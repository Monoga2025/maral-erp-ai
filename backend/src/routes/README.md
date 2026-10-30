# routes

One Express router per module, mounted under `/api/<name>` in `src/index.ts`.

| Module | Mount | Notes |
|---|---|---|
| Auth | `/api/auth` | ID-number login (`login-cedula`), email login, `me`, user list |
| Clients | `/api/clients` | CRM records, upsert by merlin code |
| Products / Categories / Tags / Segments | `/api/products`, `/api/categories`, `/api/tags`, `/api/segments` | catalog and audience building |
| Quotations | `/api/quotations` | builder, totals, PDF and HTML output (has `quotations.test.ts`) |
| Orders / Production / Inventory / Purchases / Suppliers | `/api/orders`, `/api/production`, `/api/inventory`, `/api/purchases`, `/api/suppliers` | order pipeline, production phases, stock movements |
| Invoices / DIAN | `/api/invoices`, `/api/dian` | DIAN configuration and electronic invoice flow |
| Expenses / Tasks | `/api/expenses`, `/api/tasks` | expenses and task board |
| Dashboard / Reports | `/api/dashboard`, `/api/reports` | KPIs and reports |
| Users / Notifications / Uploads | `/api/users`, `/api/notifications`, `/api/uploads` | user administration, alerts, file uploads |
| WhatsApp | `/api/whatsapp` | chats, send, media, webhook, reply suggestions, pre-quote |
| Campaigns / Image generation | `/api/campaigns`, `/api/image-gen` | campaign wizard, Marco, image studio |
| AI | `/api/ai` | briefing, autofill, voice expenses, quotation photo parsing |
| Prospecting / Competitors | `/api/prospecting`, `/api/competitors` | lead pipeline and competitor price tracking |
