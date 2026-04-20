import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAAWQnIBucg-jfAu-gkNbh3PrOKXrP4zyE",
  authDomain: "thursday-football-ddd1e.firebaseapp.com",
  projectId: "thursday-football-ddd1e",
  storageBucket: "thursday-football-ddd1e.firebasestorage.app",
  messagingSenderId: "642553863159",
  appId: "1:642553863159:web:15ceee95d9f5e2e327acf2"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const WEEKLY_COST = 6;
const DOC_REF = doc(db, "data", "main");

function toLocalKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLastThursdayKey() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day + 3) % 7;
  const thu = new Date(now);
  thu.setDate(now.getDate() - diff);
  thu.setHours(0, 0, 0, 0);
  return toLocalKey(thu);
}

function getAllThursdays() {
  const keys = [];
  const baseKey = getLastThursdayKey();
  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
  for (let i = 521; i >= 1; i--) {
    const d = new Date(baseKey + "T12:00:00");
    d.setDate(d.getDate() + i * 7);
    keys.push(toLocalKey(d));
  }
  keys.push(baseKey);
  for (let i = 1; i <= 521; i++) {
    const d = new Date(baseKey + "T12:00:00");
    d.setDate(d.getDate() - i * 7);
    if (d < startOfYear) break;
    keys.push(toLocalKey(d));
  }
  return keys;
}

function formatDate(key) {
  const d = new Date(key + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatShortDate(key) {
  const d = new Date(key + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function App() {
  const [players, setPlayers] = useState([]);
  const [payments, setPayments] = useState({});
  const [gameWeeks, setGameWeeks] = useState({});
  const [weekCost, setWeekCost] = useState(WEEKLY_COST);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const thursdays = getAllThursdays();
  const todayKey = getLastThursdayKey();

  const [viewWeek, setViewWeek] = useState(todayKey);
  const [tab, setTab] = useState("week");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [editingCost, setEditingCost] = useState(false);
  const [tempCost, setTempCost] = useState(WEEKLY_COST);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  // Load from Firebase on mount
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(DOC_REF);
        if (snap.exists()) {
          const data = snap.data();
          setPlayers(data.players || []);
          setPayments(data.payments || {});
          setGameWeeks(data.gameWeeks || {});
          setWeekCost(data.weekCost || WEEKLY_COST);
          setTempCost(data.weekCost || WEEKLY_COST);
        }
      } catch (e) {
        console.error("Failed to load:", e);
      }
      setLoading(false);
    };
    load();
  }, []);

  // Save to Firebase whenever data changes
  const saveData = async (newPlayers, newPayments, newGameWeeks, newWeekCost) => {
    setSaving(true);
    try {
      await setDoc(DOC_REF, {
        players: newPlayers,
        payments: newPayments,
        gameWeeks: newGameWeeks,
        weekCost: newWeekCost,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Failed to save:", e);
    }
    setSaving(false);
  };

  const updatePlayers = (val) => { setPlayers(val); saveData(val, payments, gameWeeks, weekCost); };
  const updatePayments = (val) => { setPayments(val); saveData(players, val, gameWeeks, weekCost); };
  const updateGameWeeks = (val) => { setGameWeeks(val); saveData(players, payments, val, weekCost); };
  const updateWeekCost = (val) => { setWeekCost(val); saveData(players, payments, gameWeeks, val); };

  const getWeek = (key) => gameWeeks[key] || { active: false, playing: [] };
  const isActive = (key) => getWeek(key).active;
  const getPlaying = (key) => getWeek(key).playing || [];

  const toggleGameOn = (key) => {
    const w = gameWeeks[key] || { active: false, playing: [] };
    const val = { ...gameWeeks, [key]: { ...w, active: !w.active } };
    updateGameWeeks(val);
  };

  const togglePlayerPlaying = (key, player) => {
    const w = gameWeeks[key] || { active: true, playing: [] };
    const playing = w.playing.includes(player)
      ? w.playing.filter(p => p !== player)
      : [...w.playing, player];
    const val = { ...gameWeeks, [key]: { ...w, playing } };
    updateGameWeeks(val);
  };

  const togglePaid = (player, week) => {
    const k = `${week}__${player}`;
    const next = { ...payments };
    if (next[k]) delete next[k];
    else next[k] = { paid: true, amount: weekCost, ts: Date.now() };
    updatePayments(next);
  };

  const isPaid = (player, week) => !!payments[`${week}__${player}`];

  const getBalance = (player) => {
    let bal = 0;
    thursdays.forEach(w => {
      if (!isActive(w)) return;
      if (!getPlaying(w).includes(player)) return;
      if (!isPaid(player, w)) bal -= weekCost;
    });
    return bal;
  };

  const playing = getPlaying(viewWeek);
  const paidPlayers = playing.filter(p => isPaid(p, viewWeek));
  const unpaidPlayers = playing.filter(p => !isPaid(p, viewWeek));
  const activeWeeks = thursdays.filter(w => isActive(w));

  const addPlayer = () => {
    const name = newPlayerName.trim();
    if (name && !players.includes(name)) {
      updatePlayers([...players, name]);
      setNewPlayerName("");
    }
  };

  const removePlayer = (p) => updatePlayers(players.filter(x => x !== p));

  const savePlayerName = (old, newName) => {
    const t = newName.trim();
    if (!t || t === old) { setEditingPlayer(null); return; }
    const newPlayers = players.map(p => p === old ? t : p);
    const newGameWeeks = {};
    Object.entries(gameWeeks).forEach(([k, v]) => {
      newGameWeeks[k] = { ...v, playing: v.playing.map(p => p === old ? t : p) };
    });
    const newPayments = {};
    Object.entries(payments).forEach(([k, v]) => {
      newPayments[k.replace(`__${old}`, `__${t}`)] = v;
    });
    setPlayers(newPlayers);
    setGameWeeks(newGameWeeks);
    setPayments(newPayments);
    saveData(newPlayers, newPayments, newGameWeeks, weekCost);
    setEditingPlayer(null);
  };

  const sortedByGames = (list) => [...list].sort((a, b) => {
    const ag = activeWeeks.filter(w => getPlaying(w).includes(a)).length;
    const bg = activeWeeks.filter(w => getPlaying(w).includes(b)).length;
    return bg - ag;
  });

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", color: "#7eb8f7", fontSize: 14, letterSpacing: ".1em" }}>
      LOADING...
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", color: "#e8eaf0", fontFamily: "'DM Mono','Courier New',monospace", paddingBottom: 80, maxWidth: 480, margin: "0 auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        button{cursor:pointer;border:none;background:none;font-family:inherit}
        input,select,textarea{font-family:inherit}
        .pb{padding:6px 14px;border-radius:4px;font-size:11px;font-family:'DM Mono',monospace;letter-spacing:.08em;transition:all .15s;font-weight:500}
        .pb:hover{filter:brightness(1.15)}
        .pr{display:flex;align-items:center;padding:10px 16px;border-bottom:1px solid #141c35;transition:background .1s;gap:10px}
        .pr:hover{background:#111827}
        .tb{flex:1;padding:8px 4px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#4a5a8a;border-bottom:2px solid transparent;transition:all .15s;font-family:'DM Mono',monospace}
        .tb.act{color:#7eb8f7;border-bottom-color:#7eb8f7}
        .tb:hover:not(.act){color:#8898bb}
        .ws{background:#141c35;border:1px solid #2a3a6e;color:#e8eaf0;padding:6px 10px;border-radius:4px;font-family:'DM Mono',monospace;font-size:12px;flex:1}
        .ti{flex:1;background:#141c35;border:1px solid #2a3a6e;color:#e8eaf0;padding:8px 12px;border-radius:4px;font-size:13px;outline:none}
        .ti:focus{border-color:#7eb8f7}
        .ti::placeholder{color:#3a4a6a}
        .sc{background:#111827;border:1px solid #1e2d55;border-radius:8px;padding:16px;flex:1;min-width:0}
        .sl{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#3a4a6e;padding:10px 16px 6px}
        .tog{width:44px;height:24px;border-radius:12px;position:relative;transition:background .2s;flex-shrink:0;cursor:pointer;border:none!important;padding:0!important}
        .tog::after{content:'';position:absolute;top:3px;width:18px;height:18px;border-radius:50%;background:white;transition:left .2s}
        .ton{background:#166534}.ton::after{left:23px}
        .tof{background:#2a3a6e}.tof::after{left:3px}
        .chip{display:inline-flex;align-items:center;padding:5px 10px;border-radius:20px;font-size:12px;margin:3px;cursor:pointer;transition:all .15s;border:1px solid transparent}
        .con{background:#1a2f1a;color:#4ade80;border-color:#2a4f2a}
        .cof{background:#141c35;color:#4a5a8a;border-color:#1e2d55}
        .con:hover{filter:brightness(1.2)}
        .cof:hover{background:#1a2535;color:#7eb8f7}
        .nb{margin:20px 16px;padding:20px;border-radius:8px;background:#111827;border:1px dashed #2a3a6e;text-align:center}
      `}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0d1530,#0a1525)", borderBottom: "1px solid #1e2d55", padding: "20px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, letterSpacing: ".05em", lineHeight: 1, color: "#7eb8f7" }}>THURSDAY FOOTBALL</div>
            <div style={{ fontSize: 11, color: "#3a4a6a", marginTop: 2, letterSpacing: ".1em" }}>
              PAYMENT TRACKER {saving && <span style={{ color: "#4a5a8a" }}>· SAVING...</span>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#3a4a6a", letterSpacing: ".1em", marginBottom: 2 }}>WEEKLY FEE</div>
            {editingCost ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ color: "#4a5a8a" }}>£</span>
                <input className="ti" style={{ width: 60, padding: "4px 8px", fontSize: 14 }} type="number" value={tempCost}
                  onChange={e => setTempCost(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { updateWeekCost(Number(tempCost)); setEditingCost(false); } if (e.key === "Escape") setEditingCost(false); }}
                  autoFocus />
                <button className="pb" style={{ background: "#1e3a5a", color: "#7eb8f7" }} onClick={() => { updateWeekCost(Number(tempCost)); setEditingCost(false); }}>✓</button>
              </div>
            ) : (
              <button onClick={() => { setTempCost(weekCost); setEditingCost(true); }}
                style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: "#4ade80", letterSpacing: ".05em" }}>£{weekCost}</button>
            )}
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 4 }}>
          <button className={`tb ${tab === "week" ? "act" : ""}`} onClick={() => setTab("week")}>Week</button>
          <button className={`tb ${tab === "balances" ? "act" : ""}`} onClick={() => setTab("balances")}>Balances</button>
          <button className={`tb ${tab === "stats" ? "act" : ""}`} onClick={() => setTab("stats")}>Stats</button>
          <button className={`tb ${tab === "players" ? "act" : ""}`} onClick={() => setTab("players")}>Players</button>
        </div>
      </div>

      {/* WEEK TAB */}
      {tab === "week" && (
        <div>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #141c35", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 11, color: "#4a5a8a", letterSpacing: ".08em", flexShrink: 0 }}>THU</div>
            <select className="ws" value={viewWeek} onChange={e => setViewWeek(e.target.value)}>
              {thursdays.map(w => (
                <option key={w} value={w}>{formatDate(w)}{w === todayKey ? " (latest)" : ""}{isActive(w) ? " ⚽" : ""}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #141c35", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13 }}>{isActive(viewWeek) ? "Game is ON ⚽" : "No game this week"}</div>
              <div style={{ fontSize: 11, color: "#4a5a8a", marginTop: 2 }}>
                {isActive(viewWeek) ? `${playing.length} player${playing.length !== 1 ? "s" : ""} selected` : "Toggle to activate this week"}
              </div>
            </div>
            <button className={`tog ${isActive(viewWeek) ? "ton" : "tof"}`} onClick={() => toggleGameOn(viewWeek)} />
          </div>

          {!isActive(viewWeek) && (
            <div className="nb">
              <div style={{ fontSize: 28, marginBottom: 8 }}>🚫</div>
              <div style={{ fontSize: 13, color: "#4a5a8a" }}>No game scheduled</div>
              <div style={{ fontSize: 11, color: "#2a3a6e", marginTop: 4 }}>Toggle above to activate this week</div>
            </div>
          )}

          {isActive(viewWeek) && (
            <>
              <div style={{ borderBottom: "1px solid #141c35" }}>
                <button onClick={() => setShowPicker(p => !p)}
                  style={{ width: "100%", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", color: "#7eb8f7", fontSize: 12, letterSpacing: ".08em" }}>
                  <span>WHO'S PLAYING? {playing.length > 0 && <span style={{ color: "#4a5a8a" }}>({playing.length} selected)</span>}</span>
                  <span style={{ color: "#4a5a8a" }}>{showPicker ? "▲ DONE" : "▼ EDIT"}</span>
                </button>
                {showPicker && (
                  <div style={{ padding: "4px 12px 12px", borderTop: "1px solid #141c35" }}>
                    <div style={{ fontSize: 11, color: "#3a4a6a", padding: "6px 4px", letterSpacing: ".08em" }}>TAP TO TOGGLE</div>
                    <div>
                      {sortedByGames(players).map(player => (
                        <button key={player} className={`chip ${playing.includes(player) ? "con" : "cof"}`}
                          onClick={() => togglePlayerPlaying(viewWeek, player)}>
                          {playing.includes(player) ? "✓ " : ""}{player}
                        </button>
                      ))}
                    </div>
                    <button className="pb" style={{ marginTop: 10, background: "#1e3a5a", color: "#7eb8f7", fontSize: 11 }}
                      onClick={() => { const val = { ...gameWeeks, [viewWeek]: { ...getWeek(viewWeek), playing: [...players] } }; updateGameWeeks(val); }}>SELECT ALL</button>
                    <button className="pb" style={{ marginTop: 10, marginLeft: 8, background: "#1f1a1a", color: "#f87171", fontSize: 11 }}
                      onClick={() => { const val = { ...gameWeeks, [viewWeek]: { ...getWeek(viewWeek), playing: [] } }; updateGameWeeks(val); }}>CLEAR ALL</button>
                  </div>
                )}
              </div>

              {playing.length === 0 && (
                <div className="nb">
                  <div style={{ fontSize: 11, color: "#4a5a8a" }}>No players selected yet — tap "WHO'S PLAYING?" above</div>
                </div>
              )}

              {playing.length > 0 && (
                <>
                  <div style={{ display: "flex", gap: 10, padding: "12px 16px", borderBottom: "1px solid #141c35" }}>
                    <div className="sc">
                      <div style={{ fontSize: 10, color: "#4a5a8a", letterSpacing: ".1em", marginBottom: 4 }}>PAID IN</div>
                      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 26, color: "#4ade80" }}>£{paidPlayers.length * weekCost}</div>
                      <div style={{ fontSize: 11, color: "#4a5a8a" }}>{paidPlayers.length} of {playing.length}</div>
                    </div>
                    <div className="sc">
                      <div style={{ fontSize: 10, color: "#4a5a8a", letterSpacing: ".1em", marginBottom: 4 }}>OUTSTANDING</div>
                      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 26, color: "#f87171" }}>£{unpaidPlayers.length * weekCost}</div>
                      <div style={{ fontSize: 11, color: "#4a5a8a" }}>{unpaidPlayers.length} players</div>
                    </div>
                  </div>

                  {unpaidPlayers.length > 0 && (
                    <>
                      <div className="sl">⏳ STILL TO PAY</div>
                      {unpaidPlayers.map(p => (
                        <div key={p} className="pr">
                          <div style={{ flex: 1, fontSize: 14 }}>{p}</div>
                          <button className="pb" style={{ background: "#1a2f1a", color: "#4ade80", border: "1px solid #2a4f2a" }}
                            onClick={() => togglePaid(p, viewWeek)}>MARK PAID</button>
                        </div>
                      ))}
                    </>
                  )}

                  {paidPlayers.length > 0 && (
                    <>
                      <div className="sl">✓ PAID</div>
                      {paidPlayers.map(p => (
                        <div key={p} className="pr">
                          <div style={{ flex: 1, fontSize: 14, color: "#4a5a8a", textDecoration: "line-through" }}>{p}</div>
                          <div style={{ fontSize: 12, color: "#4ade80", marginRight: 8 }}>£{weekCost}</div>
                          <button className="pb" style={{ background: "#1f1a1a", color: "#f87171", border: "1px solid #4f2a2a" }}
                            onClick={() => togglePaid(p, viewWeek)}>UNDO</button>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* BALANCES TAB */}
      {tab === "balances" && (
        <div>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #141c35", fontSize: 11, color: "#4a5a8a" }}>
            ACROSS {activeWeeks.length} ACTIVE WEEK{activeWeeks.length !== 1 ? "S" : ""}
          </div>
          {activeWeeks.length === 0 && (
            <div className="nb"><div style={{ fontSize: 11, color: "#4a5a8a" }}>No active weeks yet</div></div>
          )}
          {[...players]
            .map(p => {
              const gamesPlayed = activeWeeks.filter(w => getPlaying(w).includes(p)).length;
              const unpaidWeeks = activeWeeks
                .filter(w => getPlaying(w).includes(p) && !isPaid(p, w))
                .sort()
                .map(w => formatShortDate(w));
              return { name: p, balance: getBalance(p), gamesPlayed, unpaidWeeks };
            })
            .filter(p => p.gamesPlayed > 0)
            .sort((a, b) => a.balance - b.balance)
            .map(({ name, balance, gamesPlayed, unpaidWeeks }) => (
              <div key={name} className="pr" style={{ alignItems: "flex-start", padding: "12px 16px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{name}</div>
                  <div style={{ fontSize: 11, color: "#3a4a6a", marginTop: 1 }}>{gamesPlayed} game{gamesPlayed !== 1 ? "s" : ""}</div>
                  {unpaidWeeks.length > 0 && (
                    <div style={{ marginTop: 5 }}>
                      <div style={{ fontSize: 10, color: "#7f3a3a", letterSpacing: ".08em", marginBottom: 3 }}>UNPAID:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {unpaidWeeks.map(d => (
                          <span key={d} style={{ fontSize: 11, background: "#1f1010", color: "#f87171", border: "1px solid #4f2a2a", borderRadius: 4, padding: "2px 6px" }}>{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ height: 3, borderRadius: 2, marginTop: 6, minWidth: 4, width: `${Math.min(100, (Math.abs(balance) / (gamesPlayed * weekCost)) * 100)}%`, background: balance === 0 ? "#166534" : "#7f1d1d" }} />
                </div>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: balance === 0 ? "#4ade80" : "#f87171", minWidth: 60, textAlign: "right", marginLeft: 12 }}>
                  £{balance}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* STATS TAB */}
      {tab === "stats" && (
        <div>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #141c35", fontSize: 11, color: "#4a5a8a" }}>
            {activeWeeks.length} GAME WEEK{activeWeeks.length !== 1 ? "S" : ""} PLAYED
          </div>
          {activeWeeks.length === 0 && (
            <div className="nb"><div style={{ fontSize: 11, color: "#4a5a8a" }}>No active weeks yet</div></div>
          )}
          {activeWeeks.length > 0 && (() => {
            const pastActiveWeeks = activeWeeks.filter(w => w <= todayKey).sort();
            const getStreak = (player) => {
              let streak = 0;
              for (let i = pastActiveWeeks.length - 1; i >= 0; i--) {
                if (getPlaying(pastActiveWeeks[i]).includes(player)) streak++;
                else break;
              }
              return streak;
            };
            const statsData = [...players]
              .map(p => {
                const gamesPlayed = pastActiveWeeks.filter(w => getPlaying(w).includes(p)).length;
                const streak = getStreak(p);
                const attendance = pastActiveWeeks.length > 0 ? Math.round((gamesPlayed / pastActiveWeeks.length) * 100) : 0;
                return { name: p, gamesPlayed, streak, attendance, total: pastActiveWeeks.length };
              })
              .filter(p => p.gamesPlayed > 0)
              .sort((a, b) => b.gamesPlayed - a.gamesPlayed || b.streak - a.streak);
            return statsData.map(({ name, gamesPlayed, streak, attendance, total }) => (
              <div key={name} className="pr" style={{ alignItems: "flex-start", padding: "12px 16px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 14 }}>{name}</div>
                    {streak >= 3 && <div style={{ fontSize: 10, background: "#1a2f1a", color: "#4ade80", border: "1px solid #2a4f2a", borderRadius: 10, padding: "2px 7px" }}>🔥 {streak}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: "#4a5a8a" }}>{gamesPlayed}/{total} games</div>
                    <div style={{ fontSize: 11, color: streak > 0 ? "#7eb8f7" : "#4a5a8a" }}>{streak > 0 ? `${streak} week streak` : "streak broken"}</div>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "#141c35", width: "100%", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 2, width: `${attendance}%`, background: attendance >= 80 ? "#4ade80" : attendance >= 50 ? "#7eb8f7" : "#f87171" }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", minWidth: 44, marginLeft: 12 }}>
                  <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: attendance >= 80 ? "#4ade80" : attendance >= 50 ? "#7eb8f7" : "#f87171" }}>{attendance}%</div>
                  <div style={{ fontSize: 10, color: "#3a4a6a", letterSpacing: ".05em" }}>ATTENDANCE</div>
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* PLAYERS TAB */}
      {tab === "players" && (
        <div>
          <div style={{ display: "flex", gap: 8, padding: "12px 16px", borderBottom: "1px solid #141c35" }}>
            <input className="ti" placeholder="Add player name..." value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addPlayer()} />
            <button className="pb" style={{ background: "#1e3a5a", color: "#7eb8f7" }} onClick={addPlayer}>ADD</button>
          </div>
          {players.length === 0 && (
            <div className="nb"><div style={{ fontSize: 11, color: "#4a5a8a" }}>No players yet — add some above</div></div>
          )}
          {players.map(player => (
            <div key={player} className="pr">
              {editingPlayer === player ? (
                <>
                  <input className="ti" style={{ flex: 1, padding: "4px 8px", fontSize: 13 }} value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") savePlayerName(player, editingName); if (e.key === "Escape") setEditingPlayer(null); }}
                    autoFocus />
                  <button className="pb" style={{ background: "#1e3a5a", color: "#7eb8f7" }} onClick={() => savePlayerName(player, editingName)}>SAVE</button>
                  <button className="pb" style={{ color: "#4a5a8a" }} onClick={() => setEditingPlayer(null)}>✕</button>
                </>
              ) : (
                <>
                  <div style={{ flex: 1, fontSize: 14 }}>{player}</div>
                  <button className="pb" style={{ color: "#4a5a8a", fontSize: 11 }} onClick={() => { setEditingPlayer(player); setEditingName(player); }}>RENAME</button>
                  <button className="pb" style={{ color: "#f87171", fontSize: 11 }} onClick={() => removePlayer(player)}>REMOVE</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
