/* ===== 5H 종결 예측 ===== */
const P5={
  b0:-117.88,b1:733.83,b2:0.949,b3:2.028,sd:7.5,r2:0.834,n:317
};
function targetAF(){
  const sum=state.recs.filter(r=>seasonOf(r.date)==='summer'&&r.aF!=null);
  const base=sum.length>=20?sum:state.recs.filter(r=>r.aF!=null);
  const m=mean(base.map(r=>r.aF));
  return m!=null?m:0.9744;
}
function fit5H(){
  const AFT=targetAF();
  const rows=state.recs.filter(r=>r.a5!=null&&r.mins!=null&&r.amb!=null&&r.cool!=null)
    .map(r=>({gap:AFT-r.a5,amb:r.amb,cool:r.cool,mins:r.mins}));
  if(rows.length<40)return Object.assign({},P5,{fixed:true});
  const f=fitMul(rows,['gap','amb','cool'],'mins');
  if(!f)return Object.assign({},P5,{fixed:true});
  // 잔차 표준편차
  let sse=0;
  rows.forEach(r=>{const p=f.b0+f.b1*r.gap+f.b2*r.amb+f.b3*r.cool;sse+=(r.mins-p)*(r.mins-p);});
  return {b0:f.b0,b1:f.b1,b2:f.b2,b3:f.b3,r2:f.r2,n:f.n,sd:Math.sqrt(sse/rows.length)};
}
function hhmmToMin(s){
  if(!s)return null;
  const m=/^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if(!m)return null;
  const h=+m[1],mi=+m[2];
  if(h>23||mi>59)return null;
  return h*60+mi;
}
function minToHHMM(v){
  if(v==null||isNaN(v))return '—';
  let t=Math.round(v)%1440; if(t<0)t+=1440;
  const h=Math.floor(t/60),m=t%60;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}
const p5={a5:null,time:'',keep:false};
function predict5H(){
  const M=fit5H(),AFT=targetAF();
  const a5=p5.a5, t5=hhmmToMin(p5.time);
  if(a5==null||t5==null)return null;
  const amb=state.recs[0]&&state.recs[0].amb!=null?state.recs[0].amb:22.7;
  const last=state.recs.filter(r=>r.cool!=null)[0];
  const cool=last?last.cool:40.0;
  const gap=AFT-a5;
  const rem=M.b0+M.b1*gap+M.b2*amb+M.b3*cool;
  const rem2=M.b0+M.b1*gap;
  return {AFT,a5,t5,amb,cool,gap,rem,rem2,end:t5+rem,
    lo:t5+rem-1.28*M.sd,hi:t5+rem+1.28*M.sd,
    lo95:t5+rem-1.96*M.sd,hi95:t5+rem+1.96*M.sd,M};
}
function viewPredictCard(){
  const M=fit5H(),AFT=targetAF(),P=predict5H();
  const now=new Date();
  const nowMin=now.getHours()*60+now.getMinutes();
  return `<div class="sec">
    <div class="sech"><h2>5H 시점 종결 예측</h2><span class="hint">5H 산도만 넣으면 종결 예상시각이 나옵니다</span></div>
    <div class="card pad">
      <div class="fields" style="grid-template-columns:1fr 1fr 1.1fr">
        <div class="fld"><label>5H 측정 산도 <em>*</em></label>
          <div class="u"><input id="p_a5" type="text" inputmode="decimal" value="${p5.a5==null?'':p5.a5}" placeholder="0.865" oninput="p5set('a5',this.value)"><span>%</span></div></div>
        <div class="fld"><label>5H 측정 시각 <em>*</em></label>
          <input id="p_time" type="time" value="${p5.time}" oninput="p5set('time',this.value)"></div>
        <div class="fld"><label>목표 종결산도</label>
          <div class="u"><input type="text" value="${fmt(AFT,4)}" readonly style="background:#F5F8FA;color:#54697D"><span>여름</span></div></div>
      </div>
      ${!P?`<div class="alert i" style="margin-top:14px"><div>5H 산도와 측정 시각을 입력하면 <b>예상 종결시각</b>과 남은 시간을 계산합니다. 5H는 접종 후 300분 시점입니다.</div></div>`
      :`
      <div class="row" style="margin-top:16px;gap:10px;align-items:stretch">
        <div class="card" style="flex:1;background:#F2FAF8;border-color:#BFE3DE;box-shadow:none;padding:16px 18px">
          <div class="lb note">예상 종결시각</div>
          <div style="font-size:46px;font-weight:800;letter-spacing:-1.5px;color:#0B5F59;font-variant-numeric:tabular-nums;line-height:1.1;margin-top:4px">${minToHHMM(P.end)}</div>
          <div class="note" style="margin-top:4px">남은 시간 <b>${fInt(P.rem)}분</b> (${fmt(P.rem/60,1)}시간)</div>
        </div>
        <div class="card" style="flex:1;background:#FBFCFD;box-shadow:none;padding:16px 18px">
          <div class="lb note">80% 예측 구간</div>
          <div style="font-size:24px;font-weight:750;margin-top:6px;font-variant-numeric:tabular-nums;letter-spacing:-.5px">${minToHHMM(P.lo)} ~ ${minToHHMM(P.hi)}</div>
          <div class="note" style="margin-top:4px">95% 구간 ${minToHHMM(P.lo95)} ~ ${minToHHMM(P.hi95)} · 잔차 σ ${fmt(M.sd,1)}분</div>
        </div>
      </div>
      <table style="margin-top:14px"><thead><tr><th class="l">계산 항목</th><th>값</th><th class="l">의미</th></tr></thead><tbody>
        <tr><td class="l">5H 산도 격차</td><td>${fmt(P.gap,4)} %</td><td class="l">목표 ${fmt(P.AFT,4)} − 현재 ${fmt(P.a5,4)}</td></tr>
        <tr><td class="l">5H 이후 남은 시간</td><td>${fInt(P.rem)} 분</td><td class="l">격차 ${fmt(P.gap,3)}% × ${fInt(M.b1)}분/% + 환경 보정</td></tr>
        <tr><td class="l">적용 환경</td><td>${fmt(P.amb,1)}℃ / ${fmt(P.cool,1)}℃</td><td class="l">실내온도 / 살균냉각 (최근 배치 기준)</td></tr>
        <tr><td class="l">접종 후 총 소요</td><td>${fInt(300+P.rem)} 분</td><td class="l">300분(5H) + 남은 ${fInt(P.rem)}분 = ${fmt((300+P.rem)/60,1)}시간</td></tr>
      </tbody></table>
      <div class="alert ${P.rem<20?'a':'g'}" style="margin-top:12px"><div>
        ${P.rem<20?'<b>종결 시점이 임박했습니다.</b> 남은 시간이 20분 미만이면 산도 측정 주기를 30분 이내로 좁히세요.'
        :'<b>'+minToHHMM(P.end)+'</b> 전후로 종결 산도를 확인하세요. 예측은 5H 산도 하나에서 출발하므로 5H 측정 오차(±0.005%)가 종결시각을 약 ±4분 움직입니다.'}
      </div></div>`}
      <div class="note" style="margin-top:10px">모델: 남은시간 = ${fmt(M.b0,1)} + ${fmt(M.b1,1)}×격차 + ${fmt(M.b2,2)}×실내 + ${fmt(M.b3,2)}×냉각 (r²=${fmt(M.r2,2)}, n=${M.n}, σ=${fmt(M.sd,1)}분). ${M.fixed?'데이터 부족으로 기본 계수 사용 중':'보유 데이터로 자동 산출'}</div>
    </div>
  </div>`;
}
function p5set(k,v){
  if(k==='a5'){const n=parseFloat(v);p5.a5=isNaN(n)?null:n;}
  else p5.time=v;
  const card=document.getElementById('p5card');
  if(card)card.innerHTML=viewPredictCard();
}
