type Props = {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
};

export default function Header({ sidebarOpen, setSidebarOpen }: Props) {
  return (
    <header className="app-header">
      <div className="app-header__left">
        <button
          type="button"
          aria-pressed={sidebarOpen}
          aria-label={sidebarOpen ? "Sembunyikan menu" : "Tampilkan menu"}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            marginRight: 12,
            border: "1px solid var(--border)",
            background: "#fff",
            borderRadius: 10,
            height: 36,
            padding: "0 14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Menu
        </button>

        <div className="header-logo">
          <img src="/spil.png" alt="SPIL" />
        </div>
        <div className="app-header__title">IER Case</div>
      </div>
    </header>
  );
}
