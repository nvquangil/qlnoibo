// Nap danh muc + ton kho ban dau (Kho vai + Phu kien) tu 1 file Excel vao database QLNoiBo.
// Doc ky database/import/HUONG_DAN_IMPORT.md truoc khi chay tren du lieu thuc.
//
// Cach dung (chay tu thu muc backend/):
//   node scripts/importExcel.js "duong-dan-file.xlsx" --dry-run     (xem truoc, KHONG ghi DB)
//   node scripts/importExcel.js "duong-dan-file.xlsx"               (chay thuc su)
//   node scripts/importExcel.js "duong-dan-file.xlsx" --user admin  (gan nguoi tao = user 'admin', mac dinh la 'admin')
//
// Thu tu xu ly (co dinh, vi sheet sau tham chieu ten sheet truoc):
//   LoaiVai -> MauSac -> NhaCungCap -> DanhMucVai -> TonKhoVai
//   -> LoaiPhuKien -> DanhMucPhuKien -> TonKhoPhuKien
//
// QUAN TRONG: 2 sheet TonKhoVai va TonKhoPhuKien la DU LIEU GIAO DICH (moi dong = 1 cay vai / 1 lan
// nhap), KHONG idempotent - chay lai se cong trung ton kho. Cac sheet danh muc (LoaiVai, MauSac,
// NhaCungCap, DanhMucVai, LoaiPhuKien, DanhMucPhuKien) idempotent - chay lai an toan (tu bo qua neu
// da co).

const XLSX = require('xlsx');
const { sql, getPool } = require('../db');

const args = process.argv.slice(2);
const filePath = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const userFlagIdx = args.indexOf('--user');
const userName = userFlagIdx >= 0 ? args[userFlagIdx + 1] : 'admin';

if (!filePath) {
  console.error('Thiếu đường dẫn file Excel.');
  console.error('Cách dùng: node scripts/importExcel.js "duong-dan-file.xlsx" [--dry-run] [--user <username>]');
  process.exit(1);
}

const errors = [];
const warnings = [];
const summary = {};
function logErr(sheet, rowNum, msg) { errors.push(`[${sheet}] Dòng ${rowNum}: ${msg}`); }
function logWarn(sheet, rowNum, msg) { warnings.push(`[${sheet}] Dòng ${rowNum}: ${msg}`); }
function bump(key) { summary[key] = (summary[key] || 0) + 1; }

function str(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
function hasAnyValue(row) {
  return Object.values(row).some(v => v != null && String(v).trim() !== '');
}
// QUAN TRONG: KHONG dung tuy chon { cellDates: true } khi doc file (xem duoi) - SheetJS quy doi serial
// date -> JS Date qua epoch UTC, cong voi gio local cua may chay script co the lam LECH NGAY (da test
// thuc te: ngay 10/07 bi doc thanh 09/07 15:59). Doc bang gia tri raw (so serial) roi tu quy doi bang
// XLSX.SSF.parse_date_code() la cach duy nhat khong bi anh huong timezone.
function isoDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null;
  }
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; // dd/mm/yyyy kieu VN
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
// Header trong file mau co dang "TenCot *" cho cot bat buoc (dau * chi de hien thi cho nguoi dung) -
// phai bo hau to " *" khi doc thi moi khop dung ten field ma code ben duoi dung (VD r.TenLoaiVai).
function sheetRows(wb, name) {
  if (!wb.Sheets[name]) return [];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null });
  return rows.map(row => {
    const clean = {};
    for (const [k, v] of Object.entries(row)) clean[k.replace(/\s*\*\s*$/, '').trim()] = v;
    return clean;
  });
}

const nccCache = new Map();
async function resolveOrCreateNCC(pool, tenNCC, sheetName, rowNum) {
  const ten = str(tenNCC);
  if (!ten) return null;
  if (nccCache.has(ten)) return nccCache.get(ten);
  const found = await pool.request().input('t', sql.NVarChar, ten).query('SELECT NCC_ID FROM NhaCungCap WHERE TenNCC=@t');
  let id;
  if (found.recordset.length) {
    id = found.recordset[0].NCC_ID;
  } else if (dryRun) {
    id = -1;
    logWarn(sheetName, rowNum, `Nhà cung cấp "${ten}" chưa có, sẽ được tự tạo (chỉ có tên) khi chạy thật.`);
  } else {
    const ins = await pool.request().input('t', sql.NVarChar, ten)
      .query('INSERT INTO NhaCungCap (TenNCC) OUTPUT INSERTED.NCC_ID VALUES (@t)');
    id = ins.recordset[0].NCC_ID;
    bump('NhaCungCap: tự tạo theo tên (chỉ có Tên NCC)');
  }
  nccCache.set(ten, id);
  return id;
}

// ================= 1. LoaiVai =================
async function importLoaiVai(pool, rows) {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], rowNum = i + 2;
    const ten = str(r.TenLoaiVai);
    if (!ten) { if (hasAnyValue(r)) logErr('LoaiVai', rowNum, 'Thiếu TenLoaiVai.'); continue; }
    const found = await pool.request().input('t', sql.NVarChar, ten).query('SELECT LoaiVaiID FROM LoaiVai WHERE TenLoaiVai=@t');
    if (found.recordset.length) { bump('LoaiVai: đã có, bỏ qua'); continue; }
    if (!dryRun) {
      await pool.request().input('t', sql.NVarChar, ten).input('m', sql.NVarChar, str(r.MaLoai))
        .query('INSERT INTO LoaiVai (TenLoaiVai, MaLoai) VALUES (@t, @m)');
    }
    bump('LoaiVai: tạo mới');
  }
}

// ================= 2. MauSac =================
async function importMauSac(pool, rows) {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], rowNum = i + 2;
    const ten = str(r.TenMau), maMau = str(r.MaMau);
    if (!ten && !maMau) { if (hasAnyValue(r)) logErr('MauSac', rowNum, 'Thiếu TenMau/MaMau.'); continue; }
    if (!ten) { logErr('MauSac', rowNum, 'Thiếu TenMau.'); continue; }
    if (!maMau) { logErr('MauSac', rowNum, 'Thiếu MaMau (bắt buộc, phải duy nhất).'); continue; }
    const found = await pool.request().input('t', sql.NVarChar, ten).query('SELECT MauSacID FROM MauSac WHERE TenMau=@t');
    if (found.recordset.length) { bump('MauSac: đã có, bỏ qua'); continue; }
    if (!dryRun) {
      try {
        await pool.request().input('t', sql.NVarChar, ten).input('m', sql.NVarChar, maMau)
          .query('INSERT INTO MauSac (TenMau, MaMau) VALUES (@t, @m)');
      } catch (e) {
        logErr('MauSac', rowNum, `Lỗi khi tạo (có thể MaMau "${maMau}" đã tồn tại): ${e.message}`);
        continue;
      }
    }
    bump('MauSac: tạo mới');
  }
}

// ================= 3. NhaCungCap =================
async function importNhaCungCap(pool, rows) {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], rowNum = i + 2;
    const ten = str(r.TenNCC);
    if (!ten) { if (hasAnyValue(r)) logErr('NhaCungCap', rowNum, 'Thiếu TenNCC.'); continue; }
    const found = await pool.request().input('t', sql.NVarChar, ten).query('SELECT NCC_ID FROM NhaCungCap WHERE TenNCC=@t');
    if (found.recordset.length) { bump('NhaCungCap: đã có, bỏ qua'); continue; }
    if (!dryRun) {
      await pool.request()
        .input('t', sql.NVarChar, ten).input('dc', sql.NVarChar, str(r.DiaChi))
        .input('sdt', sql.NVarChar, str(r.SDT)).input('mst', sql.NVarChar, str(r.MaSoThue))
        .input('gc', sql.NVarChar, str(r.GhiChu))
        .query('INSERT INTO NhaCungCap (TenNCC, DiaChi, SDT, MaSoThue, GhiChu) VALUES (@t, @dc, @sdt, @mst, @gc)');
    }
    bump('NhaCungCap: tạo mới');
  }
}

// ================= 4. DanhMucVai =================
async function importDanhMucVai(pool, rows) {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], rowNum = i + 2;
    const maVai = str(r.MaVai), tenLoai = str(r.TenLoaiVai), tenMau = str(r.TenMau);
    if (!maVai && !tenLoai && !tenMau) { if (hasAnyValue(r)) logErr('DanhMucVai', rowNum, 'Thiếu dữ liệu.'); continue; }
    if (!maVai || !tenLoai || !tenMau) { logErr('DanhMucVai', rowNum, 'Thiếu MaVai/TenLoaiVai/TenMau (đều bắt buộc).'); continue; }

    const exists = await pool.request().input('m', sql.NVarChar, maVai).query('SELECT VaiID FROM DanhMucVai WHERE MaVai=@m');
    if (exists.recordset.length) { bump('DanhMucVai: đã có, bỏ qua'); continue; }

    const loaiRes = await pool.request().input('t', sql.NVarChar, tenLoai).query('SELECT LoaiVaiID FROM LoaiVai WHERE TenLoaiVai=@t');
    if (!loaiRes.recordset.length) { logErr('DanhMucVai', rowNum, `Không tìm thấy Loại vải "${tenLoai}" — khai báo ở sheet LoaiVai trước.`); continue; }
    const mauRes = await pool.request().input('t', sql.NVarChar, tenMau).query('SELECT MauSacID FROM MauSac WHERE TenMau=@t');
    if (!mauRes.recordset.length) { logErr('DanhMucVai', rowNum, `Không tìm thấy Màu "${tenMau}" — khai báo ở sheet MauSac trước.`); continue; }

    if (!dryRun) {
      await pool.request()
        .input('MaVai', sql.NVarChar, maVai)
        .input('MaPM', sql.NVarChar, str(r.MaPM))
        .input('LoaiVaiID', sql.Int, loaiRes.recordset[0].LoaiVaiID)
        .input('MauSacID', sql.Int, mauRes.recordset[0].MauSacID)
        .input('KhoVai', sql.Decimal(10, 2), num(r.KhoVai))
        .input('GSM', sql.Decimal(10, 2), num(r.GSM))
        .input('ViTriKho', sql.NVarChar, str(r.ViTriKho))
        .input('TonToiThieuKG', sql.Decimal(10, 2), num(r.TonToiThieuKG))
        .input('GhiChu', sql.NVarChar, str(r.GhiChu))
        .query(`INSERT INTO DanhMucVai (MaVai, MaPM, LoaiVaiID, MauSacID, KhoVai, GSM, ViTriKho, TonToiThieuKG, GhiChu)
                VALUES (@MaVai, @MaPM, @LoaiVaiID, @MauSacID, @KhoVai, @GSM, @ViTriKho, @TonToiThieuKG, @GhiChu)`);
    }
    bump('DanhMucVai: tạo mới');
  }
}

// ================= 5. TonKhoVai (nhieu cay -> gom theo Ngay+NCC+SoHoaDon thanh 1 PhieuNhapVai) =================
const TRANGTHAI_VAI_HOPLE = ['Nguyên cây', 'Cây lẻ', 'Hết'];

async function importTonKhoVai(pool, rows, nguoiTaoId) {
  const groups = new Map();
  const customMaCaySeen = new Set();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], rowNum = i + 2;
    if (!hasAnyValue(r)) continue;
    const maVai = str(r.MaVai);
    const ngay = isoDate(r.NgayNhap);
    const kg = num(r.KGTon);
    if (!maVai) { logErr('TonKhoVai', rowNum, 'Thiếu MaVai.'); continue; }
    if (!ngay) { logErr('TonKhoVai', rowNum, 'Thiếu hoặc sai định dạng NgayNhap.'); continue; }
    if (!kg || kg <= 0) { logErr('TonKhoVai', rowNum, 'KGTon phải là số > 0.'); continue; }

    const vaiRes = await pool.request().input('m', sql.NVarChar, maVai).query('SELECT VaiID FROM DanhMucVai WHERE MaVai=@m');
    if (!vaiRes.recordset.length) { logErr('TonKhoVai', rowNum, `Không tìm thấy Mã vải "${maVai}" — khai báo ở sheet DanhMucVai trước.`); continue; }

    let maCay = str(r.MaCay);
    if (maCay) {
      if (customMaCaySeen.has(maCay)) { logErr('TonKhoVai', rowNum, `Mã cây "${maCay}" bị lặp lại trong file (đã dùng ở dòng khác).`); continue; }
      const dup = await pool.request().input('m', sql.NVarChar, maCay).query('SELECT 1 FROM VaiCay WHERE MaCay=@m');
      if (dup.recordset.length) { logErr('TonKhoVai', rowNum, `Mã cây "${maCay}" đã tồn tại trong hệ thống, bỏ qua dòng này.`); continue; }
      customMaCaySeen.add(maCay);
    }

    let trangThai = str(r.TrangThai);
    if (trangThai && !TRANGTHAI_VAI_HOPLE.includes(trangThai)) {
      logWarn('TonKhoVai', rowNum, `TrangThai "${trangThai}" không hợp lệ, dùng "Nguyên cây".`);
      trangThai = null;
    }

    const tenNCC = str(r.TenNCC), soHoaDon = str(r.SoHoaDon);
    const key = `${ngay}|${tenNCC || ''}|${soHoaDon || ''}`;
    if (!groups.has(key)) groups.set(key, { ngay, tenNCC, soHoaDon, ghiChu: null, rows: [] });
    const g = groups.get(key);
    if (!g.ghiChu && str(r.GhiChuPhieu)) g.ghiChu = str(r.GhiChuPhieu);
    g.rows.push({
      rowNum, vaiId: vaiRes.recordset[0].VaiID, maVai, maCay,
      khoVaiThucTe: num(r.KhoVaiThucTe), gsm: num(r.GSM), viTriKho: str(r.ViTriKho),
      donGiaNhap: num(r.DonGiaNhap), trangThai, kg
    });
  }

  for (const g of groups.values()) {
    const nccId = await resolveOrCreateNCC(pool, g.tenNCC, 'TonKhoVai', g.rows[0].rowNum);
    let phieuNhapId = -1;
    if (!dryRun) {
      const phieuRes = await pool.request()
        .input('NgayNhap', sql.Date, g.ngay).input('NCC_ID', sql.Int, nccId)
        .input('SoHoaDon', sql.NVarChar, g.soHoaDon).input('GhiChu', sql.NVarChar, g.ghiChu)
        .input('NguoiTaoID', sql.Int, nguoiTaoId)
        .query(`INSERT INTO PhieuNhapVai (NgayNhap, NCC_ID, SoHoaDon, GhiChu, NguoiTaoID)
                OUTPUT INSERTED.PhieuNhapID VALUES (@NgayNhap, @NCC_ID, @SoHoaDon, @GhiChu, @NguoiTaoID)`);
      phieuNhapId = phieuRes.recordset[0].PhieuNhapID;
    }
    bump('PhieuNhapVai: tạo mới (gộp theo Ngày+NCC+Số hóa đơn)');

    const dateObj = new Date(g.ngay);
    const dateCode = String(dateObj.getDate()).padStart(2, '0') + String(dateObj.getMonth() + 1).padStart(2, '0') + String(dateObj.getFullYear()).slice(-2);

    for (const row of g.rows) {
      let maCay = row.maCay;
      if (!maCay) {
        const prefix = row.maVai + dateCode;
        const existing = await pool.request().input('p', sql.NVarChar, prefix + '%').query('SELECT MaCay FROM VaiCay WHERE MaCay LIKE @p');
        const nums = existing.recordset.map(x => parseInt(String(x.MaCay).replace(prefix, ''), 10) || 0);
        const seq = (nums.length ? Math.max(...nums) : 0) + 1;
        maCay = prefix + String(seq).padStart(3, '0');
      }
      const qrUrl = 'https://quickchart.io/qr?text=' + encodeURIComponent(maCay);

      if (!dryRun) {
        const req = pool.request()
          .input('MaCay', sql.NVarChar, maCay).input('PhieuNhapID', sql.Int, phieuNhapId)
          .input('VaiID', sql.Int, row.vaiId).input('KhoVaiThucTe', sql.Decimal(10, 2), row.khoVaiThucTe)
          .input('GSM', sql.Decimal(10, 2), row.gsm).input('KGNhap', sql.Decimal(10, 2), row.kg)
          .input('QRCode', sql.NVarChar, qrUrl).input('ViTriKho', sql.NVarChar, row.viTriKho)
          .input('NgayNhap', sql.Date, g.ngay).input('DonGiaNhap', sql.Decimal(14, 2), row.donGiaNhap);
        let insertSql = `INSERT INTO VaiCay (MaCay, PhieuNhapID, VaiID, KhoVaiThucTe, GSM, KGNhap, QRCode, ViTriKho, NgayNhap, DonGiaNhap`;
        let valuesSql = `VALUES (@MaCay, @PhieuNhapID, @VaiID, @KhoVaiThucTe, @GSM, @KGNhap, @QRCode, @ViTriKho, @NgayNhap, @DonGiaNhap`;
        if (row.trangThai) { req.input('TrangThai', sql.NVarChar, row.trangThai); insertSql += ', TrangThai'; valuesSql += ', @TrangThai'; }
        insertSql += ') '; valuesSql += ')';
        await req.query(insertSql + valuesSql);
      }
      bump('VaiCay: cây vải tồn kho ban đầu tạo mới');
    }
  }
}

// ================= 6. LoaiPhuKien =================
async function importLoaiPhuKien(pool, rows) {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], rowNum = i + 2;
    const ten = str(r.TenLoai);
    if (!ten) { if (hasAnyValue(r)) logErr('LoaiPhuKien', rowNum, 'Thiếu TenLoai.'); continue; }
    const found = await pool.request().input('t', sql.NVarChar, ten).query('SELECT LoaiPhuKienID FROM LoaiPhuKien WHERE TenLoai=@t');
    if (found.recordset.length) { bump('LoaiPhuKien: đã có, bỏ qua'); continue; }
    if (!dryRun) {
      await pool.request().input('t', sql.NVarChar, ten).query('INSERT INTO LoaiPhuKien (TenLoai) VALUES (@t)');
    }
    bump('LoaiPhuKien: tạo mới');
  }
}

// ================= 7. DanhMucPhuKien (tu tao Loai phu kien theo ten neu chua co, giong UI) =================
const loaiPKCache = new Map();
async function resolveOrCreateLoaiPK(pool, tenLoai) {
  const ten = str(tenLoai);
  if (!ten) return null;
  if (loaiPKCache.has(ten)) return loaiPKCache.get(ten);
  const found = await pool.request().input('t', sql.NVarChar, ten).query('SELECT LoaiPhuKienID FROM LoaiPhuKien WHERE TenLoai=@t');
  let id;
  if (found.recordset.length) id = found.recordset[0].LoaiPhuKienID;
  else if (dryRun) id = -1;
  else {
    const ins = await pool.request().input('t', sql.NVarChar, ten).query('INSERT INTO LoaiPhuKien (TenLoai) OUTPUT INSERTED.LoaiPhuKienID VALUES (@t)');
    id = ins.recordset[0].LoaiPhuKienID;
    bump('LoaiPhuKien: tự tạo theo tên (từ sheet DanhMucPhuKien)');
  }
  loaiPKCache.set(ten, id);
  return id;
}

async function importDanhMucPhuKien(pool, rows) {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], rowNum = i + 2;
    const maPK = str(r.MaPhuKien), tenPK = str(r.TenPhuKien), donViCoBan = str(r.DonViCoBan);
    if (!maPK && !tenPK) { if (hasAnyValue(r)) logErr('DanhMucPhuKien', rowNum, 'Thiếu dữ liệu.'); continue; }
    if (!maPK || !tenPK || !donViCoBan) { logErr('DanhMucPhuKien', rowNum, 'Thiếu MaPhuKien/TenPhuKien/DonViCoBan (đều bắt buộc).'); continue; }

    const exists = await pool.request().input('m', sql.NVarChar, maPK).query('SELECT PhuKienID FROM DanhMucPhuKien WHERE MaPhuKien=@m');
    if (exists.recordset.length) { bump('DanhMucPhuKien: đã có, bỏ qua'); continue; }

    const loaiId = await resolveOrCreateLoaiPK(pool, r.TenLoai);
    if (!dryRun) {
      await pool.request()
        .input('MaPhuKien', sql.NVarChar, maPK).input('TenPhuKien', sql.NVarChar, tenPK)
        .input('LoaiPhuKienID', sql.Int, loaiId).input('Size', sql.NVarChar, str(r.Size))
        .input('DonViCoBan', sql.NVarChar, donViCoBan).input('DonViQuyDoi', sql.NVarChar, str(r.DonViQuyDoi))
        .input('TyLeQuyDoi', sql.Decimal(12, 4), num(r.TyLeQuyDoi)).input('GhiChu', sql.NVarChar, str(r.GhiChu))
        .query(`INSERT INTO DanhMucPhuKien (MaPhuKien, TenPhuKien, LoaiPhuKienID, Size, DonViCoBan, DonViQuyDoi, TyLeQuyDoi, GhiChu)
                VALUES (@MaPhuKien, @TenPhuKien, @LoaiPhuKienID, @Size, @DonViCoBan, @DonViQuyDoi, @TyLeQuyDoi, @GhiChu)`);
    }
    bump('DanhMucPhuKien: tạo mới');
  }
}

// ================= 8. TonKhoPhuKien (gom theo Ngay+NCC+SoHoaDon thanh 1 PhieuPhuKien loai Nhap) =================
async function importTonKhoPhuKien(pool, rows, nguoiTaoId) {
  const groups = new Map();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], rowNum = i + 2;
    if (!hasAnyValue(r)) continue;
    const maPK = str(r.MaPhuKien);
    const ngay = isoDate(r.NgayNhap);
    const soLuong = num(r.SoLuongTon);
    if (!maPK) { logErr('TonKhoPhuKien', rowNum, 'Thiếu MaPhuKien.'); continue; }
    if (!ngay) { logErr('TonKhoPhuKien', rowNum, 'Thiếu hoặc sai định dạng NgayNhap.'); continue; }
    if (!soLuong || soLuong <= 0) { logErr('TonKhoPhuKien', rowNum, 'SoLuongTon phải là số > 0.'); continue; }

    const pkRes = await pool.request().input('m', sql.NVarChar, maPK).query('SELECT PhuKienID, DonViCoBan FROM DanhMucPhuKien WHERE MaPhuKien=@m');
    if (!pkRes.recordset.length) { logErr('TonKhoPhuKien', rowNum, `Không tìm thấy Mã phụ kiện "${maPK}" — khai báo ở sheet DanhMucPhuKien trước.`); continue; }

    const tenNCC = str(r.TenNCC), soHoaDon = str(r.SoHoaDon);
    const key = `${ngay}|${tenNCC || ''}|${soHoaDon || ''}`;
    if (!groups.has(key)) groups.set(key, { ngay, tenNCC, soHoaDon, rows: [] });
    groups.get(key).rows.push({
      rowNum, phuKienId: pkRes.recordset[0].PhuKienID,
      donVi: str(r.DonVi) || pkRes.recordset[0].DonViCoBan, soLuong, ghiChu: str(r.GhiChuDong)
    });
  }

  for (const g of groups.values()) {
    const nccId = await resolveOrCreateNCC(pool, g.tenNCC, 'TonKhoPhuKien', g.rows[0].rowNum);
    let phieuId = -1;
    if (!dryRun) {
      const phieuRes = await pool.request()
        .input('Ngay', sql.Date, g.ngay).input('LoaiPhieu', sql.NVarChar, 'Nhập')
        .input('NCC_ID', sql.Int, nccId).input('SoHoaDon', sql.NVarChar, g.soHoaDon)
        .input('GhiChu', sql.NVarChar, 'Nhập tồn đầu kỳ (import Excel)').input('NguoiTaoID', sql.Int, nguoiTaoId)
        .query(`INSERT INTO PhieuPhuKien (Ngay, LoaiPhieu, NCC_ID, SoHoaDon, GhiChu, NguoiTaoID)
                OUTPUT INSERTED.PhieuID VALUES (@Ngay, @LoaiPhieu, @NCC_ID, @SoHoaDon, @GhiChu, @NguoiTaoID)`);
      phieuId = phieuRes.recordset[0].PhieuID;
    }
    bump('PhieuPhuKien (Nhập): tạo mới (gộp theo Ngày+NCC+Số hóa đơn)');

    for (const row of g.rows) {
      if (!dryRun) {
        await pool.request()
          .input('PhieuID', sql.Int, phieuId).input('PhuKienID', sql.Int, row.phuKienId)
          .input('SoLuong', sql.Decimal(14, 2), row.soLuong).input('DonVi', sql.NVarChar, row.donVi)
          .input('GhiChu', sql.NVarChar, row.ghiChu)
          .query(`INSERT INTO PhieuPhuKienChiTiet (PhieuID, PhuKienID, SoLuong, DonVi, GhiChu)
                  VALUES (@PhieuID, @PhuKienID, @SoLuong, @DonVi, @GhiChu)`);
      }
      bump('PhieuPhuKienChiTiet: dòng tồn kho ban đầu tạo mới');
    }
  }
}

async function main() {
  console.log(dryRun ? '=== CHẠY THỬ (--dry-run) — KHÔNG ghi vào database ===' : '=== CHẠY THẬT — sẽ ghi vào database ===');
  const wb = XLSX.readFile(filePath);
  const pool = await getPool();

  let nguoiTaoId = null;
  const userRes = await pool.request().input('u', sql.NVarChar, userName).query('SELECT UserID FROM Users WHERE Username=@u');
  if (userRes.recordset.length) nguoiTaoId = userRes.recordset[0].UserID;
  else console.warn(`Không tìm thấy user "${userName}", các phiếu tạo ra sẽ để trống Người tạo.`);

  await importLoaiVai(pool, sheetRows(wb, 'LoaiVai'));
  await importMauSac(pool, sheetRows(wb, 'MauSac'));
  await importNhaCungCap(pool, sheetRows(wb, 'NhaCungCap'));
  await importDanhMucVai(pool, sheetRows(wb, 'DanhMucVai'));
  await importTonKhoVai(pool, sheetRows(wb, 'TonKhoVai'), nguoiTaoId);
  await importLoaiPhuKien(pool, sheetRows(wb, 'LoaiPhuKien'));
  await importDanhMucPhuKien(pool, sheetRows(wb, 'DanhMucPhuKien'));
  await importTonKhoPhuKien(pool, sheetRows(wb, 'TonKhoPhuKien'), nguoiTaoId);

  console.log('\n--- TỔNG KẾT ---');
  Object.entries(summary).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  if (warnings.length) {
    console.log(`\n--- CẢNH BÁO (${warnings.length}) ---`);
    warnings.forEach(w => console.warn('  ' + w));
  }
  if (errors.length) {
    console.log(`\n--- LỖI (${errors.length}) — các dòng này đã bị BỎ QUA, không được nạp ---`);
    errors.forEach(e => console.error('  ' + e));
  }
  console.log(dryRun
    ? '\nĐây là kết quả CHẠY THỬ. Sửa hết lỗi ở trên rồi chạy lại không có --dry-run để ghi thật vào database.'
    : '\nHoàn tất import.');
  process.exit(errors.length ? 1 : 0);
}

main().catch(err => { console.error('Lỗi không xử lý được:', err); process.exit(1); });
