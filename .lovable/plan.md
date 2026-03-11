
# GINEPRO ASD — Piattaforma Eventi e Tesseramento

## Stato Attuale (Completato)

### Infrastruttura
- ✅ Multi-evento dinamico: landing page con lista eventi attivi + archivio eventi passati
- ✅ Pagina evento singolo con hero, countdown, form iscrizione
- ✅ 3 metodi di pagamento: Stripe, Satispay, PayPal
- ✅ Database partecipanti con deduplicazione (returning user)
- ✅ Email di conferma parametrizzate per evento (Resend)
- ✅ Pannello admin con login, tabella iscrizioni, export CSV
- ✅ Event Manager per creare/modificare eventi da admin

### Tipologie Evento
- ✅ Iscrizione singola standard (es. Tredozio Trail, Castel Raniero)
- ✅ Iscrizione in coppia con pettorali collegati (es. Rione Rosso)
- ✅ Tesseramento annuale multi-step (firma, foto, certificato medico, tessera)
- ✅ Eventi con link esterno (es. IDchronos)
- ✅ Custom fields con prezzi variabili (percorso/disciplina)

### Design
- ✅ Dark/Light mode con loghi appropriati
- ✅ Pattern topografico SVG decorativo
- ✅ Layout responsive mobile-first
- ✅ Animazioni Framer Motion

---

## Fase 2 — Miglioramenti e Nuove Funzionalità

### 2.1 Pagina di Conferma migliorata
- Mostrare riepilogo dettagliato: nome evento, data, luogo, prezzo pagato
- Mostrare numero pettorale (se assegnato)
- Per tesseramento: mostrare numero tessera
- CTA per condividere su social o salvare ricevuta

### 2.2 Dashboard Admin avanzata
- Statistiche riassuntive: totale iscritti, incasso, breakdown per metodo di pagamento
- Grafici andamento iscrizioni nel tempo
- Filtri avanzati per stato pagamento, data, metodo
- Gestione partecipanti: modifica dati, rimborsi
- Visualizzazione certificati medici con avvisi AI

### 2.3 Notifiche e comunicazioni
- Notifiche push/email all'admin per nuove iscrizioni
- Email di promemoria pre-evento ai partecipanti
- Email personalizzabili per evento dall'admin

### 2.4 SEO e Performance
- Meta tag dinamici per ogni evento (Open Graph, Twitter Card)
- Sitemap dinamica
- Lazy loading immagini
- Ottimizzazione Core Web Vitals

### 2.5 Esperienza Utente
- Pagina "I miei eventi" per utenti registrati (lookup per email)
- Download ricevuta PDF post-iscrizione
- Migliorare la pagina 404
- Breadcrumb navigation

### 2.6 Funzionalità Avanzate
- Lista d'attesa per eventi sold-out
- Codici sconto / promo
- Iscrizioni di gruppo (>2 persone)
- QR code per check-in il giorno dell'evento

---

## Note Tecniche
- **Lovable Cloud** per edge functions e database
- **Stripe, Satispay, PayPal** per pagamenti
- **Resend** per email transazionali
- **Gemini Flash** per analisi certificati medici
- Secrets già configurati: Stripe, Satispay, PayPal, Resend, Firebase, FIDAL
