from __future__ import annotations

import argparse
import asyncio
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from band import Agent
from band.adapters.anthropic import AnthropicAdapter
from band.client.rest import AsyncRestClient
from band.core.protocols import AgentToolsProtocol
from band.core.simple_adapter import SimpleAdapter
from band.core.types import HistoryProvider, PlatformMessage
from band.runtime.tools import AgentTools

from recallops.partner_ai import generate_agent_line

DEFAULT_REST_URL = "https://app.band.ai"
DEFAULT_WS_URL = "wss://app.band.ai/api/v1/socket/websocket"
PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000"
AGENT_KEYS = ("commander", "evidence", "traceability", "risk", "communications")

# Cross-framework: the Communications agent runs on Band's AnthropicAdapter (a
# real Claude model) instead of the scripted SimpleAdapter when an Anthropic key
# is configured. It is the terminal agent, so LLM-authored output can't disrupt
# the upstream veto -> re-plan -> approve choreography. Falls back to the scripted
# adapter when no key/package is available so the live run still works offline.
COMMS_MODEL = (
    os.environ.get("RECALLOPS_COMMS_MODEL")
    or os.environ.get("RECALLOPS_REVIEWER_MODEL")
    or "claude-haiku-4-5"
)


def _communications_system_prompt(incident: SpikeIncident) -> str:
    return (
        "You are the RecallOps Communications agent in a product-recall command "
        "room on Band. When another agent @mentions you to draft recall notices, "
        "send exactly ONE chat message that drafts three notices for the confirmed "
        "recall: a regulator notice, a customer stop-use notice, and a warehouse "
        "quarantine order. Keep it concise and professional. You MUST @mention the "
        "Incident Commander (see the participants list) so the commander receives "
        "the message. Use only these confirmed incident facts:\n"
        f"{_incident_facts(incident)}\n"
        "After sending that one message, stop. Do not send any further messages."
    )


@dataclass(frozen=True)
class BandAgentCredentials:
    agent_id: str
    api_key: str


@dataclass(frozen=True)
class SpikeConfig:
    commander: BandAgentCredentials
    evidence: BandAgentCredentials
    traceability: BandAgentCredentials
    risk: BandAgentCredentials
    communications: BandAgentCredentials
    rest_url: str
    ws_url: str


@dataclass(frozen=True)
class SpikeIncident:
    product: str
    lot: str
    defect: str
    severity: str
    complaint_count: int
    shipped_units: int
    initial_coverage_percent: int
    untraced_units: int
    recovered_units: int
    final_coverage_percent: int


class ConfigError(ValueError):
    pass


def _incident_facts(incident: SpikeIncident) -> str:
    return (
        f"product={incident.product}; lot={incident.lot}; defect={incident.defect}; "
        f"severity={incident.severity}; complaints={incident.complaint_count}; "
        f"shipped_units={incident.shipped_units}; "
        f"initial_coverage={incident.initial_coverage_percent}%; "
        f"untraced_units={incident.untraced_units}; recovered_units={incident.recovered_units}; "
        f"final_coverage={incident.final_coverage_percent}%"
    )


async def _agent_line(*, role: str, instruction: str, incident: SpikeIncident) -> str:
    line = await asyncio.to_thread(
        generate_agent_line,
        role=role,
        instruction=instruction,
        facts=_incident_facts(incident),
        fallback="",
    )
    return f" {line}" if line else ""


class EvidenceSpikeAdapter(SimpleAdapter[HistoryProvider]):
    def __init__(
        self,
        *,
        commander_id: str,
        traceability_id: str,
        incident: SpikeIncident,
    ) -> None:
        super().__init__()
        self.commander_id = commander_id
        self.traceability_id = traceability_id
        self.incident = incident

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

        if "RECALLOPS_EVIDENCE" not in msg.content:
            return

        await tools.send_event(
            content=(
                f"Evidence extracted product {self.incident.product}, defect "
                f"{self.incident.defect}, lot {self.incident.lot}, and "
                f"{self.incident.severity} severity."
            ),
            message_type="task",
            metadata={"spike": "recallops", "stage": "evidence_extracted"},
        )
        await tools.add_participant(self.traceability_id)
        participants = await tools.get_participants()
        commander = _participant_mention(
            _find_configured_participant(participants, self.commander_id)
        )
        traceability = _participant_mention(
            _find_configured_participant(participants, self.traceability_id)
        )
        line = await _agent_line(
            role="Evidence Agent",
            instruction="Summarize the confirmed incident facts for the recall room.",
            incident=self.incident,
        )
        await tools.send_message(
            content=(
                f"LIVE_EVIDENCE_ACK extracted {self.incident.complaint_count} "
                f"{self.incident.defect} complaint(s) for {self.incident.lot}. "
                "RECALLOPS_TRACEABILITY Please map shipped units, open stock, and gaps."
                f"{line}"
            ),
            mentions=[commander, traceability],
        )


class TraceabilitySpikeAdapter(SimpleAdapter[HistoryProvider]):
    def __init__(self, *, commander_id: str, risk_id: str, incident: SpikeIncident) -> None:
        super().__init__()
        self.commander_id = commander_id
        self.risk_id = risk_id
        self.incident = incident

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

        if "RECALLOPS_TRACEABILITY" in msg.content:
            await self._send_gap(tools)
            return

        if "RECALLOPS_REPLAN" in msg.content:
            await self._send_resolution(tools)

    async def _send_gap(self, tools: AgentToolsProtocol) -> None:
        await tools.send_event(
            content=(
                f"Traceability found {self.incident.shipped_units:,} shipped units but only "
                f"{self.incident.initial_coverage_percent}% shipment coverage."
            ),
            message_type="task",
            metadata={
                "spike": "recallops",
                "stage": "traceability_gap",
                "coverage_percent": self.incident.initial_coverage_percent,
                "untraced_units": self.incident.untraced_units,
            },
        )
        await tools.add_participant(self.risk_id)
        participants = await tools.get_participants()
        commander = _participant_mention(
            _find_configured_participant(participants, self.commander_id)
        )
        risk = _participant_mention(_find_configured_participant(participants, self.risk_id))
        line = await _agent_line(
            role="Traceability Agent",
            instruction="Report the shipment coverage gap and untraced units.",
            incident=self.incident,
        )
        await tools.send_message(
            content=(
                f"LIVE_TRACEABILITY_GAP mapped {self.incident.shipped_units:,} shipped units, "
                f"but {self.incident.untraced_units} units are still untraced. "
                "RECALLOPS_RISK Please review recall readiness."
                f"{line}"
            ),
            mentions=[commander, risk],
        )

    async def _send_resolution(self, tools: AgentToolsProtocol) -> None:
        participants = await tools.get_participants()
        commander = _participant_mention(
            _find_configured_participant(participants, self.commander_id)
        )
        risk = _participant_mention(_find_configured_participant(participants, self.risk_id))
        await tools.send_event(
            content=(
                f"Traceability recovered {self.incident.recovered_units} units and restored "
                f"{self.incident.final_coverage_percent}% coverage."
            ),
            message_type="task",
            metadata={
                "spike": "recallops",
                "stage": "traceability_resolved",
                "coverage_percent": self.incident.final_coverage_percent,
                "recovered_units": self.incident.recovered_units,
            },
        )
        line = await _agent_line(
            role="Traceability Agent",
            instruction="Confirm the recovered coverage after the re-plan.",
            incident=self.incident,
        )
        await tools.send_message(
            content=(
                f"LIVE_TRACEABILITY_RESOLVED recovered the missing source file; coverage is "
                f"{self.incident.final_coverage_percent}%. "
                "RECALLOPS_APPROVAL Please clear the regulated recall path."
                f"{line}"
            ),
            mentions=[commander, risk],
        )


class RiskSpikeAdapter(SimpleAdapter[HistoryProvider]):
    def __init__(
        self,
        *,
        commander_id: str,
        traceability_id: str,
        communications_id: str,
        incident: SpikeIncident,
    ) -> None:
        super().__init__()
        self.commander_id = commander_id
        self.traceability_id = traceability_id
        self.communications_id = communications_id
        self.incident = incident

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

        if "RECALLOPS_RISK" in msg.content:
            await self._send_veto(tools)
            return

        if "RECALLOPS_APPROVAL" in msg.content:
            await self._send_approval(tools)

    async def _send_veto(self, tools: AgentToolsProtocol) -> None:
        participants = await tools.get_participants()
        commander = _participant_mention(
            _find_configured_participant(participants, self.commander_id)
        )
        traceability = _participant_mention(
            _find_configured_participant(participants, self.traceability_id)
        )
        await tools.send_event(
            content=(
                f"Risk raised a human-review hold while {self.incident.untraced_units} "
                "units remained untraced."
            ),
            message_type="task",
            metadata={
                "spike": "recallops",
                "stage": "regulatory_veto",
                "veto": True,
                "untraced_units": self.incident.untraced_units,
            },
        )
        line = await _agent_line(
            role="Regulatory/Risk Officer",
            instruction="Explain why a human-review hold is required while units are untraced.",
            incident=self.incident,
        )
        await tools.send_message(
            content=(
                f"LIVE_RISK_VETO customer notice is blocked while "
                f"{self.incident.untraced_units} units remain untraced. "
                "RECALLOPS_REPLAN Traceability must close the distributor gap."
                f"{line}"
            ),
            mentions=[commander, traceability],
        )

    async def _send_approval(self, tools: AgentToolsProtocol) -> None:
        await tools.add_participant(self.communications_id)
        participants = await tools.get_participants()
        commander = _participant_mention(
            _find_configured_participant(participants, self.commander_id)
        )
        communications = _participant_mention(
            _find_configured_participant(participants, self.communications_id)
        )
        await tools.send_event(
            content="Risk approved immediate recall, stock quarantine, and customer notification.",
            message_type="task",
            metadata={"spike": "recallops", "stage": "risk_approved", "approved": True},
        )
        line = await _agent_line(
            role="Regulatory/Risk Officer",
            instruction="State the approval rationale now that coverage is complete.",
            incident=self.incident,
        )
        await tools.send_message(
            content=(
                f"LIVE_RISK_APPROVED {self.incident.lot} coverage is complete; "
                "RECALLOPS_COMMS draft regulator, customer, and warehouse notices."
                f"{line}"
            ),
            mentions=[commander, communications],
        )


class CommunicationsSpikeAdapter(SimpleAdapter[HistoryProvider]):
    def __init__(self, *, commander_id: str, incident: SpikeIncident) -> None:
        super().__init__()
        self.commander_id = commander_id
        self.incident = incident

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

        if "RECALLOPS_COMMS" not in msg.content:
            return

        participants = await tools.get_participants()
        commander = _participant_mention(
            _find_configured_participant(participants, self.commander_id)
        )
        await tools.send_event(
            content="Communications drafted regulator, customer, and warehouse notices.",
            message_type="task",
            metadata={"spike": "recallops", "stage": "notice_drafted", "notices": 3},
        )
        line = await _agent_line(
            role="Communications Agent",
            instruction="Summarize the notices prepared for regulator, customers, and warehouse.",
            incident=self.incident,
        )
        await tools.send_message(
            content=(
                "SPIKE_DONE LIVE_COMMS_NOTICE drafted regulator notice, customer stop-use notice, "
                f"and warehouse quarantine order for {self.incident.lot}."
                f"{line}"
            ),
            mentions=[commander],
        )


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
        agents = {key: _load_agent(raw, key) for key in AGENT_KEYS}
    except KeyError as exc:
        raise ConfigError(f"Missing {exc.args[0]!r} in {path}.") from exc

    return SpikeConfig(
        commander=agents["commander"],
        evidence=agents["evidence"],
        traceability=agents["traceability"],
        risk=agents["risk"],
        communications=agents["communications"],
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


async def run_spike(
    config: SpikeConfig,
    timeout_seconds: float,
    incident: SpikeIncident | dict[str, object] | None = None,
) -> dict[str, Any]:
    active_incident = _coerce_incident(incident)
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if anthropic_key:
        communications_adapter: SimpleAdapter[Any] = AnthropicAdapter(
            model=COMMS_MODEL,
            provider_key=anthropic_key,
            system_prompt=_communications_system_prompt(active_incident),
            max_tokens=1024,
        )
        communications_framework = "anthropic_adapter"
    else:
        communications_adapter = CommunicationsSpikeAdapter(
            commander_id=config.commander.agent_id,
            incident=active_incident,
        )
        communications_framework = "simple_adapter"
    agents = [
        Agent.create(
            adapter=EvidenceSpikeAdapter(
                commander_id=config.commander.agent_id,
                traceability_id=config.traceability.agent_id,
                incident=active_incident,
            ),
            agent_id=config.evidence.agent_id,
            api_key=config.evidence.api_key,
            ws_url=config.ws_url,
            rest_url=config.rest_url,
        ),
        Agent.create(
            adapter=TraceabilitySpikeAdapter(
                commander_id=config.commander.agent_id,
                risk_id=config.risk.agent_id,
                incident=active_incident,
            ),
            agent_id=config.traceability.agent_id,
            api_key=config.traceability.api_key,
            ws_url=config.ws_url,
            rest_url=config.rest_url,
        ),
        Agent.create(
            adapter=RiskSpikeAdapter(
                commander_id=config.commander.agent_id,
                traceability_id=config.traceability.agent_id,
                communications_id=config.communications.agent_id,
                incident=active_incident,
            ),
            agent_id=config.risk.agent_id,
            api_key=config.risk.api_key,
            ws_url=config.ws_url,
            rest_url=config.rest_url,
        ),
        Agent.create(
            adapter=communications_adapter,
            agent_id=config.communications.agent_id,
            api_key=config.communications.api_key,
            ws_url=config.ws_url,
            rest_url=config.rest_url,
        ),
    ]

    for agent in agents:
        await agent.start()

    try:
        commander_rest = AsyncRestClient(
            api_key=config.commander.api_key,
            base_url=config.rest_url,
        )
        bootstrap_tools = AgentTools(room_id="", rest=commander_rest)
        room_id = await bootstrap_tools.create_chatroom()
        tools = AgentTools(room_id=room_id, rest=commander_rest)

        await tools.add_participant(config.evidence.agent_id)
        participants = await tools.get_participants()
        evidence_participant = _find_configured_participant(participants, config.evidence.agent_id)
        evidence_mention = _participant_mention(evidence_participant)

        commander_event = await tools.send_event(
            content="Commander created the RecallOps live workflow room and recruited Evidence.",
            message_type="task",
            metadata={"spike": "recallops", "stage": "commander_recruited_evidence"},
        )
        commander_message = await tools.send_message(
            content=(
                f"RECALLOPS_EVIDENCE Start the {active_incident.lot} live Band workflow. "
                "Extract incident facts and recruit Traceability if severity requires it."
            ),
            mentions=[evidence_mention],
        )

        # Terminal signal is the Communications agent's chat message, detected by
        # sender_id rather than a literal text marker. This keeps termination
        # robust whether Communications is the scripted SimpleAdapter (emits
        # "SPIKE_DONE LIVE_COMMS_NOTICE ...") or the LLM-driven AnthropicAdapter
        # (authors free-form notice text).
        done = await _poll_for_sender_message(
            tools,
            room_id=room_id,
            sender_id=config.communications.agent_id,
            timeout_seconds=timeout_seconds,
        )
        context = await tools.fetch_room_context(room_id=room_id, page=1, page_size=100)
        participants = await tools.get_participants()
        context_items = context["data"]
        band_tool_coverage = await _exercise_band_tools(
            tools,
            config=config,
            audit_incident=active_incident,
        )
        return {
            "ok": True,
            "proof_mode": "live_band_five_agent_workflow",
            "room_id": room_id,
            "participant_count": len(participants),
            "context_items": len(context_items),
            "commander_event_id": getattr(commander_event, "id", None),
            "commander_message_id": getattr(commander_message, "id", None),
            "evidence_ack_id": _find_context_id(context_items, "LIVE_EVIDENCE_ACK"),
            "traceability_gap_id": _find_context_id(context_items, "LIVE_TRACEABILITY_GAP"),
            "risk_veto_id": _find_context_id(context_items, "LIVE_RISK_VETO"),
            "traceability_resolved_id": _find_context_id(
                context_items, "LIVE_TRACEABILITY_RESOLVED"
            ),
            "risk_approved_id": _find_context_id(context_items, "LIVE_RISK_APPROVED"),
            "communications_notice_id": done.get("id"),
            "communications_framework": communications_framework,
            "band_tool_coverage": band_tool_coverage,
        }
    finally:
        for agent in reversed(agents):
            await agent.stop(timeout=2.0)


def _find_configured_participant(participants: Any, agent_id: str) -> Any:
    for participant in participants:
        if getattr(participant, "id", None) == agent_id:
            return participant
    raise RuntimeError(f"Configured agent {agent_id} was not found in room participants.")


async def _poll_for_sender_message(
    tools: AgentTools,
    *,
    room_id: str,
    sender_id: str,
    timeout_seconds: float,
) -> dict[str, Any]:
    """Wait for a chat message authored by ``sender_id``.

    Used to detect the terminal Communications notice without depending on a
    literal text marker, so the LLM-driven AnthropicAdapter and the scripted
    fallback both terminate the run the same way.
    """
    deadline = asyncio.get_running_loop().time() + timeout_seconds
    while asyncio.get_running_loop().time() < deadline:
        context = await tools.fetch_room_context(room_id=room_id, page=1, page_size=100)
        for item in context["data"]:
            if item.get("sender_id") == sender_id and str(item.get("message_type")) == "text":
                return item
        await asyncio.sleep(2)

    raise TimeoutError("Band workflow did not produce a Communications message before timeout.")


async def _exercise_band_tools(
    tools: AgentTools,
    *,
    config: SpikeConfig,
    audit_incident: SpikeIncident,
) -> dict[str, Any]:
    """Exercise the remaining Band agent tools and record what actually ran.

    Every call is best-effort: a failure (e.g. Memories are enterprise-gated and
    may return 403) is captured as ``{"ok": False, ...}`` and never breaks the
    core workflow proof. The result is surfaced in the run output so the proof
    can show concrete Band tool coverage rather than claiming it.
    """
    coverage: dict[str, Any] = {}

    # Peer discovery — find agents on the platform (recruitment is by discovery,
    # not a hardcoded roster).
    try:
        peers = await tools.lookup_peers(page=1, page_size=50)
        coverage["lookup_peers"] = {"ok": True, "count": len(getattr(peers, "data", []) or [])}
    except Exception as exc:  # noqa: BLE001 - record any platform error verbatim
        coverage["lookup_peers"] = {"ok": False, "error": str(exc)}

    # Contacts — read existing contacts, then send a contact request to a peer.
    try:
        contacts = await tools.list_contacts(page=1, page_size=50)
        coverage["list_contacts"] = {
            "ok": True,
            "count": len(getattr(contacts, "data", []) or []),
        }
    except Exception as exc:  # noqa: BLE001
        coverage["list_contacts"] = {"ok": False, "error": str(exc)}

    try:
        evidence_handle = _participant_mention(
            _find_configured_participant(await tools.get_participants(), config.evidence.agent_id)
        )
        contact = await tools.add_contact(
            handle=evidence_handle,
            message="RecallOps cross-agent recall coordination.",
        )
        coverage["add_contact"] = {
            "ok": True,
            "status": getattr(contact, "status", None),
            "handle": evidence_handle,
        }
    except Exception as exc:  # noqa: BLE001
        coverage["add_contact"] = {"ok": False, "error": str(exc)}

    # Memory — persist the audit fingerprint in Band Memories (enterprise-gated;
    # deterministic SHA-256 hashing remains the source of truth on failure).
    try:
        memory = await tools.store_memory(
            content=(
                f"RecallOps recall closed for {audit_incident.product} lot "
                f"{audit_incident.lot}: {audit_incident.final_coverage_percent}% shipment "
                "coverage, human approval gate prepared."
            ),
            system="long_term",
            type="semantic",
            segment="agent",
            thought="Persist the recall outcome for future shipment-trace correlation.",
            scope="organization",
            metadata={"spike": "recallops", "lot": audit_incident.lot},
        )
        memory_id = getattr(memory, "id", None)
        coverage["store_memory"] = {"ok": True, "memory_id": memory_id}
        if memory_id:
            await tools.get_memory(str(memory_id))
            coverage["get_memory"] = {"ok": True, "memory_id": memory_id}
    except Exception as exc:  # noqa: BLE001
        coverage["store_memory"] = {"ok": False, "error": str(exc)}

    # Participant lifecycle — release a specialist now the workflow has closed.
    try:
        removed = await tools.remove_participant(config.evidence.agent_id)
        coverage["remove_participant"] = {"ok": True, "status": removed.get("status")}
    except Exception as exc:  # noqa: BLE001
        coverage["remove_participant"] = {"ok": False, "error": str(exc)}

    return coverage


def _find_context_id(context_items: list[dict[str, Any]], marker: str) -> str | None:
    for item in context_items:
        content = str(item.get("content") or "")
        if marker in content:
            return str(item.get("id") or "")
    return None


def _coerce_incident(incident: SpikeIncident | dict[str, object] | None) -> SpikeIncident:
    if isinstance(incident, SpikeIncident):
        return incident
    if incident is None:
        return SpikeIncident(
            product="Northstar Home Battery Pack",
            lot="BAT-4421",
            defect="overheating during overnight charge",
            severity="critical",
            complaint_count=3,
            shipped_units=4_800,
            initial_coverage_percent=82,
            untraced_units=864,
            recovered_units=864,
            final_coverage_percent=100,
        )
    return SpikeIncident(
        product=str(incident["product"]),
        lot=str(incident["lot"]),
        defect=str(incident["defect"]),
        severity=str(incident["severity"]),
        complaint_count=int(incident["complaint_count"]),
        shipped_units=int(incident["shipped_units"]),
        initial_coverage_percent=int(incident["initial_coverage_percent"]),
        untraced_units=int(incident["untraced_units"]),
        recovered_units=int(incident["recovered_units"]),
        final_coverage_percent=int(incident["final_coverage_percent"]),
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the RecallOps Band live workflow.")
    parser.add_argument("--config", default="agent_config.yaml")
    parser.add_argument("--rest-url", default=DEFAULT_REST_URL)
    parser.add_argument("--ws-url", default=DEFAULT_WS_URL)
    parser.add_argument("--timeout", type=float, default=90.0)
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
        print(
            json.dumps(
                {"ok": True, "checked": str(Path(args.config)), "agents": list(AGENT_KEYS)},
                indent=2,
            )
        )
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
