import LiveBandRunner from "../live-band-runner";
import LiveDrill from "../live-drill";
import { apiBase, packet, shortHash } from "../recall-data";
import ProofLabel from "../proof-label";
import SiteNav from "../site-nav";

export default function JudgeModePage() {
  const capturedRun = packet.band_proof.captured_band_run;

  return (
    <main className="command-shell">
      <SiteNav />

      <section className="page-hero compact-page-hero">
        <div>
          <p className="section-kicker">Judge Mode</p>
          <h1>Replay the deterministic room, then inspect the captured IDs.</h1>
          <p>
            This page is optimized for a hackathon judge or enterprise reviewer:
            stable BAT-4421 replay first, raw proof links second, and no hidden
            claims about what is deterministic, captured, live, dry-run, or
            gated.
          </p>
        </div>
        <ProofLabel status="DETERMINISTIC">stable replay</ProofLabel>
      </section>

      <LiveDrill packet={packet} />

      <section className="judge-proof-grid">
        <article>
          <ProofLabel status="CAPTURED">Band spike</ProofLabel>
          <h2>Captured room</h2>
          <code>{capturedRun.room_id}</code>
          <p>
            {capturedRun.participant_count} participants,{" "}
            {capturedRun.context_items} context items, captured at{" "}
            {capturedRun.captured_at}.
          </p>
        </article>
        <article>
          <ProofLabel status="DETERMINISTIC">packet</ProofLabel>
          <h2>Audit digest</h2>
          <code>{shortHash(packet.audit_hash, 16)}</code>
          <p>
            The deterministic packet can be verified through the digest endpoint
            and downloaded as JSON.
          </p>
        </article>
        <article>
          <ProofLabel status="LIVE">deployed API</ProofLabel>
          <h2>Proof endpoints</h2>
          <div className="judge-link-list">
            <a href={`${apiBase}/submission-proof`}>submission proof</a>
            <a href={`${apiBase}/verify`}>verify digest</a>
            <a href={`${apiBase}/band-proof`}>Band proof</a>
            <a href={`${apiBase}/packet.json`}>download packet</a>
          </div>
        </article>
      </section>

      <section className="panel raw-proof">
        <div className="panel-head">
          <div>
            <p className="kicker">Fresh room option</p>
            <h2>
              Run a new Band drill when the deployed provider is available.
            </h2>
          </div>
          <ProofLabel status="LIVE">external service</ProofLabel>
        </div>
        <LiveBandRunner apiBase={apiBase} />
      </section>
    </main>
  );
}
