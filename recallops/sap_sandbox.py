from __future__ import annotations

import gzip
import hashlib
import json
import os
import urllib.error
import urllib.parse
import urllib.request


SAP_API_HUB_KEY_ENV = "RECALLOPS_SAP_API_HUB_KEY"
SAP_API_HUB_URL_ENV = "RECALLOPS_SAP_API_HUB_BUSINESS_PARTNER_URL"
DEFAULT_BUSINESS_PARTNER_URL = (
    "https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/"
    "API_BUSINESS_PARTNER/A_BusinessPartner?$top=1&$format=json"
)


def sap_api_hub_status() -> dict[str, object]:
    return {
        "mode": "sap_business_accelerator_hub_sandbox",
        "disclosure": (
            "This is a live SAP API Hub sandbox read proof, not a customer "
            "S/4HANA tenant write. It verifies the supplied SAP API Hub key can "
            "reach SAP's S/4HANA Cloud sandbox API."
        ),
        "configured": bool(os.getenv(SAP_API_HUB_KEY_ENV)),
        "endpoint": _redacted_endpoint(),
    }


def run_sap_api_hub_probe() -> dict[str, object]:
    api_key = os.getenv(SAP_API_HUB_KEY_ENV)
    if not api_key:
        return {
            **sap_api_hub_status(),
            "used": False,
            "status": "missing_key",
            "verified": False,
        }

    endpoint = _endpoint()
    try:
        body = _fetch_business_partner_sample(endpoint=endpoint, api_key=api_key)
    except SapApiHubError as exc:
        return {
            **sap_api_hub_status(),
            "used": True,
            "status": "error",
            "verified": False,
            "error": str(exc).replace(api_key, "[redacted]"),
        }

    result_count = _result_count(body)
    return {
        **sap_api_hub_status(),
        "used": True,
        "status": "verified",
        "verified": True,
        "http_status": 200,
        "response_hash": _payload_hash(body),
        "result_count": result_count,
    }


def _fetch_business_partner_sample(*, endpoint: str, api_key: str) -> dict[str, object]:
    request = urllib.request.Request(
        url=endpoint,
        headers={
            "APIKey": api_key,
            "accept": "application/json",
            "accept-encoding": "gzip, identity",
            "user-agent": "RecallOps/0.1 (+https://recallops.gudman.xyz)",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw_bytes = response.read()
            if response.headers.get("content-encoding", "").lower() == "gzip":
                raw_bytes = gzip.decompress(raw_bytes)
            raw_body = raw_bytes.decode("utf-8")
            body = json.loads(raw_body)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise SapApiHubError(f"HTTP {exc.code}: {_truncate(detail)}") from exc
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise SapApiHubError(_truncate(str(exc))) from exc
    if not isinstance(body, dict):
        raise SapApiHubError("SAP API Hub response was not a JSON object.")
    return body


def _result_count(body: dict[str, object]) -> int:
    d = body.get("d")
    if not isinstance(d, dict):
        return 0
    results = d.get("results")
    if not isinstance(results, list):
        return 0
    return len(results)


def _payload_hash(payload: dict[str, object]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _endpoint() -> str:
    return os.getenv(SAP_API_HUB_URL_ENV, DEFAULT_BUSINESS_PARTNER_URL)


def _redacted_endpoint() -> str:
    parsed = urllib.parse.urlsplit(_endpoint())
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


def _truncate(value: str, limit: int = 500) -> str:
    clean = " ".join(value.split())
    return clean if len(clean) <= limit else f"{clean[:limit]}..."


class SapApiHubError(RuntimeError):
    """Raised when the SAP API Hub probe cannot return a verified sample."""
