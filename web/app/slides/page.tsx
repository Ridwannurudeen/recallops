import SiteNav from "../site-nav";

const deckUrl = "/recallops-governed-command.pdf";

export default function SlidesPage() {
  return (
    <main className="command-shell clean-slides-page">
      <SiteNav active="docs" />

      <section className="page-hero compact-page-hero clean-page-hero">
        <div>
          <p className="section-kicker">Slide presentation</p>
          <h1>RecallOps governed command deck.</h1>
          <p>
            A concise PDF slide deck covering the problem, solution, product
            workflow, demo scenario, agent roles, proof model, integrations,
            market scope, revenue model, competition, and roadmap.
          </p>
        </div>
        <div className="landing-final-actions">
          <a className="primary-action" href={deckUrl}>
            Open PDF
          </a>
          <a className="secondary-action" download href={deckUrl}>
            Download PDF
          </a>
        </div>
      </section>

      <section className="clean-section clean-slide-embed-section">
        <iframe
          className="clean-slide-embed"
          src={`${deckUrl}#view=FitH`}
          title="RecallOps governed command slide presentation"
        />
      </section>
    </main>
  );
}
