from __future__ import annotations

import hashlib
import hmac
import json
import os
import urllib.error
import urllib.request
from typing import Any, Literal


RegulatorTarget = Literal["cpsc", "eu", "regional"]

REGULATOR_WRITE_ENV = "RECALLOPS_ENABLE_REGULATOR_WRITES"
REGULATOR_URL_ENV = "RECALLOPS_REGULATOR_URL"
REGULATOR_TOKEN_ENV = "RECALLOPS_REGULATOR_TOKEN"
ADMIN_KEY_ENV = "RECALLOPS_ADMIN_ACTION_KEY"

TARGETS: dict[RegulatorTarget, dict[str, str]] = {
    "cpsc": {
        "label": "CPSC 15(b)-style notice desk",
        "filing_id": "cpsc-15b-draft",
        "operation": "draft_packet_post",
    },
    "eu": {
        "label": "EU Safety Gate-style notice desk",
        "filing_id": "eu-safety-gate-draft",
        "operation": "draft_packet_post",
    },
    "regional": {
        "label": "Regional distributor hold desk",
        "filing_id": "regional-distributor-hold",
        "operation": "draft_packet_post",
    },
}


def regulator_filing_status() -> dict[str, object]:
    return {
        "mode": "draft_dispatch_with_admin_gated_external_post",
        "disclosure": (
            "Regulator filing is draft-first. Dry-run builds regulator-ready payloads. "
            "External posting requires an enabled deployment, configured endpoint/token, "
            "and server-side admin authorization."
        ),
        "live_writes_enabled": _regulator_writes_enabled(),
        "endpoint_configured": bool(os.getenv(REGULATOR_URL_ENV)),
        "token_configured": bool(os.getenv(REGULATOR_TOKEN_ENV)),
        "admin_key_configured": bool(os.getenv(ADMIN_KEY_ENV)),
        "targets": [
            {
                "id": target_id,
                **target,
                "execution_ready": _execution_ready(),
                "status": "execution_ready" if _execution_ready() else "dry_run_only",
            }
            for target_id, target in TARGETS.items()
        ],
    }


def require_regulator_authorization(provided_key: str | None) -> None:
    if not _regulator_writes_enabled():
        raise RegulatoryFilingError(403, "Live regulator filing is disabled on this deployment.")
    expected_key = os.getenv(ADMIN_KEY_ENV)
    if not expected_key or not provided_key:
        raise RegulatoryFilingError(403, "Live regulator filing requires an admin action key.")
    if not hmac.compare_digest(provided_key, expected_key):
        raise RegulatoryFilingError(403, "Live regulator filing requires an admin action key.")


def run_regulator_filing(
    *,
    filing_pack: dict[str, object],
    dry_run: bool,
    targets: tuple[RegulatorTarget, ...],
) -> dict[str, object]:
    if not targets:
        raise RegulatoryFilingError(400, "At least one regulator filing target is required.")
    payload = _base_payload(filing_pack)
    payload_hash = _hash_payload(payload)
    return {
        "mode": "dry_run_no_external_submit" if dry_run else "live_external_submit",
        "external_submit": not dry_run,
        "payload_hash": payload_hash,
        "payload": payload,
        "targets": [
            _dry_run_target(target, filing_pack, payload_hash)
            if dry_run
            else _post_target(target, filing_pack, payload_hash)
            for target in targets
        ],
        "status": regulator_filing_status(),
    }


def _base_payload(filing_pack: dict[str, object]) -> dict[str, object]:
    return {
        "schema": "recallops.regulator_filing.v1",
        "proofKind": filing_pack["proof_kind"],
        "mode": filing_pack["mode"],
        "incidentId": filing_pack["incident_id"],
        "sourceAuditHash": filing_pack["source_audit_hash"],
        "packHash": filing_pack["pack_hash"],
        "approvalReady": filing_pack["approval_ready"],
        "sourceSummary": filing_pack["source_summary"],
    }


def _dry_run_target(
    target: RegulatorTarget,
    filing_pack: dict[str, object],
    payload_hash: str,
) -> dict[str, object]:
    filing = _filing_for(target, filing_pack)
    return {
        "id": target,
        **TARGETS[target],
        "mode": "dry_run",
        "external_submit": False,
        "status": "prepared" if filing is not None else "missing_filing",
        "payload_hash": payload_hash,
        "filing": filing,
        "action_required": (
            None
            if filing is not None
            else f"filing pack did not include {TARGETS[target]['filing_id']}"
        ),
    }


def _post_target(
    target: RegulatorTarget,
    filing_pack: dict[str, object],
    payload_hash: str,
) -> dict[str, object]:
    dry_run_result = _dry_run_target(target, filing_pack, payload_hash)
    if dry_run_result["status"] != "prepared":
        return {
            **dry_run_result,
            "mode": "live",
            "external_submit": False,
            "status": "blocked",
        }
    if not _execution_ready():
        return {
            **dry_run_result,
            "mode": "live",
            "external_submit": False,
            "status": "blocked",
            "action_required": "configure regulator endpoint/token and enable live regulator filing",
        }

    body = {
        **_base_payload(filing_pack),
        "target": target,
        "filing": dry_run_result["filing"],
    }
    response = _post_json(body)
    return {
        **dry_run_result,
        "mode": "live",
        "external_submit": response["ok"],
        "status": "sent" if response["ok"] else "error",
        "http_status": response["http_status"],
        "response_hash": response["response_hash"],
        "response_excerpt": response["response_excerpt"],
    }


def _filing_for(
    target: RegulatorTarget, filing_pack: dict[str, object]
) -> dict[str, object] | None:
    filings = filing_pack.get("filings", [])
    if not isinstance(filings, list):
        return None
    filing_id = TARGETS[target]["filing_id"]
    return next(
        (
            filing
            for filing in filings
            if isinstance(filing, dict) and filing.get("id") == filing_id
        ),
        None,
    )


def _post_json(payload: dict[str, object]) -> dict[str, object]:
    url = str(os.getenv(REGULATOR_URL_ENV))
    token = str(os.getenv(REGULATOR_TOKEN_ENV))
    request = urllib.request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "accept": "application/json",
            "authorization": f"Bearer {token}",
            "content-type": "application/json",
            "user-agent": "RecallOps/0.1 (+https://recallops.gudman.xyz)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8", errors="replace")
            status = response.status
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        status = exc.code
    except OSError as exc:
        return {
            "ok": False,
            "http_status": 0,
            "response_hash": _text_hash(str(exc)),
            "response_excerpt": _truncate(str(exc)),
        }
    return {
        "ok": 200 <= status < 300,
        "http_status": status,
        "response_hash": _text_hash(body),
        "response_excerpt": _truncate(body),
    }


def _execution_ready() -> bool:
    return bool(
        _regulator_writes_enabled()
        and os.getenv(REGULATOR_URL_ENV)
        and os.getenv(REGULATOR_TOKEN_ENV)
    )


def _regulator_writes_enabled() -> bool:
    value = os.getenv(REGULATOR_WRITE_ENV, "")
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _hash_payload(payload: dict[str, object]) -> str:
    return _text_hash(json.dumps(payload, sort_keys=True, separators=(",", ":")))


def _text_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _truncate(value: Any, limit: int = 500) -> str:
    clean = " ".join(str(value).split())
    return clean if len(clean) <= limit else f"{clean[:limit]}..."


class RegulatoryFilingError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)
