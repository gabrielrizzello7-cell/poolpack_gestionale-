import React from "react";
import ThemeToggle from "./ThemeToggle.jsx";
import { supabase } from "../lib/supabaseClient.js";

const TABS = [
  { id: "orders", label: "Ordini" },
  { id: "products", label: "Prodotti" },
  { id: "clients", label: "Clienti" },
];

export default function Layout({ profile, activeTab, setActiveTab, children }) {
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-slate-100 transition-colors">
      <header className="border-b border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-500 text-white font-mono text-sm font-semibold">
              GA
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Gestionale Azienda</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {profile?.full_name || "Staff"}
              </p>
            </div>
          </div>

          <nav className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-ink-800 rounded-lg p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === tab.id
                    ? "bg-white dark:bg-ink-700 text-accent-600 dark:text-accent-500 shadow-sm font-medium"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-alert-600 transition-colors"
            >
              Esci
            </button>
          </div>
        </div>

        <nav className="sm:hidden flex border-t border-slate-200 dark:border-ink-700">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 text-sm ${
                activeTab === tab.id
                  ? "text-accent-600 dark:text-accent-500 font-medium border-b-2 border-accent-500"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
