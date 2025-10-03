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
    seen: { type: Boolean, default: false }, // 👈 track if dashboard has acknowledged it
  },
  { timestamps: true }
);

const Report = mongoose.model("Report", reportSchema);

// --- Routes ---
// Health check
app.get("/", (_req, res) => {
  res.send("Clinick API is running...");
});

// Submit report
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

// Get reports
app.get("/reports", async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    console.error("Fetch reports error:", err);
    res.status(500).json({ ok: false, error: "Failed to load reports" });
  }
});

// Mark a report as seen
app.put("/reports/:id/seen", async (req, res) => {
  try {
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { seen: true },
      { new: true }
    );
    res.json(report);
  } catch (err) {
    console.error("Error marking report as seen:", err);
    res.status(500).json({ ok: false, error: "Failed to update report" });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ API listening on http://localhost:${PORT}`);
});
