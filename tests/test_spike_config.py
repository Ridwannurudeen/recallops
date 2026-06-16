from pathlib import Path

import pytest

from scripts.band_spike import ConfigError, _load_config


def test_load_config_rejects_missing_file(tmp_path: Path) -> None:
    with pytest.raises(ConfigError, match="does not exist"):
        _load_config(
            tmp_path / "agent_config.yaml",
            rest_url="https://example.com",
            ws_url="wss://example.com",
        )


def test_load_config_rejects_placeholders(tmp_path: Path) -> None:
    config_path = tmp_path / "agent_config.yaml"
    config_path.write_text(
        """
commander:
  agent_id: "00000000-0000-0000-0000-000000000000"
  api_key: "replace-with-commander-band-agent-api-key"
evidence:
  agent_id: "00000000-0000-0000-0000-000000000000"
  api_key: "replace-with-evidence-band-agent-api-key"
""",
        encoding="utf-8",
    )

    with pytest.raises(ConfigError, match="commander.agent_id"):
        _load_config(config_path, rest_url="https://example.com", ws_url="wss://example.com")


def test_load_config_accepts_two_agents(tmp_path: Path) -> None:
    config_path = tmp_path / "agent_config.yaml"
    config_path.write_text(
        """
commander:
  agent_id: "11111111-1111-1111-1111-111111111111"
  api_key: "commander-key"
evidence:
  agent_id: "22222222-2222-2222-2222-222222222222"
  api_key: "evidence-key"
rest_url: "https://band.example"
ws_url: "wss://band.example/socket"
""",
        encoding="utf-8",
    )

    config = _load_config(config_path, rest_url="https://example.com", ws_url="wss://example.com")

    assert config.commander.agent_id == "11111111-1111-1111-1111-111111111111"
    assert config.evidence.agent_id == "22222222-2222-2222-2222-222222222222"
    assert config.rest_url == "https://band.example"
    assert config.ws_url == "wss://band.example/socket"
