from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Literal


ApprovalDecision = Literal["approved", "rejected"]


@dataclass(frozen=True)
class ApprovalReceipt:
    approval_id: str
    approved_at: str
    approver: str
    decision: ApprovalDecision
    reason: str
    source_audit_hash: str
    previous_hash: str
    receipt_hash: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def build_approval_receipt(
    *,
    approver: str,
    decision: ApprovalDecision,
    reason: str,
    source_audit_hash: str,
    previous_hash: str = "0" * 64,
) -> ApprovalReceipt:
    clean_approver = approver.strip()
    clean_reason = reason.strip()
    if not clean_approver:
        raise ValueError("Approver is required.")
    if not clean_reason:
        raise ValueError("Approval reason is required.")
    if decision not in {"approved", "rejected"}:
        raise ValueError("Decision must be approved or rejected.")
    if not _is_sha256(source_audit_hash):
        raise ValueError("Source audit hash must be a SHA-256 digest.")
    if not _is_sha256(previous_hash):
        raise ValueError("Previous hash must be a SHA-256 digest.")

    approved_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    fields: dict[str, object] = {
        "approval_id": f"approval-{source_audit_hash[:12]}",
        "approved_at": approved_at,
        "approver": clean_approver,
        "decision": decision,
        "reason": clean_reason,
        "source_audit_hash": source_audit_hash,
        "previous_hash": previous_hash,
    }
    return ApprovalReceipt(receipt_hash=_audit_hash(fields), **fields)


def verify_approval_receipt(receipt: ApprovalReceipt) -> dict[str, str | bool]:
    payload = receipt.to_dict()
    expected_hash = str(payload.pop("receipt_hash"))
    actual_hash = _audit_hash(payload)
    return {
        "ok": actual_hash == expected_hash,
        "algorithm": "sha256",
        "expected_hash": expected_hash,
        "actual_hash": actual_hash,
    }


def _audit_hash(payload: dict[str, object]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _is_sha256(value: str) -> bool:
    return len(value) == 64 and all(character in "0123456789abcdef" for character in value)
