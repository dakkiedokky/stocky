const { app, BrowserWindow, Tray, Notification, powerSaveBlocker, nativeImage } = require('electron');
const path = require('path'), fs = require('fs');
const R = []; const ok=(n,d='')=>R.push(['✓',n,d]); const no=(n,d='')=>R.push(['✗',n,d]);

app.disableHardwareAcceleration();          // headless container
app.setAppUserModelId('com.dakkie.youngeun0919');  // REQUIRED for Windows toast

app.whenReady().then(async () => {
  ok('Electron 부팅', 'v' + process.versions.electron + ' / Chromium ' + process.versions.chrome);
  ok('AppUserModelID 설정', app.getAppPath() ? 'com.dakkie.youngeun0919' : '');

  // kiosk window
  let win;
  try {
    win = new BrowserWindow({ width:1920, height:1080, kiosk:true, frame:false, show:false,
      webPreferences:{ contextIsolation:true, nodeIntegration:false } });
    ok('kiosk 전체화면 창', `isKiosk=${win.isKiosk()}`);
  } catch(e){ no('kiosk 창', e.message); }

  // powerSaveBlocker
  try {
    const id = powerSaveBlocker.start('prevent-display-sleep');
    const on = powerSaveBlocker.isStarted(id);
    powerSaveBlocker.stop(id);
    on ? ok('powerSaveBlocker', 'prevent-display-sleep 동작') : no('powerSaveBlocker','시작 실패');
  } catch(e){ no('powerSaveBlocker', e.message); }

  // Tray
  try {
    const t = new Tray(nativeImage.createFromPath(path.join(__dirname,'tray.png')));
    t.setToolTip('0919'); ok('Tray 상주', '아이콘 로드 + 툴팁');
    t.destroy();
  } catch(e){ no('Tray 상주', e.message); }

  // Notification
  try {
    const sup = Notification.isSupported();
    new Notification({ title:'오늘의 조각이 열렸어요', body:'D-6' });
    ok('Notification 생성', `isSupported=${sup} (리눅스 컨테이너라 false 정상 / Windows는 true)`);
  } catch(e){ no('Notification', e.message); }

  // login item
  try { const s = app.getLoginItemSettings(); ok('자동 실행 API', `openAtLogin 조회 가능 (${s.openAtLogin})`); }
  catch(e){ no('자동 실행 API', e.message); }

  // printToPDF with Korean webfont  ← the real test
  try {
    await win.loadFile('cert.html');
    await new Promise(r=>setTimeout(r,900));   // let webfont settle
    const pdf = await win.webContents.printToPDF({
      pageSize:'A5', printBackground:true, margins:{marginType:'none'} });
    fs.writeFileSync('cert-electron.pdf', pdf);
    ok('printToPDF 한글 증서', `A5 ${(pdf.length/1024).toFixed(1)} KB`);
  } catch(e){ no('printToPDF 한글 증서', e.message); }

  // offscreen render of the reveal frame (blur+tiles perf sanity)
  try {
    await win.loadURL('data:text/html,' + encodeURIComponent(
      `<body style="margin:0;background:#0F0D18"><div style="width:630px;height:882px;
       filter:blur(60px) saturate(0);background:linear-gradient(45deg,#9E2B3A,#F0C24B)"></div></body>`));
    const t0=Date.now();
    const img = await win.webContents.capturePage();
    ok('blur(60px) 렌더 + 캡처', `${img.getSize().width}×${img.getSize().height}, ${Date.now()-t0}ms`);
  } catch(e){ no('blur 렌더', e.message); }

  console.log('\n=== ELECTRON CHECKS ===');
  for (const [s,n,d] of R) console.log(`  ${s}  ${n}${d?'  —  '+d:''}`);
  console.log(`\n  ${R.filter(r=>r[0]==='✓').length}/${R.length} passed`);
  app.exit(R.some(r=>r[0]==='✗') ? 1 : 0);
});
