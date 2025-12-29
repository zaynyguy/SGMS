require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { initSocket } = require("./services/socketService"); 
const db = require("./db")
const cookieParser = require('cookie-parser');
const { scheduleMonthlySnapshots } = require('./jobs/monthlySnapshot');


const app = express();
const server = http.createServer(app);

const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // allows requests with no origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    // allows if origin is in whitelist OR if not in production
    if (FRONTEND_ORIGINS.includes(origin) || process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// scheduleMonthlySnapshots({ schedule: '0 9 1 * *' });

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


const PORT = process.env.PORT || 5000;

server.listen(PORT,"0.0.0.0", async () => {
console.log(`Server running on port ${PORT}`);
initSocket(server);
try {
const time = db.query("Select now()")
console.log("Database connection established successfully.");
} catch (error) {
console.error("Unable to connect to the database:", error);
}
});