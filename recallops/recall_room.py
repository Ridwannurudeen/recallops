from __future__ import annotations

import hashlib
import json
from dataclasses import asdict

from recallops.live_proof import captured_band_proof
from recallops.source_evidence import SourceEvidencePacket


def build_source_room(
    source_packet: SourceEvidencePacket,
    rule_assessment: dict[str, object],
) -> dict[str, object]:
    facts = {fact.key: fact.value for fact in source_packet.facts}
    initial = source_packet.initial_traceability
    final = source_packet.final_traceability
    initial_blockers = rule_assessment["initial_blockers"]
    final_blockers = rule_assessment["final_blockers"]
    next_deadline = rule_assessment["next_deadline"]

    hold_message = (
        f"Regulatory/Risk raises a human-review hold: {initial_blockers[0]['reason']}"
        if isinstance(initial_blockers, list) and initial_blockers
        else "Regulatory/Risk finds no initial traceability hold."
    )
    deadline_message = (
        f"Rules desk prepares {next_deadline['authority']} filing within "
        f"{next_deadline['deadline_hours']}h for "
        f"{', '.join(next_deadline['matched_regions'])}."
        if isinstance(next_deadline, dict)
        else "Rules desk finds no triggered jurisdiction deadline."
    )
    approval_message = (
        f"QA can approve after reviewing source hash {source_packet.audit_hash[:12]} and "
        "the generated enterprise hold payload."
        if rule_assessment["approval_ready"] is True
        else "QA approval waits on final blockers: "
        + "; ".join(
            str(blocker["reason"])
            for blocker in final_blockers
            if isinstance(blocker, dict) and "reason" in blocker
        )
    )
    events = [
        {
            "id": "source-room-001",
            "stage": "source_opened",
            "agent": "Evidence",
            "mentions": ["@recallops/traceability"],
            "message": (
                f"Opened {facts['complaints']} complaint(s) for {facts['product']} "
                f"lot {facts['lot']}: {facts['defect']}."
            ),
            "metrics": {"severity": facts["severity"]},
        },
        {
            "id": "source-room-002",
            "stage": "traceability_gap",
            "agent": "Traceability",
            "mentions": ["@recallops/risk", "@recallops/commander"],
            "message": (
                f"Initial shipment coverage is {initial.coverage_percent}% with "
                f"{initial.untraced_units} untraced units across {initial.regions} regions."
            ),
            "metrics": {
                "coverage_percent": initial.coverage_percent,
                "untraced_units": initial.untraced_units,
            },
        },
        {
            "id": "source-room-003",
            "stage": "human_review_hold",
            "agent": "Regulatory/Risk",
            "mentions": ["@recallops/traceability"],
            "message": hold_message,
            "metrics": {"blocker_count": len(initial_blockers)},
        },
        {
            "id": "source-room-004",
            "stage": "recovered_sources",
            "agent": "Traceability",
            "mentions": ["@recallops/risk"],
            "message": (
                f"Recovered source set reaches {final.coverage_percent}% coverage with "
                f"{final.untraced_units} untraced units remaining."
            ),
            "metrics": {
                "coverage_percent": final.coverage_percent,
                "untraced_units": final.untraced_units,
            },
        },
        {
            "id": "source-room-005",
            "stage": "jurisdiction_rules",
            "agent": "Rules",
            "mentions": ["@recallops/comms", "@qa-director"],
            "message": deadline_message,
            "metrics": {
                "applied_rules": len(rule_assessment["applied_rules"]),
            },
        },
        {
            "id": "source-room-006",
            "stage": "human_approval_gate",
            "agent": "QA Director",
            "mentions": ["@recallops/commander"],
            "message": approval_message,
            "metrics": {"approval_ready": rule_assessment["approval_ready"]},
        },
    ]
    room_hash = _hash_payload(events)
    return {
        "mode": "source_packet_parameterized_room",
        "disclosure": (
            "Generated from the current source-evidence packet and deterministic rules; "
            "Band evidence is attached by the recall-room run endpoint."
        ),
        "room_id": f"source-room-{source_packet.audit_hash[:12]}",
        "incident_id": source_packet.incident_id,
        "source_audit_hash": source_packet.audit_hash,
        "approval_ready": rule_assessment["approval_ready"],
        "next_deadline": next_deadline,
        "events": events,
        "room_hash": room_hash,
    }


def build_recall_room_run(
    *,
    source_packet: SourceEvidencePacket,
    rule_assessment: dict[str, object],
    live_band_status: dict[str, object],
    fresh_band_run: dict[str, object] | None = None,
    live_band_error: dict[str, object] | None = None,
) -> dict[str, object]:
    room = build_source_room(source_packet, rule_assessment)
    captured_run = captured_band_proof()
    band_binding = _band_binding(
        room=room,
        live_band_status=live_band_status,
        captured_run=captured_run,
        fresh_band_run=fresh_band_run,
        live_band_error=live_band_error,
    )
    run_payload = {
        "proof_kind": "source_packet_to_recall_room_run",
        "mode": "parameterized_room_with_band_binding",
        "disclosure": (
            "The room events are derived from the current source packet. When live Band "
            "runtime is available, a fresh Band run can be attached; otherwise the packet "
            "binds to captured Band room evidence and declares the fallback."
        ),
        "incident_id": source_packet.incident_id,
        "source_audit_hash": source_packet.audit_hash,
        "rule_mode": rule_assessment["mode"],
        "approval_ready": rule_assessment["approval_ready"],
        "room": room,
        "band": band_binding,
        "causality_chain": [
            "source evidence parsed",
            "traceability coverage computed",
            "human-review hold evaluated",
            "jurisdiction rules applied",
            "Band room binding attached",
            "human approval gate prepared",
        ],
    }
    run_hash = _hash_payload(run_payload)
    run = {**run_payload, "run_hash": run_hash}
    return {**run, "verification": verify_recall_room_run(run)}


def verify_recall_room_run(run: dict[str, object]) -> dict[str, str | bool]:
    payload = dict(run)
    expected_hash = str(payload.pop("run_hash"))
    payload.pop("verification", None)
    actual_hash = _hash_payload(payload)
    return {
        "ok": actual_hash == expected_hash,
        "algorithm": "sha256",
        "expected_hash": expected_hash,
        "actual_hash": actual_hash,
    }


def spike_incident_payload(source_packet: SourceEvidencePacket) -> dict[str, object]:
    facts = {fact.key: fact.value for fact in source_packet.facts}
    return {
        "product": facts["product"],
        "lot": facts["lot"],
        "defect": facts["defect"],
        "severity": facts["severity"],
        "complaint_count": facts["complaints"],
        "shipped_units": source_packet.initial_traceability.shipped_units,
        "initial_coverage_percent": source_packet.initial_traceability.coverage_percent,
        "untraced_units": source_packet.initial_traceability.untraced_units,
        "recovered_units": (
            source_packet.final_traceability.traced_units
            - source_packet.initial_traceability.traced_units
        ),
        "final_coverage_percent": source_packet.final_traceability.coverage_percent,
    }


def _band_binding(
    *,
    room: dict[str, object],
    live_band_status: dict[str, object],
    captured_run: dict[str, object],
    fresh_band_run: dict[str, object] | None,
    live_band_error: dict[str, object] | None,
) -> dict[str, object]:
    if fresh_band_run is not None:
        captured = fresh_band_run["captured_band_run"]
        assert isinstance(captured, dict)
        return {
            "mode": "fresh_live_band_run_attached",
            "room_id": captured["room_id"],
            "proof_mode": captured["proof_mode"],
            "participant_count": captured["participant_count"],
            "message_ids": _message_ids(captured),
            "live_status": live_band_status,
            "fresh_run": fresh_band_run,
            "source_room_id": room["room_id"],
        }

    latest_run = live_band_status.get("latest_run")
    latest_captured = (
        latest_run.get("captured_band_run")
        if isinstance(latest_run, dict) and isinstance(latest_run.get("captured_band_run"), dict)
        else None
    )
    reference_run = latest_captured if isinstance(latest_captured, dict) else captured_run
    return {
        "mode": "captured_band_reference_with_parameterized_source_room",
        "room_id": reference_run["room_id"],
        "proof_mode": reference_run["proof_mode"],
        "participant_count": reference_run["participant_count"],
        "message_ids": _message_ids(reference_run),
        "live_status": live_band_status,
        "live_error": live_band_error,
        "captured_reference": captured_run,
        "source_room_id": room["room_id"],
    }


def _message_ids(run: dict[str, object]) -> list[str]:
    return [
        str(run[key])
        for key in (
            "commander_message_id",
            "evidence_ack_id",
            "traceability_gap_id",
            "risk_veto_id",
            "traceability_resolved_id",
            "risk_approved_id",
            "communications_notice_id",
        )
        if run.get(key)
    ]


def _hash_payload(payload: object) -> str:
    canonical = json.dumps(_to_plain(payload), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _to_plain(value: object) -> object:
    if hasattr(value, "__dataclass_fields__"):
        return asdict(value)
    if isinstance(value, tuple):
        return [_to_plain(item) for item in value]
    if isinstance(value, list):
        return [_to_plain(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _to_plain(item) for key, item in value.items()}
    return value
