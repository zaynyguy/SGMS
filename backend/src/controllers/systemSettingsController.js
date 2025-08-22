const db = require('../db');


// -------------------- GET ALL THE SETTINGS --------------------
exports.getAllSettings = async (req, res) => {
    try {
        const { rows } = await db.query('SELECT key, value FROM "SystemSettings"');
        const settings = rows.reduce((acc, { key, value }) => {
            // Correctly parse the JSONB value into a native JavaScript type
            acc[key] = JSON.parse(value);
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
        const updatePromises = Object.entries(settings).map(([key, value]) => {
            // Correctly serialize the JavaScript value into a JSON string
            const jsonValue = JSON.stringify(value);
            return client.query(
                'UPDATE "SystemSettings" SET value = $1::jsonb, "updatedAt" = NOW() WHERE key = $2',
                [jsonValue, key]
            );
        });
        await Promise.all(updatePromises);
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