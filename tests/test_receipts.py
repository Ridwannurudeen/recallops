import pytest

from recallops.approval import build_approval_receipt
from recallops.cases import record_receipt
from recallops.source_evidence import build_source_evidence_packet


def _receipt(previous_hash: str = "0" * 64):
    packet = build_source_evidence_packet()
    return build_approval_receipt(
        approver="QA Director",
        decision="approved",
        reason="Traceability reached 100% and the veto cleared.",
        source_audit_hash=packet.audit_hash,
        previous_hash=previous_hash,
    ).to_dict()


def _record(receipt: dict[str, object]) -> dict[str, object]:
    return record_receipt(
        kind="approval",
        receipt_hash=str(receipt["receipt_hash"]),
        previous_hash=str(receipt["previous_hash"]),
        source_audit_hash=str(receipt["source_audit_hash"]),
        payload=receipt,
    )


def test_record_receipt_persists_genesis_receipt() -> None:
    record = _record(_receipt())

    assert record["recorded"] is True
    assert record["kind"] == "approval"
    assert len(record["receipt_hash"]) == 64


def test_record_receipt_rejects_replay() -> None:
    receipt = _receipt()
    _record(receipt)

    with pytest.raises(ValueError, match="replay rejected"):
        _record(receipt)


def test_record_receipt_links_to_prior_and_rejects_unknown_previous() -> None:
    first = _receipt()
    _record(first)

    chained = _receipt(previous_hash=str(first["receipt_hash"]))
    linked = _record(chained)
    assert linked["previous_hash"] == first["receipt_hash"]

    orphan = _receipt(previous_hash="a" * 64)
    with pytest.raises(ValueError, match="does not match any recorded receipt"):
        _record(orphan)
