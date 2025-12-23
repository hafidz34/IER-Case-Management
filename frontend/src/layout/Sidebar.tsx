import { NavLink, useNavigate } from "react-router-dom";

const NAV = [
  { to: "/", label: "Dashboard", icon: "D" },
  { to: "/cases/new", label: "Input Case", icon: "I" },
  { to: "/master", label: "Master Data", icon: "M" },
];

export default function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Hapus token dari penyimpanan
    localStorage.removeItem("token");
    // Lempar user kembali ke halaman login
    navigate("/login");
  };

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
      <div style={{ marginTop: "auto" }}>
        <button
          onClick={handleLogout}
          className="app-sidebar__link logout-btn"
          title="Keluar Aplikasi"
          type="button"
        >
          <span className="nav-ico">L</span>
          <span className="nav-text">Logout</span>
        </button>
      </div>
    </aside>
  );
}
