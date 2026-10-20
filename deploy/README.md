# 🚀 Guide de Déploiement & Configuration Google OAuth sur Raspberry Pi

Ce guide vous accompagne pas à pas pour déployer **PiSentinel** sur votre Raspberry Pi et configurer l'authentification sécurisée avec Google Sign-In et la liste blanche d'administrateurs.

---

## 1. Déploiement en 1 ligne sur votre Raspberry Pi

Connectez-vous en SSH à votre Raspberry Pi, puis :

```bash
# 1. Cloner ou transférer le projet sur votre Raspberry Pi
cd ~
git clone <votre_repo> pisentinel
cd pisentinel/deploy

# 2. Rendre le script exécutable et lancer l'installation
chmod +x install.sh
sudo ./install.sh
```

Le script configure automatiquement :
- L'environnement virtuel Python (`.venv`)
- Les paquets de sécurité Linux (`ufw`, `fail2ban`, `lynis`)
- Le service `systemd` `pisentinel.service` démarrant automatiquement au boot du Raspberry Pi.

---

## 2. Configuration de Google OAuth 2.0 (Google Sign-In)

Pour sécuriser l'accès avec votre compte Google :

1. Rendez-vous sur la **[Google Cloud Console](https://console.cloud.google.com/)**.
2. Créez un nouveau projet (ex: `Raspberry Pi Security`).
3. Allez dans **APIs & Services** > **OAuth consent screen (Écran de consentement OAuth)** :
   - Type d'utilisateur : **Externe** (ou Interne si Google Workspace).
   - Remplissez le nom de l'application : `PiSentinel`.
   - Ajoutez votre adresse email comme contact développeur et enregistrez.
4. Allez dans **Credentials (Identifiants)** > **Create Credentials** > **OAuth client ID** :
   - Type d'application : **Web application (Application Web)**.
   - Nom : `PiSentinel Web Client`.
   - **Origines JavaScript autorisées (Authorized JavaScript origins)** :
     - `http://localhost:8000`
     - `http://<IP_DE_VOTRE_RASPBERRY>:8000` (ex: `http://192.168.1.50:8000`)
5. Cliquez sur **Créer** et copiez votre **Client ID** (se terminant par `.apps.googleusercontent.com`).

---

## 3. Configuration de la Liste Blanche (Whitelist)

Ouvrez le fichier de configuration `.env` sur le Raspberry Pi :

```bash
sudo nano /opt/pisentinel/backend/.env
```

Modifiez les lignes suivantes :

```ini
# Votre Client ID Google
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com

# Adresses email Google autorisées à administrer le Raspberry Pi
# (Seules les adresses listées ici pourront franchir l'authentification)
ALLOWED_EMAILS=votre.email@gmail.com,autre.admin@gmail.com

# Mot de passe de secours administrateur (si hors-ligne ou panne Google)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=VotreMotDePasseTresSecurise2026!
```

Redémarrez le service pour appliquer les changements :

```bash
sudo systemctl restart pisentinel
```

---

## 4. Gestion du Service Systemd

| Action | Commande |
| :--- | :--- |
| **Vérifier le statut** | `sudo systemctl status pisentinel` |
| **Redémarrer** | `sudo systemctl restart pisentinel` |
| **Arrêter** | `sudo systemctl stop pisentinel` |
| **Consulter les logs en direct** | `sudo journalctl -u pisentinel -f` |

---

## 5. Accès au Tableau de Bord

Ouvrez votre navigateur web sur votre ordinateur, tablette ou smartphone connecté au même réseau :

👉 **`http://<IP_DE_VOTRE_RASPBERRY>:8000`**
