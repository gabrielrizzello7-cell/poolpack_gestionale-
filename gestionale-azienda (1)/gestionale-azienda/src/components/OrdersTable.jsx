import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysAgo(dateString) {
  const orderDate = new Date(dateString);
  const today = new Date();
  const a = Date.UTC(
    orderDate.getFullYear(),
    orderDate.getMonth(),
    orderDate.getDate()
  );
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((b - a) / MS_PER_DAY);
}

function isOverdue(dateString) {
  const diff = daysAgo(dateString);
  return diff >= 11 && diff <= 14;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

const emptyEditForm = { id: null, client_name: "", order_date: "", total: "" };

export default function OrdersTable() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all | toReport | reported | cancelled
  const [updatingId, setUpdatingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("orders-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchOrders() {
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("orders")
      .select("id, client_name, order_date, total, reported, cancelled, items")
      .order("order_date", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  }

  async function toggleReported(order) {
    setUpdatingId(order.id);
    const { error: updateError } = await supabase
      .from("orders")
      .update({ reported: !order.reported })
      .eq("id", order.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, reported: !o.reported } : o
        )
      );
    }
    setUpdatingId(null);
  }

  function startEdit(order) {
    setEditForm({
      id: order.id,
      client_name: order.client_name,
      order_date: order.order_date,
      total: order.total,
    });
  }

  function cancelEdit() {
    setEditForm(emptyEditForm);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const total = parseFloat(editForm.total);
      if (!editForm.client_name.trim() || !editForm.order_date || Number.isNaN(total)) {
        throw new Error("Cliente, data e totale sono obbligatori.");
      }

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          client_name: editForm.client_name.trim(),
          order_date: editForm.order_date,
          total,
        })
        .eq("id", editForm.id);

      if (updateError) throw updateError;

      cancelEdit();
      fetchOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(order) {
    if (!confirm(`Eliminare definitivamente l'ordine di "${order.client_name}"?`)) return;
    const { error: deleteError } = await supabase
      .from("orders")
      .delete()
      .eq("id", order.id);
    if (deleteError) setError(deleteError.message);
    else fetchOrders();
  }

  const visibleOrders = useMemo(() => {
    let result = orders;
    if (filter === "toReport")
      result = orders.filter((o) => !o.cancelled && !o.reported);
    else if (filter === "reported")
      result = orders.filter((o) => o.reported);
    else if (filter === "cancelled")
      result = orders.filter((o) => o.cancelled);

    // Più recenti in alto, più vecchi in basso
    return [...result].sort(
      (a, b) => new Date(b.order_date) - new Date(a.order_date)
    );
  }, [orders, filter]);

  const toReportCount = useMemo(
    () => orders.filter((o) => !o.cancelled && !o.reported).length,
    [orders]
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Ordini clienti</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {toReportCount > 0
              ? `${toReportCount} ordini ancora da riportare`
              : "Tutti gli ordini sono stati riportati"}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-ink-800 rounded-lg p-1 text-sm">
          {[
            { id: "all", label: "Tutti" },
            { id: "toReport", label: "Da riportare" },
            { id: "reported", label: "Riportati" },
            { id: "cancelled", label: "Annullati" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filter === f.id
                  ? "bg-white dark:bg-ink-700 shadow-sm font-medium text-accent-600 dark:text-accent-500"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-alert-50 dark:bg-alert-500/10 border border-alert-200 dark:border-alert-500/30 px-3 py-2 text-sm text-alert-600">
          {error}
        </div>
      )}

      {/* Modale di modifica ordine */}
      {editForm.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-sm bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-xl p-5 space-y-4"
          >
            <h3 className="font-semibold">Modifica ordine</h3>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                Cliente
              </label>
              <input
                type="text"
                required
                value={editForm.client_name}
                onChange={(e) =>
                  setEditForm({ ...editForm, client_name: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-ink-700 bg-slate-50 dark:bg-ink-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Data ordine
                </label>
                <input
                  type="date"
                  required
                  value={editForm.order_date}
                  onChange={(e) =>
                    setEditForm({ ...editForm, order_date: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-ink-700 bg-slate-50 dark:bg-ink-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Totale (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editForm.total}
                  onChange={(e) =>
                    setEditForm({ ...editForm, total: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-ink-700 bg-slate-50 dark:bg-ink-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white text-sm font-medium py-2.5 transition-colors"
              >
                {saving ? "Salvataggio..." : "Salva modifiche"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-slate-300 dark:border-ink-700 px-4 py-2.5 text-sm"
              >
                Chiudi
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-ink-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 dark:bg-ink-800 text-left text-slate-600 dark:text-slate-400">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Data ordine</th>
              <th className="px-4 py-3 font-medium">Giorni fa</th>
              <th className="px-4 py-3 font-medium">Totale</th>
              <th className="px-4 py-3 font-medium text-center">Stato</th>
              <th className="px-4 py-3 font-medium text-center">Riportato</th>
              <th className="px-4 py-3 font-medium text-right">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-ink-700">
            {loading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                >
                  Caricamento ordini...
                </td>
              </tr>
            )}

            {!loading && visibleOrders.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                >
                  Nessun ordine da mostrare.
                </td>
              </tr>
            )}

            {!loading &&
              visibleOrders.map((order) => {
                const overdue = !order.cancelled && isOverdue(order.order_date);
                return (
                  <tr
                    key={order.id}
                    className={
                      order.cancelled
                        ? "bg-alert-50/60 dark:bg-alert-500/10 opacity-80"
                        : overdue
                        ? "bg-alert-50 dark:bg-alert-500/10 hover:bg-alert-100 dark:hover:bg-alert-500/20"
                        : "hover:bg-slate-50 dark:hover:bg-ink-800/60"
                    }
                  >
                    <td className={`px-4 py-3 font-medium ${order.cancelled ? "line-through text-slate-500 dark:text-slate-500" : ""}`}>
                      {order.client_name}
                    </td>
                    <td className="px-4 py-3">{formatDate(order.order_date)}</td>
                    <td
                      className={`px-4 py-3 ${
                        overdue
                          ? "text-alert-600 dark:text-alert-500 font-semibold"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {daysAgo(order.order_date)} giorni
                    </td>
                    <td className="px-4 py-3">{formatCurrency(order.total)}</td>
                    <td className="px-4 py-3 text-center">
                      {order.cancelled ? (
                        <span className="inline-flex items-center rounded-full bg-alert-500 text-white px-2.5 py-0.5 text-xs font-semibold tracking-wide">
                          ANNULLATO
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={!!order.reported}
                        disabled={updatingId === order.id}
                        onChange={() => toggleReported(order)}
                        className="h-4 w-4 rounded border-slate-300 text-accent-500 focus:ring-accent-500 cursor-pointer disabled:opacity-50"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(order)}
                          className="text-xs font-medium text-accent-600 dark:text-accent-500 hover:underline"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => handleDelete(order)}
                          className="text-xs font-medium text-alert-600 hover:underline"
                        >
                          Elimina
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
