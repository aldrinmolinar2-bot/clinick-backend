require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// --- MongoDB connection ---
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// --- User Schema ---
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ["clinic", "reporter"], default: "reporter" },
});
const User = mongoose.model("User", userSchema);

async function createUser() {
  try {
    const hashedPassword = await bcrypt.hash("123456", 10); // default password

    const user = new User({
      username: "clinic",
      password: hashedPassword,
      role: "clinic",
    });

    await user.save();
    console.log("✅ Clinic user created: username=clinic, password=123456");
  } catch (err) {
    console.error("❌ Error creating user:", err);
  } finally {
    mongoose.connection.close();
  }
}

createUser();
