# RecallOps

Band-native command room for live product-recall decisions.

Public demo: https://ridwan.gudman.xyz/recallops

![RecallOps command room](docs/cover.png)

The demo models a battery-pack recall for lot `BAT-4421`: Evidence extracts the
incident, Traceability finds an 82% coverage gap, Regulatory/Risk vetoes the plan,
Traceability recovers the missing distributor file, Communications drafts notices,
and the QA Director approves a SHA-256 sealed packet.

## Why It Fits Band

RecallOps is built around a room, not a single assistant. The workflow needs
specialists to join, disagree, hand off work, and preserve the decision trail:

- Incident Commander opens the room and recruits specialists as risk increases.
- Evidence Agent extracts product, defect, lot, and severity.
- Traceability Agent maps lot `BAT-4421` across shipments, stock, customers, and regions.
- Regulatory/Risk Officer vetoes the recall plan while 864 units remain untraced.
- Communications Agent drafts regulator, customer, and quarantine notices after approval.
- QA Director is the human approval gate.

The command-room surface exposes room ID, participant count, event count,
message IDs, veto ID, approval ID, proof mode, and audit hash so the
collaboration proof is visible during the demo. The BAT-4421 recall transcript
is a deterministic demo packet, and `docs/band-spike-proof.json` captures a
successful live five-agent Band workflow: room creation, dynamic recruitment,
`@mention` handoffs, traceability gap, risk veto, re-plan, risk approval,
communications notice, and context fetch.

## Hackathon Alignment

Track: Regulated & High-Stakes Workflows.

- More than 3 agents: 5 agent roles plus a human approver.
- Cross-framework target architecture: Band SDK, Pydantic-style extraction, LangGraph-style traceability flow, and CrewAI-style risk review roles.
- Band-native mechanics: recruitment, `@mention` handoffs, veto, re-plan, approval, and room transcript proof.
- Enterprise value: compresses product-recall triage from fragmented meetings into one auditable decision room.
- Presentation hook: live exposure clock, visible veto, recovered missing distributor file, final sealed packet.

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

- `https://ridwan.gudman.xyz/recallops-api/api/health`
- `https://ridwan.gudman.xyz/recallops-api/api/packet`
- `https://ridwan.gudman.xyz/recallops-api/api/transcript`
- `https://ridwan.gudman.xyz/recallops-api/api/proof`
- `https://ridwan.gudman.xyz/recallops-api/api/packet.json`

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
