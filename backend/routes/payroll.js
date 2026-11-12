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
/* v9.32: tạm ứng của bảng lương = TỔNG PHIẾU CHI loại 'TamUng' của tháng — xem khối ghi chú dài
   trong utils/tamUngNhanVien.js về lý do KHÔNG ghi thẳng vào BangLuongChiTiet. */
const { tongTamUngTheoThang, chiTietTamUng } = require('../utils/tamUngNhanVien');
/* v9.45: bộ tính công nhật mới, thuần túy, viết từ bảng lương THỰC TẾ T10/2026 — xem đầu file util. */
const { tinhLuongV945, gomChamCong } = require('../utils/luongCongNhat');

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
    /* v9.45: bốn tham số mới (migration_v890) — UPDATE riêng, chỉ khi cột đã có, để màn Cấu hình vẫn
       lưu được các mục cũ trên máy chưa chạy migration. Không cache kết quả probe (quy tắc coCot…V890). */
    const coV890 = (await pool.request().query("SELECT COL_LENGTH('CauHinhLuong','TruThueTNCN') AS c")).recordset[0].c != null;
    if (coV890 && (b.truThueTNCN !== undefined || b.tyLeThuViec !== undefined || b.lamTronThucLinh !== undefined || b.diMuonChamChuocPhut !== undefined)) {
      await pool.request()
        .input('TruThue', sql.Bit, b.truThueTNCN === true || b.truThueTNCN === 1 || b.truThueTNCN === '1' ? 1 : 0)
        .input('TyLeTV', sql.Decimal(5, 2), Math.min(100, Math.max(0, dec(b.tyLeThuViec, 85))))
        .input('LamTron', sql.Int, Math.max(1, Math.round(dec(b.lamTronThucLinh, 1000))))
        .input('ChamChuoc', sql.Int, Math.max(0, Math.round(dec(b.diMuonChamChuocPhut, 5))))
        .query('UPDATE CauHinhLuong SET TruThueTNCN=@TruThue, TyLeThuViec=@TyLeTV, LamTronThucLinh=@LamTron, DiMuonChamChuocPhut=@ChamChuoc, UpdatedAt=SYSDATETIME() WHERE ID=1');
    }
    res.json({ success: true, data: { coV890 } });
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

/* ================================================================================================
   v9.11 — DANH SACH NHAN VIEN CHO MAN CHAM CONG

   🔴 LOI THAT Nguyen bao 2026-10-31: tai khoan `huongns` co DU quyen Quan ly nhan su + Tinh luong
   (ghi de rieng, tick het Xem/Them/Sua/Xoa) va DU het chuc nang PAYROLL, nhung bam "Tải NV từ máy"
   van bao "khong co quyen thuc hien thao tac nay". Vi man Cham cong di MUON
   `GET /api/danhmuc/nhanvien` — route cua PHAN HE DANH MUC. Tai khoan do khong duoc cap Danh muc
   (o "Ghi de rieng" cua Danh muc khong tick) nen requirePermission('DANHMUC','view') chan.

   Bat nguoi lam cham cong phai co quyen DANH MUC la sai ve nghiep vu: danh muc con chua khach hang,
   nha cung cap, ma hang, mau sac... Cham cong chi can TEN va MA cua nhan vien.

   Nen route rieng nay tra dung BON cot man cham cong dung — khong kem luong, khong kem so CCCD hay
   bat ky thong tin nhan su nhay cam nao. Cap quyen HEP HON han ban cu, khong phai noi rong.
   ⚠️ KHONG loc trang thai nghi viec: giu Y HET tap du lieu cua /api/danhmuc/nhanvien de khong lam
   mat dong nao dang hien, vi nhan vien da nghi van con ban ghi cham cong cu can doi chieu.
   ================================================================================================ */
router.get('/nhanvien', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const rs = (await pool.request().query(
      'SELECT NhanVienID, MaNhanVien, HoTen, MaChamCong FROM NhanVien ORDER BY HoTen')).recordset;
    res.json({ success: true, data: rs });
  } catch (err) {
    console.error('[payroll /nhanvien] ', err.message);
    res.status(500).json({ success: false, message: 'Lỗi đọc danh sách nhân viên: ' + err.message });
  }
});

// v5.59: KIỂM TRA KẾT NỐI nhanh (chỉ Hikvision — ZKTeco dùng luôn nút "Tải NV từ máy").
// v9.11: ép kiểm 'view' — route POST này CHỈ ping máy, không ghi gì. Xem ghi chú ở middleware/auth.js.
router.post('/maychamcong/:id/test', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'chamcong', 'view'), async (req, res) => {
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
/* v9.11 — ÉP 'view'. Route CHỈ ĐỌC máy, không ghi một dòng nào, và đã khai requirePermission
   (...,'view') — nhưng requireChucNang suy hành động TỪ HTTP METHOD, POST => 'edit', nên người chỉ
   được XEM tab Chấm công bị chặn. Ép 'view' cho khớp đúng việc route làm.
   Việc GHI nằm ở route /maychamcong/mapnhanvien bên dưới — chỗ đó mới đáng đòi quyền sửa.
   ⚠️ ĐỪNG nhầm: đây là một lỗi thiết kế TÌM THẤY DỌC ĐƯỜNG, **KHÔNG** phải nguyên nhân ca
   "Tải NV từ máy" của Nguyen (2026-10-31). Thủ phạm ca đó là màn Chấm công đi mượn
   `GET /api/danhmuc/nhanvien` — xem ghi chú dài ở route `GET /nhanvien` phía trên. Lỗi ở route này
   còn bị `catch` rỗng của frontend nuốt, không bao giờ hiện ra màn hình. */
router.post('/maychamcong/:id/nhanvien-tumay', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'chamcong', 'view'), async (req, res) => {
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

/* ================================================================================================
   v8.00 — NHOM CHAM CONG (migration_v700).

   Truoc v8.00 ca cong ty dung MOT bo gio vao/ra. Xuong nhieu ca => ai lech ca thi SO CONG sai,
   phai sua tay tung ngay.

   THU TU UU TIEN:   CC_DEFAULT  <-  cau hinh CHUNG  <-  cau hinh NHOM
   Nhom chi khai nhung gi KHAC (thuong la gioVao/gioRa); o de trong roi ve cau hinh chung.
   Nhan vien CHUA gan nhom -> dung y nguyen cau hinh chung (du lieu dang chay khong doi hanh vi).

   ⚠️ ngayLe LAY TU CAU HINH CHUNG, nhom KHONG duoc ghi de — le la le chung ca cong ty. Neu de nhom
   ghi de thi mot nhom quen khai ngayLe la ngay le cua ho thanh ngay thuong, tang ca tinh sai bac.

   ⚠️ Ham do cot co CACHE theo tien trinh (__coCotNhomCC). Chay migration_v700 SAU khi pm2 da chay
   thi phai pm2 restart, khong thi cache giu `false` va tinh nang an sach khong bao loi. Da vo dung
   nhu vay o v7.95/v7.98.
   ================================================================================================ */
let __coCotNhomCC = null;
async function coBangNhomChamCong(pool) {
  if (__coCotNhomCC === null) {
    try {
      const r = (await pool.request().query(
        "SELECT OBJECT_ID('NhomChamCong') AS b, COL_LENGTH('NhanVien','NhomChamCongID') AS c")).recordset[0] || {};
      __coCotNhomCC = r.b != null && r.c != null;
    } catch (e) { __coCotNhomCC = false; }
  }
  return __coCotNhomCC;
}
/* Gop 1 cau hinh nhom len tren cau hinh chung. Chi nhan cac o CO GIA TRI THAT cua nhom:
   '' / null / undefined deu coi la "khong khai" -> giu cua chung.
   Rieng nghiTruaTu/nghiTruaDen: chuoi rong LA MOT LUA CHON CO NGHIA ("khong tru nghi trua"), nen
   phai phan biet '' voi undefined -> dung hasOwnProperty, cung cach da lam cho TenHoaDon (v7.46). */
function gopCfgNhom(cfgChung, jsonNhom) {
  let n = {};
  try { n = jsonNhom ? JSON.parse(jsonNhom) : {}; } catch (e) { n = {}; }
  const ra = Object.assign({}, cfgChung);
  const coKhai = (k) => Object.prototype.hasOwnProperty.call(n, k) && n[k] !== null && n[k] !== undefined;
  ['gioVao', 'gioRa'].forEach(k => { if (coKhai(k) && String(n[k]).trim() !== '') ra[k] = n[k]; });
  ['nghiTruaTu', 'nghiTruaDen'].forEach(k => { if (coKhai(k)) ra[k] = n[k]; });
  ['soGioMotCong', 'lamTronCong', 'toiThieuTinhCongPhut', 'otBatDauSauPhut', 'otLamTronGio', 'otToiDaGioNgay']
    .forEach(k => { if (coKhai(k) && String(n[k]).trim() !== '' && !isNaN(Number(n[k]))) ra[k] = Number(n[k]); });
  if (coKhai('tinhOtTruocGioVao')) ra.tinhOtTruocGioVao = !!n.tinhOtTruocGioVao;
  ra.ngayLe = Array.isArray(cfgChung.ngayLe) ? cfgChung.ngayLe : [];   // LUON tu cau hinh chung
  return ra;
}
/* Tra { chung, theoNhanVien: Map(NhanVienID -> cfg) }.
   Chi nap MOT lan cho ca thang roi tra cuu trong vong lap tong hop — khong goi CSDL trong vong lap. */
async function getCfgChamCongTheoNhom(pool) {
  const chung = await getCauHinhChamCong(pool);
  const theoNhanVien = new Map();
  if (!await coBangNhomChamCong(pool)) return { chung, theoNhanVien };
  try {
    const rs = (await pool.request().query(`
      SELECT nv.NhanVienID, n.CauHinh
      FROM NhanVien nv
      JOIN NhomChamCong n ON n.NhomID = nv.NhomChamCongID`)).recordset;
    const capTheoJson = new Map();   // gop 1 lan cho moi nhom, khong gop lai cho tung nguoi
    rs.forEach(r => {
      const khoa = r.CauHinh == null ? '' : String(r.CauHinh);
      if (!capTheoJson.has(khoa)) capTheoJson.set(khoa, gopCfgNhom(chung, r.CauHinh));
      theoNhanVien.set(r.NhanVienID, capTheoJson.get(khoa));
    });
  } catch (e) {
    console.warn('[payroll getCfgChamCongTheoNhom] khong doc duoc nhom:', e.message);
  }
  return { chung, theoNhanVien };
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
    const nhomId = req.query.nhomId ? parseInt(req.query.nhomId, 10) : null;
    if (!nhomId) return res.json({ success: true, data: await getCauHinhChamCong(pool) });
    /* v8.00: cau hinh cua MOT NHOM. Tra ve ban DA GOP (chung + nhom) chu khong tra ban tho cua nhom.
       Ly do: form khai gio dien san tu day, nen nhung gi Nguyen NHIN THAY chinh la nhung gi se duoc
       luu. Tra ban tho thi o nao nhom chua khai se hien mac dinh CC_DEFAULT (vd 8 gio/cong) trong
       khi cong ty dang dat 7.5 — bam Luu la am tham doi 7.5 thanh 8 cho nhom do. */
    if (!await coBangNhomChamCong(pool)) {
      return res.status(400).json({ success: false, message: 'Chưa chạy database/migration_v700.sql — chưa dùng được Nhóm chấm công.' });
    }
    const r = (await pool.request().input('id', sql.Int, nhomId)
      .query('SELECT NhomID, TenNhom, CauHinh FROM NhomChamCong WHERE NhomID=@id')).recordset[0];
    if (!r) return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm chấm công.' });
    const chung = await getCauHinhChamCong(pool);
    res.json({ success: true, data: gopCfgNhom(chung, r.CauHinh), nhom: { NhomID: r.NhomID, TenNhom: r.TenNhom }, daKhaiRieng: r.CauHinh != null });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

/* ================================================================================================
   v8.00 — NHOM CHAM CONG: danh muc + gan nhan vien.

   ⚠️ CAC ROUTE NAY PHAI DUNG TRUOC `/chamcong/:nhanVienId` (dat o phia duoi file). `/chamcong/nhom`
   va `/chamcong/:nhanVienId` DEU LA 2 DOAN => neu route co tham so dung truoc thi Express hieu
   "nhom" la mot nhanVienId va tra ve bang cham cong rong. Dung loi `/nhanvien/template` chet tu
   v5.38 (xem HUONG_DAN_CAI_DAT.md).
   ================================================================================================ */
async function chanChuaCoNhom(pool, res) {
  if (await coBangNhomChamCong(pool)) return false;
  res.status(400).json({ success: false, message: 'Chưa chạy database/migration_v700.sql — chưa dùng được Nhóm chấm công.' });
  return true;
}
router.get('/chamcong/nhom', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    if (await chanChuaCoNhom(pool, res)) return;
    const rows = (await pool.request().query(`
      SELECT n.NhomID, n.TenNhom, n.GhiChu, n.CauHinh,
             (SELECT COUNT(*) FROM NhanVien nv WHERE nv.NhomChamCongID = n.NhomID) AS SoNhanVien
      FROM NhomChamCong n ORDER BY n.TenNhom`)).recordset;
    /* Tra kem gio dang ap dung THAT (da gop) de danh sach nhin la biet nhom nao dang chay gio nao,
       khong phai mo tung nhom ra xem. */
    const chung = await getCauHinhChamCong(pool);
    const data = rows.map(r => {
      const c = gopCfgNhom(chung, r.CauHinh);
      return {
        NhomID: r.NhomID, TenNhom: r.TenNhom, GhiChu: r.GhiChu, SoNhanVien: r.SoNhanVien,
        DaKhaiRieng: r.CauHinh != null, GioVao: c.gioVao, GioRa: c.gioRa
      };
    });
    res.json({ success: true, data, cauHinhChung: { gioVao: chung.gioVao, gioRa: chung.gioRa } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});
router.post('/chamcong/nhom', requireAuth, requirePermission('PAYROLL', 'create'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    if (await chanChuaCoNhom(pool, res)) return;
    const ten = String((req.body || {}).tenNhom || '').trim();
    if (!ten) return res.status(400).json({ success: false, message: 'Nhập tên nhóm.' });
    const r = await pool.request().input('t', sql.NVarChar, ten.slice(0, 100))
      .input('g', sql.NVarChar, nn((req.body || {}).ghiChu))
      .query(`INSERT INTO NhomChamCong (TenNhom, GhiChu) OUTPUT INSERTED.NhomID VALUES (@t, @g)`);
    res.json({ success: true, data: { NhomID: (r.recordset[0] || {}).NhomID } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});
router.put('/chamcong/nhom/:id', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    if (await chanChuaCoNhom(pool, res)) return;
    const ten = String((req.body || {}).tenNhom || '').trim();
    if (!ten) return res.status(400).json({ success: false, message: 'Nhập tên nhóm.' });
    await pool.request().input('id', sql.Int, req.params.id).input('t', sql.NVarChar, ten.slice(0, 100))
      .input('g', sql.NVarChar, nn((req.body || {}).ghiChu))
      .query('UPDATE NhomChamCong SET TenNhom=@t, GhiChu=@g WHERE NhomID=@id');
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});
router.delete('/chamcong/nhom/:id', requireAuth, requirePermission('PAYROLL', 'delete'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    if (await chanChuaCoNhom(pool, res)) return;
    /* Go nhan vien ra khoi nhom TRUOC roi moi xoa nhom: FK chan xoa, va quan trong hon la KHONG
       duoc xoa nguoi chi vi xoa nhom. Nguoi ve NULL = tinh theo cau hinh chung. */
    const g = await pool.request().input('id', sql.Int, req.params.id)
      .query('UPDATE NhanVien SET NhomChamCongID = NULL WHERE NhomChamCongID=@id');
    await pool.request().input('id', sql.Int, req.params.id)
      .query('DELETE FROM NhomChamCong WHERE NhomID=@id');
    res.json({ success: true, data: { goRaKhoiNhom: g.rowsAffected[0] } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});
/* Danh sach nhan vien de TICH CHON vao nhom. Tra ca nguoi dang thuoc nhom KHAC (kem ten nhom do) de
   Nguyen thay ro minh dang keo nguoi tu nhom nao sang — mot nguoi chi thuoc DUNG MOT nhom. */
router.get('/chamcong/nhom/:id/nhanvien', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    if (await chanChuaCoNhom(pool, res)) return;
    const rows = (await pool.request().input('id', sql.Int, req.params.id).query(`
      SELECT nv.NhanVienID, nv.MaNhanVien, nv.HoTen, bp.TenBoPhan,
             nv.NhomChamCongID, n.TenNhom AS TenNhomHienTai,
             CASE WHEN nv.NhomChamCongID = @id THEN 1 ELSE 0 END AS DangThuocNhomNay
      FROM NhanVien nv
      LEFT JOIN BoPhan bp ON bp.BoPhanID = nv.BoPhanID
      LEFT JOIN NhomChamCong n ON n.NhomID = nv.NhomChamCongID
      WHERE nv.TrangThaiLaoDong <> N'Đã nghỉ việc'
      ORDER BY nv.HoTen`)).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});
router.post('/chamcong/nhom/:id/nhanvien', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    if (await chanChuaCoNhom(pool, res)) return;
    const nhomId = parseInt(req.params.id, 10);
    const ids = Array.isArray((req.body || {}).nhanVienIds)
      ? req.body.nhanVienIds.map(x => parseInt(x, 10)).filter(x => x > 0) : [];
    /* Ghi de TRON BO thanh vien cua nhom nay: bo tich ai la nguoi do ve NULL (theo cau hinh chung).
       Lam 2 buoc trong 1 transaction — nua duong la co nguoi khong thuoc nhom nao ma cung khong con
       o nhom cu, so cong thang do tinh sai ma khong ai biet. */
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await new sql.Request(tx).input('id', sql.Int, nhomId)
        .query('UPDATE NhanVien SET NhomChamCongID = NULL WHERE NhomChamCongID=@id');
      for (const nv of ids) {
        await new sql.Request(tx).input('nv', sql.Int, nv).input('id', sql.Int, nhomId)
          .query('UPDATE NhanVien SET NhomChamCongID=@id WHERE NhanVienID=@nv');
      }
      await tx.commit();
    } catch (e) { await tx.rollback(); throw e; }
    res.json({ success: true, data: { soNguoi: ids.length } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});
router.post('/chamcong/cauhinh', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body || {};
    /* v8.00: `nhomId` co thi luu vao NhomChamCong.CauHinh, khong co thi luu cau hinh CHUNG nhu cu.
       MOT form phuc vu ca hai (frontend goi lai dung openCauHinhChamCong) — khong viet ban thu hai,
       kheo hai ban troi khoi nhau. */
    const nhomId = b.nhomId ? parseInt(b.nhomId, 10) : null;
    if (nhomId && await chanChuaCoNhom(pool, res)) return;
    /* Goc de roi ve khi mot o khong hop le: luu cho NHOM thi goc la cau hinh CONG TY (khong phai
       CC_DEFAULT) — nhom la ban chinh sua tren nen cong ty, khong phai bat dau lai tu mac dinh nha
       may. Luu cau hinh chung thi goc van la CC_DEFAULT, giu nguyen hanh vi truoc v8.00. */
    const goc = nhomId ? await getCauHinhChamCong(pool) : CC_DEFAULT;
    const soDuong = (v, mac) => { const n = Number(v); return isNaN(n) || n < 0 ? mac : n; };
    const gio = (v, mac) => (phutTuGio(v) != null ? String(v).trim().slice(0, 5) : mac);
    const cfg = {
      gioVao: gio(b.gioVao, goc.gioVao),
      gioRa: gio(b.gioRa, goc.gioRa),
      nghiTruaTu: b.nghiTruaTu === '' ? '' : gio(b.nghiTruaTu, goc.nghiTruaTu),
      nghiTruaDen: b.nghiTruaDen === '' ? '' : gio(b.nghiTruaDen, goc.nghiTruaDen),
      soGioMotCong: soDuong(b.soGioMotCong, goc.soGioMotCong) || 8,
      lamTronCong: soDuong(b.lamTronCong, goc.lamTronCong),
      toiThieuTinhCongPhut: soDuong(b.toiThieuTinhCongPhut, goc.toiThieuTinhCongPhut),
      otBatDauSauPhut: soDuong(b.otBatDauSauPhut, goc.otBatDauSauPhut),
      otLamTronGio: soDuong(b.otLamTronGio, goc.otLamTronGio),
      otToiDaGioNgay: soDuong(b.otToiDaGioNgay, goc.otToiDaGioNgay),
      tinhOtTruocGioVao: !!b.tinhOtTruocGioVao,
      ngayLe: Array.isArray(b.ngayLe) ? b.ngayLe.map(x => String(x).slice(0, 10)).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)) : []
    };
    if (phutTuGio(cfg.gioRa) <= phutTuGio(cfg.gioVao)) {
      return res.status(400).json({ success: false, message: 'Giờ ra phải sau giờ vào.' });
    }
    const json = JSON.stringify(cfg);
    if (nhomId) {
      /* ngayLe KHONG luu o nhom: le la le chung ca cong ty (xem gopCfgNhom — no luon lay ngayLe cua
         cau hinh chung). Luu vao day chi lam nguoi doc CSDL sau nay tuong nhom co ngay le rieng. */
      const cfgNhom = Object.assign({}, cfg); delete cfgNhom.ngayLe;
      const r = await pool.request().input('id', sql.Int, nhomId)
        .input('v', sql.NVarChar(sql.MAX), JSON.stringify(cfgNhom))
        .query('UPDATE NhomChamCong SET CauHinh=@v WHERE NhomID=@id');
      if (!r.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm chấm công.' });
      return res.json({ success: true, data: cfg, nhomId });
    }
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
    /* v8.00: cfg theo NHOM. Nap MOT lan cho ca thang (khong goi CSDL trong vong lap), roi tra cuu
       theo tung NhanVienID. Nguoi chua gan nhom -> `chung`, dung y nhu truoc v8.00.
       ⚠️ tinhCongMotNgay() KHONG SUA MOT DONG NAO — day la phep tinh ra SO CONG roi ra LUONG, doi
       no la doi tien tra cho cong nhan. v8.00 chi doi CHO NAP cfg. */
    const { chung: cfgChung, theoNhanVien: cfgTheoNV } = await getCfgChamCongTheoNhom(pool);
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
      const k = tinhCongMotNgay(cfgTheoNV.get(a.NhanVienID) || cfgChung, ngayStr, a.GioVao, a.GioRa);   // v8.00
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
    /* v8.00: + TenNhom (nhom cham cong). Do bang truoc khi JOIN — ban CSDL chua chay migration_v700
       van chay binh thuong, chi la cot Nhom tra NULL. */
    const coNhom = await coBangNhomChamCong(pool);
    const rows = (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang).query(`
      SELECT nv.NhanVienID, nv.MaNhanVien, nv.HoTen, bp.TenBoPhan,
        ${coNhom ? 'ncc.TenNhom' : "CAST(NULL AS NVARCHAR(100)) AS TenNhom"},
        ISNULL(SUM(cc.SoCong),0) AS TongCong,
        SUM(ISNULL(cc.GioTangCaThuong,0)+ISNULL(cc.GioTangCaChuNhat,0)+ISNULL(cc.GioTangCaLeTet,0)) AS TongGioTangCa,
        COUNT(cc.ID) AS SoNgay
      FROM NhanVien nv
      LEFT JOIN BoPhan bp ON bp.BoPhanID=nv.BoPhanID
      ${coNhom ? 'LEFT JOIN NhomChamCong ncc ON ncc.NhomID = nv.NhomChamCongID' : ''}
      LEFT JOIN ChamCongNgay cc ON cc.NhanVienID=nv.NhanVienID AND YEAR(cc.Ngay)=@n AND MONTH(cc.Ngay)=@t
      WHERE nv.TrangThaiLaoDong <> N'Đã nghỉ việc'
      GROUP BY nv.NhanVienID, nv.MaNhanVien, nv.HoTen, bp.TenBoPhan${coNhom ? ', ncc.TenNhom' : ''}
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
/* v9.45: bộ tính v6.1 (`tinhLuongCongNhat`) ĐÃ GỠ — nó chép từ luong.xlsm tháng 7 và SAI MÔ HÌNH so
   với bảng lương thực tế (có thuế + giảm trừ mà thực tế không áp; thiếu thử việc/KPI/chức vụ/chuyên
   cần; OT không cộng). Thay bằng `tinhLuongV945` ở utils/luongCongNhat.js — thuần túy, có bộ kiểm chạy
   thật trên 47 dòng của bảng T10/2026. */

/* Dò cột v890 trên HopDongLaoDong — KHÔNG cache (bài học v9.35: cache sống qua migration). Có cột
   `KieuLuong` là có cả bộ. Chưa migration thì các cột mới đọc NULL ⇒ bộ tính lùi về 'Thang', không BH,
   không thưởng — vẫn chạy, nhưng màn hình phải nói "chưa chạy migration_v890". */
async function coCotHopDongV890(pool) {
  const r = (await pool.request().query("SELECT COL_LENGTH('HopDongLaoDong','KieuLuong') AS c")).recordset[0] || {};
  return r.c != null;
}
async function coBang(pool, ten) {
  const r = (await pool.request().input('t', sql.NVarChar, ten).query('SELECT OBJECT_ID(@t) AS o')).recordset[0] || {};
  return r.o != null;
}

// Tinh & luu bang luong cong nhat cho 1 thang (ghi de snapshot chi tiet).
router.post('/bangluong/tinh', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'luongcongnhat'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.body.nam, 10), thang = parseInt(req.body.thang, 10);
    if (!nam || !thang) return res.status(400).json({ success: false, message: 'Thiếu năm/tháng.' });
    /* 🔴 v9.32 — CHẶN TÍNH LẠI KHI ĐÃ CHỐT, Ở MÁY CHỦ.
       Màn hình vốn chỉ GIẤU nút khi đã chốt (module.payroll.js), và câu xác nhận lúc chốt hứa
       "sau khi chốt sẽ không tính lại được" — nhưng máy chủ chưa bao giờ chặn: một tab mở từ trước
       lúc chốt vẫn còn nút. Trước v9.32 lỗ này tương đối lành (tính lại ra cùng số). Nay đầu vào
       tiền nằm ở phân hệ KHÁC: kế toán công nợ sửa/xóa một phiếu chi tạm ứng, rồi ai đó bên nhân sự
       bấm Tính lương lại ⇒ bảng lương ĐÃ CHỐT đổi tiền, hai người không biết nhau đang làm gì. */
    const dcHeader = (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang)
      .query(`SELECT TrangThai FROM BangLuong WHERE Nam=@n AND Thang=@t AND Loai=N'CongNhat'`)).recordset[0];
    if (dcHeader && String(dcHeader.TrangThai || '').trim() === 'Đã chốt')
      return res.status(400).json({ success: false,
        message: `Bảng lương tháng ${thang}/${nam} ĐÃ CHỐT nên không tính lại được. `
          + 'Muốn sửa thì bỏ chốt trước — và nhớ là tính lại sẽ lấy số tạm ứng MỚI NHẤT từ phiếu chi.' });
    const cfg = await getConfig(pool);
    const congChuan = await getCongChuan(pool, nam, thang);
    const brackets = await getBrackets(pool);
    const coV890 = await coCotHopDongV890(pool);
    const coV882 = (await pool.request().query("SELECT COL_LENGTH('HopDongLaoDong','QuyKPI') AS c")).recordset[0].c != null;
    const coBLv890 = (await pool.request().query("SELECT COL_LENGTH('BangLuongChiTiet','KieuLuong') AS c")).recordset[0].c != null;
    const cuoiThang = `${nam}-${String(thang).padStart(2, '0')}-${new Date(nam, thang, 0).getDate()}`;

    /* ================================================================================================
       v9.45 — HỢP ĐỒNG LÀ NGUỒN THÔNG SỐ LƯƠNG (Nguyen: "ký hợp đồng có lựa chọn theo KPI hay theo SP").
       Lấy hợp đồng Hiệu lực có TuNgay ≤ cuối tháng, mới nhất. KHÔNG CÓ HỢP ĐỒNG = KHÔNG TÍNH — liệt kê
       riêng để nhân sự thấy ai còn thiếu, thay vì chèn một dòng toàn số 0 vào bảng lương (bản v6.1 làm
       thế, và dòng 0 đồng trông như "người này không có lương" chứ không phải "chưa khai").
       Cột v890 chưa có (chưa migration) ⇒ CAST NULL để câu SQL vẫn chạy.
       ================================================================================================ */
    const cotV890 = coV890
      ? 'hd.KieuLuong, hd.DonGiaNgay, hd.MucDongBH, hd.LuongCoDinhThang, CONVERT(varchar(10), hd.NgayHetThuViec, 23) AS NgayHetThuViec, hd.KieuThuong'
      : "CAST(NULL AS NVARCHAR(10)) AS KieuLuong, CAST(NULL AS DECIMAL(14,2)) AS DonGiaNgay, CAST(NULL AS DECIMAL(14,2)) AS MucDongBH, CAST(NULL AS DECIMAL(14,2)) AS LuongCoDinhThang, CAST(NULL AS varchar(10)) AS NgayHetThuViec, CAST(NULL AS NVARCHAR(10)) AS KieuThuong";
    const dauThang = `${nam}-${String(thang).padStart(2, '0')}-01`;
    const cotV882 = coV882
      ? 'hd.PhuCapChucVu, hd.PhuCapChuyenCan, hd.QuyKPI, hd.SoCongXangXe, hd.SoCongAnTrua, hd.TyLeThuViec'
      : 'CAST(NULL AS DECIMAL(14,2)) AS PhuCapChucVu, CAST(NULL AS DECIMAL(14,2)) AS PhuCapChuyenCan, CAST(NULL AS DECIMAL(14,2)) AS QuyKPI, CAST(NULL AS DECIMAL(6,2)) AS SoCongXangXe, CAST(NULL AS DECIMAL(6,2)) AS SoCongAnTrua, CAST(NULL AS DECIMAL(5,2)) AS TyLeThuViec';
    const emps = (await pool.request().input('cuoi', sql.VarChar(10), cuoiThang).query(`
      SELECT nv.NhanVienID, nv.MaNhanVien, nv.HoTen, ISNULL(nv.SoNguoiPhuThuoc,0) AS SoNguoiPhuThuoc,
        hd.HopDongID, hd.LuongCoBan, hd.PhuCapAnCa, hd.PhuCapTrangPhuc, hd.PhuCapXangXe, hd.PhuCapDienThoai,
        CONVERT(varchar(10), hd.DenNgay, 23) AS DenNgay,
        ${cotV882}, ${cotV890}
      FROM NhanVien nv
      OUTER APPLY (SELECT TOP 1 * FROM HopDongLaoDong h
                   WHERE h.NhanVienID=nv.NhanVienID AND h.TrangThai=N'Hiệu lực'
                     AND (h.TuNgay IS NULL OR h.TuNgay <= @cuoi)
                   ORDER BY h.TuNgay DESC, h.HopDongID DESC) hd
      ${/* ISNULL: NULL <> N'…' là UNKNOWN ⇒ người chưa khai trạng thái sẽ bị LOẠI mà không vào cả danh
           sách "thiếu hợp đồng" — biến mất không dấu vết (rà chéo v9.45). */''}
      WHERE ISNULL(nv.TrangThaiLaoDong, N'') <> N'Đã nghỉ việc'
      ORDER BY nv.HoTen`)).recordset;
    const coHopDong = emps.filter(e => e.HopDongID != null);
    const thieuHopDong = emps.filter(e => e.HopDongID == null).map(e => ({ NhanVienID: e.NhanVienID, MaNhanVien: e.MaNhanVien, HoTen: e.HoTen }));

    /* Chấm công cả tháng, MỘT truy vấn. Ngày và giờ lấy dạng CHUỖI (CONVERT) — driver useUTC=true làm
       Date lệch +7 nếu đọc getDate()/getHours(); xem ghi chú ở /chamcong/:id/excel. */
    const ccRows = (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang).query(`
      SELECT NhanVienID, CONVERT(varchar(10), Ngay, 23) AS ngay, MaCham AS maCham, SoCong AS soCong,
             CONVERT(varchar(5), GioVao, 108) AS gioVao,
             ISNULL(GioTangCaThuong,0)+ISNULL(GioTangCaChuNhat,0)+ISNULL(GioTangCaLeTet,0) AS gioOT
      FROM ChamCongNgay WHERE YEAR(Ngay)=@n AND MONTH(Ngay)=@t`)).recordset;
    const ccTheoNV = new Map();
    ccRows.forEach(r => { if (!ccTheoNV.has(r.NhanVienID)) ccTheoNV.set(r.NhanVienID, []); ccTheoNV.get(r.NhanVienID).push(r); });
    const { chung: cfgCCChung, theoNhanVien: cfgCCTheoNV } = await getCfgChamCongTheoNhom(pool);

    /* KPI tháng + thưởng theo sản phẩm (bảng mới v890 — chưa có thì coi như trống). */
    const kpiMap = new Map(), spMap = new Map();
    if (await coBang(pool, 'DanhGiaKPI')) {
      (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang)
        .query('SELECT NhanVienID, DiemKPI, TienGhiDe FROM DanhGiaKPI WHERE Nam=@n AND Thang=@t')).recordset
        .forEach(r => kpiMap.set(r.NhanVienID, r));
    }
    if (await coBang(pool, 'ThuongSanPhamThang')) {
      (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang)
        .query('SELECT NhanVienID, SUM(SoLuong*DonGia) AS Tien FROM ThuongSanPhamThang WHERE Nam=@n AND Thang=@t GROUP BY NhanVienID')).recordset
        .forEach(r => spMap.set(r.NhanVienID, Number(r.Tien) || 0));
    }

    // Upsert header
    await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang).input('u', sql.Int, req.session.user.userId)
      .query(`MERGE BangLuong AS t USING (SELECT @n AS Nam,@t AS Thang) AS s ON t.Nam=s.Nam AND t.Thang=s.Thang AND t.Loai=N'CongNhat'
        WHEN MATCHED THEN UPDATE SET NgayLap=CAST(SYSDATETIME() AS DATE), NguoiLapID=@u
        WHEN NOT MATCHED THEN INSERT (Nam,Thang,Loai,NgayLap,NguoiLapID) VALUES (@n,@t,N'CongNhat',CAST(SYSDATETIME() AS DATE),@u);`);
    const header = (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang)
      .query(`SELECT BangLuongID FROM BangLuong WHERE Nam=@n AND Thang=@t AND Loai=N'CongNhat'`)).recordset[0];
    const blId = header.BangLuongID;

    /* 🔴 v9.45 — GIỮ ĐIỀU CHỈNH TAY QUA LẦN TÍNH LẠI. Dòng DELETE dưới xóa sạch chi tiết; điều chỉnh
       (+/− có lý do, ví dụ Ngọc −200k nghỉ không phép) là số kế toán gõ, tính lại mà mất là cùng một họ
       lỗi với tạm ứng trước v9.32. Đọc ra trước, ghi lại sau. */
    const dieuChinhCu = new Map();
    if (coBLv890) {
      (await pool.request().input('id', sql.Int, blId)
        .query('SELECT NhanVienID, DieuChinh, LyDoDieuChinh FROM BangLuongChiTiet WHERE BangLuongID=@id')).recordset
        .forEach(r => dieuChinhCu.set(r.NhanVienID, { dieuChinh: Number(r.DieuChinh) || 0, lyDo: r.LyDoDieuChinh || null }));
    }
    /* 🔴 v9.32 — TẠM ỨNG LẤY TỪ PHIẾU CHI, KHÔNG PHẢI SỐ GÕ TAY. Tính bao nhiêu lần cũng ra một số. */
    const tamUngMap = await tongTamUngTheoThang(pool, nam, thang);

    /* DELETE + vòng INSERT trong MỘT giao dịch: lỗi giữa chừng (tràn decimal, mất kết nối) mà không có
       giao dịch thì bảng lương mất sạch dòng cũ, chỉ còn một phần dòng mới — bảng rác đang hiện trên
       màn (rà chéo v9.45). Mẫu `new sql.Request(tran)` theo dms.js. */
    const tran = new sql.Transaction(pool);
    await tran.begin();
    const canhBao = [];
    try {
    await new sql.Request(tran).input('id', sql.Int, blId).query('DELETE FROM BangLuongChiTiet WHERE BangLuongID=@id');
    for (const e of coHopDong) {
      const cfgCC = cfgCCTheoNV.get(e.NhanVienID) || cfgCCChung;
      const g = gomChamCong(ccTheoNV.get(e.NhanVienID) || [], e.NgayHetThuViec, cfgCC && cfgCC.gioVao, cfg.DiMuonChamChuocPhut);
      const kpi = kpiMap.get(e.NhanVienID);
      const dc = dieuChinhCu.get(e.NhanVienID) || { dieuChinh: 0, lyDo: null };
      const inp = Object.assign({}, e, g, {
        conThuViec: !!(e.NgayHetThuViec && String(e.NgayHetThuViec) >= cuoiThang),
        diemKPI: kpi ? kpi.DiemKPI : null,
        tienKPIGhiDe: kpi && kpi.TienGhiDe != null ? kpi.TienGhiDe : null,
        thuongSanPham: spMap.get(e.NhanVienID) || 0,
        tamUng: Number(tamUngMap.get(Number(e.NhanVienID))) || 0,
        dieuChinh: dc.dieuChinh
      });
      const c = tinhLuongV945(inp, cfg, congChuan, brackets);
      if (c.chuaDanhGiaKPI) canhBao.push(`${e.HoTen}: hợp đồng thưởng theo KPI nhưng tháng này CHƯA chấm điểm — đang tính 0.`);
      /* Hợp đồng còn "Hiệu lực" nhưng DenNgay đã qua trước đầu tháng: vẫn dùng (đổi nguồn im lặng là tệ
         hơn), nhưng phải nói — "quên đổi trạng thái" là chuyện thường ở xưởng đông người. */
      if (e.DenNgay && String(e.DenNgay) < dauThang) canhBao.push(`${e.HoTen}: hợp đồng đang dùng đã HẾT HẠN ${String(e.DenNgay).split('-').reverse().join('/')} nhưng còn trạng thái Hiệu lực — kiểm lại ở Nhân sự → Hợp đồng.`);
      if (c.kieuLuong === 'Ngay' && !(Number(e.DonGiaNgay) > 0)) canhBao.push(`${e.HoTen}: lương NGÀY nhưng hợp đồng chưa khai đơn giá ngày — lương = 0.`);
      if (c.kieuLuong === 'Thang' && !(Number(e.LuongCoBan) > 0) && !(Number(e.LuongCoDinhThang) > 0)) canhBao.push(`${e.HoTen}: hợp đồng chưa khai lương cơ bản — lương = 0.`);

      const rq = new sql.Request(tran).input('BangLuongID', sql.Int, blId).input('NhanVienID', sql.Int, e.NhanVienID)
        .input('Cong', sql.Decimal(6, 2), c.cong).input('LuongCoBan', sql.Decimal(14, 2), c.luongCB).input('LuongNgayCong', sql.Decimal(14, 2), c.luongNgayCong)
        .input('PcAnCa', sql.Decimal(14, 2), c.pcAnCa).input('PcTrangPhuc', sql.Decimal(14, 2), c.pcTrangPhuc).input('PcXangXe', sql.Decimal(14, 2), c.pcXangXe).input('PcDienThoai', sql.Decimal(14, 2), c.pcDienThoai)
        .input('TangCa', sql.Decimal(14, 2), c.tangCa).input('Thuong', sql.Decimal(14, 2), c.thuong).input('TnMienThue', sql.Decimal(14, 2), c.tnMienThue).input('TnChiuThue', sql.Decimal(14, 2), c.tnChiuThue)
        .input('BhxhNld', sql.Decimal(14, 2), c.bhxh).input('BhytNld', sql.Decimal(14, 2), c.bhyt).input('BhtnNld', sql.Decimal(14, 2), c.bhtn).input('TongBH', sql.Decimal(14, 2), c.tongBH)
        .input('GiamTruBanThan', sql.Decimal(14, 2), c.giamTruBanThan).input('GiamTruNPT', sql.Decimal(14, 2), c.giamTruNPT).input('TnTinhThue', sql.Decimal(14, 2), c.tnTinhThue)
        .input('ThueTNCN', sql.Decimal(14, 2), c.thue).input('TamUng', sql.Decimal(14, 2), c.tamUng).input('ThucLinh', sql.Decimal(14, 2), c.thucLinh);
      let cotThem = '', giaTriThem = '';
      if (coBLv890) {
        rq.input('KieuLuong', sql.NVarChar(10), c.kieuLuong).input('DonGiaNgay', sql.Decimal(14, 2), c.donGiaNgay)
          .input('CongThuViec', sql.Decimal(6, 2), c.congThuViec).input('CongChinhThuc', sql.Decimal(6, 2), c.congChinhThuc + c.congLe)
          .input('SoPhep', sql.Decimal(6, 2), c.soPhep).input('SoNgayMuon', sql.Int, c.soNgayMuon)
          .input('GioOT', sql.Decimal(7, 2), c.gioOT).input('DonGiaGioOT', sql.Decimal(14, 2), c.donGiaGioOT)
          .input('PcChucVu', sql.Decimal(14, 2), c.pcChucVu).input('ChuyenCan', sql.Decimal(14, 2), c.chuyenCan)
          .input('DieuChinh', sql.Decimal(14, 2), c.dieuChinh).input('LyDoDieuChinh', sql.NVarChar(255), dc.lyDo)
          .input('MucDongBH', sql.Decimal(14, 2), c.mucDongBH).input('DiemKPI', sql.Decimal(5, 2), c.diemKPI)
          .input('KieuThuong', sql.NVarChar(10), c.kieuThuong || null).input('ThueDaTru', sql.Bit, c.thueDaTru ? 1 : 0);
        cotThem = ',KieuLuong,DonGiaNgay,CongThuViec,CongChinhThuc,SoPhep,SoNgayMuon,GioOT,DonGiaGioOT,PcChucVu,ChuyenCan,DieuChinh,LyDoDieuChinh,MucDongBH,DiemKPI,KieuThuong,ThueDaTru';
        giaTriThem = ',@KieuLuong,@DonGiaNgay,@CongThuViec,@CongChinhThuc,@SoPhep,@SoNgayMuon,@GioOT,@DonGiaGioOT,@PcChucVu,@ChuyenCan,@DieuChinh,@LyDoDieuChinh,@MucDongBH,@DiemKPI,@KieuThuong,@ThueDaTru';
      }
      await rq.query(`INSERT INTO BangLuongChiTiet (BangLuongID,NhanVienID,Cong,LuongCoBan,LuongNgayCong,PcAnCa,PcTrangPhuc,PcXangXe,PcDienThoai,TangCa,Thuong,TnMienThue,TnChiuThue,BhxhNld,BhytNld,BhtnNld,TongBH,GiamTruBanThan,GiamTruNPT,TnTinhThue,ThueTNCN,TamUng,ThucLinh${cotThem})
          VALUES (@BangLuongID,@NhanVienID,@Cong,@LuongCoBan,@LuongNgayCong,@PcAnCa,@PcTrangPhuc,@PcXangXe,@PcDienThoai,@TangCa,@Thuong,@TnMienThue,@TnChiuThue,@BhxhNld,@BhytNld,@BhtnNld,@TongBH,@GiamTruBanThan,@GiamTruNPT,@TnTinhThue,@ThueTNCN,@TamUng,@ThucLinh${giaTriThem})`);
    }
    await tran.commit();
    } catch (eTran) {
      try { await tran.rollback(); } catch (_) { /* đã rollback sẵn khi kết nối rơi */ }
      throw eTran;
    }
    /* Không có cột v890: KieuLuong null ⇒ ai cũng tính kiểu THÁNG; MucDongBH null ⇒ không BH; KieuThuong
       null ⇒ không thưởng; không tách thử việc; châm chước đi muộn lấy mặc định 5 phút. Chức vụ / chuyên
       cần / xăng (cột v8.82) VẪN tính. */
    if (!coV890) canhBao.unshift('🔴 Máy chủ CHƯA chạy migration_v890.sql: mọi người đang tính theo kiểu lương THÁNG, không BH, không thưởng KPI/SP, không tách thử việc; các cột mới KHÔNG được lưu. Chạy migration rồi tính lại.');
    res.json({ success: true, data: { bangLuongID: blId, soNhanVien: coHopDong.length, thieuHopDong, canhBao, truThue: !!cfg.TruThueTNCN } });
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

/* v9.45 — SỬA ĐIỀU CHỈNH (+/−) CỦA MỘT DÒNG, BẮT BUỘC CÓ LÝ DO.
   Bảng T10 có Ngọc bị trừ 200k "nghỉ nhiều không xin phép" — trừ thẳng vào Thành tiền, không cột,
   tháng sau không ai biết vì sao số không khớp công thức. Nay: cột riêng + lý do, và `POST /tinh`
   GIỮ nó qua lần tính lại (xem khối ghi chú ở đó).
   🔴 Tạm ứng vẫn KHÔNG sửa tay ở đây (v9.32) — nguồn là phiếu chi. */
router.put('/bangluong/chitiet/:id', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'luongcongnhat'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body || {};
    if (b.tamUng !== undefined) {
      return res.status(400).json({ success: false,
        message: 'Tạm ứng nay lấy tự động từ phiếu chi (Công nợ → Phiếu chi → Chi cho: Nhân viên → loại Tạm ứng). '
          + 'Sửa số ở phiếu chi rồi bấm Tính lương lại.' });
    }
    const coCot = (await pool.request().query("SELECT COL_LENGTH('BangLuongChiTiet','DieuChinh') AS c")).recordset[0].c != null;
    if (!coCot) return res.status(400).json({ success: false, message: 'Chưa chạy migration_v890.sql nên chưa có cột Điều chỉnh.' });
    const id = parseInt(req.params.id, 10);
    const dieuChinh = Math.round(Number(b.dieuChinh) || 0);
    const lyDo = String(b.lyDoDieuChinh || '').trim();
    if (dieuChinh !== 0 && !lyDo) return res.status(400).json({ success: false, message: 'Điều chỉnh khác 0 thì PHẢI ghi lý do.' });
    const ct = (await pool.request().input('id', sql.Int, id).query(`
      SELECT ct.*, bl.TrangThai FROM BangLuongChiTiet ct JOIN BangLuong bl ON bl.BangLuongID=ct.BangLuongID WHERE ct.ID=@id`)).recordset[0];
    if (!ct) return res.status(404).json({ success: false, message: 'Không tìm thấy dòng lương.' });
    if (String(ct.TrangThai || '').trim() === 'Đã chốt') return res.status(400).json({ success: false, message: 'Bảng lương đã chốt — bỏ chốt trước khi sửa.' });
    /* Tính lại thực lĩnh TỪ CÁC CỘT ĐÃ LƯU, cùng công thức với bộ tính — không gọi lại bộ tính vì
       thiếu dữ liệu chấm công ở đây; mọi khoản khác không đổi nên chỉ dịch đúng phần chênh. */
    const cfg = await getConfig(pool);
    const lamTron = Number(cfg.LamTronThucLinh) > 0 ? Number(cfg.LamTronThucLinh) : 1;
    const thueDaTru = ct.ThueDaTru ? Number(ct.ThueTNCN) || 0 : 0;
    const tho = (Number(ct.TnChiuThue) || 0) + (Number(ct.TnMienThue) || 0) - (Number(ct.TongBH) || 0) - thueDaTru - (Number(ct.TamUng) || 0) + dieuChinh;
    const thucLinh = Math.round(tho / lamTron) * lamTron;
    await pool.request().input('id', sql.Int, id).input('dc', sql.Decimal(14, 2), dieuChinh)
      .input('ly', sql.NVarChar(255), lyDo || null).input('tl', sql.Decimal(14, 2), thucLinh)
      .query('UPDATE BangLuongChiTiet SET DieuChinh=@dc, LyDoDieuChinh=@ly, ThucLinh=@tl WHERE ID=@id');
    res.json({ success: true, data: { thucLinh } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

/* ================================================================================================
   v9.45 — ĐÁNH GIÁ KPI THÁNG + THƯỞNG THEO SẢN PHẨM (Nguyen 11/11: "thêm chức năng đánh giá KPI
   từng người", "theo sản phẩm: tên, đơn giá, số lượng = thành tiền", "người có thể nhiều SP, mỗi SP
   một đơn giá").
   Quyền: chức năng 'kpi' (ChucNang mới trong migration_v890).
   ================================================================================================ */
router.get('/kpi', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'kpi'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10), thang = parseInt(req.query.thang, 10);
    if (!nam || !thang) return res.status(400).json({ success: false, message: 'Thiếu năm/tháng.' });
    if (!(await coCotHopDongV890(pool))) return res.status(400).json({ success: false, message: 'Chưa chạy migration_v890.sql.' });
    const cuoiThang = `${nam}-${String(thang).padStart(2, '0')}-${new Date(nam, thang, 0).getDate()}`;
    /* Chỉ người có hợp đồng khai KieuThuong — người không có thưởng thì không có gì để chấm. */
    const ds = (await pool.request().input('cuoi', sql.VarChar(10), cuoiThang).input('n', sql.Int, nam).input('t', sql.Int, thang).query(`
      SELECT nv.NhanVienID, nv.MaNhanVien, nv.HoTen, hd.HopDongID, hd.KieuThuong, hd.QuyKPI,
             k.DiemKPI, k.TienGhiDe, k.NhanXet
      FROM NhanVien nv
      OUTER APPLY (SELECT TOP 1 * FROM HopDongLaoDong h WHERE h.NhanVienID=nv.NhanVienID AND h.TrangThai=N'Hiệu lực'
                   AND (h.TuNgay IS NULL OR h.TuNgay <= @cuoi) ORDER BY h.TuNgay DESC, h.HopDongID DESC) hd
      LEFT JOIN DanhGiaKPI k ON k.NhanVienID=nv.NhanVienID AND k.Nam=@n AND k.Thang=@t
      WHERE ISNULL(nv.TrangThaiLaoDong, N'') <> N'Đã nghỉ việc' AND hd.KieuThuong IS NOT NULL
      ORDER BY nv.HoTen`)).recordset;
    const hdIds = ds.filter(r => r.KieuThuong === 'SanPham').map(r => r.HopDongID);
    const dmSP = new Map();
    if (hdIds.length) {
      (await pool.request().query(`SELECT HopDongID, TenSanPham, DonGia FROM HopDongSanPham WHERE HopDongID IN (${hdIds.join(',')}) ORDER BY ThuTu, ID`)).recordset
        .forEach(r => { if (!dmSP.has(r.HopDongID)) dmSP.set(r.HopDongID, []); dmSP.get(r.HopDongID).push(r); });
    }
    const spThang = new Map();
    (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang)
      .query('SELECT ID, NhanVienID, TenSanPham, DonGia, SoLuong, ThanhTien, GhiChu FROM ThuongSanPhamThang WHERE Nam=@n AND Thang=@t ORDER BY ID')).recordset
      .forEach(r => { if (!spThang.has(r.NhanVienID)) spThang.set(r.NhanVienID, []); spThang.get(r.NhanVienID).push(r); });
    ds.forEach(r => { r.danhMucSanPham = dmSP.get(r.HopDongID) || []; r.sanPhamThang = spThang.get(r.NhanVienID) || []; });
    res.json({ success: true, data: { nam, thang, rows: ds } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

router.put('/kpi/diem', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'kpi'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body || {};
    const nam = parseInt(b.nam, 10), thang = parseInt(b.thang, 10), nv = parseInt(b.nhanVienId, 10);
    if (!nam || !thang || !nv) return res.status(400).json({ success: false, message: 'Thiếu năm/tháng/nhân viên.' });
    const diem = Math.max(0, Math.min(100, Number(b.diemKPI) || 0));
    const ghiDe = b.tienGhiDe === '' || b.tienGhiDe == null ? null : Math.round(Number(b.tienGhiDe) || 0);
    await pool.request().input('nv', sql.Int, nv).input('n', sql.Int, nam).input('t', sql.Int, thang)
      .input('d', sql.Decimal(5, 2), diem).input('g', sql.Decimal(14, 2), ghiDe)
      .input('nx', sql.NVarChar(500), nn(b.nhanXet)).input('u', sql.Int, req.session.user.userId)
      .query(`MERGE DanhGiaKPI AS t USING (SELECT @nv AS NhanVienID, @n AS Nam, @t AS Thang) AS s
              ON t.NhanVienID=s.NhanVienID AND t.Nam=s.Nam AND t.Thang=s.Thang
              WHEN MATCHED THEN UPDATE SET DiemKPI=@d, TienGhiDe=@g, NhanXet=@nx, NguoiDanhGiaID=@u, UpdatedAt=SYSDATETIME()
              WHEN NOT MATCHED THEN INSERT (NhanVienID,Nam,Thang,DiemKPI,TienGhiDe,NhanXet,NguoiDanhGiaID) VALUES (@nv,@n,@t,@d,@g,@nx,@u);`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

/* Thưởng theo sản phẩm: ghi lại TOÀN BỘ dòng của một người trong tháng (xóa hết rồi chèn) — bảng tháng
   của một người chỉ vài dòng, cách này không lệch trạng thái giữa màn hình và CSDL. */
router.put('/kpi/sanpham', requireAuth, requirePermission('PAYROLL', 'edit'), requireChucNang('PAYROLL', 'kpi'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body || {};
    const nam = parseInt(b.nam, 10), thang = parseInt(b.thang, 10), nv = parseInt(b.nhanVienId, 10);
    if (!nam || !thang || !nv) return res.status(400).json({ success: false, message: 'Thiếu năm/tháng/nhân viên.' });
    const ds = Array.isArray(b.rows) ? b.rows : [];
    await pool.request().input('nv', sql.Int, nv).input('n', sql.Int, nam).input('t', sql.Int, thang)
      .query('DELETE FROM ThuongSanPhamThang WHERE NhanVienID=@nv AND Nam=@n AND Thang=@t');
    let tong = 0;
    for (const r of ds) {
      const ten = String(r.tenSanPham || '').trim();
      const sl = Number(r.soLuong) || 0, dg = Number(r.donGia) || 0;
      if (!ten || sl <= 0) continue;
      tong += sl * dg;
      await pool.request().input('nv', sql.Int, nv).input('n', sql.Int, nam).input('t', sql.Int, thang)
        .input('ten', sql.NVarChar(150), ten).input('dg', sql.Decimal(14, 2), dg).input('sl', sql.Decimal(12, 2), sl)
        .input('gc', sql.NVarChar(255), nn(r.ghiChu))
        .query('INSERT INTO ThuongSanPhamThang (NhanVienID,Nam,Thang,TenSanPham,DonGia,SoLuong,GhiChu) VALUES (@nv,@n,@t,@ten,@dg,@sl,@gc)');
    }
    res.json({ success: true, data: { tong: Math.round(tong) } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

/* v9.32 — XEM TỪNG PHIẾU tạo nên con số tạm ứng của một nhân viên trong tháng.
   🔴 Bắt buộc phải có: "tự tính" mà không soi được từng phiếu thì với kế toán nó là hộp đen, và khi
   nhân viên thắc mắc "sao trừ tôi ngần này" thì không ai trả lời được. */
router.get('/bangluong/tamung/:nhanVienId', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'luongcongnhat'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10), thang = parseInt(req.query.thang, 10);
    if (!nam || !thang) return res.status(400).json({ success: false, message: 'Thiếu năm/tháng.' });
    const rows = await chiTietTamUng(pool, parseInt(req.params.nhanVienId, 10), nam, thang);
    res.json({ success: true, data: { rows, tong: rows.reduce((s, r) => s + Number(r.SoTien || 0), 0) } });
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
    /* v9.45: cột theo bảng thực tế (sheet 2 T10/2026) — kiểu lương, thử việc/chính thức, phép, OT,
       KPI, chức vụ, chuyên cần, điều chỉnh có lý do. Thuế vẫn hiện; cột "Thuế đã trừ" nói nó có vào
       thực lĩnh hay không. */
    ws.mergeCells('A1', 'AB1'); ws.getCell('A1').value = `BẢNG LƯƠNG CÔNG NHẬT — THÁNG ${thang}/${nam}`;
    ws.getCell('A1').font = { bold: true, size: 14 }; ws.getCell('A1').alignment = { horizontal: 'center' };
    const head = ['STT', 'Mã NV', 'Họ và tên', 'Kiểu', 'Công TV', 'Công CT (gồm lễ)', 'Phép', 'Muộn', 'Lương CB / Đơn giá ngày', 'Lương',
      'Giờ OT', 'Tiền OT', 'Điểm KPI', 'Thưởng KPI/SP', 'Xăng xe', 'Chức vụ', 'Chuyên cần', 'Ăn ca', 'Trang phục', 'Điện thoại',
      'Mức đóng BH', 'BH 10,5%', 'Thuế TNCN', 'Thuế đã trừ', 'Tạm ứng', 'Điều chỉnh', 'Lý do', 'Thực lĩnh'];
    ws.addRow([]); const hr = ws.addRow(head); hr.font = { bold: true }; hr.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } }; c.border = { bottom: { style: 'thin' } }; });
    const N = (v) => Number(v) || 0;
    data.rows.forEach((r, i) => ws.addRow([i + 1, r.MaNhanVien, r.HoTen,
      r.KieuLuong === 'Ngay' ? 'Ngày' : 'Tháng', N(r.CongThuViec), N(r.CongChinhThuc), N(r.SoPhep), N(r.SoNgayMuon),
      r.KieuLuong === 'Ngay' ? N(r.DonGiaNgay) : N(r.LuongCoBan), N(r.LuongNgayCong),
      N(r.GioOT), N(r.TangCa), r.DiemKPI == null ? '' : N(r.DiemKPI), N(r.Thuong), N(r.PcXangXe), N(r.PcChucVu), N(r.ChuyenCan),
      N(r.PcAnCa), N(r.PcTrangPhuc), N(r.PcDienThoai),
      N(r.MucDongBH), N(r.TongBH), N(r.ThueTNCN), r.ThueDaTru ? 'Có' : 'Không', N(r.TamUng), N(r.DieuChinh), r.LyDoDieuChinh || '', N(r.ThucLinh)]));
    const tong = data.rows.reduce((s, r) => s + N(r.ThucLinh), 0);
    const tongTU = data.rows.reduce((s, r) => s + N(r.TamUng), 0);
    const trRow = new Array(head.length).fill(''); trRow[2] = 'TỔNG CỘNG'; trRow[24] = tongTU; trRow[27] = tong;
    const tr = ws.addRow(trRow); tr.font = { bold: true };
    ws.columns.forEach((c, i) => { c.numFmt = (i >= 4 && i !== 23 && i !== 26) ? '#,##0.##' : undefined; c.width = i === 2 ? 24 : (i === 26 ? 28 : 12); });
    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="BangLuong_T${thang}_${nam}.xlsx"`);
    res.end(Buffer.from(buf));
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

/* v7.97 — XUAT EXCEL CHI TIET CHAM CONG CUA 1 NHAN VIEN TRONG THANG.
   Mo tu man Cham cong: bam HO TEN -> modal chi tiet -> nut "Xuat Excel".

   Quyen: 'view' + chuc nang 'chamcong' — GIONG route GET /chamcong/:nhanVienId da co san, vi day
   chi la ban xuat ra file cua DUNG bang ma nguoi dung dang xem. Khong doi thanh 'edit': nguoi chi
   duoc XEM cham cong van phai xuat duoc bang cua chinh minh/nhan vien minh quan ly.

   ⚠️ Route nay 3 doan (/chamcong/:id/excel) nen KHONG dam nhau voi /chamcong/:nhanVienId (2 doan)
   dat o tren — nhung van phai nam SAU cac route CHU (/chamcong/chitiet, /chamcong/raw,
   /chamcong/cauhinh, /chamcong/template). Xem loi /nhanvien/template chet tu v5.38.

   ⚠️ Ngay/GioVao/GioRa doc TU CSDL nen phai dinh dang bang getUTC* — driver mssql cau hinh
   useUTC=true, dung getHours()/getDate() la lech +7 (07:55 thanh 14:55, ngay 01 thanh ngay 31). */
router.get('/chamcong/:nhanVienId/excel', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'chamcong'), async (req, res) => {
  try {
    const pool = await getPool();
    const nvId = parseInt(req.params.nhanVienId, 10);
    const nam = parseInt(req.query.nam, 10) || new Date().getFullYear();
    const thang = parseInt(req.query.thang, 10) || (new Date().getMonth() + 1);
    if (!nvId) return res.status(400).json({ success: false, message: 'Thiếu mã nhân viên.' });

    const nv = (await pool.request().input('id', sql.Int, nvId).query(`
      SELECT nv.NhanVienID, nv.MaNhanVien, nv.HoTen, bp.TenBoPhan
      FROM NhanVien nv LEFT JOIN BoPhan bp ON bp.BoPhanID = nv.BoPhanID
      WHERE nv.NhanVienID = @id`)).recordset[0];
    if (!nv) return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên.' });

    const rows = (await pool.request().input('id', sql.Int, nvId).input('n', sql.Int, nam).input('t', sql.Int, thang)
      .query(`SELECT * FROM ChamCongNgay WHERE NhanVienID=@id AND YEAR(Ngay)=@n AND MONTH(Ngay)=@t ORDER BY Ngay`)).recordset;

    const ngayDMY = (v) => {
      if (!v) return '';
      const d = new Date(v); if (isNaN(d)) return '';
      return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
    };
    const gioHM = (v) => {
      if (!v) return '';
      if (typeof v === 'string') return v.slice(0, 5);
      const d = new Date(v); if (isNaN(d)) return '';
      return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    };
    const s = (v) => Number(v) || 0;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`ChamCong T${thang}-${nam}`);
    const SO_COT = 12;
    const cotCuoi = String.fromCharCode(64 + SO_COT); // 12 -> 'L'

    ws.mergeCells(`A1:${cotCuoi}1`);
    ws.getCell('A1').value = `CHI TIẾT CHẤM CÔNG — THÁNG ${thang}/${nam}`;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };
    ws.mergeCells(`A2:${cotCuoi}2`);
    ws.getCell('A2').value = `Nhân viên: ${nv.MaNhanVien ? nv.MaNhanVien + ' — ' : ''}${nv.HoTen}`
      + (nv.TenBoPhan ? `    ·    Bộ phận: ${nv.TenBoPhan}` : '');
    ws.getCell('A2').alignment = { horizontal: 'center' };
    ws.addRow([]);

    const head = ['STT', 'Ngày', 'Mã', 'Giờ vào', 'Giờ ra', 'Giờ làm', 'Số công',
      'Giờ TC thường', 'Giờ TC chủ nhật', 'Giờ TC lễ', 'Nguồn', 'Ghi chú'];
    const hr = ws.addRow(head);
    hr.font = { bold: true };
    hr.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    hr.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
      c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    rows.forEach((r, i) => ws.addRow([
      i + 1, ngayDMY(r.Ngay), r.MaCham || '', gioHM(r.GioVao), gioHM(r.GioRa),
      r.SoGioLam != null ? s(r.SoGioLam) : null, s(r.SoCong),
      s(r.GioTangCaThuong), s(r.GioTangCaChuNhat), s(r.GioTangCaLeTet),
      r.Nguon || '', r.GhiChu || ''
    ]));
    if (!rows.length) {
      const tr0 = ws.addRow(['', 'Chưa có ngày chấm công nào trong tháng này.']);
      ws.mergeCells(`B${tr0.number}:${cotCuoi}${tr0.number}`);
      tr0.getCell(2).alignment = { horizontal: 'center' };
      tr0.font = { italic: true };
    }

    // Dong TONG — cong dung `rows` dang xuat, khong goi lai truy van khac (khoi lech voi bang tren).
    const tong = rows.reduce((a, r) => ({
      gioLam: a.gioLam + s(r.SoGioLam), cong: a.cong + s(r.SoCong),
      tcT: a.tcT + s(r.GioTangCaThuong), tcCN: a.tcCN + s(r.GioTangCaChuNhat), tcLe: a.tcLe + s(r.GioTangCaLeTet)
    }), { gioLam: 0, cong: 0, tcT: 0, tcCN: 0, tcLe: 0 });
    const tr = ws.addRow(['', 'TỔNG CỘNG', '', '', '', tong.gioLam, tong.cong, tong.tcT, tong.tcCN, tong.tcLe, '', '']);
    tr.font = { bold: true };
    tr.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F4' } }; });

    // Ke bang toan bo vung du lieu + dinh dang so (chuan phieu: bang phai co ke, so phai co dinh dang).
    for (let r = 4; r <= tr.number; r++) {
      for (let c = 1; c <= SO_COT; c++) {
        ws.getCell(r, c).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      }
    }
    ws.columns.forEach((col, i) => {
      if (i >= 5 && i <= 9) col.numFmt = '#,##0.00';   // Gio lam ... Gio TC le
      col.width = i === 1 ? 12 : (i === 11 ? 26 : (i >= 7 && i <= 9 ? 14 : 11));
      if (i >= 2 && i <= 4) col.alignment = { horizontal: 'center' };
    });

    const buf = await wb.xlsx.writeBuffer();
    // Ten file = ten doi tuong + ky (chuan xuat file da chot). Bo dau vi Content-Disposition ASCII.
    const tenFile = `ChamCong_${khongDau(nv.HoTen || '').replace(/[^A-Za-z0-9]+/g, '')}_T${thang}_${nam}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${tenFile}"`);
    res.end(Buffer.from(buf));
  } catch (err) { console.error('[payroll GET /chamcong/:id/excel]', err); res.status(500).json({ success: false, message: err.message }); }
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
    /* 🔴 v9.32 — AI BỊ LOẠI KHỎI FILE CK THÌ PHẢI NÓI RA.
       Dòng `ThucLinh <= 0` bị bỏ khỏi file ngân hàng. Trước đây hiếm (tạm ứng luôn = 0 lúc tính);
       nay tạm ứng tự chảy vào nên ứng quá lương là ÂM, và người đó biến mất khỏi file mà kế toán
       không hề biết — up lên ngân hàng xong mới phát hiện có người không nhận được gì. */
    const biLoai = [];
    data.rows.forEach((r, i) => {
      if (!(Number(r.ThucLinh) > 0)) {
        biLoai.push(`${r.MaNhanVien || ''} ${r.HoTen} (${Number(r.ThucLinh) < 0 ? 'ÂM ' : ''}${Number(r.ThucLinh).toLocaleString('vi-VN')}đ`
          + `${Number(r.TamUng) > 0 ? ', đã ứng ' + Number(r.TamUng).toLocaleString('vi-VN') + 'đ' : ''})`);
        return;
      }
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
    /* Ghi ngay trong file, dưới bảng — kế toán mở file là thấy, không phải đi tìm ở đâu khác. */
    if (biLoai.length) {
      ws.addRow([]);
      const d = ws.addRow(['⚠️ KHÔNG CHUYỂN KHOẢN ' + biLoai.length + ' người (thực lĩnh <= 0, thường do tạm ứng nhiều hơn lương):']);
      d.font = { bold: true, color: { argb: 'FFC00000' } };
      biLoai.forEach(x => ws.addRow(['', x]));
      ws.addRow(['', 'Kiểm lại ở Công nợ → Phiếu chi (loại Tạm ứng) trước khi gửi ngân hàng.']);
    }
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
   theo don hang (DonHangCongDoanMay), fallback don gia he thong (DonGiaCongDoanMay).
   ⚠️ v8.61: KY LUONG loc theo THANG GHI TIEN DO QC (xem khoi CROSS APPLY trong cau SQL), KHONG con
   theo thang ghi tien do May nhu truoc. Lenh chua qua QC KHONG vao bang luong.
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
    /* ============================================================================================
       v8.61 — KY LUONG TINH THEO THANG GHI TIEN DO QC, KHONG PHAI THANG GHI TIEN DO MAY.
       Nguyen chot 2026-10-01: "Lenh qua QC. QC ghi nhan o thang nao thi tinh tien thang do.
       Vi du hang giao thang 8 nhung QC ghi tien do T9 thi luong tinh vao thang 9."
       + "Dieu kien QC ap cho ca GC/in theu, ca luong khoan may."

       CROSS APPLY (khong phai LEFT): lenh CHUA qua QC se khong co dong nao -> tu dong bi loai khoi
       bang luong. Dung bang dieu kien "qua QC moi tinh vao luong", khong can viet them EXISTS.

       MIN(q.NgayGhiNhan) = LAN GHI QC DAU TIEN, CO Y khong dung MAX: lay MAX thi moi lan ai do ghi
       bo sung QC la CA CUC TIEN NHAY SANG THANG KHAC, ke ca thang da chot va da tra. MIN thi ghi
       QC lan dau xong la thang do chot cung.

       ⚠️ Khop CA MaCongDoan LAN TenCongDoan, da chuan hoa. Ly do: MaCongDoan la DU LIEU nguoi dung
       go duoc o man Danh muc, khong phai hang so — cong doan "Nhat chi" tung co ma that la 'nhatchi'
       chu khong phai 'NCH', lam v8.30/v8.33 KHONG BAO GIO chay (xem v8.50). Khong lap lai loi do.

       v9.02 — (a) khoi CROSS APPLY nay chuyen sang dung CHUNG APPLY_NGAY_QC (co HAVING COUNT(*) > 0,
       xem ghi chu o utils/luongGiaCongInThe.js: MIN() khong GROUP BY luon tra 1 dong, CROSS APPLY
       tran KHONG loai gi — o day van an toan nho WHERE YEAR(qc.NgayQC), nhung dung mot khoi cho ca
       bon bang). (b) Ky = THANG MUON HON giua ngay ghi May va ngay QC dau (bieuThucNgayKy) thay vi
       thang QC thuan: tu v8.74 QC ghi NHIEU DOT, dot May ghi SAU dot QC dau (lo 2 may thang 10, lo 1
       QC 28/9) ma lay thang QC la tien roi vao thang 9 da tra. Voi dong May ghi TRUOC QC (binh thuong)
       ket qua y het v8.61.
       ============================================================================================ */
    ${APPLY_NGAY_QC('td')}
    WHERE qc.NgayQC IS NOT NULL
      AND YEAR(${bieuThucNgayKy('td.NgayGhiNhan')}) = @n AND MONTH(${bieuThucNgayKy('td.NgayGhiNhan')}) = @t ${extra}
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
const { loadGiaCong: __loadGiaCong, loadInThe: __loadInThe, tongHopTheoNha, APPLY_NGAY_QC, OUTER_APPLY_NGAY_QC, bieuThucNgayKy } = require('../utils/luongGiaCongInThe');
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
// (DonHangDonGiaLaDongGoi theo Loai = MaCongDoan). Bảng RIÊNG nên KHÔNG lẫn lương khoán may.
/* v9.02 — GẮN ĐIỀU KIỆN QC (Nguyen 2026-10-24: "tất cả các lệnh SX khi công đoạn QC ghi nhận tiến độ
   mới tính lương"). Trước v9.02 bảng này lọc trần theo tháng ghi Đóng gói, không nhìn QC — là bảng
   lương theo lệnh DUY NHẤT (cùng Trải vải cắt) còn sót sau v8.61.
     · CROSS APPLY ngày QC đầu (APPLY_NGAY_QC, dùng chung với gia công/in thêu): lệnh CHƯA QC không
       có dòng → không vào bảng lương.
     · Kỳ = tháng MUỘN HƠN giữa ngày ghi Đóng gói và ngày QC đầu (bieuThucNgayKy). Đóng gói làm SAU
       QC nên thường = tháng ghi như cũ; chỉ khác khi ai đó ghi Đóng gói TRƯỚC QC (chọn tay công
       đoạn) — khi đó tiền chờ tới tháng QC, không mất.
   Trả thêm NgayQC + NgayKy để màn hình giải thích được vì sao một dòng nằm ở tháng này. */
async function loadLuongLaDongGoi(pool, nam, thang) {
  const ngayKy = bieuThucNgayKy('td.NgayGhiNhan');
  return (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang).query(`
    SELECT c.MaCongDoan AS Loai, nv.NhanVienID, nv.MaNhanVien, nv.HoTen, d.MaDH, d.TenSanPham,
           ms.TenMau, td.NgayGhiNhan, qc.NgayQC, ${ngayKy} AS NgayKy, pc.SoLuong,
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
    ${APPLY_NGAY_QC('td')}
    WHERE c.MaCongDoan IN ('LA','DG') AND qc.NgayQC IS NOT NULL
      AND YEAR(${ngayKy})=@n AND MONTH(${ngayKy})=@t
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

// Danh sách SƠ ĐỒ đã cắt THUỘC KỲ + tiền từng sơ đồ.
/* v9.18 — BỎ ĐIỀU KIỆN QC CHO RIÊNG QUỸ CẮT (Nguyen 2026-11-04: "sửa lại lương bộ phận cắt —
   tính theo ngày cập nhật tiến độ trong tháng"; chốt qua hỏi đáp: "Bỏ hẳn chờ QC", phạm vi CHỈ
   bảng Lương trải vải cắt):
     · Kỳ của một sổ cắt = THÁNG GHI SỔ CẮT (td.NgayGhiNhan) — cắt tháng nào ăn quỹ tháng đó.
     · Lệnh CHƯA QC vẫn vào quỹ. Cột NgayQC giữ lại CHỈ ĐỂ HIỂN THỊ (OUTER_APPLY_NGAY_QC — bản
       OUTER không gate; trống = lệnh chưa QC).
   ⚠️ BA BẢNG CÒN LẠI (khoán may, GC/in thêu, là/đóng gói) GIỮ NGUYÊN luật v9.02 chờ QC — đây là
   ngoại lệ có chủ đích cho mỗi bộ phận cắt, đừng "đồng bộ cho giống nhau" chiều nào.
   Lịch sử: trước v9.02 quỹ cắt vốn tính theo tháng ghi (y như bây giờ); v9.02 chuyển sang chờ QC
   kỳ-tháng-muộn-hơn (quỹ T8 85,6tr→22,4tr, T9 48,9tr→73,2tr); v9.18 quay về theo tháng ghi —
   quỹ các tháng đổi lại, đối chiếu bằng database/kiem_tra_v918_quy_cat_theo_thang.sql TRƯỚC khi
   tin bảng lương; tháng đã trả theo số v9.02 thì xử lý nghiệp vụ, không truy thu tự động.
   GIỜ CÔNG chia quỹ vẫn theo tháng chấm công (loadGioCongCat) — không đổi. */
async function loadSoDoCat(pool, nam, thang, donGia) {
  return (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang).input('g', sql.Decimal(18, 4), donGia).query(`
    SELECT td.TienDoID, td.NgayGhiNhan, td.SttSoCat, td.SoDoID, qc.NgayQC, td.NgayGhiNhan AS NgayKy,
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
                         WHERE tv.TienDoID = td.TienDoID FOR XML PATH('')), 1, 2, ''), nvt.HoTen) AS NhanVienTraiVai,
           /* v9.20: ID người cắt + danh sách ID người trải vải — để phiếu lương của MỘT nhân viên
              lọc ra đúng bàn cắt người đó tham gia. 🔴 Lọc theo ID, KHÔNG theo tên: hai người trùng
              họ tên là phiếu lương hiện nhầm bàn của nhau mà không ai biết.
              Lùi về td.NhanVienTraiVaiID y như cột tên ở trên (bàn ghi trước khi có bảng
              TienDoTraiVai nhiều người). */
           td.NhanVienCatID,
           ISNULL(STUFF((SELECT ',' + CAST(tv.NhanVienID AS NVARCHAR(20)) FROM TienDoTraiVai tv
                         WHERE tv.TienDoID = td.TienDoID FOR XML PATH('')), 1, 1, ''),
                  CAST(td.NhanVienTraiVaiID AS NVARCHAR(20))) AS NhanVienTraiVaiIDs
    FROM TienDoSanXuat td
    JOIN CongDoanSanXuat c ON c.StageID = td.StageID
    JOIN DonHangSanXuat d ON d.DonHangID = td.DonHangID
    LEFT JOIN DonHangChiTietSoDo sd ON sd.ID = td.SoDoID
    LEFT JOIN NhanVien nvc ON nvc.NhanVienID = td.NhanVienCatID
    LEFT JOIN NhanVien nvt ON nvt.NhanVienID = td.NhanVienTraiVaiID
    ${OUTER_APPLY_NGAY_QC('td')}
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

/* v9.19 — NGAY CAT cua mot LENH tren bang "Ban cat theo lenh san xuat" (Nguyen 2026-11-04:
   "doi ten cot ngay QC thanh ngay cat, cap nhat theo ngay ghi tien do").
   Mot lenh co NHIEU so do, moi so do ghi mot ngay khac nhau => gop thanh KHOANG dau–cuoi; cung mot
   ngay thi hien MOT ngay. KHONG lay dai dien mot ngay (vd ngay dau) roi im lang: nguoi xem se tuong
   ca lenh cat trong dung ngay do. Ham THUAN de bo tu kiem chay duoc ca dong du lieu that. */
const ddmmyyyy = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '';
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
};
function chuoiNgayCat(o) {
  const a = ddmmyyyy(o && o.NgayCatDau), b = ddmmyyyy(o && o.NgayCatCuoi);
  if (!a && !b) return '';
  if (!a || !b || a === b) return a || b;
  return a + ' – ' + b;
}

function tongHopLuongCat(soDo, nhanVien) {
  // Gộp theo lệnh SX (mỗi lệnh có bao nhiêu sơ đồ + tổng tiền).
  const theoDon = [];
  const map = {};
  soDo.forEach(s => {
    const k = s.DonHangID;
    if (!map[k]) {
      /* v9.02: NgayQC cua lenh (moi so do cua cung lenh co cung NgayQC) — tu v9.18 chi con la thong
         tin tham khao (quy khong cho QC nua).
         v9.19: + NgayCatDau/NgayCatCuoi (MIN/MAX ngay ghi so cat) cho cot "Ngay cat"; + MaRap gop
         tu cac so do cua lenh — route con doi chieu them voi maRapTheoDon() (nguon Ky thuat day du). */
      map[k] = { DonHangID: k, MaDH: s.MaDH, MaSanPham: s.MaSanPham, TenSanPham: s.TenSanPham, NgayQC: s.NgayQC || null,
                 NgayCatDau: null, NgayCatCuoi: null, MaRap: '', SoSoDo: 0, TongLop: 0, ThanhTien: 0 };
      theoDon.push(map[k]);
    }
    map[k].SoSoDo += 1;
    map[k].TongLop += Number(s.TongLop) || 0;
    map[k].ThanhTien += Number(s.ThanhTien) || 0;
    const ng = s.NgayGhiNhan ? new Date(s.NgayGhiNhan) : null;
    if (ng && !isNaN(ng.getTime())) {
      if (!map[k].NgayCatDau || ng < new Date(map[k].NgayCatDau)) map[k].NgayCatDau = s.NgayGhiNhan;
      if (!map[k].NgayCatCuoi || ng > new Date(map[k].NgayCatCuoi)) map[k].NgayCatCuoi = s.NgayGhiNhan;
    }
    const mr = String(s.MaRap || '').trim();
    if (mr && !map[k].MaRap.split(', ').filter(Boolean).includes(mr)) {
      map[k].MaRap = map[k].MaRap ? map[k].MaRap + ', ' + mr : mr;
    }
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

/* v9.19 — MÃ RẬP của lệnh trên bảng "Bàn cắt theo lệnh sản xuất" (Nguyen: "sửa mã hàng thành mã
   rập, điền mã rập từ công đoạn kỹ thuật sang").
   🔴 Mã rập nằm ở HAI nơi, cả hai đều do Kỹ thuật gõ: DonHangChiTietSoDo.MaRap (bảng Sơ đồ) và
   TienDoSanXuat.MaRap (ghi tiến độ Kỹ thuật) — đọc MỘT nguồn là trống oan, đã vấp hai lần (v6.06,
   v7.67). Dùng CHUNG utils/maRapCuaDon.js, KHÔNG chép tay câu SQL lần thứ ba.
   Lùi về mã rập gộp từ các sơ đồ trong kỳ (tongHopLuongCat đã gom) khi util không trả gì. */
const { maRapTheoDon } = require('../utils/maRapCuaDon');
/* ⚠️ THỨ TỰ ƯU TIÊN (rà chéo v9.19 chỉ ra): mã rập của CÁC SƠ ĐỒ ĐÃ CẮT TRONG KỲ đi TRƯỚC
   (tongHopLuongCat đã gom), chỉ khi trống mới lùi về mã rập của CẢ LỆNH (util, mọi sơ đồ + mọi lần
   ghi tiến độ KT). Lấy ngược lại thì lệnh cắt dở nhiều tháng hiện "Số sơ đồ: 2" mà cột Mã rập ra
   đủ 5 mã của cả lệnh — người đối chiếu tưởng thiếu sơ đồ. */
async function ganMaRapChoLenh(pool, theoDon) {
  const mr = await maRapTheoDon(pool);   // tự nuốt lỗi, trả {} — không chặn bảng lương
  (theoDon || []).forEach(o => { o.MaRap = o.MaRap || mr[o.DonHangID] || ''; });
  return theoDon;
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
    await ganMaRapChoLenh(pool, th.theoDon);   // v9.19
    res.json({ success: true, data: Object.assign({ nam, thang, donGia: cfg.donGia, soDo }, th) });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

/* v9.19 — XUẤT EXCEL lương trải vải cắt (Nguyen: "thêm chức năng xuất excel").
   BA sheet đúng ba bảng đang xem trên màn, cùng một bộ số (gọi lại chính các loader của route GET
   ở trên — không viết câu SQL thứ hai, kẻo file Excel và màn hình ra hai con số). */
router.get('/luongtraivaicat/excel', requireAuth, requirePermission('PAYROLL', 'view'), requireChucNang('PAYROLL', 'luongtraivaicat'), async (req, res) => {
  try {
    const pool = await getPool();
    const nam = parseInt(req.query.nam, 10) || new Date().getFullYear();
    const thang = parseInt(req.query.thang, 10) || (new Date().getMonth() + 1);
    const cfg = await getCauHinhLuongCat(pool);
    const soDo = await loadSoDoCat(pool, nam, thang, cfg.donGia);
    const nvRaw = await loadGioCongCat(pool, nam, thang);
    const th = tongHopLuongCat(soDo, nvRaw);
    await ganMaRapChoLenh(pool, th.theoDon);
    const maRapTheoLenh = {};
    (th.theoDon || []).forEach(o => { maRapTheoLenh[o.DonHangID] = o.MaRap || ''; });

    const wb = new ExcelJS.Workbook();
    const dauTrang = (ws, tieuDe, soCot) => {
      ws.mergeCells(1, 1, 1, soCot);
      ws.getCell('A1').value = tieuDe;
      ws.getCell('A1').font = { bold: true, size: 14 };
      ws.getCell('A1').alignment = { horizontal: 'center' };
      ws.addRow([]);
    };

    // Sheet 1 — bảng lương nhân viên bộ phận Cắt
    const ws1 = wb.addWorksheet(`Luong NV cat T${thang}-${nam}`);
    dauTrang(ws1, `BẢNG LƯƠNG NHÂN VIÊN BỘ PHẬN CẮT — THÁNG ${thang}/${nam}`, 6);
    ws1.addRow(['Mã NV', 'Họ tên', 'Giờ công', 'Hệ số', 'Lương 1 giờ', 'Lương khoán tháng']).font = { bold: true };
    (th.nhanVien || []).forEach(n => ws1.addRow([n.MaNhanVien || '', n.HoTen || '', Number(n.TongGioLam) || 0,
      Number(n.HeSoLuong) || 0, Number(th.donGiaGio) || 0, Number(n.ThanhTien) || 0]));
    ws1.addRow(['', 'TỔNG', Number(th.tongGio) || 0, '', '', Number(th.tongLuong) || 0]).font = { bold: true };
    ws1.columns.forEach((c, i) => { c.width = i === 1 ? 26 : 15; if (i >= 2) c.numFmt = '#,##0.##'; });

    // Sheet 2 — bàn cắt theo lệnh sản xuất (đúng cột của màn: Mã rập + Ngày cắt — v9.19)
    const ws2 = wb.addWorksheet(`Ban cat theo lenh`);
    dauTrang(ws2, `BÀN CẮT THEO LỆNH SẢN XUẤT — THÁNG ${thang}/${nam}`, 7);
    ws2.addRow(['Mã ĐH', 'Mã rập', 'Tên sản phẩm', 'Ngày cắt', 'Số sơ đồ', 'Tổng lớp', 'Thành tiền']).font = { bold: true };
    (th.theoDon || []).forEach(o => ws2.addRow([o.MaDH || '', o.MaRap || '', o.TenSanPham || '', chuoiNgayCat(o),
      Number(o.SoSoDo) || 0, Number(o.TongLop) || 0, Number(o.ThanhTien) || 0]));
    ws2.addRow(['', '', 'TỔNG BÀN CẮT', '', (soDo || []).length, '', Number(th.quy) || 0]).font = { bold: true };
    ws2.columns.forEach((c, i) => { c.width = i === 2 ? 30 : (i === 3 ? 22 : 16); if (i >= 4) c.numFmt = '#,##0.##'; });

    // Sheet 3 — chi tiết từng sơ đồ
    const ws3 = wb.addWorksheet(`Chi tiet so do`);
    dauTrang(ws3, `CHI TIẾT SƠ ĐỒ ĐÃ CẮT — THÁNG ${thang}/${nam}`, 10);
    ws3.addRow(['Mã ĐH', 'Mã rập', 'Ngày cắt', 'STT sổ cắt', 'Mét sơ đồ', 'Khổ vải', 'Tổng lớp', 'Người trải vải', 'Người cắt', 'Thành tiền']).font = { bold: true };
    (soDo || []).forEach(s => ws3.addRow([s.MaDH || '', String(s.MaRap || '').trim() || maRapTheoLenh[s.DonHangID] || '',
      ddmmyyyy(s.NgayGhiNhan), s.SttSoCat != null ? String(s.SttSoCat) : '',
      Number(s.MetSoDoDai) || 0, Number(s.KhoVaiSoDo) || 0, Number(s.TongLop) || 0,
      s.NhanVienTraiVai || '', s.NhanVienCat || '', Number(s.ThanhTien) || 0]));
    ws3.addRow(['', '', '', '', '', '', '', '', 'TỔNG', Number(th.quy) || 0]).font = { bold: true };
    ws3.columns.forEach((c, i) => { c.width = (i === 7 || i === 8) ? 24 : 16; if (i >= 4 && i <= 6) c.numFmt = '#,##0.##'; });
    ws3.getColumn(10).numFmt = '#,##0';

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="LuongTraiVaiCat_T${thang}_${nam}.xlsx"`);
    res.end(Buffer.from(buf));
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
