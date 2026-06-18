import ProductTabs from "../product-tabs";
import SiteNav from "../site-nav";
import { apiBase, packet } from "../recall-data";

const commandProofs = [
  {
    label: "source",
    headline: "Complaint and shipment data recompute into a source hash.",
    copy: "The cockpit accepts edited incident text and shipment CSV, then rebuilds the traceability packet from those inputs.",
  },
  {
    label: "rules",
    headline: "Coverage gaps become a review gate, not hidden judgment.",
    copy: "Jurisdiction and traceability checks explain why an action is ready, blocked, or waiting on recovered evidence.",
  },
  {
    label: "receipt",
    headline: "Human approval writes a separately verifiable receipt.",
    copy: "The approval API hashes the named decision, basis, source audit hash, and previous receipt reference.",
  },
];

const operatingLayers = [
  {
    layer: "Intake",
    headline: "Open a recall case from source text and CSV rows.",
    copy: "Operators can use the prepared BAT-4421 data or replace it with a new complaint and shipment ledger.",
  },
  {
    layer: "Traceability",
    headline: "Compute coverage before any recall action moves.",
    copy: "Units, regions, customers, recovered sources, and missing rows stay visible in the evidence cockpit.",
  },
  {
    layer: "Human gate",
    headline: "The system recommends; the named operator approves.",
    copy: "Approval receipts are attributable artifacts that can be verified independently from the UI.",
  },
  {
    layer: "Enterprise sync",
    headline: "SAP and Oracle writes stay gated.",
    copy: "Dry-runs are public. Live writes require tenant endpoints, enabled deployment mode, and an admin action key.",
  },
];

const marketSignals = [
  {
    company: "Honeywell",
    product: "TrackWise Recall Management",
    signal:
      "Enterprise buyers expect recall workflows to live near validated quality systems.",
    recallops:
      "RecallOps should operate as an evidence and orchestration layer, not a replacement system of record.",
    href: "https://www.honeywell.com/",
  },
  {
    company: "Oracle",
    product: "SCM and quality records",
    signal:
      "ERP and SCM teams need normalized recall payloads that map to tenant records.",
    recallops:
      "The dry-run payload exposes that mapping before a tenant write is authorized.",
    href: "https://www.oracle.com/scm/",
  },
  {
    company: "MasterControl",
    product: "Quality event management",
    signal:
      "Quality teams buy auditability, attribution, and repeatable controls.",
    recallops:
      "The receipt chain turns the decision path into a portable proof packet.",
    href: "https://www.mastercontrol.com/",
  },
];

const capabilityMatrix = [
  {
    capability: "Editable incident intake",
    incumbent:
      "Usually handled inside QMS, ERP, support, or spreadsheet workflows.",
    recallops:
      "The source cockpit recomputes the case from edited text and CSV inputs.",
  },
  {
    capability: "Decision support",
    incumbent: "Review steps are often buried in meetings and comments.",
    recallops:
      "Risk holds, coverage math, and readiness are surfaced as inspectable state.",
  },
  {
    capability: "ERP action payload",
    incumbent: "Tenant writes require project-specific integration work.",
    recallops:
      "SAP and Oracle payloads can be previewed without external writes.",
  },
];

const buyerOutcomes = [
  {
    team: "Quality",
    outcome: "A named human remains accountable for the final action.",
    proof:
      "Approval receipts seal approver, reason, source hash, and receipt hash.",
  },
  {
    team: "Operations",
    outcome: "Shipment gaps become visible before notices are sent.",
    proof:
      "Traceability coverage, recovered rows, and missing sources are recomputed from source data.",
  },
  {
    team: "IT",
    outcome: "Enterprise writes can be reviewed before any tenant change.",
    proof:
      "Dry-run payloads are available publicly; live mode needs explicit server-side authorization.",
  },
];

const deploymentPath = [
  {
    phase: "01",
    title: "Sandbox case review",
    copy: "Use the console with demo inputs, edited shipment rows, and dry-run ERP payloads.",
  },
  {
    phase: "02",
    title: "Identity and tenant binding",
    copy: "Connect OIDC/JWKS approval identity and tenant-specific SAP or Oracle endpoints.",
  },
  {
    phase: "03",
    title: "Controlled live write",
    copy: "Enable live writes only after tenant authorization, admin key configuration, and validation sign-off.",
  },
];

export default function ConsolePage() {
  return (
    <main className="command-shell">
      <SiteNav active="console" />

      <section className="page-hero compact-page-hero">
        <div>
          <p className="section-kicker">Interactive console</p>
          <h1>Try a recall case against the live engine.</h1>
          <p>
            Edit source evidence, recompute traceability, create a case, inspect
            proof artifacts, and prepare enterprise dry-runs from one operator
            surface.
          </p>
        </div>
      </section>

      <ProductTabs
        apiBase={apiBase}
        packet={packet}
        marketSignals={marketSignals}
        capabilityMatrix={capabilityMatrix}
        operatingLayers={operatingLayers}
        commandProofs={commandProofs}
        buyerOutcomes={buyerOutcomes}
        deploymentPath={deploymentPath}
      />
    </main>
  );
}
