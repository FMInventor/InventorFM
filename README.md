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
- **Ricette**: scegli gli ingredienti e copia il testo pronto da incollare in Gemini.
- **Notifiche** (campanella): una notifica per ogni scadenza, quando entra nei 5 giorni, nei 2 giorni,
  il giorno stesso e quando scade. Arrivano quando il sito è aperto o viene riaperto.
  Su iPhone servono iOS 16.4+ e il sito aggiunto alla schermata Home.
- **Mother**: la lista della spesa in versione grande e semplice. "Invia link a Mother" crea un link
  che si apre senza password, mostra solo la lista, permette di spuntare i prodotti presi e si
  aggiorna da sola. "Nuovo link" disattiva quello vecchio.

## Note

- Il progetto Supabase gratuito va in pausa dopo ~7 giorni senza uso: si riattiva dalla dashboard.
- **Salva Backup** scarica un file JSON con tutti i dati; **Ripristina** lo ricarica (sostituisce i dati attuali).
