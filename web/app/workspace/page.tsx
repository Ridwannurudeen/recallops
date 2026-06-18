import SiteNav from "../site-nav";
import RecallWorkspace from "./recall-workspace";
import { apiBase } from "../recall-data";

export default function WorkspacePage() {
  return (
    <main className="command-shell">
      <SiteNav active="workspace" />

      <section className="page-hero compact-page-hero">
        <div>
          <p className="section-kicker">Recall manager workspace</p>
          <h1>Decide what to do next, not what endpoint to call.</h1>
          <p>
            Enter the complaint and shipment rows, run the recall analysis, and
            get a plain-language action plan: what is missing, what is ready,
            which drafts were prepared, and what must stay human-approved.
          </p>
        </div>
      </section>

      <RecallWorkspace apiBase={apiBase} />
    </main>
  );
}
