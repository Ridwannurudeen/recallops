"use client";

import { useEffect, useState } from "react";

type AdapterStatus = {
  id: string;
  label: string;
  role: string;
  configured: boolean;
  status: string;
  execution_ready?: boolean;
  target_configured?: boolean;
};

type EnterpriseSyncTarget = {
  id: string;
  label: string;
  operation: string;
  execution_ready: boolean;
  live_write_enabled: boolean;
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
    execution_ready_count: number;
    adapters: AdapterStatus[];
    enterprise_sync: {
      live_writes_enabled: boolean;
      admin_key_configured: boolean;
      execution_ready_count: number;
      targets: EnterpriseSyncTarget[];
    };
  };
  production_blockers_remaining: string[];
  identity: {
    approval_gate_ready: boolean;
    approval_admin_key_configured: boolean;
    oidc: {
      verification_ready: boolean;
    };
  };
  erp_contract: {
    token_configured: boolean;
    receipt_count: number;
    latest_pair_verified: boolean;
  };
  sap_api_hub: {
    configured: boolean;
    endpoint: string;
  };
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
        <div className="readiness-links">
          <a href={`${apiBase}/ops-readiness`}>readiness api</a>
          <a href={`${apiBase}/enterprise-sync`}>sap/oracle proof</a>
          <a href={`${apiBase}/sap-api-hub`}>sap sandbox</a>
        </div>
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
              <strong>{readiness.integrations.execution_ready_count}/2</strong>
              <small>{readiness.access_control.mode}</small>
            </article>
            <article>
              <span>approval identity</span>
              <strong>
                {readiness.identity.approval_gate_ready ? "gated" : "open"}
              </strong>
              <small>
                {readiness.identity.oidc.verification_ready
                  ? "oidc jwks ready"
                  : readiness.identity.approval_admin_key_configured
                    ? "admin key ready"
                    : "demo receipt only"}
              </small>
            </article>
            <article>
              <span>erp write gate</span>
              <strong>
                {readiness.integrations.enterprise_sync.live_writes_enabled
                  ? "enabled"
                  : "dry-run"}
              </strong>
              <small>
                {readiness.integrations.enterprise_sync.admin_key_configured
                  ? "admin key set"
                  : "admin key absent"}
              </small>
            </article>
            <article>
              <span>erp contract</span>
              <strong>
                {readiness.erp_contract.latest_pair_verified
                  ? "verified"
                  : "pending"}
              </strong>
              <small>
                {readiness.erp_contract.receipt_count} receipts /{" "}
                {readiness.erp_contract.token_configured
                  ? "token set"
                  : "token absent"}
              </small>
            </article>
            <article>
              <span>sap api hub</span>
              <strong>
                {readiness.sap_api_hub.configured ? "configured" : "missing"}
              </strong>
              <small>{readiness.sap_api_hub.endpoint}</small>
            </article>
          </div>
          <div className="sync-ledger">
            {readiness.integrations.enterprise_sync.targets.map((target) => (
              <article key={target.id}>
                <span>{target.status}</span>
                <strong>{target.label}</strong>
                <p>{target.operation}</p>
                <small>
                  {target.execution_ready
                    ? "tenant endpoint ready"
                    : "tenant endpoint missing"}
                </small>
              </article>
            ))}
          </div>
          <div className="adapter-ledger">
            {readiness.integrations.adapters.map((adapter) => (
              <article key={adapter.id}>
                <span>{adapter.status}</span>
                <strong>{adapter.label}</strong>
                <p>{adapter.role}</p>
                {adapter.id === "sap" || adapter.id === "oracle" ? (
                  <small>
                    {adapter.execution_ready
                      ? "live endpoint ready"
                      : adapter.target_configured
                        ? "credential check pending"
                        : "write endpoint missing"}
                  </small>
                ) : null}
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
