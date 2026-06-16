from __future__ import annotations

import argparse
import asyncio
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from band import Agent
from band.client.rest import AsyncRestClient
from band.core.protocols import AgentToolsProtocol
from band.core.simple_adapter import SimpleAdapter
from band.core.types import HistoryProvider, PlatformMessage
from band.runtime.tools import AgentTools

DEFAULT_REST_URL = "https://app.band.ai"
DEFAULT_WS_URL = "wss://app.band.ai/api/v1/socket/websocket"
PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000"


@dataclass(frozen=True)
class BandAgentCredentials:
    agent_id: str
    api_key: str


@dataclass(frozen=True)
class SpikeConfig:
    commander: BandAgentCredentials
    evidence: BandAgentCredentials
    rest_url: str
    ws_url: str


class ConfigError(ValueError):
    pass


class EvidenceSpikeAdapter(SimpleAdapter[HistoryProvider]):
    async def on_message(
        self,
        msg: PlatformMessage,
        tools: AgentToolsProtocol,
        history: HistoryProvider,
        participants_msg: str | None,
        contacts_msg: str | None,
        *,
        is_session_bootstrap: bool,
        room_id: str,
    ) -> None:
        del history, participants_msg, contacts_msg, is_session_bootstrap, room_id

        if "RECALLOPS_SPIKE" not in msg.content:
            return

        await tools.send_event(
            content="Evidence agent received the RecallOps spike handoff.",
            message_type="task",
            metadata={"spike": "recallops", "stage": "evidence_received"},
        )
        participant = await _find_participant_by_id_or_name(
            tools,
            participant_id=msg.sender_id,
            participant_name=msg.sender_name,
        )
        mention = _participant_mention(participant)
        await tools.send_message(
            content=(
                "SPIKE_ACK Evidence agent joined the room, received the handoff, "
                "and can answer through Band."
            ),
            mentions=[mention],
        )


async def _find_participant_by_id_or_name(
    tools: AgentToolsProtocol,
    *,
    participant_id: str,
    participant_name: str | None,
) -> Any:
    participants = await tools.get_participants()
    for participant in participants:
        if getattr(participant, "id", None) == participant_id:
            return participant

    if participant_name:
        lowered = participant_name.lower()
        for participant in participants:
            if (getattr(participant, "name", "") or "").lower() == lowered:
                return participant

    raise RuntimeError("Could not resolve message sender as a Band room participant.")


def _participant_mention(participant: Any) -> str:
    handle = getattr(participant, "handle", None)
    if handle:
        return handle

    name = getattr(participant, "name", None)
    if name:
        return name

    participant_id = getattr(participant, "id", None)
    if participant_id:
        return participant_id

    raise RuntimeError("Participant has no handle, name, or ID for mention resolution.")


def _load_config(path: Path, rest_url: str, ws_url: str) -> SpikeConfig:
    if not path.exists():
        raise ConfigError(
            f"{path} does not exist. Copy agent_config.yaml.example to agent_config.yaml "
            "and fill in Band remote-agent credentials."
        )

    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    try:
        commander = _load_agent(raw, "commander")
        evidence = _load_agent(raw, "evidence")
    except KeyError as exc:
        raise ConfigError(f"Missing {exc.args[0]!r} in {path}.") from exc

    return SpikeConfig(
        commander=commander,
        evidence=evidence,
        rest_url=raw.get("rest_url") or rest_url,
        ws_url=raw.get("ws_url") or ws_url,
    )


def _load_agent(raw: dict[str, Any], key: str) -> BandAgentCredentials:
    value = raw[key]
    agent_id = str(value.get("agent_id") or "").strip()
    api_key = str(value.get("api_key") or "").strip()
    if not agent_id or agent_id == PLACEHOLDER_ID:
        raise ConfigError(f"{key}.agent_id is missing or still placeholder.")
    if not api_key or api_key.startswith("replace-with-"):
        raise ConfigError(f"{key}.api_key is missing or still placeholder.")
    return BandAgentCredentials(agent_id=agent_id, api_key=api_key)


async def run_spike(config: SpikeConfig, timeout_seconds: float) -> dict[str, Any]:
    evidence_agent = Agent.create(
        adapter=EvidenceSpikeAdapter(),
        agent_id=config.evidence.agent_id,
        api_key=config.evidence.api_key,
        ws_url=config.ws_url,
        rest_url=config.rest_url,
    )

    await evidence_agent.start()
    try:
        commander_rest = AsyncRestClient(
            api_key=config.commander.api_key,
            base_url=config.rest_url,
        )
        bootstrap_tools = AgentTools(room_id="", rest=commander_rest)
        room_id = await bootstrap_tools.create_chatroom(task_id="recallops-day0-spike")
        tools = AgentTools(room_id=room_id, rest=commander_rest)

        recruited = await tools.add_participant(config.evidence.agent_id)
        participants = await tools.get_participants()
        evidence_participant = _find_configured_participant(participants, config.evidence.agent_id)
        evidence_mention = _participant_mention(evidence_participant)

        event = await tools.send_event(
            content="Commander created the RecallOps spike room and recruited Evidence.",
            message_type="task",
            metadata={"spike": "recallops", "stage": "commander_recruited_evidence"},
        )
        message = await tools.send_message(
            content=(
                "RECALLOPS_SPIKE Please acknowledge this Band handoff. "
                "This proves room creation, recruitment, @mention routing, and reply."
            ),
            mentions=[evidence_mention],
        )

        ack = await _poll_for_ack(tools, room_id=room_id, timeout_seconds=timeout_seconds)
        context = await tools.fetch_room_context(room_id=room_id, page=1, page_size=50)
        return {
            "ok": True,
            "room_id": room_id,
            "recruited": recruited,
            "participant_count": len(participants),
            "commander_event_id": getattr(event, "id", None),
            "commander_message_id": getattr(message, "id", None),
            "evidence_ack_id": ack.get("id"),
            "context_items": len(context["data"]),
        }
    finally:
        await evidence_agent.stop(timeout=2.0)


def _find_configured_participant(participants: Any, agent_id: str) -> Any:
    for participant in participants:
        if getattr(participant, "id", None) == agent_id:
            return participant
    raise RuntimeError("Configured Evidence agent was not found in room participants.")


async def _poll_for_ack(
    tools: AgentTools,
    *,
    room_id: str,
    timeout_seconds: float,
) -> dict[str, Any]:
    deadline = asyncio.get_running_loop().time() + timeout_seconds
    while asyncio.get_running_loop().time() < deadline:
        context = await tools.fetch_room_context(room_id=room_id, page=1, page_size=50)
        for item in context["data"]:
            content = str(item.get("content") or "")
            if "SPIKE_ACK" in content:
                return item
        await asyncio.sleep(2)

    raise TimeoutError("Evidence agent did not reply with SPIKE_ACK before timeout.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the RecallOps Band Day-0 spike.")
    parser.add_argument("--config", default="agent_config.yaml")
    parser.add_argument("--rest-url", default=DEFAULT_REST_URL)
    parser.add_argument("--ws-url", default=DEFAULT_WS_URL)
    parser.add_argument("--timeout", type=float, default=45.0)
    parser.add_argument(
        "--check-config",
        action="store_true",
        help="Validate config presence and placeholders without connecting to Band.",
    )
    return parser.parse_args()


async def async_main() -> None:
    args = parse_args()
    config = _load_config(Path(args.config), rest_url=args.rest_url, ws_url=args.ws_url)
    if args.check_config:
        print(json.dumps({"ok": True, "checked": str(Path(args.config))}, indent=2))
        return

    result = await run_spike(config, timeout_seconds=args.timeout)
    print(json.dumps(result, indent=2, sort_keys=True))


def main() -> None:
    try:
        asyncio.run(async_main())
    except ConfigError as exc:
        raise SystemExit(f"Config error: {exc}") from exc


if __name__ == "__main__":
    main()
