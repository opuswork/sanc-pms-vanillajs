/* ===== 관리 탭 : 추천 온도 · 작년 동일 날짜 대조 · 보정 처방 ===== */
const MGT={
  // 실측 데이터(317배치)로 산출한 기본 계수. 데이터가 늘면 자동 재적합.
  dur:{b0:628.63,b1:0.7288,b2:-7.011,b3:-0.1437,r2:0.43,n:317},
  tt:{b0:42.91,b1:-0.1232,r2:0.63,n:317},
  hotMargin:0.4, hotLo:38.0, hotHi:41.0, coolLo:37.7, coolHi:42.0
};
function solve4(A,b){
  const n=b.length,M=A.map((r,i)=>r.concat(b[i]));
  for(let i=0;i<n;i++){
    let p=i;for(let k=i+1;k<n;k++)if(Math.abs(M[k][i])>Math.abs(M[p][i]))p=k;
    const t=M[i];M[i]=M[p];M[p]=t;
    if(Math.abs(M[i][i])<1e-12)return null;
    for(let k=i+1;k<n;k++){const f=M[k][i]/M[i][i];
      for(let j=i;j<=n;j++)M[k][j]-=f*M[i][j];}
  }
  const x=new Array(n).fill(0);
  for(let i=n-1;i>=0;i--){let s=M[i][n];for(let j=i+1;j<n;j++)s-=M[i][j]*x[j];x[i]=s/M[i][i];}
  return x;
}
function fitMul(rows,keys,yk){
  const A=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],b=[0,0,0,0];
  let n=0,ys=0,yy=0;
  const xs=[];
  rows.forEach(r=>{
    const v=[1].concat(keys.map(k=>Number(r[k])));
    if(v.some(z=>isNaN(z)))return;
    const y=Number(r[yk]); if(isNaN(y))return;
    xs.push([v,y]); n++; ys+=y; yy+=y*y;
  });
  if(n<30)return null;
  xs.forEach(([v,y])=>{for(let i=0;i<4;i++){b[i]+=v[i]*y;for(let j=0;j<4;j++)A[i][j]+=v[i]*v[j];}});
  const c=solve4(A,b); if(!c)return null;
  let sse=0; xs.forEach(([v,y])=>{let p=0;for(let i=0;i<4;i++)p+=c[i]*v[i];sse+=(y-p)*(y-p);});
  const sst=yy-ys*ys/n; const r2=sst>0?1-sse/sst:0;
  return {b0:c[0],b1:c[1],b2:c[2],b3:c[3],r2:r2,n:n};
}
function durModel(){
  const m=fitMul(state.recs.filter(r=>r.amb!=null&&r.cool!=null&&r.hot!=null),['amb','cool','hot'],'afm');
  return m||Object.assign({},MGT.dur,{fixed:true});
}
function ttModel(){
  const rows=state.recs.filter(r=>r.amb!=null&&r.tt!=null);
  if(rows.length<20)return {b0:MGT.tt.b0,b1:MGT.tt.b1,r2:MGT.tt.r2,n:rows.length,fixed:true};
  let n=0,sx=0,sy=0,sxy=0,sxx=0,syy=0;
  rows.forEach(r=>{n++;sx+=r.amb;sy+=r.tt;sxy+=r.amb*r.tt;sxx+=r.amb*r.amb;syy+=r.tt*r.tt;});
  const b1=(n*sxy-sx*sy)/(n*sxx-sx*sx), b0=(sy-b1*sx)/n;
  const r2=Math.pow(n*sxy-sx*sy,2)/((n*sxx-sx*sx)*(n*syy-sy*sy));
  return {b0:b0,b1:b1,r2:r2,n:n};
}
function lastYearSame(dateStr){
  const y=Number(dateStr.slice(0,4))-1;
  const key=y+dateStr.slice(4);
  return state.recs.find(r=>r.date===key)||null;
}
function lastYearWindow(dateStr,days){
  const y=Number(dateStr.slice(0,4))-1;
  const base=new Date(y+dateStr.slice(4)+'T00:00:00');
  const out=[];
  state.recs.forEach(r=>{
    if(Number(r.date.slice(0,4))!==y)return;
    const d=new Date(r.date+'T00:00:00');
    const diff=Math.abs((d-base)/86400000);
    if(diff<=days)out.push(Object.assign({_diff:diff},r));
  });
  return out.sort((a,b)=>a.date<b.date?-1:1);
}
function mgtCompute(amb,target){
  const D=durModel(),T=ttModel();
  const tt=Math.max(37.0,Math.min(43.0,T.b0+T.b1*amb));
  let hot=Math.round((tt+MGT.hotMargin)*10)/10;
  hot=Math.max(MGT.hotLo,Math.min(MGT.hotHi,hot));
  // 목표 종결시간을 만족하는 살균냉각온도: dur = b0+b1*amb+b2*cool+b3*hot
  const cool=(D.b0+D.b1*amb+D.b3*hot-target)/Math.abs(D.b2);
  const pred=(coolVal)=>D.b0+D.b1*amb+D.b2*coolVal+D.b3*hot;
  return {D,T,tt:tt,hot:hot,cool:cool,coolInRange:cool>=MGT.coolLo&&cool<=MGT.coolHi,
          predAtCool:pred(cool),predNow:null};
}
let mgtAmb=null,mgtTarget=null;
function yesterdayRec(){
  const d=new Date(); d.setDate(d.getDate()-1);
  const key=d.toISOString().slice(0,10);
  const ex=state.recs.find(r=>r.date===key);
  if(ex)return ex;
  return state.recs.slice().sort((a,b)=>a.date<b.date?1:-1)[0]||null;
}
/* ---------- 차이 막대 차트 (0 기준 발산형, 촘촘한 축) ---------- */
function diffChart(items,opt){
  opt=opt||{};
  const w=720,rowH=opt.rowH||46,pl=opt.pl||168,pr=110,pt=16,pb=38;
  const h=pt+pb+items.length*rowH;
  const vals=items.map(i=>i.v).filter(v=>v!=null&&!isNaN(v));
  if(!vals.length)return '<div class="empty">데이터 없음</div>';
  const mx=Math.max.apply(null,vals.map(v=>Math.abs(v)))||1;
  const step=opt.step||(mx>50?10:(mx>10?5:(mx>1?0.5:(mx>0.1?0.02:0.005))));
  const top=Math.ceil(mx/step)*step;
  const x0=pl, x1=w-pr;
  const X=v=>x0+(x1-x0)*(0.5+v/(2*top));
  const zero=X(0);
  let g='';
  g+=`<line x1="${zero}" y1="${pt}" x2="${zero}" y2="${h-pb}" stroke="#B9C6D4" stroke-width="1.4"/>`;
  for(let t=-top;t<=top+1e-9;t+=step){
    const x=X(t); if(x<x0-1||x>x1+1)continue;
    if(Math.abs(t)>1e-9){
      g+=`<line x1="${x.toFixed(1)}" y1="${pt}" x2="${x.toFixed(1)}" y2="${h-pb}" stroke="#F0F4F8"/>`;
    }
    g+=`<text x="${x.toFixed(1)}" y="${h-14}" text-anchor="middle" font-size="13" fill="#7C8DA0">${opt.fmt2?opt.fmt2(t):t}</text>`;
  }
  items.forEach((it,i)=>{
    const y=pt+i*rowH+rowH/2;
    const has=it.v!=null&&!isNaN(it.v);
    g+=`<text x="${pl-12}" y="${y+5}" text-anchor="end" font-size="15" fill="#33475B" font-weight="700">${it.l}</text>`;
    if(it.sub)g+=`<text x="${pl-12}" y="${y+22}" text-anchor="end" font-size="12" fill="#94A3B2">${it.sub}</text>`;
    if(!has)return;
    const xx=X(it.v), bw=Math.max(2,Math.abs(xx-zero));
    const pos=it.v>=0;
    const col=it.color||(pos?'#C6384A':'#2B6CB0');
    g+=`<rect x="${(pos?zero:xx).toFixed(1)}" y="${(y-9).toFixed(1)}" width="${bw.toFixed(1)}" height="18" rx="3" fill="${col}" opacity=".85"/>`;
    const lbl=opt.fmt?opt.fmt(it.v):it.v;
    let tx,anc,fg=col;
    if(bw>76){fg='#fff';}
    if(pos){tx=zero+bw-8;anc='end';}
    else{tx=zero-bw+8;anc='start';}
    if(!pos&&(zero-bw)<pl+6){tx=zero+8;anc='start';fg='#2B6CB0';}
    g+=`<text x="${tx.toFixed(1)}" y="${y+5}" text-anchor="${anc}" font-size="15" font-weight="800" fill="${fg}">${lbl}</text>`;
  });
  if(opt.unit)g+=`<text x="${w-6}" y="${h-14}" text-anchor="end" font-size="12" fill="#A3B0BE">${opt.unit}</text>`;
  return `<svg class="ch" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
}

function viewManage(){
  const D=durModel(),T=ttModel();
  const today=new Date().toISOString().slice(0,10);
  const lyd=lastYearSame(today);
  const ly=lyd||state.recs.slice().sort((a,b)=>a.date<b.date?1:-1)[0];
  const jul=state.recs.filter(r=>r.date.slice(0,7)==='2026-07'&&r.aF!=null);
  const julBase=jul.length?jul:state.recs.filter(r=>seasonOf(r.date)==='summer'&&r.aF!=null);
  const jAvg=k=>mean(julBase.map(r=>r[k]));
  const jDer=f=>mean(julBase.map(r=>der(r)[f]));
  const julDur=jDer('dur'), julD1=jDer('d1'), julD5=jDer('d5'), julDF=jDer('df');
  const julCool=jAvg('cool'), julHot=jAvg('hot'), julAmb=jAvg('amb');
  const julTanks=[301,302,303].map(t=>{
    const g=julBase.filter(r=>Number(r.tank)===t);
    return {t:t,n:g.length,dur:mean(g.map(r=>der(r).dur))};
  }).filter(x=>x.n>0);

  const refAmb=ly&&ly.amb!=null?ly.amb:(julAmb||28);
  if(mgtAmb==null)mgtAmb=Math.round(refAmb*10)/10;
  if(mgtTarget==null)mgtTarget=Math.round(julDur||378);

  // 유사 기온일 (작년 동월, ±1.5℃)
  const simYear=ly?ly.date.slice(0,4):String(new Date().getFullYear()-1);
  const simMon=ly?ly.date.slice(5,7):'11';
  const sim=state.recs.filter(r=>r.date.slice(0,4)===simYear&&r.date.slice(5,7)===simMon
    &&r.amb!=null&&Math.abs(r.amb-refAmb)<=1.5);
  const simCool=mean(sim.map(r=>r.cool)), simHot=mean(sim.map(r=>r.hot)), simDur=mean(sim.map(r=>der(r).dur));

  // 추천 계산
  const ttRec=T.b0+T.b1*mgtAmb;
  const hotFloor=simHot!=null?simHot:(ly&&ly.hot!=null?ly.hot:38.5);
  const hotRec=Math.max(hotFloor,ttRec+MGT.hotMargin);
  const hotR=Math.round(hotRec*10)/10;
  const coolIdeal=(D.b0+D.b1*mgtAmb+D.b3*hotR-mgtTarget)/Math.abs(D.b2);
  const coolR=Math.round(Math.max(MGT.coolLo,Math.min(MGT.coolHi,coolIdeal))*10)/10;
  const predDur=D.b0+D.b1*mgtAmb+D.b2*coolR+D.b3*hotR;
  const lyDur=ly?der(ly).dur:null;
  const lyGap=ly&&ly.tt!=null&&ly.hot!=null?ly.tt-ly.hot:null;

  // 차이 차트 데이터
  const acidItems=[
    {l:'초기 산도 변화 1H',sub:'Δ1H · '+fmt(julD1,4)+'% 기준',v:(ly&&der(ly).d1!=null)?der(ly).d1-julD1:null,fmt:v=>fmt(v,4)+'%',step:0.002},
    {l:'5H 산도 변화',sub:'Δ5H · '+fmt(julD5,4)+'% 기준',v:(ly&&der(ly).d5!=null)?der(ly).d5-julD5:null,fmt:v=>fmt(v,4)+'%',step:0.002},
    {l:'5H → 종결 변화',sub:'Δ종결 · '+fmt(julDF,4)+'% 기준',v:(ly&&der(ly).df!=null)?der(ly).df-julDF:null,fmt:v=>fmt(v,4)+'%',step:0.002}
  ];
  const maxAcid=Math.max.apply(null,acidItems.map(i=>Math.abs(i.v||0)).concat([0.004]));
  const acidStep=0.002;
  const durItems=julTanks.map(x=>({
    l:'탱크 '+x.t,sub:'7월 평균 '+fInt(x.dur)+'분',
    v:(lyDur!=null)?lyDur-x.dur:null,fmt:v=>(v>0?'+':'')+fInt(v)+'분',
    color:(lyDur!=null&&lyDur>x.dur)?'#C6384A':'#2B6CB0'
  }));

  const setBars=[
    {l:'발효냉각온도',sub:'작년 '+fmt(ly&&ly.cool,1)+'℃',v:(ly&&ly.cool!=null)?coolR-ly.cool:null,fmt:v=>(v>0?'+':'')+fmt(v,1)+'℃'},
    {l:'핫워터 설정',sub:'작년 '+fmt(ly&&ly.hot,1)+'℃',v:(ly&&ly.hot!=null)?hotR-ly.hot:null,fmt:v=>(v>0?'+':'')+fmt(v,1)+'℃'},
    {l:'실내온도',sub:'작년 '+fmt(ly&&ly.amb,1)+'℃',v:(ly&&ly.amb!=null)?mgtAmb-ly.amb:null,fmt:v=>(v>0?'+':'')+fmt(v,1)+'℃'}
  ];

  return `
  <div class="sec">
    <div class="sech"><h2>작년 같은 날 작업 기록</h2>
      <span class="hint">${ly?ly.date.replace(/-/g,'.')+(lyd?'':' (최근 기록 대체)')+' · 탱크 '+ly.tank:'기록 없음'}</span></div>
    <div class="card pad">
      <div class="grid-kpi" style="gap:10px">
        <div class="kpi" style="padding:0">
          <div class="lb">발효냉각온도</div>
          <div class="nb" style="font-size:40px;color:#2B6CB0">${ly&&ly.cool!=null?fmt(ly.cool,1):'—'}<small>℃</small></div>
          <div class="sb">유사 기온일 평균 ${simCool!=null?fmt(simCool,1):'—'}℃</div></div>
        <div class="kpi" style="padding:0">
          <div class="lb">핫워터 설정</div>
          <div class="nb" style="font-size:40px;color:#B4690E">${ly&&ly.hot!=null?fmt(ly.hot,1):'—'}<small>℃</small></div>
          <div class="sb">유사 기온일 평균 ${simHot!=null?fmt(simHot,1):'—'}℃</div></div>
        <div class="kpi" style="padding:0">
          <div class="lb">설정TT · 실내</div>
          <div class="nb" style="font-size:40px">${ly&&ly.tt!=null?fmt(ly.tt,1):'—'}<small>℃</small></div>
          <div class="sb">실내 ${ly&&ly.amb!=null?fmt(ly.amb,1):'—'}℃ · 격차 ${lyGap==null?'—':fmt(lyGap,2)}℃</div></div>
        <div class="kpi" style="padding:0">
          <div class="lb">종결 · QC</div>
          <div class="nb" style="font-size:40px">${lyDur!=null?fInt(lyDur):'—'}<small>분</small></div>
          <div class="sb">5H ${ly?fmt(ly.a5,3):'—'} · 종결 ${ly?fmt(ly.aF,3):'—'} · 7월 ${fInt(julDur)}분</div></div>
      </div>
      <div class="alert ${lyGap!=null&&lyGap>0?'a':'g'}" style="margin-top:14px"><div>
        ${lyGap!=null&&lyGap>0
          ?`<b>역구배 발생 조건</b> — 작년 이 날 핫워터(${fmt(ly.hot,1)}℃)가 탱크 설정TT(${fmt(ly.tt,1)}℃)보다 <b>${fmt(lyGap,1)}℃ 낮았습니다.</b> 자켓이 가온을 못 해 발효 중 온도가 떨어지는 조건입니다.`
          :`<b>역구배 없음</b> — 작년 이 날 핫워터가 설정TT 이상이었습니다.`}
        유사 기온일 ${sim.length}건의 종결 평균은 ${simDur!=null?fInt(simDur):'—'}분입니다.
      </div></div>
      <div class="tblwrap" style="margin-top:14px;border:0">
      <table><thead><tr><th class="l">구분</th><th>탱크</th><th>실내</th><th>발효냉각</th><th>핫워터</th><th>설정TT</th><th>5H 산도</th><th>종결 산도</th><th>종결 소요</th></tr></thead><tbody>
        <tr style="background:#F2FAF8"><td class="l"><b>작년 같은 날</b></td><td>${ly?ly.tank:'—'}</td>
          <td>${ly&&ly.amb!=null?fmt(ly.amb,1):'—'}</td><td>${ly&&ly.cool!=null?fmt(ly.cool,1):'—'}</td>
          <td>${ly&&ly.hot!=null?fmt(ly.hot,1):'—'}</td><td>${ly&&ly.tt!=null?fmt(ly.tt,1):'—'}</td>
          <td>${ly?fmt(ly.a5,3):'—'}</td><td>${ly?fmt(ly.aF,3):'—'}</td><td>${lyDur!=null?fInt(lyDur):'—'}</td></tr>
        <tr><td class="l">7월 기준 (${julBase.length}배치)</td><td>${julTanks.map(x=>x.t).join('·')||'—'}</td>
          <td>${fmt(julAmb,1)}</td><td>${fmt(julCool,1)}</td><td>${fmt(julHot,1)}</td><td>${fmt(jAvg('tt'),1)}</td>
          <td>${fmt(jAvg('a5'),3)}</td><td>${fmt(jAvg('aF'),3)}</td><td>${fInt(julDur)}</td></tr>
        <tr><td class="l">차이</td><td>—</td>
          <td>${ly&&ly.amb!=null?(ly.amb-julAmb>0?'+':'')+fmt(ly.amb-julAmb,1):'—'}</td>
          <td>${ly&&ly.cool!=null?(ly.cool-julCool>0?'+':'')+fmt(ly.cool-julCool,2):'—'}</td>
          <td>${ly&&ly.hot!=null?(ly.hot-julHot>0?'+':'')+fmt(ly.hot-julHot,2):'—'}</td>
          <td>${ly&&ly.tt!=null?(ly.tt-jAvg('tt')>0?'+':'')+fmt(ly.tt-jAvg('tt'),2):'—'}</td>
          <td>—</td><td>—</td>
          <td><b>${lyDur!=null?(lyDur-julDur>0?'+':'')+fInt(lyDur-julDur):'—'}</b></td></tr>
      </tbody></table></div>
    </div>
  </div>

  <div class="sec">
    <div class="sech"><h2>7월 기준 대비 차이 — 산도 변화</h2>
      <span class="hint">빨강 = 증가(늦어짐) · 파랑 = 감소</span></div>
    <div class="card pad">
      ${diffChart(acidItems,{step:0.002,fmt2:v=>v.toFixed(3),fmt:v=>fmt(v,4)+'%',rowH:56,unit:'%p'})}
      <div class="note" style="margin-top:8px">7월 평균(Δ1H ${fmt(julD1,4)} · Δ5H ${fmt(julD5,4)} · Δ종결 ${fmt(julDF,4)}%)에서 작년 같은 날이 얼마나 벗어났는지입니다. 5H 산도 변화가 +로 벌어지면 종결이 앞당겨집니다.</div>
    </div>
  </div>

  <div class="sec">
    <div class="sech"><h2>7월 기준 대비 차이 — 종결 소요시간 (탱크별)</h2>
      <span class="hint">작년 같은 날 ${lyDur!=null?fInt(lyDur)+'분':'—'} vs 7월 탱크별 평균</span></div>
    <div class="card pad">
      ${diffItemsChart(durItems)}
      <div class="note" style="margin-top:8px">양수(빨강)는 7월보다 오래 걸린 것, 음수(파랑)는 빨리 끝난 것입니다. 탱크별로 차이가 다르면 설비·자켓 상태 차이를 의심할 수 있습니다.</div>
    </div>
  </div>

  <div class="sec">
    <div class="sech"><h2>오늘 설정 추천</h2><span class="hint">현재 실내온도 입력 → 역구배 없는 설정값</span></div>
    <div class="card pad">
      <div class="fields" style="grid-template-columns:1fr 1fr 1fr">
        <div class="fld"><label>현재 실내온도 <em>*</em></label>
          <div class="u"><input id="mAmb" type="text" inputmode="decimal" value="${mgtAmb}" oninput="mgtSet('amb',this.value)"><span>℃</span></div></div>
        <div class="fld"><label>목표 종결 소요</label>
          <div class="u"><input id="mTar" type="text" inputmode="decimal" value="${mgtTarget}" oninput="mgtSet('tar',this.value)"><span>분</span></div></div>
        <div class="fld"><label>7월 기준 종결</label>
          <div class="u"><input type="text" value="${fInt(julDur)}" readonly style="background:#F5F8FA;color:#54697D"><span>분</span></div></div>
      </div>

      <div class="row" style="margin-top:16px;gap:12px;align-items:stretch">
        <div class="card" style="flex:1;background:#F2FAF8;border-color:#BFE3DE;box-shadow:none;padding:18px 20px">
          <div class="note">권장 핫워터 설정</div>
          <div style="font-size:44px;font-weight:800;color:#0B5F59;letter-spacing:-1.5px;line-height:1.1;margin-top:4px;font-variant-numeric:tabular-nums">${fmt(hotR,1)}<span style="font-size:20px">℃</span></div>
          <div class="note" style="margin-top:6px">작년 ${fmt(ly&&ly.hot,1)}℃ → ${ly&&ly.hot!=null?(hotR-ly.hot>0?'+':'')+fmt(hotR-ly.hot,1):'—'}℃ · TT+${MGT.hotMargin}℃ 보장</div>
        </div>
        <div class="card" style="flex:1;background:#F2FAF8;border-color:#BFE3DE;box-shadow:none;padding:18px 20px">
          <div class="note">권장 발효냉각온도</div>
          <div style="font-size:44px;font-weight:800;color:#0B5F59;letter-spacing:-1.5px;line-height:1.1;margin-top:4px;font-variant-numeric:tabular-nums">${fmt(coolR,1)}<span style="font-size:20px">℃</span></div>
          <div class="note" style="margin-top:6px">작년 ${fmt(ly&&ly.cool,1)}℃ → ${ly&&ly.cool!=null?(coolR-ly.cool>0?'+':'')+fmt(coolR-ly.cool,1):'—'}℃</div>
        </div>
        <div class="card" style="flex:1;background:#FBFCFD;box-shadow:none;padding:18px 20px">
          <div class="note">예상 종결 소요</div>
          <div style="font-size:44px;font-weight:800;color:#101E2C;letter-spacing:-1.5px;line-height:1.1;margin-top:4px;font-variant-numeric:tabular-nums">${fInt(predDur)}<span style="font-size:20px">분</span></div>
          <div class="note" style="margin-top:6px">목표 ${mgtTarget}분 · 7월 ${fInt(julDur)}분</div>
        </div>
      </div>

      ${diffChart(setBars,{step:0.5,fmt2:v=>v.toFixed(1),fmt:v=>(v>0?'+':'')+fmt(v,1)+'℃',rowH:48,pl:150,unit:'℃'})}

      <div class="alert ${hotR>=ttRec?'g':'a'}" style="margin-top:12px"><div>
        <b>${hotR>=ttRec?'역구배 방지 조건 충족':'역구배 위험'}</b> — 실내 ${fmt(mgtAmb,1)}℃에서 설정TT는 <b>${fmt(ttRec,1)}℃</b>입니다.
        핫워터를 <b>${fmt(hotR,1)}℃</b>로 두면 TT보다 ${fmt(hotR-ttRec,1)}℃ 높아 자켓이 가온 역할을 합니다.
        ${hotR<=hotFloor+1e-9?`(작년 유사 기온일 실적 ${fmt(hotFloor,1)}℃가 TT보다 높아 그 값을 그대로 씁니다.)`:''}
      </div></div>
      <div class="note" style="margin-top:10px">
        추천식 — 설정TT = ${fmt(T.b0,2)} ${T.b1<0?'−':'+'} ${fmt(Math.abs(T.b1),4)}×실내 / 핫워터 = max(작년 유사 기온 실적 ${fmt(hotFloor,1)}℃, TT+${MGT.hotMargin}℃) /
        발효냉각 = 목표 ${mgtTarget}분 역산 (관측 ${MGT.coolLo}~${MGT.coolHi}℃ 내). 핫워터는 데이터상 38.0~39.0℃로 거의 고정이라, 회귀 추정 대신 <b>작년 실적을 하한으로 두고 역구배만 제거</b>하는 방식을 씁니다.
      </div>
    </div>
  </div>`;
}
function diffItemsChart(items){
  if(!items.length)return '<div class="empty">탱크별 데이터가 없습니다</div>';
  const vals=items.map(i=>i.v).filter(v=>v!=null);
  if(!vals.length)return '<div class="empty">비교할 기록이 없습니다</div>';
  return diffChart(items,{step:5,fmt2:v=>v.toFixed(0),fmt:v=>(v>0?'+':'')+fInt(v)+'분',rowH:52,pl:140,unit:'분'});
}
function mgtSet(k,v){
  const n=parseFloat(v);
  if(k==='amb'){if(!isNaN(n))mgtAmb=n;else return;}
  else{if(!isNaN(n)&&n>0)mgtTarget=n;else return;}
  const keep=document.getElementById('view').scrollTop;
  render();
  document.getElementById('view').scrollTop=keep;
  const el=document.getElementById(k==='amb'?'mAmb':'mTar');
  if(el){el.focus();try{el.setSelectionRange(el.value.length,el.value.length);}catch(e){}}
}
