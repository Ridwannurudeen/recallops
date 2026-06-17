from __future__ import annotations

import json
from typing import Literal

from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel

from recallops import build_recall_packet, verify_packet_digest
from recallops.approval import build_approval_receipt, verify_approval_receipt
from recallops.live_drill import LiveDrillError, live_drill_status, run_live_drill
from recallops.live_proof import captured_band_proof
from recallops.source_evidence import (
    DEFAULT_COMPLAINT_TEXT,
    DEFAULT_RECOVERED_SHIPMENT_CSV,
    DEFAULT_SHIPMENT_CSV,
    build_source_evidence_packet,
    verify_source_evidence_digest,
)

app = FastAPI(
    title="RecallOps API",
    version="0.1.0",
    description="Executable recall packet and transcript endpoints for the RecallOps demo.",
)


class SourceEvidenceRequest(BaseModel):
    complaint_text: str | None = None
    shipment_csv: str | None = None
    recovered_shipment_csv: str | None = None


class ApprovalReceiptRequest(BaseModel):
    approver: str
    decision: Literal["approved", "rejected"] = "approved"
    reason: str
    source_audit_hash: str
    previous_hash: str = "0" * 64


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


@app.get("/api/live-drill")
def live_drill() -> dict[str, object]:
    return live_drill_status()


@app.post("/api/live-drill")
async def run_live_drill_endpoint() -> dict[str, object]:
    try:
        return await run_live_drill()
    except LiveDrillError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@app.get("/api/source-evidence")
def source_evidence() -> dict[str, object]:
    packet = build_source_evidence_packet()
    return {
        "inputs": {
            "complaint_text": DEFAULT_COMPLAINT_TEXT,
            "shipment_csv": DEFAULT_SHIPMENT_CSV,
            "recovered_shipment_csv": DEFAULT_RECOVERED_SHIPMENT_CSV,
        },
        "packet": packet.to_dict(),
        "verification": verify_source_evidence_digest(packet),
    }


@app.post("/api/source-evidence")
def recompute_source_evidence(request: SourceEvidenceRequest) -> dict[str, object]:
    try:
        complaint_text = request.complaint_text or DEFAULT_COMPLAINT_TEXT
        shipment_csv = request.shipment_csv or DEFAULT_SHIPMENT_CSV
        recovered_shipment_csv = request.recovered_shipment_csv or DEFAULT_RECOVERED_SHIPMENT_CSV
        packet = build_source_evidence_packet(
            complaint_text=complaint_text,
            shipment_csv=shipment_csv,
            recovered_shipment_csv=recovered_shipment_csv,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "inputs": {
            "complaint_text": complaint_text,
            "shipment_csv": shipment_csv,
            "recovered_shipment_csv": recovered_shipment_csv,
        },
        "packet": packet.to_dict(),
        "verification": verify_source_evidence_digest(packet),
    }


@app.get("/api/source-evidence/verify")
def source_evidence_verify() -> dict[str, object]:
    packet = build_source_evidence_packet()
    return {
        "incident_id": packet.incident_id,
        **verify_source_evidence_digest(packet),
    }


@app.get("/api/partner-ai/status")
def partner_ai_status() -> dict[str, object]:
    return build_source_evidence_packet().partner_ai


@app.post("/api/approval-receipt")
def approval_receipt(request: ApprovalReceiptRequest) -> dict[str, object]:
    try:
        receipt = build_approval_receipt(
            approver=request.approver,
            decision=request.decision,
            reason=request.reason,
            source_audit_hash=request.source_audit_hash,
            previous_hash=request.previous_hash,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "receipt": receipt.to_dict(),
        "verification": verify_approval_receipt(receipt),
        "disclosure": "Receipt hash covers the approval payload; it is not a digital signature.",
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
