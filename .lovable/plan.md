

## Piano: Sistema Email Transazionali con Admin

### Obiettivo

Creare un sistema di email transazionali gestibile dall'admin, che includa:
1. Email di conferma iscrizione/tesseramento (attuale `send-confirmation-email`, migrata)
2. Nuova email pre-gara con info logistiche e orario dinamico per disciplina
3. Pannello admin per gestire template, invio manuale/triggerato e log

### Architettura

Il sistema attuale usa Resend direttamente dalla edge function `send-confirmation-email`. Manterremo Resend come provider ma centralizzeremo tutto in un sistema unificato.

```text
┌─────────────────────────────┐
│  DB: event_emails           │
│  (template per evento)      │
│  - event_id, slug, subject  │
│  - body_html, trigger_type  │
│  - sent_at, orario_map      │
└──────────┬──────────────────┘
           │
    ┌──────┴──────┐
    │ Edge Fn:    │
    │ send-event  │◄── chiamato da admin UI o da verify-payment/check-satispay
    │ -email      │
    └─────────────┘
```

### Modifiche

**1. Nuova tabella `event_emails`**

Tabella per template email associati a un evento:

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| event_id | uuid | FK events |
| slug | text | es. "conferma-iscrizione", "pre-gara" |
| subject | text | Oggetto email, supporta `{nome}` |
| body_html | text | HTML template con placeholder `{nome}`, `{orario}`, `{cognome}` |
| trigger_type | text | "on_payment" / "manual" |
| orario_map | jsonb | Mappa disciplina→orario, es. `{"Long 31Km (+1300m)": "8:30", ...}` |
| sent_at | timestamptz | null se non ancora inviata (per invii manuali bulk) |
| created_at | timestamptz | |

RLS: SELECT public, INSERT/UPDATE/DELETE solo service_role.

**2. Nuova tabella `event_email_sends`**

Log di ogni singolo invio:

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| event_email_id | uuid | FK event_emails |
| registration_id | uuid | FK registrations |
| status | text | "sent" / "failed" |
| error | text | nullable |
| sent_at | timestamptz | |

RLS: SELECT public, INSERT solo service_role.

**3. Edge Function `send-event-email`**

Nuova edge function unificata che:
- Riceve `event_email_id` + `registration_id` (invio singolo) oppure `event_email_id` + `event_id` (invio bulk)
- Carica il template da `event_emails`
- Risolve i placeholder: `{nome}`, `{cognome}`, `{orario}` (da `orario_map` + `custom_data.disciplina`), `{tessera}`, `{data_evento}`
- Invia via Resend
- Logga in `event_email_sends`
- Per invio bulk: carica tutte le registrazioni `completed` dell'evento, esclude quelle già inviate (join con `event_email_sends`), invia in batch

**4. Migrare la conferma iscrizione**

- Creare un record `event_emails` di default per ogni evento con `trigger_type = "on_payment"` e `slug = "conferma-iscrizione"`
- Il body_html sarà l'HTML attuale della `send-confirmation-email`, convertito in template con placeholder
- Modificare `verify-payment`, `check-satispay-payment`, `capture-paypal-order` per chiamare `send-event-email` invece di `send-confirmation-email`
- La vecchia `send-confirmation-email` resta come fallback ma non viene più chiamata

**5. Email pre-gara Tredozio**

Creare un record `event_emails` per tredozio-trail-2026 con:
- `slug`: "pre-gara"
- `trigger_type`: "manual"
- `subject`: "Ci vediamo a Tredozio! 🏃‍♂️"
- `orario_map`: `{"Long 31Km (+1300m)": "8:30", "Short 18Km (+780m)": "9:00", "Walk 8km (+300m)": "10:00"}`
- `body_html`: l'HTML stilizzato del messaggio fornito, con `{nome}` e `{orario}` come placeholder

**6. Pannello Admin — Componente `TransactionalEmailManager`**

Nuovo tab nella pagina admin (accanto a Newsletter, Eventi):

- **Lista template**: tabella con slug, subject, trigger, stato invio
- **Editor template**: dialog con:
  - Subject (con placeholder hints)
  - Body HTML (textarea con anteprima live, come NewsletterManager)
  - Trigger type (on_payment / manual)
  - Mappa orari (editor key-value per disciplina→orario)
- **Invio manuale**: per template `manual`:
  - Pulsante "Invia a tutti" → conferma con conteggio destinatari (esclusi già inviati)
  - Pulsante "Invia test" → invio a un'email specifica
  - Progress bar durante l'invio bulk
  - Badge con conteggio inviati/totali
- **Log invii**: espandibile, mostra lista destinatari con stato (sent/failed)

### File coinvolti

| File | Modifica |
|------|----------|
| DB migration | Creare `event_emails` e `event_email_sends` |
| DB insert | Popolare template conferma + pre-gara per tredozio |
| `supabase/functions/send-event-email/index.ts` | Nuova edge function unificata |
| `supabase/config.toml` | Aggiungere config per `send-event-email` |
| `supabase/functions/verify-payment/index.ts` | Chiamare `send-event-email` invece di `send-confirmation-email` |
| `supabase/functions/check-satispay-payment/index.ts` | Idem |
| `supabase/functions/capture-paypal-order/index.ts` | Idem |
| `src/components/TransactionalEmailManager.tsx` | Nuovo componente admin |
| `src/pages/Admin.tsx` | Aggiungere tab "Email" con TransactionalEmailManager |
| `src/integrations/supabase/types.ts` | Auto-aggiornato dopo migration |

### Flusso

**Conferma iscrizione (automatica):**
Pagamento completato → edge function pagamento → chiama `send-event-email` con il template `trigger_type = "on_payment"` dell'evento → email inviata e loggata

**Pre-gara (manuale):**
Admin apre tab Email → seleziona template "pre-gara" → clicca "Invia a tutti" → conferma → edge function invia a tutti gli iscritti `completed`, escludendo chi ha già ricevuto → progress e log visibili

