from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class BandStageEvidence:
    stage: str
    label: str
    band_message_id: str
    proves: str


CAPTURED_BAND_RUN = {
    "proof_mode": "captured_band_five_agent_run",
    "captured_at": "2026-06-17T07:42:00+01:00",
    "room_id": "6dcd1018-bce3-481f-88d6-1ab67f6db452",
    "participant_count": 5,
    "context_items": 8,
    "commander_event_id": "e16220f4-c936-4f59-b7ad-d7468182efb3",
    "commander_message_id": "da91fc15-fd3f-4b5a-8af1-a0b2c005c5d5",
    "evidence_ack_id": "b33c7424-87e1-40db-9b15-558a64f608d7",
    "traceability_gap_id": "dad3fe04-0d06-4ac4-a427-8cab0aa85d82",
    "risk_veto_id": "bed6e1f4-f1cd-48a4-8f36-c09d7d9c9de9",
    "traceability_resolved_id": "2d7195c3-6874-4e99-bf67-73dc1724a257",
    "risk_approved_id": "04b94bb6-d8eb-4816-9cc7-70b91093a145",
    "communications_notice_id": "db2e10f0-f8f6-4fc4-a324-c99929911500",
}

CAPTURED_BAND_STAGE_EVIDENCE = (
    BandStageEvidence(
        stage="room_created",
        label="Commander message",
        band_message_id=CAPTURED_BAND_RUN["commander_message_id"],
        proves="Commander created the Band room and recruited Evidence.",
    ),
    BandStageEvidence(
        stage="evidence_extracted",
        label="Evidence ack",
        band_message_id=CAPTURED_BAND_RUN["evidence_ack_id"],
        proves="Evidence responded in-room with product, defect, lot, and severity facts.",
    ),
    BandStageEvidence(
        stage="traceability_gap",
        label="Traceability gap",
        band_message_id=CAPTURED_BAND_RUN["traceability_gap_id"],
        proves="Traceability reported 82% shipment coverage and 864 untraced units.",
    ),
    BandStageEvidence(
        stage="regulatory_veto",
        label="Risk veto",
        band_message_id=CAPTURED_BAND_RUN["risk_veto_id"],
        proves="Risk blocked customer notice until traceability recovered the missing units.",
    ),
    BandStageEvidence(
        stage="traceability_resolved",
        label="Re-plan result",
        band_message_id=CAPTURED_BAND_RUN["traceability_resolved_id"],
        proves="Traceability recovered the missing distributor file and restored coverage.",
    ),
    BandStageEvidence(
        stage="risk_approved",
        label="Risk approval",
        band_message_id=CAPTURED_BAND_RUN["risk_approved_id"],
        proves="Risk cleared the recall path after the re-plan.",
    ),
    BandStageEvidence(
        stage="notice_drafted",
        label="Communications notice",
        band_message_id=CAPTURED_BAND_RUN["communications_notice_id"],
        proves="Communications completed the regulator, customer, and quarantine handoff.",
    ),
)


def captured_band_proof() -> dict[str, object]:
    return {
        **CAPTURED_BAND_RUN,
        "stage_evidence": [asdict(evidence) for evidence in CAPTURED_BAND_STAGE_EVIDENCE],
    }
