import {
  apiBase,
  packet,
  proofStatusDefinitions,
  shortHash,
} from "../recall-data";
import ProofLabel from "../proof-label";
import SiteNav from "../site-nav";

const trustControls = [
  {
    label: "Identity",
    headline: "Approval identity is explicit.",
    copy: "Approval receipts bind signer, reason, scope, source hash, room hash, and filing hash. Public approval remains gated unless the configured identity path authorizes it.",
    status: "GATED" as const,
  },
  {
    label: "Hashing",
    headline: "Packets and receipts are digest-verifiable.",
    copy: "Source evidence, recall room output, filing pack, approval receipt, and final packet expose values that can be compared independently.",
    status: "DETERMINISTIC" as const,
  },
  {
    label: "ERP gates",
    headline: "Tenant writes are not implied.",
    copy: "SAP and Oracle actions remain dry-run or gated until customer endpoints and administrative authorization are configured.",
    status: "GATED" as const,
  },
  {
    label: "Provider boundaries",
    headline: "Optional AI providers are disclosed.",
    copy: "Partner-AI paths run behind spend controls and response hashes. Deterministic parsing remains the public proof source of truth.",
    status: "LIVE" as const,
  },
];

export default function SecurityPage() {
  return (
    <main className="command-shell clean-security-page">
      <SiteNav active="trust" />

      <section className="page-hero compact-page-hero clean-page-hero">
        <div>
          <p className="section-kicker">Security</p>
          <h1>Proof first. No unsupported compliance theater.</h1>
          <p>
            RecallOps avoids fake certifications and vague slogans. It shows
            identity gates, hashing, redaction, provider status, and
            tenant-write boundaries directly.
          </p>
        </div>
        <div className="proof-digest-card">
          <ProofLabel status="DETERMINISTIC">packet digest</ProofLabel>
          <code>{shortHash(packet.audit_hash, 16)}</code>
        </div>
      </section>

      <section className="clean-trust-grid">
        {trustControls.map((control) => (
          <article key={control.label}>
            <ProofLabel status={control.status}>{control.label}</ProofLabel>
            <h2>{control.headline}</h2>
            <p>{control.copy}</p>
          </article>
        ))}
      </section>

      <section className="clean-security-split">
        <article>
          <span>Public demo proves</span>
          <p>
            Captured Band IDs, deterministic packet verification, source packet
            verification, SAP sandbox read verification, approval receipt
            hashing, ERP receiver receipts, and dry-run enterprise payloads.
          </p>
        </article>
        <article>
          <span>Still requires authorization</span>
          <p>
            Real customer ERP writes, production identity policy, tenant
            endpoint configuration, data-processing review, and regulator
            submission.
          </p>
        </article>
      </section>

      <section className="proof-label-system clean-status-vocabulary">
        <div>
          <p className="section-kicker">Status language</p>
          <h2>The label is part of the control.</h2>
        </div>
        <div>
          {proofStatusDefinitions.map((definition) => (
            <article key={definition.status}>
              <ProofLabel status={definition.status} />
              <p>{definition.meaning}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
