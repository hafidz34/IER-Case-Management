import { NavLink } from "react-router-dom";

const NAV = [
  { to: "/", label: "Dashboard", icon: "D" },
  { to: "/cases/new", label: "Input Case", icon: "I" },
  { to: "/master", label: "Master Data", icon: "M" },
];

export default function Sidebar() {
  return (
    <aside className="app-sidebar">
      <nav className="app-sidebar__nav">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            className={({ isActive }) => `app-sidebar__link ${isActive ? "is-active" : ""}`}
            title={n.label}
          >
            <span className="nav-ico">{n.icon}</span>
            <span className="nav-text">{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
