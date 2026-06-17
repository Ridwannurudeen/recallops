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

ReceiptStatus = Literal["recorded", "blocked", "cleared", "sealed"]


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
class DecisionReceipt:
    id: str
    event_id: str
    agent: str
    check: str
    status: ReceiptStatus
    band_reference: str
    previous_hash: str
    receipt_hash: str


@dataclass(frozen=True)
class DecisionGraphNode:
    id: str
    label: str
    owner: str
    state: str


@dataclass(frozen=True)
class DecisionGraphEdge:
    source: str
    target: str
    label: str
    band_message_id: str


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
    receipts: tuple[DecisionReceipt, ...]
    decision_graph: dict[str, tuple[DecisionGraphNode, ...] | tuple[DecisionGraphEdge, ...]]
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
        framework="Pydantic AI adapter target",
        role="extracts defect, product, lot, and severity",
    ),
    AgentIdentity(
        id="agent-trace-01",
        name="Traceability Agent",
        handle="@recallops/traceability",
        framework="LangGraph adapter target",
        role="maps lots to shipments, regions, customers, and stock",
    ),
    AgentIdentity(
        id="agent-risk-01",
        name="Regulatory/Risk Officer",
        handle="@recallops/risk",
        framework="CrewAI adapter target",
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
    receipts = _decision_receipts(events, band_proof)
    decision_graph = _decision_graph(events, band_proof)
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
        "receipts": receipts,
        "decision_graph": decision_graph,
    }
    audit_hash = _audit_hash(_serialize_packet_fields(packet_fields))
    return RecallPacket(audit_hash=audit_hash, **packet_fields)


def verify_packet_digest(packet: RecallPacket) -> dict[str, str | bool]:
    payload = packet.to_dict()
    expected_hash = str(payload.pop("audit_hash"))
    actual_hash = _audit_hash(_serialize_packet_fields(payload))
    return {
        "ok": actual_hash == expected_hash,
        "algorithm": "sha256",
        "expected_hash": expected_hash,
        "actual_hash": actual_hash,
    }


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
    approval_message_id = next(
        (event.id for event in events if event.stage == "human_approved"),
        "none",
    )
    return {
        "proof_mode": "live_band_five_agent_workflow",
        "room_id": "band-room-recallops-bat-4421",
        "participant_count": len(AGENTS),
        "event_count": len(events),
        "message_ids": [event.id for event in events],
        "veto_message_id": next(event.id for event in events if event.stage == "regulatory_veto"),
        "approval_message_id": approval_message_id,
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


def _decision_receipts(
    events: tuple[RecallEvent, ...],
    band_proof: dict[str, int | str | list[str]],
) -> tuple[DecisionReceipt, ...]:
    live_refs = {
        "msg-001": str(band_proof["live_workflow_commander_message_id"]),
        "msg-002": str(band_proof["live_workflow_evidence_ack_id"]),
        "msg-004": str(band_proof["live_workflow_traceability_gap_id"]),
        "msg-006": str(band_proof["live_workflow_risk_veto_id"]),
        "msg-007": str(band_proof["live_workflow_traceability_resolved_id"]),
        "msg-008": str(band_proof["live_workflow_risk_approved_id"]),
        "msg-009": str(band_proof["live_workflow_communications_notice_id"]),
    }
    previous_hash = "0" * 64
    receipts: list[DecisionReceipt] = []
    for index, event in enumerate(events, start=1):
        receipt_payload = {
            "event_id": event.id,
            "stage": event.stage,
            "agent": event.agent,
            "mentions": event.mentions,
            "metadata": event.metadata,
            "previous_hash": previous_hash,
        }
        receipt_hash = _audit_hash(_serialize_packet_fields(receipt_payload))
        receipt = DecisionReceipt(
            id=f"receipt-{index:03d}",
            event_id=event.id,
            agent=event.agent,
            check=_receipt_check(event.stage),
            status=_receipt_status(event.stage),
            band_reference=live_refs.get(event.id, event.id),
            previous_hash=previous_hash,
            receipt_hash=receipt_hash,
        )
        receipts.append(receipt)
        previous_hash = receipt_hash
    return tuple(receipts)


def _receipt_check(stage: Stage) -> str:
    checks = {
        "room_created": "room-opened",
        "evidence_extracted": "incident-facts-extracted",
        "agent_recruited": "specialist-recruited",
        "traceability_gap": "coverage-below-approval-threshold",
        "regulatory_veto": "approval-blocked-by-risk",
        "traceability_resolved": "coverage-restored-to-100",
        "risk_approved": "risk-cleared-after-replan",
        "notice_drafted": "notices-ready-after-approval",
        "human_approved": "human-gate-sealed",
    }
    return checks[stage]


def _receipt_status(stage: Stage) -> ReceiptStatus:
    if stage == "regulatory_veto":
        return "blocked"
    if stage in {"traceability_resolved", "risk_approved", "notice_drafted"}:
        return "cleared"
    if stage == "human_approved":
        return "sealed"
    return "recorded"


def _decision_graph(
    events: tuple[RecallEvent, ...],
    band_proof: dict[str, int | str | list[str]],
) -> dict[str, tuple[DecisionGraphNode, ...] | tuple[DecisionGraphEdge, ...]]:
    event_ids = {event.stage: event.id for event in events}
    recruitment_ids = [event.id for event in events if event.stage == "agent_recruited"]
    nodes = (
        DecisionGraphNode("incident", "BAT-4421 incident", "Incident Commander", "open"),
        DecisionGraphNode("evidence", "critical defect extracted", "Evidence Agent", "recorded"),
        DecisionGraphNode("trace-gap", "82% lot coverage", "Traceability Agent", "incomplete"),
        DecisionGraphNode(
            "risk-veto", "customer notice veto", "Regulatory/Risk Officer", "blocked"
        ),
        DecisionGraphNode("trace-resolved", "100% lot coverage", "Traceability Agent", "cleared"),
        DecisionGraphNode(
            "risk-approved", "voluntary recall approved", "Regulatory/Risk Officer", "cleared"
        ),
        DecisionGraphNode("notices", "regulator/customer notices", "Communications Agent", "ready"),
        DecisionGraphNode("human-gate", "QA director approval", "QA Director", "sealed"),
    )
    edges = [
        DecisionGraphEdge("incident", "evidence", "@mention intake", event_ids["room_created"]),
        DecisionGraphEdge("evidence", "trace-gap", "dynamic recruitment", recruitment_ids[0]),
        DecisionGraphEdge(
            "trace-gap",
            "risk-veto",
            "risk review",
            str(band_proof["live_workflow_traceability_gap_id"]),
        ),
        DecisionGraphEdge(
            "risk-veto",
            "trace-resolved",
            "veto forces re-plan",
            str(band_proof["live_workflow_risk_veto_id"]),
        ),
    ]
    if "traceability_resolved" in event_ids:
        edges.append(
            DecisionGraphEdge(
                "trace-resolved",
                "risk-approved",
                "coverage recovered",
                event_ids["traceability_resolved"],
            )
        )
    if "risk_approved" in event_ids:
        edges.append(
            DecisionGraphEdge(
                "risk-approved",
                "notices",
                "@mention communications",
                event_ids["risk_approved"],
            )
        )
    if "notice_drafted" in event_ids:
        edges.append(
            DecisionGraphEdge(
                "notices",
                "human-gate",
                "human approval gate",
                event_ids["notice_drafted"],
            )
        )
    return {"nodes": nodes, "edges": tuple(edges)}


def _audit_hash(payload: dict[str, object]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _serialize_packet_fields(payload: dict[str, object]) -> dict[str, object]:
    return {key: _to_plain(value) for key, value in payload.items()}


def _to_plain(value: object) -> object:
    if hasattr(value, "__dataclass_fields__"):
        return asdict(value)
    if isinstance(value, tuple):
        return [_to_plain(item) for item in value]
    if isinstance(value, dict):
        return {key: _to_plain(item) for key, item in value.items()}
    return value
