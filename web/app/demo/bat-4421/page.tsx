"use client";

import { useState } from "react";

import RecallWorkspace, {
  type WorkspaceSeed,
} from "../../workspace/recall-workspace";
import { apiBase, packet } from "../../recall-data";
import Bat4421Replay from "../../bat-4421-replay";
import ProofLabel from "../../proof-label";
import SiteNav from "../../site-nav";

const demoSeeds: WorkspaceSeed[] = [
  {
    id: "bat-4421-held",
    complaintId: "C-901",
    product: "Harbor Sensor Battery Pack",
    lot: "LOT-900",
    defect: "overheating during overnight charge",
    severity: "critical",
    productCategory: "consumer product",
    rows: [
      {
        source: "SHIP-901",
        distributor: "Northstar",
        region: "US-West",
        customers: "18",
        units: "240",
        status: "traced",
      },
      {
        source: "SHIP-902",
        distributor: "Baltic Retail",
        region: "EU-North",
        customers: "7",
        units: "80",
        status: "missing",
      },
      {
        source: "SHIP-903",
        distributor: "Direct Warehouse",
        region: "US-East",
        customers: "21",
        units: "260",
        status: "traced",
      },
    ],
  },
  {
    id: "bat-4421-recovered",
    complaintId: "C-901",
    product: "Harbor Sensor Battery Pack",
    lot: "LOT-900",
    defect: "overheating during overnight charge",
    severity: "critical",
    productCategory: "consumer product",
    rows: [
      {
        source: "SHIP-901",
        distributor: "Northstar",
        region: "US-West",
        customers: "18",
        units: "240",
        status: "traced",
      },
      {
        source: "SHIP-902",
        distributor: "Baltic Retail",
        region: "EU-North",
        customers: "7",
        units: "80",
        status: "traced",
      },
      {
        source: "SHIP-903",
        distributor: "Direct Warehouse",
        region: "US-East",
        customers: "21",
        units: "260",
        status: "traced",
      },
    ],
  },
];

export default function Bat4421DemoPage() {
  const [seedId, setSeedId] = useState<string | "blank">(demoSeeds[0].id);
  const selectedSeed =
    seedId === "blank"
      ? null
      : (demoSeeds.find((seed) => seed.id === seedId) ?? demoSeeds[0]);

  return (
    <main className="command-shell">
      <SiteNav active="demo" />

      <section className="page-hero compact-page-hero">
        <div>
          <p className="section-kicker">BAT-4421 demo</p>
          <h1>Replay the hold, recovery, approval, and receipt.</h1>
          <p>
            BAT-4421 demonstrates the product model: incomplete traceability
            blocks approval, a recovered distributor file changes the source
            packet, coverage reaches 100%, and a named human approves the recall
            action.
          </p>
        </div>
        <ProofLabel status="DETERMINISTIC">guided replay</ProofLabel>
      </section>

      <Bat4421Replay packet={packet} variant="full" apiBase={apiBase} />

      <section className="panel" id="live-workspace">
        <div className="panel-head">
          <p className="kicker">Operate with live inputs</p>
          <h2>Use the same workflow with editable case data.</h2>
          <p>
            Load the blocked or recovered version of the scenario, then analyze
            it through the live API-backed workspace.
          </p>
        </div>
        <div className="buttonRow">
          <button
            aria-pressed={seedId === demoSeeds[0].id}
            onClick={() => setSeedId(demoSeeds[0].id)}
            type="button"
          >
            Held case
          </button>
          <button
            aria-pressed={seedId === demoSeeds[1].id}
            onClick={() => setSeedId(demoSeeds[1].id)}
            type="button"
          >
            Recovered case
          </button>
          <button
            aria-pressed={seedId === "blank"}
            onClick={() => setSeedId("blank")}
            type="button"
          >
            Create new case
          </button>
          <a className="secondary-action" href="/app">
            Open command room
          </a>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <p className="kicker">Live command room for this case</p>
          <h2>Run, review, and export artifacts from live inputs.</h2>
          <p>
            Every run uses real API calls for source evidence, room run, filing
            pack, regulator dry-run, and signature gate status.
          </p>
        </div>
        <RecallWorkspace apiBase={apiBase} seed={selectedSeed} />
      </section>
    </main>
  );
}
