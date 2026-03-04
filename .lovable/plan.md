

## Piano: Esplorazione dati Firestore

Creerò una edge function `explore-firestore` che:

1. Si connette a Firestore usando la service account già salvata
2. Lista tutte le collection `events` (escludendo quelle con "cre2025" e "cre25" nell'ID)
3. Per ogni evento, legge i primi documenti dalla subcollection `entries` e restituisce i campi disponibili

Questo ci permetterà di esplorare interattivamente la struttura dei dati e decidere cosa importare.

### Dettagli tecnici
- Edge function `explore-firestore` con endpoint GET
- Usa `FIREBASE_SERVICE_ACCOUNT` secret già configurato
- Autentica via Google OAuth2 JWT per accedere alle API REST di Firestore
- Restituisce: lista eventi con ID + sample di campi dalle entries
- Filtro client-side per escludere ID contenenti "cre2025" o "cre25"

