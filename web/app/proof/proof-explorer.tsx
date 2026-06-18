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

type ProofNode = {
  label: string;
  status: "ok" | "warn" | "gated";
  detail: string;
  value: string;
};

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

  const proofNodes = useMemo<ProofNode[]>(() => {
    if (!proof) {
      return [];
    }

    return [
      {
        label: "Source evidence",
        status: proof.source_evidence.verification.ok ? "ok" : "warn",
        detail:
          "Complaint packet, shipment ledger, recovered distributor file, citations, and source digest.",
        value: proof.source_evidence.audit_hash,
      },
      {
        label: "Analysis",
        status: proof.recall_room_run.verification.ok ? "ok" : "warn",
        detail: `${proof.recall_room_run.band.mode.replaceAll("_", " ")} room run with ${proof.recall_room_run.band.participant_count} participants and traceability checks.`,
        value: proof.recall_room_run.run_hash,
      },
      {
        label: "Decision",
        status: proof.packet.verification.ok ? "ok" : "warn",
        detail:
          "Risk hold, recovery, clearance, and deterministic BAT-4421 decision graph.",
        value: proof.packet.incident_id,
      },
      {
        label: "Human authority",
        status: proof.approval_receipt.verification.ok ? "ok" : "warn",
        detail: proof.approval_receipt.disclosure,
        value: String(
          proof.approval_receipt.receipt.receipt_hash ?? "receipt pending",
        ),
      },
      {
        label: "Downstream action",
        status: proof.checks.erp_contract_live_write_verified ? "ok" : "gated",
        detail: `${proof.filing_pack.filings.length} filing drafts, ${proof.regulator_dispatch.targets.length} regulator targets, and SAP/Oracle payload boundaries.`,
        value: String(
          proof.erp_contract.latest_pair_verified ??
            "contract verification unknown",
        ),
      },
      {
        label: "Receipts",
        status: proof.packet.verification.ok ? "ok" : "warn",
        detail:
          "Band IDs, ERP transport receipts, provider controls, and final SHA-256 digest.",
        value: proof.packet.audit_hash,
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
    <section className="proof-explorer" id="structured-proof">
      <div className="proof-explorer-head">
        <div>
          <p className="section-kicker">Audit packet</p>
          <h1>Verify the decision from source to receipt.</h1>
          <p>
            The proof bundle is organized by causality: source evidence,
            analysis, decision events, human authority, downstream action, and
            receipts. Each item says what it proves and what remains gated.
          </p>
        </div>
        <div className="proof-digest-card">
          <ProofLabel status="LIVE">deployed endpoint</ProofLabel>
          <span>Final digest</span>
          <code>{shortHash(digest, 16)}</code>
        </div>
      </div>

      <div className="proof-actions">
        <a href="#structured-proof">View structured proof</a>
        <a href={`${apiBase}/submission-proof`}>View raw JSON</a>
        <button type="button" onClick={copyDigest}>
          {copied ? "Digest copied" : "Copy digest"}
        </button>
        <button type="button" onClick={verifyChain}>
          Verify chain
        </button>
        <button
          type="button"
          disabled={runningProviderProof}
          onClick={runProviderProof}
        >
          {runningProviderProof ? "Running providers" : "Run provider proof"}
        </button>
        <a href={`${apiBase}/packet.json`}>Download packet</a>
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
            actions, and final digest from the deployed proof endpoint.
          </p>
        </div>
      ) : null}

      <div className="proof-node-grid">
        {proofNodes.map((node) => (
          <article
            className={`proof-node proof-node-${node.status}`}
            key={node.label}
          >
            <span>{node.label}</span>
            <strong>{node.status}</strong>
            <p>{node.detail}</p>
            <code>{node.value}</code>
          </article>
        ))}
      </div>

      {proof ? (
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
      ) : null}
    </section>
  );
}
