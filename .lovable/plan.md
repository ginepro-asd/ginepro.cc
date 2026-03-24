

## Piano: Maggiorazione €2 commissioni servizio idchronos

### Approccio

Aggiungere una **commissione di servizio di 200 centesimi (€2)** al prezzo della disciplina, visibile **solo** nel pulsante "Iscriviti e Paga" e nei flussi di pagamento. I prezzi mostrati nel selettore disciplina e nell'hero restano invariati.

### Modifiche

**1. `src/components/RegistrationForm.tsx`**
- Calcolare un `paymentPrice = selectedPrice + 200` usato per:
  - Il testo del pulsante: `Iscriviti e Paga — XX,XX€` (con nota piccola "incl. €2 commissioni servizio")
  - Il sottotitolo "Assicurati il posto al prezzo di..."
  - Il valore passato come `price` al componente `SatispayWaiting`
- Il `displayPriceLabel` per il pulsante e il sottotitolo userà il prezzo maggiorato
- Aggiungere una riga sotto il pulsante: `di cui €2,00 commissioni servizio idchronos`

**2. Backend — Edge Functions** (`create-checkout`, `create-satispay-payment`, `create-paypal-order`)
- Aggiungere +200 centesimi al `eventPrice` calcolato, così che il pagamento effettivo includa la commissione
- Opzionalmente mostrare la commissione come riga separata nella sessione Stripe (line item aggiuntivo o descrizione)

**3. Scope**: Solo per tredozio-trail-2026 o per tutti gli eventi?

Dato che dici "tredozio-trail-2026", propongo di aggiungere un campo `service_fee` nell'evento nel database (default 0) così è configurabile per evento. Per tredozio impostiamo 200.

### File coinvolti

| File | Modifica |
|------|----------|
| DB migration | Aggiungere colonna `service_fee` (int, default 0) a `events`, impostare 200 per tredozio |
| `src/hooks/use-event.ts` | Aggiungere `service_fee` a `EventData` |
| `src/components/RegistrationForm.tsx` | Sommare `service_fee` al prezzo nel pulsante e sottotitolo, aggiungere nota commissioni |
| `supabase/functions/create-checkout/index.ts` | Sommare `service_fee` al `eventPrice` |
| `supabase/functions/create-satispay-payment/index.ts` | Idem |
| `supabase/functions/create-paypal-order/index.ts` | Idem |

