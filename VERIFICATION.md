# Verification

Last full local verification: 2026-06-17.

## Python

```powershell
.venv\Scripts\ruff.exe format .
.venv\Scripts\ruff.exe check .
.venv\Scripts\python.exe -m pytest
```

Result: `62 passed`, including API endpoint tests, source parser coverage,
citation integrity, partner AI missing-key checks, mocked partner AI execution,
submission proof bundle checks, SQLite case persistence, jurisdiction rules,
dispatch receipts, SAP/Oracle sync payloads, identity-gated approval, OIDC/JWKS verification,
ERP contract receiver receipts, integration readiness, spend-limit checks, approval receipt
hashing, static packet drift protection, workflow gates, receipt hash chaining,
decision graph checks, digest verification, and mocked Band spike ordering.

## Live Band Workflow

```powershell
.venv\Scripts\python.exe scripts\band_spike.py --check-config
.venv\Scripts\python.exe scripts\band_spike.py --timeout 120
```

Result: config validation passed. The live Band workflow created room
`6dcd1018-bce3-481f-88d6-1ab67f6db452`, recruited Evidence, Traceability,
Risk, and Communications, sent Commander message
`da91fc15-fd3f-4b5a-8af1-a0b2c005c5d5`, received Evidence ack
`b33c7424-87e1-40db-9b15-558a64f608d7`, captured Risk veto
`bed6e1f4-f1cd-48a4-8f36-c09d7d9c9de9`, captured Communications notice
`db2e10f0-f8f6-4fc4-a324-c99929911500`, and fetched 8 context items with
5 participants.

## Frontend

```powershell
cd web
npm run typecheck
npm audit --audit-level=moderate
npm run build
```

Result: TypeScript passed, npm audit reported 0 vulnerabilities, and Next.js
production build succeeded.

## Public Smoke

```powershell
curl.exe -fsSL https://recallops.gudman.xyz
curl.exe -fsSL https://recallops.gudman.xyz/api/health
curl.exe -fsSL https://recallops.gudman.xyz/api/packet
curl.exe -fsSL https://recallops.gudman.xyz/api/proof
curl.exe -fsSL https://recallops.gudman.xyz/api/source-evidence
curl.exe -fsSL https://recallops.gudman.xyz/api/source-evidence/verify
curl.exe -fsSL https://recallops.gudman.xyz/api/partner-ai/status
curl.exe -fsSL https://recallops.gudman.xyz/api/spend-limits
curl.exe -fsSL https://recallops.gudman.xyz/api/integrations
curl.exe -fsSL https://recallops.gudman.xyz/api/ops-readiness
curl.exe -fsSL https://recallops.gudman.xyz/api/enterprise-sync
curl.exe -fsSL https://recallops.gudman.xyz/api/identity/status
curl.exe -fsSL https://recallops.gudman.xyz/api/erp-contract/status
curl.exe -fsSL https://recallops.gudman.xyz/api/erp-contract/receipts
curl.exe -fsSL https://recallops.gudman.xyz/api/rules
curl.exe -fsSL https://recallops.gudman.xyz/api/notifications/dry-run
curl.exe -fsSL https://recallops.gudman.xyz/api/submission-proof
curl.exe -fsSL https://recallops.gudman.xyz/api/receipts
curl.exe -fsSL https://recallops.gudman.xyz/api/decision-graph
curl.exe -fsSL https://recallops.gudman.xyz/api/verify
```

Playwright desktop and mobile smoke should show `RecallOps Command Room`, zero
fresh console warnings/errors, and no horizontal overflow.

Result: `recallops.service` and `recallops-api.service` were active on the VPS.
Public web and API checks passed, including source evidence, stable source audit
hash across repeated reads, source digest verification, partner AI status, and
approval receipt hashing. Playwright confirmed `RecallOps Command Room`, source
cockpit, approval receipt flow, visible proof mode, visible API links, zero
fresh console warnings/errors, and no horizontal overflow at desktop and mobile
widths.

Partner AI keys were configured on the VPS after the adapter path landed.
Public `/api/source-evidence` with `use_partner_ai: true` returned
`partner_ai_assisted`, `used_count: 2`, AI/ML API status `used`, Featherless
status `used`, and 64-character response hashes for both providers. The browser
`run partner ai` button shows both provider cards as `used` with response
hashes and compact JSON outputs.
The submission proof bundle GET returns packet digest verification, source
digest verification, approval receipt verification, captured Band proof, latest
fresh Band drill status, partner AI readiness, and explicit submission gates.
The enterprise sync dry-run endpoint returns SAP and Oracle recall payloads with
payload hashes and no external ERP write.
The identity status endpoint reports whether admin-key or OIDC/JWKS approval is
available, and the ERP contract receiver exposes redacted SAP/Oracle adapter
receipts after a live contract smoke.
Live `POST /api/submission-proof` returned `partner_ai_assisted`,
`partner_ai_used_count: 2`, and `partner_ai_used_both: true`. `/favicon.ico`
returns HTTP 200 so opening the raw JSON endpoint does not create a browser
console 404.
