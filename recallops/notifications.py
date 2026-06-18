from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass

from recallops.source_evidence import SourceEvidencePacket


@dataclass(frozen=True)
class DispatchReceipt:
    id: str
    channel: str
    recipient: str
    status: str
    payload_hash: str
    disclosure: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def build_dispatch_receipts(packet: SourceEvidencePacket) -> tuple[DispatchReceipt, ...]:
    notices = _notices(packet)
    ready = packet.final_traceability.coverage_percent == 100
    return (
        _receipt(
            receipt_id="dispatch-regulator",
            recipient="regional product-safety authority",
            body=notices["regulator"],
            ready=ready,
        ),
        _receipt(
            receipt_id="dispatch-customer",
            recipient="affected customer notification list",
            body=notices["customer"],
            ready=ready,
        ),
        _receipt(
            receipt_id="dispatch-warehouse",
            recipient="warehouse quarantine desk",
            body=notices["warehouse"],
            ready=ready,
        ),
    )


def _notices(packet: SourceEvidencePacket) -> dict[str, str]:
    facts = {fact.key: fact.value for fact in packet.facts}
    product = facts["product"]
    lot = facts["lot"]
    defect = facts["defect"]
    return {
        "regulator": (
            f"Notify regional product-safety authority of {lot} {product} risk: {defect}."
        ),
        "customer": f"Stop using {product} lot {lot} pending recall instructions.",
        "warehouse": f"Quarantine remaining inventory for {product} lot {lot}.",
    }


def _receipt(
    *,
    receipt_id: str,
    recipient: str,
    body: str,
    ready: bool,
) -> DispatchReceipt:
    payload = {
        "recipient": recipient,
        "body": body,
        "mode": "dry_run",
    }
    return DispatchReceipt(
        id=receipt_id,
        channel="dry_run",
        recipient=recipient,
        status="prepared" if ready else "blocked",
        payload_hash=_audit_hash(payload),
        disclosure="No external notification was sent; this is a dispatch-ready receipt.",
    )


def _audit_hash(payload: dict[str, object]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
