from pathlib import Path
from types import SimpleNamespace
from typing import Any

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
  api_key: "comms-key"
""",
        encoding="utf-8",
    )

    with pytest.raises(ConfigError, match="commander.agent_id"):
        _load_config(config_path, rest_url="https://example.com", ws_url="wss://example.com")


def test_load_config_requires_all_live_agents(tmp_path: Path) -> None:
    config_path = tmp_path / "agent_config.yaml"
    config_path.write_text(
        """
commander:
  agent_id: "11111111-1111-1111-1111-111111111111"
  api_key: "commander-key"
evidence:
  agent_id: "22222222-2222-2222-2222-222222222222"
  api_key: "evidence-key"
""",
        encoding="utf-8",
    )

    with pytest.raises(ConfigError, match="traceability"):
        _load_config(config_path, rest_url="https://example.com", ws_url="wss://example.com")


def test_load_config_accepts_five_agents(tmp_path: Path) -> None:
    config_path = tmp_path / "agent_config.yaml"
    config_path.write_text(
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
  api_key: "comms-key"
rest_url: "https://band.example"
ws_url: "wss://band.example/socket"
""",
        encoding="utf-8",
    )

    config = _load_config(config_path, rest_url="https://example.com", ws_url="wss://example.com")

    assert config.commander.agent_id == "11111111-1111-1111-1111-111111111111"
    assert config.evidence.agent_id == "22222222-2222-2222-2222-222222222222"
    assert config.traceability.agent_id == "33333333-3333-3333-3333-333333333333"
    assert config.risk.agent_id == "44444444-4444-4444-4444-444444444444"
    assert config.communications.agent_id == "55555555-5555-5555-5555-555555555555"
    assert config.rest_url == "https://band.example"
    assert config.ws_url == "wss://band.example/socket"


@pytest.mark.anyio("asyncio")
async def test_run_spike_executes_five_agent_live_chain(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []
    context: list[dict[str, str]] = []
    active_agents: set[str] = set()
    adapters: dict[str, Any] = {}
    message_counter = 0
    event_counter = 0
    all_participants = {
        "commander-id": SimpleNamespace(
            id="commander-id", name="RecallOps Commander", handle="@commander"
        ),
        "evidence-id": SimpleNamespace(
            id="evidence-id", name="RecallOps Evidence", handle="@evidence"
        ),
        "traceability-id": SimpleNamespace(
            id="traceability-id", name="RecallOps Traceability", handle="@traceability"
        ),
        "risk-id": SimpleNamespace(id="risk-id", name="RecallOps Risk", handle="@risk"),
        "communications-id": SimpleNamespace(
            id="communications-id", name="RecallOps Communications", handle="@communications"
        ),
    }
    participants = {"commander-id": all_participants["commander-id"]}

    class FakeAgent:
        def __init__(self, agent_id: str) -> None:
            self.agent_id = agent_id

        @classmethod
        def create(cls, **kwargs: object) -> "FakeAgent":
            agent_id = str(kwargs["agent_id"])
            adapters[agent_id] = kwargs["adapter"]
            calls.append(f"agent.create:{agent_id}")
            return cls(agent_id)

        async def start(self) -> None:
            active_agents.add(self.agent_id)
            await adapters[self.agent_id].on_started(
                all_participants[self.agent_id].name,
                "test agent",
            )
            calls.append(f"agent.start:{self.agent_id}")

        async def stop(self, timeout: float) -> None:
            assert timeout == 2.0
            active_agents.remove(self.agent_id)
            calls.append(f"agent.stop:{self.agent_id}")

    class FakeTools:
        def __init__(self, room_id: str, rest: object, sender_id: str = "commander-id") -> None:
            self.room_id = room_id
            self.rest = rest
            self.sender_id = sender_id

        async def create_chatroom(self, task_id: str | None = None) -> str:
            assert task_id is None
            calls.append("room.create")
            return "room-123"

        async def add_participant(self, identifier: str) -> dict[str, str]:
            participants[identifier] = all_participants[identifier]
            calls.append(f"participant.add:{identifier}")
            return {"id": identifier, "status": "added"}

        async def get_participants(self) -> list[SimpleNamespace]:
            calls.append("participants.get")
            return list(participants.values())

        async def send_event(
            self,
            *,
            content: str,
            message_type: str,
            metadata: dict[str, Any],
        ) -> SimpleNamespace:
            nonlocal event_counter
            assert message_type == "task"
            event_counter += 1
            item_id = f"event-{event_counter}"
            context.append({"id": item_id, "content": content})
            calls.append(f"event.send:{metadata['stage']}")
            return SimpleNamespace(id=item_id)

        async def send_message(self, *, content: str, mentions: list[str]) -> SimpleNamespace:
            nonlocal message_counter
            message_counter += 1
            item_id = f"message-{message_counter}"
            context.append({"id": item_id, "content": content})
            calls.append(f"message.send:{self.sender_id}")
            sender = all_participants[self.sender_id]

            for mention in mentions:
                target_id = _target_id_for_mention(mention)
                adapter = adapters.get(target_id)
                if adapter is None or target_id not in active_agents:
                    continue
                msg = SimpleNamespace(
                    content=content,
                    sender_id=self.sender_id,
                    sender_name=sender.name,
                )
                await adapter.on_message(
                    msg,
                    FakeTools(self.room_id, self.rest, sender_id=target_id),
                    history=SimpleNamespace(),
                    participants_msg=None,
                    contacts_msg=None,
                    is_session_bootstrap=False,
                    room_id=self.room_id,
                )

            return SimpleNamespace(id=item_id)

        async def fetch_room_context(
            self,
            *,
            room_id: str,
            page: int,
            page_size: int,
        ) -> dict[str, list[dict[str, str]]]:
            assert room_id == "room-123"
            assert page == 1
            assert page_size == 100
            calls.append("context.fetch")
            return {"data": context}

    def _target_id_for_mention(mention: str) -> str | None:
        normalized = mention.lower()
        for agent_id, participant in all_participants.items():
            options = {participant.id.lower(), participant.name.lower(), participant.handle.lower()}
            if normalized in options:
                return agent_id
        return None

    monkeypatch.setattr(band_spike, "Agent", FakeAgent)
    monkeypatch.setattr(band_spike, "AsyncRestClient", lambda **_: object())
    monkeypatch.setattr(band_spike, "AgentTools", FakeTools)

    result = await band_spike.run_spike(
        SpikeConfig(
            commander=BandAgentCredentials(agent_id="commander-id", api_key="commander-key"),
            evidence=BandAgentCredentials(agent_id="evidence-id", api_key="evidence-key"),
            traceability=BandAgentCredentials(agent_id="traceability-id", api_key="trace-key"),
            risk=BandAgentCredentials(agent_id="risk-id", api_key="risk-key"),
            communications=BandAgentCredentials(
                agent_id="communications-id", api_key="communications-key"
            ),
            rest_url="https://band.example",
            ws_url="wss://band.example/socket",
        ),
        timeout_seconds=1,
    )

    assert result["ok"] is True
    assert result["proof_mode"] == "live_band_five_agent_workflow"
    assert result["room_id"] == "room-123"
    assert result["participant_count"] == 5
    assert result["evidence_ack_id"] == "message-2"
    assert result["traceability_gap_id"] == "message-3"
    assert result["risk_veto_id"] == "message-4"
    assert result["traceability_resolved_id"] == "message-5"
    assert result["risk_approved_id"] == "message-6"
    assert result["communications_notice_id"] == "message-7"
    assert "participant.add:traceability-id" in calls
    assert "participant.add:risk-id" in calls
    assert "participant.add:communications-id" in calls
    assert active_agents == set()
