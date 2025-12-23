import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import InputCase from "./pages/InputCase";
import MasterData from "./pages/master/MasterData";
import Login from "./pages/Login";

const PrivateRoute = () => {
  const token = localStorage.getItem("token");
  // Kalau tidak ada token, lempar ke login
  return token ? <Outlet /> : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <Routes>
      {/* Route Public */}
      <Route path="/login" element={<Login />} />

      {/* Route Private (Harus Login) */}
      <Route element={<PrivateRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cases/new" element={<InputCase />} />
          <Route path="/master" element={<MasterData />} />
        </Route>
      </Route>
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
