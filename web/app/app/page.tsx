import RecallWorkspace from "../workspace/recall-workspace";
import { apiBase, packet } from "../recall-data";
import ProofLabel from "../proof-label";
import SiteNav from "../site-nav";

export default function AppPage() {
  return (
    <main className="command-shell app-shell-clean">
      <SiteNav active="app" />

      <section className="app-command-hero clean-app-hero">
        <div>
          <p className="section-kicker">Command room</p>
          <h1>Analyze the case, find the blocker, approve only when ready.</h1>
          <p>
            Use this workspace to enter your own incident, run shipment
            traceability, watch the operating stream, prepare drafts, and export
            the report. The final recall action stays human-owned.
          </p>
        </div>
        <div className="app-case-strip" aria-label="BAT-4421 reference case">
          <div>
            <span>Reference</span>
            <strong>{packet.incident_id}</strong>
          </div>
          <div>
            <span>Coverage</span>
            <strong>
              {packet.initial_traceability.coverage_percent}% to{" "}
              {packet.final_traceability.coverage_percent}%
            </strong>
          </div>
          <div>
            <span>Owner</span>
            <strong>QA Director</strong>
          </div>
          <ProofLabel status="LIVE">deployed APIs</ProofLabel>
        </div>
      </section>

      <RecallWorkspace apiBase={apiBase} />
    </main>
  );
}
