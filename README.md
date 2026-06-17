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
successful live Band spike: room creation, Evidence recruitment, `@mention`
handoff, Evidence acknowledgement, and context fetch.

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

## Band Spike

Day-0 spike goal:

- create a real Band room as the Commander agent
- recruit an Evidence agent into that room
- send an `@mention` handoff
- receive an Evidence reply through the Band WebSocket runtime
- fetch Band room context and print a proof summary with room/message IDs

## Spike Setup

Install dependencies:

```powershell
uv sync --extra dev
```

Create `agent_config.yaml` from `agent_config.yaml.example` and fill in two Band remote-agent credentials:

- `commander`
- `evidence`

Run the live spike:

```powershell
uv run python scripts/band_spike.py
```

Latest live proof captured:

- room: `9729673d-d6ce-4715-83e9-8cfaa17885f2`
- Evidence ack: `23fcfb46-0f78-4b73-b842-35c054ac4d58`
- context items: `3`

No final hackathon submission will be made without explicit approval.
