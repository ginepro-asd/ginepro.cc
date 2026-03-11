

# Piano aggiornato — Fase 1: Form Tesseramento 2026

## Nota importante
Il `TesseramentoForm` deve includere la stessa logica "Ci conosciamo già?" presente in `RegistrationForm`: lookup debounced su `participants` tramite nome+cognome, dialog di selezione profilo, precompilazione con dati offuscati, e uso dei dati reali al submit.

## Strategia per il riutilizzo

La logica condivisa tra `RegistrationForm` e `TesseramentoForm` include:
- Funzioni di offuscamento (`obfuscateEmail`, `obfuscatePhone`, `obfuscateCF`)
- L'interfaccia `MatchedRegistration` e il tipo del form base
- Il lookup debounced su `participants` via nome+cognome con `useEffect`
- Il dialog "Ci conosciamo già?" con selezione e precompilazione
- Il calcolo automatico CF da dati anagrafici e viceversa (`tryComputeCF`, `tryInverseCF`)
- Le costanti `COUNTRY_CODES`, `PAYMENT_ICONS`, `PAYMENT_LABELS`
- La funzione `stripProvincia` / `extractProvincia`

**Approccio**: Estrarre queste utilità e costanti in un file condiviso `src/lib/registration-utils.ts`, poi importarle sia in `RegistrationForm` che in `TesseramentoForm`. Questo evita duplicazione e garantisce che il comportamento "Ci conosciamo già" sia identico.

## Struttura dei file

| File | Azione |
|---|---|
| `src/lib/registration-utils.ts` | **Nuovo** — Utilità condivise (offuscamento, CF, costanti, tipo `MatchedRegistration`) |
| `src/hooks/use-returning-user.ts` | **Nuovo** — Hook custom che incapsula il lookup debounced + stato match + dialog logic |
| `src/components/RegistrationForm.tsx` | **Refactor** — Importa da `registration-utils` e `use-returning-user` invece di definire tutto inline |
| `src/components/TesseramentoForm.tsx` | **Nuovo** — Form multi-step che usa gli stessi import |
| `src/components/SignaturePad.tsx` | **Nuovo** — Canvas firma touch/mouse |
| `supabase/functions/analyze-certificate/index.ts` | **Nuovo** — Analisi AI certificato medico |
| DB migration | Crea `membership_cards`, `medical_certificates`, storage buckets, colonne su `participants` |
| `src/pages/EventPage.tsx` | Condizionale `is_tesseramento` → renderizza `TesseramentoForm` |

## Hook `use-returning-user`

Encapsula:
- Stato: `matchedUsers`, `showMatchDialog`, `matchDismissed`, `returningUserData`
- Effect debounced che chiama `participants` con `ilike` su nome+cognome
- `handleSelectMatch(match)` che popola il form con dati offuscati
- `handleDismiss()` per chiudere il dialog
- Espone `returningUserData` per l'uso al submit (dati reali in chiaro)

Parametri in input: `watchedNome`, `watchedCognome`, `form` (react-hook-form instance), `setCountryCode`, `setIdentificationType`.

## Flusso TesseramentoForm

**Step 1 — Identificazione** (identico a RegistrationForm)
- Nome, Cognome → trigger "Ci conosciamo già?" via `use-returning-user`
- Email, Telefono (con prefisso), Sesso
- Data/Luogo di nascita OPPURE Codice fiscale
- Calcolo automatico CF ↔ dati anagrafici

**Step 2 — Tipologia tesseramento**
- 6 opzioni radio con prezzo: FIDAL Running (40€), FIDAL Running + UISP Bike (80€), Socio sostenitore (15€), UISP Bike (55€), UISP Running (25€), UISP Running + Bike (65€)
- Determina discipline richieste per certificato

**Step 3 — Fototessera**
- Upload o selfie, preview, thumbnail 200px client-side

**Step 4 — Firma**
- SignaturePad canvas oppure upload immagine

**Step 5 — Certificato medico** (skip per "Socio sostenitore")
- Upload + analisi AI (Gemini Flash)
- Se 2 sport → 2 certificati
- Bottone "Carica dopo" per saltare
- Warning non bloccante se discipline non corrispondono

**Step 6 — Pagamento**
- Riepilogo + selezione metodo pagamento

## Database (invariato rispetto al piano precedente)

- Tabelle `membership_cards`, `medical_certificates`
- Colonne `photo_url`, `photo_thumb_url`, `signature_url` su `participants`
- Storage buckets: `member-photos`, `member-signatures`, `medical-certificates`

## Fuori scope (Fase 2)
- Pagina tessera `/card/:id`
- Area riservata utente
- Email di conferma con numero tessera

