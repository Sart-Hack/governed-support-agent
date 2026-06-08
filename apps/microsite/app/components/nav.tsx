"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS, isActive } from "../lib/nav";

const REPO_URL = "https://github.com/Sart-Hack/governed-support-agent";

export function Nav() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-base md:flex">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-6 w-6 place-items-center rounded border border-border bg-card font-mono text-[11px] text-text-secondary">
          gsa
        </span>
        <span className="font-mono text-xs leading-tight text-text-primary">
          Governed
          <br />
          Support Ops
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="px-2 pb-1.5 font-mono text-[10px] uppercase tracking-widest text-text-secondary/70">
              {section.title}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-card text-text-primary"
                          : "text-text-secondary hover:bg-card/60 hover:text-text-primary"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        className="border-t border-border px-5 py-3 font-mono text-[11px] text-text-secondary transition-colors hover:text-text-primary"
      >
        Sart-Hack/governed-support-agent
      </a>
    </aside>
  );
}
