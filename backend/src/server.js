require("dotenv").config();
const express = require("express");
const cors = require("cors");

// --- Import Routes ---
const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");
const roleRoutes = require("./routes/roleRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const groupsRoutes = require("./routes/groupsRoutes");
const userGroupsRoutes = require('./routes/userGroupsRoutes');
const goalsRoutes = require("./routes/goalsRoutes");
const tasksRoutes = require("./routes/tasksRoutes");
const activitiesRoutes = require("./routes/activitiesRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const systemSettingsRoutes = require("./routes/systemSettingsRoutes");
const reportsRoutes = require("./routes/reportsRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// --- API Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/goals", goalsRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/activities", activitiesRoutes);
app.use("/api/groups", groupsRoutes);
app.use('/api/user-groups', userGroupsRoutes);
app.use("/api/system-settings", systemSettingsRoutes);
app.use("/api/reports", reportsRoutes);

app.get("/", (req, res) => {
  res.send("The api server is running ..");
});

// --- Start Server ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  try {
    console.log("Database connection established successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
});
