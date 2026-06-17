# Demo Video Script

Target length: 2 minutes 45 seconds.

## 0:00-0:15 - Hook

"This is RecallOps, a Band-native command room for live product recalls. When a
defective product hits the market, the company does not need one chatbot. It
needs quality, traceability, regulatory risk, communications, and a human QA
director deciding in one auditable room."

Show Judge Mode running above the command room, then the exposure clock.

## 0:15-0:40 - Incident

"The incident is lot BAT-4421, a home battery pack with overheating complaints.
The exposure clock is already at 148,800 unit-hours in market: 4,800 units
shipped, 31 hours since first report, across 6 regions."

Point at the exposure clock and lot headline.

## 0:40-1:10 - Agent Collaboration

"The Incident Commander opens the room. Evidence extracts the product, defect,
lot, and critical severity. Because the issue is critical and multi-region, the
Commander recruits Traceability, then Regulatory/Risk."

Show agents joining in Judge Mode, then scroll the Band transcript through
`msg-001` to `msg-005`.

## 1:10-1:40 - Veto

"Traceability finds the first hard blocker: 4,800 units shipped, but only 82%
coverage. The Regulatory/Risk Officer vetoes the plan. No customer notice is
allowed while 864 units remain untraced."

Pause on `msg-006` and the Band proof panel showing the veto message ID.

## 1:40-2:10 - Re-plan

"That veto forces a re-plan. Traceability recovers the missing Kestrel
Distributor file, coverage moves from 82% to 100%, and Risk approves the recall
path. Every state change is linked into the receipt chain."

Show the traceability panel and coverage bars.

## 2:10-2:35 - Human Gate And Packet

"Communications drafts the regulator notice, customer notice, and warehouse
quarantine order. The QA Director approves the packet. The result is a recall
decision with room ID, demo actor count, live Band agent count, event count,
message IDs, veto ID, approval ID, proof mode, hash-linked receipts, a decision
graph, and a SHA-256 audit digest that the API can recompute. The BAT-4421
packet is deterministic for a clean demo, and the proof panel also shows the
captured live Band workflow: five configured Band identities, real room
creation, Evidence, Traceability, Risk, Communications, risk veto,
communications notice, and context fetch."

Show the final packet, notices, and audit seal.

## 2:35-2:45 - Close

"RecallOps shows why Band matters: agents are not isolated prompts. They join a
shared room, challenge each other, hand off work, involve a human, and leave an
audit trail for a real enterprise decision."
