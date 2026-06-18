import ThemeToggle from "./theme-toggle";

type SiteNavProps = {
  active?:
    | "product"
    | "console"
    | "demo"
    | "proof"
    | "integrations"
    | "security";
};

const navItems = [
  { id: "product", label: "Product", href: "/" },
  { id: "console", label: "Console", href: "/console" },
  { id: "demo", label: "Demo", href: "/demo/bat-4421" },
  { id: "proof", label: "Proof", href: "/proof" },
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
        <a className="judge-link" href="/judge-mode">
          Open Judge Mode
        </a>
      </div>
    </header>
  );
}
