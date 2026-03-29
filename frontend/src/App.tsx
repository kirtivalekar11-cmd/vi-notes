import React, { useMemo, useState } from "react";
import jsPDF from "jspdf";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

type LogEntry = {
  key: string;
  time: number;
};

type UserType = {
  id: string;
  name: string;
  email: string;
};

type SavedSession = {
  _id?: string;
  text: string;
  log: LogEntry[];
  pauses: number[];
  suspicious: string[];
  score: number;
  wpm: number;
  createdAt: string;
};

function App() {
  const [text, setText] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [lastTime, setLastTime] = useState<number | null>(null);
  const [pauses, setPauses] = useState<number[]>([]);
  const [suspicious, setSuspicious] = useState<string[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [replayText, setReplayText] = useState("");
  const [isReplaying, setIsReplaying] = useState(false);
  const [lastPasteTime, setLastPasteTime] = useState<number>(0);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState<UserType | null>(
    JSON.parse(localStorage.getItem("user") || "null")
  );
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const theme = useMemo(
    () => ({
      pageBg: darkMode
        ? "linear-gradient(135deg, #0f172a 0%, #111827 45%, #1e1b4b 100%)"
        : "linear-gradient(135deg, #f8fafc 0%, #eef2ff 45%, #e0f2fe 100%)",
      panel: darkMode ? "rgba(15, 23, 42, 0.82)" : "rgba(255, 255, 255, 0.88)",
      panelSolid: darkMode ? "#111827" : "#ffffff",
      card: darkMode ? "rgba(17, 24, 39, 0.9)" : "#ffffff",
      cardAlt: darkMode ? "rgba(30, 41, 59, 0.82)" : "#f8fafc",
      text: darkMode ? "#f8fafc" : "#0f172a",
      muted: darkMode ? "#94a3b8" : "#475569",
      border: darkMode ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.08)",
      inputBg: darkMode ? "#0f172a" : "#ffffff",
      textareaBg: darkMode ? "#020617" : "#ffffff",
      replayBg: darkMode ? "#020617" : "#0f172a",
      replayText: "#22c55e",
      scoreGood: "#22c55e",
      scoreMid: "#f59e0b",
      scoreLow: "#ef4444",
      shadow: darkMode
        ? "0 18px 45px rgba(0, 0, 0, 0.35)"
        : "0 18px 45px rgba(15, 23, 42, 0.10)"
    }),
    [darkMode]
  );

  const getScoreColor = (score: number) => {
    if (score > 75) return theme.scoreGood;
    if (score > 50) return theme.scoreMid;
    return theme.scoreLow;
  };

  const openAuthModal = (mode: "login" | "signup") => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const logPaste = (message: string) => {
    const now = Date.now();

    if (now - lastPasteTime < 300) return;

    setLastPasteTime(now);
    setSuspicious((prev) => [
      ...prev,
      `${message} at ${new Date().toLocaleTimeString()}`
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const now = Date.now();

    if (e.ctrlKey && e.key.toLowerCase() === "v") {
      logPaste("🚨 Paste detected");
    }

    if (lastTime) {
      const diff = now - lastTime;
      if (diff > 1000) {
        setPauses((prev) => [...prev, diff]);
      }
    }

    setLastTime(now);
    setLog((prev) => [...prev.slice(-500), { key: e.key, time: now }]);
  };

  const calculateScore = () => {
    let score = 50;
    const reasons: string[] = [];

    if (suspicious.length > 0) {
      score -= Math.min(suspicious.length * 25, 50);
      reasons.push("Paste detected");
    } else {
      score += 10;
    }

    if (pauses.length === 0) {
      score -= 15;
      reasons.push("No pauses");
    } else if (pauses.length < 3) {
      score += 5;
    } else {
      score += 15;
      reasons.push("Natural pauses");
    }

    const backspaces = log.filter((l) => l.key === "Backspace").length;
    if (backspaces > 0) {
      score += 5;
      reasons.push("Corrections detected");
    }

    if (log.length > 50) score += 10;
    if (text.length < 20) score -= 15;

    score = Math.max(0, Math.min(100, score));

    return { score, reasons };
  };

  const result = calculateScore();

  const calculateWPM = () => {
    if (log.length < 2) return 0;

    const timeDiff = (log[log.length - 1].time - log[0].time) / 1000 / 60;

    if (timeDiff < 0.1) return 0;

    const words = text.trim().length > 0 ? text.trim().split(/\s+/).length : 0;

    return Math.round(words / timeDiff);
  };

  const getChartData = () => {
    if (log.length === 0) return [];
    const startTime = log[0].time;

    return log.map((entry, index) => ({
      time: ((entry.time - startTime) / 1000).toFixed(1),
      keystroke: index + 1
    }));
  };

  const handleSignup = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Signup failed");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);
      setAuthModalOpen(false);
      alert("Signup successful");
    } catch (error: any) {
      alert(error.message || "Signup failed");
    }
  };

  const handleLogin = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);
      setAuthModalOpen(false);
      alert("Login successful");
    } catch (error: any) {
      alert(error.message || "Login failed");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken("");
    setUser(null);
    setSavedSessions([]);
  };

  const saveSession = async () => {
    try {
      if (!token) {
        alert("Please login first");
        return;
      }

      const response = await fetch("http://localhost:5000/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          text,
          log,
          pauses,
          suspicious,
          score: result.score,
          wpm: calculateWPM()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save session");
      }

      alert("Session saved successfully");
    } catch (error: any) {
      alert(error.message || "Failed to save session");
    }
  };

  const fetchSessions = async () => {
    try {
      if (!token) {
        alert("Please login first");
        return;
      }

      const response = await fetch("http://localhost:5000/api/sessions", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch sessions");
      }

      setSavedSessions(data);
    } catch (error: any) {
      alert(error.message || "Failed to fetch sessions");
    }
  };

  const generateReport = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Vi-Notes Authenticity Report", 20, 20);

    doc.setFontSize(12);
    doc.text(`Score: ${result.score}% Human`, 20, 40);

    doc.text("Stats:", 20, 60);
    doc.text(`Typing Speed: ${calculateWPM()} WPM`, 20, 70);
    doc.text(`Pauses: ${pauses.length}`, 20, 80);
    doc.text(`Suspicious Events: ${suspicious.length}`, 20, 90);

    doc.text("Reasons:", 20, 110);
    result.reasons.forEach((r, i) => {
      doc.text(`- ${r}`, 20, 120 + i * 10);
    });

    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 180);
    doc.save("vi-notes-report.pdf");
  };

  const startReplay = () => {
    if (log.length === 0) return;

    setReplayText("");
    setIsReplaying(true);

    let index = 0;

    const play = () => {
      if (index >= log.length) {
        setIsReplaying(false);
        return;
      }

      const current = log[index];

      if (current) {
        if (current.key === "Backspace") {
          setReplayText((prev) => prev.slice(0, -1));
        } else if (current.key === " ") {
          setReplayText((prev) => prev + " ");
        } else if (current.key === "Enter") {
          setReplayText((prev) => prev + "\n");
        } else if (current.key.length === 1) {
          setReplayText((prev) => prev + current.key);
        }
      }

      const delay = index === 0 ? 100 : log[index].time - log[index - 1].time;

      index++;
      setTimeout(play, delay);
    };

    play();
  };

  const resetAll = () => {
    setText("");
    setLog([]);
    setPauses([]);
    setSuspicious([]);
    setReplayText("");
    setIsReplaying(false);
    setLastTime(null);
  };

  const duration =
    log.length > 0 ? (log[log.length - 1].time - log[0].time) / 1000 : 0;

  const appShellStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: theme.pageBg,
    color: theme.text,
    padding: "24px"
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: "1280px",
    margin: "0 auto"
  };

  const glassCardStyle: React.CSSProperties = {
    background: theme.panel,
    backdropFilter: "blur(12px)",
    border: `1px solid ${theme.border}`,
    borderRadius: "22px",
    boxShadow: theme.shadow
  };

  const cardStyle: React.CSSProperties = {
    background: theme.card,
    color: theme.text,
    padding: "22px",
    borderRadius: "20px",
    border: `1px solid ${theme.border}`,
    boxShadow: theme.shadow
  };

  const inputStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "14px 16px",
    borderRadius: "14px",
    border: `1px solid ${theme.border}`,
    background: theme.inputBg,
    color: theme.text,
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box"
  };

  const textareaStyle: React.CSSProperties = {
    width: "100%",
    minHeight: "240px",
    padding: "16px",
    borderRadius: "16px",
    border: `1px solid ${theme.border}`,
    background: theme.textareaBg,
    color: theme.text,
    fontSize: "15px",
    lineHeight: 1.6,
    resize: "vertical",
    boxSizing: "border-box"
  };

  const baseButtonStyle: React.CSSProperties = {
    border: "none",
    borderRadius: "14px",
    padding: "12px 18px",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(0,0,0,0.18)"
  };

  const topButtonStyle = (bg: string): React.CSSProperties => ({
    ...baseButtonStyle,
    background: bg
  });

  const statCardStyle: React.CSSProperties = {
    background: theme.cardAlt,
    border: `1px solid ${theme.border}`,
    borderRadius: "18px",
    padding: "18px",
    boxShadow: theme.shadow,
    position: "relative",
    overflow: "hidden"
  };

  const modalOverlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(2, 6, 23, 0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1000
  };

  const modalStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "460px",
    background: theme.card,
    color: theme.text,
    borderRadius: "24px",
    border: `1px solid ${theme.border}`,
    boxShadow: theme.shadow,
    padding: "24px"
  };

  return (
    <div style={appShellStyle}>
      <div style={containerStyle}>
        <div
          style={{
            ...glassCardStyle,
            padding: "18px 22px",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap"
          }}
        >
          <div>
            <div
              style={{
                fontSize: "13px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: theme.muted,
                marginBottom: "6px"
              }}
            >
              Writing Intelligence Dashboard
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: "28px",
                lineHeight: 1.1
              }}
            >
              🧠 Vi-Notes Pro
            </h1>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap"
            }}
          >
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={topButtonStyle(
                darkMode
                  ? "linear-gradient(135deg, #f59e0b, #f97316)"
                  : "linear-gradient(135deg, #334155, #0f172a)"
              )}
            >
              {darkMode ? "☀️ Light" : "🌙 Dark"}
            </button>

            <button
              onClick={resetAll}
              style={topButtonStyle("linear-gradient(135deg, #ef4444, #dc2626)")}
            >
              🔄 Reset
            </button>

            {user ? (
              <>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px",
                    background: darkMode ? "#0f172a" : "#ffffff",
                    border: `1px solid ${theme.border}`,
                    color: theme.text,
                    fontWeight: 600
                  }}
                >
                  {user.name}
                </div>

                <button
                  onClick={handleLogout}
                  style={topButtonStyle("linear-gradient(135deg, #f43f5e, #e11d48)")}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => openAuthModal("login")}
                  style={topButtonStyle("linear-gradient(135deg, #3b82f6, #2563eb)")}
                >
                  Login
                </button>

                <button
                  onClick={() => openAuthModal("signup")}
                  style={topButtonStyle("linear-gradient(135deg, #10b981, #059669)")}
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            ...glassCardStyle,
            padding: "26px",
            marginBottom: "24px"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap"
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "38px",
                  lineHeight: 1.1
                }}
              >
                Smart Writing Analysis
              </h2>
              <p
                style={{
                  margin: "10px 0 0",
                  color: theme.muted,
                  fontSize: "15px",
                  maxWidth: "760px"
                }}
              >
                Track typing behavior, detect suspicious activity, replay writing
                flow, save authenticated sessions, and export authenticity
                reports.
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "18px",
            marginBottom: "24px"
          }}
        >
          <div style={statCardStyle}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "4px",
                background: "linear-gradient(90deg, #3b82f6, #60a5fa)"
              }}
            />
            <div style={{ color: theme.muted, fontSize: "13px", marginBottom: "8px" }}>
              Typing Speed
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800 }}>
              {calculateWPM()}
              <span style={{ fontSize: "14px", color: theme.muted, marginLeft: "6px" }}>
                WPM
              </span>
            </div>
          </div>

          <div style={statCardStyle}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "4px",
                background: "linear-gradient(90deg, #8b5cf6, #a78bfa)"
              }}
            />
            <div style={{ color: theme.muted, fontSize: "13px", marginBottom: "8px" }}>
              Pauses
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800 }}>{pauses.length}</div>
          </div>

          <div style={statCardStyle}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "4px",
                background: `linear-gradient(90deg, ${getScoreColor(
                  result.score
                )}, ${getScoreColor(result.score)})`
              }}
            />
            <div style={{ color: theme.muted, fontSize: "13px", marginBottom: "8px" }}>
              Human Score
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: getScoreColor(result.score) }}>
              {result.score}%
            </div>
          </div>

          <div style={statCardStyle}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "4px",
                background: "linear-gradient(90deg, #ec4899, #f472b6)"
              }}
            />
            <div style={{ color: theme.muted, fontSize: "13px", marginBottom: "8px" }}>
              Session Duration
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800 }}>
              {duration.toFixed(1)}
              <span style={{ fontSize: "14px", color: theme.muted, marginLeft: "6px" }}>
                sec
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1.3fr)",
            gap: "24px",
            alignItems: "start"
          }}
        >
          <div style={{ display: "grid", gap: "24px" }}>
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, fontSize: "24px" }}>📊 Analysis Summary</h2>

              <div style={{ display: "grid", gap: "12px" }}>
                <div
                  style={{
                    background: theme.cardAlt,
                    border: `1px solid ${theme.border}`,
                    borderRadius: "16px",
                    padding: "14px"
                  }}
                >
                  <div style={{ color: theme.muted, fontSize: "13px", marginBottom: "4px" }}>
                    Human Authenticity Score
                  </div>
                  <div
                    style={{
                      fontSize: "26px",
                      fontWeight: 800,
                      color: getScoreColor(result.score)
                    }}
                  >
                    {result.score}%
                  </div>
                </div>

                <div
                  style={{
                    background: theme.cardAlt,
                    border: `1px solid ${theme.border}`,
                    borderRadius: "16px",
                    padding: "14px"
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: "8px" }}>Reasons</div>
                  {result.reasons.length === 0 ? (
                    <div style={{ color: theme.muted }}>No reasons yet.</div>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: "20px", color: theme.text }}>
                      {result.reasons.map((reason, index) => (
                        <li key={index} style={{ marginBottom: "6px" }}>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div
                  style={{
                    background: theme.cardAlt,
                    border: `1px solid ${theme.border}`,
                    borderRadius: "16px",
                    padding: "14px"
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: "8px" }}>Suspicious Events</div>
                  {suspicious.length === 0 ? (
                    <div style={{ color: theme.muted }}>No suspicious activity detected.</div>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: "20px" }}>
                      {suspicious.map((item, index) => (
                        <li key={index} style={{ marginBottom: "6px", color: theme.text }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, fontSize: "24px" }}>🎥 Typing Replay</h2>
              <button
                onClick={startReplay}
                disabled={isReplaying}
                style={{
                  ...baseButtonStyle,
                  background: isReplaying
                    ? "linear-gradient(135deg, #64748b, #475569)"
                    : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                  marginBottom: "14px",
                  opacity: isReplaying ? 0.7 : 1
                }}
              >
                ▶️ {isReplaying ? "Replaying..." : "Start Replay"}
              </button>

              <div
                style={{
                  marginTop: "8px",
                  padding: "18px",
                  minHeight: "160px",
                  borderRadius: "16px",
                  background: theme.replayBg,
                  color: theme.replayText,
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  border: `1px solid ${theme.border}`,
                  boxSizing: "border-box"
                }}
              >
                {replayText || "Your typing replay will appear here..."}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "24px" }}>
            <div style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "16px",
                  flexWrap: "wrap"
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: "24px" }}>✍️ Writing Area</h2>
                  <p style={{ margin: "6px 0 0", color: theme.muted }}>
                    Type naturally to generate rhythm, pause, and replay data.
                  </p>
                </div>
                <div
                  style={{
                    background: darkMode ? "#0f172a" : "#eff6ff",
                    color: theme.muted,
                    border: `1px solid ${theme.border}`,
                    padding: "10px 14px",
                    borderRadius: "14px",
                    fontSize: "13px",
                    fontWeight: 700
                  }}
                >
                  {text.trim().length > 0
                    ? `${text.trim().split(/\s+/).length} words`
                    : "0 words"}
                </div>
              </div>

              <textarea
                rows={10}
                style={textareaStyle}
                value={text}
                onChange={(e) => {
                  const newText = e.target.value;

                  if (newText.length - text.length > 20) {
                    logPaste("🚨 Paste detected");
                  }

                  setText(newText);
                }}
                onPaste={() => {
                  logPaste("🚨 Paste detected");
                }}
                onKeyDown={handleKeyDown}
                placeholder="Start typing here..."
              />

              <div
                style={{
                  marginTop: "18px",
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap"
                }}
              >
                <button
                  onClick={saveSession}
                  style={{
                    ...baseButtonStyle,
                    background: "linear-gradient(135deg, #3b82f6, #2563eb)"
                  }}
                >
                  💾 Save Session
                </button>

                <button
                  onClick={fetchSessions}
                  style={{
                    ...baseButtonStyle,
                    background: "linear-gradient(135deg, #8b5cf6, #7c3aed)"
                  }}
                >
                  📂 Load Sessions
                </button>

                <button
                  onClick={generateReport}
                  style={{
                    ...baseButtonStyle,
                    background: "linear-gradient(135deg, #10b981, #059669)"
                  }}
                >
                  📥 Download Report
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, fontSize: "24px" }}>📈 Typing Graph</h2>
              <div
                style={{
                  width: "100%",
                  height: "320px",
                  background: theme.cardAlt,
                  border: `1px solid ${theme.border}`,
                  borderRadius: "16px",
                  padding: "12px",
                  boxSizing: "border-box"
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getChartData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#334155" : "#cbd5e1"} />
                    <XAxis dataKey="time" stroke={theme.muted} />
                    <YAxis stroke={theme.muted} />
                    <Tooltip />
                    <Line type="monotone" dataKey="keystroke" stroke="#8b5cf6" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, fontSize: "24px" }}>📚 Saved Sessions</h2>

              {savedSessions.length === 0 ? (
                <div
                  style={{
                    background: theme.cardAlt,
                    border: `1px solid ${theme.border}`,
                    borderRadius: "16px",
                    padding: "18px",
                    color: theme.muted
                  }}
                >
                  No sessions loaded yet.
                </div>
              ) : (
                <div style={{ display: "grid", gap: "14px" }}>
                  {savedSessions.map((session, index) => (
                    <div
                      key={session._id || index}
                      style={{
                        background: theme.cardAlt,
                        border: `1px solid ${theme.border}`,
                        borderRadius: "16px",
                        padding: "16px"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          flexWrap: "wrap",
                          marginBottom: "10px"
                        }}
                      >
                        <strong style={{ fontSize: "16px" }}>
                          Session {savedSessions.length - index}
                        </strong>
                        <span style={{ color: theme.muted, fontSize: "13px" }}>
                          {new Date(session.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <p style={{ margin: "0 0 10px", color: theme.text }}>
                        <strong>Text:</strong> {session.text || "No text"}
                      </p>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: "10px"
                        }}
                      >
                        <div
                          style={{
                            background: theme.panelSolid,
                            borderRadius: "12px",
                            padding: "12px",
                            border: `1px solid ${theme.border}`
                          }}
                        >
                          <div style={{ color: theme.muted, fontSize: "12px" }}>Score</div>
                          <div style={{ fontWeight: 800, color: getScoreColor(session.score) }}>
                            {session.score}
                          </div>
                        </div>

                        <div
                          style={{
                            background: theme.panelSolid,
                            borderRadius: "12px",
                            padding: "12px",
                            border: `1px solid ${theme.border}`
                          }}
                        >
                          <div style={{ color: theme.muted, fontSize: "12px" }}>WPM</div>
                          <div style={{ fontWeight: 800 }}>{session.wpm}</div>
                        </div>

                        <div
                          style={{
                            background: theme.panelSolid,
                            borderRadius: "12px",
                            padding: "12px",
                            border: `1px solid ${theme.border}`
                          }}
                        >
                          <div style={{ color: theme.muted, fontSize: "12px" }}>Pauses</div>
                          <div style={{ fontWeight: 800 }}>{session.pauses?.length || 0}</div>
                        </div>

                        <div
                          style={{
                            background: theme.panelSolid,
                            borderRadius: "12px",
                            padding: "12px",
                            border: `1px solid ${theme.border}`
                          }}
                        >
                          <div style={{ color: theme.muted, fontSize: "12px" }}>
                            Suspicious
                          </div>
                          <div style={{ fontWeight: 800 }}>
                            {session.suspicious?.length || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {authModalOpen && (
          <div style={modalOverlayStyle} onClick={closeAuthModal}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "18px"
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: "28px" }}>
                    {authMode === "login" ? "Welcome back" : "Create account"}
                  </h2>
                  <p style={{ margin: "6px 0 0", color: theme.muted }}>
                    {authMode === "login"
                      ? "Login to save and load your sessions."
                      : "Sign up to start tracking your writing sessions."}
                  </p>
                </div>

                <button
                  onClick={closeAuthModal}
                  style={{
                    background: "transparent",
                    border: `1px solid ${theme.border}`,
                    borderRadius: "12px",
                    padding: "10px 12px",
                    color: theme.text,
                    cursor: "pointer",
                    fontWeight: 700
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: "grid", gap: "12px" }}>
                {authMode === "signup" && (
                  <input
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={inputStyle}
                  />
                )}

                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                />

                <button
                  onClick={authMode === "login" ? handleLogin : handleSignup}
                  style={{
                    ...baseButtonStyle,
                    background:
                      authMode === "login"
                        ? "linear-gradient(135deg, #3b82f6, #2563eb)"
                        : "linear-gradient(135deg, #10b981, #059669)",
                    marginTop: "4px"
                  }}
                >
                  {authMode === "login" ? "Login" : "Sign Up"}
                </button>

                <p
                  style={{
                    margin: "6px 0 0",
                    color: theme.muted,
                    fontSize: "14px",
                    textAlign: "center"
                  }}
                >
                  {authMode === "login"
                    ? "Don’t have an account?"
                    : "Already have an account?"}{" "}
                  <span
                    onClick={() =>
                      setAuthMode(authMode === "login" ? "signup" : "login")
                    }
                    style={{
                      color: darkMode ? "#60a5fa" : "#2563eb",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    {authMode === "login" ? "Sign Up" : "Login"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;