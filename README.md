# 🛡️ PiSentinel — All-in-One Raspberry Pi SOC & Security Hub

[![Release](https://img.shields.io/badge/Release-v1.0.0-00f2fe.svg)](https://github.com/koops61/PiSentinel/releases)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Modern%20API-009688.svg)](https://fastapi.tiangolo.com/)
[![Vite](https://img.shields.io/badge/Frontend-Vite%20%2B%20CyberSOC-646CFF.svg)](https://vitejs.dev/)
[![Security](https://img.shields.io/badge/Auth-Google%20OAuth%20%2B%20Whitelist-00f2fe.svg)](#-authentification-google--whitelist)
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
- Bouton de **Simulation d'Attaque** pour tester immédiatement vos alertes et notifications tactiques sonores.
- Synthétiseur audio Web Audio API pour les alertes tactiques (chimes d'alerte, son de bannissement).

### 2. 🔍 Audit & Scanner des Ports Ouverts
- Cartographie instantanée de tous les ports réseau en écoute sur votre Raspberry Pi (sockets TCP/UDP).
- Détection de l'adresse de liaison : distinction entre écoute locale sécurisée (`127.0.0.1`) et exposition externe (`0.0.0.0`).
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

## 🌐 Cohabitation avec un Site Web Existant

Si vous avez déjà un site actif sur votre Raspberry Pi (ex: WordPress, Nextcloud, site vitrine) :
- **Le port 80 et le port 443 restent 100% réservés à votre site actuel.**
- PiSentinel tourne sur un port interne dédié **`8443`** (`127.0.0.1:8443`), invisible depuis l'extérieur.
- L'installation s'effectue dans **`/var/www/html/sentinel`**.
- Le script configure **automatiquement** votre serveur web (Nginx ou Apache) pour relayer les requêtes vers `https://mon-domaine.com/sentinel/`.

---

## 🚀 Installation & Déploiement

### Déploiement Automatique en 1 Commande (Raspberry Pi OS / Debian)

Connectez-vous en SSH à votre Raspberry Pi, puis exécutez :

```bash
# 1. Cloner le projet dans /var/www/html/sentinel
sudo git clone https://github.com/koops61/PiSentinel.git /var/www/html/sentinel

# 2. Se rendre dans le dossier de déploiement et lancer l'installateur
cd /var/www/html/sentinel/deploy
chmod +x install.sh
sudo ./install.sh
```

### 🤖 Ce que fait le script automatiquement :
1. Installe les paquets de sécurité requis (`ufw`, `fail2ban`, `lynis`, `python3-venv`).
2. Crée l'environnement virtuel Python isolé dans `/var/www/html/sentinel/.venv`.
3. Génère une clé secrète aléatoire `SECRET_KEY` pour les tokens JWT.
4. Active et démarre le démon `pisentinel.service` au démarrage de la machine.
5. **Détecte automatiquement votre serveur web (Nginx ou Apache) :**
   - **Sous Nginx :** Crée `/etc/nginx/snippets/pisentinel.conf`, injecte la redirection vers `127.0.0.1:8443` avec support WebSockets, valide la syntaxe et recharge Nginx.
   - **Sous Apache :** Active les modules proxy (`mod_proxy`, `mod_proxy_wstunnel`), active la configuration `pisentinel.conf` et recharge Apache.

---

## 🔐 Configuration Google OAuth & Whitelist

Pour sécuriser l'accès avec votre compte Google :

1. Rendez-vous sur la **[Google Cloud Console](https://console.cloud.google.com/)**.
2. Créez des identifiants **OAuth 2.0 Client ID** (Type : *Application Web*).
3. Dans **"Origines JavaScript autorisées"**, ajoutez :
   - `https://mon-domaine.com`
4. Éditez le fichier `.env` sur votre Raspberry Pi :

```bash
sudo nano /var/www/html/sentinel/backend/.env
```

5. Renseignez votre Client ID et votre email administrateur :

```ini
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
ALLOWED_EMAILS=votre.email@gmail.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=VotreMotDePasseAdminDeSecours!
HOST=127.0.0.1
PORT=8443
ROOT_PATH=/sentinel
```

6. Redémarrez le service :

```bash
sudo systemctl restart pisentinel
```

---

## 💻 Accès au Tableau de Bord

Une fois l'installation terminée, ouvrez votre navigateur :

👉 **`https://mon-domaine.com/sentinel/`**

*(Ou en accès direct local sur votre réseau : `http://<IP_DU_RASPBERRY>:8443/sentinel/`)*

---

## 🛠️ Commandes Utiles (Systemd)

| Action | Commande |
| :--- | :--- |
| **Vérifier l'état du service** | `sudo systemctl status pisentinel` |
| **Redémarrer le hub** | `sudo systemctl restart pisentinel` |
| **Arrêter le hub** | `sudo systemctl stop pisentinel` |
| **Consulter les journaux en direct** | `sudo journalctl -u pisentinel -f` |

---

## 💻 Développement Local (Sur PC Windows / Mac / Linux)

```bash
# 1. Démarrer le Backend Python
python -m venv .venv
source .venv/bin/activate  # Sur Windows: .\.venv\Scripts\activate
pip install -r backend/requirements.txt
cd backend && python -m uvicorn app.main:app --port 8443 --reload

# 2. Démarrer le Frontend Vite
cd frontend && npm install && npm run dev
```

---

## 📄 Licence

Ce projet est sous licence MIT. Libre d'utilisation et de modification pour sécuriser vos Raspberry Pi !
