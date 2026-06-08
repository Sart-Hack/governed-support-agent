import type { ReactNode } from "react";

// Standard page container + header. Every page below the shell uses this so the
// gutter, max width, and title treatment stay consistent across the microsite.
export function PageShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:px-10 md:py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">{eyebrow}</p>
      <h1 className="mt-4 text-balance text-3xl font-semibold leading-tight md:text-4xl">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-text-secondary">{intro}</p>
      {children ? <div className="mt-10">{children}</div> : null}
    </div>
  );
}
