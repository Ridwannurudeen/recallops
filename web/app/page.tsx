import packetJson from "../public/demo-packet.json";

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
    room_id: string;
    participant_count: number;
    event_count: number;
    message_ids: string[];
    veto_message_id: string;
    approval_message_id: string;
    live_workflow_scope: string;
    live_workflow_room_id: string;
    live_workflow_participant_count: number;
    live_workflow_context_items: number;
    live_workflow_message_ids: string[];
    live_workflow_commander_event_id: string;
    live_workflow_commander_message_id: string;
    live_workflow_evidence_ack_id: string;
    live_workflow_traceability_gap_id: string;
    live_workflow_risk_veto_id: string;
    live_workflow_traceability_resolved_id: string;
    live_workflow_risk_approved_id: string;
    live_workflow_communications_notice_id: string;
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

  return (
    <main className="shell">
      <section className="mast">
        <div>
          <p className="kicker">RecallOps command room</p>
          <h1>
            {packet.lot} is live. The room decides before exposure compounds.
          </h1>
          <p className="lede">
            Quality, traceability, risk, communications, and a human QA director
            coordinate through one Band room. The regulator cannot approve the
            packet until the missing lot coverage is resolved.
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
          <p className="kicker">Band proof</p>
          <h2>Room evidence</h2>
          <ProofRow label="mode" value={packet.band_proof.proof_mode} />
          <ProofRow label="room" value={packet.band_proof.room_id} />
          <ProofRow
            label="participants"
            value={packet.band_proof.participant_count.toString()}
          />
          <ProofRow
            label="events"
            value={packet.band_proof.event_count.toString()}
          />
          <ProofRow label="veto" value={packet.band_proof.veto_message_id} />
          <ProofRow
            label="approval"
            value={packet.band_proof.approval_message_id}
          />
          <ProofRow
            label="live room"
            value={packet.band_proof.live_workflow_room_id}
          />
          <ProofRow
            label="live veto"
            value={packet.band_proof.live_workflow_risk_veto_id}
          />
          <ProofRow
            label="live notice"
            value={packet.band_proof.live_workflow_communications_notice_id}
          />
          <ProofRow
            label="context"
            value={`${packet.band_proof.live_workflow_context_items} items`}
          />
          <div className="hash-box">
            <span>audit seal</span>
            <code>{packet.audit_hash}</code>
          </div>
          <div className="api-actions">
            <a href={`${apiBase}/packet`}>packet api</a>
            <a href={`${apiBase}/proof`}>proof api</a>
            <a href={`${apiBase}/packet.json`}>export json</a>
          </div>
        </aside>
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
