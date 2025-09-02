require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// --- API Routes ---
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/usersRoutes"));
app.use("/api/roles", require("./routes/roleRoutes"));
app.use("/api/permissions", require("./routes/permissionRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));
app.use("/api/goals", require("./routes/goalsRoutes"));
app.use("/api/tasks", require("./routes/tasksRoutes"));
app.use("/api/activities", require("./routes/activitiesRoutes"));
app.use("/api/groups", require("./routes/groupsRoutes"));
app.use("/api/user-groups", require("./routes/userGroupsRoutes"));
app.use("/api/system-settings", require("./routes/systemSettingsRoutes"));
app.use("/api/reports", require("./routes/reportsRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/notifications", require("./routes/notificationsRoutes"));
app.use("/api/audit", require("./routes/auditRoutes"));

app.get("/", (req, res) => {
  res.send("The api server is running ..");
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  try {
    console.log("Database connection established successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
});
