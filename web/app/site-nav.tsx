import ThemeToggle from "./theme-toggle";

type SiteNavProps = {
  active?:
    | "product"
    | "workspace"
    | "console"
    | "judge"
    | "demo"
    | "proof"
    | "submission"
    | "integrations"
    | "security";
};

const navItems = [
  { id: "product", label: "Product", href: "/" },
  { id: "workspace", label: "Workspace", href: "/workspace" },
  { id: "judge", label: "Judge Demo", href: "/demo/judge" },
  { id: "console", label: "Try Live", href: "/console" },
  { id: "demo", label: "Replay + Live", href: "/demo/bat-4421" },
  { id: "proof", label: "Proof", href: "/proof" },
  { id: "submission", label: "Submission", href: "/submission" },
  { id: "integrations", label: "Integrations", href: "/integrations" },
  { id: "security", label: "Security", href: "/security" },
] as const;

export default function SiteNav({ active }: SiteNavProps) {
  return (
    <header className="site-nav">
      <a className="site-mark" href="/">
        <strong>RecallOps</strong>
        <span>proof-carrying command room</span>
      </a>
      <nav aria-label="Primary navigation">
        {navItems.map((item) => (
          <a
            aria-current={active === item.id ? "page" : undefined}
            href={item.href}
            key={item.id}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="site-actions">
        <ThemeToggle />
        <a className="judge-link" href="/demo/judge">
          Open judge demo
        </a>
      </div>
    </header>
  );
}
