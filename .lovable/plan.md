

# Landing Page — Tredozio Trail by GINEPRO (Early-Bird)

## Panoramica
Landing page per iscrizioni early-bird al Tredozio Trail by GINEPRO (11 Aprile 2027) a 14,99€. Offerta valida fino alla mezzanotte del 29 Marzo 2025. Pagamento via Stripe, Satispay o PayPal.

---

## 1. Brand Identity
- **Colori primari**: Teal scuro e Rosa corallo, dai loghi GINEPRO
- **Loghi**: Dark e Light mode con i loghi forniti
- **Grafica topografica**: NON usata direttamente — verrà ricreata come pattern SVG/CSS con linee di livello stilizzate ispirate all'originale, in qualità vettoriale, usata come texture decorativa di sfondo
- **Elementi decorativi**: triangoli e cerchi dal brand, forme montagna/sole

## 2. Hero Section
- Logo GINEPRO grande
- Titolo: **Tredozio Trail** — **11 Aprile 2027**
- Prezzo: **14,99€ Early-Bird**
- **Countdown timer** fino a mezzanotte del 29 Marzo 2025
- Sfondo con pattern topografico vettoriale ricreato
- CTA "Iscriviti ora"

## 3. Sezione Info Evento
- Data, luogo (Tredozio), descrizione breve
- **"Offerta valida fino al 29 Marzo 2025 alle 23:59"**

## 4. Form di Iscrizione (bloccato dopo scadenza)
Campi obbligatori:
- **Nome**
- **Cognome**
- **Email**
- **Numero di telefono** (necessario per Satispay)
- **Scelta** tra: Data e luogo di nascita OPPURE Codice fiscale
- **Metodo di pagamento**: Stripe, Satispay o PayPal

Dopo mezzanotte del 29/03/2025: form disabilitato → "Le iscrizioni early-bird sono chiuse"

## 5. Pagamento — Tre opzioni

### 5a. Stripe
- Redirect a Stripe Checkout per 14,99€, ritorno a pagina di conferma

### 5b. Satispay
- Creazione pagamento via API Satispay (edge function)
- **Nessun redirect**: notifica push sull'app Satispay dell'utente
- Pagina mostra "In attesa di pagamento..." con polling per conferma
- Al completamento → conferma iscrizione

### 5c. PayPal
- Integrazione PayPal Checkout (SDK JavaScript o redirect)
- Pagamento one-off di 14,99€
- Ritorno a pagina di conferma

## 6. Pagina di Conferma
- Messaggio di successo con riepilogo: nome, cognome, email, metodo di pagamento

## 7. Salvataggio Dati
- Database Supabase con possibilità di esportazione CSV
- Ogni iscrizione collegata allo stato pagamento (Stripe/Satispay/PayPal)

## 8. Design & Stile
- Palette natura teal/corallo dal brand
- Pattern topografico ricreato in SVG/CSS ad alta qualità (ispirato alla grafica originale)
- Layout responsive mobile-first
- Countdown con urgenza visiva
- Dark/Light mode con loghi appropriati

## Note Tecniche
- **Lovable Cloud / Supabase** per edge function (Satispay API, salvataggio dati)
- **Stripe** integrato tramite Lovable
- **Satispay API key** salvate come secret
- **PayPal Client ID** salvato come secret
- I loghi forniti integrati come asset nel progetto

