# Verification

Last full local verification: 2026-06-17.

## Python

```powershell
.venv\Scripts\ruff.exe format .
.venv\Scripts\ruff.exe check .
.venv\Scripts\python.exe -m pytest
```

Result: `20 passed`, including API endpoint tests, static packet drift
protection, workflow gates, receipt hash chaining, decision graph checks,
digest verification, and mocked Band spike ordering.

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
curl.exe -fsSL https://recallops.gudman.xyz/api/receipts
curl.exe -fsSL https://recallops.gudman.xyz/api/decision-graph
curl.exe -fsSL https://recallops.gudman.xyz/api/verify
```

Playwright desktop and mobile smoke should show `RecallOps Command Room`, zero
fresh console warnings/errors, and no horizontal overflow.

Result: `recallops.service` and `recallops-api.service` were active on the VPS.
Public web and API `curl` checks passed. Playwright confirmed
`RecallOps Command Room`, visible proof mode, visible API links, packet API
click-through, zero fresh console warnings/errors, and no horizontal overflow at
desktop and mobile widths.
