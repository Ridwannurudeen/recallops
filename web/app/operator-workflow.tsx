"use client";

import { useEffect, useMemo, useState } from "react";

import ProofLabel from "./proof-label";
import SourceEvidenceCockpit, {
  SourceEvidenceResponse,
} from "./source-evidence-cockpit";

type SyncTargets = {
  sap: boolean;
  oracle: boolean;
};

type ActionResponse = {
  action: string;
  status: number;
  body: unknown;
};

type RecallRoomRunResponse = {
  run: {
    proof_kind: string;
    mode: string;
    disclosure: string;
    incident_id: string;
    source_audit_hash: string;
    approval_ready: boolean;
    room: {
      room_id: string;
      room_hash: string;
      events: {
        id: string;
        stage: string;
        agent: string;
        message: string;
      }[];
    };
    band: {
      mode: string;
      room_id: string;
      proof_mode: string;
      participant_count: number;
      message_ids: string[];
      live_error?: {
        status_code: number;
        detail: string;
      };
    };
    causality_chain: string[];
    run_hash: string;
    verification: {
      ok: boolean;
      algorithm: string;
      expected_hash: string;
      actual_hash: string;
    };
  };
};

type FilingPackResponse = {
  filing_pack: {
    proof_kind: string;
    mode: string;
    disclosure: string;
    source_audit_hash: string;
    approval_ready: boolean;
    source_summary: {
      product: string;
      lot: string;
      severity: string;
      final_traceability: {
        coverage_percent: number;
        untraced_units: number;
      };
    };
    filings: {
      id: string;
      authority: string;
      label: string;
      status: string;
      deadline_hours: number | null;
      matched_regions: string[];
      required_human_action: string;
    }[];
    notices: {
      id: string;
      recipient: string;
      status: string;
      payload_hash: string;
      draft: string;
    }[];
    pack_hash: string;
    verification: {
      ok: boolean;
      algorithm: string;
      expected_hash: string;
      actual_hash: string;
    };
  };
};

type RegulatorDispatchResponse = {
  regulator_dispatch: {
    mode: string;
    external_submit: boolean;
    payload_hash: string;
    targets: {
      id: string;
      label: string;
      mode: string;
      external_submit: boolean;
      status: string;
      payload_hash: string;
      action_required?: string | null;
    }[];
  };
};

type ESignatureResponse = {
  receipt: {
    signature_id: string;
    signed_at: string;
    approver: string;
    decision: "approved" | "rejected";
    meaning: string;
    source_audit_hash: string;
    recall_room_run_hash: string;
    filing_pack_hash: string;
    record_hash: string;
    signature_hash: string;
    controls: {
      disclosure: string;
    };
  };
  verification: {
    ok: boolean;
    algorithm: string;
    expected_hash: string;
    actual_hash: string;
    record_hash: string;
  };
};

function ensureTargets(targets: SyncTargets): ("sap" | "oracle")[] {
  const chosen: ("sap" | "oracle")[] = [];
  if (targets.sap) {
    chosen.push("sap");
  }
  if (targets.oracle) {
    chosen.push("oracle");
  }
  return chosen;
}

export default function OperatorWorkflow({ apiBase }: { apiBase: string }) {
  const [evidence, setEvidence] = useState<SourceEvidenceResponse | null>(null);
  const [adminKey, setAdminKey] = useState("");
  const [targets, setTargets] = useState<SyncTargets>({
    sap: true,
    oracle: true,
  });
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<ActionResponse | null>(null);
  const [runLiveBand, setRunLiveBand] = useState(false);
  const [recallRun, setRecallRun] = useState<RecallRoomRunResponse | null>(
    null,
  );
  const [filingPack, setFilingPack] = useState<FilingPackResponse | null>(null);
  const [regulatorDispatch, setRegulatorDispatch] =
    useState<RegulatorDispatchResponse | null>(null);
  const [esignature, setESignature] = useState<ESignatureResponse | null>(null);
  const [caseDrafted, setCaseDrafted] = useState(false);
  const [dryRunDone, setDryRunDone] = useState(false);
  const [liveHoldDone, setLiveHoldDone] = useState(false);

  const selectedTargets = useMemo(() => ensureTargets(targets), [targets]);
  const actionBusy = busyAction !== null;
  const normalizedAdminKey = adminKey.trim();
  const hasAdminKey = normalizedAdminKey.length > 0;
  const hasEvidence = evidence !== null;
  const hasTargets = selectedTargets.length > 0;
  const canRunRecallRoom = hasEvidence && !actionBusy;
  const canGenerateFilingPack =
    hasEvidence && recallRun !== null && !actionBusy;
  const canPrepareRegulatorDispatch =
    hasEvidence && filingPack !== null && !actionBusy;
  const canCreateCase = hasEvidence && filingPack !== null && !actionBusy;
  const canDryRunSync = hasEvidence && caseDrafted && !actionBusy;
  const canSignApproval =
    hasEvidence &&
    recallRun !== null &&
    filingPack !== null &&
    hasAdminKey &&
    !actionBusy;
  const canRunLive =
    hasEvidence &&
    dryRunDone &&
    esignature !== null &&
    hasAdminKey &&
    hasTargets &&
    !actionBusy;
  const liveKeyHint = hasAdminKey
    ? "approval code is set"
    : "enter approval code to unlock live hold";

  useEffect(() => {
    if (!evidence) {
      return;
    }
    setCaseDrafted(false);
    setDryRunDone(false);
    setLiveHoldDone(false);
    setRecallRun(null);
    setFilingPack(null);
    setRegulatorDispatch(null);
    setESignature(null);
    setError(null);
  }, [evidence]);

  async function runAction(
    action: string,
    options: {
      method: "GET" | "POST";
      path: string;
      body?: Record<string, unknown>;
      headers?: Record<string, string>;
    },
  ) {
    if (!evidence) {
      setError("Load source evidence before running live demo actions.");
      return null;
    }

    setBusyAction(action);
    setError(null);
    try {
      const request: RequestInit = {
        method: options.method,
      };
      if (options.headers) {
        request.headers = options.headers;
      }
      if (options.body) {
        request.headers = {
          ...(request.headers as Record<string, string>),
          "content-type": "application/json",
        };
        request.body = JSON.stringify(options.body);
      }

      const response = await fetch(`${apiBase}${options.path}`, request);
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.detail ?? `${action} failed.`);
      }

      const result = {
        action,
        status: response.status,
        body,
      };
      setLastAction(result);
      if (action === "create-case") {
        setCaseDrafted(result.status >= 200 && result.status < 300);
        if (result.status < 200 || result.status >= 300) {
          setDryRunDone(false);
          setLiveHoldDone(false);
        }
      }
      if (action === "enterprise-sync-dry-run") {
        setDryRunDone(result.status >= 200 && result.status < 300);
        if (result.status < 200 || result.status >= 300) {
          setLiveHoldDone(false);
        }
      }
      if (action === "enterprise-sync-live") {
        setLiveHoldDone(result.status >= 200 && result.status < 300);
      }
      return result;
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : `${action} failed.`;
      const result = {
        action,
        status: 0,
        body: { error: message },
      };
      setLastAction(result);
      if (action === "create-case") {
        setCaseDrafted(false);
      }
      if (action === "enterprise-sync-dry-run") {
        setDryRunDone(false);
      }
      if (action === "enterprise-sync-live") {
        setLiveHoldDone(false);
      }
      setError(message);
      return null;
    } finally {
      setBusyAction(null);
    }
  }

  async function createCaseRecord() {
    if (!evidence) {
      return;
    }
    await runAction("create-case", {
      method: "POST",
      path: "/api/cases",
      body: {
        complaint_text: evidence.inputs.complaint_text,
        shipment_csv: evidence.inputs.shipment_csv,
        recovered_shipment_csv: evidence.inputs.recovered_shipment_csv,
      },
    });
  }

  async function runRecallRoom() {
    if (!evidence) {
      return;
    }
    const result = await runAction("recall-room-run", {
      method: "POST",
      path: "/api/recall-room/run",
      body: {
        complaint_text: evidence.inputs.complaint_text,
        shipment_csv: evidence.inputs.shipment_csv,
        recovered_shipment_csv: evidence.inputs.recovered_shipment_csv,
        run_live_band: runLiveBand,
      },
    });
    if (result && result.status >= 200 && result.status < 300) {
      setRecallRun(result.body as RecallRoomRunResponse);
      setFilingPack(null);
      setRegulatorDispatch(null);
      setESignature(null);
    }
  }

  async function generateFilingPack() {
    if (!evidence) {
      return;
    }
    const result = await runAction("filing-pack", {
      method: "POST",
      path: "/api/filing-pack",
      body: {
        complaint_text: evidence.inputs.complaint_text,
        shipment_csv: evidence.inputs.shipment_csv,
        recovered_shipment_csv: evidence.inputs.recovered_shipment_csv,
      },
    });
    if (result && result.status >= 200 && result.status < 300) {
      setFilingPack(result.body as FilingPackResponse);
      setRegulatorDispatch(null);
      setESignature(null);
    }
  }

  async function prepareRegulatorDispatch() {
    if (!evidence) {
      return;
    }
    const result = await runAction("regulator-filing", {
      method: "POST",
      path: "/api/regulator-filing",
      body: {
        complaint_text: evidence.inputs.complaint_text,
        shipment_csv: evidence.inputs.shipment_csv,
        recovered_shipment_csv: evidence.inputs.recovered_shipment_csv,
        dry_run: true,
      },
    });
    if (result && result.status >= 200 && result.status < 300) {
      setRegulatorDispatch(result.body as RegulatorDispatchResponse);
    }
  }

  async function signApproval() {
    if (!evidence || !recallRun || !filingPack) {
      return;
    }
    if (!hasAdminKey) {
      setError("E-signature approval requires the approval code.");
      return;
    }
    const result = await runAction("esignature-approval", {
      method: "POST",
      path: "/api/esignature-approval",
      headers: {
        "x-recallops-approval-key": normalizedAdminKey,
      },
      body: {
        approver: "QA Director",
        decision: "approved",
        reason:
          "I reviewed source evidence, recall room, filing pack, and ERP dry-run.",
        source_audit_hash: evidence.packet.audit_hash,
        recall_room_run_hash: recallRun.run.run_hash,
        filing_pack_hash: filingPack.filing_pack.pack_hash,
      },
    });
    if (result && result.status >= 200 && result.status < 300) {
      setESignature(result.body as ESignatureResponse);
    }
  }

  async function runEnterpriseSync(dryRun: boolean) {
    if (!evidence) {
      return;
    }
    if (!dryRun && !hasAdminKey) {
      setError("Live enterprise sync requires the approval code.");
      return;
    }
    if (selectedTargets.length === 0) {
      setError("Select at least one target before running enterprise sync.");
      return;
    }

    const headers: Record<string, string> = {};
    if (!dryRun && adminKey.length > 0) {
      headers["x_recallops_admin_key"] = normalizedAdminKey;
    }

    await runAction(
      dryRun ? "enterprise-sync-dry-run" : "enterprise-sync-live",
      {
        method: "POST",
        path: "/api/enterprise-sync",
        body: {
          complaint_text: evidence.inputs.complaint_text,
          shipment_csv: evidence.inputs.shipment_csv,
          recovered_shipment_csv: evidence.inputs.recovered_shipment_csv,
          dry_run: dryRun,
          targets: selectedTargets,
        },
        headers,
      },
    );
  }

  function updateTarget(target: keyof SyncTargets, value: boolean) {
    setTargets((current) => ({
      ...current,
      [target]: value,
    }));
  }

  const isCreating = busyAction === "create-case";
  const isRecallRoom = busyAction === "recall-room-run";
  const isFilingPack = busyAction === "filing-pack";
  const isRegulatorFiling = busyAction === "regulator-filing";
  const isESignature = busyAction === "esignature-approval";
  const isDryRunSync = busyAction === "enterprise-sync-dry-run";
  const isLiveSync = busyAction === "enterprise-sync-live";
  const isActionSuccess =
    lastAction !== null && lastAction.status >= 200 && lastAction.status < 300;
  const evidenceSummary = evidence
    ? {
        incidentId: evidence.packet.incident_id,
        initialCoverage: evidence.packet.initial_traceability.coverage_percent,
        missingUnits: evidence.packet.initial_traceability.untraced_units,
        totalUnits: evidence.packet.initial_traceability.shipped_units,
        regions: evidence.packet.initial_traceability.regions,
        statusText: "Ready",
      }
    : null;

  function actionSuccessMessage(actionName: string, body: unknown) {
    const responseText =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : "";
    if (actionName === "create-case") {
      return responseText || "Recall plan is ready for the case.";
    }
    if (actionName === "recall-room-run") {
      return "Recall room run is bound to the current source packet and Band evidence.";
    }
    if (actionName === "filing-pack") {
      return "Multi-jurisdiction filing pack is ready for human review.";
    }
    if (actionName === "regulator-filing") {
      return "Regulator dispatch dry-run prepared without external submission.";
    }
    if (actionName === "esignature-approval") {
      return "Attributable e-signature receipt sealed the source, room, and filing hashes.";
    }
    if (actionName === "enterprise-sync-dry-run") {
      return (
        responseText ||
        "Safety check completed. You can review the preview before sending live."
      );
    }
    return responseText || "Live hold request submitted.";
  }

  function actionErrorMessage(body: unknown) {
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
    ) {
      return (body as { error: string }).error;
    }
    return "Action could not complete. Try again.";
  }

  function actionTitle(actionName: string) {
    if (actionName === "create-case") {
      return "Built recall plan";
    }
    if (actionName === "recall-room-run") {
      return "Ran recall room";
    }
    if (actionName === "filing-pack") {
      return "Generated filing pack";
    }
    if (actionName === "regulator-filing") {
      return "Prepared regulator dispatch";
    }
    if (actionName === "esignature-approval") {
      return "Signed approval receipt";
    }
    if (actionName === "enterprise-sync-dry-run") {
      return "Safety check completed";
    }
    return "Live hold request sent";
  }

  function actionStepState(isCompleted: boolean) {
    return isCompleted ? "done" : "waiting";
  }

  return (
    <section className="panel raw-proof">
      <div className="panel-head">
        <div>
          <p className="kicker">Interactive live demo</p>
          <h2>Create a practical recall case against the live engine.</h2>
        </div>
        <ProofLabel status="GATED">protected live actions</ProofLabel>
      </div>

      <section className="panel-head write-mode-brief">
        <p className="kicker">guided operator flow</p>
        <h2>Run this like a recall manager would</h2>
        <p className="write-console-copy">
          Edit the source case, recalculate traceability, build the recall plan,
          preview SAP or Oracle actions, then use the approval code only when
          you want to test a protected live hold.
        </p>
        {evidenceSummary ? (
          <>
            <div className="write-summary-grid">
              <article className="write-summary-card">
                <span>Case file</span>
                <strong>{evidenceSummary.incidentId}</strong>
                <small>Source-based recall incident</small>
              </article>
              <article className="write-summary-card">
                <span>Current coverage</span>
                <strong>
                  {evidenceSummary.initialCoverage}% covered,{" "}
                  {evidenceSummary.missingUnits.toLocaleString()} missing
                </strong>
                <small>
                  out of {evidenceSummary.totalUnits.toLocaleString()} units
                  across {evidenceSummary.regions} regions
                </small>
              </article>
              <article className="write-summary-card">
                <span>Action status</span>
                <strong>{evidenceSummary.statusText}</strong>
                <small>Dry-run first. Protected live hold needs a code.</small>
              </article>
            </div>
            <div className="write-flow-list">
              <article className={`write-flow-step ${actionStepState(true)}`}>
                <span>1</span>
                <div>
                  <strong>Edit and recalculate</strong>
                  <small>Source evidence is loaded and editable below.</small>
                </div>
              </article>
              <article
                className={`write-flow-step ${actionStepState(recallRun !== null)}`}
              >
                <span>2</span>
                <div>
                  <strong>Run recall room</strong>
                  <small>
                    {recallRun
                      ? "Room is bound to current evidence and Band proof."
                      : "Turns the source packet into a specialist room."}
                  </small>
                </div>
              </article>
              <article
                className={`write-flow-step ${actionStepState(filingPack !== null)}`}
              >
                <span>3</span>
                <div>
                  <strong>Generate filing pack</strong>
                  <small>
                    {filingPack
                      ? "Draft filings are ready for human review."
                      : "Creates regulator and notice drafts from one evidence set."}
                  </small>
                </div>
              </article>
              <article
                className={`write-flow-step ${actionStepState(regulatorDispatch !== null)}`}
              >
                <span>4</span>
                <div>
                  <strong>Prepare regulator dispatch</strong>
                  <small>
                    {regulatorDispatch
                      ? "Dry-run dispatch payload is ready."
                      : "No external submission; prepares regulator target packets."}
                  </small>
                </div>
              </article>
              <article
                className={`write-flow-step ${actionStepState(caseDrafted)}`}
              >
                <span>5</span>
                <div>
                  <strong>Build a recall plan</strong>
                  <small>
                    {caseDrafted
                      ? "Plan is ready. Continue with safety check."
                      : "Prepare a case record before any ERP action."}
                  </small>
                </div>
              </article>
              <article
                className={`write-flow-step ${actionStepState(dryRunDone)}`}
              >
                <span>6</span>
                <div>
                  <strong>Run safety check</strong>
                  <small>
                    {dryRunDone
                      ? "Safety check passed. You can request live hold."
                      : "Checks SAP/Oracle readiness without live writing."}
                  </small>
                </div>
              </article>
              <article
                className={`write-flow-step ${actionStepState(esignature !== null)}`}
              >
                <span>7</span>
                <div>
                  <strong>E-sign human approval</strong>
                  <small>
                    {esignature
                      ? "Signed receipt seals source, room, and filing hashes."
                      : "Requires approval code and verified identity gate."}
                  </small>
                </div>
              </article>
              <article
                className={`write-flow-step ${actionStepState(liveHoldDone)}`}
              >
                <span>8</span>
                <div>
                  <strong>Request live hold</strong>
                  <small>
                    {liveHoldDone ? "Live hold sent." : liveKeyHint}
                  </small>
                </div>
              </article>
            </div>
          </>
        ) : (
          <p className="runner-error">
            Loading the source case so actions can be tested.
          </p>
        )}
      </section>

      <SourceEvidenceCockpit apiBase={apiBase} onEvidenceLoaded={setEvidence} />

      <section className="panel">
        <div className="panel-head">
          <p className="kicker">Case actions</p>
          <h2>Test the operational path</h2>
        </div>
        <label className="live-band-option">
          <input
            type="checkbox"
            checked={runLiveBand}
            onChange={(event) => setRunLiveBand(event.currentTarget.checked)}
          />
          <span>
            Attempt fresh live Band run when server-side credentials allow it
          </span>
        </label>
        <div className="write-action-grid">
          <button
            type="button"
            disabled={!canRunRecallRoom}
            onClick={runRecallRoom}
          >
            {isRecallRoom ? "Running room..." : "Run recall room"}
          </button>
          <button
            type="button"
            disabled={!canGenerateFilingPack}
            onClick={generateFilingPack}
          >
            {isFilingPack ? "Preparing filings..." : "Generate filing pack"}
          </button>
          <button
            type="button"
            disabled={!canCreateCase}
            onClick={createCaseRecord}
          >
            {isCreating ? "Preparing plan..." : "Build recall plan"}
          </button>
          <button
            type="button"
            disabled={!canPrepareRegulatorDispatch}
            onClick={prepareRegulatorDispatch}
          >
            {isRegulatorFiling
              ? "Preparing dispatch..."
              : "Prepare regulator dispatch"}
          </button>
          <button
            type="button"
            disabled={!canDryRunSync}
            onClick={() => runEnterpriseSync(true)}
          >
            {isDryRunSync ? "Running safety check..." : "Run safety check"}
          </button>
          <button
            type="button"
            disabled={!canSignApproval}
            onClick={signApproval}
          >
            {isESignature ? "Signing approval..." : "E-sign approval"}
          </button>
          <button
            type="button"
            disabled={!canRunLive}
            onClick={() => runEnterpriseSync(false)}
          >
            {isLiveSync ? "Requesting live hold..." : "Request live hold"}
          </button>
        </div>
        <p className="write-console-copy">
          Regulator dispatch is a dry-run by default. The live hold button stays
          locked until the ERP dry-run passes, a verified e-signature exists,
          and an approval code is present.
        </p>

        {recallRun ? (
          <section className="judge-artifact-grid">
            <article className="judge-artifact-card">
              <span>Recall room run</span>
              <strong>{recallRun.run.room.room_id}</strong>
              <p>{recallRun.run.disclosure}</p>
              <div className="artifact-metrics">
                <code>run {shortHash(recallRun.run.run_hash)}</code>
                <code>room {shortHash(recallRun.run.room.room_hash)}</code>
                <code>band {recallRun.run.band.participant_count} agents</code>
              </div>
              <div className="artifact-event-list">
                {recallRun.run.room.events.map((event) => (
                  <div key={event.id}>
                    <span>{event.stage.replaceAll("_", " ")}</span>
                    <strong>{event.agent}</strong>
                    <p>{event.message}</p>
                  </div>
                ))}
              </div>
            </article>
            <article className="judge-artifact-card">
              <span>Band binding</span>
              <strong>{recallRun.run.band.mode.replaceAll("_", " ")}</strong>
              <p>
                Room {recallRun.run.band.room_id} /{" "}
                {recallRun.run.band.proof_mode.replaceAll("_", " ")}
              </p>
              <div className="artifact-metrics">
                {recallRun.run.band.message_ids.slice(0, 4).map((messageId) => (
                  <code key={messageId}>{shortHash(messageId)}</code>
                ))}
              </div>
              {recallRun.run.band.live_error ? (
                <small className="artifact-warning">
                  Live Band check: {recallRun.run.band.live_error.detail}
                </small>
              ) : null}
            </article>
          </section>
        ) : null}

        {filingPack ? (
          <section className="judge-artifact-card filing-pack-card">
            <div className="artifact-card-head">
              <div>
                <span>Filing pack</span>
                <strong>
                  {filingPack.filing_pack.source_summary.product} /{" "}
                  {filingPack.filing_pack.source_summary.lot}
                </strong>
              </div>
              <code>{shortHash(filingPack.filing_pack.pack_hash)}</code>
            </div>
            <p>{filingPack.filing_pack.disclosure}</p>
            <div className="filing-grid">
              {filingPack.filing_pack.filings.map((filing) => (
                <article key={filing.id}>
                  <span>{filing.status.replaceAll("_", " ")}</span>
                  <strong>{filing.label}</strong>
                  <p>{filing.authority}</p>
                  <small>
                    {filing.deadline_hours
                      ? `${filing.deadline_hours}h target`
                      : "screening route"}{" "}
                    / {filing.required_human_action}
                  </small>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {regulatorDispatch ? (
          <section className="judge-artifact-card filing-pack-card">
            <div className="artifact-card-head">
              <div>
                <span>Regulator dispatch</span>
                <strong>
                  {regulatorDispatch.regulator_dispatch.mode.replaceAll(
                    "_",
                    " ",
                  )}
                </strong>
              </div>
              <code>
                {shortHash(regulatorDispatch.regulator_dispatch.payload_hash)}
              </code>
            </div>
            <div className="filing-grid">
              {regulatorDispatch.regulator_dispatch.targets.map((target) => (
                <article key={target.id}>
                  <span>{target.status.replaceAll("_", " ")}</span>
                  <strong>{target.label}</strong>
                  <p>
                    {target.external_submit
                      ? "External submit attempted"
                      : "No external submission"}
                  </p>
                  <small>{target.action_required ?? "Ready for review"}</small>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {esignature ? (
          <section className="judge-artifact-card filing-pack-card">
            <div className="artifact-card-head">
              <div>
                <span>E-signature receipt</span>
                <strong>{esignature.receipt.signature_id}</strong>
              </div>
              <code>{shortHash(esignature.receipt.signature_hash)}</code>
            </div>
            <p>{esignature.receipt.controls.disclosure}</p>
            <div className="artifact-metrics">
              <code>record {shortHash(esignature.receipt.record_hash)}</code>
              <code>
                room {shortHash(esignature.receipt.recall_room_run_hash)}
              </code>
              <code>
                filing {shortHash(esignature.receipt.filing_pack_hash)}
              </code>
            </div>
          </section>
        ) : null}

        <div className="write-auth-grid">
          <fieldset className="write-target-grid">
            <legend>ERP targets</legend>
            <label>
              <input
                type="checkbox"
                checked={targets.sap}
                onChange={(event) =>
                  updateTarget("sap", event.currentTarget.checked)
                }
              />
              <span>Send to SAP</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={targets.oracle}
                onChange={(event) =>
                  updateTarget("oracle", event.currentTarget.checked)
                }
              />
              <span>Send to Oracle</span>
            </label>
          </fieldset>

          <label className="source-inputs">
            <span>Approval code for protected live hold</span>
            <input
              type="password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.currentTarget.value)}
              placeholder="Paste approval code only for live hold testing"
              className="write-admin-input"
              spellCheck={false}
              autoComplete="off"
            />
          </label>
        </div>

        {lastAction ? (
          <article className="write-output">
            <span>Last step completed</span>
            <strong>
              {actionTitle(lastAction.action)} -{" "}
              {isActionSuccess ? "completed" : "failed"}
            </strong>
            <small>
              {isActionSuccess
                ? actionSuccessMessage(lastAction.action, lastAction.body)
                : actionErrorMessage(lastAction.body)}
            </small>
            <details>
              <summary>Show technical details</summary>
              <pre>
                <code>{JSON.stringify(lastAction.body, null, 2)}</code>
              </pre>
            </details>
          </article>
        ) : null}

        {error ? <p className="runner-error">{error}</p> : null}
      </section>
    </section>
  );
}

function shortHash(value: string) {
  return `${value.slice(0, 10)}...`;
}
