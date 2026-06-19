from __future__ import annotations

import csv
import hashlib
import io
import json
from dataclasses import asdict, dataclass

from recallops.partner_ai import partner_ai_status


DEFAULT_COMPLAINT_TEXT = """C-117 | product: Northstar Home Battery Pack | lot: BAT-4421 | defect: overheating during overnight charge | severity: critical
C-118 | product: Northstar Home Battery Pack | lot: BAT-4421 | defect: charging-port heat spike | severity: critical
C-119 | product: Northstar Home Battery Pack | lot: BAT-4421 | defect: smoke odor after overnight charge | severity: critical
"""

DEFAULT_SHIPMENT_CSV = """source,distributor,region,customers,units,status
SHIP-001,Direct Warehouse,US-West,410,760,traced
SHIP-002,Direct Warehouse,US-East,390,720,traced
SHIP-003,RetailNet,EU-Central,460,840,traced
SHIP-004,RetailNet,EU-North,415,790,traced
SHIP-005,Medina Distribution,MEA,455,826,traced
SHIP-006,Kestrel Distributor,LATAM,480,864,missing
"""

DEFAULT_RECOVERED_SHIPMENT_CSV = """source,distributor,region,customers,units,status
SHIP-001,Direct Warehouse,US-West,410,760,traced
SHIP-002,Direct Warehouse,US-East,390,720,traced
SHIP-003,RetailNet,EU-Central,460,840,traced
SHIP-004,RetailNet,EU-North,415,790,traced
SHIP-005,Medina Distribution,MEA,455,826,traced
SHIP-006,Kestrel Distributor,LATAM,480,864,traced
"""


@dataclass(frozen=True)
class Citation:
    id: str
    source: str
    locator: str
    excerpt: str


@dataclass(frozen=True)
class ExtractedFact:
    key: str
    value: str | int
    citation_id: str


@dataclass(frozen=True)
class SourceShipment:
    source: str
    distributor: str
    region: str
    customers: int
    units: int
    status: str
    citation_id: str


@dataclass(frozen=True)
class SourceTraceability:
    shipped_units: int
    traced_units: int
    untraced_units: int
    coverage_percent: int
    affected_customers: int
    regions: int


@dataclass(frozen=True)
class SourceEvidencePacket:
    incident_id: str
    generated_at: str
    source_digests: dict[str, str]
    facts: tuple[ExtractedFact, ...]
    initial_shipments: tuple[SourceShipment, ...]
    final_shipments: tuple[SourceShipment, ...]
    initial_traceability: SourceTraceability
    final_traceability: SourceTraceability
    missing_sources: tuple[str, ...]
    citations: tuple[Citation, ...]
    partner_ai: dict[str, object]
    audit_hash: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def build_source_evidence_packet(
    *,
    complaint_text: str = DEFAULT_COMPLAINT_TEXT,
    shipment_csv: str = DEFAULT_SHIPMENT_CSV,
    recovered_shipment_csv: str = DEFAULT_RECOVERED_SHIPMENT_CSV,
    partner_ai: dict[str, object] | None = None,
) -> SourceEvidencePacket:
    complaint_facts, complaint_citations = _parse_complaints(complaint_text)
    initial_shipments, initial_citations = _parse_shipments(shipment_csv, source_name="shipment")
    final_shipments, final_citations = _parse_shipments(
        recovered_shipment_csv,
        source_name="recovered-shipment",
    )
    missing_sources = tuple(
        shipment.source for shipment in initial_shipments if shipment.status != "traced"
    )
    packet_fields = {
        "incident_id": _incident_id(complaint_facts),
        "generated_at": _generated_at(),
        "source_digests": {
            "complaint_text": _text_hash(complaint_text),
            "shipment_csv": _text_hash(shipment_csv),
            "recovered_shipment_csv": _text_hash(recovered_shipment_csv),
        },
        "facts": complaint_facts,
        "initial_shipments": initial_shipments,
        "final_shipments": final_shipments,
        "initial_traceability": _traceability(initial_shipments),
        "final_traceability": _traceability(final_shipments),
        "missing_sources": missing_sources,
        "citations": complaint_citations + initial_citations + final_citations,
        "partner_ai": partner_ai or partner_ai_status(),
    }
    audit_hash = _audit_hash(_serialize(packet_fields))
    return SourceEvidencePacket(audit_hash=audit_hash, **packet_fields)


def verify_source_evidence_digest(packet: SourceEvidencePacket) -> dict[str, str | bool]:
    payload = packet.to_dict()
    expected_hash = str(payload.pop("audit_hash"))
    actual_hash = _audit_hash(_serialize(payload))
    return {
        "ok": actual_hash == expected_hash,
        "algorithm": "sha256",
        "expected_hash": expected_hash,
        "actual_hash": actual_hash,
    }


def _parse_complaints(text: str) -> tuple[tuple[ExtractedFact, ...], tuple[Citation, ...]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        raise ValueError("Complaint text must contain at least one complaint line.")

    parsed = [_parse_key_value_line(line) for line in lines]
    first = parsed[0]
    complaint_ids = [entry["id"] for entry in parsed]
    bundle_citation = Citation(
        id="complaint-bundle",
        source="complaint_text",
        locator=f"lines 1-{len(lines)}",
        excerpt=f"{len(lines)} complaints: {', '.join(complaint_ids)}",
    )
    citation_id = str(first["id"])
    facts = (
        ExtractedFact("product", str(first["product"]), citation_id),
        ExtractedFact("lot", str(first["lot"]), citation_id),
        ExtractedFact("defect", str(first["defect"]), citation_id),
        ExtractedFact("severity", str(first["severity"]), citation_id),
        ExtractedFact("complaints", len(lines), bundle_citation.id),
    )
    citations = (bundle_citation,) + tuple(
        Citation(
            id=str(entry["id"]),
            source="complaint_text",
            locator=f"line {index}",
            excerpt=lines[index - 1],
        )
        for index, entry in enumerate(parsed, start=1)
    )
    return facts, citations


def _parse_key_value_line(line: str) -> dict[str, str]:
    parts = [part.strip() for part in line.split("|")]
    if not parts:
        raise ValueError("Complaint line is empty.")
    values = {"id": parts[0]}
    for part in parts[1:]:
        key, separator, value = part.partition(":")
        if not separator:
            continue
        values[key.strip().lower()] = value.strip()
    for required in ("product", "lot", "defect", "severity"):
        if required not in values:
            raise ValueError(f"Complaint line is missing {required}.")
    return values


def _parse_shipments(
    csv_text: str,
    *,
    source_name: str,
) -> tuple[tuple[SourceShipment, ...], tuple[Citation, ...]]:
    reader = csv.DictReader(io.StringIO(csv_text.strip()))
    required = {"source", "distributor", "region", "customers", "units", "status"}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        raise ValueError(
            "Shipment CSV must include source, distributor, region, customers, units, status."
        )

    shipments: list[SourceShipment] = []
    citations: list[Citation] = []
    seen_sources: set[str] = set()
    for row_number, row in enumerate(reader, start=2):
        source = str(row["source"]).strip()
        if source in seen_sources:
            raise ValueError(f"Shipment row {row_number} repeats source {source}.")
        seen_sources.add(source)
        status = str(row["status"]).strip().lower()
        if status not in {"traced", "missing"}:
            raise ValueError(f"Shipment row {row_number} has unsupported status {status}.")
        units = int(row["units"])
        customers = int(row["customers"])
        if units <= 0 or customers <= 0:
            raise ValueError(f"Shipment row {row_number} must have positive customers and units.")
        citation_id = f"{source_name}:{source}"
        shipment = SourceShipment(
            source=source,
            distributor=str(row["distributor"]).strip(),
            region=str(row["region"]).strip(),
            customers=customers,
            units=units,
            status=status,
            citation_id=citation_id,
        )
        shipments.append(shipment)
        citations.append(
            Citation(
                id=citation_id,
                source=f"{source_name}_csv",
                locator=f"row {row_number}",
                excerpt=",".join(str(row[field]) for field in reader.fieldnames),
            )
        )

    if not shipments:
        raise ValueError("Shipment CSV must contain at least one shipment row.")
    return tuple(shipments), tuple(citations)


def _traceability(shipments: tuple[SourceShipment, ...]) -> SourceTraceability:
    shipped_units = sum(shipment.units for shipment in shipments)
    if shipped_units <= 0:
        raise ValueError("Shipment CSV must contain positive shipped units.")
    traced_units = sum(shipment.units for shipment in shipments if shipment.status == "traced")
    affected_customers = sum(
        shipment.customers for shipment in shipments if shipment.status == "traced"
    )
    return SourceTraceability(
        shipped_units=shipped_units,
        traced_units=traced_units,
        untraced_units=shipped_units - traced_units,
        coverage_percent=round((traced_units / shipped_units) * 100),
        affected_customers=affected_customers,
        regions=len({shipment.region for shipment in shipments}),
    )


def _incident_id(facts: tuple[ExtractedFact, ...]) -> str:
    fact_map = {fact.key: str(fact.value) for fact in facts}
    return f"INC-SOURCE-{fact_map['lot']}"


def _audit_hash(payload: dict[str, object]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _text_hash(text: str) -> str:
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def _serialize(payload: dict[str, object]) -> dict[str, object]:
    return {key: _to_plain(value) for key, value in payload.items()}


def _to_plain(value: object) -> object:
    if hasattr(value, "__dataclass_fields__"):
        return asdict(value)
    if isinstance(value, tuple):
        return [_to_plain(item) for item in value]
    if isinstance(value, dict):
        return {key: _to_plain(item) for key, item in value.items()}
    return value


def _generated_at() -> str:
    return "2026-06-16T21:20:00Z"
