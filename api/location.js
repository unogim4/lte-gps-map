export function parsePoint(input) {
  const device = input.device || 'gps-01';
  if (typeof device !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(device)) throw Error('장치 ID는 영문·숫자·밑줄·하이픈 1~40자입니다.');
  for (const field of ['lat', 'lng']) if (input[field] === undefined || input[field] === null || String(input[field]).trim() === '' || !['string','number'].includes(typeof input[field])) throw Error('lat와 lng가 필요합니다.');
  const lat = Number(input.lat), lng = Number(input.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) throw Error('위도는 -90~90, 경도는 -180~180이어야 합니다.');
  const point = {device, lat, lng, receivedAt: new Date().toISOString()};
  // W-023: 선택값 고도(m)·배터리(%). 없으면 저장하지 않는다(기존 단말기 패킷 그대로 동작).
  const optional = (name, value, min, max, message) => {
    if (value === undefined || value === null || String(value).trim() === '') return;
    if (!['string','number'].includes(typeof value)) throw Error(message);
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) throw Error(message);
    point[name] = number;
  };
  optional('alt', input.alt ?? input.altitude, -1000, 20000, '고도(alt)는 -1000~20000 사이 숫자(m)여야 합니다.');
  optional('battery', input.battery ?? input.bat, 0, 100, '배터리(battery)는 0~100 사이 숫자(%)여야 합니다.');
  // W-016: 수집 모드 1 = GPS, 2 = 기지국 위치. 그 밖의 값은 저장하지 않는다.
  if (input.mode === '1' || input.mode === '2') point.mode = input.mode;
  return point;
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (!['GET','POST'].includes(req.method)) {res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'GET 또는 POST를 사용하세요.'});}
  const input = req.method === 'POST' ? req.body : req.query;
  if (!input || typeof input !== 'object') return res.status(400).json({error:'JSON 또는 URL 매개변수를 보내세요.'});
  const writing = req.method === 'POST' || input.lat !== undefined || input.lng !== undefined;
  let point;
  try { if (writing) point = parsePoint(input); } catch(e) {return res.status(400).json({error:e.message});}
  const device = input.device || 'gps-01';
  if (typeof device !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(device)) return res.status(400).json({error:'잘못된 장치 ID입니다.'});
  const url=process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL, token=process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(503).json({error:'실시간 수신용 저장소가 아직 연결되지 않았습니다. URL 좌표 표시 기능은 사용할 수 있습니다.',code:'STORAGE_NOT_CONFIGURED'});
  if (writing && !process.env.GPS_WRITE_KEY) return res.status(503).json({error:'서버 GPS_WRITE_KEY를 설정하세요.'});
  if (writing && (req.headers['x-gps-key'] || input.key) !== process.env.GPS_WRITE_KEY) return res.status(401).json({error:'전송 키가 일치하지 않습니다.'});
  try {
    const command = writing ? [
      ['SET',`gps:${device}`,JSON.stringify(point)],
      ['LPUSH',`gps-history:${device}`,JSON.stringify(point)],
      ['LTRIM',`gps-history:${device}`,0,9999]
    ] : ['GET',`gps:${device}`];
    const response=await fetch(writing ? url.replace(/\/$/,'')+'/multi-exec' : url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
    const data=await response.json();
    if (!response.ok || data.error || (writing && (!Array.isArray(data) || data.some(item=>item.error)))) throw Error('Storage failure');
    if (writing) return res.status(200).json({ok:true,location:point});
    return res.status(200).json({location:data.result ? JSON.parse(data.result) : null});
  } catch {return res.status(502).json({error:'저장소 연결에 실패했습니다. 잠시 후 다시 시도하세요.'});}
}
