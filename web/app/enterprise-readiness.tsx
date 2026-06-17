"use client";

import { useEffect, useState } from "react";

type AdapterStatus = {
  id: string;
  label: string;
  role: string;
  configured: boolean;
  status: string;
};

type Readiness = {
  persistence: {
    mode: string;
    configured_path: string;
  };
  access_control: {
    mode: string;
  };
  integrations: {
    configured_count: number;
    adapters: AdapterStatus[];
  };
  production_blockers_remaining: string[];
  spend_limits: {
    partner_ai: {
      runnable: boolean;
      runs_today: number;
      daily_limit: number;
      cooldown_remaining_seconds: number;
    };
  };
};

export default function EnterpriseReadiness({ apiBase }: { apiBase: string }) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`${apiBase}/ops-readiness`, {
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.detail ?? "Readiness check failed.");
        }
        setReadiness(body as Readiness);
      } catch (exc) {
        setError(
          exc instanceof Error ? exc.message : "Readiness check failed.",
        );
      }
    }
    void load();
  }, [apiBase]);

  return (
    <section className="panel readiness-panel">
      <div className="panel-head">
        <div>
          <p className="kicker">production readiness</p>
          <h2>Case store, rules, adapter gates</h2>
        </div>
        <a href={`${apiBase}/ops-readiness`}>readiness api</a>
      </div>
      {readiness ? (
        <>
          <div className="readiness-grid">
            <article>
              <span>case store</span>
              <strong>{readiness.persistence.mode}</strong>
              <small>{readiness.persistence.configured_path}</small>
            </article>
            <article>
              <span>partner ai spend</span>
              <strong>
                {readiness.spend_limits.partner_ai.runs_today}/
                {readiness.spend_limits.partner_ai.daily_limit}
              </strong>
              <small>
                {readiness.spend_limits.partner_ai.runnable
                  ? "runnable"
                  : `${readiness.spend_limits.partner_ai.cooldown_remaining_seconds}s cooldown`}
              </small>
            </article>
            <article>
              <span>enterprise adapters</span>
              <strong>{readiness.integrations.configured_count}</strong>
              <small>{readiness.access_control.mode}</small>
            </article>
          </div>
          <div className="adapter-ledger">
            {readiness.integrations.adapters.map((adapter) => (
              <article key={adapter.id}>
                <span>{adapter.status}</span>
                <strong>{adapter.label}</strong>
                <p>{adapter.role}</p>
              </article>
            ))}
          </div>
          <div className="blocker-strip">
            {readiness.production_blockers_remaining.map((blocker) => (
              <span key={blocker}>{blocker}</span>
            ))}
          </div>
        </>
      ) : (
        <p className="runner-error">{error ?? "loading readiness"}</p>
      )}
    </section>
  );
}
