import { apiBase } from "../../recall-data";
import ProofLabel from "../../proof-label";
import SiteNav from "../../site-nav";
import JudgeDemo from "./judge-demo";

export default function JudgeDemoPage() {
  return (
    <main className="command-shell">
      <SiteNav active="judge" />

      <section className="page-hero compact-page-hero">
        <div>
          <p className="section-kicker">Judge-guided demo</p>
          <h1>Run a recall scenario in under three minutes.</h1>
          <p>
            Pick an incident, execute the real evidence-to-room-to-filing flow,
            inspect Band proof, and download the audit packet without needing
            URL flags or hidden operator context.
          </p>
        </div>
        <ProofLabel status="LIVE">source-bound demo path</ProofLabel>
      </section>

      <JudgeDemo apiBase={apiBase} />
    </main>
  );
}
