import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import ThemeToggle from "./ThemeToggle.jsx";

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (authError) throw authError;

      const userId = authData.user.id;

      // Verifica del ruolo nella tabella profiles
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, full_name")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      if (!profile || profile.role !== "staff") {
        await supabase.auth.signOut();
        throw new Error(
          "Questo account non ha i permessi da staff. Accesso negato."
        );
      }

      onLoginSuccess(profile);
    } catch (err) {
      setError(err.message || "Credenziali non valide.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-ink-950 px-4">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-accent-500 text-white font-mono text-lg font-semibold">
            GA
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Gestionale Azienda
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Accesso riservato allo staff
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-xl p-6 space-y-4 shadow-sm"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-ink-700 bg-slate-50 dark:bg-ink-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="nome@azienda.it"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-ink-700 bg-slate-50 dark:bg-ink-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-alert-50 dark:bg-alert-500/10 border border-alert-200 dark:border-alert-500/30 px-3 py-2 text-sm text-alert-600 dark:text-alert-500">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white text-sm font-medium py-2.5 transition-colors"
          >
            {loading ? "Accesso in corso..." : "Accedi"}
          </button>
        </form>
      </div>
    </div>
  );
}
