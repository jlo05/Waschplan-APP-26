"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Slot = {
  id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
};

function toLocalInputValue(d: Date) {
  // yyyy-mm-ddThh:mm für <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export default function PlanPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const [start, setStart] = useState(toLocalInputValue(new Date(now.setHours(7, 0, 0, 0))));
  const [end, setEnd] = useState(toLocalInputValue(new Date(new Date().setHours(8, 0, 0, 0))));

  async function load() {
    setMsg(null);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? null;
    setUserId(uid);

    const { data, error } = await supabase
      .from("slots")
      .select("id,user_id,starts_at,ends_at")
      .order("starts_at", { ascending: true });

    if (error) setMsg(error.message);
    else setSlots((data ?? []) as Slot[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function createSlot() {
    setMsg(null);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) {
      setMsg("Bitte einloggen.");
      return;
    }

    const startsAt = new Date(start);
    const endsAt = new Date(end);

    const { error } = await supabase.from("slots").insert({
      user_id: uid,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    });

    if (error) {
      // Überlappung kommt als DB-Fehler -> wir zeigen eine verständliche Meldung
      if (error.message.toLowerCase().includes("overlap") || error.message.toLowerCase().includes("exclude")) {
        setMsg("Diese Zeit ist schon belegt. Bitte anderes Zeitfenster wählen.");
      } else {
        setMsg(error.message);
      }
      return;
    }

    setMsg("Slot gespeichert!");
    await load();
  }

  async function deleteSlot(id: string, slotUserId: string) {
    setMsg(null);
    if (!userId) return;

    if (slotUserId !== userId) {
      setMsg("Du kannst nur deine eigenen Slots löschen.");
      return;
    }

    const { error } = await supabase.from("slots").delete().eq("id", id);
    if (error) setMsg(error.message);
    else {
      setMsg("Slot gelöscht.");
      await load();
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Waschplan (Test)</h1>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr auto" }}>
        <div>
          <label style={{ display: "block", marginBottom: 6 }}>Start</label>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 10 }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 6 }}>Ende</label>
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 10 }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            onClick={createSlot}
            style={{ padding: "10px 14px", border: "1px solid #ccc", borderRadius: 10, width: 140 }}
          >
            Speichern
          </button>
        </div>
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <h2 style={{ marginTop: 24, fontSize: 18, fontWeight: 700 }}>Slots</h2>
      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {slots.map((s) => (
          <div
            key={s.id}
            style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", gap: 10 }}
          >
            <div>
              <div><b>{new Date(s.starts_at).toLocaleString()}</b> → <b>{new Date(s.ends_at).toLocaleString()}</b></div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>user: {s.user_id}</div>
            </div>
            <button onClick={() => deleteSlot(s.id, s.user_id)} style={{ border: "1px solid #ccc", borderRadius: 10, padding: "8px 10px" }}>
              Löschen
            </button>
          </div>
        ))}
        {slots.length === 0 && <p style={{ opacity: 0.7 }}>Noch keine Slots.</p>}
      </div>

      <p style={{ marginTop: 18, opacity: 0.7 }}>
        Öffne diese Seite: <b>/plan</b> (z.B. http://localhost:3000/plan)
      </p>
    </main>
  );
}
