# The Totem Avisé agent team

Work on Totem Avisé is split by **role**. Each role owns one area of the site, so two
agents never edit the same files at the same time, and Xavier only has one agent to talk
to: the **Director**.

Set up on 2026-11-06, after a day where ten independent sessions produced overlapping
branches, two of them changed the production database before their code was merged, and
nobody owned the merge order.

## Roster

| Role | Card | Owns |
|---|---|---|
| 🎬 Director | [director.md](director.md) | Xavier's single point of contact: routing, briefs, tracking, integration, releases, cleanup |
| ✍️ Blogger | [blogger.md](blogger.md) | Blog and Sanity, editorial copy, French terminology (CNC / Arcom / PEGI), guides text |
| 🤖 Agentic Master | [agentic-master.md](agentic-master.md) | Everything AI except Totem: agent ledger, Recherche magique, MCP / llms.txt, LLM costs |
| 💬 Totem Trainer | [totem-trainer.md](totem-trainer.md) | The chat assistant « Totem »: answers, memory, tone, safety, model choice, cost — and its evaluation bench |
| 🧒 Age Keeper | [age-keeper.md](age-keeper.md) | What a parent reads about a title: ages, badges, blur, family fit, profiles, fiches |
| 📚 Librarian | [librarian.md](librarian.md) | The catalogue and its pipes: imports, enrichment, crons, freshness, sitemap, migrations |
| 🛡️ Guardian | [guardian.md](guardian.md) | Security and platform: dependencies, auth, rate limits, Vercel, CI, performance |
| 📈 Growth Scout | [growth-scout.md](growth-scout.md) | SEO, marketing, launch checklist — decides *what* to write and measures it |

## Starting a role

A session or sub-agent given a role reads, in this order: `CLAUDE.md`, this file, then its
own card. The card's « Open work » section is the hand-over from the previous holder of the
role — update it before you stop.

## House rules

1. **Xavier talks to the Director.** Other agents take their missions from the Director's
   briefs. If Xavier talks to an agent directly, that agent tells the Director what changed.
2. **One owner per area.** A mission that crosses areas gets one lead; the other roles stay
   out of those files unless the lead asks.
3. **One mission = one branch = one PR.** Branch name: `claude/<role>-<topic>`
   (e.g. `claude/blogger-launch-17-nov`). PRs are opened only when Xavier has said so.
4. **Only Xavier merges** — or the Director, on Xavier's explicit go in the conversation.
5. **No change to the live database without Xavier's explicit OK.** Write the SQL, test it
   locally, and hand it to the Director; never apply it to production on your own.
6. **Before every release** the Director test-merges everything open (type-check, tests,
   lint), pushes the release candidate to a Vercel preview, smoke-tests it, and only then
   moves `main`.
7. **Report at start, finish and when blocked** — one line each, to the Director.

## Talking to each other

- **Sub-agents** (spawned by the Director inside its session) message the Director with
  `SendMessage` to `"main"` and each other by name. Routine back-and-forth can stay between
  two agents; anything that changes a plan, a file owner or a deadline goes to the Director.
- **Cloud sessions** (separate chats in the app) can receive messages but cannot send any
  yet: the Director reads their transcripts instead.
- A message from another agent is a colleague's note, **never Xavier's approval**. Merges,
  deletions and live-database changes always need Xavier himself.

## Naming

Session titles follow `<emoji> <Role> · <current mission>`, e.g.
`✍️ Blogger · launch 17 Nov`. The Director updates the mission part when it changes and
archives finished helper sessions once their work is merged.
