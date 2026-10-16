# Smart Pantry Pro

Inventario di casa (cibo e strumenti) con più scadenze per prodotto, lista della spesa,
sezione Mother, notifiche delle scadenze, storico consumi con grafico radar e backup su file.
Frontend statico su **GitHub Pages**, dati su **Supabase**.

## File

| File | Cosa fa |
|---|---|
| `index.html`, `style.css`, `app.js` | L'app (HTML + JavaScript puro, nessun build) |
| `config.js` | URL e chiave pubblica del tuo progetto Supabase |
| `sw.js`, `manifest.json`, `icon-*.png` | Notifiche e installazione sul telefono |
| `supabase.sql` | Crea/aggiorna tabelle e regole di sicurezza |

Con `config.js` vuoto l'app parte in **modalità demo** (dati solo nel browser).

## Aggiornare da una versione precedente

1. Supabase → **SQL Editor → New query**: incolla tutto il nuovo `supabase.sql` e premi **Run**
   (non cancella i dati, aggiunge solo le novità).
2. Su GitHub carica i nuovi file **tranne `config.js`** (tieni il tuo, già compilato).

## Come funziona

- **Usa**: la quantità consumata viene aggiunta alla lista della spesa (se c'è già, si somma).
- **Lista della spesa → In dispensa**: conferma quantità comprata e scadenza, e il prodotto torna
  nell'inventario. Se compri meno del previsto, il resto rimane in lista.
- **Categorie**: se ne possono scegliere più di una (es. Surgelati + Carne e Pesce); la prima scelta è la principale.
- **Surgelati**: compare la data di congelamento; la scadenza viene proposta a 3 mesi (modificabile).
- **Accesso**: non c'è il pulsante per creare account. Nuovi utenti si aggiungono da Supabase → Authentication → Users → Add user.
- **Colori**: rosso = scade entro 2 giorni, arancione = entro 5 giorni, bordeaux = scaduto.
- **Cosa Cucino**: seleziona in automatico i prodotti che scadono prima (puoi cambiare le caselle) e prepara
  il testo per Gemini per un menù settimanale. La risposta di Gemini si incolla nella sezione **Menù**.
- **Scorta minima**: se in casa scendi sotto la quantità minima, la differenza va da sola in lista spesa;
  il prodotto resta visibile come "Finito" finché non lo ricompri.
- **Offline**: senza connessione l'app funziona con l'ultima copia dei dati; le modifiche vengono salvate
  appena torna internet. Anche il link di Mother funziona senza campo.
- **Notifiche** (campanella / menu ☰): una notifica per ogni scadenza, quando entra nei 5 giorni, nei 2 giorni,
  il giorno stesso e quando scade. Con il kit notifiche configurato arrivano ogni mattina anche a sito
  chiuso. Su iPhone servono iOS 16.4+ e il sito aggiunto alla schermata Home.
- **Mother**: in Lista della Spesa selezioni i prodotti con la casella e premi **Genera lista Mother**.
  Nella sezione Mother (e nel link condiviso, che si apre senza password) compare solo quella lista,
  grande e semplice, e si aggiorna da sola. Se rigeneri la lista, i prodotti che Mother aveva già
  segnato come presi restano. "Nuovo link" disattiva quello vecchio.
- **Telefono**: barra in basso, menu ☰ con backup/notifiche/esci, finestre che salgono dal basso.
