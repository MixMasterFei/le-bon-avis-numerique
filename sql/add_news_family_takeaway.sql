-- Adds the "what this means for families" box that ships with the
-- journalistic-rewrite of news briefs. The body stays purely
-- journalistic (sources-first, named quotes, no parental hooks);
-- this field is the only place where Totem's voice is allowed.
--
-- Rendered as a boxed aside on the story page, between the markdown
-- body and the "Toutes les sources" footer. Hidden when null so
-- legacy briefs (published before this column existed) render
-- unchanged with no empty placeholder.
--
-- Target length: 60-120 words. Plain text, no markdown.

ALTER TABLE news_stories
  ADD COLUMN IF NOT EXISTS family_takeaway TEXT;
