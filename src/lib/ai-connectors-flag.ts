/**
 * Gate for /assistants-ia, the public page that documents the connector for
 * AI assistants (the page a connector directory links to).
 *
 * Admin-only until `AI_CONNECTORS_PAGE_PUBLIC=true`, mirroring
 * `GAME_GUIDES_PUBLIC`: one env switch, instant rollback, default OFF.
 *
 * Why the default is closed: to tell families where they can use Totem, the
 * page has to name the assistants (Claude, Le Chat, ChatGPT). CLAUDE.md
 * forbids those names in rendered text unless Xavier grants an exception.
 * Flipping this flag IS that exception — so the page can be merged early and
 * still never render publicly by accident. Admins always see it (preview).
 */
export function isAiConnectorsPagePublic(): boolean {
  return process.env.AI_CONNECTORS_PAGE_PUBLIC === "true"
}
