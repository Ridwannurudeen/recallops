# RecallOps Submission

## 30-second pitch

RecallOps turns Band into a regulated product-recall command room. Five specialist agents coordinate evidence, traceability, regulator filing drafts, communications, and ERP-ready actions while the final recall action remains owned by a named human signer.

The primary judge path is live at `https://recallops.gudman.xyz/app`. It lets a judge edit recall evidence, run the spend-gated AI/ML API evidence path, upload shipment records, recompute traceability, confirm that incomplete coverage blocks approval, prepare regulator and ERP dry-run payloads, and inspect the proof packet. The guided BAT-4421 replay is available at `https://recallops.gudman.xyz/demo/bat-4421`.

## Track

Track 3: Regulated & High-Stakes Workflows.

## Links

| Surface                | URL                                                                       |
| ---------------------- | ------------------------------------------------------------------------- |
| Primary command room   | https://recallops.gudman.xyz/app                                          |
| Guided BAT-4421 replay | https://recallops.gudman.xyz/demo/bat-4421                                |
| Judge briefing         | https://recallops.gudman.xyz/judge                                        |
| Proof explorer         | https://recallops.gudman.xyz/proof                                        |
| API docs               | https://recallops.gudman.xyz/docs                                         |
| Proof bundle           | https://recallops.gudman.xyz/api/submission-proof                         |
| Repository             | https://github.com/Ridwannurudeen/recallops                               |
| lablab project page    | https://lablab.ai/ai-hackathons/band-of-agents-hackathon/gudman/recallops |

## What the demo shows

The primary route is `/app`. A judge can run the command room directly, then open `/demo/bat-4421` for the stable guided replay. The compatibility route `/demo/judge` redirects to `/demo/bat-4421?mode=guided`. In the public review path, a judge sees:

- source evidence parsed from complaint text and shipment CSV
- AI/ML API and Featherless provider status, response hashes, and cooldown state when partner mode is enabled
- traceability move from incomplete coverage to recovered coverage
- captured Band room mode, participant count, room ID, message IDs, and transcript
- filing pack generation for regulator and distributor review
- regulator dispatch dry-run with no external submission
- human sign-off gate that remains closed without verified approval material
- downloadable full audit packet and downloadable Band room proof

The `Break shipment coverage` toggle proves the negative path. It withholds recovered evidence, leaves final coverage below 100%, keeps the case in review, and prevents human sign-off from being sealed.

## Band mechanics

- Shared Band room is the collaboration layer.
- Commander recruits Evidence, Traceability, Regulatory/Risk, and Communications roles.
- Source context is posted into the room and bound to the source audit hash.
- POST recall-room runs attempt a provider Band room by default; if credentials, provider state, cooldown, or daily cap block the run, the response discloses the fallback mode.
- Specialist recruitment is source-driven: traceability, risk, rules, communications, and AI/ML review are selected from coverage gaps, severity, jurisdiction matches, and partner-provider usage.
- Agent handoffs are visible in the transcript panel.
- Cross-framework: in the live Band run, the Communications agent runs on Band's `AnthropicAdapter` (Claude Haiku 4.5) and authors its notices with the LLM, while the other agents run on the SDK's `SimpleAdapter` — distinct frameworks collaborating in one room. It falls back to the scripted adapter when no Anthropic key is set.
- The live run exercises Band's tool surface and records coverage in the proof: peer discovery (`lookup_peers`), dynamic recruitment (`add_participant`), @mention routing and task events (`send_message`/`send_event`), contacts (`list_contacts`/`add_contact`), Band Memories (`store_memory`/`get_memory`, enterprise-gated with a deterministic-hash fallback), and participant lifecycle (`remove_participant`).
- Traceability gap creates a hold recommendation.
- Recovered shipment evidence clears the hold only when coverage reaches 100%.
- The Band proof export records room mode, room ID, participant count, message IDs, the Communications framework, Band tool coverage, source hash, run hash, transcript, and raw room run.
- The deployed demo labels captured Band proof and deterministic replay explicitly instead of presenting captured evidence as a new provider run.

## Agents

| Agent                   | Responsibility                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| Incident Commander      | Opens the room, coordinates the case, routes work.                                       |
| Evidence Agent          | Extracts product, defect, lot, severity, and cited complaint facts.                      |
| Traceability Agent      | Computes coverage, missing units, affected customers, regions, and recovered sources.    |
| Regulatory/Risk Officer | Raises or clears hold recommendations from evidence and jurisdiction rules.              |
| Communications Agent    | Prepares regulator, customer, and warehouse notice drafts. Runs on Band's `AnthropicAdapter` (Claude Haiku 4.5) in live runs; scripted-adapter fallback offline. |
| QA Director             | Human sign-off gate; the system cannot publicly sign without verified approval material. |

## Verification status

- Backend test suite: 83 passing tests.
- Frontend typecheck: passing.
- Frontend production build: passing.
- VPS build and restart: passing.
- Public lablab page: indexed and reachable at `https://lablab.ai/ai-hackathons/band-of-agents-hackathon/gudman/recallops`.
- Live judge-flow smoke:
  - `/app` exposes editable source evidence, upload controls, analysis, approval gate, and proof export.
  - `/demo/bat-4421` exposes the guided replay, transcript panel, and Band proof download.
  - `/demo/judge` redirects to `/demo/bat-4421?mode=guided`.
  - `/api/partner-ai/status` and `/api/spend-limits` disclose provider readiness and spend gates.
  - recovered path reaches 100% final coverage.
  - broken-coverage path stays at 86% final coverage.
  - recall-room endpoint returns a room hash and 6 room events.
  - e-signature endpoint returns `403` without approval key, proving the public sign-off gate is closed.
- Captured Band proof and deterministic replay are disclosed as their own modes in the public UI.

## Production boundaries

- No real regulator submission is enabled by default.
- No SAP/Oracle tenant write is enabled by default.
- Human sign-off requires verified approval material.
- Protected approval receipts require server-recomputed source readiness, filing hash, and accepted room-run hash for the submitted case context.
- The e-signature receipt is Part-11-style attributable audit evidence, not a certified Part 11 product.
- Partner AI calls are optional, explicit, and spend-gated; deterministic parsing remains the public proof path if provider keys or cooldown block a run.

## Demo video script

```text
0:00 - Open /app. "RecallOps turns Band into a regulated recall command room."
0:15 - Keep AI/ML partner mode on, upload the incomplete shipment CSV, and analyze the case.
0:35 - Show source evidence and traceability math.
0:55 - Confirm incomplete coverage keeps approval blocked.
1:20 - Upload recovered shipment evidence and rerun analysis.
1:40 - Show regulator, communications, and ERP dry-run payloads.
2:00 - Open /demo/bat-4421 to show the stable guided replay and Band room proof.
2:30 - Open /proof or /judge to show raw proof, routes, and boundaries.
```

Proof-mode line for the video:

```text
RecallOps labels captured Band proof and deterministic replay as proof modes instead of hiding them; the command room still exposes the source evidence, traceability math, approval gate, proof bundle, and dry-run integration payloads.
```

## One-line submission copy

RecallOps is a Band-native recall command room where specialist agents coordinate source evidence, traceability recovery, regulator filing drafts, and ERP-ready actions, then produce a human-signable audit packet with downloadable Band proof.
