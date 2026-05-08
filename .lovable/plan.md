## Obiettivo
Aggiungere nell'export CSV degli iscritti due nuove colonne:
- **quota_pagata** — l'importo effettivamente pagato dall'iscritto (in EUR)
- **societa** — il nome della società di appartenenza (se presente)

## Modifiche

### `supabase/functions/export-registrations/index.ts`
1. Estendere la query principale per includere:
   - `events(..., prezzo, custom_fields, service_fee)` (servono per calcolare la quota)
   - `societa(nome)` (join sulla società dell'iscrizione)
   - In alternativa `participants(..., societa(nome))` come fallback
2. Importare `resolveEventPrice` da `../_shared/event-pricing.ts`.
3. Per ogni registrazione calcolare:
   - `quota_pagata` = `(resolveEventPrice(event.prezzo, event.custom_fields, custom_data) + (event.service_fee || 0)) / 100` formattato in EUR (es. `"15.00"`)
   - `societa_nome` = `registrations.societa_nome` ?? `societa.nome` ?? `participants.societa.nome` ?? `""`
4. Aggiungere `quota_pagata` e `societa` all'array `headers` del CSV e nell'oggetto `enriched` mappato per l'export.

### Note
- Solo aggiunta colonne: nessuna modifica alla UI, nessun cambio allo schema DB.
- La quota riflette il prezzo dovuto al momento dell'iscrizione (base + opzione + service_fee), coerente con la logica usata in checkout.
