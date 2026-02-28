-- Add WATCHED value to ReactionType enum
ALTER TYPE "ReactionType" ADD VALUE IF NOT EXISTS 'WATCHED';
