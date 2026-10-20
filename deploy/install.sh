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

echo "🌐 6. Détection et configuration automatique du serveur Web (Nginx ou Apache)..."
WEB_SERVER_MAPPED="manuel"

# --- Détection & Configuration Automatique NGINX ---
if systemctl is-active --quiet nginx 2>/dev/null || command -v nginx >/dev/null 2>&1; then
  echo "🔍 Nginx détecté sur le système !"
  mkdir -p /etc/nginx/snippets

  cat << 'EOF' > /etc/nginx/snippets/pisentinel.conf
# --- PiSentinel Reverse Proxy (Subpath /sentinel) ---
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
EOF

  for site_conf in /etc/nginx/sites-enabled/*; do
    if [ -f "$site_conf" ]; then
      if grep -q "location /sentinel/" "$site_conf" 2>/dev/null || grep -q "snippets/pisentinel.conf" "$site_conf" 2>/dev/null; then
        echo "ℹ️  PiSentinel est déjà mappé dans $site_conf."
        WEB_SERVER_MAPPED="nginx"
        break
      fi

      cp "$site_conf" "$site_conf.bak.pisentinel"
      if grep -q "server {" "$site_conf"; then
        python3 -c "
with open('$site_conf', 'r') as f:
    content = f.read()
if 'include /etc/nginx/snippets/pisentinel.conf;' not in content:
    idx = content.rfind('}')
    if idx != -1:
        new_content = content[:idx] + '    include /etc/nginx/snippets/pisentinel.conf;\n' + content[idx:]
        with open('$site_conf', 'w') as f:
            f.write(new_content)
" 2>/dev/null || true

        if nginx -t >/dev/null 2>&1; then
          echo "✅ Mapping Nginx /sentinel/ ajouté avec succès dans $site_conf !"
          systemctl reload nginx 2>/dev/null || true
          WEB_SERVER_MAPPED="nginx"
          break
        else
          echo "⚠️ Restauration de $site_conf suite à un avertissement de syntaxe."
          mv "$site_conf.bak.pisentinel" "$site_conf"
        fi
      fi
    fi
  done

# --- Détection & Configuration Automatique APACHE ---
elif systemctl is-active --quiet apache2 2>/dev/null || command -v apache2 >/dev/null 2>&1; then
  echo "🔍 Apache2 détecté sur le système !"
  a2enmod proxy proxy_http proxy_wstunnel rewrite >/dev/null 2>&1 || true

  cat << 'EOF' > /etc/apache2/conf-available/pisentinel.conf
# --- PiSentinel Reverse Proxy (Subpath /sentinel) ---
<IfModule mod_proxy.c>
    ProxyPreserveHost On
    ProxyPass /sentinel/api/ws/ ws://127.0.0.1:8443/api/ws/
    ProxyPassReverse /sentinel/api/ws/ ws://127.0.0.1:8443/api/ws/

    ProxyPass /sentinel http://127.0.0.1:8443
    ProxyPassReverse /sentinel http://127.0.0.1:8443
</IfModule>
EOF

  a2enconf pisentinel >/dev/null 2>&1 || true
  if apache2ctl configtest >/dev/null 2>&1; then
    systemctl reload apache2 2>/dev/null || true
    echo "✅ Mapping Apache /sentinel/ configuré et activé avec succès !"
    WEB_SERVER_MAPPED="apache"
  fi
fi

IP_ADDRESS=$(hostname -I | awk '{print $1}')

echo ""
echo "✅ ====================================================="
echo "✅   Installation terminée avec succès !"
echo "✅ ====================================================="
if [ "$WEB_SERVER_MAPPED" != "manuel" ]; then
  echo "🎉 Le mapping /sentinel/ a été configuré AUTOMATIQUEMENT sur votre serveur ($WEB_SERVER_MAPPED) !"
  echo "🌐 Vous pouvez ouvrir directement : https://mon-domaine.com/sentinel/"
else
  echo "🌐 Accès direct : http://$IP_ADDRESS:8443/sentinel/"
  echo "🌐 Ou via votre domaine : https://mon-domaine.com/sentinel/"
fi
echo "   (Le port 80 reste intact et 100% réservé à votre site actuel)"
echo ""
echo "📝 Pour configurer Google OAuth et la liste blanche d'emails :"
echo "   sudo nano $INSTALL_DIR/backend/.env"
echo "   Puis redémarrez : sudo systemctl restart pisentinel"
echo "====================================================="
