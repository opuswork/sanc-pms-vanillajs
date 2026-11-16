/* ===== 엑셀·CSV 일괄 가져오기 ===== */
let IMP=null;
const IMP_GROUPN={'산도':'a','점도':'v','PH':'p','ph':'p','pH':'p','당도':'b'};

function impEsc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function impUnesc(s){
  return String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
    .replace(/&apos;/g,"'").replace(/&#(\d+);/g,(m,d)=>String.fromCharCode(+d)).replace(/&amp;/g,'&');
}
function impNorm(s){
  return String(s==null?'':s).replace(/\s+/g,'').replace(/[()]/g,'').replace(/·/g,'').toUpperCase();
}
function impNum(v){
  if(v==null||v==='')return null;
  const s=String(v).replace(/,/g,'').replace(/[^0-9.\-]/g,'');
  if(s===''||s==='-'||s==='.')return null;
  const n=Number(s);
  return isNaN(n)?null:n;
}
function impDate(v){
  if(v==null||v==='')return null;
  let sn=null;
  if(typeof v==='number')sn=v;
  else if(/^\d{5}(\.\d+)?$/.test(String(v).trim()))sn=Number(String(v).trim());
  if(sn!=null&&sn>20000&&sn<80000){
    const d=new Date(Date.UTC(1899,11,30)+Math.round(sn)*86400000);
    return d.toISOString().slice(0,10);
  }
  const s=String(v).trim();
  const m=/^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/.exec(s);
  if(m)return m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2);
  const m2=/^(\d{1,2})[-.\/](\d{1,2})[-.\/](\d{2,4})/.exec(s);
  if(m2){
    let y=+m2[3]; if(y<100)y+=2000;
    return y+'-'+('0'+m2[1]).slice(-2)+'-'+('0'+m2[2]).slice(-2);
  }
  return null;
}
function impColIdx(letters){
  let n=0;
  for(let i=0;i<letters.length;i++)n=n*26+(letters.charCodeAt(i)-64);
  return n-1;
}
function impInflateRaw(u8){
  if(typeof DecompressionStream==='undefined')
    return Promise.reject(new Error('이 기기에서는 xlsx를 바로 읽을 수 없습니다. 엑셀에서 CSV로 저장해 주세요.'));
  const ds=new DecompressionStream('deflate-raw');
  const stream=new Blob([u8]).stream().pipeThrough(ds);
  return new Response(stream).arrayBuffer().then(b=>new Uint8Array(b));
}
function impZip(buf){
  const u8=new Uint8Array(buf), dv=new DataView(buf);
  let eocd=-1;
  for(let i=u8.length-22;i>=Math.max(0,u8.length-66000);i--){
    if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;}
  }
  if(eocd<0)throw new Error('압축 구조를 읽을 수 없습니다');
  const n=dv.getUint16(eocd+10,true), cdOff=dv.getUint32(eocd+16,true);
  const ents={}; let p=cdOff;
  for(let i=0;i<n;i++){
    if(dv.getUint32(p,true)!==0x02014b50)break;
    const method=dv.getUint16(p+10,true);
    const csize=dv.getUint32(p+20,true);
    const fnLen=dv.getUint16(p+28,true), exLen=dv.getUint16(p+30,true), cmLen=dv.getUint16(p+32,true);
    const lho=dv.getUint32(p+42,true);
    const name=new TextDecoder('utf-8').decode(u8.subarray(p+46,p+46+fnLen));
    ents[name]={method:method,csize:csize,lho:lho};
    p+=46+fnLen+exLen+cmLen;
  }
  return {u8:u8,dv:dv,ents:ents};
}
function impEntry(z,name){
  const e=z.ents[name];
  if(!e)return Promise.resolve(null);
  const p=e.lho;
  const fnLen=z.dv.getUint16(p+26,true), exLen=z.dv.getUint16(p+28,true);
  const start=p+30+fnLen+exLen;
  const comp=z.u8.subarray(start,start+e.csize);
  if(e.method===0)return Promise.resolve(comp);
  return impInflateRaw(comp);
}
function impShared(xml){
  const out=[];
  const re=/<si>([\s\S]*?)<\/si>/g; let m;
  while((m=re.exec(xml))){
    const ts=m[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g)||[];
    out.push(ts.map(t=>impUnesc(t.replace(/<[^>]+>/g,''))).join(''));
  }
  return out;
}
function impSheet(xml,shared){
  const rows=[];
  const rowRe=/<row([^>]*)>([\s\S]*?)<\/row>/g; let m;
  while((m=rowRe.exec(xml))){
    const rAttr=/r="(\d+)"/.exec(m[1]);
    const ri=rAttr?parseInt(rAttr[1],10)-1:rows.length;
    const cells=[];
    const cellRe=/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let c;
    while((c=cellRe.exec(m[2]))){
      const attrs=c[1]||'', body=c[2]||'';
      const ref=/r="([A-Z]+)\d+"/.exec(attrs);
      const col=ref?impColIdx(ref[1]):cells.length;
      const t=/t="([^"]+)"/.exec(attrs);
      const vt=/<v>([\s\S]*?)<\/v>/.exec(body);
      let val=null;
      if(t&&t[1]==='s'&&vt){val=shared[parseInt(vt[1],10)];}
      else if(t&&t[1]==='inlineStr'){const it=/<t[^>]*>([\s\S]*?)<\/t>/.exec(body);val=it?impUnesc(it[1]):null;}
      else if(vt){val=impUnesc(vt[1]);}
      cells[col]=val;
    }
    rows[ri]=cells;
  }
  return rows;
}
function impCsvText(txt){
  const rows=[]; let row=[], cur='', q=false;
  for(let i=0;i<txt.length;i++){
    const ch=txt[i];
    if(q){
      if(ch==='"'){
        if(txt[i+1]==='"'){cur+='"';i++;}
        else q=false;
      } else cur+=ch;
    } else {
      if(ch==='"')q=true;
      else if(ch===','){row.push(cur);cur='';}
      else if(ch==='\n'){row.push(cur);cur='';rows.push(row);row=[];}
      else if(ch==='\r'){}
      else cur+=ch;
    }
  }
  if(cur!==''||row.length){row.push(cur);rows.push(row);}
  return rows;
}
function impMapCol(header,group){
  const h=impNorm(header), g=IMP_GROUPN[group]||IMP_GROUPN[String(group).trim()]||'';
  if(h.indexOf('제조일')>=0||h==='DATE'||h==='일자')return 'date';
  if(h.indexOf('톤수')>=0||h==='TON')return 'ton';
  if(h.indexOf('탱크NO')>=0||h==='TANK'||h.indexOf('탱크번호')>=0)return 'tank';
  if(h.indexOf('발효탱크TT')>=0||h==='TT'||h.indexOf('설정TT')>=0)return 'tt';
  if(h.indexOf('살균유')>=0)return 'milk';
  if(h.indexOf('1H발효액')>=0)return 't1';
  if(h.indexOf('5H발효액')>=0)return 't5';
  if(h.indexOf('실내온도')>=0)return 'amb';
  if(h.indexOf('살균냉각')>=0)return 'cool';
  if(h.indexOf('핫워터')>=0)return 'hot';
  if(h.indexOf('총이송')>=0)return 'trans';
  if(h==='시간')return 'mins';
  if(h.indexOf('종결분')>=0)return 'afm';
  if(g==='a'){
    if(h.indexOf('살균후')>=0)return 'a0';
    if(h.indexOf('접종후')>=0)return 'a1';
    if(h.indexOf('1차')>=0)return 'a5';
    if(h.indexOf('종결')>=0)return 'aF';
    if(h.indexOf('서지')>=0)return 'asS';
    if(h.indexOf('완제품')>=0)return 'asP';
  }
  if(g==='v'){
    if(h.indexOf('1차')>=0)return 'vs1';
    if(h.indexOf('종결')>=0)return 'vsF';
    if(h.indexOf('서지')>=0)return 'vsS';
    if(h.indexOf('완제품')>=0)return 'vsP';
  }
  if(g==='p'){
    if(h.indexOf('살균후')>=0)return 'ph0';
    if(h.indexOf('접종후')>=0)return 'ph1';
    if(h.indexOf('1차')>=0)return 'ph5';
    if(h.indexOf('종결')>=0)return 'phF';
    if(h.indexOf('서지')>=0)return 'phS';
    if(h.indexOf('완제품')>=0)return 'phP';
  }
  if(g==='b'){
    if(h.indexOf('살균후')>=0)return 'br0';
    if(h.indexOf('접종후')>=0)return 'br1';
    if(h.indexOf('종결')>=0)return 'brF';
    if(h.indexOf('서지')>=0)return 'brS';
    if(h.indexOf('완제품')>=0)return 'brP';
  }
  return null;
}
function impAnalyze(rows){
  let hdr=-1;
  for(let i=0;i<Math.min(rows.length,15);i++){
    const r=rows[i]||[];
    let hit=0;
    r.forEach(c=>{const s=impNorm(c);if(s.indexOf('제조일')>=0||s.indexOf('탱크')>=0||s==='톤수')hit++;});
    if(hit>=2&&(!(rows[hdr]||[]).length||hit>2)){hdr=i;if(hit>=3)break;}
  }
  if(hdr<0)throw new Error('머리글 줄(제조일·탱크)을 찾지 못했습니다');
  const header=rows[hdr]||[];
  const grow=hdr>0?(rows[hdr-1]||[]):[];
  let lastG='';
  const cols=header.map((h,ci)=>{
    let g=grow[ci];
    if(g==null||String(g).trim()==='')g=IMP_GROUPN[lastG]?lastG:'';
    else if(IMP_GROUPN[String(g).trim()])lastG=String(g).trim();
    let name=h;
    const hs=String(h==null?'':h);
    if(hs.indexOf('/')>0){
      const parts=hs.split('/');
      const g0=String(parts[0]).trim();
      if(IMP_GROUPN[g0]||IMP_GROUPN[g0.toUpperCase()]){g=g0;name=parts.slice(1).join('/');}
    }
    const key=impMapCol(name,g);
    return {ci:ci,name:String(name==null?'':name).trim(),group:g,key:key};
  });
  const mapped=cols.filter(c=>c.key);
  if(!mapped.length)throw new Error('가져올 수 있는 열이 없습니다');
  if(!mapped.some(c=>c.key==='date')||!mapped.some(c=>c.key==='tank'))
    throw new Error('제조일과 탱크 열이 필요합니다');
  const recs=[]; let bad=0;
  for(let r=hdr+1;r<rows.length;r++){
    const row=rows[r];
    if(!row||!row.length)continue;
    const o={};
    mapped.forEach(c=>{
      const v=row[c.ci];
      if(c.key==='date')o.date=impDate(v);
      else if(c.key==='tank')o.tank=v==null||v===''?null:String(v).trim().replace(/\.0$/,'');
      else o[c.key]=impNum(v);
    });
    if(!o.date||!o.tank){if(row.some(x=>x!=null&&x!==''))bad++;continue;}
    o.id=o.date+'|'+o.tank;
    recs.push(o);
  }
  return {header:header,hdr:hdr,cols:cols,mapped:mapped,recs:recs,bad:bad,rows:rows};
}
function impSampleTable(a){
  const keys=a.mapped.map(c=>c.key).filter(k=>k!=='date'&&k!=='tank').slice(0,8);
  const th=['제조일','탱크'].concat(keys).map(k=>{
    let l=k;
    if(k==='date')l='제조일';else if(k==='tank')l='탱크';
    else{
      const c=a.mapped.find(x=>x.key===k);
      l=c?c.name:k;
    }
    return '<th>'+impEsc(l)+'</th>';
  }).join('');
  const tb=a.recs.slice(0,6).map(r=>{
    const tds=['<td>'+impEsc(r.date)+'</td>','<td>'+impEsc(r.tank)+'</td>'];
    keys.forEach(k=>tds.push('<td>'+(r[k]==null?'<span class="note">–</span>':impEsc(r[k]))+'</td>'));
    return '<tr>'+tds.join('')+'</tr>';
  }).join('');
  return '<table><thead><tr>'+th+'</tr></thead><tbody>'+tb+'</tbody></table>';
}
function impCardHTML(){
  const on=!!IMP;
  return '<div class="sec" id="impCard"><div class="sech"><h2>엑셀 일괄 가져오기</h2>'
    +'<span class="hint">'+(on?IMP.recs.length+'건 인식됨':'CSV · XLSX')+'</span></div>'
    +'<div class="card pad">'
    +'<div style="font-size:26px;font-weight:780;letter-spacing:-.5px">일보 파일을 한 번에 넣기</div>'
    +'<div class="note" style="margin-top:4px">품질일보 엑셀(<b>.xlsx</b>)이나 <b>.csv</b>를 그대로 선택하세요. '
    +'머리글을 읽어 열을 자동으로 맞추고, 같은 날짜·탱크는 기존 기록에 값을 채워 넣습니다.</div>'
    +'<div class="row" style="margin-top:14px;gap:10px;align-items:center">'
    +'<input type="file" id="impFileInput" accept=".csv,.xlsx,text/csv" style="display:none" onchange="impHandle(this)">'
    +'<button class="btn pri" onclick="impPick()">파일 선택</button>'
    +(on?'<button class="btn gho" onclick="impClear()">취소</button>':'')
    +'<div class="note">'+(on?impEsc(IMP.fileName||''):'')+'</div></div>'
    +'<div class="alert i" style="margin-top:12px"><div>'
    +'<b>엑셀 그대로</b> — 일보의 산도·점도·pH·당도 구역을 구역별로 구분해 읽습니다. '
    +'산도차·분당산도는 자동 계산되므로 무시됩니다.</div></div>'
    +'</div></div>';
}
function impPick(){
  const el=document.getElementById('impFileInput');
  if(!el){toast('파일 입력을 찾을 수 없습니다');return;}
  el.value='';el.click();
}
function impClear(){
  IMP=null;
  const c=document.getElementById('impCard');if(c)c.outerHTML=impCardHTML();
  toast('가져오기를 취소했습니다');
}
function impHandle(inp){
  const f=inp.files&&inp.files[0];
  if(!f)return;
  const name=f.name||'';
  const isXlsx=/\.xlsx$/i.test(name);
  toast('파일을 읽는 중입니다');
  const rd=new FileReader();
  rd.onerror=()=>toast('파일을 읽지 못했습니다');
  rd.onload=()=>{
    const run=rows=>{
      try{
        const a=impAnalyze(rows);
        a.fileName=name;
        IMP=a;
        const c=document.getElementById('impCard');if(c)c.outerHTML=impCardHTML();
        impPreview();
      }catch(e){toast('읽기 실패: '+e.message);}
    };
    if(isXlsx){
      try{
        const z=impZip(rd.result);
        const names=Object.keys(z.ents);
        let sheet=names.filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0];
        const jobs=[impEntry(z,sheet)];
        jobs.push(z.ents['xl/sharedStrings.xml']?impEntry(z,'xl/sharedStrings.xml'):Promise.resolve(null));
        Promise.all(jobs).then(res=>{
          const shXml=new TextDecoder('utf-8').decode(res[0]);
          const sh=res[1]?impShared(new TextDecoder('utf-8').decode(res[1])):[];
          run(impSheet(shXml,sh));
        }).catch(err=>toast('xlsx 해석 실패: '+err.message));
      }catch(e){toast('xlsx 열기 실패: '+e.message);}
    } else {
      const txt=typeof rd.result==='string'?rd.result:new TextDecoder('utf-8').decode(new Uint8Array(rd.result));
      run(impCsvText(txt.replace(/^\ufeff/,'')));
    }
  };
  if(isXlsx)rd.readAsArrayBuffer(f);else rd.readAsText(f,'utf-8');
}
function impPreview(){
  if(!IMP)return;
  const exist={};state.recs.forEach(r=>exist[r.id]=1);
  const upd=IMP.recs.filter(r=>exist[r.id]).length;
  const neu=IMP.recs.length-upd;
  const unmapped=IMP.cols.filter(c=>!c.key&&String(c.name).trim()!=='');
  const body='<div class="alert i"><div><b>'+IMP.recs.length+'건</b>을 읽었습니다. '
    +'신규 <b>'+neu+'건</b> · 기존 보강 <b>'+upd+'건</b>'
    +(IMP.bad?' · 건너뜀 '+IMP.bad+'줄':'')+'</div></div>'
    +'<div style="max-height:300px;overflow:auto;margin-top:12px">'+impSampleTable(IMP)+'</div>'
    +(unmapped.length?'<div class="note" style="margin-top:10px">무시된 열: '+impEsc(unmapped.map(c=>c.name).join(', '))+'</div>':'')
    +'<div class="note" style="margin-top:8px">기존 기록은 빈 칸만 채우고, 값이 있으면 새 값으로 바꿉니다.</div>';
  openModal('가져오기 확인',body,
    '<button class="btn gho" onclick="closeModal()">취소</button>'
    +'<button class="btn pri" onclick="closeModal();impCommit()">'+IMP.recs.length+'건 가져오기</button>');
}
function impCommit(){
  if(!IMP||!IMP.recs.length)return;
  try{dtmSnapshot('가져오기 전');}catch(e){}
  const exist={};state.recs.forEach(r=>exist[r.id]=1);
  const list=IMP.recs.slice();
  let i=0,neu=0,upd=0;
  const step=()=>{
    if(i>=list.length){
      state.recs.sort((a,b)=>a.date<b.date?1:(a.date>b.date?-1:0));
      IMP=null;
      const c=document.getElementById('impCard');if(c)c.outerHTML=impCardHTML();
      buildGuide();render();
      toast('가져오기 완료 — 신규 '+neu+'건 · 보강 '+upd+'건');
      if(typeof xlOn==='function'&&xlOn())setTimeout(()=>{try{xlExport(true);}catch(e){}},600);
      return;
    }
    const o=list[i++];
    const prev=exist[o.id]?state.recs.find(r=>r.id===o.id):null;
    const merged=Object.assign({},prev||{},o);
    if(prev){
      upd++;
      if(o.afm!=null)merged.mins=o.afm-300;
    } else {
      neu++;
      merged.src='import';
      merged.ts=Date.now();
      if(o.afm!=null)merged.mins=o.afm-300;
    }
    merged.id=o.id;
    if(!merged.src)merged.src=prev&&prev.src?prev.src:'import';
    dbPut('batches',merged).then(()=>{
      const k=state.recs.findIndex(r=>r.id===o.id);
      if(k>=0)state.recs[k]=merged;else state.recs.push(merged);
      step();
    }).catch(()=>step());
  };
  step();
}
