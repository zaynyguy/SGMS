const express = require("express");
const router = express.Router();
const userGroupsController = require("../controllers/userGroupsController");
const {
  authenticateJWT,
  authorize,
  authorizePermissions,
} = require("../middleware/authMiddleware");

router.use(authenticateJWT);

router.post(
  "/",
  authorizePermissions(["manage_groups"]),
  userGroupsController.addUserToGroup
);
router.delete(
  "/",
  authorizePermissions(["manage_groups"]),
  userGroupsController.removeUserFromGroup
);
router.get(
  "/:groupId/users",
  authorizePermissions(["view_groups", "manage_groups"]),
  userGroupsController.getGroupUsers
);

module.exports = router;
