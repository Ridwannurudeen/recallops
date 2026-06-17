import pytest

from recallops.approval import build_approval_receipt, verify_approval_receipt
from recallops.source_evidence import (
    DEFAULT_SHIPMENT_CSV,
    build_source_evidence_packet,
    verify_source_evidence_digest,
)


def test_source_evidence_packet_computes_traceability_from_sources() -> None:
    packet = build_source_evidence_packet()
    second_packet = build_source_evidence_packet()

    assert packet.incident_id == "INC-SOURCE-BAT-4421"
    assert packet.audit_hash == second_packet.audit_hash
    assert packet.initial_traceability.coverage_percent == 82
    assert packet.initial_traceability.untraced_units == 864
    assert packet.final_traceability.coverage_percent == 100
    assert packet.final_traceability.untraced_units == 0
    assert packet.missing_sources == ("SHIP-006",)
    assert len(packet.source_digests["shipment_csv"]) == 64
    assert verify_source_evidence_digest(packet)["ok"] is True


def test_source_facts_point_to_citations() -> None:
    packet = build_source_evidence_packet()
    citation_ids = {citation.id for citation in packet.citations}

    assert all(fact.citation_id in citation_ids for fact in packet.facts)
    assert "complaint-bundle" in citation_ids
    assert "shipment:SHIP-006" in citation_ids
    assert "recovered-shipment:SHIP-006" in citation_ids


def test_source_parser_rejects_invalid_shipment_status() -> None:
    bad_csv = DEFAULT_SHIPMENT_CSV.replace(
        "SHIP-006,Kestrel Distributor,LATAM,480,864,missing",
        "SHIP-006,Kestrel Distributor,LATAM,480,864,unknown",
    )

    with pytest.raises(ValueError, match="unsupported status"):
        build_source_evidence_packet(shipment_csv=bad_csv)


def test_approval_receipt_hashes_source_packet() -> None:
    packet = build_source_evidence_packet()
    receipt = build_approval_receipt(
        approver="QA Director",
        decision="approved",
        reason="Traceability reached 100% and risk veto cleared.",
        source_audit_hash=packet.audit_hash,
    )

    assert receipt.approval_id.startswith(f"approval-{packet.audit_hash[:12]}")
    assert receipt.source_audit_hash == packet.audit_hash
    assert verify_approval_receipt(receipt)["ok"] is True
