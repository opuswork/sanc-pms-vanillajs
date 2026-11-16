/* ===== 원격 자동 업데이트 (GitHub Pages) ===== */
const NET_URLS=[
  'https://raw.githubusercontent.com/potato6u-byte/syncheon-pms/main/app.html',
  'https://raw.githubusercontent.com/potato6u-byte/syncheon-pms/main/app.html.html',
  'https://potato6u-byte.github.io/syncheon-pms/app.html'
];
const NET_KEY='pms_net_applied';
function netVer(s){
  const m=/<meta[^>]+name=["']app-version["'][^>]+content=["']([\d.]+)["']/i.exec(s);
  return m?m[1]:null;
}
function netCmp(a,b){
  const pa=String(a||'0').split('.').map(n=>parseInt(n,10)||0);
  const pb=String(b||'0').split('.').map(n=>parseInt(n,10)||0);
  const n=Math.max(pa.length,pb.length);
  for(let i=0;i<n;i++){
    const x=pa[i]||0,y=pb[i]||0;
    if(x!==y)return x>y?1:-1;
  }
  return 0;
}
function netFetchOne(u){
  return new Promise(res=>{
    let done=false;
    const fin=v=>{if(!done){done=true;res(v);}};
    const t=setTimeout(()=>fin(null),9000);
    try{
      fetch(u+'?t='+Date.now(),{cache:'no-store'})
        .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.text();})
        .then(txt=>{clearTimeout(t);fin(txt);})
        .catch(()=>{clearTimeout(t);fin(null);});
    }catch(e){clearTimeout(t);fin(null);}
  });
}
function netFetch(){
  let i=0;
  const step=()=>{
    if(i>=NET_URLS.length)return Promise.resolve(null);
    const u=NET_URLS[i++];
    return netFetchOne(u).then(txt=>{
      if(txt&&txt.length>20000&&txt.indexOf('app-version')>=0)return txt;
      return step();
    });
  };
  return step();
}
function netApply(html,ver){
  try{sessionStorage.setItem(NET_KEY,ver||'1');}catch(e){}
  document.open();
  document.write(html);
  document.close();
}
function netAuto(){
  try{if(sessionStorage.getItem(NET_KEY))return;}catch(e){}
  const cur=(typeof appVer==='function')?appVer():'0';
  netFetch().then(txt=>{
    if(!txt||txt.length<20000||txt.indexOf('app-version')<0)return;
    const rv=netVer(txt);
    if(!rv||netCmp(rv,cur)<=0)return;
    try{sessionStorage.setItem(NET_KEY,rv);}catch(e){}
    netApply(txt,rv);
  });
}
function netCheck(){
  const cur=(typeof appVer==='function')?appVer():'0';
  toast('새 버전을 확인하는 중입니다');
  netFetch().then(txt=>{
    if(!txt){toast('서버에 연결하지 못했습니다 — 네트워크를 확인하세요');return;}
    const rv=netVer(txt);
    if(!rv){toast('서버 파일을 읽을 수 없습니다');return;}
    if(netCmp(rv,cur)<=0){toast('이미 최신입니다 (v'+cur+')');return;}
    openModal('새 버전이 있습니다',
      '<div class="alert i"><div>현재 <b>v'+cur+'</b> · 서버 <b>v'+rv+'</b><br>지금 적용하면 화면이 새로 뜹니다. 입력한 데이터는 그대로 유지됩니다.</div></div>',
      '<button class="btn gho" onclick="closeModal()">나중에</button>'
      +'<button class="btn pri" onclick="closeModal();netForce()">지금 적용</button>');
    window._netHtml=txt;window._netVer=rv;
  });
}
function netForce(){
  if(!window._netHtml){netCheck();return;}
  netApply(window._netHtml,window._netVer);
}
(function(){
  if(typeof window.boot==='function'){
    const ob=window.boot;
    window.boot=function(){
      ob.apply(this,arguments);
      try{setTimeout(netAuto,1800);}catch(e){}
    };
  }
})();
