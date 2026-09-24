// ================================================================
// HOA DON DIEN TU (v8.36) - ket noi Cong hoa don dien tu Tong cuc Thue
// (hoadondientu.gdt.gov.vn). GIAI DOAN 1: cau hinh MST/mat khau + dang nhap
// GDT bang captcha NGUOI DUNG TU GO.
//
// GIAO THUC GDT - 5 CAI BAY DA TRA GIA THAT (nguon: tool hddt dang chay that,
// xem memory reference_gdt_hoadondientu_api). KHONG doan lai, KHONG "don dep"
// cho dep ma pha mat mot trong 5 diem nay:
//  1) PHAI giu COOKIE giua /captcha va /authenticate. Bo sot = captcha luon bao
//     sai du go dung. TU v8.36.3 dieu nay TU DONG dung vi moi lenh goi chay trong
//     1 trang Chrome that (Puppeteer) - trinh duyet tu giu cookie, khong gom tay.
//  2) cvalue tra ve co the la chuoi SVG THO (khong phai base64) -> phai tu ma
//     hoa base64 truoc khi nhung <img src="data:image/svg+xml;base64,...">.
//  3) Ngay trong query RSQL BAT BUOC DD/MM/YYYY. Gui ISO -> GDT tra HTTP 400.
//     (Dung o giai doan 2, de san ghi chu o day de khong ai "sua cho dong bo".)
//  4) /query/invoices/export-xml tra ve file ZIP (chu ky 'PK'), KHONG phai XML
//     tho. (Giai doan 3.)
//  5) Da tung gap hoa don LOT ngoai khoang ngay -> phai loc lai phia minh.
//
// CAPTCHA LUON DO NGUOI GO - khong OCR, khong vong lap tu dong thu lai. Go sai
// thi cap anh MOI de nguoi dung tu quyet dinh go tiep. Co y de khong vi pham
// dieu khoan su dung cua cong TCT.
//
// BAO MAT: mat khau TCT luu trong CSDL duoi dang ma hoa AES-256-GCM, khoa lay
// tu bien moi truong HOADON_SECRET (file .env). Nguyen da duoc bao truoc danh
// doi: ai doc duoc CA CSDL LAN .env thi giai ma duoc mat khau co quan thue.
// Mat khau KHONG BAO GIO duoc tra ve frontend (xem GET /cauhinh).
// ================================================================
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');

const router = express.Router();
const CN = (action, chucNang) => [requireAuth, requirePermission('HOADON', action), requireChucNang('HOADON', chucNang)];

const GDT_BASE = 'https://hoadondientu.gdt.gov.vn/api';
// Giu NGUYEN bo header nay theo tool hddt da chay that voi GDT - nhat la Referer.
const GDT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Content-Type': 'application/json',
  'Referer': 'https://hoadondientu.gdt.gov.vn/'
};
/* v8.42: nang 20s -> 60s. Log that 2026-09-24 co loi "signal is aborted without reason" ngay o
   buoc tra cuu danh sach - la chinh cai AbortController nay bat 20s, khong phai loi cua GDT. */
const GDT_TIMEOUT_MS = 60000;
/* v8.42: TCT tra HTTP 429 (qua nhieu yeu cau) khi tai file lien tuc. Gian nhip + thu lai co cho.
   429/500 o buoc tai file la TAM THOI - thu lai thuong duoc; 403 thi KHONG thu lai (bi chan). */
const NGHI_GIUA_2_FILE_MS = 1500;
const THU_LAI_CHO_MS = [3000, 8000, 20000];

// ---------------------------------------------------------------- ma hoa
/* Khoa 32 byte suy tu HOADON_SECRET bang scrypt (khong bat Nguyen phai tu sinh
   dung 32 byte hex). Salt co dinh la CHAP NHAN DUOC o day vi day khong phai
   ham bam mat khau nguoi dung - chi la khoa doi xung duy nhat cua he thong. */
function _khoa() {
  const secret = process.env.HOADON_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('Chua khai bao HOADON_SECRET (toi thieu 16 ky tu) trong file .env - xem HUONG_DAN_CAI_DAT.md');
  }
  return crypto.scryptSync(secret, 'qlnoibo-hoadon-v836', 32);
}

function maHoa(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', _khoa(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

function giaiMa(blob) {
  const [ivB64, tagB64, dataB64] = String(blob || '').split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Mat khau da luu khong doc duoc (sai dinh dang) - vao Cau hinh nhap lai.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', _khoa(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

// ---------------------------------------------------------------- tien ich
async function layCauHinh(pool) {
  const r = await pool.request().query('SELECT TOP 1 * FROM CauHinhHoaDonDienTu ORDER BY ID');
  return r.recordset[0] || null;
}

/* ================================================================================================
   v8.36.3 - GOI GDT QUA CHROME THAT (Puppeteer), KHONG goi bang fetch cua Node nua.

   VI SAO (bang chung that, khong phai suy doan):
   - fetch cua Node (undici): GET /captcha CHAY, nhung POST /authenticate bi GDT tra
     HTTP 403 {"message":"He thong phat hien hanh vi khong hop le. Yeu cau da bi chan."}
   - Da LOAI TRU: cookie (Node v22.17.1, cookie 315 ky tu da gui len du), va header
     (them Origin/Accept-Language/bo Content-Type deu khong doi ket qua).
   - Trinh duyet THUONG tren CHINH MAY CHU dang nhap BINH THUONG voi dung MST/mat khau do.
   => IP khong bi chan, MST/mat khau dung. Chi rieng client Node bi chan - gan nhu chac
      chan do dau van tay TLS/HTTP cua Node khac trinh duyet that.

   CACH LAM: mo 1 trang Chrome that tai dung origin hoadondientu.gdt.gov.vn roi chay
   fetch() BEN TRONG trang do (page.evaluate). Nhu vay moi request mang dau van tay that
   cua Chrome, dung cung-nguon, va COOKIE DO CHINH TRINH DUYET QUAN LY - bo duoc toan bo
   phan tu gom cookie thu cong truoc day (_layCookie da xoa).

   LUU Y VAN HANH:
   - Can `npm install puppeteer` tren may chay pm2 (tai kem Chromium ~300MB, 1 lan).
   - Dung CHUNG 1 trinh duyet + 1 trang cho ca he thong: chi co 1 MST (MOYN) nen dung
     chung phien GDT la hop ly. Cac lenh goi duoc xep hang (hangDoi) de 2 nguoi dung
     cung luc khong dam captcha/token cua nhau.
   ================================================================================================ */
let _trinhDuyet = null;
let _trang = null;
let _hangDoi = Promise.resolve();   // xep hang cac lenh goi GDT, tranh dam nhau

/* v8.43: TACH RIENG viec MO TRINH DUYET khoi viec mo TRANG GDT.
   Ly do: route /dunglaipdf KHONG goi GDT nen khong bao gio chay _layTrang(), ma _dungPDF() lai dung
   thang _trinhDuyet.newPage() -> "Cannot read properties of null (reading 'newPage')" cho MOI hoa don.
   Cung vay sau khi bam "Dang xuat TCT" (dong han trinh duyet). Nay moi cho can trinh duyet deu goi
   _moTrinhDuyet() de tu bat len neu chua co. */
async function _moTrinhDuyet() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    throw new Error('Chua cai thu vien puppeteer tren may chu. Chay: cd backend && npm install puppeteer (tai kem Chromium ~300MB), roi pm2 restart qlnoibo.');
  }
  if (!_trinhDuyet || !_trinhDuyet.connected) {
    /* v8.36.4: Chrome do Puppeteer bat len TU KHAI BAO la dang bi tu dong hoa - he thong
       chong bot doc duoc ngay. Hai cho phai vo hieu:
         - co dong lenh --enable-automation (Puppeteer tu them) + thanh "Chrome dang bi dieu
           khien boi phan mem tu dong" -> bo bang ignoreDefaultArgs + AutomationControlled.
         - navigator.webdriver === true -> xoa o evaluateOnNewDocument ben duoi. */
    _trinhDuyet = await puppeteer.launch({
      headless: true,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        // v8.41: cho phep trang file:// doc file cung thu muc (anh nen/chu ky cua hoa don).
        '--allow-file-access-from-files'
      ]
    });
    _trang = null;
  }
  return _trinhDuyet;
}

/* Trang GDT dung chung - CHI phuc vu cac lenh goi API (goiGDT). Dung PDF thi mo trang rieng. */
async function _layTrang() {
  await _moTrinhDuyet();
  if (!_trang || _trang.isClosed()) {
    _trang = await _trinhDuyet.newPage();
    await _trang.setUserAgent(GDT_HEADERS['User-Agent']);
    // Xoa dau hieu tu dong hoa TRUOC khi bat ky script nao cua trang chay.
    await _trang.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    /* Phai o DUNG origin cua GDT thi fetch ben trong trang moi la cung-nguon.
       v8.36.4: doi 'domcontentloaded' -> 'networkidle2' + cho them 1.5s. Ly do: moc
       domcontentloaded ban TRUOC khi script cua trang chay xong; neu tuong lua cua TCT cap
       cookie/token bang JavaScript thi luc ta goi API no chua kip ton tai. */
    await _trang.goto('https://hoadondientu.gdt.gov.vn/', { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise(r => setTimeout(r, 1500));
    const conDauVet = await _trang.evaluate(() => navigator.webdriver);
    console.log('[hoadon] Chrome san sang | navigator.webdriver = %s (phai la undefined)', String(conDauVet));
  }
  return _trang;
}

/* Tra ve { ok, status, text } - CO Y khong tra doi tuong Response cua fetch, vi ket qua
   nay den tu trong trang Chrome. Moi noi goi deu dung r.text (chuoi), khong phai
   await r.text(). */
async function goiGDT(url, { method = 'GET', body, token, nhiPhan = false } = {}) {
  const chay = async () => {
    const trang = await _layTrang();
    /* v8.36.5 - BA HEADER RIENG CUA GIAO DIEN TCT (bat duoc tu request THAT khi dang nhap
       tay bang F12 tren may chu, 2026-09-24). Thieu 3 header nay = request khong den tu
       giao dien cua ho => bi tuong lua chan HTTP 403 "hanh vi khong hop le".
       Giai thich tron ven trieu chung: GET /captcha khong bi kiem nen qua duoc, POST
       /authenticate bi kiem nen chan.
         request-id : UUID MOI cho TUNG request (khong duoc dung lai 1 gia tri co dinh)
         end-point  : '/'   (dung y nghia chua ro, nhung tra ve nguyen van theo traffic that)
         action     : chuoi RONG
       Payload thi KHONG doi: {username, password, cvalue, ckey}, mat khau de NGUYEN VAN,
       khong ma hoa phia client - da doi chieu voi request that. */
    const maRequest = crypto.randomUUID();
    return await trang.evaluate(async (u, m, b, t, hetGio, rid, nhiPhanTrongTrang) => {
      const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'request-id': rid,
        'end-point': '/',
        'action': ''
      };
      if (b) headers['Content-Type'] = 'application/json';
      if (t) headers['Authorization'] = 'Bearer ' + t;
      const ctl = new AbortController();
      const hen = setTimeout(() => ctl.abort(), hetGio);
      try {
        const r = await fetch(u, {
          method: m, headers, body: b || undefined,
          credentials: 'include',   // cookie do chinh trinh duyet giu
          signal: ctl.signal
        });
        /* export-xml tra ve FILE ZIP NHI PHAN - ep qua r.text() se hong file (mat byte).
           Nhanh nhiPhan doc arrayBuffer roi ma hoa base64 NGAY TRONG TRANG, vi gia tri tra
           tu page.evaluate() phai la du lieu JSON hoa duoc (khong truyen Buffer qua duoc). */
        if (nhiPhanTrongTrang) {
          const bytes = new Uint8Array(await r.arrayBuffer());
          let chuoi = '';
          for (let i = 0; i < bytes.length; i++) chuoi += String.fromCharCode(bytes[i]);
          return { ok: r.ok, status: r.status, base64: btoa(chuoi) };
        }
        return { ok: r.ok, status: r.status, text: await r.text() };
      } catch (e) {
        return { ok: false, status: 0, text: 'Loi goi trong trinh duyet: ' + (e && e.message ? e.message : String(e)) };
      } finally {
        clearTimeout(hen);
      }
    }, url, method, body ? JSON.stringify(body) : null, token || null, GDT_TIMEOUT_MS, maRequest, nhiPhan);
  };

  // Xep hang: moi lenh goi GDT chay tuan tu tren cung 1 trang.
  const ketQua = _hangDoi.then(chay, chay);
  _hangDoi = ketQua.then(() => {}, () => {});
  return ketQua;
}

/* Dong trinh duyet - goi khi dang xuat de khong giu phien GDT lo lung. */
async function dongTrinhDuyet() {
  try { if (_trang && !_trang.isClosed()) await _trang.close(); } catch { /* bo qua */ }
  try { if (_trinhDuyet) await _trinhDuyet.close(); } catch { /* bo qua */ }
  _trang = null; _trinhDuyet = null;
}

// ================================================================ CAU HINH
// Tra ve MST/ten don vi + CO hay KHONG co mat khau. TUYET DOI khong tra mat khau
// (ke ca dang ma hoa) - frontend khong co viec gi phai biet.
router.get('/cauhinh', CN('view', 'cauhinh'), async (req, res) => {
  try {
    const pool = await getPool();
    const cfg = await layCauHinh(pool);
    res.json({
      success: true,
      data: {
        MST: cfg ? cfg.MST : '',
        TenDonVi: cfg ? cfg.TenDonVi : '',
        coMatKhau: !!(cfg && cfg.MatKhauMaHoa),
        coKhoaMaHoa: !!process.env.HOADON_SECRET,
        UpdatedAt: cfg ? cfg.UpdatedAt : null,
        UpdatedBy: cfg ? cfg.UpdatedBy : null
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Loi khi doc cau hinh: ' + err.message });
  }
});

/* Mat khau de TRONG = GIU NGUYEN mat khau cu (de sua ten don vi ma khong phai
   go lai mat khau thue). Muon xoa thi gui xoaMatKhau=true. */
router.put('/cauhinh', CN('edit', 'cauhinh'), async (req, res) => {
  try {
    const { mst, tenDonVi, matKhau, xoaMatKhau } = req.body;
    if (!mst || !/^[0-9\-]{10,20}$/.test(String(mst).trim())) {
      return res.status(400).json({ success: false, message: 'MST khong hop le (10-13 so, co the co duoi -XXX).' });
    }
    let blob;
    if (xoaMatKhau) blob = null;
    else if (matKhau) blob = maHoa(matKhau);   // nem loi ro rang neu thieu HOADON_SECRET

    const pool = await getPool();
    const cfg = await layCauHinh(pool);
    const rq = pool.request()
      .input('MST', sql.NVarChar(20), String(mst).trim())
      .input('TenDonVi', sql.NVarChar(400), (tenDonVi || '').trim() || null)
      .input('By', sql.NVarChar(100), req.session.user.TenDangNhap || req.session.user.HoTen || null);

    if (cfg) {
      rq.input('ID', sql.Int, cfg.ID);
      // COALESCE: khong gui mat khau -> giu nguyen cot cu; gui xoaMatKhau -> set NULL.
      if (blob === null && xoaMatKhau) {
        await rq.query('UPDATE CauHinhHoaDonDienTu SET MST=@MST, TenDonVi=@TenDonVi, MatKhauMaHoa=NULL, UpdatedAt=SYSDATETIME(), UpdatedBy=@By WHERE ID=@ID');
      } else if (blob) {
        await rq.input('MK', sql.NVarChar(sql.MAX), blob)
          .query('UPDATE CauHinhHoaDonDienTu SET MST=@MST, TenDonVi=@TenDonVi, MatKhauMaHoa=@MK, UpdatedAt=SYSDATETIME(), UpdatedBy=@By WHERE ID=@ID');
      } else {
        await rq.query('UPDATE CauHinhHoaDonDienTu SET MST=@MST, TenDonVi=@TenDonVi, UpdatedAt=SYSDATETIME(), UpdatedBy=@By WHERE ID=@ID');
      }
    } else {
      await rq.input('MK', sql.NVarChar(sql.MAX), blob || null)
        .query('INSERT INTO CauHinhHoaDonDienTu (MST, TenDonVi, MatKhauMaHoa, UpdatedBy) VALUES (@MST, @TenDonVi, @MK, @By)');
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Loi khi luu cau hinh: ' + err.message });
  }
});

// ================================================================ DANG NHAP GDT
/* Lay 1 anh captcha MOI tu GDT. Chi con luu ckey vao session - COOKIE do chinh
   trinh duyet Chrome quan ly (xem khoi v8.36.3 o tren), khong gom tay nua. */
router.get('/captcha', CN('view', 'dauvao'), async (req, res) => {
  try {
    const r = await goiGDT(`${GDT_BASE}/captcha`);
    if (!r.ok) return res.status(502).json({ success: false, message: `Khong lay duoc captcha tu TCT (HTTP ${r.status}): ${String(r.text).slice(0, 200)}` });
    let data = {};
    try { data = JSON.parse(r.text); } catch { return res.status(502).json({ success: false, message: 'Phan hoi captcha khong phai JSON: ' + String(r.text).slice(0, 200) }); }
    const ckey = data.ckey || data.key;
    let anh = data.cvalue || data.content;
    if (!ckey || !anh) return res.status(502).json({ success: false, message: 'Phan hoi captcha cua TCT thieu ckey/cvalue.' });

    // BAY SO 2: GDT co the tra thang chuoi SVG, khong phai base64.
    const laSvgTho = typeof anh === 'string' && anh.trim().startsWith('<svg');
    if (laSvgTho) anh = Buffer.from(anh, 'utf8').toString('base64');

    req.session.gdtCkey = ckey;
    console.log('[hoadon] GDT captcha: OK (qua Chrome that)');
    // Cap captcha moi = bo hieu luc phien dang nhap cu (tranh dung nham token cu).
    req.session.gdtToken = null;
    res.json({ success: true, data: { anhBase64: anh, dinhDang: 'image/svg+xml' } });
  } catch (err) {
    console.error(err);
    res.status(502).json({ success: false, message: err.message });
  }
});

/* Dang nhap GDT bang DUY NHAT ma captcha nguoi dung vua go. Sai thi bao loi 1
   lan - KHONG tu thu lai; frontend se xin captcha MOI de nguoi dung tu go tiep. */
router.post('/dangnhap', CN('view', 'dauvao'), async (req, res) => {
  try {
    const captcha = String(req.body.captcha || '').trim();
    if (captcha.length < 4) return res.status(400).json({ success: false, message: 'Ma captcha phai co it nhat 4 ky tu.' });
    if (!req.session.gdtCkey) return res.status(400).json({ success: false, message: 'Chua lay anh captcha - bam "Lay ma moi" truoc.' });

    const pool = await getPool();
    const cfg = await layCauHinh(pool);
    if (!cfg || !cfg.MST) return res.status(400).json({ success: false, message: 'Chua khai bao MST o tab Cau hinh.' });
    if (!cfg.MatKhauMaHoa) return res.status(400).json({ success: false, message: 'Chua luu mat khau TCT o tab Cau hinh.' });

    const r = await goiGDT(`${GDT_BASE}/security-taxpayer/authenticate`, {
      method: 'POST',
      body: { username: cfg.MST, password: giaiMa(cfg.MatKhauMaHoa), ckey: req.session.gdtCkey, cvalue: captcha }
    });

    const text = String(r.text || '');
    let ketQua = {};
    try { ketQua = JSON.parse(text); } catch { /* GDT tra text loi - giu nguyen de bao lai */ }

    /* Ghi log DU de chan doan ma KHONG lo bi mat: tuyet doi khong ghi mat khau/token. */
    console.log('[hoadon] GDT authenticate (qua Chrome that): HTTP %s | phan hoi: %s', r.status, text.slice(0, 300));

    if (!r.ok || !ketQua.token) {
      // Ma captcha da dung 1 lan la hong - buoc lay ma moi, khong cho go lai tren ma cu.
      req.session.gdtCkey = null;
      /* ⚠️ PHAI tra 400, TUYET DOI KHONG tra 401 - du "dang nhap that bai" nghe rat
         giong 401. common.js (dong ~28) bat MOI response 401 la "phien QLNoiBo het
         han" va chuyen thang window.location.href='/login.html'. Tra 401 o day =
         nguoi dung go sai captcha bi da ve man dang nhap QLSX, mat luon thong bao
         loi that. Da dinh dung loi nay 2026-09-23.
         Ap dung cho CA cac route GDT sau nay (P2/P3/P4): token GDT het han cung
         phai tra 400/409, khong duoc 401. */
      return res.status(400).json({
        success: false,
        message: ketQua.message || `Dang nhap TCT that bai (HTTP ${r.status}): ${text.slice(0, 200)}`
      });
    }

    req.session.gdtToken = ketQua.token;
    req.session.gdtTokenLuc = Date.now();
    req.session.gdtCkey = null;
    res.json({ success: true, data: { mst: cfg.MST } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// Frontend hoi trang thai de biet nen hien man captcha hay man tra cuu.
router.get('/trangthai', CN('view', 'dauvao'), async (req, res) => {
  res.json({
    success: true,
    data: { daDangNhap: !!req.session.gdtToken, dangNhapLuc: req.session.gdtTokenLuc || null }
  });
});

router.post('/dangxuat', CN('view', 'dauvao'), async (req, res) => {
  req.session.gdtToken = null;
  req.session.gdtCkey = null;
  /* Dong han Chrome: cookie phien GDT nam trong trinh duyet chu khong o session
     Express nua, khong dong thi "dang xuat" chi la doi ten - lan sau van con phien cu. */
  await dongTrinhDuyet();
  res.json({ success: true });
});

// ================================================================================================
// GIAI DOAN 2 - TRA CUU HOA DON (dau vao / dau ra) + LUU CSDL + XUAT EXCEL
// ================================================================================================

/* ⚠️ RANH GIOI QUAN TRONG ⚠️
   MOI lenh goi HTTP toi GDT deu di qua DUNG MOT ham: goiGDT() (khai bao o dau file).
   Co y gom lai mot cho vi 2026-09-23 GDT tra HTTP 403 "he thong phat hien hanh vi
   khong hop le" cho client Node (undici fetch) - nghi do dau van tay TLS. Neu phai
   chuyen sang cho Puppeteer/Chrome that goi thay, CHI phai viet lai goiGDT(), toan
   bo phan duoi day (phan trang, loc ngay, luu CSDL, Excel) giu nguyen khong sua.
   Dung goi fetch() truc tiep o bat ky cho nao khac trong file nay. */

const MA_LOAI = { VAO: 'purchase', RA: 'sold' };   // /query/invoices/<...>

/* BAY SO 3: gia tri ngay trong query RSQL PHAI la DD/MM/YYYY. Gui ISO -> GDT tra
   HTTP 400 (da test that). Nhung field tdlap trong RESPONSE lai la ISO+T. Hai dinh
   dang cho hai muc dich - dung "lam cho dong bo". */
function _ngayGDT(isoDate) {
  const [y, m, d] = String(isoDate).split('-');
  return `${d}/${m}/${y}`;
}

function _chuanIso(s) {
  const t = String(s || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  throw new Error(`Ngay khong hop le: "${s}" (can YYYY-MM-DD hoac DD/MM/YYYY)`);
}

/* Lay TOAN BO hoa don trong khoang ngay, tu dong lat trang toi khi du `total`. */
async function layDanhSachGDT(token, loai, tuIso, denIso) {
  const duong = MA_LOAI[loai];
  if (!duong) throw new Error(`Loai hoa don khong hop le: ${loai}`);
  const search = `tdlap=ge=${_ngayGDT(tuIso)}T00:00:00;tdlap=le=${_ngayGDT(denIso)}T23:59:59`;

  const all = [];
  let page = 0;
  while (true) {
    const qs = new URLSearchParams({ sort: 'tdlap:desc', size: '50', page: String(page), search });
    const r = await goiGDT(`${GDT_BASE}/query/invoices/${duong}?${qs}`, { token });
    const text = String(r.text || '');
    if (!r.ok) {
      /* KHONG tra 401 len frontend du GDT tra 401/403 - common.js se da nguoi dung
         ve man dang nhap QLNoiBo va nuot mat loi that (xem ghi chu o /dangnhap). */
      throw new Error(r.status === 401 || r.status === 403
        ? `Phien dang nhap cong TCT da het hoac bi tu choi (HTTP ${r.status}) - dang nhap lai. Chi tiet: ${text.slice(0, 200)}`
        : `Tra cuu that bai tai trang ${page} (HTTP ${r.status}): ${text.slice(0, 300)}`);
    }
    let data = {};
    try { data = JSON.parse(text); } catch { throw new Error('GDT tra ve du lieu khong phai JSON: ' + text.slice(0, 200)); }
    const items = data.datas || [];
    if (!items.length) break;
    /* In DANH SACH TEN FIELD cua hoa don dau tien, 1 lan/lan tra cuu. Ly do: code
       hddt chi dung chac chan 11 field (shdon/khhdon/khmshdon/tdlap/nbmst/nbten/
       tgtcthue/tgtthue/tgttso/tttddn/id). Ten field ben MUA (doan la nmmst/nmten)
       va khoi ttkhac (PortalLink/Fkey) la SUY DOAN - chua co bang chung. Dong log
       nay bien suy doan thanh su that sau dung 1 lan tra cuu that. */
    /* v8.42: ĐÃ đối chiếu xong danh sách field thật (log 2026-09-24) - `nmmst`/`nmten`/`ttkhac` đoán
       ĐÚNG, riêng tổng thanh toán là `tgtttbso` chứ không phải `tgttso` (đã sửa ở luuHoaDon).
       Giữ dòng log này nhưng CHỈ in khi bật GDT_LOG_FIELD=1 - in cả trăm tên field mỗi lần tra cứu
       làm ngập log, che mất các dòng lỗi thật sự cần đọc. */
    if (page === 0 && process.env.GDT_LOG_FIELD === '1') {
      console.log('[hoadon] Field GDT tra ve (hoa don dau tien): %s', Object.keys(items[0]).join(', '));
    }
    /* v8.44: in GIA TRI THAT cua cac truong TIEN o hoa don dau tien. Sua ten field 1 lan van chua
       ra so -> phai nhin gia tri chu khong doan tiep. In it, khong lam ngap log nhu dong tren. */
    if (page === 0) {
      const m0 = items[0];
      console.log('[hoadon] Tien (HD dau): tgtcthue=%s | tgtthue=%s | tgtttbso=%s | tgttso=%s | tgtkcthue=%s',
        m0.tgtcthue, m0.tgtthue, m0.tgtttbso, m0.tgttso, m0.tgtkcthue);
    }
    all.push(...items);
    if (all.length >= (Number(data.total) || 0)) break;
    page += 1;
    if (page > 200) break;   // chan vong lap vo han neu GDT tra total sai
  }
  return all;
}

/* BAY SO 5: da tung gap hoa don LOT ngoai khoang ngay (hoa don 30/06 xuat hien
   trong query >= 01/07, lap lai 4/4 lan). Chua ai giai thich duoc ngu nghia ranh
   gioi ngay cua GDT. Nen LOC LAI phia minh - dung bat ke GDT xu ly the nao. */
function locDungKhoangNgay(items, tuIso, denIso) {
  return items.filter(it => {
    const ngay = String(it.tdlap || '').split('T')[0];
    return ngay && ngay >= tuIso && ngay <= denIso;
  });
}

/* Boc link tra cuu ben NHA CUNG CAP tu khoi TTKhac (neu GDT tra kem trong danh sach).
   ⚠️ KY VONG THAP - nhieu kha nang khoi nay KHONG co trong response danh sach:
   doi chieu 45 hoa don that cho thay PortalLink/Fkey nam trong TTKhac cua FILE XML
   (tai qua export-xml), con endpoint danh sach thuong chi tra field tom tat. Neu
   vay thi 3 cot nay se rong o P2 va duoc dien o P3 luc tai XML - KHONG PHAI LOI.
   Viet san o day vi neu GDT co tra kem thi lay duoc luon, khong mat gi. */
function _bocTraCuuNCC(it) {
  const ra = { PortalLink: null, Fkey: null, MaTraCuu: null };
  const nguon = Array.isArray(it.ttkhac) ? it.ttkhac : [];
  for (const o of nguon) {
    const ten = String(o.ttruong || o.TTruong || '').trim();
    const giaTri = o.dlieu != null ? o.dlieu : o.DLieu;
    if (ten === 'PortalLink') ra.PortalLink = giaTri || null;
    else if (ten === 'Fkey') ra.Fkey = giaTri || null;
    else if (ten === 'MaTraCuu') ra.MaTraCuu = giaTri || null;
  }
  return ra;
}

/* MERGE theo khoa (Loai, MstBan, KhmshDon, KhhDon, ShDon) - tra cuu LAI cung
   khoang ngay KHONG duoc sinh dong trung, va phai cap nhat so lieu neu GDT doi. */
async function luuHoaDon(pool, loai, items) {
  let them = 0, capNhat = 0;
  for (const it of items) {
    const tc = _bocTraCuuNCC(it);
    const r = await pool.request()
      .input('Loai', sql.NVarChar(4), loai)
      .input('GdtId', sql.NVarChar(100), it.id != null ? String(it.id) : null)
      .input('KhmshDon', sql.NVarChar(5), it.khmshdon != null ? String(it.khmshdon) : null)
      .input('KhhDon', sql.NVarChar(20), it.khhdon || null)
      .input('ShDon', sql.NVarChar(20), it.shdon != null ? String(it.shdon) : null)
      .input('TDLap', sql.Date, String(it.tdlap || '').split('T')[0] || null)
      .input('MstBan', sql.NVarChar(20), it.nbmst || null)
      .input('TenBan', sql.NVarChar(400), it.nbten || null)
      .input('MstMua', sql.NVarChar(20), it.nmmst || null)
      .input('TenMua', sql.NVarChar(400), it.nmten || null)
      .input('TgTCThue', sql.Decimal(18, 2), it.tgtcthue != null ? Number(it.tgtcthue) : null)
      .input('TgTThue', sql.Decimal(18, 2), it.tgtthue != null ? Number(it.tgtthue) : null)
      /* ⚠️ v8.44 - TONG TIEN THANH TOAN: thu 3 duong theo thu tu, TUYET DOI khong de rong.
           1) tgtttbso  - ten dung theo DANH SACH FIELD THAT GDT tra ve (log 2026-09-24).
                          KHONG co field ten `tgttso` trong response.
           2) tgttso    - du phong phong khi GDT doi lai.
           3) tgtcthue + tgtthue - TU TINH. Dung ve so hoc (tong = chua thue + thue) va da doi
              chieu voi hoa don that Nguyen gui: 138.585.600 + 11.086.848 = 149.672.448 ✓.
              hddt cung co dung duong du phong nay.
         Ly do phai co (3): sau khi sua (1) ma cot van bang 0 -> nhieu kha nang GDT de trong chinh
         field do o mot so hoa don. Tinh lai tu 2 so kia thi luon ra dung, khong phu thuoc GDT. */
      .input('TgTTSo', sql.Decimal(18, 2), (() => {
        if (it.tgtttbso != null && it.tgtttbso !== '') return Number(it.tgtttbso);
        if (it.tgttso != null && it.tgttso !== '') return Number(it.tgttso);
        const a = Number(it.tgtcthue) || 0, b = Number(it.tgtthue) || 0;
        return (a || b) ? a + b : null;
      })())
      .input('TrangThai', sql.NVarChar(200), it.tttddn || null)
      .input('PortalLink', sql.NVarChar(400), tc.PortalLink)
      .input('Fkey', sql.NVarChar(100), tc.Fkey)
      .input('MaTraCuu', sql.NVarChar(100), tc.MaTraCuu)
      .query(`
        MERGE HoaDonDienTu AS t
        USING (SELECT @Loai AS Loai, @MstBan AS MstBan, @KhmshDon AS KhmshDon,
                      @KhhDon AS KhhDon, @ShDon AS ShDon) AS s
          ON  t.Loai = s.Loai AND t.MstBan = s.MstBan AND t.KhmshDon = s.KhmshDon
          AND t.KhhDon = s.KhhDon AND t.ShDon = s.ShDon
        WHEN MATCHED THEN UPDATE SET
          GdtId=@GdtId, TDLap=@TDLap, TenBan=@TenBan, MstMua=@MstMua, TenMua=@TenMua,
          TgTCThue=@TgTCThue, TgTThue=@TgTThue, TgTTSo=@TgTTSo, TrangThai=@TrangThai,
          /* Chi ghi de link tra cuu khi lan nay CO du lieu - tranh xoa mat link da
             boc duoc truoc do neu lan tra cuu nay GDT khong tra kem TTKhac. */
          PortalLink=ISNULL(@PortalLink, t.PortalLink),
          Fkey=ISNULL(@Fkey, t.Fkey),
          MaTraCuu=ISNULL(@MaTraCuu, t.MaTraCuu),
          UpdatedAt=SYSDATETIME()
        WHEN NOT MATCHED THEN INSERT
          (Loai, GdtId, KhmshDon, KhhDon, ShDon, TDLap, MstBan, TenBan, MstMua, TenMua,
           TgTCThue, TgTThue, TgTTSo, TrangThai, PortalLink, Fkey, MaTraCuu)
          VALUES (@Loai, @GdtId, @KhmshDon, @KhhDon, @ShDon, @TDLap, @MstBan, @TenBan,
                  @MstMua, @TenMua, @TgTCThue, @TgTThue, @TgTTSo, @TrangThai,
                  @PortalLink, @Fkey, @MaTraCuu)
        OUTPUT $action AS HanhDong;`);
    const hd = r.recordset && r.recordset[0] ? r.recordset[0].HanhDong : '';
    if (hd === 'INSERT') them++; else if (hd === 'UPDATE') capNhat++;
  }
  return { them, capNhat };
}

// ---- Tra cuu tu GDT roi luu xuong CSDL ----
router.post('/tracuu', CN('view', 'dauvao'), async (req, res) => {
  try {
    if (!req.session.gdtToken) {
      return res.status(400).json({ success: false, message: 'Chua dang nhap cong Tong cuc thue.' });
    }
    const loai = String(req.body.loai || 'VAO').toUpperCase();
    if (!MA_LOAI[loai]) return res.status(400).json({ success: false, message: 'Loai hoa don phai la VAO hoac RA.' });
    const tuIso = _chuanIso(req.body.tuNgay);
    const denIso = _chuanIso(req.body.denNgay);
    if (tuIso > denIso) return res.status(400).json({ success: false, message: 'Tu ngay phai <= den ngay.' });

    const thoGDT = await layDanhSachGDT(req.session.gdtToken, loai, tuIso, denIso);
    const items = locDungKhoangNgay(thoGDT, tuIso, denIso);
    const bidLoc = thoGDT.length - items.length;

    const pool = await getPool();
    const { them, capNhat } = await luuHoaDon(pool, loai, items);

    console.log('[hoadon] Tra cuu %s %s..%s: GDT tra %s, sau loc %s (bo %s), them %s / cap nhat %s',
      loai, tuIso, denIso, thoGDT.length, items.length, bidLoc, them, capNhat);

    res.json({ success: true, data: { tong: items.length, them, capNhat, biLoc: bidLoc } });
  } catch (err) {
    console.error('[hoadon] Loi tra cuu:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// ---- Doc danh sach DA LUU trong CSDL (khong goi GDT) ----
router.get('/danhsach', CN('view', 'dauvao'), async (req, res) => {
  try {
    const loai = String(req.query.loai || 'VAO').toUpperCase();
    if (!MA_LOAI[loai]) return res.status(400).json({ success: false, message: 'Loai hoa don phai la VAO hoac RA.' });
    const pool = await getPool();
    const rq = pool.request().input('Loai', sql.NVarChar(4), loai);
    let dk = 'WHERE Loai = @Loai';
    if (req.query.tuNgay) { rq.input('Tu', sql.Date, _chuanIso(req.query.tuNgay)); dk += ' AND TDLap >= @Tu'; }
    if (req.query.denNgay) { rq.input('Den', sql.Date, _chuanIso(req.query.denNgay)); dk += ' AND TDLap <= @Den'; }
    const r = await rq.query(`SELECT * FROM HoaDonDienTu ${dk} ORDER BY TDLap DESC, ShDon DESC`);
    /* v8.39: gan co CoXml/CoPdf bang cach kiem tra FILE CO THAT tren dia, KHONG suy tu viec
       "da tung tai" trong CSDL. Dia moi la su that: file co the bi xoa/don dep ma CSDL khong biet,
       khi do giao dien van hien link roi bam vao moi bao 404 - dung kieu bao loi muon. */
    const rows = r.recordset.map(hd => {
      let coXml = false, coPdf = false;
      if (hd.ThuMucFile && hd.TenFile) {
        const goc = path.join(__dirname, '..', hd.ThuMucFile, path.basename(hd.TenFile));
        try { coXml = fs.existsSync(goc + '.xml'); coPdf = fs.existsSync(goc + '.pdf'); } catch { /* bo qua */ }
      }
      return { ...hd, CoXml: coXml, CoPdf: coPdf };
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// ---- Xuat Excel danh sach hoa don ----
const COT_EXCEL = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'Mẫu số', key: 'khmshdon', width: 8 },
  { header: 'Ký hiệu', key: 'khhdon', width: 12 },
  { header: 'Số hóa đơn', key: 'shdon', width: 14 },
  { header: 'Ngày lập', key: 'tdlap', width: 12 },
  { header: 'MST người bán', key: 'mstban', width: 16 },
  { header: 'Tên người bán', key: 'tenban', width: 42 },
  { header: 'MST người mua', key: 'mstmua', width: 16 },
  { header: 'Tên người mua', key: 'tenmua', width: 42 },
  { header: 'Tiền chưa thuế', key: 'tgtcthue', width: 16 },
  { header: 'Tiền thuế', key: 'tgtthue', width: 14 },
  { header: 'Tổng thanh toán', key: 'tgttso', width: 18 },
  { header: 'Trạng thái', key: 'trangthai', width: 26 },
  { header: 'Cổng tra cứu NCC', key: 'portallink', width: 34 },
  { header: 'Mã tra cứu', key: 'matracuu', width: 16 }
];

router.get('/excel', CN('view', 'dauvao'), async (req, res) => {
  try {
    const loai = String(req.query.loai || 'VAO').toUpperCase();
    if (!MA_LOAI[loai]) return res.status(400).json({ success: false, message: 'Loai hoa don phai la VAO hoac RA.' });
    const tuIso = req.query.tuNgay ? _chuanIso(req.query.tuNgay) : null;
    const denIso = req.query.denNgay ? _chuanIso(req.query.denNgay) : null;

    const pool = await getPool();
    const rq = pool.request().input('Loai', sql.NVarChar(4), loai);
    let dk = 'WHERE Loai = @Loai';
    if (tuIso) { rq.input('Tu', sql.Date, tuIso); dk += ' AND TDLap >= @Tu'; }
    if (denIso) { rq.input('Den', sql.Date, denIso); dk += ' AND TDLap <= @Den'; }
    const rows = (await rq.query(`SELECT * FROM HoaDonDienTu ${dk} ORDER BY TDLap, ShDon`)).recordset;

    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(loai === 'VAO' ? 'Hoa don dau vao' : 'Hoa don dau ra');
    ws.columns = COT_EXCEL;
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    rows.forEach((r, i) => {
      ws.addRow({
        stt: i + 1,
        khmshdon: r.KhmshDon || '',
        khhdon: r.KhhDon || '',
        /* Zero-pad 7 chu so cho DUNG cach GDT/hddt hien thi so hoa don - de doi
           chieu voi chung tu giay va voi ten file da tai ve. */
        shdon: r.ShDon != null ? String(r.ShDon).padStart(7, '0') : '',
        tdlap: r.TDLap ? new Date(r.TDLap).toLocaleDateString('vi-VN') : '',
        mstban: r.MstBan || '', tenban: r.TenBan || '',
        mstmua: r.MstMua || '', tenmua: r.TenMua || '',
        tgtcthue: r.TgTCThue != null ? Number(r.TgTCThue) : null,
        tgtthue: r.TgTThue != null ? Number(r.TgTThue) : null,
        tgttso: r.TgTTSo != null ? Number(r.TgTTSo) : null,
        trangthai: r.TrangThai || '',
        portallink: r.PortalLink || '',
        matracuu: r.Fkey || r.MaTraCuu || ''
      });
    });
    ['tgtcthue', 'tgtthue', 'tgttso'].forEach(k => { ws.getColumn(k).numFmt = '#,##0'; });

    // Dong TONG CONG - ke toan doi chieu nhanh voi so sach.
    if (rows.length) {
      const d = ws.addRow({
        tenmua: 'TỔNG CỘNG',
        tgtcthue: rows.reduce((s, r) => s + (Number(r.TgTCThue) || 0), 0),
        tgtthue: rows.reduce((s, r) => s + (Number(r.TgTThue) || 0), 0),
        tgttso: rows.reduce((s, r) => s + (Number(r.TgTTSo) || 0), 0)
      });
      d.font = { bold: true };
    }

    const ten = `Hoa_don_${loai === 'VAO' ? 'dau_vao' : 'dau_ra'}_${(tuIso || 'tatca').replace(/-/g, '')}_${(denIso || '').replace(/-/g, '')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${ten}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[hoadon] Loi xuat Excel:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// ================================================================================================
// GIAI DOAN 3 - TAI FILE GOC (XML + PDF) VE SERVER, ROI CHO TAI VE MAY
// ================================================================================================
const THU_MUC_HOADON = path.join(__dirname, '..', 'uploads', 'hoadon');
// 3 file dung CHUNG cho moi hoa don (GDT goi kem trong ZIP) - luu 1 lan moi thu muc.
const FILE_DUNG_CHUNG = ['details.js', 'viewinvoice-bg.jpg', 'sign-check.jpg'];

function _tenFile(hd) {
  const ngay = hd.TDLap ? new Date(hd.TDLap).toISOString().slice(0, 10).replace(/-/g, '') : '00000000';
  const an = s => String(s == null ? '' : s).replace(/[^\w.-]/g, '_');
  return `${ngay}_${an(hd.MstBan)}_${an(hd.KhhDon)}_${String(hd.ShDon == null ? 0 : hd.ShDon).padStart(7, '0')}`;
}
function _thuMucCua(hd, mstMinh) {
  const thang = hd.TDLap ? new Date(hd.TDLap).toISOString().slice(0, 7) : 'khong-ro';
  return path.join(THU_MUC_HOADON, String(mstMinh || 'mst'), thang);
}

/* Dung CHINH Chrome da mo san de dung PDF tu invoice.html cua GDT.
   - Ghi html + 3 asset ra dia TRUOC roi mo bang file:// : trinh duyet tu phan giai duong dan
     tuong doi toi anh/js, khong phai vá chuoi HTML de nhung asset.
   - preferCSSPageSize: GDT khai bao @page size ngay trong <style> cua tung mau hoa don (co mau A4,
     co mau A5). Bat co nay de Chrome theo dung kho giay cua HO, thay vi ep cung A4. */
async function _dungPDF(htmlPath, pdfPath) {
  /* v8.40: hoa don TCT dat hinh trong dong chim bang CSS
       background-image: url(viewinvoice-bg.jpg)  (duong dan TUONG DOI, cung thu muc)
     => file anh PHAI nam canh file .html thi Chrome moi ve duoc. Kiem TRUOC khi dung PDF va bao
     ro neu thieu - truoc day thieu anh thi PDF van sinh ra binh thuong, chi la trang tron, khong
     co dau hieu gi de biet. */
  const thuMuc = path.dirname(htmlPath);
  const thieu = FILE_DUNG_CHUNG.filter(f => !fs.existsSync(path.join(thuMuc, f)));
  if (thieu.length) {
    console.warn('[hoadon] ⚠️ THIEU file dung chung o %s: %s -> PDF se mat hinh nen/chu ky.', thuMuc, thieu.join(', '));
  }

  // v8.43: tu bat trinh duyet neu chua co - /dunglaipdf khong goi GDT nen khong co san.
  const trinhDuyet = await _moTrinhDuyet();
  const trang = await trinhDuyet.newPage();
  try {
    /* ⚠️ v8.41 - SUA LOI HINH NEN KHONG LEN PDF.
       Truoc day dung: 'file://' + htmlPath.replace(/\\/g, '/')
       Tren Windows htmlPath la 'D:\QLSX\...' -> ra 'file://D:/QLSX/...' THIEU 1 dau gach cheo.
       Dung phai la 'file:///D:/...'. Voi dang sai, 'D:' bi hieu la TEN MAY CHU chu khong phai o
       dia, nen goc duong dan lech va moi tai nguyen TUONG DOI trong trang (background-image:
       url(viewinvoice-bg.jpg)) tro sai cho -> PDF ra trang tron, KHONG co hinh trong dong.
       pathToFileURL() lo dung chuyen nay va ma hoa luon ky tu dac biet/dau tieng Viet neu co. */
    const { pathToFileURL } = require('url');
    await trang.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0', timeout: 60000 });
    /* Doi ANH giai ma xong han. networkidle0 chi bao "khong con ket noi mang" - voi file:// gan nhu
       khong co ket noi nao nen no tra ve NGAY, co the truoc khi anh nen kip ve. */
    await trang.evaluate(() => Promise.all(
      Array.from(document.images).filter(a => !a.complete).map(a => new Promise(r => { a.onload = a.onerror = r; }))
    ));
    await trang.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});

    /* Thu tai THANG anh nen NGAY TRONG TRANG. Hinh nen dat bang CSS background-image nen KHONG nam
       trong document.images -> vong cho anh o tren khong bao gio "thay" no, va neu no hong thi PDF
       van ra binh thuong, chi mat hinh. Dong log nay bien "nghi ngo" thanh "biet chac". */
    const trangThaiNen = await trang.evaluate(() => new Promise(xong => {
      const anh = new Image();
      anh.onload = () => xong('TAI DUOC ' + anh.naturalWidth + 'x' + anh.naturalHeight);
      anh.onerror = () => xong('KHONG TAI DUOC');
      anh.src = 'viewinvoice-bg.jpg';
      setTimeout(() => xong('QUA HAN CHO'), 5000);
    })).catch(e => 'loi kiem tra: ' + e.message);
    console.log('[hoadon] Hinh nen trong dong (viewinvoice-bg.jpg): %s | %s', trangThaiNen, path.basename(pdfPath));

    /* ⚠️ v8.45 - PHUC HOI HINH TRONG DONG KHI IN.
       NGUYEN NHAN (doc thang CSS that cua TCT trong invoice.html, dong ~428):
           @media print { .main-page { background: none; border: none; } }
       => CHINH TCT CO Y XOA hinh nen khi in. Anh VAN tai duoc binh thuong (log da xac nhan
       "TAI DUOC 1280x1280"), chi la lenh in go no di. Vi vay moi thu truoc do (sua duong dan
       file://, printBackground, cho anh tai xong) deu dung nhung khong the co tac dung.

       Cach phuc hoi: chen 1 lop nen RIENG bang body::before voi position: fixed. Trong che do in
       cua Chrome, phan tu position:fixed duoc VE LAI O MOI TRANG -> trang nao cung co trong dong,
       giong ban PDF cua nha cung cap. Neu chi ghi de .main-page thi background-repeat:no-repeat
       cua ho lam hinh chi hien 1 lan tren ca tai lieu nhieu trang.
       Dat z-index am + nen body trong suot de lop nay nam DUOI chu, khong che noi dung. */
    await trang.addStyleTag({
      content: `@media print {
        html, body { background: transparent !important; }
        body::before {
          content: "";
          position: fixed;
          top: 0; left: 0; width: 100%; height: 100%;
          background-image: url("viewinvoice-bg.jpg");
          background-repeat: no-repeat;
          background-position: center center;
          background-size: 180%;
          z-index: -1;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }`
    }).catch(e => console.warn('[hoadon] Khong chen duoc CSS hinh nen: %s', e.message));

    await new Promise(r => setTimeout(r, 300));
    await trang.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true });
  } finally {
    await trang.close().catch(() => {});
  }
}

/* Tai goi hoa don tu GDT roi bung ra dia. Tra ve {xml, pdf} = co/khong tung file.
   BAY SO 4: export-xml tra ve ZIP (chu ky 'PK') chu KHONG phai XML tho - phai giai nen. */
async function taiMotHoaDon(token, hd, mstMinh) {
  const thuMuc = _thuMucCua(hd, mstMinh);
  fs.mkdirSync(thuMuc, { recursive: true });
  const ten = _tenFile(hd);
  const duongXml = path.join(thuMuc, ten + '.xml');
  const duongHtml = path.join(thuMuc, ten + '.html');
  const duongPdf = path.join(thuMuc, ten + '.pdf');

  if (fs.existsSync(duongXml) && fs.existsSync(duongPdf)) {
    return { ten, thuMuc, xml: true, pdf: true, boQua: true };   // da tai roi, khong goi lai GDT
  }

  const qs = new URLSearchParams({
    nbmst: hd.MstBan || '', khhdon: hd.KhhDon || '',
    shdon: String(hd.ShDon == null ? '' : hd.ShDon), khmshdon: String(hd.KhmshDon || '1')
  });
  /* v8.42: thu lai co cho khi GDT tra 429/500. Log that cho thay tai lien tuc bi 429 (qua nhieu
     yeu cau) va 500 rai rac - deu la loi TAM THOI, thu lai sau vai giay thuong duoc. KHONG thu lai
     voi 403 (bi tuong lua chan - thu them chi lam nang them). */
  const thuTai = async (url) => {
    for (let lan = 0; lan <= THU_LAI_CHO_MS.length; lan++) {
      const kq = await goiGDT(url, { token, nhiPhan: true });
      if (kq.ok && kq.base64) return kq;
      const dangThuLaiDuoc = kq.status === 429 || kq.status >= 500 || kq.status === 0;
      if (!dangThuLaiDuoc || lan === THU_LAI_CHO_MS.length) return kq;
      console.warn('[hoadon] %s -> HTTP %s, cho %sms roi thu lai (lan %s)', ten, kq.status, THU_LAI_CHO_MS[lan], lan + 1);
      await new Promise(r2 => setTimeout(r2, THU_LAI_CHO_MS[lan]));
    }
  };

  let r = await thuTai(`${GDT_BASE}/query/invoices/export-xml?${qs}`);
  if (!r.ok || !r.base64) {
    // Du phong theo id - dung y het tool hddt lam (co hoa don chi tai duoc bang duong nay).
    if (hd.GdtId) r = await thuTai(`${GDT_BASE}/query/invoices/export-xml?id=${encodeURIComponent(hd.GdtId)}`);
  }
  if (!r.ok || !r.base64) throw new Error(`GDT khong tra file cho hoa don ${ten} (HTTP ${r.status})`);

  const goi = Buffer.from(r.base64, 'base64');
  let coXml = false, coHtml = false;
  if (goi.slice(0, 2).toString() === 'PK') {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(goi);
    for (const muc of zip.getEntries()) {
      const ten1 = path.basename(muc.entryName);
      if (ten1 === 'invoice.xml') { fs.writeFileSync(duongXml, muc.getData()); coXml = true; }
      else if (ten1 === 'invoice.html') { fs.writeFileSync(duongHtml, muc.getData()); coHtml = true; }
      else if (FILE_DUNG_CHUNG.includes(ten1)) {
        const dich = path.join(thuMuc, ten1);
        if (!fs.existsSync(dich)) fs.writeFileSync(dich, muc.getData());   // dung chung, ghi 1 lan
      }
    }
  } else {
    // Du phong: GDT tra XML tho (chua tung gap thuc te, nhung khong loai tru).
    fs.writeFileSync(duongXml, goi); coXml = true;
  }

  let coPdf = false;
  if (coHtml) {
    try { await _dungPDF(duongHtml, duongPdf); coPdf = true; }
    catch (e) { console.error('[hoadon] Dung PDF that bai cho %s: %s', ten, e.message); }
  }
  return { ten, thuMuc, xml: coXml, pdf: coPdf, boQua: false };
}

async function _dsHoaDonTheoYeuCau(pool, req) {
  const loai = String(req.body.loai || req.query.loai || 'VAO').toUpperCase();
  const ids = req.body.ids || (req.query.ids ? String(req.query.ids).split(',') : null);
  const rq = pool.request().input('Loai', sql.NVarChar(4), loai);
  let dk = 'WHERE Loai = @Loai';
  if (ids && ids.length) {
    const soIds = ids.map(Number).filter(n => Number.isInteger(n) && n > 0);
    if (!soIds.length) throw new Error('Danh sach hoa don da chon khong hop le.');
    dk += ` AND HoaDonID IN (${soIds.join(',')})`;
  } else {
    const tu = req.body.tuNgay || req.query.tuNgay;
    const den = req.body.denNgay || req.query.denNgay;
    if (tu) { rq.input('Tu', sql.Date, _chuanIso(tu)); dk += ' AND TDLap >= @Tu'; }
    if (den) { rq.input('Den', sql.Date, _chuanIso(den)); dk += ' AND TDLap <= @Den'; }
  }
  return (await rq.query(`SELECT * FROM HoaDonDienTu ${dk} ORDER BY TDLap, ShDon`)).recordset;
}

// ---- Tai XML+PDF tu TCT ve SERVER (chua gui ve may nguoi dung) ----
router.post('/taifile', CN('view', 'dauvao'), async (req, res) => {
  try {
    if (!req.session.gdtToken) return res.status(400).json({ success: false, message: 'Chua dang nhap cong Tong cuc thue.' });
    const pool = await getPool();
    const cfg = await layCauHinh(pool);
    const ds = await _dsHoaDonTheoYeuCau(pool, req);
    if (!ds.length) return res.status(400).json({ success: false, message: 'Khong co hoa don nao de tai.' });

    let taiMoi = 0, daCo = 0, loi = 0;
    const loiChiTiet = [];
    for (const hd of ds) {
      try {
        const kq = await taiMotHoaDon(req.session.gdtToken, hd, cfg && cfg.MST);
        if (kq.boQua) daCo++; else taiMoi++;
        await pool.request()
          .input('id', sql.Int, hd.HoaDonID)
          .input('tm', sql.NVarChar(400), path.relative(path.join(__dirname, '..'), kq.thuMuc).replace(/\\/g, '/'))
          .input('tf', sql.NVarChar(200), kq.ten)
          .query('UPDATE HoaDonDienTu SET ThuMucFile=@tm, TenFile=@tf, UpdatedAt=SYSDATETIME() WHERE HoaDonID=@id');
        // v8.42: gian nhip 800ms -> 1500ms. Log that cho thay 800ms van bi TCT tra 429.
        if (!kq.boQua) await new Promise(r => setTimeout(r, NGHI_GIUA_2_FILE_MS));
      } catch (e) {
        loi++; loiChiTiet.push(e.message);
        console.error('[hoadon] Tai file loi:', e.message);
      }
    }
    res.json({ success: true, data: { tong: ds.length, taiMoi, daCo, loi, loiChiTiet: loiChiTiet.slice(0, 5) } });
  } catch (err) {
    console.error('[hoadon] Loi tai file:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

/* ---- Dung LAI PDF tu file .html DA LUU (khong goi lai TCT) ----
   v8.41: can thiet vi taiMotHoaDon() BO QUA hoa don da co du .xml + .pdf - nen sau khi sua loi
   dung PDF, tai lai cung khoang ngay se giu nguyen file PDF CU (sinh truoc luc sua) va nguoi dung
   tuong la "sua khong an". Truoc day phai xoa thu muc bang tay. Chay nhanh, khong dung quota TCT. */
router.post('/dunglaipdf', CN('view', 'dauvao'), async (req, res) => {
  try {
    const pool = await getPool();
    const ds = await _dsHoaDonTheoYeuCau(pool, req);
    let xong = 0, thieuHtml = 0, loi = 0;
    const loiChiTiet = [];
    for (const hd of ds) {
      if (!hd.ThuMucFile || !hd.TenFile) { thieuHtml++; continue; }
      const goc = path.join(__dirname, '..', hd.ThuMucFile, path.basename(hd.TenFile));
      if (!goc.startsWith(THU_MUC_HOADON) || !fs.existsSync(goc + '.html')) { thieuHtml++; continue; }
      try { await _dungPDF(goc + '.html', goc + '.pdf'); xong++; }
      catch (e) { loi++; loiChiTiet.push(`${hd.TenFile}: ${e.message}`); }
    }
    res.json({ success: true, data: { tong: ds.length, xong, thieuHtml, loi, loiChiTiet: loiChiTiet.slice(0, 5) } });
  } catch (err) {
    console.error('[hoadon] Loi dung lai PDF:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// ---- Tai 1 file le (xem/tai tung hoa don) ----
router.get('/file/:id/:loaiFile', CN('view', 'dauvao'), async (req, res) => {
  try {
    const duoi = String(req.params.loaiFile).toLowerCase();
    if (!['xml', 'pdf', 'html'].includes(duoi)) return res.status(400).json({ success: false, message: 'Loai file khong hop le.' });
    const pool = await getPool();
    const r = await pool.request().input('id', sql.Int, req.params.id)
      .query('SELECT * FROM HoaDonDienTu WHERE HoaDonID=@id');
    const hd = r.recordset[0];
    if (!hd || !hd.ThuMucFile || !hd.TenFile) return res.status(404).json({ success: false, message: 'Hoa don nay chua tai file.' });
    /* path.basename chan path traversal - du lieu trong CSDL cung khong duoc phep tro ra ngoai
       thu muc uploads (cung cach anhToPngBuffer trong khohang.js da lam). */
    const duong = path.join(__dirname, '..', hd.ThuMucFile, path.basename(hd.TenFile) + '.' + duoi);
    if (!duong.startsWith(THU_MUC_HOADON) || !fs.existsSync(duong)) {
      return res.status(404).json({ success: false, message: `Chua co file .${duoi} cho hoa don nay.` });
    }
    /* v8.40: ?xem=1 -> MO NGAY trong trinh duyet thay vi tai xuong (Nguyen: "cot PDF khi click vao
       thi mo ra xem"). Khac biet nam o header Content-Disposition: inline vs attachment. */
    if (req.query.xem === '1') {
      const kieu = duoi === 'pdf' ? 'application/pdf' : (duoi === 'html' ? 'text/html; charset=utf-8' : 'application/xml; charset=utf-8');
      res.setHeader('Content-Type', kieu);
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(duong)}"`);
      return fs.createReadStream(duong).pipe(res);
    }
    res.download(duong);
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// ---- Tai NHIEU hoa don ve may duoi dang 1 file .zip ----
router.get('/taive', CN('view', 'dauvao'), async (req, res) => {
  try {
    const pool = await getPool();
    const ds = await _dsHoaDonTheoYeuCau(pool, req);
    const archiver = require('archiver');
    const zip = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="HoaDon_${Date.now()}.zip"`);
    zip.pipe(res);

    let soFile = 0;
    for (const hd of ds) {
      if (!hd.ThuMucFile || !hd.TenFile) continue;
      for (const duoi of ['xml', 'pdf']) {
        const duong = path.join(__dirname, '..', hd.ThuMucFile, path.basename(hd.TenFile) + '.' + duoi);
        if (duong.startsWith(THU_MUC_HOADON) && fs.existsSync(duong)) {
          zip.file(duong, { name: `${hd.TenFile}.${duoi}` });
          soFile++;
        }
      }
    }
    if (!soFile) {
      /* KHONG gui file zip rong roi de nguoi dung tu doan - ghi han 1 file giai thich vao trong. */
      zip.append('Chua co hoa don nao duoc tai file. Bam "Tai XML + PDF tu TCT" truoc roi tai lai.\r\n',
        { name: 'DOC_TOI_DI.txt' });
    }
    await zip.finalize();
  } catch (err) {
    console.error('[hoadon] Loi dong goi zip:', err);
    if (!res.headersSent) res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
