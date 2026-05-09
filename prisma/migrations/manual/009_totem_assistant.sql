-- Migration 009: Totem Assistant (RAG chatbot)
-- Tables: totem_conversations, totem_messages, totem_feedback
-- Apply with: prisma db execute --file prisma/migrations/manual/009_totem_assistant.sql --schema prisma/schema.prisma

-- ============================================
-- totem_conversations
-- ============================================
CREATE TABLE IF NOT EXISTS "totem_conversations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "session_id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source_page" TEXT,
  "family_member_context" JSONB,

  CONSTRAINT "totem_conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "totem_conversations_user_id_started_at_idx"
  ON "totem_conversations"("user_id", "started_at");

CREATE INDEX IF NOT EXISTS "totem_conversations_session_id_started_at_idx"
  ON "totem_conversations"("session_id", "started_at");

ALTER TABLE "totem_conversations"
  ADD CONSTRAINT "totem_conversations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- totem_messages
-- ============================================
CREATE TABLE IF NOT EXISTS "totem_messages" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "tool_calls" JSONB,
  "tool_results" JSONB,
  "cited_media_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "model_used" TEXT,
  "latency_ms" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "totem_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "totem_messages_conversation_id_created_at_idx"
  ON "totem_messages"("conversation_id", "created_at");

ALTER TABLE "totem_messages"
  ADD CONSTRAINT "totem_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "totem_conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- totem_feedback
-- ============================================
CREATE TABLE IF NOT EXISTS "totem_feedback" (
  "id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "rating" TEXT NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "totem_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "totem_feedback_message_id_idx"
  ON "totem_feedback"("message_id");

ALTER TABLE "totem_feedback"
  ADD CONSTRAINT "totem_feedback_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "totem_messages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
