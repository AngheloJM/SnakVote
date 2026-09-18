import { useEffect, useMemo, useState } from "react";
import { AuthError, clearToken, connectVotesSocket, fetchVotes, getToken, photoUrl, updateReason } from "./api";
import { DonutChart } from "./DonutChart";
import { Face } from "./Face";
import { Login } from "./Login";
import { SATISFACTION_BY_KEY, SATISFACTION_LEVELS } from "./satisfaction";
import type { Vote } from "./types";
import "./App.css";

function upsertVote(votes: Vote[], incoming: Vote): Vote[] {
  const idx = votes.findIndex((v) => v.id === incoming.id);
  if (idx === -1) return [incoming, ...votes];
  const next = [...votes];
  next[idx] = incoming;
  return next;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function App() {
  const [loggedIn, setLoggedIn] = useState(() => Boolean(getToken()));
  const [votes, setVotes] = useState<Vote[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Vote | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const [justArrivedId, setJustArrivedId] = useState<string | null>(null);

  function logout() {
    clearToken();
    setLoggedIn(false);
    setVotes([]);
  }

  useEffect(() => {
    if (!loggedIn) return;

    fetchVotes()
      .then(setVotes)
      .catch((err) => {
        if (err instanceof AuthError) logout();
        else console.error(err);
      });

    const disconnect = connectVotesSocket(
      (vote) => {
        setVotes((prev) => upsertVote(prev, vote));
        setJustArrivedId(vote.id);
        setTimeout(() => setJustArrivedId((id) => (id === vote.id ? null : id)), 2000);
      },
      setConnected,
    );
    return disconnect;
  }, [loggedIn]);

  const { counts, total } = useMemo(() => {
    const counts = Object.fromEntries(SATISFACTION_LEVELS.map((l) => [l.key, 0])) as Record<
      Vote["satisfaction"],
      number
    >;
    for (const vote of votes) counts[vote.satisfaction] = (counts[vote.satisfaction] ?? 0) + 1;
    return { counts, total: votes.length };
  }, [votes]);

  const positivos = counts.muy_satisfecho + counts.satisfecho;
  const negativos = counts.poco_satisfecho + counts.insatisfecho;
  const pctPositivo = total === 0 ? 0 : Math.round((positivos / total) * 100);

  function openVote(vote: Vote) {
    setSelectedPhoto(vote);
    setReasonDraft(vote.reason ?? "");
  }

  async function saveReason() {
    if (!selectedPhoto) return;
    try {
      const updated = await updateReason(selectedPhoto.id, reasonDraft);
      setVotes((prev) => upsertVote(prev, updated));
      setSelectedPhoto(updated);
    } catch (err) {
      if (err instanceof AuthError) logout();
      else console.error(err);
    }
  }

  if (!loggedIn) {
    return <Login onSuccess={() => setLoggedIn(true)} />;
  }

  return (
    <div className="viz-root">
      <header className="topbar">
        <h1>Satisfacción del comedor</h1>
        <div className="topbar-right">
          <span className={`status-dot ${connected ? "live" : ""}`}>
            {connected ? "En vivo" : "Conectando…"}
          </span>
          <button className="link-btn" onClick={logout}>Salir</button>
        </div>
      </header>

      <section className="tiles">
        <div className="tile">
          <div className="tile-label">Total de votos</div>
          <div className="tile-value">{total}</div>
        </div>

        <div className="tile" style={{ color: "#2454C6" }}>
          <div className="tile-label">Positivos</div>
          <div className="tile-value">{positivos}</div>
          <div className="tile-sub">{pctPositivo}% del total</div>
        </div>

        <div className="tile" style={{ color: "#E47704" }}>
          <div className="tile-label">Negativos</div>
          <div className="tile-value">{negativos}</div>
          <div className="tile-sub">{100 - pctPositivo}% del total (incl. regular)</div>
        </div>
      </section>

      <section className="donut-card">
        <DonutChart counts={counts} total={total} />
      </section>

      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Satisfacción</th>
              <th>Comentario</th>
              <th>Foto</th>
            </tr>
          </thead>
          <tbody>
            {votes.map((vote) => (
              <tr key={vote.id} className={vote.id === justArrivedId ? "row-new" : ""}>
                <td>{formatDate(vote.created_at)}</td>
                <td>
                  <span
                    className="badge"
                    style={{
                      color: SATISFACTION_BY_KEY[vote.satisfaction].color,
                      background: `${SATISFACTION_BY_KEY[vote.satisfaction].color}1a`,
                    }}
                  >
                    <Face mood={vote.satisfaction} size={20} /> {SATISFACTION_BY_KEY[vote.satisfaction].label}
                  </span>
                </td>
                <td className="muted">{vote.attention_or_food || "—"}</td>
                <td>
                  {vote.photo_key ? (
                    <button className="link-btn" onClick={() => openVote(vote)}>
                      Ver / anotar
                    </button>
                  ) : (
                    <span className="muted">sin foto</span>
                  )}
                </td>
              </tr>
            ))}
            {votes.length === 0 && (
              <tr>
                <td colSpan={4} className="muted empty">
                  Todavía no hay votos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {selectedPhoto && (
        <div className="modal-backdrop" onClick={() => setSelectedPhoto(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <img src={photoUrl(selectedPhoto.photo_key!)} alt="Foto del voto" />
            <p className="muted">{formatDate(selectedPhoto.created_at)}</p>
            <p><strong>Comentario del cliente:</strong> {selectedPhoto.attention_or_food || "—"}</p>
            <label htmlFor="reason">Nota interna (opcional, la agrega el equipo)</label>
            <textarea
              id="reason"
              value={reasonDraft}
              onChange={(e) => setReasonDraft(e.target.value)}
              rows={3}
            />
            <div className="modal-actions">
              <button onClick={() => setSelectedPhoto(null)}>Cerrar</button>
              <button className="primary" onClick={saveReason}>Guardar nota</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
