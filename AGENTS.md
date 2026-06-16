# LeadsWave — operating contract

This file is the operating contract for any AI agent working in this repo. Read it first,
then read the orchestration layer in `.claude/` before writing code.

## Read these before touching code

1. **`.claude/invariants.md`** — global rules you must NEVER override. If a change would
   break one, stop and ask. (This file reflects the *live code*; the older
   `.agents.project.context.md` has drifted — invariants win on any conflict.)
2. **`.claude/features/<feature>/purpose.md` + `rules.md`** — read the one matching the
   pipeline you're editing (`scout`, `outreach`, `inbox`, `jobs`). `purpose.md` = what it's
   for + where the code is; `rules.md` = the constraints for changing it.
3. **`.claude/memory.md`** — short continuity log: live decisions and open issues. Update
   it when you make a decision that future sessions need; keep it short (delete resolved
   items, don't archive).

Background/historical context (not authoritative for current code):
`.agents.project.context.md`, `.agents.project.Roadmap.md`, `TODO.md` (tracked deferred work).

## What this product is (one line)

Solo-operator cold-outreach autopilot: query → scout finds & enriches leads → personalized
email + scheduled follow-ups → AI classifies replies → Telegram pings + Google Calendar
booking. Not a mass-blast tool, not a CRM, single-user in v1.

## Working agreement (anti-refactoring guards)

- LLMs fail by applying valid principles at the wrong scope. Stay in scope.
- Never delete a doc without explicit instruction. Never replace docs with aliases.
- Never auto-deduplicate or merge docs because they "overlap."
- If a change improves structure but reduces usability/findability → stop and ask.
- Don't act on the drifted parts of `.agents.project.context.md`; trust the code +
  `.claude/invariants.md`.

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
