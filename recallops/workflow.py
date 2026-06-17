from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Literal


Stage = Literal[
    "room_created",
    "evidence_extracted",
    "agent_recruited",
    "traceability_gap",
    "regulatory_veto",
    "traceability_resolved",
    "risk_approved",
    "notice_drafted",
    "human_approved",
]


@dataclass(frozen=True)
class AgentIdentity:
    id: str
    name: str
    handle: str
    framework: str
    role: str


@dataclass(frozen=True)
class RecallEvent:
    id: str
    at: str
    stage: Stage
    agent: str
    message: str
    mentions: tuple[str, ...]
    metadata: dict[str, int | str | bool]


@dataclass(frozen=True)
class Shipment:
    distributor: str
    region: str
    customers: int
    units: int
    traced: bool


@dataclass(frozen=True)
class TraceabilitySnapshot:
    total_units: int
    open_stock_units: int
    shipped_units: int
    traced_units: int
    untraced_units: int
    coverage_percent: int
    regions: int
    affected_customers: int


@dataclass(frozen=True)
class RecallPacket:
    room_id: str
    incident_id: str
    product: str
    lot: str
    defect: str
    severity: str
    exposure_clock: dict[str, int | str]
    agents: tuple[AgentIdentity, ...]
    shipments: tuple[Shipment, ...]
    initial_traceability: TraceabilitySnapshot
    final_traceability: TraceabilitySnapshot
    events: tuple[RecallEvent, ...]
    decision: dict[str, str | bool]
    notices: dict[str, str]
    band_proof: dict[str, int | str | list[str]]
    audit_hash: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


AGENTS: tuple[AgentIdentity, ...] = (
    AgentIdentity(
        id="agent-commander-01",
        name="Incident Commander",
        handle="@recallops/commander",
        framework="Band SDK",
        role="opens room, routes work, owns recall state",
    ),
    AgentIdentity(
        id="agent-evidence-01",
        name="Evidence Agent",
        handle="@recallops/evidence",
        framework="Pydantic AI",
        role="extracts defect, product, lot, and severity",
    ),
    AgentIdentity(
        id="agent-trace-01",
        name="Traceability Agent",
        handle="@recallops/traceability",
        framework="LangGraph",
        role="maps lots to shipments, regions, customers, and stock",
    ),
    AgentIdentity(
        id="agent-risk-01",
        name="Regulatory/Risk Officer",
        handle="@recallops/risk",
        framework="CrewAI",
        role="vetoes unsafe decisions and approves recall path",
    ),
    AgentIdentity(
        id="agent-comms-01",
        name="Communications Agent",
        handle="@recallops/comms",
        framework="Band SDK",
        role="drafts regulator, customer, and quarantine notices",
    ),
    AgentIdentity(
        id="human-qa-01",
        name="QA Director",
        handle="@qa-director",
        framework="Human",
        role="final approval gate",
    ),
)


def build_recall_packet(*, resolve_gap: bool = True, human_approved: bool = True) -> RecallPacket:
    shipments = _shipments(resolve_gap=resolve_gap)
    initial = _traceability_snapshot(_shipments(resolve_gap=False))
    final = _traceability_snapshot(shipments)
    events = _events(resolve_gap=resolve_gap, human_approved=human_approved)
    decision = _decision(final, human_approved=human_approved)
    notices = _notices(decision)
    band_proof = _band_proof(events)
    packet_fields = {
        "room_id": "band-room-recallops-bat-4421",
        "incident_id": "INC-2026-06-16-BAT-4421",
        "product": "Northstar Home Battery Pack",
        "lot": "BAT-4421",
        "defect": "customer-reported overheating during overnight charge",
        "severity": "critical",
        "exposure_clock": _exposure_clock(final),
        "agents": AGENTS,
        "shipments": shipments,
        "initial_traceability": initial,
        "final_traceability": final,
        "events": events,
        "decision": decision,
        "notices": notices,
        "band_proof": band_proof,
    }
    audit_hash = _audit_hash(_serialize_packet_fields(packet_fields))
    return RecallPacket(audit_hash=audit_hash, **packet_fields)


def _shipments(*, resolve_gap: bool) -> tuple[Shipment, ...]:
    return (
        Shipment("Direct Warehouse", "US-West", 410, 760, True),
        Shipment("Direct Warehouse", "US-East", 390, 720, True),
        Shipment("RetailNet", "EU-Central", 460, 840, True),
        Shipment("RetailNet", "EU-North", 415, 790, True),
        Shipment("Medina Distribution", "MEA", 455, 826, True),
        Shipment("Kestrel Distributor", "LATAM", 480, 864, resolve_gap),
    )


def _traceability_snapshot(shipments: tuple[Shipment, ...]) -> TraceabilitySnapshot:
    shipped_units = sum(shipment.units for shipment in shipments)
    traced_units = sum(shipment.units for shipment in shipments if shipment.traced)
    total_units = shipped_units + 1_100
    untraced_units = shipped_units - traced_units
    return TraceabilitySnapshot(
        total_units=total_units,
        open_stock_units=1_100,
        shipped_units=shipped_units,
        traced_units=traced_units,
        untraced_units=untraced_units,
        coverage_percent=round((traced_units / shipped_units) * 100),
        regions=len({shipment.region for shipment in shipments}),
        affected_customers=sum(shipment.customers for shipment in shipments if shipment.traced),
    )


def _events(*, resolve_gap: bool, human_approved: bool) -> tuple[RecallEvent, ...]:
    base = datetime(2026, 6, 16, 21, 20, tzinfo=UTC)

    def event(
        index: int,
        stage: Stage,
        agent: str,
        message: str,
        mentions: tuple[str, ...],
        metadata: dict[str, int | str | bool] | None = None,
    ) -> RecallEvent:
        return RecallEvent(
            id=f"msg-{index:03d}",
            at=base.replace(minute=base.minute + index).isoformat(),
            stage=stage,
            agent=agent,
            message=message,
            mentions=mentions,
            metadata=metadata or {},
        )

    events: list[RecallEvent] = [
        event(
            1,
            "room_created",
            "Incident Commander",
            "Opened Band room for BAT-4421 overheating reports.",
            ("@recallops/evidence",),
            {"room_id": "band-room-recallops-bat-4421"},
        ),
        event(
            2,
            "evidence_extracted",
            "Evidence Agent",
            "Extracted product, defect, lot BAT-4421, and critical severity from 3 complaints.",
            ("@recallops/commander",),
            {"complaints": 3, "lot": "BAT-4421"},
        ),
        event(
            3,
            "agent_recruited",
            "Incident Commander",
            "Severity and multi-region exposure crossed threshold; recruited Traceability Agent.",
            ("@recallops/traceability",),
            {"recruited": "traceability"},
        ),
        event(
            4,
            "traceability_gap",
            "Traceability Agent",
            "Mapped 4,800 shipped units, but only 82% of shipment records are traced.",
            ("@recallops/commander", "@recallops/risk"),
            {"shipped_units": 4_800, "coverage_percent": 82, "untraced_units": 864},
        ),
        event(
            5,
            "agent_recruited",
            "Incident Commander",
            "Recruited Regulatory/Risk Officer for recall decision.",
            ("@recallops/risk",),
            {"recruited": "risk"},
        ),
        event(
            6,
            "regulatory_veto",
            "Regulatory/Risk Officer",
            "VETO: customer notice cannot be approved while 864 units remain untraced.",
            ("@recallops/traceability", "@recallops/commander"),
            {"veto": True, "untraced_units": 864},
        ),
    ]
    if resolve_gap:
        events.extend(
            [
                event(
                    7,
                    "traceability_resolved",
                    "Traceability Agent",
                    "Recovered missing Kestrel Distributor file; traceability coverage is now 100%.",
                    ("@recallops/risk", "@recallops/commander"),
                    {"coverage_percent": 100, "recovered_units": 864},
                ),
                event(
                    8,
                    "risk_approved",
                    "Regulatory/Risk Officer",
                    "Approved immediate voluntary recall, stock quarantine, and customer notification.",
                    ("@recallops/comms", "@qa-director"),
                    {"approved": True},
                ),
                event(
                    9,
                    "notice_drafted",
                    "Communications Agent",
                    "Drafted regulator notice, customer notice, and warehouse quarantine order.",
                    ("@qa-director",),
                    {"notices": 3},
                ),
            ]
        )
    if human_approved:
        events.append(
            event(
                10,
                "human_approved",
                "QA Director",
                "Approved recall packet and locked final action plan.",
                ("@recallops/commander",),
                {"human_approved": True},
            )
        )
    return tuple(events)


def _decision(snapshot: TraceabilitySnapshot, *, human_approved: bool) -> dict[str, str | bool]:
    approved = snapshot.coverage_percent == 100 and human_approved
    return {
        "status": "approved" if approved else "blocked",
        "action": "voluntary_recall" if approved else "continue_traceability_review",
        "risk_level": "critical",
        "human_approved": human_approved,
        "reason": (
            "Full lot traceability restored and QA Director approved."
            if approved
            else "Recall action blocked until traceability and human approval gates clear."
        ),
    }


def _notices(decision: dict[str, str | bool]) -> dict[str, str]:
    if decision["status"] != "approved":
        return {}
    return {
        "regulator": "Notify regional product-safety authority of BAT-4421 overheating risk.",
        "customer": "Stop using Northstar Home Battery Pack lot BAT-4421 pending replacement.",
        "warehouse": "Quarantine 1,100 units of lot BAT-4421 and freeze outbound movement.",
    }


def _exposure_clock(snapshot: TraceabilitySnapshot) -> dict[str, int | str]:
    units_in_market = snapshot.shipped_units
    hours_since_first_report = 31
    return {
        "label": "exposure-hours",
        "units_in_market": units_in_market,
        "hours_since_first_report": hours_since_first_report,
        "unit_hours": units_in_market * hours_since_first_report,
    }


def _band_proof(events: tuple[RecallEvent, ...]) -> dict[str, int | str | list[str]]:
    return {
        "proof_mode": "live_band_five_agent_workflow",
        "room_id": "band-room-recallops-bat-4421",
        "participant_count": len(AGENTS),
        "event_count": len(events),
        "message_ids": [event.id for event in events],
        "veto_message_id": next(event.id for event in events if event.stage == "regulatory_veto"),
        "approval_message_id": events[-1].id,
        "live_workflow_scope": (
            "room_create,evidence_extract,traceability_gap,risk_veto,"
            "replan,risk_approval,communications_notice"
        ),
        "live_workflow_room_id": "6dcd1018-bce3-481f-88d6-1ab67f6db452",
        "live_workflow_participant_count": 5,
        "live_workflow_context_items": 8,
        "live_workflow_message_ids": [
            "da91fc15-fd3f-4b5a-8af1-a0b2c005c5d5",
            "b33c7424-87e1-40db-9b15-558a64f608d7",
            "dad3fe04-0d06-4ac4-a427-8cab0aa85d82",
            "bed6e1f4-f1cd-48a4-8f36-c09d7d9c9de9",
            "2d7195c3-6874-4e99-bf67-73dc1724a257",
            "04b94bb6-d8eb-4816-9cc7-70b91093a145",
            "db2e10f0-f8f6-4fc4-a324-c99929911500",
        ],
        "live_workflow_commander_event_id": "e16220f4-c936-4f59-b7ad-d7468182efb3",
        "live_workflow_commander_message_id": "da91fc15-fd3f-4b5a-8af1-a0b2c005c5d5",
        "live_workflow_evidence_ack_id": "b33c7424-87e1-40db-9b15-558a64f608d7",
        "live_workflow_traceability_gap_id": "dad3fe04-0d06-4ac4-a427-8cab0aa85d82",
        "live_workflow_risk_veto_id": "bed6e1f4-f1cd-48a4-8f36-c09d7d9c9de9",
        "live_workflow_traceability_resolved_id": "2d7195c3-6874-4e99-bf67-73dc1724a257",
        "live_workflow_risk_approved_id": "04b94bb6-d8eb-4816-9cc7-70b91093a145",
        "live_workflow_communications_notice_id": "db2e10f0-f8f6-4fc4-a324-c99929911500",
    }


def _audit_hash(payload: dict[str, object]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _serialize_packet_fields(payload: dict[str, object]) -> dict[str, object]:
    serialized = {}
    for key, value in payload.items():
        if isinstance(value, tuple):
            serialized[key] = tuple(asdict(item) for item in value)
        elif hasattr(value, "__dataclass_fields__"):
            serialized[key] = asdict(value)
        else:
            serialized[key] = value
    return serialized
