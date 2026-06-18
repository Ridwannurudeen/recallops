"use client";

import { useEffect, useMemo, useState } from "react";
import {
  apiBase,
  packet,
  proofExplorerSections,
  shortHash,
} from "../recall-data";
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
      return proofExplorerSections.map((section) => ({
        label: section,
        status: "warn",
        detail: "Loading deployed proof endpoint.",
        value: "pending",
      }));
    }

    return [
      {
        label: "Band room",
        status: proof.checks.captured_band_has_five_agents ? "ok" : "warn",
        detail: `${proof.band.captured_run.participant_count} captured agents, ${proof.band.captured_run.context_items} context items.`,
        value: proof.band.captured_run.room_id,
      },
      {
        label: "Source packet",
        status: proof.source_evidence.verification.ok ? "ok" : "warn",
        detail:
          "Complaint, shipment CSV, recovered distributor file, citations.",
        value: proof.source_evidence.audit_hash,
      },
      {
        label: "Recall room run",
        status: proof.recall_room_run.verification.ok ? "ok" : "warn",
        detail: `${proof.recall_room_run.band.mode.replaceAll("_", " ")} with ${proof.recall_room_run.band.participant_count} Band agents referenced.`,
        value: proof.recall_room_run.run_hash,
      },
      {
        label: "Filing pack",
        status: proof.filing_pack.verification.ok ? "ok" : "warn",
        detail: `${proof.filing_pack.filings.length} regulator, distributor, and applicability drafts from the source packet.`,
        value: proof.filing_pack.pack_hash,
      },
      {
        label: "Decision events",
        status: proof.packet.verification.ok ? "ok" : "warn",
        detail: "Deterministic BAT-4421 room replay with hash verification.",
        value: proof.packet.incident_id,
      },
      {
        label: "Veto and approval",
        status: proof.approval_receipt.verification.ok ? "ok" : "warn",
        detail: proof.approval_receipt.disclosure,
        value: String(
          proof.approval_receipt.receipt.receipt_hash ?? "receipt pending",
        ),
      },
      {
        label: "Notices",
        status: proof.checks.dispatch_receipts_prepared ? "ok" : "warn",
        detail: "Regulator, customer, and warehouse notices prepared.",
        value: `${proof.dispatch_receipts.length} receipts`,
      },
      {
        label: "Identity gate",
        status: proof.checks.identity_gate_ready ? "ok" : "gated",
        detail:
          "Approval identity is disclosed as ready, admin-gated, or demo-only.",
        value: String(
          proof.identity.approval_gate_ready ?? "approval gate status unknown",
        ),
      },
      {
        label: "SAP and Oracle contracts",
        status: proof.checks.erp_contract_live_write_verified ? "ok" : "gated",
        detail: "Transport receiver receipts are separate from tenant writes.",
        value: String(
          proof.erp_contract.latest_pair_verified ??
            "contract verification unknown",
        ),
      },
      {
        label: "Provider receipts",
        status: proof.checks.partner_ai_used_both ? "ok" : "warn",
        detail: proof.checks.partner_ai_used_both
          ? "Partner AI usage is counted and disclosed, not hidden."
          : "Default proof avoids spend; run provider proof to invoke both adapters.",
        value: `${proof.checks.partner_ai_used_count} provider calls`,
      },
      {
        label: "Spend controls",
        status: "ok",
        detail: "Partner AI calls run behind daily limits and cooldowns.",
        value: JSON.stringify(proof.production_readiness).slice(0, 92),
      },
      {
        label: "Final SHA-256 digest",
        status: proof.packet.verification.ok ? "ok" : "warn",
        detail: `${proof.packet.verification.algorithm} verification result.`,
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
          <p className="section-kicker">Submission Proof</p>
          <h1>Every claim gets a status label and a receipt.</h1>
          <p>
            This page turns the deployed proof bundle into a readable packet:
            Band room, source digest, veto, approval, notices, ERP contracts,
            provider receipts, spend controls, and final SHA-256 digest.
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
