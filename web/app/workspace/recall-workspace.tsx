"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import styles from "./recall-workspace.module.css";

type ShipmentStatus = "traced" | "missing";
type TaskStatus = "ready" | "blocked" | "review" | "draft";

type ShipmentRow = {
  id: string;
  source: string;
  distributor: string;
  region: string;
  customers: string;
  units: string;
  status: ShipmentStatus;
};

type Traceability = {
  shipped_units: number;
  traced_units: number;
  untraced_units: number;
  coverage_percent: number;
  affected_customers: number;
  regions: number;
};

type EvidenceResponse = {
  packet: {
    incident_id: string;
    facts: { key: string; value: string | number; citation_id: string }[];
    initial_traceability: Traceability;
    final_traceability: Traceability;
    initial_shipments: {
      source: string;
      distributor: string;
      region: string;
      customers: number;
      units: number;
      status: string;
    }[];
    missing_sources: string[];
    audit_hash: string;
  };
};

type FilingResponse = {
  filing_pack?: {
    pack_hash: string;
    filings: {
      id: string;
      authority: string;
      label: string;
      status: string;
      deadline_hours?: number | null;
      matched_regions?: string[];
      required_human_action: string;
    }[];
  };
};

type RegulatorResponse = {
  regulator_dispatch?: {
    mode: string;
    targets: {
      id: string;
      label: string;
      status: string;
      external_submit: boolean;
    }[];
  };
};

type WorkspaceResult = {
  evidence: EvidenceResponse;
  roomRun: JsonRecord | null;
  filing: FilingResponse;
  regulator: RegulatorResponse;
  signatureGate: JsonRecord | null;
  submissionProof: JsonRecord | null;
};

type Task = {
  title: string;
  owner: string;
  deadline: string;
  status: TaskStatus;
  detail: string;
};

export type WorkspaceSeedRow = Omit<ShipmentRow, "id">;

export type WorkspaceSeed = {
  id: string;
  complaintId: string;
  product: string;
  lot: string;
  defect: string;
  severity: "critical" | "high" | "medium" | "low";
  productCategory: string;
  rows: WorkspaceSeedRow[];
};

type JsonRecord = Record<string, unknown>;

type LiveEvent = {
  id: number;
  at: string;
  actor: string;
  stage: string;
  detail: string;
  status: "running" | "complete" | "gated" | "failed";
};

type RunReport = {
  completedAt: string;
  decision: string;
  initialCoveragePercent: number;
  finalCoveragePercent: number;
  shippedUnits: number;
  tracedUnits: number;
  untracedUnits: number;
  initialTracedRows: number;
  initialMissingRows: number;
  liveEventCount: number;
  roomMode: string;
  roomParticipants: number;
  filingDraftCount: number;
  regulatorTargetCount: number;
  signatureMode: string;
  signatureReady: boolean;
  sourceHash: string | null;
  roomHash: string | null;
  boundaryChecks: string[];
  nextAction: string;
};

type IncidentReportSection = {
  label: string;
  title: string;
  body: string;
  status: "complete" | "gated" | "failed" | "review";
};

type IncidentReportContext = {
  report: RunReport;
  complaintId: string;
  product: string;
  productCategory: string;
  lot: string;
  defect: string;
  severity: string;
  rows: ShipmentRow[];
  globalChecklist: ReturnType<typeof buildGlobalChecklist>;
  filings: NonNullable<FilingResponse["filing_pack"]>["filings"];
  regulatorTargets: NonNullable<
    RegulatorResponse["regulator_dispatch"]
  >["targets"];
  liveEvents: LiveEvent[];
  sourceHash: string | null;
  roomHash: string | null;
  filingHash: string | null;
  signatureReady: boolean;
  signatureMode: string;
};

type AgentRole = {
  actor: string;
  role: string;
  output: string;
};

const agentRoles: AgentRole[] = [
  {
    actor: "Commander",
    role: "coordinates the case",
    output: "case state, handoffs, next action",
  },
  {
    actor: "Evidence",
    role: "reads the complaint",
    output: "product, lot, defect, severity",
  },
  {
    actor: "Traceability",
    role: "checks shipment records",
    output: "coverage, missing units, markets",
  },
  {
    actor: "Regulatory/Risk",
    role: "checks safety duties",
    output: "hold path or review path",
  },
  {
    actor: "Communications",
    role: "prepares notices",
    output: "customer, distributor, filing drafts",
  },
];

const initialRows: ShipmentRow[] = [
  {
    id: "row-1",
    source: "",
    distributor: "",
    region: "",
    customers: "1",
    units: "1",
    status: "missing",
  },
];

export default function RecallWorkspace({
  apiBase,
  seed,
}: {
  apiBase: string;
  seed?: WorkspaceSeed | null;
}) {
  const [complaintId, setComplaintId] = useState("C-");
  const [product, setProduct] = useState("");
  const [productCategory, setProductCategory] = useState("consumer product");
  const [lot, setLot] = useState("");
  const [defect, setDefect] = useState("");
  const [severity, setSeverity] = useState("critical");
  const [rows, setRows] = useState<ShipmentRow[]>(initialRows);
  const [result, setResult] = useState<WorkspaceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [approvalKey, setApprovalKey] = useState("");
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [currentActor, setCurrentActor] = useState<string | null>(null);
  const [runCompletedAt, setRunCompletedAt] = useState("");
  const [runReport, setRunReport] = useState<RunReport | null>(null);
  const [approvalActionMessage, setApprovalActionMessage] = useState<
    string | null
  >(null);
  const [approvingReceipt, setApprovingReceipt] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "case" | "tasks" | "drafts" | "proof"
  >("case");
  const liveFeedRef = useRef<HTMLDivElement | null>(null);

  function applySeed(nextSeed: WorkspaceSeed) {
    const normalizedRows: ShipmentRow[] =
      nextSeed.rows.length > 0
        ? nextSeed.rows.map((row, index) => ({
            id: `${nextSeed.id}-row-${index + 1}`,
            source: row.source,
            distributor: row.distributor,
            region: row.region,
            customers: String(numeric(row.customers)),
            units: String(numeric(row.units)),
            status: row.status === "traced" ? "traced" : "missing",
          }))
        : initialRows;
    setComplaintId(nextSeed.complaintId || "C-");
    setProduct(nextSeed.product);
    setLot(nextSeed.lot);
    setDefect(nextSeed.defect);
    setSeverity(nextSeed.severity || "critical");
    setProductCategory(nextSeed.productCategory || "consumer product");
    setRows(normalizedRows);
    setApprovalKey("");
    setError(null);
    setActiveTab("case");
    clearRunState();
  }

  const validationError = useMemo(
    () => validateCase({ product, lot, defect, rows }),
    [product, lot, defect, rows],
  );

  const traceability = result?.evidence.packet.final_traceability;
  const isReady = Boolean(
    traceability && traceability.coverage_percent === 100,
  );
  const missingRows = rows.filter((row) => row.status === "missing");
  const globalChecklist = buildGlobalChecklist(rows, productCategory);
  const customerNotice = buildCustomerNotice({
    product,
    lot,
    defect,
    severity,
    isReady,
  });
  const distributorHold = buildDistributorHold({ product, lot, defect, rows });
  const executiveBrief = buildExecutiveBrief({
    product,
    lot,
    defect,
    severity,
    productCategory,
    result,
    isReady,
  });
  const filingDrafts = result?.filing.filing_pack?.filings ?? [];
  const tasks = buildTasks({
    isReady,
    missingRows,
    traceability,
    filings: filingDrafts,
    globalChecklist,
  });
  const initialTraceability = result?.evidence.packet.initial_traceability;
  const urgentTasks = tasks.filter(
    (task) => task.status === "blocked" || task.deadline.includes("24h"),
  );
  const sourceHash = result?.evidence.packet.audit_hash ?? null;
  const roomMode =
    getPathString(result?.roomRun, ["run", "band", "mode"]) ??
    getPathString(result?.roomRun, ["recall_room_run", "band", "mode"]) ??
    getPathString(result?.roomRun, ["band", "mode"]) ??
    "not run yet";
  const roomHash =
    getPathString(result?.roomRun, ["run", "run_hash"]) ??
    getPathString(result?.roomRun, ["recall_room_run", "run_hash"]) ??
    getPathString(result?.roomRun, ["room_run", "run_hash"]) ??
    getString(asRecord(result?.roomRun), "run_hash") ??
    sourceHash;
  const roomEvents = getPathArray(result?.roomRun, ["run", "room", "events"]);
  const roomParticipants =
    getPathNumber(result?.roomRun, ["run", "band", "participant_count"]) ??
    getPathNumber(result?.roomRun, [
      "recall_room_run",
      "band",
      "participant_count",
    ]) ??
    0;
  const regulatorTargets = result?.regulator.regulator_dispatch?.targets ?? [];
  const filingHash = result?.filing.filing_pack?.pack_hash ?? sourceHash;
  const signatureMode =
    getString(asRecord(result?.signatureGate), "mode") ??
    getString(asRecord(result?.signatureGate), "proof_kind") ??
    "not checked";
  const signatureReady =
    getString(asRecord(result?.signatureGate), "decision") === "approved" ||
    getString(asRecord(result?.signatureGate), "status") === "approved";
  const approvalHint = result
    ? signatureReady
      ? "Approval already sealed."
      : runReport?.decision === "Run failed"
        ? "Fix the run first and retry."
        : traceability?.coverage_percent === 100
          ? "Enter approval code to review and approve the recall."
          : "Traceability must be 100% before approval."
    : "Analyze the case first.";
  const incidentReportSections = runReport
    ? buildIncidentReportSections({
        report: runReport,
        complaintId,
        product,
        productCategory,
        lot,
        defect,
        severity,
        rows,
        globalChecklist,
        filings: filingDrafts,
        regulatorTargets,
        liveEvents,
        sourceHash,
        roomHash,
        filingHash,
        signatureReady,
        signatureMode,
      })
    : [];

  useEffect(() => {
    if (liveEvents.length === 0) {
      return;
    }
    liveFeedRef.current?.scrollTo({
      top: liveFeedRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [liveEvents.length]);

  async function appendLiveEvent(
    actor: string,
    stage: string,
    detail: string,
    status: LiveEvent["status"],
  ) {
    setCurrentActor(actor);
    setLiveEvents((current) => [
      ...current,
      {
        id: current.length + 1,
        at: new Date().toLocaleTimeString([], {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        actor,
        stage,
        detail,
        status,
      },
    ]);
    await sleep(status === "running" ? 280 : 170);
  }

  function clearRunState() {
    setResult(null);
    setRunCompletedAt("");
    setRunReport(null);
    setLiveEvents([]);
    setCurrentActor(null);
    setCopiedReport(false);
    setApprovalActionMessage(null);
    setApprovingReceipt(false);
  }

  useEffect(() => {
    if (!seed) {
      setComplaintId("C-");
      setProduct("");
      setProductCategory("consumer product");
      setLot("");
      setDefect("");
      setSeverity("critical");
      setRows(initialRows);
      setApprovalKey("");
      setError(null);
      clearRunState();
      setActiveTab("case");
      return;
    }
    applySeed(seed);
  }, [seed?.id]);

  async function analyzeCase(candidateRows?: ShipmentRow[]) {
    const normalizedRows =
      candidateRows ??
      rows.map((row) => ({
        ...row,
      }));
    if (candidateRows) {
      setRows(normalizedRows);
    }
    const nextError = validateCase({
      product,
      lot,
      defect,
      rows: normalizedRows,
    });
    if (nextError) {
      setError(nextError);
      return;
    }

    setBusy(true);
    setError(null);
    setApprovalActionMessage(null);
    clearRunState();
    setActiveTab("tasks");

    const complaintText = buildComplaintText({
      complaintId,
      product,
      lot,
      defect,
      severity,
    });
    const inputRows = normalizedRows.map((row) => ({ ...row }));
    const shipmentCsv = buildShipmentCsv(normalizedRows);
    let liveEventCount = 0;
    const body = {
      complaint_text: complaintText,
      shipment_csv: shipmentCsv,
      recovered_shipment_csv: shipmentCsv,
    };
    const trackLiveEvent = async (
      actor: string,
      stage: string,
      detail: string,
      status: LiveEvent["status"],
    ) => {
      await appendLiveEvent(actor, stage, detail, status);
      liveEventCount += 1;
    };

    try {
      await trackLiveEvent(
        "Commander",
        "case opened",
        `${complaintId.trim()} is open for ${product.trim()} lot ${lot.trim()}. Final action stays human-owned.`,
        "running",
      );

      await trackLiveEvent(
        "Evidence",
        "reading complaint",
        "Posting the complaint and shipment ledger to the live source-evidence engine.",
        "running",
      );
      const evidence = (await postJson(
        `${apiBase}/source-evidence`,
        body,
      )) as EvidenceResponse;
      await trackLiveEvent(
        "Traceability",
        "coverage math",
        `Coverage is ${evidence.packet.final_traceability.coverage_percent}%; ${evidence.packet.final_traceability.untraced_units.toLocaleString()} units remain untraced after the current ledger.`,
        evidence.packet.final_traceability.coverage_percent === 100
          ? "complete"
          : "gated",
      );

      let roomRun: JsonRecord | null = null;
      try {
        await trackLiveEvent(
          "Band",
          "opening command room",
          "Calling the recall-room endpoint with run_live_band=true so the agent room is attempted from this case.",
          "running",
        );
        roomRun = (await postJson(`${apiBase}/recall-room/run`, {
          ...body,
          run_live_band: true,
        })) as JsonRecord;
        await trackLiveEvent(
          "Band",
          "room proof attached",
          `Room mode: ${(getPathString(roomRun, ["run", "band", "mode"]) ?? "captured_or_deterministic").replaceAll("_", " ")}; participants: ${getPathNumber(roomRun, ["run", "band", "participant_count"]) ?? 0}.`,
          "complete",
        );
        for (const event of getPathArray(roomRun, ["run", "room", "events"])) {
          const record = asRecord(event);
          await trackLiveEvent(
            getString(record, "agent") ?? "RecallOps agent",
            (getString(record, "stage") ?? "room event").replaceAll("_", " "),
            getString(record, "message") ?? "Room event completed.",
            "complete",
          );
        }
      } catch (exc) {
        roomRun = {
          mode: "room_unavailable",
          detail:
            exc instanceof Error
              ? exc.message
              : "Recall-room run could not complete.",
        };
        await trackLiveEvent(
          "Band",
          "room unavailable",
          "The source engine will continue, but the room proof is marked unavailable for this run.",
          "failed",
        );
      }

      await trackLiveEvent(
        "Communications",
        "drafting filings",
        "Generating regulator, distributor, FDA-screen, and NHTSA-screen drafts from the same evidence set.",
        "running",
      );
      const filing = (await postJson(
        `${apiBase}/filing-pack`,
        body,
      )) as FilingResponse;
      await trackLiveEvent(
        "Communications",
        "filing pack sealed",
        `Prepared ${(filing.filing_pack?.filings ?? []).length} filing and notice drafts; pack hash ${shortValue(filing.filing_pack?.pack_hash ?? null)}.`,
        "complete",
      );

      await trackLiveEvent(
        "Regulatory/Risk",
        "preparing dry-run dispatch",
        "Preparing CPSC, EU, and regional dispatch targets without external submission.",
        "running",
      );
      const regulator = (await postJson(`${apiBase}/regulator-filing`, {
        ...body,
        dry_run: true,
        targets: ["cpsc", "eu", "regional"],
      })) as RegulatorResponse;
      await trackLiveEvent(
        "Regulatory/Risk",
        "dispatch prepared",
        `${(regulator.regulator_dispatch?.targets ?? []).length} regulator targets prepared in dry-run mode.`,
        "complete",
      );

      let signatureGate: JsonRecord | null = null;
      if (evidence.packet.final_traceability.coverage_percent < 100) {
        signatureGate = {
          mode: "blocked_by_traceability",
          final_coverage_percent:
            evidence.packet.final_traceability.coverage_percent,
          disclosure:
            "Human approval stayed closed because traceability is incomplete.",
        };
        await trackLiveEvent(
          "QA Director",
          "approval blocked",
          "Human approval stayed closed because shipment traceability is not 100%.",
          "gated",
        );
      } else {
        const nextRoomHash =
          getPathString(roomRun, ["run", "run_hash"]) ??
          getPathString(roomRun, ["recall_room_run", "run_hash"]) ??
          getPathString(roomRun, ["room_run", "run_hash"]) ??
          evidence.packet.audit_hash;
        const signatureResult = await runSignatureGate({
          apiBase,
          approvalKey: approvalKey.trim(),
          sourceHash: evidence.packet.audit_hash,
          roomHash: nextRoomHash,
          filingHash:
            filing.filing_pack?.pack_hash ?? evidence.packet.audit_hash,
        });
        signatureGate = signatureResult.body;
        await trackLiveEvent(
          "QA Director",
          signatureResult.signed ? "approval sealed" : "approval gated",
          signatureResult.signed
            ? "Verified approval material sealed the human approval receipt."
            : "No approval code was provided, so RecallOps proves the gate stays closed.",
          signatureResult.signed ? "complete" : "gated",
        );
      }

      let submissionProof: JsonRecord | null = null;
      try {
        await trackLiveEvent(
          "Proof desk",
          "assembling proof",
          "Fetching the deployed proof packet so this run can be exported with source, room, filing, and gate evidence.",
          "running",
        );
        submissionProof = (await fetchJson(
          `${apiBase}/submission-proof`,
        )) as JsonRecord;
        await trackLiveEvent(
          "Proof desk",
          "action pack ready",
          "The downloadable action pack is ready for review, audit, or handoff.",
          "complete",
        );
      } catch {
        await trackLiveEvent(
          "Proof desk",
          "deployed proof unavailable",
          "The case action pack is still available; deployed submission proof could not be fetched.",
          "failed",
        );
      }

      const roomModeForSummary =
        getPathString(roomRun, ["run", "band", "mode"]) ??
        getPathString(roomRun, ["recall_room_run", "band", "mode"]) ??
        getPathString(roomRun, ["band", "mode"]) ??
        "not run";
      const roomParticipantsForSummary =
        getPathNumber(roomRun, ["run", "band", "participant_count"]) ??
        getPathNumber(roomRun, [
          "recall_room_run",
          "band",
          "participant_count",
        ]) ??
        0;
      const roomHashForSummary =
        getPathString(roomRun, ["run", "run_hash"]) ??
        getPathString(roomRun, ["recall_room_run", "run_hash"]) ??
        getPathString(roomRun, ["room_run", "run_hash"]) ??
        evidence.packet.audit_hash;
      setResult({
        evidence,
        roomRun,
        filing,
        regulator,
        signatureGate,
        submissionProof,
      });
      const isRunSigned =
        getString(asRecord(signatureGate), "decision") === "approved" ||
        getString(asRecord(signatureGate), "status") === "approved";
      const completedAt = new Date().toLocaleString();
      setRunCompletedAt(completedAt);
      setRunReport({
        completedAt,
        decision:
          evidence.packet.final_traceability.coverage_percent === 100
            ? "Ready for human review"
            : "Blocked: traceability incomplete",
        initialCoveragePercent:
          evidence.packet.initial_traceability.coverage_percent,
        finalCoveragePercent:
          evidence.packet.final_traceability.coverage_percent,
        shippedUnits: evidence.packet.final_traceability.shipped_units,
        tracedUnits: evidence.packet.final_traceability.traced_units,
        untracedUnits: evidence.packet.final_traceability.untraced_units,
        initialTracedRows: inputRows.filter((row) => row.status === "traced")
          .length,
        initialMissingRows: inputRows.filter((row) => row.status === "missing")
          .length,
        liveEventCount,
        roomMode: roomModeForSummary,
        roomParticipants: roomParticipantsForSummary,
        filingDraftCount: filing.filing_pack?.filings.length ?? 0,
        regulatorTargetCount: regulator.regulator_dispatch?.targets.length ?? 0,
        signatureMode:
          getString(asRecord(signatureGate), "mode") ??
          getString(asRecord(signatureGate), "proof_kind") ??
          "not checked",
        signatureReady: isRunSigned,
        sourceHash: evidence.packet.audit_hash,
        roomHash: roomHashForSummary,
        nextAction:
          evidence.packet.final_traceability.coverage_percent === 100
            ? "Everything is ready for human legal/regulatory review. Add approval code to create the final gate receipt or export artifacts for handoff."
            : "Use Recovery mode: mark missing shipments as traced, rerun analysis, then capture approval receipt after review.",
        boundaryChecks: [
          "Decision support only; a qualified human keeps final recall control.",
          "No public regulator submission was sent in this run.",
          "No SAP or Oracle write was performed.",
          "Source traceability, room activity, filing drafts, and gate status are bundled in the report.",
        ],
      });
      setActiveTab("proof");
    } catch (exc) {
      const failureMessage =
        exc instanceof Error
          ? exc.message
          : "Recall analysis could not complete.";
      setError(
        exc instanceof Error
          ? exc.message
          : "Recall analysis could not complete.",
      );
      await trackLiveEvent("RecallOps", "run failed", failureMessage, "failed");
      const completedAt = new Date().toLocaleString();
      setRunCompletedAt(completedAt);
      setRunReport({
        completedAt,
        decision: "Run failed",
        initialCoveragePercent: initialTraceability?.coverage_percent ?? 0,
        finalCoveragePercent: 0,
        shippedUnits: 0,
        tracedUnits: 0,
        untracedUnits: 0,
        initialTracedRows: inputRows.filter((row) => row.status === "traced")
          .length,
        initialMissingRows: inputRows.filter((row) => row.status === "missing")
          .length,
        liveEventCount: liveEventCount,
        roomMode: roomMode,
        roomParticipants,
        filingDraftCount: 0,
        regulatorTargetCount: 0,
        signatureMode: "failed",
        signatureReady: false,
        sourceHash: null,
        roomHash: null,
        nextAction:
          "Capture the exact error shown above, correct the input, and run again. If the issue repeats, compare the uploaded payload with backend API expectations.",
        boundaryChecks: [
          "A detailed run report was still generated for auditability.",
          `Error: ${failureMessage}`,
          "No external regulator submission or enterprise write was performed.",
          "A human signature was not generated because execution did not complete.",
        ],
      });
      setActiveTab("proof");
    } finally {
      setBusy(false);
    }
  }

  async function sealApprovalReceipt() {
    if (!result) {
      return;
    }
    if (!approvalKey.trim()) {
      setApprovalActionMessage(
        "Enter approval code in the proof tab before sealing.",
      );
      return;
    }
    if (
      !traceability?.coverage_percent ||
      traceability.coverage_percent < 100
    ) {
      setApprovalActionMessage("Coverage is not 100%. Fix traceability first.");
      return;
    }
    if (signatureReady) {
      setApprovalActionMessage("Approval is already sealed.");
      return;
    }

    const nextRoomHash =
      getPathString(result.roomRun, ["run", "run_hash"]) ??
      getPathString(result.roomRun, ["recall_room_run", "run_hash"]) ??
      getPathString(result.roomRun, ["room_run", "run_hash"]) ??
      result.evidence.packet.audit_hash;
    const sourceHashForApproval = result.evidence.packet.audit_hash;
    const filingHashForApproval =
      result.filing.filing_pack?.pack_hash ?? result.evidence.packet.audit_hash;

    setApprovingReceipt(true);
    setApprovalActionMessage(null);
    try {
      await appendLiveEvent(
        "QA Director",
        "approval requested",
        "Submitting approval code to review and approve the recall.",
        "running",
      );
      const signatureResult = await runSignatureGate({
        apiBase,
        approvalKey: approvalKey.trim(),
        sourceHash: sourceHashForApproval,
        roomHash: nextRoomHash,
        filingHash: filingHashForApproval,
      });

      if (!signatureResult.signed) {
        await appendLiveEvent(
          "QA Director",
          "approval gated",
          "Approval could not be sealed with current key.",
          "gated",
        );
        setApprovalActionMessage(
          getString(asRecord(signatureResult.body), "disclosure") ??
            "Approval seal failed. Confirm the approval code and try again.",
        );
        return;
      }

      const signatureModeForRun =
        getString(asRecord(signatureResult.body), "mode") ??
        getString(asRecord(signatureResult.body), "proof_kind") ??
        "approved";
      setResult((current) =>
        current
          ? {
              ...current,
              signatureGate: signatureResult.body,
            }
          : current,
      );
      setRunReport((current) =>
        current
          ? {
              ...current,
              signatureMode: signatureModeForRun,
              signatureReady: true,
              nextAction:
                "Human gate is sealed. Export artifacts or open proof.",
            }
          : current,
      );
      setApprovalActionMessage(
        "Approval receipt sealed. A named human approver is now recorded.",
      );
      setActiveTab("proof");
      await appendLiveEvent(
        "QA Director",
        "approval sealed",
        "Human approval receipt was successfully sealed.",
        "complete",
      );
    } catch (exc) {
      const message =
        exc instanceof Error
          ? exc.message
          : "Failed to seal human approval receipt.";
      setApprovalActionMessage(message);
      await appendLiveEvent(
        "QA Director",
        "approval failed",
        message,
        "failed",
      );
    } finally {
      setApprovingReceipt(false);
    }
  }

  function updateRow(
    id: string,
    field: keyof Omit<ShipmentRow, "id">,
    value: string,
  ) {
    clearRunState();
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function addRow() {
    clearRunState();
    setRows((current) => [
      ...current,
      {
        id: `row-${Date.now()}`,
        source: `SHIP-${900 + current.length + 1}`,
        distributor: "",
        region: "US-East",
        customers: "1",
        units: "1",
        status: "missing",
      },
    ]);
  }

  function removeRow(id: string) {
    clearRunState();
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function markAllTraced() {
    clearRunState();
    setRows((current) => current.map((row) => ({ ...row, status: "traced" })));
  }

  async function markAllAndRerun() {
    const recoveredRows: ShipmentRow[] = rows.map((row) => ({
      ...row,
      status: "traced",
    }));
    await analyzeCase(recoveredRows);
  }

  function resetCase() {
    setComplaintId("C-");
    setProduct("");
    setLot("");
    setDefect("");
    setRows(initialRows);
    setError(null);
    setActiveTab("case");
    clearRunState();
  }

  async function uploadShipmentCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }
    try {
      clearRunState();
      setRows(parseShipmentCsv(await file.text()));
    } catch (exc) {
      setError(
        exc instanceof Error ? exc.message : "Shipment CSV could not be read.",
      );
    } finally {
      event.currentTarget.value = "";
    }
  }

  async function uploadComplaintFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseComplaint(text);
      clearRunState();
      setComplaintId(parsed.complaintId ?? complaintId);
      setProduct(parsed.product ?? product);
      setLot(parsed.lot ?? lot);
      setDefect(parsed.defect ?? defect);
      setSeverity(parsed.severity ?? severity);
    } catch {
      setError("Complaint file could not be read.");
    } finally {
      event.currentTarget.value = "";
    }
  }

  function downloadActionPack() {
    if (!result) {
      return;
    }
    const actionPack = {
      proof_kind: "recallops_global_action_pack",
      generated_at: new Date().toISOString(),
      case: {
        complaintId,
        product,
        productCategory,
        lot,
        defect,
        severity,
        shipments: rows,
      },
      readiness: isReady
        ? "ready_for_human_review"
        : "blocked_missing_traceability",
      tasks,
      globalChecklist,
      executiveBrief,
      customerNotice,
      distributorHold,
      evidence: result.evidence,
      recallRoomRun: result.roomRun,
      filingPack: result.filing,
      regulatorDispatch: result.regulator,
      humanSignatureGate: result.signatureGate,
      deployedSubmissionProof: result.submissionProof,
      liveExecutionStream: liveEvents,
      boundaries: [
        "This pack is decision support, not legal advice.",
        "No external regulator submission was sent.",
        "No SAP or Oracle tenant write was performed.",
        "A named human remains responsible for final recall approval.",
      ],
    };
    downloadJson(actionPack, `recallops-${lot || "case"}-action-pack.json`);
  }

  function downloadBandProof() {
    if (!result?.roomRun) {
      return;
    }
    const bandProof = {
      proof_kind: "recallops_workspace_band_room_proof",
      generated_at: new Date().toISOString(),
      case: {
        complaintId,
        product,
        lot,
        defect,
        severity,
      },
      source_audit_hash: sourceHash,
      room_run_hash: roomHash,
      band: {
        mode: roomMode,
        participant_count: roomParticipants,
      },
      liveExecutionStream: liveEvents,
      transcript: roomEvents,
      rawRoomRun: result.roomRun,
    };
    downloadJson(bandProof, `recallops-${lot || "case"}-band-proof.json`);
  }

  async function copyRunReport() {
    if (!runReport) {
      return;
    }
    await navigator.clipboard.writeText(
      buildDetailedRunReportText({
        report: runReport,
        complaintId,
        product,
        productCategory,
        lot,
        defect,
        severity,
        rows,
        globalChecklist,
        filings: filingDrafts,
        regulatorTargets,
        liveEvents,
        sourceHash,
        roomHash,
        filingHash,
        signatureReady,
        signatureMode,
      }),
    );
    setCopiedReport(true);
    window.setTimeout(() => setCopiedReport(false), 1800);
  }

  function downloadRunReport() {
    if (!runReport) {
      return;
    }
    downloadText(
      buildDetailedRunReportText({
        report: runReport,
        complaintId,
        product,
        productCategory,
        lot,
        defect,
        severity,
        rows,
        globalChecklist,
        filings: filingDrafts,
        regulatorTargets,
        liveEvents,
        sourceHash,
        roomHash,
        filingHash,
        signatureReady,
        signatureMode,
      }),
      `recallops-${lot || "case"}-run-report.txt`,
    );
  }

  async function copyNotice() {
    await navigator.clipboard.writeText(customerNotice);
    setCopiedNotice(true);
    window.setTimeout(() => setCopiedNotice(false), 1800);
  }

  return (
    <section className={styles.commandCenter}>
      <section className={styles.heroBoard}>
        <article className={styles.verdictCard} data-ready={isReady}>
          <p className={styles.kicker}>Decision readiness</p>
          <h2>
            {result
              ? isReady
                ? "Ready for human review"
                : "Blocked: traceability gap"
              : "Start a recall case"}
          </h2>
          <p>
            {result
              ? isReady
                ? "All shipped units are traced. Review drafts and route to the accountable recall owner."
                : "Some shipped units are untraced. Add recovered shipment evidence before approval or external action."
              : "Upload or enter the incident, then run analysis to get the action board."}
          </p>
          <div className={styles.buttonRow}>
            <button disabled={busy} onClick={() => analyzeCase()} type="button">
              {busy ? "Analyzing recall case..." : "Analyze recall case"}
            </button>
            <button
              disabled={busy || missingRows.length === 0}
              onClick={markAllAndRerun}
              type="button"
            >
              {busy ? "Recomputing..." : "Add recovered file and rerun"}
            </button>
          </div>
          {error ? <strong>{error}</strong> : null}
          {validationError ? <small>{validationError}</small> : null}
        </article>

        <article className={styles.metricStrip}>
          <div>
            <span>Coverage</span>
            <strong>
              {traceability ? `${traceability.coverage_percent}%` : "-"}
            </strong>
          </div>
          <div>
            <span>Untraced units</span>
            <strong>
              {traceability
                ? traceability.untraced_units.toLocaleString()
                : "-"}
            </strong>
          </div>
          <div>
            <span>Urgent tasks</span>
            <strong>{result ? urgentTasks.length : "-"}</strong>
          </div>
          <div>
            <span>Regions</span>
            <strong>{result ? globalChecklist.length : "-"}</strong>
          </div>
        </article>
      </section>

      <section className={styles.liveRoom}>
        <article className={styles.agentBoard}>
          <div>
            <p className={styles.kicker}>Live recall room</p>
            <h2>Five roles working the case in view.</h2>
            <p>
              The active role changes during the run, so an external user can
              see who is reading evidence, calculating coverage, drafting
              notices, checking regulator routes, and holding final approval.
            </p>
          </div>
          <div className={styles.agentGrid}>
            {agentRoles.map((role) => (
              <article
                data-active={
                  currentActor === role.actor ||
                  (currentActor === "Band" && role.actor === "Traceability") ||
                  (currentActor === "Proof desk" &&
                    role.actor === "Recall owner")
                }
                key={role.actor}
              >
                <span>{role.actor}</span>
                <strong>{role.role}</strong>
                <p>{role.output}</p>
              </article>
            ))}
          </div>
        </article>

        <article className={styles.executionPanel}>
          <div className={styles.executionHeader}>
            <div>
              <p className={styles.kicker}>Execution stream</p>
              <h2>
                {busy ? "Running analysis..." : "Waiting for case analysis"}
              </h2>
              <p>
                Every real API call, Band-room attempt, filing draft, regulator
                dry-run, and approval gate decision appears here as it happens.
              </p>
            </div>
            <strong>
              {busy ? "live" : liveEvents.length ? "complete" : "idle"}
            </strong>
          </div>
          <div className={styles.liveEventFeed} ref={liveFeedRef}>
            {liveEvents.length > 0 ? (
              liveEvents.map((event) => (
                <article data-status={event.status} key={event.id}>
                  <time>{event.at}</time>
                  <span>{event.actor}</span>
                  <div>
                    <strong>{event.stage}</strong>
                    <p>{event.detail}</p>
                  </div>
                  <code>{event.status}</code>
                </article>
              ))
            ) : (
              <article data-status="running">
                <time>--:--:--</time>
                <span>RecallOps</span>
                <div>
                  <strong>waiting for case run</strong>
                  <p>
                    Click Analyze recall case to watch source evidence,
                    traceability, Band-room handoff, filing drafts, regulator
                    dry-run, and approval gate checks unfold.
                  </p>
                </div>
                <code>ready</code>
              </article>
            )}
          </div>
        </article>
      </section>

      {runReport ? (
        <article className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <p className={styles.kicker}>Detailed run report</p>
              <h2>What happened in this run</h2>
              <p>
                Run finished at <strong>{runCompletedAt}</strong>. You can hand
                this as the post-run report.
              </p>
            </div>
            <div>
              <button
                onClick={copyRunReport}
                disabled={!runReport}
                type="button"
              >
                {copiedReport ? "Report copied" : "Copy report"}
              </button>
              <button
                onClick={downloadRunReport}
                disabled={!runReport}
                type="button"
              >
                Download report (txt)
              </button>
            </div>
          </div>
          <div className={styles.proofGrid}>
            <article>
              <span>Run decision</span>
              <strong>
                {runReport?.decision ??
                  (isReady ? "Ready for human review" : "Blocked")}
              </strong>
              <p>
                {runReport?.decision === "Ready for human review"
                  ? "Coverage reached 100% and the case moved to review mode."
                  : "Coverage is incomplete; approval is blocked until evidence is complete."}
              </p>
            </article>
            <article>
              <span>Traceability movement</span>
              <strong>
                {runReport?.initialCoveragePercent ??
                  initialTraceability?.coverage_percent ??
                  0}
                {"% -> "}
                {runReport?.finalCoveragePercent ??
                  traceability?.coverage_percent ??
                  0}
                %
              </strong>
              <p>
                Traced units:{" "}
                {runReport?.tracedUnits ?? traceability?.traced_units ?? 0} /{" "}
                {runReport?.shippedUnits ?? traceability?.shipped_units ?? 0};{" "}
                Untraced:{" "}
                {runReport?.untracedUnits ?? traceability?.untraced_units ?? 0}.
              </p>
            </article>
            <article>
              <span>Execution details</span>
              <strong>
                {runReport?.liveEventCount ?? liveEvents.length} live events
              </strong>
              <p>
                Current actor sequence includes evidence, room, filing,
                regulator dry-run, and gate checks.
              </p>
            </article>
            <article>
              <span>Proof and approvals</span>
              <strong>
                {(runReport?.roomMode ?? roomMode).replaceAll("_", " ")}
              </strong>
              <p>
                {runReport?.roomParticipants ?? roomParticipants} participants,{" "}
                {runReport?.signatureReady
                  ? "approval gate sealed"
                  : "approval gate closed"}
                , source hash{" "}
                {runReport?.sourceHash || sourceHash ? "available" : "pending"}.
              </p>
            </article>
            <article>
              <span>Next action</span>
              <strong>
                {runReport?.decision === "Ready for human review"
                  ? "Ready to hand off"
                  : runReport?.decision === "Run failed"
                    ? "Fix then rerun"
                    : "Close evidence gap"}
              </strong>
              <p>{runReport?.nextAction}</p>
            </article>
          </div>
          <div className={styles.reportNarrative}>
            {incidentReportSections.map((section) => (
              <article data-status={section.status} key={section.label}>
                <span>{section.label}</span>
                <strong>{section.title}</strong>
                <p>{section.body}</p>
              </article>
            ))}
          </div>
          <div className={styles.reportFacts}>
            <div>
              <span>Case</span>
              <strong>{complaintId.trim() || "unlabeled"}</strong>
              <p>
                {product || "Product"} lot {lot || "unknown"}; severity{" "}
                {severity}.
              </p>
            </div>
            <div>
              <span>Shipments</span>
              <strong>{rows.length} row(s)</strong>
              <p>
                {rows
                  .map(
                    (row) =>
                      `${row.source || "source"}: ${numeric(row.units).toLocaleString()} units ${row.status}`,
                  )
                  .join("; ")}
              </p>
            </div>
            <div>
              <span>Regions</span>
              <strong>{globalChecklist.length} route(s)</strong>
              <p>
                {globalChecklist.map((item) => item.market).join(", ") ||
                  "No market classified."}
              </p>
            </div>
          </div>
          <div className={styles.boundaryList} style={{ marginTop: 10 }}>
            {runReport?.boundaryChecks.map((check) => (
              <p key={check}>{check}</p>
            )) ?? null}
          </div>
        </article>
      ) : null}

      <nav className={styles.tabs} aria-label="Workspace sections">
        {[
          ["case", "Case intake"],
          ["tasks", "Task board"],
          ["drafts", "Drafts"],
          ["proof", "Audit and exports"],
        ].map(([id, label]) => (
          <button
            aria-pressed={activeTab === id}
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === "case" ? (
        <section className={styles.twoColumn}>
          <article className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <p className={styles.kicker}>Incident intake</p>
                <h2>Paste details or upload a complaint file.</h2>
              </div>
              <label className={styles.fileButton}>
                Upload complaint
                <input
                  accept=".txt,.csv,text/plain,text/csv"
                  onChange={uploadComplaintFile}
                  type="file"
                />
              </label>
            </div>
            <div className={styles.fieldGrid}>
              <label>
                <span>Complaint ID</span>
                <input
                  onChange={(event) => {
                    clearRunState();
                    setComplaintId(event.currentTarget.value);
                  }}
                  value={complaintId}
                />
              </label>
              <label>
                <span>Product</span>
                <input
                  onChange={(event) => {
                    clearRunState();
                    setProduct(event.currentTarget.value);
                  }}
                  value={product}
                />
              </label>
              <label>
                <span>Lot or batch</span>
                <input
                  onChange={(event) => {
                    clearRunState();
                    setLot(event.currentTarget.value);
                  }}
                  value={lot}
                />
              </label>
              <label>
                <span>Product category</span>
                <select
                  onChange={(event) => {
                    clearRunState();
                    setProductCategory(event.currentTarget.value);
                  }}
                  value={productCategory}
                >
                  <option value="consumer product">consumer product</option>
                  <option value="food">food</option>
                  <option value="medical device">medical device</option>
                  <option value="vehicle equipment">vehicle equipment</option>
                  <option value="toy or child product">
                    toy or child product
                  </option>
                  <option value="industrial equipment">
                    industrial equipment
                  </option>
                </select>
              </label>
              <label>
                <span>Severity</span>
                <select
                  onChange={(event) => {
                    clearRunState();
                    setSeverity(event.currentTarget.value);
                  }}
                  value={severity}
                >
                  <option value="critical">critical</option>
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </label>
              <label className={styles.wideField}>
                <span>What went wrong?</span>
                <textarea
                  onChange={(event) => {
                    clearRunState();
                    setDefect(event.currentTarget.value);
                  }}
                  value={defect}
                />
              </label>
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <p className={styles.kicker}>Shipment ledger</p>
                <h2>Upload CSV or edit rows.</h2>
              </div>
              <div className={styles.buttonRow}>
                <label className={styles.fileButton}>
                  Upload CSV
                  <input
                    accept=".csv,text/csv"
                    onChange={uploadShipmentCsv}
                    type="file"
                  />
                </label>
                <button onClick={addRow} type="button">
                  Add row
                </button>
                <button onClick={markAllTraced} type="button">
                  Mark all traced
                </button>
                <button onClick={resetCase} type="button">
                  Reset
                </button>
              </div>
            </div>
            <ShipmentEditor
              rows={rows}
              removeRow={removeRow}
              updateRow={updateRow}
            />
          </article>
        </section>
      ) : null}

      {activeTab === "tasks" ? (
        <section className={styles.taskLayout}>
          <article className={styles.card}>
            <p className={styles.kicker}>Action board</p>
            <div className={styles.taskGrid}>
              {tasks.map((task) => (
                <article
                  data-status={task.status}
                  key={`${task.owner}-${task.title}`}
                >
                  <span>{task.owner}</span>
                  <strong>{task.title}</strong>
                  <p>{task.detail}</p>
                  <code>{task.deadline}</code>
                </article>
              ))}
            </div>
          </article>
          <article className={styles.card}>
            <p className={styles.kicker}>Global market checklist</p>
            <div className={styles.marketList}>
              {globalChecklist.map((item) => (
                <article key={`${item.market}-${item.authority}`}>
                  <span>{item.market}</span>
                  <strong>{item.authority}</strong>
                  <p>{item.action}</p>
                  <code>{item.status}</code>
                </article>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "drafts" ? (
        <section className={styles.twoColumn}>
          <article className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <p className={styles.kicker}>Customer notice</p>
                <h2>Plain-language draft.</h2>
              </div>
              <button onClick={copyNotice} type="button">
                {copiedNotice ? "Copied" : "Copy notice"}
              </button>
            </div>
            <textarea
              className={styles.noticeDraft}
              readOnly
              value={customerNotice}
            />
          </article>
          <article className={styles.card}>
            <p className={styles.kicker}>Distributor hold</p>
            <h2>Send to warehouses and distributors after review.</h2>
            <textarea
              className={styles.noticeDraft}
              readOnly
              value={distributorHold}
            />
          </article>
          <article className={styles.cardWide}>
            <p className={styles.kicker}>Regulator and filing drafts</p>
            <div className={styles.documentGrid}>
              {(result?.filing.filing_pack?.filings ?? []).map((filing) => (
                <article key={filing.id}>
                  <span>{filing.authority}</span>
                  <strong>{filing.label}</strong>
                  <p>{filing.required_human_action}</p>
                  <code>{filing.status}</code>
                </article>
              ))}
              {!result ? (
                <p className={styles.emptyState}>
                  Run analysis to generate filing drafts.
                </p>
              ) : null}
            </div>
          </article>
          <article className={styles.cardWide}>
            <p className={styles.kicker}>Prepared dispatch targets</p>
            <div className={styles.proofGrid}>
              {regulatorTargets.length > 0 ? (
                regulatorTargets.map((target) => (
                  <article key={target.id}>
                    <span>{target.id}</span>
                    <strong>{target.label}</strong>
                    <p>
                      {target.status}; external submit{" "}
                      {target.external_submit ? "enabled" : "off"}.
                    </p>
                  </article>
                ))
              ) : (
                <article>
                  <span>dry-run</span>
                  <strong>pending</strong>
                  <p>Build the action center to prepare dispatch targets.</p>
                </article>
              )}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "proof" ? (
        <section className={styles.twoColumn}>
          <article className={styles.card}>
            <p className={styles.kicker}>Executive brief</p>
            <textarea
              className={styles.noticeDraft}
              readOnly
              value={executiveBrief}
            />
          </article>
          <article className={styles.card}>
            <p className={styles.kicker}>Exports</p>
            <label className={styles.inlineField}>
              <span>Approval code (optional)</span>
              <input
                autoComplete="off"
                onChange={(event) => {
                  setApprovalKey(event.currentTarget.value);
                }}
                placeholder="Leave blank to prove the gate is closed"
                spellCheck={false}
                type="password"
                value={approvalKey}
              />
            </label>
            <div className={styles.exportStack}>
              <button
                disabled={
                  !result ||
                  !traceability ||
                  !result?.evidence.packet.final_traceability
                    .coverage_percent ||
                  traceability.coverage_percent < 100 ||
                  approvingReceipt ||
                  signatureReady ||
                  !approvalKey.trim()
                }
                onClick={sealApprovalReceipt}
                type="button"
              >
                {approvingReceipt
                  ? "Sealing approval..."
                  : signatureReady
                    ? "Approval already sealed"
                    : "Review and approve recall"}
              </button>
              <button
                disabled={!result}
                onClick={downloadActionPack}
                type="button"
              >
                Download full action pack
              </button>
              <button
                disabled={!result?.roomRun}
                onClick={downloadBandProof}
                type="button"
              >
                Download Band-room proof
              </button>
              <a href="/proof">Open proof explorer</a>
              <a href="/docs">Open API docs</a>
            </div>
            <p className={styles.kicker}>Approval status</p>
            <p>{approvalActionMessage ?? approvalHint}</p>
            {result?.signatureGate ? (
              <ul className={styles.boundaryList}>
                <li>
                  {signatureReady
                    ? `Approval decision: ${signatureMode.replaceAll("_", " ")}`
                    : "Approval gate is not sealed yet."}
                </li>
                <li>
                  {getString(asRecord(result.signatureGate), "disclosure") ??
                    "No approval disclosure available yet."}
                </li>
              </ul>
            ) : null}
            <ul className={styles.boundaryList}>
              <li>No public regulator submission.</li>
              <li>No public SAP or Oracle write.</li>
              <li>Final recall action stays human-owned.</li>
              <li>This is decision support, not legal advice.</li>
            </ul>
          </article>
          <article className={styles.cardWide}>
            <p className={styles.kicker}>Room, dispatch, and gate proof</p>
            <div className={styles.proofGrid}>
              <article>
                <span>Band room mode</span>
                <strong>{roomMode.replaceAll("_", " ")}</strong>
                <p>{roomParticipants} participant(s) recorded for this run.</p>
              </article>
              <article>
                <span>Regulator dry-run</span>
                <strong>{regulatorTargets.length} targets</strong>
                <p>No public regulator submission was sent.</p>
              </article>
              <article>
                <span>Human gate</span>
                <strong>{signatureReady ? "sealed" : "closed"}</strong>
                <p>{signatureMode.replaceAll("_", " ")}</p>
              </article>
            </div>
            <div className={styles.transcriptFeed}>
              {roomEvents.length > 0 ? (
                roomEvents.map((event, index) => {
                  const record = asRecord(event);
                  return (
                    <article key={`${getString(record, "id")}-${index}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>
                          {getString(record, "agent") ?? "RecallOps agent"}
                        </strong>
                        <code>
                          {(
                            getString(record, "stage") ?? "room_event"
                          ).replaceAll("_", " ")}
                        </code>
                        <p>
                          {getString(record, "message") ??
                            "Room event completed."}
                        </p>
                      </div>
                    </article>
                  );
                })
              ) : (
                <article>
                  <span>01</span>
                  <div>
                    <strong>Waiting for room run</strong>
                    <code>pending</code>
                    <p>
                      Build the action center to stream the room transcript.
                    </p>
                  </div>
                </article>
              )}
            </div>
          </article>
        </section>
      ) : null}
    </section>
  );
}

function ShipmentEditor({
  rows,
  removeRow,
  updateRow,
}: {
  rows: ShipmentRow[];
  removeRow: (id: string) => void;
  updateRow: (
    id: string,
    field: keyof Omit<ShipmentRow, "id">,
    value: string,
  ) => void;
}) {
  return (
    <div className={styles.shipmentTable}>
      <div className={styles.tableHeader}>
        <span>source</span>
        <span>distributor</span>
        <span>market / country</span>
        <span>customers</span>
        <span>units</span>
        <span>status</span>
        <span>remove</span>
      </div>
      {rows.map((row) => (
        <div className={styles.tableRow} key={row.id}>
          <input
            onChange={(event) =>
              updateRow(row.id, "source", event.currentTarget.value)
            }
            value={row.source}
          />
          <input
            onChange={(event) =>
              updateRow(row.id, "distributor", event.currentTarget.value)
            }
            value={row.distributor}
          />
          <input
            onChange={(event) =>
              updateRow(row.id, "region", event.currentTarget.value)
            }
            value={row.region}
          />
          <input
            min={1}
            onChange={(event) =>
              updateRow(row.id, "customers", event.currentTarget.value)
            }
            type="number"
            value={row.customers}
          />
          <input
            min={1}
            onChange={(event) =>
              updateRow(row.id, "units", event.currentTarget.value)
            }
            type="number"
            value={row.units}
          />
          <select
            onChange={(event) =>
              updateRow(row.id, "status", event.currentTarget.value)
            }
            value={row.status}
          >
            <option value="traced">traced</option>
            <option value="missing">missing</option>
          </select>
          <button onClick={() => removeRow(row.id)} type="button">
            remove
          </button>
        </div>
      ))}
    </div>
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

async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const detail =
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      typeof (payload as { detail: unknown }).detail === "string"
        ? (payload as { detail: string }).detail
        : "Request failed.";
    throw new Error(detail);
  }
  return payload;
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
  sourceHash: string;
  roomHash: string;
  filingHash: string;
}): Promise<{ signed: boolean; body: JsonRecord }> {
  const response = await fetch(`${apiBase}/esignature-approval`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(approvalKey ? { "x-recallops-approval-key": approvalKey } : {}),
    },
    body: JSON.stringify({
      approver: "Recall owner",
      decision: "approved",
      reason:
        "Workspace reviewed source evidence, recall room, filing pack, and regulator dispatch dry-run.",
      source_audit_hash: sourceHash,
      recall_room_run_hash: roomHash,
      filing_pack_hash: filingHash,
    }),
  });
  const body = asRecord((await response.json()) as unknown);
  if (response.ok) {
    return { signed: true, body };
  }
  if (response.status === 403 && !approvalKey) {
    return { signed: false, body };
  }
  throw new Error(formatError(body, "Human approval gate failed."));
}

function buildComplaintText({
  complaintId,
  product,
  lot,
  defect,
  severity,
}: {
  complaintId: string;
  product: string;
  lot: string;
  defect: string;
  severity: string;
}) {
  return `${complaintId.trim()} | product: ${product.trim()} | lot: ${lot.trim()} | defect: ${defect.trim()} | severity: ${severity.trim()}`;
}

function buildShipmentCsv(rows: ShipmentRow[]) {
  const header = "source,distributor,region,customers,units,status";
  const body = rows.map((row) =>
    [
      row.source.trim(),
      row.distributor.trim(),
      row.region.trim(),
      numeric(row.customers),
      numeric(row.units),
      row.status,
    ].join(","),
  );
  return [header, ...body].join("\n");
}

function parseShipmentCsv(csvText: string): ShipmentRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("Shipment CSV needs a header and at least one row.");
  }
  const headers = lines[0]
    .split(",")
    .map((header) => header.trim().toLowerCase());
  const required = [
    "source",
    "distributor",
    "region",
    "customers",
    "units",
    "status",
  ];
  for (const header of required) {
    if (!headers.includes(header)) {
      throw new Error(`Shipment CSV is missing ${header}.`);
    }
  }
  return lines.slice(1).map((line, index) => {
    const cells = line.split(",").map((cell) => cell.trim());
    const status =
      cells[headers.indexOf("status")]?.toLowerCase() === "traced"
        ? "traced"
        : "missing";
    return {
      id: `csv-${index}-${Date.now()}`,
      source: cells[headers.indexOf("source")] ?? `SHIP-${index + 1}`,
      distributor: cells[headers.indexOf("distributor")] ?? "",
      region: cells[headers.indexOf("region")] ?? "Regional",
      customers: String(numeric(cells[headers.indexOf("customers")] ?? "1")),
      units: String(numeric(cells[headers.indexOf("units")] ?? "1")),
      status,
    };
  });
}

function parseComplaint(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const first = lines[0] ?? "";
  const parts = first.split("|").map((part) => part.trim());
  const parsed: Record<string, string> = { complaintId: parts[0] };
  for (const part of parts.slice(1)) {
    const [key, ...rest] = part.split(":");
    if (key && rest.length) {
      parsed[key.trim().toLowerCase()] = rest.join(":").trim();
    }
  }
  for (const line of lines) {
    const [key, ...rest] = line.split(":");
    if (!key || rest.length === 0) {
      continue;
    }
    const normalizedKey = key.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (normalizedKey === "complaint id") {
      parsed.complaintId = value;
    } else if (
      normalizedKey === "product" ||
      normalizedKey === "lot" ||
      normalizedKey === "defect" ||
      normalizedKey === "severity"
    ) {
      parsed[normalizedKey] = value;
    }
  }
  return {
    complaintId: parsed.complaintId,
    product: parsed.product,
    lot: parsed.lot,
    defect: parsed.defect,
    severity: parsed.severity,
  };
}

function validateCase({
  product,
  lot,
  defect,
  rows,
}: {
  product: string;
  lot: string;
  defect: string;
  rows: ShipmentRow[];
}) {
  if (!product.trim() || !lot.trim() || !defect.trim()) {
    return "Product, lot, and defect are required.";
  }
  if (rows.length === 0) {
    return "Add at least one shipment row.";
  }
  for (const row of rows) {
    if (!row.source.trim() || !row.distributor.trim() || !row.region.trim()) {
      return "Every shipment row needs source, distributor, and market/country.";
    }
    if (numeric(row.customers) <= 0 || numeric(row.units) <= 0) {
      return "Every shipment row needs positive customers and units.";
    }
  }
  return null;
}

function buildTasks({
  isReady,
  missingRows,
  traceability,
  filings,
  globalChecklist,
}: {
  isReady: boolean;
  missingRows: ShipmentRow[];
  traceability?: Traceability;
  filings: NonNullable<FilingResponse["filing_pack"]>["filings"];
  globalChecklist: ReturnType<typeof buildGlobalChecklist>;
}): Task[] {
  const tasks: Task[] = [];
  if (!isReady) {
    tasks.push({
      title: "Add recovered shipment evidence",
      owner: "Traceability",
      deadline: "Now",
      status: "blocked",
      detail: `${missingRows.length || 1} shipment source(s) are missing; ${(traceability?.untraced_units ?? 0).toLocaleString()} units remain untraced.`,
    });
  }
  tasks.push({
    title: isReady ? "Review recall scope" : "Hold approval",
    owner: "QA / Legal",
    deadline: isReady ? "Today" : "Blocked",
    status: isReady ? "review" : "blocked",
    detail: isReady
      ? "Coverage is complete. Review drafts before named human approval."
      : "Do not approve final action until traceability reaches 100%.",
  });
  for (const filing of filings) {
    tasks.push({
      title: filing.label,
      owner: "Regulatory",
      deadline: filing.deadline_hours ? `${filing.deadline_hours}h` : "Review",
      status: isReady ? "draft" : "blocked",
      detail: filing.required_human_action,
    });
  }
  for (const item of globalChecklist) {
    tasks.push({
      title: `Check ${item.market} route`,
      owner: "Regional lead",
      deadline: item.status === "scope incomplete" ? "Blocked" : "Today",
      status: item.status === "scope incomplete" ? "blocked" : "review",
      detail: item.action,
    });
  }
  tasks.push({
    title: "Prepare customer and distributor communications",
    owner: "Communications",
    deadline: isReady ? "Today" : "Draft only",
    status: "draft",
    detail:
      "Use the generated drafts as review material; do not send until the recall owner approves.",
  });
  return tasks;
}

function buildCustomerNotice({
  product,
  lot,
  defect,
  severity,
  isReady,
}: {
  product: string;
  lot: string;
  defect: string;
  severity: string;
  isReady: boolean;
}) {
  const readiness = isReady
    ? "We have traced the affected shipment scope and are preparing the reviewed recall action."
    : "We are still tracing the affected shipment scope and will update this notice after review.";
  return [
    `Draft customer notice for ${product || "the affected product"} lot ${lot || "unknown"}:`,
    "",
    `We are reviewing a ${severity} safety issue involving ${defect || "a reported defect"}.`,
    readiness,
    "Stop using the affected product until the company confirms the final recall instruction.",
    "Do not discard the product unless instructed; keep proof of purchase and product labels available.",
    "This draft must be reviewed and approved by the responsible recall owner before it is sent.",
  ].join("\n");
}

function buildDistributorHold({
  product,
  lot,
  defect,
  rows,
}: {
  product: string;
  lot: string;
  defect: string;
  rows: ShipmentRow[];
}) {
  const distributors = rows
    .map((row) => `${row.distributor} (${row.region})`)
    .join(", ");
  return [
    `Distributor / warehouse hold instruction`,
    "",
    `Product: ${product}`,
    `Lot: ${lot}`,
    `Issue under review: ${defect}`,
    `Affected distribution desks: ${distributors}`,
    "",
    "Immediately quarantine affected stock, stop outbound shipment, preserve shipment records, and return current on-hand counts to the recall owner. Do not notify customers or regulators from this draft without authorized review.",
  ].join("\n");
}

function buildExecutiveBrief({
  product,
  lot,
  defect,
  severity,
  productCategory,
  result,
  isReady,
}: {
  product: string;
  lot: string;
  defect: string;
  severity: string;
  productCategory: string;
  result: WorkspaceResult | null;
  isReady: boolean;
}) {
  const traceability = result?.evidence.packet.final_traceability;
  return [
    `Executive recall brief`,
    "",
    `Product: ${product}`,
    `Category: ${productCategory}`,
    `Lot: ${lot}`,
    `Severity: ${severity}`,
    `Issue: ${defect}`,
    `Readiness: ${result ? (isReady ? "Ready for human review" : "Blocked - traceability incomplete") : "Not analyzed"}`,
    traceability
      ? `Traceability: ${traceability.coverage_percent}% coverage, ${traceability.untraced_units.toLocaleString()} untraced units, ${traceability.regions} regions.`
      : "Traceability: pending analysis.",
    result
      ? `Source audit hash: ${result.evidence.packet.audit_hash}`
      : "Source audit hash: pending.",
    "",
    "Boundary: This brief supports decision-making. A qualified human recall owner must approve any final recall action, regulator submission, or enterprise-system write.",
  ].join("\n");
}

function buildGlobalChecklist(rows: ShipmentRow[], category: string) {
  const markets = new Map<
    string,
    { authority: string; action: string; status: string }
  >();
  for (const row of rows) {
    const market = classifyMarket(row.region, category);
    markets.set(market.market, {
      authority: market.authority,
      action: market.action,
      status: row.status === "missing" ? "scope incomplete" : "draft review",
    });
  }
  return Array.from(markets.entries()).map(([market, detail]) => ({
    market,
    ...detail,
  }));
}

function classifyMarket(region: string, category: string) {
  const value = region.trim().toLowerCase();
  if (value.startsWith("us") || value.includes("united states")) {
    return {
      market: "United States",
      authority:
        category === "food"
          ? "FDA / USDA route check"
          : category === "vehicle equipment"
            ? "NHTSA route check"
            : "CPSC route check",
      action:
        "Review urgent reporting, stop-sale, customer notice, and distributor hold duties.",
    };
  }
  if (value.startsWith("eu") || value.includes("europe")) {
    return {
      market: "European Union",
      authority: "EU Safety Gate / national market authority",
      action:
        "Prepare rapid-alert facts, responsible-person review, and member-state notice path.",
    };
  }
  if (value.startsWith("uk") || value.includes("united kingdom")) {
    return {
      market: "United Kingdom",
      authority: "OPSS / relevant UK product-safety authority",
      action:
        "Prepare UK product-safety notification and corrective-action summary.",
    };
  }
  if (value.startsWith("ca") || value.includes("canada")) {
    return {
      market: "Canada",
      authority: "Health Canada / CFIA / Transport Canada route check",
      action:
        "Confirm sector route and prepare bilingual customer-notice requirements if needed.",
    };
  }
  if (value.startsWith("au") || value.includes("australia")) {
    return {
      market: "Australia",
      authority: "ACCC Product Safety route check",
      action: "Prepare supplier recall notice, hazard facts, and remedy plan.",
    };
  }
  if (value.startsWith("jp") || value.includes("japan")) {
    return {
      market: "Japan",
      authority: "CAA / MLIT / MHLW route check",
      action:
        "Confirm product category route and prepare local-language corrective action facts.",
    };
  }
  if (value.includes("latam") || value.includes("latin")) {
    return {
      market: "LATAM",
      authority: "Local consumer-protection authority + distributor desk",
      action:
        "Coordinate country-level distributor hold and local notice requirements.",
    };
  }
  if (
    value.includes("mea") ||
    value.includes("middle east") ||
    value.includes("africa")
  ) {
    return {
      market: "MEA",
      authority: "Local product-safety authority + importer/distributor desk",
      action:
        "Coordinate importer hold, warehouse quarantine, and local notice path.",
    };
  }
  return {
    market: region.trim() || "Regional market",
    authority: "Local regulator / distributor route check",
    action:
      "Confirm local reporting duties and prepare distributor-specific hold instructions.",
  };
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

function shortValue(value: string | null) {
  if (!value) {
    return "pending";
  }
  return value.length > 18
    ? `${value.slice(0, 10)}...${value.slice(-8)}`
    : value;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function numeric(value: string) {
  return Math.max(1, Number.parseInt(value, 10) || 1);
}

function buildIncidentReportSections({
  report,
  complaintId,
  product,
  productCategory,
  lot,
  defect,
  severity,
  rows,
  globalChecklist,
  filings,
  regulatorTargets,
  liveEvents,
  sourceHash,
  roomHash,
  filingHash,
  signatureReady,
  signatureMode,
}: IncidentReportContext): IncidentReportSection[] {
  const shipmentSummary =
    rows
      .map(
        (row) =>
          `${row.source || "source"} via ${row.distributor || "distributor"} in ${row.region || "market"}: ${numeric(row.units).toLocaleString()} units ${row.status}`,
      )
      .join("; ") || "No shipment rows were supplied.";
  const marketSummary =
    globalChecklist
      .map((item) => `${item.market}: ${item.authority}`)
      .join("; ") || "No market route was classified.";
  const filingSummary =
    filings.map((filing) => filing.label).join("; ") ||
    "No filing drafts were generated.";
  const runStatus =
    report.decision === "Run failed"
      ? "failed"
      : report.finalCoveragePercent === 100
        ? "complete"
        : "gated";

  return [
    {
      label: "case",
      title: `${product || "Product"} lot ${lot || "unknown"} was opened for review`,
      status: runStatus,
      body: `Complaint ${complaintId.trim() || "unlabeled"} reported a ${severity} ${productCategory} issue: ${defect || "No defect detail provided."} RecallOps treated the run as decision support and kept final recall control with the named human owner.`,
    },
    {
      label: "traceability",
      title: `${report.tracedUnits.toLocaleString()} of ${report.shippedUnits.toLocaleString()} units are traced`,
      status: report.untracedUnits === 0 ? "complete" : "gated",
      body: `Coverage moved from ${report.initialCoveragePercent}% to ${report.finalCoveragePercent}%. The run started with ${report.initialMissingRows} missing row(s). Shipment detail: ${shipmentSummary}.`,
    },
    {
      label: "markets",
      title: `${globalChecklist.length} market route(s) checked`,
      status: globalChecklist.some((item) => item.status === "scope incomplete")
        ? "gated"
        : "review",
      body: marketSummary,
    },
    {
      label: "drafts",
      title: `${report.filingDraftCount} filing draft(s) and ${report.regulatorTargetCount} regulator dry-run target(s) prepared`,
      status: report.filingDraftCount > 0 ? "review" : "gated",
      body: `${filingSummary}. Regulator dispatch stayed in dry-run mode across ${regulatorTargets.length} target(s); nothing was sent outside RecallOps.`,
    },
    {
      label: "room",
      title: `${report.roomMode.replaceAll("_", " ")} room evidence attached`,
      status:
        report.roomParticipants > 0 || liveEvents.length > 0
          ? "complete"
          : "review",
      body: `${report.roomParticipants} participant(s) were recorded and ${liveEvents.length} live event(s) were streamed. Source hash ${shortValue(sourceHash)}, room hash ${shortValue(roomHash)}, filing hash ${shortValue(filingHash)}.`,
    },
    {
      label: "approval",
      title: signatureReady
        ? "Human approval receipt is sealed"
        : "Human approval gate is closed",
      status: signatureReady
        ? "complete"
        : report.finalCoveragePercent === 100
          ? "review"
          : "gated",
      body: `${signatureMode.replaceAll("_", " ")}. ${report.nextAction}`,
    },
  ];
}

function buildDetailedRunReportText(context: IncidentReportContext) {
  const sections = buildIncidentReportSections(context);
  const lines = [
    "RecallOps run report",
    `Timestamp: ${context.report.completedAt}`,
    `Case: ${context.complaintId.trim() || "unlabeled"}`,
    `Product: ${context.product || "unknown"}`,
    `Lot: ${context.lot || "unknown"}`,
    `Category: ${context.productCategory}`,
    `Severity: ${context.severity}`,
    `Issue: ${context.defect || "No defect detail provided."}`,
    `Decision: ${context.report.decision}`,
    "",
    "Plain-English report:",
  ];

  for (const section of sections) {
    lines.push(
      "",
      `${section.label.toUpperCase()}: ${section.title}`,
      `Status: ${section.status}`,
      section.body,
    );
  }

  lines.push(
    "",
    "Shipment ledger:",
    ...context.rows.map(
      (row) =>
        `- ${row.source || "source"} | ${row.distributor || "distributor"} | ${row.region || "market"} | ${numeric(row.customers).toLocaleString()} customer(s) | ${numeric(row.units).toLocaleString()} unit(s) | ${row.status}`,
    ),
    "",
    "Market checklist:",
    ...(context.globalChecklist.length
      ? context.globalChecklist.map(
          (item) =>
            `- ${item.market} | ${item.authority} | ${item.status} | ${item.action}`,
        )
      : ["- No market route was classified."]),
    "",
    "Live execution stream:",
    ...(context.liveEvents.length
      ? context.liveEvents.map(
          (event) =>
            `- ${event.at} | ${event.actor} | ${event.stage} | ${event.status} | ${event.detail}`,
        )
      : ["- No live events were recorded."]),
    "",
    "Proof references:",
    `- Source hash: ${context.sourceHash ?? "pending"}`,
    `- Room hash: ${context.roomHash ?? "pending"}`,
    `- Filing hash: ${context.filingHash ?? "pending"}`,
    `- Signature gate: ${context.signatureReady ? "sealed" : "closed"} (${context.signatureMode.replaceAll("_", " ")})`,
    "",
    "Boundaries:",
    ...context.report.boundaryChecks.map((check) => `- ${check}`),
  );

  return lines.join("\n");
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
