"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type ProfileRow = {
  id: string;
  name: string | null;
  color: string | null;
};

const ADMIN_EMAIL = "jlo05@bluewin.ch";

export default function AdminPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [msg, setMsg] = useState<string>("");

  const isAdmin = (userEmail || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserEmail(s?.user?.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadProfiles() {
    setMsg("");
    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,color")
      .order("name", { ascending: true });

    if (error) setMsg(`Fehler beim Laden: ${error.message}`);
    else setProfiles((data ?? []) as ProfileRow[]);
  }

  useEffect(() => {
    if (isAdmin) loadProfiles();
  }, [isAdmin]);

  async function saveProfile(p: ProfileRow) {
    setMsg("");
    const { error } = await supabase
      .from("profiles")
      .update({ name: p.name, color: p.color })
      .eq("id", p.id);

    if (error) setMsg(`Fehler beim Speichern: ${error.message}`);
    else {
      setMsg("Gespeichert ✅");
      setTimeout(() => setMsg(""), 2000);
      loadProfiles();
    }
  }

  // Nicht eingeloggt
  if (!userEmail) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Bitte einloggen</h2>
        <a href="/plan">← zurück zum Waschplan</a>
      </div>
    );
  }

  // Nicht Admin: KEINE Admin-Mail anzeigen
  if (!isAdmin) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Kein Zugriff</h2>
        <p>Du bist nicht berechtigt.</p>
        <a href="/plan">← zurück zum Waschplan</a>
      </div>
    );
  }

  // Admin UI
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1>Admin: Namen & Farben</h1>

      <div
        style={{
          marginTop: 10,
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          background: "#fff",
        }}
      >
        <div style={{ marginBottom: 12 }}>
          Eingeloggt als <b>{userEmail}</b>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={loadProfiles} style={btn}>
            Neu laden
          </button>
          <a href="/plan" style={{ ...btn, display: "inline-block", textDecoration: "none", color: "#111" }}>
            ← zurück zu /plan
          </a>
        </div>

        {msg && <div style={{ marginBottom: 12 }}>{msg}</div>}

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              <th style={th}>ID</th>
              <th style={th}>Name</th>
              <th style={th}>Farbe</th>
              <th style={th}>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={td}>{p.id}</td>

                <td style={td}>
                  <input
                    value={p.name ?? ""}
                    onChange={(e) =>
                      setProfiles((all) => all.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))
                    }
                    style={input}
                  />
                </td>

                <td style={td}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="color"
                      value={p.color ?? "#cccccc"}
                      onChange={(e) =>
                        setProfiles((all) => all.map((x) => (x.id === p.id ? { ...x, color: e.target.value } : x)))
                      }
                      style={{
                        width: 42,
                        height: 36,
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                    <input
                      value={p.color ?? ""}
                      onChange={(e) =>
                        setProfiles((all) => all.map((x) => (x.id === p.id ? { ...x, color: e.target.value } : x)))
                      }
                      style={{ ...input, width: 120 }}
                    />
                  </div>
                </td>

                <td style={td}>
                  <button onClick={() => saveProfile(p)} style={{ ...btn, background: "#111", color: "#fff" }}>
                    Speichern
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          Tipp: Nur Admin darf Namen/Farben ändern. Farben werden im Waschplan verwendet.
        </p>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: 10 };
const td: React.CSSProperties = { padding: 10, verticalAlign: "middle" };
const input: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
};
const btn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

