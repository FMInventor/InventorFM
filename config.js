// ─────────────────────────────────────────────────────────────
//  Configurazione Supabase
//  Copia questi due valori da: Supabase → Project Settings → API Keys
//  - SUPABASE_URL: "Project URL" (es. https://abcdefgh.supabase.co)
//  - SUPABASE_KEY: la chiave "publishable" (sb_publishable_...) oppure la "anon" legacy.
//
//  Queste chiavi possono stare nel codice pubblico: i dati sono protetti
//  dal login e dalle regole RLS create con supabase.sql.
//  NON incollare MAI qui la "secret" / "service_role" key.
//
//  Se lasci i campi vuoti, l'app parte in MODALITÀ DEMO
//  (dati salvati solo in questo browser).
// ─────────────────────────────────────────────────────────────
window.APP_CONFIG = {
  SUPABASE_URL: 'https://krjljbxnavpzgiebhgjl.supabase.co',
  SUPABASE_KEY: 'sb_publishable_fEKFotHRtHOdqQapNLMuPA_dWbToLuY'
};
