
import { useEffect, useState } from "react";
import { checkBackend } from "./api";
import "./App.css";

const initialContacts = [
  {
    id: 1,
    name: "Rahul",
    avatar: "R",
    color: "#dbeafe",
    online: true,
    messages: [
      { id: 1, text: "Hey! How are you?", from: "them", time: "10:30 AM" },
      { id: 2, text: "I'm good! How about you?", from: "me", time: "10:31 AM" },
      { id: 3, text: "Shall we work on our project?", from: "them", time: "10:32 AM" },
    ],
  },
  {
    id: 2,
    name: "Priya",
    avatar: "P",
    color: "#fce7f3",
    online: true,
    messages: [
      { id: 1, text: "Hello! Welcome to ChatApp.", from: "them", time: "09:15 AM" },
    ],
  },
  {
    id: 3,
    name: "Kiran",
    avatar: "K",
    color: "#dcfce7",
    online: false,
    messages: [
      { id: 1, text: "Let's connect later.", from: "them", time: "Yesterday" },
    ],
  },
  {
    id: 4,
    name: "Sneha",
    avatar: "S",
    color: "#fef3c7",
    online: true,
    messages: [],
  },
];

export default function App() {
  const [screen, setScreen] = useState("login");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeId, setActiveId] = useState(1);
  const [contacts, setContacts] = useState(initialContacts);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    checkBackend()
      .then((data) => setBackendStatus(data.message))
      .catch(() => setBackendStatus("Backend connection failed"));
  }, []);

  const activeContact = contacts.find((c) => c.id === activeId);

  async function handleAuth(e) {
    e.preventDefault();

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      alert("Please enter email and password.");
      return;
    }

    if (screen === "signup" && !userName.trim()) {
      alert("Please enter your name.");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setAuthLoading(true);

    try {
      // Current backend provides a test login endpoint only.
      // Signup is not implemented on the backend yet.
      if (screen === "signup") {
        alert("Signup API is not implemented yet. Please use Login to test the API.");
        return;
      }

      const response = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(data.message || "Login failed.");
        return;
      }

      setUserName(cleanEmail.split("@")[0]);
      setScreen("chat");
      setPassword("");
    } catch (error) {
      console.error("Login error:", error);
      alert("Backend connection failed. Please check your server.");
    } finally {
      setAuthLoading(false);
    }
  }

  function sendMessage(e) {
    e.preventDefault();

    const text = message.trim();

    if (!text || !activeContact) return;

    const newMessage = {
      id: Date.now(),
      text,
      from: "me",
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setContacts((old) =>
      old.map((contact) =>
        contact.id === activeId
          ? { ...contact, messages: [...contact.messages, newMessage] }
          : contact
      )
    );

    setMessage("");
  }

  function logout() {
    setPassword("");
    setScreen("login");
  }

  if (screen !== "chat") {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-mark">C</div>

          <h1>
            Chat<span>Space</span>
          </h1>

          <p className="muted">
            {screen === "login"
              ? "Welcome back! Sign in to continue."
              : "Create your account and start chatting."}
          </p>

          <form onSubmit={handleAuth} className="auth-form">
            {screen === "signup" && (
              <label>
                Full name
                <input
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
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
                autoComplete={
                  screen === "login" ? "current-password" : "new-password"
                }
                minLength={6}
                required
              />
            </label>

            <button
              className="primary-btn"
              type="submit"
              disabled={authLoading}
            >
              {authLoading
                ? "Please wait..."
                : screen === "login"
                  ? "Login"
                  : "Create account"}
            </button>
          </form>

          <p className="auth-switch">
            {screen === "login"
              ? "Don't have an account?"
              : "Already registered?"}

            <button
              className="text-btn"
              type="button"
              onClick={() =>
                setScreen(screen === "login" ? "signup" : "login")
              }
            >
              {screen === "login" ? "Sign up" : "Login"}
            </button>
          </p>

          <p className="demo-note">
            Test login only — user accounts are not saved yet.
          </p>

          <p>
            Backend: <strong>{backendStatus}</strong>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="chat-app">
      <aside className="sidebar">
        <header className="sidebar-header">
          <div className="brand-mark small">C</div>

          <div>
            <h2>ChatSpace</h2>
            <span className="muted">Messages made simple</span>
          </div>

          <button
            className="icon-btn"
            title="Logout"
            onClick={logout}
          >
            ↪
          </button>
        </header>

        <div className="profile-row">
          <div className="avatar my-avatar">
            {(userName || "U").charAt(0).toUpperCase()}
          </div>

          <div>
            <strong>{userName || "You"}</strong>
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
          {contacts
            .filter((c) =>
              c.name.toLowerCase().includes(search.toLowerCase())
            )
            .map((contact) => {
              const last = contact.messages[contact.messages.length - 1];

              return (
                <button
                  key={contact.id}
                  className={`contact ${
                    activeId === contact.id ? "selected" : ""
                  }`}
                  onClick={() => setActiveId(contact.id)}
                >
                  <div
                    className="avatar"
                    style={{ backgroundColor: contact.color }}
                  >
                    {contact.avatar}
                    {contact.online && <i className="online-dot" />}
                  </div>

                  <div className="contact-info">
                    <strong>{contact.name}</strong>
                    <span>{last ? last.text : "Start a conversation"}</span>
                  </div>
                </button>
              );
            })}
        </div>
      </aside>

      <section className="conversation">
        {activeContact ? (
          <>
            <header className="conversation-header">
              <div
                className="avatar"
                style={{ backgroundColor: activeContact.color }}
              >
                {activeContact.avatar}
              </div>

              <div>
                <h2>{activeContact.name}</h2>
                <span
                  className={
                    activeContact.online ? "online-label" : "muted"
                  }
                >
                  {activeContact.online ? "● Online" : "Offline"}
                </span>
              </div>
            </header>

            <div className="messages-area">
              <div className="date-divider">
                <span>Today</span>
              </div>

              {activeContact.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`message-row ${
                    msg.from === "me" ? "mine" : ""
                  }`}
                >
                  <div className="message-bubble">
                    <p>{msg.text}</p>
                    <span>{msg.time}</span>
                  </div>
                </div>
              ))}

              {activeContact.messages.length === 0 && (
                <div className="empty-chat">
                  <div className="empty-icon">✉</div>
                  <h3>Say hello to {activeContact.name}!</h3>
                  <p>Your conversation starts here.</p>
                </div>
              )}
            </div>

            <form className="message-form" onSubmit={sendMessage}>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Message ${activeContact.name}...`}
                aria-label="Type your message"
              />

              <button
                type="submit"
                className="send-btn"
                disabled={!message.trim()}
              >
                Send <span>➤</span>
              </button>
            </form>
          </>
        ) : (
          <div className="empty-chat">
            Select a contact to start chatting.
          </div>
        )}
      </section>
    </main>
  );
}
