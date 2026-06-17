"use client";

import { useEffect, useState } from "react";

type SourceInputs = {
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
  configured: boolean;
  used: boolean;
  role: string;
};

type SourceEvidencePacket = {
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

type Verification = {
  ok: boolean;
  algorithm: string;
  expected_hash: string;
  actual_hash: string;
};

type SourceEvidenceResponse = {
  inputs: SourceInputs;
  packet: SourceEvidencePacket;
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

const EMPTY_INPUTS: SourceInputs = {
  complaint_text: "",
  shipment_csv: "",
  recovered_shipment_csv: "",
};

export default function SourceEvidenceCockpit({
  apiBase,
}: {
  apiBase: string;
}) {
  const [inputs, setInputs] = useState<SourceInputs>(EMPTY_INPUTS);
  const [evidence, setEvidence] = useState<SourceEvidenceResponse | null>(null);
  const [receipt, setReceipt] = useState<ApprovalReceiptResponse | null>(null);
  const [approver, setApprover] = useState("QA Director");
  const [reason, setReason] = useState(
    "Traceability reached 100% and the risk veto cleared.",
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
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Source evidence failed.");
    } finally {
      setLoading(false);
    }
  }

  async function recompute() {
    setLoading(true);
    setError(null);
    setReceipt(null);
    try {
      const response = await fetch(`${apiBase}/source-evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(inputs),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.detail ?? "Source evidence failed.");
      }
      setEvidence(body as SourceEvidenceResponse);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Source evidence failed.");
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
  }

  useEffect(() => {
    void loadEvidence();
  }, []);

  return (
    <section className="panel source-cockpit">
      <div className="panel-head">
        <div>
          <p className="kicker">source-grounded evidence</p>
          <h2>Computed packet, cited rows</h2>
        </div>
        <span className={evidence?.verification.ok ? "mono-stat" : "risk-stat"}>
          {evidence?.verification.ok ? "verified" : "pending"}
        </span>
      </div>

      <div className="source-grid">
        <article className="source-inputs">
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
                updateInput("recovered_shipment_csv", event.currentTarget.value)
              }
            />
          </label>
          <div className="source-actions">
            <button type="button" disabled={loading} onClick={recompute}>
              {loading ? "computing" : "recompute"}
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
                    <strong>
                      {provider.configured ? "configured" : "offline"}
                    </strong>
                    <small>{provider.used ? "used" : provider.role}</small>
                  </div>
                ),
              )}
            </div>
          </article>
        ) : null}
      </div>

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
              approve packet
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
