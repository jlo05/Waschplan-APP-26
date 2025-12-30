"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Profile = {
  id: string;
  name: string | null;
  color: string | null;
};

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    checkAdmin();
    loadProfiles();
  }, []);

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setEmail(user?.email ?? null);
  }

  async function loadProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,color")
      .order("name");

    if (error) {
      setMsg("Fehler beim Laden");
    } else {
      setProfiles(data ?? []);
    }
  }

  async function saveProfile(p: Profile) {
    setMsg("");
    const { error } = await supabase
      .from("profiles")
      .update({
        name: p.name,
        color: p.color,
      })
      .eq("id", p.id);

    if (error) {
      setMsg("Fehler beim Speichern");
    } else {
      setMsg("Gespeichert ✅");
      setTimeout(() => setMsg(""), 2000);
    }
  }

  return (
    <main style={{ maxWidth: 1000, margin: "30px auto", padding: 16 }}>
      <h1>Admin: Namen & Farben</h1>

      <div
        style={{
          margin: "12px 0",
          padding: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        Eingeloggt als <b>{email}</b>
        <div style={{ marginTop: 10 }}>
          <a href="/plan">← zurück zu /plan</a>
        </div>
      </div>

      {msg && <div style={{ marginBottom: 12 }}>{msg}</div>}

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
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
                    onChange={(e) =>
                      setProfiles((all) =>
                        all.map((x) =>
                          x.id === p.id ? { ...x, name: e.target.value } : x
                        )
                      )
                    }
                    style={input}
                  />
                </td>

                <td style={{ ...td, minWidth: 160 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {/* 🎨 COLOR PICKER */}
                    <input
                      type="color"
                      value={p.color ?? "#cccccc"}
                      onChange={(e) =>
                        setProfiles((all) =>
                          all.map((x) =>
                            x.id === p.id
                              ? { ...x, color: e.target.value }
                              : x
                          )
                        )
                      }
                      style={{
                        width: 36,
                        height: 36,
                        border: "none",
                        padding: 0,
                        background: "none",
                        cursor: "pointer",
                      }}
                    />

                    {/* Hex optional sichtbar */}
                    <input
                      value={p.color ?? ""}
                      onChange={(e) =>
                        setProfiles((all) =>
                          all.map((x) =>
                            x.id === p.id
                              ? { ...x, color: e.target.value }
                              : x
                          )
                        )
                      }
                      style={{ ...input, width: 100 }}
                    />
                  </div>
                </td>

                <td style={td}>
                  <button
                    onClick={() => saveProfile(p)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 12,
                      border: "none",
                      background: "#111",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
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
        Tipp: Nur Admin darf Namen/Farben ändern. User selbst kann seinen Namen
        nicht ändern.
      </p>
    </main>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
};

const td: React.CSSProperties = {
  padding: "12px 14px",
  verticalAlign: "middle",
};

const input: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
};
