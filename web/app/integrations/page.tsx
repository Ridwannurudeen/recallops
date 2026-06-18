import EnterpriseReadiness from "../enterprise-readiness";
import {
  apiBase,
  integrationClaims,
  proofStatusDefinitions,
} from "../recall-data";
import ProofLabel from "../proof-label";
import SiteNav from "../site-nav";

export default function IntegrationsPage() {
  return (
    <main className="command-shell">
      <SiteNav active="integrations" />

      <section className="page-hero compact-page-hero">
        <div>
          <p className="section-kicker">Integrations</p>
          <h1>One recall-hold action, clear proof boundaries.</h1>
          <p>
            SAP and Oracle are shown as branches of the same normalized recall
            action. RecallOps distinguishes dry-run payloads, transport
            receipts, sandbox reads, live tenant gaps, and admin-gated writes
            instead of compressing them into one vague integration claim.
          </p>
        </div>
        <ProofLabel status="GATED">
          tenant write authorization required
        </ProofLabel>
      </section>

      <section className="integration-status-grid">
        {integrationClaims.map((claim) => (
          <article key={claim.name}>
            <ProofLabel status={claim.status}>{claim.name}</ProofLabel>
            <h2>{claim.headline}</h2>
            <p>{claim.detail}</p>
          </article>
        ))}
      </section>

      <section className="integration-branches">
        <article>
          <span>SAP branch</span>
          <h2>Dry-run hold payload plus sandbox read.</h2>
          <p>
            RecallOps prepares a tenant-shaped SAP hold request from the
            human-signed recall action, verifies the SAP API Hub sandbox, and
            keeps real writes behind an admin key.
          </p>
          <a href={`${apiBase}/sap-api-hub`}>Open SAP sandbox proof</a>
        </article>
        <article>
          <span>Oracle branch</span>
          <h2>Same normalized action, Oracle-shaped contract.</h2>
          <p>
            The Oracle path receives the same recall scope, regions, notices,
            traceability state, and approval basis without pretending a demo
            tenant has granted administrative write access.
          </p>
          <a href={`${apiBase}/enterprise-sync`}>Open dry-run payload</a>
        </article>
      </section>

      <section className="proof-label-system">
        <div>
          <p className="section-kicker">Proof label system</p>
          <h2>Every proof surface says what it is.</h2>
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

      <EnterpriseReadiness apiBase={apiBase} />
    </main>
  );
}
