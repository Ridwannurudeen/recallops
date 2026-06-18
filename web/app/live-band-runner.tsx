"use client";

import { useEffect, useState } from "react";

type StageEvidence = {
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
  risk_veto_id: string;
  communications_notice_id: string;
  stage_evidence: StageEvidence[];
};

type FreshRun = {
  proof_kind: string;
  started_at: string;
  completed_at: string;
  captured_band_run: CapturedBandRun;
};

type LiveDrillStatus = {
  enabled: boolean;
  configured: boolean;
  runnable: boolean;
  cooldown_remaining_seconds: number;
  daily_limit: number;
  runs_today: number;
  latest_run: FreshRun | null;
};

export default function LiveBandRunner({ apiBase }: { apiBase: string }) {
  const [status, setStatus] = useState<LiveDrillStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    const response = await fetch(`${apiBase}/live-drill`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Unable to load live drill status.");
    }
    setStatus((await response.json()) as LiveDrillStatus);
  }

  async function runDrill() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/live-drill`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.detail ?? "Live drill failed.");
      }
      await loadStatus();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Live drill failed.");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    void loadStatus().catch((exc) => {
      setError(
        exc instanceof Error
          ? exc.message
          : "Unable to load live drill status.",
      );
    });
  }, []);

  const latestRun = status?.latest_run?.captured_band_run ?? null;
  const buttonDisabled = !status?.runnable || running;
  const stateLabel = status
    ? status.runnable
      ? "ready"
      : status.cooldown_remaining_seconds > 0
        ? `${status.cooldown_remaining_seconds}s cooldown`
        : status.configured
          ? "locked"
          : "server config missing"
    : "checking";

  return (
    <section className="live-runner">
      <div>
        <p className="kicker">fresh Band drill</p>
        <h2>Run a new room</h2>
      </div>
      <div className="runner-status">
        <span>{stateLabel}</span>
        {status ? (
          <code>
            {status.runs_today}/{status.daily_limit} today
          </code>
        ) : null}
      </div>
      <button type="button" disabled={buttonDisabled} onClick={runDrill}>
        {running ? "running" : "run live drill"}
      </button>
      {error ? <p className="runner-error">{error}</p> : null}
      {latestRun ? (
        <div className="fresh-proof">
          <span>latest fresh run</span>
          <strong>{latestRun.room_id}</strong>
          <dl>
            <div>
              <dt>agents</dt>
              <dd>{latestRun.participant_count}</dd>
            </div>
            <div>
              <dt>context</dt>
              <dd>{latestRun.context_items}</dd>
            </div>
            <div>
              <dt>hold</dt>
              <dd>{latestRun.risk_veto_id}</dd>
            </div>
            <div>
              <dt>notice</dt>
              <dd>{latestRun.communications_notice_id}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
