# Piano di refactoring strutturale

Obiettivi: ridurre debito tecnico, introdurre autenticazione reale per il backoffice, riorganizzare la navigazione admin per entità, unificare footer e theme selector.

---

## 1. Pulizia Edge Functions

### Da eliminare (mai invocate)

- `explore-firestore` — sostituita da `import-firestore`
- `generate-thumbnails` — nessun riferimento nel codice (le miniature ora si fanno client-side via canvas, vedi memory)

### Da verificare prima di eliminare

- `process-email-queue` — `verify_jwt = true`, probabilmente eseguita da cron pgmq. Confermare presenza di trigger/cron schedule prima di toccarla; se nessun cron è attivo, eliminare anche tutto il sistema pgmq inutilizzato.
- `send-newsletter` — verificare se invocata solo da `NewsletterManager`; mantenere.

### Refactor consolidamento

Ci sono molte funzioni che fanno operazioni admin con la stessa password check:

- `manage-event` (già super-funzione: list/update/create/delete events, partecipanti, registrazioni, satispay, email)
- `delete-entity`, `merge-participants`, `update-participant`, `import-firestore`, `export-registrations`, `setup-account`, `resolve-login`, `admin-chat`

Proposta: dopo l'introduzione dell'auth reale (vedi §2), spostare tutte le admin function dietro **JWT verify_jwt=true + check ruolo `admin**` invece del controllo password ripetuto in ogni funzione. Estrarre helper condiviso `_shared/admin-auth.ts`.

Funzioni di pagamento (`create-checkout`, `create-pair-checkout`, `create-paypal-order`, `capture-paypal-order`, `verify-payment`, `create-satispay-payment`, `check-satispay-payment`) restano `verify_jwt=false` perché chiamate da utenti anonimi — invariate.

`send-confirmation-email` resta come servizio interno (chiamata server-to-server).

---

## 2. Autenticazione reale del backoffice con Permessi

Sostituire il pattern `password` campo + invio in body ad ogni edge function con autenticazione Google, usare @ginepro.cc per identificare gli utenti admin.

### Database

Migrazione:

- enum `app_role` (`admin`, `user`)
- tabella `user_roles (id, user_id, role)` con RLS
- function `has_role(_user_id, _role)` SECURITY DEFINER
- seed iniziale: assegnare ruolo `admin` all'attuale account che conosce `ADMIN_PASSWORD` (manuale o via setup form one-shot protetto da `ADMIN_PASSWORD` come bootstrap)

### Frontend

- Nuova pagina `/admin/login` (email + password Supabase Auth, no Google per ora)
- Hook `useAdminAuth()` che carica session + verifica `has_role(uid, 'admin')`
- Tutte le rotte `/admin/*` protette: redirect a `/admin/login` se non admin
- Logout button nel layout admin

### Edge functions

- Helper `_shared/require-admin.ts`: legge JWT, verifica ruolo admin via `has_role`
- Tutte le admin functions: `verify_jwt = true` + check ruolo
- Rimuovere il param `password` dai body
- Creare utente admin [domenico.diiorio@ginepro.cc](mailto:domenico.diiorio@ginepro.cc)

---

## 3. Riorganizzazione routing admin

### Nuove rotte

```text
/admin                              → AdminHome (landing smistamento)
/admin/login                        → Login

/admin/events                       → Lista eventi
/admin/events/new                   → Creazione evento
/admin/events/:eventId              → Dettaglio + form modifica (ex modale EventManager)
/admin/events/:eventId/participants → Iscritti all'evento (ex tab iscrizioni filtrato)
/admin/events/:eventId/emails       → Email transazionali evento (ex TransactionalEmailManager)

/admin/users                        → Lista partecipanti globale (ex flat registrations)
/admin/users/:userId                → Dettaglio partecipante (ex modale, + form modifica)

/admin/satispay                     → Gestione account Satispay (URL + token muvat per evento)
/admin/certificates                 → Gestione certificati medici caricati
/admin/newsletters                  → NewsletterManager
/admin/imports                      → Firestore import + CSV import
/admin/chat                         → Admin chat (Gemini)
```

### Layout

Nuovo `AdminLayout.tsx` con:

- `SidebarProvider` shadcn collassabile (mini-icon mode)
- Voci sidebar: Eventi, Utenti, Satispay, Certificati, Newsletter, Import, Chat
- Header: breadcrumb + ThemeSelector + user menu (logout)
- `<Outlet />` per le sotto-rotte

### Componenti riutilizzati

- `EventManager` → split in `EventList` + `EventDetailForm` (no più dialog)
- Modali partecipante in `Admin.tsx` → pagina `UserDetail.tsx`
- `AdminAddRegistration`, `AdminCsvImport` → pagine dedicate
- `AdminChatSidebar` → pagina `/admin/chat` (può comunque essere drawer da ogni pagina)

### Migrazione legacy

- `/:slug/admin` → redirect a `/admin/events/:eventId/participants` (lookup slug→id)
- Vecchia `/admin` con password form → redirect a `/admin/login`

---

## 4. Nuove sezioni dedicate

### `/admin/satispay`

Tabella account Satispay/Muvat. Oggi i campi `satispay_api_url` e `satispay_api_token` stanno per evento in `events`. Nuova tabella `satispay_accounts (id, label, api_url, api_token)` + FK `events.satispay_account_id`, gestione CRUD con riassegnazione

Raccomando B per evitare duplicazione token tra eventi della stessa stagione.

### `/admin/certificates`

Lista `medical_certificates` con filtri (in scadenza, scaduti, warning AI), link al partecipante, preview file, riassegnazione, eliminazione.

---

## 5. Footer condiviso e theme selector

### Componente `<SiteFooter />`

- Link: Linee guida (`/guidelines`), Area riservata (`/area-riservata`), Contattaci (`mailto:info@ginepro.cc`)
- Anno dinamico: `new Date().getFullYear()`
- Logo ginepro + claim
- Stesso stile del footer attuale presente su EventPage

### Pagine end-user che lo devono mostrare

- `EventsList` (landing principale) — oggi NON ha footer
- `EventPage` — già lo ha (sostituire con componente)
- `Conferma`
- `Guidelines`
- `MemberCard`
- `AreaRiservataLogin`, `AreaRiservataSetup`, `AreaRiservataDashboard`
- `NewsletterLanding`

### `<ThemeSelector />`

Spostarlo in un layout end-user condiviso (`SiteLayout`) così appare ovunque (oggi è solo su alcune pagine). Stesso per backoffice nel header dell'`AdminLayout`.

---

## 6. Ordine di esecuzione

Suddivisione in step incrementali per non rompere produzione:

1. **Cleanup edge functions inutilizzate** (`explore-firestore`, `generate-thumbnails`, eventualmente `process-email-queue`) — basso rischio.
2. **Footer + ThemeSelector unificati** in `SiteLayout` end-user — zero rischio, miglioramento UX immediato.
3. **DB: tabella `user_roles` + has_role** + bootstrap admin via password attuale.
4. **Routing admin nuovo** in parallelo al vecchio: nuove rotte `/admin/*` con auth Supabase, vecchio `/admin` (password) come fallback.
5. **Migrare componenti** (EventManager → pagine, modali partecipante → `UserDetail`, ecc.).
6. **Rimuovere param `password**` dalle edge function admin → check JWT+ruolo.
7. **Pagine nuove**: `/admin/satispay`, `/admin/certificates`, `/admin/imports`.
8. **Eliminare** vecchio `Admin.tsx` monolitico (oggi 1597 righe) e `/:slug/admin` redirect.

---

## 7. Domande aperte

1. `process-email-queue`: devo verificare se è schedulata via pg_cron prima di proporne la rimozione — la mantengo per ora salvo conferma. Risposta: teniamola
2. **Bootstrap primo admin**: [domenico.diiorio@ginepro.cc](mailto:domenico.diiorio@ginepro.cc) è il super admin in futuro gestiremo permessi diversi per altri utenti