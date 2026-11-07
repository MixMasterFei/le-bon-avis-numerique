/**
 * Gate for /assistants-ia, the public page that documents the connector for
 * AI assistants (the page a connector directory links to).
 *
 * Admin-only until `AI_CONNECTORS_PAGE_PUBLIC=true`, mirroring
 * `GAME_GUIDES_PUBLIC`: one env switch, instant rollback, default OFF.
 *
 * The page names the assistants (Claude, Le Chat, ChatGPT) — the one
 * exception to the CLAUDE.md naming rule, approved by Xavier on 7 Nov 2026.
 * The default stays closed so the page goes live when Xavier decides (just
 * before the directory submission), not whenever the branch happens to be
 * merged. Admins always see it (preview).
 */
export function isAiConnectorsPagePublic(): boolean {
  return process.env.AI_CONNECTORS_PAGE_PUBLIC === "true"
}
