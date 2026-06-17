from recallops import build_recall_packet, verify_packet_digest


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
    assert verify_packet_digest(first)["ok"] is True


def test_packet_declares_live_five_agent_proof_mode() -> None:
    packet = build_recall_packet()

    assert packet.band_proof["proof_mode"] == "live_band_five_agent_workflow"
    assert packet.band_proof["live_workflow_participant_count"] == 5
    assert packet.band_proof["live_workflow_context_items"] == 8
    assert (
        packet.band_proof["live_workflow_communications_notice_id"]
        == "db2e10f0-f8f6-4fc4-a324-c99929911500"
    )


def test_decision_receipts_are_hash_chained() -> None:
    packet = build_recall_packet()

    assert packet.receipts[0].previous_hash == "0" * 64
    for previous, current in zip(packet.receipts[:-1], packet.receipts[1:], strict=True):
        assert current.previous_hash == previous.receipt_hash
    assert packet.receipts[-1].status == "sealed"
    assert packet.receipts[-1].event_id == "msg-010"


def test_decision_graph_captures_veto_replan_path() -> None:
    packet = build_recall_packet()
    edge_labels = {edge.label: edge for edge in packet.decision_graph["edges"]}

    assert edge_labels["veto forces re-plan"].source == "risk-veto"
    assert edge_labels["veto forces re-plan"].target == "trace-resolved"
    assert (
        edge_labels["veto forces re-plan"].band_message_id
        == packet.band_proof["live_workflow_risk_veto_id"]
    )
