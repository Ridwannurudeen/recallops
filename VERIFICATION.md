# Verification

Last full local verification: 2026-06-17.

## Python

```powershell
.venv\Scripts\ruff.exe format .
.venv\Scripts\ruff.exe check .
.venv\Scripts\python.exe -m pytest
```

Result: `14 passed`, including API endpoint tests, static packet drift
protection, workflow gates, and mocked Band spike ordering.

## Live Band Spike

```powershell
.venv\Scripts\python.exe scripts\band_spike.py --check-config
.venv\Scripts\python.exe scripts\band_spike.py --timeout 60
```

Result: config validation passed. The live Band spike created room
`9729673d-d6ce-4715-83e9-8cfaa17885f2`, recruited `RecallOps Evidence`,
sent Commander message `6cc0a722-521d-414e-a3a4-81a240a9b92d`, received
Evidence ack `23fcfb46-0f78-4b73-b842-35c054ac4d58`, and fetched 3 context
items.

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
curl.exe -fsSL https://ridwan.gudman.xyz/recallops
curl.exe -fsSL https://ridwan.gudman.xyz/recallops-api/api/health
curl.exe -fsSL https://ridwan.gudman.xyz/recallops-api/api/packet
curl.exe -fsSL https://ridwan.gudman.xyz/recallops-api/api/proof
```

Playwright desktop and mobile smoke should show `RecallOps Command Room`, zero
fresh console warnings/errors, and no horizontal overflow.

Result: `recallops.service` and `recallops-api.service` were active on the VPS.
Public web and API `curl` checks passed. Playwright confirmed
`RecallOps Command Room`, visible proof mode, visible API links, packet API
click-through, zero fresh console warnings/errors, and no horizontal overflow at
desktop and mobile widths.
