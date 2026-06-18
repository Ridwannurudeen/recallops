"use client";

import { useEffect, useMemo, useState } from "react";
import type { Packet } from "./recall-data";
import { shortHash } from "./recall-data";
import ProofLabel from "./proof-label";

type ReplayVariant = "hero" | "full";
type ReadingMode = "operator" | "judge";

type SourceEvidenceApiResponse = {
  packet?: {
    audit_hash?: string;
  };
};

type ApprovalReceiptApiResponse = {
  receipt?: {
    approval_id?: string;
    receipt_hash?: string;
  };
  detail?: string;
};

type ReplayStep = {
  key: string;
  tag: string;
  status: string;
  decision: "PLANNING" | "BLOCKED" | "REPLANNING" | "READY" | "APPROVED";
  actor: string;
  message: string;
  coverage: number;
  untraced: number;
  digest: string;
  sourceCount: number;
  visibleEvents: number;
};

const replaySteps: ReplayStep[] = [
  {
    key: "intake",
    tag: "FACT",
    status: "Source packet opened",
    decision: "PLANNING",
    actor: "Evidence",
    message:
      "Complaint text and shipment CSV cite BAT-4421 overheating during overnight charge.",
    coverage: 82,
    untraced: 864,
    digest: "be6fcf51d4259fff883168e711b5bd07ea4afbe8c66448060a15a28121600216",
    sourceCount: 2,
    visibleEvents: 2,
  },
  {
    key: "handoff",
    tag: "HANDOFF",
    status: "Traceability recruited",
    decision: "PLANNING",
    actor: "Commander",
    message:
      "Severity and multi-region exposure recruit Traceability into the Band room.",
    coverage: 82,
    untraced: 864,
    digest: "be6fcf51d4259fff883168e711b5bd07ea4afbe8c66448060a15a28121600216",
    sourceCount: 2,
    visibleEvents: 4,
  },
  {
    key: "veto",
    tag: "VETO",
    status: "VETO-01 issued",
    decision: "BLOCKED",
    actor: "Regulatory/Risk",
    message:
      "864 shipped units remain untraced. Consumer-notice scope cannot yet be defended.",
    coverage: 82,
    untraced: 864,
    digest: "4bf9894bd6936a7b87163090a10983d662122ddfc7144f97545990506a0ef40a",
    sourceCount: 2,
    visibleEvents: 6,
  },
  {
    key: "source-recovered",
    tag: "SOURCE",
    status: "Distributor file recovered",
    decision: "REPLANNING",
    actor: "Traceability",
    message:
      "Kestrel Distributor file enters the Source Cockpit and accounts for the missing 864 units.",
    coverage: 100,
    untraced: 0,
    digest: "d93eb4e729e6b30f6d419b3e06f293e026f67ec2e8e0971f89e392fa3e8812ea",
    sourceCount: 3,
    visibleEvents: 7,
  },
  {
    key: "replan",
    tag: "REPLAN",
    status: "Coverage recomputed",
    decision: "READY",
    actor: "Regulatory/Risk",
    message:
      "Risk clears the re-plan after full traceability and prepares the recall action for QA approval.",
    coverage: 100,
    untraced: 0,
    digest: "2a1b7e598105c3bd4cd1536d7ef8bd72c5e5e017ac0e107fb3d22418f11d5109",
    sourceCount: 3,
    visibleEvents: 8,
  },
  {
    key: "approval-ready",
    tag: "APPROVAL",
    status: "Human approval required",
    decision: "READY",
    actor: "QA Director",
    message:
      "QA reviews scope, regions, notices, remaining exceptions, ERP hold payload, and identity receipt.",
    coverage: 100,
    untraced: 0,
    digest: "b6b3848989736619d8c3d1f496cbe7ea05e6832c050780b50555009e119c7780",
    sourceCount: 3,
    visibleEvents: 9,
  },
  {
    key: "sealed",
    tag: "DISPATCH",
    status: "Decision sealed",
    decision: "APPROVED",
    actor: "QA Director",
    message:
      "Recall action approved. SAP and Oracle dry-run payloads are prepared and the receipt chain is inspectable.",
    coverage: 100,
    untraced: 0,
    digest: "da1c570d2fc1b9ca86fe7c2f872bd74895e51bd868766b6f373335306d10ff2b",
    sourceCount: 3,
    visibleEvents: 10,
  },
];

export default function Bat4421Replay({
  apiBase = "/api",
  packet,
  variant = "hero",
}: {
  apiBase?: string;
  packet: Packet;
  variant?: ReplayVariant;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<ReadingMode>("operator");
  const [approving, setApproving] = useState(false);
  const [approvalReceipt, setApprovalReceipt] =
    useState<ApprovalReceiptApiResponse | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const step = replaySteps[stepIndex];
  const visibleEvents = packet.events.slice(0, step.visibleEvents);
  const capturedRun = packet.band_proof.captured_band_run;
  const finalStepIndex = replaySteps.length - 1;
  const approvalReady = step.key === "approval-ready";
  const sealed = step.key === "sealed";

  const sourceFiles = useMemo(
    () => [
      {
        name: "complaints.txt",
        status: "cited",
        detail: "3 thermal swelling reports",
      },
      {
        name: "shipment-ledger.csv",
        status: step.sourceCount >= 2 ? "cited" : "waiting",
        detail: "3,936 traced units",
      },
      {
        name: "kestrel-distributor.csv",
        status: step.sourceCount >= 3 ? "recovered" : "missing",
        detail:
          step.sourceCount >= 3
            ? "864 units recovered"
            : "required before approval",
      },
    ],
    [step.sourceCount],
  );

  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = window.setInterval(() => {
      setStepIndex((current) => {
        if (current >= 5) {
          setRunning(false);
          return current;
        }
        return current + 1;
      });
    }, 2300);
    return () => window.clearInterval(timer);
  }, [running]);

  function replay() {
    setStepIndex(0);
    setRunning(true);
  }

  function stepForward() {
    setRunning(false);
    setStepIndex((current) => Math.min(current + 1, finalStepIndex));
  }

  async function approve() {
    setRunning(false);
    setApproving(true);
    setApprovalError(null);
    try {
      const sourceResponse = await fetch(`${apiBase}/source-evidence`, {
        cache: "no-store",
      });
      const sourceBody =
        (await sourceResponse.json()) as SourceEvidenceApiResponse;
      if (!sourceResponse.ok || !sourceBody.packet?.audit_hash) {
        throw new Error("Source evidence is not ready for approval.");
      }

      const approvalResponse = await fetch(`${apiBase}/approval-receipt`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          approver: "QA Director",
          decision: "approved",
          reason:
            "Traceability reached 100% and the risk hold cleared for human approval.",
          source_audit_hash: sourceBody.packet.audit_hash,
        }),
      });
      const approvalBody =
        (await approvalResponse.json()) as ApprovalReceiptApiResponse;
      if (!approvalResponse.ok) {
        throw new Error(approvalBody.detail ?? "Approval receipt failed.");
      }

      setApprovalReceipt(approvalBody);
      setStepIndex(finalStepIndex);
    } catch (exc) {
      setApprovalError(
        exc instanceof Error ? exc.message : "Approval receipt failed.",
      );
    } finally {
      setApproving(false);
    }
  }

  function reset() {
    setRunning(false);
    setStepIndex(0);
  }

  return (
    <section className={`bat-replay bat-replay-${variant}`}>
      <div className="replay-top-rail">
        <div>
          <span>BAT-4421</span>
          <strong>CRITICAL</strong>
        </div>
        <div>
          <span>Exposure</span>
          <strong>{packet.exposure_clock.hours_since_first_report}h</strong>
        </div>
        <div>
          <span>Coverage</span>
          <strong>{step.coverage}%</strong>
        </div>
        <div className={`decision-state state-${step.decision.toLowerCase()}`}>
          <span>Decision</span>
          <strong>{step.decision}</strong>
        </div>
      </div>

      <div className="replay-controls">
        <div className="mode-toggle" role="group" aria-label="Reading mode">
          <button
            aria-pressed={mode === "operator"}
            type="button"
            onClick={() => setMode("operator")}
          >
            Operator Mode
          </button>
          <button
            aria-pressed={mode === "judge"}
            type="button"
            onClick={() => setMode("judge")}
          >
            Judge Mode
          </button>
        </div>
        <div className="replay-buttons">
          <button type="button" onClick={replay}>
            {running ? "Replaying" : "Replay decision"}
          </button>
          <button type="button" onClick={stepForward}>
            Step
          </button>
          <button type="button" onClick={reset}>
            Reset
          </button>
        </div>
      </div>

      <div className="replay-grid">
        <article className="replay-panel source-panel">
          <div className="replay-panel-head">
            <p>Source Cockpit</p>
            <ProofLabel status="DETERMINISTIC">sealed demo data</ProofLabel>
          </div>
          <div className="source-file-list">
            {sourceFiles.map((file) => (
              <div
                className={`source-file source-file-${file.status}`}
                key={file.name}
              >
                <span>{file.status}</span>
                <strong>{file.name}</strong>
                <small>{file.detail}</small>
              </div>
            ))}
          </div>
          <div className="digest-card">
            <span>Source to fact digest</span>
            <code>{shortHash(step.digest, 10)}</code>
          </div>
        </article>

        <article className="replay-panel room-panel">
          <div className="replay-panel-head">
            <p>Band Command Room</p>
            <ProofLabel status="CAPTURED">room IDs exposed</ProofLabel>
          </div>
          <div className="room-event-list">
            {visibleEvents.map((event) => (
              <div className={`room-event event-${event.stage}`} key={event.id}>
                <span>[{eventTag(event.stage)}]</span>
                <div>
                  <strong>{event.agent}</strong>
                  <p>{event.message}</p>
                  {mode === "judge" ? (
                    <code>
                      {event.id} /{" "}
                      {receiptReference(packet, event.id) ?? "band pending"}
                    </code>
                  ) : (
                    <details>
                      <summary>message id</summary>
                      <code>{event.id}</code>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="replay-panel decision-panel-live">
          <div className="replay-panel-head">
            <p>Decision Control</p>
            <ProofLabel status="GATED">human approval</ProofLabel>
          </div>
          <div className={`veto-card veto-card-${step.decision.toLowerCase()}`}>
            <span>{step.tag}</span>
            <strong>{step.status}</strong>
            <p>{step.message}</p>
          </div>
          <dl className="decision-metrics">
            <div>
              <dt>Coverage</dt>
              <dd>{step.coverage}%</dd>
            </div>
            <div>
              <dt>Untraced</dt>
              <dd>{step.untraced.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Regions</dt>
              <dd>{packet.final_traceability.regions}</dd>
            </div>
          </dl>
          <div className="approval-box">
            <span>Authorize</span>
            <strong>Voluntary recall, notices, quarantine, ERP hold</strong>
            <small>
              {approvalReceipt?.receipt?.receipt_hash
                ? `Receipt: ${shortHash(approvalReceipt.receipt.receipt_hash, 10)}`
                : `Scope: ${packet.exposure_clock.units_in_market.toLocaleString()} units / ${packet.final_traceability.regions} regions / ${packet.final_traceability.affected_customers.toLocaleString()} customers`}
            </small>
            <button
              type="button"
              disabled={approving || (!approvalReady && !sealed)}
              onClick={approve}
            >
              {approving
                ? "Approving..."
                : sealed
                  ? "Recall action approved"
                  : "Approve recall action"}
            </button>
            {approvalError ? <small>{approvalError}</small> : null}
          </div>
        </article>
      </div>

      <div className="decision-chain">
        {["SOURCE", "FACT", "VETO", "RECOVERY", "APPROVAL", "RECEIPT"].map(
          (item, index) => (
            <span
              className={index <= chainIndex(step.key) ? "chain-active" : ""}
              key={item}
            >
              {item}
            </span>
          ),
        )}
      </div>

      {sealed || mode === "judge" ? (
        <div className="receipt-drawer">
          <div>
            <p>Receipt chain</p>
            <strong>{packet.audit_hash}</strong>
          </div>
          <div className="receipt-mini-grid">
            {packet.receipts.slice(-4).map((receipt) => (
              <article key={receipt.id}>
                <span>{receipt.status}</span>
                <strong>{receipt.id}</strong>
                <code>{shortHash(receipt.receipt_hash, 8)}</code>
              </article>
            ))}
          </div>
          <div className="captured-band-strip">
            <span>Captured Band room</span>
            <code>{capturedRun.room_id}</code>
            <code>{capturedRun.risk_veto_id}</code>
            <code>{capturedRun.communications_notice_id}</code>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function eventTag(stage: string) {
  switch (stage) {
    case "room_created":
      return "SOURCE";
    case "evidence_extracted":
      return "FACT";
    case "agent_recruited":
      return "HANDOFF";
    case "traceability_gap":
      return "FACT";
    case "regulatory_veto":
      return "VETO";
    case "traceability_resolved":
      return "SOURCE";
    case "risk_approved":
      return "REPLAN";
    case "notice_drafted":
      return "DISPATCH";
    case "human_approved":
      return "APPROVAL";
    default:
      return "EVENT";
  }
}

function receiptReference(packet: Packet, eventId: string) {
  return packet.receipts.find((receipt) => receipt.event_id === eventId)
    ?.band_reference;
}

function chainIndex(stepKey: string) {
  switch (stepKey) {
    case "intake":
      return 1;
    case "handoff":
      return 1;
    case "veto":
      return 2;
    case "source-recovered":
      return 3;
    case "replan":
      return 3;
    case "approval-ready":
      return 4;
    case "sealed":
      return 5;
    default:
      return 0;
  }
}
