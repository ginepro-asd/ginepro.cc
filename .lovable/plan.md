## Obiettivo

Introdurre l'entità **Società** (es. società sportiva di appartenenza dell'atleta) con:

1. Anagrafica gestita in BO
2. Selezione/creazione durante l'iscrizione (se l'evento la richiede)
3. Aggiunta a utenti esistenti dal dettaglio utente, con possibilità di richiederla via email o WhatsApp

---

## 1. Database

### Nuova tabella `societa`

- `id` uuid PK
- `nome` text NOT NULL UNIQUE (case-insensitive via index)
- `note` text nullable
- `created_at`, `updated_at`
- RLS: lettura pubblica (necessaria per autocomplete in iscrizione), scrittura/update/delete solo admin (`is_admin()`)

### Modifiche tabelle esistenti

- `participants`: aggiungere colonna `societa_id uuid` nullable (riferimento logico, no FK come da pattern progetto)
- `registrations`: aggiungere `societa_id uuid` nullable + `societa_nome text` nullable (snapshot al momento iscrizione)
- `events`: aggiungere flag `richiedi_societa boolean NOT NULL DEFAULT false`

---

## 2. Backend / Edge Functions

- `**manage-event**`: includere `richiedi_societa` in create/update payload
- `**update-participant**`: accettare `societa_id` per aggiornare un partecipante esistente
- Nessuna nuova edge function: la gestione società (CRUD) avviene direttamente dal client tramite SDK Supabase, protetta da RLS `is_admin()` (admin loggato con ruolo). Per la creazione "on-the-fly" durante iscrizione (utente anonimo), aggiungere policy INSERT pubblica oppure (preferito) creare edge function `create-societa` con `verify_jwt=false` che valida nome (zod, trim, dedup case-insensitive) e usa service role.

**Scelta consigliata**: edge function `create-societa` per evitare di esporre INSERT pubblico sulla tabella.

---

## 3. Frontend — BO Anagrafica Società

Nuova pagina `**/admin/organizations**` (`src/pages/admin/AdminSocieta.tsx`):

- Tabella con ricerca per nome
- Bottone "Nuova società" → dialog con campi `nome`, `note`
- Edit/Delete inline
- Voce in `AdminLayout` sidebar

---

## 4. Frontend — Form Iscrizione

In `RegistrationForm.tsx` e `PairRegistrationForm.tsx`:

- Se `event.richiedi_societa === true`, mostrare campo **Società**
- Componente `SocietaCombobox` (basato su `SearchableSelect` esistente):
  - Carica lista da `societa` (lettura pubblica)
  - Ricerca testuale
  - Se nessun risultato → mostra opzione "Aggiungi nuova società: ..." che invoca `create-societa` e seleziona il nuovo id
- Salvataggio: `societa_id` + `societa_nome` (snapshot) in `registrations`; aggiorna anche `participants.societa_id` se non già impostato

---

## 5. Frontend — Dettaglio Utente (BO)

In `src/pages/admin/AdminUserDetail.tsx`, nuova card **"Società"**:

- Mostra società attuale del partecipante (join con `societa` via `societa_id`)
- Bottone "Modifica" → combobox per selezionare/creare
- Bottoni di richiesta:
  - **"Richiedi via Email"**: apre dialog con `Textarea` precompilato (testo modificabile) e invia tramite edge function transazionale esistente (`send-event-email`-like — riusare pattern Lovable transactional con `unsubscribe_token`)
  - **"Richiedi via WhatsApp"**: apre dialog con `Textarea` precompilato; al submit apre `https://web.whatsapp.com/send?phone=<telefono_normalizzato>&text=<encodeURIComponent(testo)>` in nuova tab
- Testo default: "Ciao {nome}, scrivo da Ginepro. Per completare la tua iscrizione potresti indicarci la società sportiva di appartenenza? Grazie!"

Per la mail: nuova edge function leggera `send-societa-request` (oppure riutilizzo del sistema transactional esistente con template inline).

---

## 6. Frontend — EventForm BO

In `src/components/admin/EventForm.tsx`: aggiungere `Switch` "Richiedi società in iscrizione" mappato su `richiedi_societa`.

---

## 7. Tipi & Hooks

- `useEvent`: includere `richiedi_societa` in `EventData`
- Nuovo hook `useSocieta()` per lista società (cached con react-query)

---

## File coinvolti

**Nuovi**

- `supabase/migrations/<timestamp>_societa.sql`
- `supabase/functions/create-societa/index.ts`
- `supabase/functions/send-societa-request/index.ts` (email)
- `src/pages/admin/AdminSocieta.tsx`
- `src/components/SocietaCombobox.tsx`
- `src/hooks/use-societa.ts`

**Modificati**

- `src/App.tsx` (route `/admin/societa`)
- `src/components/AdminLayout.tsx` (voce menu)
- `src/components/admin/EventForm.tsx`
- `src/components/RegistrationForm.tsx`
- `src/components/PairRegistrationForm.tsx`
- `src/pages/admin/AdminUserDetail.tsx`
- `src/hooks/use-event.ts`
- `supabase/functions/manage-event/index.ts`
- `supabase/functions/update-participant/index.ts`

---

## Domande aperte

1. La società è **una sola per partecipante** (campo singolo) o storicizzata per evento (può cambiare nel tempo)? → propongo: una corrente su `participants` + snapshot per registration, così resta lo storico. Proposta accettata
2. Per la creazione on-the-fly durante iscrizione: ok edge function dedicata (più sicura) o policy INSERT pubblica con rate-limit/validation lato DB? ok edge function dedicata  
  
Tra le società esistiamo anche noi, GINEPRO, se un utente è iscritto a tesseramento-<anno-corrente> il campo società glielo popoliamo già in fase di migrazione