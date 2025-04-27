require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ MySQL Connection
const db = mysql.createConnection({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "levon2003",
  database: process.env.MYSQL_DATABASE || "SecureCloudStorage",
  port: process.env.MYSQL_PORT || 3306
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
    return;
  }
  console.log("✅ Connected to MySQL.");
});

// ✅ Authentication Middleware
const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(403).json({ error: "❌ No token provided." });

  jwt.verify(token.split(" ")[1], "secretkey", (err, decoded) => {
    if (err) return res.status(401).json({ error: "❌ Unauthorized access." });
    req.userId = decoded.id;
    next();
  });
};

// ✅ File Storage Configuration
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// ✅ Register User & Auto Login
app.post("/register", async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ error: "❌ All fields are required." });
  }

  db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
    if (results.length > 0) {
      return res.status(400).json({ error: "❌ Username already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    db.query("INSERT INTO users (username, password, email) VALUES (?, ?, ?)", 
      [username, hashedPassword, email], (err, result) => {
        if (err) return res.status(500).json({ error: "❌ Server error during registration." });

        const userId = result.insertId;
        const token = jwt.sign({ id: userId }, "secretkey", { expiresIn: "1h" });
        res.json({ message: "✅ Registered and logged in!", token });
      });
  });
});

// ✅ Login User
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
    if (results.length === 0) {
      return res.status(400).json({ error: "❌ Account not found. Please register first." });
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: "❌ Incorrect password." });
    }

    const token = jwt.sign({ id: user.id }, "secretkey", { expiresIn: "1h" });
    res.json({ message: "✅ Login successful!", token });
  });
});

// ✅ Upload File
app.post("/upload", verifyToken, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "❌ No file uploaded." });

  const encryptionKey = crypto.randomBytes(16).toString("hex");

  db.query("INSERT INTO encrypted_files (file_name, user_id, encrypted_key) VALUES (?, ?, ?)", 
    [req.file.filename, req.userId, encryptionKey], (err, result) => {
      if (err) return res.status(500).json({ error: "❌ Database error during upload." });
      res.json({ message: "✅ File uploaded!", file_id: result.insertId });
    });
});

// ✅ Fetch Files
app.get("/files", verifyToken, (req, res) => {
  db.query("SELECT id, file_name FROM encrypted_files WHERE user_id = ?", 
    [req.userId], (err, results) => {
      if (err) return res.status(500).json({ error: "❌ Error fetching files." });
      res.json(results);
    });
});

// ✅ Download File
app.get("/download/:fileId", verifyToken, (req, res) => {
  const fileId = req.params.fileId;

  db.query("SELECT file_name FROM encrypted_files WHERE id = ? AND user_id = ?", [fileId, req.userId], (err, results) => {
    if (err || results.length === 0) return res.status(403).json({ error: "❌ Unauthorized or file not found." });
    const filePath = `uploads/${results[0].file_name}`;
    res.download(filePath);
  });
});

// ✅ Delete File
app.delete("/delete/:fileId", verifyToken, (req, res) => {
  const fileId = req.params.fileId;

  db.query("SELECT file_name FROM encrypted_files WHERE id = ? AND user_id = ?", [fileId, req.userId], (err, results) => {
    if (err || results.length === 0) return res.status(403).json({ error: "❌ Unauthorized or file not found." });

    fs.unlinkSync(`uploads/${results[0].file_name}`);
    db.query("DELETE FROM encrypted_files WHERE id = ?", [fileId], (err) => {
      if (err) return res.status(500).json({ error: "❌ Error deleting file." });
      res.json({ message: "✅ File deleted successfully!" });
    });
  });
});

// ✅ Reset Password
app.post("/reset-password", (req, res) => {
  const { email, newPassword } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (results.length === 0) return res.status(400).json({ error: "❌ Email not found." });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.query("UPDATE users SET password = ? WHERE email = ?", [hashedPassword, email], (err) => {
      if (err) return res.status(500).json({ error: "❌ Error updating password." });
      res.json({ message: "✅ Password reset successfully!" });
    });
  });
});

// ✅ Serve Static Files
app.use("/uploads", express.static("uploads"));

// ✅ Start Server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
});