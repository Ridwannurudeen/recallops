<div align="center">
  <h1>RecallOps</h1>
  <p><strong>Band-native recall command room with source evidence, human sign-off, regulator drafts, and downloadable proof.</strong></p>
  <p>RecallOps turns Band into a regulated operating room: five specialist agents coordinate evidence, traceability, risk holds, filing drafts, and audit receipts while the final recall action stays owned by a named human.</p>

  <p>
    <a href="https://recallops.gudman.xyz/demo/judge"><img alt="Live demo" src="https://img.shields.io/badge/live-demo-10b981"></a>
    <img alt="Python" src="https://img.shields.io/badge/python-3.11+-3776ab">
    <img alt="Next.js" src="https://img.shields.io/badge/next.js-16-111827">
    <img alt="Tests" src="https://img.shields.io/badge/tests-74%20passing-10b981">
    <img alt="Band" src="https://img.shields.io/badge/Band-agent%20room-d4a85f">
  </p>

  <p>
    <a href="#why-recallops-exists">Why</a> ·
    <a href="#what-it-does">What it does</a> ·
    <a href="#see-it-in-action">Demo</a> ·
    <a href="#how-it-works">How it works</a> ·
    <a href="#quickstart">Quickstart</a> ·
    <a href="#honest-limitations">Limits</a>
  </p>
</div>

![RecallOps judge demo](docs/cover.png)

## Why RecallOps exists

Product recalls fail in the gaps between systems. Complaints sit in support tools, shipment rows sit in spreadsheets, regulatory review happens in meetings, ERP holds are drafted elsewhere, and the final approval trail often becomes a chain of screenshots and email fragments.

A regulated buyer cannot accept “the AI approved the recall.” The accountable action must stay with a qualified human. What the team needs is a source-grounded room where agents can gather facts, challenge unsafe action, recover missing traceability, prepare filing drafts, and leave a proof packet behind.

RecallOps uses Band as the coordination layer and wraps it with recall-specific controls: traceability math, jurisdiction rules, filing packs, e-signature gates, ERP dry-runs, and SHA-256 receipts.

## What it does

<table>
  <tr>
    <td><strong>Band-first judge demo</strong><br />The primary route, <a href="https://recallops.gudman.xyz/demo/judge">/demo/judge</a>, runs source evidence, recall room, filing pack, regulator dry-run, e-sign gate, and proof export from one guided flow.</td>
    <td><strong>Scenario selector</strong><br />Judges can run consumer battery, food contamination, medical-device, and vehicle-part recall scenarios instead of watching one hardcoded story.</td>
  </tr>
  <tr>
    <td><strong>Fresh Band attempt with honest fallback</strong><br />The judge demo calls the recall-room endpoint with <code>run_live_band: true</code>. If provider state or cooldown prevents a fresh room, the UI discloses the captured Band reference mode.</td>
    <td><strong>Visible room transcript</strong><br />The room feed shows agent, stage, and message handoffs: Evidence, Traceability, Regulatory/Risk, Communications, and QA sign-off gate.</td>
  </tr>
  <tr>
    <td><strong>Adversarial coverage toggle</strong><br />“Break shipment coverage” withholds the recovered CSV. Final coverage stays below 100%, the hold path stays active, and human sign-off remains closed.</td>
    <td><strong>Downloadable proof</strong><br />The demo exports a full audit packet plus a Band-room proof JSON with room mode, room ID, participant count, message IDs, source hash, run hash, and transcript.</td>
  </tr>
  <tr>
    <td><strong>Regulator filing pack</strong><br />CPSC, EU Safety Gate, regional distributor hold, FDA RFR screen, and NHTSA screen are drafted from the same source packet.</td>
    <td><strong>Gated enterprise actions</strong><br />SAP and Oracle payloads are public dry-runs. Real tenant writes require configured endpoints, enablement, selected targets, and an admin action key.</td>
  </tr>
</table>

Supporting surfaces: `/console` for the operator workflow, `/submission` for judge-readiness, `/proof` for raw proof inspection, `/docs` for endpoint review, and `/demo/bat-4421` for stable replay.

## See it in action

Start here: https://recallops.gudman.xyz/demo/judge

Demo path for judges:

1. Select **Consumer battery recall**.
2. Click **Run fresh Band room demo**.
3. Watch the room mode, participant count, and transcript panel.
4. Download **Band proof** or the full audit packet.
5. Enable **Break shipment coverage** and run again to prove the hold path.
6. Open `/proof` to verify the deployed proof bundle.

Cooldown-safe narration:

```text
RecallOps attempts a fresh Band room by default. If the Band provider is in cooldown or runtime state prevents a new room, the product does not fake it. It shows the captured Band reference mode, room IDs, message IDs, transcript, and proof labels so judges can distinguish live, captured, deterministic, dry-run, and gated behavior.
```

## How it works

```text
Complaint text + shipment CSV
          |
          v
Source evidence engine
- parses product, lot, defect, severity
- computes initial/final traceability
- emits citations and source digests
          |
          v
Band-backed recall room
- Commander recruits specialists
- Evidence extracts facts
- Traceability finds coverage gaps
- Regulatory/Risk raises or clears hold
- Communications prepares notices
          |
          v
Filing + dispatch layer
- regulator filing pack
- dry-run regulator dispatch
- SAP / Oracle dry-run payloads
          |
          v
Human sign-off gate
- e-signature receipt requires verified approval material
- public demo proves the gate is closed without a key
          |
          v
Proof packet
- source hash
- room run hash
- filing pack hash
- Band proof
- regulator dispatch proof
- final SHA-256 receipts
```

The same source inputs drive the room narrative, filing pack, dispatch dry-run, and proof exports. That is the core product claim.

## Quickstart

### Run locally

```powershell
uv sync --extra dev
.venv\Scripts\uvicorn.exe recallops.api:app --host 127.0.0.1 --port 8098
cd web
npm install; npm run dev -- --port 3068
```

### Try it without installing

Open `https://recallops.gudman.xyz/demo/judge`, run the guided demo, then toggle `Break shipment coverage` to prove the hold path.

### Use the API directly

```bash
curl -X POST https://recallops.gudman.xyz/api/source-evidence \
  -H "content-type: application/json" \
  -d '{
    "complaint_text":"C-901 | product: Harbor Sensor Battery Pack | lot: LOT-900 | defect: overheating | severity: critical",
    "shipment_csv":"source,distributor,region,customers,units,status\nSHIP-901,Northstar,US-West,18,240,traced\nSHIP-902,Baltic Retail,EU-North,7,80,missing",
    "recovered_shipment_csv":"source,distributor,region,customers,units,status\nSHIP-901,Northstar,US-West,18,240,traced\nSHIP-902,Baltic Retail,EU-North,7,80,traced"
  }'
```

Key routes and endpoints:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/demo/judge` | Primary judge demo with scenario selector, Band proof, failure toggle, and exports |
| `GET` | `/submission` | Judge-ready pitch, status map, demo script, and boundaries |
| `GET` | `/proof` | Human-readable proof explorer |
| `GET` | `/api/submission-proof` | Full deployed proof bundle |
| `POST` | `/api/source-evidence` | Recompute facts, traceability, citations, and source hash |
| `POST` | `/api/recall-room/run` | Run the source-bound room with optional fresh Band attempt |
| `POST` | `/api/filing-pack` | Build the multi-jurisdiction filing pack |
| `POST` | `/api/regulator-filing` | Prepare regulator dispatch dry-runs; external submission stays gated |
| `POST` | `/api/esignature-approval` | Seal human sign-off when approval identity is verified |
| `POST` | `/api/enterprise-sync` | SAP/Oracle dry-run or admin-gated live tenant action |
| `GET` | `/api/verify` | Verify the deterministic packet digest |

## Architecture

- Backend: FastAPI, deterministic recall engine, Band SDK integration, SHA-256 receipts.
- Frontend: Next.js App Router, React 19, route-level proof/demo surfaces.
- Data model: source evidence packet, rule assessment, recall room run, filing pack, dispatch receipts, e-signature receipt.
- Auth gates: approval key or OIDC/JWKS for human sign-off; admin key for live enterprise actions.
- External writes: off by default. Public demo only prepares dry-run payloads unless deployment gates are configured.
- Partner AI: optional and spend-gated. The deterministic parser remains the public source of truth.

## Project layout

```text
recallops/
  api.py                 FastAPI routes and proof bundle assembly
  source_evidence.py     Complaint and shipment parser, citations, traceability math
  recall_room.py         Source-packet-to-room narrative and Band binding
  filing_pack.py         Multi-jurisdiction filing draft generation
  regulatory.py          Regulator dispatch dry-run/live-gate layer
  esignature.py          Human sign-off receipt hashing and verification
  enterprise.py          SAP/Oracle dry-run and live-write gates
scripts/
  band_spike.py          Live Band room spike and proof capture
web/app/
  demo/judge/            Primary judge demo, Band-first transcript, exports, failure toggle
  console/               Operator workflow
  proof/                 Proof explorer
  submission/            Submission-readiness page
  recall-data.ts         Shared public copy, endpoint list, proof labels
  operator-workflow.tsx  Full practical operator flow
docs/
  band-spike-proof.json  Captured Band proof fixture
  cover.png              README screenshot
```

## Honest limitations

- Fresh Band rooms depend on configured server-side Band credentials, provider state, cooldown, and daily cap. The UI attempts fresh Band first and discloses fallback mode.
- Public regulator dispatch is a dry-run. Real external submission requires deployment gates and explicit authorization.
- Public SAP/Oracle paths are dry-runs unless real tenant endpoints and admin approval are configured.
- The e-signature receipt is Part-11-style attributable audit evidence, not a certified 21 CFR Part 11 product.
- The current room agents are deterministic specialist roles around Band coordination, not autonomous legal decision-makers.

## Roadmap

- [ ] Attach certified Part 11 e-signature provider for regulated pilots.
- [ ] Add tenant-specific SAP and Oracle sandbox mappings for a named enterprise demo.
- [ ] Add regulator-specific submission adapters after legal review.
- [ ] Add external audit replay CLI for downloaded audit packets.
- [ ] Expand scenario templates for pharma, food, vehicles, batteries, and medical devices.

## Contributing

- Keep public copy human-owned: the system recommends and prepares; the named human signs.
- Do not enable real external submissions or tenant writes without explicit approval and configured gates.
- Add tests for backend proof behavior before changing API response shapes.
- Run frontend typecheck/build after touching `web/app`.
- Do not commit secrets, `.env` files, or AI attribution footers.

## Development scripts

```powershell
.venv\Scripts\python.exe -m pytest                 # backend test suite
.venv\Scripts\python.exe -m ruff format recallops tests scripts
.venv\Scripts\python.exe -m ruff check --fix recallops tests scripts
cd web; npm run typecheck                           # TypeScript check
cd web; npm run build                               # production Next build
cd web; npm run dev -- --port 3068                  # local frontend
.venv\Scripts\uvicorn.exe recallops.api:app --host 127.0.0.1 --port 8098
```

## License and contact

License: hackathon prototype, source available for review.

Live: https://recallops.gudman.xyz · Source: https://github.com/Ridwannurudeen/recallops · Primary demo: https://recallops.gudman.xyz/demo/judge
