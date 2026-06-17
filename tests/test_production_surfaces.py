import pytest

from recallops import build_recall_packet
from recallops.cases import create_case_record, get_case_record, list_case_records
from recallops.enterprise import (
    EnterpriseSyncError,
    integration_status,
    ops_readiness,
    require_enterprise_write_authorization,
    run_enterprise_sync,
)
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
    for name in (
        "RECALLOPS_SAP_BASE_URL",
        "RECALLOPS_SAP_API_KEY",
        "RECALLOPS_SAP_RECALL_URL",
        "RECALLOPS_SAP_RECALL_PATH",
        "RECALLOPS_ORACLE_SCM_URL",
        "RECALLOPS_ORACLE_SCM_TOKEN",
        "RECALLOPS_ORACLE_SCM_RECALL_URL",
        "RECALLOPS_ORACLE_SCM_RECALL_PATH",
        "RECALLOPS_SALESFORCE_URL",
        "RECALLOPS_SALESFORCE_TOKEN",
        "RECALLOPS_ZENDESK_URL",
        "RECALLOPS_ZENDESK_TOKEN",
        "RECALLOPS_REGULATOR_URL",
        "RECALLOPS_REGULATOR_TOKEN",
    ):
        monkeypatch.delenv(name, raising=False)

    status = integration_status()

    assert status["configured_count"] == 0
    assert status["adapters"][0]["status"] == "not_configured"
    assert "RECALLOPS_SAP_API_KEY" not in str(status)
    assert (
        ops_readiness()["access_control"]["mode"] == "public_demo_with_rate_limited_spend_actions"
    )


def test_sap_oracle_status_reports_execution_ready_without_secrets(monkeypatch) -> None:
    monkeypatch.setenv("RECALLOPS_SAP_BASE_URL", "https://sap.example")
    monkeypatch.setenv("RECALLOPS_SAP_API_KEY", "sap-secret-token")
    monkeypatch.setenv("RECALLOPS_SAP_RECALL_PATH", "/sap/opu/odata/sap/Z_RECALL_HOLD")
    monkeypatch.setenv("RECALLOPS_ORACLE_SCM_URL", "https://oracle.example")
    monkeypatch.setenv("RECALLOPS_ORACLE_SCM_TOKEN", "oracle-secret-token")
    monkeypatch.setenv(
        "RECALLOPS_ORACLE_SCM_RECALL_PATH", "/fscmRestApi/resources/latest/recallHolds"
    )

    status = integration_status()

    assert status["execution_ready_count"] == 2
    assert status["enterprise_sync"]["execution_ready_count"] == 2
    assert "sap-secret-token" not in str(status)
    assert "oracle-secret-token" not in str(status)


def test_enterprise_sync_dry_run_builds_sap_oracle_payloads() -> None:
    source_packet = build_source_evidence_packet()
    rules = assess_rules(source_packet)
    receipts = build_dispatch_receipts(source_packet)

    result = run_enterprise_sync(
        source_packet=source_packet,
        rule_assessment=rules,
        dispatch_receipts=receipts,
        dry_run=True,
    )

    assert result["mode"] == "dry_run_no_external_write"
    assert result["external_write"] is False
    assert len(result["payload_hash"]) == 64
    assert result["payload"]["lotNumber"] == "BAT-4421"
    assert [target["id"] for target in result["targets"]] == ["sap", "oracle"]
    assert all(target["status"] == "prepared" for target in result["targets"])


def test_enterprise_sync_live_uses_configured_sap_oracle_targets(monkeypatch) -> None:
    monkeypatch.setenv("RECALLOPS_SAP_BASE_URL", "https://sap.example")
    monkeypatch.setenv("RECALLOPS_SAP_API_KEY", "sap-secret-token")
    monkeypatch.setenv("RECALLOPS_SAP_RECALL_PATH", "/sap/opu/odata/sap/Z_RECALL_HOLD")
    monkeypatch.setenv("RECALLOPS_SAP_CSRF_ENABLED", "0")
    monkeypatch.setenv("RECALLOPS_ORACLE_SCM_URL", "https://oracle.example")
    monkeypatch.setenv("RECALLOPS_ORACLE_SCM_TOKEN", "oracle-secret-token")
    monkeypatch.setenv(
        "RECALLOPS_ORACLE_SCM_RECALL_PATH", "/fscmRestApi/resources/latest/recallHolds"
    )
    calls: list[dict[str, object]] = []

    def fake_post_json(**kwargs: object) -> dict[str, object]:
        calls.append(kwargs)
        return {
            "ok": True,
            "http_status": 201,
            "response_hash": "c" * 64,
            "response_excerpt": '{"id":"accepted"}',
        }

    monkeypatch.setattr("recallops.enterprise._post_json", fake_post_json)
    source_packet = build_source_evidence_packet()
    result = run_enterprise_sync(
        source_packet=source_packet,
        rule_assessment=assess_rules(source_packet),
        dispatch_receipts=build_dispatch_receipts(source_packet),
        dry_run=False,
    )

    assert [target["status"] for target in result["targets"]] == ["sent", "sent"]
    assert len(calls) == 2
    assert calls[0]["payload"]["LotNumber"] == "BAT-4421"
    assert calls[1]["payload"]["lotNumber"] == "BAT-4421"


def test_enterprise_write_authorization_requires_enablement_and_admin_key(monkeypatch) -> None:
    monkeypatch.delenv("RECALLOPS_ENABLE_ENTERPRISE_WRITES", raising=False)
    monkeypatch.delenv("RECALLOPS_ADMIN_ACTION_KEY", raising=False)

    with pytest.raises(EnterpriseSyncError):
        require_enterprise_write_authorization("key")

    monkeypatch.setenv("RECALLOPS_ENABLE_ENTERPRISE_WRITES", "1")
    monkeypatch.setenv("RECALLOPS_ADMIN_ACTION_KEY", "correct-key")

    with pytest.raises(EnterpriseSyncError):
        require_enterprise_write_authorization("wrong-key")

    require_enterprise_write_authorization("correct-key")


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
