# lib

Business rules, integrations and AI clients. Route files stay thin and call into here.

- **Quotations:** `quotationPolicy.ts` (totals, line discounts, numbering that starts at 945), with unit tests.
- **Startup:** `startupPolicy.ts` (feature flags for seed and background jobs), with unit tests.
- **DIAN:** `dian.ts`, UBL 2.1 XML and CUFE generation.
- **WhatsApp and outreach:** `evolutionApi.ts` (gateway client), `campaign-sender.ts` and `campaign-queue.ts` (send worker), `drip-scheduler.ts`, `pacing.ts`, `notifier.ts`, `campaign-vars.ts`, `audience-query.ts`.
- **AI:** `marco.ts` (campaign generator and photo analysis), `image-gen.ts`, `brand-guard.ts`, `lead-classifier.ts`, `cost-tracker.ts`.
- **Analytics (no LLM):** `purchase-predictor.ts`, `forbidden-patterns.ts`, `best-time.ts`, `experiment-registry.ts`.
- **Catalog:** `sync_catalog.ts` (catalog loader), `syscomScraper.ts` (competitor price reader).
- **Infrastructure:** `prisma.ts` (client), `jwt.ts`, `autoSeed.ts`.
