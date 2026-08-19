const VERSION="2.4";
const T={team:"Team",motifs:"Motifs_RH",presence:"Presences",alerts:"Parametres_Alertes"};
const S={team:[],motifs:[],presence:[],params:[],visible:new Set(),alerts:[],available:[],errors:{},log:[]};

const $=id=>document.getElementById(id);
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const esc=(s="")=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const date=v=>typeof v==="number"?new Date(v*1000):Array.isArray(v)&&v[0]==="D"?new Date(v[1]*1000):new Date(v);
const iso=v=>{const d=date(v);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const epoch=s=>Math.floor(new Date(`${s}T12:00:00`).getTime()/1000);

const resource=id=>S.team.find(x=>x.id===Number(id));
const motif=id=>S.motifs.find(x=>x.id===Number(id));
const activeTeam=()=>S.team.filter(x=>x.actif!==false);

function notify(m){
  const t=$("toast"); if(!t)return;
  t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200);
}
function logError(action,message){
  S.log.unshift({time:new Date(),action,message:String(message)});
  if(S.log.length>100)S.log.length=100;
  renderDiagnostic();
}
function clearLog(){S.log=[];renderDiagnostic();}

function normalizeRecords(raw, tableId){
  if(Array.isArray(raw)) return raw;

  if(raw && typeof raw==="object"){
    if(Array.isArray(raw.records)) return raw.records;

    const candidate =
      (raw.columns && typeof raw.columns==="object" ? raw.columns : null) ||
      (raw.data && typeof raw.data==="object" && !Array.isArray(raw.data) ? raw.data : null) ||
      raw;

    const keys=Object.keys(candidate).filter(k=>Array.isArray(candidate[k]));
    if(keys.length){
      const length=Math.max(...keys.map(k=>candidate[k].length));
      const records=[];
      for(let i=0;i<length;i++){
        const rec={};
        for(const k of keys) rec[k]=candidate[k][i];
        records.push(rec);
      }
      return records;
    }
  }
  throw new Error(`Format non reconnu pour ${tableId}; clés=${raw&&typeof raw==="object"?Object.keys(raw).slice(0,20).join(","):"aucune"}`);
}

async function safeFetch(tableId){
  if(!S.available.includes(tableId)){
    S.errors[tableId]=`Table absente : ${tableId}`;
    return [];
  }
  try{
    const raw=await grist.docApi.fetchTable(tableId);
    return normalizeRecords(raw,tableId);
  }catch(e){
    const msg=e?.message||String(e);
    S.errors[tableId]=`${tableId} : ${msg}`;
    logError(`Chargement ${tableId}`,msg);
    return [];
  }
}

function defaults(){
  const a=new Date(),b=new Date(a);b.setDate(b.getDate()+30);
  if($("from"))$("from").value=iso(a);
  if($("to"))$("to").value=iso(b);
  if($("entryFrom"))$("entryFrom").value=iso(a);
  if($("entryTo"))$("entryTo").value=iso(a);
}

async function load(){
  $("sync").textContent=`V${VERSION} · Synchronisation…`;
  S.errors={};

  try{
    S.available=await grist.docApi.listTables();
  }catch(e){
    logError("Liste des tables",e?.message||String(e));
    $("sync").textContent=`V${VERSION} · Erreur`;
    renderDiagnostic();
    return;
  }

  const [team,motifs,presence,params]=await Promise.all([
    safeFetch(T.team),safeFetch(T.motifs),safeFetch(T.presence),safeFetch(T.alerts)
  ]);

  S.team=team;S.motifs=motifs;S.presence=presence;S.params=params;

  // On active tous les motifs au premier chargement.
  if(!S.visible.size){
    S.motifs.filter(x=>x.Actif!==false).forEach(x=>S.visible.add(x.id));
  }

  $("sync").textContent=`V${VERSION} · Team ${S.team.length} · Présences ${S.presence.length}`;
  render();
}

function render(){
  renderSelects();
  renderChips();
  pilotage();
  recent();
  renderAlerts();
  renderDiagnostic();
}

function renderSelects(){
  const opts=activeTeam()
    .slice()
    .sort((a,b)=>String(a.nom||"").localeCompare(String(b.nom||"")))
    .map(x=>`<option value="${x.id}">${esc(x.nom||`Ressource ${x.id}`)}</option>`).join("");

  if($("person"))$("person").innerHTML='<option value="">Toute l’équipe</option>'+opts;
  if($("entryPerson"))$("entryPerson").innerHTML='<option value="">Choisir…</option>'+opts;

  if($("entryMotif")){
    $("entryMotif").innerHTML=S.motifs
      .filter(x=>x.Actif!==false&&!["F","WE"].includes(x.Code))
      .map(x=>`<option value="${x.id}">${esc(x.Code||"")} — ${esc(x.Libelle||"")}</option>`).join("");
  }
}

function renderChips(){
  if(!$("chips"))return;
  $("chips").innerHTML=S.motifs
    .filter(x=>x.Actif!==false&&!["F","WE"].includes(x.Code))
    .map(x=>`<button class="chip ${S.visible.has(x.id)?"on":"off"}" data-id="${x.id}">${esc(x.Code||"")}</button>`).join("");

  $("chips").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
    const id=Number(b.dataset.id);
    S.visible.has(id)?S.visible.delete(id):S.visible.add(id);
    renderChips();pilotage();
  }));
}

function selected(){
  if(!$("from")||!$("to"))return [];
  const a=new Date($("from").value+"T00:00:00");
  const b=new Date($("to").value+"T23:59:59");
  const pid=Number($("person")?.value||0);

  return S.presence.filter(x=>{
    const d=date(x.Date);
    return d>=a&&d<=b&&(!pid||x.Ressource===pid)&&S.visible.has(x.Motif);
  });
}

function pilotage(){
  const rr=selected();
  let work=0,p=0,a=0,tl=0,fo=0;const count={};

  rr.forEach(r=>{
    const m=motif(r.Motif); if(!m)return;
    if(m.Compte_Capacite!==false){
      work++;p+=num(m.Presence_Equivalent);a+=num(m.Absence_Equivalent);
    }
    if(["TL","TE","TLE"].includes(m.Code))tl++;
    if(m.Code==="FO")fo++;
    count[m.id]=(count[m.id]||0)+1;
  });

  if($("presenceKpi"))$("presenceKpi").textContent=`${(work?p/work*100:0).toFixed(1)} %`;
  if($("presenceSub"))$("presenceSub").textContent=`${p.toFixed(1)} / ${work} jours`;
  if($("absenceKpi"))$("absenceKpi").textContent=a.toFixed(1);
  if($("remoteKpi"))$("remoteKpi").textContent=tl.toFixed(1);
  if($("formationKpi"))$("formationKpi").textContent=fo.toFixed(1);
  if($("scope"))$("scope").textContent=$("person")?.value?(resource($("person").value)?.nom||"Ressource"):"Équipe";

  bars(count);chart(rr);
  S.alerts=computeAlerts();
  list($("preview"),S.alerts.slice(0,6));
  if($("count"))$("count").textContent=S.alerts.length;
}

function bars(c){
  if(!$("bars"))return;
  const e=Object.entries(c).sort((a,b)=>b[1]-a[1]),mx=Math.max(1,...e.map(x=>x[1]));
  $("bars").innerHTML=e.length?e.map(([id,v])=>{
    const m=motif(id);
    return `<div class="bar"><span>${esc(m?.Libelle||id)}</span><div class="track"><div class="fill" style="width:${v/mx*100}%;background:${esc(m?.Couleur||"#2563eb")}"></div></div><strong>${v}</strong></div>`;
  }).join(""):'<div class="empty">Aucune donnée</div>';
}

function chart(rr){
  const svg=$("chart"); if(!svg)return;
  const by={};
  rr.forEach(r=>{
    const m=motif(r.Motif);if(!m||m.Compte_Capacite===false)return;
    const k=iso(r.Date);by[k]??={w:0,p:0};by[k].w++;by[k].p+=num(m.Presence_Equivalent);
  });
  const ds=Object.keys(by).sort();
  if(!ds.length){svg.innerHTML='<text x="30" y="60" class="axis">Aucune donnée</text>';return;}
  const vs=ds.map(k=>by[k].p/by[k].w*100),W=900,H=300,L=48,R=16,TT=18,B=40,iw=W-L-R,ih=H-TT-B;
  const x=i=>L+(ds.length===1?iw/2:i/(ds.length-1)*iw),y=v=>TT+(100-v)/100*ih;
  let h="";
  [0,25,50,75,100].forEach(v=>h+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" class="gridline"/><text x="8" y="${y(v)+4}" class="axis">${v}%</text>`);
  h+=`<polyline points="${vs.map((v,i)=>`${x(i)},${y(v)}`).join(" ")}" class="line"/>`;
  svg.innerHTML=h;
}

function severity(p,v){
  const o=num(p.Seuil_Orange),r=num(p.Seuil_Rouge);
  if(p.Sens==="MIN"){if(v<=r)return"red";if(v<=o)return"orange";}
  else{if(v>=r)return"red";if(v>=o)return"orange";}
  return null;
}
function forecast(a,b){
  return S.presence.filter(r=>{
    const d=date(r.Date);
    return d>=a&&d<=b&&["Prévisionnel","Confirmé"].includes(r.Statut);
  });
}
function computeAlerts(){
  const now=new Date();now.setHours(0,0,0,0);
  const out=[],team=activeTeam();
  const add=(p,l,v,dt="")=>{const s=severity(p,v);if(s)out.push({s,l,v,u:p.Unite||"",dt});};

  S.params.filter(p=>p.Actif!==false).forEach(p=>{
    const days=Math.max(1,num(p.Fenetre_Jours,1)),end=new Date(now);end.setDate(end.getDate()+days-1);
    const rr=forecast(now,end);

    if(p.Code_Alerte==="ABS_IND"){
      team.forEach(pe=>{
        let v=0;rr.filter(r=>r.Ressource===pe.id).forEach(r=>v+=num(motif(r.Motif)?.Absence_Equivalent));
        add(p,`${pe.nom} · absences prévues`,v);
      });
    }

    if(p.Code_Alerte==="ABS_EQ"){
      let abs=0,w=0;
      rr.forEach(r=>{const m=motif(r.Motif);if(m&&m.Compte_Capacite!==false){w++;abs+=num(m.Absence_Equivalent);}});
      add(p,"Équipe · taux d’absence prévu",w?abs/w*100:0);
    }

    if(["CAP_MIN","PRES_PHY","TL_SIM","FO_SIM"].includes(p.Code_Alerte)){
      const by={};rr.forEach(r=>(by[iso(r.Date)]??=[]).push(r));
      Object.entries(by).forEach(([d,day])=>{
        let v=0;
        if(p.Code_Alerte==="CAP_MIN"){
          let pr=0,w=0;day.forEach(r=>{const m=motif(r.Motif);if(m&&m.Compte_Capacite!==false){w++;pr+=num(m.Presence_Equivalent);}});
          v=w?pr/w*100:100;
        }
        if(p.Code_Alerte==="PRES_PHY")v=day.filter(r=>motif(r.Motif)?.Code==="P").length;
        if(p.Code_Alerte==="TL_SIM")v=day.filter(r=>["TL","TE","TLE"].includes(motif(r.Motif)?.Code)).length/Math.max(1,team.length)*100;
        if(p.Code_Alerte==="FO_SIM")v=day.filter(r=>motif(r.Motif)?.Code==="FO").length/Math.max(1,team.length)*100;
        add(p,p.Libelle,v,d);
      });
    }
  });

  return out.sort((a,b)=>(a.s==="red"?0:1)-(b.s==="red"?0:1));
}

function list(el,a){
  if(!el)return;
  el.innerHTML=a.length?a.map(x=>`<div class="alert ${x.s}"><strong>${x.s==="red"?"Critique":"Vigilance"} · ${esc(x.l)}</strong><small>${x.dt?x.dt+" · ":""}${Number(x.v).toFixed(1)} ${esc(x.u)}</small></div>`).join(""):'<div class="empty">Aucune alerte</div>';
}
function renderAlerts(){S.alerts=computeAlerts();list($("allAlerts"),S.alerts);}

function recent(){
  if(!$("recent"))return;
  const rr=S.presence.slice().sort((a,b)=>date(b.Date)-date(a.Date)).slice(0,30);
  $("recent").innerHTML=rr.length?rr.map(r=>`<tr><td>${date(r.Date).toLocaleDateString("fr-FR")}</td><td>${esc(resource(r.Ressource)?.nom||"")}</td><td>${esc(motif(r.Motif)?.Code||"")}</td><td>${esc(r.Statut||"")}</td><td>${esc(r.Commentaire||"")}</td></tr>`).join(""):'<tr><td colspan="5" class="empty">Aucune présence enregistrée.</td></tr>';
}

function range(a,b,weekdays){
  const out=[],d=new Date(a+"T12:00:00"),e=new Date(b+"T12:00:00");
  while(d<=e){if(!weekdays||![0,6].includes(d.getDay()))out.push(new Date(d));d.setDate(d.getDate()+1);}
  return out;
}

async function save(){
  const rid=Number($("entryPerson").value),mid=Number($("entryMotif").value),a=$("entryFrom").value,b=$("entryTo").value;
  if(!rid||!mid||!a||!b)return notify("Champs obligatoires manquants");
  const ds=range(a,b,$("weekdays").checked),table=grist.getTable(T.presence),creates=[],updates=[];

  ds.forEach(d=>{
    const key=iso(d);
    const old=S.presence.find(r=>r.Ressource===rid&&iso(r.Date)===key);
    const fields={Ressource:rid,Date:epoch(key),Motif:mid,Statut:$("entryStatus").value,Commentaire:$("comment").value.trim(),Source:"Widget"};
    old?updates.push({id:old.id,fields}):creates.push({fields});
  });

  try{
    if(updates.length)await table.update(updates);
    if(creates.length)await table.create(creates);
    notify("Saisie enregistrée");await load();
  }catch(e){
    logError("Enregistrement présence",e?.message||String(e));
    notify(e?.message||String(e));
  }
}

function renderDiagnostic(){
  const body=$("diagTables"),log=$("diagLog"),badge=$("diagBadge");
  if(!body||!log)return;
  const defs=[[T.team,S.team],[T.motifs,S.motifs],[T.presence,S.presence],[T.alerts,S.params]];
  body.innerHTML=defs.map(([name,rows])=>{
    const err=S.errors[name],visible=S.available.includes(name),state=err?"Erreur":visible?"OK":"Absente";
    return `<tr><td><strong>${esc(name)}</strong></td><td>${state}</td><td>${visible&&!err?rows.length:"—"}</td><td>${esc(err||(!visible?"Table non visible par le widget":""))}</td></tr>`;
  }).join("");

  log.innerHTML=S.log.length?S.log.map(x=>`<tr><td>${x.time.toLocaleTimeString("fr-FR")}</td><td>${esc(x.action)}</td><td>${esc(x.message)}</td></tr>`).join(""):'<tr><td colspan="3" class="empty">Aucune erreur enregistrée pendant cette session.</td></tr>';

  if(badge){
    badge.textContent=S.log.length?`• ${S.log.length}`:"";
    badge.className=S.log.length?"diag-count":"";
  }
}

function nav(){
  document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));

    const target=b.dataset.view==="diagnostic"?$("diagnosticView"):$(b.dataset.view);
    if(target)target.classList.add("active");

    const t={
      pilotage:["Pilotage","Disponibilité et prévisionnel"],
      saisie:["Saisie temps","Présence, absence, télétravail et formation"],
      alertes:["Alertes","Risques prévisionnels"],
      diagnostic:["Diagnostic","État technique du Cockpit RH"]
    };
    if(t[b.dataset.view]){
      $("title").textContent=t[b.dataset.view][0];
      $("subtitle").textContent=t[b.dataset.view][1];
    }
  }));
}

function init(){
  defaults();nav();
  ["from","to","person"].forEach(id=>{if($(id))$(id).addEventListener("change",pilotage);});
  if($("refresh"))$("refresh").addEventListener("click",load);
  if($("saveTime"))$("saveTime").addEventListener("click",save);
  if($("diagRefresh"))$("diagRefresh").addEventListener("click",load);
  if($("diagClear"))$("diagClear").addEventListener("click",clearLog);
  grist.ready({requiredAccess:"full"});
  load();
}
init();
