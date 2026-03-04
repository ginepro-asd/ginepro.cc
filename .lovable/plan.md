

## Scalare l'applicazione: evoluzione vs nuovo progetto

### Analisi della situazione attuale

Il progetto è una landing page single-event con tutto hardcoded: nome evento, data, luogo, prezzo, campi del form. Non c'è nessun concetto di "evento" nel database — solo una tabella `registrations`.

### Raccomandazione: evolvere questo progetto

Non serve freezare e ripartire. Conviene trasformare questa app in una **piattaforma multi-evento** riusando tutto il codice esistente. Ecco il piano:

### Architettura proposta

```text
┌─────────────────────────────────────┐
│           events (nuova tabella)     │
│  - id, slug, nome, data, luogo      │
│  - prezzo (centesimi), descrizione   │
│  - hero_image, scadenza_iscrizioni   │
│  - custom_fields (JSONB)             │
│  - attivo (boolean)                  │
└──────────────┬──────────────────────┘
               │ 1:N
┌──────────────▼──────────────────────┐
│        registrations (esistente)     │
│  + event_id (FK → events.id)        │
│  + custom_data (JSONB)              │
└─────────────────────────────────────┘
```

### Campi configurabili per evento

La colonna `custom_fields` in `events` conterrà un array JSON che definisce i campi extra per quell'evento:

```json
[
  { "key": "certificato_medico", "label": "Certificato medico", "type": "file", "required": true },
  { "key": "taglia_maglia", "label": "Taglia maglia", "type": "select", "options": ["S","M","L","XL"], "required": false }
]
```

Il form li renderizza dinamicamente e salva i valori in `custom_data` (JSONB) nella registrazione.

### Routing

- `/:slug` → landing page dell'evento (carica dati da `events` per slug)
- `/:slug/conferma` → pagina conferma
- `/:slug/admin` → dashboard admin filtrata per evento
- `/` → lista eventi attivi oppure redirect all'evento principale

### Passi di implementazione

1. **Creare tabella `events`** con tutti i campi configurabili (nome, data, luogo, prezzo, custom_fields JSONB, slug, scadenza, metodi pagamento abilitati)
2. **Aggiungere `event_id` e `custom_data` alla tabella `registrations`** con FK verso events
3. **Migrare i dati esistenti**: creare l'evento "Tredozio Trail 2027" e collegare le registrazioni esistenti
4. **Refactoring del frontend**: parametrizzare Index, RegistrationForm, Conferma e Admin per leggere la config dall'evento via slug
5. **Rendering dinamico dei campi custom** nel RegistrationForm basato su `custom_fields`
6. **Aggiornare le edge functions** per ricevere `event_id`, validare il prezzo dall'evento e passare i metadati corretti
7. **Admin multi-evento**: filtro per evento nella dashboard, export CSV per evento

### Vantaggi di questo approccio

- Riuso completo del codice esistente (form, pagamenti, admin)
- Ogni evento è configurabile da database senza toccare il codice
- I campi custom (certificato medico, taglia, ecc.) sono gestiti via JSONB senza migrazioni
- Si può creare un mini-admin per gestire gli eventi in futuro

