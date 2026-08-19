// ================================================================================================
// KET NOI MAY CHAM CONG HIKVISION qua ISAPI (v5.59) — vd DS-K1T342MFWX.
//
// Vi sao khong dung node-zklib: may Hikvision KHONG noi giao thuc ZKTeco (cong 4370) ma dung
// ISAPI = HTTP + xac thuc **Digest** (tai khoan/mat khau cua may, thuong 'admin').
//
// KHONG THEM THU VIEN NGOAI (giu dung nguyen tac cua du an: moi package moi = 1 buoc cai dat
// them tai nha may). Dung san:
//   - global fetch  (Node >= 18, xem package.json "engines")
//   - crypto (module loi cua Node) de tinh MD5 cho Digest
//
// 2 API dung o day:
//   POST /ISAPI/AccessControl/AcsEvent?format=json          -> lich su cham cong (co phan trang)
//   POST /ISAPI/AccessControl/UserInfo/Search?format=json    -> danh sach nhan vien tren may
// ================================================================================================
const crypto = require('crypto');

const md5 = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex');

// Tach cac tham so trong header WWW-Authenticate: Digest realm="x", nonce="y", qop="auth"...
function parseDigestHeader(header) {
  const out = {};
  const phan = String(header || '').replace(/^Digest\s+/i, '');
  const re = /(\w+)\s*=\s*(?:"([^"]*)"|([^,\s]+))/g;
  let m;
  while ((m = re.exec(phan)) !== null) out[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3];
  return out;
}

function buildDigestAuth({ username, password, method, uri, wwwAuth, nc, cnonce }) {
  const d = parseDigestHeader(wwwAuth);
  const realm = d.realm || '';
  const nonce = d.nonce || '';
  const qop = (d.qop || '').split(',')[0].trim();   // thuong la 'auth'
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);
  let h = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
  if (qop) h += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  if (d.opaque) h += `, opaque="${d.opaque}"`;
  if (d.algorithm) h += `, algorithm=${d.algorithm}`;
  return h;
}

// Goi 1 API ISAPI: lan 1 khong kem auth de lay 'nonce' tu 401, lan 2 gui kem Digest.
// (Mot so firmware chap nhan Basic — neu 401 lan 2 van bao Basic thi thu tiep bang Basic.)
async function isapiRequest(may, path, bodyObj, timeoutMs) {
  const host = String(may.DiaChiIP || '').trim();
  const port = Number(may.Port) || 80;
  const scheme = may.DungHTTPS ? 'https' : 'http';
  const username = (may.TenDangNhap || 'admin').trim();
  const password = may.MatKhau != null ? String(may.MatKhau) : '';
  const url = `${scheme}://${host}:${port}${path}`;
  const method = 'POST';
  const body = JSON.stringify(bodyObj || {});
  const baseOpts = { method, headers: { 'Content-Type': 'application/json' }, body };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 20000);
  try {
    let res = await fetch(url, Object.assign({}, baseOpts, { signal: ctrl.signal }));
    if (res.status === 401) {
      const wwwAuth = res.headers.get('www-authenticate') || '';
      let authHeader;
      if (/^digest/i.test(wwwAuth)) {
        authHeader = buildDigestAuth({
          username, password, method, uri: path, wwwAuth,
          nc: '00000001', cnonce: crypto.randomBytes(8).toString('hex')
        });
      } else {
        authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
      }
      res = await fetch(url, Object.assign({}, baseOpts, {
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: authHeader }
      }));
    }
    const text = await res.text();
    if (res.status === 401) {
      throw new Error(`Sai tài khoản hoặc mật khẩu máy chấm công (${host}). Kiểm tra lại mục Tài khoản/Mật khẩu của máy.`);
    }
    if (!res.ok) {
      throw new Error(`Máy trả về lỗi HTTP ${res.status}${text ? ' — ' + text.slice(0, 300) : ''}`);
    }
    try { return JSON.parse(text); }
    catch (e) { throw new Error('Máy trả về dữ liệu không phải JSON (có thể sai cổng hoặc không phải dòng máy hỗ trợ ISAPI).'); }
  } catch (e) {
    if (e && e.name === 'AbortError') {
      throw new Error(`Hết thời gian chờ khi kết nối máy chấm công ${host}:${port}. Kiểm tra: máy đã BẬT, đúng IP/cổng (Hikvision thường là 80), và MÁY CHỦ cùng mạng LAN với máy chấm công.`);
    }
    if (e && (e.code === 'ECONNREFUSED' || /ECONNREFUSED/.test(e.message))) {
      throw new Error(`Máy chấm công ${host}:${port} từ chối kết nối. Sai cổng, hoặc máy chưa bật dịch vụ ISAPI/HTTP.`);
    }
    if (e && (e.code === 'EHOSTUNREACH' || e.code === 'ENOTFOUND' || /getaddrinfo|EHOSTUNREACH|ENETUNREACH/.test(e.message))) {
      throw new Error(`Không tìm thấy máy chấm công ${host}. Kiểm tra IP và mạng LAN.`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Hikvision doi thoi gian dang ISO co mui gio, vd 2026-07-25T00:00:00+07:00
function toIsoLocal(d, endOfDay) {
  const p = (n) => String(n).padStart(2, '0');
  const dd = new Date(d);
  if (endOfDay) dd.setHours(23, 59, 59, 0); else dd.setHours(0, 0, 0, 0);
  const off = -dd.getTimezoneOffset();          // phut, VN = +420
  const dau = off >= 0 ? '+' : '-';
  const oh = p(Math.floor(Math.abs(off) / 60)), om = p(Math.abs(off) % 60);
  return `${dd.getFullYear()}-${p(dd.getMonth() + 1)}-${p(dd.getDate())}T${p(dd.getHours())}:${p(dd.getMinutes())}:${p(dd.getSeconds())}${dau}${oh}:${om}`;
}

/**
 * Lay lich su cham cong. Tra ve mang { deviceId, when, name } — dung chung dinh dang voi nhanh ZKTeco.
 * Co PHAN TRANG: ISAPI tra toi da ~30-100 ban ghi/lan, phai lap den khi het.
 */
async function layLichSuChamCong(may, { tuNgay, denNgay } = {}) {
  const start = tuNgay ? new Date(tuNgay) : new Date(Date.now() - 30 * 24 * 3600 * 1000);   // mac dinh 30 ngay gan nhat
  const end = denNgay ? new Date(denNgay) : new Date();
  const searchID = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const MAX_PAGE = 500;                 // chan vong lap vo han (500 x 100 = 50.000 ban ghi)
  const PAGE_SIZE = 100;
  const out = [];
  let pos = 0;

  for (let page = 0; page < MAX_PAGE; page++) {
    const body = {
      AcsEventCond: {
        searchID,
        searchResultPosition: pos,
        maxResults: PAGE_SIZE,
        major: 5,            // 5 = su kien kiem soat ra vao
        minor: 0,            // 0 = tat ca loai (van tay / the / khuon mat...)
        startTime: toIsoLocal(start, false),
        endTime: toIsoLocal(end, true)
      }
    };
    const json = await isapiRequest(may, '/ISAPI/AccessControl/AcsEvent?format=json', body);
    const ev = json && json.AcsEvent ? json.AcsEvent : {};
    const list = Array.isArray(ev.InfoList) ? ev.InfoList : [];
    for (const it of list) {
      const deviceId = String(it.employeeNoString != null ? it.employeeNoString : (it.employeeNo != null ? it.employeeNo : '')).trim();
      // v5.60.1 SỬA LỆCH GIỜ: máy trả '2026-07-23T08:40:09+07:00'. Nếu đưa qua new Date() rồi để
      // driver mssql ghi xuống DB thì bị đổi sang UTC -> 01:40 (lệch 7 tiếng, tính công sai).
      // => GIỮ NGUYÊN đồng hồ máy dưới dạng chuỗi 'YYYY-MM-DD HH:mm:ss' (whenStr) để ghi thẳng vào DB,
      //    KHÔNG phụ thuộc múi giờ của máy chủ. `when` chỉ dùng để lọc theo khoảng ngày.
      const raw = it.time ? String(it.time) : '';
      const m = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
      const whenStr = m ? `${m[1]} ${m[2]}` : null;
      const when = whenStr ? new Date(whenStr.replace(' ', 'T')) : null;   // đọc như giờ địa phương
      if (!deviceId || !whenStr || !when || isNaN(when.getTime())) continue;   // bỏ sự kiện không gắn nhân viên (vd mở cửa bằng nút)
      out.push({ deviceId, when, whenStr, name: it.name || '' });
    }
    const daLay = Number(ev.numOfMatches) || list.length;
    pos += daLay;
    const trangThai = String(ev.responseStatusStrg || '').toUpperCase();
    if (trangThai !== 'MORE' || daLay === 0) break;   // OK / NO MATCH / het du lieu
  }
  return out;
}

/** Danh sach nhan vien dang co tren may — dung cho nut "Tải NV từ máy". */
async function layDanhSachNhanVien(may) {
  const searchID = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const PAGE_SIZE = 100;
  const MAX_PAGE = 200;
  const out = [];
  let pos = 0;
  for (let page = 0; page < MAX_PAGE; page++) {
    const body = { UserInfoSearchCond: { searchID, searchResultPosition: pos, maxResults: PAGE_SIZE } };
    const json = await isapiRequest(may, '/ISAPI/AccessControl/UserInfo/Search?format=json', body);
    const s = json && json.UserInfoSearch ? json.UserInfoSearch : {};
    const list = Array.isArray(s.UserInfo) ? s.UserInfo : [];
    for (const u of list) {
      const ma = String(u.employeeNo != null ? u.employeeNo : '').trim();
      if (!ma) continue;
      out.push({ maChamCong: ma, tenTrenMay: u.name || '' });
    }
    const daLay = Number(s.numOfMatches) || list.length;
    pos += daLay;
    const trangThai = String(s.responseStatusStrg || '').toUpperCase();
    if (trangThai !== 'MORE' || daLay === 0) break;
  }
  return out;
}

/** Kiem tra ket noi nhanh (nut "Kiểm tra kết nối") — goi 1 trang nho nhat. */
async function kiemTraKetNoi(may) {
  const body = { UserInfoSearchCond: { searchID: '1', searchResultPosition: 0, maxResults: 1 } };
  const json = await isapiRequest(may, '/ISAPI/AccessControl/UserInfo/Search?format=json', body, 10000);
  const s = (json && json.UserInfoSearch) || {};
  return { tongNhanVienTrenMay: Number(s.totalMatches) || 0 };
}

module.exports = { layLichSuChamCong, layDanhSachNhanVien, kiemTraKetNoi, isapiRequest };
