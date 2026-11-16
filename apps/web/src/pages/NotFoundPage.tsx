import { Link } from "react-router-dom";
import Backdrop from "../components/Backdrop";

export default function NotFoundPage() {
  return (
    <div className="app">
      <Backdrop />
      <main className="auth">
        <Link to="/" className="brand auth-brand">
          <span className="logo" aria-hidden="true" />
          Uptime Monitor
        </Link>
        <section className="card stack auth-card">
          <h1>Page not found</h1>
          <p className="muted">The page you are looking for does not exist.</p>
          <Link to="/">Go to the home page</Link>
        </section>
      </main>
    </div>
  );
}
