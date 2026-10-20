(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const r of i)if(r.type==="childList")for(const l of r.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&n(l)}).observe(document,{childList:!0,subtree:!0});function s(i){const r={};return i.integrity&&(r.integrity=i.integrity),i.referrerPolicy&&(r.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?r.credentials="include":i.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(i){if(i.ep)return;i.ep=!0;const r=s(i);fetch(i.href,r)}})();const $="pisentinel_token",y={getToken:()=>localStorage.getItem($),setToken:a=>localStorage.setItem($,a),removeToken:()=>localStorage.removeItem($)},j=()=>(window.location.pathname||"").includes("/sentinel")?"/sentinel":"";async function u(a,e={}){const s=y.getToken(),n={"Content-Type":"application/json",...e.headers||{}};s&&(n.Authorization=`Bearer ${s}`);const i=j(),r=a.startsWith("http")?a:`${i}${a}`,l=await fetch(r,{...e,headers:n});if(l.status===401){y.removeToken(),window.dispatchEvent(new CustomEvent("pisentinel:unauthorized"));const v=await l.json().catch(()=>({detail:"Session expirée"}));throw new Error(v.detail||"Non autorisé")}if(!l.ok){const v=await l.json().catch(()=>({detail:`Erreur HTTP ${l.status}`}));throw new Error(v.detail||`Erreur serveur (${l.status})`)}return l.json()}const c={auth:{getConfig:()=>u("/api/auth/config"),loginGoogle:a=>u("/api/auth/google",{method:"POST",body:JSON.stringify({credential:a})}),loginLocal:(a,e)=>u("/api/auth/login",{method:"POST",body:JSON.stringify({username:a,password:e})}),getMe:()=>u("/api/auth/me"),logout:()=>u("/api/auth/logout",{method:"POST"})},system:{getStatus:()=>u("/api/system/status"),getSummary:()=>u("/api/system/summary")},ports:{getPorts:()=>u("/api/ports"),getHardeningRules:()=>u("/api/ports/hardening-rules")},tools:{getTools:()=>u("/api/tools"),control:(a,e)=>u(`/api/tools/${a}/control`,{method:"POST",body:JSON.stringify({action:e})}),install:a=>u(`/api/tools/${a}/install`,{method:"POST"})},attacks:{getAttacks:()=>u("/api/attacks"),trigger:(a,e)=>u("/api/attacks/trigger",{method:"POST",body:JSON.stringify({ip:a,service:e})}),getBanned:()=>u("/api/attacks/banned"),ban:(a,e)=>u("/api/attacks/ban",{method:"POST",body:JSON.stringify({ip:a,reason:e})}),unban:a=>u(`/api/attacks/ban/${encodeURIComponent(a)}`,{method:"DELETE"})}};class G{constructor(){this.ctx=null,this.enabled=localStorage.getItem("pisentinel_sound")==="true"}init(){if(!this.ctx&&typeof window<"u"){const e=window.AudioContext||window.webkitAudioContext;e&&(this.ctx=new e)}}toggle(){return this.enabled=!this.enabled,localStorage.setItem("pisentinel_sound",this.enabled?"true":"false"),this.enabled&&this.playBeep(880,.08,"sine"),this.enabled}playBeep(e=440,s=.1,n="sine",i=.05){if(this.enabled)try{if(this.init(),this.ctx&&this.ctx.state==="suspended"&&this.ctx.resume(),!this.ctx)return;const r=this.ctx.createOscillator(),l=this.ctx.createGain();r.type=n,r.frequency.setValueAtTime(e,this.ctx.currentTime),l.gain.setValueAtTime(i,this.ctx.currentTime),l.gain.exponentialRampToValueAtTime(1e-4,this.ctx.currentTime+s),r.connect(l),l.connect(this.ctx.destination),r.start(),r.stop(this.ctx.currentTime+s)}catch{}}playAttackAlert(){this.enabled&&(this.playBeep(880,.12,"triangle",.08),setTimeout(()=>{this.playBeep(1174,.18,"triangle",.06)},120))}playBan(){this.enabled&&(this.playBeep(320,.15,"sawtooth",.08),setTimeout(()=>{this.playBeep(180,.25,"sawtooth",.08)},100))}playSuccess(){this.enabled&&(this.playBeep(523.25,.08,"sine",.05),setTimeout(()=>{this.playBeep(659.25,.12,"sine",.05)},90))}}const g=new G,t={user:null,authConfig:null,activeTab:"radar",telemetry:null,summary:null,ports:[],portScore:100,riskBreakdown:{},tools:[],attacks:[],bannedIps:[],wsConnected:!1,soundEnabled:g.enabled,ws:null},S=document.getElementById("app");function d(a,e="info"){let s=document.querySelector(".toast-container");s||(s=document.createElement("div"),s.className="toast-container",document.body.appendChild(s));const n=document.createElement("div");n.className=`toast ${e}`,n.innerHTML=`
    <span class="pulse-dot ${e==="error"?"danger":e==="success"?"":"warning"}"></span>
    <span>${a}</span>
  `,s.appendChild(n),setTimeout(()=>{n.style.opacity="0",n.style.transform="translateX(40px)",n.style.transition="all 0.3s ease",setTimeout(()=>n.remove(),300)},4e3)}function H(a){try{return new Date(a).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}catch{return"Récemment"}}function F(a){if(!a||a.length!==2)return"🌐";const e=a.toUpperCase().split("").map(s=>127397+s.charCodeAt(0));return String.fromCodePoint(...e)}async function O(){W();try{t.authConfig=await c.auth.getConfig()}catch(e){console.warn("Failed to load auth config:",e)}if(y.getToken())try{const e=await c.auth.getMe();t.user=e.user,await C(),w(),I();return}catch{y.removeToken()}E()}window.addEventListener("pisentinel:unauthorized",()=>{t.user=null,t.ws&&(t.ws.close(),t.ws=null),E()});async function C(){try{const[a,e,s,n,i]=await Promise.all([c.system.getSummary().catch(()=>null),c.ports.getPorts().catch(()=>({ports:[],score:100,risk_breakdown:{}})),c.tools.getTools().catch(()=>[]),c.attacks.getAttacks().catch(()=>({recent_attacks:[]})),c.attacks.getBanned().catch(()=>({banned:[]}))]);t.summary=a,t.ports=e.ports||[],t.portScore=e.score||100,t.riskBreakdown=e.risk_breakdown||{},t.tools=s||[],t.attacks=n.recent_attacks||[],t.bannedIps=i.banned||[]}catch(a){console.error("Error loading initial data:",a)}}function w(){const a=y.getToken();if(!a)return;const e=window.location.protocol==="https:"?"wss:":"ws:",s=j(),n=`${e}//${window.location.host}${s}/api/ws/telemetry?token=${encodeURIComponent(a)}`;t.ws=new WebSocket(n),t.ws.onopen=()=>{t.wsConnected=!0,D()},t.ws.onmessage=i=>{try{const r=JSON.parse(i.data);r.type==="telemetry"?(t.telemetry=r.data,Z()):r.type==="attack_event"&&Q(r.data)}catch(r){console.error("WS parse error:",r)}},t.ws.onclose=()=>{t.wsConnected=!1,D(),t.user&&setTimeout(w,4e3)}}function Q(a){var e;t.attacks.unshift(a),t.attacks.length>50&&t.attacks.pop(),g.playAttackAlert(),d(`Alerte Attaque: ${a.type} depuis ${a.ip} (${((e=a.geo)==null?void 0:e.country)||"Inconnu"})`,"error"),t.activeTab==="radar"&&(T(),B())}function W(){S.innerHTML=`
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
  `}function E(){var a,e,s,n,i;S.innerHTML=`
    <div style="display:flex; align-items:center; justify-content:center; min-height:100vh; padding:1.5rem;">
      <div class="modal-content" style="max-width:480px; width:100%;">
        <div style="text-align:center; margin-bottom:1.75rem;">
          <div class="brand-logo" style="width:58px; height:58px; margin:0 auto 1rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h2 style="font-family:var(--font-cyber); font-size:1.8rem; letter-spacing:1px; text-transform:uppercase; color:var(--text-main);">
            PiSentinel SOC <span class="brand-badge" style="font-size:0.65rem; vertical-align:middle;">v1.0.0</span>
          </h2>
          <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.35rem;">
            Centre de Contrôle & Sécurité Raspberry Pi
          </p>
        </div>

        ${(a=t.authConfig)!=null&&a.google_enabled?`
          <div style="margin-bottom:1.25rem;">
            <div id="googleBtn" style="display:flex; justify-content:center;"></div>
            ${(e=t.authConfig)!=null&&e.whitelist_enabled?`
              <p style="font-size:0.75rem; color:var(--emerald); text-align:center; margin-top:0.6rem; font-family:var(--font-mono);">
                🛡️ Accès restreint par liste blanche Google (${t.authConfig.allowed_email_count} comptes autorisés)
              </p>
            `:""}
          </div>
          <div class="divider">ou connexion administrateur local</div>
        `:`
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
  `,(s=t.authConfig)!=null&&s.google_enabled&&((i=(n=window.google)==null?void 0:n.accounts)!=null&&i.id)&&(window.google.accounts.id.initialize({client_id:t.authConfig.google_client_id,callback:J}),window.google.accounts.id.renderButton(document.getElementById("googleBtn"),{theme:"filled_black",size:"large",text:"signin_with",shape:"pill",width:280})),document.getElementById("localLoginForm").addEventListener("submit",async r=>{r.preventDefault();const l=document.getElementById("loginUsername").value,v=document.getElementById("loginPassword").value;try{const m=await c.auth.loginLocal(l,v);y.setToken(m.access_token),t.user=m.user,g.playSuccess(),d("Authentification réussie !","success"),await C(),w(),I()}catch(m){g.playBan(),d(m.message,"error")}})}async function J(a){try{const e=await c.auth.loginGoogle(a.credential);y.setToken(e.access_token),t.user=e.user,g.playSuccess(),d(`Bienvenue, ${e.user.name} !`,"success"),await C(),w(),I()}catch(e){g.playBan(),d(e.message,"error")}}function I(){var a,e,s,n,i,r,l,v,m;S.innerHTML=`
    <!-- Top Command Header -->
    <header class="soc-header">
      <div class="brand-section">
        <div class="brand-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div class="brand-text">
          <h1>PiSentinel <span class="brand-badge">v1.0.0</span></h1>
          <div class="brand-sub">${((a=t.telemetry)==null?void 0:a.model)||"Raspberry Pi"} &bull; ${((e=t.telemetry)==null?void 0:e.hostname)||"raspberrypi"}</div>
        </div>
      </div>

      <div class="header-telemetry">
        <div class="telemetry-pill" id="socPill">
          <span class="pulse-dot ${t.wsConnected?"":"danger"}"></span>
          <span>${t.wsConnected?"SURVEILLANCE ACTIVE":"DÉCONNECTÉ"}</span>
        </div>
        <div class="telemetry-pill">
          <span style="color:var(--cyan-neon);">TEMP</span>
          <span id="headerTemp">${((n=(s=t.telemetry)==null?void 0:s.cpu)==null?void 0:n.temperature_c)||42}&deg;C</span>
        </div>
        <div class="telemetry-pill">
          <span style="color:var(--emerald);">SCORE SÉCURITÉ</span>
          <span id="headerScore" style="font-weight:700;">${((i=t.summary)==null?void 0:i.overall_security_score)||90}%</span>
        </div>
      </div>

      <div class="header-actions">
        <!-- Sound Toggle -->
        <button id="soundToggleBtn" class="btn btn-icon ${t.soundEnabled?"active":""}" title="Sons d'alerte tactiques">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
        </button>

        <!-- User Profile Badge & Logout -->
        <div class="user-badge">
          ${(r=t.user)!=null&&r.picture?`
            <img src="${t.user.picture}" class="user-avatar" alt="Avatar" />
          `:`
            <div class="user-avatar-placeholder">${(l=t.user)!=null&&l.name?t.user.name[0]:"A"}</div>
          `}
          <span style="font-weight:600;">${((v=t.user)==null?void 0:v.name)||"Admin"}</span>
          <button id="logoutBtn" class="btn btn-outline" style="padding:0.25rem 0.55rem; font-size:0.75rem; margin-left:0.3rem;">
            Sortir
          </button>
        </div>
      </div>
    </header>

    <!-- Navigation Tabs Bar -->
    <nav class="tabs-nav-bar">
      <div class="tabs-list">
        <button class="tab-btn ${t.activeTab==="radar"?"active":""}" data-tab="radar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
          </svg>
          Attaques & Radar Temps Réel
          <span class="tab-badge" id="tabAttackCount">${t.attacks.length}</span>
        </button>

        <button class="tab-btn ${t.activeTab==="ports"?"active":""}" data-tab="ports">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
            <line x1="6" y1="6" x2="6.01" y2="6"></line>
            <line x1="6" y1="18" x2="6.01" y2="18"></line>
          </svg>
          Audit des Ports Ouverts
          <span class="tab-badge" style="background:rgba(0,242,254,0.15); color:var(--cyan-neon); border-color:var(--cyan-neon);">
            ${t.ports.length}
          </span>
        </button>

        <button class="tab-btn ${t.activeTab==="tools"?"active":""}" data-tab="tools">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          Outils de Sécurité RPi
          <span class="tab-badge" style="background:rgba(0,245,160,0.15); color:var(--emerald); border-color:var(--emerald);">
            ${t.tools.filter(o=>o.status==="active").length}/${t.tools.length}
          </span>
        </button>

        <button class="tab-btn ${t.activeTab==="system"?"active":""}" data-tab="system">
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
            <div class="stat-value" id="cardSecurityScore">${((m=t.summary)==null?void 0:m.overall_security_score)||90}%</div>
            <div class="stat-desc">Indice global de durcissement</div>
          </div>
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
        </div>

        <div class="stat-card ${t.ports.filter(o=>o.risk==="critical"||o.risk==="high").length>0?"amber":"green"}">
          <div class="stat-info">
            <div class="stat-label">Ports en Écoute</div>
            <div class="stat-value" id="cardOpenPorts">${t.ports.length}</div>
            <div class="stat-desc">
              ${t.ports.filter(o=>o.risk==="critical").length} critique(s), ${t.ports.filter(o=>o.risk==="high").length} exposé(s)
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
            <div class="stat-value" id="cardAttacks">${t.attacks.length}</div>
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
            <div class="stat-value" id="cardTools">${t.tools.filter(o=>o.status==="active").length} / ${t.tools.length}</div>
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
  `,document.querySelectorAll(".tab-btn").forEach(o=>{o.addEventListener("click",()=>{document.querySelectorAll(".tab-btn").forEach(p=>p.classList.remove("active")),o.classList.add("active"),t.activeTab=o.dataset.tab,N()})}),document.getElementById("soundToggleBtn").addEventListener("click",()=>{t.soundEnabled=g.toggle(),document.getElementById("soundToggleBtn").classList.toggle("active",t.soundEnabled),d(t.soundEnabled?"Sons tactiques activés":"Sons désactivés","info")}),document.getElementById("logoutBtn").addEventListener("click",async()=>{await c.auth.logout(),y.removeToken(),t.user=null,t.ws&&t.ws.close(),d("Déconnexion effectuée.","info"),E()}),document.getElementById("quickSimulateBtn").addEventListener("click",async()=>{var o;try{const p=await c.attacks.trigger();d(`Attaque simulée injectée depuis ${(o=p.event)==null?void 0:o.ip}`,"info")}catch(p){d(p.message,"error")}}),document.getElementById("quickBanModalBtn").addEventListener("click",()=>{document.getElementById("banIpInput").value="",document.getElementById("banModal").showModal()}),document.getElementById("banForm").addEventListener("submit",async o=>{o.preventDefault();const p=document.getElementById("banIpInput").value,b=document.getElementById("banReasonInput").value;try{const f=await c.attacks.ban(p,b);g.playBan(),d(f.message,"success"),document.getElementById("banModal").close();const h=await c.attacks.getBanned();t.bannedIps=h.banned||[],t.activeTab==="radar"&&k()}catch(f){d(f.message,"error")}}),document.getElementById("copyRulesBtn").addEventListener("click",()=>{const o=document.getElementById("rulesCode").innerText;navigator.clipboard.writeText(o),d("Règles UFW copiées dans le presse-papier !","success")}),N()}function D(){const a=document.getElementById("socPill");a&&(a.innerHTML=`
      <span class="pulse-dot ${t.wsConnected?"":"danger"}"></span>
      <span>${t.wsConnected?"SURVEILLANCE ACTIVE":"DÉCONNECTÉ"}</span>
    `)}function Z(){var e;if(!t.telemetry)return;const a=document.getElementById("headerTemp");a&&(a.innerText=`${((e=t.telemetry.cpu)==null?void 0:e.temperature_c)||42}°C`),t.activeTab==="system"&&V()}function N(){t.activeTab==="radar"?k():t.activeTab==="ports"?U():t.activeTab==="tools"?x():t.activeTab==="system"&&V()}function k(){const a=document.getElementById("tabContent");a.innerHTML=`
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
            ${t.bannedIps.length} IP(s) Bannies
          </span>
        </div>
        <div class="panel-body">
          ${t.bannedIps.length===0?`
            <div style="text-align:center; padding:2rem; color:var(--text-dim); font-size:0.9rem;">
              Aucune adresse IP actuellement bloquée. Cliquez sur "Bloquer IP" sur une attaque pour ajouter une règle au pare-feu.
            </div>
          `:`
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
                  ${t.bannedIps.map(e=>{var s,n,i;return`
                    <tr>
                      <td class="port-num" style="color:var(--crimson);">${e.ip}</td>
                      <td>
                        <span style="font-size:1.1rem; margin-right:0.4rem;">${F((s=e.geo)==null?void 0:s.country_code)}</span>
                        ${((n=e.geo)==null?void 0:n.country)||"Inconnu"} (${((i=e.geo)==null?void 0:i.city)||"N/A"})
                      </td>
                      <td style="color:var(--text-muted);">${e.reason}</td>
                      <td style="font-family:var(--font-mono); font-size:0.8rem; color:var(--text-dim);">${H(e.timestamp)}</td>
                      <td style="text-align:right;">
                        <button class="btn btn-outline unban-btn" data-ip="${e.ip}" style="padding:0.35rem 0.75rem; font-size:0.75rem;">
                          Débloquer
                        </button>
                      </td>
                    </tr>
                  `}).join("")}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    </div>
  `,T(),B(),document.getElementById("refreshAttacksBtn").addEventListener("click",async()=>{const e=await c.attacks.getAttacks();t.attacks=e.recent_attacks||[],B(),T(),d("Journal des attaques rafraîchi.","info")}),document.querySelectorAll(".unban-btn").forEach(e=>{e.addEventListener("click",async()=>{const s=e.dataset.ip;try{const n=await c.attacks.unban(s);g.playSuccess(),d(n.message,"success");const i=await c.attacks.getBanned();t.bannedIps=i.banned||[],k()}catch(n){d(n.message,"error")}})})}function T(){const a=document.getElementById("radarThreats");if(!a)return;const e=t.attacks.slice(0,12).map((s,n)=>{var m,o,p;const i=((m=s.geo)==null?void 0:m.lat)||Math.random()*80-40,r=((o=s.geo)==null?void 0:o.lon)||Math.random()*320-160,l=Math.max(10,Math.min(90,(r+180)/360*80+10));return`
      <div class="threat-marker" style="top:${Math.max(15,Math.min(85,(90-i)/180*70+15))}%; left:${l}%;" title="${s.ip} (${((p=s.geo)==null?void 0:p.country)||"Inconnu"}) - ${s.type}"></div>
    `}).join("");a.innerHTML=e}function B(){const a=document.getElementById("attackFeedList");if(a){if(t.attacks.length===0){a.innerHTML=`
      <div style="text-align:center; padding:2rem; color:var(--text-dim); font-size:0.85rem;">
        Aucune tentative d'attaque enregistrée pour le moment.
      </div>
    `;return}a.innerHTML=t.attacks.map(e=>{var s,n;return`
    <div class="attack-item">
      <div class="attack-meta">
        <span class="attack-country-flag" title="${((s=e.geo)==null?void 0:s.country)||"Inconnu"}">
          ${F((n=e.geo)==null?void 0:n.country_code)}
        </span>
        <div>
          <div class="attack-ip">${e.ip}</div>
          <div class="attack-type">${e.type}</div>
        </div>
      </div>
      <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:0.35rem;">
        <span class="attack-target">${e.service||"Port inconnu"}</span>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span class="attack-time">${H(e.timestamp)}</span>
          <button class="btn btn-danger quick-ban-btn" data-ip="${e.ip}" style="padding:0.2rem 0.5rem; font-size:0.7rem;">
            Bloquer
          </button>
        </div>
      </div>
    </div>
  `}).join(""),a.querySelectorAll(".quick-ban-btn").forEach(e=>{e.addEventListener("click",async()=>{const s=e.dataset.ip;try{const n=await c.attacks.ban(s,"Bloqué en 1 clic depuis le flux d'attaques");g.playBan(),d(n.message,"success");const i=await c.attacks.getBanned();t.bannedIps=i.banned||[],k()}catch(n){d(n.message,"error")}})})}}function U(){const a=document.getElementById("tabContent");a.innerHTML=`
    <div class="grid-soc">
      <!-- Port Score Header Card -->
      <div class="panel" style="grid-column: span 12;">
        <div class="panel-body" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1.5rem;">
          <div style="display:flex; align-items:center; gap:1.5rem;">
            <div style="width:72px; height:72px; border-radius:50%; border:3px solid ${t.portScore>=80?"var(--emerald)":t.portScore>=60?"var(--amber)":"var(--crimson)"}; display:flex; align-items:center; justify-content:center; font-family:var(--font-cyber); font-size:1.8rem; font-weight:700; color:var(--text-main); box-shadow:0 0 20px ${t.portScore>=80?"var(--emerald-glow)":"var(--crimson-glow)"};">
              ${t.portScore}%
            </div>
            <div>
              <h2 style="font-family:var(--font-cyber); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px;">
                Indice de Sécurité des Ports
              </h2>
              <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.2rem;">
                ${t.ports.length} port(s) détecté(s) en écoute &bull; ${t.riskBreakdown.critical||0} critique(s) &bull; ${t.riskBreakdown.high||0} élevé(s)
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
                ${t.ports.map(e=>`
                  <tr>
                    <td>
                      <span class="port-num">${e.port}</span>
                      <span style="font-size:0.75rem; color:var(--text-dim); margin-left:0.3rem;">TCP/UDP</span>
                    </td>
                    <td>
                      <div style="font-weight:600; color:var(--text-main);">${e.service}</div>
                      <div style="font-size:0.75rem; color:var(--text-dim);">${e.description}</div>
                    </td>
                    <td>
                      <span class="ip-bind-badge ${e.is_localhost_only?"local":"external"}">
                        ${e.bind_ip} ${e.is_localhost_only?"(Local)":"(Public)"}
                      </span>
                    </td>
                    <td style="font-family:var(--font-mono); font-size:0.8rem; color:var(--text-muted);">
                      ${e.process_name} ${e.pid?`(${e.pid})`:""}
                    </td>
                    <td>
                      <span class="risk-badge ${e.risk}">
                        ${e.risk==="critical"?"🔴 Critique":e.risk==="high"?"🟠 Élevé":e.risk==="medium"?"🟣 Moyen":e.risk==="low"?"🔵 Faible":"🟢 Sécurisé"}
                      </span>
                    </td>
                    <td style="font-size:0.8rem; color:var(--text-muted); max-width:320px;">
                      ${e.recommendation}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,document.getElementById("rescanPortsBtn").addEventListener("click",async()=>{try{d("Analyse des ports en cours...","info");const e=await c.ports.getPorts();t.ports=e.ports||[],t.portScore=e.score||100,t.riskBreakdown=e.risk_breakdown||{},U(),d("Scan des ports terminé.","success")}catch(e){d(e.message,"error")}}),document.getElementById("showUfwRulesBtn").addEventListener("click",async()=>{try{const e=await c.ports.getHardeningRules();document.getElementById("rulesCode").innerText=e.commands.join(`
`),document.getElementById("rulesModal").showModal()}catch(e){d(e.message,"error")}})}function x(){const a=document.getElementById("tabContent");a.innerHTML=`
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
      ${t.tools.map(e=>`
        <div class="tool-card">
          <div>
            <div class="tool-card-header">
              <div>
                <div class="tool-category">${e.category}</div>
                <div class="tool-card-title">${e.name}</div>
              </div>
              <span class="tool-status-badge ${e.status}">
                <span class="pulse-dot ${e.status==="active"?"":e.status==="not_installed"?"danger":"warning"}"></span>
                ${e.status==="active"?"ACTIF":e.status==="not_installed"?"NON INSTALLÉ":"ARRÊTÉ"}
              </span>
            </div>
            <p class="tool-desc" style="margin-top:0.85rem;">
              ${e.description}
            </p>
          </div>

          <div class="tool-footer">
            ${e.is_installed?`
              <div style="display:flex; gap:0.5rem; width:100%;">
                ${e.can_control_service?`
                  ${e.status==="active"?`
                    <button class="btn btn-outline tool-action-btn" data-tool="${e.id}" data-action="restart" style="flex:1; justify-content:center; padding:0.4rem 0.6rem; font-size:0.75rem;">
                      Redémarrer
                    </button>
                    <button class="btn btn-danger tool-action-btn" data-tool="${e.id}" data-action="stop" style="flex:1; justify-content:center; padding:0.4rem 0.6rem; font-size:0.75rem;">
                      Arrêter
                    </button>
                  `:`
                    <button class="btn btn-primary tool-action-btn" data-tool="${e.id}" data-action="start" style="flex:1; justify-content:center; padding:0.4rem 0.6rem; font-size:0.75rem;">
                      Démarrer le Service
                    </button>
                  `}
                `:`
                  <span style="font-size:0.75rem; color:var(--text-dim); font-family:var(--font-mono);">
                    Outil binaire exécutable &bull; Prêt
                  </span>
                `}
              </div>
            `:`
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <span style="font-size:0.75rem; color:var(--amber); font-family:var(--font-mono);">
                  ${e.recommended?"⭐ Fortement Recommandé":"Optionnel"}
                </span>
                <button class="btn btn-primary tool-install-btn" data-tool="${e.id}" style="padding:0.4rem 0.85rem; font-size:0.8rem;">
                  📦 Installer (apt)
                </button>
              </div>
            `}
          </div>
        </div>
      `).join("")}
    </div>
  `,document.querySelectorAll(".tool-action-btn").forEach(e=>{e.addEventListener("click",async()=>{const s=e.dataset.tool,n=e.dataset.action;try{e.disabled=!0;const i=await c.tools.control(s,n);g.playSuccess(),d(i.message,"success"),t.tools=await c.tools.getTools(),x()}catch(i){d(i.message,"error")}})}),document.querySelectorAll(".tool-install-btn").forEach(e=>{e.addEventListener("click",async()=>{const s=e.dataset.tool;try{e.disabled=!0,e.innerText="Installation...";const n=await c.tools.install(s);g.playSuccess(),d(n.message,"success"),t.tools=await c.tools.getTools(),x()}catch(n){d(n.message,"error")}})}),document.getElementById("refreshToolsBtn").addEventListener("click",async()=>{t.tools=await c.tools.getTools(),x(),d("Statut des outils actualisé.","info")})}function V(){var n,i,r,l,v,m,o,p,b,f,h,P,A,M,z,_,L,q,R;const a=document.getElementById("tabContent"),e=t.telemetry||{hostname:"raspberrypi",model:"Raspberry Pi",os:"Linux",uptime:"N/A",cpu:{percent:12,temperature_c:44.5,cores:4},memory:{total_mb:3800,used_mb:850,percent:22},disk:{total_gb:32,used_gb:7.5,percent:23},network:{bytes_sent_mb:14.2,bytes_recv_mb:45.8}},s=(((n=e.cpu)==null?void 0:n.temperature_c)||0)>60;a.innerHTML=`
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
          <span class="brand-badge">UPTIME: ${e.uptime}</span>
        </div>
        <div class="panel-body" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1.25rem;">
          <div>
            <div style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase;">Modèle Matériel</div>
            <div style="font-family:var(--font-cyber); font-size:1.15rem; font-weight:700; color:var(--cyan-neon); margin-top:0.25rem;">
              ${e.model}
            </div>
          </div>
          <div>
            <div style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase;">Nom d'Hôte (Hostname)</div>
            <div style="font-family:var(--font-mono); font-size:1rem; color:var(--text-main); margin-top:0.25rem;">
              ${e.hostname}
            </div>
          </div>
          <div>
            <div style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase;">Noyau / Système</div>
            <div style="font-family:var(--font-mono); font-size:0.85rem; color:var(--text-main); margin-top:0.25rem;">
              ${e.os} (${e.architecture||"arm64"})
            </div>
          </div>
          <div>
            <div style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase;">Cœurs Processeur</div>
            <div style="font-family:var(--font-cyber); font-size:1.15rem; font-weight:700; color:var(--emerald); margin-top:0.25rem;">
              ${((i=e.cpu)==null?void 0:i.cores)||4} Cœurs Actifs
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
            <span class="gauge-val" style="color:var(--cyan-neon);">${((r=e.cpu)==null?void 0:r.percent)||0}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${((l=e.cpu)==null?void 0:l.percent)||0}%;"></div>
          </div>
          <div class="gauge-sub">
            <span>Fréquence dynamique</span>
            <span>${((v=e.cpu)==null?void 0:v.cores)||4} Threads</span>
          </div>
        </div>

        <!-- Temperature Gauge -->
        <div class="gauge-card">
          <div class="gauge-header">
            <span class="gauge-title">Température SoC (RPi)</span>
            <span class="gauge-val" style="color:${s?"var(--crimson)":"var(--emerald)"};">
              ${((m=e.cpu)==null?void 0:m.temperature_c)||42}&deg;C
            </span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${s?"warm":""}" style="width:${Math.min(100,(((o=e.cpu)==null?void 0:o.temperature_c)||40)/85*100)}%;"></div>
          </div>
          <div class="gauge-sub">
            <span>Seuil critique: 80°C</span>
            <span>${s?"Ventilation recommandée":"Refroidissement Optimal"}</span>
          </div>
        </div>

        <!-- Memory Gauge -->
        <div class="gauge-card">
          <div class="gauge-header">
            <span class="gauge-title">Mémoire Vive (RAM)</span>
            <span class="gauge-val" style="color:var(--emerald);">${((p=e.memory)==null?void 0:p.percent)||0}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${((b=e.memory)==null?void 0:b.percent)||0}%;"></div>
          </div>
          <div class="gauge-sub">
            <span>${((f=e.memory)==null?void 0:f.used_mb)||0} Mo Utilisés</span>
            <span>${((h=e.memory)==null?void 0:h.total_mb)||0} Mo Total</span>
          </div>
        </div>

        <!-- Storage Gauge -->
        <div class="gauge-card">
          <div class="gauge-header">
            <span class="gauge-title">Stockage SD / NVMe</span>
            <span class="gauge-val" style="color:var(--purple);">${((P=e.disk)==null?void 0:P.percent)||0}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${((A=e.disk)==null?void 0:A.percent)||0}%;"></div>
          </div>
          <div class="gauge-sub">
            <span>${((M=e.disk)==null?void 0:M.used_gb)||0} Go Occupés</span>
            <span>${((z=e.disk)==null?void 0:z.total_gb)||0} Go Total</span>
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
              ${((_=e.network)==null?void 0:_.bytes_recv_mb)||0} <span style="font-size:1rem;">Mo</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-dim); font-family:var(--font-mono);">${((L=e.network)==null?void 0:L.packets_recv)||0} paquets</div>
          </div>
          <div style="width:1px; height:60px; background:rgba(255,255,255,0.1);"></div>
          <div>
            <div style="font-size:0.8rem; color:var(--text-dim); text-transform:uppercase;">Total Données Émises (TX)</div>
            <div style="font-family:var(--font-cyber); font-size:2.2rem; font-weight:700; color:var(--cyan-neon); margin-top:0.3rem;">
              ${((q=e.network)==null?void 0:q.bytes_sent_mb)||0} <span style="font-size:1rem;">Mo</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-dim); font-family:var(--font-mono);">${((R=e.network)==null?void 0:R.packets_sent)||0} paquets</div>
          </div>
        </div>
      </div>
    </div>
  `}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",O):O();
