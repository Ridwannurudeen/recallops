import packetJson from "../public/demo-packet.json";

export type Agent = {
  id: string;
  name: string;
  handle: string;
  framework: string;
  role: string;
};

export type EventStage =
  | "room_created"
  | "evidence_extracted"
  | "agent_recruited"
  | "traceability_gap"
  | "regulatory_veto"
  | "traceability_resolved"
  | "risk_approved"
  | "notice_drafted"
  | "human_approved";

export type RecallEvent = {
  id: string;
  at: string;
  stage: EventStage;
  agent: string;
  message: string;
  mentions: string[];
  metadata: Record<string, string | number | boolean>;
};

export type Shipment = {
  distributor: string;
  region: string;
  customers: number;
  units: number;
  traced: boolean;
};

export type Traceability = {
  total_units: number;
  open_stock_units: number;
  shipped_units: number;
  traced_units: number;
  untraced_units: number;
  coverage_percent: number;
  regions: number;
  affected_customers: number;
};

export type BandStageEvidence = {
  stage: string;
  label: string;
  band_message_id: string;
  proves: string;
};

export type CapturedBandRun = {
  proof_mode: string;
  captured_at: string;
  room_id: string;
  participant_count: number;
  context_items: number;
  commander_event_id: string;
  commander_message_id: string;
  evidence_ack_id: string;
  traceability_gap_id: string;
  risk_veto_id: string;
  traceability_resolved_id: string;
  risk_approved_id: string;
  communications_notice_id: string;
  stage_evidence: BandStageEvidence[];
};

export type Packet = {
  room_id: string;
  incident_id: string;
  product: string;
  lot: string;
  defect: string;
  severity: string;
  exposure_clock: {
    label: string;
    units_in_market: number;
    hours_since_first_report: number;
    unit_hours: number;
  };
  agents: Agent[];
  shipments: Shipment[];
  initial_traceability: Traceability;
  final_traceability: Traceability;
  events: RecallEvent[];
  decision: {
    status: string;
    action: string;
    risk_level: string;
    human_approved: boolean;
    reason: string;
  };
  notices: Record<string, string>;
  band_proof: {
    proof_mode: string;
    packet_room_id: string;
    packet_room_type: string;
    participant_count: number;
    event_count: number;
    message_ids: string[];
    veto_message_id: string;
    approval_message_id: string;
    captured_band_run: CapturedBandRun;
  };
  receipts: {
    id: string;
    event_id: string;
    agent: string;
    check: string;
    status: "recorded" | "blocked" | "cleared" | "sealed";
    band_reference: string;
    previous_hash: string;
    receipt_hash: string;
  }[];
  decision_graph: {
    nodes: {
      id: string;
      label: string;
      owner: string;
      state: string;
    }[];
    edges: {
      source: string;
      target: string;
      label: string;
      band_message_id: string;
    }[];
  };
  audit_hash: string;
};

export type ProofStatus =
  | "LIVE"
  | "CAPTURED"
  | "DETERMINISTIC"
  | "DRY RUN"
  | "GATED"
  | "SIMULATED";

export const packet = packetJson as unknown as Packet;

export const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export const proofStatusDefinitions: {
  status: ProofStatus;
  meaning: string;
}[] = [
  {
    status: "LIVE",
    meaning: "Created against the currently deployed external service.",
  },
  {
    status: "CAPTURED",
    meaning: "Recorded from an earlier real external interaction.",
  },
  {
    status: "DETERMINISTIC",
    meaning: "Reproduced locally from sealed demo data.",
  },
  {
    status: "DRY RUN",
    meaning: "Payload generated but not written to a tenant.",
  },
  {
    status: "GATED",
    meaning: "Action requires authenticated human or admin authorization.",
  },
  {
    status: "SIMULATED",
    meaning: "Demonstration-only behavior.",
  },
];

export const roomResponsibilities = [
  {
    role: "Commander",
    authority: "Routes work",
    assignment:
      "Owns case state, recruits specialists, and publishes the plan.",
  },
  {
    role: "Evidence",
    authority: "Cites sources",
    assignment: "Extracts product, defect, lot, severity, and cited facts.",
  },
  {
    role: "Traceability",
    authority: "Blocks gaps",
    assignment:
      "Maps shipment, distributor, region, customer, and unit coverage.",
  },
  {
    role: "Regulatory/Risk",
    authority: "Raises hold",
    assignment:
      "Flags traceability, jurisdiction, and evidence gaps before human approval.",
  },
  {
    role: "Communications",
    authority: "Prepares notices",
    assignment: "Drafts regulator, customer, and quarantine communications.",
  },
];

export const accountableHuman = {
  role: "QA Director",
  authority: "Can approve",
  assignment: "Authorizes recall scope, ERP hold, and the final receipt.",
};

export const authorityModel = [
  ...roomResponsibilities,
  {
    ...accountableHuman,
    authority: "Accountable human",
  },
];

export const fragmentedSurfaces = [
  "Inbox",
  "Spreadsheet",
  "Meeting",
  "ERP",
  "Approval email",
];

export const proofExplorerSections = [
  "Band room",
  "Source packet",
  "Recall room run",
  "Filing pack",
  "Regulator dispatch",
  "Decision events",
  "Hold and human approval",
  "Human e-signature",
  "Notices",
  "Identity gate",
  "SAP and Oracle contracts",
  "Provider receipts",
  "Spend controls",
  "Final SHA-256 digest",
];

export const integrationClaims: {
  name: string;
  status: ProofStatus;
  headline: string;
  detail: string;
}[] = [
  {
    name: "Band",
    status: "CAPTURED",
    headline: "Five-agent Band room proof is captured and labeled.",
    detail:
      "The deterministic BAT-4421 packet references captured room, participant, handoff, hold, and notice IDs without presenting them as a new provider run.",
  },
  {
    name: "SAP",
    status: "LIVE",
    headline: "SAP API Hub sandbox read is verified.",
    detail:
      "The public proof endpoint checks the deployed sandbox path without claiming a customer tenant write.",
  },
  {
    name: "Oracle",
    status: "DRY RUN",
    headline: "Oracle recall-hold payload is generated from the same action.",
    detail:
      "The site shows the normalized contract and keeps live tenant writes behind authorization.",
  },
  {
    name: "ERP receiver",
    status: "LIVE",
    headline: "Transport contract receipts are verified.",
    detail:
      "RecallOps records redacted SAP and Oracle receiver receipts, separate from customer tenant authorization.",
  },
  {
    name: "Regulator filing",
    status: "DRY RUN",
    headline:
      "Multi-jurisdiction filing packets are prepared from source evidence.",
    detail:
      "CPSC, EU Safety Gate, and regional authority payloads are generated from the same source packet while live external submission stays gated.",
  },
  {
    name: "Human e-signature",
    status: "GATED",
    headline: "Approval receipts bind the named signer to source hashes.",
    detail:
      "The e-signature endpoint requires a verified approval key and seals source evidence, room run, filing pack, signature meaning, and signer identity.",
  },
  {
    name: "Tenant write",
    status: "GATED",
    headline: "Administrative authorization is required.",
    detail:
      "Live writes stay disabled unless a real tenant endpoint and admin key are configured.",
  },
  {
    name: "Partner AI",
    status: "GATED",
    headline: "Provider calls are ready behind spend controls.",
    detail:
      "AI/ML API and Featherless are invoked explicitly; the proof bundle discloses used count, response hashes, and cooldown state.",
  },
];

export const docsEndpoints = [
  {
    method: "GET",
    path: "/api/submission-proof",
    purpose: "Full human and machine-readable proof bundle.",
  },
  {
    method: "GET",
    path: "/api/band-proof",
    purpose: "Captured Band room IDs, stage evidence, and disclosure.",
  },
  {
    method: "GET",
    path: "/api/source-evidence",
    purpose: "Complaint, shipment, recovered shipment, citations, and digests.",
  },
  {
    method: "POST",
    path: "/api/source-evidence",
    purpose: "Recompute the source packet and optionally run partner AI.",
  },
  {
    method: "GET",
    path: "/api/partner-ai/status",
    purpose: "Configured AI/ML API and Featherless provider readiness.",
  },
  {
    method: "GET",
    path: "/api/spend-limits",
    purpose: "Cooldown, daily limit, lock, and latest partner-AI run status.",
  },
  {
    method: "GET",
    path: "/api/recall-room/run",
    purpose: "Default source-packet-to-room run with Band proof binding.",
  },
  {
    method: "POST",
    path: "/api/recall-room/run",
    purpose:
      "Run a recall room from edited evidence and optional provider Band binding.",
  },
  {
    method: "GET",
    path: "/api/filing-pack",
    purpose: "Default multi-jurisdiction recall filing pack.",
  },
  {
    method: "POST",
    path: "/api/filing-pack",
    purpose: "Draft filing pack from edited complaint and shipment evidence.",
  },
  {
    method: "GET",
    path: "/api/regulator-filing/status",
    purpose: "Regulator filing gate, endpoint, and authorization status.",
  },
  {
    method: "POST",
    path: "/api/regulator-filing",
    purpose:
      "Prepare multi-jurisdiction filing dispatches; live submission requires admin authorization.",
  },
  {
    method: "POST",
    path: "/api/esignature-approval",
    purpose:
      "Create a verified human approval receipt over source, room, and filing hashes.",
  },
  {
    method: "GET",
    path: "/api/enterprise-sync",
    purpose:
      "SAP and Oracle dry-run payloads from the normalized recall action.",
  },
  {
    method: "POST",
    path: "/api/enterprise-sync",
    purpose: "Write-gated enterprise sync with admin authorization.",
  },
  {
    method: "GET",
    path: "/api/sap-api-hub",
    purpose: "Live SAP API Hub sandbox verification.",
  },
  {
    method: "GET",
    path: "/api/erp-contract/receipts",
    purpose: "Redacted transport receiver receipts.",
  },
  {
    method: "GET",
    path: "/api/verify",
    purpose: "Digest verification for the deterministic packet.",
  },
];

export function shortHash(value: string, size = 12) {
  if (value.length <= size * 2) {
    return value;
  }
  return `${value.slice(0, size)}...${value.slice(-size)}`;
}
