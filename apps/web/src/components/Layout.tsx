import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import Backdrop from "./Backdrop";

export default function Layout() {
  const { logout } = useAuth();
  return (
    <div className="app">
      <Backdrop />
      <div className="app-content">
        <header className="topbar">
          <h1>
            <Link to="/" className="brand">
              <span className="logo" aria-hidden="true" />
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
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
