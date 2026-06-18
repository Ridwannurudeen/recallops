# Slide Outline

## 1. RecallOps

Band-native command room for live product-recall decisions.

## 2. The Enterprise Pain

Product recalls split evidence, traceability, regulatory risk, communications,
and QA approval across meetings, spreadsheets, and inboxes.

## 3. Why Band

Recall decisions need multiple specialists in one shared room: recruitment,
handoffs, veto, re-plan, human approval, hash-linked receipts, and transcript
proof.

## 4. Agent Room

Commander, Evidence, Traceability, Regulatory/Risk, Communications, and QA
Director coordinate around one recall case.

## 5. Demo Incident

Lot `BAT-4421`: 4,800 shipped units, 6 regions, 31 exposure hours, 82% initial
coverage, 864 untraced units.

## 6. The Winning Moment

Risk vetoes the plan, Traceability recovers the missing distributor file, and
Judge Mode replays the room moving from blocked to approved.

## 7. Source Cockpit

Complaint text and shipment CSV are visible, editable, parsed into cited facts,
and sealed with source digests. The approval receipt hashes the computed source
packet. The partner AI action can call Featherless for evidence extraction and
AI/ML API for risk review, then display model IDs and response hashes.

## 8. Audit Packet

Final output includes notices, affected coverage, packet room ID, captured Band
room ID, message IDs, veto ID, approval ID, receipt chain, decision graph, and
SHA-256 audit digest. `/api/submission-proof` bundles every judge proof surface
into one JSON endpoint, including rules, dispatch receipts, adapter readiness,
SAP API Hub sandbox proof, SAP/Oracle sync payloads, identity-gate status, ERP
contract receipts, and spend controls.

## 9. SAP / Oracle Gate

RecallOps prepares the same recall-hold payload for SAP S/4HANA and Oracle SCM
in dry-run mode. Live writes require real tenant endpoints, credentials, and a
server-side admin action key, so the demo proves the integration contract
without pretending to own a customer ERP tenant.

The SAP API Hub key is used as a separate live sandbox-read proof against SAP's
S/4HANA Cloud Business Partner sandbox.

## 10. Identity Gate

The plain demo receipt is still visible, but the enterprise path is protected:
`/api/identity-approval` requires either a server-side approval key or an RS256
OIDC token verified through JWKS, then seals that identity into the receipt
hash.

## 11. ERP Contract Receiver

The SAP/Oracle adapter can make real HTTP writes against a tenant-shaped
receiver. The receiver stores redacted receipts and proves the transport,
auth, payload mapping, and response-hash path before a customer tenant is
connected.

## 12. Raw Band Proof

The packet is deterministic for judge replay; the proof panel exposes the
captured Band room UUID, participant count, context count, and every Band
message ID used by the receipts.

## 13. Fresh Drill

When the live runtime is enabled, RecallOps can create a fresh Band room from
the deployed app and render the new room, veto, approval, and notice IDs.

## 14. Business Value

RecallOps compresses high-stakes recall coordination into one auditable,
human-approved agent room.
