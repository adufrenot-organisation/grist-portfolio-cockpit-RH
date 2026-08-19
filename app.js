const T={team:"Team",motifs:"Motifs_RH",presence:"Presences",alerts:"Parametres_Alertes"};

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
const S={team:[],motifs:[],presence:[],params:[],visible:new Set(),alerts:[]};
const $=id=>document.getElementById(id),num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d,esc=(s="")=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const date=v=>typeof v==="number"?new Date(v*1000):Array.isArray(v)&&v[0]==="D"?new Date(v[1]*1000):new Date(v);
const iso=v=>{const d=date(v);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const epoch=s=>Math.floor(new Date(`${s}T12:00:00`).getTime()/1000),resource=id=>S.team.find(x=>x.id===Number(id)),motif=id=>S.motifs.find(x=>x.id===Number(id));
const notify=m=>{const t=$("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)};
function defaults(){const a=new Date(),b=new Date(a);b.setDate(b.getDate()+30);$("from").value=iso(a);$("to").value=iso(b);$("entryFrom").value=iso(a);$("entryTo").value=iso(a)}
async function load(){
  $("sync").textContent="Synchronisation…";
  try {
    const available = await grist.docApi.listTables();
    const missing = Object.values(T).filter(name => !available.includes(name));
    if (missing.length) throw new Error(`Tables Grist absentes : ${missing.join(", ")}`);
    const [a,b,c,d]=await Promise.all([
      grist.docApi.fetchTable(T.team),
      grist.docApi.fetchTable(T.motifs),
      grist.docApi.fetchTable(T.presence),
      grist.docApi.fetchTable(T.alerts)
    ]);
    S.team=gristRows(a,"Team"); S.motifs=gristRows(b,"Motifs_RH"); S.presence=gristRows(c,"Presences"); S.params=gristRows(d,"Parametres_Alertes");
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
function render(){const opts=activeTeam().sort((a,b)=>String(a.nom).localeCompare(String(b.nom))).map(x=>`<option value="${x.id}">${esc(x.nom)}</option>`).join("");$("person").innerHTML='<option value="">Toute l’équipe</option>'+opts;$("entryPerson").innerHTML='<option value="">Choisir…</option>'+opts;$("entryMotif").innerHTML=S.motifs.filter(x=>x.Actif!==false&&!["F","WE"].includes(x.Code)).map(x=>`<option value="${x.id}">${esc(x.Code)} — ${esc(x.Libelle)}</option>`).join("");chips();pilotage();recent();alerts()}
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
function range(a,b,weekdays){const out=[],d=new Date(a+"T12:00:00"),e=new Date(b+"T12:00:00");while(d<=e){if(!weekdays||![0,6].includes(d.getDay()))out.push(new Date(d));d.setDate(d.getDate()+1)}return out}
async function save(){const rid=Number($("entryPerson").value),mid=Number($("entryMotif").value),a=$("entryFrom").value,b=$("entryTo").value;if(!rid||!mid||!a||!b)return notify("Champs obligatoires manquants");const ds=range(a,b,$("weekdays").checked),table=grist.getTable(T.presence),creates=[],updates=[];ds.forEach(d=>{const key=iso(d),old=S.presence.find(r=>r.Ressource===rid&&iso(r.Date)===key),fields={Ressource:rid,Date:epoch(key),Motif:mid,Statut:$("entryStatus").value,Commentaire:$("comment").value.trim(),Source:"Widget"};old?updates.push({id:old.id,fields}):creates.push({fields})});if(updates.length)await table.update(updates);if(creates.length)await table.create(creates);notify("Saisie enregistrée");await load()}
function nav(){document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));$(b.dataset.view).classList.add("active");const t={pilotage:["Pilotage","Disponibilité et prévisionnel"],saisie:["Saisie temps","Présence, absence, télétravail et formation"],alertes:["Alertes","Risques prévisionnels"]};$("title").textContent=t[b.dataset.view][0];$("subtitle").textContent=t[b.dataset.view][1]})}
defaults();nav();["from","to","person"].forEach(id=>$(id).onchange=pilotage);$("refresh").onclick=load;$("saveTime").onclick=()=>save().catch(e=>notify(e.message||e));grist.ready({requiredAccess:"full"});load().catch(e=>notify(e.message||e));