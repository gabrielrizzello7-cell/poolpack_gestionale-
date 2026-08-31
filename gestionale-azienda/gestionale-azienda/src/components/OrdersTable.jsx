import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysAgo(dateString) {
  const orderDate = new Date(dateString);
  const today = new Date();
  // normalizza entrambe le date a mezzanotte per un conteggio giorni pulito
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

export default function OrdersTable() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all | overdue | reported
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    fetchOrders();

    // aggiornamenti realtime: se un nuovo ordine arriva o viene modificato,
    // la tabella si aggiorna senza bisogno di ricaricare la pagina
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
      .select("id, client_name, order_date, total, reported, items")
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

  const visibleOrders = useMemo(() => {
    if (filter === "overdue")
      return orders.filter((o) => isOverdue(o.order_date));
    if (filter === "reported") return orders.filter((o) => o.reported);
    return orders;
  }, [orders, filter]);

  const overdueCount = useMemo(
    () => orders.filter((o) => isOverdue(o.order_date)).length,
    [orders]
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Ordini clienti</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {overdueCount > 0
              ? `${overdueCount} ordini da riportare (11-14 giorni)`
              : "Nessun ordine in scadenza al momento"}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-ink-800 rounded-lg p-1 text-sm">
          {[
            { id: "all", label: "Tutti" },
            { id: "overdue", label: "Da riportare" },
            { id: "reported", label: "Riportati" },
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

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-ink-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 dark:bg-ink-800 text-left text-slate-600 dark:text-slate-400">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Data ordine</th>
              <th className="px-4 py-3 font-medium">Giorni fa</th>
              <th className="px-4 py-3 font-medium">Totale</th>
              <th className="px-4 py-3 font-medium text-center">Riportato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-ink-700">
            {loading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                >
                  Caricamento ordini...
                </td>
              </tr>
            )}

            {!loading && visibleOrders.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                >
                  Nessun ordine da mostrare.
                </td>
              </tr>
            )}

            {!loading &&
              visibleOrders.map((order) => {
                const overdue = isOverdue(order.order_date);
                return (
                  <tr
                    key={order.id}
                    className={
                      overdue
                        ? "bg-alert-50 dark:bg-alert-500/10 hover:bg-alert-100 dark:hover:bg-alert-500/20"
                        : "hover:bg-slate-50 dark:hover:bg-ink-800/60"
                    }
                  >
                    <td className="px-4 py-3 font-medium">
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
                      <input
                        type="checkbox"
                        checked={!!order.reported}
                        disabled={updatingId === order.id}
                        onChange={() => toggleReported(order)}
                        className="h-4 w-4 rounded border-slate-300 text-accent-500 focus:ring-accent-500 cursor-pointer disabled:opacity-50"
                      />
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
