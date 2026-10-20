# 🛡️ PiSentinel — All-in-One Raspberry Pi SOC & Security Hub

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Modern%20API-009688.svg)](https://fastapi.tiangolo.com/)
[![Vite](https://img.shields.io/badge/Frontend-Vite%20%2B%20CyberSOC-646CFF.svg)](https://vitejs.dev/)
[![Security](https://img.shields.io/badge/Auth-Google%20OAuth%20%2B%20Whitelist-00f2fe.svg)](#authentification-google--sécurité)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**PiSentinel** est une plateforme tout-en-un moderne, ultra-rapide et sécurisée conçue pour transformer votre **Raspberry Pi** en un véritable centre d'opérations de sécurité (**SOC - Security Operations Center**).

Accessible depuis une interface web de style Cyberpunk / Glassmorphism, elle vous permet de surveiller en temps réel les intrusions, d'auditer vos ports ouverts, de contrôler vos démons de sécurité (Fail2ban, UFW, Lynis...) et de verrouiller votre système avec une authentification **Google OAuth + Whitelist stricte**.

---

## ⚡ Fonctionnalités Clés

### 1. 📡 Visualiseur d'Attaques en Temps Réel & Carte Radar
- **Radar Cyber & Carte Géographique** des menaces détectées avec géolocalisation IP (pays, ville, coordonnées).
- **Stream WebSockets bidirectionnel** analysant en direct les journaux `/var/log/auth.log`, `journalctl` et `fail2ban.log`.
- Détection des **attaques par force brute SSH**, scans de ports et sondes de vulnérabilités web.
- **Bouton de Blocage Immédiat en 1 Clic** (`UFW insert deny from <IP>`).
- Bouton de **Simulation d'Attaque** pour tester immédiatement vos alertes et défenses.
- Synthétiseur audio Web Audio API pour les alertes tactiques (chimes d'alerte, son de bannissement).

### 2. 🔍 Audit & Scanner des Ports Ouverts
- Cartographie instantanée de tous les ports réseau en écoute sur votre Raspberry Pi (sockets TCP/UDP).
- Détection de l'adresse de liaison : distinction entre écoute locale sécurisée (`127.0.0.1`) et exposition externe dangereuse (`0.0.0.0`).
- **Évaluation automatique du niveau de risque** :
  - 🔴 **Critique** : Telnet (23), FTP en clair (21), SMB (445), Redis sans mot de passe (6379), etc.
  - 🟠 **Élevé** : Base de données MySQL/Postgres exposée publiquement, HTTP non chiffré (80), VNC (5900).
  - 🟣 **Moyen / Audit** : SSH sur port par défaut (22), services applicatifs non durcis.
  - 🟢 **Sécurisé** : HTTPS (443), WireGuard VPN (51820), boucles locales.
- **Calculateur d'Indice de Sécurité** (score de 0 à 100%).
- Générateur de **règles de durcissement pare-feu UFW** prêtes à copier-coller.

### 3. 🛠️ Gestionnaire des Outils de Sécurité Linux
- Détection de l'état d'installation et d'activité des meilleurs outils de protection pour Raspberry Pi :
  - **UFW** (Uncomplicated Firewall)
  - **Fail2ban** (Protection anti-brute force et bannissement automatique)
  - **Lynis** (Auditeur de durcissement système)
  - **ClamAV** (Antivirus temps réel)
  - **Rootkit Hunter (rkhunter)** (Détecteur de portes dérobées et rootkits)
  - **WireGuard** (VPN chiffré de pointe)
  - **iptables** (Filtrage noyau avancé)
- Contrôle des services en 1 clic : **Démarrer, Arrêter, Redémarrer**.
- Installation en 1 clic (`sudo apt-get install`) pour les outils manquants.

### 4. 📊 Télémétrie Matérielle & Santé du Raspberry Pi
- **Température du SoC (RPi)** en direct avec alerte thermique si surchauffe.
- Utilisation du processeur (CPU) par cœur.
- Consommation mémoire vive (RAM) et espace disque de la carte SD / NVMe.
- Débit réseau en temps réel (RX / TX, paquets transmis).
- Modèle de Raspberry Pi détecté, version du noyau Linux et Uptime.

### 5. 🔐 Authentification Google & Sécurité Renforcée
- **Connexion Google Sign-In (OAuth 2.0)** vérifiant l'identité via les serveurs d'authentification Google.
- **Liste Blanche stricte (Whitelist)** : seules les adresses emails autorisées dans la configuration peuvent déverrouiller la plateforme.
- **Mot de passe administrateur local de secours** : permet l'accès même en cas de coupure Internet ou d'indisponibilité de Google.
- **Sessions chiffrées par JWT** transmises via cookies sécurisés `HttpOnly` et en-têtes Bearer.
- Headers de sécurité stricts (CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff).

---

## 🏗️ Architecture du Projet

```
raspberry-allin1/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py             # Gestion Pydantic des variables .env & Whitelist
│   │   │   ├── security.py           # Tokens JWT, hachage bcrypt, vérification Google ID
│   │   │   └── auth.py               # Dépendances de routes protégées FastAPI
│   │   ├── routers/
│   │   │   ├── auth.py               # Endpoints Google OAuth & login admin
│   │   │   ├── system.py             # Télémétrie hardware & score de santé global
│   │   │   ├── ports.py              # Analyse et audit des ports ouverts
│   │   │   ├── security_tools.py     # Contrôle et installation des outils Linux
│   │   │   ├── attacks.py            # Flux des attaques, bannissement & déblocage IP
│   │   │   └── ws.py                 # WebSocket pour flux d'attaques et métriques temps réel
│   │   ├── services/
│   │   │   ├── port_scanner.py       # Scanner de sockets & matrice des vulnérabilités
│   │   │   ├── tool_manager.py       # Gestionnaire système systemctl / apt
│   │   │   ├── attack_monitor.py     # Tail des logs auth.log/fail2ban + moteur de simulation
│   │   │   └── geoip.py              # Résolution géographique des adresses IP
│   │   └── main.py                   # Serveur FastAPI + hébergement SPA statique
│   ├── requirements.txt
│   ├── .env.example
│   └── .env
├── frontend/
│   ├── index.html                    # Point d'entrée HTML5
│   ├── package.json
│   ├── vite.config.js
│   ├── dist/                         # Bundle de production compilé (prêt à servir)
│   └── src/
│       ├── main.js                   # Contrôleur d'état, WebSockets et rendu des vues
│       ├── style.css                 # Système de design Cyber-SOC Glassmorphism
│       └── utils/
│           ├── api.js                # Client API fetch authentifié
│           └── sound.js              # Synthétiseur audio Web Audio API
├── deploy/
│   ├── install.sh                    # Script d'installation 1 clic pour Raspberry Pi OS
│   ├── pisentinel.service            # Service systemd pour démarrage automatique
│   └── README.md                     # Guide pas à pas Google OAuth
└── README.md
```

---

## 🚀 Démarrage Rapide

### Option A : Déploiement automatique sur Raspberry Pi
Consultez le guide détaillé : [`deploy/README.md`](file:///e:/IA-KANIS/outil-web/raspberry-allin1/deploy/README.md).

```bash
cd deploy
chmod +x install.sh
sudo ./install.sh
```

### Option B : Lancement en local (Développement)

#### 1. Lancer le Backend Python (FastAPI)
```bash
# Activer l'environnement virtuel
# Sur Linux / Raspberry Pi :
source .venv/bin/activate
# Sur Windows :
.\.venv\Scripts\activate

# Démarrer le serveur
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Le backend démarre sur `http://localhost:8000`.

#### 2. Lancer le Frontend (Mode Dev avec rechargement à chaud)
```bash
cd frontend
npm run dev
```

Ouvrez `http://localhost:5173`. L'API et les WebSockets sont automatiquement relayés vers le backend FastAPI.

---

## 🔑 Identifiants par Défaut (Mode Local)

- **Identifiant :** `admin`
- **Mot de passe :** `admin` (ou la valeur configurée dans `backend/.env`)

---

## 🛡️ Configuration de la Liste Blanche Google OAuth

Dans `backend/.env` :

```ini
GOOGLE_CLIENT_ID=votre-id-google.apps.googleusercontent.com
ALLOWED_EMAILS=mon.email@gmail.com,admin2@gmail.com
```

Lorsque cette option est configurée, seuls les comptes Google présents dans `ALLOWED_EMAILS` peuvent se connecter. Tout autre compte est immédiatement bloqué avec une erreur HTTP 403.
