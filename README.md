# Smart Pantry Pro

Inventario di casa (cibo e strumenti) con più scadenze per prodotto, lista della spesa,
storico consumi settimanale con grafico radar e backup su file.
Frontend statico su **GitHub Pages**, dati su **Supabase**.

## File

| File | Cosa fa |
|---|---|
| `index.html`, `style.css`, `app.js` | L'app (HTML + JavaScript puro, nessun build) |
| `config.js` | URL e chiave pubblica del tuo progetto Supabase |
| `supabase.sql` | Crea tabelle e regole di sicurezza (da eseguire una volta) |

Con `config.js` vuoto l'app parte in **modalità demo** (dati solo nel browser): utile per provarla.

## 1. Supabase

1. Crea un account su <https://supabase.com> e un **New project** (regione: Europe, es. Frankfurt).
2. **SQL Editor → New query**: incolla tutto `supabase.sql` e premi **Run**.
3. **Project Settings → API Keys**: copia **Project URL** e la chiave **publishable** (o *anon*)
   in `config.js`. Mai la chiave *secret* / *service_role*.
4. **Authentication → URL Configuration**: imposta **Site URL** con l'indirizzo del sito,
   es. `https://TUONOME.github.io/smart-pantry/`.

## 2. GitHub Pages

1. Crea un repository **pubblico** (es. `smart-pantry`) e carica tutti i file.
2. **Settings → Pages → Source: Deploy from a branch**, branch `main`, cartella `/ (root)` → Save.
3. Dopo 1–2 minuti il sito è su `https://TUONOME.github.io/smart-pantry/`.

## 3. Primo accesso

1. Apri il sito, inserisci email e password e premi **Crea account**.
2. Se arriva la mail di conferma, cliccala e poi premi **Accedi**.
3. **Importante:** in Supabase → **Authentication → Sign In / Providers** disattiva
   **Allow new users to sign up**, così nessun altro può registrarsi.
   (Per condividerla in famiglia: crea prima gli account degli altri, oppure usate lo stesso account.)

## Note

- Il progetto Supabase gratuito va in pausa dopo ~7 giorni senza uso: si riattiva dalla dashboard.
- **Salva Backup** scarica un file JSON con tutti i dati; **Ripristina** lo ricarica (sostituisce i dati attuali).
- Un prodotto finito (ultimo lotto usato) finisce da solo in **Lista della Spesa**; quando lo
  ricompri e lo aggiungi in dispensa, sparisce dalla lista.
