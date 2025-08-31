const db = require("../db");

function parseVal(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

exports.getAllSettings = async (req, res) => {
  const { rows } = await db.query(
    'SELECT key, value, description FROM "SystemSettings" ORDER BY key'
  );
  const data = rows.map((r) => ({
    key: r.key,
    value: parseVal(r.value),
    description: r.description,
  }));
  res.json(data);
};

exports.updateSettings = async (req, res) => {
  const updates = req.body;
  await db.tx(async (client) => {
    for (const [key, value] of Object.entries(updates)) {
      await client.query(
        `INSERT INTO "SystemSettings"(key, value) VALUES ($1, $2::jsonb)
         ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, "updatedAt"=NOW()`,
        [key, typeof value === "string" ? JSON.stringify(value) : value]
      );
    }
  });
  res.json({ message: "Settings updated." });
};
