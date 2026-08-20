// Runs in plain Node — the parts that don't need a window.
const crypto = require('crypto');
const fs = require('fs');
const results = [];
const ok = (n, d='') => results.push(['PASS', n, d]);
const no = (n, d='') => results.push(['FAIL', n, d]);

// 1. canonical JSON + SHA-256 commit/verify roundtrip
try {
  const canon = o => JSON.stringify(o, Object.keys(o).sort());
  const layout = { slot:'gift', order:['tab','watch','ebook'] };
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.createHash('sha256').update(canon(layout)+salt).digest('hex');
  const again  = crypto.createHash('sha256').update(canon({order:['tab','watch','ebook'],slot:'gift'})+salt).digest('hex');
  digest===again ? ok('해시 커밋 (키 순서 무관 canonical JSON)', digest.slice(0,12))
                 : no('해시 커밋','키 순서에 따라 digest가 달라짐');
} catch(e){ no('해시 커밋', e.message); }

// 2. AES-256-GCM seal / unseal
try {
  const key = crypto.pbkdf2Sync('passphrase', 'salt0919', 120000, 32, 'sha256');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(JSON.stringify({gift:'tab'}),'utf8'), c.final()]);
  const tag = c.getAuthTag();
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag);
  const dec = JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString('utf8'));
  dec.gift==='tab' ? ok('AES-256-GCM 봉인/해제 + PBKDF2') : no('AES-256-GCM','복호화 불일치');
  // tamper detection
  try { const t=crypto.createDecipheriv('aes-256-gcm',key,iv); t.setAuthTag(tag);
        const bad=Buffer.from(enc); bad[0]^=1; Buffer.concat([t.update(bad),t.final()]);
        no('변조 감지','변조된 데이터가 통과함'); }
  catch { ok('변조 감지 (GCM auth tag)'); }
} catch(e){ no('AES-256-GCM', e.message); }

// 3. pdf-lib + Korean font subset embed
try {
  const { PDFDocument, rgb } = require('pdf-lib');
  const fontkit = require('@pdf-lib/fontkit');
  (async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(fs.readFileSync('kfont.bin'), { subset: true });
    const page = doc.addPage([419.5, 595.3]); // A5 @72dpi
    page.drawText('봉  인  증  서', { x:120, y:500, size:20, font, color: rgb(0.1,0.09,0.15) });
    page.drawText('봉인 일시   2026-09-05 20:14 KST', { x:60, y:440, size:10, font });
    page.drawText('봉인 번호   #A7F3-2C91-8E04', { x:60, y:420, size:10, font });
    page.drawText('이 봉투 안에는 아무것도 들어 있지 않습니다.', { x:60, y:360, size:10, font });
    const bytes = await doc.save();
    fs.writeFileSync('cert.pdf', bytes);
    const kb = (bytes.length/1024).toFixed(1);
    ok('pdf-lib 한글 증서 (fontkit + subset)', `A5 ${kb} KB`);
    await stage2();
  })().catch(e => { no('pdf-lib 한글', e.message); stage2(); });
} catch(e){ no('pdf-lib 한글', e.message); }

async function stage2(){
  // 4. qrcode offline
  try {
    const QR = require('qrcode');
    const url = 'https://0919.example/j/7f3a2c918e04';
    const svg = await QR.toString(url, { type:'svg', margin:1 });
    const png = await QR.toDataURL(url);
    (svg.includes('<svg') && png.startsWith('data:image/png'))
      ? ok('QR 오프라인 생성', `SVG ${svg.length}B / PNG dataURI`)
      : no('QR 생성','출력 형식 이상');
  } catch(e){ no('QR 생성', e.message); }

  // 5. day-boundary at 05:00 KST + 밀린 날 순차 재생
  try {
    const KST = 9*60;
    const dayKey = iso => {
      const t = new Date(new Date(iso).getTime() + KST*60000 - 5*3600000);
      return t.toISOString().slice(0,10);
    };
    const a = dayKey('2026-09-12T02:30:00+09:00'); // 새벽 2:30 → 전날로
    const b = dayKey('2026-09-12T06:00:00+09:00'); // 아침 6시 → 당일
    (a==='2026-09-11' && b==='2026-09-12')
      ? ok('날짜 경계 05:00 KST', `02:30→${a} / 06:00→${b}`)
      : no('날짜 경계', `${a} / ${b}`);
    const drawn='2026-09-06', today='2026-09-12', done=new Set(['2026-09-06','2026-09-07']);
    const pend=[]; let d=new Date(drawn+'T00:00:00Z');
    while (d.toISOString().slice(0,10) <= today) {
      const k=d.toISOString().slice(0,10); if(!done.has(k)) pend.push(k);
      d=new Date(d.getTime()+864e5);
    }
    pend.length===5 ? ok('밀린 날 순차 재생', `${pend.length}일 대기: ${pend[0]} … ${pend.at(-1)}`)
                    : no('밀린 날 처리', `${pend.length}일 계산됨`);
  } catch(e){ no('날짜 로직', e.message); }

  console.log('\n=== NODE-SIDE CHECKS ===');
  for (const [s,n,d] of results) console.log(`  ${s==='PASS'?'✓':'✗'}  ${n}${d?'  —  '+d:''}`);
  const fails = results.filter(r=>r[0]==='FAIL').length;
  console.log(`\n  ${results.length - fails}/${results.length} passed`);
  process.exit(fails?1:0);
}
