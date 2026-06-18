"use client";

import { useEffect, useMemo, useState } from "react";
import { apiBase, packet, shortHash } from "../recall-data";
import ProofLabel from "../proof-label";

type Verification = {
  ok: boolean;
  algorithm: string;
  expected_hash: string;
  actual_hash: string;
};

type SubmissionProof = {
  proof_kind: string;
  run_partner_ai: boolean;
  links: Record<string, string>;
  submission_gates: Record<string, string>;
  packet: {
    room_id: string;
    incident_id: string;
    decision: Record<string, unknown>;
    audit_hash: string;
    verification: Verification;
  };
  source_evidence: {
    audit_hash: string;
    initial_traceability: Record<string, unknown>;
    final_traceability: Record<string, unknown>;
    missing_sources: string[];
    partner_ai: Record<string, unknown>;
    verification: Verification;
  };
  rule_assessment: Record<string, unknown>;
  recall_room_run: {
    run_hash: string;
    verification: Verification;
    band: {
      mode: string;
      participant_count: number;
    };
  };
  filing_pack: {
    pack_hash: string;
    verification: Verification;
    filings: Record<string, unknown>[];
  };
  regulator_dispatch: {
    mode: string;
    targets: Record<string, unknown>[];
  };
  dispatch_receipts: Record<string, unknown>[];
  enterprise_sync: {
    mode?: string;
    targets?: Record<string, unknown>[];
  };
  identity: Record<string, unknown>;
  erp_contract: Record<string, unknown>;
  sap_api_hub: Record<string, unknown>;
  production_readiness: Record<string, unknown>;
  approval_receipt: {
    receipt: Record<string, unknown>;
    verification: Verification;
    disclosure: string;
  };
  band: {
    captured_run: {
      room_id: string;
      participant_count: number;
      context_items: number;
      risk_veto_id: string;
      communications_notice_id: string;
    };
    fresh_run_status: Record<string, unknown>;
  };
  checks: Record<string, boolean | number>;
};

type ProofStage = {
  label: string;
  status: "verified" | "review" | "gated";
  summary: string;
  proves: string;
  boundary: string;
  value: string;
  raw: unknown;
};

const emptySummary = [
  { label: "Source", value: "loading" },
  { label: "Room", value: "loading" },
  { label: "Approval", value: "loading" },
  { label: "Digest", value: shortHash(packet.audit_hash, 8) },
];

export default function ProofExplorer() {
  const [proof, setProof] = useState<SubmissionProof | null>(null);
  const [verify, setVerify] = useState<Verification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [runningProviderProof, setRunningProviderProof] = useState(false);

  useEffect(() => {
    async function loadProof() {
      try {
        const response = await fetch(`${apiBase}/submission-proof`, {
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.detail ?? "Unable to load proof bundle.");
        }
        setProof(body as SubmissionProof);
      } catch (exc) {
        setError(
          exc instanceof Error ? exc.message : "Unable to load proof bundle.",
        );
      }
    }
    void loadProof();
  }, []);

  const digest = proof?.packet.audit_hash ?? packet.audit_hash;

  const summaryItems = proof
    ? [
        {
          label: "Source",
          value: proof.source_evidence.verification.ok ? "verified" : "review",
        },
        {
          label: "Room",
          value: `${proof.recall_room_run.band.mode.replaceAll("_", " ")} / ${proof.recall_room_run.band.participant_count}`,
        },
        {
          label: "Approval",
          value: proof.approval_receipt.verification.ok ? "verified" : "review",
        },
        { label: "Digest", value: shortHash(digest, 8) },
      ]
    : emptySummary;

  const stages = useMemo<ProofStage[]>(() => {
    if (!proof) {
      return [];
    }

    return [
      {
        label: "Source evidence",
        status: proof.source_evidence.verification.ok ? "verified" : "review",
        summary:
          "Complaint, shipment ledger, recovered distributor file, citations, and source digest.",
        proves:
          "The case facts can be traced back to the supplied evidence packet.",
        boundary: "It does not prove a customer ERP tenant accepted a write.",
        value: proof.source_evidence.audit_hash,
        raw: proof.source_evidence,
      },
      {
        label: "Analysis",
        status: proof.recall_room_run.verification.ok ? "verified" : "review",
        summary:
          "Traceability math, room run, Band mode, and participant count.",
        proves: "Coverage and room narrative were derived from the packet.",
        boundary:
          "Captured or deterministic room evidence is not a silent legal decision.",
        value: proof.recall_room_run.run_hash,
        raw: proof.recall_room_run,
      },
      {
        label: "Decision hold",
        status: proof.packet.verification.ok ? "verified" : "review",
        summary: "HOLD-01, recovery, clearance, and BAT-4421 decision graph.",
        proves: "The blocker and recovery sequence are present in the packet.",
        boundary:
          "The hold supports review; it does not replace the recall owner.",
        value: proof.packet.incident_id,
        raw: proof.packet.decision,
      },
      {
        label: "Human authority",
        status: proof.approval_receipt.verification.ok ? "verified" : "review",
        summary: proof.approval_receipt.disclosure,
        proves:
          "The approval receipt binds signer, reason, scope, and source hash.",
        boundary:
          "Public demo approval remains gated by the configured identity path.",
        value: String(
          proof.approval_receipt.receipt.receipt_hash ?? "receipt pending",
        ),
        raw: proof.approval_receipt,
      },
      {
        label: "Downstream action",
        status: proof.checks.erp_contract_live_write_verified
          ? "verified"
          : "gated",
        summary: `${proof.filing_pack.filings.length} filing drafts and ${proof.regulator_dispatch.targets.length} regulator targets prepared.`,
        proves:
          "Filing and SAP/Oracle payloads can be generated from the approved action.",
        boundary: "Real tenant writes and regulator submissions remain gated.",
        value: String(
          proof.erp_contract.latest_pair_verified ?? "tenant write gated",
        ),
        raw: {
          filing_pack: proof.filing_pack,
          regulator_dispatch: proof.regulator_dispatch,
          enterprise_sync: proof.enterprise_sync,
          erp_contract: proof.erp_contract,
        },
      },
      {
        label: "Receipts",
        status: proof.packet.verification.ok ? "verified" : "review",
        summary:
          "Band IDs, ERP transport receipts, provider controls, and final SHA-256 digest.",
        proves: "The final packet digest can be independently compared.",
        boundary:
          "Provider and tenant availability can change after the captured packet.",
        value: proof.packet.audit_hash,
        raw: {
          band: proof.band,
          dispatch_receipts: proof.dispatch_receipts,
          checks: proof.checks,
        },
      },
    ];
  }, [proof]);

  async function verifyChain() {
    const response = await fetch(`${apiBase}/verify`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) {
      setError(body.detail ?? "Verify chain failed.");
      return;
    }
    setVerify(body as Verification);
  }

  async function runProviderProof() {
    setRunningProviderProof(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/submission-proof`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ run_partner_ai: true }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.detail ?? "Provider proof failed.");
      }
      setProof(body as SubmissionProof);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Provider proof failed.");
    } finally {
      setRunningProviderProof(false);
    }
  }

  async function copyDigest() {
    await navigator.clipboard.writeText(digest);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section
      className="proof-explorer clean-proof-explorer"
      id="structured-proof"
    >
      <div className="proof-explorer-head clean-proof-head">
        <div>
          <p className="section-kicker">Audit packet</p>
          <h1>Follow the decision from source to receipt.</h1>
          <p>
            This page starts with the human-readable chain. Raw JSON and hash
            checks remain one click away for auditors.
          </p>
        </div>
        <div className="proof-digest-card">
          <ProofLabel status="LIVE">deployed endpoint</ProofLabel>
          <span>Final digest</span>
          <code>{shortHash(digest, 16)}</code>
        </div>
      </div>

      <div className="clean-proof-summary" aria-label="Proof summary">
        {summaryItems.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="proof-actions clean-proof-actions">
        <button type="button" onClick={verifyChain}>
          Verify chain
        </button>
        <button type="button" onClick={copyDigest}>
          {copied ? "Digest copied" : "Copy digest"}
        </button>
        <a href={`${apiBase}/packet.json`}>Download packet</a>
        <a href={`${apiBase}/submission-proof`}>Raw JSON</a>
        <button
          type="button"
          disabled={runningProviderProof}
          onClick={runProviderProof}
        >
          {runningProviderProof ? "Running providers" : "Run provider proof"}
        </button>
      </div>

      {verify ? (
        <div
          className={`verify-result ${verify.ok ? "verify-ok" : "verify-warn"}`}
        >
          <strong>{verify.ok ? "Digest verified" : "Digest mismatch"}</strong>
          <code>{verify.actual_hash}</code>
        </div>
      ) : null}
      {error ? <p className="runner-error">{error}</p> : null}

      {!proof && !error ? (
        <div className="proof-loading-skeleton" aria-live="polite">
          <strong>Loading audit packet</strong>
          <p>
            Fetching source evidence, room proof, approval receipt, downstream
            actions, and final digest from the deployed endpoint.
          </p>
        </div>
      ) : null}

      <div className="clean-proof-timeline">
        {stages.map((stage, index) => (
          <article
            className={`clean-proof-stage stage-${stage.status}`}
            key={stage.label}
          >
            <div className="clean-proof-index">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div>
              <span>{stage.label}</span>
              <strong>{stage.summary}</strong>
              <dl>
                <div>
                  <dt>Proves</dt>
                  <dd>{stage.proves}</dd>
                </div>
                <div>
                  <dt>Does not prove</dt>
                  <dd>{stage.boundary}</dd>
                </div>
              </dl>
              <code>{stage.value}</code>
              <details>
                <summary>View structured data</summary>
                <pre>{JSON.stringify(stage.raw, null, 2)}</pre>
              </details>
            </div>
          </article>
        ))}
      </div>

      {proof ? (
        <details className="clean-advanced-proof">
          <summary>Submission gates and low-level checks</summary>
          <div className="proof-structured-panels">
            <article>
              <span>Submission gates</span>
              {Object.entries(proof.submission_gates).map(([key, value]) => (
                <div key={key}>
                  <strong>{key.replaceAll("_", " ")}</strong>
                  <code>{value}</code>
                </div>
              ))}
            </article>
            <article>
              <span>Checks</span>
              {Object.entries(proof.checks).map(([key, value]) => (
                <div key={key}>
                  <strong>{key.replaceAll("_", " ")}</strong>
                  <code>{String(value)}</code>
                </div>
              ))}
            </article>
          </div>
        </details>
      ) : null}
    </section>
  );
}
