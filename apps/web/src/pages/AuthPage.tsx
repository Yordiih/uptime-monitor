import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { describeError } from "../api";
import { useAuth } from "../auth";
import { authModeFromSearch } from "../authMode";
import Backdrop from "../components/Backdrop";

export default function AuthPage() {
  const { token, login, register } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<"login" | "register">(authModeFromSearch(location.search));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (token) {
    return <Navigate to="/app" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <Backdrop />
      <main className="auth">
        <Link to="/" className="brand auth-brand">
          <span className="logo" aria-hidden="true" />
          Uptime Monitor
        </Link>
        <form className="card stack auth-card" onSubmit={onSubmit}>
          <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="muted small">
            {mode === "login"
              ? "Log in to see your monitors."
              : "Start watching a site in under a minute."}
          </p>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              maxLength={72}
              required
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Log in" : "Register"}
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? "Need an account? Register" : "Have an account? Log in"}
          </button>
        </form>
        <p className="muted small auth-back">
          <Link to="/">Back to home</Link>
        </p>
      </main>
    </div>
  );
}
