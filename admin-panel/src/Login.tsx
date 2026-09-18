import { useState } from "react";
import { login } from "./api";
import { Face } from "./Face";

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <section className="login-blob-panel">
        <div className="login-blob" />
        <div className="login-illustration">
          <div className="chat-bubble chat-bubble-big">
            <Face mood="muy_satisfecho" size={64} />
          </div>
          <div className="chat-bubble chat-bubble-small">
            <Face mood="satisfecho" size={40} delay={0.2} />
          </div>
        </div>
        <div className="login-blob-text">
          <h1>VotoKiosco</h1>
          <p>Estamos pendientes de tu trato y tu experiencia todos los días</p>
        </div>
      </section>

      <section className="login-form-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <h2>Inicio de sesión</h2>
          <p className="muted">Ingresa tus credenciales para ver los resultados</p>

          <label htmlFor="email">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />

          <label htmlFor="password">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="11" width="16" height="9" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="error">{error}</p>}

          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>
      </section>
    </div>
  );
}
