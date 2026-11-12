/* ================================================================================================
   zaloOaToken.js  —  v9.30 (Zalo OA) — KHO TOKEN

   🔴 ĐÂY LÀ CHỖ DỄ MẤT KẾT NỐI NHẤT CỦA CẢ DỰ ÁN. Đọc hết khối này trước khi sửa.

   Zalo OA cấp hai thứ:
     · access_token  — sống NGẮN (cỡ 1 giờ). Hết hạn ⇒ bot im lặng, không trả lời được.
     · refresh_token — sống dài (cỡ 3 tháng) NHƯNG **XOAY VÒNG**: mỗi lần dùng để làm mới, Zalo trả
       về refresh_token MỚI và cái cũ CHẾT NGAY.

   Hệ quả: chỉ cần MỘT lần ghi hụt refresh token mới (tiến trình chết giữa chừng, ghi file lỗi, hai
   tiến trình cùng refresh một lúc) là **mất kết nối vĩnh viễn** — phải vào developers.zalo.me cấp
   quyền lại bằng tay. Vì vậy file này:
     1. GHI XUỐNG ĐĨA TRƯỚC khi coi là thành công (ghi file tạm rồi đổi tên — không bao giờ để lại
        file nửa vời nếu máy tắt giữa chừng);
     2. KHÓA refresh: nhiều lời gọi cùng lúc chỉ sinh ĐÚNG MỘT lần gọi mạng, số còn lại chờ kết quả;
     3. GIỮ LẠI refresh token cũ trong file (`refreshTokenCu`) để còn biết đường lần mò khi sự cố;
     4. Làm mới SỚM 5 phút trước hạn, không đợi hết hạn mới chạy.

   🔴 KHÔNG để file token trong `backend/uploads/` — thư mục đó được phục vụ CÔNG KHAI ra internet
   (xem laDuongDanCong trong server.js). File nằm ở `backend/.zalo-oa.json`.
   🔴 Thêm `.zalo-oa.json` vào .gitignore — đừng commit token lên git.

   ⚠️ CHƯA ĐỐI CHIẾU ĐƯỢC TÀI LIỆU: trong phiên viết file này không tải được docs của Zalo (trang
   dựng bằng JS). Địa chỉ và tên tham số dưới đây theo hiểu biết chung về Zalo OA Open API v4 — ĐỀU
   ĐỂ ĐỔI ĐƯỢC BẰNG .env, và lần gọi thật đầu tiên phải xem log để xác nhận.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');

const FILE_TOKEN = path.join(__dirname, '..', '.zalo-oa.json');
const URL_TOKEN = process.env.ZALO_OA_TOKEN_URL || 'https://oauth.zaloapp.com/v4/oa/access_token';
const SOM_HON_MS = 5 * 60 * 1000;    // làm mới sớm 5 phút trước hạn

function appId() { return String(process.env.ZALO_OA_APP_ID || '').trim(); }
function appSecret() { return String(process.env.ZALO_OA_APP_SECRET || '').trim(); }
function daKhaiKhoa() { return !!(appId() && appSecret()); }

/* ---------------------------------------------------------------------------------------------- */
/* 🔴 BẢN TRONG BỘ NHỚ là nguồn sự thật khi ghi đĩa hỏng — xem luuTuPhanHoi(). */
let __nhoTrongRam = null;

function doc() {
  let tuFile = {};
  try { tuFile = JSON.parse(fs.readFileSync(FILE_TOKEN, 'utf8')) || {}; } catch (e) { tuFile = {}; }
  /* Ghi đĩa hỏng mà RAM đang giữ bản MỚI HƠN thì phải dùng bản RAM — nếu không, mỗi lần làm mới lại
     đọc nhầm refresh token CŨ (đã chết tại Zalo) và hỏng vĩnh viễn. */
  if (__nhoTrongRam && (!tuFile.capLuc || String(__nhoTrongRam.capLuc) > String(tuFile.capLuc)))
    return __nhoTrongRam;
  return tuFile;
}

/* Ghi ATOMIC + ÉP XUỐNG ĐĨA: file tạm → fsync → rename.
   🔴 fsync là bắt buộc, không phải cho đẹp: rename nguyên tử về METADATA, nhưng dữ liệu của file tạm
   có thể còn nằm trong bộ đệm của hệ điều hành — mất điện xong còn lại đúng tên thật mà ruột rỗng.
   Xưởng mất điện là chuyện thường. */
function ghi(obj) {
  const tam = FILE_TOKEN + '.tmp';
  const noiDung = JSON.stringify(obj, null, 2);
  const fd = fs.openSync(tam, 'w');
  try {
    fs.writeSync(fd, noiDung);
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  fs.renameSync(tam, FILE_TOKEN);   // Windows: MoveFileExW có REPLACE_EXISTING, đè được file cũ
}

function conHan(o) {
  return !!(o && o.accessToken && o.hetHanLuc && (Date.now() + SOM_HON_MS) < Number(o.hetHanLuc));
}

async function goiZalo(thamSo) {
  const res = await fetch(URL_TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      /* Zalo OA v4 nhận App Secret qua HEADER `secret_key`, không nằm trong body. */
      secret_key: appSecret()
    },
    body: new URLSearchParams(thamSo).toString(),
    signal: AbortSignal.timeout(15000)   // treo ở đây là kẹt luôn khóa __dangLamMoi
  });
  const chu = await res.text();
  let j = null;
  try { j = JSON.parse(chu); } catch (e) { /* Zalo trả không phải JSON = có chuyện */ }
  if (!j) throw new Error('Zalo trả về không phải JSON (HTTP ' + res.status + '): ' + chu.slice(0, 300));
  if (!j.access_token) {
    /* Zalo báo lỗi trong thân JSON chứ không bằng mã HTTP — phải tự bắt. */
    throw new Error('Zalo từ chối: ' + JSON.stringify(j).slice(0, 400));
  }
  return j;
}

function luuTuPhanHoi(j, cu) {
  const song = Number(j.expires_in || 3600);           // giây
  const moi = {
    accessToken: j.access_token,
    refreshToken: j.refresh_token || (cu && cu.refreshToken) || null,
    hetHanLuc: Date.now() + song * 1000,
    capLuc: new Date().toISOString(),
    /* Giữ lại cái cũ MỘT đời để còn lần mò khi sự cố — xem khối ghi chú đầu file. */
    refreshTokenCu: (cu && cu.refreshToken && j.refresh_token && cu.refreshToken !== j.refresh_token)
      ? cu.refreshToken : (cu && cu.refreshTokenCu) || null
  };
  /* 🔴 THỨ TỰ NÀY LÀ SỐNG CÒN. Zalo vừa trả refresh token MỚI ⇒ token CŨ đã chết tại Zalo rồi.
     Nếu ghi đĩa ném lỗi (đĩa đầy, Windows Defender/indexer đang giữ file, pm2 thứ hai đang đọc) mà
     ta để ngoại lệ bay lên thì bản MỚI mất sạch — không file, không RAM — và lần sau đọc lại token
     CŨ đã chết ⇒ mất kết nối VĨNH VIỄN, phải cấp quyền lại bằng tay.
     Nên: nhớ vào RAM TRƯỚC, ghi đĩa trong try/catch, hỏng thì GÀO LÊN trong log chứ không ném. */
  __nhoTrongRam = moi;
  try {
    ghi(moi);
  } catch (e) {
    console.error('[zalo] 🔴 KHÔNG GHI ĐƯỢC FILE TOKEN: ' + e.message
      + '\n[zalo] 🔴 Refresh token mới HIỆN CHỈ CÒN TRONG BỘ NHỚ. ĐỪNG restart pm2 trước khi sửa xong'
      + '\n[zalo]    chỗ ghi (' + FILE_TOKEN + '). Restart bây giờ = mất kết nối, phải cấp quyền lại tay.');
  }
  return moi;
}

/* ------------------------------------------------------------------------------------------------
   ĐỔI CODE (từ bước cấp quyền bằng tay) LẤY TOKEN LẦN ĐẦU.
   `code` sống rất ngắn (vài phút) — lấy xong phải chạy ngay.
   `codeVerifier`: Zalo OA v4 dùng PKCE; nếu trang cấp quyền của anh có sinh `code_challenge` thì
   truyền `code_verifier` tương ứng vào đây. Không có thì bỏ trống.
   ------------------------------------------------------------------------------------------------ */
async function doiCodeLayToken(code, codeVerifier) {
  if (!daKhaiKhoa()) throw new Error('Chưa khai ZALO_OA_APP_ID / ZALO_OA_APP_SECRET trong .env');
  if (!code) throw new Error('Thiếu code.');
  const thamSo = { app_id: appId(), grant_type: 'authorization_code', code: String(code).trim() };
  if (codeVerifier) thamSo.code_verifier = String(codeVerifier).trim();
  return luuTuPhanHoi(await goiZalo(thamSo), doc());
}

/* ------------------------------------------------------------------------------------------------
   NẠP THẲNG REFRESH TOKEN (đường ngắn, Nguyen 2026-11-06).

   Trang developers.zalo.me > Công cụ > "Lấy Access Token" tự chạy hộ cả vòng cấp quyền và đưa luôn
   access token + REFRESH TOKEN. Có refresh token rồi thì KHÔNG cần đi đường `--code` nữa (code chỉ
   sống vài phút, rất hay lỡ tay).

   🔴 KHÔNG ghi file trước rồi mới gọi mạng: nạp nhầm một chuỗi hỏng mà đã ghi đè file thì mất luôn
   kết nối đang chạy. Gọi Zalo TRƯỚC; Zalo nhận thì mới có phản hồi để luuTuPhanHoi() ghi xuống —
   hỏng thì file cũ còn nguyên.
   ⚠️ Zalo XOAY VÒNG refresh token: gọi hàm này một lần là chuỗi vừa dán **đã chết**, bản còn dùng
   được là bản trong .zalo-oa.json. Đừng chạy lại với đúng chuỗi cũ.
   ------------------------------------------------------------------------------------------------ */
async function napRefreshToken(rt) {
  if (!daKhaiKhoa()) throw new Error('Chưa khai ZALO_OA_APP_ID / ZALO_OA_APP_SECRET trong .env');
  const chuoi = String(rt || '').trim();
  if (!chuoi) throw new Error('Thiếu refresh token.');
  /* In ĐỘ DÀI (không in chuỗi) để đối chiếu với ô trên console Zalo — dán hụt vài ký tự đầu/cuối là
     Zalo trả đúng câu "Invalid refresh token" y hệt như token đã chết, không phân biệt được.
     Cũng cảnh báo nếu dính ký tự lạ: token Zalo chỉ gồm chữ, số, '-' và '_'. */
  const la = chuoi.replace(/[A-Za-z0-9_-]/g, '');
  console.log('[zalo] chuỗi nhận được: dài ' + chuoi.length
    + ' | đầu ' + chuoi.slice(0, 4) + ' | cuối ' + chuoi.slice(-4)
    + (la ? ' | ⚠️ CÓ ' + la.length + ' KÝ TỰ LẠ (dán hỏng): ' + JSON.stringify(la.slice(0, 20)) : ''));
  const j = await goiZalo({ app_id: appId(), grant_type: 'refresh_token', refresh_token: chuoi });
  return luuTuPhanHoi(j, doc());
}

/* Đọc refresh token từ FILE — tránh hẳn chuyện PowerShell nuốt/cắt ký tự khi dán chuỗi 500 ký tự.
   File chỉ chứa ĐÚNG chuỗi token, không nháy, không chú thích. Nạp xong NÊN XÓA file. */
async function napRefreshTuFile(duongDan) {
  if (!duongDan) throw new Error('Thiếu đường dẫn file.');
  let noiDung;
  try { noiDung = fs.readFileSync(duongDan, 'utf8'); }
  catch (e) { throw new Error('Không đọc được file ' + duongDan + ': ' + e.message); }
  /* Bỏ BOM của Notepad — ký tự vô hình này là thủ phạm kinh điển của "dán đúng mà vẫn sai". */
  return napRefreshToken(noiDung.replace(/^﻿/, '').trim());
}

/* ------------------------------------------------------------------------------------------------
   LÀM MỚI. Có KHÓA: nhiều request cùng lúc chỉ gọi mạng MỘT lần.
   Gọi song song hai lần là hai lần xoay refresh token — lần sau chắc chắn hỏng vì token đã chết.
   ------------------------------------------------------------------------------------------------ */
let __dangLamMoi = null;
async function lamMoiToken() {
  if (__dangLamMoi) return __dangLamMoi;
  __dangLamMoi = (async () => {
    if (!daKhaiKhoa()) throw new Error('Chưa khai ZALO_OA_APP_ID / ZALO_OA_APP_SECRET trong .env');
    const cu = doc();
    if (!cu.refreshToken)
      throw new Error('Chưa có refresh token — phải cấp quyền lại bằng tay (xem docs/HUONG_DAN_KET_NOI_ZALO_OA.md, bước A3).');
    const j = await goiZalo({ app_id: appId(), grant_type: 'refresh_token', refresh_token: cu.refreshToken });
    return luuTuPhanHoi(j, cu);
  })();
  try { return await __dangLamMoi; }
  finally { __dangLamMoi = null; }
}

/* Dùng ở mọi nơi cần gọi API Zalo. Tự làm mới khi sắp hết hạn. */
async function layAccessToken() {
  const o = doc();
  if (conHan(o)) return o.accessToken;
  const moi = await lamMoiToken();
  return moi.accessToken;
}

/* Xem trạng thái mà KHÔNG lộ token ra log/màn hình. */
function trangThai() {
  const o = doc();
  const conBaoLau = o.hetHanLuc ? Math.round((Number(o.hetHanLuc) - Date.now()) / 1000) : null;
  return {
    daKhaiKhoa: daKhaiKhoa(),
    coAccessToken: !!o.accessToken,
    coRefreshToken: !!o.refreshToken,
    capLuc: o.capLuc || null,
    conHanGiay: conBaoLau,
    conHan: conHan(o),
    fileToken: FILE_TOKEN
  };
}

module.exports = { layAccessToken, lamMoiToken, doiCodeLayToken, napRefreshToken, napRefreshTuFile, trangThai, daKhaiKhoa, FILE_TOKEN };

/* ---- CLI: node backend\utils\zaloOaToken.js
         [--trangthai | --naprefresh <refresh_token> | --code <code> [--verifier <v>] | --lammoi]
   Bước A3 có HAI đường:
     · NGẮN  — lấy refresh token ở developers.zalo.me > Công cụ > "Lấy Access Token", rồi --naprefresh
     · DÀI   — tự chạy vòng cấp quyền lấy `code`, rồi --code
   Về sau chỉ cần --trangthai để kiểm tra. */
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const ts = process.argv.slice(2);
  const lay = (ten) => { const i = ts.indexOf(ten); return i >= 0 ? ts[i + 1] : null; };
  (async () => {
    if (ts.indexOf('--napfile') !== -1 || ts.indexOf('--naprefresh') !== -1) {
      const o = ts.indexOf('--napfile') !== -1
        ? await napRefreshTuFile(lay('--napfile'))
        : await napRefreshToken(lay('--naprefresh'));
      console.log('✅ Zalo nhận refresh token. Access token hết hạn sau '
        + Math.round((o.hetHanLuc - Date.now()) / 1000) + 's.');
      console.log('   File: ' + FILE_TOKEN + '  (ĐỪNG commit lên git)');
      console.log('   ⚠️ Chuỗi vừa dán ĐÃ CHẾT (Zalo xoay vòng) — bản còn dùng được nằm trong file trên.');
    } else if (ts.indexOf('--code') !== -1) {
      const o = await doiCodeLayToken(lay('--code'), lay('--verifier'));
      console.log('✅ Đã lấy token. Hết hạn sau ' + Math.round((o.hetHanLuc - Date.now()) / 1000) + 's.');
      console.log('   File: ' + FILE_TOKEN + '  (ĐỪNG commit lên git)');
    } else if (ts.indexOf('--lammoi') !== -1) {
      const o = await lamMoiToken();
      console.log('✅ Đã làm mới. Hết hạn sau ' + Math.round((o.hetHanLuc - Date.now()) / 1000) + 's.');
    } else {
      console.log(JSON.stringify(trangThai(), null, 2));
    }
  })().catch(e => { console.error('❌ ' + e.message); process.exit(1); });
}
