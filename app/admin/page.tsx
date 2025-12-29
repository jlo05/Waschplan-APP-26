"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Profile = {
  id: string;
  name: string | null;
  color: string | null;
};

function isValidCssColor(s: string | null | undefined) {
  return !!s && typeof s === "string" && s.trim().length > 0;
}

export default function AdminPage() {
  const [mounted, setMounted] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const adminEmail = useMemo(() => (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase(), []);

  useEffect(() => {
    setMounted(true);
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    setMsg(null);

    const { data } = await supabase.auth.getSession();
    const email = data.session?.user?.email ?? null;

    setUserEmail(email);
    setIsAdmin(!!email && email.toLowerCase() === adminEmail);

    if (!!email && email.toLowerCase() === adminEmail) {
      await loadProfiles();
    }
  }

  async function loadProfiles() {
    setMsg(null);

    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,color")
      .order("created_at", { ascending: true });

    if (error) {
      setMsg("Fehler beim Laden: " + error.message);
      return;
    }

    setProfiles((data ?? []) as Profile[]);
  }

  function updateLocal(id: string, patch: Partial<Profile>) {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function saveProfile(p: Profile) {
    setMsg(null);

    const color = isValidCssColor(p.color) ? p.color : "#e6f0ff";

    const { error } = await supabase
      .from("profiles")
      .update({ name: p.name ?? null, color })
      .eq("id", p.id);

    if (error) {
      setMsg("Fehler beim Speichern: " + error.message);
      return;
    }

    setMsg("✅ Gespeichert.");
    await loadProfiles();
  }

  if (!mounted) return <div style={{ padding: 40 }}>Lade…</div>;

  if (!userEmail) {
    return (
      <main style={{ maxWidth: 900, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
        <h1>Admin</h1>
        <p>Bitte zuerst einloggen (über /plan).</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main style={{ maxWidth: 900, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
        <h1>Admin</h1>
        <p>
          Eingeloggt als <b>{userEmail}</b>
        </p>
        <p style={{ padding: 10, border: "1px solid #eee", borderRadius: 12 }}>
          ⛔ Kein Zugriff. (Admin ist: <b>{adminEmail || "nicht gesetzt"}</b>)
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1100, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 8 }}>Admin: Namen & Farben</h1>

      <div style={{ marginBottom: 14, opacity: 0.8 }}>
        Eingeloggt als <b>{userEmail}</b>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <button
          onClick={loadProfiles}
          style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 10 }}
        >
          Neu laden
        </button>
        <a
          href="/plan"
          style={{
            padding: "8px 10px",
            border: "1px solid #ccc",
            borderRadius: 10,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          ← zurück zu /plan
        </a>
      </div>

      {msg && <p style={{ marginBottom: 14 }}>{msg}</p>}

      <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 2fr 1fr 1fr",
            gap: 0,
            background: "#fafafa",
            borderBottom: "1px solid #eee",
          }}
        >
          <div style={{ padding: 10, fontWeight: 700 }}>ID</div>
          <div style={{ padding: 10, fontWeight: 700 }}>Name</div>
          <div style={{ padding: 10, fontWeight: 700 }}>Farbe</div>
          <div style={{ padding: 10, fontWeight: 700 }}>Aktion</div>
        </div>

        {profiles.map((p) => (
          <div
            key={p.id}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 2fr 1fr 1fr",
              borderBottom: "1px solid #f0f0f0",
              alignItems: "center",
            }}
          >
            <div style={{ padding: 10, fontSize: 12, opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis" }}>
              {p.id}
            </div>

            <div style={{ padding: 10 }}>
              <input
                value={p.name ?? ""}
                onChange={(e) => updateLocal(p.id, { name: e.target.value })}
                placeholder="z.B. Partei A"
                style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 10 }}
              />
            </div>

            <div style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="color"
                value={isValidCssColor(p.color) ? (p.color as string) : "#e6f0ff"}
                onChange={(e) => updateLocal(p.id, { color: e.target.value })}
                style={{ width: 44, height: 36, border: "none", background: "transparent" }}
                title="Farbe wählen"
              />
              <input
                value={p.color ?? ""}
                onChange={(e) => updateLocal(p.id, { color: e.target.value })}
                placeholder="#A0C4FF"
                style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 10 }}
              />
            </div>

            <div style={{ padding: 10 }}>
              <button
                onClick={() => saveProfile(p)}
                style={{ padding: "10px 14px", border: "1px solid #ccc", borderRadius: 10, width: "100%" }}
              >
                Speichern
              </button>
            </div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>
        Tipp: Name ist optional. Farbe ist pro User fix und wird im Waschplan für die Slot-Blöcke verwendet.
      </p>
    </main>
  );
}
