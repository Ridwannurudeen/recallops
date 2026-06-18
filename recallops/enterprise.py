from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import urllib.error
import urllib.request
from dataclasses import asdict
from typing import Any, Literal

from recallops.notifications import DispatchReceipt
from recallops.source_evidence import SourceEvidencePacket


TargetId = Literal["sap", "oracle"]

ENTERPRISE_WRITE_ENV = "RECALLOPS_ENABLE_ENTERPRISE_WRITES"
ADMIN_KEY_ENV = "RECALLOPS_ADMIN_ACTION_KEY"

ADAPTERS: tuple[dict[str, str], ...] = (
    {
        "id": "sap",
        "label": "SAP ERP / S4HANA",
        "url_env": "RECALLOPS_SAP_BASE_URL",
        "key_env": "RECALLOPS_SAP_API_KEY",
        "username_env": "RECALLOPS_SAP_USERNAME",
        "password_env": "RECALLOPS_SAP_PASSWORD",
        "auth_mode_env": "RECALLOPS_SAP_AUTH_MODE",
        "default_auth_mode": "api_key",
        "api_key_header_env": "RECALLOPS_SAP_API_KEY_HEADER",
        "default_api_key_header": "apikey",
        "write_url_env": "RECALLOPS_SAP_RECALL_URL",
        "write_path_env": "RECALLOPS_SAP_RECALL_PATH",
        "role": "lot master, shipment, and warehouse hold records",
        "operation": "sap_odata_post_with_optional_csrf",
    },
    {
        "id": "oracle",
        "label": "Oracle SCM",
        "url_env": "RECALLOPS_ORACLE_SCM_URL",
        "key_env": "RECALLOPS_ORACLE_SCM_TOKEN",
        "username_env": "RECALLOPS_ORACLE_SCM_USERNAME",
        "password_env": "RECALLOPS_ORACLE_SCM_PASSWORD",
        "auth_mode_env": "RECALLOPS_ORACLE_SCM_AUTH_MODE",
        "default_auth_mode": "bearer",
        "api_key_header_env": "RECALLOPS_ORACLE_SCM_API_KEY_HEADER",
        "default_api_key_header": "authorization",
        "write_url_env": "RECALLOPS_ORACLE_SCM_RECALL_URL",
        "write_path_env": "RECALLOPS_ORACLE_SCM_RECALL_PATH",
        "role": "inventory movement and distributor records",
        "operation": "oracle_scm_rest_post",
    },
    {
        "id": "salesforce",
        "label": "Salesforce Service Cloud",
        "url_env": "RECALLOPS_SALESFORCE_URL",
        "key_env": "RECALLOPS_SALESFORCE_TOKEN",
        "role": "customer case and notification list sync",
    },
    {
        "id": "zendesk",
        "label": "Zendesk",
        "url_env": "RECALLOPS_ZENDESK_URL",
        "key_env": "RECALLOPS_ZENDESK_TOKEN",
        "role": "complaint intake and support-ticket ingestion",
    },
    {
        "id": "regulator",
        "label": "Regulator filing endpoint",
        "url_env": "RECALLOPS_REGULATOR_URL",
        "key_env": "RECALLOPS_REGULATOR_TOKEN",
        "role": "external recall notice filing",
    },
)


def integration_status() -> dict[str, object]:
    adapters = [_adapter_status(adapter) for adapter in ADAPTERS]
    return {
        "mode": "credential_gated_adapter_registry",
        "disclosure": (
            "Adapters report configuration and execution readiness only. RecallOps does not "
            "send external writes unless live writes are enabled, an admin action key is "
            "accepted, and the target tenant endpoint is configured."
        ),
        "configured_count": sum(1 for adapter in adapters if adapter["configured"] is True),
        "execution_ready_count": sum(
            1 for adapter in adapters if adapter.get("execution_ready") is True
        ),
        "adapters": adapters,
        "enterprise_sync": enterprise_sync_status(),
    }


def ops_readiness() -> dict[str, object]:
    integrations = integration_status()
    blockers = [
        "add enterprise SSO and per-user approval identity",
        "complete legal review of jurisdiction-specific recall rules",
    ]
    if integrations["execution_ready_count"] != 2:
        blockers.insert(0, "configure real SAP and Oracle tenant endpoints for live ERP writes")
    if not _enterprise_writes_enabled():
        blockers.insert(0, "enable live SAP/Oracle writes only for an approved tenant demo")

    return {
        "persistence": {
            "mode": "sqlite_case_store",
            "path_env": "RECALLOPS_CASE_DB",
            "configured_path": os.getenv("RECALLOPS_CASE_DB", "recallops-cases.sqlite3"),
        },
        "access_control": {
            "mode": "public_demo_with_rate_limited_spend_actions",
            "disclosure": "Live partner-AI and Band actions are rate-limited for demo safety.",
        },
        "integrations": integrations,
        "production_blockers_remaining": blockers,
    }


def enterprise_sync_status() -> dict[str, object]:
    targets = [_sync_target_status(_adapter_for(target)) for target in ("sap", "oracle")]
    return {
        "mode": "sap_oracle_http_execution_layer",
        "disclosure": (
            "Dry-run mode builds the same payload sent to SAP/Oracle without external writes. "
            "Live mode requires configured tenant endpoints plus server-side write authorization."
        ),
        "live_writes_enabled": _enterprise_writes_enabled(),
        "admin_key_configured": bool(os.getenv(ADMIN_KEY_ENV)),
        "execution_ready_count": sum(1 for target in targets if target["execution_ready"] is True),
        "targets": targets,
    }


def build_enterprise_payload(
    *,
    source_packet: SourceEvidencePacket,
    rule_assessment: dict[str, object],
    dispatch_receipts: tuple[DispatchReceipt, ...],
) -> dict[str, object]:
    facts = {fact.key: fact.value for fact in source_packet.facts}
    return {
        "schema": "recallops.enterprise_recall.v1",
        "incidentId": source_packet.incident_id,
        "sourceAuditHash": source_packet.audit_hash,
        "product": facts["product"],
        "lotNumber": facts["lot"],
        "defect": facts["defect"],
        "severity": facts["severity"],
        "complaintCount": facts["complaints"],
        "traceability": {
            "initial": asdict(source_packet.initial_traceability),
            "final": asdict(source_packet.final_traceability),
            "missingSources": list(source_packet.missing_sources),
        },
        "shipments": [asdict(shipment) for shipment in source_packet.final_shipments],
        "rules": {
            "mode": rule_assessment["mode"],
            "approvalReady": rule_assessment["approval_ready"],
            "severity": rule_assessment["severity"],
            "nextDeadline": rule_assessment["next_deadline"],
            "initialBlockers": rule_assessment["initial_blockers"],
            "finalBlockers": rule_assessment["final_blockers"],
            "appliedRuleIds": [
                rule["id"]
                for rule in rule_assessment["applied_rules"]
                if isinstance(rule, dict) and "id" in rule
            ],
        },
        "dispatchReceipts": [receipt.to_dict() for receipt in dispatch_receipts],
    }


def run_enterprise_sync(
    *,
    source_packet: SourceEvidencePacket,
    rule_assessment: dict[str, object],
    dispatch_receipts: tuple[DispatchReceipt, ...],
    dry_run: bool = True,
    targets: tuple[TargetId, ...] = ("sap", "oracle"),
) -> dict[str, object]:
    if not targets:
        raise EnterpriseSyncError(400, "At least one enterprise sync target is required.")

    payload = build_enterprise_payload(
        source_packet=source_packet,
        rule_assessment=rule_assessment,
        dispatch_receipts=dispatch_receipts,
    )
    payload_hash = _payload_hash(payload)
    target_results = [
        _dry_run_target(_adapter_for(target), payload_hash)
        if dry_run
        else _post_target(_adapter_for(target), payload, payload_hash)
        for target in targets
    ]
    return {
        "mode": "dry_run_no_external_write" if dry_run else "live_external_write",
        "external_write": not dry_run,
        "payload_hash": payload_hash,
        "payload": payload,
        "targets": target_results,
    }


def require_enterprise_write_authorization(provided_key: str | None) -> None:
    if not _enterprise_writes_enabled():
        raise EnterpriseSyncError(403, "Live enterprise writes are disabled on this deployment.")
    expected_key = os.getenv(ADMIN_KEY_ENV)
    if not expected_key or not provided_key:
        raise EnterpriseSyncError(403, "Live enterprise writes require an admin action key.")
    if not hmac.compare_digest(provided_key, expected_key):
        raise EnterpriseSyncError(403, "Live enterprise writes require an admin action key.")


def _adapter_status(adapter: dict[str, str]) -> dict[str, object]:
    has_url = bool(os.getenv(adapter["url_env"]))
    has_key = _credential_configured(adapter)
    target_url = _write_url(adapter)
    execution_ready = adapter["id"] in {"sap", "oracle"} and has_key and bool(target_url)
    status = (
        "execution_ready"
        if execution_ready
        else "ready"
        if has_url and has_key
        else "not_configured"
    )
    result: dict[str, object] = {
        "id": adapter["id"],
        "label": adapter["label"],
        "role": adapter["role"],
        "configured": has_url and has_key,
        "url_configured": has_url,
        "credential_configured": has_key,
        "status": status,
    }
    if adapter["id"] in {"sap", "oracle"}:
        result.update(
            {
                "target_configured": bool(target_url),
                "execution_ready": execution_ready,
                "operation": adapter["operation"],
            }
        )
    return result


def _sync_target_status(adapter: dict[str, str]) -> dict[str, object]:
    status = _adapter_status(adapter)
    return {
        "id": status["id"],
        "label": status["label"],
        "operation": status["operation"],
        "configured": status["configured"],
        "target_configured": status["target_configured"],
        "execution_ready": status["execution_ready"],
        "live_write_enabled": _enterprise_writes_enabled(),
        "admin_key_configured": bool(os.getenv(ADMIN_KEY_ENV)),
        "status": status["status"],
    }


def _dry_run_target(adapter: dict[str, str], payload_hash: str) -> dict[str, object]:
    status = _sync_target_status(adapter)
    return {
        **status,
        "mode": "dry_run",
        "external_write": False,
        "status": "prepared",
        "payload_hash": payload_hash,
        "action_required": _action_required(status),
    }


def _post_target(
    adapter: dict[str, str],
    payload: dict[str, object],
    payload_hash: str,
) -> dict[str, object]:
    status = _sync_target_status(adapter)
    if status["execution_ready"] is not True:
        return {
            **status,
            "mode": "live",
            "external_write": False,
            "status": "blocked",
            "payload_hash": payload_hash,
            "action_required": _action_required(status),
        }

    body = _sap_payload(payload) if adapter["id"] == "sap" else _oracle_payload(payload)
    headers = _auth_headers(adapter)
    headers.update(
        {
            "accept": "application/json",
            "content-type": "application/json",
            "user-agent": "RecallOps/0.1 (+https://recallops.gudman.xyz)",
        }
    )
    if adapter["id"] == "sap":
        headers.update(_sap_csrf_headers(adapter, headers))

    response = _post_json(
        url=_write_url(adapter),
        headers=headers,
        payload=body,
    )
    return {
        **status,
        "mode": "live",
        "external_write": response["ok"],
        "status": "sent" if response["ok"] else "error",
        "payload_hash": payload_hash,
        "http_status": response["http_status"],
        "response_hash": response["response_hash"],
        "response_excerpt": response["response_excerpt"],
    }


def _sap_payload(payload: dict[str, object]) -> dict[str, object]:
    traceability = payload["traceability"]
    assert isinstance(traceability, dict)
    final_traceability = traceability["final"]
    assert isinstance(final_traceability, dict)
    return {
        "IncidentID": payload["incidentId"],
        "SourceAuditHash": payload["sourceAuditHash"],
        "Product": payload["product"],
        "LotNumber": payload["lotNumber"],
        "Defect": payload["defect"],
        "Severity": payload["severity"],
        "FinalCoveragePercent": final_traceability["coverage_percent"],
        "UntracedUnits": final_traceability["untraced_units"],
        "RecallAction": "HOLD_AND_NOTIFY",
        "Payload": json.dumps(payload, sort_keys=True),
    }


def _oracle_payload(payload: dict[str, object]) -> dict[str, object]:
    traceability = payload["traceability"]
    assert isinstance(traceability, dict)
    final_traceability = traceability["final"]
    assert isinstance(final_traceability, dict)
    return {
        "incidentId": payload["incidentId"],
        "sourceAuditHash": payload["sourceAuditHash"],
        "product": payload["product"],
        "lotNumber": payload["lotNumber"],
        "defect": payload["defect"],
        "severity": payload["severity"],
        "finalCoveragePercent": final_traceability["coverage_percent"],
        "untracedUnits": final_traceability["untraced_units"],
        "recallAction": "HOLD_AND_NOTIFY",
        "payload": payload,
    }


def _post_json(
    *,
    url: str,
    headers: dict[str, str],
    payload: dict[str, object],
) -> dict[str, object]:
    request = urllib.request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
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


def _sap_csrf_headers(adapter: dict[str, str], headers: dict[str, str]) -> dict[str, str]:
    if not _truthy_env("RECALLOPS_SAP_CSRF_ENABLED", default=True):
        return {}
    request = urllib.request.Request(
        url=_write_url(adapter),
        headers={**headers, "x-csrf-token": "Fetch"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            token = response.headers.get("x-csrf-token")
            cookies = response.headers.get_all("Set-Cookie", [])
    except (urllib.error.HTTPError, OSError) as exc:
        raise EnterpriseSyncError(
            502, f"SAP CSRF token fetch failed: {_truncate(str(exc))}"
        ) from exc
    if not token:
        raise EnterpriseSyncError(
            502,
            "SAP CSRF token fetch did not return an x-csrf-token header.",
        )
    csrf_headers = {"x-csrf-token": token}
    if cookies:
        csrf_headers["cookie"] = "; ".join(cookie.split(";", 1)[0] for cookie in cookies)
    return csrf_headers


def _auth_headers(adapter: dict[str, str]) -> dict[str, str]:
    auth_mode = os.getenv(adapter["auth_mode_env"], adapter["default_auth_mode"]).lower()
    if auth_mode == "basic":
        username = os.getenv(adapter["username_env"], "")
        password = os.getenv(adapter["password_env"], "")
        token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
        return {"authorization": f"Basic {token}"}

    api_key = os.getenv(adapter["key_env"], "")
    if auth_mode == "api_key":
        header_name = os.getenv(
            adapter["api_key_header_env"],
            adapter["default_api_key_header"],
        )
        return {header_name: api_key}
    return {"authorization": f"Bearer {api_key}"}


def _credential_configured(adapter: dict[str, str]) -> bool:
    auth_mode_env = adapter.get("auth_mode_env")
    auth_mode = (
        os.getenv(auth_mode_env, adapter.get("default_auth_mode", "bearer"))
        if auth_mode_env
        else adapter.get("default_auth_mode", "bearer")
    ).lower()
    if auth_mode == "basic":
        username_env = adapter.get("username_env")
        password_env = adapter.get("password_env")
        return bool(
            username_env and password_env and os.getenv(username_env) and os.getenv(password_env)
        )
    if os.getenv(adapter["key_env"]):
        return True
    username_env = adapter.get("username_env")
    password_env = adapter.get("password_env")
    return bool(
        username_env and password_env and os.getenv(username_env) and os.getenv(password_env)
    )


def _write_url(adapter: dict[str, str]) -> str:
    write_url_env = adapter.get("write_url_env")
    if write_url_env and os.getenv(write_url_env):
        return str(os.getenv(write_url_env))
    write_path_env = adapter.get("write_path_env")
    base_url = os.getenv(adapter["url_env"])
    path = os.getenv(write_path_env) if write_path_env else None
    if not base_url or not path:
        return ""
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def _adapter_for(target: str) -> dict[str, str]:
    for adapter in ADAPTERS:
        if adapter["id"] == target:
            return adapter
    raise EnterpriseSyncError(400, f"Unsupported enterprise target {target}.")


def _enterprise_writes_enabled() -> bool:
    return _truthy_env(ENTERPRISE_WRITE_ENV, default=False)


def _truthy_env(name: str, *, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _action_required(status: dict[str, object]) -> str | None:
    if status["execution_ready"] is True:
        if status["live_write_enabled"] is True and status["admin_key_configured"] is True:
            return None
        return "enable live writes and configure the admin action key for live mode"
    if status["configured"] is not True:
        return "configure tenant URL and credentials"
    return "configure the SAP/Oracle recall write endpoint"


def _payload_hash(payload: dict[str, object]) -> str:
    return _text_hash(json.dumps(payload, sort_keys=True, separators=(",", ":")))


def _text_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _truncate(value: Any, limit: int = 500) -> str:
    clean = " ".join(str(value).split())
    return clean if len(clean) <= limit else f"{clean[:limit]}..."


class EnterpriseSyncError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)
