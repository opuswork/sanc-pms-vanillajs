/* ===== formatting & stats & charts ===== */
const fmt=(v,d)=>{ if(v==null||v===''||isNaN(v))return '—'; const n=Number(v); return n.toFixed(d==null?2:d); };
const fInt=v=>(v==null||isNaN(v))?'—':Math.round(Number(v)).toLocaleString('ko-KR');
const pct=(a,b)=>b?((a-b)/b*100):0;
const sgn=v=>(v>0?'+':'')+v.toFixed(1);
const mm=d=>d.slice(0,7);
const md=d=>d.slice(5).replace('-','.');
const seasonOf=d=>{const m=+d.slice(5,7);return (m>=6&&m<=8)?'summer':((m===12||m<=2)?'winter':'mid');};
const SEASON_KO={summer:'여름',winter:'겨울',mid:'중간기'};
const SEASON_COLOR={summer:'#D9720F',winter:'#2B6CB0',mid:'#94A3B2'};

function mean(a){a=a.filter(v=>v!=null&&!isNaN(v));return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;}
function sd(a){a=a.filter(v=>v!=null&&!isNaN(v));if(a.length<2)return null;const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)*(v-m),0)/a.length);}
function quant(a,p){a=a.filter(v=>v!=null&&!isNaN(v)).slice().sort((x,y)=>x-y);if(!a.length)return null;
  const i=(a.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return a[lo]+(a[hi]-a[lo])*(i-lo);}
function stat(a){a=a.filter(v=>v!=null&&!isNaN(v));if(!a.length)return null;
  return {n:a.length,mean:mean(a),sd:sd(a),min:Math.min.apply(null,a),max:Math.max.apply(null,a),
          q1:quant(a,.25),med:quant(a,.5),q3:quant(a,.75)};}

/* derived metrics for one batch */
function der(r){
  const d1=(r.a1!=null&&r.a0!=null)?r.a1-r.a0:null;
  const d5=(r.a5!=null&&r.a1!=null)?r.a5-r.a1:null;
  const df=(r.aF!=null&&r.a5!=null)?r.aF-r.a5:null;
  const dur=r.afm!=null?Number(r.afm):(r.mins!=null?Number(r.mins)+300:null);
  const mins=dur!=null?dur-300:null;
  const rate=(df!=null&&mins)?df/mins:null;
  return {d1,d5,df,dur,mins,rate,h:dur!=null?dur/60:null};
}

/* ---------- SVG chart helpers (viewBox 720 x H) ---------- */
function svgOpen(w,h){return `<svg class="ch" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">`;}
function niceTicks(lo,hi,n){
  const span=hi-lo||1, raw=span/n, mag=Math.pow(10,Math.floor(Math.log10(raw)));
  const step=[1,2,2.5,5,10].map(k=>k*mag).find(s=>s>=raw)||10*mag;
  const out=[];let v=Math.floor(lo/step)*step;
  while(v<=hi+step*0.001){if(v>=lo-step*0.001)out.push(+v.toFixed(6));v+=step;}
  return out;
}
function lineChart(opt){
  const w=720,h=opt.h||250,pl=48,pr=18,pt=16,pb=30;
  const xs=opt.xl||[];
  const all=[].concat.apply([],opt.series.map(s=>s.vals)).filter(v=>v!=null&&!isNaN(v));
  if(!all.length)return `<div class="empty">데이터 없음</div>`;
  let lo=opt.lo!=null?opt.lo:Math.min.apply(null,all);
  let hi=opt.hi!=null?opt.hi:Math.max.apply(null,all);
  if(opt.lo==null||opt.hi==null){const p=(hi-lo)*0.16||1;if(opt.lo==null)lo-=p;if(opt.hi==null)hi+=p;}
  const n=Math.max(1,xs.length);
  const X=i=>pl+(w-pl-pr)*(n<=1?0.5:i/(n-1));
  const Y=v=>pt+(h-pt-pb)*(1-(v-lo)/(hi-lo));
  let g='';
  const ticks=opt.yticks?opt.yticks:niceTicks(lo,hi,4);
  ticks.forEach(t=>{const y=Y(t);if(y<pt-1||y>h-pb+1)return;
    g+=`<line x1="${pl}" y1="${y.toFixed(1)}" x2="${w-pr}" y2="${y.toFixed(1)}" stroke="#EDF1F5"/>`;
    g+=`<text class="axv" x="${pl-7}" y="${(y+3.5).toFixed(1)}" text-anchor="end">${opt.yfmt?opt.yfmt(t):t}</text>`;});
  if(opt.band){const y1=Y(opt.band.hi),y2=Y(opt.band.lo);
    g+=`<rect x="${pl}" y="${y1.toFixed(1)}" width="${w-pl-pr}" height="${Math.max(1,y2-y1).toFixed(1)}" fill="${opt.band.color||'#0F7A72'}" opacity=".07"/>`;
    if(opt.band.label)g+=`<text class="axl" x="${w-pr-4}" y="${(y1+11).toFixed(1)}" text-anchor="end" fill="${opt.band.color||'#0F7A72'}">${opt.band.label}</text>`;}
  (opt.hlines||[]).forEach(hl=>{const y=Y(hl.y);
    g+=`<line x1="${pl}" y1="${y.toFixed(1)}" x2="${w-pr}" y2="${y.toFixed(1)}" stroke="${hl.c}" stroke-width="1.4" stroke-dasharray="5 4"/>`;
    if(hl.label)g+=`<text class="axl" x="${w-pr}" y="${(y-5).toFixed(1)}" text-anchor="end" fill="${hl.c}">${hl.label}</text>`;});
  let paths='',dots='';
  opt.series.forEach(s=>{
    let d='',st=false;
    s.vals.forEach((v,i)=>{if(v==null||isNaN(v))return;const x=X(i),y=Y(v);
      d+=(st?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)+' ';st=true;});
    if(s.area&&d)paths+=`<path d="${d}L${X(n-1)} ${h-pb}L${X(0)} ${h-pb}Z" fill="${s.color}" opacity=".08"/>`;
    paths+=`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.w||2.2}" stroke-linejoin="round" stroke-linecap="round"/>`;
    if(s.dots!==false)s.vals.forEach((v,i)=>{if(v==null||isNaN(v))return;
      dots+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.6" fill="#fff" stroke="${s.color}" stroke-width="1.8"/>`;});
  });
  let xl='';
  const stepM=Math.ceil(n/(opt.maxLabels||12));
  xs.forEach((t,i)=>{if(i%stepM!==0&&i!==n-1)return;
    xl+=`<text class="axl" x="${X(i).toFixed(1)}" y="${h-10}" text-anchor="middle">${t}</text>`;});
  return svgOpen(w,h)+g+paths+dots+xl+'</svg>';
}

function scatterChart(pts,opt){
  const w=720,h=opt.h||260,pl=52,pr=20,pt=16,pb=34;
  if(!pts.length)return `<div class="empty">데이터 없음</div>`;
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  let x0=Math.min.apply(null,xs),x1=Math.max.apply(null,xs),y0=Math.min.apply(null,ys),y1=Math.max.apply(null,ys);
  const px=(x1-x0)*0.05||1,py=(y1-y0)*0.1||1;x0-=px;x1+=px;y0-=py;y1+=py;
  const X=v=>pl+(w-pl-pr)*((v-x0)/(x1-x0||1)),Y=v=>pt+(h-pt-pb)*(1-((v-y0)/(y1-y0||1)));
  let g='';
  niceTicks(y0,y1,4).forEach(t=>{const y=Y(t);
    g+=`<line x1="${pl}" y1="${y.toFixed(1)}" x2="${w-pr}" y2="${y.toFixed(1)}" stroke="#EDF1F5"/>`;
    g+=`<text class="axv" x="${pl-7}" y="${(y+3.5).toFixed(1)}" text-anchor="end">${Math.round(t)}</text>`;});
  niceTicks(x0,x1,6).forEach(t=>{
    g+=`<text class="axl" x="${X(t).toFixed(1)}" y="${h-12}" text-anchor="middle">${Math.round(t)}</text>`;});
  if(opt.fit){
    const f=opt.fit;
    g+=`<line x1="${X(x0)}" y1="${Y(f.b0+f.b1*x0).toFixed(1)}" x2="${X(x1)}" y2="${Y(f.b0+f.b1*x1).toFixed(1)}"
      stroke="#0F7A72" stroke-width="1.8" stroke-dasharray="6 4" opacity=".85"/>`;
  }
  const dots=pts.map(p=>{const c=SEASON_COLOR[p[2]||'mid']||'#94A3B2';
    return `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3.1" fill="${c}" opacity=".55"/>`;}).join('');
  let ax='';
  if(opt.xlabel)ax+=`<text class="axl" x="${(pl+w-pr)/2}" y="${h-1}" text-anchor="middle">${opt.xlabel}</text>`;
  return svgOpen(w,h)+g+dots+ax+'</svg>';
}

function barChart(opt){
  const w=720,h=opt.h||230,pl=44,pr=16,pt=16,pb=34;
  const vals=opt.vals,labels=opt.labels;
  const all=vals.filter(v=>v!=null&&!isNaN(v));
  if(!all.length)return `<div class="empty">데이터 없음</div>`;
  let lo=opt.lo!=null?opt.lo:Math.min.apply(null,all);
  let hi=opt.hi!=null?opt.hi:Math.max.apply(null,all);
  if(opt.lo==null){lo=lo-(hi-lo)*0.25;} if(opt.hi==null){hi=hi+(hi-lo)*0.12;}
  const n=vals.length;
  const bw=(w-pl-pr)/n;
  const Y=v=>pt+(h-pt-pb)*(1-(v-lo)/(hi-lo));
  let g='';
  niceTicks(lo,hi,4).forEach(t=>{const y=Y(t);
    g+=`<line x1="${pl}" y1="${y.toFixed(1)}" x2="${w-pr}" y2="${y.toFixed(1)}" stroke="#EDF1F5"/>`;
    g+=`<text class="axv" x="${pl-7}" y="${(y+3.5).toFixed(1)}" text-anchor="end">${Math.round(t)}</text>`;});
  if(opt.ref!=null){const y=Y(opt.ref);
    g+=`<line x1="${pl}" y1="${y.toFixed(1)}" x2="${w-pr}" y2="${y.toFixed(1)}" stroke="#0F7A72" stroke-width="1.5" stroke-dasharray="6 4"/>`;
    if(opt.refLabel)g+=`<text class="axl" x="${w-pr}" y="${(y-5).toFixed(1)}" text-anchor="end" fill="#0F7A72">${opt.refLabel}</text>`;}
  vals.forEach((v,i)=>{ if(v==null||isNaN(v))return;
    const x=pl+bw*i+bw*0.18, bh=Math.max(1,Y(lo)-Y(v));
    const c=(opt.colors&&opt.colors[i])||'#2B6CB0';
    g+=`<rect x="${x.toFixed(1)}" y="${Y(v).toFixed(1)}" width="${(bw*0.64).toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${c}" opacity=".82"/>`;
    if(opt.showVal&&n<=14)g+=`<text class="axl" x="${(x+bw*0.32).toFixed(1)}" y="${(Y(v)-5).toFixed(1)}" text-anchor="middle">${Math.round(v)}</text>`;
  });
  const step=Math.ceil(n/14);
  labels.forEach((t,i)=>{if(i%step!==0&&i!==n-1)return;
    g+=`<text class="axl" x="${(pl+bw*i+bw/2).toFixed(1)}" y="${h-18}" text-anchor="middle">${t}</text>`;});
  if(opt.xlabel)g+=`<text class="axl" x="${(w)/2}" y="${h-2}" text-anchor="middle">${opt.xlabel}</text>`;
  return svgOpen(w,h)+g+'</svg>';
}

/* linear fit */
function fit(pts){
  const p=pts.filter(q=>q[0]!=null&&q[1]!=null);
  if(p.length<3)return null;
  const n=p.length,mx=mean(p.map(q=>q[0])),my=mean(p.map(q=>q[1]));
  let sxy=0,sxx=0,syy=0;
  p.forEach(q=>{sxy+=(q[0]-mx)*(q[1]-my);sxx+=(q[0]-mx)*(q[0]-mx);syy+=(q[1]-my)*(q[1]-my);});
  if(!sxx||!syy)return null;
  const b1=sxy/sxx,b0=my-b1*mx,r2=(sxy*sxy)/(sxx*syy);
  return {b0,b1,r2,n};
}
