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
