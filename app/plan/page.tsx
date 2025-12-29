"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Slot = {
  id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
};

type Profile = {
  id: string;
  name: string | null;
  color: string | null;
};

const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}
function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function isValidCssColor(s: string | null | undefined) {
  return !!s && typeof s === "string" && s.trim().length > 0;
}
function isOverlapError(err: any) {
  const code = err?.code;
  const msg = String(err?.message ?? "").toLowerCase();
  if (code === "23P01") return true;
  if (msg.includes("exclude") || msg.includes("exclusion") || msg.includes("overlap")) return true;
  return false;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function PlanPage() {
  const [mounted, setMounted] = useState(false);

  // Login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Data
  const [slots, setSlots] = useState<Slot[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Week view
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));

  // Create form
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [durationMin, setDurationMin] = useState(60);

  // "Jetzt" scroll trigger
  const [scrollToNowToggle, setScrollToNowToggle] = useState(0);

  // Edit modal
  const [editing, setEditing] = useState<Slot | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editMsg, setEditMsg] = useState<string | null>(null);

  // Allowed month = current month (today)
  const allowedMonthStart = useMemo(() => startOfMonth(new Date()), []);
  const allowedMonthEndExclusive = useMemo(() => addMonths(allowedMonthStart, 1), [allowedMonthStart]);
  const allowedTitle = useMemo(
    () => allowedMonthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    [allowedMonthStart]
  );

  // Time axis
  const startHour = 7;
  const endHour = 22;
  const hourHeight = 56;
  const minutesPerDay = (endHour - startHour) * 60;
  const gridHeight = (endHour - startHour) * hourHeight;

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Styles
  const pageBg = "#fff";
  const textColor = "#000";
  const greyHeader = "#eee";
  const border = "#ddd";

  // Mobile horizontal scroll sizing
  const timeColW = 80;
  const dayMinW = 140;
  const gridTemplate = `${timeColW}px repeat(7, ${dayMinW}px)`;

  const inputStyle: React.CSSProperties = {
    padding: 12,
    border: `1px solid ${border}`,
    borderRadius: 12,
    width: "100%",
    minHeight: 44,
    background: "#fff",
    color: "#000",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "10px 12px",
    border: `1px solid ${border}`,
    borderRadius: 12,
    minHeight: 44,
    background: "#fff",
    color: "#000",
  };

  useEffect(() => {
    setMounted(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mounted) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  // ✅ Realtime updates (Punkt 6.1)
  useEffect(() => {
    const channel = supabase
      .channel("slots-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "slots" }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  // ✅ "Jetzt" scroll (Punkt 2.3)
  useEffect(() => {
    if (!mounted) return;

    const el = document.querySelector('[data-plan-scroll="1"]') as HTMLDivElement | null;
    if (!el) return;

    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes() - startHour * 60;
    const clamped = clamp(minutes, 0, minutesPerDay);
    const y = (clamped / 60) * hourHeight;

    el.scrollTop = Math.max(0, y - 120);
  }, [scrollToNowToggle, mounted, hourHeight, minutesPerDay, startHour]);

  async function load() {
    setMsg(null);
    setLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session ?? null;

      setUserId(session?.user?.id ?? null);
      setUserEmail(session?.user?.email ?? null);

      const startIso = weekStart.toISOString();
      const endIso = addDays(weekStart, 7).toISOString();

      const { data: slotData, error } = await supabase
        .from("slots")
        .select("id,user_id,starts_at,ends_at")
        .gte("starts_at", startIso)
        .lt("starts_at", endIso)
        .order("starts_at", { ascending: true });

      if (error) {
        setMsg("Fehler: " + error.message);
        console.error("Supabase slots error:", error);
        setSlots([]);
        return;
      }

      const safeSlots = (slotData ?? []) as Slot[];
      setSlots(safeSlots);

      const ids = Array.from(new Set(safeSlots.map((s) => s.user_id).filter(Boolean)));
      if (session?.user?.id) ids.push(session.user.id);
      const uniqueIds = Array.from(new Set(ids));

      if (uniqueIds.length === 0) {
        setProfiles({});
        return;
      }

      const { data: profs, error: profErr } = await supabase.from("profiles").select("id,name,color").in("id", uniqueIds);

      if (profErr) {
        setMsg((prev) => prev ?? "Fehler: " + profErr.message);
        console.error("Supabase profiles error:", profErr);
        return;
      }

      const map: Record<string, Profile> = {};
      for (const p of (profs ?? []) as Profile[]) map[p.id] = p;
      setProfiles(map);
    } finally {
      setLoading(false);
    }
  }

  async function login() {
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMsg("Fehler: " + error.message);
      console.error("Supabase login error:", error);
      return;
    }
    await load();
  }

  async function logout() {
    await supabase.auth.signOut();
    await load();
  }

  function isWithinAllowedMonth(d: Date) {
    return d.getTime() >= allowedMonthStart.getTime() && d.getTime() < allowedMonthEndExclusive.getTime();
  }

  function minutesFromStartHour(d: Date) {
    return d.getHours() * 60 + d.getMinutes() - startHour * 60;
  }

  function dayIndexFor(d: Date) {
    const a = new Date(weekStart);
    a.setHours(0, 0, 0, 0);
    const b = new Date(d);
    b.setHours(0, 0, 0, 0);
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function setFormForDayAtClick(day: Date, clickY: number) {
    const y = clamp(clickY, 0, gridHeight);
    const minutesFromStart = (y / gridHeight) * minutesPerDay;

    const step = 30;
    const rounded = Math.round(minutesFromStart / step) * step;

    const startMinutesFromMidnight = startHour * 60 + clamp(rounded, 0, minutesPerDay - step);

    const s = new Date(day);
    s.setHours(0, 0, 0, 0);
    s.setMinutes(startMinutesFromMidnight);

    const e = new Date(s);
    e.setMinutes(e.getMinutes() + durationMin);

    const endLimit = new Date(day);
    endLimit.setHours(endHour, 0, 0, 0);
    if (e > endLimit) e.setTime(endLimit.getTime());

    setStart(toLocalInput(s));
    setEnd(toLocalInput(e));
    setMsg(null);
  }

  function openEdit(slot: Slot) {
    if (!userId || slot.user_id !== userId) return;
    setEditing(slot);
    setEditStart(toLocalInput(new Date(slot.starts_at)));
    setEditEnd(toLocalInput(new Date(slot.ends_at)));
    setEditMsg(null);
  }

  function closeEdit() {
    setEditing(null);
    setEditStart("");
    setEditEnd("");
    setEditMsg(null);
  }

  async function createSlot() {
    setMsg(null);

    if (!userId) {
      setMsg("Bitte zuerst einloggen.");
      return;
    }
    if (!start || !end) {
      setMsg("Bitte Start und Ende auswählen.");
      return;
    }

    const s = new Date(start);
    const e = new Date(end);

    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      setMsg("Ungültiges Datum/Zeit.");
      return;
    }
    if (e <= s) {
      setMsg("Ende muss nach dem Start liegen.");
      return;
    }
    if (!isWithinAllowedMonth(s) || !isWithinAllowedMonth(e)) {
      setMsg(`⛔ Eintragen ist nur im Monat ${allowedTitle} möglich.`);
      return;
    }

    const { error } = await supabase.from("slots").insert({
      user_id: userId,
      starts_at: s.toISOString(),
      ends_at: e.toISOString(),
    });

    if (error) {
      if (isOverlapError(error)) setMsg("⛔ Diese Zeit ist schon belegt. Bitte anderes Zeitfenster wählen.");
      else setMsg("Fehler beim Speichern: " + error.message);
      console.error("Supabase insert slot error:", error);
      return;
    }

    setMsg("✅ Slot gespeichert!");
    setStart("");
    setEnd("");
    await load();
  }

  async function updateSlot() {
    setEditMsg(null);
    if (!editing || !userId) return;
    if (editing.user_id !== userId) return;

    const s = new Date(editStart);
    const e = new Date(editEnd);

    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      setEditMsg("Ungültiges Datum/Zeit.");
      return;
    }
    if (e <= s) {
      setEditMsg("Ende muss nach dem Start liegen.");
      return;
    }
    if (!isWithinAllowedMonth(s) || !isWithinAllowedMonth(e)) {
      setEditMsg(`⛔ Ändern ist nur im Monat ${allowedTitle} möglich.`);
      return;
    }

    const { error } = await supabase
      .from("slots")
      .update({ starts_at: s.toISOString(), ends_at: e.toISOString() })
      .eq("id", editing.id);

    if (error) {
      if (isOverlapError(error)) setEditMsg("⛔ Diese Zeit ist schon belegt. Bitte anderes Zeitfenster wählen.");
      else setEditMsg("Fehler: " + error.message);
      console.error("Supabase update slot error:", error);
      return;
    }

    closeEdit();
    await load();
  }

  async function deleteSlot() {
    setEditMsg(null);
    if (!editing || !userId) return;
    if (editing.user_id !== userId) return;

    // ✅ confirm (Punkt 2.2)
    if (!confirm("Diesen Slot wirklich löschen?")) return;

    const { error } = await supabase.from("slots").delete().eq("id", editing.id);
    if (error) {
      setEditMsg("Fehler beim Löschen: " + error.message);
      console.error("Supabase delete slot error:", error);
      return;
    }

    closeEdit();
    await load();
  }

  if (!mounted) return <div style={{ padding: 40, background: pageBg, color: textColor }}>Lade…</div>;

  // "Heute-Spalte" & "Now-Linie" ohne extra Hooks
  const now = new Date();
  const todayColIndex = days.findIndex((d) => sameDay(d, now));
  const isInThisWeek = now >= weekStart && now < addDays(weekStart, 7);

  const nowLineTop = (() => {
    if (!isInThisWeek) return null;
    const minutes = now.getHours() * 60 + now.getMinutes() - startHour * 60;
    const clamped = clamp(minutes, 0, minutesPerDay);
    return (clamped / 60) * hourHeight;
  })();

  const weekEnd = addDays(weekStart, 6);

  // Legend data (unique users in view)
  const legendUsers = (() => {
    const ids = Array.from(new Set(slots.map((s) => s.user_id)));
    return ids
      .map((id) => {
        const p = profiles[id];
        const color = isValidCssColor(p?.color) ? (p!.color as string) : "#f3f3f3";
        const isMe = userId && id === userId;
        const label = isMe ? `Du${userEmail ? ` (${userEmail})` : ""}` : p?.name ?? "Mieter";
        return { id, color, label, isMe };
      })
      .sort((a, b) => (a.isMe === b.isMe ? a.label.localeCompare(b.label) : a.isMe ? -1 : 1));
  })();

  return (
    <main style={{ background: pageBg, color: textColor, minHeight: "100vh", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
        <h1 style={{ margin: "4px 0 8px 0", fontSize: 22 }}>Waschplan</h1>

        {/* Nav */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <button onClick={() => setWeekStart((prev) => addDays(prev, -7))} style={buttonStyle}>
            ← Woche
          </button>
          <button
            onClick={() => {
              setWeekStart(startOfWeekMonday(new Date()));
            }}
            style={buttonStyle}
          >
            Heute
          </button>

          {/* ✅ Jetzt (scroll to now) */}
          <button
            onClick={() => {
              setWeekStart(startOfWeekMonday(new Date()));
              setScrollToNowToggle((x) => x + 1);
            }}
            style={buttonStyle}
          >
            Jetzt
          </button>

          <button onClick={() => setWeekStart((prev) => addDays(prev, 7))} style={buttonStyle}>
            Woche →
          </button>

          <span style={{ opacity: 0.85, fontSize: 13 }}>
            Woche: <b>{weekStart.toLocaleDateString()}</b> – <b>{weekEnd.toLocaleDateString()}</b>
          </span>

          <div style={{ flex: 1 }} />

          {loading && <span style={{ fontSize: 13, opacity: 0.7 }}>Lade…</span>}

          {!userEmail ? (
            <span style={{ opacity: 0.8, fontSize: 13 }}>Nicht eingeloggt</span>
          ) : (
            <span style={{ opacity: 0.8, fontSize: 13 }}>
              Eingeloggt als <b>{userEmail}</b>{" "}
              <button onClick={logout} style={{ ...buttonStyle, minHeight: 40, padding: "8px 10px", marginLeft: 6 }}>
                Logout
              </button>
            </span>
          )}
        </div>

        {/* Legend */}
        {legendUsers.length > 0 && (
          <div
            style={{
              marginBottom: 12,
              padding: 10,
              border: `1px solid ${border}`,
              borderRadius: 14,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              background: "#fff",
            }}
          >
            <span style={{ fontWeight: 800, marginRight: 6 }}>Legende:</span>
            {legendUsers.map((u) => (
              <div key={u.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: u.color,
                    border: "1px solid rgba(0,0,0,0.25)",
                    display: "inline-block",
                  }}
                />
                <span style={{ fontSize: 13, opacity: 0.9 }}>{u.label}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBottom: 14, padding: 12, border: `1px solid ${border}`, borderRadius: 14 }}>
          <b>Eintragen / Ändern nur möglich im Monat:</b> {allowedTitle}
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
            Tipp: Im Plan auf eine Uhrzeit tippen → Formular übernimmt Tag+Zeit. Eigene Slots antippen → ändern/löschen.
          </div>
        </div>

        {/* Login */}
        {!userEmail && (
          <div style={{ marginBottom: 14, border: `1px solid ${border}`, borderRadius: 14, padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Login</h3>
            <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
              <input placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
              <input
                type="password"
                placeholder="Passwort"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
              />
              <button onClick={login} style={{ ...buttonStyle, padding: "12px 14px" }}>
                Login
              </button>
            </div>
          </div>
        )}

        {/* Create form */}
        <div style={{ border: `1px solid ${border}`, borderRadius: 14, padding: 12, marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Slot anlegen</h3>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label style={{ display: "block", marginBottom: 6 }}>Start</label>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => {
                  const v = e.target.value;
                  setStart(v);
                  if (v) {
                    const s = new Date(v);
                    const ee = new Date(s);
                    ee.setMinutes(ee.getMinutes() + durationMin);
                    setEnd(toLocalInput(ee));
                  }
                }}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6 }}>Ende</label>
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle} />
            </div>

            {/* ✅ Dauer Buttons (Punkt 2.1) */}
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[30, 60, 90, 120].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setDurationMin(m);
                    if (start) {
                      const s = new Date(start);
                      const ee = new Date(s);
                      ee.setMinutes(ee.getMinutes() + m);
                      setEnd(toLocalInput(ee));
                    }
                  }}
                  style={{
                    padding: "8px 10px",
                    border: `1px solid ${border}`,
                    borderRadius: 12,
                    background: durationMin === m ? "#000" : "#fff",
                    color: durationMin === m ? "#fff" : "#000",
                    minHeight: 40,
                  }}
                >
                  {m} min
                </button>
              ))}
            </div>

            <button onClick={createSlot} style={{ ...buttonStyle, gridColumn: "1 / -1", padding: "12px 14px" }}>
              Speichern
            </button>
          </div>

          {/* ✅ Msg + Copy (Punkt 6.2/6.3) */}
          {msg && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ padding: 10, border: `1px solid ${border}`, borderRadius: 12, background: "#fff" }}>{msg}</div>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(msg)}
                style={{ padding: "8px 10px", border: `1px solid ${border}`, borderRadius: 12, background: "#fff" }}
              >
                Copy
              </button>
            </div>
          )}
        </div>

        {/* Plan */}
        <div style={{ border: `1px solid ${border}`, borderRadius: 14, overflow: "hidden", background: "#fff" }}>
          {/* ✅ vertical scroll enabled + max height for "Jetzt" scroll */}
          <div
            data-plan-scroll="1"
            style={{
              overflowX: "auto",
              overflowY: "auto",
              maxHeight: "75vh",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div style={{ minWidth: timeColW + dayMinW * 7 }}>
              {/* Sticky weekday header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: gridTemplate,
                  background: greyHeader,
                  position: "sticky",
                  top: 0,
                  zIndex: 20,
                  borderBottom: `1px solid ${border}`,
                }}
              >
                <div
                  style={{
                    padding: 10,
                    borderRight: `1px solid ${border}`,
                    fontWeight: 800,
                    position: "sticky",
                    left: 0,
                    zIndex: 30,
                    background: greyHeader,
                  }}
                >
                  Zeit
                </div>

                {days.map((d, i) => {
                  const isToday = i === todayColIndex;
                  return (
                    <div
                      key={i}
                      style={{
                        padding: 10,
                        borderRight: i === 6 ? "none" : `1px solid ${border}`,
                        background: greyHeader,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontWeight: 900 }}>{DAY_LABELS[i]}</div>
                        {isToday && (
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 999,
                              border: "1px solid rgba(0,0,0,0.25)",
                              background: "#fff",
                              fontWeight: 700,
                            }}
                          >
                            Heute
                          </span>
                        )}
                      </div>
                      <div style={{ opacity: 0.85, fontSize: 12 }}>{d.toLocaleDateString()}</div>
                    </div>
                  );
                })}
              </div>

              {/* Body grid */}
              <div style={{ display: "grid", gridTemplateColumns: gridTemplate, background: "#fff" }}>
                {/* Time column */}
                <div
                  style={{
                    borderRight: `1px solid ${border}`,
                    position: "sticky",
                    left: 0,
                    zIndex: 15,
                    background: greyHeader,
                  }}
                >
                  {Array.from({ length: endHour - startHour + 1 }, (_, idx) => {
                    const h = startHour + idx;
                    return (
                      <div
                        key={h}
                        style={{
                          height: hourHeight,
                          borderBottom: `1px solid ${border}`,
                          padding: "6px 8px",
                          fontSize: 12,
                          opacity: 0.95,
                          background: greyHeader,
                        }}
                      >
                        {String(h).padStart(2, "0")}:00
                      </div>
                    );
                  })}
                </div>

                {/* Day columns */}
                {days.map((day, col) => {
                  const isToday = col === todayColIndex;

                  return (
                    <div
                      key={col}
                      style={{
                        height: gridHeight,
                        borderRight: col === 6 ? "none" : `1px solid ${border}`,
                        position: "relative",
                        cursor: "pointer",
                        background: isToday ? "#fcfcfc" : "#fff",
                        touchAction: "manipulation",
                      }}
                      onClick={(e) => {
                        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                        const y = e.clientY - rect.top;
                        setFormForDayAtClick(day, y);
                      }}
                    >
                      {/* 30-min grid */}
                      {Array.from({ length: (endHour - startHour) * 2 }, (_, i) => (
                        <div
                          key={i}
                          style={{
                            height: hourHeight / 2,
                            borderBottom: i % 2 === 0 ? "1px solid #f0f0f0" : "1px solid #f7f7f7",
                          }}
                        />
                      ))}

                      {/* Now line (only current week + today col) */}
                      {isToday && isInThisWeek && nowLineTop !== null && (
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: nowLineTop,
                            height: 2,
                            background: "#000",
                            opacity: 0.55,
                            zIndex: 6,
                          }}
                        />
                      )}

                      {/* slots */}
                      {slots
                        .filter((s) => dayIndexFor(new Date(s.starts_at)) === col)
                        .map((s) => {
                          const st = new Date(s.starts_at);
                          const en = new Date(s.ends_at);

                          const topMin = clamp(minutesFromStartHour(st), 0, minutesPerDay);
                          const endMin = clamp(minutesFromStartHour(en), 0, minutesPerDay);
                          const durMin = Math.max(10, endMin - topMin);

                          const topPx = (topMin / 60) * hourHeight;
                          const heightPx = (durMin / 60) * hourHeight;

                          const isMine = userId && s.user_id === userId;
                          const prof = profiles[s.user_id];
                          const bg = isValidCssColor(prof?.color)
                            ? (prof!.color as string)
                            : isMine
                            ? "#e6f0ff"
                            : "#f3f3f3";
                          const who = isMine ? "Du" : prof?.name ?? "Belegt";

                          return (
                            <button
                              key={s.id}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                openEdit(s);
                              }}
                              disabled={!isMine}
                              title={isMine ? "Tippen zum Ändern/Löschen" : "Belegt"}
                              style={{
                                position: "absolute",
                                top: topPx,
                                left: 8,
                                right: 8,
                                height: heightPx,
                                borderRadius: 14,
                                border: "1px solid rgba(0,0,0,0.25)",
                                background: bg,
                                padding: 10,
                                fontSize: 12,
                                overflow: "hidden",
                                textAlign: "left",
                                cursor: isMine ? "pointer" : "default",
                                color: "#000",
                                boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                <div style={{ fontWeight: 900 }}>{who}</div>
                                <div style={{ fontSize: 11, opacity: 0.9 }}>
                                  {st.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–{" "}
                                  {en.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </div>
                              {isMine ? (
                                <div style={{ marginTop: 6, fontSize: 11, opacity: 0.85 }}>Tippen zum Bearbeiten</div>
                              ) : (
                                <div style={{ marginTop: 6, fontSize: 11, opacity: 0.75 }}>belegt</div>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div
          onClick={closeEdit}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.40)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: 12,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(620px, 100%)",
              background: "#fff",
              color: "#000",
              borderRadius: 18,
              border: `1px solid ${border}`,
              padding: 14,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h3 style={{ margin: 0 }}>Eigenen Slot bearbeiten</h3>
              <button onClick={closeEdit} style={buttonStyle}>
                ✕
              </button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Start</label>
                <input
                  type="datetime-local"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Ende</label>
                <input type="datetime-local" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} style={inputStyle} />
              </div>

              {editMsg && (
                <div style={{ padding: 10, border: `1px solid ${border}`, borderRadius: 12, background: "#fff" }}>
                  {editMsg}
                </div>
              )}

              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                <button onClick={updateSlot} style={{ ...buttonStyle, padding: "12px 14px" }}>
                  Speichern
                </button>
                <button onClick={deleteSlot} style={{ ...buttonStyle, padding: "12px 14px" }}>
                  Löschen
                </button>
              </div>

              <div style={{ opacity: 0.75, fontSize: 12 }}>
                Hinweis: Ändern/Löschen geht nur für <b>deine</b> Slots und nur im Monat <b>{allowedTitle}</b>.
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
