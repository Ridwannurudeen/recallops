from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Literal


ESignDecision = Literal["approved", "rejected"]


@dataclass(frozen=True)
class ESignatureReceipt:
    signature_id: str
    signed_at: str
    approver: str
    decision: ESignDecision
    meaning: str
    reason: str
    source_audit_hash: str
    recall_room_run_hash: str
    filing_pack_hash: str
    previous_hash: str
    identity: dict[str, object]
    controls: dict[str, object]
    record_hash: str
    signature_hash: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def build_esignature_receipt(
    *,
    approver: str,
    decision: ESignDecision,
    reason: str,
    source_audit_hash: str,
    recall_room_run_hash: str,
    filing_pack_hash: str,
    previous_hash: str,
    identity: dict[str, object],
) -> ESignatureReceipt:
    clean_approver = approver.strip()
    clean_reason = reason.strip()
    if not clean_approver:
        raise ValueError("Approver is required.")
    if not clean_reason:
        raise ValueError("Signature reason is required.")
    if decision not in {"approved", "rejected"}:
        raise ValueError("Decision must be approved or rejected.")
    for label, digest in (
        ("Source audit hash", source_audit_hash),
        ("Recall room run hash", recall_room_run_hash),
        ("Filing pack hash", filing_pack_hash),
        ("Previous hash", previous_hash),
    ):
        if not _is_sha256(digest):
            raise ValueError(f"{label} must be a SHA-256 digest.")

    signed_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    meaning = (
        "I approve this recall action and filing pack for the stated scope."
        if decision == "approved"
        else "I reject this recall action and filing pack for the stated scope."
    )
    record_fields: dict[str, object] = {
        "approver": clean_approver,
        "decision": decision,
        "meaning": meaning,
        "reason": clean_reason,
        "source_audit_hash": source_audit_hash,
        "recall_room_run_hash": recall_room_run_hash,
        "filing_pack_hash": filing_pack_hash,
        "previous_hash": previous_hash,
        "identity": identity,
    }
    record_hash = _audit_hash(record_fields)
    fields: dict[str, object] = {
        "signature_id": f"esign-{record_hash[:12]}",
        "signed_at": signed_at,
        **record_fields,
        "controls": {
            "mode": "server_verified_attributable_electronic_signature",
            "disclosure": (
                "This is an attributable RecallOps e-signature receipt. It is designed "
                "for Part 11-style auditability, but tenant validation, policies, and "
                "legal acceptance remain deployment responsibilities."
            ),
            "requires_verified_identity": True,
            "requires_record_hash": True,
            "requires_signature_meaning": True,
            "requires_tamper_evident_hash": True,
        },
        "record_hash": record_hash,
    }
    return ESignatureReceipt(signature_hash=_audit_hash(fields), **fields)


def verify_esignature_receipt(receipt: ESignatureReceipt) -> dict[str, str | bool]:
    payload = receipt.to_dict()
    expected_hash = str(payload.pop("signature_hash"))
    actual_hash = _audit_hash(payload)
    record_payload = {
        "approver": receipt.approver,
        "decision": receipt.decision,
        "meaning": receipt.meaning,
        "reason": receipt.reason,
        "source_audit_hash": receipt.source_audit_hash,
        "recall_room_run_hash": receipt.recall_room_run_hash,
        "filing_pack_hash": receipt.filing_pack_hash,
        "previous_hash": receipt.previous_hash,
        "identity": receipt.identity,
    }
    return {
        "ok": actual_hash == expected_hash and _audit_hash(record_payload) == receipt.record_hash,
        "algorithm": "sha256",
        "expected_hash": expected_hash,
        "actual_hash": actual_hash,
        "record_hash": receipt.record_hash,
    }


def _audit_hash(payload: dict[str, object]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _is_sha256(value: str) -> bool:
    return len(value) == 64 and all(character in "0123456789abcdef" for character in value)
