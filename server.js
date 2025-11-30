require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();

// --- CORS ---
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://clinick-frontend.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json());

// --- MongoDB ---
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));


// --- Firebase Admin Setup ---
if (!process.env.FIREBASE_PRIVATE_KEY) {
  console.error("❌ Missing Firebase PRIVATE KEY in ENV!");
}

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      }),
    });

    console.log("🔥 Firebase Admin initialized successfully");
  } catch (err) {
    console.error("❌ Firebase initialization error:", err);
  }
}


// --- Models ---
const reportSchema = new mongoose.Schema(
  {
    role: String,
    patientName: String,
    location: String,
    incident: String,
    severity: String,
    symptoms: String,
    seen: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Report = mongoose.model("Report", reportSchema);

const tokenSchema = new mongoose.Schema({
  token: String,
  createdAt: { type: Date, default: Date.now },
});
const Token = mongoose.model("Token", tokenSchema);


// --- ROUTES ---

app.get("/", (_req, res) => res.send("Clinick API is running..."));

// Save FCM token
app.post("/save-token", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) return res.status(400).json({ ok: false, error: "Missing token" });

    const exists = await Token.findOne({ token });

    if (!exists) {
      await Token.create({ token });
      console.log("✅ Token saved:", token);
    } else {
      console.log("⚠️ Token already exists");
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Error saving token:", err);
    res.status(500).json({ ok: false, error: "Failed to save token" });
  }
});


// Submit report + Send notification
app.post("/report", async (req, res) => {
  try {
    const report = await Report.create({
      role: req.body.role,
      patientName: req.body.patientName,
      location: req.body.location,
      incident: req.body.incident,
      severity: req.body.severity,
      symptoms: req.body.symptoms,
    });

    const tokens = (await Token.find()).map(t => t.token);

    if (tokens.length > 0) {
      const message = {
        notification: {
          title: `🚨 ${report.severity} Emergency!`,
          body: `${report.patientName} - ${report.incident} at ${report.location}`,
        },
        tokens,
      };

      try {
        const response = await admin.messaging().sendMulticast(message);
        console.log(`📨 Notifications sent: ${response.successCount}/${tokens.length}`);
      } catch (err) {
        console.error("❌ Firebase send error:", err);
      }
    }

    res.status(201).json({ ok: true, id: report._id });
  } catch (err) {
    console.error("Error saving report:", err);
    res.status(500).json({ ok: false, error: "Failed to save report" });
  }
});


// Get monthly reports
app.get("/reports", async (req, res) => {
  try {
    const { month, year } = req.query;

    let filter = {};

    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);

      filter.createdAt = { $gte: start, $lt: end };
    }

    const reports = await Report.find(filter).sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    console.error("Error fetching reports:", err);
    res.status(500).json({ ok: false, error: "Failed" });
  }
});


// Mark report as seen
app.put("/reports/:id/seen", async (req, res) => {
  try {
    const updated = await Report.findByIdAndUpdate(
      req.params.id,
      { seen: true },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    console.error("Error marking report seen:", err);
    res.status(500).json({ ok: false, error: "Failed" });
  }
});


// Export monthly as CSV
app.get("/export-reports", async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) return res.status(400).send("Missing month/year");

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const reports = await Report.find({
      createdAt: { $gte: start, $lt: end }
    });

    let csv = "Role,Patient Name,Location,Incident,Severity,Symptoms,Date\n";

    reports.forEach(r => {
      csv += `"${r.role}","${r.patientName}","${r.location}","${r.incident}","${r.severity}","${r.symptoms.replace(/"/g, '""')}","${new Date(r.createdAt).toLocaleString()}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=clinick-reports-${year}-${month}.csv`
    );

    res.send(csv);
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).send("Failed to export");
  }
});

// --- Start Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
