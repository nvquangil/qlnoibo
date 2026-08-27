// ================================================================
// PHAN HE TINH LUONG (PAYROLL) - v6.1 Phase 2
// ----------------------------------------------------------------
// Phase 2: Cau hinh luong (hang so, bieu thue, cong chuan), Cham cong (ket noi may
// cham cong IP/Port + tong hop + sua tay), Bang luong CONG NHAT (tinh theo dung cong
// thuc BANG LUONG cua file luong.xlsm, config-driven), xuat Excel + file chuyen khoan CK.
// Cac mo hinh luong khac (khoan may / gia cong / in theu) o Phase 3-4.
// ================================================================
const express = require('express');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage() });   // v5.37: import file chấm công (fallback khi máy không kéo được)

const router = express.Router();
const nn = (v) => (v === '' || v === undefined ? null : v);

// Bo dau tieng Viet (dung cho ten nguoi nhan trong file CK - ngan hang yeu cau khong dau).
function khongDau(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}
const round0 = (x) => Math.round(Number(x) || 0);

async function getConfig(pool) {
  const r = (await pool.request().query('SELECT * FROM CauHinhLuong WHERE ID=1')).recordset[0];
  return r || {};
}
async function getCongChuan(pool, nam, thang) {
  const r = (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang)
    .query('SELECT SoNgayCong FROM CongChuanThang WHERE Nam=@n AND Thang=@t')).recordset[0];
  return r ? Number(r.SoNgayCong) : 26;   // fallback 26 neu chua khai bao
}
async function getBrackets(pool) {
  return (await pool.request().query('SELECT * FROM BacThueTNCN ORDER BY Bac')).recordset;
}
// Thue TNCN theo bieu bac (MAX-of-lines: thue = TNtinhthue*suat - trudi, khong am).
function calcThueTNCN(tn, brackets) {
  if (tn <= 0 || !brackets.length) return 0;
  const b = brackets.find(x => tn > Number(x.TuMuc) && (x.DenMuc == null || tn <= Number(x.DenMuc))) || brackets[brackets.length - 1];
  return Math.max(0, round0(tn * Number(b.ThueSuat) - Number(b.TruDi)));
}

/* ================================================================
   1. CAU HINH LUONG
   ================================================================ */
router.get('/config', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'cauhinh'), async (req, res) => {
  try {
    const pool = await getPool();
    const cauHinh = await getConfig(pool);
    const bacThue = await getBrackets(pool);
    const nam = parseInt(req.query.nam, 10) || new Date().getFullYear();
    const congChuan = (await pool.request().input('n', sql.Int, nam)
      .query('SELECT Nam, Thang, SoNgayCong FROM CongChuanThang WHERE Nam=@n ORDER BY Thang')).recordset;
    res.json({ success: true, data: { cauHinh, bacThue, congChuan, nam } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

router.put('/config', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'cauhinh'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body;
    const dec = (v, d) => (nn(v) == null ? d : Number(v));
    await pool.request()
      .input('BhxhNld', sql.Decimal(5, 2), dec(b.bhxhNld, 8)).input('BhytNld', sql.Decimal(5, 2), dec(b.bhytNld, 1.5)).input('BhtnNld', sql.Decimal(5, 2), dec(b.bhtnNld, 1))
      .input('BhxhDn', sql.Decimal(5, 2), dec(b.bhxhDn, 17.5)).input('BhytDn', sql.Decimal(5, 2), dec(b.bhytDn, 3)).input('BhtnDn', sql.Decimal(5, 2), dec(b.bhtnDn, 1))
      .input('GiamTruBanThan', sql.Decimal(14, 2), dec(b.giamTruBanThan, 15500000)).input('GiamTruNPT', sql.Decimal(14, 2), dec(b.giamTruNPT, 6200000))
      .input('GioChuanNgay', sql.Decimal(4, 1), dec(b.gioChuanNgay, 8))
      .input('HsTangCaThuong', sql.Decimal(4, 2), dec(b.hsTangCaThuong, 1.5)).input('HsTangCaChuNhat', sql.Decimal(4, 2), dec(b.hsTangCaChuNhat, 2)).input('HsTangCaLeTet', sql.Decimal(4, 2), dec(b.hsTangCaLeTet, 3))
      .input('PcCaDem', sql.Decimal(4, 2), dec(b.pcCaDem, 0.3)).input('PcTangCaDem', sql.Decimal(4, 2), dec(b.pcTangCaDem, 0.2))
      .input('NgayTraLuong', sql.Int, dec(b.ngayTraLuong, 10))
      .query(`UPDATE CauHinhLuong SET BhxhNld=@BhxhNld,BhytNld=@BhytNld,BhtnNld=@BhtnNld,BhxhDn=@BhxhDn,BhytDn=@BhytDn,BhtnDn=@BhtnDn,
        GiamTruBanThan=@GiamTruBanThan,GiamTruNPT=@GiamTruNPT,GioChuanNgay=@GioChuanNgay,HsTangCaThuong=@HsTangCaThuong,
        HsTangCaChuNhat=@HsTangCaChuNhat,HsTangCaLeTet=@HsTangCaLeTet,PcCaDem=@PcCaDem,PcTangCaDem=@PcTangCaDem,
        NgayTraLuong=@NgayTraLuong,UpdatedAt=SYSDATETIME() WHERE ID=1`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

// Cap nhat bieu thue TNCN (thay toan bo 5 bac).
router.put('/config/bacthue', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'cauhinh'), async (req, res) => {
  try {
    const pool = await getPool();
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    await pool.request().query('DELETE FROM BacThueTNCN');
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      await pool.request().input('Bac', sql.Int, i + 1)
        .input('TuMuc', sql.Decimal(14, 2), Number(r.tuMuc) || 0)
        .input('DenMuc', sql.Decimal(14, 2), nn(r.denMuc) == null ? null : Number(r.denMuc))
        .input('ThueSuat', sql.Decimal(6, 4), Number(r.thueSuat) || 0)
        .input('TruDi', sql.Decimal(14, 2), Number(r.truDi) || 0)
        .query('INSERT INTO BacThueTNCN (Bac,TuMuc,DenMuc,ThueSuat,TruDi) VALUES (@Bac,@TuMuc,@DenMuc,@ThueSuat,@TruDi)');
    }
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

// Upsert cong chuan 1 thang.
router.put('/config/congchuan', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'cauhinh'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body;
    await pool.request().input('Nam', sql.Int, b.nam).input('Thang', sql.Int, b.thang).input('So', sql.Decimal(4, 1), Number(b.soNgayCong) || 26)
      .query(`MERGE CongChuanThang AS t USING (SELECT @Nam AS Nam,@Thang AS Thang) AS s ON t.Nam=s.Nam AND t.Thang=s.Thang
        WHEN MATCHED THEN UPDATE SET SoNgayCong=@So WHEN NOT MATCHED THEN INSERT (Nam,Thang,SoNgayCong) VALUES (@Nam,@Thang,@So);`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

/* ================================================================
   2. MAY CHAM CONG (ket noi IP/Port)
   ================================================================ */
router.get('/maychamcong', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const rows = (await pool.request().query('SELECT * FROM MayChamCong ORDER BY MayChamCongID')).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

function bindMay(reqDb, b) {
  // v5.59: Hikvision (ISAPI) mặc định cổng 80 + cần tài khoản/mật khẩu của máy; ZKTeco vẫn 4370.
  const giaoThuc = nn(b.loaiGiaoThuc) || 'ZKTeco';
  const portMacDinh = giaoThuc === 'Hikvision' ? 80 : 4370;
  reqDb.input('TenMay', sql.NVarChar, nn(b.tenMay))
    .input('DiaChiIP', sql.NVarChar, nn(b.diaChiIP))
    .input('Port', sql.Int, nn(b.port) || portMacDinh)
    .input('LoaiGiaoThuc', sql.NVarChar, giaoThuc)
    .input('ViTri', sql.NVarChar, nn(b.viTri))
    .input('TrangThai', sql.NVarChar, nn(b.trangThai) || 'Hoạt động')
    .input('GhiChu', sql.NVarChar, nn(b.ghiChu))
    .input('TenDangNhap', sql.NVarChar, nn(b.tenDangNhap))
    .input('MatKhau', sql.NVarChar, nn(b.matKhau))
    .input('DungHTTPS', sql.Bit, b.dungHTTPS ? 1 : 0);
}
router.post('/maychamcong', requireAuth, requirePermission('PAYROLL', 'create'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    if (!nn(req.body.tenMay) || !nn(req.body.diaChiIP)) return res.status(400).json({ success: false, message: 'Thiếu Tên máy hoặc Địa chỉ IP.' });
    const reqDb = pool.request(); bindMay(reqDb, req.body);
    const r = await reqDb.query(`INSERT INTO MayChamCong (TenMay,DiaChiIP,Port,LoaiGiaoThuc,ViTri,TrangThai,GhiChu,TenDangNhap,MatKhau,DungHTTPS)
      OUTPUT INSERTED.MayChamCongID VALUES (@TenMay,@DiaChiIP,@Port,@LoaiGiaoThuc,@ViTri,@TrangThai,@GhiChu,@TenDangNhap,@MatKhau,@DungHTTPS)`);
    res.json({ success: true, data: { MayChamCongID: r.recordset[0].MayChamCongID } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});
router.put('/maychamcong/:id', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const reqDb = pool.request().input('id', sql.Int, parseInt(req.params.id, 10)); bindMay(reqDb, req.body);
    // MatKhau: để TRỐNG khi sửa = GIỮ NGUYÊN mật khẩu cũ (không bắt gõ lại mỗi lần sửa máy).
    await reqDb.query(`UPDATE MayChamCong SET TenMay=@TenMay,DiaChiIP=@DiaChiIP,Port=@Port,LoaiGiaoThuc=@LoaiGiaoThuc,
      ViTri=@ViTri,TrangThai=@TrangThai,GhiChu=@GhiChu,TenDangNhap=@TenDangNhap,
      MatKhau=ISNULL(@MatKhau, MatKhau), DungHTTPS=@DungHTTPS WHERE MayChamCongID=@id`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});
router.delete('/maychamcong/:id', requireAuth, requirePermission('PAYROLL', 'delete'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.Int, parseInt(req.params.id, 10)).query('DELETE FROM MayChamCong WHERE MayChamCongID=@id');
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

/* v5.59: LƯU PUNCH DÙNG CHUNG cho MỌI loại máy (ZKTeco / Hikvision).
   Nhận mảng { deviceId, when } đã chuẩn hoá; lọc theo khoảng ngày + 1 mã; chống trùng bằng
   NOT EXISTS (MayChamCongID, MaChamMay, ThoiGian). Trả về đúng shape mà giao diện đang dùng. */
// v5.60.1: đổi Date -> chuỗi 'YYYY-MM-DD HH:mm:ss' theo ĐỒNG HỒ ĐỊA PHƯƠNG (không qua UTC).
function chuoiThoiGianCucBo(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
async function luuPunches(pool, may, records, { tuNgay, denNgay, loMa }) {
  const map = new Map();
  (await pool.request().query(`SELECT NhanVienID, MaChamCong FROM NhanVien WHERE MaChamCong IS NOT NULL AND MaChamCong <> ''`)).recordset
    .forEach(r => map.set(String(r.MaChamCong).trim(), r.NhanVienID));
  let inserted = 0, filtered = 0, matched = 0, unmatched = 0;
  for (const r of records) {
    const deviceId = String(r.deviceId || '').trim();
    const when = r.when;
    if (!deviceId || !when || isNaN(when.getTime())) continue;
    if (loMa && deviceId !== loMa) continue;
    if (tuNgay && when < tuNgay) continue;
    if (denNgay && when > denNgay) continue;
    filtered++;
    const nvId = map.get(deviceId) || null;
    if (nvId) matched++; else unmatched++;
    /* v5.60.1 SỬA LỆCH 7 TIẾNG: trước đây bind sql.DateTime2 với 1 đối tượng Date -> driver mssql
       quy đổi sang UTC nên 08:40 trên máy chấm công lưu thành 01:40 => tính công/tăng ca SAI.
       Nay ghi bằng CHUỖI giờ địa phương (whenStr do máy trả, hoặc suy từ Date) -> SQL Server nhận
       đúng nguyên văn, không đổi múi giờ. */
    const thoiGianStr = r.whenStr || chuoiThoiGianCucBo(when);
    const q = await pool.request()
      .input('MayChamCongID', sql.Int, may.MayChamCongID).input('MaChamMay', sql.NVarChar, deviceId)
      .input('NhanVienID', sql.Int, nvId).input('ThoiGian', sql.NVarChar, thoiGianStr)
      .query(`INSERT INTO ChamCongRaw (MayChamCongID,MaChamMay,NhanVienID,ThoiGian,Nguon)
        SELECT @MayChamCongID,@MaChamMay,@NhanVienID,CAST(@ThoiGian AS DATETIME2),N'May'
        WHERE NOT EXISTS (SELECT 1 FROM ChamCongRaw c WHERE c.MayChamCongID=@MayChamCongID AND c.MaChamMay=@MaChamMay AND c.ThoiGian=CAST(@ThoiGian AS DATETIME2))`);
    inserted += q.rowsAffected[0];
  }
  await pool.request().input('id', sql.Int, may.MayChamCongID).query('UPDATE MayChamCong SET LanDongBoCuoi=SYSDATETIME() WHERE MayChamCongID=@id');
  return { total: records.length, filtered, inserted, matched, unmatched };
}

// KEO DU LIEU tu may cham cong qua IP/Port. Ho tro 2 giao thuc:
//   - ZKTeco   : node-zklib, cong 4370 (lazy-require de thieu thu vien khong lam hong tab khac)
//   - Hikvision: ISAPI qua HTTP + Digest, cong 80 (backend/utils/hikvision.js, KHONG can cai them gi)
router.post('/maychamcong/:id/keodulieu', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const may = (await pool.request().input('id', sql.Int, parseInt(req.params.id, 10)).query('SELECT * FROM MayChamCong WHERE MayChamCongID=@id')).recordset[0];
    if (!may) return res.status(404).json({ success: false, message: 'Không tìm thấy máy chấm công.' });
    // v5.37: lọc theo khoảng thời gian tự chọn + theo 1 mã chấm công (rỗng = tất cả).
    const b = req.body || {};
    const tuNgay = b.tuNgay ? new Date(b.tuNgay + 'T00:00:00') : null;
    const denNgay = b.denNgay ? new Date(b.denNgay + 'T23:59:59') : null;
    const loMa = b.maChamCong ? String(b.maChamCong).trim() : null;

    // ---- Nhánh HIKVISION (ISAPI) ----
    if (String(may.LoaiGiaoThuc || '') === 'Hikvision') {
      const hik = require('../utils/hikvision');
      let records;
      try {
        records = await hik.layLichSuChamCong(may, { tuNgay, denNgay });
      } catch (err) {
        console.error('[chamcong-hik] ', err.message);
        return res.status(500).json({ success: false, message: err.message });
      }
      const data = await luuPunches(pool, may, records, { tuNgay, denNgay, loMa });
      return res.json({ success: true, data });
    }

    // ---- Nhánh ZKTECO (mặc định, giữ nguyên như cũ) ----
    let ZKLib;
    try { ZKLib = require('node-zklib'); }
    catch (e) { return res.status(500).json({ success: false, message: 'Máy chủ chưa cài thư viện kết nối máy chấm công. Chạy: npm install node-zklib rồi thử lại.' }); }
    const zk = new ZKLib(may.DiaChiIP, may.Port || 4370, 10000, 4000);
    try {
      await zk.createSocket();
      const att = await zk.getAttendances();
      try { await zk.disconnect(); } catch (_) { }
      const records = ((att && att.data) || []).map(r => ({
        deviceId: String(r.deviceUserId != null ? r.deviceUserId : (r.userId != null ? r.userId : (r.uid != null ? r.uid : ''))).trim(),
        when: r.recordTime ? new Date(r.recordTime) : (r.timestamp ? new Date(r.timestamp) : null)
      }));
      const data = await luuPunches(pool, may, records, { tuNgay, denNgay, loMa });
      res.json({ success: true, data });
    } catch (err) {
      try { await zk.disconnect(); } catch (_) { }
      console.error('[chamcong] ', err.message);
      res.status(500).json({ success: false, message: 'Không kết nối được máy chấm công (' + may.DiaChiIP + ':' + (may.Port || 4370) + '): ' + err.message });
    }
  } catch (err) {   // v5.59: bọc ngoài — route async lỗi mà không bắt sẽ làm SẬP tiến trình (Express 4 + Node >=15)
    console.error('[chamcong] ', err);
    res.status(500).json({ success: false, message: 'Lỗi kéo dữ liệu chấm công: ' + err.message });
  }
});

// v5.59: KIỂM TRA KẾT NỐI nhanh (chỉ Hikvision — ZKTeco dùng luôn nút "Tải NV từ máy").
router.post('/maychamcong/:id/test', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const may = (await pool.request().input('id', sql.Int, parseInt(req.params.id, 10)).query('SELECT * FROM MayChamCong WHERE MayChamCongID=@id')).recordset[0];
    if (!may) return res.status(404).json({ success: false, message: 'Không tìm thấy máy chấm công.' });
    if (String(may.LoaiGiaoThuc || '') !== 'Hikvision') {
      return res.status(400).json({ success: false, message: 'Nút kiểm tra này dành cho máy Hikvision. Với máy ZKTeco hãy bấm "Tải NV từ máy".' });
    }
    const hik = require('../utils/hikvision');
    const r = await hik.kiemTraKetNoi(may);
    res.json({ success: true, data: r });
  } catch (err) {
    console.error('[chamcong-test] ', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// v5.37: "Tải nhân viên từ máy" (getUsers) - lấy danh sách người đã đăng ký trên máy để MAP sang NhanVien.
router.post('/maychamcong/:id/nhanvien-tumay', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  const pool = await getPool();
  const may = (await pool.request().input('id', sql.Int, parseInt(req.params.id, 10)).query('SELECT * FROM MayChamCong WHERE MayChamCongID=@id')).recordset[0];
  if (!may) return res.status(404).json({ success: false, message: 'Không tìm thấy máy chấm công.' });
  // v5.59: máy Hikvision lấy danh sách qua ISAPI (UserInfo/Search) — trả cùng shape {enrollId, ten}.
  if (String(may.LoaiGiaoThuc || '') === 'Hikvision') {
    try {
      const hik = require('../utils/hikvision');
      const ds = await hik.layDanhSachNhanVien(may);
      return res.json({ success: true, data: ds.map(x => ({ enrollId: x.maChamCong, ten: x.tenTrenMay })) });
    } catch (err) {
      console.error('[chamcong-hik getUsers] ', err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  let ZKLib; try { ZKLib = require('node-zklib'); } catch (e) { return res.status(500).json({ success: false, message: 'Máy chủ chưa cài node-zklib. Chạy: npm install node-zklib.' }); }
  const zk = new ZKLib(may.DiaChiIP, may.Port || 4370, 10000, 4000);
  try {
    await zk.createSocket();
    const u = await zk.getUsers();
    try { await zk.disconnect(); } catch (_) { }
    const list = ((u && u.data) || []).map(x => ({ enrollId: String(x.userId != null ? x.userId : (x.uid != null ? x.uid : '')).trim(), ten: x.name || '' })).filter(x => x.enrollId);
    res.json({ success: true, data: list });
  } catch (err) {
    try { await zk.disconnect(); } catch (_) { }
    console.error('[chamcong getUsers] ', err.message);
    res.status(500).json({ success: false, message: 'Không lấy được nhân viên từ máy (' + may.DiaChiIP + ':' + (may.Port || 4370) + '): ' + err.message });
  }
});
// Lưu map enroll-id (máy) -> NhanVien.MaChamCong. body {maps:[{nhanVienId, maChamCong}]}. Đây là phần khắc phục
// lỗi "kéo được nhưng không map ai" - trước đây NhanVien.MaChamCong không có đường ghi.
router.post('/maychamcong/mapnhanvien', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const maps = Array.isArray(req.body.maps) ? req.body.maps : [];
    let n = 0;
    let backfilled = 0;
    for (const m of maps) {
      if (!m.nhanVienId) continue;
      const maNorm = m.maChamCong != null && String(m.maChamCong).trim() !== '' ? String(m.maChamCong).trim() : null;
      await pool.request().input('nv', sql.Int, m.nhanVienId).input('ma', sql.NVarChar, maNorm)
        .query('UPDATE NhanVien SET MaChamCong=@ma WHERE NhanVienID=@nv');
      // v5.37.1: gán LẠI các bản ghi ĐÃ KÉO trước đó (NhanVienID null) theo mã này → dùng được ngay, không phải kéo lại.
      if (maNorm) {
        const q = await pool.request().input('nv', sql.Int, m.nhanVienId).input('ma', sql.NVarChar, maNorm)
          .query('UPDATE ChamCongRaw SET NhanVienID=@nv WHERE MaChamMay=@ma AND (NhanVienID IS NULL OR NhanVienID <> @nv)');
        backfilled += q.rowsAffected[0];
      }
      n++;
    }
    res.json({ success: true, data: { updated: n, backfilled } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});
// v5.37.1: danh sách MÃ chấm công ĐÃ KÉO VỀ (distinct từ ChamCongRaw) + số lần + khoảng ngày + NV đang gán -
// để HIỂN THỊ kiểm tra + gán (không phụ thuộc getUsers - nhiều máy trả rỗng).
router.get('/maychamcong/:id/machamcong-list', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  const pool = await getPool();
  const rows = (await pool.request().input('id', sql.Int, parseInt(req.params.id, 10)).query(`
    SELECT r.MaChamMay, COUNT(*) AS SoLan, MIN(r.ThoiGian) AS TuNgay, MAX(r.ThoiGian) AS DenNgay,
           MAX(nvm.NhanVienID) AS NhanVienID, MAX(nvm.HoTen) AS HoTen
    FROM ChamCongRaw r
    LEFT JOIN NhanVien nvm ON nvm.MaChamCong = r.MaChamMay
    WHERE r.MayChamCongID = @id
    GROUP BY r.MaChamMay
    ORDER BY COUNT(*) DESC`)).recordset;
  res.json({ success: true, data: rows });
});
// v5.37.2: chi tiết chấm công ĐÃ KÉO theo tháng - mỗi NV (hoặc mã chưa gán) / mỗi ngày: giờ VÀO (min) / giờ RA (max) / số lần.
router.get('/chamcong/chitiet', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10) || new Date().getFullYear();
    const thang = parseInt(req.query.thang, 10) || (new Date().getMonth() + 1);
    const rows = (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang).query(`
      SELECT CAST(r.ThoiGian AS DATE) AS Ngay, r.MaChamMay, nv.MaNhanVien, nv.HoTen,
             CONVERT(varchar(5), MIN(r.ThoiGian), 108) AS GioVao,
             CONVERT(varchar(5), MAX(r.ThoiGian), 108) AS GioRa, COUNT(*) AS SoLan
      FROM ChamCongRaw r
      LEFT JOIN NhanVien nv ON nv.NhanVienID = r.NhanVienID
      WHERE YEAR(r.ThoiGian) = @n AND MONTH(r.ThoiGian) = @t
      GROUP BY CAST(r.ThoiGian AS DATE), r.MaChamMay, nv.MaNhanVien, nv.HoTen
      ORDER BY CAST(r.ThoiGian AS DATE) DESC, nv.HoTen`)).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});
// v5.37: "Tải lên" file chấm công (Excel) - fallback khi máy không kéo được. Cột: MaChamCong | ThoiGian.
router.post('/chamcong/import', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'chamcong'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Chưa chọn file.' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const pool = await getPool();
    const map = new Map();
    (await pool.request().query(`SELECT NhanVienID, MaChamCong FROM NhanVien WHERE MaChamCong IS NOT NULL AND MaChamCong <> ''`)).recordset
      .forEach(r => map.set(String(r.MaChamCong).trim(), r.NhanVienID));
    let inserted = 0, skipped = 0;
    for (const r of rows) {
      const deviceId = String(r.MaChamCong != null ? r.MaChamCong : (r['Mã chấm công'] != null ? r['Mã chấm công'] : '')).trim();
      const rawT = r.ThoiGian != null && r.ThoiGian !== '' ? r.ThoiGian : (r['Thời gian'] != null ? r['Thời gian'] : '');
      const when = rawT instanceof Date ? rawT : (rawT ? new Date(rawT) : null);
      if (!deviceId || !when || isNaN(when.getTime())) { skipped++; continue; }
      const nvId = map.get(deviceId) || null;
      // v5.60.1: ghi bằng chuỗi giờ địa phương (giống nhánh kéo từ máy) — tránh lệch 7 tiếng do quy đổi UTC.
      const q = await pool.request().input('MaChamMay', sql.NVarChar, deviceId).input('NhanVienID', sql.Int, nvId)
        .input('ThoiGian', sql.NVarChar, chuoiThoiGianCucBo(when))
        .query(`INSERT INTO ChamCongRaw (MayChamCongID,MaChamMay,NhanVienID,ThoiGian,Nguon)
          SELECT NULL,@MaChamMay,@NhanVienID,CAST(@ThoiGian AS DATETIME2),N'Import'
          WHERE NOT EXISTS (SELECT 1 FROM ChamCongRaw c WHERE c.MaChamMay=@MaChamMay AND c.ThoiGian=CAST(@ThoiGian AS DATETIME2) AND c.Nguon=N'Import')`);
      inserted += q.rowsAffected[0];
    }
    res.json({ success: true, data: { total: rows.length, inserted, skipped } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi import: ' + err.message }); }
});
// v5.38: file mẫu Excel để điền chấm công rồi tải lên (cột Mã chấm công, Thời gian).
router.get('/chamcong/template', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'chamcong'), (req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([['Mã chấm công', 'Thời gian'], ['5', '2026-07-01 07:55'], ['5', '2026-07-01 17:05']]);
  XLSX.utils.book_append_sheet(wb, ws, 'ChamCong');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="Mau_ChamCong.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

/* ================================================================================================
   3. CHAM CONG NGAY — CAI DAT + TONG HOP THEO GIO VAO/RA/TANG CA (v5.60)
   ================================================================================================ */
const CC_KEY = 'CHAM_CONG';
const CC_DEFAULT = {
  gioVao: '08:00',            // giờ vào chuẩn
  gioRa: '17:00',             // giờ ra chuẩn
  nghiTruaTu: '12:00',        // nghỉ trưa (trừ khỏi giờ làm) — để trống 2 ô này = không trừ
  nghiTruaDen: '13:00',
  soGioMotCong: 8,            // làm đủ bao nhiêu giờ = 1 công
  // v5.60.1: MẶC ĐỊNH = 0 (chia ĐÚNG theo giờ, vd 7.33/8 = 0.92 công). Trước đây mặc định 0.5 làm
  // người làm 7.33 giờ chỉ được 0.5 công — sai tinh thần "chia ra số tiếng nếu không đủ 1 công".
  lamTronCong: 0,             // 0 = không làm tròn; 0.25 / 0.5 = làm tròn xuống theo mức đó
  toiThieuTinhCongPhut: 30,   // làm dưới mức này thì tính 0 công
  otBatDauSauPhut: 30,        // chỉ tính tăng ca khi làm quá giờ ra ít nhất bấy nhiêu phút
  otLamTronGio: 0.5,          // làm tròn xuống tăng ca theo 0.5 giờ
  otToiDaGioNgay: 6,          // chặn trên, tránh 1 lần quét sai làm tăng ca vô lý
  tinhOtTruocGioVao: false,   // có tính tăng ca phần đến sớm trước giờ vào không
  ngayLe: []                  // ['2026-09-02', ...] -> giờ ngoài giờ chuẩn tính vào cột LỄ/TẾT
};
async function getCauHinhChamCong(pool) {
  try {
    const r = (await pool.request().input('k', sql.NVarChar, CC_KEY)
      .query('SELECT GiaTri FROM CauHinh WHERE Khoa=@k')).recordset[0];
    const saved = r && r.GiaTri ? JSON.parse(r.GiaTri) : {};
    const cfg = Object.assign({}, CC_DEFAULT, saved);
    if (!Array.isArray(cfg.ngayLe)) cfg.ngayLe = [];
    return cfg;
  } catch (e) { return Object.assign({}, CC_DEFAULT); }
}
// 'HH:mm' -> số phút từ 0h. Trả null nếu rỗng/không hợp lệ.
function phutTuGio(s) {
  if (s == null || s === '') return null;
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]), p = Number(m[2]);
  if (isNaN(h) || isNaN(p)) return null;
  return h * 60 + p;
}
const phanGiao = (a1, a2, b1, b2) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));   // phút giao nhau
const lamTronXuong = (v, buoc) => (buoc > 0 ? Math.floor(v / buoc) * buoc : v);

/* TÍNH CÔNG 1 NGÀY từ giờ vào/ra thực tế.
   - Công: chỉ tính phần giờ NẰM TRONG khung chuẩn (gioVao→gioRa), TRỪ nghỉ trưa.
     Đủ soGioMotCong = 1 công; thiếu thì chia theo tỉ lệ giờ (làm tròn xuống theo lamTronCong).
   - Tăng ca: phần làm SAU giờ ra (và trước giờ vào nếu bật), phải vượt ngưỡng otBatDauSauPhut.
     Ngày Lễ -> cột LeTet; Chủ nhật -> ChuNhat; còn lại -> Thuong.
   Trả { soCong, soGioLam, otThuong, otChuNhat, otLeTet, maCham }. */
function tinhCongMotNgay(cfg, ngayStr, gioVaoStr, gioRaStr) {
  const vao = phutTuGio(gioVaoStr), ra = phutTuGio(gioRaStr);
  const kq = { soCong: 0, soGioLam: 0, otThuong: 0, otChuNhat: 0, otLeTet: 0, maCham: 'KL' };
  if (vao == null || ra == null || ra <= vao) {
    // Chỉ có 1 lần quét (vào = ra) -> KHÔNG đủ căn cứ tính công, để 0 và đánh dấu để người dùng sửa tay.
    kq.maCham = (vao != null) ? 'x?' : 'KL';
    return kq;
  }
  const cVao = phutTuGio(cfg.gioVao) != null ? phutTuGio(cfg.gioVao) : 480;
  const cRa = phutTuGio(cfg.gioRa) != null ? phutTuGio(cfg.gioRa) : 1020;
  const tTu = phutTuGio(cfg.nghiTruaTu), tDen = phutTuGio(cfg.nghiTruaDen);

  // ---- giờ làm trong khung chuẩn ----
  let phutChuan = phanGiao(vao, ra, cVao, cRa);
  if (tTu != null && tDen != null && tDen > tTu) {
    phutChuan -= phanGiao(Math.max(vao, cVao), Math.min(ra, cRa), tTu, tDen);
  }
  phutChuan = Math.max(0, phutChuan);
  kq.soGioLam = Math.round((phutChuan / 60) * 100) / 100;

  const soGioMotCong = Number(cfg.soGioMotCong) > 0 ? Number(cfg.soGioMotCong) : 8;
  if (phutChuan < (Number(cfg.toiThieuTinhCongPhut) || 0)) {
    kq.soCong = 0;
  } else if (phutChuan / 60 >= soGioMotCong) {
    kq.soCong = 1;
  } else {
    const tho = (phutChuan / 60) / soGioMotCong;                       // vd 4h/8h = 0.5 công
    const buoc = Number(cfg.lamTronCong) || 0;
    kq.soCong = buoc > 0 ? lamTronXuong(tho, buoc) : Math.round(tho * 100) / 100;
  }

  // ---- tăng ca ----
  const nguong = Number(cfg.otBatDauSauPhut) || 0;
  let otPhut = 0;
  const sau = Math.max(0, ra - cRa);
  if (sau >= nguong) otPhut += sau;
  if (cfg.tinhOtTruocGioVao) {
    const truoc = Math.max(0, cVao - vao);
    if (truoc >= nguong) otPhut += truoc;
  }
  let otGio = lamTronXuong(otPhut / 60, Number(cfg.otLamTronGio) || 0);
  const capOt = Number(cfg.otToiDaGioNgay) > 0 ? Number(cfg.otToiDaGioNgay) : 24;
  otGio = Math.min(otGio, capOt);
  otGio = Math.round(otGio * 100) / 100;

  if (otGio > 0) {
    const laLe = (cfg.ngayLe || []).map(String).indexOf(String(ngayStr).slice(0, 10)) !== -1;
    const thu = new Date(String(ngayStr).slice(0, 10) + 'T00:00:00').getDay();   // 0 = Chủ nhật
    if (laLe) kq.otLeTet = otGio;
    else if (thu === 0) kq.otChuNhat = otGio;
    else kq.otThuong = otGio;
  }
  if (kq.soCong >= 1) kq.maCham = 'x';
  else if (kq.soCong > 0) kq.maCham = 'x';
  else if (otGio > 0) kq.maCham = 'x';
  return kq;
}

// XEM/LƯU cài đặt chấm công
router.get('/chamcong/cauhinh', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    res.json({ success: true, data: await getCauHinhChamCong(pool) });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});
router.post('/chamcong/cauhinh', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body || {};
    const soDuong = (v, mac) => { const n = Number(v); return isNaN(n) || n < 0 ? mac : n; };
    const gio = (v, mac) => (phutTuGio(v) != null ? String(v).trim().slice(0, 5) : mac);
    const cfg = {
      gioVao: gio(b.gioVao, CC_DEFAULT.gioVao),
      gioRa: gio(b.gioRa, CC_DEFAULT.gioRa),
      nghiTruaTu: b.nghiTruaTu === '' ? '' : gio(b.nghiTruaTu, CC_DEFAULT.nghiTruaTu),
      nghiTruaDen: b.nghiTruaDen === '' ? '' : gio(b.nghiTruaDen, CC_DEFAULT.nghiTruaDen),
      soGioMotCong: soDuong(b.soGioMotCong, 8) || 8,
      lamTronCong: soDuong(b.lamTronCong, 0.5),
      toiThieuTinhCongPhut: soDuong(b.toiThieuTinhCongPhut, 30),
      otBatDauSauPhut: soDuong(b.otBatDauSauPhut, 30),
      otLamTronGio: soDuong(b.otLamTronGio, 0.5),
      otToiDaGioNgay: soDuong(b.otToiDaGioNgay, 6),
      tinhOtTruocGioVao: !!b.tinhOtTruocGioVao,
      ngayLe: Array.isArray(b.ngayLe) ? b.ngayLe.map(x => String(x).slice(0, 10)).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)) : []
    };
    if (phutTuGio(cfg.gioRa) <= phutTuGio(cfg.gioVao)) {
      return res.status(400).json({ success: false, message: 'Giờ ra phải sau giờ vào.' });
    }
    const json = JSON.stringify(cfg);
    const up = await pool.request().input('k', sql.NVarChar, CC_KEY).input('v', sql.NVarChar(sql.MAX), json)
      .query('UPDATE CauHinh SET GiaTri=@v, UpdatedAt=SYSDATETIME() WHERE Khoa=@k');
    if (!up.rowsAffected[0]) {
      await pool.request().input('k', sql.NVarChar, CC_KEY).input('v', sql.NVarChar(sql.MAX), json)
        .query('INSERT INTO CauHinh (Khoa, GiaTri, UpdatedAt) VALUES (@k, @v, SYSDATETIME())');
    }
    res.json({ success: true, data: cfg });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

// Tong hop punch tho -> cham cong ngay cho 1 thang. v5.60: tinh SO CONG + TANG CA theo CAI DAT
// (truoc day co punch la 1 cong, khong biet lam it gio hay tang ca).
// KHONG ghi de dong da sua tay (Nguon='ThuCong').
router.post('/chamcong/tonghop', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.body.nam, 10), thang = parseInt(req.body.thang, 10);
    const cfg = await getCauHinhChamCong(pool);
    const agg = (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang).query(`
      SELECT NhanVienID, CAST(ThoiGian AS DATE) AS Ngay,
             CONVERT(varchar(5), MIN(ThoiGian), 108) AS GioVao,
             CONVERT(varchar(5), MAX(ThoiGian), 108) AS GioRa,
             COUNT(*) AS SoLan
      FROM ChamCongRaw
      WHERE NhanVienID IS NOT NULL AND YEAR(ThoiGian)=@n AND MONTH(ThoiGian)=@t
      GROUP BY NhanVienID, CAST(ThoiGian AS DATE)`)).recordset;

    let affected = 0, thieuQuet = 0;
    for (const a of agg) {
      const ngayStr = a.Ngay instanceof Date ? a.Ngay.toISOString().slice(0, 10) : String(a.Ngay).slice(0, 10);
      const k = tinhCongMotNgay(cfg, ngayStr, a.GioVao, a.GioRa);
      if (a.SoLan < 2) thieuQuet++;
      const rq = pool.request()
        .input('nv', sql.Int, a.NhanVienID).input('ngay', sql.Date, ngayStr)
        .input('GioVao', sql.NVarChar, a.GioVao).input('GioRa', sql.NVarChar, a.GioRa)
        .input('SoCong', sql.Decimal(4, 2), k.soCong).input('SoGioLam', sql.Decimal(5, 2), k.soGioLam)
        .input('OtThuong', sql.Decimal(5, 2), k.otThuong).input('OtCN', sql.Decimal(5, 2), k.otChuNhat)
        .input('OtLe', sql.Decimal(5, 2), k.otLeTet).input('MaCham', sql.NVarChar, k.maCham);
      const r = await rq.query(`
        MERGE ChamCongNgay AS t
        USING (SELECT @nv AS NhanVienID, @ngay AS Ngay) AS s
          ON t.NhanVienID = s.NhanVienID AND t.Ngay = s.Ngay
        WHEN MATCHED AND t.Nguon = N'May' THEN UPDATE SET
             GioVao = CAST(@GioVao AS TIME), GioRa = CAST(@GioRa AS TIME), SoCong = @SoCong, SoGioLam = @SoGioLam,
             GioTangCaThuong = @OtThuong, GioTangCaChuNhat = @OtCN, GioTangCaLeTet = @OtLe, MaCham = @MaCham
        WHEN NOT MATCHED THEN INSERT (NhanVienID,Ngay,MaCham,SoCong,SoGioLam,GioVao,GioRa,
             GioTangCaThuong,GioTangCaChuNhat,GioTangCaLeTet,Nguon)
          VALUES (@nv,@ngay,@MaCham,@SoCong,@SoGioLam,CAST(@GioVao AS TIME),CAST(@GioRa AS TIME),
             @OtThuong,@OtCN,@OtLe,N'May');`);
      affected += r.rowsAffected[0];
    }
    res.json({ success: true, data: { affected, ngay: agg.length, thieuQuet } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

/* v5.60: XÓA DỮ LIỆU CHẤM CÔNG.
   - /chamcong/ngay-thang : xóa BẢNG CHẤM CÔNG của tháng (mặc định chỉ xóa dòng do máy tổng hợp,
     giữ dòng sửa tay; truyền xoaCaThuCong=true để xóa hết).
   - /chamcong/raw        : xóa dữ liệu ĐÃ KÉO VỀ (theo tháng/máy/mã) để KÉO LẠI từ đầu. */
router.delete('/chamcong/ngay-thang', requireAuth, requirePermission('PAYROLL', 'delete'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10), thang = parseInt(req.query.thang, 10);
    if (!nam || !thang) return res.status(400).json({ success: false, message: 'Thiếu tháng/năm.' });
    const xoaHet = String(req.query.xoaCaThuCong || '') === 'true';
    const r = await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang).query(`
      DELETE FROM ChamCongNgay WHERE YEAR(Ngay)=@n AND MONTH(Ngay)=@t ${xoaHet ? '' : `AND Nguon = N'May'`}`);
    res.json({ success: true, data: { deleted: r.rowsAffected[0] } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});
router.delete('/chamcong/raw', requireAuth, requirePermission('PAYROLL', 'delete'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10), thang = parseInt(req.query.thang, 10);
    if (!nam || !thang) return res.status(400).json({ success: false, message: 'Thiếu tháng/năm.' });
    const mayId = req.query.mayId ? parseInt(req.query.mayId, 10) : null;
    const ma = req.query.maChamCong ? String(req.query.maChamCong).trim() : null;
    const r = await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang)
      .input('may', sql.Int, mayId).input('ma', sql.NVarChar, ma).query(`
      DELETE FROM ChamCongRaw
      WHERE YEAR(ThoiGian)=@n AND MONTH(ThoiGian)=@t
        AND (@may IS NULL OR MayChamCongID=@may)
        AND (@ma IS NULL OR MaChamMay=@ma)`);
    res.json({ success: true, data: { deleted: r.rowsAffected[0] } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

/* v5.60: CHI TIẾT TỪNG LẦN QUẸT đã kéo về (không gộp) — để kiểm tra vì sao 1 ngày thiếu giờ ra,
   và để xóa đúng phần cần kéo lại. Lọc theo tháng + (tùy chọn) mã chấm công / nhân viên. */
router.get('/chamcong/raw', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10) || new Date().getFullYear();
    const thang = parseInt(req.query.thang, 10) || (new Date().getMonth() + 1);
    const ma = req.query.maChamCong ? String(req.query.maChamCong).trim() : null;
    const rows = (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang).input('ma', sql.NVarChar, ma).query(`
      SELECT TOP 3000 r.ID, r.MaChamMay, r.ThoiGian, r.Nguon, r.MayChamCongID, m.TenMay,
             nv.MaNhanVien, nv.HoTen
      FROM ChamCongRaw r
      LEFT JOIN NhanVien nv ON nv.NhanVienID = r.NhanVienID
      LEFT JOIN MayChamCong m ON m.MayChamCongID = r.MayChamCongID
      WHERE YEAR(r.ThoiGian)=@n AND MONTH(r.ThoiGian)=@t AND (@ma IS NULL OR r.MaChamMay=@ma)
      ORDER BY r.ThoiGian DESC`)).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});
router.delete('/chamcong/raw/:id', requireAuth, requirePermission('PAYROLL', 'delete'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.BigInt, req.params.id).query('DELETE FROM ChamCongRaw WHERE ID=@id');
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

// Bang cham cong thang: 1 dong / nhan vien, kem tong cong + so ngay co cham.
router.get('/chamcong', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10) || new Date().getFullYear();
    const thang = parseInt(req.query.thang, 10) || (new Date().getMonth() + 1);
    const rows = (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang).query(`
      SELECT nv.NhanVienID, nv.MaNhanVien, nv.HoTen, bp.TenBoPhan,
        ISNULL(SUM(cc.SoCong),0) AS TongCong,
        SUM(ISNULL(cc.GioTangCaThuong,0)+ISNULL(cc.GioTangCaChuNhat,0)+ISNULL(cc.GioTangCaLeTet,0)) AS TongGioTangCa,
        COUNT(cc.ID) AS SoNgay
      FROM NhanVien nv
      LEFT JOIN BoPhan bp ON bp.BoPhanID=nv.BoPhanID
      LEFT JOIN ChamCongNgay cc ON cc.NhanVienID=nv.NhanVienID AND YEAR(cc.Ngay)=@n AND MONTH(cc.Ngay)=@t
      WHERE nv.TrangThaiLaoDong <> N'Đã nghỉ việc'
      GROUP BY nv.NhanVienID, nv.MaNhanVien, nv.HoTen, bp.TenBoPhan
      ORDER BY nv.HoTen`)).recordset;
    res.json({ success: true, data: { nam, thang, rows } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

// Chi tiet cham cong theo ngay cua 1 nhan vien trong thang (de sua tay).
router.get('/chamcong/:nhanVienId', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10), thang = parseInt(req.query.thang, 10);
    const rows = (await pool.request().input('id', sql.Int, parseInt(req.params.nhanVienId, 10)).input('n', sql.Int, nam).input('t', sql.Int, thang)
      .query(`SELECT * FROM ChamCongNgay WHERE NhanVienID=@id AND YEAR(Ngay)=@n AND MONTH(Ngay)=@t ORDER BY Ngay`)).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

// Luu (upsert) 1 dong cham cong ngay - sua tay (danh dau Nguon='ThuCong' de tong hop khong ghi de).
router.post('/chamcong/ngay', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body;
    await pool.request()
      .input('NhanVienID', sql.Int, b.nhanVienId).input('Ngay', sql.Date, b.ngay)
      .input('MaCham', sql.NVarChar, nn(b.maCham)).input('SoCong', sql.Decimal(4, 2), Number(b.soCong) || 0)
      .input('GioTC', sql.Decimal(5, 2), Number(b.gioTangCaThuong) || 0).input('GioCN', sql.Decimal(5, 2), Number(b.gioTangCaChuNhat) || 0).input('GioLe', sql.Decimal(5, 2), Number(b.gioTangCaLeTet) || 0)
      .input('CaDem', sql.Bit, b.caDem ? 1 : 0).input('GhiChu', sql.NVarChar, nn(b.ghiChu))
      .query(`MERGE ChamCongNgay AS t USING (SELECT @NhanVienID AS NhanVienID, @Ngay AS Ngay) AS s
        ON t.NhanVienID=s.NhanVienID AND t.Ngay=s.Ngay
        WHEN MATCHED THEN UPDATE SET MaCham=@MaCham,SoCong=@SoCong,GioTangCaThuong=@GioTC,GioTangCaChuNhat=@GioCN,GioTangCaLeTet=@GioLe,CaDem=@CaDem,GhiChu=@GhiChu,Nguon=N'ThuCong'
        WHEN NOT MATCHED THEN INSERT (NhanVienID,Ngay,MaCham,SoCong,GioTangCaThuong,GioTangCaChuNhat,GioTangCaLeTet,CaDem,GhiChu,Nguon)
          VALUES (@NhanVienID,@Ngay,@MaCham,@SoCong,@GioTC,@GioCN,@GioLe,@CaDem,@GhiChu,N'ThuCong');`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

/* ================================================================
   4. BANG LUONG CONG NHAT (engine - theo cong thuc BANG LUONG cua luong.xlsm)
   ================================================================ */
// Tinh cho 1 (nhan vien, contract, cham cong) 1 dong luong. Config-driven.
// Cong thuc (khop file): LuongNgayCong = round(LuongCB * Cong / CongChuan);
//   phu cap chia theo cong; TN mien thue = an ca + trang phuc; TN chiu thue = luong ngay cong +
//   xang xe + dien thoai + thuong; BH NLD = LuongCB * (8+1.5+1)%; giam tru ban than + NPT;
//   thue TNCN theo bieu bac; Thuc linh = TN chiu thue - BH - thue + TN mien thue - tam ung.
function tinhLuongCongNhat(e, cfg, congChuan, brackets) {
  const luongCB = Number(e.LuongCoBan) || 0;
  const cong = Number(e.Cong) || 0;
  const cc = congChuan > 0 ? congChuan : 26;
  const tyLe = cong / cc;                                  // ty le cong / cong chuan (de chia phu cap)
  const luongNgayCong = round0(luongCB * tyLe);
  const pcAnCa = round0((Number(e.PhuCapAnCa) || 0) * tyLe);
  const pcTrangPhuc = round0((Number(e.PhuCapTrangPhuc) || 0) * tyLe);
  const pcXangXe = round0((Number(e.PhuCapXangXe) || 0) * tyLe);
  const pcDienThoai = round0((Number(e.PhuCapDienThoai) || 0) * tyLe);
  const thuong = 0;                                        // thuong doanh thu: nhap sau (Phase khac)
  const tnMienThue = pcAnCa + pcTrangPhuc;                 // an ca + trang phuc = mien thue
  const tnChiuThue = luongNgayCong + pcXangXe + pcDienThoai + thuong;
  const bhxh = round0(luongCB * Number(cfg.BhxhNld) / 100);
  const bhyt = round0(luongCB * Number(cfg.BhytNld) / 100);
  const bhtn = round0(luongCB * Number(cfg.BhtnNld) / 100);
  const tongBH = bhxh + bhyt + bhtn;
  const giamTruBanThan = Number(cfg.GiamTruBanThan) || 0;
  const giamTruNPT = (Number(cfg.GiamTruNPT) || 0) * (Number(e.SoNguoiPhuThuoc) || 0);
  const tnTinhThue = Math.max(0, tnChiuThue - tongBH - giamTruBanThan - giamTruNPT);
  const thue = calcThueTNCN(tnTinhThue, brackets);
  const thucLinh = round0(tnChiuThue - tongBH - thue + tnMienThue);   // tam ung = 0 luc tinh
  return { luongCB, cong, luongNgayCong, pcAnCa, pcTrangPhuc, pcXangXe, pcDienThoai, thuong, tnMienThue, tnChiuThue, bhxh, bhyt, bhtn, tongBH, giamTruBanThan, giamTruNPT, tnTinhThue, thue, thucLinh };
}

// Tinh & luu bang luong cong nhat cho 1 thang (ghi de snapshot chi tiet).
router.post('/bangluong/tinh', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'luongcongnhat'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.body.nam, 10), thang = parseInt(req.body.thang, 10);
    if (!nam || !thang) return res.status(400).json({ success: false, message: 'Thiếu năm/tháng.' });
    const cfg = await getConfig(pool);
    const congChuan = await getCongChuan(pool, nam, thang);
    const brackets = await getBrackets(pool);
    // Nhan vien dang lam + hop dong hieu luc gan nhat + tong cong thang.
    const emps = (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang).query(`
      SELECT nv.NhanVienID, nv.MaNhanVien, nv.HoTen, ISNULL(nv.SoNguoiPhuThuoc,0) AS SoNguoiPhuThuoc,
        hd.LuongCoBan, hd.PhuCapAnCa, hd.PhuCapTrangPhuc, hd.PhuCapXangXe, hd.PhuCapDienThoai,
        (SELECT ISNULL(SUM(SoCong),0) FROM ChamCongNgay cc WHERE cc.NhanVienID=nv.NhanVienID AND YEAR(cc.Ngay)=@n AND MONTH(cc.Ngay)=@t) AS Cong
      FROM NhanVien nv
      OUTER APPLY (SELECT TOP 1 * FROM HopDongLaoDong h WHERE h.NhanVienID=nv.NhanVienID AND h.TrangThai=N'Hiệu lực' ORDER BY h.TuNgay DESC) hd
      WHERE nv.TrangThaiLaoDong <> N'Đã nghỉ việc'
      ORDER BY nv.HoTen`)).recordset;
    // Upsert header
    await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang).input('u', sql.Int, req.session.user.userId)
      .query(`MERGE BangLuong AS t USING (SELECT @n AS Nam,@t AS Thang) AS s ON t.Nam=s.Nam AND t.Thang=s.Thang AND t.Loai=N'CongNhat'
        WHEN MATCHED THEN UPDATE SET NgayLap=CAST(SYSDATETIME() AS DATE), NguoiLapID=@u
        WHEN NOT MATCHED THEN INSERT (Nam,Thang,Loai,NgayLap,NguoiLapID) VALUES (@n,@t,N'CongNhat',CAST(SYSDATETIME() AS DATE),@u);`);
    const header = (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang)
      .query(`SELECT BangLuongID FROM BangLuong WHERE Nam=@n AND Thang=@t AND Loai=N'CongNhat'`)).recordset[0];
    const blId = header.BangLuongID;
    await pool.request().input('id', sql.Int, blId).query('DELETE FROM BangLuongChiTiet WHERE BangLuongID=@id');
    for (const e of emps) {
      const c = tinhLuongCongNhat(e, cfg, congChuan, brackets);
      await pool.request().input('BangLuongID', sql.Int, blId).input('NhanVienID', sql.Int, e.NhanVienID)
        .input('Cong', sql.Decimal(6, 2), c.cong).input('LuongCoBan', sql.Decimal(14, 2), c.luongCB).input('LuongNgayCong', sql.Decimal(14, 2), c.luongNgayCong)
        .input('PcAnCa', sql.Decimal(14, 2), c.pcAnCa).input('PcTrangPhuc', sql.Decimal(14, 2), c.pcTrangPhuc).input('PcXangXe', sql.Decimal(14, 2), c.pcXangXe).input('PcDienThoai', sql.Decimal(14, 2), c.pcDienThoai)
        .input('TangCa', sql.Decimal(14, 2), 0).input('Thuong', sql.Decimal(14, 2), c.thuong).input('TnMienThue', sql.Decimal(14, 2), c.tnMienThue).input('TnChiuThue', sql.Decimal(14, 2), c.tnChiuThue)
        .input('BhxhNld', sql.Decimal(14, 2), c.bhxh).input('BhytNld', sql.Decimal(14, 2), c.bhyt).input('BhtnNld', sql.Decimal(14, 2), c.bhtn).input('TongBH', sql.Decimal(14, 2), c.tongBH)
        .input('GiamTruBanThan', sql.Decimal(14, 2), c.giamTruBanThan).input('GiamTruNPT', sql.Decimal(14, 2), c.giamTruNPT).input('TnTinhThue', sql.Decimal(14, 2), c.tnTinhThue)
        .input('ThueTNCN', sql.Decimal(14, 2), c.thue).input('TamUng', sql.Decimal(14, 2), 0).input('ThucLinh', sql.Decimal(14, 2), c.thucLinh)
        .query(`INSERT INTO BangLuongChiTiet (BangLuongID,NhanVienID,Cong,LuongCoBan,LuongNgayCong,PcAnCa,PcTrangPhuc,PcXangXe,PcDienThoai,TangCa,Thuong,TnMienThue,TnChiuThue,BhxhNld,BhytNld,BhtnNld,TongBH,GiamTruBanThan,GiamTruNPT,TnTinhThue,ThueTNCN,TamUng,ThucLinh)
          VALUES (@BangLuongID,@NhanVienID,@Cong,@LuongCoBan,@LuongNgayCong,@PcAnCa,@PcTrangPhuc,@PcXangXe,@PcDienThoai,@TangCa,@Thuong,@TnMienThue,@TnChiuThue,@BhxhNld,@BhytNld,@BhtnNld,@TongBH,@GiamTruBanThan,@GiamTruNPT,@TnTinhThue,@ThueTNCN,@TamUng,@ThucLinh)`);
    }
    res.json({ success: true, data: { bangLuongID: blId, soNhanVien: emps.length } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

async function loadBangLuong(pool, nam, thang) {
  const header = (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang)
    .query(`SELECT * FROM BangLuong WHERE Nam=@n AND Thang=@t AND Loai=N'CongNhat'`)).recordset[0];
  if (!header) return null;
  const rows = (await pool.request().input('id', sql.Int, header.BangLuongID).query(`
    SELECT ct.*, nv.MaNhanVien, nv.HoTen, nv.SoTaiKhoanNH, nv.TenNganHang, nv.ChiNhanhNH
    FROM BangLuongChiTiet ct JOIN NhanVien nv ON nv.NhanVienID=ct.NhanVienID
    WHERE ct.BangLuongID=@id ORDER BY nv.HoTen`)).recordset;
  return { header, rows };
}

router.get('/bangluong', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'luongcongnhat'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10) || new Date().getFullYear();
    const thang = parseInt(req.query.thang, 10) || (new Date().getMonth() + 1);
    const data = await loadBangLuong(pool, nam, thang);
    res.json({ success: true, data: { nam, thang, header: data ? data.header : null, rows: data ? data.rows : [] } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

// Sua tam ung 1 dong -> tinh lai thuc linh cua dong do.
router.put('/bangluong/chitiet/:id', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'luongcongnhat'), async (req, res) => {
  try {
    const pool = await getPool();
    const tamUng = Number(req.body.tamUng) || 0;
    await pool.request().input('id', sql.Int, parseInt(req.params.id, 10)).input('tu', sql.Decimal(14, 2), tamUng)
      .query(`UPDATE BangLuongChiTiet SET TamUng=@tu,
        ThucLinh = ROUND(TnChiuThue - TongBH - ThueTNCN + TnMienThue - @tu, 0) WHERE ID=@id`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

// Chot bang luong.
router.put('/bangluong/:id/chot', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'luongcongnhat'), async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.Int, parseInt(req.params.id, 10)).query(`UPDATE BangLuong SET TrangThai=N'Đã chốt' WHERE BangLuongID=@id`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

// Bang luong CUA TOI (nhan vien tu xem) - dua tren Users.NhanVienID (Phase 5 se gan lien ket day du).
router.get('/bangluong/cuatoi', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const u = (await pool.request().input('uid', sql.Int, req.session.user.userId).query('SELECT NhanVienID FROM Users WHERE UserID=@uid')).recordset[0];
    if (!u || !u.NhanVienID) return res.json({ success: true, data: { linked: false, rows: [] } });
    const nam = parseInt(req.query.nam, 10) || new Date().getFullYear();
    const thang = parseInt(req.query.thang, 10) || (new Date().getMonth() + 1);
    const rows = (await pool.request().input('nv', sql.Int, u.NhanVienID).input('n', sql.Int, nam).input('t', sql.Int, thang).query(`
      SELECT ct.*, bl.Nam, bl.Thang, bl.TrangThai FROM BangLuongChiTiet ct
      JOIN BangLuong bl ON bl.BangLuongID=ct.BangLuongID
      WHERE ct.NhanVienID=@nv AND bl.Nam=@n AND bl.Thang=@t`)).recordset;
    res.json({ success: true, data: { linked: true, rows } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

/* ================================================================
   5. XUAT EXCEL bang luong + XUAT FILE CHUYEN KHOAN CK (BIDV)
   ================================================================ */
const ExcelJS = require('exceljs');

router.get('/bangluong/excel', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'luongcongnhat'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10), thang = parseInt(req.query.thang, 10);
    const data = await loadBangLuong(pool, nam, thang);
    if (!data) return res.status(404).json({ success: false, message: 'Chưa có bảng lương tháng này.' });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Luong T${thang}-${nam}`);
    ws.mergeCells('A1', 'X1'); ws.getCell('A1').value = `BẢNG LƯƠNG CÔNG NHẬT — THÁNG ${thang}/${nam}`;
    ws.getCell('A1').font = { bold: true, size: 14 }; ws.getCell('A1').alignment = { horizontal: 'center' };
    const head = ['STT', 'Mã NV', 'Họ và tên', 'Công', 'Lương CB', 'Lương ngày công', 'Ăn ca', 'Trang phục', 'Xăng xe', 'Điện thoại', 'Thưởng', 'TN miễn thuế', 'TN chịu thuế', 'BHXH', 'BHYT', 'BHTN', 'Tổng BH', 'Giảm trừ BT', 'Giảm trừ NPT', 'TN tính thuế', 'Thuế TNCN', 'Tạm ứng', 'Thực lĩnh'];
    ws.addRow([]); const hr = ws.addRow(head); hr.font = { bold: true }; hr.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } }; c.border = { bottom: { style: 'thin' } }; });
    data.rows.forEach((r, i) => ws.addRow([i + 1, r.MaNhanVien, r.HoTen, Number(r.Cong), Number(r.LuongCoBan), Number(r.LuongNgayCong), Number(r.PcAnCa), Number(r.PcTrangPhuc), Number(r.PcXangXe), Number(r.PcDienThoai), Number(r.Thuong), Number(r.TnMienThue), Number(r.TnChiuThue), Number(r.BhxhNld), Number(r.BhytNld), Number(r.BhtnNld), Number(r.TongBH), Number(r.GiamTruBanThan), Number(r.GiamTruNPT), Number(r.TnTinhThue), Number(r.ThueTNCN), Number(r.TamUng), Number(r.ThucLinh)]));
    const tong = data.rows.reduce((s, r) => s + Number(r.ThucLinh), 0);
    const tr = ws.addRow(['', '', 'TỔNG CỘNG', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', tong]); tr.font = { bold: true };
    ws.columns.forEach((c, i) => { c.numFmt = i >= 3 ? '#,##0' : undefined; c.width = i === 2 ? 22 : 12; });
    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="BangLuong_T${thang}_${nam}.xlsx"`);
    res.end(Buffer.from(buf));
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

// File chuyen khoan CK theo mau BIDV (ck luong.xlsx Sheet 1, cot A-I).
router.get('/bangluong/ck', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'luongcongnhat'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10), thang = parseInt(req.query.thang, 10);
    const data = await loadBangLuong(pool, nam, thang);
    if (!data) return res.status(404).json({ success: false, message: 'Chưa có bảng lương tháng này.' });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet 1');
    ws.addRow(['Txn Reference\nSố tham chiếu', 'Amount (VND)\nSố tiền chuyển', 'Beneficiary Name\nTên người nhận', 'Account Number\nTài khoản nhận', 'Remarks\nNội dung', 'Ben Bank\nNgân hàng chuyển', 'Province\nĐịa bàn', 'Branch\nChi nhánh', 'Validation\nKiểm tra']).font = { bold: true };
    data.rows.forEach((r, i) => {
      if (!(Number(r.ThucLinh) > 0)) return; // bo qua dong 0d
      ws.addRow([
        'REF' + String(i + 1).padStart(4, '0'),
        Number(r.ThucLinh),
        khongDau(r.HoTen || '').toLowerCase(),
        r.SoTaiKhoanNH || '',
        'T' + thang,
        r.TenNganHang || '',
        '', '', ''
      ]);
    });
    ws.getColumn(1).width = 16; ws.getColumn(2).width = 16; ws.getColumn(2).numFmt = '#,##0';
    ws.getColumn(3).width = 26; ws.getColumn(4).width = 20; ws.getColumn(6).width = 28;
    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="CK_Luong_T${thang}_${nam}.xlsx"`);
    res.end(Buffer.from(buf));
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

/* ================================================================
   6. LUONG KHOAN MAY (Phase 3) - tinh tu PhanCongMay x don gia cong doan may cua don hang.
   CHI DOC du lieu QLSX (khong doi schema). Thanh tien = SoLuong * DonGia * HeSo; don gia uu tien
   theo don hang (DonHangCongDoanMay), fallback don gia he thong (DonGiaCongDoanMay). Loc theo thang
   ghi nhan tien do (TienDoSanXuat.NgayGhiNhan). "Nghiem thu" = da ghi nhan o cong doan May (PhanCongMay).
   ================================================================ */
async function loadLuongKhoanMay(pool, nam, thang, nhanVienId) {
  const reqDb = pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang);
  let extra = '';
  if (nhanVienId) { reqDb.input('nv', sql.Int, nhanVienId); extra = 'AND pc.NhanVienID = @nv'; }
  // v5.34c (Giai doan C): luong khoan may = SL x "Thanh tien/cai". Dual-path (uu tien don gia MOI):
  //   - Dong MOI: pc.DonGiaCongDoanMayID -> DonHangDonGiaCongDoanMay.ThanhTien (Giay gio x He so CD x He so CN).
  //   - Dong CU (khong co DonGiaCongDoanMayID): fallback model cu = DonGia x HeSo (per-order -> he thong).
  // Cot "DonGia" xuat ra = don gia MOT CAI thuc dung (de man hinh/Excel hien nguyen shape cu); HeSo=1 vi
  // he so da gop vao ThanhTien o model moi.
  return (await reqDb.query(`
    SELECT nv.NhanVienID, nv.MaNhanVien, nv.HoTen, d.MaDH, d.TenSanPham,
      ISNULL(dm.TenCongDoan, cm.TenCongDoan) AS TenCongDoan, td.NgayGhiNhan, pc.SoLuong,
      ISNULL(dm.ThanhTien, ISNULL(ISNULL(dhg.DonGia,g.DonGia),0) * ISNULL(ISNULL(dhg.HeSo,g.HeSo),1)) AS DonGia,
      CAST(1 AS DECIMAL(10,4)) AS HeSo,
      pc.SoLuong * ISNULL(dm.ThanhTien, ISNULL(ISNULL(dhg.DonGia,g.DonGia),0) * ISNULL(ISNULL(dhg.HeSo,g.HeSo),1)) AS ThanhTien
    FROM PhanCongMay pc
    JOIN TienDoSanXuat td ON td.TienDoID = pc.TienDoID
    JOIN DonHangSanXuat d ON d.DonHangID = td.DonHangID
    JOIN NhanVien nv ON nv.NhanVienID = pc.NhanVienID
    LEFT JOIN DonHangDonGiaCongDoanMay dm ON dm.ID = pc.DonGiaCongDoanMayID
    LEFT JOIN CongDoanMay cm ON cm.CongDoanMayID = pc.CongDoanMayID
    LEFT JOIN DonHangCongDoanMay dhg ON dhg.DonHangID = d.DonHangID AND dhg.CongDoanMayID = pc.CongDoanMayID
    LEFT JOIN DonGiaCongDoanMay g ON g.CongDoanMayID = pc.CongDoanMayID
    WHERE YEAR(td.NgayGhiNhan) = @n AND MONTH(td.NgayGhiNhan) = @t ${extra}
    ORDER BY nv.HoTen, d.MaDH`)).recordset;
}
function tongHopKhoanMay(rows) {
  const m = {};
  rows.forEach(r => { const k = r.NhanVienID; if (!m[k]) m[k] = { NhanVienID: k, MaNhanVien: r.MaNhanVien, HoTen: r.HoTen, SoLuong: 0, ThanhTien: 0 }; m[k].SoLuong += Number(r.SoLuong) || 0; m[k].ThanhTien += Number(r.ThanhTien) || 0; });
  return Object.values(m);
}

router.get('/luongmay', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'luongmay'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10) || new Date().getFullYear();
    const thang = parseInt(req.query.thang, 10) || (new Date().getMonth() + 1);
    const rows = await loadLuongKhoanMay(pool, nam, thang, null);
    res.json({ success: true, data: { nam, thang, rows, tongHop: tongHopKhoanMay(rows) } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

router.get('/luongmay/excel', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'luongmay'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10), thang = parseInt(req.query.thang, 10);
    const rows = await loadLuongKhoanMay(pool, nam, thang, null);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Khoan may T${thang}-${nam}`);
    ws.mergeCells('A1', 'G1'); ws.getCell('A1').value = `LƯƠNG KHOÁN MAY — THÁNG ${thang}/${nam}`;
    ws.getCell('A1').font = { bold: true, size: 14 }; ws.getCell('A1').alignment = { horizontal: 'center' };
    ws.addRow([]); const hr = ws.addRow(['Mã NV', 'Họ tên', 'Mã ĐH', 'Công đoạn', 'Số lượng', 'Đơn giá', 'Thành tiền']); hr.font = { bold: true };
    rows.forEach(r => ws.addRow([r.MaNhanVien, r.HoTen, r.MaDH, r.TenCongDoan, Number(r.SoLuong), Number(r.DonGia), Number(r.ThanhTien)]));
    const tong = rows.reduce((s, r) => s + Number(r.ThanhTien), 0);
    const tr = ws.addRow(['', '', '', '', '', 'TỔNG', tong]); tr.font = { bold: true };
    ws.columns.forEach((c, i) => { c.width = i === 1 ? 22 : 14; if (i >= 4) c.numFmt = '#,##0'; });
    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="LuongKhoanMay_T${thang}_${nam}.xlsx"`);
    res.end(Buffer.from(buf));
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

// Self-service: luong khoan may CUA TOI (chi can dang nhap; loc theo Users.NhanVienID).
router.get('/luongmay/cuatoi', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const u = (await pool.request().input('uid', sql.Int, req.session.user.userId).query('SELECT NhanVienID FROM Users WHERE UserID=@uid')).recordset[0];
    if (!u || !u.NhanVienID) return res.json({ success: true, data: { linked: false, rows: [] } });
    const nam = parseInt(req.query.nam, 10) || new Date().getFullYear();
    const thang = parseInt(req.query.thang, 10) || (new Date().getMonth() + 1);
    const rows = await loadLuongKhoanMay(pool, nam, thang, u.NhanVienID);
    res.json({ success: true, data: { linked: true, rows } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

// ============ v5.36 (Payroll P4): LƯƠNG/CHI PHÍ GIA CÔNG NGOÀI + IN THÊU (tổng hợp từ QLSX) ============
// Gia công: SoLuongNhan × đơn giá hạng mục (DonHangHangMucGiaCong.DonGia, fallback HangMucGiaCong.DonGiaMacDinh).
// In thêu:  SoLuongNhan × TỔNG đơn giá in thêu của đơn (SUM DonHangDonGiaInThe.DonGia). Lọc theo tháng tạo
// dòng giao (CreatedAt) vì SL nhận không có cột ngày riêng. Tổng hợp theo từng Nhà (gia công / in thêu).
/* v7.53 — HAI CAU SQL NAY DA CHUYEN sang utils/luongGiaCongInThe.js.
   Ly do: SO CONG NO NHA GIA CONG (routes/congno.js) phai dung DUNG con so cua bang luong. Giu ban thu
   hai la Bang luong va So cong no ra HAI CON SO cho cung mot viec ma khong ai biet ben nao dung.
   Doc ghi chu dau file util TRUOC KHI SUA cong thuc (moc "SL NHAN", bay nhieu-ban-don-gia). */
const { loadGiaCong: __loadGiaCong, loadInThe: __loadInThe, tongHopTheoNha } = require('../utils/luongGiaCongInThe');
const loadGiaCong = (pool, nam, thang) => __loadGiaCong(pool, sql, { nam, thang });
const loadInThe = (pool, nam, thang) => __loadInThe(pool, sql, { nam, thang });
router.get('/giacong-inthe', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'luonggcinthe'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10) || new Date().getFullYear();
    const thang = parseInt(req.query.thang, 10) || (new Date().getMonth() + 1);
    const gc = await loadGiaCong(pool, nam, thang);
    const it = await loadInThe(pool, nam, thang);
    res.json({ success: true, data: { nam, thang, giaCong: { rows: gc, tongHop: tongHopTheoNha(gc) }, inThe: { rows: it, tongHop: tongHopTheoNha(it) } } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

// v5.38 (Payroll P4b): LƯƠNG LÀ (LA) + ĐÓNG GÓI (DG) = SL giao (PhanCongLaDongGoi) × đơn giá là/đóng gói
// (DonHangDonGiaLaDongGoi theo Loai = MaCongDoan). Bảng RIÊNG nên KHÔNG lẫn lương khoán may. Lọc theo NgayGhiNhan.
async function loadLuongLaDongGoi(pool, nam, thang) {
  return (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang).query(`
    SELECT c.MaCongDoan AS Loai, nv.NhanVienID, nv.MaNhanVien, nv.HoTen, d.MaDH, d.TenSanPham,
           ms.TenMau, td.NgayGhiNhan, pc.SoLuong,
           ISNULL(dg.DonGia,0) AS DonGia,
           pc.SoLuong * ISNULL(dg.DonGia,0) AS ThanhTien
    FROM PhanCongLaDongGoi pc
    JOIN TienDoSanXuat td ON td.TienDoID = pc.TienDoID
    JOIN CongDoanSanXuat c ON c.StageID = td.StageID
    JOIN DonHangSanXuat d ON d.DonHangID = td.DonHangID
    JOIN NhanVien nv ON nv.NhanVienID = pc.NhanVienID
    LEFT JOIN MauSac ms ON ms.MauSacID = pc.MauSacID
    -- v5.56: nhiều bản đơn giá là/đóng gói → TOP 1 (bản đầu tiên) thay vì JOIN (tránh nhân dòng lương).
    OUTER APPLY (SELECT TOP 1 x.DonGia FROM DonHangDonGiaLaDongGoi x
                 WHERE x.DonHangID = d.DonHangID AND x.Loai = c.MaCongDoan
                 ORDER BY ISNULL(x.TenPhieu, N''), x.ID) dg
    WHERE c.MaCongDoan IN ('LA','DG') AND YEAR(td.NgayGhiNhan)=@n AND MONTH(td.NgayGhiNhan)=@t
    ORDER BY nv.HoTen, c.MaCongDoan`)).recordset;
}
router.get('/luongladonggoi', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'luongladonggoi'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10) || new Date().getFullYear();
    const thang = parseInt(req.query.thang, 10) || (new Date().getMonth() + 1);
    const rows = await loadLuongLaDongGoi(pool, nam, thang);
    res.json({ success: true, data: { nam, thang, rows, tongHop: tongHopKhoanMay(rows) } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

/* ==================================================================================================
   v5.91 — LƯƠNG TRẢI VẢI CẮT (quỹ lương cắt tháng chia cho nhân viên bộ phận Cắt theo giờ công)

   CÁCH TÍNH (theo đúng yêu cầu đã chốt):
     1. Mỗi SỔ CẮT (1 bản ghi tiến độ công đoạn Cắt) = 1 sơ đồ:
            tiền 1 sơ đồ = mét sơ đồ × TỔNG SỐ LỚP của sơ đồ đó × khổ vải × đơn giá (mặc định 1100)
        LƯU Ý QUAN TRỌNG: mét sơ đồ / khổ vải nằm trên bản ghi tiến độ NHƯNG chỉ được ghi ở công đoạn
        Kỹ thuật; ghi tiến độ Cắt KHÔNG ghi 2 cột này. Vì vậy phải LẤY BÙ từ sơ đồ đã chọn
        (TienDoSanXuat.SoDoID -> DonHangChiTietSoDo) — giống cách sổ cắt hiển thị từ v5.89.
        Nếu không lấy bù, mọi sơ đồ sẽ ra 0 đồng.
     2. Cộng các sơ đồ theo lệnh SX -> tiền của lệnh SX. Cộng tất cả -> QUỸ LƯƠNG CẮT tháng.
     3. Giờ công lấy từ chấm công (ChamCongNgay.SoGioLam) của nhân viên bộ phận Cắt trong tháng.
     4. Đơn giá 1 giờ = QUỸ / TỔNG GIỜ của toàn bộ nhân viên cắt.
     5. Lương từng người = giờ công × hệ số lương (CauHinhLuongCat, mặc định 1) × đơn giá 1 giờ.
        => Tổng lương trả ra CÓ THỂ khác quỹ khi có hệ số ≠ 1 (người dùng đã chọn cách này) nên
           luôn trả về `chenhLech` để bảng lương in ra nói rõ vượt/thiếu bao nhiêu.
   ================================================================================================== */
const LC_KEY = 'LUONG_CAT';
const LC_DEFAULT = { donGia: 1100 };
async function getCauHinhLuongCat(pool) {
  try {
    const r = (await pool.request().input('k', sql.NVarChar, LC_KEY)
      .query('SELECT GiaTri FROM CauHinh WHERE Khoa=@k')).recordset[0];
    const saved = r && r.GiaTri ? JSON.parse(r.GiaTri) : {};
    const cfg = Object.assign({}, LC_DEFAULT, saved);
    cfg.donGia = Number(cfg.donGia) || LC_DEFAULT.donGia;
    return cfg;
  } catch (e) { return Object.assign({}, LC_DEFAULT); }
}

// Danh sách SƠ ĐỒ đã cắt trong tháng + tiền từng sơ đồ.
async function loadSoDoCat(pool, nam, thang, donGia) {
  return (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang).input('g', sql.Decimal(18, 4), donGia).query(`
    SELECT td.TienDoID, td.NgayGhiNhan, td.SttSoCat, td.SoDoID,
           d.DonHangID, d.MaDH, d.TenSanPham, d.MaSanPham,
           ISNULL(td.MetSoDoDai, sd.MetSoDoDai) AS MetSoDoDai,
           ISNULL(td.KhoVaiSoDo, sd.KhoVaiSoDo) AS KhoVaiSoDo,
           ISNULL(NULLIF(LTRIM(RTRIM(ISNULL(td.MaRap, N''))), N''), sd.MaRap) AS MaRap,
           ISNULL((SELECT SUM(cay.SoLuongLop) FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = td.TienDoID), 0) AS TongLop,
           ISNULL(td.MetSoDoDai, sd.MetSoDoDai) * ISNULL(td.KhoVaiSoDo, sd.KhoVaiSoDo)
             * ISNULL((SELECT SUM(cay.SoLuongLop) FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = td.TienDoID), 0)
             * @g AS ThanhTien,
           nvc.HoTen AS NhanVienCat,
           ISNULL(STUFF((SELECT ', ' + nv2.HoTen FROM TienDoTraiVai tv
                         JOIN NhanVien nv2 ON nv2.NhanVienID = tv.NhanVienID
                         WHERE tv.TienDoID = td.TienDoID FOR XML PATH('')), 1, 2, ''), nvt.HoTen) AS NhanVienTraiVai
    FROM TienDoSanXuat td
    JOIN CongDoanSanXuat c ON c.StageID = td.StageID
    JOIN DonHangSanXuat d ON d.DonHangID = td.DonHangID
    LEFT JOIN DonHangChiTietSoDo sd ON sd.ID = td.SoDoID
    LEFT JOIN NhanVien nvc ON nvc.NhanVienID = td.NhanVienCatID
    LEFT JOIN NhanVien nvt ON nvt.NhanVienID = td.NhanVienTraiVaiID
    WHERE c.MaCongDoan = 'CAT'
      AND YEAR(td.NgayGhiNhan)=@n AND MONTH(td.NgayGhiNhan)=@t
      AND EXISTS (SELECT 1 FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = td.TienDoID)
    ORDER BY d.MaDH, td.TienDoID`)).recordset;
}

// Giờ công + hệ số của nhân viên BỘ PHẬN CẮT trong tháng.
async function loadGioCongCat(pool, nam, thang) {
  return (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang).query(`
    SELECT nv.NhanVienID, nv.MaNhanVien, nv.HoTen, bp.TenBoPhan,
           ISNULL(SUM(cc.SoGioLam), 0) AS TongGioLam,
           ISNULL(SUM(cc.SoCong), 0) AS TongCong,
           COUNT(cc.ID) AS SoNgay,
           ISNULL((SELECT TOP 1 h.HeSoLuong FROM CauHinhLuongCat h WHERE h.NhanVienID = nv.NhanVienID), 1) AS HeSoLuong
    FROM NhanVien nv
    LEFT JOIN BoPhan bp ON bp.BoPhanID = nv.BoPhanID
    LEFT JOIN ChamCongNgay cc ON cc.NhanVienID = nv.NhanVienID AND YEAR(cc.Ngay)=@n AND MONTH(cc.Ngay)=@t
    WHERE bp.TenBoPhan = N'Cắt'
    GROUP BY nv.NhanVienID, nv.MaNhanVien, nv.HoTen, bp.TenBoPhan
    ORDER BY nv.HoTen`)).recordset;
}

function tongHopLuongCat(soDo, nhanVien) {
  // Gộp theo lệnh SX (mỗi lệnh có bao nhiêu sơ đồ + tổng tiền).
  const theoDon = [];
  const map = {};
  soDo.forEach(s => {
    const k = s.DonHangID;
    if (!map[k]) {
      map[k] = { DonHangID: k, MaDH: s.MaDH, MaSanPham: s.MaSanPham, TenSanPham: s.TenSanPham, SoSoDo: 0, TongLop: 0, ThanhTien: 0 };
      theoDon.push(map[k]);
    }
    map[k].SoSoDo += 1;
    map[k].TongLop += Number(s.TongLop) || 0;
    map[k].ThanhTien += Number(s.ThanhTien) || 0;
  });
  const quy = soDo.reduce((t, s) => t + (Number(s.ThanhTien) || 0), 0);
  const tongGio = nhanVien.reduce((t, n) => t + (Number(n.TongGioLam) || 0), 0);
  // Theo phương án đã chốt: đơn giá giờ chia cho TỔNG GIỜ (chưa nhân hệ số).
  const donGiaGio = tongGio > 0 ? quy / tongGio : 0;
  const rowsNV = nhanVien.map(n => {
    const gio = Number(n.TongGioLam) || 0;
    const heSo = Number(n.HeSoLuong) || 1;
    return Object.assign({}, n, { TongGioLam: gio, HeSoLuong: heSo, ThanhTien: gio * heSo * donGiaGio });
  });
  const tongLuong = rowsNV.reduce((t, n) => t + n.ThanhTien, 0);
  return { theoDon, quy, tongGio, donGiaGio, nhanVien: rowsNV, tongLuong, chenhLech: tongLuong - quy };
}

router.get('/luongtraivaicat', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'luongtraivaicat'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10) || new Date().getFullYear();
    const thang = parseInt(req.query.thang, 10) || (new Date().getMonth() + 1);
    const cfg = await getCauHinhLuongCat(pool);
    const soDo = await loadSoDoCat(pool, nam, thang, cfg.donGia);
    const nvRaw = await loadGioCongCat(pool, nam, thang);
    const th = tongHopLuongCat(soDo, nvRaw);
    res.json({ success: true, data: Object.assign({ nam, thang, donGia: cfg.donGia, soDo }, th) });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

// Lưu đơn giá cắt + hệ số lương từng nhân viên (màn hình cấu hình ngay trong tab).
router.post('/luongtraivaicat/cauhinh', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'luongtraivaicat'), async (req, res) => {
  try {
    const pool = await getPool();
    const donGia = Number(req.body.donGia);
    if (donGia != null && !isNaN(donGia) && donGia > 0) {
      const json = JSON.stringify({ donGia });
      const up = await pool.request().input('k', sql.NVarChar, LC_KEY).input('v', sql.NVarChar(sql.MAX), json)
        .query('UPDATE CauHinh SET GiaTri=@v, UpdatedAt=SYSDATETIME() WHERE Khoa=@k');
      if (!up.rowsAffected[0]) {
        await pool.request().input('k', sql.NVarChar, LC_KEY).input('v', sql.NVarChar(sql.MAX), json)
          .query('INSERT INTO CauHinh (Khoa, GiaTri, UpdatedAt) VALUES (@k, @v, SYSDATETIME())');
      }
    }
    // Hệ số từng nhân viên: MERGE theo NhanVienID (không gửi = giữ nguyên).
    const heSo = Array.isArray(req.body.heSo) ? req.body.heSo : [];
    for (const h of heSo) {
      const nvId = Number(h.nhanVienId);
      if (!nvId) continue;
      const hs = Number(h.heSoLuong);
      await pool.request().input('nv', sql.Int, nvId).input('hs', sql.Decimal(10, 3), isNaN(hs) || hs <= 0 ? 1 : hs)
        .query(`MERGE CauHinhLuongCat AS t
                USING (SELECT @nv AS NhanVienID) AS s ON t.NhanVienID = s.NhanVienID
                WHEN MATCHED THEN UPDATE SET HeSoLuong=@hs, UpdatedAt=SYSDATETIME()
                WHEN NOT MATCHED THEN INSERT (NhanVienID, HeSoLuong, UpdatedAt) VALUES (@nv, @hs, SYSDATETIME());`);
    }
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi lưu cấu hình lương cắt: ' + err.message }); }
});

module.exports = router;
