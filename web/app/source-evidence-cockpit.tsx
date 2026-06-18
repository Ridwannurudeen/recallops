"use client";

import { useEffect, useState, type ChangeEvent } from "react";

export type SourceInputs = {
  complaint_text: string;
  shipment_csv: string;
  recovered_shipment_csv: string;
};

type ExtractedFact = {
  key: string;
  value: string | number;
  citation_id: string;
};

type Citation = {
  id: string;
  source: string;
  locator: string;
  excerpt: string;
};

type SourceShipment = {
  source: string;
  distributor: string;
  region: string;
  customers: number;
  units: number;
  status: string;
  citation_id: string;
};

type SourceTraceability = {
  shipped_units: number;
  traced_units: number;
  untraced_units: number;
  coverage_percent: number;
  affected_customers: number;
  regions: number;
};

type PartnerProvider = {
  provider: string;
  configured: boolean;
  used: boolean;
  status: string;
  model: string;
  role: string;
  response_hash?: string;
  output?: Record<string, unknown>;
  error?: string;
};

type SourceRoomEvent = {
  id: string;
  stage: string;
  agent: string;
  message: string;
  metrics: Record<string, string | number | boolean>;
};

type SourceRoom = {
  mode: string;
  disclosure: string;
  room_id: string;
  incident_id: string;
  source_audit_hash: string;
  approval_ready: boolean;
  room_hash: string;
  events: SourceRoomEvent[];
};

export type SourceEvidencePacket = {
  incident_id: string;
  generated_at: string;
  source_digests: Record<string, string>;
  facts: ExtractedFact[];
  initial_shipments: SourceShipment[];
  final_shipments: SourceShipment[];
  initial_traceability: SourceTraceability;
  final_traceability: SourceTraceability;
  missing_sources: string[];
  citations: Citation[];
  partner_ai: {
    mode: string;
    disclosure: string;
    providers: Record<string, PartnerProvider>;
  };
  audit_hash: string;
};

export type Verification = {
  ok: boolean;
  algorithm: string;
  expected_hash: string;
  actual_hash: string;
};

export type SourceEvidenceResponse = {
  inputs: SourceInputs;
  packet: SourceEvidencePacket;
  room: SourceRoom;
  verification: Verification;
};

type ApprovalReceiptResponse = {
  receipt: {
    approval_id: string;
    approved_at: string;
    approver: string;
    decision: "approved" | "rejected";
    reason: string;
    source_audit_hash: string;
    previous_hash: string;
    receipt_hash: string;
  };
  verification: Verification;
  disclosure: string;
};

type IncidentIntake = {
  firstComplaintId: string;
  product: string;
  lot: string;
  defect: string;
  severity: string;
  complaintCount: number;
};

type IntakeErrors = {
  complaint?: string;
  shipment?: string;
  recovered?: string;
};

const EMPTY_INPUTS: SourceInputs = {
  complaint_text: "",
  shipment_csv: "",
  recovered_shipment_csv: "",
};

const EMPTY_INTAKE: IncidentIntake = {
  firstComplaintId: "C-001",
  product: "",
  lot: "",
  defect: "",
  severity: "critical",
  complaintCount: 1,
};

export default function SourceEvidenceCockpit({
  apiBase,
  onEvidenceLoaded,
}: {
  apiBase: string;
  onEvidenceLoaded?: (value: SourceEvidenceResponse | null) => void;
}) {
  const [inputs, setInputs] = useState<SourceInputs>(EMPTY_INPUTS);
  const [intake, setIntake] = useState<IncidentIntake>(EMPTY_INTAKE);
  const [intakeErrors, setIntakeErrors] = useState<IntakeErrors>({});
  const [evidence, setEvidence] = useState<SourceEvidenceResponse | null>(null);
  const [receipt, setReceipt] = useState<ApprovalReceiptResponse | null>(null);
  const [approver, setApprover] = useState("QA Director");
  const [reason, setReason] = useState(
    "Traceability reached 100% and the risk hold cleared.",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const packet = evidence?.packet ?? null;

  async function loadEvidence() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/source-evidence`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.detail ?? "Source evidence failed.");
      }
      const nextEvidence = body as SourceEvidenceResponse;
      setEvidence(nextEvidence);
      setInputs(nextEvidence.inputs);
      setIntake(parseIncidentIntake(nextEvidence.inputs.complaint_text));
      setIntakeErrors({});
      onEvidenceLoaded?.(nextEvidence);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Source evidence failed.");
      onEvidenceLoaded?.(null);
    } finally {
      setLoading(false);
    }
  }

  async function recompute(usePartnerAi = false) {
    const nextErrors = validateIntake(inputs, intake);
    setIntakeErrors(nextErrors);
    if (hasIntakeErrors(nextErrors)) {
      setError("Fix the incident intake fields before recalculating.");
      return;
    }

    setLoading(true);
    setError(null);
    setReceipt(null);
    try {
      const response = await fetch(`${apiBase}/source-evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...inputs, use_partner_ai: usePartnerAi }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.detail ?? "Source evidence failed.");
      }
      const nextEvidence = body as SourceEvidenceResponse;
      setEvidence(nextEvidence);
      setInputs(nextEvidence.inputs);
      setIntake(parseIncidentIntake(nextEvidence.inputs.complaint_text));
      setIntakeErrors({});
      onEvidenceLoaded?.(nextEvidence);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Source evidence failed.");
      onEvidenceLoaded?.(null);
    } finally {
      setLoading(false);
    }
  }

  async function approvePacket() {
    if (!packet) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/approval-receipt`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          approver,
          decision: "approved",
          reason,
          source_audit_hash: packet.audit_hash,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.detail ?? "Approval receipt failed.");
      }
      setReceipt(body as ApprovalReceiptResponse);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Approval receipt failed.");
    } finally {
      setLoading(false);
    }
  }

  function updateInput(field: keyof SourceInputs, value: string) {
    setInputs((current) => ({ ...current, [field]: value }));
    if (field === "complaint_text") {
      setIntake(parseIncidentIntake(value));
    }
    if (field === "shipment_csv" || field === "recovered_shipment_csv") {
      const key = field === "shipment_csv" ? "shipment" : "recovered";
      const message = validateShipmentCsv(value);
      setIntakeErrors((current) => ({
        ...current,
        [key]: message ?? undefined,
      }));
    }
  }

  function updateIntake(field: keyof IncidentIntake, value: string) {
    const nextIntake = {
      ...intake,
      [field]:
        field === "complaintCount"
          ? Math.max(1, Number.parseInt(value, 10) || 1)
          : value,
    };
    setIntake(nextIntake);
    setInputs((current) => ({
      ...current,
      complaint_text: buildComplaintText(nextIntake),
    }));
    setIntakeErrors((current) => ({
      ...current,
      complaint: validateComplaint(nextIntake) ?? undefined,
    }));
  }

  async function uploadCsv(
    field: "shipment_csv" | "recovered_shipment_csv",
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }
    try {
      updateInput(field, await file.text());
    } catch {
      setError("CSV file could not be read.");
    } finally {
      event.currentTarget.value = "";
    }
  }

  useEffect(() => {
    void loadEvidence();
  }, []);

  return (
    <section className="panel source-cockpit">
      <div className="panel-head">
        <div>
          <p className="kicker">source-grounded evidence</p>
          <h2>Evidence and calculations from case files</h2>
        </div>
        <span className={evidence?.verification.ok ? "mono-stat" : "risk-stat"}>
          {evidence?.verification.ok ? "verified" : "pending"}
        </span>
      </div>

      <div className="source-grid">
        <article className="source-inputs intake-builder">
          <div className="intake-head">
            <div>
              <span>operator intake</span>
              <strong>Create or edit the recall case</strong>
            </div>
            <small>{shipmentSummary(inputs.shipment_csv)}</small>
          </div>

          <div className="intake-field-grid">
            <label>
              <span>first complaint id</span>
              <input
                value={intake.firstComplaintId}
                onChange={(event) =>
                  updateIntake("firstComplaintId", event.currentTarget.value)
                }
              />
            </label>
            <label>
              <span>complaint count</span>
              <input
                min={1}
                type="number"
                value={intake.complaintCount}
                onChange={(event) =>
                  updateIntake("complaintCount", event.currentTarget.value)
                }
              />
            </label>
            <label>
              <span>product</span>
              <input
                value={intake.product}
                onChange={(event) =>
                  updateIntake("product", event.currentTarget.value)
                }
              />
            </label>
            <label>
              <span>lot</span>
              <input
                value={intake.lot}
                onChange={(event) =>
                  updateIntake("lot", event.currentTarget.value)
                }
              />
            </label>
            <label>
              <span>severity</span>
              <select
                value={intake.severity}
                onChange={(event) =>
                  updateIntake("severity", event.currentTarget.value)
                }
              >
                <option value="critical">critical</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </label>
            <label className="intake-defect-field">
              <span>defect / complaint summary</span>
              <textarea
                value={intake.defect}
                onChange={(event) =>
                  updateIntake("defect", event.currentTarget.value)
                }
              />
            </label>
          </div>
          {intakeErrors.complaint ? (
            <small className="field-error">{intakeErrors.complaint}</small>
          ) : null}

          <div className="csv-upload-grid">
            <label>
              <span>initial shipment csv</span>
              <input
                accept=".csv,text/csv"
                type="file"
                onChange={(event) => uploadCsv("shipment_csv", event)}
              />
              <small>{shipmentSummary(inputs.shipment_csv)}</small>
              {intakeErrors.shipment ? (
                <b className="field-error">{intakeErrors.shipment}</b>
              ) : null}
            </label>
            <label>
              <span>recovered shipment csv</span>
              <input
                accept=".csv,text/csv"
                type="file"
                onChange={(event) => uploadCsv("recovered_shipment_csv", event)}
              />
              <small>{shipmentSummary(inputs.recovered_shipment_csv)}</small>
              {intakeErrors.recovered ? (
                <b className="field-error">{intakeErrors.recovered}</b>
              ) : null}
            </label>
          </div>

          <details className="raw-source-editor">
            <summary>Raw source editor</summary>
            <label>
              <span>complaints</span>
              <textarea
                value={inputs.complaint_text}
                onChange={(event) =>
                  updateInput("complaint_text", event.currentTarget.value)
                }
              />
            </label>
            <label>
              <span>initial shipment csv</span>
              <textarea
                value={inputs.shipment_csv}
                onChange={(event) =>
                  updateInput("shipment_csv", event.currentTarget.value)
                }
              />
            </label>
            <label>
              <span>recovered shipment csv</span>
              <textarea
                value={inputs.recovered_shipment_csv}
                onChange={(event) =>
                  updateInput(
                    "recovered_shipment_csv",
                    event.currentTarget.value,
                  )
                }
              />
            </label>
          </details>

          <div className="source-actions">
            <button
              type="button"
              disabled={loading}
              onClick={() => recompute()}
            >
              {loading ? "computing..." : "Recalculate"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => recompute(true)}
            >
              {loading ? "computing..." : "Recalculate with AI"}
            </button>
            <a href={`${apiBase}/source-evidence`}>source api</a>
            <a href={`${apiBase}/source-evidence/verify`}>verify api</a>
          </div>
        </article>

        {packet ? (
          <article className="source-results">
            <div className="trace-card trace-card-gap">
              <span>initial coverage</span>
              <strong>{packet.initial_traceability.coverage_percent}%</strong>
              <small>
                {packet.initial_traceability.untraced_units.toLocaleString()}{" "}
                untraced units
              </small>
            </div>
            <div className="trace-card trace-card-clear">
              <span>final coverage</span>
              <strong>{packet.final_traceability.coverage_percent}%</strong>
              <small>
                {packet.final_traceability.traced_units.toLocaleString()} traced
                units
              </small>
            </div>
            <div className="source-hash">
              <span>source audit hash</span>
              <code>{packet.audit_hash}</code>
            </div>
            <div className="digest-grid">
              {Object.entries(packet.source_digests).map(([key, value]) => (
                <div key={key}>
                  <span>{key.replaceAll("_", " ")}</span>
                  <code>{value}</code>
                </div>
              ))}
            </div>
            <div className="provider-grid">
              {Object.entries(packet.partner_ai.providers).map(
                ([key, provider]) => (
                  <div key={key}>
                    <span>{key.replaceAll("_", " ")}</span>
                    <strong>{provider.used ? "used" : provider.status}</strong>
                    <small>
                      {provider.configured ? provider.model : provider.role}
                    </small>
                    {provider.response_hash ? (
                      <code>{provider.response_hash}</code>
                    ) : null}
                    {provider.output ? (
                      <p>{JSON.stringify(provider.output)}</p>
                    ) : null}
                    {provider.error ? <p>{provider.error}</p> : null}
                  </div>
                ),
              )}
            </div>
          </article>
        ) : null}
      </div>

      {evidence?.room ? (
        <div className="source-room-panel">
          <div className="source-room-head">
            <div>
              <span>parameterized room</span>
              <strong>{evidence.room.room_id}</strong>
            </div>
            <small>
              {evidence.room.approval_ready ? "approval ready" : "hold active"}
            </small>
          </div>
          <p>{evidence.room.disclosure}</p>
          <div className="source-room-events">
            {evidence.room.events.map((event) => (
              <article key={event.id}>
                <span>{event.stage.replaceAll("_", " ")}</span>
                <strong>{event.agent}</strong>
                <p>{event.message}</p>
              </article>
            ))}
          </div>
          <code>{evidence.room.room_hash}</code>
        </div>
      ) : null}

      {packet ? (
        <>
          <div className="fact-grid">
            {packet.facts.map((fact) => (
              <article key={fact.key}>
                <span>{fact.key}</span>
                <strong>{fact.value}</strong>
                <small>{fact.citation_id}</small>
              </article>
            ))}
          </div>

          <div className="shipment-ledger">
            {packet.initial_shipments.map((shipment) => {
              const finalShipment = packet.final_shipments.find(
                (entry) => entry.source === shipment.source,
              );
              return (
                <article key={shipment.source}>
                  <span
                    className={
                      shipment.status === "traced"
                        ? "trace-dot traced"
                        : "trace-dot"
                    }
                  />
                  <strong>{shipment.source}</strong>
                  <small>{shipment.region}</small>
                  <p>{shipment.distributor}</p>
                  <code>
                    {shipment.status} to {finalShipment?.status ?? "unknown"}
                  </code>
                </article>
              );
            })}
          </div>

          <div className="citation-ledger">
            {packet.citations.slice(0, 9).map((citation) => (
              <article key={citation.id}>
                <span>
                  {citation.id} / {citation.locator}
                </span>
                <strong>{citation.source}</strong>
                <p>{citation.excerpt}</p>
              </article>
            ))}
          </div>

          <div className="approval-strip">
            <label>
              <span>approver</span>
              <input
                value={approver}
                onChange={(event) => setApprover(event.currentTarget.value)}
              />
            </label>
            <label>
              <span>basis</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.currentTarget.value)}
              />
            </label>
            <button type="button" disabled={loading} onClick={approvePacket}>
              seal packet receipt
            </button>
          </div>
        </>
      ) : null}

      {receipt ? (
        <div className="approval-receipt">
          <span>{receipt.receipt.approval_id}</span>
          <strong>{receipt.receipt.approved_at}</strong>
          <code>{receipt.receipt.receipt_hash}</code>
          <small>{receipt.disclosure}</small>
        </div>
      ) : null}

      {error ? <p className="runner-error">{error}</p> : null}
    </section>
  );
}

function parseIncidentIntake(complaintText: string): IncidentIntake {
  const lines = complaintText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return EMPTY_INTAKE;
  }

  const parts = lines[0].split("|").map((part) => part.trim());
  const values: Record<string, string> = {
    firstComplaintId: parts[0] || EMPTY_INTAKE.firstComplaintId,
  };
  for (const part of parts.slice(1)) {
    const [key, ...rest] = part.split(":");
    if (key && rest.length > 0) {
      values[key.trim().toLowerCase()] = rest.join(":").trim();
    }
  }

  return {
    firstComplaintId: values.firstComplaintId,
    product: values.product ?? "",
    lot: values.lot ?? "",
    defect: values.defect ?? "",
    severity: values.severity ?? EMPTY_INTAKE.severity,
    complaintCount: lines.length,
  };
}

function buildComplaintText(intake: IncidentIntake): string {
  const count = Math.max(1, intake.complaintCount);
  return Array.from({ length: count }, (_, index) => {
    const complaintId = incrementComplaintId(intake.firstComplaintId, index);
    return `${complaintId} | product: ${intake.product.trim()} | lot: ${intake.lot.trim()} | defect: ${intake.defect.trim()} | severity: ${intake.severity.trim()}`;
  }).join("\n");
}

function incrementComplaintId(value: string, offset: number): string {
  const clean = value.trim() || EMPTY_INTAKE.firstComplaintId;
  if (offset === 0) {
    return clean;
  }
  const match = clean.match(/^(.*?)(\d+)$/);
  if (!match) {
    return `${clean}-${offset + 1}`;
  }
  const [, prefix, numeric] = match;
  const nextNumber = Number.parseInt(numeric, 10) + offset;
  return `${prefix}${String(nextNumber).padStart(numeric.length, "0")}`;
}

function validateIntake(
  inputs: SourceInputs,
  intake: IncidentIntake,
): IntakeErrors {
  return {
    complaint: validateComplaint(intake) ?? undefined,
    shipment: validateShipmentCsv(inputs.shipment_csv) ?? undefined,
    recovered: validateShipmentCsv(inputs.recovered_shipment_csv) ?? undefined,
  };
}

function validateComplaint(intake: IncidentIntake): string | null {
  if (
    !intake.firstComplaintId.trim() ||
    !intake.product.trim() ||
    !intake.lot.trim() ||
    !intake.defect.trim() ||
    !intake.severity.trim()
  ) {
    return "Complaint id, product, lot, defect, and severity are required.";
  }
  if (intake.complaintCount < 1) {
    return "Complaint count must be at least 1.";
  }
  return null;
}

function validateShipmentCsv(csvText: string): string | null {
  try {
    parseShipmentRows(csvText);
    return null;
  } catch (exc) {
    return exc instanceof Error ? exc.message : "Shipment CSV is invalid.";
  }
}

function hasIntakeErrors(errors: IntakeErrors): boolean {
  return Boolean(errors.complaint || errors.shipment || errors.recovered);
}

function shipmentSummary(csvText: string): string {
  try {
    const rows = parseShipmentRows(csvText);
    const units = rows.reduce((total, row) => total + row.units, 0);
    const missing = rows.filter((row) => row.status !== "traced").length;
    return `${rows.length} rows / ${units.toLocaleString()} units / ${missing} missing`;
  } catch {
    return "CSV not ready";
  }
}

function parseShipmentRows(
  csvText: string,
): { status: string; units: number }[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("Shipment CSV needs a header and at least one row.");
  }

  const headers = lines[0].split(",").map((header) => header.trim());
  const required = [
    "source",
    "distributor",
    "region",
    "customers",
    "units",
    "status",
  ];
  for (const header of required) {
    if (!headers.includes(header)) {
      throw new Error(`Shipment CSV is missing ${header}.`);
    }
  }

  const statusIndex = headers.indexOf("status");
  const unitsIndex = headers.indexOf("units");
  const customersIndex = headers.indexOf("customers");
  return lines.slice(1).map((line, index) => {
    const cells = line.split(",").map((cell) => cell.trim());
    const status = cells[statusIndex]?.toLowerCase() ?? "";
    if (status !== "traced" && status !== "missing") {
      throw new Error(`Shipment row ${index + 2} must be traced or missing.`);
    }
    const units = Number.parseInt(cells[unitsIndex] ?? "", 10);
    const customers = Number.parseInt(cells[customersIndex] ?? "", 10);
    if (
      !Number.isFinite(units) ||
      units <= 0 ||
      !Number.isFinite(customers) ||
      customers <= 0
    ) {
      throw new Error(
        `Shipment row ${index + 2} needs positive customers and units.`,
      );
    }
    return { status, units };
  });
}
