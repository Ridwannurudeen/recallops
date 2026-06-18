# RecallOps Submission

## Project

RecallOps is a Band-native command room for live product-recall decisions.

When a defective product hits the market, the company does not need one chatbot.
It needs a room: quality, evidence, traceability, regulatory risk,
communications, and a human QA director coordinating under a ticking exposure
clock. RecallOps turns Band into that room.

## Track

Track 3: Regulated & High-Stakes Workflows.

## Links

- Demo: https://recallops.gudman.xyz
- Packet API: https://recallops.gudman.xyz/api/packet
- Repository: https://github.com/Ridwannurudeen/recallops

## What The Demo Shows

The demo opens on lot `BAT-4421`, a Northstar Home Battery Pack with three
overheating complaints and 4,800 shipped units across 6 regions. The source
cockpit shows the complaint text and shipment CSV, parses them into cited facts,
computes the initial 82% shipment coverage, and exposes SHA-256 digests for the
raw sources. The Evidence Agent extracts the incident, the Traceability Agent
finds the same 82% coverage gap, and the Regulatory/Risk Officer vetoes the
recall plan while 864 units remain untraced.

The Incident Commander routes the work back to Traceability, the missing
Kestrel Distributor file is recovered, coverage moves to 100%, Communications
drafts the regulator/customer/quarantine notices, and the human QA Director
approves the final packet. The packet closes with packet-room proof, captured
Band room proof, message IDs, the veto ID, the approval ID, the proof mode, a
hash-linked receipt chain, a decision graph, and a SHA-256 audit digest.
The human approval control also mints a receipt hash over the computed source
packet; it is presented as a receipt, not as a digital signature.
The `/api/submission-proof` endpoint bundles the packet digest, source digest,
approval receipt, captured Band proof, latest fresh Band drill status, partner
AI status, and submission gates into one judge-readable JSON object.
It also includes deterministic jurisdiction-rule checks, dry-run dispatch
receipts, SAP/Oracle sync payloads, identity-gate status, ERP contract
receiver receipts, SAP API Hub sandbox-read proof, and production adapter readiness.

## Agents

- Incident Commander: opens the Band room, recruits specialists, owns case state.
- Evidence Agent: extracts product, defect, lot, severity, and complaint facts.
- Traceability Agent: maps lot records to shipments, customers, regions, and stock.
- Regulatory/Risk Officer: blocks unsupported decisions and clears the final plan.
- Communications Agent: drafts regulator, customer, and warehouse notices.
- QA Director: human approval gate.

## Band Mechanics

- Shared room as the collaboration layer.
- Dynamic recruitment as severity and multi-region exposure increase.
- `@mention` handoffs between agents.
- Explicit regulatory veto before traceability is complete.
- Re-plan loop after the veto.
- Human approval event.
- Hash-linked decision receipts and a decision graph showing which handoff changed state.
- Public proof mode is `deterministic_packet_with_captured_band_run`: the BAT-4421 packet is deterministic, and `docs/band-spike-proof.json` records a successful captured Band room where Commander drove the room, Evidence recruited Traceability, Traceability recruited Risk, Risk vetoed and forced a re-plan, Risk recruited Communications, and Communications completed the notice handoff.
- A guarded live rerun endpoint can create a fresh Band room from the deployed app when server-side Band credentials are enabled, with lock, cooldown, and daily cap protection.
- Source evidence endpoints recompute facts, citations, coverage, source digests, and approval receipts from visible complaint/shipment inputs.
- Partner AI execution is wired as a real key-gated path: Featherless reviews the complaint text as the Evidence Agent, and AI/ML API reviews the shipment CSVs as the Regulatory/Risk Officer. The cockpit exposes provider status, model IDs, response hashes, and compact JSON outputs when those calls run.
- Submission proof endpoint: safe GET bundle for judges; live POST bundle for a fresh partner-AI proof run.
- Case persistence, jurisdiction rules, dry-run dispatch receipts, integration readiness, SAP/Oracle recall payloads, identity-gated approvals, ERP contract receiver receipts, and spend controls are exposed as production-hardening surfaces. Live SAP/Oracle writes are implemented behind tenant endpoint configuration plus a server-side admin gate; the public demo can exercise the live adapter path against a tenant-shaped contract receiver and stays away from real customer ERP writes unless an approved tenant is configured.
- SAP Business Accelerator Hub access is used honestly as a live S/4HANA Cloud sandbox read proof via `/api/sap-api-hub`; it is not represented as a customer S/4HANA tenant write.
- Enterprise identity is implemented as a protected approval path: `/api/identity-approval` accepts either a server-side approval admin key or an RS256 OIDC token verified through JWKS, then seals the verified identity into the approval receipt hash.
- Cross-framework support is the target adapter architecture: current demo logic runs through Band SDK and deterministic role logic, with Evidence mapped to a Pydantic AI adapter target, Traceability to a LangGraph adapter target, and Risk review to a CrewAI adapter target.
- The deployed packet reports whether provider keys are configured, and does not claim partner LLM usage when the deterministic parser handled the run.

## Verification

- Python tests cover the traceability gap, source parser, citation integrity, partner AI missing-key path, mocked partner AI execution, veto ordering, approval gate, approval receipt, receipt hash chain, decision graph, digest verification, and stable audit hash.
- Frontend typecheck and production build are clean.
- Public deployment is smoke-tested on desktop and mobile with no console warnings and no horizontal overflow.
- Live Band workflow succeeded with room `6dcd1018-bce3-481f-88d6-1ab67f6db452`, Commander message `da91fc15-fd3f-4b5a-8af1-a0b2c005c5d5`, Evidence ack `b33c7424-87e1-40db-9b15-558a64f608d7`, Risk veto `bed6e1f4-f1cd-48a4-8f36-c09d7d9c9de9`, Communications notice `db2e10f0-f8f6-4fc4-a324-c99929911500`, 5 participants, and 8 context items.

## Why It Matters

Product recalls are high-stakes, cross-functional, and audit-heavy. Teams lose
hours reconciling evidence, shipment coverage, regulatory risk, and customer
communication. RecallOps makes the decision process visible: who joined, who
vetoed, what changed, who approved, and what was sealed.
