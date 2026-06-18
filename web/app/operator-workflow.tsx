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
  const [caseDrafted, setCaseDrafted] = useState(false);
  const [dryRunDone, setDryRunDone] = useState(false);
  const [liveHoldDone, setLiveHoldDone] = useState(false);

  const selectedTargets = useMemo(() => ensureTargets(targets), [targets]);
  const actionBusy = busyAction !== null;
  const normalizedAdminKey = adminKey.trim();
  const hasAdminKey = normalizedAdminKey.length > 0;
  const hasEvidence = evidence !== null;
  const hasTargets = selectedTargets.length > 0;
  const canCreateCase = hasEvidence && !actionBusy;
  const canDryRunSync = hasEvidence && caseDrafted && !actionBusy;
  const canRunLive =
    hasEvidence && dryRunDone && hasAdminKey && hasTargets && !actionBusy;
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
                className={`write-flow-step ${actionStepState(caseDrafted)}`}
              >
                <span>2</span>
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
                <span>3</span>
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
                className={`write-flow-step ${actionStepState(liveHoldDone)}`}
              >
                <span>4</span>
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
        <div className="write-action-grid">
          <button
            type="button"
            disabled={!canCreateCase}
            onClick={createCaseRecord}
          >
            {isCreating ? "Preparing plan..." : "Build recall plan"}
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
            disabled={!canRunLive}
            onClick={() => runEnterpriseSync(false)}
          >
            {isLiveSync ? "Requesting live hold..." : "Request live hold"}
          </button>
        </div>
        <p className="write-console-copy">
          You can run the first two actions without an approval code. The live
          hold button stays locked until the dry-run passes and an approval code
          is present.
        </p>

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
