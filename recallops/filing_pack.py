from __future__ import annotations

import hashlib
import json
from dataclasses import asdict

from recallops.notifications import DispatchReceipt
from recallops.source_evidence import SourceEvidencePacket


def build_filing_pack(
    *,
    source_packet: SourceEvidencePacket,
    rule_assessment: dict[str, object],
    dispatch_receipts: tuple[DispatchReceipt, ...],
) -> dict[str, object]:
    facts = {fact.key: fact.value for fact in source_packet.facts}
    pack_payload = {
        "proof_kind": "multi_jurisdiction_recall_filing_pack",
        "mode": "draft_human_review_required",
        "disclosure": (
            "Filing pack drafts are decision-support artifacts. They are not legal advice "
            "and are not submitted to regulators without named human review."
        ),
        "incident_id": source_packet.incident_id,
        "source_audit_hash": source_packet.audit_hash,
        "generated_at": source_packet.generated_at,
        "approval_ready": rule_assessment["approval_ready"],
        "source_summary": {
            "product": facts["product"],
            "lot": facts["lot"],
            "defect": facts["defect"],
            "severity": facts["severity"],
            "complaint_count": facts["complaints"],
            "initial_traceability": asdict(source_packet.initial_traceability),
            "final_traceability": asdict(source_packet.final_traceability),
            "missing_sources": list(source_packet.missing_sources),
        },
        "filings": _filings(source_packet, rule_assessment),
        "notices": _notices(source_packet, dispatch_receipts),
        "source_citations": [asdict(citation) for citation in source_packet.citations[:8]],
    }
    pack_hash = _hash_payload(pack_payload)
    pack = {**pack_payload, "pack_hash": pack_hash}
    return {**pack, "verification": verify_filing_pack(pack)}


def verify_filing_pack(pack: dict[str, object]) -> dict[str, str | bool]:
    payload = dict(pack)
    expected_hash = str(payload.pop("pack_hash"))
    payload.pop("verification", None)
    actual_hash = _hash_payload(payload)
    return {
        "ok": actual_hash == expected_hash,
        "algorithm": "sha256",
        "expected_hash": expected_hash,
        "actual_hash": actual_hash,
    }


def _filings(
    source_packet: SourceEvidencePacket,
    rule_assessment: dict[str, object],
) -> list[dict[str, object]]:
    applied_rules = [
        rule
        for rule in rule_assessment["applied_rules"]
        if isinstance(rule, dict) and rule.get("triggered") is True
    ]
    ready_status = (
        "draft_ready_for_human_review"
        if rule_assessment["approval_ready"] is True
        else "blocked_until_traceability_clears"
    )
    filings = [
        {
            "id": "cpsc-15b-draft",
            "authority": "US Consumer Product Safety Commission",
            "label": "CPSC 15(b)-style substantial product hazard notice",
            "status": ready_status,
            "deadline_hours": _deadline(applied_rules, "US-CPSC-24H"),
            "matched_regions": _regions(applied_rules, "US-CPSC-24H"),
            "required_human_action": "Quality/legal owner reviews and signs before submission.",
            "source_fields": _source_fields(source_packet),
        },
        {
            "id": "eu-safety-gate-draft",
            "authority": "EU Safety Gate / national market surveillance authority",
            "label": "EU Safety Gate-style rapid alert draft",
            "status": ready_status,
            "deadline_hours": _deadline(applied_rules, "EU-SAFETY-GATE-48H"),
            "matched_regions": _regions(applied_rules, "EU-SAFETY-GATE-48H"),
            "required_human_action": "EU responsible person validates scope and notice language.",
            "source_fields": _source_fields(source_packet),
        },
        {
            "id": "regional-distributor-hold",
            "authority": "Distributor and warehouse recall desks",
            "label": "Regional stop-ship and quarantine instruction",
            "status": ready_status,
            "deadline_hours": _minimum_deadline(applied_rules, default=72),
            "matched_regions": sorted(
                {
                    region
                    for rule in applied_rules
                    for region in rule.get("matched_regions", [])
                    if isinstance(region, str)
                }
            ),
            "required_human_action": "Operations lead confirms stock hold before ERP live write.",
            "source_fields": _source_fields(source_packet),
        },
        {
            "id": "fda-rfr-screen",
            "authority": "FDA Reportable Food Registry applicability screen",
            "label": "FDA RFR screen",
            "status": "not_applicable_for_current_consumer_battery_case",
            "deadline_hours": None,
            "matched_regions": [],
            "required_human_action": "Legal confirms product category before excluding FDA routes.",
            "source_fields": {"product": _fact(source_packet, "product")},
        },
        {
            "id": "nhtsa-vin-screen",
            "authority": "NHTSA safety recall applicability screen",
            "label": "NHTSA vehicle/equipment screen",
            "status": "not_applicable_unless_product_maps_to_vehicle_equipment",
            "deadline_hours": None,
            "matched_regions": [],
            "required_human_action": "Legal confirms whether the product is motor-vehicle equipment.",
            "source_fields": {"product": _fact(source_packet, "product")},
        },
    ]
    return filings


def _notices(
    source_packet: SourceEvidencePacket,
    dispatch_receipts: tuple[DispatchReceipt, ...],
) -> list[dict[str, object]]:
    facts = {fact.key: fact.value for fact in source_packet.facts}
    return [
        {
            "id": receipt.id,
            "recipient": receipt.recipient,
            "status": receipt.status,
            "payload_hash": receipt.payload_hash,
            "draft": (
                f"Recall notice for {facts['product']} lot {facts['lot']}: "
                f"{facts['defect']}. Stop-use and quarantine pending replacement."
            ),
            "disclosure": receipt.disclosure,
        }
        for receipt in dispatch_receipts
    ]


def _source_fields(source_packet: SourceEvidencePacket) -> dict[str, object]:
    return {
        "product": _fact(source_packet, "product"),
        "lot": _fact(source_packet, "lot"),
        "defect": _fact(source_packet, "defect"),
        "severity": _fact(source_packet, "severity"),
        "complaint_count": _fact(source_packet, "complaints"),
        "source_audit_hash": source_packet.audit_hash,
        "final_coverage_percent": source_packet.final_traceability.coverage_percent,
        "untraced_units": source_packet.final_traceability.untraced_units,
    }


def _deadline(rules: list[dict[str, object]], rule_id: str) -> int | None:
    rule = _rule(rules, rule_id)
    return int(rule["deadline_hours"]) if rule else None


def _regions(rules: list[dict[str, object]], rule_id: str) -> list[str]:
    rule = _rule(rules, rule_id)
    if not rule:
        return []
    return [str(region) for region in rule.get("matched_regions", []) if isinstance(region, str)]


def _minimum_deadline(rules: list[dict[str, object]], *, default: int) -> int:
    deadlines = [int(rule["deadline_hours"]) for rule in rules if "deadline_hours" in rule]
    return min(deadlines) if deadlines else default


def _rule(rules: list[dict[str, object]], rule_id: str) -> dict[str, object] | None:
    return next((rule for rule in rules if rule.get("id") == rule_id), None)


def _fact(source_packet: SourceEvidencePacket, key: str) -> str | int:
    return next(fact.value for fact in source_packet.facts if fact.key == key)


def _hash_payload(payload: object) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
