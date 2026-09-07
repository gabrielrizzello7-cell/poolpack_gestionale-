// Supabase Edge Function: create-client-user
//
// Crea un nuovo utente B2B (auth.users) e la relativa riga in "clients",
// usando la SERVICE_ROLE_KEY lato server. Questa chiave non deve MAI
// essere esposta nel frontend: per questo la creazione utenti passa da qui.
//
// Deploy:
//   supabase functions deploy create-client-user
//
// La funzione verifica che il chiamante sia autenticato e abbia
// role = 'staff' nella tabella profiles, prima di creare l'utente.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");

    // Client "anon" per verificare CHI sta chiamando la funzione
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: callerUser },
      error: callerError,
    } = await callerClient.auth.getUser(jwt);

    if (callerError || !callerUser) {
      return json({ error: "Non autenticato." }, 401);
    }

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .single();

    if (callerProfile?.role !== "staff") {
      return json({ error: "Permessi insufficienti." }, 403);
    }

    const { email, password, name, discount_percentage } = await req.json();

    if (!email || !password || !name) {
      return json({ error: "Email, password e nome sono obbligatori." }, 400);
    }

    // Client con service_role: unico punto in cui questa chiave viene usata
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError) return json({ error: createError.message }, 400);

    // Profilo con ruolo "client" (distinto dallo staff)
    await adminClient.from("profiles").insert({
      id: newUser.user.id,
      role: "client",
      full_name: name,
      email,
    });

    const { error: clientInsertError } = await adminClient
      .from("clients")
      .insert({
        user_id: newUser.user.id,
        name,
        email,
        discount_percentage: discount_percentage ?? 0,
      });

    if (clientInsertError) return json({ error: clientInsertError.message }, 400);

    return json({ success: true, user_id: newUser.user.id });
  } catch (err) {
    return json({ error: err.message || "Errore interno." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
