import { apiBase, docsEndpoints } from "../recall-data";
import ProofLabel from "../proof-label";
import SiteNav from "../site-nav";

const groupedEndpoints = [
  {
    label: "Run a case",
    paths: [
      "/api/source-evidence",
      "/api/partner-ai/status",
      "/api/spend-limits",
      "/api/recall-room/run",
      "/api/filing-pack",
    ],
  },
  {
    label: "Approve and sync",
    paths: [
      "/api/esignature-approval",
      "/api/enterprise-sync",
      "/api/regulator-filing/status",
    ],
  },
  {
    label: "Verify proof",
    paths: [
      "/api/submission-proof",
      "/api/verify",
      "/api/packet.json",
      "/api/band-proof",
    ],
  },
];

export default function DocsPage() {
  return (
    <main className="command-shell clean-docs-page">
      <SiteNav active="docs" />

      <section className="page-hero compact-page-hero clean-page-hero">
        <div>
          <p className="section-kicker">Docs</p>
          <h1>API reference for case runs and proof checks.</h1>
          <p>
            The public product stays simple. This page keeps the technical
            surface available for developers and auditors.
          </p>
        </div>
        <ProofLabel status="LIVE">deployed API</ProofLabel>
      </section>

      <section className="clean-docs-groups">
        {groupedEndpoints.map((group) => (
          <article key={group.label}>
            <h2>{group.label}</h2>
            {group.paths.map((path) => {
              const endpoint = docsEndpoints.find((item) => item.path === path);
              if (!endpoint) {
                return null;
              }
              return (
                <div key={`${endpoint.method}-${endpoint.path}`}>
                  <span>{endpoint.method}</span>
                  <code>{endpoint.path}</code>
                  <p>{endpoint.purpose}</p>
                  <a href={`${apiBase}${endpoint.path.replace("/api", "")}`}>
                    Open
                  </a>
                </div>
              );
            })}
          </article>
        ))}
      </section>

      <details className="clean-advanced-proof clean-docs-all">
        <summary>All endpoints</summary>
        <section className="docs-table">
          {docsEndpoints.map((endpoint) => (
            <article key={`${endpoint.method}-${endpoint.path}`}>
              <span>{endpoint.method}</span>
              <code>{endpoint.path}</code>
              <p>{endpoint.purpose}</p>
              <a href={`${apiBase}${endpoint.path.replace("/api", "")}`}>
                Open endpoint
              </a>
            </article>
          ))}
        </section>
      </details>
    </main>
  );
}
