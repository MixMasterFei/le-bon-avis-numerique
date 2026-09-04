# Public Markdown and MCP

The public catalogue is available at `/api/mcp/mcp` through Streamable HTTP.
The three tools are anonymous and read-only. They never load family profiles.
Server version: 1.1.0. Structured result schema version: 1.

## Tool contract

- `search_media`: `query`, optional `type` (`film`, `serie`, `jeu`) and `limit` (1–10).
- `get_age_verdict`: exact `id` from search, or `title`; optional `type` and `year` to disambiguate. Multiple exact-title matches return candidates instead of selecting a remake automatically.
- `recommend_for_age`: `age` (3–16), optional `type` (`films`, `series`, `jeux`) and `limit` (1–20). This filters catalogue recommendations by age; it does not claim a personalized family fit.

Results contain readable French Markdown and a JSON text block. The same JSON is
available as `structuredContent` and validated against the advertised `outputSchema`.
`status` is `ok`, `not_found`, `ambiguous`, `invalid_input` or `unavailable`.
The `result.kind` discriminator identifies search, verdict, selection or error data.
Clients should ask users to select an `ambiguous` result and retry `unavailable`
requests later. Neither status means a title is suitable for a child.

Identifiers are `type:UUID`, or a UUID without a prefix. Numeric provider IDs require
their namespace: `movie:603` and `tv:603` refer to different TMDB records; `game:603`
refers only to IGDB. Malformed numeric IDs, unknown prefixes and numeric IDs without
a prefix are rejected. Every lookup applies the public catalogue visibility gate.

## Assessment data

Media results distinguish catalogue `updatedAt` from `assessment.assessedAt`.
Only recorded analysis-pass dates establish the latter; it can be null. This does
not establish that a human watched the work. Analysis source and confidence are
reported when stored. Confidence is an internal analysis score, not a probability
that the recommendation is correct.

Provisional or missing analyses have null metrics. Seven content scores are
supplemented by an educational indicator derived using the same helper as the
website. Explicit educational topics can affect that indicator; substring matches
such as "science-fiction" do not count as the topic "science".

Sensitive warnings use the site's confidence threshold and closed vocabulary.
They remain automated points to check, not confirmed scenes. Missing warnings and
an analysis that found no warnings are distinct. Classification values are passed
through, with country and authority null because the current record does not reliably
identify those fields. Do not infer a French classification from a bare number.

## Editorial content

`/md/blog` lists published articles. `/md/blog/{slug}` exports their headings,
formatting, source links, images and captions, author and dates from Sanity.
The published perspective, explicit draft exclusion and publication date gate apply.
No schedule is created and no draft is published by this integration. A weekly
release can be managed manually in the CMS when the editor decides to publish.

Markdown responses identify their canonical HTML URL and carry `noindex, follow`.
Catalogue and CMS failures return 503 with `no-store` and `Retry-After: 60`, rather
than suggesting content has been removed. The guides remain on their HTML pages.

## Operations and rollout

Handlers emit JSON logs with `event=mcp_tool_call`, `tool`, `status` and `durationMs`.
Aggregate these in hosting logs to measure successful calls, ambiguity, missing
results, failures and latency. They do not include search text, IDs, family data,
IP addresses or client-supplied labels. Transport/schema rejections before a tool
handler runs are not included. The existing crawler/referral dashboard is separate;
these events do not claim to measure citations or resulting account registrations.

No database migration or new credentials are required. Search reuses the existing
Postgres `unaccent` extension. At the current catalogue size normalization still
scans title expressions; measure actual latency before adding a normalized index.
Deploy through the normal review process, then smoke-test punctuation/accent
queries, typed IDs, ambiguity and an age selection against the deployed catalogue.

Publishing these interfaces does not automatically connect an assistant or confer
search ranking benefits. Promote the endpoint through an actual integration and
measure use before adding further tools.
