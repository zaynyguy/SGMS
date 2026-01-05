const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { authenticateJWT } = require("../middleware/authMiddleware");

router.use(authenticateJWT);

router.get("/conversations", chatController.getConversations);
router.post("/conversations", chatController.createConversation);
router.get("/conversations/:conversationId/messages", chatController.getMessages);
router.post("/conversations/:conversationId/messages", chatController.sendMessage);
router.get("/users", chatController.getUsersForChat); // Search users to start chat

module.exports = router;