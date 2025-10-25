const db = require("../db");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/generateToken"); // <-- IMPORT THIS
const { uploadFile } = require("../services/uploadService");
const { buildProfilePictureUrl } = require("../utils/fileHelper");

exports.getSettings = async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await db.query(
      'SELECT username, name, language, "profilePicture" FROM "Users" WHERE id = $1',
      [userId]
    );
    if (!rows[0]) return res.status(404).json({ message: "User not found." });

    const settings = {
      ...rows[0],
      profilePicture: buildProfilePictureUrl(rows[0].profilePicture, "user"),
    };

    res.status(200).json(settings);
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

exports.updateSettings = async (req, res) => {
  const userId = req.user.id;
  const { name, language, oldPassword, newPassword } = req.body;

  try {
    if (oldPassword && newPassword) {
      const { rows } = await db.query(
        'SELECT password FROM "Users" WHERE id = $1',
        [userId]
      );
      if (!rows[0]) return res.status(404).json({ message: "User not found." });

      const isValid = await bcrypt.compare(oldPassword, rows[0].password);
      if (!isValid) {
        return res.status(401).json({ message: "Old password is incorrect." });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.query(
        'UPDATE "Users" SET password = $1, name = COALESCE($2,name), language = $3, "updatedAt" = NOW() WHERE id = $4',
        [hashedPassword, name, language, userId]
      );
    } else {
      await db.query(
        'UPDATE "Users" SET name = COALESCE($1,name), language = $2, "updatedAt" = NOW() WHERE id = $3',
        [name, language, userId]
      );
    }

    // This part is correct, we will mirror it below
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

// --- UPDATED FUNCTION ---
exports.updateProfilePicture = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const userId = req.user.id;

  try {
    const uploaded = await uploadFile(req.file);

    await db.query(
      `UPDATE "Users" SET "profilePicture"=$1, "updatedAt"=NOW() WHERE id=$2`,
      [uploaded.url, userId]
    );

    // Re-generate token so the 'profilePicture' field in the JWT is updated
    const { token, user } = await generateToken(userId);

    res.json({
      message: "Profile picture updated successfully.",
      profilePicture: user.profilePicture, // Get URL from the new user object
      provider: uploaded.provider,
      token, // <-- ADD THIS
      user, // <-- ADD THIS
    });
  } catch (err)
 {
    console.error("Error updating profile picture:", err);
    res.status(500).json({ error: "Failed to update profile picture." });
  }
};

