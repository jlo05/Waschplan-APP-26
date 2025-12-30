"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Profile = {
  id: string;
  name: string | null;
  color: string | null;
};

const ADMIN_EMAIL = "jlo05@bluewin.ch";

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    setMsg("");
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      setMsg("Fehler: Bitte neu einloggen.");
      setEmail(null);
      setIsAdmin(false);
      return;
    }

    const userEmail = user?.email ?? null;
    setEmail(userEmail);
    setIsAdmin(userEmail?.toLowerCase() === ADMIN_EMAIL.toLowerCase());

    // Profiles laden (nur Anzeige – Updates werden unten blockiert + zusätzlich per RLS abgesichert)
    await loadProfiles();
  }

  async function loadProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,color")
      .order("name", { ascending: true });

    if (error) {
      setMsg(`Fehler beim Laden: ${error.message}`);
      setProfiles([]);
    } else {
      setProfiles((data ?? []) as Profile[]);
    }
  }

  function updateLocal(patch: Partial<Profile> & { id: string }) {
    setProfiles((all) => all.map((x) => (x.id === patch.id ? { ...x, ...patch } : x)));
  }

  async function saveProfile(p: Profile) {
    setMsg("");

    if (!isAdmin) {
      setMsg(`Kein Zugriff. Eingeloggt als ${email ?? "?"}`);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ name: p.name, color: p.color })
      .eq("id", p.id);

    if (error) {
      setMsg(`Fehler beim Speichern: ${error.message}`);
    } else {
      setMsg("Gespeichert ✅");
      setTimeout(() => setMsg(""), 2000);
    }
  }

  const bannerText = isAdmin
    ? `Admin: ${ADMIN_EMAIL}`
    : `Kein Zugriff. Eingeloggt als ${email ?? "nicht eingeloggt"}`;

  return (
    <main style={{ maxWidth: 1000, margin: "30px auto", padding: 16 }}>
      <h1>Admin: Namen & Farben</h1>

      <div
        style={{
          margin: "12px 0",
          padding: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: isAdmin ? "#ecfdf5" : "#fef2f2",
          color: "#111",
        }}
      >
        <div style={{ fontWeight: 800 }}>{bannerText}</div>
        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={loadProfiles}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Neu laden
          </button>

          <a
            href="/plan"
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#fff",
              textDecoration: "none",
              color: "#111",
              fontWeight: 700,
              display: "inline-block",
            }}
          >
            ← zurück zu /plan
          </a>
        </div>
      </div>

      {msg && <div style={{ marginBottom: 12 }}>{msg}</div>}

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f3f4f6" }}>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Name</th>
              <th style={th}>Farbe</th>
              <th style={th}>Aktion</th>
            </tr>
          </thead>

          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={td}>{p.id}</td>

                <td style={td}>
                  <input
                    value={p.name ?? ""}
                    disabled={!isAdmin}
                    onChange={(e) => updateLocal({ id: p.id, name: e.target.value })}
                    style={{ ...input, opacity: isAdmin ? 1 : 0.6 }}
                  />
                </td>

                <td style={{ ...td, minWidth: 180 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="color"
                      value={p.color ?? "#cccccc"}
                      disabled={!isAdmin}
                      onChange={(e) => updateLocal({ id: p.id, color: e.target.value })}
                      style={{
                        width: 36,
                        height: 36,
                        border: "none",
                        padding: 0,
                        background: "none",
                        cursor: isAdmin ? "pointer" : "not-allowed",
                        opacity: isAdmin ? 1 : 0.6,
                      }}
                    />

                    <input
                      value={p.color ?? ""}
                      disabled={!isAdmin}
                      onChange={(e) => updateLocal({ id: p.id, color: e.target.value })}
                      style={{ ...input, width: 110, opacity: isAdmin ? 1 : 0.6 }}
                    />
                  </div>
                </td>

                <td style={td}>
                  <button
                    onClick={() => saveProfile(p)}
                    disabled={!isAdmin}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 12,
                      border: "none",
                      background: isAdmin ? "#111" : "#9ca3af",
                      color: "#fff",
                      fontWeight: 800,
                      cursor: isAdmin ? "pointer" : "not-allowed",
                      width: "100%",
                      maxWidth: 220,
                    }}
                  >
                    Speichern
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 12, opacity: 0.7 }}>
        Tipp: Nur <b>{ADMIN_EMAIL}</b> darf Namen/Farben ändern. Andere sehen nur die Liste.
      </p>
    </main>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "12px 14px" };
const td: React.CSSProperties = { padding: "12px 14px", verticalAlign: "middle" };
const input: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  width: "100%",
};
