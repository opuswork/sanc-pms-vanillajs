/* ===== 데이터 관리 · 무결성 점검 · 자동 백업 ===== */
const DTM_LAST='pms_autobk_last';
const DTM_SNAP='pms_snapshot';
const TANK_OK=['301','302','303','304','305','306','307'];

function dtmToday(){const d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}
function dtmStamp(){const d=new Date();return dtmToday()+'_'+('0'+d.getHours()).slice(-2)+('0'+d.getMinutes()).slice(-2);}
function dtmStoreName(){
  if(typeof STO==='undefined')return '알 수 없음';
  return STO==='idb'?'내부 저장소(IndexedDB)':(STO==='file'?'앱 파일':'메모리(임시)');
}
function dtmDanger(){return typeof STO!=='undefined'&&STO==='mem';}

/* ---------- 무결성 점검 ---------- */
function dtmIssues(){
  const out=[];
  const seen={};
  const today=dtmToday();
  state.recs.forEach(r=>{
    const tag=r.date+' · '+r.tank;
    if(seen[r.id])out.push({lvl:'bd',tag:tag,msg:'중복 기록입니다 (같은 날짜·탱크)'});
    seen[r.id]=1;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date||''))out.push({lvl:'bd',tag:tag,msg:'날짜 형식이 잘못되었습니다'});
    else if(r.date>today)out.push({lvl:'wa',tag:tag,msg:'미래 날짜입니다'});
    if(TANK_OK.indexOf(String(r.tank))<0)out.push({lvl:'wa',tag:tag,msg:'탱크 번호가 301~307 범위가 아닙니다'});
    const qc=[['a0','살균후'],['a1','접종후'],['a5','5H'],['aF','종결'],['afm','종결분']];
    const miss=qc.filter(x=>r[x[0]]==null).map(x=>x[1]);
    if(miss.length&&miss.length<5)out.push({lvl:'wa',tag:tag,msg:'QC 항목 누락 — '+miss.join(', ')});
    if(r.a1!=null&&r.a0!=null&&r.a1<r.a0)out.push({lvl:'bd',tag:tag,msg:'접종후 산도가 살균후보다 낮습니다'});
    if(r.a5!=null&&r.a1!=null&&r.a5<r.a1)out.push({lvl:'bd',tag:tag,msg:'5H 산도가 접종후보다 낮습니다'});
    if(r.aF!=null&&r.a5!=null&&r.aF<r.a5)out.push({lvl:'bd',tag:tag,msg:'종결 산도가 5H보다 낮습니다'});
    if(r.afm!=null&&r.afm<300)out.push({lvl:'wa',tag:tag,msg:'종결분이 300분 미만입니다'});
    if(r.amb!=null&&(r.amb<5||r.amb>55))out.push({lvl:'wa',tag:tag,msg:'실내온도 '+r.amb+'℃ — 범위 이탈'});
    if(r.aF!=null&&(r.aF<0.85||r.aF>1.08))out.push({lvl:'wa',tag:tag,msg:'종결 산도 '+r.aF+' — 범위 이탈'});
  });
  return out;
}
function dtmCoverage(){
  const keys=[['a0','살균후'],['a1','접종후'],['a5','5H'],['aF','종결'],['afm','종결분'],
    ['tt','설정TT'],['amb','실내'],['cool','냉각'],['hot','핫워터'],
    ['vs1','점도1차'],['vsF','점도종결'],['phF','pH종결'],['brF','당도종결'],['trans','총이송']];
  const n=state.recs.length||1;
  return keys.map(k=>({k:k[0],l:k[1],n:state.recs.filter(r=>r[k[0]]!=null).length,p:state.recs.filter(r=>r[k[0]]!=null).length/n}));
}
function dtmCardHTML(){
  const n=state.recs.length;
  const iss=dtmIssues();
  const bd=iss.filter(i=>i.lvl==='bd').length;
  const wa=iss.filter(i=>i.lvl==='wa').length;
  const cov=dtmCoverage();
  const lastAB=(function(){try{return localStorage.getItem(DTM_LAST);}catch(e){return null;}})();
  const days=lastAB?Math.floor((Date.now()-new Date(lastAB.slice(0,10)).getTime())/86400000):null;
  const snap=(function(){try{const s=localStorage.getItem(DTM_SNAP);return s?JSON.parse(s):null;}catch(e){return null;}})();
  const state_chip=bd?'bd':(wa?'wa':'ok');
  return '<div class="sec" id="dtmCard"><div class="sech"><h2>데이터 관리</h2><span class="hint">저장 상태 · 무결성 · 백업</span></div>'
  +'<div class="card pad">'
  +'<div class="grid-3" style="gap:10px">'
  +'<div><div class="lb note">저장 방식</div><div style="font-size:15px;font-weight:750;margin-top:4px">'+dtmStoreName()+'</div>'
    +(dtmDanger()?'<div class="note" style="color:#C6384A">임시 저장 — 앱을 끄면 사라집니다</div>':'<div class="note">앱을 꺼도 유지됩니다</div>')+'</div>'
  +'<div><div class="lb note">무결성</div><div style="font-size:15px;font-weight:750;margin-top:4px">'
    +(bd?bd+'건 오류':'오류 없음')+(wa?' · '+wa+'건 확인':'')+'</div>'
    +'<div class="note">'+n+'배치 점검</div></div>'
  +'<div><div class="lb note">자동 백업</div><div style="font-size:15px;font-weight:750;margin-top:4px">'
    +(lastAB?(days===0?'오늘 완료':days+'일 전'):'기록 없음')+'</div>'
    +'<div class="note">'+(days==null?'아래 버튼으로 시작':(days>7?'7일 넘었습니다':'정상'))+'</div></div>'
  +'</div>'
  +'<div class="hr"></div>'
  +'<div style="font-size:15px;font-weight:750;margin-bottom:8px">항목별 입력률</div>'
  +'<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px">'
  +cov.map(c=>{
      const col=c.p>=0.95?'#1B7F52':(c.p>=0.6?'#B4690E':'#C6384A');
      return '<div><div class="note" style="margin-bottom:3px">'+c.l+'</div>'
        +'<div style="height:6px;border-radius:3px;background:#EEF2F6;overflow:hidden"><div style="width:'+Math.round(c.p*100)+'%;height:100%;background:'+col+'"></div></div>'
        +'<div class="note" style="margin-top:2px">'+Math.round(c.p*100)+'%</div></div>';
    }).join('')
  +'</div>'
  +'<div class="hr"></div>'
  +'<div class="row" style="gap:8px;flex-wrap:wrap">'
  +'<button class="btn sm pri" onclick="dtmAutoBackup(true)">지금 백업</button>'
  +'<button class="btn sm gho" onclick="dtmCheck()">무결성 점검</button>'
  +(snap?'<button class="btn sm gho" onclick="dtmUndo()">직전 상태로 되돌리기</button>':'')
  +'</div>'
  +(snap?'<div class="note" style="margin-top:8px">되돌리기 지점: '+snap.label+' · '+snap.date+' · '+snap.n+'건</div>':'')
  +'<div class="alert '+(bd?'a':(wa?'w':'i'))+'" style="margin-top:12px"><div>'
    +(bd?('<b>오류 '+bd+'건</b> — 데이터가 어긋난 기록이 있습니다. 아래 점검에서 목록을 확인하세요.')
      :(wa?('<b>확인 '+wa+'건</b> — 값이 비었거나 범위를 벗어난 기록이 있습니다. 판정에는 영향이 없습니다.')
        :('저장된 '+n+'배치 모두 정상입니다.')))+'</div></div>'
  +'</div></div>';
}
function dtmCheck(){
  const iss=dtmIssues();
  const bd=iss.filter(i=>i.lvl==='bd'),wa=iss.filter(i=>i.lvl==='wa');
  const list=bd.concat(wa).slice(0,60);
  openModal('무결성 점검 결과',
    '<div class="alert '+(bd.length?'a':'i')+'"><div>점검 대상 <b>'+state.recs.length+'배치</b> · 오류 <b>'+bd.length+'건</b> · 확인 <b>'+wa.length+'건</b></div></div>'
    +(list.length?'<div style="max-height:340px;overflow:auto;margin-top:12px"><table><thead><tr><th class="l">구분</th><th class="l">기록</th><th class="l">내용</th></tr></thead><tbody>'
      +list.map(i=>'<tr><td class="l"><span class="chip '+(i.lvl==='bd'?'bd':'wa')+'" style="height:18px;font-size:10px">'+(i.lvl==='bd'?'오류':'확인')+'</span></td>'
        +'<td class="l">'+i.tag+'</td><td class="l">'+i.msg+'</td></tr>').join('')
      +'</tbody></table></div>'
      +(list.length<bd.length+wa.length?'<div class="note" style="margin-top:8px">'+(bd.length+wa.length-list.length)+'건은 표시하지 않았습니다.</div>':'')
      :'<div class="note" style="margin-top:12px">문제가 발견되지 않았습니다.</div>'),
    '<button class="btn pri" onclick="closeModal()">닫기</button>');
}
/* ---------- 백업 ---------- */
function dtmPayload(){
  return '﻿'+JSON.stringify({app:'syncheon-pms',ver:(typeof appVer==='function'?appVer():'?'),at:new Date().toISOString(),count:state.recs.length,recs:state.recs},null,0);
}
function dtmFileName(kind){return 'PMS_'+(kind||'backup')+'_'+dtmStamp()+'.json';}
function dtmSave(payload,name){
  const b=(typeof br==='function')?br():null;
  if(b&&b.saveFile){try{const p=b.saveFile(name,payload);if(p)return p;}catch(e){}}
  try{
    const blob=new Blob([payload],{type:'application/json;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
    document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1200);
    return name;
  }catch(e){return null;}
}
function dtmAutoBackup(force){
  if(!state.recs.length){toast('백업할 기록이 없습니다');return;}
  const last=(function(){try{return localStorage.getItem(DTM_LAST);}catch(e){return null;}})();
  const today=dtmToday();
  if(!force&&last&&last.slice(0,10)===today)return;
  const name=dtmFileName('backup');
  const p=dtmSave(dtmPayload(),name);
  if(!p){if(force)toast('백업 파일을 저장하지 못했습니다');return;}
  try{localStorage.setItem(DTM_LAST,new Date().toISOString());}catch(e){}
  try{localStorage.setItem('pms_autobk_name',name);}catch(e){}
  const c=document.getElementById('dtmCard');if(c)c.outerHTML=dtmCardHTML();
  if(force)toast(state.recs.length+'건 백업 완료 — '+name);
}
/* ---------- 되돌리기 스냅샷 ---------- */
function dtmSnapshot(label){
  try{
    localStorage.setItem(DTM_SNAP,JSON.stringify({label:label||'작업 전',date:dtmStamp(),n:state.recs.length,recs:state.recs}));
  }catch(e){}
}
function dtmHasSnap(){try{return !!localStorage.getItem(DTM_SNAP);}catch(e){return false;}}
function dtmUndo(){
  let s=null;
  try{s=JSON.parse(localStorage.getItem(DTM_SNAP)||'null');}catch(e){}
  if(!s||!s.recs)return;
  openModal('직전 상태로 되돌리기',
    '<div class="alert w"><div><b>'+s.label+'</b> 시점('+s.date+' · '+s.n+'건)으로 되돌립니다.<br>'
    +'지금 기록 <b>'+state.recs.length+'건</b>은 사라집니다. 먼저 백업하지 않았다면 되돌릴 수 없습니다.</div></div>',
    '<button class="btn gho" onclick="closeModal()">취소</button>'
    +'<button class="btn pri" onclick="closeModal();dtmUndoDo()">되돌리기</button>');
}
function dtmUndoDo(){
  let s=null;
  try{s=JSON.parse(localStorage.getItem(DTM_SNAP)||'null');}catch(e){}
  if(!s||!s.recs)return;
  const list=s.recs.slice();
  dbBulk('batches',list).then(()=>{
    state.recs=list.sort((a,b)=>a.date<b.date?1:(a.date>b.date?-1:0));
    try{localStorage.removeItem(DTM_SNAP);}catch(e){}
    state.pageIdx=0;buildGuide();render();
    toast(s.n+'건으로 되돌렸습니다');
  }).catch(()=>toast('되돌리기에 실패했습니다'));
}
/* 앱 시작 시 하루 1회 자동 백업 */
(function(){
  if(typeof window.boot!=='function')return;
  const ob=window.boot;
  window.boot=function(){
    ob.apply(this,arguments);
    setTimeout(function(){try{dtmAutoBackup(false);}catch(e){}},3500);
  };
})();
