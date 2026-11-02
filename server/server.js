require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const User = require("./models/User");
const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Middleware
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// ---------- Helpers ----------

// Private room id: two user ids sorted and joined
// Example: "64a1_64b2"
function getPrivateRoomId(userIdA, userIdB) {
  return [userIdA, userIdB].sort().join("_");
}

// "general" anduru access cheyyochu, private room lo member matrame access
function canAccessRoom(room, userId) {
  if (room === "general") return true;
  return room.split("_").includes(userId);
}

// REST API protect cheyadaniki JWT middleware
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "Token required" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

// ---------- Basic APIs ----------

// Home API
app.get("/", (req, res) => {
  res.status(200).send("ChatSpace Backend is Running!");
});

// Health API
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ChatSpace backend is running!",
  });
});

// ---------- Auth APIs ----------

// REGISTER API
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);

    return res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
});

// LOGIN API WITH JWT
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing in .env");
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

// ---------- Message APIs ----------

// Room lo old messages teeskovadaniki (login ayina user matrame)
app.get("/api/messages/:room", authMiddleware, async (req, res) => {
  try {
    const { room } = req.params;

    if (!canAccessRoom(room, req.user.userId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const messages = await Message.find({ room })
      .sort({ createdAt: 1 })
      .limit(200);

    return res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Get Messages Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
    });
  }
});
// Chat lo choose cheyyadaniki users list (self tappa)
app.get("/api/users", authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.userId } })
      .select("name email");

    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Get Users Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

// ---------- 404 ----------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ---------- Socket.io ----------

const io = new Server(server, {
  cors: { origin: CLIENT_URL },
});

// Socket connect avvadaniki JWT token check
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Unauthorized"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("name");
    if (!user) return next(new Error("Unauthorized"));

    // Client nundi sender ni teeskodu, server lone set chestham
    socket.user = { id: user._id.toString(), name: user.name };
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  console.log(`${socket.user.name} connected (${socket.id})`);

  // Room join
  socket.on("joinRoom", (room) => {
    if (typeof room !== "string" || !canAccessRoom(room, socket.user.id)) {
      return socket.emit("errorMessage", "Room access denied");
    }
    socket.join(room);
    console.log(`${socket.user.name} joined ${room}`);
  });

  // Room leave
  socket.on("leaveRoom", (room) => {
    if (typeof room === "string") socket.leave(room);
  });

  // Message send
  socket.on("sendMessage", async ({ room, text } = {}) => {
    try {
      if (typeof text !== "string" || !text.trim()) return;

      if (!socket.rooms.has(room)) {
        return socket.emit("errorMessage", "Join the room first");
      }

      const message = await Message.create({
        room,
        sender: socket.user.id,
        senderName: socket.user.name,
        text: text.trim(),
      });

      io.to(room).emit("receiveMessage", message);
    } catch (error) {
      console.error("Send Message Error:", error);
      socket.emit("errorMessage", "Message send failed");
    }
  });

  socket.on("disconnect", () => {
    console.log(`${socket.user.name} disconnected`);
  });
});

// ---------- DB + Server Start ----------

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in .env");
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing in .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected successfully");

    server.listen(PORT, "127.0.0.1", () => {
      console.log(`Server running at http://127.0.0.1:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();