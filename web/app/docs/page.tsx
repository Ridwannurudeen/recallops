import { apiBase, docsEndpoints } from "../recall-data";
import ProofLabel from "../proof-label";
import SiteNav from "../site-nav";

export default function DocsPage() {
  return (
    <main className="command-shell">
      <SiteNav />

      <section className="page-hero compact-page-hero">
        <div>
          <p className="section-kicker">Docs</p>
          <h1>RecallOps API and proof surfaces.</h1>
          <p>
            These endpoints back the website, the BAT-4421 replay, the proof
            explorer, the SAP/Oracle dry-run path, and the deployed verification
            checks.
          </p>
        </div>
        <ProofLabel status="LIVE">deployed API</ProofLabel>
      </section>

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

      <section className="docs-snippets">
        <article>
          <p className="section-kicker">Verify digest</p>
          <pre>
            <code>{`curl https://recallops.gudman.xyz/api/verify`}</code>
          </pre>
        </article>
        <article>
          <p className="section-kicker">Download packet</p>
          <pre>
            <code>{`curl -O https://recallops.gudman.xyz/api/packet.json`}</code>
          </pre>
        </article>
        <article>
          <p className="section-kicker">Run source recompute</p>
          <pre>
            <code>
              {`curl -X POST https://recallops.gudman.xyz/api/source-evidence \\
  -H "content-type: application/json" \\
  -d '{"use_partner_ai":true}'`}
            </code>
          </pre>
        </article>
      </section>
    </main>
  );
}
