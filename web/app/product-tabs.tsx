import type { Packet } from "./recall-data";
import EnterpriseReadiness from "./enterprise-readiness";
import LiveBandRunner from "./live-band-runner";
import LiveDrill from "./live-drill";
import OperatorWorkflow from "./operator-workflow";

type MarketSignal = {
  company: string;
  product: string;
  signal: string;
  recallops: string;
  href: string;
};

type Capability = {
  capability: string;
  incumbent: string;
  recallops: string;
};

type OperatingLayer = {
  layer: string;
  headline: string;
  copy: string;
};

type CommandProof = {
  label: string;
  headline: string;
  copy: string;
};

type BuyerOutcome = {
  team: string;
  outcome: string;
  proof: string;
};

type DeploymentPhase = {
  phase: string;
  title: string;
  copy: string;
};

type ProductTabsProps = {
  packet: Packet;
  apiBase: string;
  marketSignals: MarketSignal[];
  capabilityMatrix: Capability[];
  operatingLayers: OperatingLayer[];
  commandProofs: CommandProof[];
  buyerOutcomes: BuyerOutcome[];
  deploymentPath: DeploymentPhase[];
};

const stageLabels: Record<Packet["events"][number]["stage"], string> = {
  room_created: "room",
  evidence_extracted: "evidence",
  agent_recruited: "recruit",
  traceability_gap: "gap",
  regulatory_veto: "hold",
  traceability_resolved: "resolved",
  risk_approved: "cleared",
  notice_drafted: "notice",
  human_approved: "approval gate",
};

export default function ProductTabs({
  packet,
  apiBase,
  marketSignals,
  capabilityMatrix,
  operatingLayers,
  commandProofs,
  buyerOutcomes,
  deploymentPath,
}: ProductTabsProps) {
  const veto = packet.events.find((event) => event.stage === "regulatory_veto");
  const approval = packet.events.find(
    (event) => event.stage === "human_approved",
  );
  const capturedRun = packet.band_proof.captured_band_run;

  return (
    <section className="tabbed-product">
      <input
        className="tab-input"
        type="radio"
        name="recallops-tabs"
        id="tab-command"
      />
      <input
        className="tab-input"
        type="radio"
        name="recallops-tabs"
        id="tab-evidence"
        defaultChecked
      />
      <input
        className="tab-input"
        type="radio"
        name="recallops-tabs"
        id="tab-enterprise"
      />
      <input
        className="tab-input"
        type="radio"
        name="recallops-tabs"
        id="tab-market"
      />
      <input
        className="tab-input"
        type="radio"
        name="recallops-tabs"
        id="tab-deployment"
      />

      <div className="tab-list" role="tablist" aria-label="RecallOps sections">
        <label htmlFor="tab-evidence" role="tab">
          Interactive Demo <span>edit, run, approve</span>
        </label>
        <label htmlFor="tab-command" role="tab">
          Scripted Room <span>walkthrough and proof</span>
        </label>
        <label htmlFor="tab-enterprise" role="tab">
          Enterprise <span>SAP, Oracle, identity</span>
        </label>
        <label htmlFor="tab-market" role="tab">
          Market <span>incumbent gap map</span>
        </label>
        <label htmlFor="tab-deployment" role="tab">
          Deployment <span>buyer and rollout path</span>
        </label>
      </div>

      <div className="tab-panels">
        <section className="tab-panel tab-command-panel">
          <LiveDrill packet={packet} />

          <section className="command-grid">
            <article className="panel timeline-panel">
              <div className="panel-head">
                <div>
                  <p className="kicker">Band transcript</p>
                  <h2>Hold, re-plan, approval</h2>
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
              <ProofRow
                label="hold"
                value={packet.band_proof.veto_message_id}
              />
              <ProofRow
                label="approval"
                value={packet.band_proof.approval_message_id}
              />
              <ProofRow label="captured room" value={capturedRun.room_id} />
              <ProofRow label="captured at" value={capturedRun.captured_at} />
              <ProofRow
                label="captured hold"
                value={capturedRun.risk_veto_id}
              />
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
              walkthrough. These rows expose the real Band room IDs captured
              from the five-agent spike that the packet receipts reference.
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
        </section>

        <section className="tab-panel tab-evidence-panel">
          <OperatorWorkflow apiBase={apiBase} />

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
                      className={
                        shipment.traced ? "trace-dot traced" : "trace-dot"
                      }
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
                <span>{veto?.id} risk hold cleared</span>
                <span>{approval?.id} human approval locked</span>
              </div>
            </article>
          </section>
        </section>

        <section className="tab-panel tab-enterprise-panel">
          <EnterpriseReadiness apiBase={apiBase} />

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
        </section>

        <section className="tab-panel tab-market-panel">
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
              closure. The opening is the layer between them: a command room
              that makes the decision path inspectable before the recall
              propagates into ERP, QMS, support, and regulator channels.
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
                <h2>
                  What the market already expects, and what RecallOps adds
                </h2>
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
        </section>

        <section className="tab-panel tab-deployment-panel">
          <section className="panel buyer-proof">
            <div>
              <p className="kicker">why it can outrank</p>
              <h2>
                Built for the search intent incumbents answer only halfway
              </h2>
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
        </section>
      </div>
    </section>
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
