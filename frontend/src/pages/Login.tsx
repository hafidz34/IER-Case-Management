import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { client } from "../api/client";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await client.post<{ access_token: string }>("/auth/login", { username, password });
      localStorage.setItem("token", data.access_token);
      navigate("/");
    } catch (err: any) {
      setError(err?.message || "Login gagal");
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "100px" }}>
      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", width: "300px", gap: "10px" }}>
        <h2>Login SPIL IER Case</h2>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <input 
          type="text" 
          placeholder="Username" 
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          required 
          style={{ padding: "8px" }}
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
          style={{ padding: "8px" }}
        />
        <button type="submit" style={{ padding: "10px", cursor: "pointer" }}>Login</button>
      </form>
    </div>
  );
}
