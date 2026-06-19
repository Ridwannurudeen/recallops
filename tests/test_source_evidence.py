import pytest

from recallops.approval import build_approval_receipt, verify_approval_receipt
from recallops.partner_ai import partner_ai_status, run_partner_ai
from recallops.source_evidence import (
    DEFAULT_SHIPMENT_CSV,
    build_source_evidence_packet,
    verify_source_evidence_digest,
)
from recallops.notifications import build_dispatch_receipts


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


def test_source_parser_rejects_duplicate_shipment_sources() -> None:
    dup_csv = (
        "source,distributor,region,customers,units,status\n"
        "SHIP-1,Hub,US-West,10,100,traced\n"
        "SHIP-1,Hub,EU-North,10,100,missing\n"
    )

    with pytest.raises(ValueError, match="repeats source"):
        build_source_evidence_packet(shipment_csv=dup_csv)


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


def test_dispatch_receipts_are_source_packet_specific() -> None:
    packet = build_source_evidence_packet(
        complaint_text=(
            "C-900 | product: Harbor Sensor | lot: LOT-900 | "
            "defect: cracked housing | severity: critical"
        ),
        shipment_csv=(
            "source,distributor,region,customers,units,status\n"
            "SHIP-900,North Hub,US-West,10,100,traced\n"
        ),
        recovered_shipment_csv=(
            "source,distributor,region,customers,units,status\n"
            "SHIP-900,North Hub,US-West,10,100,traced\n"
        ),
    )

    receipts = build_dispatch_receipts(packet)

    assert receipts[0].status == "prepared"
    assert (
        receipts[0].payload_hash
        != build_dispatch_receipts(build_source_evidence_packet())[0].payload_hash
    )


def test_partner_ai_status_never_exposes_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AIML_API_KEY", "test-aiml-key")
    monkeypatch.setenv("FEATHERLESS_API_KEY", "test-featherless-key")

    status = partner_ai_status()

    assert status["providers"]["ai_ml_api"]["configured"] is True
    assert status["providers"]["featherless"]["configured"] is True
    assert "api_key" not in status["providers"]["ai_ml_api"]
    assert "api_key" not in status["providers"]["featherless"]


def test_partner_ai_missing_keys_uses_deterministic_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AIML_API_KEY", raising=False)
    monkeypatch.delenv("AI_ML_API_KEY", raising=False)
    monkeypatch.delenv("FEATHERLESS_API_KEY", raising=False)

    status = run_partner_ai(
        complaint_text="C-1 | product: Pack | lot: LOT-1 | defect: heat | severity: critical",
        shipment_csv=DEFAULT_SHIPMENT_CSV,
        recovered_shipment_csv=DEFAULT_SHIPMENT_CSV.replace("missing", "traced"),
    )

    assert status["mode"] == "deterministic_source_parser"
    assert status["used_count"] == 0
    assert status["providers"]["ai_ml_api"]["status"] == "missing_key"
    assert status["providers"]["featherless"]["status"] == "missing_key"


def test_partner_ai_uses_configured_providers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AIML_API_KEY", "test-aiml-key")
    monkeypatch.setenv("FEATHERLESS_API_KEY", "test-featherless-key")

    def fake_chat_completion(**kwargs: str) -> str:
        if kwargs["base_url"].endswith("featherless.ai/v1"):
            return '{"product":"Northstar Home Battery Pack","lot":"BAT-4421","severity":"critical","complaint_count":3,"evidence_summary":"three overheating complaints"}'
        return '{"decision":"approve_after_traceability","risk_level":"critical","approval_gate":"coverage_100_required","reason":"initial gap blocks approval until recovered CSV traces all units"}'

    monkeypatch.setattr("recallops.partner_ai._chat_completion", fake_chat_completion)

    status = run_partner_ai(
        complaint_text="C-1 | product: Pack | lot: LOT-1 | defect: heat | severity: critical",
        shipment_csv=DEFAULT_SHIPMENT_CSV,
        recovered_shipment_csv=DEFAULT_SHIPMENT_CSV.replace("missing", "traced"),
    )

    assert status["mode"] == "partner_ai_assisted"
    assert status["used_count"] == 2
    assert status["providers"]["ai_ml_api"]["used"] is True
    assert status["providers"]["featherless"]["used"] is True
    assert len(status["providers"]["ai_ml_api"]["response_hash"]) == 64
