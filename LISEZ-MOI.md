# S&C Watches — Site + CRM

## Accéder au CRM

Le CRM est la page **`admin/`** du site :

- **sur votre ordinateur** (test) : ouvrez `admin/index.html` dans votre navigateur ;
- **une fois le site en ligne** : `https://votre-site.fr/admin/`

Le lien n'apparaît volontairement pas dans le menu du site : gardez-le en favori.

---

## Mettre la base de données en ligne (≈ 15 minutes, gratuit)

Sans cette étape, le site tourne en **mode local** : les commandes restent dans le navigateur qui les a passées.
Avec elle, toutes les commandes, messages et clients arrivent dans votre CRM, depuis n'importe quel appareil.

### 1. Créer le projet Supabase
1. Allez sur **supabase.com** → *Start your project* → créez un compte.
2. *New project* : nom `sc-watches`, choisissez un mot de passe de base de données (notez-le), région **Europe (Paris ou Frankfurt)**.
3. Attendez 1 à 2 minutes que le projet soit prêt.

### 2. Créer votre compte administrateur
1. Menu **Authentication → Users → Add user → Create new user**.
2. Entrez **votre e-mail** et un **mot de passe solide**, cochez *Auto Confirm User*.
   👉 C'est avec cet e-mail et ce mot de passe que vous vous connecterez au CRM.
3. Menu **Authentication → Sign In / Providers** (ou *Settings*) : **désactivez « Allow new users to sign up »**, pour que personne d'autre ne puisse créer de compte.

### 3. Créer les tables
1. Ouvrez le fichier `supabase/schema.sql` de ce dossier avec le Bloc-notes.
2. **Tout en bas**, remplacez `VOTRE-EMAIL@exemple.com` par l'e-mail de l'étape 2.
3. Dans Supabase : **SQL Editor → New query**, collez tout le fichier, cliquez **Run**.
   Le message « Success. No rows returned » signifie que c'est bon.

### 4. Relier le site à la base
1. Dans Supabase : **Project Settings → API** (ou *Data API*).
2. Ouvrez `assets/js/config.js` avec le Bloc-notes et collez :
   - **Project URL** entre les guillemets de `supabaseUrl`
   - la clé **anon / public** entre les guillemets de `supabaseAnonKey`
   ⚠️ Ne collez jamais la clé `service_role`.
3. Enregistrez. Ouvrez `admin/index.html` : l'écran demande maintenant **e-mail + mot de passe**, et le bas du menu indique « ● Base en ligne ».

### 5. Mettre le site en ligne
Le site est fait de fichiers simples (HTML/CSS/JS) : n'importe quel hébergeur convient.
Le plus simple : **app.netlify.com/drop** → glissez-déposez le dossier `Site internet` entier → votre site est en ligne.
Vous pourrez ensuite y brancher votre nom de domaine (Netlify → *Domain settings*).

> Si vous aviez testé en mode local : avant l'étape 4, faites CRM → Paramètres → **Télécharger une sauvegarde**, puis après l'étape 4, **Restaurer une sauvegarde** pour tout transférer en ligne.

---

## Ce que fait le CRM

- **Tableau de bord** : chiffre d'affaires 30 jours, commandes à expédier, panier moyen, ventes par modèle, stock faible, messages non lus, activité.
- **Commandes** : recherche, filtres, statut (en attente → payée → en préparation → expédiée → livrée / annulée), transporteur et n° de suivi visibles par le client sur la page Suivi, notes, export CSV. Une annulation remet automatiquement la montre en stock.
- **Clients** : fiche créée automatiquement à chaque commande ou message, total dépensé, étiquettes (VIP…), notes, export CSV.
- **Messages** : formulaire de contact, réponse par e-mail en un clic.
- **Produits** : prix, stock, textes, photo, mise en ligne/masquage — visible immédiatement sur le site.
- **Paramètres** : frais de livraison, liens de paiement Stripe, mot de passe, sauvegarde.

Le CRM se met à jour tout seul toutes les 2 minutes et à chaque retour sur l'onglet (bouton « Actualiser » sinon).

## Paiement (Stripe)
Créez un **lien de paiement** Stripe par montre et collez-le dans CRM → Paramètres.
Le client est redirigé vers ce lien après le formulaire ; le n° de commande est transmis à Stripe (« client_reference_id »).
Quand Stripe vous notifie le paiement, passez la commande en « Payée » dans le CRM.

## Sécurité
- Les prix et le stock sont vérifiés **sur le serveur** : un client ne peut pas modifier le prix de sa commande.
- Les visiteurs ne peuvent lire que le catalogue. Commandes, clients et messages ne sont lisibles que par les e-mails inscrits dans la table `admins`.
- Pour ajouter un associé : créez-lui un utilisateur (étape 2), puis dans *SQL Editor* :
  `insert into admins(email) values ('son-email@exemple.fr');`

## Fichiers
| Fichier | Rôle |
|---|---|
| `index.html`, `collection.html`, `montre.html`, `histoire.html`, `commander.html`, `suivi.html`, `contact.html` | Pages du site |
| `admin/` | CRM |
| `assets/js/config.js` | **Les 2 clés Supabase à renseigner** |
| `assets/js/store.js` | Lecture/écriture des données (en ligne ou local) |
| `supabase/schema.sql` | Création de la base (à exécuter une fois) |
| `assets/img/` | Photos |
