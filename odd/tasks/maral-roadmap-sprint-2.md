# MARAL OS — Roadmap Execution Sprint 2 (100+ Objetivos)

## Objective
Execute key high-impact objectives from the Master Roadmap (`maral_master_roadmap_plan.md`), focusing on CRM & Cartera (OBJ-012, OBJ-013, OBJ-015, OBJ-016), Commercial WhatsApp quote sharing (OBJ-009), and Command Palette enterprise search (OBJ-105).

## Actionable Checklist
- [x] Task 1: Add Credit Limit validation check in backend `orders.ts` and Call Notes timeline endpoint in `clients.ts`.
- [x] Task 2: Enhance `Clients.tsx` with Inactivity/Churn Risk tabs (>60 days without purchase) and 1-click WhatsApp direct chat.
- [x] Task 3: Enhance `ClientDetail.tsx` with Chronological Call Notes Timeline, Multi-contact display (Compras, Pagos, Gerencia), and 360° Lifetime Value metrics.
- [x] Task 4: Enhance `Quotations.tsx` with 1-click WhatsApp quote sharing in table row actions.
- [x] Task 5: Expand `CommandPalette.tsx` with Product/Catalog search, Credit Radar navigation, and luxury shortcut pills.
- [x] Task 6: Run full verification loop (`tsc` and `vite build`) across backend and frontend.

## Verification Evidence
- **Credit Limit Enforcement & Order Validation (OBJ-012)**:
  - Backend checks if client has `creditLimit > 0` and aggregates unpaid invoices (`VIGENTE`, `VENCIDA`).
  - Blocks or alerts if `currentCreditUsed + orderTotal > creditLimit` unless overridden.
  - Automatically updates `lastOrderAt` on client when orders are created (OBJ-015).
- **Call Notes Timeline & Bitácora Cronológica (OBJ-013 & OBJ-016)**:
  - Added endpoint `POST /api/clients/:id/call-notes` appending timestamped, user-attributed call entries to `callNotes`.
  - Added modern `CallNotesTimeline` logger in `ClientDetail.tsx` under "Notas" tab.
  - Added Multi-contact cards for Owner, Purchase Contact, Secretary, and Additional Contact.
- **Inactivity & Churn Risk Radar (OBJ-015)**:
  - Added Activity Tabs (`Todos`, `Activos <30d`, `En Riesgo 30-60d`, `Inactivos >60d`, `Sin Pedidos`) in `Clients.tsx`.
  - Added visual badges and contextual 1-click WhatsApp reactivation messages.
  - Added Churn Risk alert banner in `ClientDetail.tsx`.
- **Quotations 1-Click WhatsApp Sharing (OBJ-009)**:
  - Added WhatsApp share action in `Quotations.tsx` table rows formatting official quote number, total COP, and valid-until date.
- **Command Palette Enterprise Search Expansion (OBJ-105)**:
  - Added live Catalog Product search with stock count and COP prices.
  - Added direct navigation to Radar de Cartera, Cotizador Flash, and CRM.
- **Build Verification**:
  - `npm --prefix backend run typecheck`: Exit code 0.
  - `npm --prefix frontend run typecheck`: Exit code 0.
  - `npm --prefix frontend run build`: Exit code 0 (3285 modules transformed in 6.59s).

## Chosen Route per Task
- Task 1: Direct inline (Backend credit validation & call notes route)
- Task 2: Direct inline (Frontend CRM inactivity tabs & WhatsApp action)
- Task 3: Direct inline (ClientDetail call notes timeline & multi-contact)
- Task 4: Direct inline (Quotations table 1-click WhatsApp sharing)
- Task 5: Direct inline (CommandPalette product search & navigation)
- Task 6: Direct inline (Build and typecheck verification)
