import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

export default function Layout() {
  const { logout } = useAuth();
  return (
    <main className="dashboard">
      <header className="topbar">
        <h1>Uptime Monitor</h1>
        <nav aria-label="Main">
          <NavLink to="/" end>
            Monitors
          </NavLink>
          <NavLink to="/incidents">Incidents</NavLink>
          <NavLink to="/alerts">Alerts</NavLink>
        </nav>
        <button type="button" className="link" onClick={logout}>
          Log out
        </button>
      </header>
      <Outlet />
    </main>
  );
}
