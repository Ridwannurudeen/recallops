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
    label: "Human accountability",
    status: "GATED" as const,
    proves:
      "The final action requires a named recall owner and approval reason.",
    boundary:
      "Agents recommend and prepare. They do not own the legal decision.",
  },
  {
    label: "Source integrity",
    status: "DETERMINISTIC" as const,
    proves:
      "Complaint, shipment, recovery, and receipt data can be recomputed into hashes.",
    boundary:
      "A digest proves packet integrity, not real-world product removal by itself.",
  },
  {
    label: "System boundaries",
    status: "GATED" as const,
    proves:
      "SAP, Oracle, regulator, provider, and identity paths disclose their current state.",
    boundary:
      "Customer tenant writes and real submissions remain authorization-gated.",
  },
];

export default function TrustPage() {
  return (
    <main className="command-shell clean-trust-page">
      <SiteNav active="trust" />

      <section className="page-hero compact-page-hero clean-page-hero">
        <div>
          <p className="section-kicker">Trust</p>
          <h1>The system supports the recall decision. A human owns it.</h1>
          <p>
            RecallOps is explicit about proof boundaries: live checks, captured
            room evidence, deterministic replay, dry runs, gated writes, and
            optional provider calls are labelled separately.
          </p>
        </div>
        <div className="proof-digest-card">
          <ProofLabel status="DETERMINISTIC">packet digest</ProofLabel>
          <code>{shortHash(packet.audit_hash, 16)}</code>
        </div>
      </section>

      <section className="clean-trust-grid">
        {trustRows.map((row) => (
          <article key={row.label}>
            <ProofLabel status={row.status}>{row.label}</ProofLabel>
            <h2>What this proves</h2>
            <p>{row.proves}</p>
            <h2>What it does not prove</h2>
            <p>{row.boundary}</p>
          </article>
        ))}
      </section>

      <section className="proof-label-system clean-status-vocabulary">
        <div>
          <p className="section-kicker">Status language</p>
          <h2>Six labels keep the demo honest.</h2>
          <p>
            These labels prevent dry-runs, captures, and deterministic replay
            from being confused with production writes.
          </p>
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

      <section className="landing-final-cta clean-final-cta">
        <div>
          <p className="section-kicker">Audit path</p>
          <h2>
            Start with the proof packet, then inspect raw controls only if
            needed.
          </h2>
          <p>
            The Trust Center explains the boundaries. The proof packet contains
            the digest, receipts, room references, and raw data.
          </p>
        </div>
        <div className="landing-final-actions">
          <a className="primary-action" href="/proof">
            Inspect proof
          </a>
          <a className="secondary-action" href="/security">
            Security details
          </a>
          <a className="secondary-action" href={`${apiBase}/submission-proof`}>
            Raw proof JSON
          </a>
        </div>
      </section>
    </main>
  );
}
