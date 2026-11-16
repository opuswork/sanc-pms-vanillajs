/* ===== views: analysis / judge / data ===== */

/* ---------- ANALYSIS ---------- */
function seasonStats(){
  const out={};
  ['summer','winter','mid'].forEach(s=>{
    const g=state.recs.filter(r=>seasonOf(r.date)===s&&r.aF!=null);
    out[s]={n:g.length,
      dur:stat(g.map(r=>der(r).dur)),
      d1:stat(g.map(r=>der(r).d1)),
      d5:stat(g.map(r=>der(r).d5)),
      df:stat(g.map(r=>der(r).df)),
      a0:mean(g.map(r=>r.a0)),a1:mean(g.map(r=>r.a1)),a5:mean(g.map(r=>r.a5)),aF:mean(g.map(r=>r.aF)),
      amb:stat(g.map(r=>r.amb)),
      rate:stat(g.map(r=>der(r).rate))
    };
  });
  return out;
}
function viewAnalysis(){
  const g=state.guide,S=seasonStats();
  const su=S.summer,wi=S.winter;
  const gap=(wi.dur&&su.dur)?wi.dur.mean-su.dur.mean:null;
  const gapPct=(wi.dur&&su.dur)?(gap/su.dur.mean*100):null;
  /* monthly */
  const byM={};
  state.recs.forEach(r=>{ if(r.aF==null)return; const m=mm(r.date);
    (byM[m]=byM[m]||[]).push(der(r).dur); });
  const months=Object.keys(byM).sort();
  const mDur=months.map(m=>mean(byM[m]));
  const mColor=months.map(m=>SEASON_COLOR[seasonOf(m+'-15')]);
  const mLbl=months.map(m=>m.slice(2).replace('-','.'));
  /* scatter ambient vs dur */
  const pts=state.recs.filter(r=>r.amb!=null&&r.aF!=null).map(r=>[r.amb,der(r).dur,seasonOf(r.date)]);
  const ft=fit(pts);
  /* profile */
  const prof=['summer','winter','mid'].map(s=>({name:SEASON_KO[s],color:SEASON_COLOR[s],
    vals:[S[s].a0,S[s].a1,S[s].a5,S[s].aF]}));
  const recent=state.recs.filter(r=>r.aF!=null).slice(0,10);
  const durAll=stat(state.recs.map(r=>der(r).dur));

  return `
  <div class="sec"><div class="grid-kpi">
    <div class="card kpi"><div class="lb">여름 종결 소요</div><div class="nb">${su.dur?fInt(su.dur.mean):'—'}<small>분</small></div>
      <div class="sb">${su.n}배치 · σ ${su.dur?fInt(su.dur.sd):'—'}분</div></div>
    <div class="card kpi"><div class="lb">겨울 종결 소요</div><div class="nb" style="color:${gap!=null&&gap<0?'#C6384A':'#1B7F52'}">${wi.dur?fInt(wi.dur.mean):'—'}<small>분</small></div>
      <div class="sb">${wi.n}배치 · σ ${wi.dur?fInt(wi.dur.sd):'—'}분</div></div>
    <div class="card kpi"><div class="lb">여름 대비 격차</div><div class="nb" style="color:${gap!=null&&gap<0?'#C6384A':'#1B7F52'}">${gap==null?'—':(gap>0?'+':'')+gap.toFixed(0)}<small>분</small></div>
      <div class="sb">${gapPct==null?'—':(gapPct>0?'+':'')+gapPct.toFixed(1)+'%'} · 겨울이 ${gap!=null&&gap<0?'빠름':'느림'}</div></div>
    <div class="card kpi"><div class="lb">전체 종결 소요</div><div class="nb">${durAll?fInt(durAll.mean):'—'}<small>분</small></div>
      <div class="sb">${durationRange(durAll)}</div></div>
  </div></div>

  <div class="sec">
    <div class="sech"><h2>계절별 산도 프로파일</h2><span class="hint">살균후 → 1H → 5H → 종결 평균</span></div>
    <div class="card pad">
      ${lineChart({series:prof,xl:['살균후','접종후 1H','1차 5H','종결'],h:330,lo:0,hi:1.0,yticks:[0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0],yfmt:v=>v.toFixed(1),maxLabels:4})}
      <div class="lgd">${prof.map(p=>`<i><b style="background:${p.color}"></b>${p.name}</i>`).join('')}</div>
      <table style="margin-top:12px"><thead><tr><th class="l">계절</th><th>5H 산도</th><th>종결 산도</th><th>5H→종결 상승분</th><th>종결 소요</th><th>상승 기울기</th></tr></thead><tbody>
      ${['summer','winter','mid'].map(s=>{const x=S[s];if(!x.dur||!x.d5||!x.a5)return '';
        const rise=(x.aF!=null&&x.a5!=null)?x.aF-x.a5:null;
        const slope=(rise!=null&&x.dur.mean)?rise/(x.dur.mean/60):null;
        return `<tr><td class="l"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${SEASON_COLOR[s]};margin-right:7px"></span>${SEASON_KO[s]}</td>
          <td>${fmt(x.a5,3)}</td><td>${fmt(x.aF,3)}</td><td><b>${fmt(rise,3)}</b></td>
          <td>${fInt(x.dur.mean)}분</td><td><b style="color:${SEASON_COLOR[s]}">${slope==null?'—':fmt(slope,4)}</b> %/h</td></tr>`;}).join('')}
      </tbody></table>
      <div class="note" style="margin-top:8px">상승 기울기 = (종결 − 5H) ÷ 종결 소요시간. 값이 작을수록 산도가 천천히 올라 종결이 늦어집니다.</div>
      <div class="alert ${Math.abs((wi.a5-su.a5)/su.a5)>0.02?'a':'g'}" style="margin-top:12px">
        <div><b>5H 시점 겨울 산도 ${fmt(wi.a5,3)} vs 여름 ${fmt(su.a5,3)}</b> — ${(wi.a5>su.a5?'겨울이 '+fmt(wi.a5-su.a5,3)+' 높습니다.':'차이가 크지 않습니다.')}
        5H에서 이미 목표에 가까워지면 종결 판단 시점이 앞당겨집니다.</div></div>
    </div>
  </div>

  <div class="grid2">
    <div class="sec">
      <div class="sech"><h2>월별 종결 소요시간</h2><span class="hint">여름 평균 기준선</span></div>
      <div class="card pad">
        ${barChart({vals:mDur,labels:mLbl,colors:mColor,ref:g.dur.m,refLabel:'여름 '+fInt(g.dur.m)+'분',h:230})}
        <div class="lgd"><i><b class="sq" style="background:${SEASON_COLOR.summer}"></b>여름</i>
          <i><b class="sq" style="background:${SEASON_COLOR.winter}"></b>겨울</i>
          <i><b class="sq" style="background:${SEASON_COLOR.mid}"></b>중간기</i></div>
      </div>
    </div>
    <div class="sec">
      <div class="sech"><h2>계절 분포</h2><span class="hint">최소–최대 · 중앙값</span></div>
      <div class="card pad">
        ${seasonBoxes(S)}
        <div class="note" style="margin-top:10px">겨울 분포가 여름보다 왼쪽(짧은 시간)으로 이동해 있습니다. 같은 산도에 도달하는 시간이 계절에 따라 달라진다는 뜻입니다.</div>
      </div>
    </div>
  </div>

  <div class="grid2">
    <div class="sec">
      <div class="sech"><h2>초기 산도 변화 비교</h2><span class="hint">Δ1H · Δ5H</span></div>
      <div class="card pad">
        <table><thead><tr><th class="l">계절</th><th>Δ1H (%)</th><th>Δ5H (%)</th><th>Δ종결 (%)</th><th>n</th></tr></thead><tbody>
        ${['summer','winter','mid'].map(s=>{const x=S[s];return `<tr>
          <td class="l"><span style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${SEASON_COLOR[s]};margin-right:6px"></span>${SEASON_KO[s]}</td>
          <td>${fmt(x.d1&&x.d1.mean,3)}</td><td>${fmt(x.d5&&x.d5.mean,3)}</td><td>${fmt(x.df&&x.df.mean,3)}</td><td class="dim">${x.n}</td></tr>`;}).join('')}
        </tbody></table>
        <div class="alert i" style="margin-top:12px"><div>Δ1H는 계절 차이가 거의 없습니다. 차이는 <b>Δ5H와 종결 도달 시점</b>에서 발생합니다 — 초기 온도가 높을수록 5H 산도가 먼저 목표에 붙습니다.</div></div>
      </div>
    </div>
    <div class="sec">
      <div class="sech"><h2>실내온도 ↔ 종결 소요시간</h2><span class="hint">${ft?`r²=${ft.r2.toFixed(2)} · n=${ft.n}`:''}</span></div>
      <div class="card pad">
        ${scatterChart(pts,{fit:ft,xlabel:'발효실 실내온도 (℃) → 종결 소요 (분)',h:250})}
        <div class="lgd"><i><b class="sq" style="background:${SEASON_COLOR.summer}"></b>여름</i>
          <i><b class="sq" style="background:${SEASON_COLOR.winter}"></b>겨울</i>
          <i><b class="sq" style="background:${SEASON_COLOR.mid}"></b>중간기</i></div>
        ${ft?`<div class="note" style="margin-top:8px">회귀: 종결 소요 = ${ft.b0.toFixed(0)} ${ft.b1>0?'+':'−'} ${Math.abs(ft.b1).toFixed(1)} × 실내온도. 실내온도 1℃ 상승에 약 ${Math.abs(ft.b1).toFixed(1)}분 변동.</div>`:''}
      </div>
    </div>
  </div>
  ${viscCardHTML()}

  <div class="sec">
    <div class="sech"><h2>최근 배치 10건</h2><span class="hint">여름 기준 판정</span></div>
    <div class="tblwrap"><table>
      <thead><tr><th>제조일</th><th>탱크</th><th>실내</th><th>살균후</th><th>1H</th><th>5H</th><th>종결</th><th>소요(분)</th><th>판정</th></tr></thead>
      <tbody>${recent.map(r=>{const j=judge(r),D=der(r);return `<tr>
        <td>${r.date.replace(/-/g,'.')}</td><td>${r.tank}</td><td class="dim">${fmt(r.amb,1)}</td>
        <td>${fmt(r.a0,3)}</td><td>${fmt(r.a1,3)}</td><td>${fmt(r.a5,3)}</td><td>${fmt(r.aF,3)}</td>
        <td>${fInt(D.dur)}</td><td><span class="chip ${j.level==='ok'?'ok':j.level==='wa'?'wa':'bd'}">${LV_KO[j.level]}</span></td></tr>`;}).join('')}
      </tbody></table></div>
  </div>`;
}
function durationRange(s){if(!s)return '—';return `최소 ${fInt(s.min)} · 최대 ${fInt(s.max)}분`;}
function seasonBoxes(S){
  const all=['summer','winter','mid'].map(k=>S[k].dur).filter(Boolean);
  if(!all.length)return '<div class="empty">데이터 없음</div>';
  const lo=Math.min.apply(null,all.map(x=>x.min)), hi=Math.max.apply(null,all.map(x=>x.max));
  const pos=v=>((v-lo)/(hi-lo||1)*100);
  return ['summer','winter','mid'].map(k=>{
    const s=S[k].dur;if(!s)return '';
    return `<div class="bx"><div class="bn" style="color:${SEASON_COLOR[k]}">${SEASON_KO[k]}</div>
      <div class="bxtrack">
        <div class="bxbar" style="left:${pos(s.q1)}%;width:${Math.max(1,pos(s.q3)-pos(s.q1))}%"></div>
        <div class="bxmed" style="left:${pos(s.med)}%"></div>
        <div class="bxpt" style="left:${pos(s.min)}%;margin-left:-2px"></div>
        <div class="bxpt" style="left:${pos(s.max)}%;margin-left:-2px"></div>
        <div class="bxlbl" style="left:${pos(s.med)}%">${fInt(s.med)}분</div>
      </div></div>`;
  }).join('')+`<div class="note" style="margin-top:8px">막대 = 중앙 50% 구간, 세로선 = 중앙값, 점 = 최소·최대</div>`;
}

/* ---------- JUDGE ---------- */
function viewJudge(){
  const g=state.guide;
  const judged=state.recs.filter(r=>r.aF!=null).map(r=>({r,j:judge(r)}));
  const cnt={ok:0,wa:0,bd:0};
  judged.forEach(x=>cnt[x.j.level]++);
  const tot=judged.length||1;
  const bySeason={};
  ['summer','winter','mid'].forEach(s=>{
    const arr=judged.filter(x=>seasonOf(x.r.date)===s);
    bySeason[s]={n:arr.length,ok:arr.filter(x=>x.j.level==='ok').length,
      wa:arr.filter(x=>x.j.level==='wa').length,bd:arr.filter(x=>x.j.level==='bd').length};
  });
  const bad=judged.filter(x=>x.j.level!=='ok').slice(0,14);
  return `
  <div class="sec"><div class="grid-kpi">
    <div class="card kpi"><div class="lb">정상</div><div class="nb" style="color:#1B7F52">${cnt.ok}</div><div class="sb">${(cnt.ok/tot*100).toFixed(1)}% · ±1σ 이내</div></div>
    <div class="card kpi"><div class="lb">주의</div><div class="nb" style="color:#B4690E">${cnt.wa}</div><div class="sb">${(cnt.wa/tot*100).toFixed(1)}% · ±1~2σ</div></div>
    <div class="card kpi"><div class="lb">이상</div><div class="nb" style="color:#C6384A">${cnt.bd}</div><div class="sb">${(cnt.bd/tot*100).toFixed(1)}% · ±2σ 초과</div></div>
    <div class="card kpi"><div class="lb">판정 기준</div><div class="nb" style="font-size:20px">${g.basis==='summer'?'여름 실적':'전체 실적'}</div><div class="sb">기준 ${g.n}배치 · 6~8월</div></div>
  </div></div>

  <div class="grid2">
    <div class="sec">
      <div class="sech"><h2>판정 기준값</h2><span class="hint">여름(6~8월) 평균 ± 표준편차</span></div>
      <div class="card pad">
        <table><thead><tr><th class="l">항목</th><th>기준</th><th>±1σ (정상)</th><th>±2σ (주의한계)</th></tr></thead><tbody>
          ${[['초기 산도 변화 (1H)','d1','%',3],['5H 산도 변화','d5','%',3],['종결 소요시간','dur','분',0],['종결 산도','af','%',3]].map(x=>{
            const q=g[x[1]],f=v=>x[3]===0?fInt(v):fmt(v,x[3]);
            return `<tr><td class="l">${x[0]}</td><td>${f(q.m)}${x[2]}</td>
              <td class="dim">${f(q.m-q.s)} ~ ${f(q.m+q.s)}</td>
              <td class="dim">${f(q.m-2*q.s)} ~ ${f(q.m+2*q.s)}</td></tr>`;}).join('')}
        </tbody></table>
        <div class="row" style="margin-top:12px;justify-content:flex-end">
          <button class="btn sm gho" onclick="recalcGuide()">기준 재산출</button>
        </div>
        <div class="note" style="margin-top:6px">기준은 축적된 데이터로 자동 계산됩니다. 여름 실적이 20배치 미만이면 전체 데이터를 기준으로 사용합니다.</div>
      </div>
    </div>
    <div class="sec">
      <div class="sech"><h2>계절별 판정 결과</h2><span class="hint">여름 기준 적용</span></div>
      <div class="card pad">
        <table><thead><tr><th class="l">계절</th><th>정상</th><th>주의</th><th>이상</th><th>이상률</th></tr></thead><tbody>
        ${['summer','winter','mid'].map(s=>{const x=bySeason[s];if(!x.n)return `<tr><td class="l">${SEASON_KO[s]}</td><td colspan="4" class="dim">—</td></tr>`;
          return `<tr><td class="l"><span style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${SEASON_COLOR[s]};margin-right:6px"></span>${SEASON_KO[s]}</td>
            <td>${x.ok}</td><td>${x.wa}</td><td style="color:${x.bd?'#C6384A':'inherit'}">${x.bd}</td>
            <td class="dim">${(x.bd/x.n*100).toFixed(0)}%</td></tr>`;}).join('')}
        </tbody></table>
        ${bySeason.winter.n&&(bySeason.winter.bd/bySeason.winter.n)>(bySeason.summer.n?bySeason.summer.bd/bySeason.summer.n:0)
          ?`<div class="alert a" style="margin-top:12px"><div><b>겨울 이상률이 여름보다 높습니다.</b><br>여름 기준을 겨울에 그대로 적용하면 종결 소요시간이 짧아 대부분 이탈로 잡힙니다. 겨울 공정 조건(핫워터·실내온도)을 여름 수준으로 맞추는 것이 과제입니다.</div></div>`
          :''}
      </div>
    </div>
  </div>

  <div class="sec">
    <div class="sech"><h2>기준 이탈 배치</h2><span class="hint">최근 14건 · 사유 포함</span></div>
    <div class="tblwrap"><table>
      <thead><tr><th>제조일</th><th>탱크</th><th class="l">계절</th><th>소요(분)</th><th>Δ1H</th><th>Δ5H</th><th>종결산도</th><th class="l">이탈 사유</th><th>판정</th></tr></thead>
      <tbody>${bad.length?bad.map(x=>{
        const D=der(x.r),rs=x.j.items.filter(i=>i.st!=='ok'&&i.st!=='nu').map(i=>`${i.n.replace(/ \(.*\)/,'')} ${i.d===0?fInt(i.v):fmt(i.v,i.d)}${i.u} (${i.z>0?'+':''}${i.z.toFixed(1)}σ)`).join(' · ');
        return `<tr class="${x.j.level==='bd'?'rowbad':''}">
          <td>${x.r.date.replace(/-/g,'.')}</td><td>${x.r.tank}</td>
          <td class="l"><span style="color:${SEASON_COLOR[seasonOf(x.r.date)]}">${SEASON_KO[seasonOf(x.r.date)]}</span></td>
          <td>${fInt(D.dur)}</td><td>${fmt(D.d1,3)}</td><td>${fmt(D.d5,3)}</td><td>${fmt(x.r.aF,3)}</td>
          <td class="l" style="font-size:11px;color:#54697D;white-space:normal;max-width:320px">${rs||'경계값'}</td>
          <td><span class="chip ${x.j.level==='wa'?'wa':'bd'}">${LV_KO[x.j.level]}</span></td></tr>`;}).join('')
        :'<tr><td colspan="9" class="empty">이탈 배치가 없습니다</td></tr>'}
      </tbody></table></div>
  </div>`;
}
function recalcGuide(){buildGuide();render();toast('여름 실적 '+state.guide.n+'배치로 기준을 다시 계산했습니다');}

/* ---------- DATA ---------- */
function filtered(){
  const f=state.filter;
  return state.recs.filter(r=>{
    if(f.month&&mm(r.date)!==f.month)return false;
    if(f.tank&&String(r.tank)!==String(f.tank))return false;
    if(f.q){const t=(r.date+' '+r.tank+' '+(r.note||'')).toLowerCase();if(t.indexOf(f.q.toLowerCase())<0)return false;}
    return true;
  });
}
function viewData(){
  const all=state.recs;
  const months=Array.from(new Set(all.map(r=>mm(r.date)))).sort().reverse();
  const list=filtered();
  const PER=20, pages=Math.max(1,Math.ceil(list.length/PER));
  if(state.pageIdx>=pages)state.pageIdx=0;
  const rows=list.slice(state.pageIdx*PER,state.pageIdx*PER+PER);
  const size=JSON.stringify(all).length;
  const last=state.meta.lastBackup;
  const days=last?Math.floor((Date.now()-new Date(last).getTime())/86400000):null;
  const updCard=dtmCardHTML()+xlCardHTML()+impCardHTML()+viewUpdateCard();
  return `
  <div class="grid2">
    <div class="sec">
      <div class="sech"><h2>저장 현황</h2><span class="hint">태블릿 내부 저장소</span></div>
      <div class="card pad">
        <div class="grid-3" style="gap:10px">
          <div><div class="lb note">누적 배치</div><div class="nb" style="font-size:22px;font-weight:780">${all.length.toLocaleString()}<small style="font-size:11px;color:#7C8DA0">건</small></div></div>
          <div><div class="lb note">수집 기간</div><div style="font-size:15px;font-weight:750;margin-top:4px">${all.length?all[all.length-1].date.slice(0,7).replace('-','.')+'~'+all[0].date.slice(0,7).replace('-','.'):'—'}</div></div>
          <div><div class="lb note">데이터 용량</div><div style="font-size:15px;font-weight:750;margin-top:4px">${(size/1024).toFixed(0)} KB</div></div>
        </div>
        <div class="hr"></div>
        <div class="spread">
          <div class="savestate"><span class="chip ${days==null?'wa':(days>14?'wa':'ok')}">${days==null?'백업 기록 없음':(days===0?'오늘 백업':days+'일 전 백업')}</span>
            <span>1년 운영 시 약 ${Math.round(all.length?size/Math.max(1,all.length)*365/1024:40)} KB 추가</span></div>
          <div class="row">
            <button class="btn sm gho" onclick="exportCSV()">CSV</button>
            <button class="btn sm gho" onclick="exportJSON()">백업</button>
            <button class="btn sm gho" onclick="importDialog()">복원</button>
          </div>
        </div>
        <div class="note" style="margin-top:8px">데이터는 태블릿 브라우저 저장소에 보관됩니다. 앱 데이터 삭제·기기 교체 시 사라지므로 <b>주 1회 백업</b>을 권장합니다.</div>
      </div>
    </div>
    <div class="sec">
      <div class="sech"><h2>조회</h2><span class="hint">${list.length}건</span></div>
      <div class="card pad">
        <div class="row" style="gap:8px">
          <div class="fld" style="flex:1;min-width:110px"><label>월</label>
            <select id="fltMonth" onchange="setFilter('month',this.value)">
              <option value="">전체</option>${months.map(m=>`<option value="${m}" ${state.filter.month===m?'selected':''}>${m.replace('-','.')}</option>`).join('')}</select></div>
          <div class="fld" style="flex:0 0 100px"><label>탱크</label>
            <select id="fltTank" onchange="setFilter('tank',this.value)">
              <option value="">전체</option>${['301','302','303','304','305','306','307'].map(t=>`<option value="${t}" ${state.filter.tank===t?'selected':''}>${t}</option>`).join('')}</select></div>
          <div class="fld" style="flex:1;min-width:120px"><label>검색</label>
            <input id="fltQ" value="${(state.filter.q||'').replace(/"/g,'&quot;')}" placeholder="날짜·비고" oninput="setFilter('q',this.value)"></div>
        </div>
        <div class="row" style="margin-top:10px">
          <button class="btn sm gho" onclick="clearFilter()">필터 초기화</button>
          <span class="note">총 ${all.length}건 중 ${list.length}건 표시</span>
        </div>
      </div>
    </div>
  </div>

  ${updCard}

  <div class="sec">
    <div class="sech"><h2>배치 이력</h2>
      <span class="hint">${pages>1?`${state.pageIdx+1} / ${pages} 페이지`:''}</span></div>
    <div class="tblwrap"><table>
      <thead><tr><th>제조일</th><th>탱크</th><th>톤수</th><th>살균후</th><th>1H</th><th>5H</th><th>종결</th><th>소요(분)</th><th>실내</th><th>냉각</th><th>핫워터</th><th>점도1차</th><th>점도종결</th><th>pH종결</th><th>당도종결</th><th>판정</th><th class="l">관리</th></tr></thead>
      <tbody>${rows.length?rows.map(r=>{const j=judge(r),D=der(r);return `<tr class="${j.level==='bd'?'rowbad':''}">
        <td>${r.date.replace(/-/g,'.')}${r.src==='user'?' <span class="chip ac" style="height:16px;font-size:9px">신규</span>':''}</td>
        <td>${r.tank}</td><td class="dim">${fmt(r.ton,1)}</td>
        <td>${fmt(r.a0,3)}</td><td>${fmt(r.a1,3)}</td><td>${fmt(r.a5,3)}</td><td>${fmt(r.aF,3)}</td>
        <td>${fInt(D.dur)}</td><td class="dim">${fmt(r.amb,1)}</td><td class="dim">${fmt(r.cool,1)}</td><td class="dim">${fmt(r.hot,1)}</td>
        <td class="dim">${fmt(r.vs1,1)}</td><td class="dim">${fmt(r.vsF,1)}</td><td class="dim">${fmt(r.phF,2)}</td><td class="dim">${fmt(r.brF,1)}</td>
        <td><span class="chip ${j.level==='ok'?'ok':j.level==='wa'?'wa':'bd'}">${LV_KO[j.level]}</span></td>
        <td class="l"><button class="btn sm gho" style="height:24px;padding:0 8px" onclick="editRec('${r.id}')">수정</button>
          <button class="btn sm dan" style="height:24px;padding:0 8px" onclick="delRec('${r.id}')">삭제</button></td></tr>`;}).join('')
        :'<tr><td colspan="17" class="empty">조건에 맞는 기록이 없습니다</td></tr>'}
      </tbody></table></div>
    ${pages>1?`<div class="row" style="justify-content:center;margin-top:12px">
      <button class="btn sm gho" ${state.pageIdx===0?'disabled':''} onclick="pageGo(-1)">이전</button>
      <span class="note">${state.pageIdx+1} / ${pages}</span>
      <button class="btn sm gho" ${state.pageIdx>=pages-1?'disabled':''} onclick="pageGo(1)">다음</button></div>`:''}
  </div>`;
}
function setFilter(k,v){state.filter[k]=v;state.pageIdx=0;render();
  const el=document.getElementById('flt'+k.charAt(0).toUpperCase()+k.slice(1));
  if(el&&el.tagName==='INPUT'){el.focus();try{const n=el.value.length;el.setSelectionRange(n,n);}catch(e){}}}
function clearFilter(){state.filter={month:'',tank:'',q:''};state.pageIdx=0;render();}
function pageGo(d){state.pageIdx=Math.max(0,state.pageIdx+d);render();}
function bindData(){}
function editRec(id){state.editId=id;state.page='input';renderNav();render();toast('수정 모드 — 값을 고친 뒤 저장하세요');}
function delRec(id){
  const r=state.recs.find(x=>x.id===id);if(!r)return;
  openModal('기록 삭제',`<div class="alert a"><div><b>${r.date} · ${r.tank}탱크</b> 기록을 삭제합니다. 되돌릴 수 없습니다.</div></div>`,
    `<button class="btn gho" onclick="closeModal()">취소</button><button class="btn dan" onclick="doDel('${id}')">삭제</button>`);
}
function doDel(id){try{dtmSnapshot('삭제 전');}catch(e){}dbDel('batches',id).then(()=>{state.recs=state.recs.filter(r=>r.id!==id);closeModal();buildGuide();render();toast('삭제했습니다');});}

/* ---------- export / import ---------- */
function download(name,text,type){
  const b=window.AndroidBridge;
  if(b&&b.saveFile){
    try{const p=b.saveFile(name,text);toast(p?('저장: '+p):'저장했습니다');return;}
    catch(e){/* 아래 기본 경로로 */}
  }
  try{
    const blob=new Blob([text],{type:type||'text/plain;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
    document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1200);
    toast(name+' 내보냈습니다');
  }catch(e){
    openModal('내보내기',`<div class="alert i"><div>파일 저장이 지원되지 않는 환경입니다. 아래 내용을 복사해 보관하세요.</div></div>
      <textarea style="width:100%;height:220px;margin-top:10px;font-family:monospace;font-size:11px;border:1px solid #E2E8F0;border-radius:8px;padding:10px">${text.replace(/</g,'&lt;')}</textarea>`,
      '<button class="btn pri" onclick="closeModal()">닫기</button>');
  }
}
function exportCSV(){
  const head=['제조일','탱크','톤수','설정TT','살균유온도','1H온도','5H온도','실내온도','살균냉각','핫워터','살균후산도','1H산도','5H산도','종결산도','종결분','5H이후분','총이송','pH살균후','pH1H','pH5H','pH종결','pH완제품','당도살균후','당도종결','당도완제품','Δ1H','Δ5H','Δ종결','비고','구분'];
  const lines=[head.join(',')].concat(state.recs.map(r=>{const D=der(r);
    const f=v=>(v==null||v==='')?'':v;
    return [r.date,r.tank,f(r.ton),f(r.tt),f(r.milk),f(r.t1),f(r.t5),f(r.amb),f(r.cool),f(r.hot),
      f(r.a0),f(r.a1),f(r.a5),f(r.aF),f(r.afm),f(r.mins),f(r.trans),
      f(r.ph0),f(r.ph1),f(r.ph5),f(r.phF),f(r.phP),f(r.br0),f(r.brF),f(r.brP),
      D.d1==null?'':D.d1.toFixed(4),D.d5==null?'':D.d5.toFixed(4),D.df==null?'':D.df.toFixed(4),
      (r.note||'').replace(/,/g,' '),r.src==='user'?'현장입력':'기존이력'].join(',');}));
  download('shinang_공정데이터_'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'.csv','\ufeff'+lines.join('\r\n'),'text/csv;charset=utf-8');
}
function exportJSON(){
  const payload={app:'syncheon-pms',version:2,exportedAt:new Date().toISOString(),count:state.recs.length,records:state.recs};
  download('shinang_백업_'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'.json',JSON.stringify(payload,null,1),'application/json');
  metaSet('lastBackup',new Date().toISOString()).then(()=>{state.meta.lastBackup=new Date().toISOString();render();});
}
function importDialog(){
  openModal('백업 복원',
   `<div class="alert i"><div>백업 파일(.json)을 선택하면 기존 기록과 날짜·탱크 기준으로 병합합니다. 같은 키는 백업 값으로 교체됩니다.</div></div>
    <input type="file" id="impFile" accept=".json,application/json" style="margin-top:14px;font-size:12px">
    <div class="note" style="margin-top:8px">또는 백업 내용을 붙여넣기</div>
    <textarea id="impText" placeholder='{"app":"syncheon-pms",...}' style="width:100%;height:110px;margin-top:6px;font-family:monospace;font-size:11px;border:1px solid #E2E8F0;border-radius:8px;padding:9px"></textarea>`,
   `<button class="btn gho" onclick="closeModal()">취소</button><button class="btn pri" onclick="runImport()">복원 실행</button>`);
  setTimeout(()=>{const f=document.getElementById('impFile');
    if(f)f.onchange=e=>{const file=e.target.files[0];if(!file)return;const rd=new FileReader();
      rd.onload=()=>{document.getElementById('impText').value=rd.result;};rd.readAsText(file);};},60);
}
function runImport(){
  const raw=document.getElementById('impText').value.trim();
  if(!raw){toast('파일을 선택하거나 내용을 붙여넣으세요');return;}
  let data;
  try{data=JSON.parse(raw);}catch(e){toast('JSON 형식이 아닙니다');return;}
  const recs=Array.isArray(data)?data:(data.records||[]);
  if(!recs.length){toast('복원할 기록이 없습니다');return;}
  const clean=recs.filter(r=>r&&r.date&&r.tank).map(r=>{const o={};FIELDS.forEach(k=>o[k]=r[k]==null?null:(k==='date'||k==='tank'?r[k]:Number(r[k])));
    o.note=r.note||'';o.id=o.date+'|'+o.tank;o.src=r.src||'user';o.ts=r.ts||Date.now();return o;});
  Promise.all(clean.map(o=>dbPut('batches',o))).then(()=>dbAll('batches')).then(list=>{
    state.recs=list.sort((a,b)=>a.date<b.date?1:(a.date>b.date?-1:0));
    closeModal();buildGuide();render();toast(clean.length+'건을 복원했습니다');});
}
/* ---------- 점도 분석 (일보 점도 구역) ---------- */
function corrXY(xs,ys){
  const n=Math.min(xs.length,ys.length);
  if(n<8)return null;
  const mx=mean(xs),my=mean(ys);
  let sxy=0,sxx=0,syy=0;
  for(let i=0;i<n;i++){const a=xs[i]-mx,b=ys[i]-my;sxy+=a*b;sxx+=a*a;syy+=b*b;}
  if(!sxx||!syy)return null;
  return sxy/Math.sqrt(sxx*syy);
}
function viscRows(){
  return state.recs.filter(r=>r.vsF!=null&&!isNaN(r.vsF));
}
function viscCardHTML(){
  const rows=viscRows();
  const n=rows.length;
  const vs1v=stat(rows.map(r=>r.vs1)),vsFv=stat(rows.map(r=>r.vsF));
  const vsSv=stat(rows.map(r=>r.vsS)),vsPv=stat(rows.map(r=>r.vsP));
  const drop=rows.filter(r=>r.vs1!=null&&r.vsF!=null).map(r=>r.vsF-r.vs1);
  const dropS=stat(drop);
  const durF=rows.filter(r=>r.aF!=null).map(r=>der(r).dur);
  const cr=corrXY(rows.filter(r=>r.aF!=null).map(r=>der(r).dur),rows.filter(r=>r.aF!=null).map(r=>r.vsF));
  const ca=corrXY(rows.filter(r=>r.aF!=null).map(r=>r.aF),rows.filter(r=>r.aF!=null).map(r=>r.vsF));
  const half=Math.floor(rows.length/2);
  const sorted=rows.slice().sort((a,b)=>a.vsF-b.vsF);
  const lo=sorted.slice(0,half),hi=sorted.slice(half);
  const loDur=stat(lo.filter(r=>r.aF!=null).map(r=>der(r).dur));
  const hiDur=stat(hi.filter(r=>r.aF!=null).map(r=>der(r).dur));
  const f1=v=>v==null?'—':v.toFixed(1);
  const f2=v=>v==null?'—':v.toFixed(2);
  const head='<div class="sec"><div class="sech"><h2>점도 구역</h2><span class="hint">일보 점도 · '+n+'배치</span></div>';
  if(!n){
    return head+'<div class="card pad"><div class="alert i"><div>점도 값이 아직 없습니다. '
      +'데이터 탭의 <b>엑셀 일괄 가져오기</b>로 일보를 넣으면 여기에 요약이 나타납니다.</div></div></div></div>';
  }
  return head+'<div class="card pad">'
    +'<div class="statline" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">'
    +'<div><div class="lb">1차 점도</div><div style="font-size:26px;font-weight:780">'+f1(vs1v?vs1v.mean:null)+'</div><div class="note">σ '+(vs1v?f1(vs1v.sd):'—')+' · '+rows.filter(r=>r.vs1!=null).length+'건</div></div>'
    +'<div><div class="lb">종결 점도</div><div style="font-size:26px;font-weight:780">'+f1(vsFv?vsFv.mean:null)+'</div><div class="note">σ '+(vsFv?f1(vsFv.sd):'—')+' · '+n+'건</div></div>'
    +'<div><div class="lb">1차 → 종결 변화</div><div style="font-size:26px;font-weight:780;color:'+(dropS&&dropS.mean<0?'#C6384A':'#1B7F52')+'">'+(dropS?(dropS.mean>0?'+':'')+f1(dropS.mean):'—')+'</div><div class="note">σ '+(dropS?f1(dropS.sd):'—')+'</div></div>'
    +'<div><div class="lb">종결 점도 범위</div><div style="font-size:26px;font-weight:780">'+(vsFv?f1(vsFv.min)+'–'+f1(vsFv.max):'—')+'</div><div class="note">중앙값 '+(vsFv?f1(vsFv.med):'—')+'</div></div>'
    +'</div>'
    +'<div class="hr"></div>'
    +'<table><thead><tr><th class="l">구간</th><th>평균</th><th>표준편차</th><th>최소</th><th>최대</th><th>건수</th></tr></thead><tbody>'
    +[['1차',vs1v],['종결',vsFv],['서지1',vsSv],['완제품1',vsPv]].map(x=>{
        const s=x[1];
        return '<tr><td class="l">'+x[0]+'</td><td>'+(s?f1(s.mean):'—')+'</td><td>'+(s?f1(s.sd):'—')+'</td><td>'+(s?f1(s.min):'—')+'</td><td>'+(s?f1(s.max):'—')+'</td><td>'+(s?s.n:0)+'</td></tr>';
      }).join('')
    +'</tbody></table>'
    +'<div class="hr"></div>'
    +'<div style="font-size:26px;font-weight:780;margin-bottom:8px">점도가 종결에 주는 영향</div>'
    +'<div class="statline" style="flex-direction:column;gap:9px">'
    +'<div>종결 점도 ↔ 종결 소요 상관 <b>'+(cr==null?'—':f2(cr))+'</b> <span class="note">'+(cr==null?'':'|r|&lt;0.2면 영향 거의 없음')+'</span></div>'
    +'<div>종결 점도 ↔ 종결 산도 상관 <b>'+(ca==null?'—':f2(ca))+'</b></div>'
    +'<div>종결 점도 하위 50% 소요 <b>'+(loDur?fInt(loDur.mean)+'분':'—')+'</b> · 상위 50% <b>'+(hiDur?fInt(hiDur.mean)+'분':'—')+'</b>'
    +(loDur&&hiDur?' <span class="note">차이 '+(hiDur.mean-loDur.mean>0?'+':'')+(hiDur.mean-loDur.mean).toFixed(0)+'분</span>':'')+'</div>'
    +'</div>'
    +'<div class="note" style="margin-top:10px">상관계수 r은 −1~+1입니다. 0에 가까우면 점도가 종결 속도와 무관하다는 뜻이고, '
    +'음수면 점도가 높을수록 빨리 끝나는 경향입니다. 배치 수가 적으면 값이 흔들리므로 30건 이상부터 신뢰하세요.</div>'
    +'</div></div>';
}
