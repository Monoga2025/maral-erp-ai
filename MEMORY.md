# MEMORY.md — Memoria Persistente de MARAL OS

> Documento de memoria viva del proyecto para agentes de IA (Claude Code, Antigravity, OpenCode).
> Actualizado: 2026-11-05

---

## 1. Identidad y Contexto de Negocio
- **Empresa**: MARAL TECNOLOGÍA Y COMUNICACIONES S.A.S. (NIT 901.889.479-8).
- **Régimen**: No responsable de IVA. Ubicación: Curití - Santander, Colombia.
- **Negocio**: Ensamble y comercialización B2B de antenas, cables coaxiales, conectores, amplificadores y equipos de telecomunicaciones.
- **Propósito**: Plataforma operativa y ERP comercial que soporta el sustento y flujo de caja diario de la empresa.

---

## 2. Usuarios Clave y Roles (Personas)
1. **John Mónoga** (`GERENTE` / Ventas / Operaciones):
   - Celular oficial: `3000000030` | Correo: `user12@example.com`
   - Firma PDF: *Gerente de Proyectos — MARAL TECNOLOGÍA Y COMUNICACIONES S.A.S.*
2. **Lady** (`VENTAS` / Atención Comercial):
   - Celular oficial: `3000000024` | Correo: `user37@example.com`
   - Firma PDF: *Atención Comercial — MARAL TECNOLOGÍA Y COMUNICACIONES S.A.S.*
3. **Janet** (`CONTADORA` / Cartera / Facturación DIAN):
   - Gestiona la contabilidad en el software satélite legacy **Merlin** (Access `.accdb`).
   - Acceso garantizado en MARAL OS a Facturas (`/credito`), Cartera y Reportes (`/reportes`).
4. **Wilson / Iván** (`LOGISTICA` / Taller / Ensambladores):
   - Ensamblan pedidos, registran compras operativas, gasolina y fletes en `/gastos`.
   - No deben ver márgenes ni cupos de crédito de clientes.

---

## 3. Reglas de Oro Arquitectónicas
- **Integración con Merlin (Solo Lectura)**:
  - MARAL OS **NUNCA** escribe directamente en tablas de Merlin (`VENMovimientos`, `CXCMovimientos`).
  - Base de datos de producción preserva **1.384 clientes y 283 productos** migrados.
  - La factura electrónica legal ante la DIAN es emitida exclusivamente por Janet en Merlin.
- **Protección de Datos Maestros**:
  - `STARTUP_SEED_ENABLED=false` obligatorio en entornos con datos reales para evitar sobrescrituras de catálogo.
- **Metodología Gentle AI / Gentle Shell**:
  - Cambios acotados, no destructivos, sin regresiones y verificados con pruebas automatizadas.

---

## 4. Políticas de Negocio y Fórmulas Core

### A. Cotizaciones y Numeración
- **Folio inicial**: Inicia en **4585** según la serie contable de Janet en Merlin (`nextQuotationNumber(max) = Math.max(4585, max + 1)`).
- **Descuentos por categoría**:
  - `IM` (Importador): **36%**
  - `DS` (Distribuidor): **26%**
  - `CF` (Cliente Final): **10%**
- **PDF de Cotización**:
  - Altura de fila dinámica con `doc.heightOfString()` para evitar solapamiento de nombres largos.
  - Subtotal ampliado a 70pt.
  - Teléfono y firma del asesor remitente resuelto dinámicamente según quién cotiza.

### B. Ciclo de Vida del Pedido (Order Transitions)
- Estados: `CONFIRMADO` → `EN_PRODUCCION` → `LISTO` → `EMPACADO` → `DESPACHADO` → `ENTREGADO`.
- `CANCELADO` y `ENTREGADO` son terminales (inmutables).
- Un pedido en despacho no puede retroceder a producción o empaque.
- Transición directa a `DESPACHADO` o `ENTREGADO` permitida para despachos rápidos y retiro en planta (Wilson/Iván), disparando notificaciones de WhatsApp y generación de factura a crédito si aplica.

### C. Cartera y Abonos Parciales
- `PUT /api/invoices/:id/pay` acepta pagos parciales:
  - Si `monto >= saldo`: status `PAGADA`, `paidAt` sellado.
  - Si `monto < saldo`: saldo reducido atómicamente (`amount -= monto`), status `VIGENTE`/`VENCIDA`, registro del abono en `ActivityLog`.

### D. Ensamble Electrónico (BOM)
- Kits compuestos por bobinas de cable, conectores, jumpers y ensamble técnico.
- Rollup automático de costos; ante cambio de metraje se recalcula el costo unitario de cable y tiempo de armado.

---

## 5. Motores REA Odoo Integrados a MARAL OS (2026-11-05)
A través de la metodología REA (Reverse Engineer Anything), se extrajeron y adaptaron 4 motores de alta fidelidad desde los módulos de Odoo Community a TypeScript nativo de ultra alto rendimiento:
1. **Pricing & Margin Engine** (`backend/src/lib/pricingEngine.ts`):
   - Inspirado en `sale`/`sale_margin`/`pricelist`.
   - Control de márgenes mínimos (saludable, advertencia, crítico <15%), vigencia dinámica de cotizaciones (15 días) y generación de enlace directo para aprobación/envío por WhatsApp.
2. **Stock & Backorders Engine** (`backend/src/lib/stockEngine.ts`):
   - Inspirado en `stock`/`stock_warehouse_orderpoint`/`delivery`.
   - Cálculo de stock pronosticado ($Physical - Reserved + Incoming$), disparador de órdenes de reposición y generación automática de backorders ante despachos parciales.
   - Constructor de URLs de rastreo directo para Coordinadora, Servientrega, Envía, Inter Rapidísimo y TCC.
3. **Telecom BOM & Electronics Assembly Engine** (`backend/src/lib/telecomBomEngine.ts`):
   - Inspirado en `mrp`/`mrp_subcontracting`.
   - Explosión recursiva multinivel de BOMs con merma técnica de corte de coaxial (scrap ~6%), kits virtuales (`KIT_PHANTOM`) que descuentan materias primas en despacho sin alterar stock ficticio del padre, y rollup industrial de costos con mano de obra directa.
4. **DIAN Electronic Invoicing Engine** (`backend/src/lib/dianSigner.ts`, `backend/src/lib/dianSoap.ts`, `backend/src/lib/dianNotes.ts`):
   - Inspirado en `l10n_co_edi`/`l10n_co_dian` (Software Propio).
   - Generación de CUFE (facturas con Clave Técnica) y CUDE (Notas Crédito/Débito con PIN de software).
   - Canonicalización C14N 1.0, firma digital XAdES-EPES con política DIAN v2, empaquetador nativo ZIP DEFLATE en memoria sin librerías pesadas externas y envoltura SOAP WCF (`SendBillSync` / `SendTestSetAsync`).
   - Inmutabilidad estricta de base gravable nominal para preservar el CUFE ante abonos de cartera.

---

## 6. Verificación y Suite de Pruebas
Comando unificado para validar todas las políticas y motores del sistema:
```bash
cmd /c npx tsx --test backend/src/tests/pricing_engine.test.ts backend/src/tests/stock_engine.test.ts backend/src/tests/telecom_bom_engine.test.ts backend/src/tests/dian_electronic_billing.test.ts backend/src/tests/system_comprehensive.test.ts
```
*Cobertura: 14 suites, 69 tests automatizados, 100% aprobados en ~230ms (0 fallos).*

---

## 7. Documentos de Referencia
- [PLAN_MAESTRO_REA_ODOO_A_MARAL_OS.md](file:///C:/Users/Monoga/.gemini/antigravity-cli/brain/a7148626-2014-457a-a0d7-60c29cdedf21/PLAN_MAESTRO_REA_ODOO_A_MARAL_OS.md)
- [ESQUEMA_MAESTRO_DE_VARIABLES_MARAL_OS.md](file:///C:/Users/Monoga/.gemini/antigravity-cli/brain/a7148626-2014-457a-a0d7-60c29cdedf21/ESQUEMA_MAESTRO_DE_VARIABLES_MARAL_OS.md)
- [AUDITORIA_FUNCIONAL_Y_USABILIDAD_MARAL_OS.md](file:///C:/Users/Monoga/.gemini/antigravity-cli/brain/a7148626-2014-457a-a0d7-60c29cdedf21/AUDITORIA_FUNCIONAL_Y_USABILIDAD_MARAL_OS.md)
- [ROADMAP_EJECUCION_MARAL_OS.md](file:///C:/Users/Monoga/.gemini/antigravity-cli/brain/a7148626-2014-457a-a0d7-60c29cdedf21/ROADMAP_EJECUCION_MARAL_OS.md)
- [INFORME_MAESTRO_INVESTIGACION_MARAL_OS.md](file:///C:/Users/Monoga/.gemini/antigravity-cli/brain/a7148626-2014-457a-a0d7-60c29cdedf21/INFORME_MAESTRO_INVESTIGACION_MARAL_OS.md)
