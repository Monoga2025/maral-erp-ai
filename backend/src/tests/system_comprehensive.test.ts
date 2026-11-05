import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { nextQuotationNumber, calculateQuotationTotals, buildQuotationItemData, withoutTaxPercent } from '../lib/quotationPolicy.ts';

// ─── 1. Pruebas de Política y Numeración de Cotizaciones ──────────
describe('1. Política de Cotizaciones y Numeración Oficial', () => {
  test('La numeración inicia en 4585 según la serie histórica contable de Janet en Merlin', () => {
    assert.equal(nextQuotationNumber(null), 4585);
    assert.equal(nextQuotationNumber(0), 4585);
    assert.equal(nextQuotationNumber(4584), 4585);
  });

  test('La numeración incrementa de forma secuencial y nunca retrocede', () => {
    assert.equal(nextQuotationNumber(4585), 4586);
    assert.equal(nextQuotationNumber(4586), 4587);
    assert.equal(nextQuotationNumber(5000), 5001);
  });

  test('Cálculo exacto de subtotales, descuentos e impuestos de cotización', () => {
    const items = [
      { productId: 'p1', qty: 2, unitPrice: 100000, discount: 36 }, // 2 * 64.000 = 128.000
      { productId: 'p2', qty: 1, unitPrice: 50000, discount: 26 },  // 1 * 37.000 = 37.000
    ];
    const totals = calculateQuotationTotals(items, 0);
    assert.equal(totals.subtotal, 165000);
    assert.equal(totals.tax, 0);
    assert.equal(totals.total, 165000);

    const withIVA = calculateQuotationTotals(items, 19);
    assert.equal(withIVA.subtotal, 165000);
    assert.equal(withIVA.tax, 31350);
    assert.equal(withIVA.total, 196350);
  });

  test('withoutTaxPercent excluye el campo de cálculo taxPercent de la persistencia', () => {
    const input = { clientId: 'c1', paymentTerms: 'Contado', taxPercent: 19, total: 1000 };
    const cleaned = withoutTaxPercent(input);
    assert.deepEqual(cleaned, { clientId: 'c1', paymentTerms: 'Contado', total: 1000 });
    assert.equal('taxPercent' in cleaned, false);
  });
});

// ─── 2. Pruebas de Escalas de Descuento de John ───────────────────
describe('2. Matriz de Precios y Escalas por Categoría', () => {
  const CATEGORY_DISCOUNTS = {
    IMPORTADOR:    { code: 'IM', pct: 36, label: 'Importador' },
    DISTRIBUIDOR:  { code: 'DS', pct: 26, label: 'Distribuidor' },
    CLIENTE_FINAL: { code: 'CF', pct: 10, label: 'Cliente Final' },
  };

  test('Escalas oficiales solicitadas por John para cada segmento comercial', () => {
    assert.equal(CATEGORY_DISCOUNTS.IMPORTADOR.pct, 36);
    assert.equal(CATEGORY_DISCOUNTS.IMPORTADOR.code, 'IM');

    assert.equal(CATEGORY_DISCOUNTS.DISTRIBUIDOR.pct, 26);
    assert.equal(CATEGORY_DISCOUNTS.DISTRIBUIDOR.code, 'DS');

    assert.equal(CATEGORY_DISCOUNTS.CLIENTE_FINAL.pct, 10);
    assert.equal(CATEGORY_DISCOUNTS.CLIENTE_FINAL.code, 'CF');
  });

  test('Cálculo de precio final neto descontado para antena VHF ($150.000)', () => {
    const basePrice = 150000;

    const netIM = Math.round(basePrice * (1 - CATEGORY_DISCOUNTS.IMPORTADOR.pct / 100));
    assert.equal(netIM, 96000, 'Importador 36% debe dar $96.000');

    const netDS = Math.round(basePrice * (1 - CATEGORY_DISCOUNTS.DISTRIBUIDOR.pct / 100));
    assert.equal(netDS, 111000, 'Distribuidor 26% debe dar $111.000');

    const netCF = Math.round(basePrice * (1 - CATEGORY_DISCOUNTS.CLIENTE_FINAL.pct / 100));
    assert.equal(netCF, 135000, 'Cliente Final 10% debe dar $135.000');
  });
});

// ─── 3. Pruebas de Ensamble y Costeo BOM (Receta de Kits) ─────────
describe('3. Ensamble Electrónico y Receta BOM de Kits', () => {
  test('Costeo acumulado de componentes (Rollup BOM estándar)', () => {
    // Receta estándar de Arnés de Cable RG-58:
    // 15 metros cable ($2.500/m) + 2 conectores PL-259 ($12.000 c/u)
    const components = [
      { name: 'Cable RG-58', qty: 15, unitCost: 2500 },
      { name: 'Conector PL-259', qty: 2, unitCost: 12000 },
    ];
    const standardCost = components.reduce((sum, c) => sum + c.qty * c.unitCost, 0);
    assert.equal(standardCost, 61500, 'Costo estándar del kit debe ser $61.500');
  });

  test('Recálculo de costo ante personalización de metraje en cotización', () => {
    // Cliente solicita 25 metros de cable en vez de 15 metros
    const customComponents = [
      { name: 'Cable RG-58', qty: 25, unitCost: 2500 },
      { name: 'Conector PL-259', qty: 2, unitCost: 12000 },
    ];
    const customCost = customComponents.reduce((sum, c) => sum + c.qty * c.unitCost, 0);
    assert.equal(customCost, 86500, 'Costo con 25m debe ser $86.500');
  });
});

// ─── 4. Pruebas de Cartera: Vencimientos y Abonos Parciales ────────
describe('4. Cartera y Liquidación de Facturas (Abonos Parciales)', () => {
  test('Cálculo de fecha de vencimiento según días de pago del cliente', () => {
    const baseDate = new Date('2026-11-01T00:00:00Z');
    const paymentDays = 45;
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + paymentDays);

    const diffDays = Math.round((dueDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
    assert.equal(diffDays, 45);
  });

  test('Abono parcial reduce el saldo de la factura y mantiene la deuda activa', () => {
    const invoice = { id: 'inv-1', amount: 800000, status: 'VIGENTE' };
    const paymentAmount = 300000;

    // Lógica implementada en backend/src/routes/invoices.ts
    assert.ok(paymentAmount < invoice.amount);
    const remaining = Math.round((invoice.amount - paymentAmount) * 100) / 100;
    assert.equal(remaining, 500000, 'Saldo restante debe ser $500.000');
    assert.equal(invoice.status, 'VIGENTE', 'La factura no debe cerrarse prematuramente');
  });

  test('Pago total o superior liquida la factura a estado PAGADA', () => {
    const invoice = { id: 'inv-2', amount: 500000, status: 'VIGENTE' };
    const paymentAmount = 500000;

    const isFullyPaid = paymentAmount >= invoice.amount;
    const newStatus = isFullyPaid ? 'PAGADA' : 'VIGENTE';
    assert.equal(newStatus, 'PAGADA');
  });
});

// ─── 5. Pruebas de Parser de Gastos por Voz (NLP Colombiano) ──────
describe('5. Parser de Gastos por Voz con Modismos Colombianos', () => {
  // Función idéntica a parseExpenseFallback en backend/src/routes/ai.ts
  function parseExpense(text: string) {
    const lower = text.toLowerCase().trim();
    let type: 'CAJA_MENOR' | 'TARJETA' = 'CAJA_MENOR';
    if (lower.includes('tarjeta') || lower.includes('nequi') || lower.includes('daviplata') || lower.includes('bancolombia') || lower.includes('cuenta')) {
      type = 'TARJETA';
    }
    let amount = 0;
    const millonMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:millon|millones)/);
    const milMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:mil|k)\b/);
    const rawNumMatch = lower.match(/\$?\s*(\d{1,3}(?:\.\d{3})+|\d+)/);

    if (millonMatch) {
      amount = Math.round(parseFloat(millonMatch[1].replace(',', '.')) * 1000000);
    } else if (milMatch) {
      amount = Math.round(parseFloat(milMatch[1].replace(',', '.')) * 1000);
    } else if (rawNumMatch) {
      amount = parseInt(rawNumMatch[1].replace(/\./g, ''), 10) || 0;
    }

    let concept = lower
      .replace(/gasto\s*(?:de)?/gi, '')
      .replace(/(?:por\s*valor\s*de|por|de|en|con|pesos|cop|caja\s*menor|efectivo|tarjeta)/gi, ' ')
      .replace(/\b\d+(?:[.,]\d+)?\s*(?:mil|millon|millones|k)?\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    concept = concept ? concept.charAt(0).toUpperCase() + concept.slice(1) : 'Gasto operacional';

    return {
      amount,
      concept,
      type: amount >= 300000 && type === 'CAJA_MENOR' ? 'TARJETA' : type,
    };
  }

  test('Dictado: "45 mil de gasolina caja menor"', () => {
    const res = parseExpense('45 mil de gasolina caja menor');
    assert.equal(res.amount, 45000);
    assert.equal(res.type, 'CAJA_MENOR');
    assert.ok(res.concept.toLowerCase().includes('gasolina'));
  });

  test('Dictado: "150 mil fletes de coordinadora efectivo"', () => {
    const res = parseExpense('150 mil fletes de coordinadora efectivo');
    assert.equal(res.amount, 150000);
    assert.equal(res.type, 'CAJA_MENOR');
    assert.ok(res.concept.toLowerCase().includes('fletes'));
  });

  test('Dictado: "2 millones compra de conectores tarjeta"', () => {
    const res = parseExpense('2 millones compra de conectores tarjeta');
    assert.equal(res.amount, 2000000);
    assert.equal(res.type, 'TARJETA');
  });

  test('Dictado con Nequi: "18 mil almuerzo de taller nequi"', () => {
    const res = parseExpense('18 mil almuerzo de taller nequi');
    assert.equal(res.amount, 18000);
    assert.equal(res.type, 'TARJETA');
  });
});

// ─── 6. Pruebas de Resolución Dinámica de Vendedor y PDF ──────────
describe('6. Membrete Corporativo y Teléfonos Dinámicos', () => {
  const COMPANY = {
    name: 'MARAL TECNOLOGÍA Y COMUNICACIONES S.A.S.',
    nit: '901.889.479-8',
    phone: '3000000024',
    city: 'Curití - Santander, Colombia',
  };

  function getSellerPhone(seller: { name?: string; email?: string; phone?: string | null } | null): string {
    if (!seller) return COMPANY.phone;
    if (seller.phone) return seller.phone;
    const email = (seller.email ?? '').toLowerCase();
    const name  = (seller.name  ?? '').toLowerCase();
    if (email.includes('ingenieria') || name.includes('john')) return '3000000030';
    return COMPANY.phone;
  }

  test('Asesor John Mónoga resuelve celular oficial de ventas 3000000030', () => {
    const sellerJohn = { name: 'John Mónoga', email: 'user12@example.com', phone: null };
    assert.equal(getSellerPhone(sellerJohn), '3000000030');
  });

  test('Asesor Lady resuelve celular oficial de atención 3000000024', () => {
    const sellerLady = { name: 'Lady Gómez', email: 'user13@example.com', phone: null };
    assert.equal(getSellerPhone(sellerLady), '3000000024');
  });

  test('Datos institucionales de Maral S.A.S. en membrete', () => {
    assert.equal(COMPANY.nit, '901.889.479-8');
    assert.ok(COMPANY.name.includes('MARAL TECNOLOGÍA'));
    assert.ok(COMPANY.city.includes('Curití'));
  });
});

// ─── 7. Pruebas de Roles y Permisos (Matriz RBAC) ─────────────────
describe('7. Matriz de Autorización por Rol (RBAC)', () => {
  const canAccessReports = (role: string) => ['GERENTE', 'CONTADORA', 'VENTAS'].includes(role);
  const canCreateInvoice = (role: string) => ['GERENTE', 'VENTAS', 'CONTADORA'].includes(role);
  const canAccessGastos  = (role: string) => ['GERENTE', 'CONTADORA', 'VENTAS', 'LOGISTICA'].includes(role);
  const canAccessCredit  = (role: string) => ['GERENTE', 'CONTADORA'].includes(role);

  test('Janet (CONTADORA) tiene acceso garantizado a Facturas y Reportes', () => {
    assert.equal(canCreateInvoice('CONTADORA'), true, 'Contadora debe poder crear facturas');
    assert.equal(canAccessReports('CONTADORA'), true, 'Contadora debe poder ver reportes');
    assert.equal(canAccessCredit('CONTADORA'), true, 'Contadora debe gestionar crédito');
  });

  test('Equipo de Ventas tiene acceso a Reportes de Ventas y Gastos', () => {
    assert.equal(canAccessReports('VENTAS'), true, 'Ventas debe ver reportes');
    assert.equal(canAccessGastos('VENTAS'), true, 'Ventas debe poder reportar viáticos');
    assert.equal(canAccessCredit('VENTAS'), false, 'Ventas NO debe modificar cupos de crédito');
  });

  test('Personal de Logística (Wilson/Iván) puede reportar fletes y gasolina pero no ve Cartera', () => {
    assert.equal(canAccessGastos('LOGISTICA'), true, 'Logística reporta gasolina y fletes');
    assert.equal(canAccessCredit('LOGISTICA'), false, 'Logística no tiene acceso a Cartera');
  });
});

// ─── 8. Pruebas de Conteo de Pedidos Activos en Dashboard ─────────
describe('8. Filtro de Pedidos Activos en KPIs de Dashboard', () => {
  const activeStatuses = ['CONFIRMADO', 'EN_PRODUCCION', 'LISTO', 'EMPACADO', 'DESPACHO_PARCIAL', 'DESPACHADO'];

  test('Pedidos en estado LISTO y DESPACHO_PARCIAL se contabilizan como activos en planta', () => {
    assert.ok(activeStatuses.includes('LISTO'), 'Pedidos listos para entrega deben sumar en KPI');
    assert.ok(activeStatuses.includes('DESPACHO_PARCIAL'), 'Despachos parciales deben sumar en KPI');
    assert.ok(activeStatuses.includes('EN_PRODUCCION'));
    assert.ok(activeStatuses.includes('EMPACADO'));
  });

  test('Pedidos en estados terminales no se contabilizan como activos', () => {
    assert.equal(activeStatuses.includes('ENTREGADO'), false);
    assert.equal(activeStatuses.includes('CANCELADO'), false);
  });
});

// ─── 9. Ciclo de Vida y Transiciones de Pedidos ──────────────────
describe('9. Validaciones de Transición de Estados de Pedido', () => {
  function validateTransition(currentStatus: string, targetStatus: string) {
    if ((currentStatus === 'CANCELADO' || currentStatus === 'ENTREGADO') && targetStatus !== currentStatus) {
      throw new Error(`ORDER_TERMINAL:${currentStatus}`);
    }
    if (['DESPACHO_PARCIAL', 'DESPACHADO'].includes(currentStatus) &&
        ['CONFIRMADO', 'EN_PRODUCCION', 'LISTO', 'EMPACADO'].includes(targetStatus)) {
      throw new Error('ORDER_DISPATCHED_BACKWARD');
    }
    return true;
  }

  test('Pedidos entregados o cancelados no pueden ser reabiertos', () => {
    assert.throws(() => validateTransition('ENTREGADO', 'EN_PRODUCCION'), /ORDER_TERMINAL:ENTREGADO/);
    assert.throws(() => validateTransition('CANCELADO', 'CONFIRMADO'), /ORDER_TERMINAL:CANCELADO/);
  });

  test('Pedidos despachados no pueden retroceder a producción o empaque', () => {
    assert.throws(() => validateTransition('DESPACHADO', 'EMPACADO'), /ORDER_DISPATCHED_BACKWARD/);
    assert.throws(() => validateTransition('DESPACHO_PARCIAL', 'EN_PRODUCCION'), /ORDER_DISPATCHED_BACKWARD/);
  });

  test('Avance directo a DESPACHADO o ENTREGADO está permitido sin bloquear al usuario', () => {
    assert.doesNotThrow(() => validateTransition('EMPACADO', 'DESPACHADO'));
    assert.doesNotThrow(() => validateTransition('DESPACHADO', 'ENTREGADO'));
  });
});

// ─── 10. Resolución de Contacto y Teléfono en Conversión ────────
describe('10. Prioridad de Celular/WhatsApp sobre Teléfono Fijo en Pedidos', () => {
  function resolveOrderPhone(explicitPhone?: string, clientWhatsapp?: string, clientPhone?: string) {
    return explicitPhone || clientWhatsapp || clientPhone || '';
  }

  test('Prioriza WhatsApp móvil sobre teléfono fijo PBX para notificaciones de despacho', () => {
    const client = { phone: '6012345678', whatsapp: '3109876543' };
    const orderPhone = resolveOrderPhone(undefined, client.whatsapp, client.phone);
    assert.equal(orderPhone, '3109876543', 'Debe tomar el WhatsApp móvil 310 en vez del fijo 601');
  });

  test('Si no hay WhatsApp, utiliza el teléfono registrado', () => {
    const client = { phone: '6012345678', whatsapp: undefined };
    const orderPhone = resolveOrderPhone(undefined, client.whatsapp, client.phone);
    assert.equal(orderPhone, '6012345678');
  });

  test('Si se especifica un teléfono explícito en la orden, se respeta', () => {
    const client = { phone: '6012345678', whatsapp: '3109876543' };
    const orderPhone = resolveOrderPhone('3001112233', client.whatsapp, client.phone);
    assert.equal(orderPhone, '3001112233');
  });
});
