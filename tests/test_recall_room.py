from recallops.recall_room import build_recall_room_run, verify_recall_room_run
from recallops.rules import assess_rules
from recallops.source_evidence import build_source_evidence_packet


FAKE_PARTNER_AI = {
    "mode": "partner_ai_assisted",
    "disclosure": "Partner providers ran.",
    "used_count": 2,
    "providers": {
        "ai_ml_api": {
            "provider": "AI/ML API",
            "used": True,
            "status": "used",
            "response_hash": "a" * 64,
            "output": {"decision": "approve_after_traceability", "risk_level": "critical"},
        },
        "featherless": {
            "provider": "Featherless",
            "used": True,
            "status": "used",
            "response_hash": "b" * 64,
            "output": {"evidence_summary": "three overheating complaints"},
        },
    },
}


def _run(partner_ai=None):
    packet = build_source_evidence_packet(partner_ai=partner_ai)
    assessment = assess_rules(packet)
    return build_recall_room_run(
        source_packet=packet,
        rule_assessment=assessment,
        live_band_status={},
    )


def test_ai_advisory_surfaces_real_llm_output() -> None:
    run = _run(partner_ai=FAKE_PARTNER_AI)
    advisory = run["ai_advisory"]

    assert advisory["used"] is True
    assert advisory["agent"] == "AI/ML Risk Adapter"
    assert advisory["risk_analysis"]["risk_level"] == "critical"
    assert advisory["evidence_analysis"]["evidence_summary"] == "three overheating complaints"
    assert run["verification"]["ok"] is True


def test_ai_advisory_is_excluded_from_run_hash() -> None:
    run = _run(partner_ai=FAKE_PARTNER_AI)

    tampered = {key: value for key, value in run.items() if key != "verification"}
    tampered["ai_advisory"] = {"used": True, "risk_analysis": {"risk_level": "tampered"}}

    assert verify_recall_room_run(tampered)["ok"] is True


def test_ai_advisory_absent_when_partner_ai_unused() -> None:
    run = _run()

    assert run["ai_advisory"]["used"] is False
    assert run["ai_advisory"]["risk_analysis"] is None
    assert run["verification"]["ok"] is True
