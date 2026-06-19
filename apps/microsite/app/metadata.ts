import type { Metadata } from "next";

const description =
  "AI agents your security team will actually approve. For US tech companies past Series A that need agents, not chatbots.";

// The canonical production host (a branded subdomain of the portfolio). Used as
// metadataBase so the file-convention opengraph-image and canonical URLs are
// absolute and on-domain rather than the *.vercel.app project URL. Local dev and
// preview deploys fall back to the Vercel-provided host, then localhost.
const baseUrl =
  process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production"
    ? "https://demo.sarthak-gupta.com"
    : process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000";

export const siteMetadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "Governed Support Ops Agent",
  description,
  openGraph: {
    title: "Governed Support Ops Agent",
    description,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Governed Support Ops Agent",
    description,
  },
};
