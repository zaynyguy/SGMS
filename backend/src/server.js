require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

// --- Import Routes ---
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
// const settingsRoutes = require('./routes/settingsRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
// app.use('/api/settings', settingsRoutes);

// --- Server Initialization ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    await db.query("SELECT NOW()");
    console.log("Database connection established successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
});
