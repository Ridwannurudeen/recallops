"use client";

import { useEffect, useMemo, useState } from "react";

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

type Agent = {
  id: string;
  name: string;
  handle: string;
  framework: string;
  role: string;
};

type RecallEvent = {
  id: string;
  at: string;
  stage: EventStage;
  agent: string;
  message: string;
  mentions: string[];
  metadata: Record<string, string | number | boolean>;
};

type Traceability = {
  coverage_percent: number;
  untraced_units: number;
};

type DecisionReceipt = {
  id: string;
  event_id: string;
  agent: string;
  check: string;
  status: "recorded" | "blocked" | "cleared" | "sealed";
  band_reference: string;
  previous_hash: string;
  receipt_hash: string;
};

type DecisionGraphEdge = {
  source: string;
  target: string;
  label: string;
  band_message_id: string;
};

type DrillPacket = {
  agents: Agent[];
  events: RecallEvent[];
  receipts: DecisionReceipt[];
  initial_traceability: Traceability;
  final_traceability: Traceability;
  decision_graph: {
    edges: DecisionGraphEdge[];
  };
};

const JOIN_INDEX: Record<string, number> = {
  "Incident Commander": 0,
  "Evidence Agent": 0,
  "Traceability Agent": 2,
  "Regulatory/Risk Officer": 4,
  "Communications Agent": 7,
  "QA Director": 7,
};

export default function LiveDrill({ packet }: { packet: DrillPacket }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [running, setRunning] = useState(true);
  const currentEvent = packet.events[activeIndex];
  const currentReceipt = packet.receipts.find(
    (receipt) => receipt.event_id === currentEvent.id,
  );
  const visibleEvents = packet.events.slice(0, activeIndex + 1);
  const visibleReceipts = packet.receipts.slice(
    Math.max(0, activeIndex - 3),
    activeIndex + 1,
  );
  const traceability =
    activeIndex >= stageIndex(packet.events, "traceability_resolved")
      ? packet.final_traceability
      : packet.initial_traceability;
  const activeAgent = currentEvent.agent;
  const graphEdges = useMemo(
    () =>
      packet.decision_graph.edges.filter((edge) =>
        visibleEvents.some(
          (event) =>
            event.id === edge.band_message_id ||
            event.id === currentReceipt?.event_id ||
            edge.band_message_id === currentReceipt?.band_reference,
        ),
      ),
    [currentReceipt, packet.decision_graph.edges, visibleEvents],
  );

  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((index) => {
        if (index >= packet.events.length - 1) {
          setRunning(false);
          return index;
        }
        return index + 1;
      });
    }, 1400);
    return () => window.clearInterval(timer);
  }, [packet.events.length, running]);

  return (
    <section className="drill-panel">
      <div className="panel-head drill-head">
        <div>
          <p className="kicker">judge mode</p>
          <h2>Live incident drill</h2>
        </div>
        <div className="drill-controls">
          <button type="button" onClick={() => setRunning((value) => !value)}>
            {running ? "pause" : "run"}
          </button>
          <button
            type="button"
            onClick={() =>
              setActiveIndex((index) =>
                Math.min(index + 1, packet.events.length - 1),
              )
            }
          >
            step
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveIndex(0);
              setRunning(true);
            }}
          >
            reset
          </button>
        </div>
      </div>

      <div className="drill-grid">
        <article className={`drill-monitor monitor-${currentEvent.stage}`}>
          <span className="stage">
            {currentEvent.stage.replaceAll("_", " ")}
          </span>
          <strong>{currentEvent.agent}</strong>
          <p>{currentEvent.message}</p>
          <dl>
            <div>
              <dt>coverage</dt>
              <dd>{traceability.coverage_percent}%</dd>
            </div>
            <div>
              <dt>untraced</dt>
              <dd>{traceability.untraced_units.toLocaleString()}</dd>
            </div>
            <div>
              <dt>receipt</dt>
              <dd>{currentReceipt?.id ?? "pending"}</dd>
            </div>
          </dl>
        </article>

        <article className="room-roster">
          <p className="kicker">room membership</p>
          {packet.agents.map((agent) => {
            const joined = activeIndex >= JOIN_INDEX[agent.name];
            const active = agent.name === activeAgent;
            return (
              <div
                className={`agent-lane ${joined ? "joined" : ""} ${
                  active ? "active" : ""
                }`}
                key={agent.id}
              >
                <span>{joined ? "joined" : "waiting"}</span>
                <strong>{agent.name}</strong>
                <small>{agent.framework}</small>
              </div>
            );
          })}
        </article>

        <article className="receipt-chain">
          <p className="kicker">hash-linked receipts</p>
          {visibleReceipts.map((receipt) => (
            <div
              className={`receipt receipt-${receipt.status}`}
              key={receipt.id}
            >
              <span>{receipt.status}</span>
              <strong>
                {receipt.id} / {receipt.event_id}
              </strong>
              <p>{receipt.check}</p>
              <code>{receipt.receipt_hash}</code>
            </div>
          ))}
        </article>

        <article className="handoff-graph">
          <p className="kicker">handoff graph</p>
          {graphEdges.length === 0 ? (
            <div className="graph-edge pending-edge">
              <span>awaiting handoff</span>
              <strong>{currentEvent.id}</strong>
            </div>
          ) : (
            graphEdges.map((edge) => (
              <div className="graph-edge" key={`${edge.source}-${edge.target}`}>
                <span>{edge.source}</span>
                <strong>{edge.label}</strong>
                <span>{edge.target}</span>
              </div>
            ))
          )}
        </article>
      </div>
    </section>
  );
}

function stageIndex(events: RecallEvent[], stage: EventStage) {
  const index = events.findIndex((event) => event.stage === stage);
  return index === -1 ? events.length : index;
}
