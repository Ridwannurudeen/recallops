import RecallWorkspace from "../workspace/recall-workspace";
import { apiBase, packet } from "../recall-data";
import ProofLabel from "../proof-label";
import SiteNav from "../site-nav";

export default function AppPage() {
  return (
    <main className="command-shell">
      <SiteNav active="app" />

      <section className="app-command-hero">
        <div>
          <p className="section-kicker">RecallOps command room</p>
          <h1>Operate the recall around the next decision.</h1>
          <p>
            Create a case, analyze shipment coverage, watch structured
            operational events, prepare notices and dry-run actions, then export
            the audit packet that explains exactly what changed.
          </p>
        </div>
        <div className="app-case-strip" aria-label="BAT-4421 reference case">
          <div>
            <span>Reference case</span>
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
            <span>Decision state</span>
            <strong>Human review required</strong>
          </div>
          <ProofLabel status="LIVE">workspace uses deployed APIs</ProofLabel>
        </div>
      </section>

      <RecallWorkspace apiBase={apiBase} />
    </main>
  );
}
