import ProofExplorer from "./proof-explorer";
import SiteNav from "../site-nav";

export default function ProofPage() {
  return (
    <main className="command-shell">
      <SiteNav active="proof" />
      <ProofExplorer />
    </main>
  );
}
