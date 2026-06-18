"use client";

import { useMemo, useState } from "react";
import styles from "./judge-demo.module.css";

type Scenario = {
  id: string;
  title: string;
  sector: string;
  risk: string;
  whyItMatters: string;
  complaint_text: string;
  shipment_csv: string;
  recovered_shipment_csv: string;
};

type StepId =
  | "evidence"
  | "room"
  | "filing"
  | "regulator"
  | "signature"
  | "packet";

type StepStatus = "waiting" | "running" | "complete" | "gated" | "failed";

type DemoStep = {
  id: StepId;
  label: string;
  detail: string;
  status: StepStatus;
};

type JsonRecord = Record<string, unknown>;

const scenarios: Scenario[] = [
  {
    id: "battery",
    title: "Consumer battery recall",
    sector: "Consumer electronics",
    risk: "Thermal runaway across two regions",
    whyItMatters:
      "Closest to the BAT-4421 story, useful for showing traceability recovery and customer notice scope.",
    complaint_text:
      "C-901 | product: Harbor Sensor Battery Pack | lot: LOT-900 | defect: overheating during overnight charge | severity: critical\nC-902 | product: Harbor Sensor Battery Pack | lot: LOT-900 | defect: charging-port heat spike | severity: critical",
    shipment_csv:
      "source,distributor,region,customers,units,status\nSHIP-901,Northstar,US-West,18,240,traced\nSHIP-902,Baltic Retail,EU-North,7,80,missing\nSHIP-903,Direct Warehouse,US-East,21,260,traced",
    recovered_shipment_csv:
      "source,distributor,region,customers,units,status\nSHIP-901,Northstar,US-West,18,240,traced\nSHIP-902,Baltic Retail,EU-North,7,80,traced\nSHIP-903,Direct Warehouse,US-East,21,260,traced",
  },
  {
    id: "food",
    title: "Food contamination recall",
    sector: "Packaged food",
    risk: "Possible allergen contamination",
    whyItMatters:
      "Shows that the same source pipeline can prepare regulator and distributor packets outside electronics.",
    complaint_text:
      "F-311 | product: MeadowTrail Protein Bar | lot: BAR-771 | defect: undeclared peanut allergen report | severity: critical\nF-312 | product: MeadowTrail Protein Bar | lot: BAR-771 | defect: allergic reaction after consumption | severity: critical\nF-313 | product: MeadowTrail Protein Bar | lot: BAR-771 | defect: packaging mismatch with allergen label | severity: high",
    shipment_csv:
      "source,distributor,region,customers,units,status\nFOOD-11,Metro Grocery,US-East,88,4200,traced\nFOOD-12,Alpine Retail,EU-Central,43,1900,missing\nFOOD-13,ColdLane,US-West,61,2600,traced",
    recovered_shipment_csv:
      "source,distributor,region,customers,units,status\nFOOD-11,Metro Grocery,US-East,88,4200,traced\nFOOD-12,Alpine Retail,EU-Central,43,1900,traced\nFOOD-13,ColdLane,US-West,61,2600,traced",
  },
  {
    id: "medical-device",
    title: "Medical-device field correction",
    sector: "Healthcare equipment",
    risk: "Infusion pump dosage variance",
    whyItMatters:
      "Demonstrates human-owned sign-off language for regulated, safety-critical workflows.",
    complaint_text:
      "M-044 | product: Aster Infusion Pump | lot: PUMP-204 | defect: intermittent dosage variance under high-flow mode | severity: critical\nM-045 | product: Aster Infusion Pump | lot: PUMP-204 | defect: alarm delay during high-flow mode | severity: high",
    shipment_csv:
      "source,distributor,region,customers,units,status\nMED-44,Hospital Direct,US-East,12,96,traced\nMED-45,Clinic Supply,MEA,9,54,missing\nMED-46,MedBridge,EU-North,14,82,traced",
    recovered_shipment_csv:
      "source,distributor,region,customers,units,status\nMED-44,Hospital Direct,US-East,12,96,traced\nMED-45,Clinic Supply,MEA,9,54,traced\nMED-46,MedBridge,EU-North,14,82,traced",
  },
  {
    id: "vehicle-part",
    title: "Vehicle-part safety recall",
    sector: "Automotive component",
    risk: "Brake sensor false negative",
    whyItMatters:
      "Makes the NHTSA applicability screen and multi-region distribution story obvious to judges.",
    complaint_text:
      "A-702 | product: Roadline Brake Sensor | lot: BRK-118 | defect: false negative brake wear signal | severity: critical\nA-703 | product: Roadline Brake Sensor | lot: BRK-118 | defect: dashboard warning failed during inspection | severity: high",
    shipment_csv:
      "source,distributor,region,customers,units,status\nAUTO-70,DealerNet,US-West,34,510,traced\nAUTO-71,PartsHub,LATAM,19,275,missing\nAUTO-72,EuroParts,EU-Central,28,390,traced",
    recovered_shipment_csv:
      "source,distributor,region,customers,units,status\nAUTO-70,DealerNet,US-West,34,510,traced\nAUTO-71,PartsHub,LATAM,19,275,traced\nAUTO-72,EuroParts,EU-Central,28,390,traced",
  },
];

const initialSteps: DemoStep[] = [
  {
    id: "evidence",
    label: "Recompute source evidence",
    detail: "Parse complaints and shipment CSV into traceability math.",
    status: "waiting",
  },
  {
    id: "room",
    label: "Run Band-backed recall room",
    detail: "Generate a source-bound room narrative and Band proof binding.",
    status: "waiting",
  },
  {
    id: "filing",
    label: "Generate filing pack",
    detail: "Prepare regulator, distributor, and applicability drafts.",
    status: "waiting",
  },
  {
    id: "regulator",
    label: "Prepare regulator dispatch",
    detail: "Build dry-run dispatch packets without external submission.",
    status: "waiting",
  },
  {
    id: "signature",
    label: "Check human sign-off gate",
    detail: "Seal if an approval key is present; otherwise prove the gate.",
    status: "waiting",
  },
  {
    id: "packet",
    label: "Download audit packet",
    detail: "Bundle source, room, filing, regulator, and proof artifacts.",
    status: "waiting",
  },
];

function cloneSteps() {
  return initialSteps.map((step) => ({ ...step }));
}

export default function JudgeDemo({ apiBase }: { apiBase: string }) {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [approvalKey, setApprovalKey] = useState("");
  const [steps, setSteps] = useState<DemoStep[]>(cloneSteps);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<JsonRecord | null>(null);
  const [roomRun, setRoomRun] = useState<JsonRecord | null>(null);
  const [filingPack, setFilingPack] = useState<JsonRecord | null>(null);
  const [regulatorDispatch, setRegulatorDispatch] = useState<JsonRecord | null>(
    null,
  );
  const [esignature, setESignature] = useState<JsonRecord | null>(null);
  const [proof, setProof] = useState<JsonRecord | null>(null);

  const scenario = useMemo(
    () =>
      scenarios.find((candidate) => candidate.id === scenarioId) ??
      scenarios[0],
    [scenarioId],
  );

  const packet = asRecord(evidence?.packet);
  const initialTraceability = asRecord(packet.initial_traceability);
  const finalTraceability = asRecord(packet.final_traceability);
  const sourceHash = getString(packet, "audit_hash");
  const incidentId = getString(packet, "incident_id");
  const roomHash =
    getPathString(roomRun, ["run", "run_hash"]) ??
    getPathString(roomRun, ["recall_room_run", "run_hash"]) ??
    getPathString(roomRun, ["room_run", "run_hash"]) ??
    getString(roomRun, "run_hash") ??
    getPathString(roomRun, ["run", "room", "room_hash"]) ??
    getPathString(roomRun, ["room", "room_hash"]) ??
    sourceHash;
  const filingHash =
    getPathString(filingPack, ["filing_pack", "pack_hash"]) ??
    getString(filingPack, "pack_hash") ??
    sourceHash;
  const bandMode =
    getPathString(roomRun, ["run", "band", "mode"]) ??
    getPathString(roomRun, ["recall_room_run", "band", "mode"]) ??
    getPathString(roomRun, ["band", "mode"]) ??
    getPathString(proof, ["recall_room_run", "band", "mode"]) ??
    "not run yet";
  const bandParticipants =
    getPathNumber(roomRun, ["run", "band", "participant_count"]) ??
    getPathNumber(roomRun, ["recall_room_run", "band", "participant_count"]) ??
    getPathNumber(roomRun, ["band", "participant_count"]) ??
    getPathNumber(proof, ["band", "captured_run", "participant_count"]) ??
    0;
  const capturedRoom =
    getPathString(roomRun, ["run", "band", "room_id"]) ??
    getPathString(proof, ["band", "captured_run", "room_id"]) ??
    getPathString(roomRun, ["band", "captured_room_id"]) ??
    "pending";
  const regulatorTargets = getPathArray(regulatorDispatch, [
    "regulator_dispatch",
    "targets",
  ]);

  function updateStep(id: StepId, status: StepStatus) {
    setSteps((current) =>
      current.map((step) => (step.id === id ? { ...step, status } : step)),
    );
  }

  function resetArtifacts(nextScenarioId: string) {
    setScenarioId(nextScenarioId);
    setSteps(cloneSteps());
    setError(null);
    setEvidence(null);
    setRoomRun(null);
    setFilingPack(null);
    setRegulatorDispatch(null);
    setESignature(null);
    setProof(null);
  }

  async function runDemo() {
    setRunning(true);
    setError(null);
    setSteps(cloneSteps());
    setEvidence(null);
    setRoomRun(null);
    setFilingPack(null);
    setRegulatorDispatch(null);
    setESignature(null);
    setProof(null);

    try {
      updateStep("evidence", "running");
      const nextEvidence = await postJson(`${apiBase}/source-evidence`, {
        complaint_text: scenario.complaint_text,
        shipment_csv: scenario.shipment_csv,
        recovered_shipment_csv: scenario.recovered_shipment_csv,
      });
      setEvidence(nextEvidence);
      updateStep("evidence", "complete");

      updateStep("room", "running");
      const nextRoomRun = await postJson(`${apiBase}/recall-room/run`, {
        complaint_text: scenario.complaint_text,
        shipment_csv: scenario.shipment_csv,
        recovered_shipment_csv: scenario.recovered_shipment_csv,
        run_live_band: false,
      });
      setRoomRun(nextRoomRun);
      updateStep("room", "complete");

      updateStep("filing", "running");
      const nextFilingPack = await postJson(`${apiBase}/filing-pack`, {
        complaint_text: scenario.complaint_text,
        shipment_csv: scenario.shipment_csv,
        recovered_shipment_csv: scenario.recovered_shipment_csv,
      });
      setFilingPack(nextFilingPack);
      updateStep("filing", "complete");

      updateStep("regulator", "running");
      const nextRegulatorDispatch = await postJson(
        `${apiBase}/regulator-filing`,
        {
          complaint_text: scenario.complaint_text,
          shipment_csv: scenario.shipment_csv,
          recovered_shipment_csv: scenario.recovered_shipment_csv,
          dry_run: true,
          targets: ["cpsc", "eu", "regional"],
        },
      );
      setRegulatorDispatch(nextRegulatorDispatch);
      updateStep("regulator", "complete");

      updateStep("signature", "running");
      const nextSignature = await runSignatureGate({
        apiBase,
        approvalKey: approvalKey.trim(),
        sourceHash: getPathString(nextEvidence, ["packet", "audit_hash"]),
        roomHash:
          getPathString(nextRoomRun, ["run", "run_hash"]) ??
          getPathString(nextRoomRun, ["recall_room_run", "run_hash"]) ??
          getPathString(nextRoomRun, ["room_run", "run_hash"]) ??
          getString(nextRoomRun, "run_hash"),
        filingHash:
          getPathString(nextFilingPack, ["filing_pack", "pack_hash"]) ??
          getString(nextFilingPack, "pack_hash"),
      });
      setESignature(nextSignature.body);
      updateStep("signature", nextSignature.signed ? "complete" : "gated");

      updateStep("packet", "running");
      const nextProof = await fetchJson(`${apiBase}/submission-proof`);
      setProof(nextProof);
      updateStep("packet", "complete");
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Judge demo failed.");
      setSteps((current) =>
        current.map((step) =>
          step.status === "running" ? { ...step, status: "failed" } : step,
        ),
      );
    } finally {
      setRunning(false);
    }
  }

  async function downloadPacket() {
    const packetProof =
      proof ?? (await fetchJson(`${apiBase}/submission-proof`));
    const artifact = {
      proof_kind: "recallops_judge_demo_audit_packet",
      generated_at: new Date().toISOString(),
      scenario,
      evidence,
      recall_room_run: roomRun,
      filing_pack: filingPack,
      regulator_dispatch: regulatorDispatch,
      human_signature_gate: esignature,
      deployed_submission_proof: packetProof,
      boundaries: [
        "External regulator submission is not enabled by default.",
        "SAP and Oracle tenant writes require explicit admin authorization.",
        "Human sign-off is accountable to a named operator, not the software.",
      ],
    };
    const blob = new Blob([JSON.stringify(artifact, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `recallops-${scenario.id}-audit-packet.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <section className={styles.shell}>
      <div className={styles.leadGrid}>
        <article className={styles.scenarioPicker}>
          <p className={styles.kicker}>Choose scenario</p>
          <div className={styles.scenarioList}>
            {scenarios.map((candidate) => (
              <button
                aria-pressed={candidate.id === scenario.id}
                key={candidate.id}
                onClick={() => resetArtifacts(candidate.id)}
                type="button"
              >
                <span>{candidate.sector}</span>
                <strong>{candidate.title}</strong>
                <small>{candidate.risk}</small>
              </button>
            ))}
          </div>
        </article>

        <article className={styles.scenarioCard}>
          <p className={styles.kicker}>Selected incident</p>
          <h2>{scenario.title}</h2>
          <p>{scenario.whyItMatters}</p>
          <div className={styles.metaStrip}>
            <span>{scenario.sector}</span>
            <span>{scenario.risk}</span>
            <span>
              {scenario.shipment_csv.split("\n").length - 1} shipment rows
            </span>
          </div>
          <label>
            <span>Optional approval key</span>
            <input
              autoComplete="off"
              onChange={(event) => setApprovalKey(event.currentTarget.value)}
              placeholder="Leave blank to prove the public sign-off gate"
              spellCheck={false}
              type="password"
              value={approvalKey}
            />
          </label>
          <div className={styles.actions}>
            <button disabled={running} onClick={runDemo} type="button">
              {running ? "Running scenario..." : "Run guided demo"}
            </button>
            <button
              disabled={!evidence && !proof}
              onClick={downloadPacket}
              type="button"
            >
              Download audit packet
            </button>
          </div>
        </article>
      </div>

      <div className={styles.stepRail}>
        {steps.map((step, index) => (
          <article className={styles[step.status]} key={step.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step.label}</strong>
            <p>{step.detail}</p>
            <code>{step.status}</code>
          </article>
        ))}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.resultsGrid}>
        <article>
          <span>Incident</span>
          <strong>{incidentId ?? "pending"}</strong>
          <p>{scenario.complaint_text.split("\n")[0]}</p>
        </article>
        <article>
          <span>Traceability</span>
          <strong>
            {getNumber(initialTraceability, "coverage_percent") ?? 0}% to{" "}
            {getNumber(finalTraceability, "coverage_percent") ?? 0}%
          </strong>
          <p>
            {(
              getNumber(initialTraceability, "untraced_units") ?? 0
            ).toLocaleString()}{" "}
            untraced units before recovery.
          </p>
        </article>
        <article>
          <span>Source hash</span>
          <strong>{sourceHash ? "sealed" : "pending"}</strong>
          <code>{sourceHash ?? "run the scenario"}</code>
        </article>
      </div>

      <section className={styles.bandPanel}>
        <div>
          <p className={styles.kicker}>Band proof is central</p>
          <h2>Agent-room evidence is visible, not buried.</h2>
          <p>
            The guided flow shows whether the room run is live, captured, or
            deterministic, then anchors it to participant counts, room IDs, and
            the downloadable proof packet.
          </p>
        </div>
        <div className={styles.bandStats}>
          <div>
            <span>Room mode</span>
            <strong>{bandMode.replaceAll("_", " ")}</strong>
          </div>
          <div>
            <span>Participants</span>
            <strong>{bandParticipants}</strong>
          </div>
          <div>
            <span>Captured room</span>
            <code>{capturedRoom}</code>
          </div>
        </div>
      </section>

      <section className={styles.dispatchPanel}>
        <div>
          <p className={styles.kicker}>Regulator dispatch</p>
          <h2>Prepared, not externally submitted.</h2>
          <p>
            RecallOps generates target packets for the scenario while keeping
            real regulator submission behind deployment and human authorization
            gates.
          </p>
        </div>
        <div className={styles.targetGrid}>
          {regulatorTargets.length > 0 ? (
            regulatorTargets.map((target, index) => {
              const targetRecord = asRecord(target);
              return (
                <article key={`${getString(targetRecord, "id")}-${index}`}>
                  <span>{getString(targetRecord, "id") ?? "target"}</span>
                  <strong>
                    {getString(targetRecord, "status") ?? "prepared"}
                  </strong>
                  <p>
                    {getString(targetRecord, "label") ?? "Regulator packet"}
                  </p>
                </article>
              );
            })
          ) : (
            <article>
              <span>targets</span>
              <strong>pending</strong>
              <p>Run the guided demo to prepare three dispatch targets.</p>
            </article>
          )}
        </div>
      </section>

      <section className={styles.scriptPanel}>
        <p className={styles.kicker}>Two-minute narration</p>
        <ol>
          <li>
            “I pick a regulated recall scenario and run the real source parser
            against complaint text plus shipment CSV.”
          </li>
          <li>
            “The room changes with the source data: traceability gaps create a
            hold recommendation, recovered rows clear it.”
          </li>
          <li>
            “The filing pack and regulator dispatch are prepared from the same
            source hash, with no external submission.”
          </li>
          <li>
            “The final action is human-owned: a verified key can seal the
            sign-off; without it, the public demo proves the gate is closed.”
          </li>
          <li>
            “The audit packet downloads everything needed to recompute or
            inspect the claim.”
          </li>
        </ol>
      </section>
    </section>
  );
}

async function fetchJson(url: string): Promise<JsonRecord> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(formatError(body, "Request failed."));
  }
  return asRecord(body);
}

async function postJson(url: string, body: JsonRecord): Promise<JsonRecord> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const responseBody = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(formatError(responseBody, "Request failed."));
  }
  return asRecord(responseBody);
}

async function runSignatureGate({
  apiBase,
  approvalKey,
  sourceHash,
  roomHash,
  filingHash,
}: {
  apiBase: string;
  approvalKey: string;
  sourceHash: string | null;
  roomHash: string | null;
  filingHash: string | null;
}): Promise<{ signed: boolean; body: JsonRecord }> {
  const response = await fetch(`${apiBase}/esignature-approval`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(approvalKey ? { "x-recallops-approval-key": approvalKey } : {}),
    },
    body: JSON.stringify({
      approver: "QA Director",
      decision: "approved",
      reason:
        "Judge demo reviewed source evidence, recall room, filing pack, and regulator dispatch dry-run.",
      source_audit_hash: sourceHash ?? "",
      recall_room_run_hash: roomHash ?? sourceHash ?? "",
      filing_pack_hash: filingHash ?? sourceHash ?? "",
    }),
  });
  const body = asRecord((await response.json()) as unknown);
  if (response.ok) {
    return { signed: true, body };
  }
  if (response.status === 403 && !approvalKey) {
    return { signed: false, body };
  }
  throw new Error(formatError(body, "Human sign-off gate failed."));
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function getString(record: JsonRecord | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function getNumber(record: JsonRecord | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "number" ? value : null;
}

function getPathString(value: unknown, path: string[]) {
  const target = getPathValue(value, path);
  return typeof target === "string" ? target : null;
}

function getPathNumber(value: unknown, path: string[]) {
  const target = getPathValue(value, path);
  return typeof target === "number" ? target : null;
}

function getPathArray(value: unknown, path: string[]) {
  const target = getPathValue(value, path);
  return Array.isArray(target) ? target : [];
}

function getPathValue(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const segment of path) {
    const record = asRecord(current);
    current = record[segment];
  }
  return current;
}

function formatError(value: unknown, fallback: string) {
  const record = asRecord(value);
  const detail = record.detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return JSON.stringify(detail);
  }
  return fallback;
}
