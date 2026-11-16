/* ===== shinang 공정 데이터 관리 시스템 : core ===== */
const DB_NAME='syncheon_pms', DB_VER=1;
let db=null;
const state={recs:[],page:'input',guide:null,editId:null,inputMode:'qc',filter:{month:'',tank:'',q:''},pageIdx:0,meta:{}};

const FIELDS=['date','tank','ton','tt','milk','t1','t5','amb','cool','hot','a0','a1','a5','aF','afm','mins','trans','ph0','ph1','ph5','phF','phP','br0','brF','brP','asS','asP','vs1','vsF','vsS','vsP','phS','br1','brS'];
const SEEDMAP={};
window.SEED.forEach((a,i)=>{const o={};FIELDS.forEach((k,j)=>o[k]=a[j]);o.id=o.date+'|'+o.tank;o.src='seed';SEEDMAP[o.id]=1;});

const COMMON_FIELDS=[
 {k:'date',l:'제조일',t:'date',req:1},
 {k:'tank',l:'발효탱크',t:'select',req:1,opts:['301','302','303','304','305','306','307']},
 {k:'ton',l:'톤수',u:'t'}
];
const GROUPS_QC=[
 {t:'산도 (%)',note:'초기 산도 변화와 종결시간의 판정 근거',f:[
   {k:'a0',l:'살균후',u:'%',req:1},
   {k:'a1',l:'접종후 (1H)',u:'%',req:1},
   {k:'a5',l:'1차샘플 (5H)',u:'%',req:1},
   {k:'aF',l:'종결',u:'%',req:1},
   {k:'afm',l:'종결분 (접종 후 경과)',u:'분',req:1},
   {k:'asS',l:'서지1'},
   {k:'asP',l:'완제품1'},
   {k:'trans',l:'총이송',u:'m'}]},
 {t:'점도',note:'일보 점도 구역',f:[
   {k:'vs1',l:'1차'},
   {k:'vsF',l:'종결'},
   {k:'vsS',l:'서지1'},
   {k:'vsP',l:'완제품1'}]},
 {t:'pH',note:'',f:[
   {k:'ph0',l:'살균후'},{k:'ph1',l:'접종후 (1H)'},{k:'ph5',l:'1차 (5H)'},
   {k:'phF',l:'종결'},{k:'phS',l:'서지1'},{k:'phP',l:'완제품1'}]},
 {t:'당도 (°Bx)',note:'',f:[
   {k:'br0',l:'살균후'},{k:'br1',l:'접종후 (1H)'},{k:'brF',l:'종결'},{k:'brS',l:'서지1'},{k:'brP',l:'완제품1'}]}
];
const GROUPS_TT=[
 {t:'탱크 온도',note:'HMI · 수기 기록',f:[
   {k:'tt',l:'발효탱크 설정TT',u:'℃',req:1},
   {k:'milk',l:'살균유 측정온도',u:'℃'},
   {k:'amb',l:'발효실 실내온도',u:'℃'},
   {k:'t1',l:'1H 발효액 온도',u:'℃'},
   {k:'t5',l:'5H 발효액 온도',u:'℃'}]},
 {t:'가온 설정',note:'겨울 역구배 판정',f:[
   {k:'hot',l:'핫워터 설정온도',u:'℃'},
   {k:'cool',l:'살균냉각온도',u:'℃'}]}
];
const TT_SERIES=[['510','5:10'],['535','5:35'],['550','5:50'],['630','6:30'],['650','6:50'],['1100','11:00'],['1300','13:00']];
function groupsOf(mode){return mode==='tt'?GROUPS_TT:GROUPS_QC;}
function fieldsOf(mode){return groupsOf(mode).reduce((a,g)=>a.concat(g.f),[]);}
function qcDone(r){return r&&r.a0!=null&&r.a1!=null&&r.a5!=null&&r.aF!=null&&r.afm!=null;}
function ttDone(r){return r&&(r.tt!=null||r.amb!=null);}

/* ---------- storage (IndexedDB → 파일 → 메모리 순 폴백) ---------- */
let STO='idb';
const MEM={batches:[],meta:[]};
function br(){return window.AndroidBridge||null;}
function fileRead(k){const b=br();if(!b||!b.readData)return null;try{return b.readData(k);}catch(e){return null;}}
function fileWrite(k,v){const b=br();if(b&&b.writeData)try{b.writeData(k,v);return true;}catch(e){return false;}return false;}
function initStorage(){
  return new Promise(res=>{
    const fallback=()=>{STO=br()?'file':'mem';res(STO);};
    if(!window.indexedDB)return fallback();
    let done=false;
    const t=setTimeout(()=>{if(!done){done=true;fallback();}},2500);
    try{
      const q=indexedDB.open(DB_NAME,DB_VER);
      q.onupgradeneeded=e=>{const d=e.target.result;
        if(!d.objectStoreNames.contains('batches')){const s=d.createObjectStore('batches',{keyPath:'id'});s.createIndex('date','date');}
        if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'k'});};
      q.onsuccess=e=>{if(done)return;done=true;clearTimeout(t);db=e.target.result;STO='idb';res('idb');};
      q.onerror=()=>{if(done)return;done=true;clearTimeout(t);fallback();};
      q.onblocked=()=>{if(done)return;done=true;clearTimeout(t);fallback();};
    }catch(e){fallback();}
  });
}
function tx(store,mode){return db.transaction(store,mode).objectStore(store);}
function fileArr(store){try{return JSON.parse(fileRead(store)||'[]');}catch(e){return [];}}
function keyOf(v){return v.id!=null?v.id:v.k;}
function dbAll(store){
  if(STO==='idb')return new Promise((res,rej)=>{const r=tx(store,'readonly').getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});
  if(STO==='file')return Promise.resolve(fileArr(store));
  return Promise.resolve(MEM[store]||[]);
}
function dbPut(store,val){
  if(STO==='idb')return new Promise((res,rej)=>{const r=tx(store,'readwrite').put(val);r.onsuccess=()=>res(1);r.onerror=()=>rej(r.error);});
  if(STO==='file'){const arr=fileArr(store);const k=keyOf(val);const i=arr.findIndex(x=>keyOf(x)===k);
    if(i>=0)arr[i]=val;else arr.push(val);fileWrite(store,JSON.stringify(arr));return Promise.resolve(1);}
  const arr=MEM[store]||[];const k=keyOf(val);const i=arr.findIndex(x=>keyOf(x)===k);
  if(i>=0)arr[i]=val;else arr.push(val);MEM[store]=arr;return Promise.resolve(1);
}
function dbBulk(store,list){
  if(STO==='idb')return new Promise((res,rej)=>{const t=db.transaction(store,'readwrite');const os=t.objectStore(store);
    list.forEach(v=>os.put(v));t.oncomplete=()=>res(1);t.onerror=()=>rej(t.error);});
  if(STO==='file'){fileWrite(store,JSON.stringify(list));return Promise.resolve(1);}
  MEM[store]=list.slice();return Promise.resolve(1);
}
function dbDel(store,key){
  if(STO==='idb')return new Promise((res,rej)=>{const r=tx(store,'readwrite').delete(key);r.onsuccess=()=>res(1);r.onerror=()=>rej(r.error);});
  if(STO==='file'){fileWrite(store,JSON.stringify(fileArr(store).filter(x=>keyOf(x)!==key)));return Promise.resolve(1);}
  MEM[store]=(MEM[store]||[]).filter(x=>keyOf(x)!==key);return Promise.resolve(1);
}
function dbClear(store){
  if(STO==='idb')return new Promise((res,rej)=>{const r=tx(store,'readwrite').clear();r.onsuccess=()=>res(1);r.onerror=()=>rej(r.error);});
  if(STO==='file'){fileWrite(store,'[]');return Promise.resolve(1);}
  MEM[store]=[];return Promise.resolve(1);
}
function metaGet(k){return dbAll('meta').then(list=>{const f=list.filter(x=>x.k===k)[0];return f?f.v:null;}).catch(()=>null);}
function metaSet(k,v){return dbPut('meta',{k,v});}

/* ---------- guide & judgment ---------- */
function buildGuide(){
  const sum=state.recs.filter(r=>seasonOf(r.date)==='summer'&&r.aF!=null);
  const base=sum.length>=20?sum:state.recs.filter(r=>r.aF!=null);
  const pick=f=>base.map(f).filter(v=>v!=null&&!isNaN(v));
  const d1=pick(r=>der(r).d1), d5=pick(r=>der(r).d5), dur=pick(r=>der(r).dur), af=pick(r=>r.aF), dft=pick(r=>der(r).df);
  const g={
    basis:sum.length>=20?'summer':'all', n:base.length,
    d1:{m:mean(d1),s:sd(d1)}, d5:{m:mean(d5),s:sd(d5)},
    dur:{m:mean(dur),s:sd(dur)}, af:{m:mean(af),s:sd(af)}, df:{m:mean(dft),s:sd(dft)}
  };
  state.guide=g;return g;
}
function zOf(v,g){if(v==null||g.m==null)return null;if(!g.s)return 0;return (v-g.m)/g.s;}
function judge(r){
  const g=state.guide,D=der(r);
  const items=[
    {k:'d1',n:'초기 산도 변화 (1H)',v:D.d1,u:'%',d:3},
    {k:'d5',n:'5H 산도 변화',v:D.d5,u:'%',d:3},
    {k:'dur',n:'종결 소요시간',v:D.dur,u:'분',d:0},
    {k:'af',n:'종결 산도',v:r.aF,u:'%',d:3}
  ].map(it=>{
    const z=zOf(it.v,g[it.k]);
    let st='nu';
    if(z!=null){const az=Math.abs(z);st=az<=1?'ok':(az<=2?'wa':'bd');}
    return Object.assign(it,{z,st,g:g[it.k]});
  });
  const lv=items.some(i=>i.st==='bd')?'bd':(items.some(i=>i.st==='wa')?'wa':'ok');
  return {level:lv,items};
}
const LV_KO={ok:'정상',wa:'주의',bd:'이상',nu:'—'};

/* ---------- ui helpers ---------- */
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('on');
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),2200);}
function openModal(title,body,foot){document.getElementById('mTitle').textContent=title;
  document.getElementById('mBody').innerHTML=body;document.getElementById('mFoot').innerHTML=foot||'';
  document.getElementById('mask').classList.add('on');}
function closeModal(){document.getElementById('mask').classList.remove('on');}
document.addEventListener('click',e=>{if(e.target.id==='mask')closeModal();});

/* ---------- nav ---------- */
const PAGES=[
 {id:'input',n:'입력',sub:'A300 공정 · 품질 데이터 입력',ic:'M12 5v14M5 12h14'},
 {id:'analysis',n:'분석',sub:'계절별 산도·종결시간 비교 분석',ic:'M4 19V6m0 13h17M8 16l3.5-5 3 3L21 7'},
 {id:'judge',n:'판정',sub:'여름 기준 대비 품질 판정',ic:'M9 12l2 2 4-4M12 3l7 4v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V7z'},
 {id:'data',n:'데이터',sub:'이력 조회 · 백업 · 복원',ic:'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7'},
 {id:'manage',n:'관리',sub:'추천 온도 · 작년 대조 · 보정 처방',ic:'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6'}
];
function renderNav(){
  document.getElementById('nav').innerHTML=PAGES.map(p=>
    `<button class="navbtn ${state.page===p.id?'on':''}" onclick="go('${p.id}')">
      <svg viewBox="0 0 24 24"><path d="${p.ic}"/></svg><span>${p.n}</span></button>`).join('');
}
function go(id){state.page=id;state.pageIdx=0;renderNav();render();}
function render(){
  const p=PAGES.find(x=>x.id===state.page);
  document.getElementById('tbTitle').textContent=p.n==='입력'?'데이터 입력':(p.n==='분석'?'분석':(p.n==='판정'?'품질 판정':(p.n==='관리'?'관리 · 추천 온도':'데이터 관리')));
  document.getElementById('tbSub').textContent=p.sub;
  const ds=state.recs.map(r=>r.date).sort();
  document.getElementById('pillCount').innerHTML=`<span class="dot"></span>총 <b>${state.recs.length.toLocaleString()}</b> 배치`;
  document.getElementById('pillRange').textContent=ds.length?`${ds[0].slice(0,7).replace('-','.')} ~ ${ds[ds.length-1].slice(0,7).replace('-','.')}`:'—';
  const v=document.getElementById('view');
  if(state.page==='input')v.innerHTML=viewInput();
  else if(state.page==='analysis')v.innerHTML=viewAnalysis();
  else if(state.page==='judge')v.innerHTML=viewJudge();
  else if(state.page==='manage')v.innerHTML=viewManage();
  else v.innerHTML=viewData();
  if(state.page==='input')bindInput(); else if(state.page==='data')bindData();
  v.scrollTop=0;
}

/* ---------- input page ---------- */
function fieldHtml(f,rec){
  const v=rec?(rec[f.k]==null?'':rec[f.k]):'';
  let inp='';
  if(f.t==='select'){
    inp=`<select id="f_${f.k}">${[''].concat(f.opts).map(o=>`<option value="${o}" ${String(v)===String(o)?'selected':''}>${o||'선택'}</option>`).join('')}</select>`;
  }else{
    inp=`<input id="f_${f.k}" type="${f.t==='date'?'date':'text'}" value="${v}" inputmode="decimal" autocomplete="off" placeholder=" ">`;
  }
  if(f.u)inp=`<div class="u">${inp}<span>${f.u}</span></div>`;
  return `<div class="fld" id="w_${f.k}"><label>${f.l}${f.req?' <em>*</em>':''}</label>${inp}</div>`;
}
function seriesHtml(rec){
  const ser=(rec&&rec.ser)?rec.ser:{};
  return `<div class="formgrp"><div class="fgh"><b>시각별 탱크 온도</b><i></i><span>선택 입력 · 역구배 추적</span></div>
    <div class="fields" style="grid-template-columns:repeat(4,minmax(0,1fr))">
    ${TT_SERIES.map(t=>`<div class="fld"><label>${t[1]}</label>
      <div class="u"><input id="s_${t[0]}" type="text" inputmode="decimal" value="${ser[t[0]]==null?'':ser[t[0]]}" placeholder=" "><span>℃</span></div></div>`).join('')}
    </div></div>`;
}
function viewInput(){
  const mode=state.inputMode||'qc';
  const edit=state.editId?state.recs.find(r=>r.id===state.editId):null;
  const g=state.guide;
  const rec=edit||{};
  const groups=groupsOf(mode).map(gr=>`<div class="formgrp">
    <div class="fgh"><b>${gr.t}</b><i></i><span>${gr.note||''}</span></div>
    <div class="fields">${gr.f.map(f=>fieldHtml(f,rec)).join('')}</div></div>`).join('');
  const common=`<div class="formgrp"><div class="fgh"><b>배치 정보</b><i></i><span>두 기록이 공유하는 기준키</span></div>
    <div class="fields">${COMMON_FIELDS.map(f=>fieldHtml(f,rec)).join('')}</div></div>`;
  const qcChip=edit?`<span class="chip ${qcDone(edit)?'ok':'nu'}">QC ${qcDone(edit)?'완료':'미입력'}</span>`:'';
  const ttChip=edit?`<span class="chip ${ttDone(edit)?'ok':'nu'}">A300 ${ttDone(edit)?'완료':'미입력'}</span>`:'';
  return `<div class="seg" style="margin-bottom:14px">
      <button class="${mode==='qc'?'on':''}" onclick="setMode('qc')" style="--sc:#2B6CB0">
        <span class="sico" style="background:${mode==='qc'?'#2B6CB0':'#EAF2FB'};color:${mode==='qc'?'#fff':'#2B6CB0'}">QC</span>
        기록 — 산도 · pH · 당도</button>
      <button class="${mode==='tt'?'on':''}" onclick="setMode('tt')" style="--sc:#B4690E">
        <span class="sico" style="background:${mode==='tt'?'#B4690E':'#FDF3E3'};color:${mode==='tt'?'#fff':'#B4690E'}">A300</span>
        기록 — 온도 · 설정값</button>
    </div>
  <div class="grid2">
    <div class="card pad">
      <div class="spread" style="margin-bottom:14px">
        <div>
          <div style="font-size:28px;font-weight:780;letter-spacing:-.6px">${mode==='qc'?'QC 기록':'A300 기록'}${edit?' · 수정':''}</div>
          <div class="note" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px">
            ${edit?`<span>${edit.date.replace(/-/g,'.')} · ${edit.tank}탱크</span>${qcChip}${ttChip}`:'필수 항목(*)만 입력해도 저장됩니다'}
          </div>
        </div>
        <div class="row">
          <button class="btn sm gho" onclick="prefillLast('${mode}')">최근값</button>
          <button class="btn sm gho" onclick="clearForm()">초기화</button>
        </div>
      </div>
      <div id="formBody">${common}${groups}
        <div class="formgrp"><div class="fgh"><b>비고</b><i></i></div>
          <div class="fld"><textarea id="f_note" placeholder="이상 징후, 조치 사항">${edit&&edit.note?edit.note:''}</textarea></div>
        </div>
        ${mode==='tt'?seriesHtml(rec):''}
      </div>
      <div class="row" style="margin-top:16px;justify-content:flex-end">
        ${edit?'<button class="btn gho" onclick="cancelEdit()">수정 취소</button>':''}
        <button class="btn pri" onclick="saveBatch()">${mode==='qc'?'QC':'A300'} 저장</button>
      </div>
    </div>
    <div class="prev">
      <div class="card pad">
        <div class="spread" style="margin-bottom:4px">
          <div style="font-size:26px;font-weight:780">실시간 계산</div>
          <span class="chip nu" id="lvChip">입력 대기</span>
        </div>
        <div id="pvRows"></div>
        <div id="verdict"></div>
        <div class="hr"></div>
        <div class="note">QC 5개 항목(산도 4값 + 종결분)이 모두 들어오면 판정이 확정됩니다. A300만 입력한 배치는 판정 없이 저장됩니다.</div>
      </div>
      <div class="card pad" style="margin-top:14px">
        <div class="spread" style="margin-bottom:12px">
          <div style="font-size:26px;font-weight:780">판정 기준값</div>
          <span class="chip ac">${g.basis==='summer'?'여름 기준':'전체 기준'}</span>
        </div>
        <div class="statline" style="flex-direction:column;gap:9px">
          <div>초기 산도 변화 (1H) <b>${fmt(g.d1.m,3)} ± ${fmt(g.d1.s,3)}</b> %</div>
          <div>5H 산도 변화 <b>${fmt(g.d5.m,3)} ± ${fmt(g.d5.s,3)}</b> %</div>
          <div>종결 소요시간 <b>${fInt(g.dur.m)} ± ${fInt(g.dur.s)}</b> 분</div>
          <div>종결 산도 <b>${fmt(g.af.m,3)} ± ${fmt(g.af.s,3)}</b> %</div>
        </div>
        <div class="hr"></div>
        <div class="note">여름(6~8월) ${g.n}배치 평균±표준편차. ±1σ 정상, ±2σ 주의, 초과 시 이상.</div>
      </div>
    </div>
  </div>`;
}
function setMode(m){state.inputMode=m;render();
  const v=document.getElementById('view');if(v)v.scrollTop=0;}
function readForm(mode){
  const modeNow=mode||state.inputMode||'qc';
  const o={};
  COMMON_FIELDS.concat(fieldsOf(modeNow)).forEach(f=>{
    const el=document.getElementById('f_'+f.k);if(!el)return;
    const v=el.value.trim();
    if(v===''){o[f.k]=null;return;}
    o[f.k]=(f.k==='date'||f.k==='tank')?v:Number(v);
    if(isNaN(o[f.k]))o[f.k]=null;
  });
  const n=document.getElementById('f_note');o.note=n?n.value.trim():'';
  if(modeNow==='tt'){
    const ser={};
    TT_SERIES.forEach(t=>{const el=document.getElementById('s_'+t[0]);
      if(el&&el.value.trim()!==''){const v=Number(el.value);if(!isNaN(v))ser[t[0]]=v;}});
    o.ser=ser;
  }
  return o;
}
function bindInput(){
  FIELDS.concat(['note']).forEach(k=>{
    const el=document.getElementById('f_'+k);if(!el)return;
    el.addEventListener('input',()=>livePreview(el));
  });
  TT_SERIES.forEach(t=>{const el=document.getElementById('s_'+t[0]);
    if(el)el.addEventListener('input',()=>livePreview(el));});
  livePreview();
}
function livePreview(src){
  const mode=state.inputMode||'qc';
  const r=Object.assign({},state.editId?(state.recs.find(x=>x.id===state.editId)||{}):{},readForm(mode));
  const D=der(r);
  const chk=judge(r);
  const pv=document.getElementById('pvRows');
  if(pv)pv.innerHTML=[
    ['초기 산도 변화 (1H)',fmt(D.d1,3),'%','접종후 − 살균후'],
    ['5H 산도 변화',fmt(D.d5,3),'%','5H − 접종후'],
    ['종결 전 산도 변화',fmt(D.df,3),'%','종결 − 5H'],
    ['종결 소요시간',D.dur==null?'—':fInt(D.dur),'분','접종 후 경과'],
    ['분당 산도 상승',D.rate==null?'—':D.rate.toFixed(5),'%/분','종결 전 변화 ÷ 5H 이후']
  ].map(x=>`<div class="pv"><div class="k">${x[0]}<small>${x[3]}</small></div>
    <div class="v">${x[1]}<small>${x[2]}</small></div></div>`).join('');
  const lv=chk.level;
  const chip=document.getElementById('lvChip');
  if(chip){chip.className='chip '+(qcDone(r)?(lv==='ok'?'ok':lv==='wa'?'wa':'bd'):'nu');
    chip.textContent=qcDone(r)?LV_KO[lv]:'입력 대기';}
  const box=document.getElementById('verdict');
  if(box){
    if(!qcDone(r)){box.innerHTML=`<div class="note" style="margin-top:10px">산도 4개 값과 종결분을 입력하면 여름 기준 대비 판정이 표시됩니다.</div>`;}
    else{
      box.innerHTML=`<div class="verdict ${lv}">
        <div class="vt">${lv==='ok'?'✓ 여름 기준 충족':lv==='wa'?'△ 주의 — 기준 이탈':'✕ 이상 — 기준 초과'}</div>
        <ul>${chk.items.filter(i=>i.st!=='ok'&&i.st!=='nu').map(i=>
          `<li><b>·</b><span>${i.n} ${i.v==null?'—':(i.d===0?fInt(i.v):fmt(i.v,i.d))}${i.u} (기준 ${i.d===0?fInt(i.g.m):fmt(i.g.m,i.d)}${i.u}, z=${i.z.toFixed(1)})</span></li>`).join('')
          || '<li><b>·</b><span>모든 항목이 ±1σ 이내입니다.</span></li>'}</ul>
      </div>`;
    }
  }
  if(src&&src.id&&(src.id==='f_date'||src.id==='f_tank')){/* noop */}
}
function clearForm(){
  state.editId=null;
  document.querySelectorAll('#formBody input,#formBody textarea').forEach(el=>{el.value='';el.parentElement.classList.remove('err');});
  document.querySelectorAll('#formBody select').forEach(el=>{el.value='';});
  livePreview();toast('입력란을 비웠습니다');
}
function prefillLast(mode){
  const m=mode||state.inputMode||'qc';
  const src=state.recs.filter(r=>r.src==='user').sort((a,b)=>a.date<b.date?1:-1)[0]
        || state.recs.slice().sort((a,b)=>a.date<b.date?1:-1)[0];
  if(!src){toast('불러올 이력이 없습니다');return;}
  COMMON_FIELDS.concat(fieldsOf(m)).forEach(f=>{
    const el=document.getElementById('f_'+f.k);if(!el)return;
    if(f.k==='date'){el.value=new Date().toISOString().slice(0,10);return;}
    el.value=src[f.k]==null?'':src[f.k];
  });
  if(m==='tt'&&src.ser){TT_SERIES.forEach(t=>{const el=document.getElementById('s_'+t[0]);
    if(el)el.value=src.ser[t[0]]==null?'':src.ser[t[0]];});}
  const n=document.getElementById('f_note');if(n)n.value='';
  livePreview();toast(src.date.replace(/-/g,'.')+' 값에서 불러왔습니다. 날짜·수치 확인 후 저장하세요');
}
/* ---------- 입력값 검증 (오타·범위 이탈 경고) ---------- */
const HARD={amb:[10,50],cool:[34,48],hot:[36,42],tt:[34,46],milk:[34,46],t1:[30,46],t5:[30,46],
  a0:[0.12,0.30],a1:[0.15,0.32],a5:[0.68,0.98],aF:[0.88,1.05],afm:[260,480],trans:[20,120],
  ph0:[4.0,7.5],ph1:[4.0,7.5],ph5:[3.5,7.0],phF:[3.4,6.5],phS:[3.4,6.5],phP:[3.4,6.5],
  br0:[8,22],br1:[8,22],brF:[8,22],brS:[8,22],brP:[8,22],
  vs1:[0,60],vsF:[0,60],vsS:[0,60],vsP:[0,60]};
const LABEL={amb:'실내온도',cool:'살균냉각',hot:'핫워터',tt:'설정TT',milk:'살균유',t1:'1H 액온',t5:'5H 액온',
  a0:'산도 살균후',a1:'산도 접종후',a5:'산도 5H',aF:'산도 종결',afm:'종결분',trans:'총이송',
  ph0:'pH 살균후',ph1:'pH 1H',ph5:'pH 5H',phF:'pH 종결',phS:'pH 서지',phP:'pH 완제품',
  br0:'당도 살균후',br1:'당도 접종후',brF:'당도 종결',brS:'당도 서지',brP:'당도 완제품',
  vs1:'점도 1차',vsF:'점도 종결',vsS:'점도 서지',vsP:'점도 완제품'};
function obsCheck(k,v){
  const h=HARD[k]; if(!h||v==null||isNaN(v))return null;
  if(v<h[0]||v>h[1])return LABEL[k]+' '+v+' — 관측 범위('+h[0]+'~'+h[1]+')를 벗어났습니다';
  return null;
}
function lastSameTank(tank,date){
  const list=state.recs.filter(r=>String(r.tank)===String(tank)&&r.date<date)
    .sort((a,b)=>a.date<b.date?1:-1);
  return list[0]||null;
}
function validateBatch(o,prev){
  const w=[];
  Object.keys(HARD).forEach(k=>{const m=obsCheck(k,o[k]);if(m)w.push(m);});
  if(o.a0!=null&&o.a1!=null&&o.a1<o.a0)w.push('접종후 산도('+o.a1+')가 살균후('+o.a0+')보다 낮습니다');
  if(o.a1!=null&&o.a5!=null&&o.a5<o.a1)w.push('5H 산도('+o.a5+')가 접종후('+o.a1+')보다 낮습니다');
  if(o.a5!=null&&o.aF!=null&&o.aF<o.a5)w.push('종결 산도('+o.aF+')가 5H('+o.a5+')보다 낮습니다 — 5H→종결은 상승해야 합니다');
  if(o.afm!=null&&(o.afm-300)<0)w.push('종결분('+o.afm+')이 300분보다 짧습니다 — 5H 이후 시간이 음수가 됩니다');
  const base=prev||lastSameTank(o.tank,o.date);
  if(base){
    if(base.aF!=null&&o.aF!=null&&Math.abs(o.aF-base.aF)>0.05)
      w.push('종결 산도가 직전 기록('+base.aF+')과 '+(Math.abs(o.aF-base.aF)).toFixed(3)+' 차이납니다');
    if(base.afm!=null&&o.afm!=null&&Math.abs(o.afm-base.afm)>40)
      w.push('종결분이 직전 기록('+base.afm+'분)과 '+Math.abs(o.afm-base.afm)+'분 차이납니다');
    if(base.amb!=null&&o.amb!=null&&Math.abs(o.amb-base.amb)>15)
      w.push('실내온도가 직전 기록('+base.amb+'℃)과 '+Math.abs(o.amb-base.amb).toFixed(1)+'℃ 차이납니다');
  }
  return w;
}
function saveBatch(){
  const mode=state.inputMode||'qc';
  const o=readForm(mode);
  const req=COMMON_FIELDS.concat(fieldsOf(mode)).filter(f=>f.req);
  const miss=req.filter(f=>o[f.k]===null||o[f.k]==='');
  document.querySelectorAll('.fld.err').forEach(e=>e.classList.remove('err'));
  if(miss.length){miss.forEach(f=>{const w=document.getElementById('w_'+f.k);if(w)w.classList.add('err');});
    toast('필수 항목: '+miss.map(f=>f.l).join(', '));return;}
  const id=o.date+'|'+o.tank;
  const prev=state.recs.find(r=>r.id===id);
  const merged=Object.assign({},prev||{},o);
  merged.id=id;
  merged.mins=merged.afm!=null?merged.afm-300:null;
  merged.src='user';merged.ts=Date.now();
  if(mode==='tt'&&(!o.ser||Object.keys(o.ser).length===0)&&prev&&prev.ser)merged.ser=prev.ser;
  const warns=validateBatch(merged,prev);
  if(warns.length&&!window._valOk){
    window._valOk=true;
    openModal('입력값을 확인하세요',
      '<div class="alert w"><div><b>'+warns.length+'건</b>이 평소 범위와 다릅니다. 오타인지 확인하세요.</div></div>'
      +'<div style="margin-top:10px;display:flex;flex-direction:column;gap:7px">'
      +warns.map(x=>'<div style="font-size:var(--fs);color:#8A5A00">· '+x+'</div>').join('')
      +'</div>',
      '<button class="btn gho" onclick="window._valOk=false;closeModal()">다시 입력</button>'
      +'<button class="btn pri" onclick="closeModal();saveBatch()">확인 — 저장</button>');
    return;
  }
  const commit=()=>{
    dbPut('batches',merged).then(()=>{
      const i=state.recs.findIndex(r=>r.id===id);
      if(i>=0)state.recs[i]=merged;else state.recs.push(merged);
      state.recs.sort((a,b)=>a.date<b.date?1:(a.date>b.date?-1:0));
      window._valOk=false;
      buildGuide();render();toast(o.date.replace(/-/g,'.').replace(/-/g,'.')+' · '+o.tank+'탱크 '+(mode==='qc'?'QC':'A300')+' 저장 완료');
    }).catch(e=>toast('저장 실패: '+e.message));
  };
  if(prev&&state.editId!==id){
    const both=qcDone(prev)&&qcDone(merged)&&mode==='qc';
    openModal('기록이 이미 있습니다',
      `<div class="alert i"><div><b>${o.date} · ${o.tank}탱크</b> 기록이 이미 있습니다.<br>
        ${mode==='qc'?'QC 항목을 새 값으로 교체합니다. A300 항목은 그대로 유지됩니다.':'A300 항목을 새 값으로 교체합니다. QC 항목은 그대로 유지됩니다.'}</div></div>`,
      `<button class="btn gho" onclick="closeModal()">취소</button>
       <button class="btn pri" onclick="closeModal();commitPending()">계속</button>`);
    window._pendingMerged=merged;window._commit=commit;return;
  }
  commit();
}
function commitPending(){
  const o=window._pendingMerged;if(!o)return;
  dbPut('batches',o).then(()=>{
    const i=state.recs.findIndex(r=>r.id===o.id);
    if(i>=0)state.recs[i]=o;else state.recs.push(o);
    state.recs.sort((a,b)=>a.date<b.date?1:(a.date>b.date?-1:0));
    buildGuide();render();toast('저장 완료');
  });
}
function forceSave(){const o=window._pending;if(!o)return;dbPut('batches',o).then(()=>{
  const i=state.recs.findIndex(r=>r.id===o.id);if(i>=0)state.recs[i]=o;else state.recs.push(o);
  state.recs.sort((a,b)=>a.date<b.date?1:(a.date>b.date?-1:0));buildGuide();render();toast('덮어쓰기 완료');});}
function cancelEdit(){state.editId=null;render();}

/* ---------- boot ---------- */
function boot(){
  initStorage().then(async()=>{
    let recs=await dbAll('batches');
    if(recs.length===0){
      const objs=window.SEED.map(a=>{const o={};FIELDS.forEach((k,j)=>o[k]=a[j]);o.id=o.date+'|'+o.tank;o.src='seed';return o;});
      await dbBulk('batches',objs);
      recs=objs;
      await metaSet('seeded',new Date().toISOString());
    }
    state.recs=recs.sort((a,b)=>a.date<b.date?1:(a.date>b.date?-1:0));
    state.meta.lastBackup=await metaGet('lastBackup');
    const vl=document.getElementById('verLabel');
    if(vl){try{vl.textContent='v'+appVer();}catch(e){}}
    buildGuide();renderNav();render();
  }).catch(e=>{document.getElementById('view').innerHTML=
    `<div class="card pad"><div class="alert a"><div><b>저장소를 열 수 없습니다.</b><br>${e.message}<br>브라우저 개인정보 보호 모드이거나 저장 공간이 부족한 경우 발생합니다.</div></div></div>`;});
}
