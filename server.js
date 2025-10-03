require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// --- CORS Middleware ---
app.use(
  cors({
    origin: [
      "http://localhost:3000", // Local dev
      "https://clinick-frontend.vercel.app", // ✅ Vercel frontend
    ],
    methods: ["GET", "POST", "PUT", "DELETE"], // Allow needed HTTP methods
    credentials: true,
  })
);

app.use(express.json());

// --- MongoDB connection ---
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// --- Report Schema & Model ---
const reportSchema = new mongoose.Schema(
  {
    role: String,
    patientName: String,
    location: String,
    incident: String,
    severity: String,
    symptoms: String,
  },
  { timestamps: true }
);

const Report = mongoose.model("Report", reportSchema);

// --- Routes ---
// Health check
app.get("/", (_req, res) => {
  res.send("Clinick API is running...");
});

// Submit report (📌 without email now)
app.post("/report", async (req, res) => {
  try {
    const report = new Report({
      role: req.body.role,
      patientName: req.body.patientName,
      location: req.body.location,
      incident: req.body.incident,
      severity: req.body.severity,
      symptoms: req.body.symptoms,
    });

    await report.save();

    res.status(201).json({ ok: true, id: report._id });
  } catch (err) {
    console.error("Error saving report:", err);
    res.status(500).json({ ok: false, error: "Failed to process report" });
  }
});

// Get reports (with optional ?since filter)
app.get("/reports", async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : null;
    const filter = since ? { createdAt: { $gt: since } } : {};
    const reports = await Report.find(filter).sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    console.error("Fetch reports error:", err);
    res.status(500).json({ ok: false, error: "Failed to load reports" });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ API listening on http://localhost:${PORT}`);
});
