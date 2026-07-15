-- Optional "why" on a news DISLIKE — helps the news pipeline learn what
-- families find inadequate. reason_code is one of the fixed keys in
-- src/lib/news-feedback.ts; reason_note is optional free text.
ALTER TABLE news_story_reactions ADD COLUMN IF NOT EXISTS reason_code TEXT;
ALTER TABLE news_story_reactions ADD COLUMN IF NOT EXISTS reason_note TEXT;
