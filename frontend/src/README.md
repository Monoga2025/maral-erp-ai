# src

- `App.tsx`: route table. Desktop routes cover dashboard, clients, quotations, orders, WhatsApp, campaigns, production, inventory, purchasing, credit, expenses, reports, catalog and settings. Mobile variants replace some pages.
- `pages/`: one screen per module, plus `pages/mobile/`. See `pages/README.md`.
- `components/`: shared UI, layout, campaign studio, dashboard widgets and the in-app tour. See `components/README.md`.
- `lib/api.ts`: Axios client for the backend. `lib/offlineQueue.ts` queues writes while offline. `lib/contracts.ts` holds shared request shapes.
- `store/`: Zustand stores for auth (`auth.ts`) and UI state (`ui.ts`).
- `hooks/`: `useMobile`, `usePWAInstall`.
- `types/index.ts`: domain types used across pages.
