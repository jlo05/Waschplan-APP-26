"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type SlotRow = {
  id: string;
  user_id: string;
  starts_at: string; // ISO
  ends_at: string; // ISO
};

type ProfileRow = {
  id: string; // user id
  name: string | null;
  color: string | null;
};

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalDatetimeInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addMonths(d: Date, months: number) {
  const x = new Date(d);
  const day = x.getDate();
  x.setMonth(x.getMonth() + months);
  if (x.getDate() !== day) x.setDate(0);
  return x;
}

function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  const jsDay = x.getDay(); // 0=So ... 1=Mo ... 6=Sa
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  x.setDate(x.getDate() + diff);
  return x;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function minutesToHourLabel(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m}`;
}

export default function PlanPage() {
  // Grid settings
  const DAY_START_HOUR = 7;
  const DAY_END_HOUR = 22;
  const SLOT_MINUTES = 30;

  const MOBILE_BREAKPOINT = 520;
  // Breite pro Tag auf Mobile: macht die Slots lesbar, Woche per Scroll erreichbar
  const MOBILE_DAY_W = 140;

  // Booking window: today -> today + 2 months (rolling)
  const bookingMin = useMemo(() => startOfDay(new Date()), []);
  const bookingMax = useMemo(() => addMonths(new Date(), 2), []);

  // State
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [startValue, setStartValue] = useState<string>("");
  const [endValue, setEndValue] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [msg, setMsg] = useState<string>("");
  const [justSaved, setJustSaved] = useState<boolean>(false);

  const [isMobile, setIsMobile] = useState(false);

  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  const weekRange = useMemo(() => {
    const from = new Date(weekStart);
    const to = new Date(weekStart);
    to.setDate(to.getDate() + 7);
    return { from, to };
  }, [weekStart]);

  const timeRows = useMemo(() => {
    const rows: { label: string; minutesFromStart: number }[] = [];
    const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
    for (let m = 0; m <= totalMinutes; m += SLOT_MINUTES) {
      const hh = DAY_START_HOUR + Math.floor(m / 60);
      const mm = m % 60;
      rows.push({ label: `${pad2(hh)}:${pad2(mm)}`, minutesFromStart: m });
    }
    return rows;
  }, []);

  // Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      if (s?.user) {
        setUserId(s.user.id);
        setUserEmail(s.user.email ?? null);
      } else {
        setUserId(null);
        setUserEmail(null);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUserId(u?.id ?? null);
      setUserEmail(u?.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadData() {
    setMsg("");

    const { data: slotData, error: slotErr } = await supabase
      .from("slots")
      .select("id,user_id,starts_at,ends_at")
      .gte("starts_at", weekRange.from.toISOString())
      .lt("starts_at", weekRange.to.toISOString())
      .order("starts_at", { ascending: true });

    if (slotErr) setMsg(`Fehler beim Laden Slots: ${slotErr.message}`);
    else setSlots((slotData ?? []) as SlotRow[]);

    const { data: profData, error: profErr } = await supabase.from("profiles").select("id,name,color");
    if (profErr) {
      setMsg((m) => (m ? m + " | " : "") + `Fehler beim Laden Profiles: ${profErr.message}`);
    } else {
      const map: Record<string, ProfileRow> = {};
      (profData ?? []).forEach((p: any) => {
        map[p.id] = { id: p.id, name: p.name ?? null, color: p.color ?? null };
      });
      setProfiles(map);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const userDisplayName = useMemo(() => {
    if (!userId) return null;
    const n = profiles[userId]?.name?.trim();
    return n && n.length > 0 ? n : userEmail;
  }, [profiles, userId, userEmail]);

  function withinBookingWindow(d: Date) {
    return d.getTime() >= bookingMin.getTime() && d.getTime() <= bookingMax.getTime();
  }

  function slotColor(uid: string) {
    return profiles[uid]?.color || "#9CA3AF";
  }

  function slotLabel(uid: string) {
    const p = profiles[uid];
    const n = p?.name?.trim();
    if (n) return n;
    return "User";
  }

  function formatDayHeader(d: Date) {
    return `${WEEKDAYS[(d.getDay() + 6) % 7]} ${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
  }

  function minutesSinceDayStart(d: Date) {
    return (d.getHours() - DAY_START_HOUR) * 60 + d.getMinutes();
  }

  function overlapsExisting(start: Date, end: Date, ignoreId?: string | null) {
    const sISO = start.toISOString();
    const eISO = end.toISOString();
    return slots.some((x) => {
      if (ignoreId && x.id === ignoreId) return false;
      return sISO < x.ends_at && eISO > x.starts_at;
    });
  }

  // Click day column => set form time
  function handleClickCell(dayIndex: number, clientY: number) {
    const grid = gridRef.current;
    if (!grid) return;

    const rect = grid.getBoundingClientRect();
    const y = clientY - rect.top;

    const headerHLocal = 44; // must match headerH below
    const usableH = rect.height - headerHLocal;
    const y2 = y - headerHLocal;
    if (y2 < 0) return;

    const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
    const minutes = clamp(
      Math.round(((y2 / usableH) * totalMinutes) / SLOT_MINUTES) * SLOT_MINUTES,
      0,
      totalMinutes
    );

    const start = new Date(weekDays[dayIndex]);
    start.setHours(DAY_START_HOUR, 0, 0, 0);
    start.setMinutes(start.getMinutes() + minutes);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 60);

    setEditingId(null);
    setStartValue(toLocalDatetimeInputValue(start));
    setEndValue(toLocalDatetimeInputValue(end));
    setMsg("");
    setJustSaved(false);
  }

  // Duration buttons: 2h, 4h, 6h (green)
  const quickDurations = useMemo(() => [120, 240, 360], []);
  function applyDuration(minutes: number) {
    if (!startValue) return;
    const s = new Date(startValue);
    if (isNaN(s.getTime())) return;
    const e = new Date(s);
    e.setMinutes(e.getMinutes() + minutes);
    setEndValue(toLocalDatetimeInputValue(e));
  }

  // Auth
  async function login() {
    setMsg("");
    setJustSaved(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(`Login Fehler: ${error.message}`);
  }

  async function logout() {
    setMsg("");
    setJustSaved(false);
    const { error } = await supabase.auth.signOut();
    if (error) setMsg(`Logout Fehler: ${error.message}`);
  }

  // Save / Update / Delete
  async function saveSlot() {
    setMsg("");
    setJustSaved(false);

    if (!userId) {
      setMsg("Bitte zuerst einloggen.");
      return;
    }
    if (!startValue || !endValue) {
      setMsg("Bitte Start und Ende wählen.");
      return;
    }

    const start = new Date(startValue);
    const end = new Date(endValue);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setMsg("Ungültiges Datum.");
      return;
    }
    if (end <= start) {
      setMsg("Ende muss nach Start sein.");
      return;
    }

    if (!withinBookingWindow(start) || !withinBookingWindow(end)) {
      setMsg(`Eintragen nur ab heute bis max. ${bookingMax.toLocaleDateString()} möglich.`);
      return;
    }

    if (overlapsExisting(start, end, editingId)) {
      setMsg("Dieses Zeitfenster überlappt mit einem bestehenden Slot.");
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("slots")
        .update({ starts_at: start.toISOString(), ends_at: end.toISOString() })
        .eq("id", editingId)
        .eq("user_id", userId);

      if (error) {
        setMsg(`Fehler beim Ändern: ${error.message}`);
        return;
      }

      setEditingId(null);
      setJustSaved(true);
      setMsg("Gespeichert ✅");
      setTimeout(() => setJustSaved(false), 1800);

      await loadData();
      return;
    }

    const { error } = await supabase
      .from("slots")
      .insert({ user_id: userId, starts_at: start.toISOString(), ends_at: end.toISOString() });

    if (error) {
      setMsg(`Fehler beim Speichern: ${error.message}`);
      return;
    }

    setJustSaved(true);
    setMsg("Gespeichert ✅");
    setTimeout(() => setJustSaved(false), 1800);

    await loadData();
  }

  async function deleteSlot(id: string) {
    setMsg("");
    setJustSaved(false);
    if (!userId) return;

    const { error } = await supabase.from("slots").delete().eq("id", id).eq("user_id", userId);
    if (error) {
      setMsg(`Fehler beim Löschen: ${error.message}`);
      return;
    }
    setMsg("Slot gelöscht ✅");
    await loadData();
  }

  function startEdit(slot: SlotRow) {
    if (!userId || slot.user_id !== userId) return;
    setEditingId(slot.id);
    setStartValue(toLocalDatetimeInputValue(new Date(slot.starts_at)));
    setEndValue(toLocalDatetimeInputValue(new Date(slot.ends_at)));
    setMsg("");
    setJustSaved(false);
  }

  // NOW line only in today column (red)
  const nowLineInfo = useMemo(() => {
    const n = new Date();
    const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
    const mins = minutesSinceDayStart(n);
    if (mins < 0 || mins > totalMinutes) return null;

    const todayIndex = weekDays.findIndex((d) => sameDay(d, n));
    if (todayIndex === -1) return null;

    return { todayIndex, mins };
  }, [weekDays]);

  // Layout sizes
  const timeColW = 70;
  const headerH = 44;
  const rowH = 24;
  const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const gridH = Math.round((totalMinutes / SLOT_MINUTES) * rowH);

  // Slots by day
  const slotsByDay = useMemo(() => {
    const map: Record<number, SlotRow[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const s of slots) {
      const d = new Date(s.starts_at);
      for (let i = 0; i < 7; i++) {
        if (sameDay(d, weekDays[i])) map[i].push(s);
      }
    }
    for (let i = 0; i < 7; i++) map[i].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return map;
  }, [slots, weekDays]);

  // Legend bottom
  const legendUsers = useMemo(() => {
    const ids = Array.from(new Set(slots.map((s) => s.user_id)));
    const all = Object.keys(profiles);
    return Array.from(new Set([...ids, ...all]));
  }, [slots, profiles]);

  return (
    <div style={{ background: "#fff", color: "#111", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 14px 8px" }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Waschplan</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              Eintragen erlaubt: <b>{bookingMin.toLocaleDateString()}</b> bis <b>{bookingMax.toLocaleDateString()}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() =>
                setWeekStart((w) => {
                  const x = new Date(w);
                  x.setDate(x.getDate() - 7);
                  return x;
                })
              }
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
              }}
            >
              ← Woche
            </button>

            <button
              onClick={() => setWeekStart(startOfWeekMonday(new Date()))}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
              }}
            >
              Heute
            </button>

            <button
              onClick={() =>
                setWeekStart((w) => {
                  const x = new Date(w);
                  x.setDate(x.getDate() + 7);
                  return x;
                })
              }
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
              }}
            >
              Woche →
            </button>

            <a
              href="/admin"
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
                textDecoration: "none",
                color: "#111",
              }}
            >
              Admin
            </a>
          </div>
        </div>

        {/* Login / Status */}
        <div style={{ marginTop: 10, padding: 12, border: "1px solid #e5e7eb", borderRadius: 14 }}>
          {!userEmail ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>Login</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-Mail"
                style={{
                  padding: "9px 10px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  minWidth: 220,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Passwort"
                type="password"
                style={{
                  padding: "9px 10px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  minWidth: 220,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
              <button
                onClick={login}
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#111",
                  color: "#fff",
                }}
              >
                Login
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                Eingeloggt als <b>{userDisplayName ?? userEmail}</b>
              </div>
              <button
                onClick={logout}
                style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" }}
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Form */}
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #e5e7eb", borderRadius: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontWeight: 900,
                fontSize: 14,
                background: "#22c55e",
                color: "#0b1f10",
                padding: "8px 12px",
                borderRadius: 999,
              }}
            >
              Waschzeit eintragen
            </div>

            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {editingId ? "Du bearbeitest gerade deinen Slot (Slot anklicken)" : "Klick in den Plan setzt Startzeit"}
            </div>
          </div>

          {/* ✅ FIX: Mobile 1 Spalte, Desktop 2 Spalten */}
          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, opacity: 0.75 }}>Start</label>
              <input
                type="datetime-local"
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, opacity: 0.75 }}>Ende</label>
              <input
                type="datetime-local"
                value={endValue}
                onChange={(e) => setEndValue(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Duration Buttons */}
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Dauer:</div>
            {quickDurations.map((min) => (
              <button
                key={min}
                onClick={() => applyDuration(min)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid #bbf7d0",
                  background: "#86efac",
                  color: "#111",
                  fontWeight: 900,
                }}
                title={`Dauer: ${minutesToHourLabel(min)}`}
              >
                {minutesToHourLabel(min)}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={saveSlot}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#111",
                color: "#fff",
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {editingId ? "Änderung speichern" : "Speichern"}
              {justSaved && <span style={{ fontSize: 18, lineHeight: 1 }}>✅</span>}
            </button>

            {editingId && (
              <button
                onClick={() => {
                  setEditingId(null);
                  setMsg("");
                  setJustSaved(false);
                }}
                style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff" }}
              >
                Abbrechen
              </button>
            )}

            <button
              onClick={loadData}
              style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff" }}
            >
              Neu laden
            </button>
          </div>

          {msg && <div style={{ marginTop: 10, color: msg.includes("Fehler") ? "#b91c1c" : "#065f46" }}>{msg}</div>}

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Eintragen/Ändern ist nur möglich ab heute bis max. <b>{bookingMax.toLocaleDateString()}</b>.
          </div>
        </div>
      </div>

      {/* Plan */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 14px 18px" }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff" }}>
          {/* ✅ Horizontal scroll container */}
          <div
            style={{
              overflowX: "auto",
              overflowY: "hidden",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div style={{ minWidth: isMobile ? timeColW + 7 * MOBILE_DAY_W : 0 }}>
              {/* Sticky header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? `${timeColW}px repeat(7, ${MOBILE_DAY_W}px)`
                    : `${timeColW}px repeat(7, 1fr)`,
                  position: "sticky",
                  top: 0,
                  zIndex: 5,
                  background: "#f3f4f6",
                  borderBottom: "1px solid #e5e7eb",
                  height: headerH,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    paddingLeft: 10,
                    fontSize: isMobile ? 11 : 12,
                    opacity: 0.7,
                    position: "sticky",
                    left: 0,
                    zIndex: 7,
                    background: "#f3f4f6",
                    borderRight: "1px solid #e5e7eb",
                  }}
                >
                  Zeit
                </div>

                {weekDays.map((d, i) => {
                  const isToday = sameDay(d, new Date());
                  return (
                    <div
                      key={i}
                      style={{
                        padding: isMobile ? "0 6px" : "0 10px",
                        fontWeight: 800,
                        fontSize: isMobile ? 12 : 13,
                        lineHeight: 1.1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={formatDayHeader(d)}
                    >
                      {formatDayHeader(d)} {isToday ? "•" : ""}
                    </div>
                  );
                })}
              </div>

              {/* Grid */}
              <div
                ref={gridRef}
                style={{
                  position: "relative",
                  height: gridH + 1,
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? `${timeColW}px repeat(7, ${MOBILE_DAY_W}px)`
                    : `${timeColW}px repeat(7, 1fr)`,
                }}
              >
                {/* Time column (sticky left) */}
                <div
                  style={{
                    background: "#f3f4f6",
                    borderRight: "1px solid #e5e7eb",
                    position: "sticky",
                    left: 0,
                    zIndex: 6,
                  }}
                >
                  {timeRows.map((t, idx) => (
                    <div
                      key={idx}
                      style={{
                        height: rowH,
                        borderBottom: "1px solid #e5e7eb",
                        paddingLeft: 10,
                        display: "flex",
                        alignItems: "center",
                        fontSize: isMobile ? 11 : 12,
                        opacity: 0.75,
                      }}
                    >
                      {t.label}
                    </div>
                  ))}
                </div>

                {/* Days */}
                {weekDays.map((_, dayIndex) => {
                  const isTodayCol = nowLineInfo?.todayIndex === dayIndex;
                  const nowTop = nowLineInfo ? (nowLineInfo.mins / SLOT_MINUTES) * rowH : 0;

                  return (
                    <div
                      key={dayIndex}
                      onClick={(e) => handleClickCell(dayIndex, (e as any).clientY)}
                      style={{
                        position: "relative",
                        borderRight: dayIndex === 6 ? "none" : "1px solid #e5e7eb",
                        background: "#fff",
                        cursor: "crosshair",
                      }}
                    >
                      {/* Raster */}
                      {timeRows.map((_, idx) => (
                        <div key={idx} style={{ height: rowH, borderBottom: "1px solid #f0f1f3" }} />
                      ))}

                      {/* Now line: only today, red */}
                      {isTodayCol && nowLineInfo && (
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: nowTop,
                            height: 2,
                            background: "#ef4444",
                            zIndex: 4,
                            pointerEvents: "none",
                          }}
                        />
                      )}

                      {/* Slots */}
                      {slotsByDay[dayIndex]?.map((s) => {
                        const sStart = new Date(s.starts_at);
                        const sEnd = new Date(s.ends_at);

                        const topMinutes = minutesSinceDayStart(sStart);
                        const endMinutes = minutesSinceDayStart(sEnd);

                        const h = Math.max(1, ((endMinutes - topMinutes) / SLOT_MINUTES) * rowH);
                        const top = (topMinutes / SLOT_MINUTES) * rowH;

                        const mine = userId && s.user_id === userId;

                        return (
                          <div
                            key={s.id}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              if (!mine) return;
                              startEdit(s);
                            }}
                            style={{
                              position: "absolute",
                              left: 8,
                              right: 8,
                              top,
                              height: h,
                              background: slotColor(s.user_id),
                              color: "#fff",
                              borderRadius: 12,
                              padding: isMobile ? "6px 8px" : "8px 10px",
                              boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
                              cursor: mine ? "pointer" : "default",
                              userSelect: "none",
                              overflow: "hidden",
                            }}
                            title={mine ? "Klicken zum Bearbeiten" : ""}
                          >
                            {/* ✅ Name */}
                            <div
                              style={{
                                fontWeight: 900,
                                fontSize: isMobile ? 12 : 13,
                                lineHeight: 1.1,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={slotLabel(s.user_id)}
                            >
                              {slotLabel(s.user_id)}
                            </div>

                            {/* ✅ Zeiten */}
                            <div
                              style={{
                                fontSize: isMobile ? 11 : 12,
                                opacity: 0.98,
                                marginTop: 4,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {pad2(sStart.getHours())}:{pad2(sStart.getMinutes())} – {pad2(sEnd.getHours())}:{pad2(sEnd.getMinutes())}
                            </div>

                            {/* ✅ belegt (ohne Dauer) */}
                            <div style={{ fontSize: isMobile ? 11 : 12, opacity: 0.92, marginTop: 2, fontWeight: 800 }}>
                              belegt
                            </div>

                            {mine && (
                              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                                <button
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    deleteSlot(s.id);
                                  }}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(255,255,255,0.45)",
                                    background: "rgba(0,0,0,0.18)",
                                    color: "#fff",
                                    fontWeight: 800,
                                    fontSize: 12,
                                  }}
                                >
                                  Löschen
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Legend bottom */}
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff" }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Legende</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {legendUsers
              .filter((uid) => uid && profiles[uid]?.color)
              .map((uid) => (
                <div
                  key={uid}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 999,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: slotColor(uid),
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{slotLabel(uid)}</span>
                </div>
              ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Hinweis: Nur eigene Slots sind anklickbar (ändern/löschen).
          </div>
        </div>
      </div>
    </div>
  );
}
