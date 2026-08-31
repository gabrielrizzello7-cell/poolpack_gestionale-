import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

const emptyForm = {
  id: null,
  name: "",
  email: "",
  password: "",
  discount_percentage: "0",
};

export default function ClientManager() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("clients")
      .select("id, name, email, discount_percentage, created_at")
      .order("created_at", { ascending: false });

    if (fetchError) setError(fetchError.message);
    else setClients(data || []);
    setLoading(false);
  }

  function startEdit(client) {
    setForm({
      id: client.id,
      name: client.name,
      email: client.email,
      password: "",
      discount_percentage: String(client.discount_percentage ?? 0),
    });
  }

  function resetForm() {
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const discount = parseFloat(form.discount_percentage);
      if (Number.isNaN(discount) || discount < 0 || discount > 100) {
        throw new Error("Lo sconto deve essere un numero tra 0 e 100.");
      }

      if (form.id) {
        // Modifica cliente esistente: solo nome e sconto (l'account utente resta invariato)
        const { error: updateError } = await supabase
          .from("clients")
          .update({ name: form.name.trim(), discount_percentage: discount })
          .eq("id", form.id);
        if (updateError) throw updateError;
        setSuccess("Cliente aggiornato.");
      } else {
        // Nuovo cliente B2B: crea l'account tramite Edge Function
        // (la creazione utenti richiede la service_role key, che non
        // deve mai girare nel browser: la funzione la usa lato server).
        if (!form.email || !form.password) {
          throw new Error("Email e password sono obbligatorie per un nuovo cliente.");
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          "create-client-user",
          {
            body: {
              email: form.email.trim(),
              password: form.password,
              name: form.name.trim(),
              discount_percentage: discount,
            },
            headers: {
              Authorization: `Bearer ${sessionData?.session?.access_token || ""}`,
            },
          }
        );

        if (fnError) throw fnError;
        if (fnData?.error) throw new Error(fnData.error);

        setSuccess("Nuovo cliente B2B creato correttamente.");
      }

      resetForm();
      fetchClients();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2">
        <div className="bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-xl p-5">
          <h3 className="font-semibold mb-4">
            {form.id ? "Modifica cliente" : "Nuovo cliente B2B"}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                Ragione sociale / Nome
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-ink-700 bg-slate-50 dark:bg-ink-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>

            {!form.id && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                    Email di accesso
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-ink-700 bg-slate-50 dark:bg-ink-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                    Password provvisoria
                  </label>
                  <input
                    type="text"
                    required
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    placeholder="Il cliente potrà cambiarla al primo accesso"
                    className="w-full rounded-lg border border-slate-300 dark:border-ink-700 bg-slate-50 dark:bg-ink-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                Sconto personalizzato (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                required
                value={form.discount_percentage}
                onChange={(e) =>
                  setForm({ ...form, discount_percentage: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-ink-700 bg-slate-50 dark:bg-ink-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-alert-50 dark:bg-alert-500/10 border border-alert-200 dark:border-alert-500/30 px-3 py-2 text-sm text-alert-600">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-3 py-2 text-sm text-emerald-600">
                {success}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white text-sm font-medium py-2.5 transition-colors"
              >
                {saving
                  ? "Salvataggio..."
                  : form.id
                  ? "Salva modifiche"
                  : "Crea cliente"}
              </button>
              {form.id && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-300 dark:border-ink-700 px-4 py-2.5 text-sm"
                >
                  Annulla
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="lg:col-span-3">
        <div className="bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-xl overflow-hidden">
          {loading && (
            <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Caricamento clienti...
            </p>
          )}
          {!loading && clients.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Nessun cliente registrato.
            </p>
          )}

          <table className="w-full text-sm">
            {clients.length > 0 && (
              <thead>
                <tr className="bg-slate-100 dark:bg-ink-800 text-left text-slate-600 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Sconto</th>
                  <th className="px-4 py-3 font-medium text-right">Azioni</th>
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-slate-200 dark:divide-ink-700">
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className="px-4 py-3 font-medium">{client.name}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {client.email}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-accent-500/10 text-accent-600 dark:text-accent-500 px-2.5 py-0.5 text-xs font-medium">
                      {client.discount_percentage}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => startEdit(client)}
                      className="text-xs font-medium text-accent-600 dark:text-accent-500 hover:underline"
                    >
                      Modifica
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
