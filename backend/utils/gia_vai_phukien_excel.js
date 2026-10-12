// v8.76 — CAP NHAT DON GIA VAI + PHU KIEN TU FILE EXCEL
//
// Chay TRONG thu muc backend:
//
//   node utils/gia_vai_phukien_excel.js "D:\bang gia vai.xlsx"
//        -> XEM TRUOC: doc file, do cot, dem se dien bao nhieu dong. KHONG ghi gi vao database.
//
//   node utils/gia_vai_phukien_excel.js "D:\bang gia vai.xlsx" --ncc-cho-phep "Nhap ton kho vai dau ky" --ghi
//        -> GHI THAT (co backup + transaction).
//
// Tuy chon:
//   --ghi                      ghi that (mac dinh chi xem truoc)
//   --sheet "Ten sheet"        chi doc 1 sheet (mac dinh: quet moi sheet)
//   --ncc-cho-phep "A;B"       CHO PHEP dien gia cho cay thuoc phieu nhap cua cac NCC nay
//   --moi-ncc                  dien cho MOI NCC (lam TANG cong no that — xem muc AN TOAN)
//   --theo-ma-loai             EP hieu cot ma la MA LOAI VAI (LoaiVai.MaLoai)
//   --theo-ma-vai              EP hieu cot ma la MA VAI       (DanhMucVai.MaVai)
//   --theo-ma-cay              EP hieu cot ma la MA CAY       (VaiCay.MaCay)
//   --cho-gia-thap             cho phep don gia duoi nguong (vai < 10.000 d/kg, phu kien < 100 d)
//   --chi-vai / --chi-phukien  gioi han pham vi
//   --xuat-mau "D:\mau.xlsx"   chi sinh FILE MAU (co san danh sach ma dang thieu gia) roi thoat
//
// ============================ NGUYEN TAC AN TOAN ============================
//
// 1) KHONG co --ghi  =>  TUYET DOI khong dong vao database.
//
// 2) KHONG BAO GIO ghi de. Dong nao da co gia (> 0) thi BO QUA. Khong co tuy chon ghi de —
//    muon sua gia da co thi vao man Nhap kho sua tay (co y lam kho, vi do la sua so lieu da chot).
//
// 3) 🔴 CONG NO NHA CUNG CAP
//    No NCC = SUM(KGNhap x DonGiaNhap) tren MOI cay thuoc PhieuNhapVai CO NCC_ID
//    (congno.js:951-954). No phat sinh luc NHAP — KHONG lien quan den viec cay da xuat hay chua.
//    Phu kien y het: SUM(SoLuong x DonGia) tren phieu LoaiPhieu = N'Nhap' co NCC_ID
//    (congno.js:955-958).
//    => Dien gia cho cay thuoc phieu CO NCC lam TANG NO PHAI TRA NGAY, du cay dang nam im trong kho.
//    => Vi vay MAC DINH script chi dien cho cay thuoc phieu KHONG gan NCC.
//       Muon dien them cho NCC nao thi phai goi ro ten qua --ncc-cho-phep.
//
// 4) Truoc khi ghi: luu gia tri cu ra backend/backup/ (1 file .json + 1 file .sql hoan tac).
//
// 5) Toan bo ghi nam trong 1 transaction — loi giua chung thi rollback sach.

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { sql, getPool } = require('../db');

// ---------------------------------------------------------------- tien ich
// boDau/soThuc chep tu utils/nhap_ton_vai_excel.js — file do goi main() ngay khi require
// nen khong the dung lai bang require. Sua mot ben nho doi chieu ben kia.
function boDau(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

// Chuoi so kieu Viet ("1.234,5") lan kieu Anh ("1,234.5") deu doc duoc.
function soThuc(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let t = String(v).replace(/[^\d.,-]/g, '').trim();
  if (!t) return null;
  const cham = t.lastIndexOf('.'), phay = t.lastIndexOf(',');
  if (cham >= 0 && phay >= 0) {
    if (phay > cham) t = t.replace(/\./g, '').replace(',', '.');
    else t = t.replace(/,/g, '');
  } else if (phay >= 0) {
    t = t.replace(',', '.');
  }
  const n = parseFloat(t);
  return isFinite(n) ? n : null;
}

const tien = n => (Number(n) || 0).toLocaleString('vi-VN');

// NGUONG NGHI GO THIEU SO 0 — PHAI KHAC NHAU GIUA VAI VA PHU KIEN.
//   Vai  : tinh theo KG, thuc te thap nhat trong bang gia la 45.000 d/kg.
//          "210" cho 36 kg vai = 7.560 d -> chac chan thieu so 0.
//   Phu kien: tinh theo CAI. Chot nhua 500 d/cai, day rut 1.000 d/cai la gia THAT, khong phai loi.
//          Dat nguong 1.000 cho phu kien la sai: chan nham hang tram dong hop le, va con vo ly
//          o cho day rut 1.000 thi lot ma chot 500 thi chan.
// Ghi nham loai nay khong bao gio lo ra: he thong van tinh duoc, chi la gia von sai am tham.
// Muon ghi gia duoi nguong that su thi them --cho-gia-thap.
const NGUONG_GIA_THAP = { vai: 10000, phuKien: 100 };

function docThamSo() {
  const args = process.argv.slice(2);
  const COGIATRI = ['--sheet', '--ncc-cho-phep', '--xuat-mau'];
  const ts = { file: null, ghi: false, sheet: null, nccChoPhep: [], moiNcc: false,
               chiVai: false, chiPhuKien: false, xuatMau: null, ep: null, choGiaThap: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (COGIATRI.includes(a)) {
      const v = args[++i];
      if (a === '--sheet') ts.sheet = v;
      else if (a === '--xuat-mau') ts.xuatMau = v;
      else if (a === '--ncc-cho-phep') {
        String(v || '').split(';').map(x => x.trim()).filter(Boolean).forEach(x => ts.nccChoPhep.push(x));
      }
    }
    else if (a === '--ghi') ts.ghi = true;
    else if (a === '--moi-ncc') ts.moiNcc = true;
    else if (a === '--chi-vai') ts.chiVai = true;
    else if (a === '--chi-phukien') ts.chiPhuKien = true;
    else if (a === '--theo-ma-loai') ts.ep = 'loai';
    else if (a === '--theo-ma-vai') ts.ep = 'vai';
    else if (a === '--theo-ma-cay') ts.ep = 'cay';
    else if (a === '--cho-gia-thap') ts.choGiaThap = true;
    else if (a.startsWith('--')) console.log('Bo qua tuy chon la: ' + a);
    else if (!ts.file) ts.file = a;
  }
  return ts;
}

// ---------------------------------------------------- do cot theo TEN TIEU DE
// THU TU KHAI BAO = THU TU UU TIEN khoa: ma cay (hep nhat) > ma vai > ma loai vai (rong nhat).
// File nao co ca hai thi lay khoa HEP hon — dien chinh xac hon.
const TU_DIEN_COT = {
  maCay:     ['ma cay', 'macay', 'ma cuon', 'ma cay vai'],
  maVai:     ['ma vai', 'mavai'],
  maLoai:    ['ma loai vai', 'maloaivai', 'ma loai', 'maloai', 'ma chat lieu'],
  maPhuKien: ['ma phu kien', 'maphukien', 'ma phukien', 'ma pk', 'mapk', 'ma'],
  donGia:    ['don gia nhap', 'gia nhap', 'don gia moi', 'don gia', 'gia']
};

// Vong khop "chua" ben duoi se bat ca "Gia ban" vao truong donGia neu khong cam han.
// Cam theo kieu CHUA (khong phai bang) — neu khong thi "Don gia ban hang" van lot qua.
// KHONG cho 'ton' tran vao day: boDau("Cotton") chua 'ton' -> se cam nham cot "Ma loai Cotton".
const COT_CAM = ['gia ban', 'don gia ban', 'gia xuat', 'don gia xuat', 'gia von', 'gia goc',
                 'thanh tien', 'so luong', 'ghi chu', 'ton kho', 'ton dau', 'ma pm'];
const biCam = k => k === 'stt' || COT_CAM.some(t => k.includes(t));

// Nhung tu khoa chi duoc khop CHINH XAC, khong bao gio khop long.
// 'ma': sheet phu kien co cot ten dung la "Ma". Cho no khop long thi no nuot ca "Ma vai",
// "Ma loai vai" o sheet khac -> sheet vai bi hieu thanh sheet phu kien.
const CHI_KHOP_CHINH_XAC = ['ma'];

// Tu khoa NGAN (< 5 ky tu) chi duoc khop dau chuoi, khong duoc khop "chua":
// 'gia' ma khop chua thi boDau("Ngay giao") = 'ngay giao' cung dinh -> cot ngay bi hieu la cot gia.
const khopTuKhoa = (k, t, khopChua) =>
  CHI_KHOP_CHINH_XAC.includes(t) ? k === t
  : !khopChua ? k === t
  : (t.length < 5 ? k.startsWith(t) : (k.startsWith(t) || k.includes(t)));

// Tra ve map truong -> CHI SO COT (khong phai ten cot: ten co the trung nhau giua 2 cot).
function doCot(headers) {
  const map = {};
  const dung = new Set();
  const duyet = (khopChua) => headers.forEach((h, idx) => {
    const k = boDau(h);
    if (!k || dung.has(idx) || biCam(k)) return;
    for (const [truong, ds] of Object.entries(TU_DIEN_COT)) {
      if (map[truong] != null) continue;          // chu y: chi so 0 la hop le, phai so sanh voi null
      if (ds.some(t => khopTuKhoa(k, t, khopChua))) { map[truong] = idx; dung.add(idx); return; }
    }
  });
  duyet(false);   // vong 1: khop CHINH XAC ten cot
  duyet(true);    // vong 2: khop "chua" cho nhung truong con thieu
  return map;
}

// Tim bang du lieu trong sheet: dong tieu de KHONG bat buoc o dong 1 (file thuong co tieu de,
// logo, dong trong o tren). Quet 30 dong dau, lay dong dau tien do duoc CA cot gia LAN mot cot khoa.
function timBangTrongSheet(ws) {
  // blankrows: true — GIU dong trong de chi so dong bao ra khop DUNG voi dong trong Excel.
  // De false thi dong trong bi nen lai, bao "dong 42" nhung Excel la dong 57 -> khong do duoc.
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: true });
  for (let i = 0; i < Math.min(aoa.length, 30); i++) {
    const headers = (aoa[i] || []).map(x => (x == null ? '' : String(x).trim()));
    if (headers.filter(Boolean).length < 2) continue;
    const cot = doCot(headers);
    if (cot.donGia == null) continue;
    if (cot.maCay == null && cot.maVai == null && cot.maLoai == null && cot.maPhuKien == null) continue;
    return { dongTieuDe: i + 1, headers, cot, duLieu: aoa.slice(i + 1) };
  }
  return null;
}

// ------------------------------------------------------------- tra cuu danh muc
async function timTheoMaLoai(pool, ma) {
  return (await pool.request().input('m', sql.NVarChar, ma).query(
    "SELECT LoaiVaiID, TenLoaiVai FROM LoaiVai " +
    "WHERE LOWER(LTRIM(RTRIM(ISNULL(MaLoai, N'')))) = LOWER(LTRIM(RTRIM(@m)))")).recordset;
}
async function timTheoMaVai(pool, ma) {
  return (await pool.request().input('m', sql.NVarChar, ma).query(
    'SELECT VaiID, MaVai FROM DanhMucVai ' +
    'WHERE LOWER(LTRIM(RTRIM(MaVai))) = LOWER(LTRIM(RTRIM(@m)))')).recordset;
}
async function timTheoMaCay(pool, ma) {
  return (await pool.request().input('m', sql.NVarChar, ma).query(
    'SELECT CayID, MaCay FROM VaiCay ' +
    'WHERE LOWER(LTRIM(RTRIM(MaCay))) = LOWER(LTRIM(RTRIM(@m)))')).recordset;
}
async function timTheoMaPhuKien(pool, ma) {
  return (await pool.request().input('m', sql.NVarChar, ma).query(
    'SELECT PhuKienID, MaPhuKien, TenPhuKien FROM DanhMucPhuKien ' +
    'WHERE LOWER(LTRIM(RTRIM(MaPhuKien))) = LOWER(LTRIM(RTRIM(@m)))')).recordset;
}

// ------------------------------------------------- tra cuu vai: TIN DU LIEU, KHONG TIN TEN COT
// Ca thuc te v8.76: file bang gia co cot ten "Ma vai" nhung noi dung lai la MA LOAI VAI
// (CTSG, CTL, CTT4C...). Tin ten cot thi 72/73 dong truot, va dong con lai khop NHAM — "GNK"
// vua la mot ma loai vua la mot ma vai, nen no dien 1 cay roi bo sot het cac cay khac cua loai do.
// Sai im lang, kho phat hien nhat. Vi vay: thu CA BA cap, quyet dinh theo du lieu.
//   - dung 1 cap khop  -> dung cap do (du ten cot noi khac)
//   - tu 2 cap tro len -> MO HO, bao loi va bat chon bang --theo-ma-loai / --theo-ma-vai
//   - ep = cap duoc chi dinh -> chi tra cap do, bo qua cac cap khac
async function traCuuVai(pool, ma, ep) {
  const kq = {};
  if (!ep || ep === 'cay')  kq.cay  = await timTheoMaCay(pool, ma);
  if (!ep || ep === 'vai')  kq.vai  = await timTheoMaVai(pool, ma);
  if (!ep || ep === 'loai') kq.loai = await timTheoMaLoai(pool, ma);

  const TEN = { cay: 'ma cay', vai: 'ma vai', loai: 'ma loai vai' };
  const coKq = ['cay', 'vai', 'loai'].filter(c => (kq[c] || []).length);

  if (!coKq.length) {
    return { loi: `"${ma}" khong co trong danh muc` +
      (ep ? ` (tra theo ${TEN[ep]})` : ' (da thu ca ma cay / ma vai / ma loai vai)') };
  }
  if (coKq.length > 1) {
    return { loi: `"${ma}" vua la ${coKq.map(c => TEN[c]).join(' vua la ')} -> MO HO. ` +
      'Chay lai kem --theo-ma-loai (hoac --theo-ma-vai) de chi ro, script khong doan' };
  }
  const cap = coKq[0], rows = kq[cap];
  if (rows.length > 1) {
    // Chi ma LOAI VAI moi trung duoc: LoaiVai.MaLoai NULL duoc va KHONG UNIQUE.
    // MaVai va MaCay deu NOT NULL UNIQUE.
    return { loi: `"${ma}" tro toi ${rows.length} loai vai ` +
      `(${rows.map(x => x.TenLoaiVai || x.MaVai || x.MaCay).join(' / ')}) ` +
      '-> SUA DANH MUC cho moi loai mot ma rieng' };
  }
  return { cap, row: rows[0] };
}

// --------------------------------------------------- lay dong dang THIEU GIA
// Lay HET (khong loc NCC o SQL) roi phan loai trong JS — de bao duoc ca so dong BI BO QUA vi NCC.
const SQL_CAY_THIEU_GIA =
  "SELECT vc.CayID, vc.MaCay, vc.DonGiaNhap, ISNULL(vc.KGNhap, 0) AS KGNhap, pn.NCC_ID, " +
  "       ISNULL(ncc.TenNCC, N'(khong gan NCC)') AS TenNCC " +
  "FROM VaiCay vc " +
  "JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID " +
  "LEFT JOIN PhieuNhapVai pn ON pn.PhieuNhapID = vc.PhieuNhapID " +
  "LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = pn.NCC_ID " +
  "WHERE ISNULL(vc.DonGiaNhap, 0) = 0 AND ";

async function cayThieuGia(pool, capKhoa, id) {
  const dk = capKhoa === 'cay' ? 'vc.CayID = @x'
           : capKhoa === 'vai' ? 'dv.VaiID = @x'
           : 'dv.LoaiVaiID = @x';
  return (await pool.request().input('x', sql.Int, id).query(SQL_CAY_THIEU_GIA + dk)).recordset;
}

async function dongPhuKienThieuGia(pool, phuKienId) {
  return (await pool.request().input('x', sql.Int, phuKienId).query(
    "SELECT ct.ID, ct.DonGia, ISNULL(ct.SoLuong, 0) AS SoLuong, p.NCC_ID, " +
    "       ISNULL(ncc.TenNCC, N'(khong gan NCC)') AS TenNCC " +
    "FROM PhieuPhuKienChiTiet ct " +
    "JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID " +
    "LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID " +
    "WHERE ct.PhuKienID = @x AND p.LoaiPhieu = N'Nhập' AND ISNULL(ct.DonGia, 0) = 0")).recordset;
}

// ------------------------------------------------------------- loc theo NCC
async function giaiTenNcc(pool, tens) {
  const all = (await pool.request().query('SELECT NCC_ID, TenNCC FROM NhaCungCap')).recordset;
  const ids = [], khongThay = [], daKhop = [];
  for (const t of tens) {
    const k = boDau(t);
    // Uu tien khop CHINH XAC ten; khong co moi noi long sang khop "chua" (ten NCC hay go dai dong).
    const dung = all.filter(n => boDau(n.TenNCC) === k);
    const tim = dung.length ? dung : all.filter(n => boDau(n.TenNCC).includes(k));
    if (!tim.length) khongThay.push(t);
    else tim.forEach(n => { ids.push(Number(n.NCC_ID)); daKhop.push(n.TenNCC); });
  }
  return { ids: [...new Set(ids)], khongThay, daKhop: [...new Set(daKhop)] };
}

function duocPhep(r, dsChoPhep, moiNcc) {
  if (moiNcc) return true;
  if (r.NCC_ID == null) return true;
  return dsChoPhep.includes(Number(r.NCC_ID));
}

// ------------------------------------------------------------- file mau
async function xuatFileMau(pool, duongDan) {
  const loai = (await pool.request().query(
    "SELECT ISNULL(lv.MaLoai, N'') AS MaLoai, lv.TenLoaiVai, " +
    "       COUNT(vc.CayID) AS SoCayThieuGia, SUM(ISNULL(vc.KGNhap,0)) AS KGThieuGia " +
    "FROM LoaiVai lv " +
    "JOIN DanhMucVai dv ON dv.LoaiVaiID = lv.LoaiVaiID " +
    "JOIN VaiCay vc ON vc.VaiID = dv.VaiID AND ISNULL(vc.DonGiaNhap,0) = 0 " +
    "GROUP BY ISNULL(lv.MaLoai, N''), lv.TenLoaiVai " +
    "ORDER BY COUNT(vc.CayID) DESC")).recordset;

  const pk = (await pool.request().query(
    "SELECT dm.MaPhuKien, dm.TenPhuKien, ISNULL(dm.Size, N'') AS Size, " +
    "       ISNULL(dm.DonViCoBan, N'') AS DonVi, COUNT(ct.ID) AS SoDongThieuGia " +
    "FROM DanhMucPhuKien dm " +
    "JOIN PhieuPhuKienChiTiet ct ON ct.PhuKienID = dm.PhuKienID " +
    "JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID AND p.LoaiPhieu = N'Nhập' " +
    "WHERE ISNULL(ct.DonGia, 0) = 0 " +
    "GROUP BY dm.MaPhuKien, dm.TenPhuKien, dm.Size, dm.DonViCoBan " +
    "ORDER BY dm.MaPhuKien")).recordset;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Ma loai vai', 'Ten loai vai', 'So cay thieu gia', 'KG thieu gia', 'Don gia'],
    ...loai.map(r => [r.MaLoai, r.TenLoaiVai, r.SoCayThieuGia, Number(r.KGThieuGia) || 0, null])
  ]), 'Vai');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Ma phu kien', 'Ten phu kien', 'Size', 'Don vi', 'So dong thieu gia', 'Don gia'],
    ...pk.map(r => [r.MaPhuKien, r.TenPhuKien, r.Size, r.DonVi, r.SoDongThieuGia, null])
  ]), 'PhuKien');
  XLSX.writeFile(wb, duongDan);

  console.log('Da tao file mau: ' + duongDan);
  console.log(`   sheet "Vai":     ${loai.length} ma loai dang co cay thieu gia`);
  console.log(`   sheet "PhuKien": ${pk.length} ma phu kien dang co dong nhap thieu gia`);
  console.log('   => Dien cot "Don gia" roi chay lai script voi duong dan file nay.');
  console.log('   LUU Y: dong co "Ma loai vai" TRONG la loai vai chua khai ma — dien o day khong khop duoc,');
  console.log('          phai vao Danh muc dat ma cho no truoc.');
}

// =================================================================== MAIN
async function main() {
  const ts = docThamSo();
  const pool = await getPool();

  if (ts.xuatMau) { await xuatFileMau(pool, ts.xuatMau); process.exit(0); }

  if (!ts.file) {
    console.log('Thieu duong dan file Excel.\n');
    console.log('  node utils/gia_vai_phukien_excel.js "D:\\bang gia vai.xlsx"');
    console.log('  node utils/gia_vai_phukien_excel.js --xuat-mau "D:\\mau.xlsx"');
    process.exit(1);
  }
  const duongDan = path.resolve(ts.file);
  if (!fs.existsSync(duongDan)) { console.log('Khong thay file: ' + duongDan); process.exit(1); }

  // ---- NCC duoc phep ----
  const ncc = await giaiTenNcc(pool, ts.nccChoPhep);
  console.log('='.repeat(78));
  console.log('FILE : ' + duongDan);
  console.log('CHE DO: ' + (ts.ghi ? '*** GHI THAT ***' : 'XEM TRUOC (khong ghi gi)'));
  if (ts.moiNcc) {
    console.log('NCC  : --moi-ncc  => dien cho MOI nha cung cap. CONG NO PHAI TRA SE TANG.');
  } else if (ncc.ids.length) {
    console.log('NCC  : phieu KHONG gan NCC + ' + ncc.daKhop.map(x => '"' + x + '"').join(', '));
  } else {
    console.log('NCC  : CHI phieu KHONG gan NCC (cong no khong doi)');
  }
  if (ncc.khongThay.length) {
    console.log('  ⚠ Khong tim thay NCC: ' + ncc.khongThay.map(x => '"' + x + '"').join(', '));
    console.log('    => Cay cua nhung NCC do SE BI BO QUA. Kiem tra lai ten o man Nha cung cap.');
  }
  console.log('='.repeat(78));

  // ---- doc file ----
  const wb = XLSX.readFile(duongDan, { cellDates: true });
  const dsSheet = ts.sheet ? [ts.sheet] : wb.SheetNames;
  const mucVai = [], mucPK = [], khongDoc = [];

  for (const ten of dsSheet) {
    const ws = wb.Sheets[ten];
    if (!ws) { khongDoc.push(`${ten}: khong co sheet nay trong file`); continue; }
    const bang = timBangTrongSheet(ws);
    if (!bang) {
      // In ra tieu de THAT trong sheet — khong co dong nay thi khong biet phai sua ten cot thanh gi.
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: false });
      const dong = (aoa.slice(0, 30).find(r => (r || []).filter(x => x != null && String(x).trim()).length >= 2) || []);
      khongDoc.push(`${ten}: khong do duoc cot (can 1 cot gia + 1 cot ma). Tieu de thay trong sheet: ` +
        (dong.length ? dong.map(x => `"${x == null ? '' : String(x).trim()}"`).join(' | ') : '(khong thay dong tieu de nao)'));
      continue;
    }

    const c = bang.cot;
    const laPK = c.maPhuKien != null;
    const capKhoa = c.maCay != null ? 'cay' : c.maVai != null ? 'vai' : 'loai';
    const cotKhoa = laPK ? c.maPhuKien : (c.maCay != null ? c.maCay : c.maVai != null ? c.maVai : c.maLoai);

    console.log(`\nSHEET "${ten}" (tieu de o dong ${bang.dongTieuDe}) -> ` +
      (laPK ? 'PHU KIEN theo ma phu kien' : 'VAI theo ' +
        (capKhoa === 'cay' ? 'MA CAY' : capKhoa === 'vai' ? 'MA VAI' : 'MA LOAI VAI')));
    console.log(`   cot ma  = "${bang.headers[cotKhoa]}"   cot gia = "${bang.headers[c.donGia]}"`);

    bang.duLieu.forEach((row, i) => {
      const ma = String((row || [])[cotKhoa] == null ? '' : (row || [])[cotKhoa]).trim();
      const gia = soThuc((row || [])[c.donGia]);
      if (!ma && gia == null) return;                 // dong trong
      const muc = { sheet: ten, dong: bang.dongTieuDe + 1 + i, ma, gia, capKhoa };
      (laPK ? mucPK : mucVai).push(muc);
    });
  }
  khongDoc.forEach(x => console.log('   (bo qua) ' + x));

  if (ts.chiPhuKien) mucVai.length = 0;
  if (ts.chiVai) mucPK.length = 0;
  if (!mucVai.length && !mucPK.length) {
    console.log('\nKhong doc duoc dong nao tu file. Kiem tra ten cot (can "Ma loai vai"/"Ma phu kien" va "Don gia").');
    process.exit(1);
  }

  // ---- tra cuu + phan loai ----
  const viecVai = [], viecPK = [], loi = [];
  let boQuaNcc = 0, kgBoQuaNcc = 0;
  const nccBiBoQua = new Map();
  const khacCap = new Map();   // dong khop o cap KHAC voi ten cot -> canh bao cuoi bang

  for (const m of mucVai) {
    if (!m.ma) { loi.push(`${m.sheet} dong ${m.dong}: thieu ma`); continue; }
    if (m.gia == null || m.gia <= 0) { loi.push(`${m.sheet} dong ${m.dong}: "${m.ma}" chua dien don gia`); continue; }
    if (m.gia < NGUONG_GIA_THAP.vai && !ts.choGiaThap) {
      loi.push(`${m.sheet} dong ${m.dong}: "${m.ma}" don gia = ${tien(m.gia)} d/kg — QUA THAP ` +
               `(vai thap nhat thuc te ~45.000 d/kg), nghi go thieu so 0. ` +
               'Sua lai file, hoac them --cho-gia-thap neu gia nay dung that');
      continue;
    }

    const tc = await traCuuVai(pool, m.ma, ts.ep);
    if (tc.loi) { loi.push(`${m.sheet} dong ${m.dong}: ${tc.loi}`); continue; }
    if (tc.cap !== m.capKhoa) khacCap.set(tc.cap, (khacCap.get(tc.cap) || 0) + 1);

    const tim = [tc.row];
    const id = tc.cap === 'loai' ? tc.row.LoaiVaiID : tc.cap === 'vai' ? tc.row.VaiID : tc.row.CayID;
    const cay = await cayThieuGia(pool, tc.cap, id);
    const duoc = [], chan = [];
    cay.forEach(r => (duocPhep(r, ncc.ids, ts.moiNcc) ? duoc : chan).push(r));
    chan.forEach(r => {
      boQuaNcc++; kgBoQuaNcc += Number(r.KGNhap) || 0;
      nccBiBoQua.set(r.TenNCC, (nccBiBoQua.get(r.TenNCC) || 0) + 1);
    });
    if (!duoc.length && !chan.length) { loi.push(`${m.sheet} dong ${m.dong}: "${m.ma}" khong con cay nao thieu gia`); continue; }
    if (duoc.length) viecVai.push({ ...m, ten: tim[0].TenLoaiVai || tim[0].MaVai || tim[0].MaCay, rows: duoc, chan: chan.length });
    else loi.push(`${m.sheet} dong ${m.dong}: "${m.ma}" co ${chan.length} cay thieu gia nhung DEU thuoc NCC khong duoc phep`);
  }

  for (const m of mucPK) {
    if (!m.ma) { loi.push(`${m.sheet} dong ${m.dong}: thieu ma phu kien`); continue; }
    if (m.gia == null || m.gia <= 0) { loi.push(`${m.sheet} dong ${m.dong}: "${m.ma}" chua dien don gia`); continue; }
    if (m.gia < NGUONG_GIA_THAP.phuKien && !ts.choGiaThap) {
      loi.push(`${m.sheet} dong ${m.dong}: "${m.ma}" don gia = ${tien(m.gia)} — QUA THAP, nghi go thieu so 0. ` +
               'Sua lai file, hoac them --cho-gia-thap neu gia nay dung that');
      continue;
    }
    const tim = await timTheoMaPhuKien(pool, m.ma);
    if (!tim.length) { loi.push(`${m.sheet} dong ${m.dong}: "${m.ma}" khong co trong danh muc phu kien`); continue; }
    if (tim.length > 1) { loi.push(`${m.sheet} dong ${m.dong}: "${m.ma}" bi TRUNG ${tim.length} dong trong danh muc`); continue; }
    const dong = await dongPhuKienThieuGia(pool, tim[0].PhuKienID);
    const duoc = [], chan = [];
    dong.forEach(r => (duocPhep(r, ncc.ids, ts.moiNcc) ? duoc : chan).push(r));
    chan.forEach(r => { boQuaNcc++; nccBiBoQua.set(r.TenNCC, (nccBiBoQua.get(r.TenNCC) || 0) + 1); });
    if (duoc.length) viecPK.push({ ...m, ten: tim[0].TenPhuKien, rows: duoc, chan: chan.length });
    else if (chan.length) loi.push(`${m.sheet} dong ${m.dong}: "${m.ma}" co ${chan.length} dong nhung DEU thuoc NCC khong duoc phep`);
    else loi.push(`${m.sheet} dong ${m.dong}: "${m.ma}" khong con dong nhap nao thieu gia`);
  }

  // ---- bang xem truoc ----
  console.log('\n' + '-'.repeat(78));
  if (viecVai.length) {
    console.log('VAI — se dien:');
    console.log('  ' + 'MA'.padEnd(16) + 'TEN'.padEnd(26) + 'DON GIA'.padStart(12) + 'SO CAY'.padStart(8) + 'KG'.padStart(11));
    viecVai.forEach(v => {
      const kg = v.rows.reduce((s, r) => s + (Number(r.KGNhap) || 0), 0);
      console.log('  ' + String(v.ma).slice(0, 15).padEnd(16) + String(v.ten || '').slice(0, 25).padEnd(26) +
        tien(v.gia).padStart(12) + String(v.rows.length).padStart(8) + kg.toFixed(1).padStart(11));
    });
  }
  if (viecPK.length) {
    console.log('\nPHU KIEN — se dien:');
    console.log('  ' + 'MA'.padEnd(20) + 'TEN'.padEnd(28) + 'DON GIA'.padStart(12) + 'SO DONG'.padStart(9));
    viecPK.forEach(v => console.log('  ' + String(v.ma).slice(0, 19).padEnd(20) +
      String(v.ten || '').slice(0, 27).padEnd(28) + tien(v.gia).padStart(12) + String(v.rows.length).padStart(9)));
  }

  if (khacCap.size) {
    const TEN = { cay: 'MA CAY', vai: 'MA VAI', loai: 'MA LOAI VAI' };
    console.log('\n⚠ TEN COT KHONG KHOP NOI DUNG:');
    [...khacCap.entries()].forEach(([c, n]) =>
      console.log(`   ${n} dong khop duoc o cap ${TEN[c]} (ten cot trong file noi khac).`));
    console.log('   Script da tra theo DU LIEU, khong theo ten cot. Kiem lai bang tren cho chac.');
  }

  const soCay = viecVai.reduce((s, v) => s + v.rows.length, 0);
  const soDongPK = viecPK.reduce((s, v) => s + v.rows.length, 0);
  const tienVaiTang = viecVai.reduce((s, v) =>
    s + v.rows.filter(r => r.NCC_ID != null).reduce((k, r) => k + (Number(r.KGNhap) || 0) * v.gia, 0), 0);
  const tienPKTang = viecPK.reduce((s, v) =>
    s + v.rows.filter(r => r.NCC_ID != null).reduce((k, r) => k + (Number(r.SoLuong) || 0) * v.gia, 0), 0);

  console.log('\n' + '-'.repeat(78));
  console.log(`TONG: ${soCay} cay vai + ${soDongPK} dong phu kien se duoc dien gia`);
  if (boQuaNcc) {
    console.log(`BO QUA ${boQuaNcc} dong vi thuoc NCC khong duoc phep (${kgBoQuaNcc.toFixed(1)} kg vai):`);
    [...nccBiBoQua.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
      .forEach(([t, n]) => console.log(`   - ${t}: ${n} dong`));
    console.log('   => Muon dien cho NCC nao thi them: --ncc-cho-phep "Ten NCC"');
  }
  if (tienVaiTang + tienPKTang > 0) {
    console.log('\n🔴 CONG NO PHAI TRA NCC SE TANG: ' + tien(Math.round(tienVaiTang + tienPKTang)) + ' d');
    console.log(`   (vai ${tien(Math.round(tienVaiTang))} d + phu kien ${tien(Math.round(tienPKTang))} d)`);
    console.log('   So cong no in TRUOC va SAU khi chay se khac nhau. Doc ky truoc khi dung --ghi.');
  } else {
    console.log('\n✓ Cong no phai tra NCC KHONG doi (moi dong deu thuoc phieu khong gan NCC).');
  }
  if (loi.length) {
    // Gom theo LY DO truoc khi liet ke: danh sach 300 dong deu deu thi khong ai doc, va cai can
    // biet la "bao nhieu dong truot vi ly do gi", khong phai tung dong mot.
    const nhom = new Map();
    const datTen = x =>
      /QUA THAP/.test(x)                 ? 'Don gia qua thap (nghi go thieu so 0)'
      : /khong con .* thieu gia/.test(x) ? 'Ma da co du gia — khong con gi de dien'
      : /DEU thuoc NCC/.test(x)          ? 'Chi con dong cua NCC khong duoc phep'
      : /tro toi \d+ loai vai/.test(x)   ? 'Ma loai vai bi TRUNG — phai sua Danh muc'
      : /MO HO/.test(x)                  ? 'Ma mo ho giua 2 cap — can --theo-ma-loai'
      : /khong co trong danh muc/.test(x)? 'Khong co trong danh muc'
      : /chua dien don gia/.test(x)      ? 'Chua dien don gia'
      : /thieu ma/.test(x)               ? 'Dong trong / thieu ma'
      : 'Khac';
    loi.forEach(x => { const t = datTen(x); if (!nhom.has(t)) nhom.set(t, []); nhom.get(t).push(x); });

    console.log(`\nKHONG XU LY DUOC ${loi.length} dong — theo ly do:`);
    [...nhom.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([t, ds]) => {
      console.log(`\n  [${ds.length}] ${t}`);
      ds.slice(0, 8).forEach(x => console.log('      - ' + x));
      if (ds.length > 8) console.log(`      ... va ${ds.length - 8} dong nua cung ly do`);
    });
  }

  if (!ts.ghi) {
    console.log('\n' + '='.repeat(78));
    console.log('DAY CHI LA XEM TRUOC — CHUA GHI GI VAO DATABASE.');
    console.log('Kiem tra ky bang tren, thay dung roi thi chay lai kem  --ghi');
    process.exit(0);
  }
  if (!soCay && !soDongPK) { console.log('\nKhong co dong nao de ghi.'); process.exit(1); }

  // ---- BACKUP truoc khi dong vao database ----
  const thuMuc = path.join(__dirname, '..', 'backup');
  if (!fs.existsSync(thuMuc)) fs.mkdirSync(thuMuc, { recursive: true });
  const d = new Date();
  const dau = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}` +
              `_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  const fJson = path.join(thuMuc, `gia_truoc_khi_sua_${dau}.json`);
  const fSql = path.join(thuMuc, `hoan_tac_gia_${dau}.sql`);

  const luuVai = [], luuPK = [];
  viecVai.forEach(v => v.rows.forEach(r => luuVai.push({ CayID: r.CayID, MaCay: r.MaCay, DonGiaNhapCu: r.DonGiaNhap, GiaMoi: v.gia })));
  viecPK.forEach(v => v.rows.forEach(r => luuPK.push({ ID: r.ID, DonGiaCu: r.DonGia, GiaMoi: v.gia })));
  fs.writeFileSync(fJson, JSON.stringify({ thoiGian: d.toISOString(), file: duongDan, vai: luuVai, phuKien: luuPK }, null, 2), 'utf8');

  const lo = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
  const dongSql = ['-- HOAN TAC lan chay ' + d.toISOString(), '-- Chay TOAN BO file nay de tra gia ve nhu truoc.', ''];
  [[luuVai.filter(x => x.DonGiaNhapCu == null).map(x => x.CayID), 'VaiCay', 'DonGiaNhap', 'CayID', 'NULL'],
   [luuVai.filter(x => x.DonGiaNhapCu != null).map(x => x.CayID), 'VaiCay', 'DonGiaNhap', 'CayID', '0'],
   [luuPK.filter(x => x.DonGiaCu == null).map(x => x.ID), 'PhieuPhuKienChiTiet', 'DonGia', 'ID', 'NULL'],
   [luuPK.filter(x => x.DonGiaCu != null).map(x => x.ID), 'PhieuPhuKienChiTiet', 'DonGia', 'ID', '0']
  ].forEach(([ids, bang, cot, khoa, gt]) => lo(ids, 500).forEach(p =>
    dongSql.push(`UPDATE ${bang} SET ${cot} = ${gt} WHERE ${khoa} IN (${p.join(',')});`)));
  fs.writeFileSync(fSql, dongSql.join('\n'), 'utf8');

  console.log('\nDa luu backup:');
  console.log('   ' + fJson);
  console.log('   ' + fSql + '   <- chay file nay de HOAN TAC');

  // ---- GHI THAT ----
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    let daCay = 0, daPK = 0;
    for (const v of viecVai) {
      for (const phan of lo(v.rows.map(r => r.CayID), 500)) {
        const kq = await new sql.Request(tran).input('g', sql.Decimal(14, 2), v.gia).query(
          `UPDATE VaiCay SET DonGiaNhap = @g WHERE CayID IN (${phan.join(',')}) AND ISNULL(DonGiaNhap, 0) = 0`);
        daCay += kq.rowsAffected[0] || 0;
      }
    }
    for (const v of viecPK) {
      for (const phan of lo(v.rows.map(r => r.ID), 500)) {
        const kq = await new sql.Request(tran).input('g', sql.Decimal(14, 2), v.gia).query(
          `UPDATE PhieuPhuKienChiTiet SET DonGia = @g WHERE ID IN (${phan.join(',')}) AND ISNULL(DonGia, 0) = 0`);
        daPK += kq.rowsAffected[0] || 0;
      }
    }
    await tran.commit();
    console.log('\n' + '='.repeat(78));
    console.log(`XONG. Da cap nhat ${daCay} cay vai + ${daPK} dong phu kien.`);
    if (daCay !== soCay || daPK !== soDongPK) {
      console.log(`⚠ Lech so voi xem truoc (${soCay} / ${soDongPK}) — co dong vua duoc nguoi khac dien gia.`);
    }
    console.log('Doi chieu: chay lai database\\kiem_tra_gia_thieu.sql, cac con so phai giam dung bang so tren.');
    console.log('Hoan tac neu sai: chay ' + fSql);
    process.exit(0);
  } catch (err) {
    await tran.rollback();
    console.error('\nLOI khi ghi — DA ROLLBACK, database khong thay doi gi.');
    throw err;
  }
}

main().catch(err => { console.error('\nLOI:', err.message); console.error(err); process.exit(1); });
