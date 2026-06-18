import Bat4421Replay from "../../bat-4421-replay";
import LiveBandRunner from "../../live-band-runner";
import SourceEvidenceCockpit from "../../source-evidence-cockpit";
import { apiBase, packet } from "../../recall-data";
import ProofLabel from "../../proof-label";
import SiteNav from "../../site-nav";

export default function Bat4421DemoPage() {
  return (
    <main className="command-shell">
      <SiteNav active="demo" />

      <section className="page-hero compact-page-hero">
        <div>
          <p className="section-kicker">BAT-4421 incident replay</p>
          <h1>Watch the recall move from blocked to approved.</h1>
          <p>
            The replay starts with 4,800 units across 6 regions, 31 exposure
            hours, 82% coverage and 864 untraced units. Risk vetoes the plan,
            Traceability recovers the missing distributor file, QA approves the
            action, and the receipt chain becomes inspectable.
          </p>
        </div>
        <ProofLabel status="DETERMINISTIC">complete offline story</ProofLabel>
      </section>

      <Bat4421Replay packet={packet} variant="full" />

      <section className="demo-support-grid">
        <article className="operator-note">
          <p className="section-kicker">Operator Mode</p>
          <h2>Handle the incident.</h2>
          <p>
            Operator Mode keeps IDs quiet and prioritizes the current blocker,
            source coverage, assignments, and approval control.
          </p>
        </article>
        <article className="operator-note">
          <p className="section-kicker">Judge Mode</p>
          <h2>Verify what happened.</h2>
          <p>
            Judge Mode exposes event IDs, captured Band message IDs, receipt
            hashes, packet digest, and external proof endpoints.
          </p>
        </article>
      </section>

      <SourceEvidenceCockpit apiBase={apiBase} />
      <section className="panel raw-proof">
        <div className="panel-head">
          <div>
            <p className="kicker">Fresh Band drill</p>
            <h2>Run a new deployed room when provider state allows it.</h2>
          </div>
          <ProofLabel status="LIVE">rate limited</ProofLabel>
        </div>
        <LiveBandRunner apiBase={apiBase} />
      </section>
    </main>
  );
}
