from __future__ import annotations

import os


ADAPTERS: tuple[dict[str, str], ...] = (
    {
        "id": "sap",
        "label": "SAP ERP / S4HANA",
        "url_env": "RECALLOPS_SAP_BASE_URL",
        "key_env": "RECALLOPS_SAP_API_KEY",
        "role": "lot master, shipment, and warehouse hold records",
    },
    {
        "id": "oracle",
        "label": "Oracle SCM",
        "url_env": "RECALLOPS_ORACLE_SCM_URL",
        "key_env": "RECALLOPS_ORACLE_SCM_TOKEN",
        "role": "inventory movement and distributor records",
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
        "mode": "adapter_registry",
        "disclosure": (
            "Adapters report configuration readiness only. RecallOps does not send external "
            "writes unless a target URL and credential are configured."
        ),
        "configured_count": sum(1 for adapter in adapters if adapter["configured"] is True),
        "adapters": adapters,
    }


def ops_readiness() -> dict[str, object]:
    integrations = integration_status()
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
        "production_blockers_remaining": [
            "configure real ERP/CRM/regulator adapters for external reads and writes",
            "add enterprise SSO and per-user approval identity",
            "complete legal review of jurisdiction-specific recall rules",
        ],
    }


def _adapter_status(adapter: dict[str, str]) -> dict[str, object]:
    has_url = bool(os.getenv(adapter["url_env"]))
    has_key = bool(os.getenv(adapter["key_env"]))
    return {
        "id": adapter["id"],
        "label": adapter["label"],
        "role": adapter["role"],
        "configured": has_url and has_key,
        "url_configured": has_url,
        "credential_configured": has_key,
        "status": "ready" if has_url and has_key else "not_configured",
    }
