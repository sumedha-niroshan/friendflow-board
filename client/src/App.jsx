import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000";
const PRIORITIES = ["High", "Medium", "Low"];

const normalizePriority = (p) => {
  const value = (p || "Medium").toString().toLowerCase();
  if (value === "high") return "High";
  if (value === "low") return "Low";
  return "Medium";
};

function App() {
  const [note, setNote] = useState("");
  const [tasks, setTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [completingId, setCompletingId] = useState(null);
  const [error, setError] = useState("");

  // layout state
  const [view, setView] = useState("board"); // "board" | "history"
  const [query, setQuery] = useState("");

  /* ============================================================
     LOAD SAVED TASKS
  ============================================================ */

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoadingTasks(true);
      setError("");

      const response = await fetch(`${API_URL}/api/tasks`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load tasks");
      }

      setTasks(data.active || []);
      setCompletedTasks(data.completed || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load saved tasks");
    } finally {
      setLoadingTasks(false);
    }
  };

  /* ============================================================
     ORGANIZE WITH AI
  ============================================================ */

  const handleOrganize = async () => {
    if (!note.trim() || loading) return;

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/api/organize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to organize tasks");
      }

      // Backend returns the entire current active list so both sides stay in sync.
      if (Array.isArray(data.active)) {
        setTasks(data.active);
      } else if (Array.isArray(data.tasks)) {
        setTasks((current) => [...data.tasks, ...current]);
      }

      if (Array.isArray(data.completed)) {
        setCompletedTasks(data.completed);
      }

      setNote("");
      setView("board");
    } catch (err) {
      console.error("Organize task error:", err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     COMPLETE / DELETE / CLEAR
  ============================================================ */

  const completeTask = async (id) => {
    try {
      setCompletingId(id);
      setError("");

      const response = await fetch(`${API_URL}/api/tasks/${id}/complete`, {
        method: "PATCH",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to complete task");
      }

      setTasks(data.active || []);
      setCompletedTasks(data.completed || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to mark task as completed");
    } finally {
      setCompletingId(null);
    }
  };

  const deleteCompletedTask = async (id) => {
    try {
      setError("");

      const response = await fetch(`${API_URL}/api/tasks/completed/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete completed task");
      }

      setCompletedTasks(data.completed || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to delete completed task");
    }
  };

  const clearHistory = async () => {
    try {
      setError("");

      const response = await fetch(`${API_URL}/api/tasks/completed`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to clear history");
      }

      setCompletedTasks([]);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to clear history");
    }
  };

  const formatDate = (value) => (value ? new Date(value).toLocaleString() : "");

  /* ============================================================
     DERIVED DATA
  ============================================================ */

  const matches = (task) =>
    !query.trim() ||
    (task.title || "").toLowerCase().includes(query.trim().toLowerCase());

  const columns = useMemo(
    () =>
      PRIORITIES.map((level) => ({
        level,
        items: tasks.filter(
          (t) => normalizePriority(t.priority) === level && matches(t)
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, query]
  );

  const filteredHistory = completedTasks.filter(matches);
  const highCount = tasks.filter(
    (t) => normalizePriority(t.priority) === "High"
  ).length;
  const total = tasks.length + completedTasks.length;
  const progress = total ? Math.round((completedTasks.length / total) * 100) : 0;

  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      handleOrganize();
    }
  };

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div className="shell">
      {/* ---------------- SIDEBAR ---------------- */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">F</div>
          <div>
            <h1>FriendFlow</h1>
            <p>Messy thoughts, clear actions.</p>
          </div>
        </div>

        <nav className="nav" aria-label="Views">
          <button
            className={`nav-item ${view === "board" ? "active" : ""}`}
            onClick={() => setView("board")}
          >
            <span>Task board</span>
            <span className="pill">{tasks.length}</span>
          </button>
          <button
            className={`nav-item ${view === "history" ? "active" : ""}`}
            onClick={() => setView("history")}
          >
            <span>Completed history</span>
            <span className="pill">{completedTasks.length}</span>
          </button>
        </nav>

        <div className="stats">
          <div className="stat">
            <strong>{highCount}</strong>
            <span>High priority</span>
          </div>
          <div className="stat">
            <strong>{progress}%</strong>
            <span>Done overall</span>
          </div>
          <div className="progress" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="sidebar-foot">
          <div className="local-ai-badge">
            <span className="status-dot"></span>
            Local AI
          </div>
          <p>Your notes stay private and are processed on this device.</p>
        </div>
      </aside>

      {/* ---------------- MAIN ---------------- */}
      <main className="main">
        <section className="composer">
          <div className="composer-head">
            <label htmlFor="note">What's on your mind?</label>
            <span className="hint">Ctrl + Enter to organize</span>
          </div>

          <textarea
            id="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Example: Tomorrow I need to call Kasun, send the supplier invoice, buy printer paper, and remind Nimal about the meeting."
            rows={4}
          />

          <div className="composer-foot">
            <span className="hint">{note.trim().length} characters</span>
            <button
              className="organize-button"
              onClick={handleOrganize}
              disabled={!note.trim() || loading}
            >
              {loading ? "Organizing..." : "Organize with AI"}
            </button>
          </div>

          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
        </section>

        <div className="toolbar">
          <h2>{view === "board" ? "Task board" : "Completed history"}</h2>

          <div className="toolbar-right">
            <input
              className="search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks"
              aria-label="Search tasks"
            />
            {view === "history" && completedTasks.length > 0 && (
              <button className="clear-history-button" onClick={clearHistory}>
                Clear history
              </button>
            )}
          </div>
        </div>

        {/* ---------- BOARD VIEW ---------- */}
        {view === "board" &&
          (loadingTasks ? (
            <div className="empty-state">
              <p>Loading your tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✓</div>
              <h3>You're all caught up</h3>
              <p>
                Paste a messy note above and FriendFlow will turn it into
                clear actions.
              </p>
            </div>
          ) : (
            <div className="board">
              {columns.map(({ level, items }) => (
                <section
                  className={`column column-${level.toLowerCase()}`}
                  key={level}
                >
                  <header className="column-head">
                    <h3>{level}</h3>
                    <span className="pill">{items.length}</span>
                  </header>

                  <div className="column-body">
                    {items.length === 0 ? (
                      <p className="column-empty">No {level.toLowerCase()} tasks</p>
                    ) : (
                      items.map((task) => (
                        <article className="task-card" key={task.id}>
                          <button
                            className="check-button"
                            onClick={() => completeTask(task.id)}
                            disabled={completingId === task.id}
                            aria-label={`Complete ${task.title}`}
                            title="Mark as completed"
                          >
                            {completingId === task.id ? "…" : "✓"}
                          </button>

                          <div className="task-content">
                            <h4>{task.title}</h4>
                            {task.dueDate && (
                              <div className="task-meta">
                                <span>{task.dueDate}</span>
                              </div>
                            )}
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              ))}
            </div>
          ))}

        {/* ---------- HISTORY VIEW ---------- */}
        {view === "history" &&
          (filteredHistory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✓</div>
              <h3>
                {completedTasks.length === 0
                  ? "No completed tasks yet"
                  : "No matches"}
              </h3>
              <p>
                {completedTasks.length === 0
                  ? "Tasks you finish will appear here."
                  : "Try a different search."}
              </p>
            </div>
          ) : (
            <div className="history-list">
              {filteredHistory.map((task) => (
                <article className="task-card completed" key={task.id}>
                  <div className="completed-icon">✓</div>

                  <div className="task-content">
                    <h4>{task.title}</h4>
                    <div className="task-meta">
                      {task.dueDate && <span>{task.dueDate}</span>}
                      <span
                        className={`priority priority-${normalizePriority(
                          task.priority
                        ).toLowerCase()}`}
                      >
                        {normalizePriority(task.priority)}
                      </span>
                      {task.completedAt && (
                        <span className="completed-date">
                          Completed {formatDate(task.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    className="delete-history-button"
                    onClick={() => deleteCompletedTask(task.id)}
                    aria-label={`Delete ${task.title} from history`}
                    title="Delete from history"
                  >
                    ×
                  </button>
                </article>
              ))}
            </div>
          ))}
      </main>
    </div>
  );
}

export default App;