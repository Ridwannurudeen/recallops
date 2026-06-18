"use client";

import { useState } from "react";

import RecallWorkspace, { type WorkspaceSeed } from "../../workspace/recall-workspace";
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
      : demoSeeds.find((seed) => seed.id === seedId) ?? demoSeeds[0];

  return (
    <main className="command-shell">
      <SiteNav active="demo" />

      <section className="page-hero compact-page-hero">
        <div>
          <p className="section-kicker">BAT-4421 scenario</p>
          <h1>Run the full story live, then watch the replay.</h1>
          <p>
            This page starts with a live workspace where judges and users can
            edit shipment data, run real services, and export action artifacts.
            The deterministic replay stays available as an optional fallback for
            judge consistency.
          </p>
        </div>
        <ProofLabel status="LIVE">live workspace (BAT-4421 seeded)</ProofLabel>
      </section>

      <section className="panel" id="live-workspace">
        <div className="panel-head">
          <p className="kicker">Live workspace first</p>
          <h2>Use one workspace to test inputs and approvals.</h2>
          <p>
            Build a live run with real API calls, check the live event stream,
            and download a full action pack or Band-room proof.
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
            Start blank case
          </button>
          <a className="secondary-action" href="/demo/judge">
            Open judge runner
          </a>
          <a className="secondary-action" href="/workspace">
            Open blank workspace
          </a>
        </div>
      </section>

        <section className="panel">
        <details>
          <summary>
            <span className="kicker" style={{ marginRight: 6 }}>
              Optional scripted replay
            </span>
            Need a deterministic judge script? Expand this to replay BAT-4421.
          </summary>
          <div style={{ marginTop: 14 }}>
            <Bat4421Replay packet={packet} variant="full" apiBase={apiBase} />
          </div>
        </details>
      </section>

      <section className="panel">
        <div className="panel-head">
          <p className="kicker">Live workspace for this case</p>
          <h2>Run, review, and export artifacts from live inputs.</h2>
          <p>
            Every run uses real API calls for source evidence, room run,
            filing pack, regulator dry-run, and signature gate status.
          </p>
        </div>
        <RecallWorkspace apiBase={apiBase} seed={selectedSeed} />
      </section>
    </main>
  );
}
