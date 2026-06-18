from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal


ContractTarget = Literal["sap", "oracle"]
CONTRACT_TOKEN_ENV = "RECALLOPS_ERP_CONTRACT_TOKEN"
CONTRACT_LOG_ENV = "RECALLOPS_ERP_CONTRACT_LOG"


def contract_status() -> dict[str, object]:
    receipts = contract_receipts(limit=50)
    return {
        "mode": "tenant_shaped_contract_receiver",
        "disclosure": (
            "The contract receiver accepts the same live SAP/Oracle adapter writes over HTTP "
            "and stores redacted receipts. It is not a substitute for a customer ERP tenant."
        ),
        "token_configured": bool(os.getenv(CONTRACT_TOKEN_ENV)),
        "log_path_env": CONTRACT_LOG_ENV,
        "receipt_count": len(receipts),
        "latest_pair_verified": _latest_pair_verified(receipts),
        "latest_receipts": receipts[:4],
    }


def require_contract_authorization(
    *,
    authorization: str | None,
    apikey: str | None,
    contract_token: str | None,
) -> None:
    expected = os.getenv(CONTRACT_TOKEN_ENV)
    if not expected:
        raise ContractReceiverError(403, "ERP contract receiver token is not configured.")
    candidates = [contract_token or "", apikey or "", _bearer_token(authorization) or ""]
    if not any(hmac.compare_digest(candidate, expected) for candidate in candidates):
        raise ContractReceiverError(403, "ERP contract receiver requires its configured token.")


def record_contract_write(
    *,
    target: ContractTarget,
    payload: dict[str, object],
) -> dict[str, object]:
    extracted = _extract_payload(target, payload)
    payload_hash = _payload_hash(payload)
    receipt = {
        "target": target,
        "received_at": _now(),
        "incident_id": extracted["incident_id"],
        "lot_number": extracted["lot_number"],
        "source_audit_hash": extracted["source_audit_hash"],
        "payload_hash": payload_hash,
        "schema": extracted["schema"],
        "action": extracted["action"],
    }
    receipt["receipt_hash"] = _payload_hash(receipt)
    _append_receipt(receipt)
    return {
        "accepted": True,
        "receipt": receipt,
    }


def contract_receipts(*, limit: int = 20) -> list[dict[str, object]]:
    path = _contract_log_path()
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            parsed = json.loads(line)
            if isinstance(parsed, dict):
                rows.append(parsed)
    return list(reversed(rows))[:limit]


def _extract_payload(target: ContractTarget, payload: dict[str, object]) -> dict[str, str]:
    if target == "sap":
        incident_id = str(payload.get("IncidentID", "")).strip()
        lot_number = str(payload.get("LotNumber", "")).strip()
        source_audit_hash = str(payload.get("SourceAuditHash", "")).strip()
        action = str(payload.get("RecallAction", "")).strip()
        schema = "sap_odata_recall_hold"
    elif target == "oracle":
        incident_id = str(payload.get("incidentId", "")).strip()
        lot_number = str(payload.get("lotNumber", "")).strip()
        source_audit_hash = str(payload.get("sourceAuditHash", "")).strip()
        action = str(payload.get("recallAction", "")).strip()
        schema = "oracle_scm_recall_hold"
    else:
        raise ContractReceiverError(400, f"Unsupported ERP contract target {target}.")

    if not incident_id or not lot_number or not action:
        raise ContractReceiverError(400, "ERP contract payload is missing required fields.")
    if not _is_sha256(source_audit_hash):
        raise ContractReceiverError(400, "ERP contract payload source hash must be SHA-256.")
    return {
        "incident_id": incident_id,
        "lot_number": lot_number,
        "source_audit_hash": source_audit_hash,
        "schema": schema,
        "action": action,
    }


def _append_receipt(receipt: dict[str, object]) -> None:
    path = _contract_log_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(receipt, sort_keys=True))
        handle.write("\n")


def _latest_pair_verified(receipts: list[dict[str, object]]) -> bool:
    by_hash: dict[str, set[str]] = {}
    for receipt in receipts:
        source_hash = str(receipt.get("source_audit_hash", ""))
        target = str(receipt.get("target", ""))
        by_hash.setdefault(source_hash, set()).add(target)
    return any({"sap", "oracle"}.issubset(targets) for targets in by_hash.values())


def _contract_log_path() -> Path:
    return Path(os.getenv(CONTRACT_LOG_ENV, "erp-contract-receipts.jsonl"))


def _bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def _payload_hash(payload: dict[str, object]) -> str:
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def _is_sha256(value: str) -> bool:
    return len(value) == 64 and all(character in "0123456789abcdef" for character in value)


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class ContractReceiverError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)
