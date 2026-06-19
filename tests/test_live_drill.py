import asyncio
import json
from pathlib import Path
from typing import Any

import pytest

from recallops import live_drill


def _write_config(path: Path) -> None:
    path.write_text(
        """
commander:
  agent_id: "11111111-1111-1111-1111-111111111111"
  api_key: "commander-key"
evidence:
  agent_id: "22222222-2222-2222-2222-222222222222"
  api_key: "evidence-key"
traceability:
  agent_id: "33333333-3333-3333-3333-333333333333"
  api_key: "trace-key"
risk:
  agent_id: "44444444-4444-4444-4444-444444444444"
  api_key: "risk-key"
communications:
  agent_id: "55555555-5555-5555-5555-555555555555"
  api_key: "communications-key"
""",
        encoding="utf-8",
    )


def _set_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path, *, enabled: bool = True) -> Path:
    config_path = tmp_path / "agent_config.yaml"
    monkeypatch.setenv("RECALLOPS_ENABLE_LIVE_DRILL", "1" if enabled else "0")
    monkeypatch.setenv("RECALLOPS_BAND_CONFIG", str(config_path))
    monkeypatch.setenv("RECALLOPS_LIVE_DRILL_DIR", str(tmp_path / "runs"))
    monkeypatch.setenv("RECALLOPS_LIVE_DRILL_COOLDOWN_SECONDS", "0")
    monkeypatch.setenv("RECALLOPS_LIVE_DRILL_DAILY_LIMIT", "5")
    monkeypatch.setenv("RECALLOPS_LIVE_DRILL_TIMEOUT_SECONDS", "1")
    return config_path


def test_live_drill_status_reports_missing_config(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _set_env(monkeypatch, tmp_path)

    status = live_drill.live_drill_status()

    assert status["enabled"] is True
    assert status["configured"] is False
    assert status["runnable"] is False
    assert status["latest_run"] is None


def test_live_drill_rejects_disabled_runtime(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    config_path = _set_env(monkeypatch, tmp_path, enabled=False)
    _write_config(config_path)

    with pytest.raises(live_drill.LiveDrillError, match="disabled"):
        asyncio.run(live_drill.run_live_drill())


def test_live_drill_persists_fresh_band_run(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    config_path = _set_env(monkeypatch, tmp_path)
    _write_config(config_path)

    async def fake_run_spike_once(config: Any, timeout_seconds: float) -> dict[str, Any]:
        assert config.commander.agent_id == "11111111-1111-1111-1111-111111111111"
        assert timeout_seconds == 1
        return {
            "ok": True,
            "proof_mode": "live_band_five_agent_workflow",
            "room_id": "fresh-room",
            "participant_count": 5,
            "context_items": 8,
            "commander_event_id": "fresh-event",
            "commander_message_id": "fresh-commander",
            "evidence_ack_id": "fresh-evidence",
            "traceability_gap_id": "fresh-gap",
            "risk_veto_id": "fresh-veto",
            "traceability_resolved_id": "fresh-resolved",
            "risk_approved_id": "fresh-approved",
            "communications_notice_id": "fresh-notice",
        }

    monkeypatch.setattr(live_drill, "_run_spike_once", fake_run_spike_once)

    proof = asyncio.run(live_drill.run_live_drill())
    captured_run = proof["captured_band_run"]

    assert proof["proof_kind"] == "fresh_live_band_run"
    assert captured_run["proof_mode"] == "fresh_band_five_agent_run"
    assert captured_run["room_id"] == "fresh-room"
    assert captured_run["stage_evidence"][3]["band_message_id"] == "fresh-veto"

    status = live_drill.live_drill_status()
    assert status["latest_run"] == proof
    latest_path = tmp_path / "runs" / "latest.json"
    assert json.loads(latest_path.read_text(encoding="utf-8")) == proof


def test_live_drill_status_normalizes_legacy_fresh_band_copy(tmp_path: Path) -> None:
    run_dir = tmp_path / "runs"
    run_dir.mkdir()
    settings = live_drill.LiveDrillSettings(
        enabled=True,
        config_path=tmp_path / "agent_config.yaml",
        run_dir=run_dir,
        cooldown_seconds=0,
        daily_limit=5,
        timeout_seconds=1,
    )
    legacy_proof = {
        "completed_at": "2026-06-19T02:36:06Z",
        "captured_band_run": {
            "stage_evidence": [
                {
                    "stage": "room_created",
                    "label": "Commander message",
                    "band_message_id": "message-1",
                    "proves": "Commander created a fresh Band room and recruited Evidence.",
                }
            ]
        },
    }
    (run_dir / "latest.json").write_text(json.dumps(legacy_proof), encoding="utf-8")

    status = live_drill.live_drill_status(settings)
    latest_run = status["latest_run"]

    assert isinstance(latest_run, dict)
    captured_run = latest_run["captured_band_run"]
    assert isinstance(captured_run, dict)
    assert captured_run["stage_evidence"][0]["proves"] == (
        "Commander created a new provider Band room and recruited Evidence."
    )
