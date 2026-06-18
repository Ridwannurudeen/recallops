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
    headline: "Approval identity is sealed into the receipt.",
    copy: "The deployed API supports admin-key and OIDC/JWKS approval gates. The public proof bundle discloses whether the gate is ready instead of hiding behind a generic approval label.",
    status: "GATED" as const,
  },
  {
    label: "Hashing",
    headline: "Packets and receipts are digest-verifiable.",
    copy: "The deterministic packet, source evidence packet, approval receipt, and ERP transport receipts expose expected and actual SHA-256 verification values.",
    status: "DETERMINISTIC" as const,
  },
  {
    label: "Provider boundaries",
    headline: "External AI usage is visible by provider status.",
    copy: "AI/ML API and Featherless paths run through spend controls and response hashes. If a provider is unavailable or unused, the proof says so.",
    status: "LIVE" as const,
  },
  {
    label: "ERP authorization",
    headline: "Tenant writes are not implied.",
    copy: "SAP and Oracle payloads are dry-run unless tenant endpoints and administrative authorization are configured. The receiver contract is separate from customer ERP authority.",
    status: "GATED" as const,
  },
  {
    label: "Redaction",
    headline: "Receipts prove flow without exposing customer data.",
    copy: "Transport receipts keep proof metadata and hashes while avoiding fake customer names, fake tenants, and unnecessary personal data in the public demo.",
    status: "CAPTURED" as const,
  },
];

export default function SecurityPage() {
  return (
    <main className="command-shell">
      <SiteNav active="security" />

      <section className="page-hero compact-page-hero">
        <div>
          <p className="section-kicker">Security and trust</p>
          <h1>Proof first, no unsupported compliance theater.</h1>
          <p>
            RecallOps does not display fake certifications, fake customers, or
            vague security slogans. The product earns trust by showing identity
            gates, hash checks, provider boundaries, redaction rules, and ERP
            authorization state directly.
          </p>
        </div>
        <div className="proof-digest-card">
          <ProofLabel status="DETERMINISTIC">packet digest</ProofLabel>
          <code>{shortHash(packet.audit_hash, 16)}</code>
        </div>
      </section>

      <section className="trust-control-grid">
        {trustControls.map((control) => (
          <article key={control.label}>
            <ProofLabel status={control.status}>{control.label}</ProofLabel>
            <h2>{control.headline}</h2>
            <p>{control.copy}</p>
          </article>
        ))}
      </section>

      <section className="security-principles">
        <article>
          <span>What the public demo proves</span>
          <p>
            Captured Band room IDs, deterministic packet verification, source
            packet verification, SAP sandbox read verification, ERP receiver
            receipts, approval receipt hashing, and dry-run enterprise payloads.
          </p>
        </article>
        <article>
          <span>What remains gated</span>
          <p>
            Real customer ERP writes, production identity policy, tenant
            endpoint configuration, data-processing review, and administrative
            authorization.
          </p>
        </article>
        <article>
          <span>How to inspect it</span>
          <p>
            Open the proof explorer, verify the digest, download the packet, or
            inspect the raw deployed API responses.
          </p>
          <a href={`${apiBase}/submission-proof`}>Open raw proof JSON</a>
        </article>
      </section>

      <section className="proof-label-system">
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
