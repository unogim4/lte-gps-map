# GPS Link

모바일·PC용 지도와 Vercel HTTPS 수신 API입니다.

## 현재 상태

- URL 좌표 표시, 직접 입력, 공유 URL 복사 구현 완료
- API: 장치별 최신 좌표 저장/조회, 전송 키 확인, 좌표 검증 구현 완료
- Upstash 미연결: 서버 수신은 503 응답. 가짜 저장 또는 임시 메모리 저장 없음
- 단위 테스트 3개 통과. 실제 브라우저 지도 렌더링 및 LTE 장비 시험은 미실시
- Vercel 프로젝트 생성됨: lte-gps-map / prj_14AsJ9mK7zqhlkJuXASD35PyYpKb
- 팀: team_QtCilW4X3sD6vn4oMeyEE8c3 (unogims-projects)
- 공개 배포 및 보호 설정 변경은 연결 계정의 팀 접근 권한 부족(403)으로 실패. 공개 URL 없음

## Vercel 배포

이 폴더 전체를 Git 저장소에 업로드하고 Vercel에서 연결하세요. Framework Preset은 Other, Output Directory는 public입니다. api/location.js는 Vercel Function으로 실행합니다.

이미 생성된 프로젝트를 사용할 경우 해당 팀 접근 권한이 있는 계정으로 로그인해야 합니다. 다른 컴퓨터나 LTE 장치에서 인증 없이 접속하려면 Project Settings → Deployment Protection에서 공개할 배포의 Vercel Authentication을 해제하세요.

CLI를 사용하는 경우 이 폴더에서 다음 명령을 실행하고 기존 lte-gps-map 프로젝트를 선택하세요.

```sh
npx vercel login
npx vercel link --scope unogims-projects
npx vercel --prod --scope unogims-projects
```

## URL만으로 지도 표시

아래 YOUR-DOMAIN을 실제 배포 주소로 바꾸세요.

```text
https://YOUR-DOMAIN/?lat=37.5665&lng=126.9780
```

이 URL을 여는 브라우저에 위치를 표시합니다. 다른 사람이 URL을 요청했다고 이미 열려 있는 다른 화면이 바뀌지는 않습니다. 그 동작은 아래 서버 수신 기능을 사용합니다.

## GPS → LTE → HTTPS → 저장소 → 지도

1. Upstash에서 Redis 데이터베이스를 생성합니다(요금제를 직접 확인·선택).
2. Vercel 프로젝트의 Settings → Environment Variables에 아래 값을 Production 환경으로 설정합니다.
   - UPSTASH_REDIS_REST_URL: Upstash REST URL
   - UPSTASH_REDIS_REST_TOKEN: Upstash REST 토큰
   - GPS_WRITE_KEY: 직접 생성한 충분히 긴 임의 전송 키
3. 재배포합니다. 토큰·키는 프런트엔드 코드에 넣지 마세요.
4. GPS 장치가 WGS84 십진수 좌표로 다음 HTTPS GET 요청을 보냅니다.

```text
https://YOUR-DOMAIN/api/location?device=gps-01&lat=37.5665&lng=126.9780&key=YOUR_WRITE_KEY
```

POST도 지원합니다. 헤더 전송이 가능하면 URL에 키를 넣는 대신 다음 방식을 권장합니다.

```sh
curl -X POST 'https://YOUR-DOMAIN/api/location' \
  -H 'Content-Type: application/json' \
  -H 'X-GPS-Key: YOUR_WRITE_KEY' \
  -d '{"device":"gps-01","lat":37.5665,"lng":126.9780}'
```

5. 다른 기기에서 https://YOUR-DOMAIN/?device=gps-01 을 열고 ‘장치 위치 수신 시작’을 누릅니다. 요청 완료 후 5초 간격으로 최신 좌표를 조회합니다.

전송 성공은 HTTP 200과 ok:true 응답으로 확인합니다. 잘못된 좌표 400, 전송 키 오류 401, 저장소 미설정 503, 저장소 통신 실패 502입니다. 실패 시 GPS 장치 측 재시도가 필요합니다. 서버는 마지막으로 수신한 좌표 한 건만 저장합니다. 경로 이력은 저장하지 않습니다. 읽기는 공개이므로 장치 ID를 알면 최신 위치를 조회할 수 있습니다.

LTE는 장치의 인터넷 연결 방식입니다. GPS 원시 NMEA나 이동통신 모뎀의 AT 명령을 이 사이트가 직접 해석하지 않습니다. 장치 펌웨어에서 좌표를 변환하고 HTTPS GET/POST 요청을 만들어야 합니다. 장치·모뎀의 TLS 인증서 검증 및 HTTPS 지원을 확인하세요.

지도는 Leaflet 1.9.4와 OpenStreetMap 타일을 사용하므로 브라우저에서 외부 CDN/지도 서버에 연결되어야 합니다.

## 검증

```sh
npm test
```

공식 참고: https://vercel.com/docs/functions/runtimes/node-js 및 https://upstash.com/docs/redis/features/restapi
