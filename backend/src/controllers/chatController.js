const db = require("../db");
const { emitToList } = require("../services/socketService");

// 1. Get list of conversations for current user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    // Fetch conversations where user is a participant
    // Also fetch the name/avatar of the "other" person for DMs
    const query = `
      SELECT 
        c.*,
        (
          SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'profilePicture', u."profilePicture"))
          FROM "ChatParticipants" cp2
          JOIN "Users" u ON cp2."userId" = u.id
          WHERE cp2."conversationId" = c.id
        ) as participants,
        (
          SELECT content FROM "ChatMessages" cm 
          WHERE cm."conversationId" = c.id 
          ORDER BY "createdAt" DESC LIMIT 1
        ) as "lastMessage",
        (
          SELECT COUNT(*)::int FROM "ChatMessages" cm2
          WHERE cm2."conversationId" = c.id 
          AND cm2."senderId" != $1
          AND cm2."isRead" = false
        ) as "unreadCount"
      FROM "ChatConversations" c
      JOIN "ChatParticipants" cp ON c.id = cp."conversationId"
      WHERE cp."userId" = $1
      ORDER BY c."lastMessageAt" DESC
    `;
    const { rows } = await db.query(query, [userId]);
    res.json(rows);
  } catch (err) {
    console.error("getConversations error:", err);
    res.status(500).json({ error: err.message });
  }
};

// 2. Get messages for a specific conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const limit = 50;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;

    // Check participation
    const access = await db.query(
      `SELECT 1 FROM "ChatParticipants" WHERE "conversationId"=$1 AND "userId"=$2`,
      [conversationId, req.user.id]
    );
    if (!access.rows.length) return res.status(403).json({ error: "Forbidden" });

    const query = `
      SELECT m.*, u.name as "senderName", u."profilePicture" as "senderAvatar"
      FROM "ChatMessages" m
      JOIN "Users" u ON m."senderId" = u.id
      WHERE m."conversationId" = $1
      ORDER BY m."createdAt" DESC
      LIMIT $2 OFFSET $3
    `;
    const { rows } = await db.query(query, [conversationId, limit, offset]);
    
    // Mark as read (simple approach: reading history marks all as read for this user context)
    // Note: A more robust system tracks read status per user per message.
    await db.query(
      `UPDATE "ChatMessages" SET "isRead" = true WHERE "conversationId" = $1 AND "senderId" != $2`,
      [conversationId, req.user.id]
    );

    res.json(rows.reverse()); // Client usually expects oldest at top
  } catch (err) {
    console.error("getMessages error:", err);
    res.status(500).json({ error: err.message });
  }
};

// 3. Send a message
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    const senderId = req.user.id;

    if (!content || !content.trim()) return res.status(400).json({ error: "Empty message" });

    // Validate access
    const check = await db.query(
      `SELECT "conversationId" FROM "ChatParticipants" WHERE "conversationId"=$1 AND "userId"=$2`,
      [conversationId, senderId]
    );
    if (!check.rows.length) return res.status(403).json({ error: "Forbidden" });

    // Insert message
    const insertRes = await db.query(
      `INSERT INTO "ChatMessages" ("conversationId", "senderId", "content") 
       VALUES ($1, $2, $3) 
       RETURNING *, (SELECT name FROM "Users" WHERE id=$2) as "senderName"`,
      [conversationId, senderId, content]
    );
    const newMessage = insertRes.rows[0];

    // Update conversation timestamp
    await db.query(`UPDATE "ChatConversations" SET "lastMessageAt" = NOW() WHERE id=$1`, [conversationId]);

    // Get all participants to notify via Socket
    const partRes = await db.query(
      `SELECT "userId" FROM "ChatParticipants" WHERE "conversationId"=$1`, 
      [conversationId]
    );
    const recipientIds = partRes.rows.map(r => r.userId);

    // Emit Real-time event
    emitToList(recipientIds, "chat_message", newMessage);

    res.status(201).json(newMessage);
  } catch (err) {
    console.error("sendMessage error:", err);
    res.status(500).json({ error: err.message });
  }
};

// 4. Create a new DM or Group
exports.createConversation = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { type = 'dm', participantIds, name } = req.body; // participantIds is array of OTHER users
    const myId = req.user.id;

    // For DM, check if exists
    if (type === 'dm' && participantIds.length === 1) {
      const otherId = participantIds[0];
      // Check if DM exists
      const existing = await client.query(`
        SELECT c.id FROM "ChatConversations" c
        JOIN "ChatParticipants" cp1 ON c.id = cp1."conversationId"
        JOIN "ChatParticipants" cp2 ON c.id = cp2."conversationId"
        WHERE c.type = 'dm' AND cp1."userId" = $1 AND cp2."userId" = $2
        LIMIT 1
      `, [myId, otherId]);
      
      if (existing.rows.length) {
        await client.query('COMMIT');
        return res.json({ id: existing.rows[0].id, isExisting: true });
      }
    }

    // Create Conversation
    const convRes = await client.query(
      `INSERT INTO "ChatConversations" (type, name) VALUES ($1, $2) RETURNING id`,
      [type, name || null]
    );
    const convId = convRes.rows[0].id;

    // Add Participants (Self + others)
    const allUsers = [...new Set([myId, ...participantIds])];
    for (const uid of allUsers) {
      await client.query(
        `INSERT INTO "ChatParticipants" ("conversationId", "userId") VALUES ($1, $2)`,
        [convId, uid]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: convId, isExisting: false });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("createConversation error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// 5. Get available users for new chat (excluding self)
exports.getUsersForChat = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, username, "profilePicture" FROM "Users" WHERE id != $1 ORDER BY name ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}