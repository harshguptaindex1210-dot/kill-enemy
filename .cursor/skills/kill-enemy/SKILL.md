---
name: kill-enemy
description: >-
  Master skill catalog for the Kill Enemy shooter game. Use when starting work
  on this repo — read CONTEXT handoff first, then invoke the right pipeline,
  delivery, debug, or Cursor skill by path.
---

# Kill Enemy — Agent Skill Catalog

This project skill indexes **all skills available on this machine** for working on Kill Enemy. It does not duplicate full skill bodies — read each linked `SKILL.md` when invoked.

## Start here (this repo)

| Resource | Path |
|----------|------|
| Latest handoff | `CONTEXT/handoffs/2026-08-08-session-complete.md` |
| Context map | `CONTEXT/CONTEXT-MAP.md` |
| Architecture | `ARCHITECTURE.md` |
| Live game | https://harshguptaindex1210-dot.github.io/kill-enemy/ |
| Git remote | `https://github.com/harshguptaindex1210-dot/kill-enemy.git` |

### Recommended skills for this game

| Task | Skill | Path |
|------|-------|------|
| Run next ticket end-to-end | `work` | `C:\Users\Harsh\.claude\skills\work\SKILL.md` |
| Plan / grill / tickets | `planner` | `C:\Users\Harsh\.agents\skills\planner\SKILL.md` |
| Implement ticket (TDD) | `coder` | `C:\Users\Harsh\.agents\skills\coder\SKILL.md` |
| Harden / corner cases | `debugger` | `C:\Users\Harsh\.agents\skills\debugger\SKILL.md` |
| Review / gate to Done | `reviewer` | `C:\Users\Harsh\.agents\skills\reviewer\SKILL.md` |
| Commit verified work | `push-handoff` | `C:\Users\Harsh\.claude\skills\push-handoff\SKILL.md` |
| Session handoff doc | `handoff` | `C:\Users\Harsh\.agents\skills\handoff\SKILL.md` |
| Visual polish vs bar | `gauntlet-loop` | `C:\Users\Harsh\.agents\skills\gauntlet-loop\SKILL.md` |
| Mobile / control bugs | `diagnosing-bugs` | `C:\Users\Harsh\.agents\skills\diagnosing-bugs\SKILL.md` |
| GitHub Projects board | `github-projects-pipeline` | `C:\Users\Harsh\.agents\skills\github-projects-pipeline\SKILL.md` |

### Kill Enemy invariants (do not regress)

- Phone: landscape only; touch joystick + look; HEAL button; 5 med-kits; minimap top-right.
- Controls: strafe right = right (`9ced9c8`); look not sticky-inverted (settings v2).
- Bundle gate: raw initial JS ≤ 662000 — headroom is tiny; prefer CSS over new JS strings.
- Pages deploy uses demo online (`LocalServer`), not live Nakama.
- Founder name `HARSH FOUNDERCEO_01` reserved (client-side owner token); no PIN lock.
- Stack is **Three.js** — do not rewrite to custom WebGL.

---

## 1. Cursor built-in skills (on disk)

Managed by Cursor. **Do not edit** `~/.cursor/skills-cursor/`. Cursor may also inject additional built-ins at runtime (e.g. `review-bugbot`, `review-security`, `automate`, `autopilot`, `cursor-guide`) that are not stored locally.

| Skill | Path |
|-------|------|
| `babysit` | `C:\Users\Harsh\.cursor\skills-cursor\babysit\SKILL.md` |
| `canvas` | `C:\Users\Harsh\.cursor\skills-cursor\canvas\SKILL.md` |
| `create-hook` | `C:\Users\Harsh\.cursor\skills-cursor\create-hook\SKILL.md` |
| `create-rule` | `C:\Users\Harsh\.cursor\skills-cursor\create-rule\SKILL.md` |
| `create-skill` | `C:\Users\Harsh\.cursor\skills-cursor\create-skill\SKILL.md` |
| `create-subagent` | `C:\Users\Harsh\.cursor\skills-cursor\create-subagent\SKILL.md` |
| `loop` | `C:\Users\Harsh\.cursor\skills-cursor\loop\SKILL.md` |
| `migrate-to-skills` | `C:\Users\Harsh\.cursor\skills-cursor\migrate-to-skills\SKILL.md` |
| `rename-chat` | `C:\Users\Harsh\.cursor\skills-cursor\rename-chat\SKILL.md` |
| `sdk` | `C:\Users\Harsh\.cursor\skills-cursor\sdk\SKILL.md` |
| `shell` | `C:\Users\Harsh\.cursor\skills-cursor\shell\SKILL.md` |
| `split-to-prs` | `C:\Users\Harsh\.cursor\skills-cursor\split-to-prs\SKILL.md` |
| `statusline` | `C:\Users\Harsh\.cursor\skills-cursor\statusline\SKILL.md` |
| `update-cli-config` | `C:\Users\Harsh\.cursor\skills-cursor\update-cli-config\SKILL.md` |
| `update-cursor-settings` | `C:\Users\Harsh\.cursor\skills-cursor\update-cursor-settings\SKILL.md` |

---

## 2. Cursor personal skills

| Skill | Path |
|-------|------|
| `work` | `C:\Users\Harsh\.cursor\skills\work\SKILL.md` |

---

## 3. Agent skills (`~/.agents/skills/`)

Primary copies used by `/work` pipeline and delivery chains.

### Pipeline & delivery

| Skill | Path |
|-------|------|
| `work` | `C:\Users\Harsh\.agents\skills\work\SKILL.md` |
| `planner` | `C:\Users\Harsh\.agents\skills\planner\SKILL.md` |
| `coder` | `C:\Users\Harsh\.agents\skills\coder\SKILL.md` |
| `debugger` | `C:\Users\Harsh\.agents\skills\debugger\SKILL.md` |
| `reviewer` | `C:\Users\Harsh\.agents\skills\reviewer\SKILL.md` |
| `part1` | `C:\Users\Harsh\.agents\skills\part1\SKILL.md` |
| `part2` | `C:\Users\Harsh\.agents\skills\part2\SKILL.md` |
| `part3` | `C:\Users\Harsh\.agents\skills\part3\SKILL.md` |
| `profile-gated-delivery` | `C:\Users\Harsh\.agents\skills\profile-gated-delivery\SKILL.md` |
| `github-projects-pipeline` | `C:\Users\Harsh\.agents\skills\github-projects-pipeline\SKILL.md` |
| `linear-pipeline` | `C:\Users\Harsh\.agents\skills\linear-pipeline\SKILL.md` |
| `linear-label-pipeline` | `C:\Users\Harsh\.agents\skills\linear-label-pipeline\SKILL.md` |
| `controlled-ticket-delivery` | `C:\Users\Harsh\.agents\skills\controlled-ticket-delivery\SKILL.md` |
| `ticket-implementation-tdd` | `C:\Users\Harsh\.agents\skills\ticket-implementation-tdd\SKILL.md` |
| `push-handoff` | `C:\Users\Harsh\.agents\skills\push-handoff\SKILL.md` |
| `handoff` | `C:\Users\Harsh\.agents\skills\handoff\SKILL.md` |
| `state-driven-pipeline-recovery` | `C:\Users\Harsh\.agents\skills\state-driven-pipeline-recovery\SKILL.md` |

### Quality & review

| Skill | Path |
|-------|------|
| `gauntlet-loop` | `C:\Users\Harsh\.agents\skills\gauntlet-loop\SKILL.md` |
| `code-review` | `C:\Users\Harsh\.agents\skills\code-review\SKILL.md` |
| `codebase-audit` | `C:\Users\Harsh\.agents\skills\codebase-audit\SKILL.md` |
| `invariant-evidence-review` | `C:\Users\Harsh\.agents\skills\invariant-evidence-review\SKILL.md` |
| `qa` | `C:\Users\Harsh\.agents\skills\qa\SKILL.md` |
| `tdd` | `C:\Users\Harsh\.agents\skills\tdd\SKILL.md` |
| `provider-integration-tdd` | `C:\Users\Harsh\.agents\skills\provider-integration-tdd\SKILL.md` |

### Planning & design

| Skill | Path |
|-------|------|
| `wayfinder` | `C:\Users\Harsh\.agents\skills\wayfinder\SKILL.md` |
| `grilling` | `C:\Users\Harsh\.agents\skills\grilling\SKILL.md` |
| `grill-me` | `C:\Users\Harsh\.agents\skills\grill-me\SKILL.md` |
| `batch-grill-me` | `C:\Users\Harsh\.agents\skills\batch-grill-me\SKILL.md` |
| `grill-with-docs` | `C:\Users\Harsh\.agents\skills\grill-with-docs\SKILL.md` |
| `domain-modeling` | `C:\Users\Harsh\.agents\skills\domain-modeling\SKILL.md` |
| `codebase-design` | `C:\Users\Harsh\.agents\skills\codebase-design\SKILL.md` |
| `design-an-interface` | `C:\Users\Harsh\.agents\skills\design-an-interface\SKILL.md` |
| `request-refactor-plan` | `C:\Users\Harsh\.agents\skills\request-refactor-plan\SKILL.md` |
| `to-prd` | `C:\Users\Harsh\.agents\skills\to-prd\SKILL.md` |
| `to-spec` | `C:\Users\Harsh\.agents\skills\to-spec\SKILL.md` |
| `to-tickets` | `C:\Users\Harsh\.agents\skills\to-tickets\SKILL.md` |
| `to-issues` | `C:\Users\Harsh\.agents\skills\to-issues\SKILL.md` |
| `triage` | `C:\Users\Harsh\.agents\skills\triage\SKILL.md` |
| `ubiquitous-language` | `C:\Users\Harsh\.agents\skills\ubiquitous-language\SKILL.md` |

### Implementation & debugging

| Skill | Path |
|-------|------|
| `implement` | `C:\Users\Harsh\.agents\skills\implement\SKILL.md` |
| `prototype` | `C:\Users\Harsh\.agents\skills\prototype\SKILL.md` |
| `diagnosing-bugs` | `C:\Users\Harsh\.agents\skills\diagnosing-bugs\SKILL.md` |
| `research` | `C:\Users\Harsh\.agents\skills\research\SKILL.md` |
| `loop-engineer` | `C:\Users\Harsh\.agents\skills\loop-engineer\SKILL.md` |
| `loop-me` | `C:\Users\Harsh\.agents\skills\loop-me\SKILL.md` |
| `resolving-merge-conflicts` | `C:\Users\Harsh\.agents\skills\resolving-merge-conflicts\SKILL.md` |
| `parallel-subagent-implementation` | `C:\Users\Harsh\.agents\skills\parallel-subagent-implementation\SKILL.md` |
| `subagent-batch-implementation` | `C:\Users\Harsh\.agents\skills\subagent-batch-implementation\SKILL.md` |
| `shared-worktree-delegation` | `C:\Users\Harsh\.agents\skills\shared-worktree-delegation\SKILL.md` |
| `shared-worktree-safety` | `C:\Users\Harsh\.agents\skills\shared-worktree-safety\SKILL.md` |

### Tooling & setup

| Skill | Path |
|-------|------|
| `setup-pre-commit` | `C:\Users\Harsh\.agents\skills\setup-pre-commit\SKILL.md` |
| `setup-vskills` | `C:\Users\Harsh\.agents\skills\setup-vskills\SKILL.md` |
| `setup-ts-deep-modules` | `C:\Users\Harsh\.agents\skills\setup-ts-deep-modules\SKILL.md` |
| `setup-matt-pocock-skills` | `C:\Users\Harsh\.agents\skills\setup-matt-pocock-skills\SKILL.md` |
| `setup-obsidian` | `C:\Users\Harsh\.agents\skills\setup-obsidian\SKILL.md` |
| `git-guardrails-claude-code` | `C:\Users\Harsh\.agents\skills\git-guardrails-claude-code\SKILL.md` |
| `migrate-to-shoehorn` | `C:\Users\Harsh\.agents\skills\migrate-to-shoehorn\SKILL.md` |
| `scaffold-exercises` | `C:\Users\Harsh\.agents\skills\scaffold-exercises\SKILL.md` |
| `find-skills` | `C:\Users\Harsh\.agents\skills\find-skills\SKILL.md` |
| `specialist-profiles` | `C:\Users\Harsh\.agents\skills\specialist-profiles\SKILL.md` |

### Writing & misc

| Skill | Path |
|-------|------|
| `writing-great-skills` | `C:\Users\Harsh\.agents\skills\writing-great-skills\SKILL.md` |
| `writing-shape` | `C:\Users\Harsh\.agents\skills\writing-shape\SKILL.md` |
| `writing-beats` | `C:\Users\Harsh\.agents\skills\writing-beats\SKILL.md` |
| `writing-fragments` | `C:\Users\Harsh\.agents\skills\writing-fragments\SKILL.md` |
| `teach` | `C:\Users\Harsh\.agents\skills\teach\SKILL.md` |
| `edit-article` | `C:\Users\Harsh\.agents\skills\edit-article\SKILL.md` |
| `wizard` | `C:\Users\Harsh\.agents\skills\wizard\SKILL.md` |
| `obsidian-vault` | `C:\Users\Harsh\.agents\skills\obsidian-vault\SKILL.md` |
| `claude-handoff` | `C:\Users\Harsh\.agents\skills\claude-handoff\SKILL.md` |
| `ask-matt` | `C:\Users\Harsh\.agents\skills\ask-matt\SKILL.md` |
| `improve-codebase-architecture` | `C:\Users\Harsh\.agents\skills\improve-codebase-architecture\SKILL.md` |
| `ai-subscription-unit-economics` | `C:\Users\Harsh\.agents\skills\ai-subscription-unit-economics\SKILL.md` |

### Caveman (compressed comms)

| Skill | Path |
|-------|------|
| `caveman` | `C:\Users\Harsh\.agents\skills\caveman\SKILL.md` |
| `cavecrew` | `C:\Users\Harsh\.agents\skills\cavecrew\SKILL.md` |
| `caveman-commit` | `C:\Users\Harsh\.agents\skills\caveman-commit\SKILL.md` |
| `caveman-compress` | `C:\Users\Harsh\.agents\skills\caveman-compress\SKILL.md` |
| `caveman-help` | `C:\Users\Harsh\.agents\skills\caveman-help\SKILL.md` |
| `caveman-review` | `C:\Users\Harsh\.agents\skills\caveman-review\SKILL.md` |
| `caveman-stats` | `C:\Users\Harsh\.agents\skills\caveman-stats\SKILL.md` |

> **Note:** Dated backups live under `C:\Users\Harsh\.agents\skills\.vskills-backup\` — prefer non-dated folders above.

---

## 4. Claude skills (`~/.claude/skills/`)

Mirror of many agent skills. If both exist, prefer `~/.agents/skills/` unless the user attached a specific path.

Same skill names as Section 3 — root: `C:\Users\Harsh\.claude\skills\<name>\SKILL.md`

Notable Claude-only or primary copies:

| Skill | Path |
|-------|------|
| `work` | `C:\Users\Harsh\.claude\skills\work\SKILL.md` |
| `push-handoff` | `C:\Users\Harsh\.claude\skills\push-handoff\SKILL.md` |
| `find-skills` | `C:\Users\Harsh\.claude\skills\find-skills\SKILL.md` |

---

## 5. Codex skills (`~/.codex/skills/`)

| Skill | Path |
|-------|------|
| `review-agent` | `C:\Users\Harsh\.codex\skills\.system\review-agent\SKILL.md` |
| `skill-creator` | `C:\Users\Harsh\.codex\skills\.system\skill-creator\SKILL.md` |
| `skill-installer` | `C:\Users\Harsh\.codex\skills\.system\skill-installer\SKILL.md` |
| `plugin-creator` | `C:\Users\Harsh\.codex\skills\.system\plugin-creator\SKILL.md` |
| `openai-docs` | `C:\Users\Harsh\.codex\skills\.system\openai-docs\SKILL.md` |
| `imagegen` | `C:\Users\Harsh\.codex\skills\.system\imagegen\SKILL.md` |

---

## 6. How to invoke a skill in Cursor

1. User attaches skill to chat (`@skill-name`) or types `/skill-name` if configured.
2. Agent reads the full `SKILL.md` at the path above before acting.
3. For this game, default chain: read **handoff** → `/work` or `coder` → `push-handoff`.

## 7. Verification commands (this repo)

```powershell
npm test
npm run build
```

Bundle gate lives in `scripts/bundle-size.js`. Deploy: push to `main` → GitHub Pages workflow.
