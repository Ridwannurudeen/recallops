from __future__ import annotations

import json

from fastapi import FastAPI, Response

from recallops import build_recall_packet, verify_packet_digest
from recallops.live_proof import captured_band_proof

app = FastAPI(
    title="RecallOps API",
    version="0.1.0",
    description="Executable recall packet and transcript endpoints for the RecallOps demo.",
)


@app.get("/api/health")
def health() -> dict[str, int | str | bool]:
    packet = build_recall_packet()
    return {
        "ok": True,
        "proof_mode": packet.band_proof["proof_mode"],
        "room_id": packet.room_id,
        "lot": packet.lot,
        "events": len(packet.events),
        "audit_hash": packet.audit_hash,
    }


@app.get("/api/packet")
def packet() -> dict[str, object]:
    return build_recall_packet().to_dict()


@app.get("/api/transcript")
def transcript() -> dict[str, object]:
    packet = build_recall_packet()
    return {
        "room_id": packet.room_id,
        "events": [event.__dict__ for event in packet.events],
        "band_proof": packet.band_proof,
    }


@app.get("/api/proof")
def proof() -> dict[str, object]:
    packet = build_recall_packet()
    return {
        "room_id": packet.room_id,
        "incident_id": packet.incident_id,
        "decision": packet.decision,
        "initial_traceability": packet.initial_traceability.__dict__,
        "final_traceability": packet.final_traceability.__dict__,
        "band_proof": packet.band_proof,
        "audit_hash": packet.audit_hash,
    }


@app.get("/api/band-proof")
def band_proof() -> dict[str, object]:
    return {
        "proof_kind": "captured_live_band_run",
        "disclosure": (
            "The BAT-4421 packet is deterministic for judge replay. "
            "This endpoint exposes the real Band room run captured from the five-agent spike."
        ),
        "captured_band_run": captured_band_proof(),
    }


@app.get("/api/receipts")
def receipts() -> dict[str, object]:
    packet = build_recall_packet()
    return {
        "room_id": packet.room_id,
        "audit_hash": packet.audit_hash,
        "receipts": [receipt.__dict__ for receipt in packet.receipts],
    }


@app.get("/api/decision-graph")
def decision_graph() -> dict[str, object]:
    packet = build_recall_packet()
    return {
        "room_id": packet.room_id,
        "nodes": [node.__dict__ for node in packet.decision_graph["nodes"]],
        "edges": [edge.__dict__ for edge in packet.decision_graph["edges"]],
    }


@app.get("/api/verify")
def verify() -> dict[str, object]:
    packet = build_recall_packet()
    return {
        "room_id": packet.room_id,
        "incident_id": packet.incident_id,
        **verify_packet_digest(packet),
    }


@app.get("/api/packet.json")
def packet_download() -> Response:
    packet_json = json.dumps(build_recall_packet().to_dict(), indent=2)
    return Response(
        content=packet_json,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="recallops-bat-4421-packet.json"'},
    )
