"use client";

import { useEffect, useMemo, useState } from "react";

import Bat4421Replay from "../../bat-4421-replay";
import LiveBandRunner from "../../live-band-runner";
import SourceEvidenceCockpit, {
  SourceEvidenceResponse,
} from "../../source-evidence-cockpit";
import { apiBase, packet } from "../../recall-data";
import ProofLabel from "../../proof-label";
import SiteNav from "../../site-nav";

type DemoMode = "read" | "write";
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

export default function Bat4421DemoPage() {
  const [mode, setMode] = useState<DemoMode>("read");
  const [evidence, setEvidence] = useState<SourceEvidenceResponse | null>(null);
  const [adminKey, setAdminKey] = useState("");
  const [showReadTechnical, setShowReadTechnical] = useState(false);
  const [showAdvancedWrite, setShowAdvancedWrite] = useState(false);
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
  const hasEvidence = evidence !== null;
  const actionBusy = busyAction !== null;
  const normalizedAdminKey = adminKey.trim();
  const hasAdminKey = normalizedAdminKey.length > 0;
  const writeEnabled = mode === "write" && hasEvidence;
  const hasTargets = selectedTargets.length > 0;
  const canRunLive =
    writeEnabled && dryRunDone && hasAdminKey && hasTargets && !actionBusy;
  const canCreateCase = writeEnabled && !actionBusy;
  const canDryRunSync = writeEnabled && caseDrafted && !actionBusy;
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

  function getModeFromLocation(): DemoMode {
    if (typeof window === "undefined") {
      return "read";
    }
    const queryMode = new URLSearchParams(window.location.search).get("mode");
    return queryMode === "write" ? "write" : "read";
  }

  useEffect(() => {
    const syncFromUrl = () => {
      setMode(getModeFromLocation());
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);

    return () => {
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, []);

  function setModeAndUrl(nextMode: DemoMode) {
    setMode(nextMode);
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.set("mode", nextMode);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", nextUrl);
  }

  async function runWriteAction(
    action: string,
    options: {
      method: "GET" | "POST";
      path: string;
      body?: Record<string, unknown>;
      headers?: Record<string, string>;
    },
  ) {
    if (!evidence) {
      setError("Load source evidence before running write actions.");
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
    await runWriteAction("create-case", {
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

    await runWriteAction(
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
    <main className="command-shell">
      <SiteNav active="demo" />

      <section className="page-hero compact-page-hero">
        <div>
          <p className="section-kicker">BAT-4421 incident replay</p>
          <h1>Watch the recall move from blocked to approved.</h1>
          <p>
            Use this page for the stable BAT-4421 story. For the practical
            operator workflow, open the live demo and test the case flow without
            touching URL modes.
          </p>
        </div>
        {mode === "read" ? (
          <ProofLabel status="DETERMINISTIC">complete offline story</ProofLabel>
        ) : (
          <ProofLabel status="LIVE">interactive write actions</ProofLabel>
        )}
      </section>

      <section className="mode-toggle" role="group" aria-label="Demo mode">
        <button
          aria-pressed={mode === "read"}
          type="button"
          onClick={() => setModeAndUrl("read")}
        >
          Scripted walkthrough
        </button>
        <button
          aria-pressed={mode === "write"}
          type="button"
          onClick={() => setModeAndUrl("write")}
        >
          Internal write check
        </button>
      </section>

      {mode === "read" ? (
        <>
          <section className="panel read-brief">
            <div className="panel-head">
              <p className="kicker">scripted walkthrough</p>
              <h2>Plain-language incident story</h2>
            </div>
            <p>
              This replay shows one recall from complaint to final approval, so
              you can see exactly what changed and why.
            </p>
            <div className="read-incident-grid">
              <article className="operator-note">
                <span className="read-incident-kicker">Starting point</span>
                <h3>Fragmented systems become one room</h3>
                <p>
                  Complaint text, shipment data, and approvals are usually
                  separate. Here they are coordinated as one decision flow.
                </p>
              </article>
              <article className="operator-note">
                <span className="read-incident-kicker">Decision blocker</span>
                <h3>Regulatory hold first, then recovery</h3>
                <p>
                  A risk hold stops the draft notice until missing units are
                  recovered and traceability is improved.
                </p>
              </article>
              <article className="operator-note">
                <span className="read-incident-kicker">Business outcome</span>
                <h3>Clear approval trail</h3>
                <p>
                  QA approval is explicit. Proof artifacts stay available for
                  audit and dispute response.
                </p>
              </article>
            </div>
          </section>

          <Bat4421Replay packet={packet} variant="full" apiBase={apiBase} />

          <section
            className="mode-toggle"
            role="group"
            aria-label="Read detail mode"
          >
            <button
              aria-pressed={!showReadTechnical}
              type="button"
              onClick={() => setShowReadTechnical(false)}
            >
              Simple read
            </button>
            <button
              aria-pressed={showReadTechnical}
              type="button"
              onClick={() => setShowReadTechnical(true)}
            >
              Technical proof view
            </button>
          </section>

          {showReadTechnical ? (
            <>
              <section className="demo-support-grid">
                <article className="operator-note">
                  <p className="section-kicker">Operator perspective</p>
                  <h2>What to act on now</h2>
                  <p>
                    Focus on blocker, coverage status, and current assignment.
                    Detailed IDs are kept in the proof pane when needed.
                  </p>
                </article>
                <article className="operator-note">
                  <p className="section-kicker">Judge perspective</p>
                  <h2>What to verify</h2>
                  <p>
                    Event logs, decision graph, evidence hashes, and final
                    receipt can be verified independently.
                  </p>
                </article>
              </section>
              <details className="advanced-details">
                <summary>Open technical proof panel</summary>
                <SourceEvidenceCockpit
                  apiBase={apiBase}
                  onEvidenceLoaded={setEvidence}
                />
                <section className="panel">
                  <div className="panel-head">
                    <p className="kicker">Live demo proof controls</p>
                    <h2>
                      Open technical execution controls and linked integration
                      checks.
                    </h2>
                  </div>
                  <LiveBandRunner apiBase={apiBase} />
                </section>
              </details>
            </>
          ) : null}
        </>
      ) : (
        <section className="panel raw-proof">
          <div className="panel-head">
            <div>
              <p className="kicker">Write mode</p>
              <h2>Run the recall workflow like a real operator.</h2>
            </div>
            <ProofLabel status="GATED">stateful writes and dry-runs</ProofLabel>
          </div>

          <section className="panel-head write-mode-brief">
            <p className="kicker">guided operator flow</p>
            <h2>4 steps to run this demo</h2>
            <p className="write-console-copy">
              Start with prepared BAT-4421 data, build a recall plan, run a
              safety check, then decide whether to send the live hold.
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
                    <span>Write status</span>
                    <strong>{evidenceSummary.statusText}</strong>
                    <small>
                      Safety check first. Live hold needs an approval code.
                    </small>
                  </article>
                </div>
                <div className="write-flow-list">
                  <article
                    className={`write-flow-step ${actionStepState(!!evidence)}`}
                  >
                    <span>1</span>
                    <div>
                      <strong>Load incident data</strong>
                      <small>Case details are already loaded.</small>
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
                          : "Prepare a recall plan before any hold action."}
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
                        {liveHoldDone
                          ? "Live hold sent with full audit trail."
                          : liveKeyHint}
                      </small>
                    </div>
                  </article>
                </div>
              </>
            ) : (
              <p className="runner-error">
                Loading source case so actions can be tested.
              </p>
            )}
          </section>

          <SourceEvidenceCockpit
            apiBase={apiBase}
            onEvidenceLoaded={setEvidence}
          />

          <section className="panel">
            <div className="panel-head">
              <p className="kicker">Case actions</p>
              <h2>Choose each step</h2>
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
              You can run the first two steps safely without an approval code.
              Add the approval code only when you want to test the live hold
              step.
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
                <span>Approval code for live hold (required)</span>
                <input
                  type="password"
                  value={adminKey}
                  onChange={(event) => setAdminKey(event.currentTarget.value)}
                  placeholder="Paste approval code to unlock live hold request"
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

          <section className="mode-toggle" style={{ marginTop: 12 }}>
            <button
              aria-pressed={!showAdvancedWrite}
              type="button"
              onClick={() => setShowAdvancedWrite(false)}
            >
              Simple operator view
            </button>
            <button
              aria-pressed={showAdvancedWrite}
              type="button"
              onClick={() => setShowAdvancedWrite(true)}
            >
              Advanced view
            </button>
          </section>

          <details
            className="advanced-details"
            open={showAdvancedWrite}
            onToggle={(event) => setShowAdvancedWrite(event.currentTarget.open)}
          >
            <summary>Advanced details (technical users)</summary>
            <section className="panel">
              <div className="panel-head">
                <p className="kicker">Fresh Band drill</p>
                <h2>Run a new deployed room when provider state allows it.</h2>
              </div>
              <LiveBandRunner apiBase={apiBase} />
            </section>
          </details>
        </section>
      )}
    </main>
  );
}
