

## Piano: Gestione completa utenti + pagamento in contanti

### Obiettivo
1. Permettere all'admin di modificare **tutti** i campi del partecipante (inclusi `identification_type`, `newsletter`, `photo_url`, `signature_url`, ecc.)
2. Aggiungere `'contanti'` (cash) come metodo di pagamento valido
3. Permettere all'admin di creare utenti, iscriverli a eventi e registrare pagamenti in contanti

### Modifiche

#### 1. Migrazione database
- Aggiungere `'contanti'` e `'admin'` ai valori consentiti del vincolo `registrations_payment_method_check`

```sql
ALTER TABLE public.registrations DROP CONSTRAINT registrations_payment_method_check;
ALTER TABLE public.registrations ADD CONSTRAINT registrations_payment_method_check 
  CHECK (payment_method = ANY (ARRAY['stripe','satispay','paypal','imported','contanti','admin']));
```

#### 2. Edge Function `update-participant`
- Estendere `allowedFields` per includere tutti i campi della tabella `participants`: aggiungere `identification_type`, `newsletter`, `photo_url`, `photo_thumb_url`, `signature_url`
- I campi che non esistono in `registrations` (es. `newsletter`, `photo_url`, `signature_url`) non verranno sincronizzati nelle registrazioni

#### 3. Edge Function `manage-event` — Nuove azioni
- **`create_participant`**: Crea un nuovo partecipante con tutti i campi anagrafici
- **`admin_register`**: Iscrive un partecipante a un evento con `payment_method` a scelta (incluso `'contanti'`) e `payment_status = 'completed'`, bypassando la scadenza. Supporta `custom_data`
- **`update_registration`**: Aggiorna `payment_status`, `payment_method` e `custom_data` di un'iscrizione esistente

#### 4. Frontend Admin.tsx
- **Dialog modifica utente**: Aggiungere i campi mancanti (`identification_type` come select, `newsletter` come checkbox)
- **Pulsante "Aggiungi utente"**: Dialog con form completo per creare un nuovo partecipante
- **Pulsante "Iscrivi a evento"**: Nella modale dettagli utente o nella riga, con select evento + metodo di pagamento (incluso "Contanti") + campi custom opzionali
- **Pulsante "Aggiungi iscritto"** nella vista per-evento: cerca partecipante esistente o ne crea uno nuovo, poi lo iscrive

#### 5. Deploy
Redeploy delle edge function `update-participant` e `manage-event`.

### Dettagli tecnici

```text
Flusso "Iscrizione in contanti":
Admin → Trova/crea utente → "Iscrivi a evento" 
  → Seleziona evento + "Contanti" come metodo
  → Iscrizione creata con payment_status=completed, payment_method=contanti
```

I campi editabili nel dialog di modifica utente saranno:
- nome, cognome, email, telefono, codice_fiscale, birth_date, birth_place, identification_type (select: birth/fiscal/cf), newsletter (checkbox)

I campi `photo_url`, `signature_url` restano modificabili solo via API (non ha senso un campo testo per URL di foto nella UI).

