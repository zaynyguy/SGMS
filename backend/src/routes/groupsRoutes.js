const express = require("express");
const router = express.Router();
const groupsController = require("../controllers/groupsController");
const {
  authenticateJWT,
  authorizePermissions,
} = require("../middleware/authMiddleware");

router.use(authenticateJWT);
router.get(
  "/",
  authorizePermissions(["view_groups", "manage_groups"]),
  groupsController.getAllGroups
);
router.post(
  "/",
  authorizePermissions(["manage_groups"]),
  groupsController.createGroup
);
router.put(
  "/:id",
  authorizePermissions(["manage_groups"]),
  groupsController.updateGroup
);
router.delete(
  "/:id",
  authorizePermissions(["manage_groups"]),
  groupsController.deleteGroup
);

module.exports = router;
