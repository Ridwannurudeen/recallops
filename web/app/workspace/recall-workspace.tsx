"use client";

import { useMemo, useState } from "react";
import styles from "./recall-workspace.module.css";

type ShipmentStatus = "traced" | "missing";

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

  const validationError = useMemo(
    () => validateCase({ product, lot, defect, rows }),
    [product, lot, defect, rows],
  );

  const traceability = result?.evidence.packet.final_traceability;
  const isReady = Boolean(
    traceability && traceability.coverage_percent === 100,
  );
  const missingRows = rows.filter((row) => row.status === "missing");
  const nextActions = buildNextActions({
    isReady,
    missingRows,
    traceability,
    hasResult: result !== null,
  });
  const globalChecklist = buildGlobalChecklist(rows, productCategory);
  const customerNotice = buildCustomerNotice({
    product,
    lot,
    defect,
    severity,
    isReady,
  });

  async function analyzeCase() {
    const nextError = validateCase({ product, lot, defect, rows });
    if (nextError) {
      setError(nextError);
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

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

  function markAllTraced() {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        status: "traced",
      })),
    );
  }

  function resetCase() {
    setRows(initialRows);
    setResult(null);
    setError(null);
  }

  function downloadBrief() {
    if (!result) {
      return;
    }
    const brief = {
      proof_kind: "recallops_external_user_case_brief",
      generated_at: new Date().toISOString(),
      input: {
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
        : "not_ready_missing_traceability",
      next_actions: nextActions,
      evidence: result.evidence,
      filing_pack: result.filing,
      regulator_dispatch: result.regulator,
      boundaries: [
        "RecallOps does not submit to regulators from the public workspace.",
        "RecallOps does not write to SAP or Oracle from the public workspace.",
        "A named human remains responsible for final recall sign-off.",
      ],
    };
    const blob = new Blob([JSON.stringify(brief, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `recallops-${lot || "case"}-brief.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  async function copyNotice() {
    await navigator.clipboard.writeText(customerNotice);
    setCopiedNotice(true);
    window.setTimeout(() => setCopiedNotice(false), 1800);
  }

  return (
    <section className={styles.workspace}>
      <div className={styles.inputPanel}>
        <article className={styles.card}>
          <p className={styles.kicker}>1. Describe the incident</p>
          <div className={styles.fieldGrid}>
            <label>
              <span>Complaint ID</span>
              <input
                onChange={(event) => setComplaintId(event.currentTarget.value)}
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
              <p className={styles.kicker}>2. Enter shipment rows</p>
              <h2>Mark each row traced or missing.</h2>
            </div>
            <div className={styles.smallActions}>
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

          <div className={styles.shipmentTable}>
            <div className={styles.tableHeader}>
              <span>source</span>
              <span>distributor</span>
              <span>market / country</span>
              <span>customers</span>
              <span>units</span>
              <span>status</span>
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
              </div>
            ))}
          </div>
        </article>
      </div>

      <aside className={styles.actionPanel}>
        <article className={styles.statusCard} data-ready={isReady}>
          <p className={styles.kicker}>3. Run recall analysis</p>
          <h2>
            {result
              ? isReady
                ? "Ready for human review"
                : "Not ready: traceability gap"
              : "No analysis yet"}
          </h2>
          <p>
            {result
              ? isReady
                ? "All shipped units are traced. Review the generated drafts before a named human signs off."
                : "Some shipped units are still missing. Recover the shipment source before sign-off."
              : "Run analysis to calculate coverage, prepare drafts, and get next actions."}
          </p>
          <button disabled={busy} onClick={analyzeCase} type="button">
            {busy ? "Analyzing..." : "Analyze recall risk"}
          </button>
          {validationError ? <small>{validationError}</small> : null}
          {error ? <strong className={styles.error}>{error}</strong> : null}
        </article>

        <article className={styles.card}>
          <p className={styles.kicker}>What to do today</p>
          <ol className={styles.actionList}>
            {nextActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ol>
        </article>

        <article className={styles.card}>
          <p className={styles.kicker}>Boundaries</p>
          <ul className={styles.boundaryList}>
            <li>No public regulator submission.</li>
            <li>No public SAP or Oracle write.</li>
            <li>Final recall action stays human-owned.</li>
          </ul>
        </article>
      </aside>

      {result ? (
        <section className={styles.resultsPanel}>
          <article className={styles.metricCard}>
            <span>coverage</span>
            <strong>{traceability?.coverage_percent ?? 0}%</strong>
            <p>
              {(traceability?.untraced_units ?? 0).toLocaleString()} untraced
              units
            </p>
          </article>
          <article className={styles.metricCard}>
            <span>market exposure</span>
            <strong>
              {(traceability?.shipped_units ?? 0).toLocaleString()} units
            </strong>
            <p>{traceability?.regions ?? 0} regions affected</p>
          </article>
          <article className={styles.metricCard}>
            <span>case</span>
            <strong>{result.evidence.packet.incident_id}</strong>
            <p>{shortHash(result.evidence.packet.audit_hash)}</p>
          </article>
          <article className={styles.metricCard}>
            <span>customer reach</span>
            <strong>
              {(traceability?.affected_customers ?? 0).toLocaleString()}
            </strong>
            <p>affected customers traced</p>
          </article>

          <article className={styles.documentPanel}>
            <div className={styles.cardHead}>
              <div>
                <p className={styles.kicker}>Global market checklist</p>
                <h2>Which authorities may care?</h2>
              </div>
            </div>
            <div className={styles.documentGrid}>
              {globalChecklist.map((item) => (
                <article key={`${item.market}-${item.authority}`}>
                  <span>{item.market}</span>
                  <strong>{item.authority}</strong>
                  <p>{item.action}</p>
                  <code>{item.status}</code>
                </article>
              ))}
            </div>
            <p className={styles.disclaimer}>
              This is decision support, not legal advice. Confirm filing duties
              with qualified counsel or the responsible product-safety owner.
            </p>
          </article>

          <article className={styles.documentPanel}>
            <div className={styles.cardHead}>
              <div>
                <p className={styles.kicker}>Customer notice draft</p>
                <h2>Plain-language notice to review.</h2>
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

          <article className={styles.documentPanel}>
            <div className={styles.cardHead}>
              <div>
                <p className={styles.kicker}>Prepared drafts</p>
                <h2>Ready for human review.</h2>
              </div>
              <button onClick={downloadBrief} type="button">
                Download case brief
              </button>
            </div>
            <div className={styles.documentGrid}>
              {(result.filing.filing_pack?.filings ?? [])
                .slice(0, 5)
                .map((filing) => (
                  <article key={filing.id}>
                    <span>{filing.authority}</span>
                    <strong>{filing.label}</strong>
                    <p>{filing.required_human_action}</p>
                    <code>{filing.status}</code>
                  </article>
                ))}
            </div>
          </article>

          <article className={styles.documentPanel}>
            <p className={styles.kicker}>Regulator dispatch preview</p>
            <div className={styles.documentGrid}>
              {(result.regulator.regulator_dispatch?.targets ?? []).map(
                (target) => (
                  <article key={target.id}>
                    <span>{target.id}</span>
                    <strong>{target.status}</strong>
                    <p>{target.label}</p>
                    <code>
                      {target.external_submit
                        ? "external submit"
                        : "dry-run only"}
                    </code>
                  </article>
                ),
              )}
            </div>
          </article>
        </section>
      ) : null}
    </section>
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
      Math.max(1, Number.parseInt(row.customers, 10) || 1),
      Math.max(1, Number.parseInt(row.units, 10) || 1),
      row.status,
    ].join(","),
  );
  return [header, ...body].join("\n");
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
      return "Every shipment row needs source, distributor, and region.";
    }
    if (
      (Number.parseInt(row.customers, 10) || 0) <= 0 ||
      (Number.parseInt(row.units, 10) || 0) <= 0
    ) {
      return "Every shipment row needs positive customers and units.";
    }
  }
  return null;
}

function buildNextActions({
  isReady,
  missingRows,
  traceability,
  hasResult,
}: {
  isReady: boolean;
  missingRows: ShipmentRow[];
  traceability?: Traceability;
  hasResult: boolean;
}) {
  if (!hasResult) {
    return [
      "Enter the incident details.",
      "Mark each shipment row as traced or missing.",
      "Run analysis to see whether human sign-off is safe.",
    ];
  }

  if (!isReady) {
    const missingNames = missingRows
      .map((row) => row.distributor || row.source)
      .join(", ");
    return [
      `Recover missing shipment evidence for ${missingNames || "untraced rows"}.`,
      `Do not seal human sign-off while ${(traceability?.untraced_units ?? 0).toLocaleString()} units are untraced.`,
      "Keep regulator dispatch as draft-only until coverage reaches 100%.",
      "Quarantine known stock while traceability is being completed.",
    ];
  }

  return [
    "Review the prepared regulator and distributor drafts.",
    "Confirm the scope with the accountable QA or legal owner.",
    "Use authorized systems for any real regulator submission or SAP/Oracle write.",
    "Download the case brief for audit and handoff.",
  ];
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

function shortHash(value: string) {
  return value.length > 22
    ? `${value.slice(0, 12)}...${value.slice(-8)}`
    : value;
}
