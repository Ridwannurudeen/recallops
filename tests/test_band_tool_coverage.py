from types import SimpleNamespace
from typing import Any

import pytest

from scripts import band_spike
from scripts.band_spike import BandAgentCredentials, SpikeConfig


def _config() -> SpikeConfig:
    return SpikeConfig(
        commander=BandAgentCredentials(agent_id="commander-id", api_key="commander-key"),
        evidence=BandAgentCredentials(agent_id="evidence-id", api_key="evidence-key"),
        traceability=BandAgentCredentials(agent_id="traceability-id", api_key="trace-key"),
        risk=BandAgentCredentials(agent_id="risk-id", api_key="risk-key"),
        communications=BandAgentCredentials(agent_id="communications-id", api_key="comms-key"),
        rest_url="https://band.example",
        ws_url="wss://band.example/socket",
    )


class _SweepToolsOk:
    async def lookup_peers(self, page: int, page_size: int) -> Any:
        return SimpleNamespace(data=[SimpleNamespace(id="x"), SimpleNamespace(id="y")])

    async def list_contacts(self, page: int, page_size: int) -> Any:
        return SimpleNamespace(data=[SimpleNamespace(id="c")])

    async def get_participants(self) -> list[SimpleNamespace]:
        return [SimpleNamespace(id="evidence-id", name="Evidence", handle="@evidence")]

    async def add_contact(self, handle: str, message: str | None = None) -> Any:
        return SimpleNamespace(status="pending")

    async def store_memory(self, **kwargs: Any) -> Any:
        return SimpleNamespace(id="mem-1")

    async def get_memory(self, memory_id: str) -> Any:
        return SimpleNamespace(id=memory_id, content="...")

    async def remove_participant(self, identifier: str) -> dict[str, str]:
        return {"id": identifier, "status": "removed"}


class _SweepToolsFail:
    async def lookup_peers(self, page: int, page_size: int) -> Any:
        raise RuntimeError("peer lookup denied")

    async def list_contacts(self, page: int, page_size: int) -> Any:
        raise RuntimeError("contacts denied")

    async def get_participants(self) -> list[SimpleNamespace]:
        return [SimpleNamespace(id="evidence-id", name="Evidence", handle="@evidence")]

    async def add_contact(self, handle: str, message: str | None = None) -> Any:
        raise RuntimeError("contact add denied")

    async def store_memory(self, **kwargs: Any) -> Any:
        raise RuntimeError("403 memory is an enterprise feature")

    async def remove_participant(self, identifier: str) -> dict[str, str]:
        raise RuntimeError("remove denied")


@pytest.mark.anyio("asyncio")
async def test_exercise_band_tools_records_success() -> None:
    incident = band_spike._coerce_incident(None)
    coverage = await band_spike._exercise_band_tools(
        _SweepToolsOk(), config=_config(), audit_incident=incident
    )

    assert coverage["lookup_peers"] == {"ok": True, "count": 2}
    assert coverage["list_contacts"] == {"ok": True, "count": 1}
    assert coverage["add_contact"]["ok"] is True
    assert coverage["add_contact"]["status"] == "pending"
    assert coverage["store_memory"] == {"ok": True, "memory_id": "mem-1"}
    assert coverage["get_memory"] == {"ok": True, "memory_id": "mem-1"}
    assert coverage["remove_participant"] == {"ok": True, "status": "removed"}


@pytest.mark.anyio("asyncio")
async def test_exercise_band_tools_records_failures_gracefully() -> None:
    incident = band_spike._coerce_incident(None)
    coverage = await band_spike._exercise_band_tools(
        _SweepToolsFail(), config=_config(), audit_incident=incident
    )

    assert coverage["lookup_peers"]["ok"] is False
    assert coverage["list_contacts"]["ok"] is False
    assert coverage["add_contact"]["ok"] is False
    assert coverage["store_memory"]["ok"] is False
    # get_memory only runs after a successful store; absent on the enterprise-gated path.
    assert "get_memory" not in coverage
    assert coverage["remove_participant"]["ok"] is False


class _PollTools:
    def __init__(self, items: list[dict[str, str]]) -> None:
        self._items = items

    async def fetch_room_context(
        self, *, room_id: str, page: int, page_size: int
    ) -> dict[str, list[dict[str, str]]]:
        return {"data": self._items}


@pytest.mark.anyio("asyncio")
async def test_poll_for_sender_message_matches_sender() -> None:
    items = [
        {"id": "m1", "sender_id": "commander-id", "message_type": "text"},
        {"id": "e1", "sender_id": "communications-id", "message_type": "task"},
        {"id": "m7", "sender_id": "communications-id", "message_type": "text"},
    ]
    found = await band_spike._poll_for_sender_message(
        _PollTools(items),
        room_id="room-123",
        sender_id="communications-id",
        timeout_seconds=1,
    )
    assert found["id"] == "m7"


@pytest.mark.anyio("asyncio")
async def test_poll_for_sender_message_times_out() -> None:
    with pytest.raises(TimeoutError):
        await band_spike._poll_for_sender_message(
            _PollTools([{"id": "m1", "sender_id": "commander-id", "message_type": "text"}]),
            room_id="room-123",
            sender_id="communications-id",
            timeout_seconds=0,
        )
