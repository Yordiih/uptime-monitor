import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

export default function Layout() {
  const { logout } = useAuth();
  return (
    <main className="dashboard">
      <header className="topbar">
        <h1>
          <Link to="/" className="brand">
            Uptime Monitor
          </Link>
        </h1>
        <nav aria-label="Main">
          <NavLink to="/app" end>
            Monitors
          </NavLink>
          <NavLink to="/app/incidents">Incidents</NavLink>
          <NavLink to="/app/alerts">Alerts</NavLink>
        </nav>
        <button type="button" className="link" onClick={logout}>
          Log out
        </button>
      </header>
      <Outlet />
    </main>
  );
}
