# RecallOps

Band-native command room for live product-recall decisions.

The demo models a battery-pack recall for lot `BAT-4421`: Evidence extracts the
incident, Traceability finds an 82% coverage gap, Regulatory/Risk vetoes the plan,
Traceability recovers the missing distributor file, Communications drafts notices,
and the QA Director approves a SHA-256 sealed packet.

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

Current gate: a human Band API key or manual Band UI agent creation is required
to obtain the two remote-agent credentials. The local product demo remains
deterministic until `agent_config.yaml` exists.

No final hackathon submission will be made without explicit approval.
