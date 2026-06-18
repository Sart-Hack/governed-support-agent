/**
 * Prompt-injection detector for UNTRUSTED retrieved content - KB pages, tool
 * results, scraped docs - scanned before it reaches a planner LLM.
 *
 * The defensible design is the data-vs-instructions boundary: content the agent
 * retrieves is DATA and must never be executed as INSTRUCTIONS. This scans for
 * the structural signatures of injected directives (instruction-override
 * phrasing, control-bypass, false authority, mass-action commands) generically
 * - it does not match any specific known payload.
 *
 * Maps to OWASP Agentic Top 10 ASI01 (Agent Goal Hijack).
 */

export const INJECTION_ASI_ID = "ASI01";
export const INJECTION_ASI_NAME = "Agent Goal Hijack";

export interface InjectionPattern {
  /** Stable id for the signature. */
  id: string;
  /** Human-readable category surfaced in the decision summary. */
  label: string;
  /** Contribution to the detection score. 3 = strong (sufficient alone). */
  weight: number;
  pattern: RegExp;
}

export interface InjectionMatch {
  patternId: string;
  label: string;
  /** The offending substring, whitespace-collapsed and clipped. */
  snippet: string;
}

export interface InjectionScan {
  detected: boolean;
  score: number;
  matches: InjectionMatch[];
  asiId: string;
}

// Each signature targets the STRUCTURE of an injected instruction, not a
// payload string. Order is irrelevant; every pattern is tested independently.
const PATTERNS: InjectionPattern[] = [
  {
    id: "override-instructions",
    label: "instruction-override",
    weight: 3,
    pattern:
      /\b(ignore|disregard|forget|override)\b[\s\S]{0,40}?\b(previous|prior|earlier|above|all|any)\b[\s\S]{0,30}?\b(instructions?|prompts?|directions?|rules?|context|messages?)\b/i,
  },
  {
    id: "approval-bypass",
    label: "control-bypass",
    weight: 3,
    pattern:
      /\b(skip|bypass|ignore|without|no need for|don'?t (?:wait for|require|need))\b[\s\S]{0,25}?\bapprovals?\b/i,
  },
  {
    id: "authority-escalation",
    label: "false-authority",
    weight: 2,
    pattern:
      /\b(system|admin|administrator|developer|root)[-\s]?level\b|\bthis is an? (?:system|admin|developer)[-\s]?(?:level\s)?(?:instruction|requirement|message|rule|command|directive)\b/i,
  },
  {
    id: "mass-action",
    label: "mass-action-directive",
    weight: 2,
    pattern:
      /\b(resolve|close|delete|email|send|reply|contact|notify)\b[\s\S]{0,30}?\b(every|all|each)\b[\s\S]{0,25}?\b(tickets?|customers?|requesters?|users?|accounts?|records?|contacts?)\b/i,
  },
  {
    id: "covert-directive",
    label: "covert-instruction",
    weight: 2,
    pattern:
      /\b(do not|don'?t|never)\b[\s\S]{0,20}?\b(tell|inform|notify|mention|disclose|reveal|log)\b/i,
  },
];

/** Detection fires when the cumulative signature score reaches the threshold. */
const DEFAULT_THRESHOLD = 3;

/**
 * Scan a single piece of untrusted content for instruction-injection signatures.
 * Returns the matched signatures, a score, and whether detection fired.
 */
export function detectInjection(content: string, threshold = DEFAULT_THRESHOLD): InjectionScan {
  const text = typeof content === "string" ? content : "";
  const matches: InjectionMatch[] = [];
  let score = 0;
  for (const p of PATTERNS) {
    const m = p.pattern.exec(text);
    if (m) {
      score += p.weight;
      matches.push({ patternId: p.id, label: p.label, snippet: clip(m[0]) });
    }
  }
  return { detected: score >= threshold, score, matches, asiId: INJECTION_ASI_ID };
}

export interface ScannedSource {
  /** Where the content came from, e.g. a KB page id. */
  source: string;
  scan: InjectionScan;
}

export interface InjectionSummary {
  summary: string;
  asiIds: string[];
}

/**
 * Render a human-readable decision over one or more scanned sources, in the
 * same shape `formatDecision` produces for Cedar denials so callers can surface
 * it through the existing outcome/audit path.
 */
export function summarizeInjection(sources: ScannedSource[]): InjectionSummary {
  const flagged = sources.filter((s) => s.scan.detected);
  if (flagged.length === 0) {
    return { summary: "No prompt-injection detected in retrieved content.", asiIds: [] };
  }
  const ids = flagged.map((s) => s.source).join(", ");
  const labels = Array.from(new Set(flagged.flatMap((s) => s.scan.matches.map((m) => m.label))));
  return {
    summary: `Quarantined: prompt-injection detected in retrieved content ${ids} - ${labels.join(
      " + ",
    )} (${INJECTION_ASI_ID} ${INJECTION_ASI_NAME}). Injected instructions were not executed.`,
    asiIds: [INJECTION_ASI_ID],
  };
}

function clip(s: string, max = 80): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
