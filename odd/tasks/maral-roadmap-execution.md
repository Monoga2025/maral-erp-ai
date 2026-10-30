# MARAL OS — Roadmap Execution Sprint 1

## Objective
Execute key high-impact objectives from the approved Master Roadmap (`maral_master_roadmap_plan.md`), focusing on Commercial Quotation discounts & WhatsApp sharing, Credit Overdue Aging Radar, and Command Palette enterprise search.

## Actionable Checklist
- [x] Task 1: Enhance `Credit.tsx` with aging brackets (0-30, 31-60, 60+ days), filter tabs, and instant WhatsApp payment reminder action.
- [x] Task 2: Enhance `QuotationForm.tsx` with automatic segment discount suggestions and one-click WhatsApp quote sharing.
- [x] Task 3: Expand `CommandPalette.tsx` with rich shortcuts and direct entity navigation.
- [x] Task 4: Run full verification loop (`tsc` and `vite build`) across backend and frontend.

## Verification Evidence
- Enhanced Credit & Aging Radar (`frontend/src/pages/Credit.tsx`):
  - Built Aging Radar brackets (1-30d, 31-60d, 60+d mora crítica) with total values and counts.
  - Added filter tabs (Todas, Vencidas, Próximas 3d, Críticas >60d, Pagadas) with search by client or invoice #.
  - Integrated `EmptyState` component with CTA when no matching records exist.
  - 1-click WhatsApp collection reminder template per invoice.
- Build Verifications:
  - Backend compilation: `tsc` exit code 0.
  - Frontend compilation: `vite build` exit code 0 (3285 modules transformed in 6.96s).

## Chosen Route per Task
- Task 1: Direct inline (Credit.tsx UI & calculations)
- Task 2: Direct inline (QuotationForm.tsx discounts & sharing)
- Task 3: Direct inline (CommandPalette.tsx enhancements)
- Task 4: Direct inline (Build and typecheck verification)
