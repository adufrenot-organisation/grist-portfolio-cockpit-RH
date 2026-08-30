/*
 * pmo-access.js v1.2.0
 * Garde d'accès applicatif pour widgets Grist.
 *
 * Sécurité réelle = ACL Grist sur les tables.
 * Cette garde bloque l'entrée du module et adapte l'UX.
 *
 * v1.2.0 : page de refus volontairement générique.
 * Aucune information sur le profil, la matrice de droits ou la raison technique
 * n'est exposée à l'utilisateur final.
 */
(() => {
  "use strict";

  const VERSION = "1.2.0";
  const RIGHTS_TABLE = "DROITS_MODULES";
  const TEAM_TABLES = ["Team", "TEAM", "Equipe"];
  const EMAIL_FIELDS = ["email", "Email", "EMAIL", "Utilisateur_Email", "Mail"];
  const PROFILE_FIELDS = ["profil", "Profil", "PROFILE", "profile", "Profile", "role", "Role", "ROLE"];

  const norm = v => String(v ?? "")
    .trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  function gristRows(data) {
    if (!data || !Array.isArray(data.id)) return [];
    const keys = Object.keys(data);
    return data.id.map((_, i) => Object.fromEntries(
      keys.map(k => [k, Array.isArray(data[k]) ? data[k][i] : data[k]])
    ));
  }

  function pick(row, fields) {
    if (!row) return null;
    for (const f of fields) {
      if (Object.prototype.hasOwnProperty.call(row, f) && row[f] !== null && row[f] !== undefined) {
        return row[f];
      }
    }
    return null;
  }

  function flag(v, defaultValue = true) {
    if (v === null || v === undefined || v === "") return defaultValue;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    return !["false", "0", "non", "no", "off", "inactive", "inactif"].includes(norm(v));
  }

  async function currentUser() {
    try {
      const u = await window.PmoPresence?.currentUser?.();
      if (u?.email || u?.Email) {
        return {
          email: u.email || u.Email || "",
          name: u.name || u.Name || u.nom || ""
        };
      }
    } catch (e) {
      console.warn("[PMO Access] Presence currentUser indisponible", e);
    }
    return {email: "", name: ""};
  }

  async function findProfile(email) {
    const tables = await grist.docApi.listTables();
    const table = TEAM_TABLES.find(t => tables.includes(t));
    if (!table) return {profile: "", table: null, found: false};

    const data = await grist.docApi.fetchTable(table);
    const rows = gristRows(data);
    const wanted = norm(email);
    const row = rows.find(r => EMAIL_FIELDS.some(f => norm(r[f]) === wanted));

    return {
      profile: String(pick(row, PROFILE_FIELDS) ?? "").trim(),
      table,
      found: !!row
    };
  }

  async function fetchWithToken(url) {
    const res = await fetch(url, {method: "GET", credentials: "omit"});
    let body = null;
    try { body = await res.json(); } catch (_) {}
    return {res, body};
  }

  async function isDocumentOwner(userEmail) {
    try {
      const tokenInfo = await grist.docApi.getAccessToken({readOnly: true});
      if (!tokenInfo?.baseUrl || !tokenInfo?.token) return false;
      const auth = `auth=${encodeURIComponent(tokenInfo.token)}`;
      const baseUrl = String(tokenInfo.baseUrl).replace(/\/+$/, "");

      try {
        const {res, body} = await fetchWithToken(`${baseUrl}/access?${auth}`);
        if (res.status === 200 && body) {
          const users = Array.isArray(body.users) ? body.users : [];
          const wanted = norm(userEmail);
          const me = users.find(u => norm(u.email) === wanted);
          const access = norm(me?.access || me?.role);
          if (["owner", "owners"].includes(access)) return true;
          if (me) return false;
        }
      } catch (e) {
        console.warn("[PMO Access] /access indisponible", e);
      }

      try {
        const {res} = await fetchWithToken(`${baseUrl}/usersForViewAs?${auth}`);
        if (res.status === 200) return true;
        if (res.status === 403) return false;
      } catch (e) {
        console.warn("[PMO Access] /usersForViewAs indisponible", e);
      }
    } catch (e) {
      console.warn("[PMO Access] Détection Owner indisponible", e);
    }
    return false;
  }

  async function moduleRows() {
    const tables = await grist.docApi.listTables();
    if (!tables.includes(RIGHTS_TABLE)) {
      throw new Error(`La table ${RIGHTS_TABLE} est absente du document.`);
    }
    return gristRows(await grist.docApi.fetchTable(RIGHTS_TABLE));
  }

  function rowMatches(row, moduleCode, profile) {
    const moduleValue = row.Module ?? row.Code_Module ?? row.module ?? "";
    const profileValue = row.Profil ?? row.Profile ?? row.Role ?? row.profil ?? "";
    const active = flag(row.Actif, true);
    const allowed = flag(row.Acces ?? row.Accès ?? row.Autorise ?? row.Autorisé, true);
    return active && allowed && norm(moduleValue) === norm(moduleCode) && norm(profileValue) === norm(profile);
  }

  function injectStyle() {
    if (document.getElementById("pmoAccessStyle")) return;
    const style = document.createElement("style");
    style.id = "pmoAccessStyle";
    style.textContent = `
      .pmo-access-gate{
        position:fixed;inset:0;z-index:2147483647;
        display:flex;align-items:center;justify-content:center;
        padding:28px;
        background:
          radial-gradient(circle at 18% 18%, rgba(67,97,238,.12), transparent 34%),
          radial-gradient(circle at 82% 76%, rgba(124,58,237,.10), transparent 30%),
          linear-gradient(145deg,#f8fafc 0%,#eef2ff 52%,#f8fafc 100%);
        font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        color:#172033;
      }
      .pmo-access-card{
        width:min(620px,100%);
        background:rgba(255,255,255,.97);
        border:1px solid rgba(148,163,184,.28);
        border-radius:24px;
        box-shadow:0 28px 80px rgba(30,41,59,.16);
        overflow:hidden;
        text-align:center;
      }
      .pmo-access-top{
        padding:38px 34px 30px;
        background:linear-gradient(135deg,#111827,#28385f);
      }
      .pmo-access-lock{
        width:72px;height:72px;border-radius:20px;margin:0 auto 20px;
        display:grid;place-items:center;background:rgba(255,255,255,.12);
        border:1px solid rgba(255,255,255,.15);font-size:34px
      }
      .pmo-access-top h1{margin:0;color:#fff;font-size:30px;line-height:1.15}
      .pmo-access-top p{margin:12px auto 0;max-width:470px;color:#cbd5e1;font-size:15px;line-height:1.6}
      .pmo-access-body{padding:28px 34px 32px}
      .pmo-access-message{
        margin:0 auto;
        max-width:480px;
        color:#475569;
        font-size:15px;
        line-height:1.65;
      }
      .pmo-access-contact{
        margin-top:20px;
        padding:15px 18px;
        border-radius:14px;
        background:#f8fafc;
        border:1px solid #e2e8f0;
        color:#334155;
        font-size:14px;
        line-height:1.5;
      }
      @media(max-width:600px){
        .pmo-access-top,.pmo-access-body{padding-left:22px;padding-right:22px}
        .pmo-access-top h1{font-size:25px}
      }
    `;
    document.head.appendChild(style);
  }

  function showDenied() {
    injectStyle();

    document.querySelectorAll("body > :not(.pmo-access-gate)").forEach(el => {
      if (el.tagName !== "SCRIPT") el.style.display = "none";
    });

    const existing = document.querySelector(".pmo-access-gate");
    if (existing) existing.remove();

    const gate = document.createElement("div");
    gate.className = "pmo-access-gate";
    gate.innerHTML = `
      <section class="pmo-access-card" role="alert" aria-live="polite">
        <div class="pmo-access-top">
          <div class="pmo-access-lock">🔒</div>
          <h1>Accès non autorisé</h1>
          <p>Vous ne disposez pas des droits nécessaires pour accéder à ce module.</p>
        </div>
        <div class="pmo-access-body">
          <p class="pmo-access-message">
            Si vous pensez devoir disposer de cet accès, veuillez contacter l’administrateur de la solution.
          </p>
          <div class="pmo-access-contact">
            Votre administrateur pourra vérifier et, si nécessaire, mettre à jour vos droits d’accès.
          </div>
        </div>
      </section>`;
    document.body.appendChild(gate);
  }

  async function check({module, label}) {
    const user = await currentUser();

    if (await isDocumentOwner(user.email)) {
      return {allowed: true, owner: true, module, label, user, profile: "Owner Grist"};
    }

    const p = await findProfile(user.email);
    const profile = p.profile;

    if (!p.found) {
      return {allowed:false, owner:false, module, label, user, profile:"",
        reason:`Aucune ligne Team ne correspond à l'utilisateur courant.`};
    }
    if (!profile) {
      return {allowed:false, owner:false, module, label, user, profile:"",
        reason:"Aucun profil applicatif détecté."};
    }

    let rights;
    try {
      rights = await moduleRows();
    } catch (e) {
      return {allowed:false, owner:false, module, label, user, profile, reason:e.message || String(e)};
    }

    const allowed = rights.some(r => rowMatches(r, module, profile));
    return {
      allowed, owner:false, module, label, user, profile,
      reason: allowed ? "" : `Aucun droit actif pour ${module}/${profile}.`
    };
  }

  async function guard(opts) {
    try {
      const result = await check(opts);
      if (!result.allowed) {
        console.warn("[PMO Access] Accès refusé", result);
        showDenied();
      }
      return result.allowed;
    } catch (e) {
      console.error("[PMO Access] Erreur de contrôle d'accès", e);
      showDenied();
      return false;
    }
  }

  window.PmoAccess = {VERSION, RIGHTS_TABLE, check, guard, isDocumentOwner};
})();
