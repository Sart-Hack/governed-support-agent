import type { Metadata } from "next";

const description =
  "AI agents your security team will actually approve. For US tech companies past Series A that need agents, not chatbots.";

// On Vercel production this resolves to the deployed host so the file-convention
// opengraph-image gets an absolute URL; falls back to localhost for local dev.
const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
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
