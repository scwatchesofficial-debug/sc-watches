/* =========================================================
   Configuration de la base de données en ligne (Supabase)
   ---------------------------------------------------------
   Supabase → Project Settings → API (ou « Data API ») :
   - copiez « Project URL » dans supabaseUrl
   - copiez la clé « anon public » dans supabaseAnonKey
   (la clé « anon » est faite pour être publique ; ne mettez
   JAMAIS ici la clé « service_role ».)

   Laissés vides, le site fonctionne en « mode local » :
   les données restent dans le navigateur (pour tester).
   ========================================================= */
window.SC_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};
