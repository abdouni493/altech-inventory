# Altech Inventory — Gestion de stock & affectations (organismes publics), 100 % hors ligne

**Version démo.** Application de gestion du magasin d'un organisme public : stock, achats, fournisseurs,
**départements**, **affectations** du matériel aux départements, employés, dépenses, **budget** et rapports,
en **React 18 + TypeScript + Vite**. Elle fonctionne **sans internet** : toutes les données sont enregistrées sur le PC,
dans le dossier `data\` (ou dans le navigateur — IndexedDB — si l'application est hébergée sans le serveur local).
Interface bilingue **Français / Arabe (RTL)**, utilisable sur PC et sur mobile.

## Version démo

- L'écran de connexion propose **« Connexion avec le compte démo »** : un clic ouvre l'application avec un jeu
  de données de test complet (produits, achats, fournisseurs, départements, affectations, employés, dépenses, budget).
- Identifiants démo : **demo@altech.dz** / **demo1234** (ou le nom d'utilisateur `demo`).
- Une base vide est remplie automatiquement avec les données de démonstration au premier lancement.
- **Paramètres → Base de données → Recharger les données de démonstration** remet le jeu de test à zéro.

## Modules

| Module | Rôle |
|---|---|
| Tableau de bord | affectations du mois, valeur du stock, départements servis, flux mensuels, alertes |
| Affectations | sortie de matériel vers un département — recherche produit, saisie / douchette ou **scan du code-barres au téléphone**, historique complet, détails (avec chronologie et impression du bon), modification, suppression |
| Gestion de stock | produits + bouton **Historique** de chaque produit (achats reçus et affectations) |
| Achats / Fournisseurs | entrées en stock, paiements et dettes fournisseurs |
| Départements | nom, description et informations optionnelles (code, responsable, téléphone, email, emplacement) — détails, modification, suppression |
| Budget | dotations, retraits, achats payés, dépenses, salaires, consommation du budget, analyse par catégorie et par département |
| Rapports | budget, départements, articles les plus affectés / stock dormant, catégories, affectations, achats, dépenses, salaires, situation du stock |

## Installation sur un PC client (Windows)

Prérequis : **Node.js LTS** (https://nodejs.org), à installer une seule fois.

1. Copiez tout le dossier de l'application sur le PC (par ex. `C:\AltechPOS`).
2. Double-cliquez sur **`create-desktop-shortcut.bat`** :
   - installe les dépendances et prépare l'application (première fois : quelques minutes) ;
   - crée le raccourci **« Altech Inventory »** sur le bureau et dans le menu Démarrer, avec l'icône Altech Inventory.
3. Double-cliquez sur **Altech Inventory** sur le bureau : le serveur local démarre en arrière-plan et
   l'application s'ouvre dans **sa propre fenêtre, sans cadre de navigateur** (Edge ou Chrome en mode
   application ; à défaut, le navigateur par défaut).

| Fichier | Rôle |
|---|---|
| `create-desktop-shortcut.bat` | installation + raccourci bureau / menu Démarrer |
| `run-app.bat` | lance l'application avec la fenêtre du serveur visible (journal, dépannage). Fermer cette fenêtre arrête le serveur |
| `stop-app.bat` | arrête le serveur lancé par le raccourci (avant une mise à jour ou un déplacement du dossier) |

Après une mise à jour du code, le raccourci reconstruit l'application automatiquement au lancement suivant.

## Premier lancement

L'écran de connexion propose **« Créer un compte Admin »** tant qu'aucun administrateur n'existe.
Dès que le compte est créé, ce bouton **disparaît définitivement**. L'administrateur se connecte
ensuite avec son email **ou** son nom d'utilisateur. Les comptes des employés se créent dans
**Employés** (case « Compte de connexion ») et utilisent les permissions de la fiche employé.

Les mots de passe ne sont jamais stockés : seule une empreinte salée (SHA-256 itéré) est enregistrée.

## Données — base locale

| Élément | Emplacement |
|---|---|
| Base de données | `data\altech-pos.json` + journal `data\journal.jsonl` (chaque opération est écrite sur disque immédiatement) |
| Sauvegardes automatiques | `data\backups\` — une copie par jour, 30 jours conservés, + une copie avant chaque restauration |
| Journal du serveur | `data\server.log`, `data\server-error.log` |

- **Sauvegarde / restauration manuelle** : Paramètres → Base de données (fichier JSON). Les sauvegardes
  de l'ancienne version en ligne sont acceptées (les comptes actuels sont alors conservés).
- **Changer de PC** : faites une sauvegarde, installez l'application sur le nouveau PC, restaurez.
- Autre dossier de données : variable d'environnement `ALTECH_DATA_DIR`. Autre port : `PORT` (5175 par défaut).
- Si l'application est ouverte sans le serveur local (simple hébergement statique), les données sont
  gardées dans le navigateur (IndexedDB).
- La base n'est accessible que depuis ce PC. Pour partager la même base entre plusieurs caisses du
  réseau local, démarrez le serveur avec `ALTECH_LAN_DB=1` et ouvrez `http://<IP-du-PC>:5175` sur les autres postes.

## Scanner avec le téléphone

Dans **Affectations → Nouvelle affectation**, le bouton **« Scanner avec mon téléphone »** affiche un QR code.
Le téléphone (sur le même Wi-Fi) l'ouvre et chaque code-barres filmé est ajouté à l'affectation, relayé par le
serveur local. La caméra de l'appareil lui-même et les douchettes USB fonctionnent aussi.

## Développement

```bash
npm install
npm run dev        # http://localhost:5175 — même base de données data\ que le serveur hors ligne
npm run build      # build de production (dist\)
npm start          # serveur hors ligne : sert dist\ + la base locale
npm run typecheck
```

Icône : `public\altech-pos.svg` ; le fichier `.ico` du raccourci se régénère avec
`.venv\Scripts\python.exe scripts\make-icon.py`.

## Structure

```
server/            serveur hors ligne (Node, sans dépendance) : base locale, API, relais du scanner
scripts/           lanceur du raccourci, préparation (install/build), création du raccourci, icône
src/lib/           database (chargement + sauvegarde automatique des stores), password, scanSession
src/store/         stores Zustand (produits, ventes, achats, comptes…)
src/pages/         un écran par module + /scan (page du téléphone)
src/components/    layout (barre d'icônes, menu, en-tête, raccourcis) + ui + shared
src/utils/         calculs, vente en détail (retail.ts), export / import
```
