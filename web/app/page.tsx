import packetJson from "../public/demo-packet.json";
import EnterpriseReadiness from "./enterprise-readiness";
import LiveBandRunner from "./live-band-runner";
import LiveDrill from "./live-drill";
import SourceEvidenceCockpit from "./source-evidence-cockpit";

type Agent = {
  id: string;
  name: string;
  handle: string;
  framework: string;
  role: string;
};

type EventStage =
  | "room_created"
  | "evidence_extracted"
  | "agent_recruited"
  | "traceability_gap"
  | "regulatory_veto"
  | "traceability_resolved"
  | "risk_approved"
  | "notice_drafted"
  | "human_approved";

type RecallEvent = {
  id: string;
  at: string;
  stage: EventStage;
  agent: string;
  message: string;
  mentions: string[];
  metadata: Record<string, string | number | boolean>;
};

type Shipment = {
  distributor: string;
  region: string;
  customers: number;
  units: number;
  traced: boolean;
};

type Traceability = {
  total_units: number;
  open_stock_units: number;
  shipped_units: number;
  traced_units: number;
  untraced_units: number;
  coverage_percent: number;
  regions: number;
  affected_customers: number;
};

type BandStageEvidence = {
  stage: string;
  label: string;
  band_message_id: string;
  proves: string;
};

type CapturedBandRun = {
  proof_mode: string;
  captured_at: string;
  room_id: string;
  participant_count: number;
  context_items: number;
  commander_event_id: string;
  commander_message_id: string;
  evidence_ack_id: string;
  traceability_gap_id: string;
  risk_veto_id: string;
  traceability_resolved_id: string;
  risk_approved_id: string;
  communications_notice_id: string;
  stage_evidence: BandStageEvidence[];
};

type Packet = {
  room_id: string;
  incident_id: string;
  product: string;
  lot: string;
  defect: string;
  severity: string;
  exposure_clock: {
    label: string;
    units_in_market: number;
    hours_since_first_report: number;
    unit_hours: number;
  };
  agents: Agent[];
  shipments: Shipment[];
  initial_traceability: Traceability;
  final_traceability: Traceability;
  events: RecallEvent[];
  decision: {
    status: string;
    action: string;
    risk_level: string;
    human_approved: boolean;
    reason: string;
  };
  notices: Record<string, string>;
  band_proof: {
    proof_mode: string;
    packet_room_id: string;
    packet_room_type: string;
    participant_count: number;
    event_count: number;
    message_ids: string[];
    veto_message_id: string;
    approval_message_id: string;
    captured_band_run: CapturedBandRun;
  };
  receipts: {
    id: string;
    event_id: string;
    agent: string;
    check: string;
    status: "recorded" | "blocked" | "cleared" | "sealed";
    band_reference: string;
    previous_hash: string;
    receipt_hash: string;
  }[];
  decision_graph: {
    nodes: {
      id: string;
      label: string;
      owner: string;
      state: string;
    }[];
    edges: {
      source: string;
      target: string;
      label: string;
      band_message_id: string;
    }[];
  };
  audit_hash: string;
};

const packet = packetJson as unknown as Packet;
const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

const stageLabels: Record<EventStage, string> = {
  room_created: "room",
  evidence_extracted: "evidence",
  agent_recruited: "recruit",
  traceability_gap: "gap",
  regulatory_veto: "veto",
  traceability_resolved: "resolved",
  risk_approved: "approved",
  notice_drafted: "notice",
  human_approved: "human gate",
};

const proofStats = [
  {
    label: "live agents",
    value: packet.band_proof.captured_band_run.participant_count.toString(),
    detail: "Band room roles recruited in sequence",
  },
  {
    label: "traceability",
    value: `${packet.final_traceability.coverage_percent}%`,
    detail: "approval blocked until lot coverage cleared",
  },
  {
    label: "partner AI",
    value: "2",
    detail: "AI/ML API and Featherless proof path",
  },
  {
    label: "ERP proof",
    value: "SAP + Oracle",
    detail: "adapter payloads, SAP sandbox, contract receipts",
  },
];

const proofLinks = [
  { label: "proof bundle", href: `${apiBase}/submission-proof` },
  { label: "SAP proof", href: `${apiBase}/sap-api-hub` },
  { label: "ERP receipts", href: `${apiBase}/erp-contract/receipts` },
  { label: "digest verify", href: `${apiBase}/verify` },
];

const marketSignals = [
  {
    company: "Oracle",
    product: "Fusion Cloud Product Recall Management",
    signal:
      "End-to-end recall capture, affected-product traceability, quarantine, disposal, and structured tasks.",
    recallops:
      "Keep SAP/Oracle as systems of record, but put a live decision room and proof seal above the recall lifecycle.",
    href: "https://docs.oracle.com/en/cloud/saas/supply-chain-and-manufacturing/26b/fampr/overview-of-product-recall-management.html",
  },
  {
    company: "Honeywell",
    product: "TrackWise Recall Management",
    signal:
      "AI-assisted life-sciences recall workflow, regulatory compliance, and patient-safety framing.",
    recallops:
      "Expose the AI decision path, risk veto, human approval, and evidence hashes instead of hiding intelligence inside workflow.",
    href: "https://automation.honeywell.com/us/en/news/press-releases/2025/honeywell-ai-assisted-recall-software",
  },
  {
    company: "TraceLink",
    product: "Targeted Recalls",
    signal:
      "Real-time targeted alerts, site matching, response tracking, and automatic digital audit trails.",
    recallops:
      "Turn targeted recall execution into agent-routed notices backed by traceability coverage and dispatch receipts.",
    href: "https://www.tracelink.com/products/product-orchestration/targeted-recalls",
  },
  {
    company: "Trustwell",
    product: "FoodLogiQ Recall",
    signal:
      "Fast food recall execution with real-time alerts, lot-level traceability, dashboards, and escalation.",
    recallops:
      "Use the same speed expectation, then add explainable vetoes and cross-system proof for regulated operators.",
    href: "https://www.trustwell.com/products/foodlogiq/recall/",
  },
  {
    company: "MasterControl",
    product: "Quality Excellence",
    signal:
      "Automated workflows, real-time tracking, integrated documentation, CAPA, and compliance records.",
    recallops:
      "Connect recall decisions to approval receipts and closure evidence without forcing the recall to live inside one QMS.",
    href: "https://www.mastercontrol.com/glossary-page/fda-product-recall-management/",
  },
  {
    company: "ETQ / Hexagon",
    product: "ETQ Reliance eQMS",
    signal:
      "Workflow-based enterprise QMS covering CAPA, supplier quality, audits, compliance, and risk.",
    recallops:
      "Position as the recall command layer that can orchestrate QMS, ERP, support, and regulator actions together.",
    href: "https://hexagon.com/products/product-groups/etq-reliance",
  },
];

const capabilityMatrix = [
  {
    capability: "Recall lifecycle",
    incumbent:
      "Oracle structures the native recall record, tasks, quarantine, and closure.",
    recallops:
      "Coordinates the decision layer above ERP so SAP, Oracle, QMS, support, and regulators see the same incident proof.",
  },
  {
    capability: "AI intake",
    incumbent:
      "Honeywell and Oracle show the market wants AI-assisted recall signal parsing.",
    recallops:
      "Publishes prompt hashes, response hashes, source citations, and provider status instead of hiding model output.",
  },
  {
    capability: "Targeted response",
    incumbent:
      "TraceLink and Trustwell focus on targeted alerts, site response, and recall execution speed.",
    recallops:
      "Routes notices only after traceability clears, risk vetoes resolve, and dispatch receipts are prepared.",
  },
  {
    capability: "Quality closure",
    incumbent:
      "MasterControl and ETQ anchor the QMS record, CAPA, documentation, audit, and risk workflow.",
    recallops:
      "Adds cross-system proof: who challenged the decision, who approved, what changed, and which hash verifies it.",
  },
  {
    capability: "Enterprise write path",
    incumbent:
      "Incumbents often assume they own the workflow or the system of record.",
    recallops:
      "Keeps writes gated and tenant-shaped: dry-run by default, admin-key live mode, redacted ERP receipts.",
  },
];

const commandProofs = [
  {
    label: "source evidence",
    headline: "Every fact cites the complaint or shipment ledger",
    copy: "The incident starts as source text and CSV data, not a hand-written demo state. RecallOps hashes the source packet before it moves.",
  },
  {
    label: "risk veto",
    headline: "Approval is impossible while coverage is incomplete",
    copy: "The Risk Officer blocks the recall packet at 82% coverage, forces a re-plan, and only clears after the missing distributor file is recovered.",
  },
  {
    label: "identity gate",
    headline: "The human approval becomes part of the receipt",
    copy: "Approvals can be sealed with a server-side admin key or OIDC/JWKS verification, then included in the recall audit chain.",
  },
  {
    label: "ERP contract",
    headline: "SAP and Oracle actions are provable without unsafe writes",
    copy: "The public demo proves tenant-shaped payloads and live receiver receipts while keeping real customer ERP writes behind explicit configuration.",
  },
];

const buyerOutcomes = [
  {
    team: "Quality and regulatory",
    outcome: "Walk into a board review with one verifiable recall packet.",
    proof:
      "source digest, risk veto, approval receipt, jurisdiction rules, dispatch receipts",
  },
  {
    team: "Supply chain",
    outcome:
      "Know exactly which lots, shipments, distributors, and regions are still unresolved.",
    proof:
      "coverage delta, affected regions, missing sources, final shipment ledger",
  },
  {
    team: "Enterprise IT",
    outcome:
      "Integrate without replacing SAP, Oracle, QMS, or support systems.",
    proof:
      "adapter status, dry-run payloads, write gates, redacted transport receipts",
  },
  {
    team: "Executives",
    outcome: "See the decision, not a vague dashboard status.",
    proof: "agent handoffs, re-plan evidence, final action, audit seal",
  },
];

const deploymentPath = [
  {
    phase: "01",
    title: "Read-only command layer",
    copy: "Ingest complaints, supplier notices, shipment exports, and QMS records. Produce a source-cited incident packet without writing back.",
  },
  {
    phase: "02",
    title: "Controlled execution pilot",
    copy: "Enable SAP/Oracle dry-runs, approval identity, dispatch receipts, and partner-AI review for one non-production recall workflow.",
  },
  {
    phase: "03",
    title: "Write-gated enterprise rollout",
    copy: "Turn on tenant writes only after admin authorization, endpoint review, legal rule validation, and security approval.",
  },
];

const operatingLayers = [
  {
    layer: "signal",
    headline: "Supplier letter, complaint, FDA notice, or support ticket",
    copy: "Normalize the first recall signal into a source-cited incident packet before any downstream workflow starts.",
  },
  {
    layer: "scope",
    headline: "Lot, batch, site, shipment, and customer exposure",
    copy: "Compute initial and final traceability coverage, then block approval while material gaps remain open.",
  },
  {
    layer: "decision",
    headline: "Risk veto, re-plan, and human approval",
    copy: "Make every agent handoff inspectable: who vetoed, what changed, what cleared, and which identity approved.",
  },
  {
    layer: "execution",
    headline: "SAP/Oracle holds, dispatch notices, and ERP receipts",
    copy: "Prepare tenant-shaped payloads, execute only behind admin gates, and keep the external write proof redacted.",
  },
  {
    layer: "proof",
    headline: "Hash-linked recall record for regulators and boards",
    copy: "Bundle the packet, Band run, partner-AI outputs, approval receipt, and integration receipts into one proof endpoint.",
  },
];

const productSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "RecallOps",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://recallops.gudman.xyz",
  description:
    "Verifiable product recall command center for SAP, Oracle SCM, QMS, support, and regulatory workflows.",
  featureList: [
    "AI product recall management",
    "SAP and Oracle recall adapter proof",
    "Lot and batch traceability",
    "Human approval receipts",
    "Hash-linked audit trail",
    "Multi-agent recall command room",
  ],
};

export default function Home() {
  const veto = packet.events.find((event) => event.stage === "regulatory_veto");
  const approval = packet.events.find(
    (event) => event.stage === "human_approved",
  );
  const capturedRun = packet.band_proof.captured_band_run;

  return (
    <main className="shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <section className="mast">
        <div className="hero-copy">
          <p className="kicker">RecallOps | verifiable recall command layer</p>
          <h1>The proof layer above every product recall.</h1>
          <p className="lede">
            Oracle can hold the recall record. TrackWise, MasterControl, and ETQ
            can hold the quality workflow. TraceLink and Trustwell can target
            the response. RecallOps owns the missing control plane: live
            decision orchestration, risk vetoes, human approval, ERP execution
            gates, and a regulator-readable proof bundle.
          </p>
          <div className="hero-claims">
            <a href={`${apiBase}/submission-proof`}>open live proof</a>
            <a href={`${apiBase}/live-drill`}>fresh Band drill</a>
            <a href={`${apiBase}/sap-api-hub`}>SAP sandbox proof</a>
          </div>
        </div>
        <aside className="hero-proof-console">
          <span className="live-dot" />
          <p className="kicker">live proof console</p>
          <strong>{packet.lot}</strong>
          <span>risk veto cleared only after coverage reached 100%</span>
          <div className="proof-stat-grid">
            {proofStats.map((stat) => (
              <div key={stat.label}>
                <small>{stat.label}</small>
                <b>{stat.value}</b>
                <em>{stat.detail}</em>
              </div>
            ))}
          </div>
          <div className="proof-link-grid">
            {proofLinks.map((link) => (
              <a href={link.href} key={link.label}>
                {link.label}
              </a>
            ))}
          </div>
        </aside>
      </section>

      <section className="proof-strip">
        <article>
          <span>exposure clock</span>
          <strong>{packet.exposure_clock.unit_hours.toLocaleString()}</strong>
          <p>unit-hours in market</p>
        </article>
        <article>
          <span>affected customers</span>
          <strong>
            {packet.final_traceability.affected_customers.toLocaleString()}
          </strong>
          <p>covered in final packet</p>
        </article>
        <article>
          <span>receipts</span>
          <strong>{packet.receipts.length}</strong>
          <p>hash-linked decision records</p>
        </article>
        <article>
          <span>audit seal</span>
          <code>{packet.audit_hash.slice(0, 18)}...</code>
          <p>recomputed by API</p>
        </article>
      </section>

      <LiveDrill packet={packet} />

      <SourceEvidenceCockpit apiBase={apiBase} />

      <EnterpriseReadiness apiBase={apiBase} />

      <section className="panel category-thesis">
        <div className="panel-head">
          <div>
            <p className="kicker">category thesis</p>
            <h2>
              Incumbents manage recalls. RecallOps proves command decisions.
            </h2>
          </div>
          <span className="mono-stat">six-company synthesis</span>
        </div>
        <p className="category-copy">
          The category is already real. Oracle formalizes recall records and
          tasks. Honeywell validates AI-assisted regulated recall workflows.
          TraceLink and Trustwell prove the need for targeted response.
          MasterControl and ETQ prove that quality teams need compliance
          closure. The opening is the layer between them: a command room that
          makes the decision path inspectable before the recall propagates into
          ERP, QMS, support, and regulator channels.
        </p>
        <div className="market-grid">
          {marketSignals.map((signal) => (
            <article key={signal.company}>
              <a href={signal.href} rel="noreferrer" target="_blank">
                {signal.company}
              </a>
              <strong>{signal.product}</strong>
              <p>{signal.signal}</p>
              <small>{signal.recallops}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="panel capability-matrix">
        <div className="panel-head">
          <div>
            <p className="kicker">incumbent gap map</p>
            <h2>What the market already expects, and what RecallOps adds</h2>
          </div>
        </div>
        <div className="matrix-table">
          {capabilityMatrix.map((row) => (
            <article key={row.capability}>
              <span>{row.capability}</span>
              <p>{row.incumbent}</p>
              <strong>{row.recallops}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="panel operating-system">
        <div className="panel-head">
          <div>
            <p className="kicker">recall operating system</p>
            <h2>One incident across five control planes</h2>
          </div>
          <a href={`${apiBase}/submission-proof`}>open proof bundle</a>
        </div>
        <div className="operating-layers">
          {operatingLayers.map((item, index) => (
            <article key={item.layer}>
              <span>
                {String(index + 1).padStart(2, "0")} | {item.layer}
              </span>
              <strong>{item.headline}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel command-proofs">
        <div className="panel-head">
          <div>
            <p className="kicker">proof-led architecture</p>
            <h2>Designed so the strongest claim is always verifiable</h2>
          </div>
          <a href={`${apiBase}/proof`}>packet proof</a>
        </div>
        <div className="command-proof-grid">
          {commandProofs.map((proof) => (
            <article key={proof.label}>
              <span>{proof.label}</span>
              <strong>{proof.headline}</strong>
              <p>{proof.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel buyer-proof">
        <div>
          <p className="kicker">why it can outrank</p>
          <h2>Built for the search intent incumbents answer only halfway</h2>
        </div>
        <div className="buyer-grid">
          {buyerOutcomes.map((buyer) => (
            <article key={buyer.team}>
              <span>{buyer.team}</span>
              <strong>{buyer.outcome}</strong>
              <p>{buyer.proof}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel deployment-path">
        <div className="panel-head">
          <div>
            <p className="kicker">enterprise deployment path</p>
            <h2>
              Ambitious without pretending production controls are optional
            </h2>
          </div>
          <span className="mono-stat">write-gated by design</span>
        </div>
        <div className="deployment-grid">
          {deploymentPath.map((phase) => (
            <article key={phase.phase}>
              <span>{phase.phase}</span>
              <strong>{phase.title}</strong>
              <p>{phase.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="command-grid">
        <article className="panel timeline-panel">
          <div className="panel-head">
            <div>
              <p className="kicker">Band transcript</p>
              <h2>Veto, re-plan, approval</h2>
            </div>
            <span className="status-pill">{packet.decision.status}</span>
          </div>
          <div className="timeline">
            {packet.events.map((event) => (
              <div className="event-row" key={event.id}>
                <time>{formatTime(event.at)}</time>
                <div>
                  <span className={`stage stage-${event.stage}`}>
                    {stageLabels[event.stage]}
                  </span>
                  <p>{event.message}</p>
                  <small>
                    {event.id} | {event.agent} | {event.mentions.join(", ")}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <aside className="panel proof-panel">
          <p className="kicker">Packet proof</p>
          <h2>Room evidence</h2>
          <ProofRow label="mode" value={packet.band_proof.proof_mode} />
          <ProofRow
            label="packet room"
            value={packet.band_proof.packet_room_id}
          />
          <ProofRow
            label="packet type"
            value={packet.band_proof.packet_room_type}
          />
          <ProofRow
            label="replay actors"
            value={packet.band_proof.participant_count.toString()}
          />
          <ProofRow
            label="captured agents"
            value={capturedRun.participant_count.toString()}
          />
          <ProofRow
            label="events"
            value={packet.band_proof.event_count.toString()}
          />
          <ProofRow
            label="receipts"
            value={packet.receipts.length.toString()}
          />
          <ProofRow label="veto" value={packet.band_proof.veto_message_id} />
          <ProofRow
            label="approval"
            value={packet.band_proof.approval_message_id}
          />
          <ProofRow label="captured room" value={capturedRun.room_id} />
          <ProofRow label="captured at" value={capturedRun.captured_at} />
          <ProofRow label="captured veto" value={capturedRun.risk_veto_id} />
          <ProofRow
            label="captured notice"
            value={capturedRun.communications_notice_id}
          />
          <ProofRow
            label="context"
            value={`${capturedRun.context_items} items`}
          />
          <div className="hash-box">
            <span>audit seal</span>
            <code>{packet.audit_hash}</code>
          </div>
          <div className="api-actions">
            <a href={`${apiBase}/packet`}>packet api</a>
            <a href={`${apiBase}/proof`}>proof api</a>
            <a href={`${apiBase}/band-proof`}>band proof</a>
            <a href={`${apiBase}/packet.json`}>export json</a>
            <a href={`${apiBase}/receipts`}>receipts api</a>
            <a href={`${apiBase}/decision-graph`}>graph api</a>
            <a href={`${apiBase}/verify`}>verify digest</a>
            <a href={`${apiBase}/source-evidence`}>source api</a>
            <a href={`${apiBase}/partner-ai/status`}>ai status</a>
            <a href={`${apiBase}/submission-proof`}>proof bundle</a>
            <a href={`${apiBase}/cases`}>cases api</a>
            <a href={`${apiBase}/rules`}>rules api</a>
            <a href={`${apiBase}/notifications/dry-run`}>dispatch api</a>
            <a href={`${apiBase}/enterprise-sync`}>erp sync</a>
            <a href={`${apiBase}/identity/status`}>identity</a>
            <a href={`${apiBase}/erp-contract/receipts`}>erp receipts</a>
            <a href={`${apiBase}/sap-api-hub`}>sap sandbox</a>
          </div>
        </aside>
      </section>

      <section className="panel raw-proof">
        <div className="panel-head">
          <div>
            <p className="kicker">raw Band proof</p>
            <h2>Captured run, not a claim</h2>
          </div>
          <a href={`${apiBase}/band-proof`}>download proof</a>
        </div>
        <p className="proof-disclosure">
          Judge Mode replays the deterministic BAT-4421 packet for a stable
          walkthrough. These rows expose the real Band room IDs captured from
          the five-agent spike that the packet receipts reference.
        </p>
        <div className="proof-ledger">
          {capturedRun.stage_evidence.map((evidence) => (
            <article key={evidence.band_message_id}>
              <span>{evidence.stage.replaceAll("_", " ")}</span>
              <strong>{evidence.label}</strong>
              <code>{evidence.band_message_id}</code>
              <p>{evidence.proves}</p>
            </article>
          ))}
        </div>
        <LiveBandRunner apiBase={apiBase} />
      </section>

      <section className="lower-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="kicker">Traceability</p>
              <h2>Missing distributor file recovered</h2>
            </div>
            <span className="mono-stat">
              {packet.initial_traceability.coverage_percent}% to{" "}
              {packet.final_traceability.coverage_percent}%
            </span>
          </div>
          <CoverageBar
            label="initial lot coverage"
            value={packet.initial_traceability.coverage_percent}
          />
          <CoverageBar
            label="final lot coverage"
            value={packet.final_traceability.coverage_percent}
          />
          <div className="shipment-grid">
            {packet.shipments.map((shipment) => (
              <div
                className="shipment"
                key={`${shipment.distributor}-${shipment.region}`}
              >
                <span
                  className={shipment.traced ? "trace-dot traced" : "trace-dot"}
                />
                <strong>{shipment.region}</strong>
                <small>{shipment.distributor}</small>
                <b>{shipment.units.toLocaleString()} units</b>
              </div>
            ))}
          </div>
        </article>

        <article className="panel decision-panel">
          <p className="kicker">Final packet</p>
          <h2>{packet.decision.action.replaceAll("_", " ")}</h2>
          <p className="decision-copy">{packet.decision.reason}</p>
          <div className="notice-list">
            {Object.entries(packet.notices).map(([key, value]) => (
              <div key={key}>
                <span>{key}</span>
                <p>{value}</p>
              </div>
            ))}
          </div>
          <div className="gate">
            <span>{veto?.id} risk veto cleared</span>
            <span>{approval?.id} human approval locked</span>
          </div>
        </article>
      </section>

      <section className="agents">
        {packet.agents.map((agent) => (
          <article key={agent.id}>
            <span>{agent.framework}</span>
            <strong>{agent.name}</strong>
            <small>{agent.handle}</small>
            <p>{agent.role}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

function ProofRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="proof-row">
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}

function CoverageBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="coverage">
      <div>
        <span>{label}</span>
        <b>{value}%</b>
      </div>
      <i>
        <em style={{ width: `${value}%` }} />
      </i>
    </div>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
