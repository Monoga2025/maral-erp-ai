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

## 5. Verificación y Suite de Pruebas
Comando único para validar todas las políticas del sistema:
```bash
node --test backend/src/lib/quotationPolicy.test.ts backend/src/lib/startupPolicy.test.ts backend/src/tests/system_comprehensive.test.ts
```
*Cobertura: 10 suites, 35 tests, 100% aprobados en ~300ms.*

---

## 6. Documentos de Referencia
- [ESQUEMA_MAESTRO_DE_VARIABLES_MARAL_OS.md](file:///C:/Users/Monoga/.gemini/antigravity-cli/brain/a7148626-2014-457a-a0d7-60c29cdedf21/ESQUEMA_MAESTRO_DE_VARIABLES_MARAL_OS.md)
- [AUDITORIA_FUNCIONAL_Y_USABILIDAD_MARAL_OS.md](file:///C:/Users/Monoga/.gemini/antigravity-cli/brain/a7148626-2014-457a-a0d7-60c29cdedf21/AUDITORIA_FUNCIONAL_Y_USABILIDAD_MARAL_OS.md)
- [ROADMAP_EJECUCION_MARAL_OS.md](file:///C:/Users/Monoga/.gemini/antigravity-cli/brain/a7148626-2014-457a-a0d7-60c29cdedf21/ROADMAP_EJECUCION_MARAL_OS.md)
- [INFORME_MAESTRO_INVESTIGACION_MARAL_OS.md](file:///C:/Users/Monoga/.gemini/antigravity-cli/brain/a7148626-2014-457a-a0d7-60c29cdedf21/INFORME_MAESTRO_INVESTIGACION_MARAL_OS.md)
