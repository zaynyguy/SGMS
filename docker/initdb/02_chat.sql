-- 1. Conversations (Channels)
CREATE TABLE IF NOT EXISTS "ChatConversations" (
  "id" SERIAL PRIMARY KEY,
  "type" VARCHAR(20) NOT NULL DEFAULT 'dm', -- 'dm' or 'group'
  "name" VARCHAR(255), -- Null for DMs, required for named groups
  "lastMessageAt" TIMESTAMPTZ DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Participants (Who is in which conversation)
CREATE TABLE IF NOT EXISTS "ChatParticipants" (
  "conversationId" INTEGER NOT NULL REFERENCES "ChatConversations"("id") ON DELETE CASCADE,
  "userId" INTEGER NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "joinedAt" TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY ("conversationId", "userId")
);

-- 3. Messages
CREATE TABLE IF NOT EXISTS "ChatMessages" (
  "id" SERIAL PRIMARY KEY,
  "conversationId" INTEGER NOT NULL REFERENCES "ChatConversations"("id") ON DELETE CASCADE,
  "senderId" INTEGER NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "isRead" BOOLEAN DEFAULT FALSE, -- Simple read receipt
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON "ChatParticipants"("userId");
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON "ChatMessages"("conversationId");
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON "ChatMessages"("createdAt");