require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { initSocket } = require("./services/socketService"); 
const db = require("./db")
const cookieParser = require('cookie-parser');
const { scheduleMonthlySnapshots } = require('./jobs/monthlySnapshot');
const { UPLOAD_DIR } = require("./middleware/uploadMiddleware");

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

scheduleMonthlySnapshots({ schedule: '0 9 1 * *' });

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
res.send("The API server is running...");
});

// REMOVED: app.use("/uploads", express.static(UPLOAD_DIR));
// This line has been removed to close the security vulnerability.
// Files are now served via secure controllers.

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
console.log(`Server running on port ${PORT}`);
initSocket(server);
try {
db.query("Select now()")
console.log("Database connection established successfully.");
} catch (error) {
console.error("Unable to connect to the database:", error);
}
});
