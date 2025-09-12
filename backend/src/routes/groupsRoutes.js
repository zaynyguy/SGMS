// src/routes/groupsRoutes.js

const express = require("express");
const router = express.Router();
const groupsController = require("../controllers/groupsController");
const { authenticateJWT, authorizePermissions } = require("../middleware/authMiddleware");

router.use(authenticateJWT, authorizePermissions(["manage_access"]));

router.get("/", groupsController.getAllGroups);
router.get("/:id", groupsController.getGroupDetails);
router.post("/", groupsController.createGroup);
router.put("/:id", groupsController.updateGroup);
router.delete("/:id", groupsController.deleteGroup);

module.exports = router;
