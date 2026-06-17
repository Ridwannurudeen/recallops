import asyncio

import httpx

from recallops.api import app


def get(path: str) -> httpx.Response:
    async def request() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.get(path)

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
