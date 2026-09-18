import { useState } from "react";
import { login } from "./api";
import { Face } from "./Face";
import { SATISFACTION_LEVELS } from "./satisfaction";

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
      <section className="login-brand">
        <div className="login-brand-content">
          <h1 className="login-brand-title">VotoKiosco</h1>
          <p className="login-brand-subtitle">Panel de satisfacción del comedor</p>
          <div className="login-brand-faces">
            {SATISFACTION_LEVELS.map((level, i) => (
              <Face key={level.key} mood={level.key} size={56} delay={i * 0.15} />
            ))}
          </div>
        </div>
      </section>

      <section className="login-form-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <h2>Bienvenido de nuevo</h2>
          <p className="muted">Ingresa con tu cuenta de RRHH/supervisión</p>

          <label htmlFor="email">Correo</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />

          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="error">{error}</p>}

          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </section>
    </div>
  );
}
