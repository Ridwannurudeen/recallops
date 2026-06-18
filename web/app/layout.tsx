import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallOps | Verifiable Product Recall Command Center",
  description:
    "Verifiable product recall command center for SAP, Oracle SCM, QMS, support, and regulatory teams. Coordinate traceability, risk vetoes, approvals, ERP holds, notifications, and audit receipts.",
  keywords: [
    "product recall management software",
    "AI recall management",
    "SAP recall management",
    "Oracle SCM recall management",
    "recall command center",
    "lot traceability software",
    "quality management recall workflow",
  ],
  openGraph: {
    title: "RecallOps | Verifiable Product Recall Command Center",
    description:
      "A recall command layer that coordinates agents, SAP/Oracle adapters, human approvals, and hash-linked proof receipts.",
    url: "https://recallops.gudman.xyz",
    siteName: "RecallOps",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
