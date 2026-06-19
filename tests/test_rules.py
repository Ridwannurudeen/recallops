from recallops.rules import assess_rules
from recallops.source_evidence import build_source_evidence_packet


CRITICAL_COMPLAINT = "C-1 | product: Pack | lot: LOT-1 | defect: overheating | severity: critical\n"


def _packet(shipment_csv: str):
    return build_source_evidence_packet(
        complaint_text=CRITICAL_COMPLAINT,
        shipment_csv=shipment_csv,
        recovered_shipment_csv=shipment_csv,
    )


def test_full_coverage_clears_approval() -> None:
    csv = "source,distributor,region,customers,units,status\nSHIP-1,Hub,US-West,10,1000,traced\n"
    packet = _packet(csv)
    assessment = assess_rules(packet)

    assert packet.final_traceability.untraced_units == 0
    assert assessment["final_blockers"] == []
    assert assessment["approval_ready"] is True


def test_rounded_full_coverage_with_untraced_units_blocks_approval() -> None:
    csv = (
        "source,distributor,region,customers,units,status\n"
        "SHIP-1,Hub,US-West,10,999,traced\n"
        "SHIP-2,Hub,US-West,1,1,missing\n"
    )
    packet = _packet(csv)
    assessment = assess_rules(packet)

    assert packet.final_traceability.coverage_percent == 100
    assert packet.final_traceability.untraced_units == 1
    assert assessment["approval_ready"] is False
    assert assessment["final_blockers"][0]["id"] == "FINAL-TRACEABILITY-INCOMPLETE"
