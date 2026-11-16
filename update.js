/* ===== 앱 업데이트 (재설치 없이 화면 교체) ===== */
function bridge(){return window.AndroidBridge||null;}
function appVer(){const m=document.querySelector('meta[name="app-version"]');return m?m.getAttribute('content'):'—';}
function updateState(){
  const b=bridge();
  if(!b||!b.updateInfo)return {native:false,ver:appVer(),bundled:null,update:null};
  try{return JSON.parse(b.updateInfo());}catch(e){return {native:false,ver:appVer()};}
}
function viewUpdateCard(){
  const s=updateState();
  if(!s.native){
    return `<div class="sec"><div class="sech"><h2>앱 업데이트</h2><span class="hint">웹 버전</span></div>
      <div class="card pad"><div class="alert i"><div>웹 버전은 파일을 새로 열면 항상 최신입니다.
      태블릿 앱(APK)에서는 <b>업데이트 파일 선택</b>으로 재설치 없이 화면을 교체할 수 있습니다.</div></div>
      <div class="note" style="margin-top:8px">현재 버전 v${s.ver}</div></div></div>`;
  }
  const used=s.update?'update':'bundle';
  return `<div class="sec"><div class="sech"><h2>앱 업데이트</h2><span class="hint">재설치 없이 적용</span></div>
    <div class="card pad">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div>
          <div class="lb note">지금 실행 중인 화면</div>
          <div style="font-size:30px;font-weight:780;letter-spacing:-.8px;margin-top:2px">v${s.ver}</div>
          <div class="note" style="margin-top:4px">${used==='update'?'교체된 업데이트 파일에서 실행 중':'앱에 내장된 원본에서 실행 중'}</div>
        </div>
        <span class="chip ${used==='update'?'ac':'nu'}">${used==='update'?'업데이트 적용됨':'내장 버전'}</span>
      </div>
      <table style="margin-top:12px"><thead><tr><th class="l">항목</th><th class="l">버전</th></tr></thead><tbody>
        <tr><td class="l">앱에 내장된 원본</td><td class="l">${s.bundled?'v'+s.bundled:'—'}</td></tr>
        <tr><td class="l">교체된 업데이트 파일</td><td class="l">${s.update?'v'+s.update:'없음'}</td></tr>
      </tbody></table>
      <div class="row" style="margin-top:14px">
        <button class="btn pri" onclick="pickUpdate()">업데이트 파일 선택</button>
        ${used==='update'?'<button class="btn gho" onclick="revertUpdate()">원래 버전으로 되돌리기</button>':''}
      </div>
      <div class="alert i" style="margin-top:14px"><div>
        <b>사용법</b> — 새로 받은 <b>.html</b> 파일을 태블릿에 저장한 뒤 위 버튼으로 선택하면,
        앱을 다시 설치하지 않고 새 화면으로 바로 바뀝니다. <b>입력한 데이터는 그대로 유지됩니다.</b>
      </div></div>
      <div class="note" style="margin-top:8px">되돌리기를 누르면 앱에 내장된 원본으로 실행됩니다. 교체 파일은 앱 내부에 보관되며, 앱을 삭제하면 함께 사라집니다.</div>
    </div></div>`;
}
function pickUpdate(){
  const b=bridge();
  if(!b||!b.pickUpdate){toast('이 환경에서는 지원되지 않습니다');return;}
  try{b.pickUpdate();}catch(e){toast('파일 선택기를 열 수 없습니다');}
}
function revertUpdate(){
  const b=bridge();
  if(!b||!b.revertUpdate)return;
  try{b.revertUpdate();}catch(e){toast('되돌리기에 실패했습니다');}
}
