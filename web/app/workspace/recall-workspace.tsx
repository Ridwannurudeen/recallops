"use client";

import { useMemo, useState, type ChangeEvent } from "react";
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
  filing: FilingResponse;
  regulator: RegulatorResponse;
};

type Task = {
  title: string;
  owner: string;
  deadline: string;
  status: TaskStatus;
  detail: string;
};

const initialRows: ShipmentRow[] = [
  {
    id: "row-1",
    source: "SHIP-901",
    distributor: "Northstar",
    region: "US-West",
    customers: "18",
    units: "240",
    status: "traced",
  },
  {
    id: "row-2",
    source: "SHIP-902",
    distributor: "Baltic Retail",
    region: "EU-North",
    customers: "7",
    units: "80",
    status: "missing",
  },
  {
    id: "row-3",
    source: "SHIP-903",
    distributor: "Direct Warehouse",
    region: "US-East",
    customers: "21",
    units: "260",
    status: "traced",
  },
];

export default function RecallWorkspace({ apiBase }: { apiBase: string }) {
  const [complaintId, setComplaintId] = useState("C-901");
  const [product, setProduct] = useState("Harbor Sensor Battery Pack");
  const [productCategory, setProductCategory] = useState("consumer product");
  const [lot, setLot] = useState("LOT-900");
  const [defect, setDefect] = useState("overheating during overnight charge");
  const [severity, setSeverity] = useState("critical");
  const [rows, setRows] = useState<ShipmentRow[]>(initialRows);
  const [result, setResult] = useState<WorkspaceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "case" | "tasks" | "drafts" | "proof"
  >("case");

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
  const tasks = buildTasks({
    isReady,
    missingRows,
    traceability,
    filings: result?.filing.filing_pack?.filings ?? [],
    globalChecklist,
  });
  const urgentTasks = tasks.filter(
    (task) => task.status === "blocked" || task.deadline.includes("24h"),
  );

  async function analyzeCase() {
    const nextError = validateCase({ product, lot, defect, rows });
    if (nextError) {
      setError(nextError);
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);
    setActiveTab("tasks");

    const complaintText = buildComplaintText({
      complaintId,
      product,
      lot,
      defect,
      severity,
    });
    const shipmentCsv = buildShipmentCsv(rows);
    const body = {
      complaint_text: complaintText,
      shipment_csv: shipmentCsv,
      recovered_shipment_csv: shipmentCsv,
    };

    try {
      const evidence = (await postJson(
        `${apiBase}/source-evidence`,
        body,
      )) as EvidenceResponse;
      const filing = (await postJson(
        `${apiBase}/filing-pack`,
        body,
      )) as FilingResponse;
      const regulator = (await postJson(`${apiBase}/regulator-filing`, {
        ...body,
        dry_run: true,
        targets: ["cpsc", "eu", "regional"],
      })) as RegulatorResponse;
      setResult({ evidence, filing, regulator });
    } catch (exc) {
      setError(
        exc instanceof Error
          ? exc.message
          : "Recall analysis could not complete.",
      );
    } finally {
      setBusy(false);
    }
  }

  function updateRow(
    id: string,
    field: keyof Omit<ShipmentRow, "id">,
    value: string,
  ) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function addRow() {
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
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function markAllTraced() {
    setRows((current) => current.map((row) => ({ ...row, status: "traced" })));
  }

  function resetCase() {
    setRows(initialRows);
    setResult(null);
    setError(null);
    setActiveTab("case");
  }

  async function uploadShipmentCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }
    try {
      setRows(parseShipmentCsv(await file.text()));
      setResult(null);
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
      setComplaintId(parsed.complaintId ?? complaintId);
      setProduct(parsed.product ?? product);
      setLot(parsed.lot ?? lot);
      setDefect(parsed.defect ?? defect);
      setSeverity(parsed.severity ?? severity);
      setResult(null);
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
      filingPack: result.filing,
      regulatorDispatch: result.regulator,
      boundaries: [
        "This pack is decision support, not legal advice.",
        "No external regulator submission was sent.",
        "No SAP or Oracle tenant write was performed.",
        "A named human remains responsible for final recall sign-off.",
      ],
    };
    downloadJson(actionPack, `recallops-${lot || "case"}-action-pack.json`);
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
          <p className={styles.kicker}>Live verdict</p>
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
                : "Some shipped units are untraced. Recover shipment evidence before sign-off or external action."
              : "Upload or enter the incident, then run analysis to get the action board."}
          </p>
          <button disabled={busy} onClick={analyzeCase} type="button">
            {busy ? "Building action center..." : "Build action center"}
          </button>
          {error ? <strong>{error}</strong> : null}
          {validationError ? <small>{validationError}</small> : null}
        </article>

        <article className={styles.metricStrip}>
          <div>
            <span>Coverage</span>
            <strong>{traceability?.coverage_percent ?? 0}%</strong>
          </div>
          <div>
            <span>Untraced units</span>
            <strong>
              {(
                traceability?.untraced_units ??
                missingRows.reduce((sum, row) => sum + numeric(row.units), 0)
              ).toLocaleString()}
            </strong>
          </div>
          <div>
            <span>Urgent tasks</span>
            <strong>{urgentTasks.length}</strong>
          </div>
          <div>
            <span>Markets</span>
            <strong>{globalChecklist.length}</strong>
          </div>
        </article>
      </section>

      <nav className={styles.tabs} aria-label="Workspace sections">
        {[
          ["case", "Case intake"],
          ["tasks", "Task board"],
          ["drafts", "Drafts"],
          ["proof", "Proof & exports"],
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
                  onChange={(event) =>
                    setComplaintId(event.currentTarget.value)
                  }
                  value={complaintId}
                />
              </label>
              <label>
                <span>Product</span>
                <input
                  onChange={(event) => setProduct(event.currentTarget.value)}
                  value={product}
                />
              </label>
              <label>
                <span>Lot or batch</span>
                <input
                  onChange={(event) => setLot(event.currentTarget.value)}
                  value={lot}
                />
              </label>
              <label>
                <span>Product category</span>
                <select
                  onChange={(event) =>
                    setProductCategory(event.currentTarget.value)
                  }
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
                  onChange={(event) => setSeverity(event.currentTarget.value)}
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
                  onChange={(event) => setDefect(event.currentTarget.value)}
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
            <div className={styles.exportStack}>
              <button
                disabled={!result}
                onClick={downloadActionPack}
                type="button"
              >
                Download full action pack
              </button>
              <a href="/proof">Open proof explorer</a>
              <a href="/docs">Open API docs</a>
            </div>
            <ul className={styles.boundaryList}>
              <li>No public regulator submission.</li>
              <li>No public SAP or Oracle write.</li>
              <li>Final recall action stays human-owned.</li>
              <li>This is decision support, not legal advice.</li>
            </ul>
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
  const first =
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? "";
  const parts = first.split("|").map((part) => part.trim());
  const parsed: Record<string, string> = { complaintId: parts[0] };
  for (const part of parts.slice(1)) {
    const [key, ...rest] = part.split(":");
    if (key && rest.length) {
      parsed[key.trim().toLowerCase()] = rest.join(":").trim();
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
      title: "Recover missing shipment evidence",
      owner: "Traceability",
      deadline: "Now",
      status: "blocked",
      detail: `${missingRows.length || 1} shipment source(s) are missing; ${(traceability?.untraced_units ?? 0).toLocaleString()} units remain untraced.`,
    });
  }
  tasks.push({
    title: isReady ? "Review recall scope" : "Hold sign-off",
    owner: "QA / Legal",
    deadline: isReady ? "Today" : "Blocked",
    status: isReady ? "review" : "blocked",
    detail: isReady
      ? "Coverage is complete. Review drafts before named human sign-off."
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
