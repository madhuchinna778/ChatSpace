import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import "./App.css";

const API = "http://127.0.0.1:5000";
const COLORS = ["#dbeafe", "#fce7f3", "#dcfce7", "#fef3c7", "#ede9fe", "#ffedd5"];

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    return null;
  }
};

// Two users ki common room id (backend lo kuda same logic)
const roomFor = (a, b) => [a, b].sort().join("_");

const colorFor = (str = "") =>
  COLORS[[...str].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length];

const formatTime = (date) =>
  new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function App() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [me, setMe] = useState(getStoredUser());
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState("Checking...");

  // Chat state
  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");

  const socketRef = useRef(null);
  const activeRoomRef = useRef(null);

  const activeRoom = activeUser && me ? roomFor(me.id, activeUser._id) : null;
  activeRoomRef.current = activeRoom;

  const authConfig = { headers: { Authorization: `Bearer ${token}` } };

  // Backend health check (login screen lo status chupinchadaniki)
  useEffect(() => {
    fetch(`${API}/api/health`)
      .then((res) => res.json())
      .then((data) => setBackendStatus(data.message))
      .catch(() => setBackendStatus("Backend connection failed"));
  }, []);

  function logout() {
    socketRef.current?.disconnect();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setMe(null);
    setUsers([]);
    setActiveUser(null);
    setMessagesByRoom({});
    setPassword("");
  }

  // Token vunte socket connect + users load
  useEffect(() => {
    if (!token) return;

    const socket = io(API, { auth: { token } });
    socketRef.current = socket;

    // Reconnect ayithe current room lo malli join avvali
    socket.on("connect", () => {
      if (activeRoomRef.current) socket.emit("joinRoom", activeRoomRef.current);
    });

    socket.on("receiveMessage", (msg) => {
      setMessagesByRoom((prev) => ({
        ...prev,
        [msg.room]: [...(prev[msg.room] || []), msg],
      }));
    });

    socket.on("errorMessage", (msg) => alert(msg));

    socket.on("connect_error", (err) => {
      console.error("Socket error:", err.message);
    });

    axios
      .get(`${API}/api/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setUsers(res.data.users))
      .catch((err) => {
        console.error("Users load failed:", err);
        // Token expire ayithe logout
        if (err.response?.status === 401) logout();
      });

    return () => socket.disconnect();
  }, [token]);

  async function handleAuth(e) {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (mode === "signup" && !name.trim()) {
      alert("Please enter your name.");
      return;
    }
    if (!cleanEmail || !password) {
      alert("Please enter email and password.");
      return;
    }
    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setAuthLoading(true);

    try {
      if (mode === "signup") {
        await axios.post(`${API}/api/register`, {
          name: name.trim(),
          email: cleanEmail,
          password,
        });
      }

      const { data } = await axios.post(`${API}/api/login`, {
        email: cleanEmail,
        password,
      });

      const user = { id: data.user.id, name: data.user.name, email: data.user.email };

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(user));

      setToken(data.token);
      setMe(user);
      setName("");
      setPassword("");
    } catch (err) {
      alert(err.response?.data?.message || "Backend connection failed. Please check your server.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function openChat(user) {
    const room = roomFor(me.id, user._id);
    setActiveUser(user);
    socketRef.current?.emit("joinRoom", room);

    try {
      const { data } = await axios.get(`${API}/api/messages/${room}`, authConfig);

      // Old messages + socket lo ippatike vachina messages merge (duplicates ledu)
      setMessagesByRoom((prev) => {
        const existing = prev[room] || [];
        const ids = new Set(data.messages.map((m) => m._id));
        return {
          ...prev,
          [room]: [...data.messages, ...existing.filter((m) => !ids.has(m._id))],
        };
      });
    } catch (err) {
      console.error("Messages load failed:", err);
      alert(err.response?.data?.message || "Messages load cheyyaledu");
    }
  }

  function sendMessage(e) {
    e.preventDefault();

    const clean = text.trim();
    if (!clean || !activeRoom) return;

    // Server save chesi room lo andariki pampisthundi (receiveMessage)
    socketRef.current?.emit("sendMessage", { room: activeRoom, text: clean });
    setText("");
  }

  // ---------- Login / Signup screen ----------
  if (!token || !me) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-mark">C</div>

          <h1>
            Chat<span>Space</span>
          </h1>

          <p className="muted">
            {mode === "login"
              ? "Welcome back! Sign in to continue."
              : "Create your account and start chatting."}
          </p>

          <form onSubmit={handleAuth} className="auth-form">
            {mode === "signup" && (
              <label>
                Full name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required
                />
              </label>
            )}

            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={6}
                required
              />
            </label>

            <button className="primary-btn" type="submit" disabled={authLoading}>
              {authLoading
                ? "Please wait..."
                : mode === "login"
                  ? "Login"
                  : "Create account"}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "login" ? "Don't have an account?" : "Already registered?"}
            <button
              className="text-btn"
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Sign up" : "Login"}
            </button>
          </p>

          <p>
            Backend: <strong>{backendStatus}</strong>
          </p>
        </section>
      </main>
    );
  }

  // ---------- Chat screen ----------
  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  const currentMessages = activeRoom ? messagesByRoom[activeRoom] || [] : [];

  return (
    <main className="chat-app">
      <aside className="sidebar">
        <header className="sidebar-header">
          <div className="brand-mark small">C</div>

          <div>
            <h2>ChatSpace</h2>
            <span className="muted">Messages made simple</span>
          </div>

          <button className="icon-btn" title="Logout" onClick={logout}>
            ↪
          </button>
        </header>

        <div className="profile-row">
          <div className="avatar my-avatar">{me.name.charAt(0).toUpperCase()}</div>

          <div>
            <strong>{me.name}</strong>
            <span className="online-label">● Available</span>
          </div>
        </div>

        <h3 className="section-heading">MESSAGES</h3>

        <input
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people..."
        />

        <div className="contact-list">
          {filteredUsers.length === 0 && (
            <p className="muted" style={{ padding: 12 }}>
              Inka vere users ledu.
            </p>
          )}

          {filteredUsers.map((user) => {
            const room = roomFor(me.id, user._id);
            const roomMsgs = messagesByRoom[room] || [];
            const last = roomMsgs[roomMsgs.length - 1];

            return (
              <button
                key={user._id}
                className={`contact ${activeUser?._id === user._id ? "selected" : ""}`}
                onClick={() => openChat(user)}
              >
                <div className="avatar" style={{ backgroundColor: colorFor(user.name) }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>

                <div className="contact-info">
                  <strong>{user.name}</strong>
                  <span>{last ? last.text : "Start a conversation"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="conversation">
        {activeUser ? (
          <>
            <header className="conversation-header">
              <div className="avatar" style={{ backgroundColor: colorFor(activeUser.name) }}>
                {activeUser.name.charAt(0).toUpperCase()}
              </div>

              <div>
                <h2>{activeUser.name}</h2>
                <span className="muted">{activeUser.email}</span>
              </div>
            </header>

            <div className="messages-area">
              <div className="date-divider">
                <span>Today</span>
              </div>

              {currentMessages.map((msg) => {
                const isMine = msg.sender === me.id;

                return (
                  <div
                    key={msg._id}
                    className={`message-row ${isMine ? "mine" : ""}`}
                  >
                    <div className="message-bubble">
                      <p>{msg.text}</p>
                      <span>{formatTime(msg.createdAt)}</span>
                    </div>
                  </div>
                );
              })}

              {currentMessages.length === 0 && (
                <div className="empty-chat">
                  <div className="empty-icon">✉</div>
                  <h3>Say hello to {activeUser.name}!</h3>
                  <p>Your conversation starts here.</p>
                </div>
              )}
            </div>

            <form className="message-form" onSubmit={sendMessage}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Message ${activeUser.name}...`}
                aria-label="Type your message"
              />

              <button type="submit" className="send-btn" disabled={!text.trim()}>
                Send <span>➤</span>
              </button>
            </form>
          </>
        ) : (
          <div className="empty-chat">Select a contact to start chatting.</div>
        )}
      </section>
    </main>
  );
}