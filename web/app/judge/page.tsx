import {
  apiBase,
  docsEndpoints,
  integrationClaims,
  packet,
  shortHash,
} from "../recall-data";
import ProofLabel from "../proof-label";
import SiteNav from "../site-nav";

const thirtySecondPitch = [
  "RecallOps is a proof-carrying command room for product recalls.",
  "A judge can run AI/ML-assisted source evidence, watch traceability gaps become human review gates, inspect the captured Band room proof, and verify the final packet hash.",
  "The important boundary is explicit: public demos can prepare regulator filing packs and ERP payloads, but real regulator submission and tenant writes stay gated behind configured endpoints, approval identity, and admin authorization.",
];

const statusCards = [
  {
    status: "LIVE" as const,
    label: "Deployed API and console",
    headline:
      "Source evidence, case creation, proof bundles, and dry-run payloads are served by the live app.",
  },
  {
    status: "CAPTURED" as const,
    label: "Band room evidence",
    headline:
      "BAT-4421 includes captured room, participant, handoff, hold, and notice IDs.",
  },
  {
    status: "GATED" as const,
    label: "AI/ML API proof lane",
    headline:
      "The command room can call AI/ML API and Featherless once, then records provider status and response hashes in the run report.",
  },
  {
    status: "DETERMINISTIC" as const,
    label: "Replay packet",
    headline:
      "The fixed packet lets judges replay the same incident and recompute the final digest.",
  },
  {
    status: "DRY RUN" as const,
    label: "Regulator and ERP payloads",
    headline:
      "Filing packs plus SAP and Oracle payloads are generated without external tenant mutation.",
  },
  {
    status: "GATED" as const,
    label: "Human e-signature",
    headline:
      "Approval receipts require verified approval material before sealing a named signer.",
  },
  {
    status: "GATED" as const,
    label: "Live submission or tenant write",
    headline:
      "No real regulator submission or SAP/Oracle tenant write occurs unless deployment gates are configured and authorized.",
  },
];

const demoScript = [
  {
    step: "00:00",
    title: "Open the pitch page",
    copy: "State the one-liner: RecallOps coordinates a recall decision room and proves what was live, captured, deterministic, dry-run, or gated.",
    href: "/judge",
    action: "This page",
  },
  {
    step: "00:30",
    title: "Run the guided judge demo",
    copy: "Run the source evidence, room, filing, and proof flow, then inspect the captured Band proof and packet hash.",
    href: "/demo/bat-4421?mode=guided",
    action: "Run BAT-4421",
  },
  {
    step: "01:20",
    title: "Open the command room",
    copy: "Open the command room, keep AI/ML partner mode on, recompute traceability, and show provider status plus the coverage gate.",
    href: "/app",
    action: "Open command room",
  },
  {
    step: "02:00",
    title: "Replay the stable room",
    copy: "Use the deterministic replay to show evidence handoff, regulatory hold, recovered distributor file, and named QA approval.",
    href: "/demo/bat-4421",
    action: "Replay BAT-4421",
  },
  {
    step: "02:30",
    title: "Inspect proof",
    copy: "Open the proof explorer and verify the packet hash, captured Band IDs, e-signature boundary, and integration status labels.",
    href: "/proof",
    action: "Inspect proof",
  },
  {
    step: "02:50",
    title: "Check the API",
    copy: "Open docs and direct endpoints so a judge can verify the proof bundle independently from the UI.",
    href: "/docs",
    action: "Read docs",
  },
];

const judgeLinks = [
  {
    label: "Command room",
    href: "/app",
    copy: "Editable incident intake, source recompute, case creation, approval proof, and enterprise sync preview.",
  },
  {
    label: "Proof explorer",
    href: "/proof",
    copy: "Human-readable audit packet with raw proof surfaces and digest verification context.",
  },
  {
    label: "API docs",
    href: "/docs",
    copy: "Endpoint index for the proof bundle, source evidence, filing pack, Band proof, SAP/Oracle checks, and verify route.",
  },
  {
    label: "lablab page",
    href: "https://lablab.ai/ai-hackathons/band-of-agents-hackathon/gudman/recallops",
    copy: "Public hackathon listing with Track 3 category, project summary, repository, presentation, and demo links.",
  },
];

const featuredEndpoints = docsEndpoints.filter((endpoint) =>
  [
    "/api/submission-proof",
    "/api/source-evidence",
    "/api/partner-ai/status",
    "/api/spend-limits",
    "/api/recall-room/run",
    "/api/filing-pack",
    "/api/regulator-filing/status",
    "/api/enterprise-sync",
    "/api/verify",
  ].includes(endpoint.path),
);

const hardBoundaries = [
  {
    title: "No real regulator submission by default",
    copy: "RecallOps can prepare regulator filing dispatches and expose status, but live external filing requires the regulator gate to be configured and authorized.",
  },
  {
    title: "No tenant writes by default",
    copy: "SAP and Oracle payloads are public dry-runs unless a tenant endpoint, live action mode, selected targets, and admin action key are present.",
  },
  {
    title: "Human-owned approval",
    copy: "The system prepares evidence and receipts. The final recall action stays attributable to the named human signer.",
  },
  {
    title: "Captured is not live",
    copy: "Captured Band IDs prove a prior external run. Deterministic replay proves stable behavior from the sealed packet.",
  },
];

export default function SubmissionPage() {
  const capturedRun = packet.band_proof.captured_band_run;
  const gatedClaims = integrationClaims.filter(
    (claim) => claim.status === "GATED",
  );

  return (
    <main className="command-shell">
      <SiteNav />

      <section className="page-hero compact-page-hero">
        <div>
          <p className="section-kicker">Submission readiness</p>
          <h1>Judge RecallOps in one pass.</h1>
          <p>
            This standalone page gives the 30-second pitch, proof status map,
            demo script, direct route links, endpoint links, and the hard
            boundaries around regulator submission and tenant writes.
          </p>
        </div>
        <ProofLabel status="GATED">submission and tenant writes</ProofLabel>
      </section>

      <section className="landing-proof-stack">
        <div>
          <p className="section-kicker">30-second pitch</p>
          <h2>Run the recall. Prove the decision.</h2>
          {thirtySecondPitch.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <div className="landing-final-actions" style={{ marginTop: 18 }}>
            <a className="primary-action" href="/demo/bat-4421?mode=guided">
              Run BAT-4421
            </a>
            <a className="secondary-action" href="/app">
              Open command room
            </a>
          </div>
        </div>
        <div className="proof-stack-grid">
          <article>
            <ProofLabel status="CAPTURED">Band room</ProofLabel>
            <strong>{capturedRun.room_id}</strong>
          </article>
          <article>
            <ProofLabel status="DETERMINISTIC">audit hash</ProofLabel>
            <strong>{shortHash(packet.audit_hash, 16)}</strong>
          </article>
          <article>
            <ProofLabel status="LIVE">incident</ProofLabel>
            <strong>
              {packet.incident_id} / {packet.product} / lot {packet.lot}
            </strong>
          </article>
          <article>
            <ProofLabel status="GATED">write boundary</ProofLabel>
            <strong>No live regulator or tenant write without gates.</strong>
          </article>
        </div>
      </section>

      <section className="landing-workflow">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Status map</p>
            <h2>What is live, captured, deterministic, dry-run, or gated.</h2>
          </div>
          <a className="secondary-action" href="/docs">
            Open API docs
          </a>
        </div>
        <div className="proof-stack-grid">
          {statusCards.map((item) => (
            <article key={`${item.status}-${item.label}`}>
              <ProofLabel status={item.status}>{item.label}</ProofLabel>
              <strong>{item.headline}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-workflow">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Demo script</p>
            <h2>Three-minute judging path.</h2>
          </div>
          <a className="primary-action" href="/demo/bat-4421?mode=guided">
            Run BAT-4421
          </a>
        </div>
        <div className="workflow-rail">
          {demoScript.map((item) => (
            <article key={item.step}>
              <span>{item.step}</span>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
              <a className="secondary-action" href={item.href}>
                {item.action}
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-audience">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Judge links</p>
            <h2>Open the three review surfaces.</h2>
          </div>
        </div>
        <div className="audience-grid">
          {judgeLinks.map((item) => (
            <article key={item.href}>
              <span>{item.label}</span>
              <strong>
                <a href={item.href}>{item.href}</a>
              </strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="docs-table" aria-label="Submission API endpoints">
        {featuredEndpoints.map((endpoint) => (
          <article key={`${endpoint.method}-${endpoint.path}`}>
            <span>{endpoint.method}</span>
            <code>{endpoint.path}</code>
            <p>{endpoint.purpose}</p>
            <a href={`${apiBase}${endpoint.path.replace("/api", "")}`}>
              Open endpoint
            </a>
          </article>
        ))}
      </section>

      <section className="landing-disclosure">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Hard boundaries</p>
            <h2>No hidden production claim.</h2>
          </div>
          <ProofLabel status="GATED">real-world mutation</ProofLabel>
        </div>
        <div className="disclosure-grid">
          {hardBoundaries.map((item) => (
            <article key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="docs-snippets">
        <article>
          <p className="section-kicker">Proof bundle</p>
          <pre>
            <code>{`curl ${apiBase}/submission-proof`}</code>
          </pre>
        </article>
        <article>
          <p className="section-kicker">Regulator gate</p>
          <pre>
            <code>{`curl ${apiBase}/regulator-filing/status`}</code>
          </pre>
        </article>
        <article>
          <p className="section-kicker">Tenant-write boundary</p>
          <pre>
            <code>{`curl ${apiBase}/enterprise-sync`}</code>
          </pre>
        </article>
      </section>

      <section className="landing-final-cta">
        <div>
          <p className="section-kicker">Gated surfaces</p>
          <h2>
            {gatedClaims.length} integration claims require authorization.
          </h2>
          <p>
            The submission page intentionally labels e-signature, tenant write,
            partner AI spend, and live external submission boundaries so judges
            can distinguish public proof from controlled production actions.
          </p>
        </div>
        <div className="landing-final-actions">
          <a className="primary-action" href="/app">
            Open command room
          </a>
          <a className="secondary-action" href="/proof">
            Verify proof
          </a>
          <a className="secondary-action" href="/docs">
            Read docs
          </a>
        </div>
      </section>
    </main>
  );
}
