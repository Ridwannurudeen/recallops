import Bat4421Replay from "./bat-4421-replay";
import {
  accountableHuman,
  apiBase,
  integrationClaims,
  packet,
  proofStatusDefinitions,
  roomResponsibilities,
  shortHash,
} from "./recall-data";
import ProofLabel from "./proof-label";
import SiteNav from "./site-nav";

const productSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "RecallOps",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://recallops.gudman.xyz",
  description:
    "Product-recall command system that coordinates source evidence, traceability, accountable human approval, ERP-ready actions, and verifiable receipts.",
  featureList: [
    "Source-linked incident evidence",
    "Traceability coverage calculation",
    "Operational hold and recovery events",
    "Human-owned approval receipts",
    "SAP and Oracle dry-run payloads",
    "Hash-linked audit packet",
  ],
};

const decisionSpine = [
  "SOURCE",
  "FACT",
  "HOLD",
  "RECOVERY",
  "CLEARANCE",
  "APPROVAL",
  "RECEIPT",
];

const proofHealth = [
  {
    label: "Source packet",
    status: "DETERMINISTIC" as const,
    value: shortHash(packet.audit_hash, 10),
  },
  {
    label: "Band room",
    status: "CAPTURED" as const,
    value: packet.band_proof.captured_band_run.room_id,
  },
  {
    label: "Human approval",
    status: "GATED" as const,
    value: "QA Director required",
  },
  {
    label: "ERP actions",
    status: "DRY RUN" as const,
    value: "SAP + Oracle payloads",
  },
];

const recallBreakpoints = [
  "Complaint evidence lives in documents.",
  "Shipment coverage lives in CSVs.",
  "Risk review happens in meetings.",
  "Approval disappears into email.",
  "ERP holds become a separate handoff.",
];

export default function Home() {
  return (
    <main className="command-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <SiteNav active="product" />

      <section className="hero-section hero-section-redesign">
        <div className="hero-copy-v2 hero-copy-operational">
          <p className="section-kicker">Product recall command system</p>
          <h1 className="hero-title">Run the recall. Prove the decision.</h1>
          <p className="hero-lede">
            Turn complaints, shipment records, traceability, regulatory review,
            communications, and ERP-ready actions into one source-linked,
            human-approved decision chain.
          </p>
          <div className="hero-actions-v2">
            <a className="primary-action" href="/demo/bat-4421">
              Run BAT-4421
            </a>
            <a className="secondary-action" href="/proof">
              Inspect a verified packet
            </a>
          </div>
          <a className="quiet-link" href="/app">
            Open command room
          </a>
          <p className="trust-line">
            Source-grounded / Human-approved / ERP-gated
          </p>
        </div>

        <Bat4421Replay packet={packet} variant="hero" apiBase={apiBase} />
      </section>

      <section className="decision-spine" aria-label="RecallOps decision chain">
        {decisionSpine.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </section>

      <section className="proof-health-strip">
        {proofHealth.map((item) => (
          <article key={item.label}>
            <ProofLabel status={item.status}>{item.label}</ProofLabel>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="fragmented-section">
        <div>
          <p className="section-kicker">Why recalls break</p>
          <h2>Recalls break when the decision trail breaks.</h2>
          <p>
            RecallOps brings evidence, traceability, risk, communications, human
            approval, and downstream action into one inspectable case record.
          </p>
        </div>
        <div className="surface-chain" aria-label="Fragmented recall work">
          {recallBreakpoints.map((surface, index) => (
            <div key={surface}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{surface}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="room-section">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Authority model</p>
            <h2>Five specialist agents. One accountable human.</h2>
            <p>
              Agents assemble, challenge, calculate, draft, and recommend. The
              named QA Director reviews and authorizes the final recall action.
            </p>
          </div>
          <ProofLabel status="CAPTURED">Band room proof exposed</ProofLabel>
        </div>
        <div className="responsibility-grid">
          {roomResponsibilities.map((item) => (
            <article key={item.role}>
              <span>{item.authority}</span>
              <strong>{item.role}</strong>
              <p>{item.assignment}</p>
            </article>
          ))}
          <article className="human-authority-card">
            <span>{accountableHuman.authority}</span>
            <strong>{accountableHuman.role} - human</strong>
            <p>{accountableHuman.assignment}</p>
          </article>
        </div>
      </section>

      <section className="story-split">
        <article className="veto-feature">
          <span>Blocked</span>
          <h2>864 units remain untraced.</h2>
          <p>
            Regulatory/Risk raises HOLD-01 because the consumer-notice scope
            cannot be defended at 82% coverage.
          </p>
          <strong>Approval unavailable</strong>
        </article>
        <article className="recovery-feature">
          <span>Recovered</span>
          <h2>Kestrel distributor file enters the source packet.</h2>
          <p>
            The missing ledger accounts for 864 units, recomputes coverage to
            100%, and changes the source digest.
          </p>
          <code>{shortHash(packet.receipts[6].receipt_hash, 14)}</code>
        </article>
        <article className="approval-feature">
          <span>Approved</span>
          <h2>The human approves a specific recall action.</h2>
          <p>
            Scope, regions, notices, quarantine action, ERP payloads, remaining
            exceptions, and source hash are sealed into the receipt.
          </p>
          <a href="/demo/bat-4421">Replay the decision</a>
        </article>
      </section>

      <section className="proof-preview">
        <div>
          <p className="section-kicker">Verify</p>
          <h2>A validated quality dossier, not a black-box chatbot.</h2>
          <p>
            The proof explorer groups the packet by source evidence, command
            room, decision events, human authority, downstream actions, and
            final receipts. Raw JSON stays available when the auditor needs it.
          </p>
          <a className="primary-action" href="/proof">
            Inspect proof
          </a>
        </div>
        <div className="proof-preview-list">
          {proofStatusDefinitions.map((definition) => (
            <span key={definition.status}>
              {definition.status}: {definition.meaning}
            </span>
          ))}
        </div>
      </section>

      <section className="integration-preview">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Integrations</p>
            <h2>One approved recall action branches into gated systems.</h2>
            <p>
              Band, SAP, Oracle, regulator filing, identity, and provider checks
              keep separate status labels so dry runs do not look like
              customer-tenant writes.
            </p>
          </div>
          <a className="secondary-action" href="/integrations">
            View integration status
          </a>
        </div>
        <div className="integration-preview-grid">
          {integrationClaims.slice(0, 6).map((claim) => (
            <article key={claim.name}>
              <ProofLabel status={claim.status}>{claim.name}</ProofLabel>
              <strong>{claim.headline}</strong>
              <p>{claim.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final-cta">
        <div>
          <p className="section-kicker">Operate</p>
          <h2>Open the command room when you need to manage a case.</h2>
          <p>
            The application keeps the current decision state, blocker, next
            action, approval boundary, and audit exports in one operating
            surface.
          </p>
        </div>
        <div className="landing-final-actions">
          <a className="primary-action" href="/app">
            Open command room
          </a>
          <a className="secondary-action" href="/demo/bat-4421">
            Run BAT-4421
          </a>
          <a className="secondary-action" href="/trust">
            Open Trust Center
          </a>
        </div>
      </section>
    </main>
  );
}
