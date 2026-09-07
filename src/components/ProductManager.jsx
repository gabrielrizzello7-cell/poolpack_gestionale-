import React, { useEffect, useMemo, useState } from "react";
import { supabase, PRODUCT_IMAGES_BUCKET } from "../lib/supabaseClient.js";

const UNITS = [
  { value: "ct", label: "ct — Cartone" },
  { value: "cf", label: "cf — Confezione" },
  { value: "rt", label: "rt — Rotolo" },
  { value: "pz", label: "pz — Pezzo" },
  { value: "bl", label: "Balla" },
];

const emptyForm = {
  id: null,
  code: "",
  name: "",
  price: "",
  unit: "pz",
  notes: "",
  image_url: "",
};

export default function ProductManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Cronologia delle modifiche al form, per i tasti Indietro/Avanti
  // (annulla/ripristina) prima di salvare il prodotto.
  const [history, setHistory] = useState([emptyForm]);
  const [historyIndex, setHistoryIndex] = useState(0);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("products")
      .select("id, code, name, price, unit, notes, image_url, created_at")
      .order("created_at", { ascending: false });

    if (fetchError) setError(fetchError.message);
    else setProducts(data || []);
    setLoading(false);
  }

  // Applica un cambiamento al form registrandolo nella cronologia
  function updateForm(partial) {
    const next = { ...form, ...partial };
    setForm(next);
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIndex + 1);
      return [...truncated, next];
    });
    setHistoryIndex((prev) => prev + 1);
  }

  function undo() {
    if (historyIndex === 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setForm(history[newIndex]);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setForm(history[newIndex]);
  }

  function resetForm() {
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview("");
    setHistory([emptyForm]);
    setHistoryIndex(0);
  }

  function startEdit(product) {
    const nextForm = {
      id: product.id,
      code: product.code || "",
      name: product.name,
      price: product.price,
      unit: product.unit,
      notes: product.notes || "",
      image_url: product.image_url || "",
    };
    setForm(nextForm);
    setImagePreview(product.image_url || "");
    setImageFile(null);
    setHistory([nextForm]);
    setHistoryIndex(0);
  }

  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      setError("Seleziona un file immagine valido.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }

  async function uploadImageIfNeeded() {
    if (!imageFile) return form.image_url || null;

    const ext = imageFile.name.split(".").pop();
    const path = `products/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(path, imageFile, { upsert: false });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const imageUrl = await uploadImageIfNeeded();

      const payload = {
        code: form.code.trim() || null,
        name: form.name.trim(),
        price: parseFloat(form.price),
        unit: form.unit,
        notes: form.notes.trim() || null,
        image_url: imageUrl,
      };

      if (!payload.name || Number.isNaN(payload.price)) {
        throw new Error("Nome e prezzo sono obbligatori.");
      }

      if (form.id) {
        const { error: updateError } = await supabase
          .from("products")
          .update(payload)
          .eq("id", form.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("products")
          .insert(payload);
        if (insertError) throw insertError;
      }

      resetForm();
      fetchProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product) {
    if (!confirm(`Eliminare "${product.name}"?`)) return;
    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);
    if (deleteError) setError(deleteError.message);
    else fetchProducts();
  }

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(term) ||
        p.code?.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  function unitLabel(unitValue) {
    return UNITS.find((u) => u.value === unitValue)?.label || unitValue;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Form aggiungi/modifica */}
      <div className="lg:col-span-2">
        <div className="bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">
              {form.id ? "Modifica prodotto" : "Nuovo prodotto"}
            </h3>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={undo}
                disabled={historyIndex === 0}
                title="Annulla ultima modifica"
                aria-label="Indietro"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 dark:border-ink-700 text-slate-500 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-ink-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                title="Ripristina modifica"
                aria-label="Avanti"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 dark:border-ink-700 text-slate-500 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-ink-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Codice
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => updateForm({ code: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-ink-700 bg-slate-50 dark:bg-ink-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                  placeholder="es. PP-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Nome prodotto
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-ink-700 bg-slate-50 dark:bg-ink-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Prezzo (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.price}
                  onChange={(e) => updateForm({ price: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-ink-700 bg-slate-50 dark:bg-ink-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Unità di misura
                </label>
                <select
                  value={form.unit}
                  onChange={(e) => updateForm({ unit: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-ink-700 bg-slate-50 dark:bg-ink-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                Note / Descrizione
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => updateForm({ notes: e.target.value })}
                rows={3}
                placeholder="Facoltativo"
                className="w-full rounded-lg border border-slate-300 dark:border-ink-700 bg-slate-50 dark:bg-ink-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                Foto prodotto
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
                  isDragging
                    ? "border-accent-500 bg-accent-500/5"
                    : "border-slate-300 dark:border-ink-700"
                }`}
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Anteprima prodotto"
                    className="h-24 w-24 object-cover rounded-lg"
                  />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-8 w-8 text-slate-400"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Trascina un'immagine qui oppure
                </p>
                <label className="text-sm text-accent-600 dark:text-accent-500 font-medium cursor-pointer">
                  scegli un file
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-alert-50 dark:bg-alert-500/10 border border-alert-200 dark:border-alert-500/30 px-3 py-2 text-sm text-alert-600">
                {error}
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
                  : "Aggiungi prodotto"}
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

      {/* Elenco prodotti */}
      <div className="lg:col-span-3">
        <div className="mb-3">
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca per codice o nome..."
              className="w-full rounded-lg border border-slate-300 dark:border-ink-700 bg-white dark:bg-ink-900 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-xl overflow-hidden">
          {loading && (
            <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Caricamento prodotti...
            </p>
          )}

          {!loading && filteredProducts.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {products.length === 0
                ? "Nessun prodotto ancora registrato."
                : "Nessun prodotto corrisponde alla ricerca."}
            </p>
          )}

          <ul className="divide-y divide-slate-200 dark:divide-ink-700">
            {filteredProducts.map((product) => (
              <li
                key={product.id}
                className="flex items-center gap-4 px-5 py-3"
              >
                <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-100 dark:bg-ink-800 overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {product.code ? `${product.code} · ` : ""}
                    {product.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {new Intl.NumberFormat("it-IT", {
                      style: "currency",
                      currency: "EUR",
                    }).format(product.price)}{" "}
                    · {unitLabel(product.unit)}
                  </p>
                  {product.notes && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      {product.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(product)}
                    className="text-xs font-medium text-accent-600 dark:text-accent-500 hover:underline"
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => handleDelete(product)}
                    className="text-xs font-medium text-alert-600 hover:underline"
                  >
                    Elimina
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
