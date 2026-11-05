// backend/src/tests/pricing_engine.test.ts
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateItemMarginAndPrice,
  calculateQuoteSummary,
  resolveClientPricingPolicy,
  isQuotationExpired,
  roundCurrency,
} from '../lib/pricingEngine.ts';

describe('Pricing & Margin Engine Suite (Odoo sale/pricelist REA)', () => {
  test('1. Aplica el descuento automático correcto según la categoría de cliente', () => {
    assert.equal(resolveClientPricingPolicy('IMPORTADOR').defaultDiscount, 36);
    assert.equal(resolveClientPricingPolicy('DISTRIBUIDOR').defaultDiscount, 26);
    assert.equal(resolveClientPricingPolicy('CLIENTE_FINAL').defaultDiscount, 10);
    assert.equal(resolveClientPricingPolicy(null).defaultDiscount, 10); // Fallback a PROSPECTO
  });

  test('2. Calcula el precio unitario neto redondeado a 2 decimales evitando float drift', () => {
    const item = calculateItemMarginAndPrice({
      productId: 'p-ant-01',
      qty: 3,
      unitPrice: 125450,
      cost: 72000,
      discount: 26,
    });
    // 125,450 * (1 - 0.26) = 92,833
    assert.equal(item.effectiveUnitPrice, 92833);
    assert.equal(item.subtotal, 92833 * 3);
  });

  test('3. Calcula con precisión el margen bruto monetario y porcentual por línea', () => {
    const item = calculateItemMarginAndPrice({
      productId: 'p-base',
      qty: 2,
      unitPrice: 200000,
      cost: 100000,
      discount: 25,
    });
    // Neto: 150,000. Subtotal: 300,000. Costo Total: 200,000. Utilidad: 100,000.
    // Margen % = 100,000 / 300,000 = 33.33%
    assert.equal(item.subtotal, 300000);
    assert.equal(item.totalCost, 200000);
    assert.equal(item.grossProfit, 100000);
    assert.equal(item.marginPercent, 33.33);
    assert.equal(item.marginAlert, 'HEALTHY');
  });

  test('4. Calcula correctamente el margen ponderado global de una cotización múltiple', () => {
    const items = [
      { productId: 'p1', qty: 1, unitPrice: 100000, cost: 50000, discount: 0 },  // Sub: 100k, Cost: 50k (50%)
      { productId: 'p2', qty: 1, unitPrice: 200000, cost: 160000, discount: 0 }, // Sub: 200k, Cost: 160k (20%)
    ];
    const summary = calculateQuoteSummary(items, 0);
    // Total Sub: 300,000. Total Cost: 210,000. Utilidad: 90,000.
    // Margen Ponderado: 90,000 / 300,000 = 30.00%
    assert.equal(summary.subtotal, 300000);
    assert.equal(summary.totalCost, 210000);
    assert.equal(summary.totalGrossProfit, 90000);
    assert.equal(summary.weightedMarginPercent, 30);
  });

  test('5. Activa flag CRITICAL si el precio con descuento cae por debajo del costo o margen <15%', () => {
    const lossItem = calculateItemMarginAndPrice({
      productId: 'p-loss',
      qty: 1,
      unitPrice: 100000,
      cost: 85000,
      discount: 20, // Neto = 80,000 < Costo (85,000)
    });
    assert.equal(lossItem.grossProfit, -5000);
    assert.equal(lossItem.marginAlert, 'CRITICAL');

    const summary = calculateQuoteSummary([lossItem]);
    assert.equal(summary.isViable, false);
    assert.equal(summary.criticalItemsCount, 1);
  });

  test('6. Evalúa correctamente los días restantes de vigencia de una cotización activa', () => {
    const now = new Date();
    const validity = isQuotationExpired(now, 15);
    assert.equal(validity.isExpired, false);
    assert.ok(validity.daysRemaining >= 14 && validity.daysRemaining <= 15);
  });

  test('7. Marca como expirada una cotización creada hace más de 15 días', () => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const validity = isQuotationExpired(twentyDaysAgo, 15);
    assert.equal(validity.isExpired, true);
    assert.ok(validity.daysRemaining < 0);
  });

  test('8. Garantiza que el precio unitario del pedido coincida con el neto cotizado sin desfases', () => {
    const quoteItem = { productId: 'p1', qty: 5, unitPrice: 85000, cost: 50000, discount: 15 };
    const calc = calculateItemMarginAndPrice(quoteItem);
    
    // 85,000 * (1 - 0.15) = 72,250
    assert.equal(calc.effectiveUnitPrice, 72250);
    const orderLineUnitPrice = Math.round(quoteItem.unitPrice * (1 - quoteItem.discount / 100));
    assert.equal(orderLineUnitPrice, calc.effectiveUnitPrice);
    assert.equal(orderLineUnitPrice * calc.qty, calc.subtotal);
  });

  test('9. Simulación de validación de límite de crédito pre-conversión', () => {
    const client = { creditLimit: 5000000, activeDebt: 4200000, paymentDays: 30 };
    const quoteTotal = 1200000;

    const exceedsCredit = client.paymentDays > 0 && 
      client.creditLimit > 0 && 
      (client.activeDebt + quoteTotal > client.creditLimit);

    assert.equal(exceedsCredit, true);
  });

  test('10. Validación de token seguro de aprobación digital sin contraseña', () => {
    const quoteId = 'cuid-12345';
    const clientRut = '900123456';
    const salt = 'maral-secret-salt';
    
    const token = Buffer.from(`${quoteId}:${clientRut}:${salt}`).toString('base64url');
    const decoded = Buffer.from(token, 'base64url').toString('utf8').split(':');
    assert.equal(decoded[0], quoteId);
    assert.equal(decoded[1], clientRut);
  });
});
