# GPS Link

모바일·PC용 지도와 Vercel HTTPS 수신 API입니다.

## 현재 상태

- 기본 주소 접속 시 브라우저 위치 권한 요청 후 내 위치 표시
- URL 좌표 표시, 직접 입력, 공유 URL 복사 구현 완료
- API: 장치별 최신 좌표 저장/조회, 전송 키 확인, 좌표 검증 구현 완료
- Upstash Redis Free 연결 완료: Production 전용 lte-gps-map-redis
- 단위 테스트 20개 통과. 공개 사이트 URL 좌표 표시 확인. LTE 장비 시험은 미실시
- Vercel 프로젝트 생성됨: lte-gps-map / prj_14AsJ9mK7zqhlkJuXASD35PyYpKb
- 팀: team_QtCilW4X3sD6vn4oMeyEE8c3 (unogims-projects)
- 공개 사이트: https://lte-gps-map.vercel.app
- GitHub 저장소: https://github.com/unogim4/lte-gps-map
- main 브랜치에 푸시하면 Vercel Production 자동 배포

## Vercel 배포

Vercel 프로젝트에 unogim4/lte-gps-map 저장소가 연결되어 있습니다. main 브랜치의 새 커밋은 자동으로 빌드·배포되며 https://lte-gps-map.vercel.app 에 반영됩니다. Framework Preset은 Other, Output Directory는 public입니다. api/location.js는 Vercel Function으로 실행합니다.

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
   - KV_REST_API_URL 또는 UPSTASH_REDIS_REST_URL: Upstash REST URL
   - KV_REST_API_TOKEN 또는 UPSTASH_REDIS_REST_TOKEN: Upstash REST 토큰
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

5. 다른 기기에서 https://YOUR-DOMAIN/?device=gps-01 을 열면 자동 수신이 시작됩니다. 요청 완료 후 5초 간격으로 최신 좌표를 조회합니다.

전송 성공은 HTTP 200과 ok:true 응답으로 확인합니다. 잘못된 좌표 400, 전송 키 오류 401, 저장소 미설정 503, 저장소 통신 실패 502입니다. 실패 시 GPS 장치 측 재시도가 필요합니다. 서버는 마지막으로 수신한 좌표 한 건만 저장합니다. 경로 이력은 저장하지 않습니다. 읽기는 공개이므로 장치 ID를 알면 최신 위치를 조회할 수 있습니다.

LTE는 장치의 인터넷 연결 방식입니다. GPS 원시 NMEA나 이동통신 모뎀의 AT 명령을 이 사이트가 직접 해석하지 않습니다. 장치 펌웨어에서 좌표를 변환하고 HTTPS GET/POST 요청을 만들어야 합니다. 장치·모뎀의 TLS 인증서 검증 및 HTTPS 지원을 확인하세요.

지도는 Leaflet 1.9.4와 OpenStreetMap 타일을 사용하므로 Leaflet 라이브러리는 사이트에 포함되어 있고, 지도 이미지는 OpenStreetMap 서버에서 받습니다. 모바일 지도는 명시적 높이와 크기 재계산으로 표시합니다.

## 검증

```sh
npm test
```

공식 참고: https://vercel.com/docs/functions/runtimes/node-js 및 https://upstash.com/docs/redis/features/restapi

## 내 현재 위치

https://lte-gps-map.vercel.app 에 접속하고 위치 요청을 허용하면 내 위치가 표시됩니다. 전송키는 필요하지 않습니다. 위치 권한이 차단되면 주소창의 사이트 설정에서 위치를 허용하고 내 위치 찾기를 누르세요. 데스크톱은 Wi-Fi/네트워크 기반 추정 위치로 오차가 클 수 있습니다. 이 기능은 좌표를 Redis에 자동 전송하지 않습니다. device 링크는 해당 장치의 서버 수신 위치를 표시합니다.

## 동의한 방문자 위치 공유

- 기본 페이지의 ‘관리자에게 위치 공유’에서 목적·보관기간을 확인하고 체크한 후 버튼을 눌러야 전송합니다.
- 위치 권한 허용만으로 서버에 공유하지 않습니다. 정확한 위치·정확도·시각·선택 별명을 공유 시작 후 약 5초마다 최신 값으로 갱신합니다.
- 마지막 전송 후 최대 24시간 보관하며 관리자 화면은 최근 200건을 표시합니다. 방문자는 같은 페이지를 닫기 전 삭제 버튼으로 공유를 취소할 수 있습니다.
- 관리자 화면: https://lte-gps-map.vercel.app/admin.html
- 서버 환경변수 ADMIN_ACCESS_KEY(Production Secret)가 필요합니다. GPS_WRITE_KEY와 분리되어 있습니다.
- 관리자 인증키는 URL·브라우저 저장소에 넣지 않고 페이지 메모리에서만 사용합니다. GET /api/visitors에는 Authorization: Bearer 인증이 필요합니다.
- 방문자 레코드는 visitor-sharing:record 네임스페이스로 저장되며 Redis TTL 86400초를 적용합니다. 공개 장치 조회 API에서는 방문자 위치를 읽을 수 없습니다.
- 위치 데이터 자체는 실제 신원이나 실제 좌표임을 검증하지 않으므로 본인확인 수단으로 사용하지 마세요.

## TM800 고정 수신 경로

`/radlot/data` 및 `/radlot/data/`를 HTTPS 수신 API에 연결했습니다. JSON/폼/쿼리의 십진수 좌표와 기존 GPS 전송키를 사용합니다. 실제 펌웨어 형식은 미확인입니다. 자세한 설정·시험 방법은 [TM800.md](TM800.md)를 참고하세요.

## 실시간 위치 추적

휴대폰 방문자는 실시간 공유에 동의하고 시작 버튼을 누르면 화면이 활성화된 동안 약 5초마다 전송합니다. 공유 중지 또는 동의 해제로 중단할 수 있고, 화면이 비활성화되어도 중지합니다. 페이지를 닫거나 화면을 잠근 상태의 백그라운드 추적은 지원하지 않습니다. 관리자 지도는 약 5초 간격으로 조회하며 따라가기 버튼으로 지도 자동 이동을 켜고 끕니다. 각 방문자의 기존 레코드를 갱신하므로 5초마다 새 방문자가 생성되지 않습니다. GPS 장치의 송신 주기는 장치 펌웨어에서 별도로 5초로 설정해야 합니다. 네트워크·GPS 획득 지연으로 실제 전송/표시 간격은 늘어날 수 있습니다.
