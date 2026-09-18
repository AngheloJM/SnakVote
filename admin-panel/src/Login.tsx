import { useState } from "react";
import { login } from "./api";
import { ConectaLogo } from "./ConectaLogo";
import { Face } from "./Face";
import type { Satisfaction } from "./types";

const RISING_BUBBLES: {
  left: number;
  size: number;
  mood: Satisfaction;
  duration: number;
  delay: number;
}[] = [
  { left: 6, size: 52, mood: "muy_satisfecho", duration: 14, delay: 0 },
  { left: 20, size: 36, mood: "satisfecho", duration: 11, delay: 2.2 },
  { left: 36, size: 64, mood: "muy_satisfecho", duration: 17, delay: 4.5 },
  { left: 13, size: 30, mood: "satisfecho", duration: 9, delay: 6.5 },
  { left: 29, size: 46, mood: "muy_satisfecho", duration: 13, delay: 1.2 },
  { left: 3, size: 40, mood: "satisfecho", duration: 15.5, delay: 8.5 },
  { left: 41, size: 34, mood: "muy_satisfecho", duration: 10, delay: 3.5 },
  { left: 23, size: 56, mood: "satisfecho", duration: 18, delay: 5.8 },
];

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
        <svg className="login-blob" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="blobGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#041476" />
              <stop offset="75%" stopColor="#2454c6" />
            </linearGradient>
          </defs>
          <path
            className="wave-tall"
            d="M0,0 L88,0 C74,10 94,20 80,30 C68,40 90,48 76,58 C64,66 86,74 72,84 C60,92 68,97 58,100 L0,100 Z"
            fill="url(#blobGrad)"
          />
          <path
            className="wave-wide"
            d="M0,0 L100,0 L100,68 C88,78 82,62 70,72 C58,82 52,66 40,76 C28,86 22,70 10,80 C6,83 3,79 0,82 Z"
            fill="url(#blobGrad)"
          />
        </svg>
        <ConectaLogo />
        <div className="login-illustration">
          {RISING_BUBBLES.map((b, i) => (
            <div
              key={i}
              className="chat-bubble bubble-rise"
              style={{
                width: b.size,
                height: b.size,
                left: `${b.left}%`,
                animationDuration: `${b.duration}s`,
                animationDelay: `${b.delay}s`,
              }}
            >
              <Face mood={b.mood} size={b.size * 0.68} />
            </div>
          ))}
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
