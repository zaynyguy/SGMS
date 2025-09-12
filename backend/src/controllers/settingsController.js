// src/controllers/settingsController.js

const db = require("../db");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/generateToken");
const { uploadFile } = require("../services/uploadService");
// -------------------- GET SETTINGS --------------------
exports.getSettings = async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await db.query(
      'SELECT username, name, language, "darkMode", "profilePicture" FROM "Users" WHERE id = $1',
      [userId]
    );
    if (!rows[0]) return res.status(404).json({ message: "User not found." });
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error fetching user settings:", error);
    res
      .status(500)
      .json({
        message: "Failed to fetch user settings.",
        error: error.message,
      });
  }
};

// -------------------- UPDATE SETTINGS --------------------
exports.updateSettings = async (req, res) => {
  const userId = req.user.id;
  const { name, language, darkMode, oldPassword, newPassword } = req.body;

  try {
    if (oldPassword && newPassword) {
      // password change case
      const { rows } = await db.query(
        'SELECT password FROM "Users" WHERE id = $1',
        [userId]
      );
      if (!rows[0]) return res.status(404).json({ message: "User not found." });

      const isValid = await bcrypt.compare(oldPassword, rows[0].password);
      if (!isValid)
        return res.status(401).json({ message: "Old password is incorrect." });

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.query(
        'UPDATE "Users" SET password = $1, name = COALESCE($2,name), language = $3, "darkMode" = $4, "updatedAt" = NOW() WHERE id = $5',
        [hashedPassword, name, language, darkMode, userId]
      );
    } else {
      // no password change, just settings
      await db.query(
        'UPDATE "Users" SET name = COALESCE($1,name), language = $2, "darkMode" = $3, "updatedAt" = NOW() WHERE id = $4',
        [name, language, darkMode, userId]
      );
    }

    const { token, user } = await generateToken(userId);
    res
      .status(200)
      .json({ message: "Settings updated successfully.", token, user });
  } catch (error) {
    console.error("Error updating user settings:", error);
    res
      .status(500)
      .json({
        message: "Failed to update user settings.",
        error: error.message,
      });
  }
};

// -------------------- UPDATE PROFILE PICTURE --------------------
exports.updateProfilePicture = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const userId = req.user.id;

  try {
    // Use the centralized upload service
    const uploaded = await uploadFile(req.file);

    await db.query(
      `UPDATE "Users" SET "profilePicture"=$1, "updatedAt"=NOW() WHERE id=$2`,
      [uploaded.url, userId]
    );

    res.json({
      message: "Profile picture updated successfully.",
      profilePicture: uploaded.url,
      provider: uploaded.provider,
    });
  } catch (err) {
    console.error("Error updating profile picture:", err);
    res.status(500).json({ error: "Failed to update profile picture." });
  }
};