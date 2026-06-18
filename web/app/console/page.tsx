import SiteNav from "../site-nav";
import RecallWorkspace from "../workspace/recall-workspace";
import { apiBase } from "../recall-data";

export default function ConsolePage() {
  return (
    <main className="command-shell">
      <SiteNav active="console" />

      <section className="page-hero compact-page-hero">
        <div>
          <p className="section-kicker">Interactive live console</p>
          <h1>Run the recall pipeline end-to-end, in one place.</h1>
          <p>
            Enter or edit complaint + shipment data, execute the same
            proof-bound pipeline your judges review, and export task, filing,
            and proof artifacts directly from this live workspace.
          </p>
        </div>
      </section>

      <RecallWorkspace apiBase={apiBase} />
    </main>
  );
}
