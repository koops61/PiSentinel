# 🚀 Guide de Déploiement & Configuration sur Raspberry Pi

Ce guide vous accompagne pas à pas pour déployer **PiSentinel** dans `/var/www/html/sentinel` et le rendre accessible via **`https://mon-domaine.com/sentinel`** derrière votre serveur web existant (Nginx ou Apache).

---

## 1. Déploiement dans `/var/www/html/sentinel`

Connectez-vous en SSH à votre Raspberry Pi, puis :

```bash
# 1. Cloner ou transférer le projet sur votre Raspberry Pi
cd ~
git clone <votre_repo> pisentinel-src
cd pisentinel-src/deploy

# 2. Rendre le script exécutable et lancer l'installation
chmod +x install.sh
sudo ./install.sh
```

Le script installe automatiquement :
- L'application dans **`/var/www/html/sentinel`**
- L'environnement virtuel Python isolé dans `/var/www/html/sentinel/.venv`
- Les paquets de sécurité Linux (`ufw`, `fail2ban`, `lynis`)
- Le service `systemd` `pisentinel.service` configuré pour démarrer sur `127.0.0.1:8443`

---

## 2. Configuration du Reverse Proxy (Nginx ou Apache)

Pour que PiSentinel soit accessible sur **`https://mon-domaine.com/sentinel`** sans toucher à votre site existant sur la racine :

### Cas A : Si vous utilisez NGINX (Recommandé)

Ouvrez la configuration de votre site dans `/etc/nginx/sites-available/` (ou votre fichier de configuration SSL) :

```bash
sudo nano /etc/nginx/sites-available/default
```

À l'intérieur du bloc `server { ... }` (qui gère le port 443 / SSL), ajoutez ce bloc `location /sentinel` :

```nginx
    # --- PiSentinel Hub (Subpath /sentinel) ---
    location /sentinel/ {
        proxy_pass http://127.0.0.1:8443/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

Testez et rechargez Nginx :
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### Cas B : Si vous utilisez APACHE

Activez les modules proxy et proxy_wstunnel :
```bash
sudo a2enmod proxy proxy_http proxy_wstunnel
```

Dans la configuration de votre VirtualHost SSL (`/etc/apache2/sites-available/000-default-le-ssl.conf` ou votre fichier vhost) :

```apache
    # --- WebSocket Stream PiSentinel ---
    ProxyPass /sentinel/api/ws/ ws://127.0.0.1:8443/api/ws/
    ProxyPassReverse /sentinel/api/ws/ ws://127.0.0.1:8443/api/ws/

    # --- Application PiSentinel ---
    ProxyPass /sentinel http://127.0.0.1:8443
    ProxyPassReverse /sentinel http://127.0.0.1:8443
    ProxyPreserveHost On
```

Rechargez Apache :
```bash
sudo systemctl restart apache2
```

---

## 3. Configuration de Google OAuth 2.0 (Google Sign-In)

1. Rendez-vous sur la **[Google Cloud Console](https://console.cloud.google.com/)**.
2. Allez dans **APIs & Services** > **OAuth consent screen** et créez un écran externe `PiSentinel`.
3. Allez dans **Credentials** > **Create Credentials** > **OAuth client ID** :
   - Type d'application : **Web application**.
   - **Authorized JavaScript origins (Origines JavaScript autorisées)** :
     - `https://mon-domaine.com`
     - `http://localhost:8443` (pour les tests locaux)
4. Copiez votre **Client ID**.

---

## 4. Configuration de la Liste Blanche (Whitelist)

Éditez le fichier `.env` dans `/var/www/html/sentinel/backend/.env` :

```bash
sudo nano /var/www/html/sentinel/backend/.env
```

Renseignez vos paramètres :

```ini
# Google OAuth
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com

# Adresses email Google autorisées à administrer le Raspberry Pi
ALLOWED_EMAILS=votre.email@gmail.com,autre.admin@gmail.com

# Mot de passe de secours administrateur local
ADMIN_USERNAME=admin
ADMIN_PASSWORD=VotreMotDePasseTresSecurise2026!

# Port interne dédié (le port 80 reste pour votre site actuel)
HOST=127.0.0.1
PORT=8443
ROOT_PATH=/sentinel
```

Redémarrez le service :

```bash
sudo systemctl restart pisentinel
```

---

## 5. Accès au Tableau de Bord

Rendez-vous simplement sur :

👉 **`https://mon-domaine.com/sentinel/`**

Le tableau de bord, les flux WebSockets temps réel, l'audit des ports et l'authentification Google sont immédiatement opérationnels !
