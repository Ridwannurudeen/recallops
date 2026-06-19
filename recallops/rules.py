from __future__ import annotations

from dataclasses import asdict, dataclass

from recallops.source_evidence import SourceEvidencePacket


@dataclass(frozen=True)
class JurisdictionRule:
    id: str
    region_prefixes: tuple[str, ...]
    authority: str
    deadline_hours: int
    trigger: str


RULES: tuple[JurisdictionRule, ...] = (
    JurisdictionRule(
        id="US-CPSC-24H",
        region_prefixes=("US-",),
        authority="US Consumer Product Safety Commission",
        deadline_hours=24,
        trigger="critical consumer-product safety risk",
    ),
    JurisdictionRule(
        id="EU-SAFETY-GATE-48H",
        region_prefixes=("EU-",),
        authority="EU Safety Gate / national market surveillance authority",
        deadline_hours=48,
        trigger="serious multi-region consumer safety risk",
    ),
    JurisdictionRule(
        id="MEA-DISTRIBUTOR-HOLD-72H",
        region_prefixes=("MEA",),
        authority="Regional distributor and warehouse recall desk",
        deadline_hours=72,
        trigger="regional stock quarantine required",
    ),
    JurisdictionRule(
        id="LATAM-DISTRIBUTOR-72H",
        region_prefixes=("LATAM",),
        authority="LATAM distributor recall liaison",
        deadline_hours=72,
        trigger="previously missing distributor file recovered",
    ),
)


def assess_rules(packet: SourceEvidencePacket) -> dict[str, object]:
    severity = _fact(packet, "severity").lower()
    initial_blockers = []
    if packet.initial_traceability.untraced_units > 0:
        initial_blockers.append(
            {
                "id": "TRACEABILITY-BELOW-100",
                "reason": (
                    f"{packet.initial_traceability.untraced_units} shipped units were untraced "
                    "before the re-plan."
                ),
            }
        )
    final_blockers = []
    if packet.final_traceability.untraced_units > 0:
        final_blockers.append(
            {
                "id": "FINAL-TRACEABILITY-INCOMPLETE",
                "reason": (
                    f"Final recall approval requires 100% shipment traceability; "
                    f"{packet.final_traceability.untraced_units} units remain untraced."
                ),
            }
        )

    applied_rules = [
        _rule_decision(rule, packet)
        for rule in RULES
        if any(_matches_region(region, rule) for region in _regions(packet))
    ]
    deadlines = sorted(
        (rule for rule in applied_rules if rule["triggered"] is True),
        key=lambda rule: int(rule["deadline_hours"]),
    )
    return {
        "mode": "deterministic_jurisdiction_rules",
        "disclosure": "Rules are demo policy checks, not legal advice.",
        "severity": severity,
        "approval_ready": severity == "critical" and not final_blockers,
        "initial_blockers": initial_blockers,
        "final_blockers": final_blockers,
        "applied_rules": applied_rules,
        "next_deadline": deadlines[0] if deadlines else None,
    }


def _rule_decision(rule: JurisdictionRule, packet: SourceEvidencePacket) -> dict[str, object]:
    return {
        **asdict(rule),
        "matched_regions": [
            shipment.region
            for shipment in packet.final_shipments
            if _matches_region(shipment.region, rule)
        ],
        "triggered": _fact(packet, "severity").lower() == "critical",
    }


def _matches_region(region: str, rule: JurisdictionRule) -> bool:
    return any(region.startswith(prefix) for prefix in rule.region_prefixes)


def _regions(packet: SourceEvidencePacket) -> set[str]:
    return {shipment.region for shipment in packet.final_shipments}


def _fact(packet: SourceEvidencePacket, key: str) -> str:
    return str(next(fact.value for fact in packet.facts if fact.key == key))
