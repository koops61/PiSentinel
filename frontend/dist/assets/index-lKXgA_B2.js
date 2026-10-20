(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const r of i)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&n(o)}).observe(document,{childList:!0,subtree:!0});function t(i){const r={};return i.integrity&&(r.integrity=i.integrity),i.referrerPolicy&&(r.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?r.credentials="include":i.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(i){if(i.ep)return;i.ep=!0;const r=t(i);fetch(i.href,r)}})();const $="pisentinel_token",y={getToken:()=>localStorage.getItem($),setToken:s=>localStorage.setItem($,s),removeToken:()=>localStorage.removeItem($)},N=()=>(window.location.pathname||"").includes("/sentinel")?"/sentinel":"";async function u(s,e={}){const t=y.getToken(),n={"Content-Type":"application/json",...e.headers||{}};t&&(n.Authorization=`Bearer ${t}`);const i=N(),r=s.startsWith("http")?s:`${i}${s}`,o=await fetch(r,{...e,headers:n});if(o.status===401){y.removeToken(),window.dispatchEvent(new CustomEvent("pisentinel:unauthorized"));const m=await o.json().catch(()=>({detail:"Session expirée"}));throw new Error(m.detail||"Non autorisé")}if(!o.ok){const m=await o.json().catch(()=>({detail:`Erreur HTTP ${o.status}`}));throw new Error(m.detail||`Erreur serveur (${o.status})`)}return o.json()}const d={auth:{getConfig:()=>u("/api/auth/config"),loginGoogle:s=>u("/api/auth/google",{method:"POST",body:JSON.stringify({credential:s})}),loginLocal:(s,e)=>u("/api/auth/login",{method:"POST",body:JSON.stringify({username:s,password:e})}),getMe:()=>u("/api/auth/me"),logout:()=>u("/api/auth/logout",{method:"POST"})},system:{getStatus:()=>u("/api/system/status"),getSummary:()=>u("/api/system/summary")},ports:{getPorts:()=>u("/api/ports"),getHardeningRules:()=>u("/api/ports/hardening-rules")},tools:{getTools:()=>u("/api/tools"),control:(s,e)=>u(`/api/tools/${s}/control`,{method:"POST",body:JSON.stringify({action:e})}),install:s=>u(`/api/tools/${s}/install`,{method:"POST"})},attacks:{getAttacks:()=>u("/api/attacks"),trigger:(s,e)=>u("/api/attacks/trigger",{method:"POST",body:JSON.stringify({ip:s,service:e})}),getBanned:()=>u("/api/attacks/banned"),ban:(s,e)=>u("/api/attacks/ban",{method:"POST",body:JSON.stringify({ip:s,reason:e})}),unban:s=>u(`/api/attacks/ban/${encodeURIComponent(s)}`,{method:"DELETE"})},audit:{getReport:()=>u("/api/audit/report"),scan:s=>u(`/api/audit/scan/${s}`,{method:"POST"}),getOptimizations:()=>u("/api/audit/optimizations"),optimize:()=>u("/api/audit/optimize",{method:"POST"})}};class Q{constructor(){this.ctx=null,this.enabled=localStorage.getItem("pisentinel_sound")==="true"}init(){if(!this.ctx&&typeof window<"u"){const e=window.AudioContext||window.webkitAudioContext;e&&(this.ctx=new e)}}toggle(){return this.enabled=!this.enabled,localStorage.setItem("pisentinel_sound",this.enabled?"true":"false"),this.enabled&&this.playBeep(880,.08,"sine"),this.enabled}playBeep(e=440,t=.1,n="sine",i=.05){if(this.enabled)try{if(this.init(),this.ctx&&this.ctx.state==="suspended"&&this.ctx.resume(),!this.ctx)return;const r=this.ctx.createOscillator(),o=this.ctx.createGain();r.type=n,r.frequency.setValueAtTime(e,this.ctx.currentTime),o.gain.setValueAtTime(i,this.ctx.currentTime),o.gain.exponentialRampToValueAtTime(1e-4,this.ctx.currentTime+t),r.connect(o),o.connect(this.ctx.destination),r.start(),r.stop(this.ctx.currentTime+t)}catch{}}playAttackAlert(){this.enabled&&(this.playBeep(880,.12,"triangle",.08),setTimeout(()=>{this.playBeep(1174,.18,"triangle",.06)},120))}playBan(){this.enabled&&(this.playBeep(320,.15,"sawtooth",.08),setTimeout(()=>{this.playBeep(180,.25,"sawtooth",.08)},100))}playSuccess(){this.enabled&&(this.playBeep(523.25,.08,"sine",.05),setTimeout(()=>{this.playBeep(659.25,.12,"sine",.05)},90))}}const p=new Q,a={user:null,authConfig:null,activeTab:"radar",telemetry:null,summary:null,ports:[],portScore:100,riskBreakdown:{},tools:[],attacks:[],bannedIps:[],wsConnected:!1,soundEnabled:p.enabled,ws:null},S=document.getElementById("app");function l(s,e="info"){let t=document.querySelector(".toast-container");t||(t=document.createElement("div"),t.className="toast-container",document.body.appendChild(t));const n=document.createElement("div");n.className=`toast ${e}`,n.innerHTML=`
    <span class="pulse-dot ${e==="error"?"danger":e==="success"?"":"warning"}"></span>
    <span>${s}</span>
  `,t.appendChild(n),setTimeout(()=>{n.style.opacity="0",n.style.transform="translateX(40px)",n.style.transition="all 0.3s ease",setTimeout(()=>n.remove(),300)},4e3)}function F(s){try{return new Date(s).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}catch{return"Récemment"}}function U(s){if(!s||s.length!==2)return"🌐";const e=s.toUpperCase().split("").map(t=>127397+t.charCodeAt(0));return String.fromCodePoint(...e)}async function O(){J();try{a.authConfig=await d.auth.getConfig()}catch(e){console.warn("Failed to load auth config:",e)}if(y.getToken())try{const e=await d.auth.getMe();a.user=e.user,await C(),w(),I();return}catch{y.removeToken()}E()}window.addEventListener("pisentinel:unauthorized",()=>{a.user=null,a.ws&&(a.ws.close(),a.ws=null),E()});async function C(){try{const[s,e,t,n,i]=await Promise.all([d.system.getSummary().catch(()=>null),d.ports.getPorts().catch(()=>({ports:[],score:100,risk_breakdown:{}})),d.tools.getTools().catch(()=>[]),d.attacks.getAttacks().catch(()=>({recent_attacks:[]})),d.attacks.getBanned().catch(()=>({banned:[]}))]);a.summary=s,a.ports=e.ports||[],a.portScore=e.score||100,a.riskBreakdown=e.risk_breakdown||{},a.tools=t||[],a.attacks=n.recent_attacks||[],a.bannedIps=i.banned||[]}catch(s){console.error("Error loading initial data:",s)}}function w(){const s=y.getToken();if(!s)return;const e=window.location.protocol==="https:"?"wss:":"ws:",t=N(),n=`${e}//${window.location.host}${t}/api/ws/telemetry?token=${encodeURIComponent(s)}`;a.ws=new WebSocket(n),a.ws.onopen=()=>{a.wsConnected=!0,D()},a.ws.onmessage=i=>{try{const r=JSON.parse(i.data);r.type==="telemetry"?(a.telemetry=r.data,K()):r.type==="attack_event"&&W(r.data)}catch(r){console.error("WS parse error:",r)}},a.ws.onclose=()=>{a.wsConnected=!1,D(),a.user&&setTimeout(w,4e3)}}function W(s){var e;a.attacks.unshift(s),a.attacks.length>50&&a.attacks.pop(),p.playAttackAlert(),l(`Alerte Attaque: ${s.type} depuis ${s.ip} (${((e=s.geo)==null?void 0:e.country)||"Inconnu"})`,"error"),a.activeTab==="radar"&&(T(),B())}function J(){S.innerHTML=`
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
  `}function E(){var s,e,t,n,i;S.innerHTML=`
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

        ${(s=a.authConfig)!=null&&s.google_enabled?`
          <div style="margin-bottom:1.25rem;">
            <div id="googleBtn" style="display:flex; justify-content:center;"></div>
            ${(e=a.authConfig)!=null&&e.whitelist_enabled?`
              <p style="font-size:0.75rem; color:var(--emerald); text-align:center; margin-top:0.6rem; font-family:var(--font-mono);">
                🛡️ Accès restreint par liste blanche Google (${a.authConfig.allowed_email_count} comptes autorisés)
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
  `,(t=a.authConfig)!=null&&t.google_enabled&&((i=(n=window.google)==null?void 0:n.accounts)!=null&&i.id)&&(window.google.accounts.id.initialize({client_id:a.authConfig.google_client_id,callback:Z}),window.google.accounts.id.renderButton(document.getElementById("googleBtn"),{theme:"filled_black",size:"large",text:"signin_with",shape:"pill",width:280})),document.getElementById("localLoginForm").addEventListener("submit",async r=>{r.preventDefault();const o=document.getElementById("loginUsername").value,m=document.getElementById("loginPassword").value;try{const v=await d.auth.loginLocal(o,m);y.setToken(v.access_token),a.user=v.user,p.playSuccess(),l("Authentification réussie !","success"),await C(),w(),I()}catch(v){p.playBan(),l(v.message,"error")}})}async function Z(s){try{const e=await d.auth.loginGoogle(s.credential);y.setToken(e.access_token),a.user=e.user,p.playSuccess(),l(`Bienvenue, ${e.user.name} !`,"success"),await C(),w(),I()}catch(e){p.playBan(),l(e.message,"error")}}function I(){var s,e,t,n,i,r,o,m,v;S.innerHTML=`
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
          <div class="brand-sub">${((s=a.telemetry)==null?void 0:s.model)||"Raspberry Pi"} &bull; ${((e=a.telemetry)==null?void 0:e.hostname)||"raspberrypi"}</div>
        </div>
      </div>

      <div class="header-telemetry">
        <div class="telemetry-pill" id="socPill">
          <span class="pulse-dot ${a.wsConnected?"":"danger"}"></span>
          <span>${a.wsConnected?"SURVEILLANCE ACTIVE":"DÉCONNECTÉ"}</span>
        </div>
        <div class="telemetry-pill">
          <span style="color:var(--cyan-neon);">TEMP</span>
          <span id="headerTemp">${((n=(t=a.telemetry)==null?void 0:t.cpu)==null?void 0:n.temperature_c)||42}&deg;C</span>
        </div>
        <div class="telemetry-pill">
          <span style="color:var(--emerald);">SCORE SÉCURITÉ</span>
          <span id="headerScore" style="font-weight:700;">${((i=a.summary)==null?void 0:i.overall_security_score)||90}%</span>
        </div>
      </div>

      <div class="header-actions">
        <!-- Sound Toggle -->
        <button id="soundToggleBtn" class="btn btn-icon ${a.soundEnabled?"active":""}" title="Sons d'alerte tactiques">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
        </button>

        <!-- User Profile Badge & Logout -->
        <div class="user-badge">
          ${(r=a.user)!=null&&r.picture?`
            <img src="${a.user.picture}" class="user-avatar" alt="Avatar" />
          `:`
            <div class="user-avatar-placeholder">${(o=a.user)!=null&&o.name?a.user.name[0]:"A"}</div>
          `}
          <span style="font-weight:600;">${((m=a.user)==null?void 0:m.name)||"Admin"}</span>
          <button id="logoutBtn" class="btn btn-outline" style="padding:0.25rem 0.55rem; font-size:0.75rem; margin-left:0.3rem;">
            Sortir
          </button>
        </div>
      </div>
    </header>

    <!-- Navigation Tabs Bar -->
    <nav class="tabs-nav-bar">
      <div class="tabs-list">
        <button class="tab-btn ${a.activeTab==="radar"?"active":""}" data-tab="radar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
          </svg>
          Attaques & Radar Temps Réel
          <span class="tab-badge" id="tabAttackCount">${a.attacks.length}</span>
        </button>

        <button class="tab-btn ${a.activeTab==="ports"?"active":""}" data-tab="ports">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
            <line x1="6" y1="6" x2="6.01" y2="6"></line>
            <line x1="6" y1="18" x2="6.01" y2="18"></line>
          </svg>
          Audit des Ports Ouverts
          <span class="tab-badge" style="background:rgba(0,242,254,0.15); color:var(--cyan-neon); border-color:var(--cyan-neon);">
            ${a.ports.length}
          </span>
        </button>

        <button class="tab-btn ${a.activeTab==="tools"?"active":""}" data-tab="tools">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          Outils de Sécurité RPi
          <span class="tab-badge" style="background:rgba(0,245,160,0.15); color:var(--emerald); border-color:var(--emerald);">
            ${a.tools.filter(c=>c.status==="active").length}/${a.tools.length}
          </span>
        </button>

        <button class="tab-btn ${a.activeTab==="system"?"active":""}" data-tab="system">
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
            <div class="stat-value" id="cardSecurityScore">${((v=a.summary)==null?void 0:v.overall_security_score)||90}%</div>
            <div class="stat-desc">Indice global de durcissement</div>
          </div>
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
        </div>

        <div class="stat-card ${a.ports.filter(c=>c.risk==="critical"||c.risk==="high").length>0?"amber":"green"}">
          <div class="stat-info">
            <div class="stat-label">Ports en Écoute</div>
            <div class="stat-value" id="cardOpenPorts">${a.ports.length}</div>
            <div class="stat-desc">
              ${a.ports.filter(c=>c.risk==="critical").length} critique(s), ${a.ports.filter(c=>c.risk==="high").length} exposé(s)
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
            <div class="stat-value" id="cardAttacks">${a.attacks.length}</div>
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
            <div class="stat-value" id="cardTools">${a.tools.filter(c=>c.status==="active").length} / ${a.tools.length}</div>
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
  `,document.querySelectorAll(".tab-btn").forEach(c=>{c.addEventListener("click",()=>{document.querySelectorAll(".tab-btn").forEach(g=>g.classList.remove("active")),c.classList.add("active"),a.activeTab=c.dataset.tab,H()})}),document.getElementById("soundToggleBtn").addEventListener("click",()=>{a.soundEnabled=p.toggle(),document.getElementById("soundToggleBtn").classList.toggle("active",a.soundEnabled),l(a.soundEnabled?"Sons tactiques activés":"Sons désactivés","info")}),document.getElementById("logoutBtn").addEventListener("click",async()=>{await d.auth.logout(),y.removeToken(),a.user=null,a.ws&&a.ws.close(),l("Déconnexion effectuée.","info"),E()}),document.getElementById("quickSimulateBtn").addEventListener("click",async()=>{var c;try{const g=await d.attacks.trigger();l(`Attaque simulée injectée depuis ${(c=g.event)==null?void 0:c.ip}`,"info")}catch(g){l(g.message,"error")}}),document.getElementById("quickBanModalBtn").addEventListener("click",()=>{document.getElementById("banIpInput").value="",document.getElementById("banModal").showModal()}),document.getElementById("banForm").addEventListener("submit",async c=>{c.preventDefault();const g=document.getElementById("banIpInput").value,b=document.getElementById("banReasonInput").value;try{const f=await d.attacks.ban(g,b);p.playBan(),l(f.message,"success"),document.getElementById("banModal").close();const h=await d.attacks.getBanned();a.bannedIps=h.banned||[],a.activeTab==="radar"&&k()}catch(f){l(f.message,"error")}}),document.getElementById("copyRulesBtn").addEventListener("click",()=>{const c=document.getElementById("rulesCode").innerText;navigator.clipboard.writeText(c),l("Règles UFW copiées dans le presse-papier !","success")}),H()}function D(){const s=document.getElementById("socPill");s&&(s.innerHTML=`
      <span class="pulse-dot ${a.wsConnected?"":"danger"}"></span>
      <span>${a.wsConnected?"SURVEILLANCE ACTIVE":"DÉCONNECTÉ"}</span>
    `)}function K(){var e;if(!a.telemetry)return;const s=document.getElementById("headerTemp");s&&(s.innerText=`${((e=a.telemetry.cpu)==null?void 0:e.temperature_c)||42}°C`),a.activeTab==="system"&&G()}function H(){a.activeTab==="radar"?k():a.activeTab==="ports"?V():a.activeTab==="tools"?x():a.activeTab==="system"&&G()}function k(){const s=document.getElementById("tabContent");s.innerHTML=`
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
            ${a.bannedIps.length} IP(s) Bannies
          </span>
        </div>
        <div class="panel-body">
          ${a.bannedIps.length===0?`
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
                  ${a.bannedIps.map(e=>{var t,n,i;return`
                    <tr>
                      <td class="port-num" style="color:var(--crimson);">${e.ip}</td>
                      <td>
                        <span style="font-size:1.1rem; margin-right:0.4rem;">${U((t=e.geo)==null?void 0:t.country_code)}</span>
                        ${((n=e.geo)==null?void 0:n.country)||"Inconnu"} (${((i=e.geo)==null?void 0:i.city)||"N/A"})
                      </td>
                      <td style="color:var(--text-muted);">${e.reason}</td>
                      <td style="font-family:var(--font-mono); font-size:0.8rem; color:var(--text-dim);">${F(e.timestamp)}</td>
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
  `,T(),B(),document.getElementById("refreshAttacksBtn").addEventListener("click",async()=>{const e=await d.attacks.getAttacks();a.attacks=e.recent_attacks||[],B(),T(),l("Journal des attaques rafraîchi.","info")}),document.querySelectorAll(".unban-btn").forEach(e=>{e.addEventListener("click",async()=>{const t=e.dataset.ip;try{const n=await d.attacks.unban(t);p.playSuccess(),l(n.message,"success");const i=await d.attacks.getBanned();a.bannedIps=i.banned||[],k()}catch(n){l(n.message,"error")}})})}function T(){const s=document.getElementById("radarThreats");if(!s)return;const e=a.attacks.slice(0,12).map((t,n)=>{var v,c,g;const i=((v=t.geo)==null?void 0:v.lat)||Math.random()*80-40,r=((c=t.geo)==null?void 0:c.lon)||Math.random()*320-160,o=Math.max(10,Math.min(90,(r+180)/360*80+10));return`
      <div class="threat-marker" style="top:${Math.max(15,Math.min(85,(90-i)/180*70+15))}%; left:${o}%;" title="${t.ip} (${((g=t.geo)==null?void 0:g.country)||"Inconnu"}) - ${t.type}"></div>
    `}).join("");s.innerHTML=e}function B(){const s=document.getElementById("attackFeedList");if(s){if(a.attacks.length===0){s.innerHTML=`
      <div style="text-align:center; padding:2rem; color:var(--text-dim); font-size:0.85rem;">
        Aucune tentative d'attaque enregistrée pour le moment.
      </div>
    `;return}s.innerHTML=a.attacks.map(e=>{var t,n;return`
    <div class="attack-item">
      <div class="attack-meta">
        <span class="attack-country-flag" title="${((t=e.geo)==null?void 0:t.country)||"Inconnu"}">
          ${U((n=e.geo)==null?void 0:n.country_code)}
        </span>
        <div>
          <div class="attack-ip">${e.ip}</div>
          <div class="attack-type">${e.type}</div>
        </div>
      </div>
      <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:0.35rem;">
        <span class="attack-target">${e.service||"Port inconnu"}</span>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span class="attack-time">${F(e.timestamp)}</span>
          <button class="btn btn-danger quick-ban-btn" data-ip="${e.ip}" style="padding:0.2rem 0.5rem; font-size:0.7rem;">
            Bloquer
          </button>
        </div>
      </div>
    </div>
  `}).join(""),s.querySelectorAll(".quick-ban-btn").forEach(e=>{e.addEventListener("click",async()=>{const t=e.dataset.ip;try{const n=await d.attacks.ban(t,"Bloqué en 1 clic depuis le flux d'attaques");p.playBan(),l(n.message,"success");const i=await d.attacks.getBanned();a.bannedIps=i.banned||[],k()}catch(n){l(n.message,"error")}})})}}function V(){const s=document.getElementById("tabContent");s.innerHTML=`
    <div class="grid-soc">
      <!-- Port Score Header Card -->
      <div class="panel" style="grid-column: span 12;">
        <div class="panel-body" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1.5rem;">
          <div style="display:flex; align-items:center; gap:1.5rem;">
            <div style="width:72px; height:72px; border-radius:50%; border:3px solid ${a.portScore>=80?"var(--emerald)":a.portScore>=60?"var(--amber)":"var(--crimson)"}; display:flex; align-items:center; justify-content:center; font-family:var(--font-cyber); font-size:1.8rem; font-weight:700; color:var(--text-main); box-shadow:0 0 20px ${a.portScore>=80?"var(--emerald-glow)":"var(--crimson-glow)"};">
              ${a.portScore}%
            </div>
            <div>
              <h2 style="font-family:var(--font-cyber); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px;">
                Indice de Sécurité des Ports
              </h2>
              <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.2rem;">
                ${a.ports.length} port(s) détecté(s) en écoute &bull; ${a.riskBreakdown.critical||0} critique(s) &bull; ${a.riskBreakdown.high||0} élevé(s)
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
                ${a.ports.map(e=>`
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
  `,document.getElementById("rescanPortsBtn").addEventListener("click",async()=>{try{l("Analyse des ports en cours...","info");const e=await d.ports.getPorts();a.ports=e.ports||[],a.portScore=e.score||100,a.riskBreakdown=e.risk_breakdown||{},V(),l("Scan des ports terminé.","success")}catch(e){l(e.message,"error")}}),document.getElementById("showUfwRulesBtn").addEventListener("click",async()=>{try{const e=await d.ports.getHardeningRules();document.getElementById("rulesCode").innerText=e.commands.join(`
`),document.getElementById("rulesModal").showModal()}catch(e){l(e.message,"error")}})}function x(){const s=document.getElementById("tabContent");s.innerHTML=`
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
      ${a.tools.map(t=>`
        <div class="tool-card">
          <div>
            <div class="tool-card-header">
              <div>
                <div class="tool-category">${t.category}</div>
                <div class="tool-card-title">${t.name}</div>
              </div>
              <span class="tool-status-badge ${t.status}">
                <span class="pulse-dot ${t.status==="active"?"":t.status==="not_installed"?"danger":t.status==="not_applicable"?"cyan":"warning"}"></span>
                ${t.status==="active"?"ACTIF":t.status==="not_installed"?"NON INSTALLÉ":t.status==="not_applicable"?"PRÊT":"ARRÊTÉ"}
              </span>
            </div>
            <p class="tool-desc" style="margin-top:0.85rem;">
              ${t.description}
            </p>
          </div>

          <div class="tool-footer">
            ${t.is_installed?`
              <div style="display:flex; gap:0.5rem; width:100%;">
                ${t.can_control_service?`
                  ${t.status==="active"?`
                    <button class="btn btn-outline tool-action-btn" data-tool="${t.id}" data-action="restart" style="flex:1; justify-content:center; padding:0.4rem 0.6rem; font-size:0.75rem;">
                      Redémarrer
                    </button>
                    <button class="btn btn-danger tool-action-btn" data-tool="${t.id}" data-action="stop" style="flex:1; justify-content:center; padding:0.4rem 0.6rem; font-size:0.75rem;">
                      Arrêter
                    </button>
                  `:`
                    <button class="btn btn-primary tool-action-btn" data-tool="${t.id}" data-action="start" style="flex:1; justify-content:center; padding:0.4rem 0.6rem; font-size:0.75rem;">
                      Démarrer le Service
                    </button>
                  `}
                `:`
                  ${t.id==="lynis"||t.id==="rkhunter"?`
                    <div style="display:flex; gap:0.4rem; width:100%;">
                      <button class="btn btn-primary run-audit-btn" data-tool="${t.id}" style="flex:1; justify-content:center; padding:0.4rem 0.5rem; font-size:0.75rem;">
                        🚀 Lancer Scan
                      </button>
                      <button class="btn btn-outline view-audit-btn" data-tool="${t.id}" style="flex:1; justify-content:center; padding:0.4rem 0.5rem; font-size:0.75rem;">
                        📋 Rapport
                      </button>
                    </div>
                  `:`
                    <span style="font-size:0.75rem; color:var(--text-dim); font-family:var(--font-mono);">
                      ${t.id==="iptables"?"🛡️ Filtrage actif via le noyau Linux & UFW":"🔍 Outil d'analyse &bull; Prêt à l'exécution"}
                    </span>
                  `}
                `}
              </div>
            `:`
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <span style="font-size:0.75rem; color:var(--amber); font-family:var(--font-mono);">
                  ${t.recommended?"⭐ Fortement Recommandé":"Optionnel"}
                </span>
                <button class="btn btn-primary tool-install-btn" data-tool="${t.id}" style="padding:0.4rem 0.85rem; font-size:0.8rem;">
                  📦 Installer (apt)
                </button>
              </div>
            `}
          </div>
        </div>
      `).join("")}
    </div>

    <!-- Section Durcissement & Optimisation Système (Hardening) -->
    <div class="panel" style="margin-top:2.5rem;">
      <div class="panel-header" style="flex-wrap:wrap; gap:1rem;">
        <div class="panel-title">
          🛡️ Optimiseur de Sécurité & Durcissement Système (1-Clic)
        </div>
        <button id="applyHardeningBtn" class="btn btn-primary">
          ⚡ Appliquer le Durcissement Recommandé
        </button>
      </div>
      <div class="panel-body">
        <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1.25rem;">
          Active automatiquement les protections du noyau Linux (sysctl) et sécurise les permissions système recommandées par Lynis pour bloquer le SYN-Flood, le spoofing d'IP et fermer les vecteurs d'attaque.
        </p>
        <div id="hardeningChecksContainer" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1rem;">
          <div style="color:var(--text-dim); font-family:var(--font-mono); font-size:0.85rem;">Chargement des paramètres de sécurité...</div>
        </div>
      </div>
    </div>
  `,j(),document.querySelectorAll(".tool-action-btn").forEach(t=>{t.addEventListener("click",async()=>{const n=t.dataset.tool,i=t.dataset.action;try{t.disabled=!0;const r=await d.tools.control(n,i);p.playSuccess(),l(r.message,"success"),a.tools=await d.tools.getTools(),x()}catch(r){l(r.message,"error")}})}),document.querySelectorAll(".tool-install-btn").forEach(t=>{t.addEventListener("click",async()=>{const n=t.dataset.tool;try{t.disabled=!0,t.innerText="Installation en cours...";const i=await d.tools.install(n);p.playSuccess(),l(i.message,"success")}catch(i){p.playAlert(),l(i.message,"error")}finally{a.tools=await d.tools.getTools(),x()}})}),document.querySelectorAll(".run-audit-btn").forEach(t=>{t.addEventListener("click",async()=>{const n=t.dataset.tool;try{t.disabled=!0,t.innerText="Scan en cours...";const i=await d.audit.scan(n);p.playSuccess(),l(i.message,"info")}catch(i){p.playAlert(),l(i.message,"error")}finally{setTimeout(()=>{t.disabled=!1,t.innerText="🚀 Lancer Scan"},5e3)}})}),document.querySelectorAll(".view-audit-btn").forEach(t=>{t.addEventListener("click",()=>{const n=t.dataset.tool;X(n)})});const e=document.getElementById("applyHardeningBtn");e&&e.addEventListener("click",async()=>{try{e.disabled=!0,e.innerText="Application en cours...";const t=await d.audit.optimize();p.playSuccess(),l(t.message,"success"),await j(),a.summary=await d.system.getSummary(),updateSummaryHeader()}catch(t){p.playAlert(),l(t.message,"error")}finally{e.disabled=!1,e.innerText="⚡ Appliquer le Durcissement Recommandé"}}),document.getElementById("refreshToolsBtn").addEventListener("click",async()=>{a.tools=await d.tools.getTools(),x(),l("Statut des outils actualisé.","info")})}async function j(){try{const s=await d.audit.getOptimizations(),e=document.getElementById("hardeningChecksContainer");if(!e)return;e.innerHTML=s.map(t=>`
      <div class="hardening-card ${t.compliant?"compliant":"non-compliant"}">
        <div>
          <div style="font-size:0.72rem; color:var(--cyan-neon); font-family:var(--font-mono); text-transform:uppercase;">${t.category}</div>
          <div style="font-family:var(--font-cyber); font-weight:700; font-size:0.95rem; margin-top:0.2rem;">${t.title}</div>
          <p style="color:var(--text-muted); font-size:0.8rem; margin-top:0.35rem; line-height:1.4;">${t.desc}</p>
        </div>
        <span class="tool-status-badge ${t.compliant?"active":"stopped"}">
          <span class="pulse-dot ${t.compliant?"":"warning"}"></span>
          ${t.compliant?"ACTIF":"À DURCIR"}
        </span>
      </div>
    `).join("")}catch(s){console.error("Error loading hardening checks:",s)}}async function X(s){p.playClick();const e=document.getElementById("auditReportModal");e&&e.remove();const t=document.createElement("dialog");t.id="auditReportModal",t.className="soc-modal",t.innerHTML=`
    <div class="modal-content audit-dialog-content">
      <div class="modal-header">
        <h3 class="modal-title">Chargement du rapport...</h3>
        <button class="close-btn" id="closeAuditModalBtn">&times;</button>
      </div>
      <div id="auditModalBody" style="padding:1rem 0;">
        <div style="color:var(--text-dim); font-family:var(--font-mono); text-align:center;">
          Lecture des journaux système de ${s.toUpperCase()}...
        </div>
      </div>
    </div>
  `,document.body.appendChild(t),t.showModal(),document.getElementById("closeAuditModalBtn").addEventListener("click",()=>{t.close(),t.remove()});try{const n=await d.audit.getReport(),i=document.getElementById("auditModalBody"),r=t.querySelector(".modal-title");if(s==="lynis"){const o=n.lynis;if(r.innerHTML="🛡️ Rapport d'Audit Lynis",!o.available){i.innerHTML=`<p style="color:var(--amber);">${o.message||"Aucun rapport disponible."}</p>`;return}i.innerHTML=`
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); padding:1rem; border-radius:var(--radius-sm); margin-bottom:1.25rem;">
          <div>
            <div style="font-size:0.8rem; color:var(--text-dim); text-transform:uppercase;">Score de Durcissement (Hardening Index)</div>
            <div style="font-family:var(--font-cyber); font-size:2.4rem; font-weight:700; color:${o.hardening_index>=75?"var(--emerald)":o.hardening_index>=60?"var(--cyan-neon)":"var(--amber)"};">
              ${o.hardening_index} <span style="font-size:1.1rem; color:var(--text-muted);">/ 100</span>
            </div>
          </div>
          <div style="text-align:right; font-family:var(--font-mono); font-size:0.8rem; color:var(--text-muted);">
            <div>Dernier Scan : ${o.scan_date}</div>
            <div style="color:var(--cyan-neon); margin-top:0.25rem;">${o.suggestions_count} suggestions d'optimisation</div>
          </div>
        </div>

        <h4 style="font-family:var(--font-cyber); font-size:1.05rem; text-transform:uppercase; color:var(--cyan-neon); margin-bottom:0.75rem;">
          Recommandations & Suggestions Prioritaires
        </h4>
        <div style="display:flex; flex-direction:column; gap:0.6rem; max-height:300px; overflow-y:auto;" class="custom-scroll">
          ${o.suggestions.map(m=>`
            <div style="background:rgba(17,26,51,0.7); border:1px solid var(--panel-border); border-left:3px solid var(--cyan-neon); border-radius:var(--radius-sm); padding:0.65rem 0.85rem;">
              <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--amber); background:rgba(255,170,0,0.15); padding:1px 5px; border-radius:3px;">${m.id}</span>
              <span style="font-size:0.85rem; margin-left:0.4rem; color:var(--text-main);">${m.desc}</span>
            </div>
          `).join("")}
        </div>
      `}else if(s==="rkhunter"){const o=n.rkhunter;if(r.innerHTML="🔍 Rapport Rootkit Hunter",!o.available){i.innerHTML=`<p style="color:var(--amber);">${o.message||"Aucun rapport disponible."}</p>`;return}i.innerHTML=`
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); padding:1rem; border-radius:var(--radius-sm); margin-bottom:1.25rem;">
          <div>
            <div style="font-size:0.8rem; color:var(--text-dim); text-transform:uppercase;">État du Système</div>
            <div style="font-family:var(--font-cyber); font-size:1.6rem; font-weight:700; color:${o.warnings_count===0?"var(--emerald)":"var(--amber)"};">
              ${o.warnings_count===0?"Système Sain & Conforme":`${o.warnings_count} Avertissement(s) Détecté(s)`}
            </div>
          </div>
          <div style="text-align:right; font-family:var(--font-mono); font-size:0.8rem; color:var(--text-muted);">
            <div>Dernier Scan : ${o.scan_date}</div>
          </div>
        </div>

        <h4 style="font-family:var(--font-cyber); font-size:1.05rem; text-transform:uppercase; color:var(--amber); margin-bottom:0.75rem;">
          Analyse des Avertissements
        </h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; max-height:300px; overflow-y:auto;" class="custom-scroll">
          ${o.warnings.length===0?`
            <div style="color:var(--emerald); font-size:0.9rem;">Aucun rootkit ni altération suspecte trouvée.</div>
          `:o.warnings.map(m=>`
            <div style="background:rgba(17,26,51,0.7); border:1px solid rgba(255,170,0,0.3); border-left:3px solid ${m.is_false_positive?"var(--cyan-neon)":"var(--crimson)"}; border-radius:var(--radius-sm); padding:0.75rem 0.95rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                <span style="font-family:var(--font-mono); font-size:0.75rem; color:${m.is_false_positive?"var(--cyan-neon)":"var(--crimson)"};">
                  ${m.is_false_positive?"✅ Faux Positif Connu (Normal sur Debian / RPi)":"⚠️ Alerte de Sécurité"}
                </span>
              </div>
              <div style="font-size:0.85rem; color:var(--text-main);">${m.explanation}</div>
              <div style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-dim); margin-top:0.35rem; word-break:break-all;">${m.raw}</div>
            </div>
          `).join("")}
        </div>
      `}}catch(n){document.getElementById("auditModalBody").innerHTML=`<p style="color:var(--crimson);">Erreur: ${n.message}</p>`}}function G(){var n,i,r,o,m,v,c,g,b,f,h,A,z,M,P,L,_,q,R;const s=document.getElementById("tabContent"),e=a.telemetry||{hostname:"raspberrypi",model:"Raspberry Pi",os:"Linux",uptime:"N/A",cpu:{percent:12,temperature_c:44.5,cores:4},memory:{total_mb:3800,used_mb:850,percent:22},disk:{total_gb:32,used_gb:7.5,percent:23},network:{bytes_sent_mb:14.2,bytes_recv_mb:45.8}},t=(((n=e.cpu)==null?void 0:n.temperature_c)||0)>60;s.innerHTML=`
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
            <div class="progress-fill" style="width:${((o=e.cpu)==null?void 0:o.percent)||0}%;"></div>
          </div>
          <div class="gauge-sub">
            <span>Fréquence dynamique</span>
            <span>${((m=e.cpu)==null?void 0:m.cores)||4} Threads</span>
          </div>
        </div>

        <!-- Temperature Gauge -->
        <div class="gauge-card">
          <div class="gauge-header">
            <span class="gauge-title">Température SoC (RPi)</span>
            <span class="gauge-val" style="color:${t?"var(--crimson)":"var(--emerald)"};">
              ${((v=e.cpu)==null?void 0:v.temperature_c)||42}&deg;C
            </span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${t?"warm":""}" style="width:${Math.min(100,(((c=e.cpu)==null?void 0:c.temperature_c)||40)/85*100)}%;"></div>
          </div>
          <div class="gauge-sub">
            <span>Seuil critique: 80°C</span>
            <span>${t?"Ventilation recommandée":"Refroidissement Optimal"}</span>
          </div>
        </div>

        <!-- Memory Gauge -->
        <div class="gauge-card">
          <div class="gauge-header">
            <span class="gauge-title">Mémoire Vive (RAM)</span>
            <span class="gauge-val" style="color:var(--emerald);">${((g=e.memory)==null?void 0:g.percent)||0}%</span>
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
            <span class="gauge-val" style="color:var(--purple);">${((A=e.disk)==null?void 0:A.percent)||0}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${((z=e.disk)==null?void 0:z.percent)||0}%;"></div>
          </div>
          <div class="gauge-sub">
            <span>${((M=e.disk)==null?void 0:M.used_gb)||0} Go Occupés</span>
            <span>${((P=e.disk)==null?void 0:P.total_gb)||0} Go Total</span>
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
              ${((L=e.network)==null?void 0:L.bytes_recv_mb)||0} <span style="font-size:1rem;">Mo</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-dim); font-family:var(--font-mono);">${((_=e.network)==null?void 0:_.packets_recv)||0} paquets</div>
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
