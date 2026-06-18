import asyncio

import httpx

from recallops.api import app


def get(path: str) -> httpx.Response:
    async def request() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.get(path)

    return asyncio.run(request())


def post(path: str, body: dict[str, object]) -> httpx.Response:
    async def request() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.post(path, json=body)

    return asyncio.run(request())


def post_with_headers(
    path: str,
    body: dict[str, object],
    headers: dict[str, str],
) -> httpx.Response:
    async def request() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.post(path, json=body, headers=headers)

    return asyncio.run(request())


def test_health_exposes_packet_identity() -> None:
    response = get("/api/health")

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert response.json()["lot"] == "BAT-4421"
    assert len(response.json()["audit_hash"]) == 64


def test_packet_endpoint_returns_sealed_packet() -> None:
    response = get("/api/packet")

    assert response.status_code == 200
    packet = response.json()
    assert packet["band_proof"]["proof_mode"] == "deterministic_packet_with_captured_band_run"
    assert packet["band_proof"]["veto_message_id"] == "msg-006"
    assert packet["decision"]["status"] == "approved"


def test_transcript_endpoint_returns_room_events() -> None:
    response = get("/api/transcript")

    assert response.status_code == 200
    transcript = response.json()
    assert transcript["room_id"] == "band-room-recallops-bat-4421"
    assert len(transcript["events"]) == transcript["band_proof"]["event_count"]


def test_packet_download_headers_are_submission_ready() -> None:
    response = get("/api/packet.json")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert "recallops-bat-4421-packet.json" in response.headers["content-disposition"]


def test_band_proof_endpoint_exposes_captured_run() -> None:
    response = get("/api/band-proof")

    assert response.status_code == 200
    body = response.json()
    captured_run = body["captured_band_run"]
    assert body["proof_kind"] == "captured_live_band_run"
    assert captured_run["proof_mode"] == "captured_band_five_agent_run"
    assert captured_run["room_id"] == "6dcd1018-bce3-481f-88d6-1ab67f6db452"
    assert captured_run["participant_count"] == 5
    assert captured_run["stage_evidence"][3]["stage"] == "regulatory_veto"
    assert (
        captured_run["stage_evidence"][3]["band_message_id"]
        == "bed6e1f4-f1cd-48a4-8f36-c09d7d9c9de9"
    )


def test_live_drill_status_endpoint_is_safe_by_default() -> None:
    response = get("/api/live-drill")

    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is False
    assert body["runnable"] is False


def test_source_evidence_endpoint_returns_computed_packet() -> None:
    response = get("/api/source-evidence")

    assert response.status_code == 200
    body = response.json()
    packet = body["packet"]
    assert body["verification"]["ok"] is True
    assert body["room"]["mode"] == "source_packet_parameterized_room"
    assert body["room"]["room_id"].startswith("source-room-")
    assert packet["incident_id"] == "INC-SOURCE-BAT-4421"
    assert packet["initial_traceability"]["coverage_percent"] == 82
    assert packet["final_traceability"]["coverage_percent"] == 100
    assert packet["missing_sources"] == ["SHIP-006"]
    assert packet["partner_ai"]["mode"] == "deterministic_source_parser"


def test_source_evidence_recompute_generates_parameterized_room() -> None:
    response = post(
        "/api/source-evidence",
        {
            "complaint_text": (
                "C-900 | product: Harbor Sensor | lot: LOT-900 | "
                "defect: cracked housing | severity: critical"
            ),
            "shipment_csv": (
                "source,distributor,region,customers,units,status\n"
                "SHIP-900,North Hub,US-West,10,100,traced\n"
                "SHIP-901,South Hub,US-East,10,100,missing\n"
            ),
            "recovered_shipment_csv": (
                "source,distributor,region,customers,units,status\n"
                "SHIP-900,North Hub,US-West,10,100,traced\n"
                "SHIP-901,South Hub,US-East,10,100,traced\n"
            ),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["packet"]["incident_id"] == "INC-SOURCE-LOT-900"
    assert body["packet"]["initial_traceability"]["coverage_percent"] == 50
    assert body["room"]["incident_id"] == "INC-SOURCE-LOT-900"
    assert body["room"]["approval_ready"] is True
    assert "Harbor Sensor" in body["room"]["events"][0]["message"]
    assert "50% with 100 untraced units" in body["room"]["events"][1]["message"]
    assert len(body["room"]["room_hash"]) == 64


def test_recall_room_run_binds_source_packet_to_band_reference() -> None:
    response = post(
        "/api/recall-room/run",
        {
            "complaint_text": (
                "C-900 | product: Harbor Sensor | lot: LOT-900 | "
                "defect: cracked housing | severity: critical"
            ),
            "shipment_csv": (
                "source,distributor,region,customers,units,status\n"
                "SHIP-900,North Hub,US-West,10,100,traced\n"
                "SHIP-901,South Hub,US-East,10,100,missing\n"
            ),
            "recovered_shipment_csv": (
                "source,distributor,region,customers,units,status\n"
                "SHIP-900,North Hub,US-West,10,100,traced\n"
                "SHIP-901,South Hub,US-East,10,100,traced\n"
            ),
        },
    )

    assert response.status_code == 200
    body = response.json()
    run = body["run"]
    assert body["packet"]["incident_id"] == "INC-SOURCE-LOT-900"
    assert run["proof_kind"] == "source_packet_to_recall_room_run"
    assert run["verification"]["ok"] is True
    assert run["room"]["incident_id"] == "INC-SOURCE-LOT-900"
    assert run["band"]["mode"] == "captured_band_reference_with_parameterized_source_room"
    assert run["band"]["participant_count"] == 5
    assert len(run["run_hash"]) == 64


def test_recall_room_run_live_band_falls_back_honestly_when_disabled() -> None:
    response = post("/api/recall-room/run", {"run_live_band": True})

    assert response.status_code == 200
    run = response.json()["run"]
    assert run["verification"]["ok"] is True
    assert run["band"]["live_error"]["status_code"] == 503
    assert "disabled" in run["band"]["live_error"]["detail"]


def test_filing_pack_generates_multijurisdiction_drafts() -> None:
    response = post(
        "/api/filing-pack",
        {
            "complaint_text": (
                "C-900 | product: Harbor Sensor | lot: LOT-900 | "
                "defect: cracked housing | severity: critical"
            ),
            "shipment_csv": (
                "source,distributor,region,customers,units,status\n"
                "SHIP-900,North Hub,US-West,10,100,traced\n"
                "SHIP-901,Euro Hub,EU-Central,10,100,missing\n"
            ),
            "recovered_shipment_csv": (
                "source,distributor,region,customers,units,status\n"
                "SHIP-900,North Hub,US-West,10,100,traced\n"
                "SHIP-901,Euro Hub,EU-Central,10,100,traced\n"
            ),
        },
    )

    assert response.status_code == 200
    body = response.json()
    filing_pack = body["filing_pack"]
    filing_ids = {filing["id"] for filing in filing_pack["filings"]}
    assert filing_pack["proof_kind"] == "multi_jurisdiction_recall_filing_pack"
    assert filing_pack["verification"]["ok"] is True
    assert "cpsc-15b-draft" in filing_ids
    assert "eu-safety-gate-draft" in filing_ids
    assert "Harbor Sensor" in filing_pack["notices"][0]["draft"]
    assert len(filing_pack["pack_hash"]) == 64


def test_regulator_filing_dry_run_prepares_target_dispatches() -> None:
    response = post("/api/regulator-filing", {})

    assert response.status_code == 200
    body = response.json()
    dispatch = body["regulator_dispatch"]
    assert dispatch["mode"] == "dry_run_no_external_submit"
    assert dispatch["external_submit"] is False
    assert [target["id"] for target in dispatch["targets"]] == ["cpsc", "eu", "regional"]
    assert all(target["status"] == "prepared" for target in dispatch["targets"])
    assert len(dispatch["payload_hash"]) == 64


def test_regulator_filing_live_requires_admin_gate(monkeypatch) -> None:
    monkeypatch.delenv("RECALLOPS_ENABLE_REGULATOR_WRITES", raising=False)
    monkeypatch.delenv("RECALLOPS_ADMIN_ACTION_KEY", raising=False)

    response = post("/api/regulator-filing", {"dry_run": False})

    assert response.status_code == 403
    assert "disabled" in response.json()["detail"]


def test_esignature_approval_requires_verified_identity(monkeypatch) -> None:
    monkeypatch.setenv("RECALLOPS_APPROVAL_ADMIN_KEY", "approval-key")
    source = get("/api/source-evidence").json()["packet"]
    room = get("/api/recall-room/run").json()["run"]
    filing = get("/api/filing-pack").json()["filing_pack"]
    body = {
        "approver": "QA Director",
        "decision": "approved",
        "reason": "I reviewed traceability, filing pack, and ERP dry-run.",
        "source_audit_hash": source["audit_hash"],
        "recall_room_run_hash": room["run_hash"],
        "filing_pack_hash": filing["pack_hash"],
    }
    blocked = post("/api/esignature-approval", body)
    approved = post_with_headers(
        "/api/esignature-approval",
        body,
        {"x-recallops-approval-key": "approval-key"},
    )

    assert blocked.status_code == 403
    assert approved.status_code == 200
    receipt = approved.json()["receipt"]
    assert receipt["controls"]["requires_verified_identity"] is True
    assert receipt["source_audit_hash"] == source["audit_hash"]
    assert receipt["recall_room_run_hash"] == room["run_hash"]
    assert receipt["filing_pack_hash"] == filing["pack_hash"]
    assert approved.json()["verification"]["ok"] is True


def test_source_evidence_recompute_rejects_bad_csv() -> None:
    response = post(
        "/api/source-evidence",
        {
            "shipment_csv": "source,distributor,region,customers,units,status\nSHIP-1,D,R,1,1,bad",
        },
    )

    assert response.status_code == 400
    assert "unsupported status" in response.json()["detail"]


def test_source_evidence_verify_endpoint_recomputes_digest() -> None:
    response = get("/api/source-evidence/verify")

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["incident_id"] == "INC-SOURCE-BAT-4421"
    assert body["expected_hash"] == body["actual_hash"]


def test_partner_ai_status_is_honest_about_usage() -> None:
    response = get("/api/partner-ai/status")

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "deterministic_source_parser"
    assert body["providers"]["ai_ml_api"]["used"] is False
    assert body["providers"]["featherless"]["used"] is False


def test_spend_limits_endpoint_reports_partner_ai_guard() -> None:
    response = get("/api/spend-limits")

    assert response.status_code == 200
    body = response.json()
    assert "partner_ai" in body
    assert "daily_limit" in body["partner_ai"]


def test_integrations_and_ops_readiness_are_explicit() -> None:
    integrations = get("/api/integrations")
    readiness = get("/api/ops-readiness")

    assert integrations.status_code == 200
    assert readiness.status_code == 200
    assert integrations.json()["mode"] == "credential_gated_adapter_registry"
    assert readiness.json()["persistence"]["mode"] == "sqlite_case_store"
    assert "identity" in readiness.json()
    assert "erp_contract" in readiness.json()
    assert "sap_api_hub" in readiness.json()
    assert "production_blockers_remaining" in readiness.json()


def test_enterprise_sync_get_returns_dry_run_payloads() -> None:
    response = get("/api/enterprise-sync")

    assert response.status_code == 200
    body = response.json()
    assert body["sync"]["mode"] == "dry_run_no_external_write"
    assert body["sync"]["external_write"] is False
    assert body["sync"]["payload"]["lotNumber"] == "BAT-4421"
    assert [target["id"] for target in body["sync"]["targets"]] == ["sap", "oracle"]


def test_sap_api_hub_endpoint_runs_probe(monkeypatch) -> None:
    monkeypatch.setenv("RECALLOPS_SAP_API_HUB_KEY", "sap-api-hub-secret")
    monkeypatch.setattr(
        "recallops.sap_sandbox._fetch_business_partner_sample",
        lambda **_: {"d": {"results": [{"BusinessPartner": "1000000"}]}},
    )

    response = get("/api/sap-api-hub")

    assert response.status_code == 200
    body = response.json()
    assert body["verified"] is True
    assert body["result_count"] == 1
    assert "sap-api-hub-secret" not in str(body)


def test_enterprise_sync_live_requires_admin_gate(monkeypatch) -> None:
    monkeypatch.delenv("RECALLOPS_ENABLE_ENTERPRISE_WRITES", raising=False)
    monkeypatch.delenv("RECALLOPS_ADMIN_ACTION_KEY", raising=False)

    response = post("/api/enterprise-sync", {"dry_run": False})

    assert response.status_code == 403
    assert "disabled" in response.json()["detail"]


def test_identity_status_and_protected_approval(monkeypatch) -> None:
    monkeypatch.setenv("RECALLOPS_APPROVAL_ADMIN_KEY", "approval-key")
    source = get("/api/source-evidence").json()["packet"]
    approval_body = {
        "approver": "QA Director",
        "decision": "approved",
        "reason": "Traceability reached 100% and the veto cleared.",
        "source_audit_hash": source["audit_hash"],
    }
    status = get("/api/identity/status")
    blocked = post("/api/identity-approval", approval_body)
    approved = post_with_headers(
        "/api/identity-approval",
        approval_body,
        {"x-recallops-approval-key": "approval-key"},
    )

    assert status.status_code == 200
    assert status.json()["approval_gate_ready"] is True
    assert blocked.status_code == 403
    assert approved.status_code == 200
    body = approved.json()
    assert body["identity"]["mode"] == "server_admin_key"
    assert body["receipt"]["identity"]["assurance_level"] == "server_verified_shared_secret"
    assert body["verification"]["ok"] is True


def test_erp_contract_receiver_records_redacted_receipts(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("RECALLOPS_ERP_CONTRACT_TOKEN", "contract-key")
    monkeypatch.setenv("RECALLOPS_ERP_CONTRACT_LOG", str(tmp_path / "erp.jsonl"))
    source = get("/api/source-evidence").json()["packet"]
    sap_payload = {
        "IncidentID": source["incident_id"],
        "SourceAuditHash": source["audit_hash"],
        "LotNumber": "BAT-4421",
        "RecallAction": "HOLD_AND_NOTIFY",
    }
    blocked = post("/api/erp-contract/sap", sap_payload)
    accepted = post_with_headers(
        "/api/erp-contract/sap",
        sap_payload,
        {"apikey": "contract-key"},
    )
    receipts = get("/api/erp-contract/receipts")

    assert blocked.status_code == 403
    assert accepted.status_code == 200
    assert accepted.json()["accepted"] is True
    assert receipts.status_code == 200
    assert receipts.json()["receipts"][0]["target"] == "sap"


def test_rules_endpoint_returns_recall_gates() -> None:
    response = get("/api/rules")

    assert response.status_code == 200
    body = response.json()
    assert body["approval_ready"] is True
    assert body["initial_blockers"][0]["id"] == "TRACEABILITY-BELOW-100"


def test_notification_dry_run_returns_dispatch_receipts() -> None:
    response = get("/api/notifications/dry-run")

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "dry_run_no_external_send"
    assert len(body["receipts"]) == 3
    assert body["receipts"][0]["status"] == "prepared"


def test_case_endpoints_persist_case(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("RECALLOPS_CASE_DB", str(tmp_path / "api-cases.sqlite3"))
    created = post("/api/cases", {})

    assert created.status_code == 200
    case_id = created.json()["case"]["case_id"]
    listed = get("/api/cases")
    detail = get(f"/api/cases/{case_id}")

    assert listed.status_code == 200
    assert listed.json()["cases"][0]["case_id"] == case_id
    assert detail.status_code == 200
    assert detail.json()["case"]["source_packet"]["incident_id"] == "INC-SOURCE-BAT-4421"


def test_source_evidence_partner_ai_request_reports_missing_keys() -> None:
    response = post("/api/source-evidence", {"use_partner_ai": True})

    assert response.status_code == 200
    partner_ai = response.json()["packet"]["partner_ai"]
    assert partner_ai["mode"] == "deterministic_source_parser"
    assert partner_ai["used_count"] == 0
    assert partner_ai["providers"]["ai_ml_api"]["status"] == "missing_key"
    assert partner_ai["providers"]["featherless"]["status"] == "missing_key"


def test_approval_receipt_endpoint_hashes_human_decision() -> None:
    source = get("/api/source-evidence").json()["packet"]
    response = post(
        "/api/approval-receipt",
        {
            "approver": "QA Director",
            "decision": "approved",
            "reason": "Traceability reached 100% and the veto cleared.",
            "source_audit_hash": source["audit_hash"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["verification"]["ok"] is True
    assert body["receipt"]["source_audit_hash"] == source["audit_hash"]
    assert "not a digital signature" in body["disclosure"]


def test_submission_proof_endpoint_returns_safe_bundle() -> None:
    response = get("/api/submission-proof")

    assert response.status_code == 200
    body = response.json()
    assert body["proof_kind"] == "recallops_submission_bundle"
    assert body["run_partner_ai"] is False
    assert body["packet"]["verification"]["ok"] is True
    assert body["source_evidence"]["verification"]["ok"] is True
    assert body["approval_receipt"]["verification"]["ok"] is True
    assert body["recall_room_run"]["verification"]["ok"] is True
    assert body["filing_pack"]["verification"]["ok"] is True
    assert body["regulator_dispatch"]["mode"] == "dry_run_no_external_submit"
    assert body["checks"]["captured_band_has_five_agents"] is True
    assert body["checks"]["recall_room_run_ok"] is True
    assert body["checks"]["filing_pack_ok"] is True
    assert body["checks"]["regulator_dispatch_prepared"] is True
    assert body["checks"]["rules_approval_ready"] is True
    assert body["checks"]["dispatch_receipts_prepared"] is True
    assert body["checks"]["sap_oracle_payloads_prepared"] is True
    assert "identity_gate_ready" in body["checks"]
    assert "esignature_gate_ready" in body["checks"]
    assert "erp_contract_live_write_verified" in body["checks"]
    assert "sap_api_hub_sandbox_verified" in body["checks"]
    assert len(body["dispatch_receipts"]) == 3
    assert body["enterprise_sync"]["mode"] == "dry_run_no_external_write"
    assert "identity" in body
    assert "erp_contract" in body
    assert "sap_api_hub" in body
    assert body["production_readiness"]["persistence"]["mode"] == "sqlite_case_store"
    assert body["submission_gates"]["repo_visibility"] == "private_until_user_approves_public_flip"


def test_submission_proof_post_can_run_partner_ai(monkeypatch) -> None:
    def fake_partner_ai(**_: str) -> dict[str, object]:
        return {
            "mode": "partner_ai_assisted",
            "used_count": 2,
            "providers": {
                "ai_ml_api": {
                    "provider": "AI/ML API",
                    "configured": True,
                    "used": True,
                    "status": "used",
                    "model": "gpt-4o-mini",
                    "role": "risk-decision adapter",
                    "response_hash": "a" * 64,
                    "output": {"decision": "approve"},
                },
                "featherless": {
                    "provider": "Featherless",
                    "configured": True,
                    "used": True,
                    "status": "used",
                    "model": "Qwen/Qwen2.5-7B-Instruct",
                    "role": "evidence-extraction adapter",
                    "response_hash": "b" * 64,
                    "output": {"lot": "BAT-4421"},
                },
            },
        }

    monkeypatch.setattr("recallops.api.run_partner_ai", fake_partner_ai)

    response = post("/api/submission-proof", {})

    assert response.status_code == 200
    body = response.json()
    assert body["run_partner_ai"] is True
    assert body["source_evidence"]["partner_ai"]["mode"] == "partner_ai_assisted"
    assert body["checks"]["partner_ai_used_count"] == 2
    assert body["checks"]["partner_ai_used_both"] is True
    assert body["approval_receipt"]["verification"]["ok"] is True


def test_receipts_endpoint_returns_hash_chain() -> None:
    response = get("/api/receipts")

    assert response.status_code == 200
    body = response.json()
    assert body["receipts"][0]["previous_hash"] == "0" * 64
    assert body["receipts"][-1]["status"] == "sealed"


def test_decision_graph_endpoint_returns_veto_path() -> None:
    response = get("/api/decision-graph")

    assert response.status_code == 200
    body = response.json()
    assert any(edge["label"] == "veto forces re-plan" for edge in body["edges"])


def test_verify_endpoint_recomputes_audit_digest() -> None:
    response = get("/api/verify")

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["algorithm"] == "sha256"
    assert body["expected_hash"] == body["actual_hash"]
