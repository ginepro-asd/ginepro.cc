# GINEPRO

Web app per gestire eventi, tesseramento e iscrizioni GINEPRO.

## Cosa fa

- Landing pubblica con eventi attivi, archivio eventi passati e tesseramento.
- Pagina evento con iscrizione singola, iscrizione di coppia, quote variabili, limiti posti e scadenze.
- Pagamenti tramite Stripe, Satispay, PayPal e bypass admin per contanti.
- Area riservata per recupero account, tessere e certificati.
- Backoffice admin per eventi, partecipanti, societa, pagamenti Satispay, certificati, newsletter, import e email transazionali.
- Edge Functions Supabase per checkout, pagamenti, import Firestore, export CSV, email, tessere e gestione admin.

## Stack

- Vite, React, TypeScript
- Tailwind CSS e componenti shadcn/ui locali
- Supabase database, auth, storage ed Edge Functions
- pnpm come package manager

## Sviluppo locale

```sh
pnpm install
pnpm supabase:start
pnpm dev
```

Il dev server parte sulla porta `8080`.

Configura le variabili Vite partendo da `.env.example`.

Se usi Colima invece di Docker Desktop, `pnpm supabase:start` esclude `vector`, il collector dei log, per evitare il problema di bind mount del Docker socket. I servizi necessari all'app restano attivi.

URL locali principali:

- App: `http://localhost:8080`
- Supabase API: `http://127.0.0.1:54321`
- Supabase Studio: `http://127.0.0.1:54323`
- Mailpit: `http://127.0.0.1:54324`

Il database locale viene popolato da `supabase/seed.sql` con eventi demo.

Accesso admin locale:

- URL: `http://localhost:8080/admin/login`
- Email: `domenico.diiorio@ginepro.cc`
- Password: `admin-local-123`

In locale la pagina admin usa email/password Supabase. In staging e produzione il login admin Google avviene tramite Lovable Cloud Auth.

## Script utili

```sh
pnpm build
pnpm test
pnpm lint
pnpm analyze:unused
pnpm supabase:reset
pnpm supabase:stop
```

Nota: al momento `pnpm lint` evidenzia ancora debito tecnico storico, soprattutto `any` espliciti e dipendenze mancanti negli hook. Build e test sono i controlli principali per questa base.

## Ambienti

| Ambiente | Branch Git | Supabase | Frontend |
|---|---|---|---|
| Locale | qualsiasi (working copy) | Stack Docker locale (`supabase start`) | `localhost:8080` |
| Staging | `staging` | `qqngsecqtqibbywmdqte` (ginepro-staging) | Vercel — branch staging |
| Prod | `main` | `yastxhhxfzaqfizahdib` (ginepro.cc) | Vercel — produzione |

Il branch `develop` usa Supabase locale; solo `staging` e `main` triggherano il deploy cloud.

### Flusso di promozione

```
feature/* → PR in develop → PR in staging → PR in main
```

Ogni PR verso `develop`, `staging` o `main` esegue CI (lint + test + build).
Il merge su `staging` o `main` deploya automaticamente migration e Edge Functions sull'ambiente corrispondente.

### GitHub Actions secrets richiesti

| Secret | Valore |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Token CLI da supabase.com/dashboard/account/tokens |
| `SUPABASE_PROD_REF` | `yastxhhxfzaqfizahdib` |
| `SUPABASE_STAGING_REF` | `qqngsecqtqibbywmdqte` |

### Credenziali Edge Functions per ambiente

I secrets delle Edge Functions (Stripe, PayPal, Satispay, Resend, ecc.) si configurano separatamente per ogni progetto Supabase:

- Prod: usare chiavi live (Stripe live mode, PayPal prod, ecc.)
- Staging: usare chiavi sandbox/test (Stripe test mode `sk_test_*`, PayPal sandbox, ecc.)

Per impostarli: `supabase secrets set NOME=valore --project-ref <ref>` oppure dal pannello *Project Settings → Edge Functions → Secrets* su supabase.com.

### Hosting (Vercel)

Il frontend è deployato su Vercel, collegato al repo `ginepro-asd/ginepro.cc`. Le variabili d'ambiente Vite (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) si configurano in *Project Settings → Environment Variables* per ogni ambiente (Production / Preview branch `staging`).

**Nota:** ogni nuovo dominio aggiunto su Vercel (staging, prod) va registrato come redirect URI consentito nell'auth di Lovable affinché il login Google admin funzioni.

## Struttura

- `src/pages`: rotte pubbliche, area riservata e backoffice admin.
- `src/components`: form iscrizione, componenti admin e UI condivisa.
- `src/hooks`: query Supabase e logiche riusabili.
- `src/lib`: pricing, scadenze e utility.
- `supabase/functions`: Edge Functions deployate su Supabase.
- `supabase/migrations`: schema e migrazioni database.
