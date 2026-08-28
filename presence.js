/* GRIST PMO — Présence partagée v2 */
(function(){
  const TABLE="SESSIONS_UTILISATEURS", HEARTBEAT_MS=60000, ACTIVE_MINUTES=10;
  const makeId=()=>{try{return crypto.randomUUID()}catch(_){return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}};
  function sid(){const k="grist-pmo:presence:v2:session";let v=sessionStorage.getItem(k);if(!v){v=makeId();sessionStorage.setItem(k,v)}return v}
  function rows(d){if(!d||!Array.isArray(d.id))return[];const ks=Object.keys(d);return d.id.map((_,i)=>Object.fromEntries(ks.map(k=>[k,Array.isArray(d[k])?d[k][i]:d[k]])))}
  const now=()=>Math.floor(Date.now()/1000), has=(d,k)=>d&&Object.prototype.hasOwnProperty.call(d,k);
  const P={
    widget:"MODULE",version:"",rowId:null,timer:null,started:false,getContext:()=>({module:"Module",context:document.title||"",contextId:""}),
    async schema(){const raw=await grist.docApi.fetchTable(TABLE);return{raw,all:rows(raw)}},
    payload(raw){const c=this.getContext()||{},p={},put=(k,v)=>{if(has(raw,k))p[k]=v};
      put("Widget_Code",this.widget);put("Widget_Version",this.version);put("Page",String(c.context||""));
      put("Module",String(c.module||this.widget));put("Contexte",String(c.context||""));
      put("Contexte_ID",c.contextId==null?"":String(c.contextId));put("Derniere_Activite",now());put("Actif",true);return p},
    async ensureRow(){const s=sid(),{raw,all}=await this.schema(),f=all.find(r=>String(r.Session_ID||"")===s);if(f){this.rowId=f.id;return raw}
      const fields=this.payload(raw);if(has(raw,"Session_ID"))fields.Session_ID=s;
      await grist.docApi.applyUserActions([["AddRecord",TABLE,null,fields]]);
      const raw2=await grist.docApi.fetchTable(TABLE),c=rows(raw2).find(r=>String(r.Session_ID||"")===s);
      if(!c)throw new Error("Session créée mais non retrouvée");this.rowId=c.id;return raw2},
    async beat(){try{const raw=this.rowId?await grist.docApi.fetchTable(TABLE):await this.ensureRow();
      await grist.docApi.applyUserActions([["UpdateRecord",TABLE,this.rowId,this.payload(raw)]]);return true
      }catch(e){this.rowId=null;console.warn("[PRESENCE V2]",e);return false}},
    async start(o={}){if(this.started)return;this.started=true;this.widget=o.widget||this.widget;this.version=o.version||"";if(typeof o.getContext==="function")this.getContext=o.getContext;
      await this.beat();this.timer=setInterval(()=>this.beat(),HEARTBEAT_MS);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")this.beat()})},
    touch(){if(this.started)return this.beat()},
    async currentUser(){try{if(!this.rowId)await this.ensureRow();const raw=await grist.docApi.fetchTable(TABLE),r=rows(raw).find(x=>Number(x.id)===Number(this.rowId));return r?{email:String(r.Utilisateur_Email||"").trim(),name:String(r.Utilisateur_Nom||"").trim()}:{email:"",name:""}}catch(_){return{email:"",name:""}}},
    async listActive(o={}){const raw=await grist.docApi.fetchTable(TABLE),cut=Date.now()/1000-(o.minutes||ACTIVE_MINUTES)*60,all=o.allModules!==false&&o.allWidgets!==false,w=String(o.module||o.widget||this.widget);
      const a=rows(raw).filter(r=>Number(r.Derniere_Activite||0)>=cut&&(!has(raw,"Actif")||r.Actif!==false)&&(all||String(r.Module||r.Widget_Code||"")===w)),g=new Map();
      for(const r of a){const ident=String(r.Utilisateur_Email||r.Utilisateur_Nom||r.Session_ID||r.id),mod=String(r.Module||r.Widget_Code||"Module"),k=`${ident.toLowerCase()}::${mod.toLowerCase()}`,e={...r,Module:mod,Contexte:r.Contexte||r.Page||"",Contexte_ID:r.Contexte_ID||"",sessions:1},p=g.get(k);
        if(!p)g.set(k,e);else{const n=p.sessions+1;if(Number(r.Derniere_Activite||0)>Number(p.Derniere_Activite||0))Object.assign(p,e);p.sessions=n}}
      return [...g.values()].sort((a,b)=>Number(b.Derniere_Activite||0)-Number(a.Derniere_Activite||0))}
  };
  window.PmoPresence=P;
})();