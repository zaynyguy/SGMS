// src/routes/groupsRoutes.js
const express = require("express");
const router = express.Router();
const groupsController = require("../controllers/groupsController");
const {
  authenticateJWT,
  authorizePermissions,
} = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");

// protect whole router
router.use(authenticateJWT, authorizePermissions(["manage_access"]));

router.get("/", groupsController.getAllGroups);
router.get("/:id", groupsController.getGroupDetails);

router.post("/", upload.single("profilePicture"), groupsController.createGroup);
router.put(
  "/:id",
  upload.single("profilePicture"),
  groupsController.updateGroup
);
router.delete("/:id", groupsController.deleteGroup);

module.exports = router;
