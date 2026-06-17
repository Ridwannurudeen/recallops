import packetJson from "../public/demo-packet.json";
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

export default function Home() {
  const veto = packet.events.find((event) => event.stage === "regulatory_veto");
  const approval = packet.events.find(
    (event) => event.stage === "human_approved",
  );
  const capturedRun = packet.band_proof.captured_band_run;

  return (
    <main className="shell">
      <section className="mast">
        <div>
          <p className="kicker">RecallOps command room</p>
          <h1>
            {packet.lot} is live. The room decides before exposure compounds.
          </h1>
          <p className="lede">
            A deterministic recall packet is paired with a captured five-agent
            Band run. The regulator cannot approve the packet until the missing
            lot coverage is resolved, the veto clears, and the audit seal
            recomputes.
          </p>
        </div>
        <aside className="exposure">
          <span className="live-dot" />
          <p className="kicker">exposure clock</p>
          <strong>{packet.exposure_clock.unit_hours.toLocaleString()}</strong>
          <span>unit-hours in market</span>
          <dl>
            <div>
              <dt>Units</dt>
              <dd>{packet.exposure_clock.units_in_market.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Hours</dt>
              <dd>{packet.exposure_clock.hours_since_first_report}</dd>
            </div>
            <div>
              <dt>Regions</dt>
              <dd>{packet.final_traceability.regions}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <LiveDrill packet={packet} />

      <SourceEvidenceCockpit apiBase={apiBase} />

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
