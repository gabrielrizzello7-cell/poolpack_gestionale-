# Gestionale Azienda — Sito Staff

App React (Vite + Tailwind CSS + `@supabase/supabase-js`) per la gestione interna
di ordini, prodotti e clienti B2B.

## Avvio rapido

```bash
npm install
npm run dev
```

L'app parte su `http://localhost:5173`.

## Configurazione Supabase

1. **Database**: apri l'SQL Editor del tuo progetto Supabase e incolla il
   contenuto di `supabase/schema.sql`. Crea le tabelle `profiles`, `clients`,
   `products`, `orders`, il bucket storage `product-images` e tutte le policy
   RLS necessarie.

2. **Primo utente staff**: crea un utente da *Authentication → Users*, poi
   inserisci manualmente la riga corrispondente in `profiles` con
   `role = 'staff'` (istruzioni in fondo a `schema.sql`).

3. **Edge Function per la creazione clienti B2B**: la creazione di nuovi
   utenti richiede la `service_role key`, che **non deve mai finire nel
   frontend**. Per questo la funzione `create-client-user` gira lato server:

   ```bash
   supabase functions deploy create-client-user
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<la-tua-service-role-key>
   ```

   Il frontend la richiama con `supabase.functions.invoke(...)` passando il
   token dell'utente staff loggato; la funzione verifica che sia davvero
   staff prima di creare l'account.

## Variabili d'ambiente (consigliato)

Le credenziali fornite sono già impostate come fallback in
`src/lib/supabaseClient.js`, ma è buona norma spostarle in un file `.env`
(mai committato) prima di andare in produzione:

```
VITE_SUPABASE_URL=https://ysubbmtqiclnkncjxpzp.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_dGWhJ5qOZqE-G0y6Qp3DAw_iiNef3sd
```

> Nota: l'anon/publishable key è pensata per essere pubblica — la sicurezza
> vera è demandata alle policy RLS in `schema.sql`. Verificale sempre prima
> del rilascio in produzione.

## Se stai aggiornando un progetto già esistente

Se il database Supabase esiste già da prima di questa versione, esegui in
più le righe commentate in `supabase/schema.sql` (le trovi subito sotto le
definizioni di `products` e `orders`):

```sql
alter table public.products add column if not exists code text;
alter table public.products add column if not exists notes text;
alter table public.orders add column if not exists cancelled boolean not null default false;
```

E aggiungi la nuova policy che permette al sito clienti di annullare i
propri ordini (vedi commento "Il cliente annulla il proprio ordine" nello
schema).

## Struttura funzionalità

| Requisito | File principale |
|---|---|
| Login con verifica ruolo `staff`, scritta "BENVENUTO" | `src/components/Login.jsx` |
| Logo Poolpack Puglia in header + favicon | `public/logo.png`, `index.html`, `src/components/Layout.jsx` |
| Dark/Light mode | `src/context/ThemeContext.jsx`, `src/components/ThemeToggle.jsx` |
| Ordini: evidenziazione 11-14 giorni, spunta "Riportato", modifica, eliminazione, badge ANNULLATO | `src/components/OrdersTable.jsx` |
| Prodotti: ricerca per codice/nome, note, unità "Balla", undo/redo, drag&drop su `product-images` | `src/components/ProductManager.jsx` |

> La sezione "Clienti" è stata rimossa dall'interfaccia staff. La tabella
> `clients` e la Edge Function `create-client-user` restano nel database
> perché gli ordini referenziano ancora `client_id` e lo sconto B2B — se non
> ti serve più nulla lato clienti, valuta se rimuoverle anche lì.

## Realtime

`OrdersTable` si iscrive ai cambiamenti realtime della tabella `orders`
(assicurati che la Realtime replication sia attiva su quella tabella nella
dashboard Supabase, sezione *Database → Replication*).
