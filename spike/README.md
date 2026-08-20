# 실현 가능성 스파이크

`docs/tech-spec.md` §0의 검증을 재현하는 스크립트입니다.
결론은 그 문서에 정리돼 있고, 여기는 실행 방법만 둡니다.

```bash
npm i electron qrcode
curl -sS -L -o kfont.bin "$(curl -sS -H 'User-Agent: Mozilla/5.0' \
  'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo' \
  | grep -oE 'https://fonts.gstatic.com[^)]*\.ttf' | head -1)"

node node-checks.js                    # 해시 · AES-GCM · QR · 날짜 로직
npx electron .                         # Electron API + printToPDF 한글 증서
# 리눅스 헤드리스: xvfb-run -a npx electron . --no-sandbox
```

`main.js`가 `cert.html`을 A5 PDF로 출력합니다. **`pdf-lib`는 쓰지 않습니다** —
한글 폰트 임베드에 실패해서 Electron의 `printToPDF`로 대체했습니다. 근거는 tech-spec §0.
