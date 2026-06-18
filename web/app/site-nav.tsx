import ThemeToggle from "./theme-toggle";

type SiteNavProps = {
  active?:
    | "product"
    | "app"
    | "demo"
    | "proof"
    | "trust"
    | "integrations"
    | "security"
    | "docs";
};

const navItems = [
  { id: "product", label: "Product", href: "/" },
  { id: "demo", label: "Demo", href: "/demo/bat-4421" },
  { id: "proof", label: "Proof", href: "/proof" },
  { id: "integrations", label: "Integrations", href: "/integrations" },
  { id: "trust", label: "Trust", href: "/trust" },
] as const;

export default function SiteNav({ active }: SiteNavProps) {
  return (
    <header className="site-nav clean-site-nav">
      <a className="site-mark" href="/" aria-label="RecallOps home">
        <strong>RecallOps</strong>
        <span>recall command system</span>
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
        <a className="judge-link" href="/app">
          Open command room
        </a>
      </div>
    </header>
  );
}
