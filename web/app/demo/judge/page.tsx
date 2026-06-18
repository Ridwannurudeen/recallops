"use client";

import { useState } from "react";

import RecallWorkspace, {
  type WorkspaceSeed,
} from "../../workspace/recall-workspace";
import { apiBase } from "../../recall-data";
import ProofLabel from "../../proof-label";
import SiteNav from "../../site-nav";

const demoSeeds: WorkspaceSeed[] = [
  {
    id: "judge-blocked-battery",
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
    id: "judge-recovered-battery",
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

export default function JudgeDemoPage() {
  const [selectedSeedId, setSelectedSeedId] = useState<string | "blank">(
    demoSeeds[0].id,
  );
  const selectedSeed =
    selectedSeedId === "blank"
      ? null
      : (demoSeeds.find((seed) => seed.id === selectedSeedId) ?? demoSeeds[0]);

  return (
    <main className="command-shell">
      <SiteNav active="judge" />

      <section className="page-hero compact-page-hero">
        <div>
          <p className="section-kicker">Judge-ready demo</p>
          <h1>Run a real recall from incident data to proof artifacts.</h1>
          <p>
            Pick a seeded case, click Build action center, then watch the
            evidence, coverage, Band handoff, filing drafts, regulator dispatch,
            and human gate updates in one stream.
          </p>
        </div>
        <ProofLabel status="LIVE">judge-run live workspace</ProofLabel>
      </section>

      <section className="panel">
        <div className="panel-head">
          <p className="kicker">Judge script</p>
          <h2>Execution flow</h2>
          <p>
            1) Load the held coverage case, run it, and watch the hold gate. 2)
            Load the recovered case, rerun, and confirm ready state. 3) Export
            the run report, full action pack, and proof. 4) Start blank and test
            your own case in the same workspace.
          </p>
        </div>

        <div className="buttonRow">
          <button
            aria-pressed={
              selectedSeedId === demoSeeds[0].id &&
              selectedSeed?.id === demoSeeds[0].id
            }
            onClick={() => setSelectedSeedId(demoSeeds[0].id)}
            type="button"
          >
            Load held case
          </button>
          <button
            aria-pressed={
              selectedSeedId === demoSeeds[1].id &&
              selectedSeed?.id === demoSeeds[1].id
            }
            onClick={() => setSelectedSeedId(demoSeeds[1].id)}
            type="button"
          >
            Load recovered case
          </button>
          <button
            aria-pressed={selectedSeedId === "blank"}
            onClick={() => setSelectedSeedId("blank")}
            type="button"
          >
            Start blank workspace
          </button>
        </div>
      </section>

      <RecallWorkspace apiBase={apiBase} seed={selectedSeed} />
    </main>
  );
}
