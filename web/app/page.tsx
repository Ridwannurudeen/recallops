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
    "Proof-carrying recall command room for regulated product teams, coordinating source evidence, traceability math, human approval, ERP-ready actions, and audit receipts.",
  featureList: [
    "Editable incident intake",
    "Traceability and jurisdiction rule checks",
    "Parameterized recall room narrative",
    "Human-owned approval receipt",
    "SAP and Oracle dry-run payloads",
    "Hash-linked audit chain",
  ],
};

const workflowSteps = [
  {
    step: "01",
    title: "Intake the incident",
    copy: "Enter complaint details, product, lot, defect, severity, and shipment CSVs. The cockpit keeps the raw source text available for review.",
  },
  {
    step: "02",
    title: "Compute traceability",
    copy: "RecallOps parses shipments into coverage, untraced units, affected customers, regions, missing sources, and source digests.",
  },
  {
    step: "03",
    title: "Apply review gates",
    copy: "Deterministic rules identify traceability gaps, jurisdiction deadlines, and whether the case is ready for a named human decision.",
  },
  {
    step: "04",
    title: "Generate the room",
    copy: "The current source packet becomes a parameterized room narrative, so changed incident data changes the operating story.",
  },
  {
    step: "05",
    title: "Approve and prepare action",
    copy: "A human approval receipt seals approver, basis, source audit hash, and receipt hash; ERP writes remain dry-run unless explicitly authorized.",
  },
];

const proofStack = [
  {
    label: "source packet",
    status: "LIVE" as const,
    headline:
      "Complaint and shipment evidence recompute into a SHA-256 audit hash.",
  },
  {
    label: "room narrative",
    status: "DETERMINISTIC" as const,
    headline:
      "The room events are generated from the current source packet and rules.",
  },
  {
    label: "Band proof",
    status: "CAPTURED" as const,
    headline: "The BAT-4421 walkthrough links to captured Band room IDs.",
  },
  {
    label: "enterprise sync",
    status: "GATED" as const,
    headline:
      "SAP and Oracle live writes require tenant config and an admin action key.",
  },
];

const buyerRoles = [
  {
    role: "Quality and recall leads",
    need: "See why the case is or is not ready for approval.",
    detail:
      "Coverage, regions, missing sources, notices, and approval basis are visible before the final action.",
  },
  {
    role: "Regulatory and legal",
    need: "Keep the decision human-owned.",
    detail:
      "RecallOps raises review gates and prepares filing context; it does not replace accountable sign-off.",
  },
  {
    role: "Operations and ERP teams",
    need: "Preview the downstream payload.",
    detail:
      "SAP and Oracle sync paths produce normalized dry-runs before any tenant write is enabled.",
  },
  {
    role: "Auditors and judges",
    need: "Verify the claim without trusting the UI.",
    detail:
      "The proof explorer exposes packet JSON, source digests, approval receipts, and recomputable hashes.",
  },
];

const realnessNotes = [
  {
    title: "Real engine",
    copy: "The API parses arbitrary complaint and shipment inputs, creates case records, recomputes traceability, applies rules, and emits proof payloads.",
  },
  {
    title: "Scripted replay",
    copy: "BAT-4421 remains a deterministic walkthrough so demos and judges can replay the same incident every time.",
  },
  {
    title: "Gated writes",
    copy: "ERP writes are not public actions. Live mode needs configured tenant endpoints, live-write enablement, and an admin key.",
  },
  {
    title: "Optional partner AI",
    copy: "Provider calls are spend-controlled and disclosed. The deterministic parser remains the source of truth for the public proof path.",
  },
];

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
            RecallOps turns fragmented recall work into a source-grounded
            command room: intake the incident, compute traceability, raise human
            review gates, prepare ERP actions, and seal the approval trail.
          </p>
          <div className="hero-actions-v2">
            <a className="primary-action" href="/workspace">
              Use the workspace
            </a>
            <a className="primary-action" href="/console">
              Open operator console
            </a>
            <a className="secondary-action" href="/demo/judge">
              Start judge demo
            </a>
          </div>
          <p className="trust-line">
            Human-owned decision support &middot; Source-linked &middot;
            ERP-gated
          </p>
        </div>
        <Bat4421Replay packet={packet} apiBase={apiBase} />
      </section>

      <section className="landing-system-map">
        <article>
          <span>What it is</span>
          <strong>A command layer for high-stakes product recalls.</strong>
          <p>
            RecallOps sits between source evidence, quality review, regulatory
            checks, communications, ERP holds, and audit proof. It helps teams
            coordinate the decision without pretending the software owns the
            final legal act.
          </p>
        </article>
        <article>
          <span>What it outputs</span>
          <strong>
            Cases, room narratives, receipts, and ERP-ready payloads.
          </strong>
          <p>
            A recall manager can edit incident facts, upload shipment ledgers,
            recompute coverage, create a case, inspect proof, and prepare SAP or
            Oracle sync payloads from one surface.
          </p>
        </article>
        <article>
          <span>What stays accountable</span>
          <strong>The named human decides and signs.</strong>
          <p>
            The system can flag blockers and prepare evidence. The approval
            receipt records who signed, why, and which source hash supported the
            action.
          </p>
        </article>
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

      <section className="landing-workflow">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">How it works</p>
            <h2>From incident intake to verifiable approval.</h2>
          </div>
          <a className="secondary-action" href="/console">
            Open the live demo
          </a>
        </div>
        <div className="workflow-rail">
          {workflowSteps.map((step) => (
            <article key={step.step}>
              <span>{step.step}</span>
              <strong>{step.title}</strong>
              <p>{step.copy}</p>
            </article>
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

      <section className="landing-proof-stack">
        <div>
          <p className="section-kicker">Proof model</p>
          <h2>Every claim carries a label.</h2>
          <p>
            RecallOps separates live computation, captured external proof,
            deterministic replay, dry-runs, gated writes, and simulated
            behavior. Buyers can see what happened now, what was captured
            earlier, and what still needs tenant authorization.
          </p>
        </div>
        <div className="proof-stack-grid">
          {proofStack.map((item) => (
            <article key={item.label}>
              <ProofLabel status={item.status}>{item.label}</ProofLabel>
              <strong>{item.headline}</strong>
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
          <a href="/console">Seal human sign-off in the live demo</a>
        </article>
      </section>

      <section className="landing-audience">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Who it is for</p>
            <h2>Built around the teams that touch a recall.</h2>
          </div>
        </div>
        <div className="audience-grid">
          {buyerRoles.map((item) => (
            <article key={item.role}>
              <span>{item.role}</span>
              <strong>{item.need}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
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

      <section className="landing-disclosure">
        <div>
          <p className="section-kicker">Operational boundaries</p>
          <h2>Clear about what is live, replayed, and gated.</h2>
        </div>
        <div className="disclosure-grid">
          {realnessNotes.map((item) => (
            <article key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final-cta">
        <div>
          <p className="section-kicker">Start with the live path</p>
          <h2>Create a case, inspect the room, and verify the proof.</h2>
          <p>
            Use the console for editable incidents, the BAT-4421 replay for a
            stable walkthrough, and the proof explorer for raw verification
            artifacts.
          </p>
        </div>
        <div className="landing-final-actions">
          <a className="primary-action" href="/workspace">
            Use the workspace
          </a>
          <a className="primary-action" href="/demo/judge">
            Start judge demo
          </a>
          <a className="secondary-action" href="/console">
            Open operator console
          </a>
          <a className="secondary-action" href="/proof">
            Inspect proof
          </a>
          <a className="secondary-action" href="/docs">
            Read the API docs
          </a>
        </div>
      </section>
    </main>
  );
}
