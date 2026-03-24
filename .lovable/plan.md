

## Piano: Indicatore fallback email conferma nell'admin

### Cosa manca

Il sistema backend già cerca un template `on_payment` per ogni evento e, se non lo trova, usa il fallback (`send-confirmation-email`). Ma nell'admin non c'è nessuna indicazione visiva di questo stato.

### Modifica

**`src/components/TransactionalEmailManager.tsx`** — una sola modifica nell'UI:

Quando viene selezionato un evento e i template sono caricati, verificare se esiste un template con `trigger_type = "on_payment"`. Se non esiste, mostrare un banner informativo sopra la lista template:

- **Icona info + testo**: "Nessuna email di conferma configurata per questo evento. Viene utilizzato il template di sistema predefinito."
- **Pulsante**: "Crea template conferma" che apre l'editor pre-compilato con:
  - `slug`: "conferma-iscrizione"
  - `trigger_type`: "on_payment"
  - `subject`: "Iscrizione confermata — {evento}"
  - `body_html`: l'HTML della `send-confirmation-email` attuale, convertito in template con placeholder `{nome}`, `{cognome}`, `{email}`

Se invece esiste un template `on_payment`, mostrare un badge verde: "Email di conferma configurata ✓"

### File coinvolti

| File | Modifica |
|------|----------|
| `src/components/TransactionalEmailManager.tsx` | Banner fallback + pulsante creazione rapida con HTML predefinito |

