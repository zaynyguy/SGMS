const db = require('../db');
const bcrypt = require('bcrypt');
const { generateToken } = require('./authController');

// -------------------- GET SETTINGS --------------------
exports.getSettings = async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await db.query('SELECT username, name, language, "darkMode" FROM "Users" WHERE id = $1', [userId]);
    if (!rows[0]) return res.status(404).json({ message: "User not found." });
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error fetching user settings:", error);
    res.status(500).json({ message: "Failed to fetch user settings.", error: error.message });
  }
};

// -------------------- UPDATE SETTINGS --------------------
exports.updateSettings = async (req, res) => {
  const userId = req.user.id;
  const { language, darkMode, oldPassword, newPassword } = req.body;

  try {
    if (oldPassword && newPassword) {
      const { rows } = await db.query('SELECT password FROM "Users" WHERE id = $1', [userId]);
      if (!rows[0]) return res.status(404).json({ message: "User not found." });

      const isValid = await bcrypt.compare(oldPassword, rows[0].password);
      if (!isValid) return res.status(401).json({ message: "Old password is incorrect." });

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.query(
        'UPDATE "Users" SET password = $1, language = $2, "darkMode" = $3, "updatedAt" = NOW() WHERE id = $4',
        [hashedPassword, language, darkMode, userId]
      );
    } else {
      await db.query(
        'UPDATE "Users" SET language = $1, "darkMode" = $2, "updatedAt" = NOW() WHERE id = $3',
        [language, darkMode, userId]
      );
    }

    const { token, user } = await generateToken(userId);
    res.status(200).json({ message: "Settings updated successfully.", token, user });
  } catch (error) {
    console.error("Error updating user settings:", error);
    res.status(500).json({ message: "Failed to update user settings.", error: error.message });
  }
};