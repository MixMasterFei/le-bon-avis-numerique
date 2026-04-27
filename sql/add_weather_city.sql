-- Per-user weather city for the "Météo famille" sidebar widget on
-- /apercudecouverte-v3. Cross-device: saved server-side so home PC,
-- work PC, and phone all show the same city. NULL = use Paris default.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS weather_city_name TEXT,
  ADD COLUMN IF NOT EXISTS weather_city_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS weather_city_lon DOUBLE PRECISION;
