import packetJson from "../public/demo-packet.json";
import ProductTabs from "./product-tabs";

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

export type Packet = {
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

      <ProductTabs
        packet={packet}
        apiBase={apiBase}
        marketSignals={marketSignals}
        capabilityMatrix={capabilityMatrix}
        operatingLayers={operatingLayers}
        commandProofs={commandProofs}
        buyerOutcomes={buyerOutcomes}
        deploymentPath={deploymentPath}
      />
    </main>
  );
}
