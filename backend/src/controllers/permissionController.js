const db = require("../db");

exports.getAllPermissions = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, description FROM "Permissions" ORDER BY name;'
    );
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
