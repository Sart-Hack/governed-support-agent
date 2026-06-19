const REPO_URL = "https://github.com/Sart-Hack/governed-support-agent";
const BOOKING_URL = "https://cal.com/sarthakgupta/30min";

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-8 md:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary">
          Governed Support Ops Agent. A solo AI consulting practice.
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <a
            href={BOOKING_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-text-primary hover:underline"
          >
            Book a call
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="text-text-secondary hover:text-text-primary"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
