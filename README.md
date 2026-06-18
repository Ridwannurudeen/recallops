# RecallOps

Band-native command room for live product-recall decisions.

Public demo: https://recallops.gudman.xyz

![RecallOps command room](docs/cover.png)

The deployed demo uses a deterministic battery-pack recall for lot `BAT-4421`
so judges can replay the same incident every time: Evidence extracts the
incident, Traceability finds an 82% coverage gap, Regulatory/Risk vetoes the
plan, Traceability recovers the missing distributor file, Communications drafts
notices, and the QA Director approves a SHA-256 audit digest.

## Why It Fits Band

RecallOps is built around a room, not a single assistant. The workflow needs
specialists to join, disagree, hand off work, and preserve the decision trail:

- Incident Commander opens the room and recruits specialists as risk increases.
- Evidence Agent extracts product, defect, lot, and severity.
- Traceability Agent maps lot `BAT-4421` across shipments, stock, customers, and regions.
- Regulatory/Risk Officer vetoes the recall plan while 864 units remain untraced.
- Communications Agent drafts regulator, customer, and quarantine notices after approval.
- QA Director is the human approval gate.

The command-room surface exposes packet room ID, captured Band room ID,
captured agent count, event count, message IDs, veto ID, approval ID, proof
mode, receipt chain, decision graph, source citations, editable shipment CSV,
computed traceability, approval receipt, and audit hash. The BAT-4421
transcript is deterministic, and `docs/band-spike-proof.json` captures a
successful Band room run: five configured Band identities, dynamic recruitment,
`@mention` handoffs, traceability gap, risk veto, re-plan, risk approval,
communications notice, and context fetch.

## Hackathon Alignment

Track: Regulated & High-Stakes Workflows.

- More than 3 agents: 5 agent roles plus a human approver.
- Cross-framework target architecture: current demo uses Band SDK plus deterministic role logic; the adapter target maps Evidence to Pydantic AI, Traceability to LangGraph, and Risk review to CrewAI.
- Band-native mechanics: recruitment, `@mention` handoffs, veto, re-plan, approval, and captured room transcript proof.
- Source-grounded evidence: complaint text and shipment CSV are parsed into facts, citations, coverage snapshots, source digests, and a recomputable approval receipt.
- Partner AI path: `/api/source-evidence` can call Featherless for evidence extraction and AI/ML API for risk review through their OpenAI-compatible chat APIs when provider keys are configured; response hashes and compact JSON outputs are surfaced in the cockpit.
- Enterprise value: compresses product-recall triage from fragmented meetings into one auditable decision room.
- Presentation hook: live drill mode, source cockpit, exposure clock, visible veto, recovered missing distributor file, receipt chain, and final packet.

## Product Demo

Generate the tested recall packet:

```powershell
.venv\Scripts\python.exe scripts\generate_demo_packet.py
```

Run the command-room UI:

```powershell
cd web
npm install
npm run dev -- --port 3068
```

Run the local API:

```powershell
.venv\Scripts\uvicorn.exe recallops.api:app --host 127.0.0.1 --port 8098
```

Public API endpoints:

- `https://recallops.gudman.xyz/api/health`
- `https://recallops.gudman.xyz/api/packet`
- `https://recallops.gudman.xyz/api/transcript`
- `https://recallops.gudman.xyz/api/proof`
- `https://recallops.gudman.xyz/api/band-proof`
- `https://recallops.gudman.xyz/api/live-drill`
- `https://recallops.gudman.xyz/api/source-evidence`
- `https://recallops.gudman.xyz/api/source-evidence/verify`
- `https://recallops.gudman.xyz/api/partner-ai/status`
- `https://recallops.gudman.xyz/api/spend-limits`
- `https://recallops.gudman.xyz/api/integrations`
- `https://recallops.gudman.xyz/api/ops-readiness`
- `https://recallops.gudman.xyz/api/enterprise-sync`
- `https://recallops.gudman.xyz/api/identity/status`
- `https://recallops.gudman.xyz/api/identity-approval`
- `https://recallops.gudman.xyz/api/erp-contract/status`
- `https://recallops.gudman.xyz/api/erp-contract/receipts`
- `https://recallops.gudman.xyz/api/rules`
- `https://recallops.gudman.xyz/api/notifications/dry-run`
- `https://recallops.gudman.xyz/api/cases`
- `https://recallops.gudman.xyz/api/approval-receipt`
- `https://recallops.gudman.xyz/api/submission-proof`
- `https://recallops.gudman.xyz/api/receipts`
- `https://recallops.gudman.xyz/api/decision-graph`
- `https://recallops.gudman.xyz/api/verify`
- `https://recallops.gudman.xyz/api/packet.json`

Production check:

```powershell
cd web
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

Python verification:

```powershell
.venv\Scripts\python.exe -m ruff format .
.venv\Scripts\python.exe -m ruff check --fix .
.venv\Scripts\python.exe -m pytest
```

`GET /api/submission-proof` returns a safe judge bundle without spending partner
AI credits. `POST /api/submission-proof` runs the live partner AI proof path and
returns the same bundle with partner provider usage.

Production hardening surfaces:

- SQLite case records via `/api/cases`.
- Deterministic jurisdiction checks via `/api/rules`.
- Dispatch-ready dry-run notification receipts via `/api/notifications/dry-run`.
- Enterprise adapter readiness via `/api/integrations`.
- SAP/Oracle recall payloads and credential-gated live write path via `/api/enterprise-sync`.
- Identity-gated approval receipts via `/api/identity-approval`, using either a server-side approval key or OIDC/JWKS verification when configured.
- Tenant-shaped ERP contract receiver receipts via `/api/erp-contract/receipts`.
- Credit-spend guardrails via `/api/spend-limits`.

SAP/Oracle live adapter configuration:

- SAP: set `RECALLOPS_SAP_BASE_URL`, `RECALLOPS_SAP_API_KEY` or SAP basic-auth envs, and `RECALLOPS_SAP_RECALL_PATH` or `RECALLOPS_SAP_RECALL_URL`.
- Oracle SCM: set `RECALLOPS_ORACLE_SCM_URL`, `RECALLOPS_ORACLE_SCM_TOKEN` or Oracle basic-auth envs, and `RECALLOPS_ORACLE_SCM_RECALL_PATH` or `RECALLOPS_ORACLE_SCM_RECALL_URL`.
- Live writes additionally require `RECALLOPS_ENABLE_ENTERPRISE_WRITES=1` and an admin action key sent as `X-RecallOps-Admin-Key`.
- Without those tenant settings, `/api/enterprise-sync` stays in dry-run mode and exposes the exact payload hash without writing to external ERP systems.

Enterprise identity configuration:

- Server-gated approvals: set `RECALLOPS_APPROVAL_ADMIN_KEY` and call `/api/identity-approval` with `X-RecallOps-Approval-Key`.
- OIDC approvals: set `RECALLOPS_OIDC_ISSUER`, `RECALLOPS_OIDC_AUDIENCE`, and `RECALLOPS_OIDC_JWKS_URL`; send an RS256 bearer token to `/api/identity-approval`.
- ERP contract receiver proof: set `RECALLOPS_ERP_CONTRACT_TOKEN` and point SAP/Oracle recall URLs at `/api/erp-contract/sap` and `/api/erp-contract/oracle` for a tenant-shaped live adapter smoke before using a real tenant.

## Band Live Workflow

Live workflow goal:

- create a real Band room as the Commander agent
- recruit Evidence, Traceability, Risk, and Communications into that room
- send `@mention` handoffs between each specialist
- execute a veto, re-plan, approval, and notice chain
- fetch Band room context and print a proof summary with room/message IDs

## Spike Setup

Install dependencies:

```powershell
uv sync --extra dev
```

Create `agent_config.yaml` from `agent_config.yaml.example` and fill in five Band remote-agent credentials:

- `commander`
- `evidence`
- `traceability`
- `risk`
- `communications`

Run the live workflow:

```powershell
uv run python scripts/band_spike.py
```

Latest live proof captured:

- room: `6dcd1018-bce3-481f-88d6-1ab67f6db452`
- Risk veto: `bed6e1f4-f1cd-48a4-8f36-c09d7d9c9de9`
- Communications notice: `db2e10f0-f8f6-4fc4-a324-c99929911500`
- participants: `5`
- context items: `8`

No final hackathon submission will be made without explicit approval.
