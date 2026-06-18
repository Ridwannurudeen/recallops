# RecallOps Submission

## 30-second pitch

RecallOps turns Band into a regulated product-recall command room. Five specialist agents coordinate evidence, traceability, regulator filing drafts, communications, and ERP-ready actions while the final recall action remains owned by a named human signer.

The judge demo is live at `https://recallops.gudman.xyz/demo/judge`. It runs real source evidence, attempts a fresh Band room, shows the room transcript, prepares filing and regulator dispatch packets, proves the public sign-off gate, and exports the audit packet.

## Track

Track 3: Regulated & High-Stakes Workflows.

## Links

| Surface | URL |
|---|---|
| Primary judge demo | https://recallops.gudman.xyz/demo/judge |
| Submission-readiness page | https://recallops.gudman.xyz/submission |
| Operator console | https://recallops.gudman.xyz/console |
| Proof explorer | https://recallops.gudman.xyz/proof |
| API docs | https://recallops.gudman.xyz/docs |
| Proof bundle | https://recallops.gudman.xyz/api/submission-proof |
| Repository | https://github.com/Ridwannurudeen/recallops |

## What the demo shows

The primary route is `/demo/judge`, not the old replay path. A judge chooses a scenario, runs the guided demo, and sees:

- source evidence parsed from complaint text and shipment CSV
- traceability move from incomplete coverage to recovered coverage
- Band room mode, participant count, room ID, message IDs, and transcript
- filing pack generation for regulator and distributor review
- regulator dispatch dry-run with no external submission
- human sign-off gate that remains closed without verified approval material
- downloadable full audit packet and downloadable Band room proof

The `Break shipment coverage` toggle proves the negative path. It withholds recovered evidence, leaves final coverage below 100%, keeps the case in review, and prevents human sign-off from being sealed.

## Band mechanics

- Shared Band room is the collaboration layer.
- Commander recruits Evidence, Traceability, Regulatory/Risk, and Communications roles.
- Source context is posted into the room and bound to the source audit hash.
- Agent handoffs are visible in the transcript panel.
- Traceability gap creates a hold recommendation.
- Recovered shipment evidence clears the hold only when coverage reaches 100%.
- The Band proof export records room mode, room ID, participant count, message IDs, source hash, run hash, transcript, and raw room run.
- The deployed judge demo attempts a fresh Band run first. If credentials, provider state, cooldown, or daily cap block a fresh room, it discloses the captured fallback mode instead of pretending the run was live.

## Agents

| Agent | Responsibility |
|---|---|
| Incident Commander | Opens the room, coordinates the case, routes work. |
| Evidence Agent | Extracts product, defect, lot, severity, and cited complaint facts. |
| Traceability Agent | Computes coverage, missing units, affected customers, regions, and recovered sources. |
| Regulatory/Risk Officer | Raises or clears hold recommendations from evidence and jurisdiction rules. |
| Communications Agent | Prepares regulator, customer, and warehouse notice drafts. |
| QA Director | Human sign-off gate; the system cannot publicly sign without verified approval material. |

## Verification status

- Backend test suite: 74 passing tests.
- Frontend typecheck: passing.
- Frontend production build: passing.
- VPS build and restart: passing.
- Live judge-flow smoke:
  - `/demo/judge` exposes fresh Band run button, break-coverage toggle, transcript panel, and Band proof download.
  - recovered path reaches 100% final coverage.
  - broken-coverage path stays at 86% final coverage.
  - recall-room endpoint returns a room hash and 6 room events.
  - e-signature endpoint returns `403` without approval key, proving the public sign-off gate is closed.
- Live Band proof has succeeded in a smoke run as `fresh_live_band_run_attached`; later smoke returned captured fallback because the fresh run consumed provider/cooldown state. The UI discloses the exact mode.

## Production boundaries

- No real regulator submission is enabled by default.
- No SAP/Oracle tenant write is enabled by default.
- Human sign-off requires verified approval material.
- The e-signature receipt is Part-11-style attributable audit evidence, not a certified Part 11 product.
- Partner AI calls are optional and spend-gated; deterministic parsing remains the public proof path.

## Demo video script

```text
0:00 - Open /demo/judge. "RecallOps turns Band into a regulated recall command room."
0:15 - Select Consumer battery recall and run the guided demo.
0:35 - Show source evidence and traceability math.
0:55 - Show Band room mode, participants, room ID, and transcript.
1:20 - Show filing pack and regulator dispatch dry-run.
1:40 - Download Band proof or audit packet.
1:55 - Toggle Break shipment coverage and run again.
2:20 - Show final coverage below 100% and sign-off gate closed.
2:40 - Open /proof or /submission to show raw proof and boundaries.
```

Cooldown-safe line for the video:

```text
The demo attempts fresh Band first. If the provider is in cooldown, RecallOps labels the captured fallback and still exposes room IDs, message IDs, source hashes, and the transcript. The proof mode is part of the product, not hidden.
```

## One-line submission copy

RecallOps is a Band-native recall command room where specialist agents coordinate source evidence, traceability recovery, regulator filing drafts, and ERP-ready actions, then produce a human-signable audit packet with downloadable Band proof.
