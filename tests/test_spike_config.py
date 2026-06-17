from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts import band_spike
from scripts.band_spike import BandAgentCredentials, ConfigError, SpikeConfig, _load_config


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


@pytest.mark.anyio("asyncio")
async def test_run_spike_orders_room_recruit_handoff_and_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    class FakeAgent:
        @classmethod
        def create(cls, **kwargs: object) -> "FakeAgent":
            assert kwargs["agent_id"] == "evidence-id"
            calls.append("agent.create")
            return cls()

        async def start(self) -> None:
            calls.append("agent.start")

        async def stop(self, timeout: float) -> None:
            assert timeout == 2.0
            calls.append("agent.stop")

    class FakeTools:
        def __init__(self, room_id: str, rest: object) -> None:
            self.room_id = room_id
            self.rest = rest

        async def create_chatroom(self, task_id: str) -> str:
            assert task_id == "recallops-day0-spike"
            calls.append("room.create")
            return "room-123"

        async def add_participant(self, identifier: str) -> dict[str, str]:
            assert identifier == "evidence-id"
            calls.append("participant.add")
            return {"id": identifier}

        async def get_participants(self) -> list[SimpleNamespace]:
            calls.append("participants.get")
            return [
                SimpleNamespace(id="commander-id", name="Commander", handle="@commander"),
                SimpleNamespace(id="evidence-id", name="Evidence", handle="@evidence"),
            ]

        async def send_event(
            self,
            *,
            content: str,
            message_type: str,
            metadata: dict[str, str],
        ) -> SimpleNamespace:
            assert message_type == "task"
            assert metadata["stage"] == "commander_recruited_evidence"
            assert "recruited Evidence" in content
            calls.append("event.send")
            return SimpleNamespace(id="event-123")

        async def send_message(self, *, content: str, mentions: list[str]) -> SimpleNamespace:
            assert "RECALLOPS_SPIKE" in content
            assert mentions == ["@evidence"]
            calls.append("message.send")
            return SimpleNamespace(id="message-123")

        async def fetch_room_context(
            self,
            *,
            room_id: str,
            page: int,
            page_size: int,
        ) -> dict[str, list[dict[str, str]]]:
            assert room_id == "room-123"
            assert page == 1
            assert page_size == 50
            calls.append("context.fetch")
            return {"data": [{"id": "ack-123", "content": "SPIKE_ACK complete"}]}

    monkeypatch.setattr(band_spike, "Agent", FakeAgent)
    monkeypatch.setattr(band_spike, "AsyncRestClient", lambda **_: object())
    monkeypatch.setattr(band_spike, "AgentTools", FakeTools)

    result = await band_spike.run_spike(
        SpikeConfig(
            commander=BandAgentCredentials(agent_id="commander-id", api_key="commander-key"),
            evidence=BandAgentCredentials(agent_id="evidence-id", api_key="evidence-key"),
            rest_url="https://band.example",
            ws_url="wss://band.example/socket",
        ),
        timeout_seconds=1,
    )

    assert result == {
        "ok": True,
        "room_id": "room-123",
        "recruited": {"id": "evidence-id"},
        "participant_count": 2,
        "commander_event_id": "event-123",
        "commander_message_id": "message-123",
        "evidence_ack_id": "ack-123",
        "context_items": 1,
    }
    assert calls == [
        "agent.create",
        "agent.start",
        "room.create",
        "participant.add",
        "participants.get",
        "event.send",
        "message.send",
        "context.fetch",
        "context.fetch",
        "agent.stop",
    ]
