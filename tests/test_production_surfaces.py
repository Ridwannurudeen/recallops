from recallops import build_recall_packet
from recallops.cases import create_case_record, get_case_record, list_case_records
from recallops.enterprise import integration_status, ops_readiness
from recallops.notifications import build_dispatch_receipts
from recallops.rate_limit import SpendLimitSettings, acquire_spend_permit, spend_limit_status
from recallops.rules import assess_rules
from recallops.source_evidence import build_source_evidence_packet


def test_rules_capture_initial_blocker_and_deadline() -> None:
    packet = build_source_evidence_packet()
    assessment = assess_rules(packet)

    assert assessment["approval_ready"] is True
    assert assessment["initial_blockers"][0]["id"] == "TRACEABILITY-BELOW-100"
    assert assessment["next_deadline"]["id"] == "US-CPSC-24H"
    assert len(assessment["applied_rules"]) == 4


def test_dispatch_receipts_are_dry_run_hashes() -> None:
    packet = build_source_evidence_packet()
    receipts = build_dispatch_receipts(packet)

    assert len(receipts) == 3
    assert all(receipt.channel == "dry_run" for receipt in receipts)
    assert all(receipt.status == "prepared" for receipt in receipts)
    assert all(len(receipt.payload_hash) == 64 for receipt in receipts)


def test_integration_status_never_requires_secrets(monkeypatch) -> None:
    monkeypatch.delenv("RECALLOPS_SAP_BASE_URL", raising=False)
    monkeypatch.delenv("RECALLOPS_SAP_API_KEY", raising=False)

    status = integration_status()

    assert status["configured_count"] == 0
    assert status["adapters"][0]["status"] == "not_configured"
    assert "RECALLOPS_SAP_API_KEY" not in str(status)
    assert (
        ops_readiness()["access_control"]["mode"] == "public_demo_with_rate_limited_spend_actions"
    )


def test_case_store_persists_source_rules_and_dispatch(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("RECALLOPS_CASE_DB", str(tmp_path / "cases.sqlite3"))
    source_packet = build_source_evidence_packet()
    rules = assess_rules(source_packet)
    receipts = build_dispatch_receipts(source_packet)

    record = create_case_record(
        source_packet=source_packet,
        rule_assessment=rules,
        dispatch_receipts=receipts,
    )
    saved = get_case_record(str(record["case_id"]))

    assert saved is not None
    assert saved["source_packet"]["audit_hash"] == source_packet.audit_hash
    assert saved["rule_assessment"]["approval_ready"] is True
    assert len(saved["dispatch_receipts"]) == 3
    assert list_case_records()[0]["case_id"] == record["case_id"]


def test_partner_ai_spend_limit_blocks_cooldown(tmp_path) -> None:
    settings = SpendLimitSettings(
        enabled=True,
        run_dir=tmp_path / "spend",
        cooldown_seconds=120,
        daily_limit=5,
    )
    permit = acquire_spend_permit(settings)
    permit.record({"mode": "partner_ai_assisted", "used_count": 2})
    permit.release()

    status = spend_limit_status(settings)

    assert status["runs_today"] == 1
    assert status["cooldown_remaining_seconds"] > 0
    assert status["runnable"] is False


def test_build_recall_packet_still_available() -> None:
    assert build_recall_packet().decision["status"] == "approved"
