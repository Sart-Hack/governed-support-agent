import { INJECTION_PAYLOAD_PAGE_ID, NOTION_PAGES } from "@gsa/fixtures";
import {
  INJECTION_ASI_ID,
  INJECTION_ASI_NAME,
  detectInjection,
  summarizeInjection,
} from "@sarthak/agent-shield";

// The injection-card facts, computed from the real payload fixture and the real
// agent-shield detector, the same detectInjection the agent runs at triage time
// (apps/agent/src/steps.ts) and the ASI01 eval asserts (apps/agent/src/eval/
// asi-suite.ts). Nothing here is authored: the page id, the matched signatures,
// the score, the ASI mapping, and the quarantine summary all come from the
// engine, the way the refusal scenes come from Cedar. injection-proof.test.ts
// re-runs this and asserts the committed JSON matches, so it cannot drift.

// The detector's default firing threshold (detector.ts). Kept here so the card
// can show score against threshold; the drift test guards score >= threshold.
const DETECTOR_THRESHOLD = 3;

export interface InjectionProof {
  /** The fixture KB page that carries the injection payload (a permitted support-kb page). */
  pageId: string;
  pageTitle: string;
  /** Whether the detector fired on the page body. */
  detected: boolean;
  /** Cumulative signature score, and the threshold it had to clear. */
  score: number;
  threshold: number;
  /** The structural signatures the detector matched, e.g. instruction-override. */
  signatures: string[];
  /** OWASP Agentic mapping, e.g. "ASI01 Agent Goal Hijack". */
  asi: string;
  /** The formatDecision-style quarantine summary the agent surfaces. */
  summary: string;
}

export function getInjectionProof(): InjectionProof {
  const page = NOTION_PAGES.find((p) => p.id === INJECTION_PAYLOAD_PAGE_ID);
  if (!page) {
    throw new Error(`injection payload page ${INJECTION_PAYLOAD_PAGE_ID} not found in fixtures`);
  }
  const scan = detectInjection(page.body);
  const { summary } = summarizeInjection([{ source: page.id, scan }]);
  return {
    pageId: page.id,
    pageTitle: page.title,
    detected: scan.detected,
    score: scan.score,
    threshold: DETECTOR_THRESHOLD,
    signatures: scan.matches.map((m) => m.label),
    asi: `${INJECTION_ASI_ID} ${INJECTION_ASI_NAME}`,
    summary,
  };
}
