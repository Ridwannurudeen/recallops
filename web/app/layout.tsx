import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallOps | AI Product Recall Management for SAP and Oracle",
  description:
    "AI product recall command center for SAP, Oracle SCM, QMS, and support teams. Coordinate traceability, risk vetoes, human approvals, ERP holds, notifications, and audit receipts.",
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
    title: "RecallOps | AI Product Recall Management for SAP and Oracle",
    description:
      "A verifiable recall command center that coordinates agents, SAP/Oracle adapters, human approvals, and hash-linked audit receipts.",
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
