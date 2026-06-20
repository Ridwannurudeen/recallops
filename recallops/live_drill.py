from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from scripts.band_spike import (
    DEFAULT_REST_URL,
    DEFAULT_WS_URL,
    ConfigError,
    _load_config,
    run_spike,
)

LEGACY_FRESH_ROOM_PROOF = "Commander created a fresh Band room and recruited Evidence."
PROVIDER_ROOM_PROOF = "Commander created a new provider Band room and recruited Evidence."


@dataclass(frozen=True)
class LiveDrillSettings:
    enabled: bool
    config_path: Path
    run_dir: Path
    cooldown_seconds: int
    daily_limit: int
    timeout_seconds: float


class LiveDrillError(RuntimeError):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def live_drill_settings() -> LiveDrillSettings:
    return LiveDrillSettings(
        enabled=os.environ.get("RECALLOPS_ENABLE_LIVE_DRILL") == "1",
        config_path=Path(os.environ.get("RECALLOPS_BAND_CONFIG", "agent_config.yaml")),
        run_dir=Path(os.environ.get("RECALLOPS_LIVE_DRILL_DIR", "live-runs")),
        cooldown_seconds=int(os.environ.get("RECALLOPS_LIVE_DRILL_COOLDOWN_SECONDS", "600")),
        daily_limit=int(os.environ.get("RECALLOPS_LIVE_DRILL_DAILY_LIMIT", "5")),
        timeout_seconds=float(os.environ.get("RECALLOPS_LIVE_DRILL_TIMEOUT_SECONDS", "120")),
    )


def live_drill_status(settings: LiveDrillSettings | None = None) -> dict[str, object]:
    active_settings = settings or live_drill_settings()
    latest_run = latest_live_drill(active_settings)
    runs_today = _runs_today(active_settings)
    cooldown_remaining = _cooldown_remaining(active_settings, latest_run)
    configured = active_settings.config_path.exists()
    return {
        "enabled": active_settings.enabled,
        "configured": configured,
        "runnable": (
            active_settings.enabled
            and configured
            and cooldown_remaining == 0
            and runs_today < active_settings.daily_limit
            and not _lock_path(active_settings).exists()
        ),
        "cooldown_seconds": active_settings.cooldown_seconds,
        "cooldown_remaining_seconds": cooldown_remaining,
        "daily_limit": active_settings.daily_limit,
        "runs_today": runs_today,
        "latest_run": latest_run,
    }


async def run_live_drill(
    settings: LiveDrillSettings | None = None,
    *,
    incident: dict[str, object] | None = None,
) -> dict[str, object]:
    active_settings = settings or live_drill_settings()
    status = live_drill_status(active_settings)
    if not active_settings.enabled:
        raise LiveDrillError(503, "Provider Band drill is disabled on this deployment.")
    if not active_settings.config_path.exists():
        raise LiveDrillError(503, "Provider Band drill is missing server-side Band credentials.")
    if status["cooldown_remaining_seconds"] != 0:
        raise LiveDrillError(429, "Provider Band drill is cooling down.")
    if int(status["runs_today"]) >= active_settings.daily_limit:
        raise LiveDrillError(429, "Provider Band drill daily limit reached.")

    active_settings.run_dir.mkdir(parents=True, exist_ok=True)
    lock_fd = _acquire_lock(active_settings)
    started_at = _now()
    try:
        config = _load_config(
            active_settings.config_path,
            rest_url=DEFAULT_REST_URL,
            ws_url=DEFAULT_WS_URL,
        )
        spike_result = (
            await _run_spike_once(
                config,
                active_settings.timeout_seconds,
                incident=incident,
            )
            if incident is not None
            else await _run_spike_once(config, active_settings.timeout_seconds)
        )
        completed_at = _now()
        proof = {
            "proof_kind": "fresh_live_band_run",
            "started_at": started_at,
            "completed_at": completed_at,
            "captured_band_run": _fresh_band_proof(spike_result, captured_at=completed_at),
        }
        _write_live_drill(active_settings, proof)
        return proof
    except ConfigError as exc:
        raise LiveDrillError(503, "Provider Band drill server config is invalid.") from exc
    finally:
        os.close(lock_fd)
        _lock_path(active_settings).unlink(missing_ok=True)


def latest_live_drill(settings: LiveDrillSettings | None = None) -> dict[str, object] | None:
    active_settings = settings or live_drill_settings()
    latest_path = active_settings.run_dir / "latest.json"
    if not latest_path.exists():
        return None
    return _normalize_live_drill(json.loads(latest_path.read_text(encoding="utf-8")))


async def _run_spike_once(
    config: Any,
    timeout_seconds: float,
    *,
    incident: dict[str, object] | None = None,
) -> dict[str, Any]:
    return await run_spike(config, timeout_seconds=timeout_seconds, incident=incident)


def _fresh_band_proof(result: dict[str, Any], *, captured_at: str) -> dict[str, object]:
    return {
        "proof_mode": "fresh_band_five_agent_run",
        "captured_at": captured_at,
        "room_id": str(result["room_id"]),
        "participant_count": int(result["participant_count"]),
        "context_items": int(result["context_items"]),
        "commander_event_id": str(result["commander_event_id"]),
        "commander_message_id": str(result["commander_message_id"]),
        "evidence_ack_id": str(result["evidence_ack_id"]),
        "traceability_gap_id": str(result["traceability_gap_id"]),
        "risk_veto_id": str(result["risk_veto_id"]),
        "traceability_resolved_id": str(result["traceability_resolved_id"]),
        "risk_approved_id": str(result["risk_approved_id"]),
        "communications_notice_id": str(result["communications_notice_id"]),
        "communications_framework": result.get("communications_framework", "simple_adapter"),
        "band_tool_coverage": result.get("band_tool_coverage", {}),
        "stage_evidence": _stage_evidence(result),
    }


def _stage_evidence(result: dict[str, Any]) -> list[dict[str, str]]:
    return [
        {
            "stage": "room_created",
            "label": "Commander message",
            "band_message_id": str(result["commander_message_id"]),
            "proves": PROVIDER_ROOM_PROOF,
        },
        {
            "stage": "evidence_extracted",
            "label": "Evidence ack",
            "band_message_id": str(result["evidence_ack_id"]),
            "proves": "Evidence responded in-room with product, defect, lot, and severity facts.",
        },
        {
            "stage": "traceability_gap",
            "label": "Traceability gap",
            "band_message_id": str(result["traceability_gap_id"]),
            "proves": "Traceability reported the coverage gap and untraced units.",
        },
        {
            "stage": "regulatory_veto",
            "label": "Risk veto",
            "band_message_id": str(result["risk_veto_id"]),
            "proves": "Risk blocked customer notice until traceability recovered the missing units.",
        },
        {
            "stage": "traceability_resolved",
            "label": "Re-plan result",
            "band_message_id": str(result["traceability_resolved_id"]),
            "proves": "Traceability recovered the distributor gap and restored coverage.",
        },
        {
            "stage": "risk_approved",
            "label": "Risk approval",
            "band_message_id": str(result["risk_approved_id"]),
            "proves": "Risk cleared the recall path after the re-plan.",
        },
        {
            "stage": "notice_drafted",
            "label": "Communications notice",
            "band_message_id": str(result["communications_notice_id"]),
            "proves": "Communications completed the regulator, customer, and quarantine handoff.",
        },
    ]


def _write_live_drill(settings: LiveDrillSettings, proof: dict[str, object]) -> None:
    completed_at = str(proof["completed_at"]).replace(":", "").replace("-", "")
    run_path = settings.run_dir / f"run-{completed_at}.json"
    payload = json.dumps(proof, indent=2, sort_keys=True)
    run_path.write_text(payload, encoding="utf-8")
    (settings.run_dir / "latest.json").write_text(payload, encoding="utf-8")


def _normalize_live_drill(proof: dict[str, object]) -> dict[str, object]:
    captured_run = proof.get("captured_band_run")
    if not isinstance(captured_run, dict):
        return proof

    stage_evidence = captured_run.get("stage_evidence")
    if not isinstance(stage_evidence, list):
        return proof

    normalized_stage_evidence: list[object] = []
    changed = False
    for item in stage_evidence:
        if isinstance(item, dict) and item.get("proves") == LEGACY_FRESH_ROOM_PROOF:
            normalized_stage_evidence.append({**item, "proves": PROVIDER_ROOM_PROOF})
            changed = True
        else:
            normalized_stage_evidence.append(item)

    if not changed:
        return proof

    return {
        **proof,
        "captured_band_run": {
            **captured_run,
            "stage_evidence": normalized_stage_evidence,
        },
    }


def _runs_today(settings: LiveDrillSettings) -> int:
    if not settings.run_dir.exists():
        return 0
    today = datetime.now(UTC).date().isoformat()
    count = 0
    for run_path in settings.run_dir.glob("run-*.json"):
        try:
            proof = json.loads(run_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if str(proof.get("completed_at", "")).startswith(today):
            count += 1
    return count


def _cooldown_remaining(settings: LiveDrillSettings, latest_run: dict[str, object] | None) -> int:
    if not latest_run:
        return 0
    completed_at = str(latest_run.get("completed_at") or "")
    if not completed_at:
        return 0
    completed = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
    elapsed = (datetime.now(UTC) - completed).total_seconds()
    return max(0, settings.cooldown_seconds - int(elapsed))


def _acquire_lock(settings: LiveDrillSettings) -> int:
    lock_path = _lock_path(settings)
    try:
        return os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError as exc:
        raise LiveDrillError(409, "Provider Band drill is already running.") from exc


def _lock_path(settings: LiveDrillSettings) -> Path:
    return settings.run_dir / "run.lock"


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")
