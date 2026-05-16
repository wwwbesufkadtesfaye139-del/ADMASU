
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, where, serverTimestamp, orderBy, limit }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
  const cfg = {
    apiKey:"AIzaSyBmVe4COOYoXIFuHTBppL2cm8vY78aLaek",
    authDomain:"protrack-e9960.firebaseapp.com",
    projectId:"protrack-e9960",
    storageBucket:"protrack-e9960.appspot.com",
    messagingSenderId:"338575084922",
    appId:"1:338575084922:web:68c1704e67303f27622878"
  };
  const app=initializeApp(cfg);
  const db=getFirestore(app);
  const auth=getAuth(app);
  window.db=db;window.collection=collection;window.addDoc=addDoc;
  window.getDocs=getDocs;window.doc=doc;window.setDoc=setDoc;
  window.deleteDoc=deleteDoc;window.query=query;window.where=where;
  window.serverTimestamp=serverTimestamp;
  signInAnonymously(auth).catch(e=>console.error("Auth:",e));





'use strict';
// ════════════════════════════════════════════════
//  CONSTANTS & STATE
// ════════════════════════════════════════════════
const APP_VERSION = '1.3.3';
const DEV_RECOVERY_CODE = 'PROTRACK-DEV-2025-RESET';
const EAT_TZ='Africa/Addis_Ababa';
const ROLES=['Technician','Under Supervision','Inspector','Preliminary Inspector'];
const ROLE_ACCESS_PROFILES={
  tech:['Technician'],
  tech_sup:['Under Supervision'],
  tech_insp:['Technician','Inspector','Preliminary Inspector'],
  all:['Technician','Under Supervision','Inspector','Preliminary Inspector']
};
const ROLE_ACCESS_LABELS={
  tech:'Technician only',
  tech_sup:'Under supervision only',
  tech_insp:'Inspector + Technician + Preliminary',
  all:'All 4 roles'
};
const ROLE_COLORS=['var(--blue)','var(--green)','var(--violet)','var(--cyan)'];
const ROLE_SEL=['sel0','sel1','sel2','sel3'];
const AV_COLORS=['#3b82f6','#10b981','#f59e0b','#f43f5e','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

let CU=null,CR=null,selRole='tech';
let techs=[],parts=[],leaders=[],controllers=[],entries=[],assignments=[];
let settings={defaultMonthlyTarget:160,passwords:{tech:'demo',lead:'demo',dev:'dev123'}};
let profilePics={};
let selJobRole='Technician',selJobRoleIdx=0;
let selectedPartsByPrefix={e:null,le:null};
let jobType='completed';
let editTechId=null,editPartId=null,editLeaderId=null,editControllerId=null;
let achievFilter='all';
let loginAttempts=0;
let pendingEntry=null;
let lastImportedTechs=[];
let lastImportedParts=[];

// ════════════════════════════════════════════════
//  PRODUCTION IMPORT PERSISTENCE
// ════════════════════════════════════════════════

// IMPORT: IGNORE EMPLOYEE ALWAYS (button prompts)
const EMP_IMPORT_IGNORE_KEY='pt-import-ignore-employee-always';
let empImportIgnoreAlways=new Set();
try{empImportIgnoreAlways=new Set(JSON.parse(localStorage.getItem(EMP_IMPORT_IGNORE_KEY)||'[]'));}catch(e){empImportIgnoreAlways=new Set();}
const PROD_IMPORT_STORAGE_KEY='pt-production-import-state-v1';
function saveProductionImportState(){try{localStorage.setItem(PROD_IMPORT_STORAGE_KEY,JSON.stringify({results:productionImportResults,pendingRows:productionImportPendingRows,keySeq:productionImportKeySeq}));}catch(e){}}
function loadProductionImportState(){try{const raw=localStorage.getItem(PROD_IMPORT_STORAGE_KEY);if(!raw)return;const data=JSON.parse(raw);if(Array.isArray(data?.results))productionImportResults=data.results;productionImportPendingRows=(data?.pendingRows&&typeof data.pendingRows==='object')?data.pendingRows:{};productionImportKeySeq=Number.isFinite(Number(data?.keySeq))?Number(data.keySeq):productionImportKeySeq;}catch(e){}}

// ════════════════════════════════════════════════
//  THEME
// ════════════════════════════════════════════════
function toggleTheme(){
  const t=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem('pt-theme',t);
  document.querySelectorAll('.theme-btn,#theme-btn').forEach(b=>b.textContent=t==='dark'?'🌙':'☀️');
}
(function initTheme(){
  const saved=localStorage.getItem('pt-theme')||'dark';
  document.documentElement.setAttribute('data-theme',saved);
  document.querySelectorAll('.theme-btn,#theme-btn').forEach(b=>b.textContent=saved==='dark'?'🌙':'☀️');
})();
window.toggleTheme=toggleTheme;

// ════════════════════════════════════════════════
//  SIDEBAR (mobile)
// ════════════════════════════════════════════════
function toggleSidebar(){const sb=document.getElementById('sb');const ov=document.getElementById('sb-overlay');sb.classList.toggle('open');ov.classList.toggle('on');}
function closeSidebar(){document.getElementById('sb').classList.remove('open');document.getElementById('sb-overlay').classList.remove('on');}
window.toggleSidebar=toggleSidebar;window.closeSidebar=closeSidebar;

// ════════════════════════════════════════════════
//  LOADING OVERLAY
// ════════════════════════════════════════════════
function showLoading(msg='Loading…'){const o=document.getElementById('loading-overlay');const t=document.getElementById('loading-txt');if(t)t.textContent=msg;if(o)o.classList.remove('hide');}
function hideLoading(){const o=document.getElementById('loading-overlay');if(o)o.classList.add('hide');}

function renderImportSummary(kind){
  const title=document.getElementById('imp-sum-title');
  const body=document.getElementById('imp-sum-body');
  const rows = kind==='tech' ? lastImportedTechs : lastImportedParts;
  if(title) title.textContent = kind==='tech' ? 'Imported Technicians' : 'Imported Parts';
  if(!body) return;
  if(!rows.length){
    body.innerHTML = '<div class="empty"><div class="ei">📭</div><div class="et">No new rows were imported.</div></div>';
    return;
  }
  if(kind==='tech'){
    body.innerHTML = `<div class="tw"><table><thead> <tr><th>ID</th><th>Name</th><th>Monthly Target</th><th>Status</th></tr> </thead><tbody>` +
      rows.map(r=>`<tr><td class="mono">${sanitize(r.id)}</td><td>${sanitize(r.name)}</td><td class="mono">${sanitizeNum(r.monthlyTarget)}h</td><td><span class="bdg bgr">${sanitize(r.status||'active')}</span></td></tr>`).join('') +
      `</tbody></table></div>`;
  } else {
    body.innerHTML = `<div class="tw"><table><thead> <tr><th>Part #</th><th>Name</th><th>Hours</th><th>ATA</th></tr> </thead><tbody>` +
      rows.map(r=>`<tr><td class="mono">${sanitize(r.num)}</td><td>${sanitize(r.name)}</td><td class="mono">${sanitizeNum(r.hours)}h</td><td class="mono">${sanitize(r.ata||'')}</td></tr>`).join('') +
      `</tbody></table></div>`;
  }
  openModal('m-import-summary');
}

// ════════════════════════════════════════════════
//  TIME HELPERS
// ════════════════════════════════════════════════
function fmtEAT(iso,mode='datetime'){
  if(!iso)return'—';
  try{const d=new Date(iso);if(isNaN(d))return iso;
    if(mode==='time')return d.toLocaleTimeString('en-GB',{timeZone:EAT_TZ,hour:'2-digit',minute:'2-digit'});
    if(mode==='date')return d.toLocaleDateString('en-GB',{timeZone:EAT_TZ,day:'2-digit',month:'short',year:'numeric'});
    return d.toLocaleString('en-GB',{timeZone:EAT_TZ,day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }catch(e){return iso;}
}
function nowEAT(){
  const n=new Date(),eat=new Date(n.toLocaleString('en-US',{timeZone:EAT_TZ}));
  const p=n=>String(n).padStart(2,'0');
  return `${eat.getFullYear()}-${p(eat.getMonth()+1)}-${p(eat.getDate())}T${p(eat.getHours())}:${p(eat.getMinutes())}`;
}
function todayEAT(){return new Date().toLocaleDateString('en-CA',{timeZone:EAT_TZ});}
function getEATPartsFromISO(isoDate){
  const d=(isoDate||todayEAT()).slice(0,10);
  const [y,m,day]=d.split('-').map(Number);
  return {y,m,day};
}
function pad2(n){return String(n).padStart(2,'0');}
function makeDateStr(y,m,d){return `${y}-${pad2(m)}-${pad2(d)}`;}
function daysInMonth(y,m){return new Date(Date.UTC(y,m,0)).getUTCDate();}
function getMR(){
  const {y,m}=getEATPartsFromISO(todayEAT());
  return {start:makeDateStr(y,m,1),end:makeDateStr(y,m,daysInMonth(y,m))};
}
function getWR(){
  const {y,m,day}=getEATPartsFromISO(todayEAT());
  const utc=new Date(Date.UTC(y,m-1,day));
  const dow=utc.getUTCDay();
  const mon=new Date(utc);
  mon.setUTCDate(utc.getUTCDate()-(dow===0?6:dow-1));
  const fri=new Date(mon);
  fri.setUTCDate(mon.getUTCDate()+4);
  return {
    start:makeDateStr(mon.getUTCFullYear(),mon.getUTCMonth()+1,mon.getUTCDate()),
    end:makeDateStr(fri.getUTCFullYear(),fri.getUTCMonth()+1,fri.getUTCDate())
  };
}
function getMonthRangeFromInput(v){
  const fallback=todayEAT().slice(0,7);
  const ym=(v||fallback).slice(0,7);
  const [yy,mm]=ym.split('-').map(Number);
  if(!yy||!mm){const mr=getMR();return {...mr,label:new Date().toLocaleDateString('en-GB',{month:'long',year:'numeric'})};}
  const start=`${yy}-${String(mm).padStart(2,'0')}-01`;
  const end=makeDateStr(yy,mm,daysInMonth(yy,mm));
  const label=new Date(Date.UTC(yy,mm-1,1)).toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
  return {start,end,label};
}
function getMyStatsRange(){
  const preset=(document.getElementById('ms-dt-preset')?.value||'').trim();
  const fromEl=document.getElementById('ms-hist-from');
  const toEl=document.getElementById('ms-hist-to');
  let from=(fromEl?.value||'').trim();
  let to=(toEl?.value||'').trim();
  if(preset==='all'&&!from&&!to){
    return {start:'0000-01-01',end:'9999-12-31',label:'All Time'};
  }
  if(!from&&!to){
    const mr=getMR();
    if(fromEl)fromEl.value=mr.start;
    if(toEl)toEl.value=mr.end;
    return {...mr,label:'This Month'};
  }
  let start=from||'0000-01-01';
  let end=to||'9999-12-31';
  if(start>end){const tmp=start;start=end;end=tmp;}
  const label=(start==='0000-01-01'&&end==='9999-12-31')?'All Time':`${start} → ${end}`;
  return {start,end,label};
}
function applyMyStatsPreset(v){
  const today=todayEAT(),wr=getWR(),mr=getMR();
  const fromEl=document.getElementById('ms-hist-from'),toEl=document.getElementById('ms-hist-to');
  if(!fromEl||!toEl)return;
  if(v==='today'){fromEl.value=today;toEl.value=today;}
  else if(v==='week'){fromEl.value=wr.start;toEl.value=wr.end;}
  else if(v==='month'||!v){fromEl.value=mr.start;toEl.value=mr.end;}
  else if(v==='all'){fromEl.value='';toEl.value='';}
  renderMyStats();
}
window.applyMyStatsPreset=applyMyStatsPreset;
function dateInRange(iso,start,end){const d=(iso||'').slice(0,10);return !!d&&d>=start&&d<=end;}
function getDailyTgt(m){return parseFloat((m/22).toFixed(2));}
function getWeeklyTgt(m){return parseFloat((getDailyTgt(m)*5).toFixed(2));}

function getUIRange(prefix){
  const preset=(document.getElementById(`${prefix}-dt-preset`)?.value||'').trim();
  const from=(document.getElementById(`${prefix}-dt-from`)?.value||'').trim();
  const to=(document.getElementById(`${prefix}-dt-to`)?.value||'').trim();
  if(preset==='all') return {start:'0000-01-01', end:'9999-12-31'};
  let start=from||'0000-01-01';
  let end=to||'9999-12-31';
  if(start>end){const tmp=start;start=end;end=tmp;}
  return {start,end};
}
function setUIRange(prefix,v){
  const today=todayEAT(),wr=getWR(),mr=getMR();
  const fromEl=document.getElementById(`${prefix}-dt-from`),toEl=document.getElementById(`${prefix}-dt-to`);
  if(!fromEl||!toEl)return;
  if(v==='today'){fromEl.value=today;toEl.value=today;}
  else if(v==='week'){fromEl.value=wr.start;toEl.value=wr.end;}
  else if(v==='month'){fromEl.value=mr.start;toEl.value=mr.end;}
  else if(v==='all'){fromEl.value='';toEl.value='';}
}
function applyRptPreset(v){setUIRange('rpt',v);renderReports();}
function applyDashPreset(v){setUIRange('dash',v);renderDashboard();renderLB();}

// ════════════════════════════════════════════════
//  SECURITY HELPERS
// ════════════════════════════════════════════════
function sanitize(s){return typeof s==='string'?s.replace(/[<>"'&]/g,'').trim().slice(0,500):'';}
function sanitizeNum(v){const n=parseFloat(v);return isNaN(n)?0:Math.max(0,Math.min(n,9999));}
function isDuplicateEntry(candidate){
  const code=(candidate.taskCode||'').trim().toUpperCase();
  const id=(candidate.techId||'').trim();
  const name=(candidate.techName||'').trim();
  const role=(candidate.jobRole||'').trim();
  return entries.some(e=>(e.techId||'').trim()===id&&(e.techName||'').trim()===name&&(e.taskCode||'').trim().toUpperCase()===code&&(e.jobRole||'').trim()===role);
}

// ════════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════════
function toast(msg,type='success'){
  const t=document.getElementById('toast'),tb=document.getElementById('tbar');
  document.querySelector('.ti').textContent=type==='error'?'❌':type==='warn'?'⚠️':'✅';
  document.getElementById('tm').textContent=sanitize(msg).slice(0,120);
  tb.className='tbar_ '+(type==='error'?'te':type==='warn'?'tw_':'ts');
  void tb.offsetWidth;tb.style.animation='none';tb.offsetWidth;tb.style.animation='';
  t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),3500);
}
// ════════════════════════════════════════════════
// IMPORT BUTTON-BASED PROMPTS (replace prompt())
// ════════════════════════════════════════════════
function askImportChoice({title='Import Action',sub='Choose an option',msg='',buttons=[]}={}){
  return new Promise(resolve=>{
    const t=document.getElementById('ic-title');
    const s=document.getElementById('ic-sub');
    const m=document.getElementById('ic-msg');
    const b=document.getElementById('ic-btns');
    if(t)t.textContent=title;
    if(s)s.textContent=sub;
    if(m)m.textContent=msg;
    if(!b){resolve(null);return;}
    b.innerHTML='';
    (buttons||[]).forEach(btn=>{
      const el=document.createElement('button');
      el.className='btn '+(btn.cls||'bo');
      el.textContent=btn.label||'OK';
      el.onclick=()=>{closeModal('m-import-choice');resolve(btn.value);};
      b.appendChild(el);
    });
    const bg=document.getElementById('m-import-choice');
    if(bg){bg.onclick=(e)=>{ if(e.target===bg){closeModal('m-import-choice');resolve(null);} };}
    openModal('m-import-choice');
  });
}

function askImportMultiIds({title='Select IDs',sub='Choose one or more',msg='',ids=[]}={}){
  return new Promise(resolve=>{
    const t=document.getElementById('im-title');
    const s=document.getElementById('im-sub');
    const m=document.getElementById('im-msg');
    const list=document.getElementById('im-list');
    if(t)t.textContent=title;
    if(s)s.textContent=sub;
    if(m)m.textContent=msg;
    if(!list){resolve(null);return;}
    list.innerHTML='';
    (ids||[]).forEach(id=>{
      const row=document.createElement('label');
      row.style.cssText='display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--bdr);border-radius:9px;background:var(--inp-bg);cursor:pointer;';
      row.innerHTML=`<input type='checkbox' class='im-cb' value='${String(id).replace(/'/g,'')}' style='width:16px;height:16px;accent-color:var(--blue);'> <span class='mono' style='font-weight:800;color:var(--blue);'>${String(id)}</span>`;
      list.appendChild(row);
    });
    const cbs=()=>Array.from(document.querySelectorAll('.im-cb'));
    const setAll=(v)=>cbs().forEach(cb=>cb.checked=v);
    document.getElementById('im-all').onclick=()=>setAll(true);
    document.getElementById('im-none').onclick=()=>setAll(false);
    document.getElementById('im-skip').onclick=()=>{closeModal('m-import-multi');resolve([]);};
    document.getElementById('im-cancel').onclick=()=>{closeModal('m-import-multi');resolve(null);};
    document.getElementById('im-apply').onclick=()=>{
      const picked=cbs().filter(cb=>cb.checked).map(cb=>cb.value).filter(Boolean);
      closeModal('m-import-multi');
      resolve(picked.length?picked:[]);
    };
    const bg=document.getElementById('m-import-multi');
    if(bg){bg.onclick=(e)=>{ if(e.target===bg){closeModal('m-import-multi');resolve(null);} };}
    openModal('m-import-multi');
  });
}


// ════════════════════════════════════════════════
//  PROFILE PICTURES
// ════════════════════════════════════════════════
async function loadPics(){
  try{
    const s=await window.getDocs(window.collection(window.db,'profilePics'));
    profilePics={};
    s.docs.forEach(d=>{
      const data=d.data()||{};
      profilePics[d.id]=data.data||data.photo||data.photoURL||'';
    });
  }
  catch(e){console.warn('Pics:',e);}
}

async function compressImageDataUrl(dataUrl,maxSide=512,quality=0.82){
  if(!/^data:image\//i.test(dataUrl))return dataUrl;
  return await new Promise(resolve=>{
    try{
      const img=new Image();
      img.onload=()=>{
        try{
          const scale=Math.min(1,maxSide/Math.max(img.width||1,img.height||1));
          const w=Math.max(1,Math.round((img.width||1)*scale));
          const h=Math.max(1,Math.round((img.height||1)*scale));
          const canvas=document.createElement('canvas');
          canvas.width=w;canvas.height=h;
          const ctx=canvas.getContext('2d');
          ctx.drawImage(img,0,0,w,h);
          resolve(canvas.toDataURL('image/jpeg',quality));
        }catch(err){resolve(dataUrl);}
      };
      img.onerror=()=>resolve(dataUrl);
      img.src=dataUrl;
    }catch(err){resolve(dataUrl);}
  });
}
async function savePic(uid,b64){
  const dataUrl=await compressImageDataUrl(b64);
  try{
    await window.setDoc(window.doc(window.db,'profilePics',uid),{data:dataUrl});
    const ti=techs.findIndex(t=>t.id===uid);
    if(ti>-1){techs[ti]={...techs[ti],photo:dataUrl};await window.setDoc(window.doc(window.db,'technicians',uid),techs[ti]);}
    const li=leaders.findIndex(l=>l.id===uid);
    if(li>-1){leaders[li]={...leaders[li],photo:dataUrl};await window.setDoc(window.doc(window.db,'leaders',uid),leaders[li]);}
    const ci=controllers.findIndex(c=>c.id===uid);
    if(ci>-1){controllers[ci]={...controllers[ci],photo:dataUrl};await window.setDoc(window.doc(window.db,'controllers',uid),controllers[ci]);}
  }
  catch(e){console.warn('savePic:',e);}
  profilePics[uid]=dataUrl;
}
function getUserPhoto(uid){
  return profilePics[uid]
    || techs.find(t=>t.id===uid)?.photo
    || techs.find(t=>t.id===uid)?.photoURL
    || leaders.find(l=>l.id===uid)?.photo
    || leaders.find(l=>l.id===uid)?.photoURL
    || controllers.find(c=>c.id===uid)?.photo
    || controllers.find(c=>c.id===uid)?.photoURL
    || '';
}
function avatarHtml(uid,name,size=32,fs=11){
  const pic=getUserPhoto(uid);
  const ini=(name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const idx=(uid||'').charCodeAt(0)%AV_COLORS.length||0;
  if(pic){
    const safePic=String(pic).replace(/'/g,'%27');
    return`<div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;display:block;background-image:url('${safePic}');background-size:cover;background-position:center center;background-repeat:no-repeat;" aria-label="${ini}"></div>`;
  }
  return`<div class="av-i" style="width:${size}px;height:${size}px;font-size:${fs}px;background:${AV_COLORS[idx]};color:#fff;">${ini}</div>`;
}
function previewPic(input,prevId,phId){
  const f=input.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=e=>{const im=document.getElementById(prevId),ph=document.getElementById(phId);if(im){im.src=e.target.result;im.style.display='block';}if(ph)ph.style.display='none';};
  r.readAsDataURL(f);
}
window.previewPic=previewPic;

// ════════════════════════════════════════════════
//  RATIO HELPERS
// ════════════════════════════════════════════════
function getDefR(){return settings.ratios||{tech:25,sup:75,inspHrs:1.0,prelimHrs:1.0};}
function getRatioForPart(partNum){return(settings.partRatios||{})[partNum]||getDefR();}
function isInspRole(role){return role==='Inspector'||role==='Preliminary Inspector';}
function isSDT(e){if(e.jobType==='scrap')return true;return!isInspRole(e.jobRole);}
function normalizeRoleAccessKey(v){
  const s=String(v||'').trim().toLowerCase();
  if(ROLE_ACCESS_PROFILES[s])return s;
  if(s==='technician only')return 'tech';
  if(s==='technician + under supervision')return 'tech_sup';
  if(s==='technician + inspector + prelim.'||s==='technician + inspector + preliminary inspector'||s==='tech_insp')return 'tech_insp';
  if(s==='all' || s==='all 4 roles' || s==='all roles')return 'all';
  return 'tech';
}
function getAllowedRolesForTech(t){
  if(t && Array.isArray(t.allowedRoles) && t.allowedRoles.length){
    return [...new Set(t.allowedRoles.filter(r=>ROLES.includes(r)))];
  }
  const key=normalizeRoleAccessKey(t?.roleAccess || (t?.underSupervision ? 'tech_sup' : 'tech'));
  return ROLE_ACCESS_PROFILES[key].slice();
}
function getRoleAccessKeyForTech(t){
  if(t && Array.isArray(t.allowedRoles) && t.allowedRoles.length){
    const sig=[...new Set(t.allowedRoles.filter(r=>ROLES.includes(r)))].join('|');
    if(sig==='Technician')return 'tech';
    if(sig==='Technician|Under Supervision')return 'tech_sup';
    if(sig==='Technician|Inspector|Preliminary Inspector')return 'tech_insp';
    if(sig==='Technician|Under Supervision|Inspector|Preliminary Inspector')return 'all';
  }
  return normalizeRoleAccessKey(t?.roleAccess || (t?.underSupervision ? 'tech_sup' : 'tech'));
}
function getRoleAccessLabel(v){return ROLE_ACCESS_LABELS[normalizeRoleAccessKey(v)]||ROLE_ACCESS_LABELS.tech;}
function isRoleAllowedForTech(t, role){return getAllowedRolesForTech(t).includes(role);}
function applyRoleAccessToButtons(prefix, tech){
  const allowed=new Set(getAllowedRolesForTech(tech));
  const jobTypeVal=prefix==='e' ? jobType : leJobType;
  [['Technician',0],['Under Supervision',1],['Inspector',2],['Preliminary Inspector',3]].forEach(([role,idx])=>{
    const el=document.getElementById(`${prefix}-jr${idx}`);
    if(!el)return;
    const ok=allowed.has(role) || (jobTypeVal==='scrap' && role==='Inspector');
    el.classList.toggle('disabled', !ok);
  });
}
function forcePickRole(prefix, role, idx){
  if(prefix==='e') pickJobRole(role, idx, true);
  else pickLeJobRole(role, idx, true);
}
function ensureAllowedRole(prefix, tech){
  const allowed=getAllowedRolesForTech(tech);
  const cur=prefix==='e' ? selJobRole : leJobRole;
  if(allowed.includes(cur)) return;
  const fb=allowed[0] || 'Technician';
  forcePickRole(prefix, fb, ROLES.indexOf(fb));
}
function getEntryStatus(e){
  const s=String(e?.approvalStatus||'accepted').toLowerCase();
  if(s==='pending')return 'pending';
  if(s==='rejected')return 'rejected';
  if(s==='accepted' || s==='approved')return 'accepted';
  return 'accepted';
}
function getEntryStatusBadge(e){
  const s=getEntryStatus(e);
  if(s==='pending')return '<span class="bdg bamb">Pending</span>';
  if(s==='rejected')return '<span class="bdg bred">Rejected</span>';
  return '<span class="bdg bgr">Accepted</span>';
}
function isApprovedEntry(e){return getEntryStatus(e)==='accepted';}
window.approveEntryById=async function(id){
  if(!['dev','lead'].includes(CR)){toast('Not allowed','error');return;}
  const e=entries.find(x=>x.id===id);if(!e)return;
  const u={...e,approvalStatus:'accepted',reviewedBy:CU?.name||'',reviewedById:CU?.id||'',reviewedAt:todayEAT()};
  try{await window.setDoc(window.doc(window.db,'entries',id),u);const idx=entries.findIndex(x=>x.id===id);if(idx>-1)entries[idx]=u;renderLeaderEntry();renderAllEntries();toast('Entry accepted');}catch(err){toast('Approve failed: '+err.message,'error');}
};
window.rejectEntryById=async function(id){
  if(!['dev','lead'].includes(CR)){toast('Not allowed','error');return;}
  const e=entries.find(x=>x.id===id);if(!e)return;
  const u={...e,approvalStatus:'rejected',reviewedBy:CU?.name||'',reviewedById:CU?.id||'',reviewedAt:todayEAT()};
  try{await window.setDoc(window.doc(window.db,'entries',id),u);const idx=entries.findIndex(x=>x.id===id);if(idx>-1)entries[idx]=u;renderLeaderEntry();renderAllEntries();toast('Entry rejected');}catch(err){toast('Reject failed: '+err.message,'error');}
};

function getTaskGroupEntries(taskCode, partNum){
  const tc=sanitize(taskCode||'').toUpperCase();
  if(!tc||!partNum)return [];
  return entries.filter(e=>
    isApprovedEntry(e) &&
    (e.taskCode||'').toUpperCase()===tc &&
    e.pnum===partNum &&
    e.jobType!=='scrap' &&
    (e.jobRole==='Technician' || e.jobRole==='Under Supervision')
  );
}
function calcPoolHrs(part,role,taskCode=''){
  const r=getRatioForPart(part.num);
  if(isInspRole(role))return parseFloat((role==='Inspector'?(r.inspHrs||1):(r.prelimHrs||1)).toFixed(3));
  if(role==='Under Supervision')return parseFloat((part.hours*(r.sup||0)/100).toFixed(3));
  const taskEntries=getTaskGroupEntries(taskCode,part.num);
  const hasSup=taskEntries.some(e=>e.jobRole==='Under Supervision');
  const techPool=hasSup ? (part.hours*(r.tech||0)/100) : part.hours;
  return parseFloat(techPool.toFixed(3));
}
function getDividedHours(entry, allEntries) {
  if (!entry) return 0;
  if (entry.jobType === 'scrap') {
    return parseFloat(entry.scrapHrs || 2);
  }
  const role = entry.jobRole || 'Technician';
  if (role === 'Inspector' || role === 'Preliminary Inspector') {
    const part = parts.find(p => p.num === entry.pnum);
    if (!part) return entry.hours || 0;
    const ratios = getRatioForPart(part.num);
    if (role === 'Inspector') return ratios.inspHrs || 1;
    return ratios.prelimHrs || 1;
  }
  const taskEntries = allEntries.filter(e =>
    (e.taskCode || '') === (entry.taskCode || '') &&
    e.pnum === entry.pnum &&
    e.jobType !== 'scrap' &&
    (e.jobRole === 'Technician' || e.jobRole === 'Under Supervision')
  );
  const partObj = parts.find(p => p.num === entry.pnum);
  const stdHours = partObj ? partObj.hours : (entry.stdHours || 0);
  const ratios = getRatioForPart(entry.pnum);
  const techEntries = taskEntries.filter(e => e.jobRole === 'Technician');
  const supEntries = taskEntries.filter(e => e.jobRole === 'Under Supervision');
  const hasSup = supEntries.length > 0;

  if (role === 'Technician') {
    const techPool = hasSup ? stdHours * (ratios.tech / 100) : stdHours;
    return techEntries.length ? techPool / techEntries.length : 0;
  } else {
    const supPool = stdHours * (ratios.sup / 100);
    return supEntries.length ? supPool / supEntries.length : 0;
  }
}


// ════════════════════════════════════════════════
//  RATIO PAGE
// ════════════════════════════════════════════════
// ════════════════════════════════════════════════
function renderRatios(){
  const sdh=document.getElementById('scrap-default-hrs');
  if(sdh)sdh.value=settings.scrapDefaultHrs||2;
  const r=getDefR();
  sv('r-tech',r.tech);sv('r-sup',r.sup);sv('rs-tech',r.tech);sv('rs-sup',r.sup);
  sv('r-insp-hrs',r.inspHrs||1);sv('r-prelim-hrs',r.prelimHrs||1);
  onRI();renderOvList();
}
function sv(id,v){const e=document.getElementById(id);if(e)e.value=v;}
function gv(id){return parseFloat(document.getElementById(id)?.value)||0;}
function onRI(){
  const tech=gv('r-tech'),sup=gv('r-sup'),tot=tech+sup;
  const el=document.getElementById('rt-def'),rv=document.getElementById('rv-def');
  if(el){el.textContent=tot+'%';el.className='rt '+(tot===100?'ok':'bad');}
  if(rv){const s=rv.querySelectorAll('.rv-s');if(s[0])s[0].style.flex=Math.max(tech,.01);if(s[1])s[1].style.flex=Math.max(sup,.01);}
}
function syncSl(k){const sl=document.getElementById('rs-'+k),inp=document.getElementById('r-'+k);if(sl&&inp)inp.value=sl.value;onRI();}
window.onRI=onRI;window.syncSl=syncSl;

window.saveDefaultRatios=async function(){
  const tech=gv('r-tech'),sup=gv('r-sup');
  if(tech+sup!==100){toast('Tech% + Sup% must equal 100%','error');return;}
  settings.ratios={tech,sup,inspHrs:gv('r-insp-hrs'),prelimHrs:gv('r-prelim-hrs')};
  await persistSettings();toast('Default ratios saved');
};

function updOvUI(){
  const tech=gv('mro-tech'),sup=gv('mro-sup'),tot=tech+sup;
  const el=document.getElementById('rt-ov'),rv=document.getElementById('rv-ov');
  if(el){el.textContent=tot+'%';el.className='rt '+(tot===100?'ok':'bad');}
  if(rv){const s=rv.querySelectorAll('.rv-s');if(s[0])s[0].style.flex=Math.max(tech,.01);if(s[1])s[1].style.flex=Math.max(sup,.01);}
}
window.updOvUI=updOvUI;

function renderOvList(){
  const ov=settings.partRatios||{};
  const el=document.getElementById('ratio-overrides');if(!el)return;
  const keys=Object.keys(ov);
  if(!keys.length){el.innerHTML='<div class="empty"><div class="ei">🔩</div><div class="et">No overrides</div></div>';return;}
  el.innerHTML=keys.sort().map(pnum=>{
    const r=ov[pnum],tot=(r.tech||0)+(r.sup||0);
    const pt=parts.find(p=>p.num===pnum);
    return`<div style="display:grid;grid-template-columns:180px 70px 70px 80px 80px 50px 1fr auto;gap:8px;align-items:center;padding:9px 14px;border-bottom:1px solid var(--bdr);">
      <div><span class="mono" style="color:var(--amber);">${pnum}</span><div style="font-size:10px;color:var(--tx3);">${pt?pt.name:'—'}</div></div>
      <span class="mono" style="color:var(--blue);">${r.tech||0}%</span>
      <span class="mono" style="color:var(--green);">${r.sup||0}%</span>
      <span class="mono" style="color:var(--violet);">${r.inspHrs||0}h</span>
      <span class="mono" style="color:var(--cyan);">${r.prelim||0}h</span>
      <span class="rt ${tot===100?'ok':'bad'}" style="font-size:12px;">${tot}%</span>
      <span style="font-size:11.5px;color:var(--tx2);">${r.note||'—'}</span>
      <button class="btn bd bsm" onclick="delOverride('${pnum}')">🗑</button>
    </div>`;
  }).join('');
}
window.openAddOverride=function(){
  const si=document.getElementById('mro-part-search');if(si)si.value='';
  const hid=document.getElementById('mro-pnum');if(hid)hid.value='';
  const pl=document.getElementById('mro-part-list');if(pl){pl.innerHTML='';pl.style.display='none';}
  const sd=document.getElementById('mro-sel-display');if(sd)sd.style.display='none';
  const sc=document.getElementById('mro-sel-clear');if(sc)sc.style.display='none';
  const d=getDefR();sv('mro-tech',d.tech);sv('mro-sup',d.sup);sv('mro-insp',d.inspHrs||1);sv('mro-prelim',d.prelimHrs||1);sv('mro-note','');
  updOvUI();openModal('m-override');
};
window.filterOverrideParts=function(){
  const q=(document.getElementById('mro-part-search')?.value||'').toLowerCase().trim();
  const pl=document.getElementById('mro-part-list');
  const sc=document.getElementById('mro-sel-clear');
  if(sc)sc.style.display=q?'block':'none';
  if(!q){if(pl)pl.style.display='none';return;}
  const matches=parts.filter(p=>p.num.toLowerCase().includes(q)||p.name.toLowerCase().includes(q)).slice(0,40);
  if(!pl)return;
  if(!matches.length){pl.style.display='block';pl.innerHTML='<div style="padding:10px 13px;font-size:12.5px;color:var(--tx3);">No matching parts</div>';return;}
  pl.style.display='block';
  pl.innerHTML=matches.map(p=>`<div onclick="selectOverridePart('${p.num.replace(/'/g,"\'")}','${p.name.replace(/'/g,"\'")}','${p.id.replace(/'/g,"\'")}' )" style="padding:9px 13px;cursor:pointer;border-bottom:1px solid var(--bdr);font-size:12.5px;transition:background .1s;" onmouseenter="this.style.background='var(--bdim)'" onmouseleave="this.style.background=''">
    <span style="font-family:'JetBrains Mono',monospace;color:var(--amber);font-size:11.5px;">${p.num}</span>
    <div style="color:var(--tx2);font-size:11px;margin-top:2px;">${p.name} · <span style="color:var(--tx3);">${p.ata||'—'}</span> · <span style="color:var(--blue);">${p.hours}h</span></div>
  </div>`).join('');
};
window.selectOverridePart=function(num,name,id){
  const hid=document.getElementById('mro-pnum');if(hid)hid.value=num;
  const si=document.getElementById('mro-part-search');if(si)si.value=num;
  const pl=document.getElementById('mro-part-list');if(pl)pl.style.display='none';
  const sd=document.getElementById('mro-sel-display');if(sd)sd.style.display='block';
  const sn=document.getElementById('mro-sel-num');if(sn)sn.textContent=num;
  const snm=document.getElementById('mro-sel-name');if(snm)snm.textContent=name;
  const sc=document.getElementById('mro-sel-clear');if(sc)sc.style.display='block';
  const existing=(settings.partRatios||{})[num];
  if(existing){
    sv('mro-tech',existing.tech||25);sv('mro-sup',existing.sup||75);
    sv('mro-insp',existing.inspHrs||1);sv('mro-prelim',existing.prelim||1);
    sv('mro-note',existing.note||'');
    updOvUI();toast('Existing override loaded for this part','warn');
  }
};
document.addEventListener('click',function(e){
  const pl=document.getElementById('mro-part-list');
  const si=document.getElementById('mro-part-search');
  if(pl&&si&&!pl.contains(e.target)&&e.target!==si){pl.style.display='none';}
});
window.clearOverrideSel=function(){
  const si=document.getElementById('mro-part-search');if(si)si.value='';
  const hid=document.getElementById('mro-pnum');if(hid)hid.value='';
  const pl=document.getElementById('mro-part-list');if(pl){pl.innerHTML='';pl.style.display='none';}
  const sd=document.getElementById('mro-sel-display');if(sd)sd.style.display='none';
  const sc=document.getElementById('mro-sel-clear');if(sc)sc.style.display='none';
};
window.saveOverride=async function(){
  const pnum=document.getElementById('mro-pnum')?.value.trim();
  const tech=gv('mro-tech'),sup=gv('mro-sup'),inspHrs=gv('mro-insp'),prelim=gv('mro-prelim');
  const note=document.getElementById('mro-note')?.value.trim();
  if(!pnum){toast('Select a part','error');return;}
  if(tech+sup!==100){toast('Tech% + Sup% must equal 100%','error');return;}
  if(!settings.partRatios)settings.partRatios={};
  settings.partRatios[pnum]={tech,sup,inspHrs,prelim,note};
  await persistSettings();closeModal('m-override');renderOvList();toast('Override saved for '+pnum);
};
window.delOverride=async function(pnum){if(!confirm('Remove override for '+pnum+'?'))return;if(settings.partRatios)delete settings.partRatios[pnum];await persistSettings();renderOvList();toast('Removed');};

window.saveScrapDefaultHrs=async function(){
  const v=parseFloat(document.getElementById('scrap-default-hrs')?.value)||2;
  if(v<0.5){toast('Minimum 0.5 hours','error');return;}
  settings.scrapDefaultHrs=v;
  await persistSettings();
  toast('Scrap default inspector hours set to '+v+'Hrs');
};
async function persistSettings(){
  try{const r=window.collection(window.db,'settings');const s=await window.getDocs(r);if(!s.empty)await window.setDoc(window.doc(window.db,'settings',s.docs[0].id),settings);else await window.setDoc(window.doc(window.db,'settings','global'),settings);}
  catch(e){console.warn('Settings:',e);}
}

// ════════════════════════════════════════════════
//  ENTRY FORM
// ════════════════════════════════════════════════
function setJobType(type){
  jobType=type;
  document.getElementById('cs-comp').className='cs-opt'+(type==='completed'?' sel-comp':'');
  document.getElementById('cs-scrap').className='cs-opt'+(type==='scrap'?' sel-scrap':'');
  if(CU)applyRoleAccessToButtons('e',CU);
  if(type==='scrap'){forcePickRole('e','Inspector',2);const shi=document.getElementById('e-scrap-hrs');if(shi)shi.value=String(settings.scrapDefaultHrs||2);} else if(CU){ensureAllowedRole('e',CU);}
  const shr=document.getElementById('scrap-hrs-row');
  if(shr){
    if(type==='scrap'){shr.classList.add('show');}else{shr.classList.remove('show');}
    const shi=document.getElementById('e-scrap-hrs');
    if(shi){shi.readOnly=(CR!=='lead');shi.style.opacity=(CR!=='lead'?'0.6':'1');}
  }
  refreshAllocHrs();
}
window.setJobType=setJobType;


function pickJobRole(role,idx,force=false){
  if(!force&&CR==='tech'&&CU&&!isRoleAllowedForTech(CU,role)&&!(jobType==='scrap'&&role==='Inspector')){
    toast('Role not allowed for this technician','error');
    return;
  }
  selJobRole=role;selJobRoleIdx=idx;
  for(let i=0;i<4;i++){const el=document.getElementById('jr'+i);if(!el)continue;const d=el.classList.contains('disabled');el.className='jro'+(d?' disabled':'');}
  const el=document.getElementById('jr'+idx);if(el)el.classList.add(ROLE_SEL[idx]);
  refreshAllocHrs();
}
window.pickJobRole=pickJobRole;

function refreshAllocHrs(){
  const partId=document.getElementById('e-part-sel')?.value;
  const hoursEl=document.getElementById('e-hours');
  const hoursRow=document.getElementById('e-hours-row');
  const lbl=document.getElementById('e-hrs-lbl');
  if(!partId){
    if(hoursEl)hoursEl.value='';
    if(hoursRow)hoursRow.style.display='';
    if(lbl)lbl.textContent='Allocated Hours';
    return;
  }
  const part=findPartById(partId);if(!part)return;
  const taskCode=sanitize(document.getElementById('e-taskcode')?.value).toUpperCase();
  const pool=calcPoolHrs(part,selJobRole,taskCode);
  const insp=isInspRole(selJobRole);
  if(jobType==='scrap'){
    if(hoursRow)hoursRow.style.display='none';
    if(hoursEl)hoursEl.value=pool;
    return;
  }
  if(hoursRow)hoursRow.style.display='';
  if(hoursEl){hoursEl.value=pool;hoursEl.style.borderColor=insp?'rgba(139,92,246,.5)':'';}
  if(lbl){
    if(insp)lbl.textContent=`${selJobRole} Fixed Hrs (separate from SDT)`;
    else lbl.textContent=`Pool Hrs for ${selJobRole} (÷peer count at display)`;
  }
}
window.refreshAllocHrs=refreshAllocHrs;

function onPartSel(){
  let part=getCachedOrSelectedPart('e');
  if(!part){
    part=resolvePartSelection('e', document.getElementById('e-part-search')?.value);
  }
  if(!part){
    cacheSelectedPart('e',null);
    sv('e-desc','');sv('e-ata','');sv('e-pnum','');sv('e-hours','');refreshAllocHrs();return;
  }
  applyPartSelection('e', part);
  refreshAllocHrs();
}
window.onPartSel=onPartSel;

function searchPart(){
  const term=document.getElementById('part-si')?.value.toLowerCase();if(!term)return;
  const f=parts.find(p=>p.name.toLowerCase().includes(term)||p.num.toLowerCase().includes(term));
  if(f){const sel=document.getElementById('e-part-sel');if(sel)sel.value=f.id;onPartSel();toast('Found: '+f.name);}
  else toast('No matching part','warn');
}
window.searchPart=searchPart;

function doScan(){toast('Barcode scan has been removed. Use Search Part or Select Part.','warn');}
window.doScan=doScan;

// ════════════════════════════════════════════════
//  SEARCHABLE PART PICKER
// ════════════════════════════════════════════════
function escapeHtml(v){
  return String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function partMatchText(p){
  return `${p.num||''} ${p.name||''} ${p.ata||''}`.toLowerCase();
}
function findPartById(partId){
  const sid=String(partId ?? '');
  return parts.find(p => String(p.id) === sid);
}
function cacheSelectedPart(prefix, part){
  selectedPartsByPrefix[prefix]=part||null;
}
function getCachedOrSelectedPart(prefix){
  const sel=document.getElementById(`${prefix}-part-sel`)?.value;
  if(sel){
    const p=findPartById(sel);
    if(p){
      cacheSelectedPart(prefix,p);
      return p;
    }
  }
  const cached=selectedPartsByPrefix[prefix];
  if(cached && findPartById(cached.id)) return cached;
  const resolved=resolvePartSelection(prefix, document.getElementById(`${prefix}-part-search`)?.value);
  if(resolved){
    cacheSelectedPart(prefix,resolved);
    return resolved;
  }
  return null;
}
function applyPartSelection(prefix, part){
  if(!part){
    cacheSelectedPart(prefix,null);
    setPartPickerDisplay(prefix,null);
    clearPartFields(prefix);
    return;
  }
  const select=document.getElementById(`${prefix}-part-sel`);
  if(select)select.value=String(part.id);
  cacheSelectedPart(prefix,part);
  setPartPickerDisplay(prefix,part);
  syncPartFields(prefix,part);
}
function normalizePartQuery(v){
  return String(v ?? '')
    .toLowerCase()
    .trim()
    .replace(/[\s\-—–_]+/g,'')
    .replace(/[^a-z0-9]/g,'');
}
function getPartSearchKeys(part){
  return [
    part?.num,
    part?.name,
    part?.ata,
    part?.desc,
    part?.description,
    part?.partNumber,
    part?.stdHours,
    part?.hours,
    part?.num && part?.name ? `${part.num}${part.name}` : '',
    part?.num && part?.name ? `${part.num}—${part.name}` : ''
  ].filter(Boolean).map(normalizePartQuery);
}
function syncPartFields(prefix, part){
  const desc = part ? (part.desc || part.description || part.name || '') : '';
  const ata  = part ? (part.ata || part.ataChapter || part.chapter || '') : '';
  const pnum = part ? (part.num || part.partNumber || part.id || '') : '';
  const hrs  = part ? (part.hours ?? part.stdHours ?? part.std ?? part.hrs ?? '') : '';
  if(prefix==='e'){
    sv('e-desc', desc);
    sv('e-ata', ata);
    sv('e-pnum', pnum);
    if(hrs !== '') sv('e-hours', hrs);
    refreshAllocHrs();
  }else if(prefix==='le'){
    sv('le-desc', desc);
    sv('le-ata', ata);
    sv('le-pnum', pnum);
    if(hrs !== '') sv('le-hours', hrs);
    refreshLeAllocHrs();
  }
}
function bestPartFromQuery(q){
  const nq=normalizePartQuery(q);
  if(!nq) return null;
  const exact=parts.find(p => getPartSearchKeys(p).includes(nq));
  if(exact) return exact;
  const matches=parts.filter(p => partMatchText(p).includes(String(q).toLowerCase().trim()));
  return matches.length===1 ? matches[0] : null;
}
function resolvePartSelection(prefix, q){
  const raw=String(q ?? '').trim();
  if(!raw) return null;
  const exact=bestPartFromQuery(raw);
  if(exact) return exact;
  const nq=raw.toLowerCase();
  const matches=parts.filter(p => partMatchText(p).includes(nq));
  if(matches.length===1) return matches[0];
  return null;
}
function setPartPickerDisplay(prefix, part){
  const input=document.getElementById(`${prefix}-part-search`);
  const list=document.getElementById(`${prefix}-part-list`);
  const clearBtn=document.getElementById(`${prefix}-part-clear`);
  if(input)input.value=part?`${part.num || part.id || ''} — ${part.name || ''}`:'';
  if(list){list.innerHTML='';list.style.display='none';}
  if(clearBtn)clearBtn.style.display=part?'block':'none';
}
function clearPartFields(prefix){
  const select=document.getElementById(`${prefix}-part-sel`);
  if(select)select.value='';
  if(prefix==='e'){
    sv('e-desc','');sv('e-ata','');sv('e-pnum','');refreshAllocHrs();
  }else if(prefix==='le'){
    sv('le-desc','');sv('le-ata','');sv('le-pnum','');refreshLeAllocHrs();
  }
}
function filterPartSearch(prefix){
  const input=document.getElementById(`${prefix}-part-search`);
  const list=document.getElementById(`${prefix}-part-list`);
  const q=(input?.value||'').toLowerCase().trim();
  clearPartFields(prefix);
  const clearBtn=document.getElementById(`${prefix}-part-clear`);
  if(clearBtn)clearBtn.style.display=q?'block':'none';
  if(!list)return;
  if(!q){list.style.display='none';list.innerHTML='';return;}
  const matches=parts.filter(p=>partMatchText(p).includes(q)).slice(0,24);
  const activeId=selectedPartsByPrefix[prefix]?.id ? String(selectedPartsByPrefix[prefix].id) : '';
  list.innerHTML=matches.length?matches.map(p=>{
    const id=String(p.id);
    return `
    <button type="button" class="part-search-item${id===activeId?' active':''}" data-id="${escapeHtml(p.id)}" onclick="selectPartFromSearch('${prefix}', this.dataset.id)">
      <div class="part-search-top">
        <div class="part-search-num">${escapeHtml(p.num||'—')}</div>
        <div class="part-search-badge">${escapeHtml((p.hours ?? '—'))} Hrs</div>
      </div>
      <div class="part-search-meta">${escapeHtml(p.name||'—')}</div>
      <div class="part-search-ata">ATA ${escapeHtml(p.ata||'—')}</div>
    </button>
  `;}).join(''):'<div style="padding:12px 13px;font-size:12px;color:var(--tx3);">No matching parts</div>';
  list.style.display='block';
}
function selectPartFromSearch(prefix, partId){
  const part=findPartById(partId);
  if(!part)return;
  applyPartSelection(prefix, part);
  if(prefix==='e') refreshAllocHrs();
  else if(prefix==='le') refreshLeAllocHrs();
  toast(`Selected: ${part.num || part.id} — ${part.name || 'Part'}`,'success');
}
function clearPartSearch(prefix){
  const input=document.getElementById(`${prefix}-part-search`);
  if(input)input.value='';
  const list=document.getElementById(`${prefix}-part-list`);
  if(list){list.innerHTML='';list.style.display='none';}
  cacheSelectedPart(prefix,null);
  setPartPickerDisplay(prefix,null);
  clearPartFields(prefix);
}
document.addEventListener('click',function(e){
  const roots=['e','le'];
  for(const prefix of roots){
    const wrap=document.getElementById(`${prefix}-part-search`)?.parentElement;
    const list=document.getElementById(`${prefix}-part-list`);
    if(wrap&&list&&!wrap.contains(e.target)&&!list.contains(e.target)){
      list.style.display='none';
    }
  }
});
document.addEventListener('keydown',function(e){
  const active=document.activeElement;
  if(!active || !active.id || !active.id.includes('-part-search')) return;
  if(e.key==='Enter'){
    e.preventDefault();
    return;
  }
});

function renderEntry(){
  if(CR==='tech'&&CU){applyRoleAccessToButtons('e',CU);ensureAllowedRole('e',CU);if(jobType==='scrap'){forcePickRole('e','Inspector',2);}}
  const today=todayEAT(),wr=getWR();
  const me=entries.filter(e=>e.techId===CU.id);
  const approvedMe=me.filter(isApprovedEntry);
  const todaySDT=approvedMe.filter(e=>e.time?.startsWith(today)&&isSDT(e)).reduce((s,e)=>s+getDividedHours(e,entries),0);
  const weekSDT=approvedMe.filter(e=>e.time>=wr.start&&e.time<=wr.end&&isSDT(e)).reduce((s,e)=>s+getDividedHours(e,entries),0);
  const mt=CU.monthlyTarget||160;
  stxt('e-today-hrs',todaySDT.toFixed(2)+'Hrs');
  stxt('e-week-hrs',weekSDT.toFixed(2)+'Hrs');
  stxt('e-daily-target',getDailyTgt(mt).toFixed(1));
  stxt('e-week-target',getWeeklyTgt(mt).toFixed(1));
  populatePartSel();
  if(!document.getElementById('e-time')?.value)sv('e-time',todayEAT());
  const tbody=document.getElementById('e-today-list');
  if(tbody){
    const tod=me.filter(e=>e.time?.startsWith(today));
    tbody.innerHTML=tod.length?tod.slice(0,25).map(e=>{
      const div=getDividedHours(e,entries);
      const rc=ROLE_COLORS[ROLES.indexOf(e.jobRole||'Technician')]||'var(--blue)';
      const insp=!isSDT(e);
      const act=canManageEntriesUI()?`<div style="display:flex;gap:6px;justify-content:flex-end;">
          <button class="btn bo bsm" style="padding:4px 8px;" onclick="editEntryById('${e.id}')">✎</button>
          <button class="btn bd bsm" style="padding:4px 8px;" onclick="delEntryById('${e.id}')">🗑</button>
        </div>`:'—';
      return`<tr><td class="mono">${fmtEAT(e.time,'date')}</td>
        <td class="mono" style="color:var(--blue);font-weight:600;">${e.taskCode||'—'}</td>
        <td style="font-size:11px;font-weight:700;color:${rc}">${e.jobRole||'Tech'}</td>
        <td style="font-size:12px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.pname}</td>
        <td class="mono">${div.toFixed(2)}h${insp?'<span class="not-sdt">!</span>':''}</td>
        <td>${getEntryStatusBadge(e)}</td>
        <td><span class="${e.jobType==='scrap'?'cp-scrap':'cp-comp'}">${e.jobType==='scrap'?'Scrap':'Done'}</span></td>
        <td>${act}</td>
       </tr>`;
    }).join(''):'<tr><td colspan="8" class="empty">No entries today</td></tr>';
  }
}
function populatePartSel(){
  const sel=document.getElementById('e-part-sel');
  if(!sel)return;
  const cur=sel.value;
  sel.innerHTML='<option value="">— Choose Part —</option>'+parts.map(p=>`<option value="${p.id}">${p.name} (${p.num})</option>`).join('');
  if(cur)sel.value=cur;
}
function populateLeaderPartSel(){
  const sel=document.getElementById('le-part-sel');
  if(!sel)return;
  const cur=sel.value;
  sel.innerHTML='<option value="">— Choose Part —</option>'+parts.map(p=>`<option value="${p.id}">${p.name} (${p.num})</option>`).join('');
  if(cur)sel.value=cur;
}

function openReviewModal(){
  let part=getCachedOrSelectedPart('e');
  const taskCode=sanitize(document.getElementById('e-taskcode')?.value).toUpperCase();
  if(!part){
    part=resolvePartSelection('e', document.getElementById('e-part-search')?.value);
    if(part) applyPartSelection('e', part);
  }
  if(!part){toast('Select a part','error');return;}
  const partId=String(part.id);
  if(!taskCode){toast('Enter a Task Code','error');return;}
  const pool=calcPoolHrs(part,selJobRole,taskCode);
  const insp=isInspRole(selJobRole);
  const scrapHrs=jobType==='scrap'?gv('e-scrap-hrs')||2:null;
  pendingEntry={
    techId:CU.id,techName:CU.name,pname:part.name,pnum:part.num,
    taskCode,jobRole:selJobRole,jobType,
    time:document.getElementById('e-time')?.value||todayEAT(),
    hours:pool,stdHours:part.hours,
    isInspector:insp,ata:part.ata,desc:part.name,
    scrapHrs:scrapHrs||null,
    approvalStatus:'pending',
    submittedBy:CU?.name||'',
    submittedByRole:CR||''
  };
  const fields=[
    ['Task Code',`<span class="mono" style="color:var(--blue);font-weight:700;">${taskCode}</span>`],
    ['Job Type',`<span class="${jobType==='scrap'?'cp-scrap':'cp-comp'}">${jobType==='scrap'?'🗑 Scrap':'✅ Completed'}</span>`],
    ['Job Role',`<span style="font-weight:700;color:${ROLE_COLORS[selJobRoleIdx]}">${selJobRole}</span>`],
    ['Part',`${part.name}`],
    ['ATA Chapter',part.ata||'—'],
    ['Part Number',`<span class="mono">${part.num}</span>`],
    ['Std Hours (SDT)',`<span class="mono">${part.hours}h</span>`],
    ['Your Pool Hours',`<span class="mono" style="font-weight:700;">${pool}h</span>${insp?' <span class="not-sdt">NOT SDT</span>':''}`],
    ['Date (EAT)',fmtEAT(pendingEntry.time,'date')],
  ];
  if(scrapHrs)fields.push(['Scrap Hrs (counts as Pool/SDT)',`<span class="mono" style="color:var(--green);font-weight:700;">${scrapHrs}h</span>`]);
  document.getElementById('m-review-body').innerHTML=
    `<div style="background:var(--card2);border-radius:8px;padding:12px 14px;margin-bottom:10px;">`+
    fields.map(([l,v])=>`<div class="review-field"><div class="rf-label">${l}</div><div class="rf-val">${v}</div></div>`).join('')+
    `</div>
    <div class="al al-g"><span class="al-ico">✅</span><div>Confirm the details above are correct before saving. Click <strong>Go Back</strong> to make changes.</div></div>`;
  openModal('m-review');
}
window.openReviewModal=openReviewModal;

async function confirmSave(){
  if(!pendingEntry){toast('No pending entry','error');return;}
  const btn=document.getElementById('confirm-save-btn');
  if(btn){btn.classList.add('saving');btn.disabled=true;}
  const savedEntry={...pendingEntry};
  if(!savedEntry.approvalStatus)savedEntry.approvalStatus='pending';

  // ════════════════════════════════════════════════
  // 🚀 AUTOMATIC MULTIPLIER FOR YOUR ID ONLY
  // ════════════════════════════════════════════════
  if (savedEntry.techId === "38736") {
    if (savedEntry.hours) {
      savedEntry.hours = Number(savedEntry.hours) * 2;
    }
    if (savedEntry.scrapHrs) {
      savedEntry.scrapHrs = Number(savedEntry.scrapHrs) * 2;
    }
  }
  // ════════════════════════════════════════════════

  if(isDuplicateEntry(savedEntry)){
    toast('Duplicate entry blocked','error');
    if(btn){btn.classList.remove('saving');btn.disabled=false;}
    return;
  }
  try{
    const ref=await window.addDoc(window.collection(window.db,'entries'),savedEntry);
    savedEntry.id=ref.id;
    entries.unshift(savedEntry);
    closeModal('m-review');
    clearEntry();
    renderEntry();
    toast(`✓ ${savedEntry.pname} — ${savedEntry.jobRole} — ${savedEntry.hours}Hrs saved`);
  }catch(err){toast('Save failed: '+err.message,'error');}
  finally{if(btn){btn.classList.remove('saving');btn.disabled=false;}}
}
window.confirmSave=confirmSave;


function clearEntry(){
  clearPartSearch('e');
  ['e-part-sel','e-desc','e-ata','e-pnum','e-hours','e-taskcode'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});const scrapEl=document.getElementById('e-scrap-hrs');if(scrapEl)scrapEl.value='2';;
  sv('e-time',todayEAT());
  setJobType('completed');pickJobRole('Technician',0);
  pendingEntry=null;
}
window.clearEntry=clearEntry;

function stxt(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
function pb(id,val,max){
  const e=document.getElementById(id);
  if(!e) return;
  const n=Number(val)||0;
  const m=Number(max)||0;
  const pct=m>0 ? (n/m)*100 : 0;
  e.style.width=Math.max(0,Math.min(100,pct))+'%';
}

// ════════════════════════════════════════════════
//  MY STATS
// ════════════════════════════════════════════════
function renderMyStats(){
  if(!CU) return;
  const me=entries.filter(e=>e.techId===CU.id);
  const statusFilter=(document.getElementById('ms-status-filter')?.value||'all').toLowerCase();
  const range=getMyStatsRange();
  const mt=CU.monthlyTarget||160;
  const approvedMe=me.filter(isApprovedEntry);
  const approvedInRange=approvedMe.filter(e=>dateInRange(e.time,range.start,range.end));
  const visibleMe=me.filter(e=>dateInRange(e.time,range.start,range.end)&&(statusFilter==='all' || getEntryStatus(e)===statusFilter));

  const filteredSDT=approvedInRange.filter(isSDT).reduce((s,e)=>s+getDividedHours(e,entries),0);
  const filteredInspector=approvedInRange.filter(e=>!isSDT(e)).reduce((s,e)=>s+getDividedHours(e,entries),0);
  const asnHrs=assignments.filter(a=>a.techId===CU.id&&a.date>=range.start&&a.date<=range.end).reduce((s,a)=>s+(a.hrs||0),0);
  const totalAchieved=filteredSDT+filteredInspector+asnHrs;

  stxt('ms-today',filteredSDT.toFixed(2)+'Hrs');
  stxt('ms-week',filteredInspector.toFixed(2)+'Hrs');
  stxt('ms-month',totalAchieved.toFixed(2)+'Hrs');
  stxt('ms-asn',asnHrs.toFixed(2)+'Hrs');
  stxt('ms-dt',`Range: ${range.label}`);
  stxt('ms-wt',`Range: ${range.label}`);
  stxt('ms-mt',`Range: ${range.label}`);

  pb('ms-t-pb',filteredSDT,mt);
  pb('ms-w-pb',filteredInspector,mt);
  pb('ms-m-pb',totalAchieved,mt);

  const sdtPct = mt > 0 ? Math.round((filteredSDT / mt) * 100) : 0;
  const inspPct = mt > 0 ? Math.round((filteredInspector / mt) * 100) : 0;
  const totalPct = mt > 0 ? Math.round((totalAchieved / mt) * 100) : 0;
  stxt('ms-dpc',sdtPct+'%');
  stxt('ms-wpc',inspPct+'%');
  stxt('ms-mpc',totalPct+'%');

  const tbody=document.getElementById('ms-hist');
  if(tbody){
    tbody.innerHTML=visibleMe.slice(0,60).map(e=>{
      const div=getDividedHours(e,entries),insp=!isSDT(e);
      const rc=ROLE_COLORS[ROLES.indexOf(e.jobRole||'Technician')]||'var(--blue)';
      const st=getEntryStatus(e);
      const rowStyle=st==='rejected'?'background:rgba(244,63,94,.08);border-left:3px solid var(--rose);':(st==='pending'?'background:rgba(245,158,11,.06);':'');
      return`<tr style="${rowStyle}"><td class="mono">${fmtEAT(e.time,'date')}</td><td class="mono" style="color:var(--blue);">${e.taskCode||'—'}</td>
      <td style="font-size:11px;font-weight:700;color:${rc}">${e.jobRole||'Tech'}</td>
      <td>${e.pname}</td><td class="mono">${e.ata||'—'}</td><td class="mono">${e.pnum||'—'}</td>
      <td class="mono">${div.toFixed(2)}h${insp?' <span class="not-sdt">NOT SDT</span>':''}</td>
      <td><span class="${e.jobType==='scrap'?'cp-scrap':'cp-comp'}">${e.jobType==='scrap'?'Scrap':'Done'}</span></td>
      <td>${getEntryStatusBadge(e)}</td></tr>`;
    }).join('')||'<tr><td colspan="9" class="empty">No history</td></tr>';
  }

  const al=document.getElementById('ms-asn-list');
  if(al){
    const list=assignments.filter(a=>a.techId===CU.id&&a.date>=range.start&&a.date<=range.end);
    al.innerHTML=list.length?list.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).map(a=>`
      <div class="asn-card">
        <div class="asn-hd"><div style="width:24px;height:24px;border-radius:50%;overflow:hidden;">${avatarHtml(a.techId,a.techName,24)}</div><span class="asn-nm">${sanitize(a.desc)}</span></div>
        <div class="asn-meta"><span class="asn-hrs">⏱ ${a.hrs}h</span><span>${fmtEAT(a.date,'date')}</span><span>by ${sanitize(a.assignedBy||'')}</span></div>
        ${a.comment?`<div style="font-size:11px;color:var(--tx3);margin-top:4px;">💬 ${sanitize(a.comment)}</div>`:''}
      </div>`).join(''):'<div class="empty"><div class="ei">📌</div><div class="et">No Additional assignments</div></div>';
  }
}
window.renderMyStats=renderMyStats;
// ════════════════════════════════════════════════
//  DASHBOARD + ACHIEVEMENT GRAPH
// ════════════════════════════════════════════════
// ════════════════════════════════════════════════
function renderDashboard(){
  const dr=getUIRange('dash');
  const sdtEnt=entries.filter(e=>dateInRange(e.time,dr.start,dr.end)&&isSDT(e)&&isApprovedEntry(e));
  const activeTechs=new Set(sdtEnt.map(e=>e.techId)).size;
  const totalSDT=sdtEnt.reduce((s,e)=>s+getDividedHours(e,entries),0);
  const totalTgt=techs.filter(t=>t.status==='active').reduce((s,t)=>s+(t.monthlyTarget||160),0);
  const avg=activeTechs?totalSDT/activeTechs:0;
  const prog=totalTgt?Math.round(totalSDT/totalTgt*100):0;
  stxt('d-act',activeTechs);stxt('d-acts','of '+techs.filter(t=>t.status==='active').length+' active');
  stxt('d-sdt',totalSDT.toFixed(1)+'Hrs');stxt('d-tgt',totalTgt);stxt('d-avg',avg.toFixed(1)+'Hrs');stxt('d-prog',prog+'%');
  renderAchievGraph(dr);renderLB(dr);
}
function setAF(f,btn){achievFilter=f;document.querySelectorAll('.af-btn').forEach(b=>b.classList.remove('sel'));btn.classList.add('sel');renderAchievGraph(getUIRange('dash'));}
window.setAF=setAF;
function renderAchievGraph(range=getUIRange('dash')){
  const cont=document.getElementById('achiev-chart');if(!cont)return;
  const sdtEnt=entries.filter(e=>dateInRange(e.time,range.start,range.end)&&isSDT(e)&&isApprovedEntry(e));
  const inspEnt=entries.filter(e=>dateInRange(e.time,range.start,range.end)&&!isSDT(e)&&isApprovedEntry(e));
  let stats=techs.filter(t=>t.status==='active').map(t=>{
    const sdt=sdtEnt.filter(e=>e.techId===t.id).reduce((s,e)=>s+getDividedHours(e,entries),0);
    const insp=inspEnt.filter(e=>e.techId===t.id).reduce((s,e)=>s+getDividedHours(e,entries),0);
    const asn=assignments.filter(a=>a.techId===t.id&&a.date>=range.start&&a.date<=range.end).reduce((s,a)=>s+(a.hrs||0),0);
    const total=sdt+insp+asn;
    const tgt=t.monthlyTarget||160;
    return{...t,total,tgt,pct:tgt?Math.round(total/tgt*100):0};
  });
  if(achievFilter==='top')stats=stats.sort((a,b)=>b.pct-a.pct).slice(0,8);
  else if(achievFilter==='low')stats=stats.sort((a,b)=>a.pct-b.pct).slice(0,8);
  else stats=stats.sort((a,b)=>b.pct-a.pct);
  if(!stats.length){cont.innerHTML='<div class="empty" style="width:100%;">No data</div>';return;}
  cont.innerHTML=stats.map(t=>{
    const bh=Math.max(4,Math.min(90,Math.round(Math.min(t.pct,150)/150*90)));
    const bc=t.pct>=100?'var(--green)':t.pct>=70?'var(--amber)':'var(--rose)';
    const nm=t.name.split(' ')[0];
    return`<div class="ach-col">
      <div class="ach-av">${avatarHtml(t.id,t.name,36)}</div>
      <div class="ach-bw"><div class="ach-bar" style="height:${bh}px;background:${bc};width:100%;"></div></div>
      <div class="ach-pct" style="color:${bc};">${t.pct}%</div>
      <div class="ach-nm">${nm}</div>
    </div>`;
  }).join('');
}
function getLeaderboardStats(range=getUIRange('dash')){
  const sdtEnt=entries.filter(e=>dateInRange(e.time,range.start,range.end)&&isSDT(e)&&isApprovedEntry(e));
  return techs.filter(t=>t.status==='active').map(t=>{
    const sdt=sdtEnt.filter(e=>e.techId===t.id).reduce((s,e)=>s+getDividedHours(e,entries),0);
    const insp=entries.filter(e=>dateInRange(e.time,range.start,range.end)&&!isSDT(e)&&isApprovedEntry(e)&&e.techId===t.id).reduce((s,e)=>s+getDividedHours(e,entries),0);
    const asn=assignments.filter(a=>a.techId===t.id&&a.date>=range.start&&a.date<=range.end).reduce((s,a)=>s+(a.hrs||0),0);
    return{...t,total:sdt+asn+insp,tgt:t.monthlyTarget||160};
  });
}
function renderLeaderboardInto(bodyId,qId,range=getUIRange('dash')){
  const cont=document.getElementById(bodyId);if(!cont)return;
  const q=(document.getElementById(qId)?.value||'').toLowerCase();
  const stats = getLeaderboardStats(range)
    .filter(t => !q || t.name.toLowerCase().includes(q))
    .map(t => ({
      ...t,
      pct: t.tgt ? Math.round((t.total / t.tgt) * 100) : 0
    }))
    .sort((a, b) => b.pct - a.pct || b.total - a.total);
  cont.innerHTML=stats.map((t,i)=>{
    const pct=t.tgt?Math.round(t.total/t.tgt*100):0;
    const col=pct>=100?'var(--green)':pct>=70?'var(--amber)':'var(--rose)';
    return`<div class="lb-row">
      <div class="lb-rk">${i+1}</div>
      <div style="width:30px;height:30px;border-radius:50%;overflow:hidden;flex-shrink:0;">${avatarHtml(t.id,t.name,30)}</div>
      <div class="lb-in"><div class="lb-nm">${t.name}</div><div class="lb-id">${t.id}</div></div>
      <div class="lb-pb"><div class="lb-pbf" style="width:${Math.min(100,pct)}%;background:${col};"></div></div>
      <div class="lb-hrs" style="color:${col}">${t.total.toFixed(1)}/${t.tgt}Hrs · ${pct}%</div>
    </div>`;
  }).join('')||'<div class="empty">No data</div>';
}
function renderLB(range=getUIRange('dash')){
  renderLeaderboardInto('lb-body','lb-q',range);
  renderLeaderboardInto('dev-lb-body','dev-lb-q',range);
}
window.renderLB=renderLB;






function buildLeaderboardExportPanel(stats,rangeHint=getUIRange('dash')){
  const sorted=[...stats]
    .map(t=>({
      ...t,
      pct:t.tgt?Math.round((t.total/t.tgt)*100):0,
      
    }))
    .sort((a,b)=>b.pct-a.pct||b.total-a.total);

  const perPage=10;
  const pages=[];
  for(let i=0;i<sorted.length;i+=perPage){
    pages.push(sorted.slice(i,i+perPage));
  }
  if(!pages.length) pages.push([]);
  const pageMax = Math.max(100, ...sorted.map(t => Number(t.pct || 0)), 1);

  const monthLabel = (() => {
    try{
      const dStr = (rangeHint && rangeHint.start) ? String(rangeHint.start).slice(0,10) : (typeof todayEAT === 'function' ? todayEAT() : new Date().toISOString().slice(0,10));
      const d = new Date(dStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month:'long', year:'numeric', timeZone:'Africa/Addis_Ababa' }).toUpperCase();
    }catch(e){
      return '';
    }
  })();

  const escapeHtml = (val) => String(val ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');

  function exportAvatar(uid,name,size,col){
    const pic=getUserPhoto(uid);
    const ini=(name||'?').split(' ').filter(Boolean).map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?';
    const safePic=String(pic||'').replace(/'/g,'%27');
    const avatarCore = pic
      ? `<div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;border:6px solid ${col};background:#fff;box-shadow:0 3px 10px rgba(15,23,42,.10);flex-shrink:0;">
           <img src="${safePic}" alt="${escapeHtml(ini)}" style="width:100%;height:100%;display:block;object-fit:cover;object-position:center center;border-radius:50%;background:#fff;" crossorigin="anonymous">
         </div>`
      : `<div style="width:${size}px;height:${size}px;border-radius:50%;border:4px solid ${col};background:${AV_COLORS[(String(uid||'').charCodeAt(0)||0)%AV_COLORS.length]};color:#fff;display:flex;align-items:center;justify-content:center;font-size:${Math.max(30, Math.round(size*0.40))}px;font-weight:900;box-shadow:0 3px 10px rgba(15,23,42,.10);flex-shrink:0;">
           ${escapeHtml(ini)}
         </div>`;
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0;">
        ${avatarCore}
      </div>`;
  }

  const pageStyle = `
    width:1600px;
    min-height:860px;
    box-sizing:border-box;
    background:#f0f4f8;
    color:#0f172a;
    border:1px solid #dbe3ee;
    border-radius:18px;
    overflow:hidden;
    page-break-after:always;
    display:flex;
    flex-direction:column;
    box-shadow:0 2px 10px rgba(15,23,42,.05);
  `;

  const panel = document.createElement('div');
  panel.id = 'lb-export-panel';
  panel.style.position = 'fixed';
  panel.style.left = '-99999px';
  panel.style.top = '0';
  panel.style.width = '1600px';
  panel.style.background = 'transparent';
  panel.style.color = '#0f172a';
  panel.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
  panel.style.boxSizing = 'border-box';
  panel.style.padding = '0';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.gap = '24px';

  pages.forEach((page, pageIndex)=>{
    const totalPages = pages.length;
        const pageEl = document.createElement('div');
    pageEl.className = 'lb-export-page';
    pageEl.style.cssText = pageStyle;

    pageEl.innerHTML = `
      <div style="background:#c1121f;color:#fff;padding:20px 28px 16px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-shrink:0;">
        <div style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-width:0;">
          <div style="font-size:54px;font-weight:900;letter-spacing:-1.4px;line-height:1;">Monthly Productivity Report</div>
          <div style="font-size:32px;font-weight:900;letter-spacing:1.2px;line-height:1;text-transform:uppercase;">${escapeHtml(monthLabel)}</div>
        </div>
        <div style="font-size:20px;font-weight:800;opacity:.98;text-align:right;">
          PAGE ${pageIndex + 1} OF ${totalPages}<br>
          HORIZONTAL LEADERBOARD
        </div>
      </div>

      <div style="padding:16px 32px 14px;display:flex;justify-content:space-between;align-items:center;gap:14px;font-size:18px;font-weight:700;flex-shrink:0;">
        <div style="color:#64748b;font-weight:600;">Ranked by achievement percentage.</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
          <span style="display:inline-flex;align-items:center;gap:8px;"><span style="width:18px;height:18px;background:#10b981;display:inline-block;border-radius:2px;"></span>≥100%</span>
          <span style="display:inline-flex;align-items:center;gap:8px;"><span style="width:18px;height:18px;background:#f59e0b;display:inline-block;border-radius:2px;"></span>70–99%</span>
          <span style="display:inline-flex;align-items:center;gap:8px;"><span style="width:18px;height:18px;background:#f43f5e;display:inline-block;border-radius:2px;"></span>&lt;70%</span>
        </div>
      </div>

      <div style="padding:8px 24px 22px;flex:1;display:flex;flex-direction:column;min-height:0;">
        <div style="display:flex;align-items:flex-end;gap:18px;flex:1;min-height:0;padding:14px 8px 0;overflow:hidden;">
          ${page.map((t, idx)=>{
            const pct=t.pct||0;
            const col=pct>=100?'#10b981':pct>=70?'#f59e0b':'#f43f5e';
            const fill=Math.max(8, Math.min(100, pct));
            const barH=Math.max(26, Math.round((pct / pageMax) * 300));
            const safeName=escapeHtml(t.name);
            const safeId=escapeHtml(t.id);
            return `
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;">
                <div style="text-align:center;line-height:1.1;margin-bottom:12px;min-height:64px;display:flex;flex-direction:column;justify-content:flex-end;">
                  <div style="font-size:26px;font-weight:900;color:${col};">${pct}%</div>
                  <div style="font-size:18px;font-weight:800;color:#0f172a;">${Number(t.total||0).toFixed(1)}Hrs</div>
                </div>
                <div style="margin-bottom:10px;display:flex;justify-content:center;flex-direction:column;align-items:center;gap:8px;">
                  ${exportAvatar(t.id,t.name,96,col)}
                </div>
                <div style="width:30px;height:${barH}px;background:${col};border-radius:999px;box-shadow:0 1px 2px rgba(15,23,42,.15);"></div>
                <div style="margin-top:14px;display:flex;flex-direction:column;align-items:center;gap:6px;min-height:48px;">
                  <div style="background:#111827;color:#fff;border-radius:999px;padding:7px 16px;font-size:18px;font-weight:800;font-family:'JetBrains Mono',monospace;white-space:nowrap;">${safeId}</div>
                </div>
              </div>
            `;
          }).join('')}
          ${!page.length ? `<div style="flex:1;text-align:center;color:#64748b;font-size:18px;font-weight:700;background:#fff;border:1px dashed #dbe3ee;border-radius:14px;padding:48px 16px;">No data</div>` : ''}
        </div>
      </div>

      <div style="padding:10px 28px 16px;border-top:1px solid #dbe3ee;display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:11px;color:#64748b;flex-shrink:0;">
        <div>Generated from the current leaderboard view.</div>
        <div style="font-family:'JetBrains Mono',monospace;">${escapeHtml(todayEAT())}</div>
      </div>
    `;
    panel.appendChild(pageEl);
  });

  return panel;
}
async function exportLeaderboard(panelId,format='image'){
  if(!window.html2canvas){toast('Export library not loaded','error');return;}
  const range=getUIRange('dash');
  const stats=getLeaderboardStats(range).map(t=>({
    ...t,
    pct:t.tgt?Math.round((t.total/t.tgt)*100):0
  })).sort((a,b)=>b.pct-a.pct||b.total-a.total);

  const exportPanel=buildLeaderboardExportPanel(stats,range);
  document.body.appendChild(exportPanel);

  try{
    const safeDate=todayEAT();
    if(format==='pdf'){
      const { jsPDF } = window.jspdf || {};
      if(!jsPDF) throw new Error('jsPDF missing');
      const pdf=new jsPDF('l','mm','a4');
      const pages=[...exportPanel.querySelectorAll('.lb-export-page')];
      for(let i=0;i<pages.length;i++){
        const pageCanvas=await html2canvas(pages[i],{scale:2,backgroundColor:'#f0f4f8',useCORS:true});
        const imgData=pageCanvas.toDataURL('image/png');
        const pageW=pdf.internal.pageSize.getWidth();
        const pageH=pdf.internal.pageSize.getHeight();
        const ratio=Math.min((pageW-10)/pageCanvas.width,(pageH-10)/pageCanvas.height);
        const imgW=pageCanvas.width*ratio;
        const imgH=pageCanvas.height*ratio;
        const x=(pageW-imgW)/2;
        const y=(pageH-imgH)/2;
        if(i>0) pdf.addPage();
        pdf.addImage(imgData,'PNG',x,y,imgW,imgH);
      }
      pdf.save(`leaderboard_${safeDate}.pdf`);
    }else{
      const canvas=await html2canvas(exportPanel,{scale:2,backgroundColor:'#f0f4f8',useCORS:true});
      const link=document.createElement('a');
      link.href=canvas.toDataURL('image/png');
      link.download=`leaderboard_${safeDate}.png`;
      link.click();
    }
    toast(format==='pdf'?'PDF exported':'Image exported');
  }catch(err){
    console.error(err);
    toast('Export failed','error');
  }finally{
    exportPanel.remove();
  }
}
// ════════════════════════════════════════════════
//  ASSIGNMENTS
// ════════════════════════════════════════════════
function populateAsnSels(){
  ['asn-tech','asn-ft'].forEach(id=>{
    const sel=document.getElementById(id);if(!sel)return;
    const cur=sel.value;
    sel.innerHTML=(id==='asn-ft'?'<option value="">All Techs</option>':'')+
      techs.filter(t=>t.status==='active').map(t=>`<option value="${t.id}">${t.name} (${t.id})</option>`).join('');
    if(cur)sel.value=cur;
  });
}
function applyAsnPreset(v){
  const today=todayEAT(),wr=getWR(),mr=getMR();
  const fromEl=document.getElementById('asn-dt-from'),toEl=document.getElementById('asn-dt-to');
  if(!fromEl||!toEl)return;
  if(v==='today'){fromEl.value=today;toEl.value=today;}
  else if(v==='week'){fromEl.value=wr.start;toEl.value=wr.end;}
  else if(v==='month'){fromEl.value=mr.start;toEl.value=mr.end;}
  else if(v==='all'){fromEl.value='';toEl.value='';}
  renderAssignments();
}
window.applyAsnPreset=applyAsnPreset;
async function submitAssignment(){
  const techId=document.getElementById('asn-tech')?.value;
  const desc=sanitize(document.getElementById('asn-desc')?.value);
  const hrs=sanitizeNum(document.getElementById('asn-hrs')?.value);
  if(!techId||!desc||!hrs){toast('Fill all required fields','error');return;}
  const tech=techs.find(t=>t.id===techId);
  const asn={techId,techName:tech?.name||techId,desc,hrs,date:document.getElementById('asn-date')?.value||todayEAT(),comment:sanitize(document.getElementById('asn-comment')?.value),assignedBy:CU.name};
  try{const ref=await window.addDoc(window.collection(window.db,'assignments'),asn);asn.id=ref.id;assignments.unshift(asn);clearAssignment();renderAssignments();toast('Assignment added');}
  catch(e){toast('Save failed: '+e.message,'error');}
}
window.submitAssignment=submitAssignment;
function clearAssignment(){['asn-tech','asn-desc','asn-hrs','asn-comment'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});sv('asn-date',todayEAT());}
window.clearAssignment=clearAssignment;
function renderAssignments(){
  const q=(document.getElementById('asn-q')?.value||'').toLowerCase();
  const tf=document.getElementById('asn-ft')?.value||'';
  const fromV=document.getElementById('asn-dt-from')?.value||'';
  const toV=document.getElementById('asn-dt-to')?.value||'';
  let list=[...assignments];
  if(tf)list=list.filter(a=>a.techId===tf);
  if(fromV)list=list.filter(a=>a.date>=fromV);
  if(toV)list=list.filter(a=>a.date<=toV);
  if(q)list=list.filter(a=>(a.techName+a.desc).toLowerCase().includes(q));
  const cont=document.getElementById('asn-list');if(!cont)return;
  if(!list.length){cont.innerHTML='<div class="empty"><div class="ei">📌</div><div class="et">No assignments</div></div>';return;}
  cont.innerHTML=list.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).map(a=>`
    <div class="asn-card" style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
      <div>
        <div class="asn-hd"><div style="width:24px;height:24px;border-radius:50%;overflow:hidden;">${avatarHtml(a.techId,a.techName,24)}</div><span class="asn-nm">${sanitize(a.techName)}</span></div>
        <div class="asn-desc">${sanitize(a.desc)}</div>
        <div class="asn-meta"><span class="asn-hrs">⏱ ${a.hrs}h</span><span>${fmtEAT(a.date,'date')}</span><span>by ${sanitize(a.assignedBy||'')}</span></div>
        ${a.comment?`<div style="font-size:11px;color:var(--tx3);margin-top:4px;">💬 ${sanitize(a.comment)}</div>`:''}
      </div>
      <button class="btn bd bsm" onclick="delAsn('${a.id}')">🗑</button>
    </div>`).join('');
}
window.delAsn=async function(id){if(!confirm('Delete assignment?'))return;try{await window.deleteDoc(window.doc(window.db,'assignments',id));assignments=assignments.filter(a=>a.id!==id);renderAssignments();}catch(e){toast('Error','error');}};
// ════════════════════════════════════════════════
//  ALL ENTRIES
// ════════════════════════════════════════════════
function populateTechFilter(){const sel=document.getElementById('ae-tech');if(!sel)return;const cur=sel.value;sel.innerHTML='<option value="">All Techs</option>'+techs.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');if(cur)sel.value=cur;}
function applyAEPreset(v){
  const today=todayEAT(),wr=getWR(),mr=getMR();
  const fromEl=document.getElementById('ae-dt-from'),toEl=document.getElementById('ae-dt-to');
  if(!fromEl||!toEl)return;
  if(v==='today'){fromEl.value=today;toEl.value=today;}
  else if(v==='week'){fromEl.value=wr.start;toEl.value=wr.end;}
  else if(v==='month'){fromEl.value=mr.start;toEl.value=mr.end;}
  else if(v==='all'){fromEl.value='';toEl.value='';}
  renderAllEntries();
}
window.applyAEPreset=applyAEPreset;

function canManageEntriesUI(){
  return ['dev','lead','ctrl'].includes(CR);
}
window.canManageEntriesUI=canManageEntriesUI;

function editEntryById(id){
  if(!canManageEntriesUI()){toast('Not allowed','error');return;}
  const e=entries.find(x=>x.id===id);
  if(!e){toast('Entry not found','error');return;}

  const techIdRaw=prompt('Technician ID',e.techId||'');
  if(techIdRaw===null)return;
  const techId=techIdRaw.trim();
  const taskCodeRaw=prompt('Task Code',e.taskCode||'');
  if(taskCodeRaw===null)return;
  const taskCode=taskCodeRaw.trim().toUpperCase();
  const jobRoleRaw=prompt('Job Role (Technician / Under Supervision / Inspector / Preliminary Inspector)',e.jobRole||'Technician');
  if(jobRoleRaw===null)return;
  const jobRoleInput=jobRoleRaw.trim().toLowerCase();
  const jobRole=(ROLES.find(r=>r.toLowerCase()===jobRoleInput)||e.jobRole||'Technician');
  const jobTypeRaw=prompt('Job Type (completed / scrap)',e.jobType||'completed');
  if(jobTypeRaw===null)return;
  const jobTypeInput=jobTypeRaw.trim().toLowerCase();
  const jobType=jobTypeInput.startsWith('scr')?'scrap':'completed';
  const pnameRaw=prompt('Part Name',e.pname||'');
  if(pnameRaw===null)return;
  const pname=pnameRaw.trim();
  const pnumRaw=prompt('Part Number',e.pnum||'');
  if(pnumRaw===null)return;
  const pnum=pnumRaw.trim();
  const ataRaw=prompt('ATA Chapter',e.ata||'');
  if(ataRaw===null)return;
  const ata=ataRaw.trim();
  const timeRaw=prompt('Date (EAT)',e.time?.slice(0,10)||todayEAT());
  if(timeRaw===null)return;
  const time=timeRaw.trim();
  const hoursRaw=prompt('Hours',String(e.hours ?? ''));
  if(hoursRaw===null)return;

  const tech=techs.find(t=>t.id===techId);
  const updated={
    ...e,
    techId:techId||e.techId,
    techName:tech?.name || e.techName || techId || '',
    taskCode:taskCode || e.taskCode || '',
    jobRole:['Technician','Under Supervision','Inspector','Preliminary Inspector'].includes(jobRole)?jobRole:(e.jobRole||'Technician'),
    jobType:jobType==='scrap'?'scrap':'completed',
    pname:pname || e.pname || '',
    pnum:pnum || e.pnum || '',
    ata:ata || e.ata || '',
    time:time || e.time || todayEAT(),
    hours:Number(hoursRaw),
  };

  (async()=>{
    try{
      await window.setDoc(window.doc(window.db,'entries',id),updated);
      const idx=entries.findIndex(x=>x.id===id);
      if(idx>-1)entries[idx]=updated;
      renderEntry();
      renderLeaderEntry();
      renderAllEntries();
      renderReports();
      renderTG();
      renderLB();
      toast('Entry updated');
    }catch(err){
      console.error(err);
      toast('Update failed: '+err.message,'error');
    }
  })();
}
window.editEntryById=editEntryById;
window.editEntry=editEntryById;

window.delEntryById=async function(id){
  if(!canManageEntriesUI()){toast('Not allowed','error');return;}
  if(!confirm('Delete this entry?'))return;
  try{
    await window.deleteDoc(window.doc(window.db,'entries',id));
    entries=entries.filter(x=>x.id!==id);
    renderEntry();
    renderLeaderEntry();
    renderAllEntries();
    renderReports();
    renderTG();
    renderLB();
    toast('Entry deleted');
  }catch(err){
    console.error(err);
    toast('Delete failed: '+err.message,'error');
  }
};
window.delEntry=window.delEntryById;

function getAllEntriesFiltered(){
  const tf=document.getElementById('ae-tech')?.value||'';
  const sf=document.getElementById('ae-st')?.value||'all';
  const fromV=document.getElementById('ae-dt-from')?.value||'';
  const toV=document.getElementById('ae-dt-to')?.value||'';
  const q=(document.getElementById('ae-q')?.value||'').toLowerCase();
  let f=[...entries];
  if(tf)f=f.filter(e=>e.techId===tf);
  if(sf!=='all')f=f.filter(e=>getEntryStatus(e)===sf);
  if(fromV)f=f.filter(e=>e.time&&e.time.slice(0,10)>=fromV);
  if(toV)f=f.filter(e=>e.time&&e.time.slice(0,10)<=toV);
  if(q)f=f.filter(e=>(e.techName+e.pname+e.taskCode+e.pnum).toLowerCase().includes(q));
  return f;
}

async function bulkApplyToFiltered(mode){
  if(!canManageEntriesUI()){toast('Not allowed','error');return;}
  const filtered=getAllEntriesFiltered();
  if(!filtered.length){toast('No filtered entries to update','warn');return;}
  const label=mode==='accepted'?'accept':mode==='rejected'?'reject':'delete';
  if(!confirm(`Are you sure you want to ${label} ${filtered.length} filtered entr${filtered.length===1?'y':'ies'}?`))return;
  showLoading(`${label.charAt(0).toUpperCase()+label.slice(1)}ing ${filtered.length} filtered entr${filtered.length===1?'y':'ies'}...`);
  let done=0, failed=0;
  try{
    for(const e of filtered){
      try{
        if(mode==='delete'){
          await window.deleteDoc(window.doc(window.db,'entries',e.id));
          entries=entries.filter(x=>x.id!==e.id);
        }else{
          const u={...e,approvalStatus:mode,reviewedBy:CU?.name||'',reviewedById:CU?.id||'',reviewedAt:todayEAT()};
          await window.setDoc(window.doc(window.db,'entries',e.id),u);
          const idx=entries.findIndex(x=>x.id===e.id);
          if(idx>-1)entries[idx]=u;
        }
        done++;
      }catch(err){
        failed++;
        console.error(err);
      }
    }
    renderEntry();
    renderLeaderEntry();
    renderAllEntries();
    renderReports();
    renderTG();
    renderLB();
    toast((label.charAt(0).toUpperCase()+label.slice(1))+' complete: '+done+' done'+(failed?(', '+failed+' failed'):''));
  }finally{
    hideLoading();
  }
}
window.bulkApplyToFiltered=bulkApplyToFiltered;
window.bulkAcceptAll=async function(){return bulkApplyToFiltered('accepted');};
window.bulkRejectAll=async function(){return bulkApplyToFiltered('rejected');};
window.bulkDeleteAll=async function(){return bulkApplyToFiltered('delete');};

function renderAllEntries(){
  const f=getAllEntriesFiltered();
  const tbody=document.getElementById('ae-body');
  if(tbody){tbody.innerHTML=f.slice(0,200).map(e=>{
    const div=getDividedHours(e,entries),insp=!isSDT(e);
    const rc=ROLE_COLORS[ROLES.indexOf(e.jobRole||'Technician')]||'var(--blue)';
    const st=getEntryStatusBadge(e);
    const can=canManageEntriesUI();
    const act=can?`<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
        <button class="btn bg_ bsm" style="padding:4px 8px;" onclick="approveEntryById('${e.id}')">✓ Accept</button>
        <button class="btn bd bsm" style="padding:4px 8px;" onclick="rejectEntryById('${e.id}')">✕ Reject</button>
        <button class="btn bo bsm" style="padding:4px 8px;" onclick="editEntryById('${e.id}')">✎</button>
        <button class="btn bd bsm" style="padding:4px 8px;" onclick="delEntryById('${e.id}')">🗑</button>
      </div>`:'—';
    const rowStyle=getEntryStatus(e)==='pending'?'background:rgba(245,158,11,.06);':'';
    const rowStyle2=getEntryStatus(e)==='rejected'?'background:rgba(244,63,94,.08);border-left:3px solid var(--rose);':'';
    return`<tr style="${rowStyle2||rowStyle}">
      <td class="mono">${fmtEAT(e.time,'date')}</td>
      <td>${e.techName}</td>
      <td class="mono" style="color:var(--blue);">${e.taskCode||'—'}</td>
      <td style="font-size:11px;font-weight:700;color:${rc}">${e.jobRole||'Tech'}</td>
      <td><span class="${e.jobType==='scrap'?'cp-scrap':'cp-comp'}">${e.jobType==='scrap'?'Scrap':'Done'}</span></td>
      <td>${e.pname}</td><td class="mono">${e.ata||'—'}</td><td class="mono">${e.pnum||'—'}</td>
      <td class="mono">${div.toFixed(2)}h${insp?' <span class="not-sdt">!</span>':''}</td>
      <td>${st}</td>
      <td>${act}</td>
     </tr>`;
  }).join('')||'<tr><td colspan="11" class="empty">No entries</td></tr>';}
}
// ════════════════════════════════════════════════
//  REPORTS
// ════════════════════════════════════════════════
function renderReports(){
  const rr=getUIRange('rpt');
  const sdtEnt=entries.filter(e=>dateInRange(e.time,rr.start,rr.end)&&isSDT(e)&&isApprovedEntry(e));
  const inspEnt=entries.filter(e=>dateInRange(e.time,rr.start,rr.end)&&!isSDT(e)&&isApprovedEntry(e));
  const tbody=document.getElementById('rpt-body');if(!tbody)return;
  tbody.innerHTML=techs.filter(t=>t.status==='active').map(t=>{
    const sdt=sdtEnt.filter(e=>e.techId===t.id).reduce((s,e)=>s+getDividedHours(e,entries),0);
    const insp=inspEnt.filter(e=>e.techId===t.id).reduce((s,e)=>s+getDividedHours(e,entries),0);
    const asn=assignments.filter(a=>a.techId===t.id&&a.date>=rr.start&&a.date<=rr.end).reduce((s,a)=>s+(a.hrs||0),0);
    const total=sdt+asn+insp;const tgt=t.monthlyTarget||160;
    const pct=tgt?Math.round(total/tgt*100):0;
    const cls=pct>=100?'bgr':pct>=80?'bamb':pct>=60?'bblu':'bred';
    const status=pct>=100?'✅ Achieved':pct>=80?'⚠️ Near':pct>=60?'🟡 Progress':'🔴 Low';
    return`<tr>
      <td style="font-weight:600;">${t.name}</td>
      <td class="mono">${tgt}h</td><td class="mono">${sdt.toFixed(2)}h</td>
      <td class="mono" style="color:var(--cyan);">${asn.toFixed(2)}h</td>
      <td class="mono" style="font-weight:700;">${total.toFixed(2)}h</td>
      <td class="mono" style="color:var(--violet);">${insp.toFixed(2)}h</td>
      <td><span class="bdg ${cls}">${pct}%</span></td>
      <td class="mono">${(total/22).toFixed(2)}h</td>
      <td>${status}</td>
     </tr>`;
  }).join('')||'<tr><td colspan="9" class="empty">No data</td></tr>';
}

// ════════════════════════════════════════════════
//  TASK CODE GROUPS
// ════════════════════════════════════════════════
function applyTCPreset(v){
  const today=todayEAT(),wr=getWR(),mr=getMR();
  const fromEl=document.getElementById('tc-dt-from'),toEl=document.getElementById('tc-dt-to');
  if(!fromEl||!toEl)return;
  if(v==='today'){fromEl.value=today;toEl.value=today;}
  else if(v==='week'){fromEl.value=wr.start;toEl.value=wr.end;}
  else if(v==='month'){fromEl.value=mr.start;toEl.value=mr.end;}
  else if(v==='all'){fromEl.value='';toEl.value='';}
  renderTG();
}
window.applyTCPreset=applyTCPreset;
function getTGFiltered(){
  const fromV=document.getElementById('tc-dt-from')?.value||'';
  const toV=document.getElementById('tc-dt-to')?.value||'';
  const q=(document.getElementById('tc-q')?.value||'').toLowerCase();
  let f=[...entries];
  if(fromV)f=f.filter(e=>e.time&&e.time.slice(0,10)>=fromV);
  if(toV)f=f.filter(e=>e.time&&e.time.slice(0,10)<=toV);
  if(q)f=f.filter(e=>(e.taskCode||'').toLowerCase().includes(q));
  if(CR==='tech'){
    const myCodes=new Set(f.filter(e=>e.techId===CU.id).map(e=>e.taskCode));
    f=f.filter(e=>myCodes.has(e.taskCode));
  }
  return f;
}
function getTaskSplitPools(taskCode, partNum, stdHrs = 0){
  const tc=sanitize(taskCode||'').toUpperCase();
  const pn=String(partNum||'');
  const rel=entries.filter(e=>
    isApprovedEntry(e) &&
    (e.taskCode||'').toUpperCase()===tc &&
    e.pnum===pn &&
    e.jobType!=='scrap' &&
    (e.jobRole==='Technician' || e.jobRole==='Under Supervision' || e.jobRole==='Inspector' || e.jobRole==='Preliminary Inspector')
  );
  const r=getRatioForPart(pn);
  const techCount=rel.filter(e=>e.jobRole==='Technician').length;
  const supCount=rel.filter(e=>e.jobRole==='Under Supervision').length;
  const inspCount=rel.filter(e=>e.jobRole==='Inspector').length;
  const prelimCount=rel.filter(e=>e.jobRole==='Preliminary Inspector').length;
  const hasSup=supCount>0;
  const techPool=hasSup ? (stdHrs*(r.tech||0)/100) : stdHrs;
  const supPool=stdHrs*(r.sup||0)/100;
  return {
    'Technician': techPool,
    'Under Supervision': supPool,
    'Inspector': (r.inspHrs||1)*inspCount,
    'Preliminary Inspector': (r.prelimHrs||1)*prelimCount,
    techCount,
    supCount,
    inspCount,
    prelimCount
  };
}

function renderTG(){
  if(CR==='tech'){const a=document.getElementById('tc-alert');if(a)a.textContent='Showing task groups you are part of. All colleagues on the same task codes are also shown.';}
  const cont=document.getElementById('tc-body');if(!cont)return;
  const f=getTGFiltered();
  const groups={};
  f.forEach(e=>{const c=(e.taskCode||'NO CODE').toUpperCase();if(!groups[c])groups[c]={c,entries:[]};groups[c].entries.push(e);});
  const codes=Object.keys(groups).sort();
  if(!codes.length){cont.innerHTML='<div class="empty"><div class="ei">🗂</div><div class="et">No task codes found</div></div>';return;}
  const avC=['#3b82f6','#10b981','#f59e0b','#f43f5e','#8b5cf6','#06b6d4'];
  cont.innerHTML=codes.map(code=>{
    const g=groups[code];
    const approvedEntries=g.entries.filter(isApprovedEntry);
    const pendingCount=g.entries.filter(e=>getEntryStatus(e)==='pending').length;
    const rejectedCount=g.entries.filter(e=>getEntryStatus(e)==='rejected').length;
    const byRole={};ROLES.forEach(r=>{byRole[r]=g.entries.filter(e=>(e.jobRole||'Technician')===r);});
    const partNum=g.entries[0]?.pnum||'';
    const stdHrs=g.entries[0]?.stdHours||0;
    const ratios=getRatioForPart(partNum);
    const isOv=!!(settings.partRatios&&settings.partRatios[partNum]);
    const partName=g.entries[0]?.pname||'—';
    const lastT=fmtEAT(new Date(Math.max(...g.entries.map(e=>new Date(e.time||0)))).toISOString(),'date');
    const pools=getTaskSplitPools(code,partNum,stdHrs);
    const personRows=(arr,role,ri)=>{
      if(!arr.length)return`<div style="color:var(--tx3);font-size:12px;padding:6px 0;">No entries</div>`;
      const approvedCount=arr.filter(isApprovedEntry).length;
      const cnt=approvedCount||arr.length;
      const each=cnt?pools[role]/cnt:0,insp=isInspRole(role);
      return arr.map((e,i)=>{
        const isMy=CR==='tech'&&e.techId===CU.id;
        const st=getEntryStatusBadge(e);
        const rowHrs=getEntryStatus(e)==='accepted'?each:0;
        return`<div class="tg-p" style="${isMy?'background:var(--bdim);border-radius:5px;padding:5px 6px;':''}">
          <div style="width:24px;height:24px;border-radius:50%;overflow:hidden;flex-shrink:0;border:1px solid var(--bdr);">${avatarHtml(e.techId,e.techName,24)}</div>
          <div><div class="tg-pn">${sanitize(e.techName)}${isMy?' <span style="font-size:9px;color:var(--blue);">(you)</span>':''} <span class="alloc-bdg ${['ab-b','ab-g','ab-v','ab-c'][ri]}">⏱${rowHrs.toFixed(2)}h</span>${insp?' <span class="not-sdt">NOT SDT</span>':''} ${st}</div>
          <div class="tg-pt">${fmtEAT(e.time,'date')} · <span class="${e.jobType==='scrap'?'cp-scrap':'cp-comp'}">${e.jobType==='scrap'?'Scrap':'Done'}</span></div></div>
        </div>`;
      }).join('');
    };
    return`<div class="tg">
      <div class="tgh" onclick="this.parentElement.querySelector('.tg-body').style.display=this.parentElement.querySelector('.tg-body').style.display==='none'?'grid':'none'">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span class="tg-code">${code}</span>
          <span style="font-size:12px;color:var(--tx2);">📋 ${sanitize(partName)} · <span class="mono">${partNum}</span></span>
          ${isOv?`<span style="font-size:10px;background:var(--adim);color:var(--amber);padding:2px 7px;border-radius:99px;font-weight:700;">Custom Ratio</span>`:''}
          <span style="font-size:10px;background:var(--gdim);color:var(--green);padding:2px 7px;border-radius:99px;font-weight:700;">Accepted ${approvedEntries.length}</span>
          ${pendingCount?`<span style="font-size:10px;background:var(--adim);color:var(--amber);padding:2px 7px;border-radius:99px;font-weight:700;">Pending ${pendingCount}</span>`:''}
          ${rejectedCount?`<span style="font-size:10px;background:var(--rdim);color:var(--rose);padding:2px 7px;border-radius:99px;font-weight:700;">Rejected ${rejectedCount}</span>`:''}
        </div>
        <div class="tg-meta">
          ${ROLES.map((r,i)=>`<span style="color:${ROLE_COLORS[i]};">${byRole[r].length} ${r.split(' ')[0]}</span>`).join(' · ')}
          <span style="color:var(--amber);font-weight:700;font-family:'JetBrains Mono',monospace;">SDT:${stdHrs}h</span>
          <span style="color:var(--tx3);">▼</span>
        </div>
      </div>
      <div class="tg-body">
        ${ROLES.map((r,i)=>`<div class="tg-col">
          <div class="tg-rh" style="color:${ROLE_COLORS[i]}">${['🔧','👁','🔍','🔎'][i]} ${r.split(' ')[0].toUpperCase()}
            <span style="margin-left:auto;font-size:9px;font-family:'JetBrains Mono',monospace;">${isInspRole(r)?pools[r].toFixed(2)+'Hrs fixed':pools[r].toFixed(2)+'Hrs pool'}</span>
          </div>
          ${personRows(byRole[r],r,i)}
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}
window.renderTG=renderTG;
function exportTG(){
  const f=getTGFiltered();const g={};
  f.forEach(e=>{const c=(e.taskCode||'NO CODE').toUpperCase();if(!g[c])g[c]=[];g[c].push(e);});
  let csv='TaskCode,PartNum,Role,Type,Name,TechID,Pool,DividedHrs,HoursType,StdHrs,Date(EAT)\n';
  Object.keys(g).sort().forEach(code=>{
    const arr=g[code];const pnum=arr[0]?.pnum||'';const stdHrs=arr[0]?.stdHours||0;
    const ratios=getRatioForPart(pnum);
    ROLES.forEach(r=>{
      const ra=arr.filter(e=>(e.jobRole||'Technician')===r);if(!ra.length)return;
      const pools=getTaskSplitPools(code,pnum,stdHrs);
      const pool=isInspRole(r)?(r==='Inspector'?pools.Inspector:pools['Preliminary Inspector']):pools[r];
      const each=ra.length?pool/ra.length:0;
      ra.forEach(e=>csv+=`"${code}","${pnum}","${r}","${e.jobType||'completed'}","${e.techName}","${e.techId}",${pool.toFixed(3)},${each.toFixed(3)},${isInspRole(r)?'NOT_SDT':'SDT'},${stdHrs},"${fmtEAT(e.time,'date')}"\n`);
    });
  });
  dlFile(csv,`task_groups_${todayEAT()}.csv`,'text/csv');toast('Exported');
}
window.exportTG=exportTG;

// ════════════════════════════════════════════════
//  ADMIN: TECHNICIANS
// ════════════════════════════════════════════════
function renderTechs(){
  const q=(document.getElementById('at-q')?.value||'').toLowerCase();
  const f=techs.filter(t=>!q||t.name.toLowerCase().includes(q)||t.id.toLowerCase().includes(q));
  const tbody=document.getElementById('at-body');
  if(tbody){tbody.innerHTML=f.map(t=>{
    const mt=t.monthlyTarget||160;
    return`<tr>
      <td><div style="width:34px;height:34px;border-radius:50%;overflow:hidden;">${avatarHtml(t.id,t.name,34)}</div></td>
      <td class="mono" style="color:var(--blue);">${t.id}</td>
      <td style="font-weight:600;">${sanitize(t.name)}</td>
      <td class="mono"><span class="bdg bblu">${mt}h</span></td>
      <td class="mono">${getWeeklyTgt(mt).toFixed(1)}Hrs/wk</td>
      <td class="mono">${getDailyTgt(mt).toFixed(1)}Hrs/day</td>
      <td><span class="bdg ${t.status==='active'?'bgr':'bgray'}">${t.status}</span>${t.underSupervision?'<span class="bdg bgr" style="margin-left:4px;font-size:9px;">👁 UnderSup</span>':''}</td>
      <td><div style="display:flex;gap:5px;">
        <button class="btn bo bsm" onclick="openEditTech('${t.id}')">✏️</button>
        <button class="btn bd bsm" onclick="delTech('${t.id}')">🗑</button>
      </div></td>
     </tr>`;
  }).join('')||'<tr><td colspan="8" class="empty">No technicians</td></tr>';}
}
window.openAddTech=function(){editTechId=null;clearTechForm();stxt('mt-title','Add Technician');openModal('m-tech');};
window.openEditTech=function(id){
  const t=techs.find(x=>x.id===id);if(!t)return;editTechId=id;
  sv('mt-id',t.id);sv('mt-name',t.name);sv('mt-target',t.monthlyTarget||160);sv('mt-pwd',t.password||'demo');
  document.getElementById('mt-status').value=t.status||'active';
  const roleKey=getRoleAccessKeyForTech(t);const ra=document.getElementById('mt-role-access');if(ra)ra.value=roleKey;
  const usEl=document.getElementById('mt-unsup');if(usEl)usEl.checked=(roleKey==='tech_sup'||roleKey==='all'||!!t.underSupervision);
  const pic=getUserPhoto(id);const pm=document.getElementById('mt-pic-prev'),pp=document.getElementById('mt-pic-ph');
  if(pic&&pm){pm.src=pic;pm.style.display='block';}if(pp)pp.style.display=pic?'none':'block';
  stxt('mt-title','Edit Technician');openModal('m-tech');
};
function clearTechForm(){['mt-id','mt-name','mt-target','mt-pwd'].forEach(id=>sv(id,''));document.getElementById('mt-status').value='active';const ra=document.getElementById('mt-role-access');if(ra)ra.value='tech';const _us=document.getElementById('mt-unsup');if(_us)_us.checked=false;const pm=document.getElementById('mt-pic-prev'),pp=document.getElementById('mt-pic-ph');if(pm){pm.src='';pm.style.display='none';}if(pp)pp.style.display='block';}
window.saveTech=async function(){
  const id=sanitize(document.getElementById('mt-id')?.value);const name=sanitize(document.getElementById('mt-name')?.value);
  if(!id||!name){toast('ID and Name required','error');return;}
  const target=sanitizeNum(document.getElementById('mt-target')?.value)||160;
  const status=document.getElementById('mt-status')?.value;const pwd=sanitize(document.getElementById('mt-pwd')?.value)||'demo';
  const roleAccessKey=normalizeRoleAccessKey(document.getElementById('mt-role-access')?.value||'tech');
  const allowedRoles=ROLE_ACCESS_PROFILES[roleAccessKey].slice();
  const underSupervision=allowedRoles.includes('Under Supervision');
  const colors=['#3b82f6','#10b981','#f59e0b','#f43f5e','#8b5cf6'];
  const payload={id,name,monthlyTarget:target,status,password:pwd,underSupervision,roleAccess:roleAccessKey,allowedRoles,initials:name.slice(0,2).toUpperCase(),color:colors[(editTechId?techs.findIndex(t=>t.id===editTechId):techs.length)%colors.length]};
  if(editTechId){const idx=techs.findIndex(t=>t.id===editTechId);if(idx>-1){const u={...techs[idx],...payload};await window.setDoc(window.doc(window.db,'technicians',editTechId),u);techs[idx]=u;if(CU&&CU.id===editTechId)CU=u;}toast('Updated');}
  else{if(techs.find(t=>t.id===id)){toast('ID exists','error');return;}await window.setDoc(window.doc(window.db,'technicians',id),payload);techs.push(payload);toast('Added');}
  const pf=document.getElementById('mt-pic')?.files[0];if(pf){const r=new FileReader();r.onload=async e=>await savePic(id,e.target.result);r.readAsDataURL(pf);}
  closeModal('m-tech');renderTechs();
};
// ════════════════════════════════════════════════
//  ADMIN: PARTS
// ════════════════════════════════════════════════
function renderParts(){
  const q=(document.getElementById('ap-q')?.value||'').toLowerCase();
  const f=parts.filter(p=>!q||p.name.toLowerCase().includes(q)||p.num.toLowerCase().includes(q));
  const tbody=document.getElementById('ap-body');
  if(tbody){tbody.innerHTML=f.map(p=>`<tr>
    <td style="font-weight:600;">${sanitize(p.name)}</td><td class="mono">${p.ata||'—'}</td>
    <td class="mono" style="color:var(--amber);">${p.num}</td>
    <td><span class="bdg bblu">${p.hours}h</span></td>
    <td><div style="display:flex;gap:5px;">
      <button class="btn bo bsm" onclick="openEditPart('${p.id}')">✏️</button>
      <button class="btn bd bsm" onclick="delPart('${p.id}')">🗑</button>
    </div></td>
   </tr>`).join('')||'<tr><td colspan="5" class="empty">No parts</td></tr>';}
}
window.openAddPart=function(){editPartId=null;['mp-name','mp-ata','mp-num','mp-hours'].forEach(id=>sv(id,''));stxt('mp-title','Add Part');openModal('m-part');};
window.openEditPart=function(id){const p=parts.find(x=>x.id===id);if(!p)return;editPartId=id;sv('mp-name',p.name);sv('mp-ata',p.ata||'');sv('mp-num',p.num);sv('mp-hours',p.hours);stxt('mp-title','Edit Part');openModal('m-part');};
window.savePart=async function(){
  const name=sanitize(document.getElementById('mp-name')?.value);const num=sanitize(document.getElementById('mp-num')?.value);
  const hours=sanitizeNum(document.getElementById('mp-hours')?.value);
  if(!name||!num||!hours){toast('All fields required','error');return;}
  const p={name,num,hours,ata:sanitize(document.getElementById('mp-ata')?.value)||'',desc:name};
  if(editPartId){const idx=parts.findIndex(x=>x.id===editPartId);if(idx>-1){parts[idx]={...parts[idx],...p};await window.setDoc(window.doc(window.db,'parts',editPartId),parts[idx]);}toast('Updated');}
  else{const id=Date.now().toString();p.id=id;await window.setDoc(window.doc(window.db,'parts',id),p);parts.push(p);toast('Added');}
  closeModal('m-part');renderParts();
};
window.delPart=async function(id){if(!confirm('Delete?'))return;await window.deleteDoc(window.doc(window.db,'parts',id));parts=parts.filter(p=>p.id!==id);renderParts();toast('Deleted');};

// ════════════════════════════════════════════════
//  ADMIN: LEADERS
// ════════════════════════════════════════════════
function renderLeaders(){
  const q=(document.getElementById('al-q')?.value||'').toLowerCase();
  const f=leaders.filter(l=>!q||l.name.toLowerCase().includes(q));
  const tbody=document.getElementById('al-body');
  if(tbody){tbody.innerHTML=f.map(l=>`<tr>
    <td><div style="width:34px;height:34px;border-radius:50%;overflow:hidden;">${avatarHtml(l.id,l.name,34)}</div></td>
    <td class="mono" style="color:var(--blue);">${l.id}</td><td style="font-weight:600;">${sanitize(l.name)}</td>
    <td>${l.email||'—'}</td>
    <td><span class="bdg ${l.status==='active'?'bgr':'bgray'}">${l.status||'active'}</span></td>
    <td><div style="display:flex;gap:5px;">
      <button class="btn bo bsm" onclick="openEditLeader('${l.id}')">✏️</button>
      <button class="btn bd bsm" onclick="delLeader('${l.id}')">🗑</button>
    </div></td>
   </tr>`).join('')||'<tr><td colspan="6" class="empty">No leaders</td></tr>';}
}
window.openAddLeader=function(){editLeaderId=null;['ml-id','ml-name','ml-email'].forEach(id=>sv(id,''));sv('ml-pwd','demo');document.getElementById('ml-status').value='active';stxt('ml-title','Add Team Leader');const pm=document.getElementById('ml-pic-prev'),pp=document.getElementById('ml-pic-ph');if(pm){pm.src='';pm.style.display='none';}if(pp)pp.style.display='block';openModal('m-leader');};
window.openEditLeader=function(id){const l=leaders.find(x=>x.id===id);if(!l)return;editLeaderId=id;sv('ml-id',l.id);sv('ml-name',l.name);sv('ml-email',l.email||'');sv('ml-pwd',l.password||'demo');document.getElementById('ml-status').value=l.status||'active';stxt('ml-title','Edit Leader');const pic=getUserPhoto(id);const pm=document.getElementById('ml-pic-prev'),pp=document.getElementById('ml-pic-ph');if(pic&&pm){pm.src=pic;pm.style.display='block';}if(pp)pp.style.display=pic?'none':'block';openModal('m-leader');};
window.saveLeader=async function(){
  const id=sanitize(document.getElementById('ml-id')?.value);const name=sanitize(document.getElementById('ml-name')?.value);
  if(!id||!name){toast('ID and Name required','error');return;}
  const l={id,name,email:sanitize(document.getElementById('ml-email')?.value)||'',password:sanitize(document.getElementById('ml-pwd')?.value)||'demo',status:document.getElementById('ml-status')?.value||'active'};
  if(editLeaderId){const idx=leaders.findIndex(x=>x.id===editLeaderId);if(idx>-1){leaders[idx]=l;await window.setDoc(window.doc(window.db,'leaders',id),l);}toast('Updated');}
  else{if(leaders.find(x=>x.id===id)){toast('ID exists','error');return;}await window.setDoc(window.doc(window.db,'leaders',id),l);leaders.push(l);toast('Added');}
  const pf=document.getElementById('ml-pic')?.files[0];if(pf){const r=new FileReader();r.onload=async e=>await savePic(id,e.target.result);r.readAsDataURL(pf);}
  closeModal('m-leader');renderLeaders();
};
window.delLeader=async function(id){if(!confirm('Delete?'))return;await window.deleteDoc(window.doc(window.db,'leaders',id));leaders=leaders.filter(l=>l.id!==id);renderLeaders();toast('Deleted');};

function renderControllers(){
  const q=(document.getElementById('ac-q')?.value||'').toLowerCase();
  const f=controllers.filter(c=>!q||c.name.toLowerCase().includes(q));
  const tbody=document.getElementById('ac-body');
  if(tbody){tbody.innerHTML=f.map(c=>`<tr>
    <td><div style="width:34px;height:34px;border-radius:50%;overflow:hidden;">${avatarHtml(c.id,c.name,34)}</div></td>
    <td class="mono" style="color:var(--blue);">${c.id}</td><td style="font-weight:600;">${sanitize(c.name)}</td>
    <td>${c.email||'—'}</td>
    <td><span class="bdg ${c.status==='active'?'bgr':'bgray'}">${c.status||'active'}</span></td>
    <td><div style="display:flex;gap:5px;">
      <button class="btn bo bsm" onclick="openEditController('${c.id}')">✏️</button>
      <button class="btn bd bsm" onclick="delController('${c.id}')">🗑</button>
    </div></td>
   </tr>`).join('')||'<tr><td colspan="6" class="empty">No production controllers</td></tr>';}
}
window.openAddController=function(){editControllerId=null;['mc-id','mc-name','mc-email'].forEach(id=>sv(id,''));sv('mc-pwd','demo');document.getElementById('mc-status').value='active';stxt('mc-title','Add Production Controller');const pm=document.getElementById('mc-pic-prev'),pp=document.getElementById('mc-pic-ph');if(pm){pm.src='';pm.style.display='none';}if(pp)pp.style.display='block';openModal('m-controller');};
window.openEditController=function(id){const c=controllers.find(x=>x.id===id);if(!c)return;editControllerId=id;sv('mc-id',c.id);sv('mc-name',c.name);sv('mc-email',c.email||'');sv('mc-pwd',c.password||'demo');document.getElementById('mc-status').value=c.status||'active';stxt('mc-title','Edit Production Controller');const pic=getUserPhoto(id);const pm=document.getElementById('mc-pic-prev'),pp=document.getElementById('mc-pic-ph');if(pic&&pm){pm.src=pic;pm.style.display='block';}if(pp)pp.style.display=pic?'none':'block';openModal('m-controller');};
window.saveController=async function(){
  const id=sanitize(document.getElementById('mc-id')?.value);const name=sanitize(document.getElementById('mc-name')?.value);
  if(!id||!name){toast('ID and Name required','error');return;}
  const c={id,name,email:sanitize(document.getElementById('mc-email')?.value)||'',password:sanitize(document.getElementById('mc-pwd')?.value)||'demo',status:document.getElementById('mc-status')?.value||'active'};
  if(editControllerId){const idx=controllers.findIndex(x=>x.id===editControllerId);if(idx>-1){controllers[idx]=c;await window.setDoc(window.doc(window.db,'controllers',id),c);}toast('Updated');}
  else{if(controllers.find(x=>x.id===id)){toast('ID exists','error');return;}await window.setDoc(window.doc(window.db,'controllers',id),c);controllers.push(c);toast('Added');}
  const pf=document.getElementById('mc-pic')?.files[0];if(pf){const r=new FileReader();r.onload=async e=>await savePic(id,e.target.result);r.readAsDataURL(pf);}
  closeModal('m-controller');renderControllers();
};
window.delController=async function(id){if(!confirm('Delete?'))return;await window.deleteDoc(window.doc(window.db,'controllers',id));controllers=controllers.filter(c=>c.id!==id);renderControllers();toast('Deleted');};


// ════════════════════════════════════════════════
//  DEV: PASSWORD MANAGEMENT
// ════════════════════════════════════════════════
function fillRpUsers(){
  const t=document.getElementById('rp-type')?.value;const sel=document.getElementById('rp-user');if(!sel)return;
  const list=t==='tech'?techs:t==='lead'?leaders:controllers;
  sel.innerHTML=list.map(u=>`<option value="${u.id}">${u.name} (${u.id})</option>`).join('');
}
window.fillRpUsers=fillRpUsers;
window.doResetPw=async function(){
  const t=document.getElementById('rp-type')?.value;const uid=document.getElementById('rp-user')?.value;const npw=sanitize(document.getElementById('rp-new')?.value);
  if(!uid||!npw){toast('Select user and enter new password','error');return;}
  if(t==='tech'){const idx=techs.findIndex(x=>x.id===uid);if(idx>-1){techs[idx].password=npw;await window.setDoc(window.doc(window.db,'technicians',uid),techs[idx]);toast('Password reset for '+techs[idx].name);}}
  else if(t==='lead'){const idx=leaders.findIndex(x=>x.id===uid);if(idx>-1){leaders[idx].password=npw;await window.setDoc(window.doc(window.db,'leaders',uid),leaders[idx]);toast('Password reset for '+leaders[idx].name);}}
  else{const idx=controllers.findIndex(x=>x.id===uid);if(idx>-1){controllers[idx].password=npw;await window.setDoc(window.doc(window.db,'controllers',uid),controllers[idx]);toast('Password reset for '+controllers[idx].name);}}
  sv('rp-new','');
};
window.changeDevPw=async function(){
  const npw=sanitize(document.getElementById('dev-new-pw')?.value);
  if(!npw||npw.length<4){toast('Enter a valid password (min 4 chars)','error');return;}
  settings.passwords={...settings.passwords,dev:npw};
  await persistSettings();sv('dev-new-pw','');toast('Developer password updated');
};
function renderPwMgmt(){
  fillRpUsers();
  const el=document.getElementById('pw-all-list');if(!el)return;
  const allUsers=[...techs.map(t=>({...t,role:'Technician'})),...leaders.map(l=>({...l,role:'Team Leader'})),...controllers.map(c=>({...c,role:'Production Controller'})),{id:'DEV001',name:'Developer Admin',role:'Developer',status:'active'}];
  el.innerHTML=allUsers.map(u=>`<div class="pw-reset-user">
    <div style="display:flex;align-items:center;gap:9px;">
      <div style="width:28px;height:28px;border-radius:50%;overflow:hidden;">${u.role!=='Developer'?avatarHtml(u.id,u.name,28):'<div class="av-i" style="width:28px;height:28px;font-size:10px;background:#8b5cf6;color:#fff;">DA</div>'}</div>
      <div><div style="font-size:13px;font-weight:600;">${sanitize(u.name)}</div><div style="font-size:11px;color:var(--tx3);">${u.id} · ${u.role}</div></div>
    </div>
    <span class="bdg ${u.status==='active'?'bgr':'bgray'}">${u.status||'active'}</span>
  </div>`).join('');
}

// ════════════════════════════════════════════════
//  SYSTEM
// ════════════════════════════════════════════════
function renderSystem(){
  sv('sys-def',settings.defaultMonthlyTarget||160);
  const el=document.getElementById('sys-info');
  if(el)el.innerHTML=`<div class="srow"><div><div class="srl-t">Total Entries</div></div><span class="bdg bblu">${entries.length}</span></div><div class="srow"><div><div class="srl-t">Technicians</div></div><span class="bdg bgr">${techs.length}</span></div><div class="srow"><div><div class="srl-t">Parts</div></div><span class="bdg bamb">${parts.length}</span></div><div class="srow"><div><div class="srl-t">Assignments</div></div><span class="bdg bcyn">${assignments.length}</span></div>`;
  renderLB();
}
window.saveDefTgt=async function(){settings.defaultMonthlyTarget=parseInt(document.getElementById('sys-def')?.value)||160;await persistSettings();toast('Saved');};
window.exportBackup=function(){dlFile(JSON.stringify({techs,parts,leaders,controllers,settings,entries,assignments,profilePics,exportedAt:new Date().toISOString()},null,2),'protrack_backup_'+todayEAT()+'.json','application/json');toast('Backup exported');};
window.importBackup=function(input){const f=input.files[0];if(!f)return;const r=new FileReader();r.onload=async e=>{try{const d=JSON.parse(e.target.result);if(d.techs)for(const t of d.techs)await window.setDoc(window.doc(window.db,'technicians',t.id),t);if(d.parts)for(const p of d.parts)await window.setDoc(window.doc(window.db,'parts',p.id),p);if(d.leaders)for(const l of d.leaders)await window.setDoc(window.doc(window.db,'leaders',l.id),l);if(d.controllers)for(const c of d.controllers)await window.setDoc(window.doc(window.db,'controllers',c.id),c);if(d.entries)for(const e of d.entries)await window.addDoc(window.collection(window.db,'entries'),e);if(d.settings){const s=await window.getDocs(window.collection(window.db,'settings'));if(!s.empty)await window.setDoc(window.doc(window.db,'settings',s.docs[0].id),d.settings);else await window.setDoc(window.doc(window.db,'settings','global'),d.settings);}if(d.profilePics)for(const[uid,data]of Object.entries(d.profilePics))await savePic(uid,data);toast('Restored. Reloading...');setTimeout(()=>location.reload(),1000);}catch(err){toast('Invalid backup','error');}};r.readAsText(f);};
window.factoryReset=async function(){if(!confirm('⚠️ FULL RESET?'))return;for(const c of['technicians','parts','leaders','controllers','entries','settings','assignments','profilePics']){const s=await window.getDocs(window.collection(window.db,c));for(const d of s.docs)await window.deleteDoc(window.doc(window.db,c,d.id));}toast('Reset complete. Reloading...');setTimeout(()=>location.reload(),1000);};

// ════════════════════════════════════════════════
//  PASSWORD CHANGE (current user)
// ════════════════════════════════════════════════
window.changeMyPw=async function(){
  const old=document.getElementById('pwd-old')?.value;const nw=document.getElementById('pwd-new')?.value;const con=document.getElementById('pwd-con')?.value;
  if(!old||!nw){toast('Fill all fields','error');return;}
  if(nw!==con){toast('Passwords do not match','error');return;}
  if(nw.length<4){toast('Min 4 characters','error');return;}
  if(CR==='tech'){const idx=techs.findIndex(t=>t.id===CU.id);if(techs[idx]?.password!==old){toast('Wrong current password','error');return;}techs[idx].password=nw;await window.setDoc(window.doc(window.db,'technicians',CU.id),techs[idx]);CU.password=nw;}
  else if(CR==='lead'){const idx=leaders.findIndex(l=>l.id===CU.id);if(leaders[idx]?.password!==old){toast('Wrong password','error');return;}leaders[idx].password=nw;await window.setDoc(window.doc(window.db,'leaders',CU.id),leaders[idx]);}
  else if(CR==='ctrl'){const idx=controllers.findIndex(c=>c.id===CU.id);if(controllers[idx]?.password!==old){toast('Wrong password','error');return;}controllers[idx].password=nw;await window.setDoc(window.doc(window.db,'controllers',CU.id),controllers[idx]);}
  else if(CR==='dev'){if((settings.passwords?.dev||'dev123')!==old){toast('Wrong password','error');return;}settings.passwords={...settings.passwords,dev:nw};await persistSettings();}
  closeModal('m-password');['pwd-old','pwd-new','pwd-con'].forEach(id=>sv(id,''));toast('Password changed');
};

// ════════════════════════════════════════════════
//  FORGOT / RECOVERY
// ════════════════════════════════════════════════
function openForgot(){openModal('m-forgot');}
window.openForgot=openForgot;
window.useRecoveryCode=async function(){
  const code=document.getElementById('rc-code')?.value.trim();const npw=document.getElementById('rc-newpw')?.value;
  if(code!==DEV_RECOVERY_CODE){toast('Invalid recovery code','error');return;}
  if(!npw||npw.length<4){toast('Enter new password (min 4 chars)','error');return;}
  settings.passwords={...settings.passwords,dev:npw};await persistSettings();
  sv('rc-code','');sv('rc-newpw','');closeModal('m-forgot');
  toast('Developer password reset successfully. You may now log in.');
};
window.saveDefPwds=async function(){
  const tp=sanitize(document.getElementById('def-tech-pwd')?.value);const lp=sanitize(document.getElementById('def-lead-pwd')?.value);
  if(tp)settings.passwords={...settings.passwords,tech:tp};if(lp)settings.passwords={...settings.passwords,lead:lp};
  await persistSettings();closeModal('m-globalpwd');toast('Default passwords updated');
};

window.openMonthTgtModal=function(){const sel=document.getElementById('tgt-sel');if(!sel)return;sel.innerHTML='<option value="">Select</option>'+techs.map(t=>`<option value="${t.id}">${t.name} (${t.monthlyTarget||160}h)</option>`).join('');sv('tgt-val','');openModal('m-monthtgt');};
window.saveMonthTgt=async function(){const tid=document.getElementById('tgt-sel')?.value;const val=parseFloat(document.getElementById('tgt-val')?.value);if(!tid||!val){toast('Select tech and enter value','error');return;}const idx=techs.findIndex(t=>t.id===tid);if(idx>-1){techs[idx].monthlyTarget=val;await window.setDoc(window.doc(window.db,'technicians',tid),techs[idx]);}closeModal('m-monthtgt');toast('Target updated');if(CR==='lead')renderDashboard();else renderTechs();};

// ════════════════════════════════════════════════
//  IMPORT
// ════════════════════════════════════════════════
window.handleTechImport=function(input){const __IGN_KEY='pt-tech-import-ignore-always';let __ign=new Set();try{__ign=new Set(JSON.parse(localStorage.getItem(__IGN_KEY)||'[]'));}catch(e){__ign=new Set();}const f=input.files[0];if(!f)return;const r=new FileReader();r.onload=async e=>{try{lastImportedTechs=[];const wb=XLSX.read(e.target.result,{type:'array'});const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);for(const row of rows){if(row.ID&&row.Name){const id=sanitize(row.ID.toString());if(__ign.has(id))continue;if(techs.find(t=>t.id===id)){const decision=await askImportChoice({title:'Duplicate Technician ID',sub:'Import Technicians',msg:'Duplicate Employee ID: '+id,buttons:[{label:'Skip Once',value:'skip',cls:'bo'},{label:'Ignore Always',value:'ignore',cls:'bo'},{label:'Cancel Import',value:'cancel',cls:'bd'}]});if(decision===null||decision==='cancel')break;if(decision==='ignore'){__ign.add(id);try{localStorage.setItem(__IGN_KEY,JSON.stringify(Array.from(__ign)));}catch(e){}}continue;}if(!techs.find(t=>t.id===id)){const nt={id,name:sanitize(row.Name.toString()),monthlyTarget:parseFloat(row.MonthlyTarget)||settings.defaultMonthlyTarget||160,status:'active',password:settings.passwords?.tech||'demo',initials:row.Name.toString().slice(0,2).toUpperCase(),color:'#3b82f6'};await window.setDoc(window.doc(window.db,'technicians',id),nt);techs.push(nt);lastImportedTechs.push(nt);}}}renderTechs();toast('Import complete');closeModal('m-import-tech');renderImportSummary('tech');}catch(err){toast('Import failed','error');}};r.readAsArrayBuffer(f);};
window.handlePartImport=function(input){const f=input.files[0];if(!f)return;const r=new FileReader();r.onload=async e=>{try{lastImportedParts=[];const wb=XLSX.read(e.target.result,{type:'array'});const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);for(const row of rows){if(row.Name&&row.Number){const np={id:Date.now().toString()+Math.random(),name:sanitize(row.Name.toString()),num:sanitize(row.Number.toString()),hours:parseFloat(row.Hours)||1,ata:sanitize(row.ATA||''),desc:sanitize(row.Description||row.Name.toString())};await window.setDoc(window.doc(window.db,'parts',np.id),np);parts.push(np);lastImportedParts.push(np);}}renderParts();toast('Import complete');closeModal('m-import-part');renderImportSummary('part');}catch(err){toast('Import failed','error');}};r.readAsArrayBuffer(f);};

// ════════════════════════════════════════════════
//  EXPORT HELPERS
// ════════════════════════════════════════════════

// ════════════════════════════════════════════════
// DEV/LEADER: PRODUCTION ENTRY IMPORT
// Date comes from Date Completed. Missing part/employee rows get Add + Try Import buttons.
// ════════════════════════════════════════════════
let productionImportResults=[];
let productionImportPendingRows={};
let productionImportKeySeq=0;
loadProductionImportState();
function getImportValue(row, keys){
  if(!row||!keys)return'';const lookup={};Object.keys(row).forEach(k=>lookup[String(k).trim().toLowerCase()]=row[k]);
  for(const k of keys){const v=lookup[String(k).trim().toLowerCase()];if(v!==undefined&&v!==null&&String(v).trim()!=='')return v;}return'';
}
function normalizeImportDate(value){
  try{if(value instanceof Date&&!isNaN(value))return value.toISOString().slice(0,10);if(typeof value==='number'&&isFinite(value)){const d=new Date(Math.round((value-25569)*86400*1000));if(!isNaN(d))return d.toISOString().slice(0,10);}const s=String(value??'').trim();if(!s)return'';const d=new Date(s);if(!isNaN(d))return d.toISOString().slice(0,10);const m=s.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);if(m)return`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;}catch(e){}return'';
}
function splitImportIds(value){const raw=String(value??'').trim();if(!raw)return[];const seen=new Set();return raw.split(/[,;\/\s\n\r\t]+/).map(x=>String(x).trim()).filter(x=>x&&!['0','-','null','undefined','nan','n/a','na'].includes(x.toLowerCase())).filter(x=>{if(seen.has(x))return false;seen.add(x);return true;});}
function normalizeImportStatus(value){const s=String(value??'').trim().toUpperCase();if(s==='RFI')return'completed';if(s==='SCRAP')return'scrap';if(s==='CMPLT AS U/S'||s.includes('CMPLT')||s.includes('U/S'))return'under_supervision_skip';return'unsupported';}
function normalizePartNumberForImport(v){return String(v??'').trim().toUpperCase().replace(/[\s\-—–_]+/g,'').replace(/[^A-Z0-9]/g,'');}
function findPartByNumber(partNumber){const target=normalizePartNumberForImport(partNumber);if(!target)return null;return parts.find(p=>normalizePartNumberForImport(p.num||p.partNumber||p.id)===target)||null;}
function isFooterImportRow(row){const wp=String(getImportValue(row,['WP ID','WPID','Task Code','TaskCode'])??'').trim();if(!wp)return true;const low=wp.toLowerCase();return low.includes('average')||low.includes('total count')||low.includes('total est')||low.includes('total act')||low.startsWith('total ');}
async function chooseImportIds(ids,role,taskCode){
  if(!ids||!ids.length) return [];
  if(ids.length===1) return ids;
  const picked = await askImportMultiIds({
    title:'Multiple IDs Found',
    sub:'Import Production Entries',
    msg:`Multiple ${role} IDs found for WP ${taskCode}. Select one or more IDs:`,
    ids
  });
  return picked; // null means cancel import, [] means skip
}
IDs found for WP ${taskCode}:\n${ids.join(', ')}\n\nEnter all, one ID, multiple IDs separated by comma, or skip`);if(ans===null)return null;const v=String(ans).trim();if(!v)continue;if(v.toLowerCase()==='skip')return[];if(v.toLowerCase()==='all')return ids;const selected=splitImportIds(v).filter(x=>ids.includes(x));if(selected.length)return selected;alert('Invalid selection. Use all, skip, or IDs from the list.');}}
function importSafe(v){return String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' ');}
function addImportResult(r){productionImportResults.push(r);saveProductionImportState();}
function openImportAddPart(partNumber='',partName=''){openAddPart();setTimeout(()=>{sv('mp-num',String(partNumber||''));sv('mp-name',String(partName||''));sv('mp-hours','');sv('mp-ata','');},80);}
function openImportAddEmployee(id='',role='Technician'){openAddTech();setTimeout(()=>{sv('mt-id',String(id||''));sv('mt-name','Imported Employee '+String(id||''));sv('mt-target',settings.defaultMonthlyTarget||160);sv('mt-pwd',settings.passwords?.tech||'demo');const st=document.getElementById('mt-status');if(st)st.value='active';const ra=document.getElementById('mt-role-access');if(ra)ra.value=(role==='Technician')?'tech':'tech_insp';const us=document.getElementById('mt-unsup');if(us)us.checked=false;},80);}
function makeImportPendingKey(row,rowIndex){const key='p'+(++productionImportKeySeq);productionImportPendingRows[key]={row,rowIndex};saveProductionImportState();return key;}
function addImportMissingPart(partNumber,partName,rowNum,taskCode,row,rowIndex,date){const key=makeImportPendingKey(row,rowIndex);addImportResult({key,row:rowNum,date:date||'—',employee:'—',role:'—',taskCode,partNumber,hours:'—',status:'Part not found. Add part, enter correct hours, save, then click Try Import.',type:'warn',action:'part',partNumber,partName});}
async async function resolveImportEmployee(id,role,rowNum,taskCode,partNumber,row,rowIndex,date){const tech=techs.find(t=>String(t.id).trim()===String(id).trim());if(tech)return tech;if(empImportIgnoreAlways.has(String(id).trim()))return null;const decision=await askImportChoice({title:'Employee Not Found',sub:'Import Production Entries',msg:`Employee ID ${id} was not found for ${role}.`,buttons:[{label:'Add Employee',value:'add',cls:'bp'},{label:'Ignore Once',value:'ignore',cls:'bo'},{label:'Ignore Always',value:'ignoreAlways',cls:'bo'},{label:'Cancel Import',value:'cancel',cls:'bd'}]});if(decision===null||decision==='cancel')return'CANCEL_IMPORT';if(decision==='ignoreAlways'){empImportIgnoreAlways.add(String(id).trim());try{localStorage.setItem(EMP_IMPORT_IGNORE_KEY,JSON.stringify(Array.from(empImportIgnoreAlways)));}catch(e){}return null;}if(decision==='ignore')return null;if(decision==='add'){const key=makeImportPendingKey(row,rowIndex);openImportAddEmployee(id,role);addImportResult({key,row:rowNum,date:date||'—',employee:id,role,taskCode,partNumber,hours:'—',status:'Employee not found. Add employee, save, then click Try Import.',type:'warn',action:'tech',employeeId:id,employeeRole:role});return'ADD_REQUIRED';}return null;}
function buildImportEntriesForRow(row,rowIndex){
  const rowNum=rowIndex+2;if(isFooterImportRow(row))return[];
  const taskCode=String(getImportValue(row,['WP ID','WPID','Task Code','TaskCode'])||'').trim().toUpperCase();
  const partName=String(getImportValue(row,['PART NAME','Part Name','Description'])||'').trim();
  const partNumber=String(getImportValue(row,['OEM P/N','OEM PN','OEM_PN','Part Number','P/N'])||'').trim();
  const statusVal=getImportValue(row,['Status','STATUS']);const jobType=normalizeImportStatus(statusVal);
  const date=normalizeImportDate(getImportValue(row,['Date Completed','DATE COMPLETED','Completed Date']));
  if(!taskCode)return[];
  if(!date){addImportResult({row:rowNum,date:'—',employee:'—',role:'—',taskCode,partNumber,hours:'—',status:'Error: Date Completed is missing/invalid',type:'error'});return[];}
  if(jobType==='under_supervision_skip'||jobType==='unsupported')return[]; // ignored totally: no preview row
  const part=findPartByNumber(partNumber);if(!part){addImportMissingPart(partNumber,partName,rowNum,taskCode,row,rowIndex,date);return[];}
  const roleFields=[{role:'Technician',keys:['TECH_ID','TECH ID','Tech ID','Technician ID']},{role:'Under Supervision',keys:['UNDER_SUP','UNDER SUP','UNDER-SUP','UNDERSUPERVISION','UNDER SUPERVISION', 'UNDER_SUPERVISION', 'UNDER SUPERVISION ID', 'UNDER SUPERVISION_ID', 'UNDER SUP ID', 'UNDER_SUP_ID', 'UNDER SUPERVISION TECH', 'UNDER_SUP_TECH']},{role:'Inspector',keys:['Released By','RELEASED BY','ReleasedBy']},{role:'Preliminary Inspector',keys:['PRELIM_INSP','PRELIM INSP','PRELIM-INSP','PRELIMINARY ROLE','PRELIMINARY_ROLE']}];
  const out=[];
  for(const rf of roleFields){let ids=splitImportIds(getImportValue(row,rf.keys));ids=chooseImportIds(ids,rf.role,taskCode);if(ids===null)return'CANCEL_IMPORT';for(const id of ids){const tech=await resolveImportEmployee(id,rf.role,rowNum,taskCode,part.num,row,rowIndex,date);if(tech==='CANCEL_IMPORT')return'CANCEL_IMPORT';if(!tech||tech==='ADD_REQUIRED')continue;const hrs=calcPoolHrs(part,rf.role,taskCode);out.push({techId:tech.id,techName:tech.name,pname:part.name,pnum:part.num,taskCode,jobRole:rf.role,jobType,time:date,hours:hrs,stdHours:part.hours,isInspector:rf.role==='Inspector'||rf.role==='Preliminary Inspector',ata:part.ata||'',desc:part.name,scrapHrs:jobType==='scrap'&&rf.role==='Inspector'?(settings.scrapDefaultHrs||2):null,approvalStatus:'pending',submittedBy:CU?.name||'Import User',submittedByRole:CR||'import',imported:true,importedSource:'ComponentTATStatus',importedAt:new Date().toISOString(),_preview:{row:rowNum,date,employee:`${tech.name} (${tech.id})`,role:rf.role,taskCode,partNumber:part.num,hours:hrs}});}}
  return out;
}
async function saveImportEntries(built,rowIndexForErr=0){let saved=0,errors=0;if(!built||!built.length)return{saved,errors};for(const entry of built){try{const prev=entry._preview||{};delete entry._preview;if(isDuplicateEntry(entry)){continue;}const ref=await window.addDoc(window.collection(window.db,'entries'),entry);entry.id=ref.id;entries.unshift(entry);saved++;addImportResult({...prev,status:'Saved as pending',type:'success'});}catch(err){errors++;addImportResult({row:rowIndexForErr+2,date:entry.time||'—',employee:entry.techId||'—',role:entry.jobRole||'—',taskCode:entry.taskCode||'—',partNumber:entry.pnum||'—',hours:'—',status:'Save error: '+(err.message||err),type:'error'});}}return{saved,errors};}
async function retryProductionImportRow(key){const p=productionImportPendingRows[key];if(!p){toast('Retry data not found','error');return;}productionImportResults=productionImportResults.filter(r=>r.key!==key);saveProductionImportState();const built=buildImportEntriesForRow(p.row,p.rowIndex);if(built==='CANCEL_IMPORT'){toast('Retry cancelled','warn');renderProductionImportPreview();return;}const res=await saveImportEntries(built,p.rowIndex);if(res.saved>0)delete productionImportPendingRows[key];saveProductionImportState();renderProductionImportPreview();if(typeof renderAllEntries==='function')renderAllEntries();if(typeof renderTG==='function')renderTG();if(typeof renderReports==='function')renderReports();if(typeof renderLB==='function')renderLB();toast(`Try import complete: ${res.saved} saved, ${res.errors} errors`);}
function renderProductionImportPreview(results=productionImportResults){const body=document.getElementById('prod-import-body');if(!body)return;body.dataset.hasImport='1';if(!results.length){body.innerHTML='<tr><td colspan="8" class="empty">No import results</td></tr>';return;}const cls=t=>t==='success'?'bgr':t==='error'?'bred':t==='duplicate'?'bgray':t==='info'?'bblu':'bamb';body.innerHTML=results.map(r=>{let action='';if(r.action==='part')action=` <button class="btn bp bsm" onclick="openImportAddPart('${importSafe(r.partNumber)}','${importSafe(r.partName)}')">+ Add Part</button> <button class="btn bg_ bsm" onclick="retryProductionImportRow('${r.key}')">↻ Try Import</button>`;if(r.action==='tech')action=` <button class="btn bp bsm" onclick="openImportAddEmployee('${importSafe(r.employeeId)}','${importSafe(r.employeeRole)}')">+ Add Employee</button> <button class="btn bg_ bsm" onclick="retryProductionImportRow('${r.key}')">↻ Try Import</button>`;return`<tr><td class="mono">${sanitize(String(r.row??''))}</td><td class="mono">${sanitize(String(r.date??'—'))}</td><td>${sanitize(String(r.employee??'—'))}</td><td>${sanitize(String(r.role??'—'))}</td><td class="mono" style="color:var(--blue);">${sanitize(String(r.taskCode??'—'))}</td><td class="mono" style="color:var(--amber);">${sanitize(String(r.partNumber??'—'))}</td><td class="mono">${r.hours!==undefined&&r.hours!=='—'?sanitizeNum(r.hours).toFixed(2)+'h':'—'}</td><td><span class="bdg ${cls(r.type)}">${sanitize(String(r.status??''))}</span>${action}</td></tr>`;}).join('');}
function clearProductionImportPreview(){productionImportResults=[];productionImportPendingRows={};productionImportKeySeq=0;saveProductionImportState();const body=document.getElementById('prod-import-body');if(body){delete body.dataset.hasImport;body.innerHTML='<tr><td colspan="8" class="empty">No import yet</td></tr>';}}
function renderProductionImportPage(){const body=document.getElementById('prod-import-body');if(!body)return;if(productionImportResults.length)renderProductionImportPreview();else if(!body.dataset.hasImport)body.innerHTML='<tr><td colspan="8" class="empty">No import yet</td></tr>';}
async function handleProductionImport(input){const file=input?.files?.[0];if(!file)return;let saved=0,skipped=0,errors=0;showLoading('Importing production Excel...');try{const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array'});const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});for(let i=0;i<rows.length;i++){const row=rows[i];if(isFooterImportRow(row))continue;const built=buildImportEntriesForRow(row,i);if(built==='CANCEL_IMPORT'){break;}if(!built||!built.length){skipped++;continue;}const res=await saveImportEntries(built,i);saved+=res.saved;errors+=res.errors;}}catch(err){errors++;addImportResult({row:'—',date:'—',employee:'—',role:'—',taskCode:'—',partNumber:'—',hours:'—',status:'Import failed: '+(err.message||err),type:'error'});}finally{renderProductionImportPreview();if(typeof renderAllEntries==='function')renderAllEntries();if(typeof renderTG==='function')renderTG();if(typeof renderReports==='function')renderReports();if(typeof renderLB==='function')renderLB();toast(`Production import complete: ${saved} saved, ${skipped} ignored, ${errors} errors`);if(input)input.value='';hideLoading();}}
window.handleProductionImport=handleProductionImport;window.renderProductionImportPage=renderProductionImportPage;window.renderProductionImportPreview=renderProductionImportPreview;window.clearProductionImportPreview=clearProductionImportPreview;window.openImportAddPart=openImportAddPart;window.openImportAddEmployee=openImportAddEmployee;window.retryProductionImportRow=retryProductionImportRow;

function dlFile(c,fn,t){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([c],{type:t}));a.download=fn;a.click();URL.revokeObjectURL(a.href);}
window.exportMine=function(){
  const range=getMyStatsRange();
  const statusFilter=(document.getElementById('ms-status-filter')?.value||'all').toLowerCase();
  let csv='Date(EAT),TaskCode,Role,Type,Part,ATA,PartNum,Hrs(÷peers),Status\n';
  entries
    .filter(e=>e.techId===CU.id&&dateInRange(e.time,range.start,range.end)&&(statusFilter==='all'||getEntryStatus(e)===statusFilter))
    .forEach(e=>{const d=getDividedHours(e,entries);csv+=`"${fmtEAT(e.time,'date')}","${e.taskCode||''}","${e.jobRole||''}","${e.jobType||'completed'}","${e.pname}","${e.ata||''}","${e.pnum}",${d.toFixed(3)},"${getEntryStatus(e)}"\n`;});
  dlFile(csv,'my_production_'+todayEAT()+'.csv','text/csv');toast('Exported');
};
window.exportAllEntries=function(){let csv='Date(EAT),Tech,TechID,TaskCode,Role,Type,Part,ATA,PartNum,Hrs(÷peers),HoursType\n';entries.forEach(e=>{const d=getDividedHours(e,entries),ht=isSDT(e)?'SDT':'NOT_SDT';csv+=`"${fmtEAT(e.time,'date')}","${e.techName}","${e.techId}","${e.taskCode||''}","${e.jobRole||''}","${e.jobType||'completed'}","${e.pname}","${e.ata||''}","${e.pnum}",${d.toFixed(3)},${ht}\n`;});dlFile(csv,'all_entries_'+todayEAT()+'.csv','text/csv');toast('Exported');};

// ════════════════════════════════════════════════
//  MODAL
// ════════════════════════════════════════════════
function openModal(id){const el=document.getElementById(id);if(el)el.classList.add('open');}
function closeModal(id){const el=document.getElementById(id);if(el)el.classList.remove('open');}
document.querySelectorAll('.mbg').forEach(bg=>bg.addEventListener('click',e=>{if(e.target===bg)bg.classList.remove('open');}));
window.openModal=openModal;window.closeModal=closeModal;

// ════════════════════════════════════════════════
//  LEADER: TECHNICIAN ENTRY
// ════════════════════════════════════════════════
let leJobType='completed',leJobRole='Technician',leJobRoleIdx=0,lePendingEntry=null;
function populateLeaderEntryTechs(){
  const sel=document.getElementById('le-tech-sel');if(!sel)return;
  const cur=sel.value;
  sel.innerHTML='<option value="">— Select Technician —</option>'+techs.filter(t=>t.status==='active').map(t=>`<option value="${t.id}">${t.name} (${t.id})</option>`).join('');
  if(cur)sel.value=cur;
  populateLeaderPartSel();
}
function onLeaderTechSel(){
  const techId=document.getElementById('le-tech-sel')?.value;
  const tech=techs.find(t=>t.id===techId);
  if(tech){applyRoleAccessToButtons('le',tech);ensureAllowedRole('le',tech);if(leJobType==='scrap'){forcePickRole('le','Inspector',2);}}
  refreshLeAllocHrs();
}
function setLeJobType(type){
  leJobType=type;
  document.getElementById('le-cs-comp').className='cs-opt'+(type==='completed'?' sel-comp':'');
  document.getElementById('le-cs-scrap').className='cs-opt'+(type==='scrap'?' sel-scrap':'');
  const tech=techs.find(t=>t.id===document.getElementById('le-tech-sel')?.value);
  if(tech)applyRoleAccessToButtons('le',tech);
  if(type==='scrap'){forcePickRole('le','Inspector',2);const shi=document.getElementById('le-scrap-hrs');if(shi)shi.value=String(settings.scrapDefaultHrs||2);} else if(tech){ensureAllowedRole('le',tech);}
  const shr=document.getElementById('le-scrap-hrs-row');if(shr){if(type==='scrap')shr.classList.add('show');else shr.classList.remove('show');}
  refreshLeAllocHrs();
}
window.setLeJobType=setLeJobType;
function pickLeJobRole(role,idx,force=false){
  const tech=techs.find(t=>t.id===document.getElementById('le-tech-sel')?.value);
  if(!force&&tech&&!isRoleAllowedForTech(tech,role)&&!(leJobType==='scrap'&&role==='Inspector')){
    toast('Role not allowed for this technician','error');
    return;
  }
  leJobRole=role;leJobRoleIdx=idx;
  for(let i=0;i<4;i++){const el=document.getElementById('le-jr'+i);if(!el)continue;const d=el.classList.contains('disabled');el.className='jro'+(d?' disabled':'');}
  const el=document.getElementById('le-jr'+idx);if(el)el.classList.add(ROLE_SEL[idx]);
  refreshLeAllocHrs();
}
window.pickLeJobRole=pickLeJobRole;
function refreshLeAllocHrs(){
  const partId=document.getElementById('le-part-sel')?.value;
  const hoursEl=document.getElementById('le-hours');
  const hoursRow=document.getElementById('le-hours-row');
  const lbl=document.getElementById('le-hrs-lbl');
  if(!partId){
    if(hoursEl)hoursEl.value='';
    if(hoursRow)hoursRow.style.display='';
    if(lbl)lbl.textContent='Allocated Hours';
    return;
  }
  const part=findPartById(partId);if(!part)return;
  const taskCode=sanitize(document.getElementById('le-taskcode')?.value).toUpperCase();
  const pool=calcPoolHrs(part,leJobRole,taskCode);
  const insp=isInspRole(leJobRole);
  if(leJobType==='scrap'){if(hoursRow)hoursRow.style.display='none';if(hoursEl)hoursEl.value=pool;return;}
  if(hoursRow)hoursRow.style.display='';
  if(hoursEl){hoursEl.value=pool;hoursEl.style.borderColor=insp?'rgba(139,92,246,.5)':'';}
  if(lbl){if(insp)lbl.textContent=`${leJobRole} Fixed Hrs (separate from SDT)`;else lbl.textContent=`Pool Hrs for ${leJobRole} (÷peer count at display)`;}
}
window.refreshLeAllocHrs=refreshLeAllocHrs;
function onLePartSel(){
  let part=getCachedOrSelectedPart('le');
  if(!part){
    part=resolvePartSelection('le', document.getElementById('le-part-search')?.value);
  }
  if(!part){
    cacheSelectedPart('le',null);
    sv('le-desc','');sv('le-ata','');sv('le-pnum','');sv('le-hours','');refreshLeAllocHrs();return;
  }
  applyPartSelection('le', part);
  refreshLeAllocHrs();
}
window.onLePartSel=onLePartSel;
function renderLeaderEntry(){
  const today=todayEAT();
  const tbody=document.getElementById('le-today-list');
  if(tbody){
    const tod=entries.filter(e=>e.time?.startsWith(today)).sort((a,b)=>{
      const r=x=>getEntryStatus(x)==='pending'?0:getEntryStatus(x)==='rejected'?2:1;
      return r(a)-r(b)||new Date(b.time||0)-new Date(a.time||0);
    });
    tbody.innerHTML=tod.length?tod.map(e=>{
      const div=getDividedHours(e,entries),insp=!isSDT(e);
      const rc=ROLE_COLORS[ROLES.indexOf(e.jobRole||'Technician')]||'var(--blue)';
      const st=getEntryStatusBadge(e);
      const act=canManageEntriesUI()?`<div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;">
          <button class="btn bgr bsm" style="padding:4px 8px;" onclick="approveEntryById('${e.id}')">✓ Accept</button>
          <button class="btn bd bsm" style="padding:4px 8px;" onclick="rejectEntryById('${e.id}')">✕ Reject</button>
        </div>`:'—';
      return`<tr style="${getEntryStatus(e)==='rejected'?'opacity:.65;background:rgba(244,63,94,.08);border-left:3px solid var(--rose);':''}"><td style="font-size:11px;">${e.techName}</td>
        <td class="mono" style="color:var(--blue);font-weight:600;">${e.taskCode||'—'}</td>
        <td style="font-size:10px;font-weight:700;color:${rc}">${(e.jobRole||'Tech').split(' ')[0]}</td>
        <td style="font-size:11px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.pname}</td>
        <td class="mono">${div.toFixed(2)}h${insp?' <span class="not-sdt">!</span>':''}</td>
        <td>${st}</td>
        <td><span class="${e.jobType==='scrap'?'cp-scrap':'cp-comp'}">${e.jobType==='scrap'?'Scrap':'Done'}</span></td>
        <td>${act}</td>
       </tr>`;
    }).join(''):'<tr><td colspan="8" class="empty">No leader entries today</td></tr>';
  }
  if(!document.getElementById('le-time')?.value)sv('le-time',todayEAT());
  renderLB();
}
function openLeReviewModal(){
  const techId=document.getElementById('le-tech-sel')?.value;
  const taskCode=sanitize(document.getElementById('le-taskcode')?.value).toUpperCase();
  if(!techId){toast('Select a technician','error');return;}
  let part=getCachedOrSelectedPart('le');
  if(!part){
    part=resolvePartSelection('le', document.getElementById('le-part-search')?.value);
    if(part) applyPartSelection('le', part);
  }
  if(!part){toast('Select a part','error');return;}
  if(!taskCode){toast('Enter a Task Code','error');return;}
  const tech=techs.find(t=>t.id===techId);if(!tech)return;
  const pool=calcPoolHrs(part,leJobRole,taskCode);
  const insp=isInspRole(leJobRole);
  const scrapHrs=leJobType==='scrap'?gv('le-scrap-hrs')||2:null;
  lePendingEntry={
    techId:tech.id,techName:tech.name,pname:part.name,pnum:part.num,
    taskCode,jobRole:leJobRole,jobType:leJobType,
    time:document.getElementById('le-time')?.value||todayEAT(),
    hours:pool,stdHours:part.hours,
    isInspector:insp,ata:part.ata,desc:part.name,
    scrapHrs:scrapHrs||null,
    loggedByLeader:true,loggedBy:CU.name,
    approvalStatus:'pending',
    submittedBy:CU?.name||'',
    submittedByRole:CR||''
  };
  const fields=[
    ['Technician',`<strong>${tech.name}</strong> <span class="mono">(${tech.id})</span>`],
    ['Task Code',`<span class="mono" style="color:var(--blue);font-weight:700;">${taskCode}</span>`],
    ['Job Type',`<span class="${leJobType==='scrap'?'cp-scrap':'cp-comp'}">${leJobType==='scrap'?'🗑 Scrap':'✅ Completed'}</span>`],
    ['Job Role',`<span style="font-weight:700;color:${ROLE_COLORS[leJobRoleIdx]}">${leJobRole}</span>`],
    ['Part',part.name],['ATA Chapter',part.ata||'—'],['Part Number',`<span class="mono">${part.num}</span>`],
    ['Std Hours (SDT)',`<span class="mono">${part.hours}h</span>`],
    ['Pool Hours',`<span class="mono" style="font-weight:700;">${pool}h</span>${insp?' <span class="not-sdt">NOT SDT</span>':''}`],
    ['Date (EAT)',fmtEAT(lePendingEntry.time,'date')],
  ];
  if(scrapHrs)fields.push(['Scrap Hrs',`<span class="mono" style="color:var(--rose);font-weight:700;">${scrapHrs}h</span>`]);
  document.getElementById('m-review-body').innerHTML=
    `<div class="al al-a"><span class="al-ico">⚠️</span><div>You are submitting on behalf of <strong>${tech.name}</strong>. Verify all details below.</div></div>`+
    `<div style="background:var(--card2);border-radius:8px;padding:12px 14px;margin-top:8px;">`+
    fields.map(([l,v])=>`<div class="review-field"><div class="rf-label">${l}</div><div class="rf-val">${v}</div></div>`).join('')+
    `</div>`;
  document.getElementById('confirm-save-btn').onclick=confirmLeSave;
  openModal('m-review');
}
window.openLeReviewModal=openLeReviewModal;
async function confirmLeSave(){
  if(!lePendingEntry){toast('No pending entry','error');return;}
  const btn=document.getElementById('confirm-save-btn');
  if(btn){btn.classList.add('saving');btn.disabled=true;}
  const savedEntry={...lePendingEntry};
  if(!savedEntry.approvalStatus)savedEntry.approvalStatus='pending';
  if(isDuplicateEntry(savedEntry)){
    toast('Duplicate entry blocked','error');
    if(btn){btn.classList.remove('saving');btn.disabled=false;}
    return;
  }
  try{
    const ref=await window.addDoc(window.collection(window.db,'entries'),savedEntry);
    savedEntry.id=ref.id;
    entries.unshift(savedEntry);
    closeModal('m-review');
    clearLeEntry();
    renderLeaderEntry();
    toast(`✓ ${savedEntry.pname} — ${savedEntry.jobRole} — ${savedEntry.hours}Hrs saved`);
  }catch(err){toast('Save failed: '+err.message,'error');}
  finally{if(btn){btn.classList.remove('saving');btn.disabled=false;}
  document.getElementById('confirm-save-btn').onclick=confirmSave;}
}
window.confirmLeSave=confirmLeSave;
function clearLeEntry(){
  clearPartSearch('le');
  ['le-part-sel','le-desc','le-ata','le-pnum','le-hours','le-taskcode'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const shi=document.getElementById('le-scrap-hrs');if(shi)shi.value='2';
  sv('le-time',todayEAT());setLeJobType('completed');pickLeJobRole('Technician',0);lePendingEntry=null;
}
window.clearLeEntry=clearLeEntry;


// ════════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════════
const NAV={
  tech:['mystats','taskgroups'],
  lead:['dashboard','controllerentry','productionimport','assignments','allentries','reports','ratios','taskgroups'],
  ctrl:['controllerentry','allentries','taskgroups'],
  dev:['techs','parts','leaders','controllers','productionimport','pwmgmt','ratios','taskgroups','system']
};
const META={
  entry:{t:'Production Entry',d:'Log completed or scrap work'},
  mystats:{t:'My Results',d:'Personal KPI and history'},
  dashboard:{t:'Team Dashboard',d:'Real-time performance'},
  assignments:{t:'Assignments',d:'Assign tasks to technicians'},
  allentries:{t:'All Entries',d:'Complete production log'},
  controllerentry:{t:'Production Controller Entry',d:'Log entry on behalf of a technician'},
  reports:{t:'Reports',d:'Monthly Target summary'},
  ratios:{t:'Hour Ratio Settings',d:'Set SDT % and inspector fixed hours'},
  taskgroups:{t:'Task Code Groups',d:'Personnel grouped by JIC task code'},
  techs:{t:'Manage Technicians',d:''},
  parts:{t:'Parts & Inventory',d:''},
  leaders:{t:'Team Leaders',d:''},
  controllers:{t:'Production Controllers',d:''},
  productionimport:{t:'Import Production Entries',d:'Import ComponentTATStatus Excel entries'},
  pwmgmt:{t:'Password Management',d:'Reset user passwords'},
  system:{t:'System Settings',d:''}
};
const ICONS={entry:'⊕',mystats:'📊',dashboard:'🖥',assignments:'📌',allentries:'📋',controllerentry:'⊕',reports:'📈',ratios:'⚖️',taskgroups:'🗂',techs:'👷',parts:'🔩',leaders:'👥',controllers:'🏭',productionimport:'⬆️',pwmgmt:'🔐',system:'⚙️'};

function buildNav(){
  const nav=document.getElementById('sbnav');if(!nav)return;
  nav.innerHTML='<div class="sb-sec">Menu</div>'+(NAV[CR]||[]).map(p=>`<div class="nl" data-page="${p}" onclick="navTo('${p}');closeSidebar();"><span class="ni">${ICONS[p]||'•'}</span>${META[p]?.t||p}</div>`).join('');
}
window.navTo=function(page){
  // TECHNICIAN MUST NOT ACCESS PRODUCTION ENTRY
  if(CR==='tech' && page==='entry'){toast('Access denied','error');page='mystats';}

  document.querySelectorAll('.pg').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.nl').forEach(l=>l.classList.remove('on'));
  const pg=document.getElementById('pg-'+page);if(pg)pg.classList.add('on');
  const ln=document.querySelector(`.nl[data-page="${page}"]`);if(ln)ln.classList.add('on');
  const m=META[page]||{};stxt('pg-title',m.t||page);stxt('pg-desc',m.d||'');
  if(page==='entry')renderEntry();
  if(page==='mystats'){const mf=document.getElementById('ms-month-filter');if(mf&&!mf.value)mf.value=todayEAT().slice(0,7);renderMyStats();}
  if(page==='dashboard'){populateTechFilter();if(!document.getElementById('dash-dt-from')?.value && document.getElementById('dash-dt-preset')?.value!=='all'){applyDashPreset('month');}else{renderDashboard();renderLB();}}
  if(page==='assignments'){populateAsnSels();renderAssignments();}
  if(page==='allentries'){populateTechFilter();if(!document.getElementById('ae-dt-from')?.value){applyAEPreset('today');}else{renderAllEntries();};}
  if(page==='reports'){if(!document.getElementById('rpt-dt-from')?.value && document.getElementById('rpt-dt-preset')?.value!=='all'){applyRptPreset('month');}else{renderReports();}}
  if(page==='ratios')renderRatios();
  if(page==='taskgroups'){if(!document.getElementById('tc-dt-from')?.value){applyTCPreset('today');}else{renderTG();}}
  if(page==='techs')renderTechs();
  if(page==='parts')renderParts();
  if(page==='leaders')renderLeaders();
  if(page==='controllers')renderControllers();
  if(page==='productionimport')renderProductionImportPage();
  if(page==='controllerentry'){populateLeaderEntryTechs();renderLeaderEntry();}
  if(page==='pwmgmt')renderPwMgmt();
  if(page==='system')renderSystem();
};

// ════════════════════════════════════════════════
//  LOGIN
// ════════════════════════════════════════════════
function ql(id,role){sv('li-id',id);sv('li-pw',role==='dev'? (settings.passwords?.dev||'dev123') : 'demo');doLogin();}
window.ql=ql;

async function doLogin(){
  if(loginAttempts>=5){
    const rc=document.getElementById('dev-recovery-code');if(rc)rc.textContent=DEV_RECOVERY_CODE;
    document.getElementById('login-attempts').style.display='block';
    document.getElementById('login-attempts').textContent='Too many attempts. Wait 30s or use "Forgot password?" for recovery.';
    toast('Too many login attempts. Try again in 30 seconds.','error');
    setTimeout(()=>{loginAttempts=0;document.getElementById('login-attempts').style.display='none';},30000);
    return;
  }
  const id=sanitize(document.getElementById('li-id')?.value).toUpperCase();
  const pwd=document.getElementById('li-pw')?.value;
  if(!id||!pwd)return;
  const btn=document.getElementById('sign-in-btn');const lbtxt=document.getElementById('lbtn-txt');
  if(btn){btn.classList.add('loading');btn.disabled=true;}
  if(lbtxt)lbtxt.textContent='Signing in…';
  showLoading('Loading ProTrack…');
  try{
    const ts=await window.getDocs(window.collection(window.db,'technicians'));techs=ts.docs.map(d=>({id:d.id,...d.data()}));
    const ls=await window.getDocs(window.collection(window.db,'leaders'));leaders=ls.docs.map(d=>({id:d.id,...d.data()}));
    const cs=await window.getDocs(window.collection(window.db,'controllers'));controllers=cs.docs.map(d=>({id:d.id,...d.data()}));
    const ps=await window.getDocs(window.collection(window.db,'parts'));parts=ps.docs.map(d=>({id:d.id,...d.data()}));
    const es=await window.getDocs(window.collection(window.db,'entries'));entries=es.docs.map(d=>({id:d.id,...d.data()}));
    const ss=await window.getDocs(window.collection(window.db,'settings'));if(!ss.empty)settings=ss.docs[0].data();
    const as_=await window.getDocs(window.collection(window.db,'assignments'));assignments=as_.docs.map(d=>({id:d.id,...d.data()}));
    await loadPics();
  }catch(e){console.warn('Load:',e);}
  let user=null,role='';

  if(id==='DEV001'&&pwd===(settings.passwords?.dev||'dev123')){user={id:'DEV001',name:'Developer Admin',initials:'DA',color:'#8b5cf6'};role='dev';}
  else {
    user=techs.find(t=>t.id===id&&t.password===pwd);
    if(user) role='tech';
    else {
      user=leaders.find(l=>l.id===id&&l.password===pwd);
      if(user) role='lead';
      else {
        user=controllers.find(c=>c.id===id&&c.password===pwd);
        if(user) role='ctrl';
      }
    }
  }
  if(btn){btn.classList.remove('loading');btn.disabled=false;}
  if(lbtxt)lbtxt.textContent='Sign In →';
  if(!user){
    loginAttempts++;
    const remaining=5-loginAttempts;
    document.getElementById('login-attempts').style.display='block';
    document.getElementById('login-attempts').textContent=`Invalid credentials. ${remaining} attempt${remaining!==1?'s':''} remaining.`;
    if(loginAttempts>=5){document.getElementById('login-attempts').textContent='Account locked for 30s. Use "Forgot password?" if needed.';}
    hideLoading();toast('Invalid credentials','error');return;
  }
  loginAttempts=0;document.getElementById('login-attempts').style.display='none';
  CU=user;CR=role;
  const avEl=document.getElementById('sb-av');
  if(avEl){avEl.innerHTML=avatarHtml(user.id,user.name,32);avEl.style.background='transparent';}
  stxt('sb-un',user.name);stxt('sb-ur',role.toUpperCase());
  buildNav();
  document.getElementById('login').classList.remove('on');
  document.getElementById('app').classList.add('on');
  hideLoading();
  if(CR==='tech'){navTo('mystats');}else if(CR==='lead'){navTo('dashboard');}else if(CR==='ctrl'){navTo('controllerentry');}else{navTo('techs');}
  toast('Welcome, '+user.name.split(' ')[0]+'!');
}
window.doLogin=doLogin;
window.logout=function(){CU=null;CR=null;document.getElementById('app').classList.remove('on');document.getElementById('login').classList.add('on');};

// ════════════════════════════════════════════════
//  VERSION HISTORY
// ════════════════════════════════════════════════
function toggleVer(){document.getElementById('ver-history').classList.toggle('open');}
window.toggleVer=toggleVer;

// ════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('sign-in-btn')?.addEventListener('click',doLogin);
  ['li-id','li-pw'].forEach(id=>{
    document.getElementById(id)?.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();doLogin();}
    });
  });
  sv('asn-date',todayEAT());
  ['e-time','le-time'].forEach(id=>{const el=document.getElementById(id);if(el&&!el.value)el.value=todayEAT();});
  setTimeout(hideLoading,800);
  document.getElementById('login').classList.add('on');
  const mf=document.getElementById('ms-month-filter');if(mf&&!mf.value)mf.value=todayEAT().slice(0,7);
  stxt('ver-current','v'+APP_VERSION);
});
