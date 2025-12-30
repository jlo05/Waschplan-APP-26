"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type ProfileRow = {
  id: string;
  name: string | null;
  color: string | null;
};

export default function AdminPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileRow>>({});
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const [err, setErr] = useState<string>("");

  // Session laden
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUserId(u?.id ?? null);
      setUserEmail(u?.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUserId(u?.id ?? null);
      setUserEmail(u?.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Display name aus profiles (falls vorhanden)
  const displayName = useMemo(() => {
    if (!userId) return null;
    const n = profilesMap[userId]?.name?.trim();
    return n && n.length > 0 ? n : userEmail;
  }, [profilesMap, userId, userEmail]);

  async function checkAdminAndLoad() {
    setErr("");

    const { data: sess } = await supabase.auth.getSession();
    const email = sess.session?.user?.email ?? null;
    const uid = sess.session?.user?.id ?? null;

    setUserEmail(email);
    setUserId(uid);

    if (!email) {
      setIsAdmin(false);
      return;
    }

    // Admin check
    const { data: adminRow, error: adminErr } = await supabase
      .from("admin_emails")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (adminErr) {
      setErr(`Fehler Admin-Check: ${adminErr.message}`);
      setIsAdmin(false);
      return;
    }

    const ok = !!adminRow?.email;
    setIsAdmin(ok);

    // Profiles laden (für Anzeige Name/Farbe, und Admin-Bearbeitung)
    const { data: p, error: pErr } = await supabase.from("profiles").select("id,name,color").order("name", { ascending: true });

    if (pErr) {
      setErr(`Fehler beim Laden profiles: ${pErr.message}`);
      return;
    }

    const list = (p ?? []) as ProfileRow[];
    setProfiles(list);

    const map: Record<string, ProfileRow> = {};
    list.forEach((x) => (map[x.id] = x));
    setProfilesMap(map);
  }

  useEffect(() => {
    checkAdminAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  async function saveProfile(id: string, name: string, color: string) {
    setErr("");
    const { error } = await supabase.from("profiles").update({ name, color }).eq("id", id);
    if (error) {
      setErr(`Fehler beim Speichern: ${error.message}`);
      return;
    }
    await checkAdminAndLoad();
  }

  return (
    <div style={{ background: "#fff", color: "#111", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <h1 style={{ margin: 0 }}>Admin: Namen & Farben</h1>

        <div style={{ marginTop: 10, padding: 12, border: "1px solid #e5e7eb", borderRadius: 14 }}>
          <div style={{ opacity: 0.8 }}>
            Eingeloggt als <b>{displayName ?? userEmail ?? "nicht eingeloggt"}</b>
          </div>
          {!isAdmin && (
            <div style={{ marginTop: 8, color: "#b91c1c", fontWeight: 900 }}>
              Kein Zugriff – Nicht Admin: {userEmail ?? "?"}
            </div>
          )}
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={checkAdminAndLoad}
              style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff" }}
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
              }}
            >
              ← zurück zu /plan
            </a>
          </div>

          {err && <div style={{ marginTop: 10, color: "#b91c1c" }}>{err}</div>}
        </div>

        {/* Admin Tabelle nur wenn Admin */}
        {isAdmin && (
          <div style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 0.8fr 0.8fr", background: "#f3f4f6", padding: 12, fontWeight: 900 }}>
              <div>ID</div>
              <div>Name</div>
              <div>Farbe</div>
              <div>Aktion</div>
            </div>

            {profiles.map((p) => (
              <AdminRow key={p.id} p={p} onSave={saveProfile} />
            ))}
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          Tipp: Nur Admin darf Namen/Farben ändern. User selbst kann seinen Namen nicht ändern (nur Admin).
        </div>
      </div>
    </div>
  );
}

function AdminRow({ p, onSave }: { p: ProfileRow; onSave: (id: string, name: string, color: string) => Promise<void> }) {
  const [name, setName] = useState(p.name ?? "");
  const [color, setColor] = useState(p.color ?? "#3B82F6");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(p.name ?? "");
    setColor(p.color ?? "#3B82F6");
  }, [p.id, p.name, p.color]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 0.8fr 0.8fr", padding: 12, borderTop: "1px solid #e5e7eb", alignItems: "center", gap: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.8, wordBreak: "break-all" }}>{p.id}</div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb" }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 18, height: 18, borderRadius: 6, background: color, border: "1px solid #e5e7eb" }} />
        <input
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", width: "100%" }}
        />
      </div>

      <button
        onClick={async () => {
          setSaving(true);
          await onSave(p.id, name, color);
          setSaving(false);
        }}
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: "#111",
          color: "#fff",
          fontWeight: 900,
          opacity: saving ? 0.7 : 1,
        }}
        disabled={saving}
      >
        {saving ? "..." : "Speichern"}
      </button>
    </div>
  );
}