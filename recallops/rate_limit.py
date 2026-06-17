from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path


@dataclass(frozen=True)
class SpendLimitSettings:
    enabled: bool
    run_dir: Path
    cooldown_seconds: int
    daily_limit: int


class SpendLimitError(RuntimeError):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class SpendPermit:
    def __init__(self, settings: SpendLimitSettings, lock_fd: int | None) -> None:
        self.settings = settings
        self.lock_fd = lock_fd

    def record(self, payload: dict[str, object]) -> None:
        if not self.settings.enabled:
            return
        self.settings.run_dir.mkdir(parents=True, exist_ok=True)
        recorded_at = _now()
        record = {"recorded_at": recorded_at, **payload}
        record_path = (
            self.settings.run_dir / f"run-{recorded_at.replace(':', '').replace('-', '')}.json"
        )
        record_json = json.dumps(record, indent=2, sort_keys=True)
        record_path.write_text(record_json, encoding="utf-8")
        (self.settings.run_dir / "latest.json").write_text(record_json, encoding="utf-8")

    def release(self) -> None:
        if self.lock_fd is not None:
            os.close(self.lock_fd)
            self.lock_fd = None
        _lock_path(self.settings).unlink(missing_ok=True)


def partner_ai_limit_settings() -> SpendLimitSettings:
    return SpendLimitSettings(
        enabled=os.environ.get("RECALLOPS_PARTNER_AI_LIMIT_ENABLED", "1") == "1",
        run_dir=Path(os.environ.get("RECALLOPS_PARTNER_AI_LIMIT_DIR", "partner-ai-runs")),
        cooldown_seconds=int(os.environ.get("RECALLOPS_PARTNER_AI_COOLDOWN_SECONDS", "10")),
        daily_limit=int(os.environ.get("RECALLOPS_PARTNER_AI_DAILY_LIMIT", "25")),
    )


def spend_limit_status(settings: SpendLimitSettings | None = None) -> dict[str, object]:
    active_settings = settings or partner_ai_limit_settings()
    latest_run = _latest_run(active_settings)
    runs_today = _runs_today(active_settings)
    cooldown_remaining = _cooldown_remaining(active_settings, latest_run)
    lock_exists = _lock_path(active_settings).exists()
    return {
        "enabled": active_settings.enabled,
        "runnable": (
            not active_settings.enabled
            or (
                cooldown_remaining == 0
                and runs_today < active_settings.daily_limit
                and not lock_exists
            )
        ),
        "cooldown_seconds": active_settings.cooldown_seconds,
        "cooldown_remaining_seconds": cooldown_remaining,
        "daily_limit": active_settings.daily_limit,
        "runs_today": runs_today,
        "locked": lock_exists,
        "latest_run": latest_run,
    }


def acquire_spend_permit(settings: SpendLimitSettings | None = None) -> SpendPermit:
    active_settings = settings or partner_ai_limit_settings()
    if not active_settings.enabled:
        return SpendPermit(active_settings, None)

    status = spend_limit_status(active_settings)
    if status["locked"] is True:
        raise SpendLimitError(409, "Partner AI proof is already running.")
    if status["cooldown_remaining_seconds"] != 0:
        raise SpendLimitError(429, "Partner AI proof is cooling down.")
    if int(status["runs_today"]) >= active_settings.daily_limit:
        raise SpendLimitError(429, "Partner AI daily limit reached.")

    active_settings.run_dir.mkdir(parents=True, exist_ok=True)
    try:
        lock_fd = os.open(_lock_path(active_settings), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError as exc:
        raise SpendLimitError(409, "Partner AI proof is already running.") from exc
    return SpendPermit(active_settings, lock_fd)


def _latest_run(settings: SpendLimitSettings) -> dict[str, object] | None:
    latest_path = settings.run_dir / "latest.json"
    if not latest_path.exists():
        return None
    return json.loads(latest_path.read_text(encoding="utf-8"))


def _runs_today(settings: SpendLimitSettings) -> int:
    if not settings.run_dir.exists():
        return 0
    today = datetime.now(UTC).date().isoformat()
    count = 0
    for run_path in settings.run_dir.glob("run-*.json"):
        try:
            record = json.loads(run_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if str(record.get("recorded_at", "")).startswith(today):
            count += 1
    return count


def _cooldown_remaining(
    settings: SpendLimitSettings,
    latest_run: dict[str, object] | None,
) -> int:
    if not latest_run:
        return 0
    recorded_at = str(latest_run.get("recorded_at") or "")
    if not recorded_at:
        return 0
    recorded = datetime.fromisoformat(recorded_at.replace("Z", "+00:00"))
    elapsed = (datetime.now(UTC) - recorded).total_seconds()
    return max(0, settings.cooldown_seconds - int(elapsed))


def _lock_path(settings: SpendLimitSettings) -> Path:
    return settings.run_dir / "run.lock"


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")
