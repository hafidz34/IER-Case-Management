import { NavLink } from "react-router-dom";

type Props = {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
};

const NAV = [
  { to: "/", label: "Dashboard", icon: "D" },
  { to: "/cases/new", label: "Input Case", icon: "I" },
  { to: "/master", label: "Master Data", icon: "M" },
];

export default function Sidebar({ sidebarOpen, setSidebarOpen }: Props) {
  const handleNavClick = () => {
    if (typeof window === "undefined") return;
    const shouldClose = window.matchMedia("(max-width: 1024px)").matches;
    if (shouldClose) {
      setSidebarOpen(false);
    }
  };

  return (
    <aside className={`app-sidebar ${sidebarOpen ? "is-open" : ""}`} aria-hidden={!sidebarOpen}>
      <nav className="app-sidebar__nav">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            className={({ isActive }) => `app-sidebar__link ${isActive ? "is-active" : ""}`}
            title={n.label}
            onClick={handleNavClick}
          >
            <span className="nav-ico">{n.icon}</span>
            <span className="nav-text">{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
