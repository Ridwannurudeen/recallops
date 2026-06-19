import Bat4421Replay from "./bat-4421-replay";
import {
  accountableHuman,
  apiBase,
  integrationClaims,
  packet,
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
  sameAs: [
    "https://github.com/Ridwannurudeen/recallops",
    "https://lablab.ai/ai-hackathons/band-of-agents-hackathon/gudman/recallops",
  ],
  description:
    "Product-recall command system that coordinates evidence, traceability, accountable human approval, ERP-ready actions, and verifiable receipts.",
  featureList: [
    "Source-linked incident evidence",
    "Traceability coverage calculation",
    "Human-owned approval receipts",
    "SAP and Oracle dry-run payloads",
    "Hash-linked audit packet",
  ],
};

const decisionSteps = [
  "Source",
  "Fact",
  "Hold",
  "Recovery",
  "Approval",
  "Receipt",
];

const operatingFlow = [
  {
    label: "1",
    title: "Add the evidence",
    copy: "Complaint details and shipment ledgers enter one case record.",
  },
  {
    label: "2",
    title: "Find the blocker",
    copy: "Traceability, risk, and filing checks show what prevents approval.",
  },
  {
    label: "3",
    title: "Recover or document the gap",
    copy: "Missing shipment files or exceptions are added before approval opens.",
  },
  {
    label: "4",
    title: "Approve and prove",
    copy: "A named human reviews the scope and seals a receipt-backed action.",
  },
];

const proofSummary = [
  {
    label: "Initial coverage",
    value: `${packet.initial_traceability.coverage_percent}%`,
    detail: `${packet.initial_traceability.untraced_units.toLocaleString()} units untraced`,
  },
  {
    label: "Recovered coverage",
    value: `${packet.final_traceability.coverage_percent}%`,
    detail: "missing distributor file added",
  },
  {
    label: "Human owner",
    value: accountableHuman.role,
    detail: "final action remains accountable",
  },
  {
    label: "Packet digest",
    value: shortHash(packet.audit_hash, 8),
    detail: "source-linked proof trail",
  },
];

export default function Home() {
  return (
    <main className="command-shell product-home clean-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <SiteNav active="product" />

      <section className="hero-section hero-section-redesign clean-hero">
        <div className="hero-copy-v2 hero-copy-operational clean-hero-copy">
          <p className="section-kicker">Product recall command system</p>
          <h1 className="hero-title">Run the recall. Prove the decision.</h1>
          <p className="hero-lede">
            Coordinate complaint evidence, shipment traceability, regulatory
            review, communications, and accountable human approval in one
            source-linked command room.
          </p>
          <div className="hero-actions-v2">
            <a className="primary-action" href="/app">
              Open command room
            </a>
            <a
              className="secondary-action"
              href="https://youtu.be/15Nj38uSZNI"
              target="_blank"
              rel="noreferrer"
            >
              Watch 3-minute demo
            </a>
            <a className="secondary-action" href="/demo/bat-4421">
              Run BAT-4421
            </a>
          </div>
          <a className="quiet-link" href="/proof">
            Inspect the audit packet
          </a>
          <a
            className="quiet-link"
            href="https://lablab.ai/ai-hackathons/band-of-agents-hackathon/gudman/recallops"
            target="_blank"
            rel="noreferrer"
          >
            View lablab submission
          </a>
          <p className="trust-line">
            Source-grounded / Human-approved / ERP-gated
          </p>
          <p className="track-line">
            Built for Track 3: Regulated & High-Stakes Workflows
          </p>
        </div>

        <Bat4421Replay packet={packet} variant="hero" apiBase={apiBase} />
      </section>

      <section
        className="decision-spine clean-spine"
        aria-label="RecallOps decision chain"
      >
        {decisionSteps.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </section>

      <section className="clean-metric-strip" aria-label="BAT-4421 summary">
        {proofSummary.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="clean-section judge-shortcut-section">
        <div>
          <p className="section-kicker">Judging RecallOps?</p>
          <h2>Use this path to see the Track 3 workflow quickly.</h2>
          <p>
            The fastest evaluation is to watch the short demo, open the command
            room, run an incomplete shipment case, confirm approval is blocked,
            then inspect the proof packet and public lablab listing.
          </p>
        </div>
        <ol>
          <li>Watch the 3-minute demo video.</li>
          <li>Open the command room and analyze a recall case.</li>
          <li>Confirm incomplete traceability blocks approval.</li>
          <li>Add recovered shipment evidence and rerun analysis.</li>
          <li>Inspect the audit packet and receipts.</li>
        </ol>
        <div className="judge-shortcut-actions">
          <a
            className="primary-action"
            href="https://youtu.be/15Nj38uSZNI"
            target="_blank"
            rel="noreferrer"
          >
            Watch demo video
          </a>
          <a className="secondary-action" href="/app">
            Open command room
          </a>
          <a className="secondary-action" href="/proof">
            Inspect proof packet
          </a>
          <a
            className="secondary-action"
            href="https://lablab.ai/ai-hackathons/band-of-agents-hackathon/gudman/recallops"
            target="_blank"
            rel="noreferrer"
          >
            lablab page
          </a>
        </div>
      </section>

      <section className="clean-section clean-problem">
        <div>
          <p className="section-kicker">Why it exists</p>
          <h2>
            Dangerous recalls fail when evidence, approval, and proof split
            apart.
          </h2>
        </div>
        <p>
          RecallOps keeps the decision trail intact. The system shows what is
          known, what is missing, what is blocked, what changed after recovery,
          and what a named human is approving.
        </p>
      </section>

      <section className="clean-section clean-flow-section">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">How it works</p>
            <h2>One operating flow from incident to receipt.</h2>
          </div>
          <a className="secondary-action" href="/demo/bat-4421">
            Watch the flow
          </a>
        </div>
        <div className="clean-flow-grid">
          {operatingFlow.map((step) => (
            <article key={step.label}>
              <span>{step.label}</span>
              <strong>{step.title}</strong>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="clean-section clean-authority-section">
        <div>
          <p className="section-kicker">Authority model</p>
          <h2>Five specialist agents. One accountable human.</h2>
          <p>
            Agents gather, challenge, calculate, draft, and recommend. The QA
            Director owns the final recall decision.
          </p>
        </div>
        <div className="clean-role-grid">
          {roomResponsibilities.map((item) => (
            <article key={item.role}>
              <span>{item.authority}</span>
              <strong>{item.role}</strong>
              <p>{item.assignment}</p>
            </article>
          ))}
          <article className="human-authority-card">
            <span>Accountable human</span>
            <strong>{accountableHuman.role}</strong>
            <p>{accountableHuman.assignment}</p>
          </article>
        </div>
      </section>

      <section className="clean-section clean-proof-section">
        <div>
          <p className="section-kicker">Verification</p>
          <h2>The proof is readable before it becomes technical.</h2>
          <p>
            Every important claim is labelled as live, captured, deterministic,
            dry-run, gated, or simulated. Raw JSON remains available, but the
            page starts with the audit story.
          </p>
          <div className="hero-actions-v2">
            <a className="primary-action" href="/proof">
              Inspect proof
            </a>
            <a className="secondary-action" href="/trust">
              Trust Center
            </a>
          </div>
        </div>
        <div className="clean-boundary-list">
          {integrationClaims.slice(0, 4).map((claim) => (
            <article key={claim.name}>
              <ProofLabel status={claim.status}>{claim.name}</ProofLabel>
              <strong>{claim.headline}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final-cta clean-final-cta">
        <div>
          <p className="section-kicker">Start</p>
          <h2>Use the command room when you need to test a real case.</h2>
          <p>
            Create a case, add shipment rows, watch the execution stream,
            resolve blockers, and download the report and audit packet.
          </p>
        </div>
        <div className="landing-final-actions">
          <a className="primary-action" href="/app">
            Open command room
          </a>
          <a className="secondary-action" href="/integrations">
            Integration status
          </a>
        </div>
      </section>
    </main>
  );
}
