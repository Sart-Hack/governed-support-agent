export type NavItem = {
  label: string;
  href: string;
  // When the visible route differs from the link target (dynamic routes),
  // match the active state against this prefix instead of the exact href.
  activeMatch?: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Demo",
    items: [
      { label: "Overview", href: "/" },
      { label: "Traces", href: "/traces/scenario-1", activeMatch: "/traces" },
      { label: "Refusals", href: "/refusals" },
    ],
  },
  {
    title: "Governance",
    items: [
      { label: "Policies", href: "/policies" },
      { label: "Permissions", href: "/permissions" },
      { label: "Evals", href: "/evals" },
    ],
  },
  {
    title: "Reference",
    items: [
      { label: "Architecture", href: "/architecture" },
      { label: "Clone and run", href: "/run" },
    ],
  },
  {
    title: "Library",
    items: [{ label: "agent-shield", href: "/shield" }],
  },
  {
    title: "Disclosure",
    items: [
      { label: "Trust", href: "/trust" },
      { label: "Tenants", href: "/tenants" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function isActive(pathname: string, item: NavItem): boolean {
  const base = item.activeMatch ?? item.href;
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(`${base}/`);
}
