const db = require('../db');


// -------------------- GET ALL THE SETTINGS --------------------
exports.getAllSettings = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT key, value, description FROM "SystemSettings"');
    const settings = rows.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching system settings:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


// -------------------- UPDATE ALL THE SETTINGS --------------------
exports.updateSettings = async (req, res) => {
  const settings = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const key in settings) {
      if (Object.hasOwnProperty.call(settings, key)) {
        await client.query(
          'UPDATE "SystemSettings" SET value = $1, "updatedAt" = NOW() WHERE key = $2',
          [settings[key], key]
        );
      }
    }
    await client.query('COMMIT');
    res.status(200).json({ message: 'Settings updated successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error updating system settings:", error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};
