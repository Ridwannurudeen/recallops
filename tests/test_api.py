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
    assert packet["incident_id"] == "INC-SOURCE-BAT-4421"
    assert packet["initial_traceability"]["coverage_percent"] == 82
    assert packet["final_traceability"]["coverage_percent"] == 100
    assert packet["missing_sources"] == ["SHIP-006"]
    assert packet["partner_ai"]["mode"] == "deterministic_source_parser"


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
    assert integrations.json()["mode"] == "adapter_registry"
    assert readiness.json()["persistence"]["mode"] == "sqlite_case_store"
    assert "production_blockers_remaining" in readiness.json()


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
    assert body["checks"]["captured_band_has_five_agents"] is True
    assert body["checks"]["rules_approval_ready"] is True
    assert body["checks"]["dispatch_receipts_prepared"] is True
    assert len(body["dispatch_receipts"]) == 3
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
