require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();

// --- CORS Middleware ---
app.use(
  cors({
    origin: [
      "http://localhost:3000", // Local dev
      "https://clinick-frontend.vercel.app", // ✅ Vercel frontend
    ],
    methods: ["GET", "POST", "PUT", "DELETE"], // Allow needed HTTP methods
    credentials: true, // Allow cookies/headers if ever needed
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

// --- Nodemailer Transporter ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// --- Routes ---
// Health check
app.get("/", (_req, res) => {
  res.send("Clinick API is running...");
});

// 🔓 Public: Submit report
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

    // Send email alert
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_TO,
      subject: `🚨 Emergency Report: ${report.incident} (${report.severity})`,
      text: `New emergency report received:

Patient: ${report.patientName}
Role: ${report.role}
Location: ${report.location}
Incident: ${report.incident}
Severity: ${report.severity}
Symptoms: ${report.symptoms}

Time: ${report.createdAt}
`,
    });

    res.status(201).json({ ok: true, id: report._id });
  } catch (err) {
    console.error("Error saving report or sending email:", err);
    res.status(500).json({ ok: false, error: "Failed to process report" });
  }
});

// 🔓 Public: Get reports (with optional ?since filter)
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
