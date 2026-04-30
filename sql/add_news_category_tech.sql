-- Adds the TECH news category for the new "Tech & IA" section on
-- /apercudecouverte-v3. Covers: generative AI for families, parental
-- tech, social media regulation, screen-time tools, EdTech, device
-- announcements relevant to kids. Distinct from GAMES (which stays
-- about the video game industry).
--
-- Postgres requires ALTER TYPE in its own statement, not inside a
-- transaction with other DDL.

ALTER TYPE "NewsCategory" ADD VALUE IF NOT EXISTS 'TECH';
