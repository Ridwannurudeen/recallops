import {
  apiBase,
  packet,
  proofStatusDefinitions,
  shortHash,
} from "../recall-data";
import ProofLabel from "../proof-label";
import SiteNav from "../site-nav";

const trustRows = [
  {
    label: "Source hashing",
    status: "DETERMINISTIC" as const,
    proves:
      "The BAT-4421 source packet can be recomputed into the displayed digest.",
    boundary:
      "It does not prove a customer tenant accepted a production action.",
  },
  {
    label: "Human approval",
    status: "GATED" as const,
    proves:
      "Approval receipts bind a named signer, reason, source hash, room hash, and filing hash.",
    boundary: "The demo does not make the software the legal recall owner.",
  },
  {
    label: "Band room evidence",
    status: "CAPTURED" as const,
    proves:
      "The packet references captured room, participant, handoff, hold, and notice IDs.",
    boundary: "Captured Band evidence is not presented as a current live room.",
  },
  {
    label: "ERP actions",
    status: "GATED" as const,
    proves:
      "SAP and Oracle payloads are shaped from the same approved recall action.",
    boundary:
      "Tenant writes require configured endpoints and admin authorization.",
  },
];

export default function TrustPage() {
  return (
    <main className="command-shell">
      <SiteNav active="trust" />

      <section className="page-hero compact-page-hero">
        <div>
          <p className="section-kicker">Trust Center</p>
          <h1>Every claim says what it proves and what it does not.</h1>
          <p>
            RecallOps separates live checks, captured proof, deterministic
            replay, dry runs, gated writes, and simulated behavior so auditors
            can follow the decision without accepting vague product claims.
          </p>
        </div>
        <div className="proof-digest-card">
          <ProofLabel status="DETERMINISTIC">final packet digest</ProofLabel>
          <code>{shortHash(packet.audit_hash, 16)}</code>
        </div>
      </section>

      <section className="trust-control-grid">
        {trustRows.map((row) => (
          <article key={row.label}>
            <ProofLabel status={row.status}>{row.label}</ProofLabel>
            <h2>What it proves</h2>
            <p>{row.proves}</p>
            <h2>What it does not prove</h2>
            <p>{row.boundary}</p>
          </article>
        ))}
      </section>

      <section className="proof-label-system">
        <div>
          <p className="section-kicker">Status vocabulary</p>
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

      <section className="landing-final-cta">
        <div>
          <p className="section-kicker">Verification path</p>
          <h2>Inspect the packet, then inspect the controls.</h2>
          <p>
            Start with the public proof bundle, then review the security page
            for identity, redaction, admin authorization, provider boundaries,
            and tenant-write gates.
          </p>
        </div>
        <div className="landing-final-actions">
          <a className="primary-action" href="/proof">
            Inspect proof
          </a>
          <a className="secondary-action" href="/security">
            Security controls
          </a>
          <a className="secondary-action" href={`${apiBase}/submission-proof`}>
            Raw proof JSON
          </a>
        </div>
      </section>
    </main>
  );
}
