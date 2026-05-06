## Obiettivo

La modale "Aggiungi iscritto" del BO riusa **integralmente** `RegistrationForm` (stessi campi, validazioni, società, certificato, tessera, custom fields, prezzi). Unica differenza: i metodi di pagamento sono limitati a **Satispay** e **Contanti**.

## Modifiche

### 1. `src/components/RegistrationForm.tsx`

- Nuova prop opzionale `onCompleted?: () => void`. Quando definita, alla conclusione del flusso (contanti completato, Satispay confermato in `SatispayWaiting`) viene invocata invece di reindirizzare a `/conferma`. Per Stripe/PayPal nessun cambiamento (non sono nei metodi admin).
- `adminBypass` continua a limitare i payment methods a `["satispay", "contanti"]` (già implementato).

### 2. `src/components/AdminAddRegistration.tsx` — refactor

- Rimuove tutto il form custom e il polling Satispay duplicato.
- Eliminiamo lo step iniziale di **ricerca per nome/cognome** perchè ci basiamo già sul meccanismo di RegistrationForm "returning user"
- Aggiunge prop `eventSlug: string` (passata dal parent) e usa `useEvent(eventSlug)` per ottenere il `EventData` completo.
- Allo step `"form"` renderizza:
  ```tsx
  <RegistrationForm
    event={event}
    adminBypass
    onCompleted={() => { onOpenChange(false); onSuccess(); }}
  />
  ```
  &nbsp;

### 3. `src/pages/admin/AdminEventParticipants.tsx`

- Recupera anche `slug` nella query iniziale su `events` e lo passa come `eventSlug` alla modale.

## Note

- `RegistrationForm` ha già la gestione di società (`event.richiedi_societa`), certificato, tessera sportiva, returning user, calcolo CF, prezzi variabili, spot counts: tutto disponibile automaticamente.
- Spot counts: opzionalmente la modale può recuperare `spotCounts` come fa la pagina pubblica; in prima battuta lo lasciamo `undefined` (il form gestisce il caso assente).