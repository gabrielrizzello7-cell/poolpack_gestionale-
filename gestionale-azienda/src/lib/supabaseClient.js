import { createClient } from "@supabase/supabase-js";

// Consigliato: sposta questi valori in variabili d'ambiente Vite
// (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) prima di andare in produzione,
// per non tenerli hardcoded nel bundle pubblico.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://ysubbmtqiclnkncjxpzp.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_dGWhJ5qOZqE-G0y6Qp3DAw_iiNef3sd";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const PRODUCT_IMAGES_BUCKET = "product-images";
