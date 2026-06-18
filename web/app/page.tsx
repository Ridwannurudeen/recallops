import Bat4421Replay from "./bat-4421-replay";
import {
  apiBase,
  fragmentedSurfaces,
  integrationClaims,
  packet,
  proofExplorerSections,
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
    "Proof-carrying command room for product recalls, coordinating evidence, traceability, risk holds, human approval, ERP-ready actions, and audit receipts.",
  featureList: [
    "Band-native recall command room",
    "Product recall proof packet",
    "Risk hold and re-plan workflow",
    "Human approval receipt",
    "SAP and Oracle dry-run payloads",
    "Hash-linked audit chain",
  ],
};

export default function Home() {
  return (
    <main className="command-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <SiteNav active="product" />

      <section className="hero-section">
        <div className="hero-copy-v2">
          <p className="section-kicker">BAND-NATIVE RECALL COMMAND</p>
          <h1 className="hero-title">Run the recall. Prove the decision.</h1>
          <p className="hero-lede">
            Coordinate evidence, traceability, regulatory risk, communications
            and QA in one shared command room. Every source, veto, approval and
            ERP-ready action becomes part of one verifiable decision chain.
          </p>
          <div className="hero-actions-v2">
            <a className="primary-action" href="/console">
              Try the live console
            </a>
            <a className="secondary-action" href="/demo/bat-4421">
              Replay BAT-4421
            </a>
          </div>
          <p className="trust-line">
            Human-approved &middot; Source-linked &middot; ERP-gated
          </p>
        </div>
        <Bat4421Replay packet={packet} apiBase={apiBase} />
      </section>

      <section className="fragmented-section">
        <div>
          <p className="section-kicker">Fragmented reality</p>
          <h2>Recalls break when the decision trail breaks.</h2>
          <p>
            Evidence lives in one system, shipment records in another,
            regulatory review happens in meetings, and final approval disappears
            into email.
          </p>
        </div>
        <div
          className="surface-chain"
          aria-label="Disconnected recall surfaces"
        >
          {fragmentedSurfaces.map((surface, index) => (
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
            <p className="section-kicker">One room, six responsibilities</p>
            <h2>Specialists do not agree by default. They carry authority.</h2>
          </div>
          <ProofLabel status="CAPTURED">Band room evidence exposed</ProofLabel>
        </div>
        <div className="responsibility-grid">
          {roomResponsibilities.map((item) => (
            <article key={item.role}>
              <span>{item.authority}</span>
              <strong>{item.role}</strong>
              <p>{item.assignment}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="story-split">
        <article className="veto-feature">
          <span>HOLD-01</span>
          <h2>Raised by Regulatory/Risk</h2>
          <p>
            864 shipped units remain untraced. Consumer-notice scope cannot yet
            be defended.
          </p>
          <strong>Plan status: HUMAN REVIEW REQUIRED</strong>
        </article>
        <article className="recovery-feature">
          <span>Recovery and re-plan</span>
          <h2>One recovered distributor file changes the decision.</h2>
          <p>
            Kestrel Distributor enters the Source Cockpit, cites the missing
            units, recomputes coverage from 82% to 100%, and unlocks risk
            clearance.
          </p>
          <code>{shortHash(packet.receipts[6].receipt_hash, 14)}</code>
        </article>
        <article className="approval-feature">
          <span>Human approval</span>
          <h2>The button says exactly what the human authorizes.</h2>
          <p>
            Recall scope, regions, notice package, traceability coverage,
            remaining exceptions, ERP hold payload, and identity are sealed into
            the receipt.
          </p>
          <a href="/demo/bat-4421">Approve recall action in the replay</a>
        </article>
      </section>

      <section className="proof-preview">
        <div>
          <p className="section-kicker">Proof packet</p>
          <h2>Structured evidence before a buyer has to ask for it.</h2>
          <p>
            The proof explorer presents the deployed bundle as a readable audit
            packet and keeps the raw JSON one click away.
          </p>
          <a className="primary-action" href="/proof">
            Inspect the audit packet
          </a>
        </div>
        <div className="proof-preview-list">
          {proofExplorerSections.map((section) => (
            <span key={section}>{section}</span>
          ))}
        </div>
      </section>

      <section className="integration-preview">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Enterprise integrations</p>
            <h2>Honest ERP status is a trust feature.</h2>
          </div>
          <a className="secondary-action" href="/integrations">
            View integration status
          </a>
        </div>
        <div className="integration-preview-grid">
          {integrationClaims.slice(0, 4).map((claim) => (
            <article key={claim.name}>
              <ProofLabel status={claim.status}>{claim.name}</ProofLabel>
              <strong>{claim.headline}</strong>
              <p>{claim.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
