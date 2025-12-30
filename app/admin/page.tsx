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

  // Session
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
      .order("name");

    if (error) {
      setMsg(`Fehler beim Laden: ${error.message}`);
    } else {
      setProfiles(data as ProfileRow[]);
    }
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

    if (error) {
      setMsg(`Fehler beim Speichern: ${error.message}`);
    } else {
      setMsg("Gespeichert ✅");
      loadProfiles();
    }
  }

  // ⛔ Kein Zugriff
  if (userEmail && !isAdmin) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Kein Zugriff</h2>
        <p>
          Du bist eingeloggt als <b>{userEmail}</b>
        </p>
        <p>
          Admin ist: <b>{ADMIN_EMAIL}</b>
        </p>
        <a href="/plan">← zurück zum Waschplan</a>
      </div>
    );
  }

  if (!userEmail) {
    return <div style={{ padding: 24 }}>Bitte einloggen…</div>;
  }

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

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button onClick={loadProfiles}>Neu laden</button>
          <a href="/plan">← zurück zu /plan</a>
        </div>

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
              <tr key={p.id}>
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
                <td style={td}>
                  <input
                    type="color"
                    value={p.color ?? "#cccccc"}
                    onChange={(e) =>
                      setProfiles((all) =>
                        all.map((x) =>
                          x.id === p.id ? { ...x, color: e.target.value } : x
                        )
                      )
                    }
                    style={{
                      width: 42,
                      height: 36,
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                    }}
                  />
                  <input
                    value={p.color ?? ""}
                    onChange={(e) =>
                      setProfiles((all) =>
                        all.map((x) =>
                          x.id === p.id ? { ...x, color: e.target.value } : x
                        )
                      )
                    }
                    style={{ ...input, marginLeft: 8, width: 110 }}
                  />
                </td>
                <td style={td}>
                  <button onClick={() => saveProfile(p)}>Speichern</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          Tipp: Nur Admin darf Namen & Farben ändern. Farben werden im Waschplan
          für die Slot-Blöcke verwendet.
        </p>

        {msg && <div style={{ marginTop: 10 }}>{msg}</div>}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 10,
  borderBottom: "1px solid #e5e7eb",
};

const td: React.CSSProperties = {
  padding: 10,
  borderBottom: "1px solid #e5e7eb",
  verticalAlign: "middle",
};

const input: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
};
