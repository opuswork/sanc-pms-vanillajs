/* ===== 엑셀(CSV) 자동 저장 — 태블릿 '다운로드/SynCheon' 폴더 ===== */
const XL_PREF='pms_xl_auto';
let XL_LAST=null;
const XL_COLS=[
  ['date','제조일'],['tank','탱크'],['ton','톤수'],['tt','설정TT'],['milk','살균유'],
  ['t1','1H발효액'],['t5','5H발효액'],['amb','실내온도'],['cool','살균냉각'],['hot','핫워터'],
  ['a0','살균후'],['a1','접종후(1H)'],['a5','1차샘플(5H)'],['aF','종결'],['afm','종결분'],['mins','시간'],['trans','총이송'],
  ['asS','산도서지1'],['asP','산도완제품1'],
  ['vs1','점도1차'],['vsF','점도종결'],['vsS','점도서지1'],['vsP','점도완제품1'],
  ['ph0','pH살균후'],['ph1','pH1H'],['ph5','pH5H'],['phF','pH종결'],['phS','pH서지1'],['phP','pH완제품1'],
  ['br0','당도살균후'],['br1','당도접종후'],['brF','당도종결'],['brS','당도서지1'],['brP','당도완제품1'],['note','비고']
];
function xlOn(){try{return localStorage.getItem(XL_PREF)!=='0';}catch(e){return true;}}
function xlSet(v){try{localStorage.setItem(XL_PREF,v?'1':'0');}catch(e){}}
function xlToggle(){
  xlSet(!xlOn());
  const c=document.getElementById('xlCard');if(c)c.outerHTML=xlCardHTML();
  toast(xlOn()?'저장할 때마다 엑셀 파일을 자동으로 갱신합니다':'자동 저장을 껐습니다');
}
function xlPad(n){return n<10?'0'+n:''+n;}
function xlStamp(d){
  d=d||new Date();
  return d.getFullYear()+'-'+xlPad(d.getMonth()+1)+'-'+xlPad(d.getDate())+'_'+xlPad(d.getHours())+xlPad(d.getMinutes());
}
function xlNum(v){
  if(v==null||v==='')return '';
  return (typeof v==='number')?String(v):String(v).replace(/,/g,'').trim();
}
function xlCell(v){
  if(v==null)return '';
  let s=String(v);
  if(/[",\r\n]/.test(s))s='"'+s.replace(/"/g,'""')+'"';
  return s;
}
function xlBuildCSV(recs){
  const lines=[];
  lines.push(XL_COLS.map(c=>xlCell(c[1])).join(','));
  recs.forEach(r=>{
    lines.push(XL_COLS.map(c=>{
      const k=c[0];
      if(k==='note')return xlCell((r.note||'').replace(/[\r\n]+/g,' '));
      if(k==='date')return xlCell(r.date||'');
      return xlCell(xlNum(r[k]));
    }).join(','));
  });
  return lines.join('\r\n')+'\r\n';
}
function xlExport(silent){
  const b=(typeof br==='function')?br():(window.AndroidBridge||null);
  if(!b||!b.saveFile){
    if(!silent)toast('파일 저장은 태블릿 앱(APK)에서만 됩니다');
    return null;
  }
  if(!state||!state.recs||!state.recs.length){if(!silent)toast('저장할 기록이 없습니다');return null;}
  const recs=state.recs.slice().sort((a,c)=>a.date<c.date?1:(a.date>c.date?-1:0));
  const csv='\ufeff'+xlBuildCSV(recs);
  const name='공정데이터_'+xlStamp()+'.csv';
  let path=null;
  try{path=b.saveFile(name,csv);}catch(e){path=null;}
  if(path){
    XL_LAST={name:name,path:path,ts:Date.now(),rows:recs.length};
    try{localStorage.setItem('pms_xl_last',JSON.stringify(XL_LAST));}catch(e){}
    if(!silent)toast(recs.length+'건을 엑셀 파일로 저장했습니다');
    const c=document.getElementById('xlCard');if(c)c.outerHTML=xlCardHTML();
  }else if(!silent){toast('파일 저장에 실패했습니다');}
  return path;
}
function xlRestore(){
  try{const s=localStorage.getItem('pms_xl_last');if(s)XL_LAST=JSON.parse(s);}catch(e){}
}
function xlCardHTML(){
  xlRestore();
  const on=xlOn();
  const b=(typeof br==='function')?br():null;
  const native=!!(b&&b.saveFile);
  let last='<span class="note">아직 저장한 파일이 없습니다</span>';
  if(XL_LAST){
    const d=new Date(XL_LAST.ts);
    last='<b>'+XL_LAST.name+'</b><div class="note" style="margin-top:2px">'
      +d.getFullYear()+'.'+xlPad(d.getMonth()+1)+'.'+xlPad(d.getDate())+' '
      +xlPad(d.getHours())+':'+xlPad(d.getMinutes())+' · '+XL_LAST.rows+'건 전체</div>';
  }
  return '<div class="sec" id="xlCard"><div class="sech"><h2>엑셀 파일 자동 저장</h2>'
    +'<span class="hint">'+(on?'자동 켜짐':'자동 꺼짐')+'</span></div>'
    +'<div class="card pad">'
    +'<div class="row" style="justify-content:space-between;align-items:center">'
    +'<div><div style="font-size:26px;font-weight:780;letter-spacing:-.5px">저장할 때마다 엑셀 파일 갱신</div>'
    +'<div class="note" style="margin-top:4px">입력 즉시 <b>다운로드/SynCheon</b> 폴더에 CSV 파일이 하나 더 만들어집니다. '
    +'파일을 열면 지금까지의 모든 기록이 들어 있습니다.</div></div>'
    +'<button class="btn '+(on?'pri':'gho')+'" onclick="xlToggle()">'+(on?'자동 저장 켜짐':'자동 저장 꺼짐')+'</button>'
    +'</div>'
    +'<div class="row" style="margin-top:14px;gap:16px;align-items:center">'
    +'<button class="btn pri" onclick="xlExport(false)">지금 엑셀 파일 만들기</button>'
    +'<div>'+last+'</div></div>'
    +(native?'':'<div class="alert w" style="margin-top:12px"><div>웹 브라우저에서는 파일을 저장할 수 없습니다. 태블릿 앱(APK)에서 사용하세요.</div></div>')
    +'<div class="alert i" style="margin-top:12px"><div>'
    +'<b>여는 방법</b> — 태블릿의 <b>내 파일 → 다운로드 → SynCheon</b> 에서 가장 최근 <b>.csv</b> 파일을 누르면 엑셀(또는 한셀·구글시트)로 열립니다. '
    +'파일을 PC로 옮겨도 그대로 열립니다.</div></div>'
    +'<div class="note" style="margin-top:8px">파일 이름에 저장 시각이 붙습니다(예: 공정데이터_2026-11-11_1105.csv). '
    +'같은 이름이 겹치지 않아 이전 파일이 덮어써지지 않습니다 — 오래된 파일은 지워도 앱 데이터는 그대로 남습니다.</div>'
    +'</div></div>';
}
function xlMount(){
  const v=document.getElementById('view');
  if(!v||document.getElementById('xlCard'))return;
  if(typeof state==='undefined'||state.page!=='data')return;
  v.insertAdjacentHTML('afterbegin',xlCardHTML());
}
/* 저장 이벤트 연결 — dbPut(배치 저장) 완료 시 자동 갱신 */
(function(){
  if(typeof dbPut==='function'){
    const orig=dbPut;
    dbPut=function(store,val){
      const p=orig(store,val);
      if(store==='batches'&&xlOn()){
        try{if(p&&p.then)p.then(function(){setTimeout(function(){xlExport(true);},500);});}catch(e){}
      }
      return p;
    };
  }
})();
