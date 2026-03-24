

## Piano: Gestione iscrizioni Tredozio Trail 2026

Trasformare l'evento da link esterno a gestione interna con 3 discipline, posti limitati, logica tessera/certificato condizionale e analisi AI non bloccante.

---

### 1. Aggiornamento dati evento (database)

Aggiornare il record `tredozio-trail-2026`:
- `external_url` → `null`
- `prezzo` → `1500`
- `custom_fields` con disciplina, prezzi, posti e flag certificato

### 2. Estendere il tipo `CustomField` (src/hooks/use-event.ts)

Aggiungere:
- `option_max_spots?: Record<string, number>`
- `option_requires_certificate?: Record<string, boolean>`

### 3. Conteggio posti e disciplina selector (EventPage.tsx)

Usare il selettore disciplina già presente in `EventPage.tsx` (quello per mixed coppia) anche per eventi con `option_max_spots`. Per ogni opzione con posti limitati:
- Query a `registrations` filtrando `event_id`, `payment_status = 'completed'`, contando per `custom_data->>disciplina`
- Mostrare "X posti rimasti" (verde >5, arancione 1-5, rosso 0)
- Disabilitare opzioni esaurite

### 4. Logica tessera/certificato nel RegistrationForm

**Se disciplina con `option_requires_certificate = true` (Short/Long):**
- Campo "Tessera sportiva" (testo, opzionale)
- Se tessera compilata → upload certificato **facoltativo** con nota "facoltativo con tessera"
- Se tessera vuota → upload certificato **obbligatorio**
- Link: "Non hai una tessera? Tesserati con Ginepro →" → `/tesseramento-2026`

**Se disciplina senza flag (Walk):**
- Nessun campo tessera/certificato
- CTA leggera: "Vuoi diventare socio Ginepro? Scopri il tesseramento →"

**Upload certificato:**
- File caricato su bucket `medical-certificates`
- Al caricamento, chiamare `analyze-certificate` con `expectedDiscipline` derivata dalla disciplina (discipline valide: "Atletica Leggera", "Trail running" e sinonimi)
- Mostrare spinner durante analisi
- Risultato: badge verde se scadenza valida il giorno gara, warning arancione se non leggibile/scaduto — **mai bloccante**
- Passare `certificatePaths` e `certificateAnalyses` al payload di checkout

### 5. Validazione backend (Edge Functions)

In `create-checkout`, `create-satispay-payment`, `create-paypal-order`:

**Verifica posti:**
- Contare registrazioni `completed` per la disciplina selezionata (`custom_data->>'disciplina'`)
- Confrontare con `option_max_spots` dal campo custom dell'evento
- Rifiutare con errore se esaurito

**Verifica certificato:**
- Se l'opzione ha `option_requires_certificate` e `customData.tessera_sportiva` è vuoto → `certificatePaths` deve essere presente, altrimenti rifiutare
- Salvare `tessera_sportiva` in `customData`

### 6. EventManager (admin)

Aggiungere nell'editor custom fields la possibilità di configurare `option_max_spots` e `option_requires_certificate` per le opzioni di un campo select, per riutilizzabilità futura.

---

### File coinvolti

| File | Modifica |
|------|----------|
| DB (insert tool) | Update evento tredozio-trail-2026 |
| `src/hooks/use-event.ts` | Nuovi campi in `CustomField` |
| `src/pages/EventPage.tsx` | Selettore disciplina con posti rimasti |
| `src/components/RegistrationForm.tsx` | Tessera sportiva, upload certificato con analisi AI, CTA tesseramento |
| `src/lib/event-pricing.ts` | Helper `getOptionMaxSpots`, `optionRequiresCertificate` |
| `supabase/functions/create-checkout/index.ts` | Verifica posti + certificato |
| `supabase/functions/create-satispay-payment/index.ts` | Verifica posti + certificato |
| `supabase/functions/create-paypal-order/index.ts` | Verifica posti + certificato |
| `src/components/EventManager.tsx` | UI per configurare max spots e requires certificate |

