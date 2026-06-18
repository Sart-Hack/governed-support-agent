# InjecAgent subset

The Python sidecar of the public eval suite. It measures how the Governed Support
Ops Agent resists indirect prompt-injection attacks from the **InjecAgent**
benchmark.

## What it measures

InjecAgent injects an attacker instruction into tool output and checks whether the
agent *executes* it. This runner measures the same outcome for this agent's
defense-in-depth. An attack is **prevented** when either:

1. **Injection detector** — `detectInjection` (agent-shield) flags the injected
   tool output, so it is quarantined before the planner sees it. Run through the
   real TypeScript implementation via the `injection-scan` bridge, so there is no
   Python reimplementation to drift from the agent's actual defense.
2. **Least privilege** — the attacker's tool is outside the agent's permitted
   action set (Cedar policies 01–04, 08), so a default-deny decision blocks the
   action even if the injected instruction reaches the planner.

The runner prints the per-layer breakdown (`byDetector`, `byLeastPrivilege`) so
the headline number is never a black box. Notably the structural detector catches
the framed ("enhanced") attacks but not the bare ("base") ones — least-privilege
is what stops those, which is the honest division of labor between the two layers.

## Data

`cases.sample.json` is a 200-case sample (100 base + 100 enhanced, across direct-
harm and data-stealing attack types) vendored from the InjecAgent dataset:

> InjecAgent: Benchmarking Indirect Prompt Injections in Tool-Integrated Large
> Language Model Agents. Qiusi Zhan, Zhixiang Liang, Zifan Wang, Yuan Tian, et al.
> https://github.com/uiuc-kang-lab/InjecAgent — MIT License.

Each case keeps only the fields this runner needs: `id`, `setting` (base or
enhanced), `attack_type`, `attacker_tools`, and `tool_response` (the injected
output the agent would receive).

## Run

```bash
uv run python runner.py        # or: python3 runner.py
```

It writes `evals/results/injecagent.json`, which `pnpm eval` merges into
`evals/results/latest.json` for the microsite `/evals` page.
