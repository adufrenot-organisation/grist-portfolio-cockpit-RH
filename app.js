const T={team:"Team",teams:"Team_ref",motifs:"Motifs_RH",presence:"Presences",alerts:"Parametres_Alertes"};

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
const S={team:[],teams:[],motifs:[],presence:[],params:[],visible:new Set(),alerts:[],month:new Date(),selectedMotif:null,changes:new Map(),selectedCells:new Set()};
const $=id=>document.getElementById(id),num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d,esc=(s="")=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const date=v=>typeof v==="number"?new Date(v*1000):Array.isArray(v)&&v[0]==="D"?new Date(v[1]*1000):new Date(v);
const iso=v=>{const d=date(v);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const epoch=s=>Math.floor(new Date(`${s}T12:00:00`).getTime()/1000),resource=id=>S.team.find(x=>x.id===Number(id)),motif=id=>S.motifs.find(x=>x.id===Number(id));
const notify=m=>{const t=$("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)};
function defaults(){const a=new Date(),b=new Date(a);b.setDate(b.getDate()+30);$("from").value=iso(a);$("to").value=iso(b);S.month=new Date(a.getFullYear(),a.getMonth(),1)}
async function load(){
  $("sync").textContent="Synchronisation…";
  try {
    const available = await grist.docApi.listTables();
    const missing = Object.values(T).filter(name => !available.includes(name));
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
    render();
    if (!S.team.length) notify("La table Team est vide : aucune ressource à afficher");
  } catch(e) {
    console.error(e);
    $("sync").textContent="Erreur de chargement";
    notify(e.message||String(e));
    throw e;
  }
}
function activeTeam(){return S.team.filter(x=>x.actif!==false)}
function render(){const opts=activeTeam().sort((a,b)=>String(a.nom).localeCompare(String(b.nom))).map(x=>`<option value="${x.id}">${esc(x.nom)}</option>`).join("");$("person").innerHTML='<option value="">Toute l’équipe</option>'+opts;chips();pilotage();recent();alerts();renderForecast();renderMassFilters();renderMassMotifs();renderMassCalendar();renderLegend()}
function chips(){$("chips").innerHTML=S.motifs.filter(x=>x.Actif!==false&&!["F","WE"].includes(x.Code)).map(x=>`<button class="chip ${S.visible.has(x.id)?"on":"off"}" data-id="${x.id}">${esc(x.Code)}</button>`).join("");$("chips").querySelectorAll("button").forEach(b=>b.onclick=()=>{const id=Number(b.dataset.id);S.visible.has(id)?S.visible.delete(id):S.visible.add(id);chips();pilotage()})}
function selected(){const a=new Date($("from").value+"T00:00:00"),b=new Date($("to").value+"T23:59:59"),pid=Number($("person").value||0);return S.presence.filter(x=>{const d=date(x.Date);return d>=a&&d<=b&&(!pid||x.Ressource===pid)&&S.visible.has(x.Motif)})}
function pilotage(){const rr=selected();let work=0,p=0,a=0,tl=0,fo=0;const count={};rr.forEach(r=>{const m=motif(r.Motif);if(!m)return;if(m.Compte_Capacite!==false){work++;p+=num(m.Presence_Equivalent);a+=num(m.Absence_Equivalent)}if(["TL","TE","TLE"].includes(m.Code))tl++;if(m.Code==="FO")fo++;count[m.id]=(count[m.id]||0)+1});$("presenceKpi").textContent=`${(work?p/work*100:0).toFixed(1)} %`;$("presenceSub").textContent=`${p.toFixed(1)} / ${work} jours`;$("absenceKpi").textContent=a.toFixed(1);$("remoteKpi").textContent=tl.toFixed(1);$("formationKpi").textContent=fo.toFixed(1);$("scope").textContent=$("person").value?(resource($("person").value)?.nom||"Ressource"):"Équipe";bars(count);chart(rr);S.alerts=compute();list($("preview"),S.alerts.slice(0,6));$("count").textContent=S.alerts.length}
function bars(c){const e=Object.entries(c).sort((a,b)=>b[1]-a[1]),mx=Math.max(1,...e.map(x=>x[1]));$("bars").innerHTML=e.length?e.map(([id,v])=>{const m=motif(id);return `<div class="bar"><span>${esc(m?.Libelle||id)}</span><div class="track"><div class="fill" style="width:${v/mx*100}%;background:${esc(m?.Couleur||"#2563eb")}"></div></div><strong>${v}</strong></div>`}).join(""):'<div class="empty">Aucune donnée</div>'}
function chart(rr){const by={};rr.forEach(r=>{const m=motif(r.Motif);if(!m||m.Compte_Capacite===false)return;const k=iso(r.Date);by[k]??={w:0,p:0};by[k].w++;by[k].p+=num(m.Presence_Equivalent)});const ds=Object.keys(by).sort(),svg=$("chart");if(!ds.length){svg.innerHTML='<text x="30" y="60" class="axis">Aucune donnée</text>';return}const vs=ds.map(k=>by[k].p/by[k].w*100),W=900,H=300,L=48,R=16,TT=18,B=40,iw=W-L-R,ih=H-TT-B,x=i=>L+(ds.length===1?iw/2:i/(ds.length-1)*iw),y=v=>TT+(100-v)/100*ih;let h="";[0,25,50,75,100].forEach(v=>h+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" class="gridline"/><text x="8" y="${y(v)+4}" class="axis">${v}%</text>`);h+=`<polyline points="${vs.map((v,i)=>`${x(i)},${y(v)}`).join(" ")}" class="line"/>`;svg.innerHTML=h}
function severity(p,v){const o=num(p.Seuil_Orange),r=num(p.Seuil_Rouge);if(p.Sens==="MIN"){if(v<=r)return"red";if(v<=o)return"orange"}else{if(v>=r)return"red";if(v>=o)return"orange"}return null}
function forecast(a,b){return S.presence.filter(r=>{const d=date(r.Date);return d>=a&&d<=b&&["Prévisionnel","Confirmé"].includes(r.Statut)})}
function compute(){const now=new Date();now.setHours(0,0,0,0);const out=[],team=activeTeam(),add=(p,l,v,dt="")=>{const s=severity(p,v);if(s)out.push({s,l,v,u:p.Unite||"",dt})};S.params.filter(p=>p.Actif!==false).forEach(p=>{const days=Math.max(1,num(p.Fenetre_Jours,1)),end=new Date(now);end.setDate(end.getDate()+days-1);const rr=forecast(now,end);
if(p.Code_Alerte==="ABS_IND")team.forEach(pe=>{let v=0;rr.filter(r=>r.Ressource===pe.id).forEach(r=>v+=num(motif(r.Motif)?.Absence_Equivalent));add(p,`${pe.nom} · absences prévues`,v)});
if(p.Code_Alerte==="ABS_EQ"){let abs=0,w=0;rr.forEach(r=>{const m=motif(r.Motif);if(m&&m.Compte_Capacite!==false){w++;abs+=num(m.Absence_Equivalent)}});add(p,"Équipe · taux d’absence prévu",w?abs/w*100:0)}
if(["CAP_MIN","PRES_PHY","TL_SIM","FO_SIM"].includes(p.Code_Alerte)){const by={};rr.forEach(r=>(by[iso(r.Date)]??=[]).push(r));Object.entries(by).forEach(([d,day])=>{let v=0;if(p.Code_Alerte==="CAP_MIN"){let pr=0,w=0;day.forEach(r=>{const m=motif(r.Motif);if(m&&m.Compte_Capacite!==false){w++;pr+=num(m.Presence_Equivalent)}});v=w?pr/w*100:100}if(p.Code_Alerte==="PRES_PHY")v=day.filter(r=>motif(r.Motif)?.Code==="P").length;if(p.Code_Alerte==="TL_SIM")v=day.filter(r=>["TL","TE","TLE"].includes(motif(r.Motif)?.Code)).length/Math.max(1,team.length)*100;if(p.Code_Alerte==="FO_SIM")v=day.filter(r=>motif(r.Motif)?.Code==="FO").length/Math.max(1,team.length)*100;add(p,p.Libelle,v,d)})}
});return out.sort((a,b)=>(a.s==="red"?0:1)-(b.s==="red"?0:1))}
function list(el,a){el.innerHTML=a.length?a.map(x=>`<div class="alert ${x.s}"><strong>${x.s==="red"?"Critique":"Vigilance"} · ${esc(x.l)}</strong><small>${x.dt?x.dt+" · ":""}${Number(x.v).toFixed(1)} ${esc(x.u)}</small></div>`).join(""):'<div class="empty">Aucune alerte</div>'}
function alerts(){S.alerts=compute();list($("allAlerts"),S.alerts)}
function recent(){const rr=S.presence.slice().sort((a,b)=>date(b.Date)-date(a.Date)).slice(0,30);$("recent").innerHTML=rr.map(r=>`<tr><td>${date(r.Date).toLocaleDateString("fr-FR")}</td><td>${esc(resource(r.Ressource)?.nom||"")}</td><td>${esc(motif(r.Motif)?.Code||"")}</td><td>${esc(r.Statut||"")}</td><td>${esc(r.Commentaire||"")}</td></tr>`).join("")}

function teamRef(id){return S.teams.find(x=>x.id===Number(id))}
function renderForecast(){const now=new Date();now.setHours(0,0,0,0);const rr=S.presence.filter(r=>date(r.Date)>=now&&["Prévisionnel","Confirmé"].includes(r.Statut)).slice().sort((a,b)=>date(a.Date)-date(b.Date)).slice(0,150);$("forecastRows").innerHTML=rr.length?rr.map(r=>`<tr><td>${date(r.Date).toLocaleDateString("fr-FR")}</td><td>${esc(resource(r.Ressource)?.nom||"")}</td><td>${esc(motif(r.Motif)?.Code||"")}</td><td>${esc(r.Statut||"")}</td><td>${esc(r.Commentaire||"")}</td></tr>`).join(""):'<tr><td colspan="5" class="empty">Aucune donnée prévisionnelle</td></tr>'}
function motifSoftColor(code){const map={"A":["#daf2d8","#258a31"],"1/2 M":["#dcecff","#2672c5"],"1/2 AM":["#dcecff","#2672c5"],"FO":["#fff0cf","#b06d00"],"F":["#eee5fa","#7a45b2"],"WE":["#eef1f4","#4f6474"],"TE":["#d9f3f2","#12877f"],"TLE":["#d9f3f2","#12877f"],"TL":["#d9f3f2","#12877f"],"P":["#ffe0e8","#d83467"]};return map[code]||["#e8f4f3","#176b68"]}
function renderMassFilters(){const current=$("massTeam").value;$("massTeam").innerHTML='<option value="">Toutes les équipes</option>'+S.teams.map(t=>`<option value="${t.id}">${esc(t.Libelle||t.Code||"Équipe")}</option>`).join("");if([...$("massTeam").options].some(o=>o.value===current))$("massTeam").value=current}
function renderMassMotifs(){const usable=S.motifs.filter(m=>m.Actif!==false);if(!S.selectedMotif&&usable.length)S.selectedMotif=usable.find(m=>m.Code==="A")?.id||usable[0].id;$("massMotifs").innerHTML=usable.map(m=>{const [bg,fg]=motifSoftColor(m.Code);return `<button class="motif-btn ${S.selectedMotif===m.id?"active":""}" data-id="${m.id}" style="background:${bg};color:${fg}">${esc(m.Code)}<small>${esc(m.Libelle||"")}</small></button>`}).join("");$("massMotifs").querySelectorAll(".motif-btn").forEach(b=>b.onclick=()=>{S.selectedMotif=Number(b.dataset.id);renderMassMotifs()})}
function massResources(){const team=Number($("massTeam").value||0),activeOnly=$("massActiveOnly").checked;return S.team.filter(r=>(!team||r.equipe===team)&&(!activeOnly||r.actif!==false)).sort((a,b)=>String(a.nom).localeCompare(String(b.nom)))}
function daysInMonth(d){const y=d.getFullYear(),m=d.getMonth(),n=new Date(y,m+1,0).getDate();return Array.from({length:n},(_,i)=>new Date(y,m,i+1))}
function presenceFor(resourceId,dateStr){return S.presence.find(r=>r.Ressource===resourceId&&iso(r.Date)===dateStr)}
function cellKey(resourceId,dateStr){return `${resourceId}|${dateStr}`}
function displayMotifForCell(resourceId,dateStr){const key=cellKey(resourceId,dateStr);if(S.changes.has(key))return S.changes.get(key);const old=presenceFor(resourceId,dateStr);return old?old.Motif:null}
function initials(name=""){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()}
function renderMassCalendar(){const res=massResources(),days=daysInMonth(S.month),today=iso(new Date());$("resourceCount").textContent=`${res.length} ressource${res.length>1?"s":""} affichée${res.length>1?"s":""}`;$("monthLabel").textContent=S.month.toLocaleDateString("fr-FR",{month:"long",year:"numeric"}).replace(/^./,c=>c.toUpperCase());$("massHead").innerHTML=`<tr><th class="sticky-name">Ressource</th><th class="sticky-team">Équipe</th>${days.map(d=>{const w=[0,6].includes(d.getDay()),ds=iso(d);return `<th class="day-head ${w?"weekend":""}">${d.toLocaleDateString("fr-FR",{weekday:"short"}).replace(".","")}<strong>${String(d.getDate()).padStart(2,"0")}</strong></th>`}).join("")}</tr>`;$("massBody").innerHTML=res.map(r=>`<tr><td class="sticky-name"><div class="resource-name"><span class="avatar">${initials(r.nom)}</span><span>${esc(r.nom)}</span></div></td><td class="sticky-team">${esc(teamRef(r.equipe)?.Libelle||teamRef(r.equipe)?.Code||"—")}</td>${days.map(d=>{const ds=iso(d),key=cellKey(r.id,ds),mid=displayMotifForCell(r.id,ds),m=motif(mid),weekend=[0,6].includes(d.getDay()),selected=S.selectedCells.has(key),changed=S.changes.has(key),colors=m?motifSoftColor(m.Code):["#fff","#fff"];return `<td class="resource-cell ${weekend?"weekend":""} ${selected?"selected":""} ${m?"has-value":""}"><button class="cell-toggle" data-r="${r.id}" data-d="${ds}"><span class="cell-box" style="${m?`background:${colors[0]};color:${colors[1]};border:1px solid ${colors[1]}44`:""}">${m?esc(m.Code):""}</span>${changed?'<span class="modified-dot"></span>':""}</button></td>`}).join("")}</tr>`).join("");$("massBody").querySelectorAll(".cell-toggle").forEach(b=>b.onclick=()=>toggleCell(Number(b.dataset.r),b.dataset.d));$("saveSummary").textContent=S.changes.size?`${S.changes.size} modification${S.changes.size>1?"s":""} en attente`:""}
function toggleCell(resourceId,dateStr){const key=cellKey(resourceId,dateStr),old=presenceFor(resourceId,dateStr);if(!S.selectedMotif)return notify("Sélectionnez d'abord un motif.");S.selectedCells.add(key);S.changes.set(key,S.selectedMotif);renderMassCalendar()}
function selectAllVisible(){if(!S.selectedMotif)return notify("Sélectionnez un motif.");const res=massResources(),days=daysInMonth(S.month).filter(d=>![0,6].includes(d.getDay()));res.forEach(r=>days.forEach(d=>{const ds=iso(d),key=cellKey(r.id,ds);S.selectedCells.add(key);S.changes.set(key,S.selectedMotif)}));renderMassCalendar()}
function clearSelection(){S.selectedCells.clear();S.changes.clear();renderMassCalendar()}
function deleteSelection(){if(!S.selectedCells.size)return notify("Aucune case sélectionnée.");S.selectedCells.forEach(key=>S.changes.set(key,null));renderMassCalendar()}
async function saveMass(){if(!S.changes.size)return notify("Aucune modification à enregistrer.");const table=grist.getTable(T.presence),creates=[],updates=[];for(const [key,mid] of S.changes.entries()){const [ridStr,ds]=key.split("|"),rid=Number(ridStr),old=presenceFor(rid,ds);if(mid===null){if(old)updates.push({id:old.id,fields:{Motif:0,Commentaire:"",Source:"Widget"}});continue}const fields={Ressource:rid,Date:epoch(ds),Motif:Number(mid),Statut:$("massStatus").value,Commentaire:$("massComment").value.trim(),Source:"Widget"};old?updates.push({id:old.id,fields}):creates.push({fields})}if(updates.length)await table.update(updates);if(creates.length)await table.create(creates);const total=creates.length+updates.length;S.changes.clear();S.selectedCells.clear();notify(`${total} modification${total>1?"s":""} enregistrée${total>1?"s":""}`);await load()}
function renderLegend(){$("massLegend").innerHTML=S.motifs.filter(m=>m.Actif!==false).map(m=>{const [bg,fg]=motifSoftColor(m.Code);return `<div class="legend-item"><span class="legend-code" style="background:${bg};color:${fg}">${esc(m.Code)}</span><span>${esc(m.Libelle||"")}</span></div>`}).join("")}
function nav(){document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));$(b.dataset.view).classList.add("active");const t={pilotage:["Cockpit","Disponibilité et prévisionnel"],previsionnel:["Prévisionnel","Saisies futures et confirmées"],saisie:["Saisie des temps — Saisie de masse","Remplissez rapidement les présences / absences pour plusieurs ressources"],alertes:["Alertes","Risques prévisionnels"],rapports:["Rapports","Dernières saisies"]};$("title").textContent=t[b.dataset.view][0];$("subtitle").textContent=t[b.dataset.view][1];if(b.dataset.view==="saisie")renderMassCalendar()})}
defaults();nav();["from","to","person"].forEach(id=>$(id).onchange=pilotage);$("refresh").onclick=load;$("massTeam").onchange=renderMassCalendar;$("massActiveOnly").onchange=renderMassCalendar;$("prevMonth").onclick=()=>{S.month=new Date(S.month.getFullYear(),S.month.getMonth()-1,1);clearSelection()};$("nextMonth").onclick=()=>{S.month=new Date(S.month.getFullYear(),S.month.getMonth()+1,1);clearSelection()};$("selectAllVisible").onclick=selectAllVisible;$("clearSelection").onclick=clearSelection;$("deleteSelection").onclick=deleteSelection;$("saveMass").onclick=()=>saveMass().catch(e=>notify(e.message||e));grist.ready({requiredAccess:"full"});load().catch(e=>notify(e.message||e));
