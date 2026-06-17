from recallops import build_recall_packet


def test_initial_traceability_gap_is_visible() -> None:
    packet = build_recall_packet()

    assert packet.initial_traceability.shipped_units == 4_800
    assert packet.initial_traceability.coverage_percent == 82
    assert packet.initial_traceability.untraced_units == 864


def test_regulatory_veto_precedes_replan() -> None:
    packet = build_recall_packet()
    stages = [event.stage for event in packet.events]

    assert stages.index("regulatory_veto") < stages.index("traceability_resolved")
    assert packet.band_proof["veto_message_id"] == "msg-006"


def test_final_decision_requires_traceability_and_human_approval() -> None:
    approved = build_recall_packet()
    unapproved = build_recall_packet(human_approved=False)
    unresolved = build_recall_packet(resolve_gap=False)

    assert approved.decision["status"] == "approved"
    assert unapproved.decision["status"] == "blocked"
    assert unresolved.decision["status"] == "blocked"


def test_audit_hash_is_stable_for_same_packet() -> None:
    first = build_recall_packet()
    second = build_recall_packet()

    assert first.audit_hash == second.audit_hash
    assert len(first.audit_hash) == 64


def test_packet_declares_deterministic_proof_mode() -> None:
    packet = build_recall_packet()

    assert packet.band_proof["proof_mode"] == "deterministic_demo"
