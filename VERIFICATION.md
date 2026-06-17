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
`RecallOps Command Room`, visible `deterministic_demo` proof mode, visible API
links, packet API click-through, zero fresh console warnings/errors, and no
horizontal overflow at desktop and mobile widths.
