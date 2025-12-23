import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import ToastHost from "../components/ToastHost";

export default function AppLayout() {
  return (
    <div className="app-root">
      <ToastHost />
      <Header />

      <div className="app-body">
        <Sidebar />

        <main className="app-main">
          <div className="app-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
