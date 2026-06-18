import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallOps | Run the Recall. Prove the Decision.",
  description:
    "Proof-carrying command room for product recalls. Coordinate evidence, traceability, risk vetoes, human approval, ERP-ready actions, and audit receipts.",
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
    title: "RecallOps | Run the Recall. Prove the Decision.",
    description:
      "A Band-native recall command room that turns source evidence, vetoes, approval, ERP-ready actions, and receipts into one verifiable decision chain.",
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
