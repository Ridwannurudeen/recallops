import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallOps | Run the Recall. Prove the Decision.",
  description:
    "Proof-carrying command room for product recalls. Coordinate evidence, traceability, hold recommendations, human approval, ERP-ready actions, and audit receipts.",
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
      "A Band-native recall command room that turns source evidence, hold recommendations, human approval, ERP-ready actions, and receipts into one verifiable decision chain.",
    url: "https://recallops.gudman.xyz",
    siteName: "RecallOps",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("recallops-theme");if(t!=="light"&&t!=="dark"){t="light"}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){document.documentElement.dataset.theme="light";document.documentElement.style.colorScheme="light"}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
