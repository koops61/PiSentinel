import { api, authStorage, getBasePath } from './utils/api.js';
import { sounds } from './utils/sound.js';

// Application State
const state = {
  user: null,
  authConfig: null,
  activeTab: 'radar', // 'radar' | 'ports' | 'tools' | 'system'
  telemetry: null,
  summary: null,
  ports: [],
  portScore: 100,
  riskBreakdown: {},
  tools: [],
  attacks: [],
  bannedIps: [],
  wsConnected: false,
  soundEnabled: sounds.enabled,
  ws: null
};

// Elements
const app = document.getElementById('app');

// Toast helper
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="pulse-dot ${type === 'error' ? 'danger' : (type === 'success' ? '' : 'warning')}"></span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Convert ISO time to readable relative time
function formatTime(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return 'Récemment';
  }
}

// Convert Country Code to Flag Emoji
function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// ==========================================================================
// Initialization & Authentication
// ==========================================================================

async function init() {
  renderLoading();

  try {
    state.authConfig = await api.auth.getConfig();
  } catch (err) {
    console.warn('Failed to load auth config:', err);
  }

  const token = authStorage.getToken();
  if (token) {
    try {
      const meData = await api.auth.getMe();
      state.user = meData.user;
      await loadInitialData();
      connectWebSocket();
      renderApp();
      return;
    } catch (e) {
      authStorage.removeToken();
    }
  }

  // Not authenticated: Show Login
  renderLogin();
}

window.addEventListener('pisentinel:unauthorized', () => {
  state.user = null;
  if (state.ws) {
    state.ws.close();
    state.ws = null;
  }
  renderLogin();
});

// Load all dashboard datasets
async function loadInitialData() {
  try {
    const [summary, portsData, toolsData, attacksData, bannedData] = await Promise.all([
      api.system.getSummary().catch(() => null),
      api.ports.getPorts().catch(() => ({ ports: [], score: 100, risk_breakdown: {} })),
      api.tools.getTools().catch(() => []),
      api.attacks.getAttacks().catch(() => ({ recent_attacks: [] })),
      api.attacks.getBanned().catch(() => ({ banned: [] }))
    ]);

    state.summary = summary;
    state.ports = portsData.ports || [];
    state.portScore = portsData.score || 100;
    state.riskBreakdown = portsData.risk_breakdown || {};
    state.tools = toolsData || [];
    state.attacks = attacksData.recent_attacks || [];
    state.bannedIps = bannedData.banned || [];
  } catch (err) {
    console.error('Error loading initial data:', err);
  }
}

// WebSocket Connection
function connectWebSocket() {
  const token = authStorage.getToken();
  if (!token) return;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const basePath = getBasePath();
  const wsUrl = `${protocol}//${window.location.host}${basePath}/api/ws/telemetry?token=${encodeURIComponent(token)}`;

  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    state.wsConnected = true;
    updateHeaderTelemetryPill();
  };

  state.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'telemetry') {
        state.telemetry = msg.data;
        updateTelemetryViews();
      } else if (msg.type === 'attack_event') {
        handleIncomingAttack(msg.data);
      }
    } catch (e) {
      console.error('WS parse error:', e);
    }
  };

  state.ws.onclose = () => {
    state.wsConnected = false;
    updateHeaderTelemetryPill();
    // Reconnect after 4s if still authenticated
    if (state.user) {
      setTimeout(connectWebSocket, 4000);
    }
  };
}

function handleIncomingAttack(attack) {
  state.attacks.unshift(attack);
  if (state.attacks.length > 50) state.attacks.pop();

  sounds.playAttackAlert();
  showToast(`Alerte Attaque: ${attack.type} depuis ${attack.ip} (${attack.geo?.country || 'Inconnu'})`, 'error');

  // Update dynamic parts of the DOM if currently on radar tab
  if (state.activeTab === 'radar') {
    renderRadarThreats();
    renderAttackFeed();
  }
}

// ==========================================================================
// Views Rendering
// ==========================================================================

function renderLoading() {
  app.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; gap:1.5rem;">
      <div class="brand-logo" style="width:64px; height:64px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <div style="font-family:var(--font-cyber); font-size:1.5rem; letter-spacing:2px; text-transform:uppercase; color:var(--cyan-neon);">
        Initialisation de PiSentinel...
      </div>
    </div>
  `;
}

// Login Modal View
function renderLogin() {
  app.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:center; min-height:100vh; padding:1.5rem;">
      <div class="modal-content" style="max-width:480px; width:100%;">
        <div style="text-align:center; margin-bottom:1.75rem;">
          <div class="brand-logo" style="width:58px; height:58px; margin:0 auto 1rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h2 style="font-family:var(--font-cyber); font-size:1.8rem; letter-spacing:1px; text-transform:uppercase; color:var(--text-main);">
            PiSentinel SOC
          </h2>
          <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.35rem;">
            Centre de Contrôle & Sécurité Raspberry Pi
          </p>
        </div>

        ${state.authConfig?.google_enabled ? `
          <div style="margin-bottom:1.25rem;">
            <div id="googleBtn" style="display:flex; justify-content:center;"></div>
            ${state.authConfig?.whitelist_enabled ? `
              <p style="font-size:0.75rem; color:var(--emerald); text-align:center; margin-top:0.6rem; font-family:var(--font-mono);">
                🛡️ Accès restreint par liste blanche Google (${state.authConfig.allowed_email_count} comptes autorisés)
              </p>
            ` : ''}
          </div>
          <div class="divider">ou connexion administrateur local</div>
        ` : `
          <div style="background:rgba(0,242,254,0.06); border:1px solid var(--panel-border); border-radius:var(--radius-sm); padding:0.85rem; margin-bottom:1.25rem; font-size:0.8rem; color:var(--text-muted);">
            💡 <strong>Google OAuth :</strong> Pour activer la connexion Google, configurez <code>GOOGLE_CLIENT_ID</code> et <code>ALLOWED_EMAILS</code> dans le fichier <code>backend/.env</code>.
          </div>
        `}

        <form id="localLoginForm">
          <div class="form-group">
            <label class="form-label">Identifiant Administrateur</label>
            <input type="text" id="loginUsername" class="form-input" value="admin" required autocomplete="username" />
          </div>
          <div class="form-group">
            <label class="form-label">Mot de passe de secours</label>
            <input type="password" id="loginPassword" class="form-input" placeholder="••••••••••••" required autocomplete="current-password" />
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center; padding:0.8rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Déverrouiller le Hub
          </button>
        </form>
      </div>
    </div>
  `;

  // Init Google Sign-In button if available
  if (state.authConfig?.google_enabled && window.google?.accounts?.id) {
    window.google.accounts.id.initialize({
      client_id: state.authConfig.google_client_id,
      callback: handleGoogleCredential
    });
    window.google.accounts.id.renderButton(
      document.getElementById('googleBtn'),
      { theme: 'filled_black', size: 'large', text: 'signin_with', shape: 'pill', width: 280 }
    );
  }

  // Handle local form login
  document.getElementById('localLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value;
    const p = document.getElementById('loginPassword').value;

    try {
      const res = await api.auth.loginLocal(u, p);
      authStorage.setToken(res.access_token);
      state.user = res.user;
      sounds.playSuccess();
      showToast('Authentification réussie !', 'success');
      await loadInitialData();
      connectWebSocket();
      renderApp();
    } catch (err) {
      sounds.playBan();
      showToast(err.message, 'error');
    }
  });
}

async function handleGoogleCredential(response) {
  try {
    const res = await api.auth.loginGoogle(response.credential);
    authStorage.setToken(res.access_token);
    state.user = res.user;
    sounds.playSuccess();
    showToast(`Bienvenue, ${res.user.name} !`, 'success');
    await loadInitialData();
    connectWebSocket();
    renderApp();
  } catch (err) {
    sounds.playBan();
    showToast(err.message, 'error');
  }
}

// ==========================================================================
// Main Application View
// ==========================================================================

function renderApp() {
  app.innerHTML = `
    <!-- Top Command Header -->
    <header class="soc-header">
      <div class="brand-section">
        <div class="brand-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div class="brand-text">
          <h1>PiSentinel <span class="brand-badge">SOC RPi</span></h1>
          <div class="brand-sub">${state.telemetry?.model || 'Raspberry Pi'} &bull; ${state.telemetry?.hostname || 'raspberrypi'}</div>
        </div>
      </div>

      <div class="header-telemetry">
        <div class="telemetry-pill" id="socPill">
          <span class="pulse-dot ${state.wsConnected ? '' : 'danger'}"></span>
          <span>${state.wsConnected ? 'SURVEILLANCE ACTIVE' : 'DÉCONNECTÉ'}</span>
        </div>
        <div class="telemetry-pill">
          <span style="color:var(--cyan-neon);">TEMP</span>
          <span id="headerTemp">${state.telemetry?.cpu?.temperature_c || 42}&deg;C</span>
        </div>
        <div class="telemetry-pill">
          <span style="color:var(--emerald);">SCORE SÉCURITÉ</span>
          <span id="headerScore" style="font-weight:700;">${state.summary?.overall_security_score || 90}%</span>
        </div>
      </div>

      <div class="header-actions">
        <!-- Sound Toggle -->
        <button id="soundToggleBtn" class="btn btn-icon ${state.soundEnabled ? 'active' : ''}" title="Sons d'alerte tactiques">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
        </button>

        <!-- User Profile Badge & Logout -->
        <div class="user-badge">
          ${state.user?.picture ? `
            <img src="${state.user.picture}" class="user-avatar" alt="Avatar" />
          ` : `
            <div class="user-avatar-placeholder">${state.user?.name ? state.user.name[0] : 'A'}</div>
          `}
          <span style="font-weight:600;">${state.user?.name || 'Admin'}</span>
          <button id="logoutBtn" class="btn btn-outline" style="padding:0.25rem 0.55rem; font-size:0.75rem; margin-left:0.3rem;">
            Sortir
          </button>
        </div>
      </div>
    </header>

    <!-- Navigation Tabs Bar -->
    <nav class="tabs-nav-bar">
      <div class="tabs-list">
        <button class="tab-btn ${state.activeTab === 'radar' ? 'active' : ''}" data-tab="radar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
          </svg>
          Attaques & Radar Temps Réel
          <span class="tab-badge" id="tabAttackCount">${state.attacks.length}</span>
        </button>

        <button class="tab-btn ${state.activeTab === 'ports' ? 'active' : ''}" data-tab="ports">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
            <line x1="6" y1="6" x2="6.01" y2="6"></line>
            <line x1="6" y1="18" x2="6.01" y2="18"></line>
          </svg>
          Audit des Ports Ouverts
          <span class="tab-badge" style="background:rgba(0,242,254,0.15); color:var(--cyan-neon); border-color:var(--cyan-neon);">
            ${state.ports.length}
          </span>
        </button>

        <button class="tab-btn ${state.activeTab === 'tools' ? 'active' : ''}" data-tab="tools">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          Outils de Sécurité RPi
          <span class="tab-badge" style="background:rgba(0,245,160,0.15); color:var(--emerald); border-color:var(--emerald);">
            ${state.tools.filter(t => t.status === 'active').length}/${state.tools.length}
          </span>
        </button>

        <button class="tab-btn ${state.activeTab === 'system' ? 'active' : ''}" data-tab="system">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
            <rect x="9" y="9" width="6" height="6"></rect>
            <line x1="9" y1="1" x2="9" y2="4"></line>
            <line x1="15" y1="1" x2="15" y2="4"></line>
            <line x1="9" y1="20" x2="9" y2="23"></line>
            <line x1="15" y1="20" x2="15" y2="23"></line>
            <line x1="20" y1="9" x2="23" y2="9"></line>
            <line x1="20" y1="14" x2="23" y2="14"></line>
            <line x1="1" y1="9" x2="4" y2="9"></line>
            <line x1="1" y1="14" x2="4" y2="14"></line>
          </svg>
          Télémétrie Matérielle
        </button>
      </div>

      <div class="quick-bar-actions">
        <button id="quickSimulateBtn" class="btn btn-outline" style="font-size:0.8rem; padding:0.4rem 0.8rem;" title="Simule une attaque entrante pour tester les alertes">
          ⚡ Simuler Attaque
        </button>
        <button id="quickBanModalBtn" class="btn btn-danger" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
          🚫 Bloquer une IP
        </button>
      </div>
    </nav>

    <!-- Main Content Area -->
    <main class="main-content">
      <!-- 4 Quick Stat Hero Cards -->
      <div class="summary-cards-row">
        <div class="stat-card cyan">
          <div class="stat-info">
            <div class="stat-label">Score de Sécurité</div>
            <div class="stat-value" id="cardSecurityScore">${state.summary?.overall_security_score || 90}%</div>
            <div class="stat-desc">Indice global de durcissement</div>
          </div>
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
        </div>

        <div class="stat-card ${state.ports.filter(p => p.risk === 'critical' || p.risk === 'high').length > 0 ? 'amber' : 'green'}">
          <div class="stat-info">
            <div class="stat-label">Ports en Écoute</div>
            <div class="stat-value" id="cardOpenPorts">${state.ports.length}</div>
            <div class="stat-desc">
              ${state.ports.filter(p => p.risk === 'critical').length} critique(s), ${state.ports.filter(p => p.risk === 'high').length} exposé(s)
            </div>
          </div>
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
            </svg>
          </div>
        </div>

        <div class="stat-card red">
          <div class="stat-info">
            <div class="stat-label">Tentatives d'Intrusion</div>
            <div class="stat-value" id="cardAttacks">${state.attacks.length}</div>
            <div class="stat-desc">Détectées en temps réel</div>
          </div>
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
        </div>

        <div class="stat-card green">
          <div class="stat-info">
            <div class="stat-label">Outils de Défense</div>
            <div class="stat-value" id="cardTools">${state.tools.filter(t => t.status === 'active').length} / ${state.tools.length}</div>
            <div class="stat-desc">Services de sécurité actifs</div>
          </div>
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
        </div>
      </div>

      <!-- Active Tab Container -->
      <div id="tabContent"></div>
    </main>

    <!-- Modal: Bloquer une IP -->
    <dialog id="banModal" class="soc-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">🚫 Bloquer une IP avec UFW</h3>
          <button class="close-btn" onclick="document.getElementById('banModal').close()">&times;</button>
        </div>
        <form id="banForm">
          <div class="form-group">
            <label class="form-label">Adresse IP de l'Attaquant</label>
            <input type="text" id="banIpInput" class="form-input" placeholder="ex: 185.220.101.5" required pattern="^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$" />
          </div>
          <div class="form-group">
            <label class="form-label">Motif du blocage</label>
            <input type="text" id="banReasonInput" class="form-input" value="Attaque par force brute SSH détectée" required />
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('banModal').close()">Annuler</button>
            <button type="submit" class="btn btn-danger">Appliquer le Blocage UFW</button>
          </div>
        </form>
      </div>
    </dialog>

    <!-- Modal: Règles UFW de durcissement -->
    <dialog id="rulesModal" class="soc-modal">
      <div class="modal-content" style="max-width:620px;">
        <div class="modal-header">
          <h3 class="modal-title">🛡️ Règles de Durcissement Pare-feu</h3>
          <button class="close-btn" onclick="document.getElementById('rulesModal').close()">&times;</button>
        </div>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">
          Ces commandes sécurisent votre Raspberry Pi en fermant les ports non essentiels et en protégeant SSH contre la force brute :
        </p>
        <pre id="rulesCode" style="background:rgba(0,0,0,0.5); padding:1rem; border-radius:var(--radius-sm); border:1px solid var(--panel-border); color:var(--cyan-neon); font-family:var(--font-mono); font-size:0.82rem; overflow-x:auto; line-height:1.6;"></pre>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.5rem;">
          <button id="copyRulesBtn" class="btn btn-outline">
            📋 Copier les Commandes
          </button>
          <button type="button" class="btn btn-primary" onclick="document.getElementById('rulesModal').close()">Terminé</button>
        </div>
      </div>
    </dialog>
  `;

  // Attach tab switching events
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTab = btn.dataset.tab;
      renderCurrentTab();
    });
  });

  // Sound toggle
  document.getElementById('soundToggleBtn').addEventListener('click', () => {
    state.soundEnabled = sounds.toggle();
    document.getElementById('soundToggleBtn').classList.toggle('active', state.soundEnabled);
    showToast(state.soundEnabled ? 'Sons tactiques activés' : 'Sons désactivés', 'info');
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api.auth.logout();
    authStorage.removeToken();
    state.user = null;
    if (state.ws) state.ws.close();
    showToast('Déconnexion effectuée.', 'info');
    renderLogin();
  });

  // Quick action: Simulate Attack
  document.getElementById('quickSimulateBtn').addEventListener('click', async () => {
    try {
      const res = await api.attacks.trigger();
      showToast(`Attaque simulée injectée depuis ${res.event?.ip}`, 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Quick action: Open Ban Modal
  document.getElementById('quickBanModalBtn').addEventListener('click', () => {
    document.getElementById('banIpInput').value = '';
    document.getElementById('banModal').showModal();
  });

  // Handle Ban Form
  document.getElementById('banForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ip = document.getElementById('banIpInput').value;
    const reason = document.getElementById('banReasonInput').value;
    try {
      const res = await api.attacks.ban(ip, reason);
      sounds.playBan();
      showToast(res.message, 'success');
      document.getElementById('banModal').close();
      const bannedData = await api.attacks.getBanned();
      state.bannedIps = bannedData.banned || [];
      if (state.activeTab === 'radar') renderRadarTab();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Copy rules modal helper
  document.getElementById('copyRulesBtn').addEventListener('click', () => {
    const text = document.getElementById('rulesCode').innerText;
    navigator.clipboard.writeText(text);
    showToast('Règles UFW copiées dans le presse-papier !', 'success');
  });

  // Render initial active tab
  renderCurrentTab();
}

function updateHeaderTelemetryPill() {
  const pill = document.getElementById('socPill');
  if (pill) {
    pill.innerHTML = `
      <span class="pulse-dot ${state.wsConnected ? '' : 'danger'}"></span>
      <span>${state.wsConnected ? 'SURVEILLANCE ACTIVE' : 'DÉCONNECTÉ'}</span>
    `;
  }
}

function updateTelemetryViews() {
  if (!state.telemetry) return;

  const tempElem = document.getElementById('headerTemp');
  if (tempElem) {
    tempElem.innerText = `${state.telemetry.cpu?.temperature_c || 42}°C`;
  }

  // If on System tab, refresh meters
  if (state.activeTab === 'system') {
    renderSystemTab();
  }
}

function renderCurrentTab() {
  if (state.activeTab === 'radar') {
    renderRadarTab();
  } else if (state.activeTab === 'ports') {
    renderPortsTab();
  } else if (state.activeTab === 'tools') {
    renderToolsTab();
  } else if (state.activeTab === 'system') {
    renderSystemTab();
  }
}

// ==========================================================================
// Tab 1: Radar & Attaques en Temps Réel
// ==========================================================================

function renderRadarTab() {
  const tabContent = document.getElementById('tabContent');
  tabContent.innerHTML = `
    <div class="grid-soc">
      <!-- Left Column: Radar Threat Visualizer -->
      <div class="panel" style="grid-column: span 7;">
        <div class="panel-header">
          <div class="panel-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="22" y1="12" x2="18" y2="12"></line>
              <line x1="6" y1="12" x2="2" y2="12"></line>
              <line x1="12" y1="6" x2="12" y2="2"></line>
              <line x1="12" y1="22" x2="12" y2="18"></line>
            </svg>
            Radar de Détection des Menaces & Géolocalisation
          </div>
          <span class="brand-badge" style="background:rgba(255,51,102,0.15); color:var(--crimson); border-color:var(--crimson);">
            LIVE THREAT MAP
          </span>
        </div>
        <div class="panel-body">
          <div class="radar-container" id="radarContainer">
            <div class="radar-circle c1"></div>
            <div class="radar-circle c2"></div>
            <div class="radar-circle c3"></div>
            <div class="radar-sweep"></div>
            
            <!-- Simplified Stylized SVG World Map -->
            <svg class="world-map-svg" viewBox="0 0 1000 500" fill="currentColor">
              <!-- Continents simplified outlines -->
              <path d="M150,120 Q180,80 250,90 Q300,120 280,180 Q250,220 180,210 Q140,170 150,120 Z" fill="#1e293b" opacity="0.8"/>
              <path d="M220,240 Q280,260 270,360 Q230,420 210,380 Q190,300 220,240 Z" fill="#1e293b" opacity="0.8"/>
              <path d="M480,90 Q540,70 600,110 Q580,180 500,170 Q460,130 480,90 Z" fill="#1e293b" opacity="0.8"/>
              <path d="M480,200 Q560,210 550,330 Q510,400 470,320 Q460,250 480,200 Z" fill="#1e293b" opacity="0.8"/>
              <path d="M620,80 Q780,60 850,130 Q820,230 700,220 Q610,160 620,80 Z" fill="#1e293b" opacity="0.8"/>
              <path d="M780,310 Q860,300 870,380 Q800,410 770,360 Z" fill="#1e293b" opacity="0.8"/>
            </svg>

            <!-- Dynamic Threat Markers injected here -->
            <div id="radarThreats"></div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.25rem; font-size:0.8rem; color:var(--text-muted); font-family:var(--font-mono);">
            <div style="display:flex; gap:1.25rem;">
              <span>🔴 Attaque Force-Brute</span>
              <span>🟠 Balayage de Ports</span>
              <span>🟢 Pare-feu Actif</span>
            </div>
            <span>Flux de télémétrie chiffré</span>
          </div>
        </div>
      </div>

      <!-- Right Column: Live Attacks Feed -->
      <div class="panel" style="grid-column: span 5;">
        <div class="panel-header">
          <div class="panel-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            Flux des Tentatives d'Attaque
          </div>
          <button id="refreshAttacksBtn" class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.75rem;">
            Actualiser
          </button>
        </div>
        <div class="panel-body" style="padding:1rem;">
          <div class="attack-feed custom-scroll" id="attackFeedList"></div>
        </div>
      </div>

      <!-- Bottom Panel: Banned IPs Blacklist -->
      <div class="panel" style="grid-column: span 12;">
        <div class="panel-header">
          <div class="panel-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
            </svg>
            Adresses IP Bloquées (Pare-feu UFW / Fail2ban)
          </div>
          <span class="brand-badge" style="background:rgba(255,51,102,0.15); color:var(--crimson); border-color:var(--crimson);">
            ${state.bannedIps.length} IP(s) Bannies
          </span>
        </div>
        <div class="panel-body">
          ${state.bannedIps.length === 0 ? `
            <div style="text-align:center; padding:2rem; color:var(--text-dim); font-size:0.9rem;">
              Aucune adresse IP actuellement bloquée. Cliquez sur "Bloquer IP" sur une attaque pour ajouter une règle au pare-feu.
            </div>
          ` : `
            <div class="ports-table-wrapper">
              <table class="soc-table">
                <thead>
                  <tr>
                    <th>Adresse IP</th>
                    <th>Origine / Pays</th>
                    <th>Motif du Bannissement</th>
                    <th>Date & Heure</th>
                    <th style="text-align:right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.bannedIps.map(item => `
                    <tr>
                      <td class="port-num" style="color:var(--crimson);">${item.ip}</td>
                      <td>
                        <span style="font-size:1.1rem; margin-right:0.4rem;">${getFlagEmoji(item.geo?.country_code)}</span>
                        ${item.geo?.country || 'Inconnu'} (${item.geo?.city || 'N/A'})
                      </td>
                      <td style="color:var(--text-muted);">${item.reason}</td>
                      <td style="font-family:var(--font-mono); font-size:0.8rem; color:var(--text-dim);">${formatTime(item.timestamp)}</td>
                      <td style="text-align:right;">
                        <button class="btn btn-outline unban-btn" data-ip="${item.ip}" style="padding:0.35rem 0.75rem; font-size:0.75rem;">
                          Débloquer
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  renderRadarThreats();
  renderAttackFeed();

  // Attach refresh attacks
  document.getElementById('refreshAttacksBtn').addEventListener('click', async () => {
    const data = await api.attacks.getAttacks();
    state.attacks = data.recent_attacks || [];
    renderAttackFeed();
    renderRadarThreats();
    showToast('Journal des attaques rafraîchi.', 'info');
  });

  // Attach unban handlers
  document.querySelectorAll('.unban-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ip = btn.dataset.ip;
      try {
        const res = await api.attacks.unban(ip);
        sounds.playSuccess();
        showToast(res.message, 'success');
        const b = await api.attacks.getBanned();
        state.bannedIps = b.banned || [];
        renderRadarTab();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function renderRadarThreats() {
  const container = document.getElementById('radarThreats');
  if (!container) return;

  const markersHtml = state.attacks.slice(0, 12).map((a, idx) => {
    // Project lat/lon to radar container approximate positions
    const lat = a.geo?.lat || (Math.random() * 80 - 40);
    const lon = a.geo?.lon || (Math.random() * 320 - 160);

    // Map: X between 10% and 90%, Y between 15% and 85%
    const x = Math.max(10, Math.min(90, ((lon + 180) / 360) * 80 + 10));
    const y = Math.max(15, Math.min(85, ((90 - lat) / 180) * 70 + 15));

    return `
      <div class="threat-marker" style="top:${y}%; left:${x}%;" title="${a.ip} (${a.geo?.country || 'Inconnu'}) - ${a.type}"></div>
    `;
  }).join('');

  container.innerHTML = markersHtml;
}

function renderAttackFeed() {
  const list = document.getElementById('attackFeedList');
  if (!list) return;

  if (state.attacks.length === 0) {
    list.innerHTML = `
      <div style="text-align:center; padding:2rem; color:var(--text-dim); font-size:0.85rem;">
        Aucune tentative d'attaque enregistrée pour le moment.
      </div>
    `;
    return;
  }

  list.innerHTML = state.attacks.map(a => `
    <div class="attack-item">
      <div class="attack-meta">
        <span class="attack-country-flag" title="${a.geo?.country || 'Inconnu'}">
          ${getFlagEmoji(a.geo?.country_code)}
        </span>
        <div>
          <div class="attack-ip">${a.ip}</div>
          <div class="attack-type">${a.type}</div>
        </div>
      </div>
      <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:0.35rem;">
        <span class="attack-target">${a.service || 'Port inconnu'}</span>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span class="attack-time">${formatTime(a.timestamp)}</span>
          <button class="btn btn-danger quick-ban-btn" data-ip="${a.ip}" style="padding:0.2rem 0.5rem; font-size:0.7rem;">
            Bloquer
          </button>
        </div>
      </div>
    </div>
  `).join('');

  // Attach quick ban listeners
  list.querySelectorAll('.quick-ban-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ip = btn.dataset.ip;
      try {
        const res = await api.attacks.ban(ip, 'Bloqué en 1 clic depuis le flux d\'attaques');
        sounds.playBan();
        showToast(res.message, 'success');
        const b = await api.attacks.getBanned();
        state.bannedIps = b.banned || [];
        renderRadarTab();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

// ==========================================================================
// Tab 2: Audit des Ports Ouverts & Vulnérabilités
// ==========================================================================

function renderPortsTab() {
  const tabContent = document.getElementById('tabContent');

  tabContent.innerHTML = `
    <div class="grid-soc">
      <!-- Port Score Header Card -->
      <div class="panel" style="grid-column: span 12;">
        <div class="panel-body" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1.5rem;">
          <div style="display:flex; align-items:center; gap:1.5rem;">
            <div style="width:72px; height:72px; border-radius:50%; border:3px solid ${state.portScore >= 80 ? 'var(--emerald)' : (state.portScore >= 60 ? 'var(--amber)' : 'var(--crimson)')}; display:flex; align-items:center; justify-content:center; font-family:var(--font-cyber); font-size:1.8rem; font-weight:700; color:var(--text-main); box-shadow:0 0 20px ${state.portScore >= 80 ? 'var(--emerald-glow)' : 'var(--crimson-glow)'};">
              ${state.portScore}%
            </div>
            <div>
              <h2 style="font-family:var(--font-cyber); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px;">
                Indice de Sécurité des Ports
              </h2>
              <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.2rem;">
                ${state.ports.length} port(s) détecté(s) en écoute &bull; ${state.riskBreakdown.critical || 0} critique(s) &bull; ${state.riskBreakdown.high || 0} élevé(s)
              </p>
            </div>
          </div>

          <div style="display:flex; gap:0.75rem;">
            <button id="rescanPortsBtn" class="btn btn-outline">
              🔄 Réanalyser les Ports
            </button>
            <button id="showUfwRulesBtn" class="btn btn-primary">
              🛡️ Règles de Durcissement UFW
            </button>
          </div>
        </div>
      </div>

      <!-- Ports Matrix Table -->
      <div class="panel" style="grid-column: span 12;">
        <div class="panel-header">
          <div class="panel-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
            </svg>
            Matrice des Ports & Analyse de Risque
          </div>
          <span style="font-family:var(--font-mono); font-size:0.8rem; color:var(--text-dim);">
            Trié par priorité de menace
          </span>
        </div>
        <div class="panel-body">
          <div class="ports-table-wrapper">
            <table class="soc-table">
              <thead>
                <tr>
                  <th>Port</th>
                  <th>Service Détecté</th>
                  <th>IP d'Écoute (Bind)</th>
                  <th>Processus (PID)</th>
                  <th>Niveau de Risque</th>
                  <th>Recommandation Sécurité</th>
                </tr>
              </thead>
              <tbody>
                ${state.ports.map(p => `
                  <tr>
                    <td>
                      <span class="port-num">${p.port}</span>
                      <span style="font-size:0.75rem; color:var(--text-dim); margin-left:0.3rem;">TCP/UDP</span>
                    </td>
                    <td>
                      <div style="font-weight:600; color:var(--text-main);">${p.service}</div>
                      <div style="font-size:0.75rem; color:var(--text-dim);">${p.description}</div>
                    </td>
                    <td>
                      <span class="ip-bind-badge ${p.is_localhost_only ? 'local' : 'external'}">
                        ${p.bind_ip} ${p.is_localhost_only ? '(Local)' : '(Public)'}
                      </span>
                    </td>
                    <td style="font-family:var(--font-mono); font-size:0.8rem; color:var(--text-muted);">
                      ${p.process_name} ${p.pid ? `(${p.pid})` : ''}
                    </td>
                    <td>
                      <span class="risk-badge ${p.risk}">
                        ${p.risk === 'critical' ? '🔴 Critique' : (p.risk === 'high' ? '🟠 Élevé' : (p.risk === 'medium' ? '🟣 Moyen' : (p.risk === 'low' ? '🔵 Faible' : '🟢 Sécurisé')))}
                      </span>
                    </td>
                    <td style="font-size:0.8rem; color:var(--text-muted); max-width:320px;">
                      ${p.recommendation}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  // Rescan Ports Button
  document.getElementById('rescanPortsBtn').addEventListener('click', async () => {
    try {
      showToast('Analyse des ports en cours...', 'info');
      const data = await api.ports.getPorts();
      state.ports = data.ports || [];
      state.portScore = data.score || 100;
      state.riskBreakdown = data.risk_breakdown || {};
      renderPortsTab();
      showToast('Scan des ports terminé.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Show UFW Hardening Rules Modal
  document.getElementById('showUfwRulesBtn').addEventListener('click', async () => {
    try {
      const data = await api.ports.getHardeningRules();
      document.getElementById('rulesCode').innerText = data.commands.join('\n');
      document.getElementById('rulesModal').showModal();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ==========================================================================
// Tab 3: Gestionnaire des Outils de Sécurité
// ==========================================================================

function renderToolsTab() {
  const tabContent = document.getElementById('tabContent');

  tabContent.innerHTML = `
    <div style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
      <div>
        <h2 style="font-family:var(--font-cyber); font-size:1.5rem; text-transform:uppercase; letter-spacing:1px;">
          Outils & Démons de Sécurité Raspberry Pi
        </h2>
        <p style="color:var(--text-muted); font-size:0.85rem;">
          Surveillez, activez et installez en 1 clic les packages de protection indispensables.
        </p>
      </div>
      <button id="refreshToolsBtn" class="btn btn-outline">
        🔄 Actualiser les Statuts
      </button>
    </div>

    <div class="tools-grid">
      ${state.tools.map(tool => `
        <div class="tool-card">
          <div>
            <div class="tool-card-header">
              <div>
                <div class="tool-category">${tool.category}</div>
                <div class="tool-card-title">${tool.name}</div>
              </div>
              <span class="tool-status-badge ${tool.status}">
                <span class="pulse-dot ${tool.status === 'active' ? '' : (tool.status === 'not_installed' ? 'danger' : 'warning')}"></span>
                ${tool.status === 'active' ? 'ACTIF' : (tool.status === 'not_installed' ? 'NON INSTALLÉ' : 'ARRÊTÉ')}
              </span>
            </div>
            <p class="tool-desc" style="margin-top:0.85rem;">
              ${tool.description}
            </p>
          </div>

          <div class="tool-footer">
            ${tool.is_installed ? `
              <div style="display:flex; gap:0.5rem; width:100%;">
                ${tool.can_control_service ? `
                  ${tool.status === 'active' ? `
                    <button class="btn btn-outline tool-action-btn" data-tool="${tool.id}" data-action="restart" style="flex:1; justify-content:center; padding:0.4rem 0.6rem; font-size:0.75rem;">
                      Redémarrer
                    </button>
                    <button class="btn btn-danger tool-action-btn" data-tool="${tool.id}" data-action="stop" style="flex:1; justify-content:center; padding:0.4rem 0.6rem; font-size:0.75rem;">
                      Arrêter
                    </button>
                  ` : `
                    <button class="btn btn-primary tool-action-btn" data-tool="${tool.id}" data-action="start" style="flex:1; justify-content:center; padding:0.4rem 0.6rem; font-size:0.75rem;">
                      Démarrer le Service
                    </button>
                  `}
                ` : `
                  <span style="font-size:0.75rem; color:var(--text-dim); font-family:var(--font-mono);">
                    Outil binaire exécutable &bull; Prêt
                  </span>
                `}
              </div>
            ` : `
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <span style="font-size:0.75rem; color:var(--amber); font-family:var(--font-mono);">
                  ${tool.recommended ? '⭐ Fortement Recommandé' : 'Optionnel'}
                </span>
                <button class="btn btn-primary tool-install-btn" data-tool="${tool.id}" style="padding:0.4rem 0.85rem; font-size:0.8rem;">
                  📦 Installer (apt)
                </button>
              </div>
            `}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Attach control service listeners
  document.querySelectorAll('.tool-action-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const toolId = btn.dataset.tool;
      const action = btn.dataset.action;
      try {
        btn.disabled = true;
        const res = await api.tools.control(toolId, action);
        sounds.playSuccess();
        showToast(res.message, 'success');
        state.tools = await api.tools.getTools();
        renderToolsTab();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  // Attach install listeners
  document.querySelectorAll('.tool-install-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const toolId = btn.dataset.tool;
      try {
        btn.disabled = true;
        btn.innerText = 'Installation...';
        const res = await api.tools.install(toolId);
        sounds.playSuccess();
        showToast(res.message, 'success');
        state.tools = await api.tools.getTools();
        renderToolsTab();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  // Refresh
  document.getElementById('refreshToolsBtn').addEventListener('click', async () => {
    state.tools = await api.tools.getTools();
    renderToolsTab();
    showToast('Statut des outils actualisé.', 'info');
  });
}

// ==========================================================================
// Tab 4: Télémétrie Matérielle & Santé RPi
// ==========================================================================

function renderSystemTab() {
  const tabContent = document.getElementById('tabContent');
  const t = state.telemetry || {
    hostname: 'raspberrypi',
    model: 'Raspberry Pi',
    os: 'Linux',
    uptime: 'N/A',
    cpu: { percent: 12, temperature_c: 44.5, cores: 4 },
    memory: { total_mb: 3800, used_mb: 850, free_mb: 2950, percent: 22 },
    disk: { total_gb: 32, used_gb: 7.5, free_gb: 24.5, percent: 23 },
    network: { bytes_sent_mb: 14.2, bytes_recv_mb: 45.8 }
  };

  const isWarm = (t.cpu?.temperature_c || 0) > 60;

  tabContent.innerHTML = `
    <div class="grid-soc">
      <!-- Hardware System Overview Card -->
      <div class="panel" style="grid-column: span 12;">
        <div class="panel-header">
          <div class="panel-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
              <rect x="9" y="9" width="6" height="6"></rect>
            </svg>
            Informations Plateforme & Système d'Exploitation
          </div>
          <span class="brand-badge">UPTIME: ${t.uptime}</span>
        </div>
        <div class="panel-body" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1.25rem;">
          <div>
            <div style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase;">Modèle Matériel</div>
            <div style="font-family:var(--font-cyber); font-size:1.15rem; font-weight:700; color:var(--cyan-neon); margin-top:0.25rem;">
              ${t.model}
            </div>
          </div>
          <div>
            <div style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase;">Nom d'Hôte (Hostname)</div>
            <div style="font-family:var(--font-mono); font-size:1rem; color:var(--text-main); margin-top:0.25rem;">
              ${t.hostname}
            </div>
          </div>
          <div>
            <div style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase;">Noyau / Système</div>
            <div style="font-family:var(--font-mono); font-size:0.85rem; color:var(--text-main); margin-top:0.25rem;">
              ${t.os} (${t.architecture || 'arm64'})
            </div>
          </div>
          <div>
            <div style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase;">Cœurs Processeur</div>
            <div style="font-family:var(--font-cyber); font-size:1.15rem; font-weight:700; color:var(--emerald); margin-top:0.25rem;">
              ${t.cpu?.cores || 4} Cœurs Actifs
            </div>
          </div>
        </div>
      </div>

      <!-- Telemetry Gauges Grid -->
      <div style="grid-column: span 12;" class="telemetry-grid">
        <!-- CPU Gauge -->
        <div class="gauge-card">
          <div class="gauge-header">
            <span class="gauge-title">Charge Processeur</span>
            <span class="gauge-val" style="color:var(--cyan-neon);">${t.cpu?.percent || 0}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${t.cpu?.percent || 0}%;"></div>
          </div>
          <div class="gauge-sub">
            <span>Fréquence dynamique</span>
            <span>${t.cpu?.cores || 4} Threads</span>
          </div>
        </div>

        <!-- Temperature Gauge -->
        <div class="gauge-card">
          <div class="gauge-header">
            <span class="gauge-title">Température SoC (RPi)</span>
            <span class="gauge-val" style="color:${isWarm ? 'var(--crimson)' : 'var(--emerald)'};">
              ${t.cpu?.temperature_c || 42}&deg;C
            </span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${isWarm ? 'warm' : ''}" style="width:${Math.min(100, ((t.cpu?.temperature_c || 40) / 85) * 100)}%;"></div>
          </div>
          <div class="gauge-sub">
            <span>Seuil critique: 80°C</span>
            <span>${isWarm ? 'Ventilation recommandée' : 'Refroidissement Optimal'}</span>
          </div>
        </div>

        <!-- Memory Gauge -->
        <div class="gauge-card">
          <div class="gauge-header">
            <span class="gauge-title">Mémoire Vive (RAM)</span>
            <span class="gauge-val" style="color:var(--emerald);">${t.memory?.percent || 0}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${t.memory?.percent || 0}%;"></div>
          </div>
          <div class="gauge-sub">
            <span>${t.memory?.used_mb || 0} Mo Utilisés</span>
            <span>${t.memory?.total_mb || 0} Mo Total</span>
          </div>
        </div>

        <!-- Storage Gauge -->
        <div class="gauge-card">
          <div class="gauge-header">
            <span class="gauge-title">Stockage SD / NVMe</span>
            <span class="gauge-val" style="color:var(--purple);">${t.disk?.percent || 0}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${t.disk?.percent || 0}%;"></div>
          </div>
          <div class="gauge-sub">
            <span>${t.disk?.used_gb || 0} Go Occupés</span>
            <span>${t.disk?.total_gb || 0} Go Total</span>
          </div>
        </div>
      </div>

      <!-- Network Throughput -->
      <div class="panel" style="grid-column: span 12;">
        <div class="panel-header">
          <div class="panel-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            Trafic Réseau Entrant / Sortant (I/O)
          </div>
          <span style="font-family:var(--font-mono); font-size:0.8rem; color:var(--cyan-neon);">
            Interface eth0 / wlan0
          </span>
        </div>
        <div class="panel-body" style="display:flex; justify-content:space-around; align-items:center; text-align:center;">
          <div>
            <div style="font-size:0.8rem; color:var(--text-dim); text-transform:uppercase;">Total Données Reçues (RX)</div>
            <div style="font-family:var(--font-cyber); font-size:2.2rem; font-weight:700; color:var(--emerald); margin-top:0.3rem;">
              ${t.network?.bytes_recv_mb || 0} <span style="font-size:1rem;">Mo</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-dim); font-family:var(--font-mono);">${t.network?.packets_recv || 0} paquets</div>
          </div>
          <div style="width:1px; height:60px; background:rgba(255,255,255,0.1);"></div>
          <div>
            <div style="font-size:0.8rem; color:var(--text-dim); text-transform:uppercase;">Total Données Émises (TX)</div>
            <div style="font-family:var(--font-cyber); font-size:2.2rem; font-weight:700; color:var(--cyan-neon); margin-top:0.3rem;">
              ${t.network?.bytes_sent_mb || 0} <span style="font-size:1rem;">Mo</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-dim); font-family:var(--font-mono);">${t.network?.packets_sent || 0} paquets</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Start Application
window.addEventListener('DOMContentLoaded', init);
