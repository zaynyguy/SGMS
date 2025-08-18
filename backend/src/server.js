require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

// --- Import Routes ---
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const goalRoutes = require('./routes/goalRoutes');
const taskRoutes = require('./routes/taskRoutes');
const activityRoutes = require('./routes/activityRoutes');
const groupRoutes = require('./routes/groupRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/groups', groupRoutes)

app.get('/', (req, res) => {
  res.send('The api server is running ..')
})

// --- Start Server ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  try {
    const current_time = await db.query('SELECT NOW()');
    console.log(`Current time: ${current_time.rows[0].now}`);
    console.log('Database connection established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
});
