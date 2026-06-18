import { apiBase, integrationClaims } from "../recall-data";
import ProofLabel from "../proof-label";
import SiteNav from "../site-nav";

const normalizedActionBranches = [
  {
    label: "SAP",
    capability: "Tenant-shaped recall hold payload",
    evidence: "Sandbox read plus dry-run payload",
    mutation: "Gated write",
  },
  {
    label: "Oracle",
    capability: "Oracle-shaped hold contract",
    evidence: "Generated dry-run payload",
    mutation: "Gated write",
  },
  {
    label: "Regulators",
    capability: "Jurisdiction-shaped filing pack",
    evidence: "Draft dispatch targets",
    mutation: "Submission gated",
  },
  {
    label: "Band",
    capability: "Agent-room coordination proof",
    evidence: "Captured room IDs and handoffs",
    mutation: "Captured proof",
  },
];

export default function IntegrationsPage() {
  return (
    <main className="command-shell clean-integrations-page">
      <SiteNav active="integrations" />

      <section className="page-hero compact-page-hero clean-page-hero">
        <div>
          <p className="section-kicker">Integrations</p>
          <h1>One approved recall action, clear system boundaries.</h1>
          <p>
            RecallOps shows what each integration can do today, what evidence
            supports it, and what remains gated before any real tenant write or
            regulator submission.
          </p>
        </div>
        <ProofLabel status="GATED">
          tenant writes require authorization
        </ProofLabel>
      </section>

      <section className="normalized-action-diagram clean-action-diagram">
        <div>
          <p className="section-kicker">Normalized action</p>
          <h2>
            Human approval comes first. System-specific actions branch after.
          </h2>
          <p>
            The same recall scope becomes SAP, Oracle, regulator, and audit
            artifacts without pretending every branch has the same live status.
          </p>
        </div>
        <div className="action-branch-map clean-branch-map">
          <strong>Human-approved recall action</strong>
          <div>
            {normalizedActionBranches.map((branch) => (
              <article key={branch.label}>
                <span>{branch.label}</span>
                <p>{branch.capability}</p>
                <code>{branch.mutation}</code>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="clean-integration-table"
        aria-label="Integration status matrix"
      >
        <div className="clean-table-head">
          <span>Integration</span>
          <span>Capability</span>
          <span>Evidence</span>
          <span>Boundary</span>
        </div>
        {integrationClaims.map((claim) => (
          <article key={claim.name}>
            <div>
              <ProofLabel status={claim.status}>{claim.name}</ProofLabel>
            </div>
            <strong>{claim.headline}</strong>
            <p>{claim.detail}</p>
            <code>
              {claim.status === "GATED"
                ? "Requires authorization"
                : claim.status === "DRY RUN"
                  ? "No tenant write"
                  : claim.status.toLowerCase()}
            </code>
          </article>
        ))}
      </section>

      <section className="landing-final-cta clean-final-cta">
        <div>
          <p className="section-kicker">Verify</p>
          <h2>Inspect the receipts behind each claim.</h2>
          <p>
            Start with the audit packet for the full proof chain, or open the
            live SAP sandbox and enterprise dry-run endpoints directly.
          </p>
        </div>
        <div className="landing-final-actions">
          <a className="primary-action" href="/proof">
            Inspect proof
          </a>
          <a className="secondary-action" href={`${apiBase}/sap-api-hub`}>
            SAP sandbox
          </a>
          <a className="secondary-action" href={`${apiBase}/enterprise-sync`}>
            ERP dry-run
          </a>
        </div>
      </section>
    </main>
  );
}
