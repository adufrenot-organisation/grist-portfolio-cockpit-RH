const APP_VERSION="V6.50";
const T={team:"Team",teams:"Team_ref",motifs:"Motifs_RH",presence:"Presences",alerts:"Parametres_Alertes",locks:"Verrous_Periodes_RH",managers:"Managers_Equipes",requests:"Demandes_RH"};

function gristRows(data, tableName="") {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") {
    throw new Error(`Format inattendu retourné par ${tableName || "Grist"}`);
  }
  const keys = Object.keys(data).filter(k => Array.isArray(data[k]));
  if (!keys.length) {
    throw new Error(`Aucune colonne exploitable retournée par ${tableName || "Grist"}`);
  }
  const length = Math.max(...keys.map(k => data[k].length));
  const rows = [];
  for (let i = 0; i < length; i++) {
    const row = {};
    for (const key of keys) row[key] = data[key][i];
    rows.push(row);
  }
  return rows;
}
const S={team:[],teams:[],motifs:[],presence:[],params:[],userScope:{ready:false,isAdmin:false,email:"",teamIds:new Set()},visible:new Set(),alerts:[],month:new Date(),selectedMotif:null,changes:new Map(),selectedCells:new Set(),csvAnalysis:null,excelWorkbook:null,hiddenGridMotifs:new Set(),locks:[],locksTableAvailable:false,accessLevel:"full",alertsAdmin:false,alertsAllowed:false,annualAlertsAllowed:false,logsAllowed:false,alertsAdminChecked:false,alertAccessReason:"",accessDiagnostics:{},halfMonth:(new Date().getDate()<=15?1:2),managers:[],requests:[],requestsTablesReady:false,requestsAllowed:false,managedTeamIds:new Set()};
const $=id=>document.getElementById(id),num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d,esc=(s="")=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const date=v=>typeof v==="number"?new Date(v*1000):Array.isArray(v)&&v[0]==="D"?new Date(v[1]*1000):new Date(v);
const iso=v=>{const d=date(v);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const epoch=s=>Math.floor(new Date(`${s}T12:00:00`).getTime()/1000),resource=id=>S.team.find(x=>x.id===Number(id)),motif=id=>S.motifs.find(x=>x.id===Number(id));
const notify=m=>{const t=$("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)};
function defaults(){const a=new Date(),b=new Date(a);b.setDate(b.getDate()+30);$("from").value=iso(a);$("to").value=iso(b);S.month=new Date(a.getFullYear(),a.getMonth(),1)}

function canWriteCockpit(){return S.accessLevel==="full"}
function activeLocks(){return (S.locks||[]).filter(l=>l.Verrouille!==false)}
function lockDateString(v){try{return iso(v)}catch(_){return ""}}
function lockForDate(ds){return activeLocks().find(l=>{const a=lockDateString(l.Date_Debut),b=lockDateString(l.Date_Fin);return a&&b&&ds>=a&&ds<=b})||null}
function isDateLocked(v){const ds=typeof v==="string"?v:iso(v);return !!lockForDate(ds)}
function presenceState(v){return isDateLocked(v)?"Réalisé":"Ouvert"}
function presenceStateHtml(v){return isDateLocked(v)?'<span class="presence-state locked">🔒 Réalisé</span>':'<span class="presence-state open">✏️ Ouvert</span>'}
async function syncPresenceStatusForRange(from,to){
  if(!from||!to)return 0;
  const rows=(S.presence||[]).filter(r=>{const ds=iso(r.Date);return ds>=from&&ds<=to});
  const updates=rows.map(r=>{
    const ds=iso(r.Date),desired=isDateLocked(ds)?"Réalisé":"Prévisionnel";
    return r.Statut===desired?null:{id:r.id,fields:{Statut:desired}}
  }).filter(Boolean);
  if(updates.length)await grist.getTable(T.presence).update(updates);
  return updates.length
}

async function loadLocks(){
  try{
    const available=await grist.docApi.listTables();
    S.locksTableAvailable=available.includes(T.locks);
    S.locks=S.locksTableAvailable?gristRows(await grist.docApi.fetchTable(T.locks),T.locks):[];
  }catch(e){console.warn("Verrous",e);S.locks=[];S.locksTableAvailable=false}
}
function renderLockBadge(){
  const n=activeLocks().length;
  if($("lockCountBadge"))$("lockCountBadge").textContent=n?`(${n})`:"";
  if($("activeLockCount"))$("activeLockCount").textContent=String(n);
}
function renderPeriodLocks(){
  renderLockBadge();
  const list=$("periodLockList");if(!list)return;
  const ro=!canWriteCockpit();
  if($("lockReadonlyWarning"))$("lockReadonlyWarning").hidden=true;
  ["lockLabel","lockFrom","lockTo","lockComment"].forEach(id=>{if($(id))$(id).disabled=false});if($("createPeriodLock"))$("createPeriodLock").disabled=false;
  if(!S.locksTableAvailable){list.innerHTML='<div class="empty">Table Verrous_Periodes_RH absente. Appliquez la migration V6.</div>';return}
  const rows=activeLocks().slice().sort((a,b)=>lockDateString(a.Date_Debut).localeCompare(lockDateString(b.Date_Debut)));
  list.innerHTML=rows.length?rows.map(l=>{const a=lockDateString(l.Date_Debut),b=lockDateString(l.Date_Fin);return `<div class="lock-row" data-id="${l.id}"><div class="lock-icon">🔒</div><div class="lock-main"><strong>${esc(l.Libelle||"Période verrouillée")}</strong><span>${new Date(a+"T12:00:00").toLocaleDateString("fr-FR")} → ${new Date(b+"T12:00:00").toLocaleDateString("fr-FR")}</span>${l.Commentaire?`<small>${esc(l.Commentaire)}</small>`:""}</div><button class="btn secondary unlock-period-btn" type="button" >Déverrouiller</button></div>`}).join(""):'<div class="empty">Aucune période verrouillée.</div>';
  list.querySelectorAll(".unlock-period-btn").forEach(btn=>btn.onclick=async()=>{
    const id=Number(btn.closest(".lock-row").dataset.id),l=S.locks.find(x=>x.id===id);if(!l)return;
    if(!window.confirm(`Déverrouiller « ${l.Libelle||"cette période"} » ?\n\nLes présences qui ne sont plus couvertes par un autre verrou redeviendront ouvertes.`))return;
    const a=lockDateString(l.Date_Debut),b=lockDateString(l.Date_Fin);
    await grist.getTable(T.locks).update({id,fields:{Verrouille:false}});
    await loadLocks();
    const synced=await syncPresenceStatusForRange(a,b);
    if(synced)S.presence=gristRows(await grist.docApi.fetchTable(T.presence),"Presences");
    renderPeriodLocks();renderMassCalendar();renderForecast();renderRecent();pilotage();
    notify("Période déverrouillée · présences ouvertes")
  });
}
function openPeriodLocksModal(){renderPeriodLocks();const m=$("periodLocksModal");if(m){m.hidden=false;m.style.display="flex";document.body.classList.add("modal-open")}}
function closePeriodLocksModal(){const m=$("periodLocksModal");if(m){m.hidden=true;m.style.display="none";document.body.classList.remove("modal-open")}}
async function createPeriodLock(){
  const btn=$("createPeriodLock");
  const status=$("lockWriteStatus");
  const a=$("lockFrom")?.value||"";
  const b=$("lockTo")?.value||"";

  const setStatus=(msg,type="")=>{
    if(status){
      status.textContent=msg;
      status.className=`lock-write-status ${type}`.trim();
    }
  };

  if(!a||!b){
    setStatus("Renseignez les dates de début et de fin.","error");
    return notify("Renseignez la période.");
  }
  if(b<a){
    setStatus("La date de fin doit être postérieure à la date de début.","error");
    return notify("Période invalide.");
  }

  if(btn){btn.disabled=true;btn.textContent="Vérification…";}
  setStatus("Vérification de la table Grist…");

  try{
    // Re-check the table at click time instead of relying on stale UI state.
    const available=await grist.docApi.listTables();
    S.locksTableAvailable=available.includes(T.locks);
    if(!S.locksTableAvailable){
      throw new Error(`Table ${T.locks} introuvable. Appliquez la migration V6.`);
    }

    // Reload current locks immediately before checking overlap.
    await loadLocks();
    const overlaps=activeLocks().filter(l=>{
      const from=lockDateString(l.Date_Debut),to=lockDateString(l.Date_Fin);
      return from&&to&&a<=to&&b>=from;
    });
    if(overlaps.length){
      const ok=window.confirm(`Cette période chevauche ${overlaps.length} verrou(s) existant(s). Continuer ?`);
      if(!ok){
        setStatus("Verrouillage annulé.");
        return;
      }
    }

    const fields={
      Libelle:$("lockLabel")?.value.trim()||`Verrou ${a} → ${b}`,
      Date_Debut:epoch(a),
      Date_Fin:epoch(b),
      Verrouille:true,
      Commentaire:$("lockComment")?.value.trim()||""
    };

    if(btn)btn.textContent="Verrouillage…";
    setStatus("Écriture dans Grist en cours…");

    const table=grist.getTable(T.locks);
    await table.create({fields});

    // Verify persistence with a fresh fetch.
    await loadLocks();
    const created=activeLocks().find(l=>
      lockDateString(l.Date_Debut)===a &&
      lockDateString(l.Date_Fin)===b &&
      (l.Libelle||"")===fields.Libelle
    );
    if(!created){
      throw new Error("Grist n'a pas renvoyé le verrou après écriture.");
    }

    const synced=await syncPresenceStatusForRange(a,b);
    if(synced)S.presence=gristRows(await grist.docApi.fetchTable(T.presence),"Presences");

    ["lockLabel","lockFrom","lockTo","lockComment"].forEach(id=>{if($(id))$(id).value=""});
    renderPeriodLocks();
    renderMassCalendar();
    setStatus(`Période verrouillée avec succès · ${a} → ${b}`,"success");
    notify("Période verrouillée · présences réalisées");
  }catch(e){
    console.error("Création verrou",e);
    const msg=e?.message||String(e);
    setStatus(`Échec du verrouillage : ${msg}`,"error");
    notify(msg);
  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent="Verrouiller la période";
    }
  }
}

async function load(){
  $("sync").textContent="Synchronisation…";
  try {
    const available = await grist.docApi.listTables();
    const required=[T.team,T.teams,T.motifs,T.presence,T.alerts];const missing=required.filter(name=>!available.includes(name));
    if (missing.length) throw new Error(`Tables Grist absentes : ${missing.join(", ")}`);
    const [a,b,c,d,e]=await Promise.all([
      grist.docApi.fetchTable(T.team),
      grist.docApi.fetchTable(T.teams),
      grist.docApi.fetchTable(T.motifs),
      grist.docApi.fetchTable(T.presence),
      grist.docApi.fetchTable(T.alerts)
    ]);
    S.team=gristRows(a,"Team"); S.teams=gristRows(b,"Team_ref"); S.motifs=gristRows(c,"Motifs_RH"); S.presence=gristRows(d,"Presences"); S.params=gristRows(e,"Parametres_Alertes");
    if(!S.visible.size) S.motifs.filter(x=>x.Actif!==false).forEach(x=>S.visible.add(x.id));
    $("sync").textContent=`Synchronisé · Ressources ${S.team.length} · Présences ${S.presence.length}`;
    await loadLocks();
    await initUserTeamScope();
    await loadRequestsModule();
    render();
    renderRequestsModule();
    if (!S.team.length) notify("La table Team est vide : aucune ressource à afficher");
  } catch(e) {
    console.error(e);
    $("sync").textContent="Erreur de chargement";
    notify(e.message||String(e));
    throw e;
  }
}
function resourceTeamId(r){
  const v=r?.equipe??r?.Equipe??r?.Equipe_Id??r?.Team_ref??r?.Equipe_Ref;
  const id=gristRefId(v);
  return id===null?Number(v||0):Number(id)
}
function scopedTeams(){
  if(!S.userScope?.ready||S.userScope.isAdmin)return S.teams;
  return S.teams.filter(t=>S.userScope.teamIds.has(Number(t.id)))
}
function isResourceInUserScope(r){
  return !S.userScope?.ready||S.userScope.isAdmin||S.userScope.teamIds.has(resourceTeamId(r))
}
function isAdminTeamRow(r){
  const role=normAccess(r?.role??r?.Role??r?.Profil??r?.Profile??r?.Fonction??"");
  return role==="ADMIN"||role==="ADMIN_RH"||role==="ADMINISTRATEUR"||role==="ADMINISTRATEUR_RH"||role.includes("ADMIN_RH")
}
async function initUserTeamScope(){
  try{
    const u=await effectiveAccessUser(),email=String(u?.email||"").trim().toLowerCase();
    const mine=S.team.filter(r=>teamEmail(r)===email);
    const isAdmin=mine.some(isAdminTeamRow);
    const teamIds=new Set(mine.map(resourceTeamId).filter(id=>Number.isFinite(id)&&id>0));
    S.userScope={ready:true,isAdmin,email,teamIds};
    if(!isAdmin&&!teamIds.size)console.warn("[EQUIPES] Aucune équipe associée à l'utilisateur",email);
  }catch(e){
    console.warn("[EQUIPES] Identification impossible",e);
    S.userScope={ready:true,isAdmin:false,email:"",teamIds:new Set()};
  }
}
function activeTeam(){return S.team.filter(x=>x.actif!==false&&isResourceInUserScope(x))}
function render(){const opts=activeTeam().sort((a,b)=>String(a.nom).localeCompare(String(b.nom))).map(x=>`<option value="${x.id}">${esc(x.nom)}</option>`).join("");$("person").innerHTML='<option value="">Toute l’équipe</option>'+opts;renderReportTeams();renderReportMotifs();renderReconcileResources();chips();pilotage();renderRecent();alerts();renderForecast();setupAnnualYears();renderAnnualAlerts();renderMassFilters();renderMassMotifs();renderMotifInfo();renderMassCalendar();renderLockBadge()}
function chips(){$("chips").innerHTML=S.motifs.filter(x=>x.Actif!==false&&!["F","WE"].includes(x.Code)).map(x=>`<button class="chip ${S.visible.has(x.id)?"on":"off"}" data-id="${x.id}">${esc(x.Code)}</button>`).join("");$("chips").querySelectorAll("button").forEach(b=>b.onclick=()=>{const id=Number(b.dataset.id);S.visible.has(id)?S.visible.delete(id):S.visible.add(id);chips();pilotage()})}
function selected(){const a=new Date($("from").value+"T00:00:00"),b=new Date($("to").value+"T23:59:59"),pid=Number($("person").value||0);return S.presence.filter(x=>{const d=date(x.Date);return d>=a&&d<=b&&(!pid||x.Ressource===pid)&&S.visible.has(x.Motif)})}
function paramByCode(code){return S.params.find(p=>p.Code_Alerte===code&&p.Actif!==false)}
function capMinParam(){return paramByCode("CAP_MIN")}
function capThreshold(){const p=capMinParam();return p?num(p.Seuil_Orange,70):70}
function physicalParam(){
  const p=paramByCode("PRES_PHY");
  // Compatibilité avec l'ancien paramétrage en nombre de personnes.
  // Tant que l'unité n'est pas passée en %, on applique les valeurs recommandées.
  if(!p)return {Code_Alerte:"PRES_PHY",Libelle:"Présence physique minimale",Sens:"MIN",Seuil_Orange:50,Seuil_Rouge:35,Unite:"%",Actif:true,Fenetre_Jours:1};
  if(String(p.Unite||"").trim()!=="%")return {...p,Sens:"MIN",Seuil_Orange:50,Seuil_Rouge:35,Unite:"%"};
  return p;
}
function kpiSeverity(p,v){return p?(severity(p,v)||"green"):"neutral"}
function setKpiStatus(id,status,text){const el=$(id);if(!el)return;el.className=`kpi-status ${status}`;el.textContent=text}
function statusLabel(s){return s==="red"?"🔴 Critique":s==="orange"?"🟠 Vigilance":s==="green"?"🟢 Normal":"—"}
function capacityStats(rr){
  let work=0,presence=0,absence=0,remote=0,formation=0,physical=0;const count={};
  rr.forEach(r=>{const m=motif(r.Motif);if(!m)return;const excluded=["WE","F"].includes(m.Code)||m.Compte_Capacite===false;
    if(!excluded){work++;presence+=num(m.Presence_Equivalent);absence+=num(m.Absence_Equivalent)}
    if(["TL","TE","TLE"].includes(m.Code))remote+=num(m.Presence_Equivalent,1);
    if(m.Code==="FO")formation+=num(m.Presence_Equivalent,1);
    if(m.Code==="P")physical+=num(m.Presence_Equivalent,1);
    count[m.id]=(count[m.id]||0)+1;
  });
  return{work,presence,absence,remote,formation,physical,count,capacity:work?presence/work*100:0}
}
function resourcesBelowThreshold(rr,threshold){
  const by={};rr.forEach(r=>{const m=motif(r.Motif);if(!m||["WE","F"].includes(m.Code)||m.Compte_Capacite===false)return;(by[r.Ressource]??={w:0,p:0}).w++;by[r.Ressource].p+=num(m.Presence_Equivalent)});
  return Object.entries(by).map(([rid,v])=>({rid:Number(rid),rate:v.w?v.p/v.w*100:0})).filter(x=>x.rate<=threshold);
}
function pilotage(){
  const rr=selected(),st=capacityStats(rr),capP=capMinParam(),threshold=capThreshold(),below=resourcesBelowThreshold(rr,threshold);
  const physicalRate=st.work?st.physical/st.work*100:0,remoteRate=st.work?st.remote/st.work*100:0;
  const physP=physicalParam();

  $("presenceKpi").textContent=`${st.capacity.toFixed(1)} %`;
  $("presenceSub").textContent=`${st.presence.toFixed(1)} / ${st.work} jours-ressources travaillables`;
  $("absenceKpi").textContent=st.absence.toFixed(1);
  $("remoteKpi").textContent=st.remote.toFixed(1);
  $("formationKpi").textContent=st.formation.toFixed(1);

  $("capacityKpi").textContent=`${st.capacity.toFixed(1)} %`;
  const capOrange=capP?num(capP.Seuil_Orange,70):70,capRed=capP?num(capP.Seuil_Rouge,50):50;
  const capRule=capP||{Sens:"MIN",Seuil_Orange:capOrange,Seuil_Rouge:capRed};
  const capS=kpiSeverity(capRule,st.capacity);
  setKpiStatus("capacityStatus",capS,statusLabel(capS));
  $("capacitySub").textContent=`Orange ≤ ${capOrange.toFixed(0)} % · Rouge ≤ ${capRed.toFixed(0)} %`;

  $("physicalKpi").textContent=`${physicalRate.toFixed(1)} %`;
  const physS=kpiSeverity(physP,physicalRate);
  setKpiStatus("physicalStatus",physS,statusLabel(physS));
  $("physicalSub").textContent=`${st.physical.toFixed(1)} j site · Orange ≤ ${num(physP.Seuil_Orange,50).toFixed(0)} % · Rouge ≤ ${num(physP.Seuil_Rouge,35).toFixed(0)} %`;

  $("remoteRateKpi").textContent=`${remoteRate.toFixed(1)} %`;
  setKpiStatus("remoteRateStatus","info","ℹ️ Informatif");
  $("remoteRateSub").textContent=`${st.remote.toFixed(1)} jours · TL simultané surveillé séparément`;

  $("belowThresholdKpi").textContent=String(below.length);
  setKpiStatus("belowThresholdStatus",below.length?"orange":"green",below.length?"🟠 À examiner":"🟢 Aucun");
  $("belowThresholdSub").textContent=`capacité individuelle ≤ ${threshold.toFixed(0)} %`;

  $("scope").textContent=$("person").value?(resource($("person").value)?.nom||"Ressource"):"Équipe";
  bars(st.count);activityMix(st);chart(rr,threshold);forecastRealChart(rr);renderAttention(rr,below,threshold);
  S.alerts=compute();const pv=$("preview");if(pv)list(pv,S.alerts.slice(0,6));const ct=$("count");if(ct)ct.textContent=S.alerts.length
}
function bars(c){const e=Object.entries(c).sort((a,b)=>b[1]-a[1]),mx=Math.max(1,...e.map(x=>x[1]));$("bars").innerHTML=e.length?e.map(([id,v])=>{const m=motif(id);return `<div class="bar"><span>${esc(m?.Libelle||id)}</span><div class="track"><div class="fill" style="width:${v/mx*100}%;background:${esc(m?.Couleur||"#2563eb")}"></div></div><strong>${v}</strong></div>`}).join(""):'<div class="empty">Aucune donnée</div>'}
function activityMix(st){
  const el=$("activityMix");if(!el)return;const vals=[["Présentiel",st.physical,"mix-p"],["Télétravail",st.remote,"mix-tl"],["Absence",st.absence,"mix-a"],["Formation",st.formation,"mix-fo"]],total=vals.reduce((s,x)=>s+x[1],0);
  if(!total){el.innerHTML='<div class="empty">Aucune donnée</div>';return}
  el.innerHTML=`<div class="mix-bar">${vals.map(x=>`<span class="${x[2]}" style="width:${x[1]/total*100}%"></span>`).join("")}</div><div class="mix-legend">${vals.map(x=>`<div><i class="${x[2]}"></i><span>${x[0]}</span><strong>${(x[1]/total*100).toFixed(1)} %</strong></div>`).join("")}</div>`
}
function chart(rr,threshold=70){
  const by={};
  rr.forEach(r=>{
    const m=motif(r.Motif);
    if(!m||m.Compte_Capacite===false||["WE","F"].includes(m.Code))return;
    const k=iso(r.Date);by[k]??={w:0,p:0};by[k].w++;by[k].p+=num(m.Presence_Equivalent)
  });
  const ds=Object.keys(by).sort(),svg=$("chart");
  if(!ds.length){svg.innerHTML='<text x="30" y="60" class="axis">Aucune donnée</text>';return}

  const vs=ds.map(k=>by[k].p/by[k].w*100),W=900,H=300,L=48,R=16,TT=18,B=48,iw=W-L-R,ih=H-TT-B;
  const x=i=>L+(ds.length===1?iw/2:i/(ds.length-1)*iw),y=v=>TT+(100-v)/100*ih;
  const shortDate=k=>{
    const d=date(k);
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`
  };
  // Environ 7 à 9 repères temporels maximum, mais tous les points restent tracés.
  const maxTicks=8,step=Math.max(1,Math.ceil((ds.length-1)/Math.max(1,maxTicks-1)));
  const tickIdx=[];
  for(let i=0;i<ds.length;i+=step)tickIdx.push(i);
  if(tickIdx[tickIdx.length-1]!==ds.length-1)tickIdx.push(ds.length-1);

  let h="";
  [0,25,50,75,100].forEach(v=>{
    h+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" class="gridline"/>`;
    h+=`<text x="8" y="${y(v)+4}" class="axis">${v}%</text>`
  });

  // Axe des abscisses et dates.
  h+=`<line x1="${L}" x2="${W-R}" y1="${H-B}" y2="${H-B}" class="x-axis-line"/>`;
  tickIdx.forEach(i=>{
    const xx=x(i);
    h+=`<line x1="${xx}" x2="${xx}" y1="${H-B}" y2="${H-B+5}" class="x-axis-tick"/>`;
    h+=`<text x="${xx}" y="${H-B+19}" text-anchor="middle" class="axis x-axis-label">${shortDate(ds[i])}</text>`
  });

  h+=`<line x1="${L}" x2="${W-R}" y1="${y(threshold)}" y2="${y(threshold)}" class="threshold-line"/>`;
  h+=`<text x="${W-R-74}" y="${y(threshold)-6}" class="threshold-label">${threshold.toFixed(0)}%</text>`;
  h+=`<polyline points="${vs.map((v,i)=>`${x(i)},${y(v)}`).join(" ")}" class="line"/>`;

  // Points transparents élargissant la zone de survol + tooltip SVG natif.
  vs.forEach((v,i)=>{
    const label=`${new Intl.DateTimeFormat("fr-FR",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"}).format(date(ds[i]))} · Capacité ${v.toFixed(1)} %`;
    h+=`<circle cx="${x(i)}" cy="${y(v)}" r="7" class="chart-hover-point"><title>${esc(label)}</title></circle>`
  });
  svg.innerHTML=h
}
function weekKey(d){const x=new Date(d);x.setHours(0,0,0,0);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);return iso(x)}
function forecastRealChart(rr){
  const by={};
  rr.forEach(r=>{
    const m=motif(r.Motif);if(!m||m.Compte_Capacite===false||["WE","F"].includes(m.Code))return;
    const k=weekKey(date(r.Date)),kind=isDateLocked(iso(r.Date))?"real":"forecast";
    by[k]??={forecast:{w:0,p:0},real:{w:0,p:0}};
    by[k][kind].w++;by[k][kind].p+=num(m.Presence_Equivalent)
  });
  const ds=Object.keys(by).sort(),svg=$("forecastRealChart");
  if(!ds.length){svg.innerHTML='<text x="30" y="60" class="axis">Aucune donnée</text>';return}
  const W=900,H=300,L=48,R=16,T=18,B=42,iw=W-L-R,ih=H-T-B,x=i=>L+(ds.length===1?iw/2:i/(ds.length-1)*iw),y=v=>T+(100-v)/100*ih;
  const val=(k,t)=>by[k][t].w?by[k][t].p/by[k][t].w*100:null;let h="";
  [0,25,50,75,100].forEach(v=>h+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" class="gridline"/><text x="8" y="${y(v)+4}" class="axis">${v}%</text>`);
  const segments=t=>{let seg=[],all=[];ds.forEach((k,i)=>{const v=val(k,t);if(v===null){if(seg.length)all.push(seg);seg=[]}else seg.push(`${x(i)},${y(v)}`)});if(seg.length)all.push(seg);return all};
  segments("forecast").forEach(s=>h+=`<polyline points="${s.join(" ")}" class="line forecast-line"/>`);
  segments("real").forEach(s=>h+=`<polyline points="${s.join(" ")}" class="line realized-line"/>`);
  ds.forEach((k,i)=>{if(i===0||i===ds.length-1||i%Math.max(1,Math.ceil(ds.length/5))===0)h+=`<text x="${x(i)}" y="${H-12}" text-anchor="middle" class="axis">${new Date(k+"T00:00:00").toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"})}</text>`});
  svg.innerHTML=h
}
function renderAttention(rr,below,threshold){
  const items=[];below.slice(0,5).forEach(x=>items.push({level:"warn",title:`${resource(x.rid)?.nom||"Ressource"} sous le seuil de capacité`,detail:`${x.rate.toFixed(1)} % · seuil ${threshold.toFixed(0)} %`}));
  const st=capacityStats(rr);if(st.work&&st.physical/st.work*100<30)items.push({level:"info",title:"Présence physique faible",detail:`${(st.physical/st.work*100).toFixed(1)} % sur la période`});
  const alertsNow=compute().slice(0,4);alertsNow.forEach(a=>items.push({level:a.s==="red"?"danger":"warn",title:a.l,detail:`${a.dt?a.dt+" · ":""}${Number(a.v).toFixed(1)} ${a.u||""}`}));
  const unique=[];const seen=new Set();items.forEach(x=>{const k=x.title+"|"+x.detail;if(!seen.has(k)){seen.add(k);unique.push(x)}});
  $("attentionCount").textContent=String(unique.length);$("attentionList").innerHTML=unique.length?unique.slice(0,8).map(x=>`<div class="attention-item ${x.level}"><span></span><div><strong>${esc(x.title)}</strong><small>${esc(x.detail)}</small></div></div>`).join(""):'<div class="attention-ok">Aucun point d’attention sur la sélection.</div>'
}
function severity(p,v){const o=num(p.Seuil_Orange),r=num(p.Seuil_Rouge);if(p.Sens==="MIN"){if(v<=r)return"red";if(v<=o)return"orange"}else{if(v>=r)return"red";if(v>=o)return"orange"}return null}
function forecast(a,b){return S.presence.filter(r=>{const d=date(r.Date),ds=iso(r.Date);return d>=a&&d<=b&&!isDateLocked(ds)})}
function compute(){
  const now=new Date();now.setHours(0,0,0,0);
  const out=[],team=activeTeam(),add=(p,l,v,dt="")=>{const s=severity(p,v);if(s)out.push({s,l,v,u:p.Unite||"",dt,code:p.Code_Alerte||""})};
  S.params.filter(p=>p.Actif!==false).forEach(raw=>{
    const p=raw.Code_Alerte==="PRES_PHY"?physicalParam():raw;
    const days=Math.max(1,num(p.Fenetre_Jours,1)),end=new Date(now);end.setDate(end.getDate()+days-1);
    const rr=forecast(now,end);

    if(p.Code_Alerte==="ABS_IND")team.forEach(pe=>{let v=0;rr.filter(r=>r.Ressource===pe.id).forEach(r=>v+=num(motif(r.Motif)?.Absence_Equivalent));add(p,`${pe.nom} · absences prévues`,v)});

    if(p.Code_Alerte==="ABS_EQ"){
      let abs=0,w=0;
      rr.forEach(r=>{const m=motif(r.Motif);if(m&&m.Compte_Capacite!==false){w++;abs+=num(m.Absence_Equivalent)}});
      add(p,"Équipe · taux d’absence prévu",w?abs/w*100:0)
    }

    if(["CAP_MIN","PRES_PHY","TL_SIM","FO_SIM"].includes(p.Code_Alerte)){
      const by={};rr.forEach(r=>(by[iso(r.Date)]??=[]).push(r));
      Object.entries(by).forEach(([d,day])=>{
        let v=0;
        if(p.Code_Alerte==="CAP_MIN"){
          let pr=0,w=0;day.forEach(r=>{const m=motif(r.Motif);if(m&&m.Compte_Capacite!==false){w++;pr+=num(m.Presence_Equivalent)}});
          v=w?pr/w*100:100
        }
        if(p.Code_Alerte==="PRES_PHY")v=day.filter(r=>motif(r.Motif)?.Code==="P").length/Math.max(1,team.length)*100;
        if(p.Code_Alerte==="TL_SIM")v=day.filter(r=>["TL","TE","TLE"].includes(motif(r.Motif)?.Code)).length/Math.max(1,team.length)*100;
        if(p.Code_Alerte==="FO_SIM")v=day.filter(r=>motif(r.Motif)?.Code==="FO").length/Math.max(1,team.length)*100;
        add(p,p.Libelle,v,d)
      })
    }
  });
  return out.sort((a,b)=>(a.s==="red"?0:1)-(b.s==="red"?0:1))
}

function annualAbsenceParam(){
  const p=paramByCode("ABS_ANNUEL");
  return p||{Code_Alerte:"ABS_ANNUEL",Libelle:"Absence annuelle individuelle",Seuil_Orange:50,Seuil_Rouge:55,Unite:"jours",Sens:"MAX",Actif:true,Fenetre_Jours:365}
}
function annualYearRows(year){
  const a=`${year}-01-01`,b=`${year}-12-31`;
  return S.presence.filter(r=>{const ds=iso(r.Date);return ds>=a&&ds<=b})
}
function annualDailyValue(code,day,team){
  if(code==="CAP_MIN"){
    let pr=0,w=0;day.forEach(r=>{const m=motif(r.Motif);if(m&&m.Compte_Capacite!==false&&!["WE","F"].includes(m.Code)){w++;pr+=num(m.Presence_Equivalent)}});
    return w?pr/w*100:null
  }
  if(code==="PRES_PHY")return day.length?day.filter(r=>motif(r.Motif)?.Code==="P").length/Math.max(1,team.length)*100:null;
  if(code==="TL_SIM")return day.length?day.filter(r=>["TL","TE","TLE"].includes(motif(r.Motif)?.Code)).length/Math.max(1,team.length)*100:null;
  if(code==="FO_SIM")return day.length?day.filter(r=>motif(r.Motif)?.Code==="FO").length/Math.max(1,team.length)*100:null;
  return null
}
function annualDailyStats(rr){
  const team=activeTeam(),by={};rr.forEach(r=>(by[iso(r.Date)]??=[]).push(r));
  return ["CAP_MIN","PRES_PHY","TL_SIM","FO_SIM"].map(code=>{
    let p=code==="PRES_PHY"?physicalParam():paramByCode(code);
    if(!p||p.Actif===false)return null;
    let orange=0,red=0;
    Object.values(by).forEach(day=>{
      const v=annualDailyValue(code,day,team);if(v===null)return;
      const s=severity(p,v);if(s==="red")red++;else if(s==="orange")orange++
    });
    return {code,p,orange,red,total:orange+red}
  }).filter(Boolean)
}
function annualStateBadge(s){
  return s==="red"?'<span class="presence-state annual-red">🔴 Critique</span>':s==="orange"?'<span class="presence-state annual-orange">🟠 Vigilance</span>':'<span class="presence-state annual-green">🟢 Normal</span>'
}
function setupAnnualYears(){
  const el=$("annualAlertYear");if(!el)return;
  const years=new Set([new Date().getFullYear()]);
  S.presence.forEach(r=>{const d=date(r.Date);if(!Number.isNaN(d.getTime()))years.add(d.getFullYear())});
  const current=Number(el.value)||new Date().getFullYear();
  el.innerHTML=[...years].sort((a,b)=>b-a).map(y=>`<option value="${y}">${y}</option>`).join("");
  el.value=[...el.options].some(o=>Number(o.value)===current)?String(current):el.options[0]?.value||String(new Date().getFullYear())
}
function renderAnnualAlerts(){
  if(!S.annualAlertsAllowed){if($("annualAbsenceRows"))$("annualAbsenceRows").innerHTML="";if($("annualDailyRows"))$("annualDailyRows").innerHTML="";return}
  const year=Number($("annualAlertYear")?.value)||new Date().getFullYear(),rr=annualYearRows(year),p=annualAbsenceParam(),team=activeTeam();
  const orange=num(p.Seuil_Orange,50),red=num(p.Seuil_Rouge,55);
  if($("annualAbsenceThresholdInfo"))$("annualAbsenceThresholdInfo").textContent=`ABS_ANNUEL · Orange ≥ ${orange.toFixed(1)} jours · Rouge ≥ ${red.toFixed(1)} jours`;
  let critical=0,warning=0;
  const rows=team.map(pe=>{
    let done=0,planned=0;
    rr.filter(r=>r.Ressource===pe.id).forEach(r=>{
      const a=num(motif(r.Motif)?.Absence_Equivalent);
      if(isDateLocked(iso(r.Date)))done+=a;else planned+=a
    });
    const total=done+planned,s=severity(p,total)||"green";
    if(s==="red")critical++;else if(s==="orange")warning++;
    return {pe,done,planned,total,s}
  }).sort((a,b)=>({red:0,orange:1,green:2}[a.s]-{red:0,orange:1,green:2}[b.s])||(b.total-a.total));
  if($("annualCritical"))$("annualCritical").textContent=critical;
  if($("annualWarning"))$("annualWarning").textContent=warning;
  if($("annualAbsenceRows"))$("annualAbsenceRows").innerHTML=rows.length?rows.map(x=>`<tr><td><strong>${esc(x.pe.nom||"")}</strong></td><td>${x.done.toFixed(1)}</td><td>${x.planned.toFixed(1)}</td><td><strong>${x.total.toFixed(1)}</strong></td><td>${orange.toFixed(1)}</td><td>${red.toFixed(1)}</td><td>${annualStateBadge(x.s)}</td></tr>`).join(""):'<tr><td colspan="7" class="empty">Aucune ressource active.</td></tr>';
  const daily=annualDailyStats(rr);
  const cap=daily.find(x=>x.code==="CAP_MIN"),tl=daily.find(x=>x.code==="TL_SIM");
  if($("annualCapDays"))$("annualCapDays").textContent=cap?.total||0;
  if($("annualTlDays"))$("annualTlDays").textContent=tl?.total||0;
  if($("annualDailyRows"))$("annualDailyRows").innerHTML=daily.length?daily.map(x=>`<tr><td><strong>${esc(x.p.Libelle||x.code)}</strong><small class="annual-code">${x.code}</small></td><td>${num(x.p.Seuil_Orange).toFixed(1)} ${esc(x.p.Unite||"")}</td><td>${num(x.p.Seuil_Rouge).toFixed(1)} ${esc(x.p.Unite||"")}</td><td>${x.orange}</td><td>${x.red}</td><td><strong>${x.total}</strong></td></tr>`).join(""):'<tr><td colspan="6" class="empty">Aucun seuil journalier actif.</td></tr>'
}
function alertDetails(a){
 const p=a.code==="PRES_PHY"?physicalParam():paramByCode(a.code),threshold=a.s==="red"?num(p?.Seuil_Rouge):num(p?.Seuil_Orange),team=activeTeam(),ds=a.dt||"",day=ds?S.presence.filter(r=>iso(r.Date)===ds&&!isDateLocked(ds)):[];
 const names=codes=>day.filter(r=>codes.includes(motif(r.Motif)?.Code)).map(r=>resource(r.Ressource)?.nom).filter(Boolean);let cause="",people=[],action="";
 if(a.code==="PRES_PHY"){const site=names(["P"]),remote=names(["TL","TE","TLE"]),absent=day.filter(r=>num(motif(r.Motif)?.Absence_Equivalent)>0).map(r=>resource(r.Ressource)?.nom).filter(Boolean);cause=`${site.length}/${team.length} sur site · ${remote.length} en télétravail · ${absent.length} en absence`;people=[...remote,...absent];action="Revoir les présences sur site ou le planning télétravail."}
 else if(a.code==="TL_SIM"){people=names(["TL","TE","TLE"]);cause=`${people.length}/${team.length} ressources en télétravail`;action="Répartir le télétravail sur d’autres journées."}
 else if(a.code==="FO_SIM"){people=names(["FO"]);cause=`${people.length}/${team.length} ressources en formation`;action="Vérifier la couverture opérationnelle ou répartir les formations."}
 else if(a.code==="CAP_MIN"){people=day.filter(r=>{const m=motif(r.Motif);return m&&m.Compte_Capacite!==false&&num(m.Presence_Equivalent)<1}).map(r=>resource(r.Ressource)?.nom).filter(Boolean);cause=people.length?`${people.length} ressource(s) réduisent la capacité disponible`:"Capacité disponible sous le seuil";action="Examiner absences, télétravail et formations de cette journée."}
 else if(a.code==="ABS_IND"){people=[(a.l||"").split(" · ")[0]];cause=`Absences prévues cumulées : ${Number(a.v).toFixed(1)} ${a.u||""}`;action="Vérifier le planning individuel et la continuité d’activité."}
 else if(a.code==="ABS_EQ"){cause=`Taux d’absence prévu de l’équipe : ${Number(a.v).toFixed(1)} ${a.u||""}`;action="Identifier les journées et ressources qui concentrent les absences."}
 return{threshold,cause,people:[...new Set(people)].slice(0,8),action}
}
function list(el,a){
 if(!el)return;const level=$("alertLevelFilter")?.value||"",q=($("alertSearch")?.value||"").trim().toLowerCase();
 const filtered=a.filter(x=>(!level||x.s===level)&&(!q||`${x.l} ${x.dt} ${x.code||""} ${alertDetails(x).people.join(" ")}`.toLowerCase().includes(q)));
 if($("alertCriticalCount"))$("alertCriticalCount").textContent=a.filter(x=>x.s==="red").length;if($("alertWarningCount"))$("alertWarningCount").textContent=a.filter(x=>x.s==="orange").length;if($("alertDatesCount"))$("alertDatesCount").textContent=new Set(a.map(x=>x.dt).filter(Boolean)).size;
 el.innerHTML=filtered.length?filtered.map(x=>{const d=alertDetails(x),dl=x.dt?date(x.dt).toLocaleDateString("fr-FR"):"Fenêtre";return `<div class="alert ${x.s} alert-card"><div class="alert-card-top"><span class="alert-level">${x.s==="red"?"🔴 Critique":"🟠 Vigilance"}</span><strong>${esc(x.l)}</strong><span class="alert-date">✏️ ${esc(dl)}</span></div><div class="alert-metrics"><b>${Number(x.v).toFixed(1)} ${esc(x.u||"")}</b><span>Seuil ${x.s==="red"?"rouge":"orange"} : ${Number(d.threshold).toFixed(1)} ${esc(x.u||"")}</span></div>${d.cause?`<div class="alert-cause"><strong>Pourquoi ?</strong> ${esc(d.cause)}</div>`:""}${d.people.length?`<div class="alert-people"><strong>Personnes concernées</strong> ${d.people.map(n=>`<span>${esc(n)}</span>`).join("")}</div>`:""}${d.action?`<div class="alert-action"><strong>Action à envisager</strong><span>${esc(d.action)}</span></div>`:""}</div>`}).join(""):'<div class="empty">Aucune alerte correspondant aux filtres.</div>'
}
function alerts(){S.alerts=compute();if(S.alertsAllowed&&$("allAlerts"))list($("allAlerts"),S.alerts);else if($("allAlerts"))$("allAlerts").innerHTML=""}
function renderRecent(){const el=$("recent");if(!el)return;const rr=S.presence.slice().sort((a,b)=>date(b.Date)-date(a.Date)).slice(0,30);el.innerHTML=rr.map(r=>`<tr><td>${date(r.Date).toLocaleDateString("fr-FR")}</td><td>${esc(resource(r.Ressource)?.nom||"")}</td><td>${esc(motif(r.Motif)?.Code||"")}</td><td>${presenceStateHtml(iso(r.Date))}</td><td>${esc(r.Commentaire||"")}</td></tr>`).join("")}

function teamRef(id){return S.teams.find(x=>x.id===Number(id))}
function renderForecast(){
  const now=new Date();now.setHours(0,0,0,0);
  const rr=S.presence.filter(r=>date(r.Date)>=now&&!isDateLocked(iso(r.Date))).slice().sort((a,b)=>date(a.Date)-date(b.Date)).slice(0,150);
  $("forecastRows").innerHTML=rr.length?rr.map(r=>`<tr><td>${date(r.Date).toLocaleDateString("fr-FR")}</td><td>${esc(resource(r.Ressource)?.nom||"")}</td><td>${esc(motif(r.Motif)?.Code||"")}</td><td>${presenceStateHtml(iso(r.Date))}</td><td>${esc(r.Commentaire||"")}</td></tr>`).join(""):'<tr><td colspan="5" class="empty">Aucune présence ouverte à venir.</td></tr>'
}
function motifSoftColor(code){const map={"A":["#daf2d8","#258a31"],"1/2 M":["#dcecff","#2672c5"],"1/2 AM":["#dcecff","#2672c5"],"FO":["#fff0cf","#b06d00"],"F":["#eee5fa","#7a45b2"],"WE":["#eef1f4","#4f6474"],"TE":["#d9f3f2","#12877f"],"TLE":["#d9f3f2","#12877f"],"TL":["#d9f3f2","#12877f"],"P":["#ffe0e8","#d83467"]};return map[code]||["#e8f4f3","#176b68"]}
function renderMassFilters(){const el=$("massTeam");if(!el)return;const current=el.value;const teams=scopedTeams();
const allOption=(S.userScope.isAdmin||teams.length>1)?'<option value="">Toutes les équipes autorisées</option>':"";
el.innerHTML=allOption+teams.map(t=>`<option value="${t.id}">${esc(t.Libelle||t.Code||"Équipe")}</option>`).join("");
if(!S.userScope.isAdmin&&teams.length===1)el.value=String(teams[0].id);if([...el.options].some(o=>o.value===current))el.value=current}
function renderMassMotifs(){const el=$("massMotifs");if(!el)return;const usable=S.motifs.filter(m=>m.Actif!==false);if(!S.selectedMotif&&usable.length)S.selectedMotif=usable.find(m=>m.Code==="A")?.id||usable[0].id;el.innerHTML=usable.map(m=>{const [bg,fg]=motifSoftColor(m.Code);return `<button class="motif-btn ${S.selectedMotif===m.id?"active":""}" data-id="${m.id}" style="background:${bg};color:${fg}">${esc(m.Code)}<small>${esc(m.Libelle||"")}</small></button>`}).join("");el.querySelectorAll(".motif-btn").forEach(b=>b.onclick=()=>{S.selectedMotif=Number(b.dataset.id);renderMassMotifs()})}
function massResources(){const team=Number($("massTeam").value||0),activeOnly=$("massActiveOnly").checked;return S.team.filter(r=>isResourceInUserScope(r)&&(!team||resourceTeamId(r)===team)&&(!activeOnly||r.actif!==false)).sort((a,b)=>String(a.nom).localeCompare(String(b.nom)))}
function daysInMonth(d){const y=d.getFullYear(),m=d.getMonth(),n=new Date(y,m+1,0).getDate();return Array.from({length:n},(_,i)=>new Date(y,m,i+1))}
function daysInCurrentHalf(d){
  const all=daysInMonth(d);
  return S.halfMonth===1?all.slice(0,15):all.slice(15);
}
function halfMonthLabel(d){
  const all=daysInMonth(d),days=daysInCurrentHalf(d);
  const month=d.toLocaleDateString("fr-FR",{month:"long",year:"numeric"}).replace(/^./,c=>c.toUpperCase());
  if(!days.length)return month;
  return `${month} · ${String(days[0].getDate()).padStart(2,"0")}–${String(days[days.length-1].getDate()).padStart(2,"0")}`;
}
function previousHalfMonth(){
  if(S.halfMonth===2){S.halfMonth=1}
  else{S.month=new Date(S.month.getFullYear(),S.month.getMonth()-1,1);S.halfMonth=2}
  clearSelection();
}
function nextHalfMonth(){
  if(S.halfMonth===1){S.halfMonth=2}
  else{S.month=new Date(S.month.getFullYear(),S.month.getMonth()+1,1);S.halfMonth=1}
  clearSelection();
}
function presenceFor(resourceId,dateStr){return S.presence.find(r=>r.Ressource===resourceId&&iso(r.Date)===dateStr)}
function cellKey(resourceId,dateStr){return `${resourceId}|${dateStr}`}
function displayMotifForCell(resourceId,dateStr){const key=cellKey(resourceId,dateStr);if(S.changes.has(key))return S.changes.get(key);const old=presenceFor(resourceId,dateStr);return old?old.Motif:null}
function initials(name=""){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()}
function renderMotifVisibility(){
  const el=$("motifVisibilityList");
  if(!el)return;
  const items=S.motifs.filter(m=>m.Actif!==false);
  el.innerHTML=items.map(m=>{
    const hidden=S.hiddenGridMotifs.has(m.id);
    const c=motifSoftColor(m.Code);
    return `<button type="button" class="motif-visibility-tile ${hidden?"hidden":"visible"}" data-id="${m.id}" style="background:${c[0]};color:${c[1]}">
      <span class="motif-visibility-code">${esc(m.Code)}</span>
      <span class="motif-visibility-label">${esc(m.Libelle||"")}</span>
      <span class="motif-visibility-state">${hidden?"Masqué":"Visible"}</span>
    </button>`;
  }).join("");
  el.querySelectorAll(".motif-visibility-tile").forEach(b=>b.onclick=()=>{
    const id=Number(b.dataset.id);
    if(S.hiddenGridMotifs.has(id))S.hiddenGridMotifs.delete(id);
    else S.hiddenGridMotifs.add(id);
    renderMotifVisibility();
    renderMassCalendar();
  });
}
function showAllGridMotifs(){
  S.hiddenGridMotifs.clear();
  renderMotifVisibility();
  renderMassCalendar();
  notify("Tous les motifs sont affichés.");
}
function hideAllGridMotifs(){
  S.hiddenGridMotifs.clear();
  S.motifs.filter(m=>m.Actif!==false).forEach(m=>S.hiddenGridMotifs.add(Number(m.id)));
  renderMotifVisibility();
  renderMassCalendar();
  notify("Tous les motifs sont masqués.");
}
function renderMassCalendar(){const res=massResources(),days=daysInCurrentHalf(S.month),today=iso(new Date());$("resourceCount").textContent=`${res.length} ressource${res.length>1?"s":""} affichée${res.length>1?"s":""}`;$("monthLabel").textContent=halfMonthLabel(S.month);$("massHead").innerHTML=`<tr><th class="sticky-name">Ressource</th><th class="sticky-team">Équipe</th>${days.map(d=>{const w=[0,6].includes(d.getDay()),ds=iso(d);return `<th class="day-head ${w?"weekend":""}">${d.toLocaleDateString("fr-FR",{weekday:"short"}).replace(".","")}<strong>${String(d.getDate()).padStart(2,"0")}</strong></th>`}).join("")}</tr>`;$("massBody").innerHTML=res.map(r=>`<tr><td class="sticky-name"><div class="resource-name"><span class="avatar">${initials(r.nom)}</span><span>${esc(r.nom)}</span></div></td><td class="sticky-team">${esc(teamRef(r.equipe)?.Libelle||teamRef(r.equipe)?.Code||"—")}</td>${days.map(d=>{const ds=iso(d),key=cellKey(r.id,ds),mid=displayMotifForCell(r.id,ds),m=motif(mid),weekend=[0,6].includes(d.getDay()),selected=S.selectedCells.has(key),changed=S.changes.has(key),locked=isDateLocked(ds),hidden=!!(m&&S.hiddenGridMotifs.has(m.id)),shown=m&&!hidden,colors=shown?motifSoftColor(m.Code):["#fff","#fff"];return `<td class="resource-cell ${weekend?"weekend":""} ${selected?"selected":""} ${shown?"has-value":""} ${hidden?"motif-hidden":""} ${locked?"period-locked":""}" title="${locked?"Période verrouillée":hidden?esc((m.Libelle||m.Code)+" — masqué"):""}"><button class="cell-toggle" data-r="${r.id}" data-d="${ds}" ${locked?"disabled":""}><span class="cell-box" style="${shown?`background:${colors[0]};color:${colors[1]};border:1px solid ${colors[1]}44`:""}">${shown?esc(m.Code):""}</span>${locked?'<span class="period-lock-mark">🔒</span>':""}${hidden?'<span class="hidden-motif-dot"></span>':""}${changed?'<span class="modified-dot"></span>':""}</button></td>`}).join("")}</tr>`).join("");$("massBody").querySelectorAll(".cell-toggle").forEach(b=>b.onclick=()=>toggleCell(Number(b.dataset.r),b.dataset.d));$("saveSummary").textContent=S.changes.size?`${S.changes.size} modification${S.changes.size>1?"s":""} en attente`:""}
function toggleCell(resourceId,dateStr){if(isDateLocked(dateStr))return notify("Période verrouillée : déverrouillez-la avant modification.");const key=cellKey(resourceId,dateStr),old=presenceFor(resourceId,dateStr);if(!S.selectedMotif)return notify("Sélectionnez d'abord un motif.");S.selectedCells.add(key);S.changes.set(key,S.selectedMotif);renderMassCalendar()}
function selectAllVisible(){if(!S.selectedMotif)return notify("Sélectionnez un motif.");const res=massResources(),days=daysInCurrentHalf(S.month).filter(d=>![0,6].includes(d.getDay())&&!isDateLocked(iso(d)));res.forEach(r=>days.forEach(d=>{const ds=iso(d),key=cellKey(r.id,ds);S.selectedCells.add(key);S.changes.set(key,S.selectedMotif)}));renderMassCalendar()}
function clearSelection(){S.selectedCells.clear();S.changes.clear();renderMassCalendar()}
function deleteSelection(){if(!S.selectedCells.size)return notify("Aucune case sélectionnée.");S.selectedCells.forEach(key=>S.changes.set(key,null));renderMassCalendar()}
async function saveMass(){if(!S.changes.size)return notify("Aucune modification à enregistrer.");const lc=[...S.changes.keys()].filter(k=>isDateLocked(k.split("|")[1]));if(lc.length)throw new Error(`${lc.length} modification(s) concernent une période verrouillée.`);const table=grist.getTable(T.presence),creates=[],updates=[];for(const [key,mid] of S.changes.entries()){const [ridStr,ds]=key.split("|"),rid=Number(ridStr),old=presenceFor(rid,ds);if(mid===null){if(old)updates.push({id:old.id,fields:{Motif:0,Commentaire:"",Source:"Widget"}});continue}const fields={Ressource:rid,Date:epoch(ds),Motif:Number(mid),Statut:"Prévisionnel",Commentaire:$("massComment").value.trim(),Source:"Widget"};old?updates.push({id:old.id,fields}):creates.push({fields})}if(updates.length)await table.update(updates);if(creates.length)await table.create(creates);const total=creates.length+updates.length;S.changes.clear();S.selectedCells.clear();notify(`${total} modification${total>1?"s":""} enregistrée${total>1?"s":""}`);await load()}
function renderLegend(){const el=$("massLegend");if(!el)return;el.innerHTML=S.motifs.filter(m=>m.Actif!==false).map(m=>{const [bg,fg]=motifSoftColor(m.Code);return `<div class="legend-item"><span class="legend-code" style="background:${bg};color:${fg}">${esc(m.Code)}</span><span>${esc(m.Libelle||"")}</span></div>`}).join("")}
const CSV_HEADER=["Nom_Ressource","Email","Equipe_Code","Role","Capacite_ETP","Date","Motif","Commentaire"];
const CSV_EXAMPLE=[CSV_HEADER.join(";"),"Alice Martin;alice@example.com;ACC;Dev;1;2026-09-01;TL;Télétravail","Nouveau Collab;new@example.com;ACC;QA;1;2026-09-02;FO;Formation"].join("\\n");
function csvSetup(){const b=new Blob(["\\ufeff"+CSV_EXAMPLE],{type:"text/csv;charset=utf-8"});$("downloadTemplate").href=URL.createObjectURL(b)}
function csvLine(s,sep){let a=[],c="",q=false;for(let i=0;i<s.length;i++){let x=s[i];if(x=='"'){if(q&&s[i+1]=='"'){c+='"';i++}else q=!q}else if(x===sep&&!q){a.push(c);c=""}else c+=x}a.push(c);return a}

function csvHeaderKey(v){
  return String(v??"")
    .replace(/^\uFEFF/,"")
    .replace(/\u00A0/g," ")
    .trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[\s_-]+/g,"");
}
const CSV_HEADER_ALIASES={
  nomressource:"Nom_Ressource",
  email:"Email",
  equipecode:"Equipe_Code",
  role:"Role",
  capaciteetp:"Capacite_ETP",
  date:"Date",
  motif:"Motif",
  statut:"Statut",
  commentaire:"Commentaire"
};
function canonicalCsvHeader(v){
  const clean=String(v??"").replace(/^\uFEFF/,"").replace(/\u00A0/g," ").trim();
  return CSV_HEADER_ALIASES[csvHeaderKey(clean)]||clean;
}

async function readCsvFileText(file){const buf=await file.arrayBuffer(),bytes=new Uint8Array(buf);try{const txt=new TextDecoder("utf-8",{fatal:true}).decode(bytes);if(!txt.includes("\uFFFD"))return txt}catch(e){}try{return new TextDecoder("windows-1252").decode(bytes)}catch(e){return new TextDecoder("utf-8").decode(bytes)}}
function normalizeCsvDate(v){const s=String(v??"").trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(m){const y=+m[1],mo=+m[2],d=+m[3],dt=new Date(y,mo-1,d,12);if(dt.getFullYear()===y&&dt.getMonth()===mo-1&&dt.getDate()===d)return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`}m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);if(m){const d=+m[1],mo=+m[2],y=+m[3],dt=new Date(y,mo-1,d,12);if(dt.getFullYear()===y&&dt.getMonth()===mo-1&&dt.getDate()===d)return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`}return ""}
function normalizeCsvStatus(v){let s=String(v??"").trim().replace(/\u00A0/g," ");s=s.replace(/^Pr.visionnel$/i,"Prévisionnel").replace(/^Confirm.$/i,"Confirmé").replace(/^R.alis.$/i,"Réalisé");const k=s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();if(k==="previsionnel")return "Prévisionnel";if(k==="confirme")return "Confirmé";if(k==="realise")return "Réalisé";return s}
function csvParse(t){t=String(t??"").replace(/^\uFEFF/,"").replace(/\r\n/g,"\n").replace(/\r/g,"\n");let l=t.split("\n").filter(x=>x.trim());if(!l.length)return{headers:[],rows:[]};let sep=(l[0].match(/;/g)||[]).length>=(l[0].match(/,/g)||[]).length?";":",";let rawHeaders=csvLine(l[0],sep),hh=rawHeaders.map(canonicalCsvHeader);return{headers:hh,rawHeaders,rows:l.slice(1).map((x,n)=>{let v=csvLine(x,sep),o={_line:n+2};hh.forEach((k,i)=>o[k]=(v[i]||"").replace(/\u00A0/g," ").trim());return o})}}
function csvResource(r){let em=(r.Email||"").toLowerCase(),nm=(r.Nom_Ressource||"").toLowerCase();return(em&&S.team.find(x=>(x.email||"").toLowerCase()===em))||S.team.find(x=>(x.nom||"").toLowerCase()===nm)}
function csvTeam(v){v=(v||"").toLowerCase();return S.teams.find(x=>(x.Code||"").toLowerCase()===v||(x.Libelle||"").toLowerCase()===v)}
function csvMotif(v){v=(v||"").toUpperCase();return S.motifs.find(x=>(x.Code||"").toUpperCase()===v)}
function csvAnalyze(p){
  let miss=CSV_HEADER.filter(x=>!p.headers.includes(x));if(miss.length)throw Error("Colonnes manquantes : "+miss.join(", ")+" · Colonnes détectées : "+p.headers.join(" | "));
  let nr=new Map(),nt=new Map(),rows=[];
  for(let r of p.rows){
    let d=[],res=csvResource(r),tm=csvTeam(r.Equipe_Code),mo=csvMotif(r.Motif),bad=false,nd=normalizeCsvDate(r.Date);
    if(!r.Nom_Ressource&&!r.Email){d.push("Ressource obligatoire");bad=true}
    if(!nd){d.push("Date invalide (JJ/MM/AAAA ou AAAA-MM-JJ)");bad=true}else r.Date=nd;
    if(nd&&isDateLocked(nd)){d.push("Période verrouillée");bad=true}
    if(!mo){d.push("Motif inconnu");bad=true}
    let key=(r.Email||r.Nom_Ressource).toLowerCase(),teamKey=(r.Equipe_Code||"").trim().toLowerCase();
    if(r.Equipe_Code&&!tm&&!nt.has(teamKey))nt.set(teamKey,{key:teamKey,Code:r.Equipe_Code.trim(),Libelle:r.Equipe_Code.trim(),Description:"Créée automatiquement par import CSV"});
    if(!res&&!nr.has(key))nr.set(key,{...r,key,teamId:tm?.id||0,teamKey});
    if(r.Equipe_Code&&!tm)d.push("Équipe à créer automatiquement");
    let old=res&&nd?S.presence.find(x=>x.Ressource===res.id&&iso(x.Date)===nd):null;
    rows.push({...r,status:"Prévisionnel",res,mo,key,teamKey,old,bad,diag:d.join(" · ")||"OK",action:res?(old?"Modifier":"Créer"):"Créer ressource + présence"})
  }
  return{rows,newResources:nr,newTeams:nt}
}
function csvRender(){let a=S.csvAnalysis;if(!a){$("csvPreview").innerHTML="";$("importCsv").disabled=true;return}let ok=a.rows.filter(x=>!x.bad),er=a.rows.filter(x=>x.bad);$("csvValid").textContent=ok.length;$("csvNewResources").textContent=a.newResources.size;$("csvCreates").textContent=ok.filter(x=>!x.old).length;$("csvUpdates").textContent=ok.filter(x=>x.old).length;$("csvErrors").textContent=er.length;$("importCsv").disabled=er.length>0||!ok.length;$("csvMessage").textContent=er.length?"Corrigez les erreurs avant import.":`Analyse OK : ${a.newTeams?.size||0} équipe(s) et ${a.newResources.size} ressource(s) seront créées si nécessaire.`;$("csvPreview").innerHTML=a.rows.slice(0,200).map(x=>`<tr><td>${x._line}</td><td>${esc(x.Nom_Ressource)}</td><td>${esc(x.Email)}</td><td>${esc(x.Equipe_Code)}</td><td>${esc(x.Date)}</td><td>${esc(x.Motif)}</td><td>${esc(x.action)}</td><td class="${x.bad?"diag-error":x.diag==="OK"?"diag-ok":"diag-warn"}">${esc(x.diag)}</td></tr>`).join("")}
async function csvAnalyzeFile(){let f=$("csvFile").files?.[0];if(!f)throw Error("Sélectionnez un CSV");let p=csvParse(await readCsvFileText(f));S.csvAnalysis={...p,...csvAnalyze(p)};csvRender()}
async function csvImport(){let a=S.csvAnalysis;if(!a||a.rows.some(x=>x.bad))throw Error("Analyse invalide");let teamRefTable=grist.getTable(T.teams),tt=grist.getTable(T.team),pt=grist.getTable(T.presence),createdTeams=new Map(),createdResources=new Map();for(let t of (a.newTeams?.values()||[])){let z=await teamRefTable.create({fields:{Code:t.Code,Libelle:t.Libelle,Description:t.Description||""}});if(typeof z==="number")createdTeams.set(t.key,z);else if(z?.id)createdTeams.set(t.key,z.id)}if(a.newTeams?.size){S.teams=gristRows(await grist.docApi.fetchTable(T.teams),"Team_ref");for(let t of a.newTeams.values())if(!createdTeams.has(t.key)){let found=csvTeam(t.Code);if(found)createdTeams.set(t.key,found.id)}}for(let r of a.newResources.values()){let teamId=Number(r.teamId||0);if(!teamId&&r.teamKey)teamId=Number(createdTeams.get(r.teamKey)||0);let z=await tt.create({fields:{nom:r.Nom_Ressource||r.Email,email:r.Email||"",role:r.Role||"",capacite_ETP:num(r.Capacite_ETP,1),actif:true,equipe:teamId}});if(typeof z==="number")createdResources.set(r.key,z);else if(z?.id)createdResources.set(r.key,z.id)}if(a.newResources.size){S.team=gristRows(await grist.docApi.fetchTable(T.team),"Team");for(let r of a.newResources.values())if(!createdResources.has(r.key)){let m=csvResource(r);if(m)createdResources.set(r.key,m.id)}}S.presence=gristRows(await grist.docApi.fetchTable(T.presence),"Presences");let cr=[],up=[];for(let r of a.rows){let rid=r.res?.id||createdResources.get(r.key);if(!rid)throw Error("Ressource introuvable ligne "+r._line);let old=S.presence.find(x=>x.Ressource===rid&&iso(x.Date)===r.Date),fields={Ressource:rid,Date:epoch(r.Date),Motif:r.mo.id,Statut:"Prévisionnel",Commentaire:r.Commentaire||"",Source:"Import"};old?up.push({id:old.id,fields}):cr.push({fields})}if(up.length)await pt.update(up);if(cr.length)await pt.create(cr);$("csvMessage").textContent=`Import terminé : ${a.newTeams?.size||0} équipe(s), ${a.newResources.size} ressource(s), ${cr.length} création(s), ${up.length} mise(s) à jour.`;S.csvAnalysis=null;$("csvFile").value="";csvRender();await load();notify("Import CSV terminé")}


/* V6.35 — rapport HTML intégré, imprimable par équipe et période */
function teamLabel(id){const t=teamRef(id);return t?(t.Libelle||t.Code||`Équipe ${id}`):"Sans équipe"}
function renderReportTeams(){const el=$("reportTeam");if(!el)return;const current=el.value;const teams=scopedTeams().slice().sort((a,b)=>String(a.Libelle||a.Code||"").localeCompare(String(b.Libelle||b.Code||""),"fr"));
const allOption=(S.userScope.isAdmin||teams.length>1)?'<option value="">Toutes les équipes autorisées</option>':"";
el.innerHTML=allOption+teams.map(t=>`<option value="${t.id}">${esc(t.Libelle||t.Code||("Équipe "+t.id))}</option>`).join("");
if(!S.userScope.isAdmin&&teams.length===1)el.value=String(teams[0].id);if([...el.options].some(o=>o.value===current))el.value=current}
function reportMotifItems(){
  // Motifs actifs + motifs historiques déjà utilisés : un motif désactivé reste exploitable dans les rapports.
  const used=new Set(S.presence.map(r=>Number(r.Motif)).filter(Number.isFinite));
  return S.motifs.filter(m=>m.Actif!==false||used.has(Number(m.id))).slice().sort((a,b)=>String(a.Code||"").localeCompare(String(b.Code||""),"fr"))
}
function updateReportMotifsSummary(){
 const selected=selectedReportMotifs(),total=reportMotifItems().length,summary=$("reportMotifsSummary"),count=$("reportMotifsModalCount");
 if(summary)summary.textContent=`Motifs sélectionnés : ${selected.size}/${total}`;
 if(count)count.textContent=`${selected.size} motif${selected.size>1?"s":""} sélectionné${selected.size>1?"s":""} sur ${total}`;
}
function renderReportMotifs(){
 const store=$("reportMotifs");if(!store)return;
 const previous=new Set([...store.querySelectorAll("input:checked")].map(x=>String(x.value))),had=store.querySelectorAll("input").length>0,items=reportMotifItems();
 store.innerHTML=items.map(m=>`<input type="checkbox" value="${esc(m.Code||"")}" ${!had||previous.has(String(m.Code||""))?"checked":""}>`).join("");
 renderReportMotifPicker();updateReportMotifsSummary();
}
function renderReportMotifPicker(){
 const picker=$("reportMotifsPicker");if(!picker)return;const selected=selectedReportMotifs();
 picker.innerHTML=reportMotifItems().map(m=>`<label class="report-motif-choice" title="${esc(m.Libelle||m.Code||"")}"><input type="checkbox" value="${esc(m.Code||"")}" ${selected.has(String(m.Code||""))?"checked":""}> <span class="report-motif-code">${esc(m.Code||"?")}</span><span class="report-motif-label">${esc(m.Libelle||m.Code||"")}</span></label>`).join("");
 picker.querySelectorAll("input").forEach(x=>x.onchange=()=>{syncReportMotifsFromPicker();updateReportMotifsSummary()});
}
function syncReportMotifsFromPicker(){const chosen=new Set([...document.querySelectorAll("#reportMotifsPicker input:checked")].map(x=>String(x.value)));document.querySelectorAll("#reportMotifs input").forEach(x=>x.checked=chosen.has(String(x.value)))}
function selectedReportMotifs(){const boxes=[...document.querySelectorAll("#reportMotifs input[type=checkbox]")];return new Set(boxes.filter(x=>x.checked).map(x=>String(x.value)))}
function setAllReportMotifs(on){document.querySelectorAll("#reportMotifs input[type=checkbox],#reportMotifsPicker input[type=checkbox]").forEach(x=>x.checked=on);updateReportMotifsSummary()}
function openReportMotifs(){
 renderReportMotifPicker();updateReportMotifsSummary();
 const m=$("reportMotifsModal");if(!m)return;
 if(m.parentElement!==document.body)document.body.appendChild(m);
 m.hidden=false;m.style.display="flex";
}
function closeReportMotifs(){
 syncReportMotifsFromPicker();updateReportMotifsSummary();
 const m=$("reportMotifsModal");if(!m)return;
 m.hidden=true;m.style.display="none";
}
function initReportMotifsModal(){
 const m=$("reportMotifsModal");if(!m)return;
 if(m.parentElement!==document.body)document.body.appendChild(m);
 m.hidden=true;m.style.display="none";
}
function reportScope(){
 const from=$("from")?.value||"",to=$("to")?.value||"",teamId=Number($("reportTeam")?.value||0);
 const people=activeTeam().filter(p=>!teamId||resourceTeamId(p)===teamId),ids=new Set(people.map(p=>p.id));
 const rows=S.presence.filter(r=>{const ds=iso(r.Date);return ds>=from&&ds<=to&&ids.has(Number(r.Ressource))});
 return{from,to,teamId,people,rows,label:teamId?teamLabel(teamId):(S.userScope.isAdmin?"Toutes les équipes":"Toutes mes équipes")}
}
function periodAlerts(scope){
 const out=[],add=(p,l,v,dt="",personId=0)=>{const s=severity(p,v);if(s)out.push({s,l,v,u:p.Unite||"",dt,code:p.Code_Alerte||"",personId:Number(personId)||0})},team=scope.people,rr=scope.rows;
 S.params.filter(p=>p.Actif!==false).forEach(raw=>{const p=raw.Code_Alerte==="PRES_PHY"?physicalParam():raw;
  if(p.Code_Alerte==="ABS_IND")team.forEach(pe=>{let v=0;rr.filter(r=>r.Ressource===pe.id).forEach(r=>v+=num(motif(r.Motif)?.Absence_Equivalent));add(p,`${pe.nom} · absences sur la période`,v,"",pe.id)});
  if(p.Code_Alerte==="ABS_EQ"){let abs=0,w=0;rr.forEach(r=>{const m=motif(r.Motif);if(m&&m.Compte_Capacite!==false&&!['WE','F'].includes(m.Code)){w++;abs+=num(m.Absence_Equivalent)}});add(p,"Équipe · taux d’absence sur la période",w?abs/w*100:0)}
  if(["CAP_MIN","PRES_PHY","TL_SIM","FO_SIM"].includes(p.Code_Alerte)){const by={};rr.forEach(r=>(by[iso(r.Date)]??=[]).push(r));Object.entries(by).forEach(([d,day])=>{let v=0;if(p.Code_Alerte==="CAP_MIN"){let pr=0,w=0;day.forEach(r=>{const m=motif(r.Motif);if(m&&m.Compte_Capacite!==false&&!['WE','F'].includes(m.Code)){w++;pr+=num(m.Presence_Equivalent)}});v=w?pr/w*100:100}if(p.Code_Alerte==="PRES_PHY")v=day.filter(r=>motif(r.Motif)?.Code==="P").length/Math.max(1,team.length)*100;if(p.Code_Alerte==="TL_SIM")v=day.filter(r=>["TL","TE","TLE"].includes(motif(r.Motif)?.Code)).length/Math.max(1,team.length)*100;if(p.Code_Alerte==="FO_SIM")v=day.filter(r=>motif(r.Motif)?.Code==="FO").length/Math.max(1,team.length)*100;add(p,p.Libelle||p.Code_Alerte,v,d)})}
 });return out.sort((a,b)=>(a.s==="red"?0:1)-(b.s==="red"?0:1)||String(a.dt).localeCompare(String(b.dt)))
}
function fmtReportDate(s){return s?new Date(s+"T12:00:00").toLocaleDateString("fr-FR"):"—"}
function generateHtmlReport(){
 const q=reportScope();if(!q.from||!q.to)return notify("Sélectionnez une période.");if(q.to<q.from)return notify("Période invalide.");if(!q.people.length)return notify("Aucune ressource dans cette équipe.");
 const ia=$("previewIncludeAlerts"),ic=$("previewIncludeChart");if(ia)ia.checked=$("reportIncludeAlerts")?.checked!==false;if(ic)ic.checked=$("reportIncludeChart")?.checked!==false;
 const includeAlerts=ia?ia.checked:($('reportIncludeAlerts')?.checked===true);const includeChart=ic?ic.checked:($('reportIncludeChart')?.checked===true);
 const html=buildPortableReportHtml({includeAlerts,includeChart,preview:true});if(!html)return;
 const frame=$("htmlReportFrame"),modal=$("htmlReportModal");if(!frame||!modal)return notify("Prévisualisation du rapport indisponible.");frame.srcdoc=html;$("htmlReportSubtitle").textContent=`${q.label} · du ${fmtReportDate(q.from)} au ${fmtReportDate(q.to)} · ${q.people.length} ressource(s)`;modal.hidden=false;document.body.classList.add("modal-open");
}

function closeHtmlReport(){const m=$("htmlReportModal");if(m)m.hidden=true;document.body.classList.remove("modal-open")}
function printHtmlReportFrame(){const f=$("htmlReportFrame");if(!f?.contentWindow)return notify("Rapport non chargé.");try{f.contentWindow.focus();f.contentWindow.print()}catch(e){notify("Impossible d’ouvrir l’impression du rapport.");console.error(e)}}



/* V6.36 — export autonome HTML/JS, dynamique et partageable */
function buildPortableReportHtml(options={}){
 let q=reportScope();
 const selectedMotifs=options.selectedMotifs?new Set(options.selectedMotifs):selectedReportMotifs();
 if(!selectedMotifs.size){notify("Sélectionnez au moins un motif à traiter dans le rapport.");return null}
 q={...q,rows:q.rows.filter(r=>selectedMotifs.has(String(motif(r.Motif)?.Code||r.Motif||"")))};
 if(!q.from||!q.to){notify("Sélectionnez une période.");return null}
 if(q.to<q.from){notify("Période invalide.");return null}
 if(!q.people.length){notify("Aucune ressource dans cette équipe.");return null}
 const people=q.people.map(pe=>({id:Number(pe.id),name:pe.nom||("Ressource "+pe.id)})).sort((a,b)=>a.name.localeCompare(b.name,"fr"));
 const rows=q.rows.map(r=>{const m=motif(r.Motif);return {person:Number(r.Ressource),date:iso(r.Date),motif:m?.Code||String(r.Motif||""),presence:num(m?.Presence_Equivalent),absence:num(m?.Absence_Equivalent),remote:["TL","TE","TLE"].includes(m?.Code)?1:0,formation:m?.Code==="FO"?1:0,work:(m&&m.Compte_Capacite!==false&&!['WE','F'].includes(m.Code))?1:0,locked:isDateLocked(iso(r.Date))}});
 const includeAlerts=options.includeAlerts!==undefined?!!options.includeAlerts:($("reportIncludeAlerts")?.checked===true);
 const includeChart=options.includeChart!==undefined?!!options.includeChart:($("reportIncludeChart")?.checked===true);
 const alertExplain={ABS_IND:"Le cumul d’absence d’une ressource dépasse le seuil défini pour la période.",ABS_EQ:"Le taux d’absence global de l’équipe dépasse le seuil défini.",CAP_MIN:"La capacité disponible passe sous le niveau minimal attendu.",PRES_PHY:"La présence physique sur site passe sous le seuil minimal attendu.",TL_SIM:"La part de télétravail simultané dépasse le seuil défini.",FO_SIM:"La part de ressources en formation simultanée dépasse le seuil défini."};
 const alerts=includeAlerts?periodAlerts(q).map(a=>{const p=a.code==="PRES_PHY"?physicalParam():paramByCode(a.code),threshold=a.s==="red"?num(p?.Seuil_Rouge):num(p?.Seuil_Orange);return {level:a.s,code:a.code||"",label:a.l||"",date:a.dt||"",value:Number(a.v)||0,unit:a.u||"",threshold,personId:Number(a.personId)||0,explanation:alertExplain[a.code]||"Seuil paramétré dépassé sur la période sélectionnée."}}):[];
 const reportMotifs=S.motifs.filter(m=>selectedMotifs.has(String(m.Code||""))).map(m=>({code:String(m.Code||""),label:String(m.Libelle||m.Code||""),presence:num(m.Presence_Equivalent),absence:num(m.Absence_Equivalent)}));
 const payload=JSON.stringify({title:"Rapport RH",scope:q.label,from:q.from,to:q.to,people,rows,alerts,includeAlerts,includeChart,selectedMotifs:[...selectedMotifs],reportMotifs}).replace(/</g,"\\u003c");
 return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rapport RH — ${esc(q.label)}</title><style>
 :root{--navy:#15395f;--blue:#2563eb;--ink:#172033;--muted:#667085;--line:#e5eaf0;--soft:#f6f8fb;--red:#b42318;--orange:#b54708}*{box-sizing:border-box}body{margin:0;background:#f2f5f8;color:var(--ink);font:14px Inter,Segoe UI,Arial,sans-serif}.shell{max-width:1280px;margin:auto;padding:28px}.hero{background:linear-gradient(135deg,#123452,#245b88);color:#fff;border-radius:20px;padding:24px 28px;box-shadow:0 12px 35px #173b6820}.hero h1{margin:0 0 6px;font-size:27px}.hero p{margin:0;color:#d9e7f5}.toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:end;background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px;margin:16px 0}.toolbar label{display:grid;gap:5px;color:var(--muted);font-size:12px}.toolbar select,.toolbar button{height:38px;border:1px solid #ccd5df;border-radius:9px;background:#fff;padding:0 12px;font:inherit}.toolbar button{cursor:pointer;font-weight:700}.toolbar .primary{background:var(--blue);border-color:var(--blue);color:#fff}.cards{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:12px}.card{background:#fff;border:1px solid var(--line);border-radius:15px;padding:15px}.card b{display:block;color:var(--navy);font-size:24px}.card span{color:var(--muted);font-size:12px}.panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;margin-top:14px}.panel h2{margin:0 0 14px;font-size:17px}.people{display:flex;flex-wrap:wrap;gap:8px}.pill{display:inline-flex;gap:7px;align-items:center;border:1px solid #d6deea;border-radius:999px;padding:7px 10px;background:#fff}.bar{height:8px;background:#edf1f5;border-radius:99px;overflow:hidden;min-width:100px}.bar i{display:block;height:100%;background:var(--blue);border-radius:99px}table{width:100%;border-collapse:collapse}th,td{padding:10px 8px;border-bottom:1px solid #edf0f3;text-align:left}th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}.crit{color:var(--red);font-weight:700}.warn{color:var(--orange);font-weight:700}.muted{color:var(--muted)}.empty{text-align:center;color:var(--muted);padding:28px}.alert-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.alert-summary{display:grid;grid-template-columns:repeat(3,minmax(140px,1fr));gap:10px;margin:12px 0}.alert-chip{border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--soft)}.alert-chip b{display:block;font-size:20px}.alert-note{color:var(--muted);font-size:12px;line-height:1.45}.alert-row details{max-width:520px}.alert-row summary{cursor:pointer;font-weight:700}.chart-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.seg{display:inline-flex;border:1px solid #d6deea;border-radius:10px;padding:3px;background:var(--soft);gap:3px}.seg button{border:0;background:transparent;border-radius:7px;padding:7px 10px;cursor:pointer;font:inherit;font-size:12px;font-weight:700;color:var(--muted)}.seg button.active{background:#fff;color:var(--navy);box-shadow:0 1px 4px #102a4320}.compare-chart{margin-top:18px;display:grid;gap:14px}.chart-row{display:grid;grid-template-columns:minmax(130px,220px) 1fr;gap:14px;align-items:center}.chart-name{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chart-track{position:relative;min-height:48px;border-left:1px solid #d8e0e8;background:linear-gradient(to right,transparent 24.8%,#edf1f5 25%,transparent 25.2%,transparent 49.8%,#edf1f5 50%,transparent 50.2%,transparent 74.8%,#edf1f5 75%,transparent 75.2%);border-radius:0 8px 8px 0}.chart-bar{height:18px;border-radius:5px;min-width:2px;display:flex;align-items:center;padding:0 6px;font-size:11px;font-weight:800;white-space:nowrap;overflow:visible}.chart-bar.pres{background:#cfe0ff;color:#15395f}.chart-bar.abs{background:#ffd9d5;color:#8a251d;margin-top:6px}.avg-line{position:absolute;top:0;bottom:0;width:2px;background:#344054;opacity:.65}.avg-line span{position:absolute;top:-16px;left:5px;font-size:10px;color:#475467;white-space:nowrap}.chart-legend{display:flex;gap:16px;flex-wrap:wrap;color:var(--muted);font-size:11px;margin-top:8px}.dot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}.dot.pres{background:#cfe0ff}.dot.abs{background:#ffd9d5}.activity-stack{display:flex;height:30px;border-radius:999px;overflow:hidden;background:#eef2f6;margin:14px 0 12px}.activity-stack i{display:block;height:100%}.act-present{background:#ec4899}.act-remote{background:#14b8a6}.act-absence{background:#f59e0b}.act-training{background:#8b5cf6}.activity-legend{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px 16px;margin-bottom:18px}.activity-legend span{font-size:12px;color:var(--muted)}.activity-legend b{float:right;color:var(--ink)}.activity-bars{border-top:1px solid var(--line);padding-top:10px}.activity-line{display:grid;grid-template-columns:120px minmax(160px,1fr) 60px;gap:10px;align-items:center;margin:10px 0}.activity-line .track{height:12px;background:#edf1f5;border-radius:99px;overflow:hidden}.activity-line .fill{height:100%;border-radius:99px;background:#2563eb}.activity-line .fill.abs{background:#ef4444}.activity-line .fill.we{background:#cbd5e1}.activity-line .fill.holiday{background:#94a3b8}.activity-line strong{text-align:right}.hide{display:none!important}@media(max-width:800px){.shell{padding:12px}.cards{grid-template-columns:repeat(2,1fr)}}@media print{body{background:#fff}.shell{max-width:none;padding:0}.toolbar{display:none}.hero{box-shadow:none;background:#fff;color:var(--ink);border:1px solid var(--line)}.hero p{color:var(--muted)}.panel,.card{break-inside:avoid}}
 </style></head><body><main class="shell"><section class="hero"><h1>Rapport RH</h1><p id="subtitle"></p></section><section class="toolbar"><label>Vue<select id="mode"><option value="team">Synthèse sélection</option><option value="individual">Fiches individuelles</option></select></label><label>Ressource<select id="single"><option value="">Toutes les ressources</option></select></label><button id="all">Tout sélectionner</button><button id="none">Tout désélectionner</button><button class="primary" onclick="window.print()">Imprimer / PDF</button></section><section class="panel"><h2>Ressources affichées</h2><div class="people" id="checks"></div></section><section class="cards" id="cards" style="margin-top:14px"></section><section class="panel" id="activityPanel"><div class="chart-head"><div><h2 style="margin-bottom:4px">Répartition de l’activité</h2><div class="alert-note">Présentiel · Télétravail · Absence · Formation, puis volumes par motif.</div></div></div><div class="activity-stack" id="activityStack"></div><div class="activity-legend" id="activityLegend"></div><div class="activity-bars" id="activityBars"></div></section><section class="panel" id="comparePanel"><div class="chart-head"><div><h2 style="margin-bottom:4px">Présence / Absence par collaborateur</h2><div class="alert-note">Comparaison en jours équivalents. La ligne indique la moyenne des collaborateurs actuellement sélectionnés.</div></div><div class="seg" id="chartMode"><button type="button" data-chart="both" class="active">Présence + Absence</button><button type="button" data-chart="presence">Présence</button><button type="button" data-chart="absence">Absence</button></div></div><div class="chart-legend" id="chartLegend"></div><div class="compare-chart" id="compareChart"></div></section><section class="panel" id="summaryPanel"><h2>Indicateurs par ressource</h2><div style="overflow:auto"><table><thead><tr><th>Ressource</th><th>Présence</th><th>Absence</th><th>Télétravail</th><th>Formation</th><th>Taux</th></tr></thead><tbody id="peopleRows"></tbody></table></div></section><section class="panel"><h2>Répartition des motifs</h2><div id="motifs"></div></section><section class="panel" id="alertsPanel"><div class="alert-head"><div><h2 style="margin-bottom:4px">Alertes significatives</h2><div class="alert-note">Synthèse des franchissements de seuil. Ouvrez une ligne pour comprendre pourquoi elle apparaît.</div></div><label class="pill"><input id="showAlerts" type="checkbox" checked> Afficher les alertes</label></div><div class="alert-summary" id="alertSummary"></div><div id="alertContent" style="overflow:auto"><table><thead><tr><th>Niveau</th><th>Type</th><th>Quand</th><th>Mesure / seuil</th><th>Explication</th></tr></thead><tbody id="alerts"></tbody></table></div></section><section id="individuals"></section></main><script>const D=${payload};
 const $=id=>document.getElementById(id),fmt=n=>(Number(n)||0).toFixed(1),fd=s=>s?new Date(s+'T12:00:00').toLocaleDateString('fr-FR'):'Période';
 function stat(rows){let x={presence:0,absence:0,remote:0,formation:0,work:0,real:0,open:0};rows.forEach(r=>{x.presence+=r.presence;x.absence+=r.absence;x.remote+=r.remote;x.formation+=r.formation;x.work+=r.work;r.locked?x.real++:x.open++});x.rate=x.work?x.presence/x.work*100:0;return x}
 function selected(){return new Set([...document.querySelectorAll('.pick:checked')].map(x=>Number(x.value)))}
 function render(){const ids=selected(),single=Number($('single').value||0);if(single){ids.clear();ids.add(single);document.querySelectorAll('.pick').forEach(x=>x.checked=ids.has(Number(x.value)))}const ppl=D.people.filter(p=>ids.has(p.id)),rows=D.rows.filter(r=>ids.has(r.person)),s=stat(rows);$('subtitle').textContent=D.scope+' · du '+fd(D.from)+' au '+fd(D.to)+' · '+ppl.length+' ressource(s) · Motifs : '+(D.selectedMotifs||[]).join(', ');const cardData=[['Présence',fmt(s.presence)+' j'],['Absence',fmt(s.absence)+' j'],['Télétravail',fmt(s.remote)+' j'],['Formation',fmt(s.formation)+' j'],['Taux présence',fmt(s.rate)+' %'],['Réalisé 🔒',s.real],['Ouvert ✏️',s.open]];if(D.includeAlerts)cardData.push(['Alertes',D.alerts.filter(a=>!a.personId||ids.has(a.personId)).length]);$('cards').innerHTML=cardData.map(x=>'<div class="card"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('');
 const per=ppl.map(p=>{const z=stat(rows.filter(r=>r.person===p.id));return {p,z}});const cm=document.querySelector('#chartMode button.active')?.dataset.chart||'both',maxVal=Math.max(1,...per.flatMap(o=>cm==='presence'?[o.z.presence]:cm==='absence'?[o.z.absence]:[o.z.presence,o.z.absence])),avgP=per.length?per.reduce((a,o)=>a+o.z.presence,0)/per.length:0,avgA=per.length?per.reduce((a,o)=>a+o.z.absence,0)/per.length:0;function bar(v,kind){const w=Math.max(0,Math.min(100,v/maxVal*100));return '<div class="chart-bar '+kind+'" style="width:'+w+'%">'+fmt(v)+' j</div>'}function avg(v,label){return '<div class="avg-line" style="left:'+Math.min(100,v/maxVal*100)+'%"><span>'+label+' '+fmt(v)+' j</span></div>'}$('chartLegend').innerHTML=(cm!=='absence'?'<span><i class="dot pres"></i>Présence · moyenne '+fmt(avgP)+' j</span>':'')+(cm!=='presence'?'<span><i class="dot abs"></i>Absence · moyenne '+fmt(avgA)+' j</span>':'');$('compareChart').innerHTML=per.map(o=>'<div class="chart-row"><div class="chart-name">'+o.p.name+'</div><div class="chart-track">'+(cm!=='absence'?avg(avgP,'Moy. présence')+bar(o.z.presence,'pres'):'')+(cm!=='presence'?avg(avgA,'Moy. absence')+bar(o.z.absence,'abs'):'')+'</div></div>').join('')||'<div class="empty">Aucune ressource sélectionnée.</div>';$('comparePanel').classList.toggle('hide',!D.includeChart);$('peopleRows').innerHTML=per.map(o=>'<tr><td><b>'+o.p.name+'</b></td><td>'+fmt(o.z.presence)+' j</td><td>'+fmt(o.z.absence)+' j</td><td>'+fmt(o.z.remote)+' j</td><td>'+fmt(o.z.formation)+' j</td><td><div>'+fmt(o.z.rate)+' %</div><div class="bar"><i style="width:'+Math.min(100,o.z.rate)+'%"></i></div></td></tr>').join('')||'<tr><td colspan="6" class="empty">Aucune ressource sélectionnée.</td></tr>';
 const activity={present:0,remote:0,absence:0,formation:0};rows.forEach(r=>{if(r.motif==='P')activity.present+=1;if(['TL','TE','TLE'].includes(r.motif))activity.remote+=1;activity.absence+=r.absence;if(r.motif==='FO')activity.formation+=1});const actTotal=Math.max(1,activity.present+activity.remote+activity.absence+activity.formation),pct=v=>v/actTotal*100;$('activityStack').innerHTML='<i class="act-present" style="width:'+pct(activity.present)+'%"></i><i class="act-remote" style="width:'+pct(activity.remote)+'%"></i><i class="act-absence" style="width:'+pct(activity.absence)+'%"></i><i class="act-training" style="width:'+pct(activity.formation)+'%"></i>';$('activityLegend').innerHTML=[['Présentiel',activity.present,'act-present'],['Télétravail',activity.remote,'act-remote'],['Absence',activity.absence,'act-absence'],['Formation',activity.formation,'act-training']].map(x=>'<span><i class="dot '+x[2]+'"></i>'+x[0]+' <b>'+fmt(pct(x[1]))+' %</b></span>').join('');const motifVolumes={};rows.forEach(r=>motifVolumes[r.motif]=(motifVolumes[r.motif]||0)+1);const maxMotif=Math.max(1,...Object.values(motifVolumes));const motifNames={P:'Présentiel',WE:'Week-end',A:'Absent',TL:'Télétravail',TE:'Télétravail',TLE:'Télétravail',F:'Jour férié',FO:'Formation'};$('activityBars').innerHTML=Object.entries(motifVolumes).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<div class="activity-line"><span>'+(motifNames[k]||k)+'</span><div class="track"><div class="fill '+(k==='A'?'abs':k==='WE'?'we':k==='F'?'holiday':'')+'" style="width:'+(v/maxMotif*100)+'%"></div></div><strong>'+v+'</strong></div>').join('');$('activityPanel').classList.toggle('hide',!D.includeChart);
 const mc={};rows.forEach(r=>mc[r.motif]=(mc[r.motif]||0)+1);$('motifs').innerHTML=Object.entries(mc).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<div style="display:grid;grid-template-columns:90px 1fr 55px;gap:10px;align-items:center;margin:8px 0"><b>'+k+'</b><div class="bar"><i style="width:'+Math.min(100,v/Math.max(1,rows.length)*300)+'%"></i></div><span>'+v+'</span></div>').join('')||'<div class="empty">Aucune donnée.</div>';
 const visibleAlerts=D.alerts.filter(a=>!a.personId||ids.has(a.personId));const groups={};visibleAlerts.forEach(a=>{const k=a.code+'|'+a.level;(groups[k]??=[]).push(a)});$('alertSummary').innerHTML=Object.values(groups).map(g=>'<div class="alert-chip"><b class="'+(g[0].level==='red'?'crit':'warn')+'">'+g.length+'</b><span>'+g[0].code+' · '+(g[0].level==='red'?'Critique':'Vigilance')+'</span></div>').join('')||'<div class="alert-note">Aucun franchissement de seuil.</div>';$('alerts').innerHTML=visibleAlerts.map(a=>'<tr class="alert-row"><td class="'+(a.level==='red'?'crit':'warn')+'">'+(a.level==='red'?'● Critique':'● Vigilance')+'</td><td><b>'+a.code+'</b></td><td>'+fd(a.date)+'</td><td>'+fmt(a.value)+' '+a.unit+'<div class="alert-note">Seuil : '+fmt(a.threshold)+' '+a.unit+'</div></td><td><details><summary>'+a.label+'</summary><div class="alert-note" style="margin-top:6px">'+a.explanation+'</div></details></td></tr>').join('')||'<tr><td colspan="5" class="empty">Aucune alerte sur la période.</td></tr>';$('alertsPanel').classList.toggle('hide',!D.includeAlerts);
 const indiv=$('mode').value==='individual';$('summaryPanel').classList.toggle('hide',indiv);$('individuals').innerHTML=indiv?per.map(o=>'<section class="panel"><h2>'+o.p.name+'</h2><div class="cards"><div class="card"><b>'+fmt(o.z.presence)+' j</b><span>Présence</span></div><div class="card"><b>'+fmt(o.z.absence)+' j</b><span>Absence</span></div><div class="card"><b>'+fmt(o.z.remote)+' j</b><span>Télétravail</span></div><div class="card"><b>'+fmt(o.z.formation)+' j</b><span>Formation</span></div></div></section>').join(''):''}
 D.people.forEach(p=>{$('checks').insertAdjacentHTML('beforeend','<label class="pill"><input class="pick" type="checkbox" value="'+p.id+'" checked> '+p.name+'</label>');$('single').insertAdjacentHTML('beforeend','<option value="'+p.id+'">'+p.name+'</option>')});document.querySelectorAll('.pick').forEach(x=>x.onchange=()=>{$('single').value='';render()});$('mode').onchange=render;$('single').onchange=render;if($('showAlerts'))$('showAlerts').onchange=()=>{$('alertContent').classList.toggle('hide',!$('showAlerts').checked);$('alertSummary').classList.toggle('hide',!$('showAlerts').checked)};document.querySelectorAll('#chartMode button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#chartMode button').forEach(x=>x.classList.remove('active'));b.classList.add('active');render()});$('all').onclick=()=>{document.querySelectorAll('.pick').forEach(x=>x.checked=true);$('single').value='';render()};$('none').onclick=()=>{document.querySelectorAll('.pick').forEach(x=>x.checked=false);$('single').value='';render()};render();<\/script></body></html>`
}
function exportDynamicHtmlReport(fromPreview=false){const html=buildPortableReportHtml(fromPreview?{includeAlerts:$("previewIncludeAlerts")?.checked===true,includeChart:$("previewIncludeChart")?.checked===true,selectedMotifs:[...selectedReportMotifs()]}:{});if(!html)return;const q=reportScope(),safe=(q.label||"equipe").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase();const blob=new Blob([html],{type:"text/html;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`rapport-rh-${safe||"equipe"}-${q.from}-${q.to}.html`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);notify("Rapport HTML dynamique exporté.")}

/* V6.34 — réconciliation des doublons Team */
function normIdentity(v){return String(v||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9@.]+/g,"")}
function duplicateGroups(){const groups=new Map();S.team.forEach(p=>{const email=teamEmail(p),name=normIdentity(teamName(p));const k=email?`e:${email}`:(name?`n:${name}`:"");if(k){if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p)}});return [...groups.values()].filter(g=>g.length>1)}
function renderReconcileResources(){const s=$("reconcileSource"),t=$("reconcileTarget");if(!s||!t)return;const sv=s.value,tv=t.value,people=S.team.slice().sort((a,b)=>teamName(a).localeCompare(teamName(b),"fr")),opts=people.map(p=>`<option value="${p.id}">${esc(teamName(p)||("Ressource "+p.id))} · ${esc(teamEmail(p)||"sans email")} · #${p.id}${p.actif===false?" · inactive":""}</option>`).join("");s.innerHTML='<option value="">Choisir…</option>'+opts;t.innerHTML='<option value="">Choisir…</option>'+opts;if([...s.options].some(o=>o.value===sv))s.value=sv;if([...t.options].some(o=>o.value===tv))t.value=tv;const g=duplicateGroups();if($("duplicateHint"))$("duplicateHint").textContent=`${g.length} doublon${g.length>1?"s":""} détecté${g.length>1?"s":""}`;if(g.length&& !s.value&&!t.value){const pair=g[0];s.value=String(pair[1].id);t.value=String(pair[0].id)}previewReconcile()}
function reconcilePlan(){const sourceId=Number($("reconcileSource")?.value||0),targetId=Number($("reconcileTarget")?.value||0);if(!sourceId||!targetId||sourceId===targetId)return null;const source=resource(sourceId),target=resource(targetId);if(!source||!target)return null;const src=S.presence.filter(r=>r.Ressource===sourceId),tgt=S.presence.filter(r=>r.Ressource===targetId),byDate=new Map(tgt.map(r=>[iso(r.Date),r])),updates=[],duplicates=[],conflicts=[];src.forEach(r=>{const other=byDate.get(iso(r.Date));if(!other)updates.push(r);else{duplicates.push(r);if(Number(other.Motif)!==Number(r.Motif))conflicts.push({source:r,target:other})}});return{source,target,src,tgt,updates,duplicates,conflicts}}
function previewReconcile(){const el=$("reconcilePreview"),btn=$("runReconcile"),p=reconcilePlan();if(!el||!btn)return;if(!p){el.innerHTML="Sélectionnez deux fiches différentes pour contrôler la fusion.";btn.disabled=true;return}el.innerHTML=`<div class="reconcile-stats"><span><b>${p.src.length}</b> présences source</span><span><b>${p.updates.length}</b> à transférer</span><span><b>${p.duplicates.length}</b> dates déjà présentes</span><span class="${p.conflicts.length?"danger-text":""}"><b>${p.conflicts.length}</b> conflit(s) de motif</span></div><p>La fiche <strong>${esc(teamName(p.source))} #${p.source.id}</strong> sera absorbée par <strong>${esc(teamName(p.target))} #${p.target.id}</strong>. Sur une date déjà présente, la fiche conservée reste prioritaire.</p>`;btn.disabled=false}
async function runReconcile(){const p=reconcilePlan();if(!p)throw Error("Sélectionnez deux fiches différentes.");const detail=p.conflicts.length?`\n\nAttention : ${p.conflicts.length} date(s) ont des motifs différents. Le motif de la fiche conservée sera gardé.`:"";if(!window.confirm(`Réconcilier ${teamName(p.source)} (#${p.source.id}) vers ${teamName(p.target)} (#${p.target.id}) ?\n\n${p.updates.length} présence(s) seront transférées et ${p.duplicates.length} doublon(s) de date supprimé(s).${detail}`))return;if(!window.confirm("Confirmation finale : cette opération modifie les références de présence et désactive la fiche source. Continuer ?"))return;const pt=grist.getTable(T.presence),tt=grist.getTable(T.team);if(p.updates.length)await pt.update(p.updates.map(r=>({id:r.id,fields:{Ressource:p.target.id}})));if(p.duplicates.length)await pt.destroy(p.duplicates.map(r=>r.id));await tt.update({id:p.source.id,fields:{actif:false}});await load();notify(`Réconciliation terminée · ${p.updates.length} transférée(s) · ${p.duplicates.length} doublon(s) supprimé(s)`)}

/* EXCEL IMPORT --------------------------------------------------------- */
function excelDateToIso(v){
  if(v instanceof Date&&!Number.isNaN(v.getTime()))return iso(v);
  if(typeof v==="number"){
    const p=XLSX.SSF.parse_date_code(v);
    if(p)return `${p.y}-${String(p.m).padStart(2,"0")}-${String(p.d).padStart(2,"0")}`;
  }
  const s=String(v??"").trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  return "";
}
async function loadExcelWorkbook(){
  const file=$("excelFile").files?.[0];
  if(!file)return;
  if(typeof XLSX==="undefined")throw Error("La librairie de lecture Excel n'est pas disponible.");
  const data=await file.arrayBuffer();
  S.excelWorkbook=XLSX.read(data,{type:"array",cellDates:true});
  $("excelSheet").innerHTML='<option value="">Choisir une feuille…</option>'+S.excelWorkbook.SheetNames.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");
  $("excelSheet").disabled=false;$("analyzeExcel").disabled=true;
  $("excelInfo").textContent=`${S.excelWorkbook.SheetNames.length} feuille(s) détectée(s). Sélectionnez celle à importer.`;
}
function excelSheetToCsvRows(){
  const sheetName=$("excelSheet").value;
  if(!S.excelWorkbook||!sheetName)throw Error("Sélectionnez la feuille à importer.");
  const ws=S.excelWorkbook.Sheets[sheetName];
  const matrix=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});
  if(!matrix.length)throw Error("La feuille sélectionnée est vide.");

  // Détection de la ligne contenant le plus de dates : calendrier horizontal.
  let dateRow=-1,dateCols=[];
  matrix.forEach((row,ri)=>{
    const found=[];
    row.forEach((v,ci)=>{const ds=excelDateToIso(v);if(ds)found.push({ci,ds})});
    if(found.length>dateCols.length){dateRow=ri;dateCols=found}
  });
  if(dateRow<0||dateCols.length<2)throw Error("Impossible de détecter un calendrier horizontal : aucune ligne de dates exploitable.");

  const firstDateCol=Math.min(...dateCols.map(x=>x.ci));
  // Détection des ressources sous la ligne des dates : première colonne texte non vide avant les dates.
  let nameCol=-1;
  for(let c=0;c<firstDateCol;c++){
    let score=0;
    for(let r=dateRow+1;r<matrix.length;r++)if(typeof matrix[r]?.[c]==="string"&&matrix[r][c].trim())score++;
    if(score>0){nameCol=c;break}
  }
  if(nameCol<0)throw Error("Impossible de détecter la colonne des ressources.");

  const defaultTeam=($("excelDefaultTeam").value||sheetName||"EQUIPE_EXCEL").trim();
  const blankAsP=$("excelBlankAsP").checked;
  const known=new Set(S.motifs.map(m=>String(m.Code||"").trim().toUpperCase()));
  const rows=[];let resources=0,unknown=new Set();

  for(let r=dateRow+1;r<matrix.length;r++){
    const name=String(matrix[r]?.[nameCol]??"").trim();
    if(!name)continue;
    // Ignore obvious legend/header rows by requiring at least one calendar cell or a normal-looking name.
    let produced=0;
    for(const dc of dateCols){
      let code=String(matrix[r]?.[dc.ci]??"").trim();
      const dow=new Date(dc.ds+"T12:00:00").getDay();
      if(!code&&blankAsP&&dow!==0&&dow!==6)code="P";
      if(!code)continue;
      if(!known.has(code.toUpperCase())){unknown.add(code);continue}
      rows.push({
        _line:r+1,Nom_Ressource:name,Email:"",Equipe_Code:defaultTeam,Role:"",Capacite_ETP:"1",
        Date:dc.ds,Motif:code,Commentaire:`Import Excel · ${sheetName}`
      });produced++;
    }
    if(produced)resources++;
  }
  if(!rows.length)throw Error("Aucune présence exploitable détectée dans cette feuille.");
  if(unknown.size)throw Error("Motifs inconnus dans la feuille : "+[...unknown].join(", "));
  return {headers:CSV_HEADER.slice(),rows,separator:"excel",sheetName,resources,dateCount:dateCols.length};
}
function analyzeExcelSheet(){
  const parsed=excelSheetToCsvRows();
  S.csvAnalysis={...parsed,...csvAnalyze(parsed)};
  $("csvMessage").textContent=`Source Excel : ${parsed.sheetName} · ${parsed.resources} ressource(s) · ${parsed.dateCount} date(s).`;
  csvRender();
  $("csvMessage").textContent=`Excel « ${parsed.sheetName} » analysé · ${parsed.resources} ressource(s). ${S.csvAnalysis.newTeams?.size||0} équipe(s) et ${S.csvAnalysis.newResources.size} ressource(s) seront créées si nécessaire.`;
  document.querySelector(".import-card:not(.excel-import-card)")?.scrollIntoView({behavior:"smooth",block:"start"});
}

function resetCsvImport(){
  S.csvAnalysis=null;
  if($("csvFile")) $("csvFile").value="";
  if($("csvMessage")) $("csvMessage").textContent="";
  if($("csvPreview")) $("csvPreview").innerHTML="";
  ["csvValid","csvNewResources","csvCreates","csvUpdates","csvErrors"].forEach(id=>{
    if($(id)) $(id).textContent="0";
  });
  if($("importCsv")) $("importCsv").disabled=true;
  notify("Import CSV réinitialisé");
}

function resetExcelImport(){
  S.excelWorkbook=null;
  S.csvAnalysis=null;

  if($("excelFile")) $("excelFile").value="";
  if($("excelSheet")){
    $("excelSheet").innerHTML='<option value="">Sélectionnez d\'abord un fichier</option>';
    $("excelSheet").disabled=true;
  }
  if($("analyzeExcel")) $("analyzeExcel").disabled=true;
  if($("excelInfo")) $("excelInfo").textContent="";
  if($("excelDefaultTeam")) $("excelDefaultTeam").value="EQUIPE_EXCEL";
  if($("excelBlankAsP")) $("excelBlankAsP").checked=true;

  if($("csvMessage")) $("csvMessage").textContent="";
  if($("csvPreview")) $("csvPreview").innerHTML="";
  ["csvValid","csvNewResources","csvCreates","csvUpdates","csvErrors"].forEach(id=>{
    if($(id)) $(id).textContent="0";
  });
  if($("importCsv")) $("importCsv").disabled=true;

  notify("Import Excel réinitialisé");
}

async function refreshCockpit(){
  const btn=$("refresh");
  if(btn){
    btn.disabled=true;
    btn.dataset.originalText=btn.textContent;
    btn.textContent="Actualisation…";
  }

  try{
    // Nettoyage uniquement des états transitoires locaux.
    S.changes.clear();
    S.selectedCells.clear();
    S.csvAnalysis=null;

    // load() recharge Grist puis appelle déjà render().
    // On évite donc d'appeler ici d'anciennes fonctions de rendu supprimées/renommées.
    await load();

    // Rendus complémentaires qui ne font pas partie du render() principal.
    if(typeof renderMotifVisibility==="function")renderMotifVisibility();
    if(typeof renderResetTimesheet==="function")renderResetTimesheet();
    if(typeof renderPeriodLocks==="function")renderLockBadge();

    notify("Données actualisées");
  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent=btn.dataset.originalText||"Actualiser";
    }
  }
}

function renderMotifInfo(){
  const grid=$("motifInfoGrid");
  if(!grid)return;
  const items=S.motifs.filter(m=>m.Actif!==false);
  grid.innerHTML=items.length?items.map(m=>{
    const pair=motifSoftColor(m.Code),bg=pair[0],fg=pair[1];
    return `<div class="motif-info-item" title="${esc(m.Libelle||"")}">
      <span class="motif-info-code" style="background:${bg};color:${fg}">${esc(m.Code)}</span>
      <span class="motif-info-label">${esc(m.Libelle||"")}</span>
    </div>`;
  }).join(""):'<div class="empty">Aucun motif actif.</div>';
}
function toggleMotifInfo(){
  const panel=$("motifInfoPanel"),btn=$("motifInfoToggle");
  if(!panel||!btn)return;
  const willShow=panel.hidden;
  panel.hidden=!willShow;
  btn.textContent=willShow?"ⓘ Masquer les motifs":"ⓘ Motifs disponibles";
}


function renderResetTimesheet(){
  const sel=$("resetTimesheetPerson");if(!sel)return;
  const current=sel.value;
  const people=(S.team||[]).filter(p=>p&&p.id).slice().sort((a,b)=>String(a.nom||a.Nom||"").localeCompare(String(b.nom||b.Nom||""),"fr"));
  sel.innerHTML='<option value="">Choisir une ressource…</option>'+people.map(p=>`<option value="${p.id}">${esc(p.nom||p.Nom||p.Name||("Ressource "+p.id))}</option>`).join("");
  if([...sel.options].some(o=>o.value===current))sel.value=current;
  updateResetModeUi();updateResetTimesheetCount();
}
function openResetTimesheetModal(){renderResetTimesheet();const m=$("resetTimesheetModal");if(m){m.hidden=false;m.style.display="flex";document.body.classList.add("modal-open")}}
function closeResetTimesheetModal(){const m=$("resetTimesheetModal");if(m){m.hidden=true;m.style.display="none";document.body.classList.remove("modal-open")}}


function updateResetModeUi(){const show=($("resetTimesheetMode")?.value||"all")==="period";if($("resetPeriodFields"))$("resetPeriodFields").hidden=!show}


function selectedResetRows(){
  const rid=Number($("resetTimesheetPerson")?.value||0);
  if(!rid)return [];

  let rows=S.presence.filter(r=>r.Ressource===rid);
  const mode=$("resetTimesheetMode")?.value||"all";

  if(mode==="period"){
    const from=$("resetPeriodFrom")?.value||"";
    const to=$("resetPeriodTo")?.value||"";
    if(!from||!to)return [];
    if(to<from)return [];
    rows=rows.filter(r=>{
      const d=iso(r.Date);
      return d>=from&&d<=to;
    });
  }
  return rows;
}

function updateResetTimesheetCount(){
  const count=$("resetTimesheetCount"),btn=$("resetTimesheetBtn");
  if(!count||!btn)return;

  const rid=Number($("resetTimesheetPerson")?.value||0);
  const mode=$("resetTimesheetMode")?.value||"all";
  const from=$("resetPeriodFrom")?.value||"";
  const to=$("resetPeriodTo")?.value||"";

  if(mode==="period"&&from&&to&&to<from){
    count.textContent="Période invalide";
    btn.disabled=true;
    return;
  }

  const n=selectedResetRows().length;
  count.textContent=`${n} ligne${n>1?"s":""}`;
  btn.disabled=!rid||n===0||(mode==="period"&&(!from||!to));
}

async function resetUserTimesheet(){
  const rid=Number($("resetTimesheetPerson")?.value||0);
  if(!rid)return notify("Sélectionnez une ressource.");

  const mode=$("resetTimesheetMode")?.value||"all";
  const from=$("resetPeriodFrom")?.value||"";
  const to=$("resetPeriodTo")?.value||"";

  if(mode==="period"){
    if(!from||!to)return notify("Renseignez la période à réinitialiser.");
    if(to<from)return notify("La date de fin doit être postérieure à la date de début.");
  }

  const pe=resource(rid);
  const rows=selectedResetRows();
  if(!rows.length)return notify("Aucune saisie à supprimer pour cette sélection.");
  const lockedRows=rows.filter(r=>isDateLocked(iso(r.Date)));if(lockedRows.length)return notify(`${lockedRows.length} ligne(s) sont dans une période verrouillée.`);

  const name=pe?.nom||`Ressource ${rid}`;
  const scope=mode==="all"
    ?"toute la feuille de présence"
    :`la période du ${new Date(from+"T12:00:00").toLocaleDateString("fr-FR")} au ${new Date(to+"T12:00:00").toLocaleDateString("fr-FR")}`;

  const first=window.confirm(`Réinitialiser ${scope} de « ${name} » ?\n\n${rows.length} ligne(s) de présence seront supprimées.`);
  if(!first)return;

  const second=window.confirm(`CONFIRMATION FINALE\n\nSupprimer définitivement ${rows.length} ligne(s) de Presences pour « ${name} » (${scope}) ?\n\nLa ressource Team ne sera pas supprimée.`);
  if(!second)return;

  const btn=$("resetTimesheetBtn");
  if(btn){btn.disabled=true;btn.textContent="Suppression…";}
  try{
    const ids=rows.map(r=>r.id).filter(Number.isFinite);
    if(!ids.length)throw new Error("Aucun identifiant de présence exploitable.");

    await grist.getTable(T.presence).destroy(ids);

    notify(`${ids.length} ligne(s) supprimée(s) pour ${name}`);
    S.changes.clear();
    S.selectedCells.clear();
    await load();

    if($("resetTimesheetPerson"))$("resetTimesheetPerson").value="";
    if($("resetTimesheetMode"))$("resetTimesheetMode").value="all";
    if($("resetPeriodFrom"))$("resetPeriodFrom").value="";
    if($("resetPeriodTo"))$("resetPeriodTo").value="";
    updateResetModeUi();
    updateResetTimesheetCount();
    closeResetTimesheetModal();
  }finally{
    if(btn)btn.textContent="Réinitialiser la feuille de présence";
  }
}


function renderInitCalendarPeople(){const sel=$("initCalendarPerson");if(!sel)return;const current=sel.value;const people=(S.team||[]).filter(p=>p&&p.id).slice().sort((a,b)=>String(a.nom||"").localeCompare(String(b.nom||""),"fr"));sel.innerHTML='<option value="">Choisir une ressource…</option>'+people.map(p=>`<option value="${p.id}">${esc(p.nom||("Ressource "+p.id))}</option>`).join("");if([...sel.options].some(o=>o.value===current))sel.value=current}
function renderInitCalendarMotifs(){const w=$("initWeekdayMotif"),we=$("initWeekendMotif"),rec=$("initRecurringMotif");if(!w||!we)return;const motifs=S.motifs.filter(m=>m.Actif!==false),opts=motifs.map(m=>`<option value="${m.id}">${esc(m.Code)} — ${esc(m.Libelle||"")}</option>`).join("");w.innerHTML=opts;we.innerHTML=opts;if(rec)rec.innerHTML=opts;const p=motifs.find(m=>m.Code==="P"),wem=motifs.find(m=>m.Code==="WE");if(p)w.value=String(p.id);if(wem)we.value=String(wem.id);if(rec&&p)rec.value=String(p.id)}
function isRecurringCalendarAction(){return String($("initCalendarAction")?.value||"").startsWith("recurring-")}
function recurringCalendarDays(){return new Set([...document.querySelectorAll(".init-recurring-day:checked")].map(x=>Number(x.value)))}
function recurringFrequencyConfig(){
  const type=$("initRecurringFrequency")?.value||"weekly";
  let weeks=1,months=0;
  if(type==="biweekly")weeks=2;else if(type==="triweekly")weeks=3;
  else if(type==="monthly")months=1;else if(type==="quarterly")months=3;else if(type==="semiannual")months=6;else if(type==="annual")months=12;
  else if(type==="custom-weeks")weeks=Math.max(1,Number($("initRecurringInterval")?.value||1));
  else if(type==="custom-months")months=Math.max(1,Number($("initRecurringInterval")?.value||1));
  return {type,weeks,months,ordinal:Number($("initRecurringOrdinal")?.value||1)};
}
function recurringDateMatches(d,start,days){
  if(!days.has(d.getDay()))return false;
  const cfg=recurringFrequencyConfig();
  if(cfg.months){
    const monthDiff=(d.getFullYear()-start.getFullYear())*12+(d.getMonth()-start.getMonth());
    if(monthDiff<0||monthDiff%cfg.months!==0)return false;
    if(cfg.ordinal===-1){const next=new Date(d);next.setDate(d.getDate()+7);return next.getMonth()!==d.getMonth()}
    return Math.floor((d.getDate()-1)/7)+1===cfg.ordinal;
  }
  const anchor=new Date(start);anchor.setHours(12,0,0,0);
  const cur=new Date(d);cur.setHours(12,0,0,0);
  const daysDiff=Math.floor((cur-anchor)/86400000);
  const weekIndex=Math.floor(daysDiff/7);
  return weekIndex>=0&&weekIndex%cfg.weeks===0;
}
function updateRecurringFrequencyUI(){
  const cfg=recurringFrequencyConfig(),custom=cfg.type.startsWith("custom-");
  const iw=$("initRecurringIntervalWrap"),ow=$("initRecurringOrdinalWrap"),input=$("initRecurringInterval");
  if(iw)iw.hidden=!custom;if(ow)ow.hidden=!cfg.months;
  if(input){input.max=cfg.type==="custom-months"?"24":"52";input.setAttribute("aria-label",cfg.type==="custom-months"?"Nombre de mois":"Nombre de semaines")}
  updateInitCalendarPreview();
}
function updateInitCalendarAction(){const recurring=isRecurringCalendarAction(),wrap=$("initRecurringWrap"),grid=document.querySelector(".init-motif-grid"),preserve=$("initPreserveHolidays")?.closest("label");if(wrap)wrap.hidden=!recurring;if(grid)grid.hidden=recurring;if(preserve)preserve.hidden=recurring;if(recurring&&$("initCalendarMode")?.value!=="period"){$("initCalendarMode").value="period"}const note=$("initCalendarNote");if(note)note.textContent=recurring?"Le motif récurrent suit la fréquence choisie à partir de la date de début. En création uniquement, les saisies existantes sont conservées. En création / modification, les dates correspondantes existantes sont remplacées. Les périodes verrouillées ne sont jamais modifiées.":"En mode Initialiser, les saisies existantes sont conservées. En mode Modifier en masse, elles sont mises à jour et les jours manquants sont créés. Les périodes verrouillées ne sont jamais modifiées.";updateInitCalendarMode()}
function updateInitCalendarMode(){const mode=$("initCalendarMode")?.value||"year";if($("initCalendarYearWrap"))$("initCalendarYearWrap").hidden=mode!=="year";if($("initCalendarPeriodWrap"))$("initCalendarPeriodWrap").hidden=mode!=="period";updateInitCalendarPreview()}
function initCalendarDateRange(){const mode=$("initCalendarMode")?.value||"year";if(mode==="year"){const y=Number($("initCalendarYear")?.value||0);return y?{from:`${y}-01-01`,to:`${y}-12-31`}:null}const from=$("initCalendarFrom")?.value||"",to=$("initCalendarTo")?.value||"";return from&&to&&to>=from?{from,to}:null}
function initCalendarPlan(){
  const rid=Number($("initCalendarPerson")?.value||0),range=initCalendarDateRange(),action=$("initCalendarAction")?.value||"initialize",recurring=action.startsWith("recurring-");
  const weekdayMotif=Number($("initWeekdayMotif")?.value||0),weekendMotif=Number($("initWeekendMotif")?.value||0),recurringMotif=Number($("initRecurringMotif")?.value||0),days=recurringCalendarDays(),preserveF=$("initPreserveHolidays")?.checked!==false;
  if(!rid||!range||(recurring?(!recurringMotif||!days.size):(!weekdayMotif||!weekendMotif)))return {creates:[],updates:[],locked:0,existing:0,preservedHolidays:0,matched:0};
  const byDate=new Map(S.presence.filter(r=>r.Ressource===rid).map(r=>[iso(r.Date),r])),creates=[],updates=[];let locked=0,existing=0,preservedHolidays=0,matched=0;
  let d=new Date(range.from+"T12:00:00"),finish=new Date(range.to+"T12:00:00");
  while(d<=finish){const ds=iso(d);if(recurring&&!recurringDateMatches(d,new Date(range.from+"T12:00:00"),days)){d.setDate(d.getDate()+1);continue}matched++;const old=byDate.get(ds),desiredMotif=recurring?recurringMotif:([0,6].includes(d.getDay())?weekendMotif:weekdayMotif);if(isDateLocked(ds))locked++;else if(old){const oldMotif=motif(old.Motif);if(!recurring&&preserveF&&oldMotif?.Code==="F")preservedHolidays++;else if(action==="upsert"||action==="recurring-upsert"){if(Number(old.Motif)!==desiredMotif)updates.push({record:old,ds,motifId:desiredMotif});else existing++}else existing++}else creates.push({ds,motifId:desiredMotif});d.setDate(d.getDate()+1)}
  return {creates,updates,locked,existing,preservedHolidays,matched};
}
function updateInitCalendarPreview(){
  const p=initCalendarPlan();

  if($("initCalendarCreates")){
    $("initCalendarCreates").textContent=`${p.creates.length} création${p.creates.length>1?"s":""}`;
  }
  if($("initCalendarUpdates")){
    $("initCalendarUpdates").textContent=`${p.updates.length} mise${p.updates.length>1?"s":""} à jour`;
  }
  if($("initCalendarLocked")){
    $("initCalendarLocked").textContent=`${p.locked} jour${p.locked>1?"s":""} verrouillé${p.locked>1?"s":""} ignoré${p.locked>1?"s":""}`;
  }
  if($("initCalendarExisting")){
    const kept=p.existing+p.preservedHolidays;
    $("initCalendarExisting").textContent=`${kept} jour${kept>1?"s":""} existant${kept>1?"s":""} conservé${kept>1?"s":""}`;
  }

  const btn=$("initCalendarBtn");
  if(btn)btn.disabled=(p.creates.length+p.updates.length)===0;
}
function openInitCalendarModal(){renderInitCalendarPeople();renderInitCalendarMotifs();const now=new Date();if($("initCalendarYear"))$("initCalendarYear").value=String(now.getFullYear());if($("initCalendarAction"))$("initCalendarAction").value="initialize";if($("initCalendarMode"))$("initCalendarMode").value="year";if($("initPreserveHolidays"))$("initPreserveHolidays").checked=true;if($("initRecurringFrequency"))$("initRecurringFrequency").value="weekly";if($("initRecurringInterval"))$("initRecurringInterval").value="2";if($("initRecurringOrdinal"))$("initRecurringOrdinal").value="1";updateInitCalendarAction();updateRecurringFrequencyUI();const m=$("initCalendarModal");if(m){m.hidden=false;m.style.display="flex";document.body.classList.add("modal-open")}}
function closeInitCalendarModal(){const m=$("initCalendarModal");if(m){m.hidden=true;m.style.display="none";document.body.classList.remove("modal-open")}}
async function initializeCalendar(){
  const rid=Number($("initCalendarPerson")?.value||0);
  if(!rid)return notify("Sélectionnez une ressource.");

  const plan=initCalendarPlan();
  const total=plan.creates.length+plan.updates.length;
  if(!total)return notify("Aucune modification à effectuer.");

  const pe=resource(rid);
  const action=$("initCalendarAction")?.value||"initialize";
  const modeLabel=action==="upsert"?"Modifier en masse":action==="recurring-create"?"Ajouter le motif récurrent (création uniquement)":action==="recurring-upsert"?"Ajouter le motif récurrent (création / modification)":"Initialiser";

  const message=
    `${modeLabel} le feuille de présence de « ${pe?.nom||"la ressource"} » ?\n\n`+
    `${plan.creates.length} création(s)\n`+
    `${plan.updates.length} mise(s) à jour\n`+
    `${plan.locked} date(s) verrouillée(s) ignorée(s)\n`+
    `${plan.existing+plan.preservedHolidays} date(s) existante(s) conservée(s).`;

  if(!window.confirm(message))return;

  const btn=$("initCalendarBtn");
  if(btn){btn.disabled=true;btn.textContent="Traitement…";}

  try{
    const table=grist.getTable(T.presence);

    const creates=plan.creates.map(x=>({
      fields:{
        Ressource:rid,
        Date:epoch(x.ds),
        Motif:Number(x.motifId),
        Statut:"Prévisionnel",
        Commentaire:action.startsWith("recurring-")?"Motif récurrent calendrier":"Initialisation / modification calendrier",
        Source:"Widget"
      }
    }));

    const updates=plan.updates.map(x=>({
      id:x.record.id,
      fields:{
        Motif:Number(x.motifId),
        Statut:"Prévisionnel",
        Commentaire:action.startsWith("recurring-")?"Modification motif récurrent calendrier":"Modification en masse calendrier",
        Source:"Widget"
      }
    }));

    if(updates.length)await table.update(updates);
    if(creates.length)await table.create(creates);

    notify(`${creates.length} création(s), ${updates.length} mise(s) à jour`);
    await load();
    closeInitCalendarModal();
  }finally{
    if(btn)btn.textContent="Initialiser / modifier la feuille de présence";
  }
}



function requestStatus(v){return normAccess(v||"EN_ATTENTE")}
function requestDate(v){try{return iso(v)}catch(_){return ""}}
function requestPersonId(r){return gristRefId(r?.Demandeur??r?.Ressource??r?.Collaborateur)}
function requestTeamId(r){return gristRefId(r?.Equipe??r?.Team)}
function requestManagerId(r){return gristRefId(r?.Manager)}
function currentTeamRecord(){
  const email=String(S.userScope?.email||"").toLowerCase();
  return S.team.find(r=>teamEmail(r)===email)||null
}
function roleAllowsRequests(){
  if(S.userScope?.isAdmin)return true;
  const me=currentTeamRecord();
  const role=normAccess(me?.role??me?.Role??me?.Profil??me?.Fonction??"");
  return role.includes("PMO")||role.includes("MANAGER")||role.includes("RESPONSABLE")
}
async function loadRequestsModule(){
  try{
    const tables=await grist.docApi.listTables();
    S.requestsTablesReady=tables.includes(T.managers)&&tables.includes(T.requests);
    if(!S.requestsTablesReady){
      S.managers=[];S.requests=[];S.managedTeamIds=new Set();
      S.requestsAllowed=!!S.userScope?.isAdmin;
      updateRequestsNav();
      return
    }
    const [m,d]=await Promise.all([grist.docApi.fetchTable(T.managers),grist.docApi.fetchTable(T.requests)]);
    S.managers=gristRows(m,T.managers);S.requests=gristRows(d,T.requests);
    const me=currentTeamRecord(),meId=Number(me?.id||0),email=String(S.userScope?.email||"").toLowerCase();
    const managed=new Set();
    S.managers.filter(x=>x.Actif!==false).forEach(x=>{
      const mid=gristRefId(x.Manager);
      const memail=String(x.Manager_Email||x.Email||"").trim().toLowerCase();
      if((meId&&mid===meId)||(email&&memail===email)) {
        const tid=gristRefId(x.Equipe); if(tid)managed.add(Number(tid));
      }
    });
    S.managedTeamIds=managed;
    S.requestsAllowed=!!S.userScope?.isAdmin||roleAllowsRequests()||managed.size>0;
    updateRequestsNav()
  }catch(e){
    console.warn("Demandes RH",e);S.requestsAllowed=false;updateRequestsNav()
  }
}
function updateRequestsNav(){
  const b=document.querySelector('.nav-item[data-view="demandesRH"]');
  if(!b)return;
  b.hidden=!S.requestsAllowed&&!S.userScope?.isAdmin;
}
function requestsInScope(){
  if(S.userScope?.isAdmin)return S.requests||[];
  return (S.requests||[]).filter(r=>S.managedTeamIds.has(Number(requestTeamId(r)||0)))
}
function renderRequestsModule(){
  const root=$("demandesRH");if(!root)return;
  const setup=$("requestsSetup"),content=$("requestsContent"),denied=$("requestsDenied");
  if(!S.requestsTablesReady){
    if(setup)setup.hidden=false;if(content)content.hidden=true;if(denied)denied.hidden=true;
    const btn=$("createRequestsTables");if(btn)btn.hidden=!S.userScope?.isAdmin;
    return
  }
  if(setup)setup.hidden=true;
  if(!S.requestsAllowed){
    if(content)content.hidden=true;if(denied)denied.hidden=false;return
  }
  if(denied)denied.hidden=true;if(content)content.hidden=false;
  const rows=requestsInScope().slice().sort((a,b)=>String(requestDate(b.Date_Demande)).localeCompare(String(requestDate(a.Date_Demande))));
  const pending=rows.filter(r=>requestStatus(r.Statut)==="EN_ATTENTE");
  if($("requestsPendingCount"))$("requestsPendingCount").textContent=String(pending.length);
  if($("requestsTotalCount"))$("requestsTotalCount").textContent=String(rows.length);
  const body=$("requestsBody");if(!body)return;
  body.innerHTML=rows.length?rows.map(r=>{
    const p=resource(requestPersonId(r)),team=teamRef(requestTeamId(r));
    const st=requestStatus(r.Statut),can=st==="EN_ATTENTE";
    return `<tr data-id="${r.id}">
      <td><strong>${esc(r.Reference||("DRH-"+r.id))}</strong></td>
      <td>${esc(p?.nom||r.Demandeur_Nom||"—")}</td>
      <td>${esc(team?.Libelle||team?.Code||"—")}</td>
      <td>${esc(r.Type||"CONGE")}</td>
      <td>${esc(requestDate(r.Date_Debut))}${requestDate(r.Date_Fin)&&requestDate(r.Date_Fin)!==requestDate(r.Date_Debut)?" → "+esc(requestDate(r.Date_Fin)):""}</td>
      <td><span class="badge">${esc(st.replaceAll("_"," "))}</span></td>
      <td>${esc(r.Commentaire_Demandeur||"")}</td>
      <td class="request-actions">${can?`<button class="btn primary req-approve" data-id="${r.id}">Valider</button><button class="btn secondary req-refuse" data-id="${r.id}">Refuser</button>`:""}</td>
    </tr>`
  }).join(""):'<tr><td colspan="8" class="empty">Aucune demande pour les équipes que vous gérez.</td></tr>';
  body.querySelectorAll(".req-approve").forEach(b=>b.onclick=()=>decideRequest(Number(b.dataset.id),"VALIDEE"));
  body.querySelectorAll(".req-refuse").forEach(b=>b.onclick=()=>decideRequest(Number(b.dataset.id),"REFUSEE"));
}
async function decideRequest(id,status){
  const r=S.requests.find(x=>Number(x.id)===Number(id));if(!r)return;
  if(!S.userScope?.isAdmin&&!S.managedTeamIds.has(Number(requestTeamId(r)||0)))return notify("Demande hors de votre périmètre.");
  const label=status==="VALIDEE"?"valider":"refuser";
  if(!window.confirm(`${label[0].toUpperCase()+label.slice(1)} la demande ${r.Reference||("#"+id)} ?`))return;
  const me=currentTeamRecord();
  await grist.getTable(T.requests).update({id,fields:{Statut:status,Manager:me?.id||null,Date_Decision:Math.floor(Date.now()/1000)}});
  await loadRequestsModule();renderRequestsModule();notify(status==="VALIDEE"?"Demande validée":"Demande refusée")
}
async function createRequestsTables(){
  if(!S.userScope?.isAdmin)return notify("Création réservée à l’administrateur.");
  const btn=$("createRequestsTables");if(btn){btn.disabled=true;btn.textContent="Création…"}
  try{
    const tables=await grist.docApi.listTables(),actions=[];
    if(!tables.includes(T.managers))actions.push(["AddTable",T.managers,[
      {id:"Equipe",type:"Ref:Team_ref"},{id:"Manager",type:"Ref:Team"},{id:"Manager_Email",type:"Text"},{id:"Actif",type:"Bool"},{id:"Commentaire",type:"Text"}
    ]]);
    if(!tables.includes(T.requests))actions.push(["AddTable",T.requests,[
      {id:"Reference",type:"Text"},{id:"Demandeur",type:"Ref:Team"},{id:"Equipe",type:"Ref:Team_ref"},{id:"Type",type:"Text"},
      {id:"Date_Debut",type:"Date"},{id:"Date_Fin",type:"Date"},{id:"Motif",type:"Ref:Motifs_RH"},{id:"Statut",type:"Text"},
      {id:"Manager",type:"Ref:Team"},{id:"Commentaire_Demandeur",type:"Text"},{id:"Commentaire_Manager",type:"Text"},
      {id:"Date_Demande",type:"DateTime"},{id:"Date_Decision",type:"DateTime"},{id:"UUID_Demande",type:"Text"}
    ]]);
    if(actions.length)await grist.docApi.applyUserActions(actions);
    await loadRequestsModule();renderRequestsModule();notify("Tables Demandes RH créées")
  }catch(e){console.error(e);notify(e.message||String(e))}
  finally{if(btn){btn.disabled=false;btn.textContent="Créer les tables"}}
}

function setSidebarCollapsed(collapsed){
  document.body.classList.toggle("sidebar-collapsed",collapsed);
  const btn=$("sidebarToggle");
  if(btn){
    btn.setAttribute("aria-expanded",String(!collapsed));
    btn.setAttribute("aria-label",collapsed?"Déplier le menu":"Réduire le menu");
    btn.title=collapsed?"Déplier le menu":"Réduire le menu";
    const icon=btn.querySelector(".sidebar-toggle-icon");
    if(icon)icon.textContent=collapsed?"›":"‹";
  }
  try{localStorage.setItem("rh-sidebar-collapsed",collapsed?"1":"0")}catch(_){}
}
function initSidebar(){
  // Réduit par défaut. Si l'utilisateur l'a déjà changé, on respecte son choix local.
  let collapsed=true;
  try{
    const saved=localStorage.getItem("rh-sidebar-collapsed");
    if(saved==="0")collapsed=false;
    if(saved==="1")collapsed=true;
  }catch(_){}
  setSidebarCollapsed(collapsed);
  const btn=$("sidebarToggle");
  if(btn)btn.onclick=()=>setSidebarCollapsed(!document.body.classList.contains("sidebar-collapsed"));
}

function presenceContext(){
  const active=document.querySelector(".nav-item.active");
  const view=active?.dataset?.view||"pilotage";
  const labels={pilotage:"Cockpit",previsionnel:"Planning",saisie:"Feuille de présence",imports:"Imports",alertes:"Alertes",rapports:"Rapports"};
  return {module:"Cockpit RH",context:labels[view]||"Cockpit RH",contextId:""};
}



const TAB_ACCESS_TABLE="ACCES_ONGLETS";
const TAB_ACCESS_MODULE="COCKPIT_RH";
const TAB_ACCESS_ALERTS="ALERTES";
const normAccess=v=>String(v??"").trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[\s\-]+/g,"_");
const accessFlag=(v,d=true)=>{
  if(v===null||v===undefined||v==="")return d;
  if(typeof v==="boolean")return v;
  if(typeof v==="number")return v!==0;
  return !["FALSE","0","NON","NO","OFF","INACTIF","INACTIVE"].includes(normAccess(v))
};
function teamEmail(r){return String(r?.Email??r?.email??r?.EMAIL??r?.Mail??r?.Utilisateur_Email??"").trim().toLowerCase()}
function teamName(r){return String(r?.Nom??r?.nom??r?.Nom_Ressource??r?.Name??r?.name??"").trim()}
function rowRefValue(row,fields){for(const f of fields){if(row&&row[f]!==undefined&&row[f]!==null&&row[f]!=="")return row[f]}return null}
function gristRefId(v){
  if(typeof v==="number"&&Number.isFinite(v))return v;
  if(Array.isArray(v)){
    // Grist references may be represented as ["R", id] / ["r", id].
    if((v[0]==="R"||v[0]==="r")&&Number.isFinite(Number(v[1])))return Number(v[1]);
    // Defensive support for a one-item reference list.
    for(const x of v){const id=gristRefId(x);if(id!==null)return id}
  }
  if(v&&typeof v==="object"){
    for(const k of ["id","rowId","recordId"]){
      if(Number.isFinite(Number(v[k])))return Number(v[k])
    }
  }
  const s=String(v??"").trim();
  if(/^\d+$/.test(s))return Number(s);
  return null
}
function gristRefIds(v){
  if(Array.isArray(v)&&["L","l"].includes(v[0]))return v.slice(1).map(gristRefId).filter(x=>x!==null);
  const id=gristRefId(v);return id===null?[]:[id]
}
function viewAsEmail(){
  // Grist "View As" garde l'identité réelle pour les écritures, mais expose
  // l'utilisateur simulé dans l'URL du document. Selon l'hébergement du widget,
  // le paramètre peut se trouver dans l'URL de l'iframe ou dans document.referrer.
  const candidates=[];
  try{candidates.push(String(window.location.href||""))}catch(_){}
  try{candidates.push(String(document.referrer||""))}catch(_){}
  try{
    // Fonctionne uniquement si le parent est same-origin ; sinon l'accès est bloqué
    // et on retombe silencieusement sur les autres sources.
    candidates.push(String(window.parent?.location?.href||""))
  }catch(_){}

  for(const raw of candidates){
    if(!raw)continue;
    try{
      const u=new URL(raw,window.location.href);
      for(const key of ["aclAsUser_","aclAsUser","viewAs","viewAsUser"]){
        const v=String(u.searchParams.get(key)||"").trim();
        if(v&&v.includes("@"))return v.toLowerCase()
      }
    }catch(_){
      const m=raw.match(/[?&](?:aclAsUser_|aclAsUser|viewAs|viewAsUser)=([^&#]+)/i);
      if(m){
        try{
          const v=decodeURIComponent(m[1]).trim();
          if(v.includes("@"))return v.toLowerCase()
        }catch(__){}
      }
    }
  }
  return ""
}
async function effectiveAccessUser(){
  const simulated=viewAsEmail();
  if(simulated)return {email:simulated,name:"",source:"view-as"};
  const user=await window.PmoPresence?.currentUser?.();
  return {
    email:String(user?.email||user?.Email||"").trim().toLowerCase(),
    name:String(user?.name||user?.Name||user?.nom||"").trim(),
    source:"session"
  }
}
async function delegatedTabAccess(tabCode){
  const tables=await grist.docApi.listTables();
  if(!tables.includes(TAB_ACCESS_TABLE))return {allowed:false,reason:`Table ${TAB_ACCESS_TABLE} absente`,tabCode,email:"",identitySource:"",teamIds:[],rows:0};

  const user=await effectiveAccessUser();
  const email=String(user?.email||"").trim().toLowerCase();
  if(!email)return {allowed:false,reason:"Utilisateur courant non identifié",tabCode,email:"",identitySource:user.source||"",teamIds:[],rows:0};

  // Team est la référence nominative de la délégation.
  let teamRows=S.team||[];
  if(!teamRows.length&&tables.includes(T.team))teamRows=gristRows(await grist.docApi.fetchTable(T.team),T.team);
  const meRows=teamRows.filter(r=>teamEmail(r)===email);
  if(!meRows.length)return {allowed:false,reason:"Utilisateur absent de Team",tabCode,email,identitySource:user.source||"",teamIds:[],rows:0};
  const myTeamIds=new Set(meRows.map(r=>Number(r.id)).filter(Number.isFinite));
  const myNames=new Set(meRows.map(teamName).filter(Boolean).map(normAccess));

  const rows=gristRows(await grist.docApi.fetchTable(TAB_ACCESS_TABLE),TAB_ACCESS_TABLE);

  // Le champ Module peut être le code texte COCKPIT_RH ou une Ref vers une table de modules.
  const moduleRefIds=new Set();
  for(const mt of ["ACCES_MODULE","ACCES_MODULES","DROITS_MODULES"]){
    if(!tables.includes(mt))continue;
    try{
      const mr=gristRows(await grist.docApi.fetchTable(mt),mt);
      mr.filter(r=>[r.Code,r.Code_Module,r.Module,r.Nom,r.Libelle].some(v=>normAccess(v)===TAB_ACCESS_MODULE))
        .forEach(r=>moduleRefIds.add(Number(r.id)));
    }catch(e){console.warn("Résolution module",mt,e)}
  }

  const allowed=rows.some(r=>{
    if(!accessFlag(rowRefValue(r,["Actif","Active","Enabled"]),true))return false;

    const tab=rowRefValue(r,["Onglet","Code_Onglet","Onglet_Code","Tab","Vue"]);
    if(normAccess(tab)!==normAccess(tabCode))return false;

    const mod=rowRefValue(r,["Module","Module_Code","Code_Module","Acces_Module"]);
    const moduleIds=gristRefIds(mod);
    const moduleOk=normAccess(mod)===TAB_ACCESS_MODULE || moduleIds.some(id=>moduleRefIds.has(id));
    if(!moduleOk)return false;

    const tr=rowRefValue(r,["Team","Ressource","Utilisateur","Collaborateur","Team_Id"]);
    const teamIds=gristRefIds(tr);

    // Important : un même email peut exister sur plusieurs lignes Team.
    // On autorise si la référence ACCES_ONGLETS pointe vers N'IMPORTE QUELLE
    // ligne Team correspondant à l'utilisateur connecté.
    if(teamIds.some(id=>myTeamIds.has(Number(id))))return true;

    // Si Grist renvoie une valeur texte, on compare email et noms connus.
    const target=normAccess(tr);
    if(target===normAccess(email)||myNames.has(target))return true;

    // Dernier secours : si la Ref est lisible mais pointe vers une autre ligne
    // Team portant le même email (cas de doublon / ancienne ligne), on la résout.
    for(const id of teamIds){
      const linked=teamRows.find(t=>Number(t.id)===Number(id));
      if(linked&&teamEmail(linked)===email)return true;
    }
    return false
  });

  if(!allowed)console.warn("[ACCES_ONGLETS] Aucun droit trouvé",{email,identitySource:user.source,tabCode,teamIds:[...myTeamIds],rows:rows.length});
  else console.info("[ACCES_ONGLETS] Droit accordé",{email,identitySource:user.source,tabCode,teamIds:[...myTeamIds]});
  return {
    allowed,
    reason:allowed?"Délégation ACCES_ONGLETS active":`Aucune délégation ${tabCode} active`,
    teamId:[...myTeamIds][0]||null,
    teamIds:[...myTeamIds],
    email,
    identitySource:user.source||"",
    tabCode,
    rows:rows.length
  }
}

function accessDiagnosticText(d){
  if(!d)return "Diagnostic non exécuté.";
  const ids=Array.isArray(d.teamIds)&&d.teamIds.length?d.teamIds.join(", "):"aucun";
  return [
    `Utilisateur détecté : ${d.email||"non identifié"}`,
    `Source identité : ${d.identitySource||"inconnue"}`,
    `Onglet : ${d.tabCode||"—"}`,
    `ID Team : ${ids}`,
    `Lignes ACCES_ONGLETS visibles : ${Number.isFinite(Number(d.rows))?d.rows:"—"}`,
    `Résultat : ${d.allowed?"AUTORISÉ":"REFUSÉ"}`,
    `Raison : ${d.reason||"—"}`
  ].join("\n")
}
function renderAccessDiagnostics(){
  const op=S.accessDiagnostics?.ALERTES;
  const an=S.accessDiagnostics?.ALERTES_ANNUELLES;
  const lg=S.accessDiagnostics?.LOGS;
  const combined=[
    `ALERTES\n${accessDiagnosticText(op)}`,
    `ALERTES_ANNUELLES\n${accessDiagnosticText(an)}`,
    `LOGS\n${accessDiagnosticText(lg)}`
  ].join("\n\n");
  if($("accessDiagnostic"))$("accessDiagnostic").textContent=combined;
}

async function checkSensitiveAlertsAccess(){
  try{
    // V6.26 : les deux onglets Alertes sont pilotés exclusivement par ACCES_ONGLETS.
    // Le statut Admin RH / Owner n'accorde plus d'accès implicite.
    S.alertsAdmin=false;
    const operational=await delegatedTabAccess("ALERTES");
    const annual=await delegatedTabAccess("ALERTES_ANNUELLES");
    const logs=await delegatedTabAccess("LOGS");

    S.accessDiagnostics={ALERTES:operational,ALERTES_ANNUELLES:annual,LOGS:logs};
    S.alertsAllowed=!!operational.allowed;
    S.annualAlertsAllowed=!!annual.allowed;
    S.logsAllowed=!!logs.allowed;
    S.alertAccessReason=operational.reason||"Accès non autorisé";
    S.alertsAdminChecked=true;
    updateSensitiveNavState();
    renderAccessDiagnostics();

    if(S.alertsAllowed&&$("allAlerts"))list($("allAlerts"),S.alerts||[]);
    if(S.annualAlertsAllowed)renderAnnualAlerts();
    return S.alertsAllowed||S.annualAlertsAllowed||S.logsAllowed
  }catch(e){
    console.warn("Contrôle accès onglets alertes",e);
    S.alertsAdmin=false;S.alertsAllowed=false;S.annualAlertsAllowed=false;S.logsAllowed=false;S.alertsAdminChecked=true;
    S.alertAccessReason="Erreur de contrôle d’accès";
    S.accessDiagnostics={
      ALERTES:{allowed:false,reason:e?.message||String(e),tabCode:"ALERTES",email:"",identitySource:"",teamIds:[],rows:0},
      ALERTES_ANNUELLES:{allowed:false,reason:e?.message||String(e),tabCode:"ALERTES_ANNUELLES",email:"",identitySource:"",teamIds:[],rows:0},
      LOGS:{allowed:false,reason:e?.message||String(e),tabCode:"LOGS",email:"",identitySource:"",teamIds:[],rows:0}
    };
    updateSensitiveNavState();renderAccessDiagnostics();return false
  }
}
function updateSensitiveNavState(){
  document.querySelectorAll(".sensitive-nav").forEach(b=>{
    const view=b.dataset.view;
    const allowed=view==="alertes"?S.alertsAllowed:view==="alertesAnnuelles"?S.annualAlertsAllowed:view==="logs"?S.logsAllowed:true;
    b.classList.toggle("sensitive-allowed",!!allowed);
    const lock=b.querySelector(".nav-lock");
    if(lock)lock.textContent=allowed?"":"🔒";
    b.title=allowed?"Accès autorisé via ACCES_ONGLETS":"Accès soumis à ACCES_ONGLETS"
  })
}
function sensitiveViewAllowed(view){
  if(view==="alertes")return !!S.alertsAllowed;
  if(view==="alertesAnnuelles")return !!S.annualAlertsAllowed;
  if(view==="logs")return !!S.logsAllowed;
  if(view==="demandesRH")return !!S.requestsAllowed;
  return true
}
function nav(){
  document.querySelectorAll(".nav-item").forEach(b=>b.onclick=async()=>{
    document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    window.PmoPresence?.touch?.();
    document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));

    const requested=b.dataset.view;
    const sensitive=["alertes","alertesAnnuelles","logs","demandesRH"].includes(requested);
    if(sensitive&&!S.alertsAdminChecked)await checkSensitiveAlertsAccess();

    const target=sensitiveViewAllowed(requested)?requested:"alertsRestricted";
    $(target)?.classList.add("active");

    const t={
      pilotage:["Cockpit RH","Disponibilité, capacité et alertes sur les présences ouvertes"],
      previsionnel:["Planning","Présences ouvertes et périodes réalisées par verrouillage"],
      saisie:["Feuille de présence","Saisie rapide des présences et absences pour plusieurs ressources"],
      imports:["Imports","Importez des calendriers Excel ou CSV dans Grist"],
      alertesAnnuelles:["Alertes annuelles","Projection annuelle des absences et franchissements de seuils"],
      alertes:["Alertes","Alertes calculées sur les présences ouvertes selon les seuils configurés"],
      rapports:["Rapports","Synthèse des dernières saisies enregistrées"],
      logs:["Logs","Diagnostic technique des droits d’accès aux onglets"],
      demandesRH:["Demandes RH","Validation des demandes des membres des équipes que vous gérez"]
    };
    const allowed=sensitiveViewAllowed(requested);
    $("title").textContent=sensitive&&!allowed?"Accès restreint":t[requested][0];
    $("subtitle").textContent=sensitive&&!allowed?"Droit requis pour cet onglet":t[requested][1];
    if(requested==="saisie")renderMassCalendar();
    if(requested==="logs"&&S.logsAllowed)renderAccessDiagnostics();
    if(requested==="demandesRH"&&S.requestsAllowed)renderRequestsModule();
    if(requested==="alertesAnnuelles"&&S.annualAlertsAllowed)renderAnnualAlerts();if(requested==="alertes"&&S.alertsAllowed)list($("allAlerts"),S.alerts||[])
  })
}
defaults();initSidebar();nav();if($("createRequestsTables"))$("createRequestsTables").onclick=()=>createRequestsTables();updateSensitiveNavState();initReportMotifsModal();checkSensitiveAlertsAccess();if($("refreshAccessDiagnostic"))$("refreshAccessDiagnostic").onclick=()=>{S.alertsAdminChecked=false;if($("accessDiagnostic"))$("accessDiagnostic").textContent="Contrôle en cours…";checkSensitiveAlertsAccess()};if($("annualAlertYear"))$("annualAlertYear").onchange=renderAnnualAlerts;["from","to","person"].forEach(id=>$(id).onchange=pilotage);if($("openReportMotifs"))$("openReportMotifs").onclick=openReportMotifs;if($("closeReportMotifs"))$("closeReportMotifs").onclick=closeReportMotifs;if($("applyReportMotifs"))$("applyReportMotifs").onclick=closeReportMotifs;if($("reportMotifsAll"))$("reportMotifsAll").onclick=()=>setAllReportMotifs(true);if($("reportMotifsNone"))$("reportMotifsNone").onclick=()=>setAllReportMotifs(false);if($("printHtmlReport"))$("printHtmlReport").onclick=generateHtmlReport;if($("exportHtmlReportDirect"))$("exportHtmlReportDirect").onclick=exportDynamicHtmlReport;if($("closeHtmlReport"))$("closeHtmlReport").onclick=closeHtmlReport;if($("cancelHtmlReport"))$("cancelHtmlReport").onclick=closeHtmlReport;if($("printHtmlReportFrame"))$("printHtmlReportFrame").onclick=printHtmlReportFrame;if($("exportHtmlReport"))$("exportHtmlReport").onclick=()=>exportDynamicHtmlReport(true);if($("previewReconcile"))$("previewReconcile").onclick=previewReconcile;if($("reconcileSource"))$("reconcileSource").onchange=previewReconcile;if($("reconcileTarget"))$("reconcileTarget").onchange=previewReconcile;if($("runReconcile"))$("runReconcile").onclick=()=>runReconcile().catch(e=>notify(e.message||e));$("refresh").onclick=()=>refreshCockpit().catch(e=>{notify(e.message||e);console.error(e)});
$("massTeam").onchange=renderMassCalendar;$("massActiveOnly").onchange=renderMassCalendar;$("prevMonth").onclick=previousHalfMonth;$("nextMonth").onclick=nextHalfMonth;$("selectAllVisible").onclick=selectAllVisible;$("clearSelection").onclick=clearSelection;$("deleteSelection").onclick=deleteSelection;$("saveMass").onclick=()=>saveMass().catch(e=>notify(e.message||e));
$("analyzeCsv").onclick=()=>csvAnalyzeFile().catch(e=>{S.csvAnalysis=null;csvRender();$("csvMessage").textContent=e.message;notify(e.message)});$("importCsv").onclick=()=>csvImport().catch(e=>{$("importCsv").disabled=false;$("csvMessage").textContent=e.message;notify(e.message)});
$("resetCsv").onclick=resetCsvImport;csvSetup();
$("excelFile").onchange=()=>loadExcelWorkbook().catch(e=>{$("excelInfo").textContent=e.message;notify(e.message)});
$("excelSheet").onchange=()=>{$("analyzeExcel").disabled=!$("excelSheet").value;$("excelInfo").textContent=$("excelSheet").value?`Feuille sélectionnée : ${$("excelSheet").value}`:""};
$("analyzeExcel").onclick=()=>{try{analyzeExcelSheet()}catch(e){S.csvAnalysis=null;csvRender();$("csvMessage").textContent=e.message;notify(e.message)}};
$("resetExcel").onclick=resetExcelImport;
if($("showAllMotifs"))$("showAllMotifs").onclick=showAllGridMotifs;
if($("hideAllMotifs"))$("hideAllMotifs").onclick=hideAllGridMotifs;
if($("openResetTimesheet"))$("openResetTimesheet").onclick=openResetTimesheetModal;
if($("closeResetTimesheet"))$("closeResetTimesheet").onclick=closeResetTimesheetModal;
if($("cancelResetTimesheet"))$("cancelResetTimesheet").onclick=closeResetTimesheetModal;
if($("resetTimesheetModal"))$("resetTimesheetModal").onclick=e=>{if(e.target===$("resetTimesheetModal"))closeResetTimesheetModal()};
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("resetTimesheetModal")?.hidden)closeResetTimesheetModal()});
if($("resetTimesheetPerson"))$("resetTimesheetPerson").onchange=updateResetTimesheetCount;
if($("resetTimesheetMode"))$("resetTimesheetMode").onchange=()=>{updateResetModeUi();updateResetTimesheetCount();};
if($("resetPeriodFrom"))$("resetPeriodFrom").onchange=updateResetTimesheetCount;
if($("resetPeriodTo"))$("resetPeriodTo").onchange=updateResetTimesheetCount;
if($("resetTimesheetBtn"))$("resetTimesheetBtn").onclick=()=>resetUserTimesheet().catch(e=>notify(e.message||e));
if($("openPeriodLocks"))$("openPeriodLocks").onclick=openPeriodLocksModal;
if($("closePeriodLocks"))$("closePeriodLocks").onclick=closePeriodLocksModal;
if($("cancelPeriodLocks"))$("cancelPeriodLocks").onclick=closePeriodLocksModal;
if($("createPeriodLock"))$("createPeriodLock").onclick=()=>createPeriodLock().catch(e=>notify(e.message||e));
if($("periodLocksModal"))$("periodLocksModal").onclick=e=>{if(e.target===$("periodLocksModal"))closePeriodLocksModal();};
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("periodLocksModal")?.hidden)closePeriodLocksModal();});
document.addEventListener("click",e=>{
  const b=e.target.closest?.("#createPeriodLock");
  if(!b||b.dataset.lockDelegated==="1")return;
  // Normal onclick is installed when the modal exists. This fallback only covers a missing binding.
  if(typeof b.onclick!=="function"){
    e.preventDefault();
    createPeriodLock().catch(err=>notify(err.message||err));
  }
});
grist.onOptions((options,interaction)=>{S.accessLevel=interaction?.access_level||interaction?.accessLevel||S.accessLevel;renderPeriodLocks();});
if($("appVersion"))$("appVersion").textContent=`Cockpit RH · ${APP_VERSION}`;
if($("openInitCalendar"))$("openInitCalendar").onclick=openInitCalendarModal;
if($("closeInitCalendar"))$("closeInitCalendar").onclick=closeInitCalendarModal;
if($("cancelInitCalendar"))$("cancelInitCalendar").onclick=closeInitCalendarModal;
if($("initCalendarModal"))$("initCalendarModal").onclick=e=>{if(e.target===$("initCalendarModal"))closeInitCalendarModal();};
if($("initCalendarPerson"))$("initCalendarPerson").onchange=updateInitCalendarPreview;
if($("initCalendarMode"))$("initCalendarMode").onchange=updateInitCalendarMode;
if($("initCalendarYear"))$("initCalendarYear").oninput=updateInitCalendarPreview;
if($("initCalendarFrom"))$("initCalendarFrom").onchange=updateInitCalendarPreview;
if($("initCalendarTo"))$("initCalendarTo").onchange=updateInitCalendarPreview;
if($("initWeekdayMotif"))$("initWeekdayMotif").onchange=updateInitCalendarPreview;
if($("initWeekendMotif"))$("initWeekendMotif").onchange=updateInitCalendarPreview;
if($("initCalendarBtn"))$("initCalendarBtn").onclick=()=>initializeCalendar().catch(e=>notify(e.message||e));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("initCalendarModal")?.hidden)closeInitCalendarModal();});
if($("initCalendarAction"))$("initCalendarAction").onchange=updateInitCalendarAction;
if($("initRecurringMotif"))$("initRecurringMotif").onchange=updateInitCalendarPreview;
if($("initRecurringFrequency"))$("initRecurringFrequency").onchange=updateRecurringFrequencyUI;
if($("initRecurringInterval"))$("initRecurringInterval").oninput=updateInitCalendarPreview;
if($("initRecurringOrdinal"))$("initRecurringOrdinal").onchange=updateInitCalendarPreview;
document.querySelectorAll(".init-recurring-day").forEach(x=>x.onchange=updateInitCalendarPreview);
if($("initPreserveHolidays"))$("initPreserveHolidays").onchange=updateInitCalendarPreview;
if($("cockpitVersion"))$("cockpitVersion").textContent=`Cockpit RH · ${APP_VERSION}`;
grist.ready({requiredAccess:"full"});window.PmoPresence?.start({widget:"COCKPIT_RH",version:APP_VERSION,getContext:presenceContext});load().catch(e=>notify(e.message||e));

["alertLevelFilter","alertSearch"].forEach(id=>{const el=$(id);if(el)el.addEventListener(id==="alertSearch"?"input":"change",()=>{if(S.alertsAllowed)list($("allAlerts"),S.alerts||[])})});
