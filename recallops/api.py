from __future__ import annotations

import json
from typing import Literal

from fastapi import FastAPI, Header, HTTPException, Response
from pydantic import BaseModel

from recallops import build_recall_packet, verify_packet_digest
from recallops.approval import build_approval_receipt, verify_approval_receipt
from recallops.cases import create_case_record, get_case_record, list_case_records
from recallops.enterprise import (
    EnterpriseSyncError,
    enterprise_sync_status,
    integration_status,
    ops_readiness,
    require_enterprise_write_authorization,
    run_enterprise_sync,
)
from recallops.erp_contract import (
    ContractReceiverError,
    contract_receipts,
    contract_status,
    record_contract_write,
    require_contract_authorization,
)
from recallops.esignature import build_esignature_receipt, verify_esignature_receipt
from recallops.filing_pack import build_filing_pack, verify_filing_pack
from recallops.identity import IdentityError, identity_status, resolve_approval_identity
from recallops.live_drill import LiveDrillError, live_drill_status, run_live_drill
from recallops.live_proof import captured_band_proof
from recallops.notifications import build_dispatch_receipts
from recallops.partner_ai import partner_ai_status as current_partner_ai_status
from recallops.partner_ai import run_partner_ai
from recallops.rate_limit import SpendLimitError, acquire_spend_permit, spend_limit_status
from recallops.recall_room import (
    build_recall_room_run,
    build_source_room,
    spike_incident_payload,
    verify_recall_room_run,
)
from recallops.regulatory import (
    RegulatoryFilingError,
    regulator_filing_status,
    require_regulator_authorization,
    run_regulator_filing,
)
from recallops.rules import assess_rules
from recallops.sap_sandbox import run_sap_api_hub_probe, sap_api_hub_status
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
    use_partner_ai: bool = False


class RecallRoomRunRequest(SourceEvidenceRequest):
    run_live_band: bool = False


class FilingPackRequest(SourceEvidenceRequest):
    pass


class RegulatorFilingRequest(FilingPackRequest):
    dry_run: bool = True
    targets: tuple[Literal["cpsc", "eu", "regional"], ...] = ("cpsc", "eu", "regional")


class ESignatureApprovalRequest(BaseModel):
    approver: str
    decision: Literal["approved", "rejected"] = "approved"
    reason: str
    source_audit_hash: str
    recall_room_run_hash: str
    filing_pack_hash: str
    previous_hash: str = "0" * 64


class ApprovalReceiptRequest(BaseModel):
    approver: str
    decision: Literal["approved", "rejected"] = "approved"
    reason: str
    source_audit_hash: str
    previous_hash: str = "0" * 64


class SubmissionProofRequest(BaseModel):
    run_partner_ai: bool = True


class CreateCaseRequest(SourceEvidenceRequest):
    pass


class EnterpriseSyncRequest(SourceEvidenceRequest):
    dry_run: bool = True
    targets: tuple[Literal["sap", "oracle"], ...] = ("sap", "oracle")


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
    rule_assessment = assess_rules(packet)
    return {
        "inputs": {
            "complaint_text": DEFAULT_COMPLAINT_TEXT,
            "shipment_csv": DEFAULT_SHIPMENT_CSV,
            "recovered_shipment_csv": DEFAULT_RECOVERED_SHIPMENT_CSV,
        },
        "packet": packet.to_dict(),
        "room": build_source_room(packet, rule_assessment),
        "verification": verify_source_evidence_digest(packet),
    }


@app.post("/api/source-evidence")
def recompute_source_evidence(request: SourceEvidenceRequest) -> dict[str, object]:
    try:
        complaint_text = request.complaint_text or DEFAULT_COMPLAINT_TEXT
        shipment_csv = request.shipment_csv or DEFAULT_SHIPMENT_CSV
        recovered_shipment_csv = request.recovered_shipment_csv or DEFAULT_RECOVERED_SHIPMENT_CSV
        partner_ai = (
            _run_partner_ai_guarded(
                complaint_text=complaint_text,
                shipment_csv=shipment_csv,
                recovered_shipment_csv=recovered_shipment_csv,
            )
            if request.use_partner_ai
            else None
        )
        packet = build_source_evidence_packet(
            complaint_text=complaint_text,
            shipment_csv=shipment_csv,
            recovered_shipment_csv=recovered_shipment_csv,
            partner_ai=partner_ai,
        )
        rule_assessment = assess_rules(packet)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "inputs": {
            "complaint_text": complaint_text,
            "shipment_csv": shipment_csv,
            "recovered_shipment_csv": recovered_shipment_csv,
        },
        "packet": packet.to_dict(),
        "room": build_source_room(packet, rule_assessment),
        "verification": verify_source_evidence_digest(packet),
    }


@app.get("/api/recall-room/run")
def default_recall_room_run() -> dict[str, object]:
    source_packet = build_source_evidence_packet()
    rule_assessment = assess_rules(source_packet)
    run = build_recall_room_run(
        source_packet=source_packet,
        rule_assessment=rule_assessment,
        live_band_status=live_drill_status(),
    )
    return {
        "inputs": {
            "complaint_text": DEFAULT_COMPLAINT_TEXT,
            "shipment_csv": DEFAULT_SHIPMENT_CSV,
            "recovered_shipment_csv": DEFAULT_RECOVERED_SHIPMENT_CSV,
        },
        "packet": source_packet.to_dict(),
        "rule_assessment": rule_assessment,
        "run": run,
    }


@app.post("/api/recall-room/run")
async def run_recall_room(request: RecallRoomRunRequest) -> dict[str, object]:
    try:
        complaint_text = request.complaint_text or DEFAULT_COMPLAINT_TEXT
        shipment_csv = request.shipment_csv or DEFAULT_SHIPMENT_CSV
        recovered_shipment_csv = request.recovered_shipment_csv or DEFAULT_RECOVERED_SHIPMENT_CSV
        partner_ai = (
            _run_partner_ai_guarded(
                complaint_text=complaint_text,
                shipment_csv=shipment_csv,
                recovered_shipment_csv=recovered_shipment_csv,
            )
            if request.use_partner_ai
            else None
        )
        source_packet = build_source_evidence_packet(
            complaint_text=complaint_text,
            shipment_csv=shipment_csv,
            recovered_shipment_csv=recovered_shipment_csv,
            partner_ai=partner_ai,
        )
        rule_assessment = assess_rules(source_packet)
        fresh_band_run = None
        live_band_error = None
        if request.run_live_band:
            try:
                fresh_band_run = await run_live_drill(
                    incident=spike_incident_payload(source_packet)
                )
            except LiveDrillError as exc:
                live_band_error = {
                    "status_code": exc.status_code,
                    "detail": exc.detail,
                }
        run = build_recall_room_run(
            source_packet=source_packet,
            rule_assessment=rule_assessment,
            live_band_status=live_drill_status(),
            fresh_band_run=fresh_band_run,
            live_band_error=live_band_error,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "inputs": {
            "complaint_text": complaint_text,
            "shipment_csv": shipment_csv,
            "recovered_shipment_csv": recovered_shipment_csv,
        },
        "packet": source_packet.to_dict(),
        "rule_assessment": rule_assessment,
        "run": run,
    }


@app.get("/api/filing-pack")
def default_filing_pack() -> dict[str, object]:
    source_packet = build_source_evidence_packet()
    rule_assessment = assess_rules(source_packet)
    dispatch_receipts = build_dispatch_receipts(source_packet)
    filing_pack = build_filing_pack(
        source_packet=source_packet,
        rule_assessment=rule_assessment,
        dispatch_receipts=dispatch_receipts,
    )
    return {
        "inputs": {
            "complaint_text": DEFAULT_COMPLAINT_TEXT,
            "shipment_csv": DEFAULT_SHIPMENT_CSV,
            "recovered_shipment_csv": DEFAULT_RECOVERED_SHIPMENT_CSV,
        },
        "packet": source_packet.to_dict(),
        "rule_assessment": rule_assessment,
        "filing_pack": filing_pack,
    }


@app.post("/api/filing-pack")
def run_filing_pack(request: FilingPackRequest) -> dict[str, object]:
    try:
        complaint_text = request.complaint_text or DEFAULT_COMPLAINT_TEXT
        shipment_csv = request.shipment_csv or DEFAULT_SHIPMENT_CSV
        recovered_shipment_csv = request.recovered_shipment_csv or DEFAULT_RECOVERED_SHIPMENT_CSV
        partner_ai = (
            _run_partner_ai_guarded(
                complaint_text=complaint_text,
                shipment_csv=shipment_csv,
                recovered_shipment_csv=recovered_shipment_csv,
            )
            if request.use_partner_ai
            else None
        )
        source_packet = build_source_evidence_packet(
            complaint_text=complaint_text,
            shipment_csv=shipment_csv,
            recovered_shipment_csv=recovered_shipment_csv,
            partner_ai=partner_ai,
        )
        rule_assessment = assess_rules(source_packet)
        dispatch_receipts = build_dispatch_receipts(source_packet)
        filing_pack = build_filing_pack(
            source_packet=source_packet,
            rule_assessment=rule_assessment,
            dispatch_receipts=dispatch_receipts,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "inputs": {
            "complaint_text": complaint_text,
            "shipment_csv": shipment_csv,
            "recovered_shipment_csv": recovered_shipment_csv,
        },
        "packet": source_packet.to_dict(),
        "rule_assessment": rule_assessment,
        "filing_pack": filing_pack,
    }


@app.get("/api/regulator-filing/status")
def regulator_status() -> dict[str, object]:
    return regulator_filing_status()


@app.post("/api/regulator-filing")
def regulator_filing(
    request: RegulatorFilingRequest,
    x_recallops_admin_key: str | None = Header(default=None),
) -> dict[str, object]:
    try:
        if not request.dry_run:
            require_regulator_authorization(x_recallops_admin_key)
        complaint_text = request.complaint_text or DEFAULT_COMPLAINT_TEXT
        shipment_csv = request.shipment_csv or DEFAULT_SHIPMENT_CSV
        recovered_shipment_csv = request.recovered_shipment_csv or DEFAULT_RECOVERED_SHIPMENT_CSV
        partner_ai = (
            _run_partner_ai_guarded(
                complaint_text=complaint_text,
                shipment_csv=shipment_csv,
                recovered_shipment_csv=recovered_shipment_csv,
            )
            if request.use_partner_ai
            else None
        )
        source_packet = build_source_evidence_packet(
            complaint_text=complaint_text,
            shipment_csv=shipment_csv,
            recovered_shipment_csv=recovered_shipment_csv,
            partner_ai=partner_ai,
        )
        rule_assessment = assess_rules(source_packet)
        dispatch_receipts = build_dispatch_receipts(source_packet)
        filing_pack = build_filing_pack(
            source_packet=source_packet,
            rule_assessment=rule_assessment,
            dispatch_receipts=dispatch_receipts,
        )
        regulator_dispatch = run_regulator_filing(
            filing_pack=filing_pack,
            dry_run=request.dry_run,
            targets=request.targets,
        )
    except RegulatoryFilingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "inputs": {
            "complaint_text": complaint_text,
            "shipment_csv": shipment_csv,
            "recovered_shipment_csv": recovered_shipment_csv,
        },
        "packet": source_packet.to_dict(),
        "rule_assessment": rule_assessment,
        "filing_pack": filing_pack,
        "regulator_dispatch": regulator_dispatch,
    }


@app.post("/api/esignature-approval")
def esignature_approval(
    request: ESignatureApprovalRequest,
    x_recallops_approval_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    try:
        identity = resolve_approval_identity(
            approver=request.approver,
            provided_admin_key=x_recallops_approval_key,
            authorization=authorization,
        )
        receipt = build_esignature_receipt(
            approver=request.approver,
            decision=request.decision,
            reason=request.reason,
            source_audit_hash=request.source_audit_hash,
            recall_room_run_hash=request.recall_room_run_hash,
            filing_pack_hash=request.filing_pack_hash,
            previous_hash=request.previous_hash,
            identity=identity,
        )
    except IdentityError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "receipt": receipt.to_dict(),
        "verification": verify_esignature_receipt(receipt),
        "identity": identity,
        "disclosure": (
            "Attributable e-signature receipt with server-verified identity, "
            "signature meaning, source hash, room-run hash, and filing-pack hash."
        ),
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
    return current_partner_ai_status()


@app.get("/api/spend-limits")
def spend_limits() -> dict[str, object]:
    return {"partner_ai": spend_limit_status()}


@app.get("/api/integrations")
def integrations() -> dict[str, object]:
    return integration_status()


@app.get("/api/ops-readiness")
def readiness() -> dict[str, object]:
    return {
        **ops_readiness(),
        "spend_limits": spend_limits(),
        "identity": identity_status(),
        "erp_contract": contract_status(),
        "regulator_filing": regulator_filing_status(),
        "sap_api_hub": sap_api_hub_status(),
    }


@app.get("/api/enterprise-sync")
def enterprise_sync_dry_run() -> dict[str, object]:
    return _enterprise_sync_from_inputs(
        complaint_text=DEFAULT_COMPLAINT_TEXT,
        shipment_csv=DEFAULT_SHIPMENT_CSV,
        recovered_shipment_csv=DEFAULT_RECOVERED_SHIPMENT_CSV,
        partner_ai=None,
        dry_run=True,
        targets=("sap", "oracle"),
    )


@app.get("/api/sap-api-hub")
def sap_api_hub() -> dict[str, object]:
    return run_sap_api_hub_probe()


@app.post("/api/enterprise-sync")
def enterprise_sync(
    request: EnterpriseSyncRequest,
    x_recallops_admin_key: str | None = Header(default=None),
) -> dict[str, object]:
    try:
        if not request.dry_run:
            require_enterprise_write_authorization(x_recallops_admin_key)
        complaint_text = request.complaint_text or DEFAULT_COMPLAINT_TEXT
        shipment_csv = request.shipment_csv or DEFAULT_SHIPMENT_CSV
        recovered_shipment_csv = request.recovered_shipment_csv or DEFAULT_RECOVERED_SHIPMENT_CSV
        partner_ai = (
            _run_partner_ai_guarded(
                complaint_text=complaint_text,
                shipment_csv=shipment_csv,
                recovered_shipment_csv=recovered_shipment_csv,
            )
            if request.use_partner_ai
            else None
        )
        return _enterprise_sync_from_inputs(
            complaint_text=complaint_text,
            shipment_csv=shipment_csv,
            recovered_shipment_csv=recovered_shipment_csv,
            partner_ai=partner_ai,
            dry_run=request.dry_run,
            targets=request.targets,
        )
    except EnterpriseSyncError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/identity/status")
def approval_identity_status() -> dict[str, object]:
    return identity_status()


@app.post("/api/identity-approval")
def identity_approval_receipt(
    request: ApprovalReceiptRequest,
    x_recallops_approval_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    try:
        identity = resolve_approval_identity(
            approver=request.approver,
            provided_admin_key=x_recallops_approval_key,
            authorization=authorization,
        )
        receipt = build_approval_receipt(
            approver=request.approver,
            decision=request.decision,
            reason=request.reason,
            source_audit_hash=request.source_audit_hash,
            previous_hash=request.previous_hash,
            identity=identity,
        )
    except IdentityError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "receipt": receipt.to_dict(),
        "verification": verify_approval_receipt(receipt),
        "identity": identity,
        "disclosure": "Identity approval is server-verified, then sealed into the receipt hash.",
    }


@app.get("/api/erp-contract/status")
def erp_contract_status() -> dict[str, object]:
    return contract_status()


@app.get("/api/erp-contract/receipts")
def erp_contract_receipts() -> dict[str, object]:
    return {"receipts": contract_receipts()}


@app.post("/api/erp-contract/{target}")
def erp_contract_receiver(
    target: Literal["sap", "oracle"],
    request: dict[str, object],
    authorization: str | None = Header(default=None),
    apikey: str | None = Header(default=None),
    x_recallops_contract_token: str | None = Header(default=None),
) -> dict[str, object]:
    try:
        require_contract_authorization(
            authorization=authorization,
            apikey=apikey,
            contract_token=x_recallops_contract_token,
        )
        return record_contract_write(target=target, payload=request)
    except ContractReceiverError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@app.get("/api/rules")
def rules() -> dict[str, object]:
    source_packet = build_source_evidence_packet()
    return assess_rules(source_packet)


@app.get("/api/notifications/dry-run")
def notification_dry_run() -> dict[str, object]:
    source_packet = build_source_evidence_packet()
    receipts = build_dispatch_receipts(source_packet)
    return {
        "mode": "dry_run_no_external_send",
        "receipts": [receipt.to_dict() for receipt in receipts],
    }


@app.get("/api/cases")
def cases() -> dict[str, object]:
    return {"cases": list_case_records()}


@app.post("/api/cases")
def create_case(request: CreateCaseRequest) -> dict[str, object]:
    try:
        complaint_text = request.complaint_text or DEFAULT_COMPLAINT_TEXT
        shipment_csv = request.shipment_csv or DEFAULT_SHIPMENT_CSV
        recovered_shipment_csv = request.recovered_shipment_csv or DEFAULT_RECOVERED_SHIPMENT_CSV
        partner_ai = (
            _run_partner_ai_guarded(
                complaint_text=complaint_text,
                shipment_csv=shipment_csv,
                recovered_shipment_csv=recovered_shipment_csv,
            )
            if request.use_partner_ai
            else None
        )
        source_packet = build_source_evidence_packet(
            complaint_text=complaint_text,
            shipment_csv=shipment_csv,
            recovered_shipment_csv=recovered_shipment_csv,
            partner_ai=partner_ai,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    rule_assessment = assess_rules(source_packet)
    dispatch_receipts = build_dispatch_receipts(source_packet)
    record = create_case_record(
        source_packet=source_packet,
        rule_assessment=rule_assessment,
        dispatch_receipts=dispatch_receipts,
    )
    return {"case": record}


@app.get("/api/cases/{case_id}")
def case_detail(case_id: str) -> dict[str, object]:
    record = get_case_record(case_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Case not found.")
    return {"case": record}


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


@app.get("/api/submission-proof")
def submission_proof() -> dict[str, object]:
    return _submission_proof(run_partner_ai_proof=False)


@app.post("/api/submission-proof")
def run_submission_proof(request: SubmissionProofRequest | None = None) -> dict[str, object]:
    run_partner_ai_proof = True if request is None else request.run_partner_ai
    return _submission_proof(run_partner_ai_proof=run_partner_ai_proof)


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


def _submission_proof(*, run_partner_ai_proof: bool) -> dict[str, object]:
    recall_packet = build_recall_packet()
    partner_ai = (
        _run_partner_ai_guarded(
            complaint_text=DEFAULT_COMPLAINT_TEXT,
            shipment_csv=DEFAULT_SHIPMENT_CSV,
            recovered_shipment_csv=DEFAULT_RECOVERED_SHIPMENT_CSV,
        )
        if run_partner_ai_proof
        else current_partner_ai_status()
    )
    source_packet = build_source_evidence_packet(partner_ai=partner_ai)
    rule_assessment = assess_rules(source_packet)
    dispatch_receipts = build_dispatch_receipts(source_packet)
    recall_room_run = build_recall_room_run(
        source_packet=source_packet,
        rule_assessment=rule_assessment,
        live_band_status=live_drill_status(),
    )
    filing_pack = build_filing_pack(
        source_packet=source_packet,
        rule_assessment=rule_assessment,
        dispatch_receipts=dispatch_receipts,
    )
    regulator_dispatch = run_regulator_filing(
        filing_pack=filing_pack,
        dry_run=True,
        targets=("cpsc", "eu", "regional"),
    )
    enterprise_sync = run_enterprise_sync(
        source_packet=source_packet,
        rule_assessment=rule_assessment,
        dispatch_receipts=dispatch_receipts,
        dry_run=True,
    )
    approval = build_approval_receipt(
        approver="QA Director",
        decision="approved",
        reason="Traceability reached 100%, partner evidence was reviewed, and the risk veto cleared.",
        source_audit_hash=source_packet.audit_hash,
    )
    packet_verification = verify_packet_digest(recall_packet)
    source_verification = verify_source_evidence_digest(source_packet)
    approval_verification = verify_approval_receipt(approval)
    approval_identity = identity_status()
    erp_contract = contract_status()
    sap_api_hub = run_sap_api_hub_probe()
    fresh_band_status = live_drill_status()
    latest_fresh_run = fresh_band_status["latest_run"]
    captured_run = captured_band_proof()
    partner_ai_used_count = int(partner_ai.get("used_count", 0))
    captured_participants = int(captured_run["participant_count"])

    return {
        "proof_kind": "recallops_submission_bundle",
        "run_partner_ai": run_partner_ai_proof,
        "links": {
            "demo": "https://recallops.gudman.xyz",
            "repository": "https://github.com/Ridwannurudeen/recallops",
            "packet": "https://recallops.gudman.xyz/api/packet",
            "source_evidence": "https://recallops.gudman.xyz/api/source-evidence",
            "band_proof": "https://recallops.gudman.xyz/api/band-proof",
            "live_drill": "https://recallops.gudman.xyz/api/live-drill",
            "recall_room_run": "https://recallops.gudman.xyz/api/recall-room/run",
            "filing_pack": "https://recallops.gudman.xyz/api/filing-pack",
            "regulator_filing": "https://recallops.gudman.xyz/api/regulator-filing",
            "esignature_approval": "https://recallops.gudman.xyz/api/esignature-approval",
            "enterprise_sync": "https://recallops.gudman.xyz/api/enterprise-sync",
        },
        "submission_gates": {
            "demo_url": "ready",
            "repo_visibility": "private_until_user_approves_public_flip",
            "video": "record_before_submission",
            "submit": "requires_explicit_user_approval",
        },
        "packet": {
            "room_id": recall_packet.room_id,
            "incident_id": recall_packet.incident_id,
            "decision": recall_packet.decision,
            "audit_hash": recall_packet.audit_hash,
            "verification": packet_verification,
        },
        "source_evidence": {
            "incident_id": source_packet.incident_id,
            "audit_hash": source_packet.audit_hash,
            "initial_traceability": source_packet.initial_traceability.__dict__,
            "final_traceability": source_packet.final_traceability.__dict__,
            "missing_sources": source_packet.missing_sources,
            "partner_ai": source_packet.partner_ai,
            "verification": source_verification,
        },
        "rule_assessment": rule_assessment,
        "recall_room_run": recall_room_run,
        "filing_pack": filing_pack,
        "regulator_dispatch": regulator_dispatch,
        "dispatch_receipts": [receipt.to_dict() for receipt in dispatch_receipts],
        "enterprise_sync": enterprise_sync,
        "identity": approval_identity,
        "erp_contract": erp_contract,
        "sap_api_hub": sap_api_hub,
        "production_readiness": ops_readiness(),
        "approval_receipt": {
            "receipt": approval.to_dict(),
            "verification": approval_verification,
            "disclosure": "Receipt hash covers the approval payload; it is not a digital signature.",
        },
        "band": {
            "captured_run": captured_run,
            "fresh_run_status": fresh_band_status,
        },
        "checks": {
            "packet_digest_ok": packet_verification["ok"],
            "source_digest_ok": source_verification["ok"],
            "recall_room_run_ok": verify_recall_room_run(recall_room_run)["ok"],
            "filing_pack_ok": verify_filing_pack(filing_pack)["ok"],
            "regulator_dispatch_prepared": all(
                target["status"] == "prepared" for target in regulator_dispatch["targets"]
            ),
            "approval_receipt_ok": approval_verification["ok"],
            "captured_band_has_five_agents": captured_participants == 5,
            "fresh_band_run_available": latest_fresh_run is not None,
            "partner_ai_used_count": partner_ai_used_count,
            "partner_ai_used_both": partner_ai_used_count == 2,
            "rules_approval_ready": rule_assessment["approval_ready"],
            "dispatch_receipts_prepared": all(
                receipt.status == "prepared" for receipt in dispatch_receipts
            ),
            "sap_oracle_payloads_prepared": all(
                target["status"] == "prepared" for target in enterprise_sync["targets"]
            ),
            "identity_gate_ready": approval_identity["approval_gate_ready"],
            "esignature_gate_ready": approval_identity["approval_gate_ready"],
            "erp_contract_live_write_verified": erp_contract["latest_pair_verified"],
            "sap_api_hub_sandbox_verified": sap_api_hub["verified"],
        },
    }


def _enterprise_sync_from_inputs(
    *,
    complaint_text: str,
    shipment_csv: str,
    recovered_shipment_csv: str,
    partner_ai: dict[str, object] | None,
    dry_run: bool,
    targets: tuple[Literal["sap", "oracle"], ...],
) -> dict[str, object]:
    source_packet = build_source_evidence_packet(
        complaint_text=complaint_text,
        shipment_csv=shipment_csv,
        recovered_shipment_csv=recovered_shipment_csv,
        partner_ai=partner_ai,
    )
    rule_assessment = assess_rules(source_packet)
    dispatch_receipts = build_dispatch_receipts(source_packet)
    return {
        "sync": run_enterprise_sync(
            source_packet=source_packet,
            rule_assessment=rule_assessment,
            dispatch_receipts=dispatch_receipts,
            dry_run=dry_run,
            targets=targets,
        ),
        "status": enterprise_sync_status(),
    }


def _run_partner_ai_guarded(
    *,
    complaint_text: str,
    shipment_csv: str,
    recovered_shipment_csv: str,
) -> dict[str, object]:
    status = current_partner_ai_status()
    providers = status["providers"]
    assert isinstance(providers, dict)
    configured = any(
        isinstance(provider, dict) and provider.get("configured") is True
        for provider in providers.values()
    )
    if not configured:
        return run_partner_ai(
            complaint_text=complaint_text,
            shipment_csv=shipment_csv,
            recovered_shipment_csv=recovered_shipment_csv,
        )

    permit = None
    try:
        permit = acquire_spend_permit()
        partner_ai = run_partner_ai(
            complaint_text=complaint_text,
            shipment_csv=shipment_csv,
            recovered_shipment_csv=recovered_shipment_csv,
        )
        permit.record(
            {
                "mode": partner_ai["mode"],
                "used_count": partner_ai["used_count"],
            }
        )
        return partner_ai
    except SpendLimitError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    finally:
        if permit is not None:
            permit.release()
