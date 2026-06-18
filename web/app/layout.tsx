import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallOps | Run the Recall. Prove the Decision.",
  description:
    "Product-recall command system for source evidence, traceability, human approval, ERP-ready actions, and verifiable audit packets.",
  keywords: [
    "product recall management software",
    "recall command center",
    "lot traceability software",
    "quality management recall workflow",
    "SAP recall management",
    "Oracle SCM recall management",
  ],
  openGraph: {
    title: "RecallOps | Run the Recall. Prove the Decision.",
    description:
      "Coordinate recall evidence, traceability, accountable human approval, ERP-ready actions, and proof in one command room.",
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
