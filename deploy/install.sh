#!/bin/bash
# ==============================================================================
# PiSentinel - Script d'installation automatique pour Raspberry Pi OS / Debian
# ==============================================================================

set -e

echo "🛡️ ====================================================="
echo "🛡️   Installation & Déploiement de PiSentinel SOC RPi"
echo "🛡️ ====================================================="

# Vérification des droits root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Veuillez exécuter ce script avec sudo : sudo ./install.sh"
  exit 1
fi

CURRENT_USER=${SUDO_USER:-pi}
INSTALL_DIR="/var/www/html/sentinel"

echo "📦 1. Mise à jour des paquets & installation des dépendances système..."
apt-get update -y
apt-get install -y python3 python3-pip python3-venv ufw fail2ban lynis curl git

echo "📁 2. Configuration du répertoire d'installation ($INSTALL_DIR)..."
mkdir -p "$INSTALL_DIR"
cp -r ../* "$INSTALL_DIR/" || true
chown -R "$CURRENT_USER:www-data" "$INSTALL_DIR" 2>/dev/null || chown -R "$CURRENT_USER:$CURRENT_USER" "$INSTALL_DIR"

echo "🐍 3. Création de l'environnement virtuel Python..."
sudo -u "$CURRENT_USER" python3 -m venv "$INSTALL_DIR/.venv"
sudo -u "$CURRENT_USER" "$INSTALL_DIR/.venv/bin/pip" install --upgrade pip
sudo -u "$CURRENT_USER" "$INSTALL_DIR/.venv/bin/pip" install -r "$INSTALL_DIR/backend/requirements.txt"

echo "⚙️ 4. Initialisation du fichier de configuration .env..."
if [ ! -f "$INSTALL_DIR/backend/.env" ]; then
  cp "$INSTALL_DIR/backend/.env.example" "$INSTALL_DIR/backend/.env"
  # Générer une clé secrète aléatoire
  RANDOM_SECRET=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 48)
  sed -i "s|SECRET_KEY=.*|SECRET_KEY=$RANDOM_SECRET|g" "$INSTALL_DIR/backend/.env"
  sed -i "s|ROOT_PATH=.*|ROOT_PATH=/sentinel|g" "$INSTALL_DIR/backend/.env" 2>/dev/null || true
  echo "🔑 Nouvelle clé SECRET_KEY générée aléatoirement."
fi

echo "🚀 5. Configuration et activation du service systemd..."
cp "$INSTALL_DIR/deploy/pisentinel.service" /etc/systemd/system/
# Remplacement du nom d'utilisateur dans le service si différent de 'pi'
sed -i "s|User=pi|User=$CURRENT_USER|g" /etc/systemd/system/pisentinel.service

systemctl daemon-reload
systemctl enable pisentinel
systemctl restart pisentinel

IP_ADDRESS=$(hostname -I | awk '{print $1}')

echo ""
echo "✅ ====================================================="
echo "✅   Installation terminée avec succès !"
echo "✅ ====================================================="
echo "🌐 Accès direct : http://$IP_ADDRESS:8443/sentinel/"
echo "🌐 Ou via votre domaine : https://mon-domaine.com/sentinel/"
echo "   (Le port 80 reste intact et 100% réservé à votre site actuel)"
echo "📝 Pour configurer Google OAuth et la liste blanche d'emails :"
echo "   sudo nano $INSTALL_DIR/backend/.env"
echo "   Puis redémarrez : sudo systemctl restart pisentinel"
echo "====================================================="
