from __future__ import annotations

import json
import os
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from recallops.notifications import DispatchReceipt
from recallops.source_evidence import SourceEvidencePacket


def case_db_path() -> Path:
    return Path(os.environ.get("RECALLOPS_CASE_DB", "recallops-cases.sqlite3"))


def create_case_record(
    *,
    source_packet: SourceEvidencePacket,
    rule_assessment: dict[str, object],
    dispatch_receipts: tuple[DispatchReceipt, ...],
) -> dict[str, object]:
    case_id = f"{source_packet.incident_id}-{source_packet.audit_hash[:10]}"
    created_at = _now()
    payload = {
        "case_id": case_id,
        "created_at": created_at,
        "source_packet": source_packet.to_dict(),
        "rule_assessment": rule_assessment,
        "dispatch_receipts": [receipt.to_dict() for receipt in dispatch_receipts],
    }
    with _connect() as connection:
        _ensure_schema(connection)
        connection.execute(
            """
            insert into recall_cases(case_id, created_at, source_audit_hash, payload_json)
            values (?, ?, ?, ?)
            on conflict(case_id) do update set
              created_at=excluded.created_at,
              source_audit_hash=excluded.source_audit_hash,
              payload_json=excluded.payload_json
            """,
            (
                case_id,
                created_at,
                source_packet.audit_hash,
                json.dumps(payload, sort_keys=True),
            ),
        )
    return payload


def list_case_records(limit: int = 20) -> list[dict[str, object]]:
    with _connect() as connection:
        _ensure_schema(connection)
        rows = connection.execute(
            """
            select case_id, created_at, source_audit_hash
            from recall_cases
            order by created_at desc
            limit ?
            """,
            (limit,),
        ).fetchall()
    return [
        {
            "case_id": str(row["case_id"]),
            "created_at": str(row["created_at"]),
            "source_audit_hash": str(row["source_audit_hash"]),
        }
        for row in rows
    ]


def get_case_record(case_id: str) -> dict[str, object] | None:
    with _connect() as connection:
        _ensure_schema(connection)
        row = connection.execute(
            "select payload_json from recall_cases where case_id = ?",
            (case_id,),
        ).fetchone()
    if row is None:
        return None
    payload = json.loads(str(row["payload_json"]))
    assert isinstance(payload, dict)
    return payload


def record_receipt(
    *,
    kind: str,
    receipt_hash: str,
    previous_hash: str,
    source_audit_hash: str,
    payload: dict[str, object],
) -> dict[str, object]:
    recorded_at = _now()
    with _connect() as connection:
        _ensure_receipt_schema(connection)
        already = connection.execute(
            "select 1 from recall_receipts where receipt_hash = ?",
            (receipt_hash,),
        ).fetchone()
        if already is not None:
            raise ValueError("Receipt already recorded; replay rejected.")
        if previous_hash != "0" * 64:
            prior = connection.execute(
                "select 1 from recall_receipts where receipt_hash = ?",
                (previous_hash,),
            ).fetchone()
            if prior is None:
                raise ValueError("Previous hash does not match any recorded receipt.")
        try:
            connection.execute(
                """
                insert into recall_receipts(
                  receipt_hash, previous_hash, kind, source_audit_hash, recorded_at, payload_json
                )
                values (?, ?, ?, ?, ?, ?)
                """,
                (
                    receipt_hash,
                    previous_hash,
                    kind,
                    source_audit_hash,
                    recorded_at,
                    json.dumps(payload, sort_keys=True),
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise ValueError("Receipt already recorded; replay rejected.") from exc
    return {
        "recorded": True,
        "kind": kind,
        "receipt_hash": receipt_hash,
        "previous_hash": previous_hash,
        "recorded_at": recorded_at,
    }


def _connect() -> sqlite3.Connection:
    path = case_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    return connection


def _ensure_schema(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        create table if not exists recall_cases (
            case_id text primary key,
            created_at text not null,
            source_audit_hash text not null,
            payload_json text not null
        )
        """
    )


def _ensure_receipt_schema(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        create table if not exists recall_receipts (
            receipt_hash text primary key,
            previous_hash text not null,
            kind text not null,
            source_audit_hash text not null,
            recorded_at text not null,
            payload_json text not null
        )
        """
    )


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")
