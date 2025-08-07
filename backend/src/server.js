require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");

// --- Import Routes & Controllers ---
const authRoutes = require("./routes/authRoutes");

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Routes ---
app.get("/", (req, res) => res.send("SGMS API is running..."));
app.use("/api/auth", authRoutes);

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
