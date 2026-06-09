const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersController");
const {
  authenticateJWT,
  authorizePermissions,
} = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");
const {
  validate,
  createUser,
  updateUser,
  idParam,
} = require("../utils/validator");

router.get(
  "/profile-picture/:filename",
  authenticateJWT,
  usersController.getProfilePicture,
);

router.use(authenticateJWT, authorizePermissions(["manage_access"]));

router.get("/", usersController.getAllUsers);
router.post("/", validate(createUser), usersController.createUser);
router.put(
  "/:id",
  validate(idParam, "params"),
  validate(updateUser),
  usersController.updateUser,
);
router.delete("/:id", validate(idParam, "params"), usersController.deleteUser);

router.put(
  "/:id/profile-picture",
  validate(idParam, "params"),
  upload.single("file"),
  usersController.uploadProfilePictureForUser,
);

module.exports = router;
