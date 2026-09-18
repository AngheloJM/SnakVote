import { useEffect, useMemo, useState } from "react";
import { AuthError, clearToken, connectVotesSocket, fetchVotes, getToken, photoUrl, updateReason } from "./api";
import { BarChart } from "./BarChart";
import { CommentsFrequency } from "./CommentsFrequency";
import { DateRangeFilter, PRESETS, type DateRange } from "./DateRangeFilter";
import { DonutChart } from "./DonutChart";
import { Face } from "./Face";
import { Login } from "./Login";
import { SATISFACTION_BY_KEY, SATISFACTION_LEVELS } from "./satisfaction";
import { TrendChart } from "./TrendChart";
import type { Vote } from "./types";
import { useCountUp } from "./useCountUp";
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

type SortKey = "date" | "satisfaction" | "comment";
type SortDir = "asc" | "desc";

const SATISFACTION_RANK = Object.fromEntries(
  SATISFACTION_LEVELS.map((level, i) => [level.key, i]),
) as Record<Vote["satisfaction"], number>;

function App() {
  const [loggedIn, setLoggedIn] = useState(() => Boolean(getToken()));
  const [votes, setVotes] = useState<Vote[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Vote | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const [justArrivedId, setJustArrivedId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(PRESETS[3]);
  const [chartView, setChartView] = useState<"donut" | "bar">("donut");
  const [commentFilter, setCommentFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  function logout() {
    clearToken();
    setLoggedIn(false);
    setVotes([]);
  }

  useEffect(() => {
    if (!loggedIn) return;

    fetchVotes({ from: dateRange.from, to: dateRange.to })
      .then(setVotes)
      .catch((err) => {
        if (err instanceof AuthError) logout();
        else console.error(err);
      });
  }, [loggedIn, dateRange]);

  useEffect(() => {
    if (!loggedIn) return;

    const disconnect = connectVotesSocket((vote) => {
      setVotes((prev) => upsertVote(prev, vote));
      setJustArrivedId(vote.id);
      setTimeout(() => setJustArrivedId((id) => (id === vote.id ? null : id)), 2000);
    });
    return disconnect;
  }, [loggedIn]);

  const filteredVotes = useMemo(
    () => (commentFilter ? votes.filter((v) => v.attention_or_food === commentFilter) : votes),
    [votes, commentFilter],
  );

  const sortedVotes = useMemo(() => {
    const arr = [...filteredVotes];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortKey === "satisfaction") {
        cmp = SATISFACTION_RANK[a.satisfaction] - SATISFACTION_RANK[b.satisfaction];
      } else {
        cmp = (a.attention_or_food ?? "").localeCompare(b.attention_or_food ?? "");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredVotes, sortKey, sortDir]);

  const { counts, total } = useMemo(() => {
    const counts = Object.fromEntries(SATISFACTION_LEVELS.map((l) => [l.key, 0])) as Record<
      Vote["satisfaction"],
      number
    >;
    for (const vote of filteredVotes) counts[vote.satisfaction] = (counts[vote.satisfaction] ?? 0) + 1;
    return { counts, total: filteredVotes.length };
  }, [filteredVotes]);

  const positivos = counts.muy_satisfecho + counts.satisfecho;
  const negativos = counts.poco_satisfecho + counts.insatisfecho;
  const pctPositivo = total === 0 ? 0 : Math.round((positivos / total) * 100);

  const totalDisplay = useCountUp(total);
  const positivosDisplay = useCountUp(positivos);
  const negativosDisplay = useCountUp(negativos);

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
          <button className="link-btn" onClick={logout}>Salir</button>
        </div>
      </header>

      <DateRangeFilter value={dateRange} onChange={setDateRange} />

      <section className="tiles">
        <div className="tile">
          <div className="tile-label">Total de votos</div>
          <div className="tile-value">{totalDisplay}</div>
        </div>

        <div className="tile" style={{ color: "#2454C6" }}>
          <div className="tile-label">Positivos</div>
          <div className="tile-value">{positivosDisplay}</div>
          <div className="tile-sub">{pctPositivo}% del total</div>
        </div>

        <div className="tile" style={{ color: "#E47704" }}>
          <div className="tile-label">Negativos</div>
          <div className="tile-value">{negativosDisplay}</div>
          <div className="tile-sub">{100 - pctPositivo}% del total (incl. regular)</div>
        </div>
      </section>

      <section className="donut-card">
        <div className="chart-toggle">
          <button
            className={chartView === "donut" ? "active" : ""}
            onClick={() => setChartView("donut")}
          >
            Dona
          </button>
          <button
            className={chartView === "bar" ? "active" : ""}
            onClick={() => setChartView("bar")}
          >
            Barras
          </button>
        </div>
        <div className="chart-view" key={chartView}>
          {chartView === "donut" ? (
            <DonutChart counts={counts} total={total} />
          ) : (
            <BarChart counts={counts} total={total} />
          )}
        </div>
      </section>

      <section className="split-cards" key={dateRange.label}>
        <div className="donut-card trend-card">
          <h3>Tendencia de votos</h3>
          <TrendChart votes={filteredVotes} />
        </div>
        <div className="donut-card">
          <h3>Comentarios más frecuentes</h3>
          <CommentsFrequency votes={votes} selected={commentFilter} onSelect={setCommentFilter} />
        </div>
      </section>

      <section className="table-wrap" key={`table-${dateRange.label}`}>
        <table>
          <thead>
            <tr>
              <th className="sortable" onClick={() => toggleSort("date")}>
                Fecha{sortIndicator("date")}
              </th>
              <th className="sortable" onClick={() => toggleSort("satisfaction")}>
                Satisfacción{sortIndicator("satisfaction")}
              </th>
              <th className="sortable" onClick={() => toggleSort("comment")}>
                Comentario{sortIndicator("comment")}
              </th>
              <th>Foto</th>
            </tr>
          </thead>
          <tbody>
            {sortedVotes.map((vote) => (
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
            {filteredVotes.length === 0 && (
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
