/* ================================================================================================
   PHAN HE BAO CAO KINH DOANH  (v6.26)
   ------------------------------------------------------------------------------------------------
   5 nhom bao cao, tat ca deu theo KY (tu ngay - den ngay):
     1. /tonhanghoa   Nhap - Xuat - Ton thanh pham (The kho hang hoa)
     2. /tonvai       Nhap - Xuat - Ton kho vai (theo KG, kem so met)
     3. /tonphukien   Nhap - Xuat - Ton kho phu kien
     4. /taichinh     Quy tien mat + ngan hang, cong no phai thu / phai tra, dong tien trong ky
     5. /kinhdoanh    Doanh thu - Gia von - Chi phi = Loi nhuan (ket qua kinh doanh)

   ------------------------------------------------------------------------------------------------
   ⚠️ NGUYEN TAC TINH TON DAU KY - DOC KY TRUOC KHI SUA
   ------------------------------------------------------------------------------------------------
   Ca 3 kho deu KHONG luu lich su ton theo thoi diem:
     - TheKhoChiTietMau.NhapCai/XuatCai   = so LUY KE, khong co ngay.
     - VaiCay.KGNhap - SUM(KGXuat)        = ton hien tai, khong co ngay.
     - Ton phu kien                        = SUM(Nhap) - SUM(Xuat), co ngay o dau phieu.
   => KHONG the "cong don tu dau" de ra ton dau ky, vi mot phan so lieu (nhap/sua tay tren the kho,
      import Excel ton dau) KHONG co ngay.

   Cach lam (LUON CAN DOI, khong bao gio lech):
        Ton cuoi ky (tai ngay D) := Ton HIEN TAI - Nhap(D+1 .. hom nay) + Xuat(D+1 .. hom nay)
        Ton dau  ky (tai ngay F) := Ton HIEN TAI - Nhap(F   .. hom nay) + Xuat(F   .. hom nay)
   Suy ra: Ton dau + Nhap trong ky - Xuat trong ky = Ton cuoi  (dung ve mat dai so, luon khop).
   Nghia la: moi thay doi KHONG CO CHUNG TU (sua tay, import ton dau) deu duoc coi nhu xay ra
   TRUOC ky bao cao va nam gon trong "Ton dau ky" — dung voi thuc te vi do chinh la so du dau.

   Chung tu CO NGAY dung de tinh Nhap/Xuat trong ky:
     Thanh pham  NHAP: TienDoSanXuat cong doan 'KN' (Kho nhap) -> TienDoChiTietMau  [NgayGhiNhan]
                 XUAT: PhieuBanHang -> PhieuBanHangChiTiet                          [NgayBan]
                     + DonKhachDatHang da tru ton truc tiep (du lieu truoc v6.23)   [ThoiGian]
     Vai         NHAP: VaiCay                                                       [NgayNhap]
                 XUAT: PhieuXuatVaiChiTiet -> PhieuXuatVai                          [NgayXuat]
     Phu kien    NHAP/XUAT: PhieuPhuKienChiTiet -> PhieuPhuKien (LoaiPhieu)         [Ngay]
   ================================================================================================ */
const express = require('express');
const ExcelJS = require('exceljs');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');

const router = express.Router();

// Luoi an toan cho handler async (giong khohang.js/banhang.js - Express 4 khong tu bat loi trong async)
['get', 'post', 'put', 'delete'].forEach(method => {
  const goc = router[method].bind(router);
  router[method] = (path, ...handlers) => goc(path, ...handlers.map(h => (
    h.length >= 4 ? h : (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)
  )));
});

/* ================================ helper chung ================================ */
function so(v) { const n = Number(v); return isFinite(n) ? n : 0; }
function lam2(v) { return Math.round(so(v) * 100) / 100; }
function tien(v) { return Math.round(so(v)); }   // VND khong co xu (cung quy tac voi banhang.js)
/* v6.31: "don vi GOP" nhan dien bang DonViQuyDoi cua chinh ma hang, khong so ten voi 'Ri'.
   ⚠️ Ban sao: banhang.js, khohang.js, public.js, frontend/js/common.js — sua phai sua dong bo. */
function chuanDV(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
function donViChinhLaGop(mh) {
  const cb = chuanDV(mh && (mh.DonViCoBan != null ? mh.DonViCoBan : mh.DonVi));
  const qd = chuanDV(mh && mh.DonViQuyDoi);
  return qd ? cb === qd : cb === 'ri';
}

/* Ky bao cao: mac dinh THANG HIEN TAI. Tra ve chuoi 'YYYY-MM-DD' de dua thang vao SQL DATE. */
function layKy(q) {
  const homNay = new Date();
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hopLe = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim());
  const tuNgay = hopLe(q.tuNgay) ? String(q.tuNgay).trim() : iso(new Date(homNay.getFullYear(), homNay.getMonth(), 1));
  const denNgay = hopLe(q.denNgay) ? String(q.denNgay).trim() : iso(homNay);
  return { tuNgay, denNgay, homNay: iso(homNay) };
}

/* Dat 3 tham so ngay chuan cho moi truy van bao cao. */
function rqKy(pool, ky) {
  return pool.request()
    .input('tu', sql.Date, ky.tuNgay)
    .input('den', sql.Date, ky.denNgay)
    .input('nay', sql.Date, ky.homNay);
}

/* Do cot/bang co ton tai khong (CSDL that co the chua chay het migration). */
const _cacheCot = new Map();
async function coCot(pool, bang, cot) {
  const k = bang + '.' + cot;
  if (!_cacheCot.has(k)) {
    try {
      const r = (await pool.request().query(`SELECT COL_LENGTH('${bang}','${cot}') AS c`)).recordset[0] || {};
      _cacheCot.set(k, r.c != null);
    } catch (e) { _cacheCot.set(k, false); }
  }
  return _cacheCot.get(k);
}
const _cacheBang = new Map();
async function coBang(pool, bang) {
  if (!_cacheBang.has(bang)) {
    try {
      const r = (await pool.request().query(`SELECT OBJECT_ID('dbo.${bang}','U') AS o`)).recordset[0] || {};
      _cacheBang.set(bang, r.o != null);
    } catch (e) { _cacheBang.set(bang, false); }
  }
  return _cacheBang.get(bang);
}

/* Gop cac mang phat sinh vao 1 Map theo khoa. */
function gomVao(map, rows, khoaFn, truong) {
  rows.forEach(r => {
    const k = khoaFn(r);
    if (!map.has(k)) return;
    map.get(k)[truong] += so(r.SL);
  });
}

/* ================================================================================================
   1. TON KHO HANG HOA (thanh pham)
   Don vi: DON VI CHINH cua ma hang (TheKhoHangHoa.DonViCoBan - co the la 'Ri').
   Quy doi: 1 <DonViQuyDoi> = LoaiRi <DonViCoBan>?  KHONG — LoaiRi la so CAI trong 1 Ri.
            NhapCai/XuatCai luu theo DON VI CHINH (xem ghi chu 2 don vi trong banhang.js).
   ================================================================================================ */
async function baoCaoTonHangHoa(pool, ky) {
  // Ton HIEN TAI theo tung ma hang (cong het cac mau)
  const tonNay = (await pool.request().query(`
    SELECT h.MaHangID, h.MaHang, h.TenHang, h.DonViCoBan, h.DonViQuyDoi, h.LoaiRi, h.GiaBan,
           dm.TenTheKho AS TenDanhMuc,
           ISNULL(SUM(t.TonCai), 0) AS Ton
    FROM TheKhoHangHoa h
    -- v6.89: vw_TonTheoMau = NhapCai (khai o the kho) + NhapTuPhieu (PHIEU NHAP KHO) - XuatCai.
    -- Truoc day cong thang tu TheKhoChiTietMau nen hang nhap bang phieu nhap kho KHONG hien tren
    -- bao cao ton. Xem migration_v682.
    LEFT JOIN vw_TonTheoMau t ON t.MaHangID = h.MaHangID
    LEFT JOIN TheKhoDanhMuc dm ON dm.TheKhoDanhMucID = h.TheKhoDanhMucID
    GROUP BY h.MaHangID, h.MaHang, h.TenHang, h.DonViCoBan, h.DonViQuyDoi, h.LoaiRi, h.GiaBan, dm.TenTheKho
    ORDER BY h.MaHang`)).recordset;

  const map = new Map();
  tonNay.forEach(r => map.set(r.MaHangID, {
    MaHangID: r.MaHangID, MaHang: r.MaHang, TenHang: r.TenHang, TenDanhMuc: r.TenDanhMuc || '',
    DonVi: r.DonViCoBan || 'Cái', DonViCoBan: r.DonViCoBan || 'Cái',
    DonViQuyDoi: r.DonViQuyDoi || '', LoaiRi: Number(r.LoaiRi) || 1,
    GiaBan: so(r.GiaBan), TonHienTai: so(r.Ton),
    NhapKy: 0, XuatKy: 0, NhapSauKy: 0, XuatSauKy: 0
  }));

  /* --- NHAP: PHIEU NHAP KHO HANG HOA — NGUON DUY NHAT (v6.91) ---
     ⚠️ DA GO HAN duong "cong doan Kho nhap (KN) cua lenh SX". Ly do (chinh nguoi dung chot):
     MOI hang ton kho tu nay deu phai qua PHIEU NHAP KHO. Duong KN ra doi hoi chua co phan he ban
     hang / cong no, chi de theo doi tam; giu ca hai nguon la mo duong dem hai lan va phai luon nho
     dieu kien loai tru cheo giua baocao.js va qlsx.js.
     => Nhap trong ky = SUM(SoLuongChinh) cua cac phieu chua huy co NgayNhap trong ky.
     SoLuongChinh da theo DON VI CHINH cua ma hang -> cung don vi voi cot Ton, khong phai quy doi.

     ⚠️ Ton dau/cuoi ky duoc suy ra bang cach LUI tu ton hien tai theo chung tu:
        TonCuoi = TonHienTai - NhapSauKy + XuatSauKy;  TonDau = TonCuoi - NhapKy + XuatKy.
     Ton hien tai (vw_TonTheoMau) VAN gom ca phan NhapCai cu (go tay o the kho / KN truoc day). Phan
     do khong co ngay nen se nam trong "Ton dau ky" — dung, va da ghi ro o `ghiChu` cuoi ham. */
  let nhapPhieuKy = [], nhapPhieuSau = [];
  if (await coBang(pool, 'PhieuNhapKhoHangChiTiet')) {
    const sqlNhapPhieu = `
      SELECT ct.MaHangID, ISNULL(SUM(ct.SoLuongChinh), 0) AS SL
      FROM PhieuNhapKhoHangChiTiet ct
      JOIN PhieuNhapKhoHang p ON p.PhieuNKID = ct.PhieuNKID
      WHERE p.TrangThai <> N'Đã hủy' AND p.NgayNhap BETWEEN @a AND @b
      GROUP BY ct.MaHangID`;
    nhapPhieuKy = (await pool.request().input('a', sql.Date, ky.tuNgay).input('b', sql.Date, ky.denNgay)
      .query(sqlNhapPhieu)).recordset;
    nhapPhieuSau = (await pool.request().input('a', sql.Date, ky.denNgay).input('b', sql.Date, ky.homNay)
      .query(sqlNhapPhieu.replace('BETWEEN @a AND @b', '> @a AND p.NgayNhap <= @b'))).recordset;
  }

  /* --- GIA NHAP (v6.91) ---
     A) HANG MUA NGOAI: BINH QUAN GIA QUYEN tren toan bo phieu nhap tu NCC (chua huy):
          gia = SUM(ThanhTien) / SUM(SoLuongChinh)
        Chia cho SoLuongChinh (KHONG phai SoLuong) de gia ra dung DON VI CHINH — cung don vi voi cot
        Ton, nho vay Gia tri ton = Ton x Gia nhap moi khop.
        Chi tinh dong CO tien (ThanhTien > 0): dong gia 0 keo binh quan tut xuong sai.
     B) HANG NHA SAN XUAT: phieu loai 'SanXuat' luon co DonGia = 0 (nhapkho.js: khong sinh cong no ao),
        nen KHONG the lay gia tu phieu. Phai lay GIA THANH cua lenh SX ma phieu do gan vao ->
        bang GiaVonHangHoa (nut "Nạp từ lệnh SX" o Bao cao gia von tinh san va chot lai o day).
        Uu tien A truoc: ma nao vua mua ngoai vua tu san xuat thi tien that da bo ra la o phieu NCC. */
  let giaNhapRs = [];
  if (await coBang(pool, 'PhieuNhapKhoHangChiTiet')) {
    const coGiaVon = await coBang(pool, 'GiaVonHangHoa');
    giaNhapRs = (await pool.request().query(`
      SELECT h.MaHangID,
             bq.SoLuong AS SLMua, bq.SoTien AS TienMua,
             ${coGiaVon ? 'gv.GiaVon, gv.NguonGia, gv.MaDHNguon' : 'NULL AS GiaVon, NULL AS NguonGia, NULL AS MaDHNguon'}
      FROM TheKhoHangHoa h
      OUTER APPLY (
        SELECT ISNULL(SUM(ct.SoLuongChinh), 0) AS SoLuong, ISNULL(SUM(ct.ThanhTien), 0) AS SoTien
        FROM PhieuNhapKhoHangChiTiet ct
        JOIN PhieuNhapKhoHang p ON p.PhieuNKID = ct.PhieuNKID
        WHERE ct.MaHangID = h.MaHangID AND p.TrangThai <> N'Đã hủy'
          AND p.LoaiNhap = N'NhaCungCap' AND ISNULL(ct.ThanhTien, 0) > 0
      ) bq
      ${coGiaVon ? 'LEFT JOIN GiaVonHangHoa gv ON gv.MaHangID = h.MaHangID' : ''}`)).recordset;
  }
  const giaNhapMap = new Map();
  giaNhapRs.forEach(r => {
    const slMua = so(r.SLMua), tienMua = so(r.TienMua);
    if (slMua > 0 && tienMua > 0) {
      giaNhapMap.set(r.MaHangID, { gia: tienMua / slMua, nguon: 'Phiếu nhập (BQGQ)' });
    } else if (so(r.GiaVon) > 0) {
      /* GiaVonHangHoa.GiaVon la gia 1 DON VI GOC (cung don vi voi GiaBan). Cot Ton theo DON VI CHINH;
         ma nao co don vi chinh la don vi GOP thi phai nhan he so de ve cung don vi. */
      giaNhapMap.set(r.MaHangID, {
        gia: so(r.GiaVon),
        goc: true,
        nguon: r.NguonGia === 'Lệnh SX' ? (r.MaDHNguon ? 'Lệnh SX ' + r.MaDHNguon : 'Lệnh SX') : (r.NguonGia || 'Khai tay')
      });
    }
  });

  /* --- XUAT 1: phieu ban hang (duong tru ton duy nhat tu v6.23) --- */
  const sqlXuatBH = `
    SELECT h.MaHangID,
           /* v6.31: "don vi chinh la don vi GOP" = DonViCoBan trung DonViQuyDoi cua chinh ma hang do
              (truoc day so cung voi N'ri'). Chua khai DonViQuyDoi thi lui ve quy tac cu. */
           SUM(CASE WHEN LOWER(LTRIM(RTRIM(h.DonViCoBan))) =
                         LOWER(LTRIM(RTRIM(ISNULL(NULLIF(LTRIM(RTRIM(h.DonViQuyDoi)), N''), N'ri'))))
                     AND h.LoaiRi > 0
                    THEN CAST(ct.SoLuongCai AS DECIMAL(18,4)) / h.LoaiRi ELSE ct.SoLuongCai END) AS SL
    FROM PhieuBanHangChiTiet ct
    JOIN PhieuBanHang p ON p.PhieuBHID = ct.PhieuBHID
    JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
    WHERE p.TrangThai <> N'Đã hủy' AND p.NgayBan BETWEEN @a AND @b
    GROUP BY h.MaHangID`;
  const xuatBHKy = (await pool.request().input('a', sql.Date, ky.tuNgay).input('b', sql.Date, ky.denNgay).query(sqlXuatBH)).recordset;
  const xuatBHSau = (await pool.request().input('a', sql.Date, ky.denNgay).input('b', sql.Date, ky.homNay)
    .query(sqlXuatBH.replace('BETWEEN @a AND @b', '> @a AND p.NgayBan <= @b'))).recordset;

  /* --- XUAT 2: don khach dat DA TRU TON truc tiep, CHUA gan phieu ban hang ---
     Day la du lieu TRUOC v6.23 (khi don tu tru ton). Don da gan PhieuBHID thi phieu ban hang
     o tren da tinh roi -> loai ra, khong duoc tinh 2 lan. */
  const coDaTruTon = await coCot(pool, 'DonKhachDatHang', 'DaTruTon');
  const coPhieuBH = await coCot(pool, 'DonKhachDatHang', 'PhieuBHID');
  let xuatDonKy = [], xuatDonSau = [];
  if (coDaTruTon) {
    const dk = [
      coDaTruTon ? 'd.DaTruTon = 1' : '1=1',
      coPhieuBH ? 'd.PhieuBHID IS NULL' : '1=1'
    ].join(' AND ');
    const sqlXuatDon = `
      SELECT h.MaHangID,
             /* v6.31: "don vi GOP" = DonViQuyDoi cua chinh ma hang (chua khai thi lui ve N'ri'). */
             SUM(CASE WHEN LOWER(LTRIM(RTRIM(ISNULL(d.DonVi, N'Cái')))) = LOWER(LTRIM(RTRIM(h.DonViCoBan)))
                        THEN CAST(d.SoLuongDat AS DECIMAL(18,4))
                      WHEN LOWER(LTRIM(RTRIM(ISNULL(d.DonVi, N'Cái')))) = LOWER(LTRIM(RTRIM(ISNULL(NULLIF(LTRIM(RTRIM(h.DonViQuyDoi)), N''), N'ri'))))
                        THEN CAST(d.SoLuongDat AS DECIMAL(18,4)) * h.LoaiRi
                      WHEN LOWER(LTRIM(RTRIM(h.DonViCoBan))) = LOWER(LTRIM(RTRIM(ISNULL(NULLIF(LTRIM(RTRIM(h.DonViQuyDoi)), N''), N'ri')))) AND h.LoaiRi > 0
                        THEN CAST(d.SoLuongDat AS DECIMAL(18,4)) / h.LoaiRi
                      ELSE CAST(d.SoLuongDat AS DECIMAL(18,4)) END) AS SL
      FROM DonKhachDatHang d
      JOIN TheKhoHangHoa h ON h.MaHangID = d.MaHangID
      WHERE ${dk} AND CAST(d.ThoiGian AS DATE) BETWEEN @a AND @b
      GROUP BY h.MaHangID`;
    xuatDonKy = (await pool.request().input('a', sql.Date, ky.tuNgay).input('b', sql.Date, ky.denNgay).query(sqlXuatDon)).recordset;
    xuatDonSau = (await pool.request().input('a', sql.Date, ky.denNgay).input('b', sql.Date, ky.homNay)
      .query(sqlXuatDon.replace('BETWEEN @a AND @b', '> @a AND CAST(d.ThoiGian AS DATE) <= @b'))).recordset;
  }

  const khoa = r => r.MaHangID;
  gomVao(map, nhapPhieuKy, khoa, 'NhapKy');        // v6.91: PHIEU NHAP KHO la nguon nhap DUY NHAT
  gomVao(map, nhapPhieuSau, khoa, 'NhapSauKy');
  gomVao(map, xuatBHKy, khoa, 'XuatKy');
  gomVao(map, xuatBHSau, khoa, 'XuatSauKy');
  gomVao(map, xuatDonKy, khoa, 'XuatKy');
  gomVao(map, xuatDonSau, khoa, 'XuatSauKy');

  const rows = [...map.values()].map(x => {
    // Ton cuoi ky = ton hien tai lui ve theo chung tu phat sinh SAU ky
    const tonCuoi = lam2(x.TonHienTai - x.NhapSauKy + x.XuatSauKy);
    const tonDau = lam2(tonCuoi - x.NhapKy + x.XuatKy);
    const heSo = donViChinhLaGop(x) ? x.LoaiRi : 1;   // ton theo don vi GOP -> nhan he so ra don vi goc
    /* Gia nhap ve DUNG DON VI CUA COT TON:
         - nguon "Phieu nhap (BQGQ)" da la gia 1 don vi chinh  -> giu nguyen
         - nguon GiaVonHangHoa la gia 1 don vi GOC             -> nhan he so neu don vi chinh la gop */
    const gn = giaNhapMap.get(x.MaHangID);
    const giaNhap = gn ? (gn.goc ? gn.gia * heSo : gn.gia) : null;
    return {
      MaHang: x.MaHang, TenHang: x.TenHang, TenDanhMuc: x.TenDanhMuc, DonVi: x.DonVi,
      TonDau: tonDau, Nhap: lam2(x.NhapKy), Xuat: lam2(x.XuatKy), TonCuoi: tonCuoi,
      // v6.91: gia nhap + gia tri ton THEO GIA NHAP (day moi la tien that da bo ra)
      GiaNhap: giaNhap == null ? null : tien(giaNhap),
      NguonGiaNhap: gn ? gn.nguon : null,
      GiaTriTonNhap: giaNhap == null ? null : tien(tonCuoi * giaNhap),
      GiaBan: tien(x.GiaBan),
      // Gia tri ton theo GIA BAN — chi de tham khao (gia von nam o bao cao ket qua kinh doanh).
      // Giá là giá 1 ĐƠN VỊ GỐC; tồn lưu theo đơn vị GỘP thì phải nhân tỷ lệ ra số đơn vị gốc.
      GiaTriTon: tien(tonCuoi * heSo * x.GiaBan)
    };
  }).filter(r => r.TonDau || r.Nhap || r.Xuat || r.TonCuoi);

  const thieuGia = rows.filter(r => r.GiaNhap == null && r.TonCuoi).map(r => r.MaHang);

  return {
    rows,
    tong: {
      TonDau: lam2(rows.reduce((s, r) => s + r.TonDau, 0)),
      Nhap: lam2(rows.reduce((s, r) => s + r.Nhap, 0)),
      Xuat: lam2(rows.reduce((s, r) => s + r.Xuat, 0)),
      TonCuoi: lam2(rows.reduce((s, r) => s + r.TonCuoi, 0)),
      GiaTriTonNhap: tien(rows.reduce((s, r) => s + (r.GiaTriTonNhap || 0), 0)),
      GiaTriTon: tien(rows.reduce((s, r) => s + r.GiaTriTon, 0))
    },
    canhBao: thieuGia.length
      ? `${thieuGia.length} mã còn tồn nhưng CHƯA CÓ GIÁ NHẬP (${thieuGia.slice(0, 8).join(', ')}${thieuGia.length > 8 ? '…' : ''}) — cột "Giá trị tồn (giá nhập)" của các mã này đang bị bỏ trống. `
        + 'Hàng mua ngoài: khai đơn giá trên phiếu nhập kho. Hàng tự sản xuất: vào Báo cáo → Giá vốn, bấm "Nạp từ lệnh SX".'
      : null,
    ghiChu: 'Số lượng theo ĐƠN VỊ CHÍNH của từng mã hàng (cột ĐVT). '
      + 'Nhập trong kỳ lấy TỪ PHIẾU NHẬP KHO (từ v6.91 đây là nguồn nhập duy nhất); xuất lấy từ phiếu bán hàng. '
      + 'Giá nhập: hàng mua ngoài = bình quân gia quyền các phiếu nhập từ NCC; hàng tự sản xuất = giá thành lệnh SX (Báo cáo → Giá vốn). '
      + 'Số nhập tay trực tiếp trên thẻ kho và số ghi qua công đoạn "Kho nhập" trước đây không có chứng từ nên nằm trong "Tồn đầu kỳ".'
  };
}

/* ================================================================================================
   2. TON KHO VAI  (don vi KG, kem so met)
   Nhap: VaiCay.NgayNhap · Xuat: PhieuXuatVai.NgayXuat
   Khac 2 kho kia: kho vai KHONG co duong sua tay khong ngay -> ton dau ky tinh duoc chinh xac,
   nhung van dung cung cong thuc lui-tu-hien-tai cho nhat quan (ket qua giong het nhau).
   ================================================================================================ */
async function baoCaoTonVai(pool, ky) {
  const coMet = await coCot(pool, 'VaiCay', 'SoMet');
  const met = coMet ? 'ISNULL(vc.SoMet,0)' : '0';
  const metX = coMet ? 'ISNULL(ct.SoMet,0)' : '0';

  const rows = (await rqKy(pool, ky).query(`
    WITH nhap AS (
      SELECT vc.VaiID,
             SUM(CASE WHEN vc.NgayNhap <  @tu  THEN vc.KGNhap ELSE 0 END) AS KG_Truoc,
             SUM(CASE WHEN vc.NgayNhap >= @tu AND vc.NgayNhap <= @den THEN vc.KGNhap ELSE 0 END) AS KG_Ky,
             SUM(CASE WHEN vc.NgayNhap <  @tu  THEN ${met} ELSE 0 END) AS M_Truoc,
             SUM(CASE WHEN vc.NgayNhap >= @tu AND vc.NgayNhap <= @den THEN ${met} ELSE 0 END) AS M_Ky,
             COUNT(CASE WHEN vc.NgayNhap >= @tu AND vc.NgayNhap <= @den THEN 1 END) AS SoCayNhapKy
      FROM VaiCay vc GROUP BY vc.VaiID
    ),
    xuat AS (
      SELECT vc.VaiID,
             SUM(CASE WHEN px.NgayXuat <  @tu  THEN ct.KGXuat ELSE 0 END) AS KG_Truoc,
             SUM(CASE WHEN px.NgayXuat >= @tu AND px.NgayXuat <= @den THEN ct.KGXuat ELSE 0 END) AS KG_Ky,
             SUM(CASE WHEN px.NgayXuat <  @tu  THEN ${metX} ELSE 0 END) AS M_Truoc,
             SUM(CASE WHEN px.NgayXuat >= @tu AND px.NgayXuat <= @den THEN ${metX} ELSE 0 END) AS M_Ky
      FROM PhieuXuatVaiChiTiet ct
      JOIN PhieuXuatVai px ON px.PhieuXuatID = ct.PhieuXuatID
      JOIN VaiCay vc ON vc.CayID = ct.CayID
      GROUP BY vc.VaiID
    ),
    gia AS (
      /* Mau so CHI dem cay DA khai gia — neu dem ca cay chua khai gia thi don gia BQ bi keo xuong,
         gia tri ton bao thieu (bug cung kieu tung gap o ben phu kien). */
      SELECT VaiID, SUM(CASE WHEN ISNULL(DonGiaNhap,0) > 0 THEN KGNhap * DonGiaNhap ELSE 0 END) AS TienNhap,
             SUM(CASE WHEN ISNULL(DonGiaNhap,0) > 0 THEN KGNhap ELSE 0 END) AS KGNhapTong
      FROM VaiCay GROUP BY VaiID
    )
    SELECT v.MaVai, lv.TenLoaiVai, ms.TenMau, v.KhoVai,
           ISNULL(n.KG_Truoc,0) - ISNULL(x.KG_Truoc,0) AS TonDauKG,
           ISNULL(n.KG_Ky,0)   AS NhapKG,
           ISNULL(x.KG_Ky,0)   AS XuatKG,
           ISNULL(n.M_Truoc,0) - ISNULL(x.M_Truoc,0) AS TonDauMet,
           ISNULL(n.M_Ky,0)    AS NhapMet,
           ISNULL(x.M_Ky,0)    AS XuatMet,
           ISNULL(n.SoCayNhapKy,0) AS SoCayNhapKy,
           CASE WHEN ISNULL(g.KGNhapTong,0) > 0 THEN g.TienNhap / g.KGNhapTong ELSE 0 END AS DonGiaBQ
    FROM DanhMucVai v
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = v.LoaiVaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID
    LEFT JOIN nhap n ON n.VaiID = v.VaiID
    LEFT JOIN xuat x ON x.VaiID = v.VaiID
    LEFT JOIN gia  g ON g.VaiID = v.VaiID
    ORDER BY v.MaVai`)).recordset.map(r => {
      const tonDauKG = lam2(r.TonDauKG), nhapKG = lam2(r.NhapKG), xuatKG = lam2(r.XuatKG);
      const tonCuoiKG = lam2(tonDauKG + nhapKG - xuatKG);
      return {
        MaVai: r.MaVai, TenLoaiVai: r.TenLoaiVai || '', TenMau: r.TenMau || '', KhoVai: r.KhoVai == null ? null : lam2(r.KhoVai),
        TonDauKG: tonDauKG, NhapKG: nhapKG, XuatKG: xuatKG, TonCuoiKG: tonCuoiKG,
        TonDauMet: lam2(r.TonDauMet), NhapMet: lam2(r.NhapMet), XuatMet: lam2(r.XuatMet),
        TonCuoiMet: lam2(so(r.TonDauMet) + so(r.NhapMet) - so(r.XuatMet)),
        SoCayNhapKy: r.SoCayNhapKy || 0,
        DonGiaBQ: tien(r.DonGiaBQ),
        GiaTriTon: tien(tonCuoiKG * so(r.DonGiaBQ))
      };
    }).filter(r => r.TonDauKG || r.NhapKG || r.XuatKG || r.TonCuoiKG);

  return {
    rows,
    tong: {
      TonDauKG: lam2(rows.reduce((s, r) => s + r.TonDauKG, 0)),
      NhapKG: lam2(rows.reduce((s, r) => s + r.NhapKG, 0)),
      XuatKG: lam2(rows.reduce((s, r) => s + r.XuatKG, 0)),
      TonCuoiKG: lam2(rows.reduce((s, r) => s + r.TonCuoiKG, 0)),
      GiaTriTon: tien(rows.reduce((s, r) => s + r.GiaTriTon, 0))
    },
    ghiChu: 'Đơn vị KG (cột mét chỉ có với vải khai số mét). Đơn giá BQ = tổng tiền nhập / tổng KG nhập của mã vải đó (bình quân gia quyền toàn bộ lịch sử nhập).'
  };
}

/* ================================================================================================
   3. TON KHO PHU KIEN  (don vi = DanhMucPhuKien.DonViCoBan)
   Nguon duy nhat con hoat dong: PhieuPhuKien (LoaiPhieu Nhap/Xuat) + PhieuPhuKienChiTiet.
   Nguon thu 3 (PhieuXuatVatTuPhuKien) da bi DROP o v5.29 -> chi union khi bang con ton tai.
   ================================================================================================ */
async function baoCaoTonPhuKien(pool, ky) {
  const coVatTu = await coBang(pool, 'PhieuXuatVatTuPhuKien') && await coBang(pool, 'PhieuXuatVatTu');
  const unionVatTu = coVatTu ? `
      UNION ALL
      SELECT vt.PhuKienID, pv.NgayXuat AS Ngay, N'Xuất' AS LoaiPhieu, vt.SoLuong
      FROM PhieuXuatVatTuPhuKien vt JOIN PhieuXuatVatTu pv ON pv.PhieuVatTuID = vt.PhieuVatTuID` : '';

  const rows = (await rqKy(pool, ky).query(`
    WITH ps AS (
      SELECT ct.PhuKienID, p.Ngay, p.LoaiPhieu, ct.SoLuong
      FROM PhieuPhuKienChiTiet ct JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
      ${unionVatTu}
    ),
    tong AS (
      SELECT PhuKienID,
        SUM(CASE WHEN LoaiPhieu = N'Nhập' AND Ngay <  @tu THEN SoLuong ELSE 0 END) AS NhapTruoc,
        SUM(CASE WHEN LoaiPhieu = N'Xuất' AND Ngay <  @tu THEN SoLuong ELSE 0 END) AS XuatTruoc,
        SUM(CASE WHEN LoaiPhieu = N'Nhập' AND Ngay >= @tu AND Ngay <= @den THEN SoLuong ELSE 0 END) AS NhapKy,
        SUM(CASE WHEN LoaiPhieu = N'Xuất' AND Ngay >= @tu AND Ngay <= @den THEN SoLuong ELSE 0 END) AS XuatKy
      FROM ps GROUP BY PhuKienID
    ),
    gia AS (
      SELECT ct.PhuKienID, MAX(ct.DonGia) AS DonGiaMax,
             SUM(CASE WHEN ISNULL(ct.DonGia,0) > 0 THEN ct.SoLuong * ct.DonGia ELSE 0 END) AS TienNhap,
             SUM(CASE WHEN ISNULL(ct.DonGia,0) > 0 THEN ct.SoLuong ELSE 0 END) AS SLCoGia
      FROM PhieuPhuKienChiTiet ct JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
      WHERE p.LoaiPhieu = N'Nhập'
      GROUP BY ct.PhuKienID
    )
    SELECT dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai, dm.Size, dm.DonViCoBan,
           ISNULL(t.NhapTruoc,0) - ISNULL(t.XuatTruoc,0) AS TonDau,
           ISNULL(t.NhapKy,0) AS Nhap, ISNULL(t.XuatKy,0) AS Xuat,
           CASE WHEN ISNULL(g.SLCoGia,0) > 0 THEN g.TienNhap / g.SLCoGia ELSE 0 END AS DonGiaBQ
    FROM DanhMucPhuKien dm
    LEFT JOIN LoaiPhuKien lpk ON lpk.LoaiPhuKienID = dm.LoaiPhuKienID
    LEFT JOIN tong t ON t.PhuKienID = dm.PhuKienID
    LEFT JOIN gia  g ON g.PhuKienID = dm.PhuKienID
    ORDER BY dm.MaPhuKien`)).recordset.map(r => {
      const tonDau = lam2(r.TonDau), nhap = lam2(r.Nhap), xuat = lam2(r.Xuat);
      const tonCuoi = lam2(tonDau + nhap - xuat);
      return {
        MaPhuKien: r.MaPhuKien, TenPhuKien: r.TenPhuKien, TenLoai: r.TenLoai || '', Size: r.Size || '',
        DonVi: r.DonViCoBan || '', TonDau: tonDau, Nhap: nhap, Xuat: xuat, TonCuoi: tonCuoi,
        DonGiaBQ: tien(r.DonGiaBQ), GiaTriTon: tien(tonCuoi * so(r.DonGiaBQ))
      };
    }).filter(r => r.TonDau || r.Nhap || r.Xuat || r.TonCuoi);

  return {
    rows,
    tong: {
      TonDau: lam2(rows.reduce((s, r) => s + r.TonDau, 0)),
      Nhap: lam2(rows.reduce((s, r) => s + r.Nhap, 0)),
      Xuat: lam2(rows.reduce((s, r) => s + r.Xuat, 0)),
      TonCuoi: lam2(rows.reduce((s, r) => s + r.TonCuoi, 0)),
      GiaTriTon: tien(rows.reduce((s, r) => s + r.GiaTriTon, 0))
    },
    ghiChu: 'Đơn giá BQ tính từ các phiếu NHẬP có khai đơn giá (phiếu xuất không có cột đơn giá).'
      + (coVatTu ? ' Đã cộng cả phiếu xuất vật tư.' : '')
  };
}

/* ================================================================================================
   4. BAO CAO TAI CHINH
   Gom 3 phan:
     A. QUY (tien mat + tung tai khoan ngan hang): dau ky - thu - chi - cuoi ky
     B. CONG NO tai NGAY CUOI KY: phai thu khach hang, phai tra nha cung cap
     C. DONG TIEN trong ky theo LOAI TAI KHOAN (biet tien vao/ra tu khoan nao)
   ================================================================================================ */
async function baoCaoTaiChinh(pool, ky) {
  const coNH = await coBang(pool, 'DanhMucTaiKhoanNganHang');
  const coTKNH = coNH && await coCot(pool, 'PhieuThu', 'TaiKhoanNHID');
  /* CSDL chua chay migration_v669 thi khong co cot TaiKhoanNHID. KHONG duoc dua CAST(NULL AS INT)
     vao GROUP BY (SQL Server loi 164) — bo han cot ay khoi GROUP BY roi gan null o JS. */
  const cot = coTKNH ? 'TaiKhoanNHID' : 'CAST(NULL AS INT)';
  const groupBy = coTKNH ? 'HinhThuc, TaiKhoanNHID' : 'HinhThuc';

  /* ---------- A. QUY ---------- */
  const cfg = (await pool.request().query(
    `SELECT ConfigValue FROM CauHinhHeThong WHERE ConfigKey = 'QUY_TIEN_MAT_DAU_KY'`)).recordset[0];
  const quyTMDauKyGoc = so(cfg && cfg.ConfigValue);   // so du tien mat khai o cau hinh (tinh tu dau)

  const sqlPS = (bang, cotNgay) => `
    SELECT HinhThuc, ${cot} AS TaiKhoanNHID,
           SUM(CASE WHEN ${cotNgay} <  @tu THEN SoTien ELSE 0 END) AS Truoc,
           SUM(CASE WHEN ${cotNgay} >= @tu AND ${cotNgay} <= @den THEN SoTien ELSE 0 END) AS TrongKy,
           COUNT(CASE WHEN ${cotNgay} >= @tu AND ${cotNgay} <= @den THEN 1 END) AS SoPhieu
    FROM ${bang} GROUP BY ${groupBy}`;
  const thu = (await rqKy(pool, ky).query(sqlPS('PhieuThu', 'NgayThu'))).recordset;
  const chi = (await rqKy(pool, ky).query(sqlPS('PhieuChi', 'NgayChi'))).recordset;
  const nh = coNH ? (await pool.request().query(
    'SELECT TaiKhoanNHID, TenNganHang, SoTaiKhoan, ChuTaiKhoan, SoDuDauKy FROM DanhMucTaiKhoanNganHang ORDER BY TenNganHang')).recordset : [];

  const laTM = h => String(h || '').trim() !== 'Chuyển khoản';
  const cong = (arr, dk, truong) => arr.filter(dk).reduce((s, x) => s + so(x[truong]), 0);

  const quy = [];
  /* v6.33: `khoa` = định danh gửi lên endpoint /taichinh/chitiet khi người dùng bấm vào dòng quỹ. */
  const themQuy = (ten, soTK, dauKyGoc, dk, khoa) => {
    const thuTruoc = cong(thu, dk, 'Truoc'), chiTruoc = cong(chi, dk, 'Truoc');
    const thuKy = cong(thu, dk, 'TrongKy'), chiKy = cong(chi, dk, 'TrongKy');
    const dauKy = tien(dauKyGoc + thuTruoc - chiTruoc);   // so du dau ky = so du khai + phat sinh TRUOC ky
    quy.push({
      Ten: ten, Khoa: khoa, SoTaiKhoan: soTK, DauKy: dauKy, Thu: tien(thuKy), Chi: tien(chiKy),
      CuoiKy: tien(dauKy + thuKy - chiKy),
      SoPhieuThu: cong(thu, dk, 'SoPhieu'), SoPhieuChi: cong(chi, dk, 'SoPhieu')
    });
  };
  themQuy('Quỹ tiền mặt', '', quyTMDauKyGoc, x => laTM(x.HinhThuc), 'TienMat');
  nh.forEach(t => themQuy(t.TenNganHang, t.SoTaiKhoan, so(t.SoDuDauKy),
    x => !laTM(x.HinhThuc) && x.TaiKhoanNHID === t.TaiKhoanNHID, String(t.TaiKhoanNHID)));
  const leThu = thu.filter(x => !laTM(x.HinhThuc) && !x.TaiKhoanNHID);
  const leChi = chi.filter(x => !laTM(x.HinhThuc) && !x.TaiKhoanNHID);
  if (leThu.length || leChi.length) {
    themQuy('Chuyển khoản (chưa gán tài khoản)', '', 0, x => !laTM(x.HinhThuc) && !x.TaiKhoanNHID, 'ChuaGan');
  }

  /* ---------- B. CONG NO tai NGAY CUOI KY ---------- */
  const phaiThu = (await rqKy(pool, ky).query(`
    SELECT
      (SELECT ISNULL(SUM(TongThanhToan),0) FROM PhieuBanHang WHERE TrangThai <> N'Đã hủy' AND NgayBan <= @den) AS BanHang,
      (SELECT ISNULL(SUM(SoTien),0) FROM PhieuThu WHERE LoaiDoiTuong = N'KhachHang' AND NgayThu <= @den) AS DaThu,
      (SELECT ISNULL(SUM(SoTien),0) FROM CongNoDieuChinh WHERE LoaiDoiTuong = N'KhachHang' AND Ngay <= @den) AS DieuChinh`)).recordset[0];

  const coGiaVai = await coCot(pool, 'VaiCay', 'DonGiaNhap');
  const coGiaPK = await coCot(pool, 'PhieuPhuKienChiTiet', 'DonGia');
  const phaiTra = (await rqKy(pool, ky).query(`
    SELECT
      ${coGiaVai ? `(SELECT ISNULL(SUM(vc.KGNhap * ISNULL(vc.DonGiaNhap,0)),0)
          FROM PhieuNhapVai pn JOIN VaiCay vc ON vc.PhieuNhapID = pn.PhieuNhapID
          WHERE pn.NCC_ID IS NOT NULL AND pn.NgayNhap <= @den)` : '0'} AS NhapVai,
      ${coGiaPK ? `(SELECT ISNULL(SUM(ct.SoLuong * ISNULL(ct.DonGia,0)),0)
          FROM PhieuPhuKien p JOIN PhieuPhuKienChiTiet ct ON ct.PhieuID = p.PhieuID
          WHERE p.LoaiPhieu = N'Nhập' AND p.NCC_ID IS NOT NULL AND p.Ngay <= @den)` : '0'} AS NhapPhuKien,
      (SELECT ISNULL(SUM(SoTien),0) FROM PhieuChi WHERE LoaiDoiTuong = N'NhaCungCap' AND NCC_ID IS NOT NULL AND NgayChi <= @den) AS DaTra,
      (SELECT ISNULL(SUM(SoTien),0) FROM CongNoDieuChinh WHERE LoaiDoiTuong = N'NhaCungCap' AND NCC_ID IS NOT NULL AND Ngay <= @den) AS DieuChinh`)).recordset[0];

  /* ---------- C. DONG TIEN THEO LOAI TAI KHOAN ---------- */
  const theoTK = (await rqKy(pool, ky).query(`
    SELECT ISNULL(lt.TenLoai, N'(chưa phân loại)') AS TenLoai, ISNULL(lt.TinhChiPhiKD, 0) AS TinhChiPhiKD,
           SUM(x.Thu) AS Thu, SUM(x.Chi) AS Chi
    FROM (
      SELECT TaiKhoanID, SoTien AS Thu, 0 AS Chi FROM PhieuThu WHERE NgayThu BETWEEN @tu AND @den
      UNION ALL
      SELECT TaiKhoanID, 0 AS Thu, SoTien AS Chi FROM PhieuChi WHERE NgayChi BETWEEN @tu AND @den
    ) x
    LEFT JOIN DanhMucTaiKhoan tk ON tk.TaiKhoanID = x.TaiKhoanID
    LEFT JOIN DanhMucLoaiTaiKhoan lt ON lt.LoaiTKID = tk.LoaiTKID
    GROUP BY lt.TenLoai, lt.TinhChiPhiKD
    ORDER BY SUM(x.Chi) DESC, SUM(x.Thu) DESC`)).recordset
    .map(r => ({ TenLoai: r.TenLoai, TinhChiPhiKD: !!r.TinhChiPhiKD, Thu: tien(r.Thu), Chi: tien(r.Chi) }));

  const tongPhaiThu = tien(so(phaiThu.BanHang) + so(phaiThu.DieuChinh) - so(phaiThu.DaThu));
  const tongPhaiTra = tien(so(phaiTra.NhapVai) + so(phaiTra.NhapPhuKien) + so(phaiTra.DieuChinh) - so(phaiTra.DaTra));

  return {
    quy,
    tongQuy: {
      DauKy: tien(quy.reduce((s, q) => s + q.DauKy, 0)),
      Thu: tien(quy.reduce((s, q) => s + q.Thu, 0)),
      Chi: tien(quy.reduce((s, q) => s + q.Chi, 0)),
      CuoiKy: tien(quy.reduce((s, q) => s + q.CuoiKy, 0))
    },
    congNo: {
      PhaiThu: tongPhaiThu, PhaiThu_BanHang: tien(phaiThu.BanHang), PhaiThu_DaThu: tien(phaiThu.DaThu),
      PhaiThu_DieuChinh: tien(phaiThu.DieuChinh),
      PhaiTra: tongPhaiTra, PhaiTra_Vai: tien(phaiTra.NhapVai), PhaiTra_PhuKien: tien(phaiTra.NhapPhuKien),
      PhaiTra_DaTra: tien(phaiTra.DaTra), PhaiTra_DieuChinh: tien(phaiTra.DieuChinh)
    },
    theoTK,
    canhBao: (!coGiaVai || !coGiaPK) ? 'Thiếu cột đơn giá nhập (VaiCay.DonGiaNhap / PhieuPhuKienChiTiet.DonGia) — phần công nợ đó tính bằng 0.' : null,
    ghiChu: 'Số dư đầu kỳ của quỹ = số dư khai trong danh mục + toàn bộ phiếu thu/chi phát sinh TRƯỚC ngày bắt đầu kỳ. Công nợ lấy tại NGÀY CUỐI KỲ (lũy kế từ đầu).'
  };
}

/* ================================================================================================
   5. KET QUA KINH DOANH (lai / lo)
   ------------------------------------------------------------------------------------------------
   DOANH THU THUAN = SUM(PhieuBanHang.TienTruocVAT)   <- KHONG gom thue GTGT (dung chuan ke toan:
                     thue GTGT dau ra la khoan thu ho nha nuoc, khong phai doanh thu).
   GIA VON         = SUM(SoLuongCai cua tung dong ban x GiaVonHangHoa.GiaVon cua ma hang do)
                     Gia von CHOT trong bang GiaVonHangHoa (xem migration_v672).
   LAI GOP         = Doanh thu thuan - Gia von
   CHI PHI KD      = SUM(PhieuChi) co tai khoan thuoc loai co TinhChiPhiKD = 1
   LOI NHUAN       = Lai gop - Chi phi KD
   ================================================================================================ */
async function baoCaoKinhDoanh(pool, ky) {
  const coGiaVon = await coBang(pool, 'GiaVonHangHoa');

  // --- Doanh thu + gia von theo tung MA HANG (chi tiet de biet mat hang nao lai) ---
  const rows = (await rqKy(pool, ky).query(`
    SELECT h.MaHangID, h.MaHang, h.TenHang,
           SUM(ct.SoLuongCai) AS SLCai,
           SUM(ct.ThanhTien)  AS TienHang
           ${coGiaVon ? ', MAX(gv.GiaVon) AS GiaVon, MAX(gv.NguonGia) AS NguonGia' : ''}
    FROM PhieuBanHangChiTiet ct
    JOIN PhieuBanHang p ON p.PhieuBHID = ct.PhieuBHID
    JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
    ${coGiaVon ? 'LEFT JOIN GiaVonHangHoa gv ON gv.MaHangID = h.MaHangID' : ''}
    WHERE p.TrangThai <> N'Đã hủy' AND p.NgayBan BETWEEN @tu AND @den
    GROUP BY h.MaHangID, h.MaHang, h.TenHang
    ORDER BY SUM(ct.ThanhTien) DESC`)).recordset;

  // --- Tong tren PHIEU (co CK NPP + thue) ---
  const tongPhieu = (await rqKy(pool, ky).query(`
    SELECT ISNULL(SUM(TongTienHang),0) AS TongTienHang, ISNULL(SUM(TienCKNPP),0) AS TienCKNPP,
           ISNULL(SUM(TienTruocVAT),0) AS TienTruocVAT, ISNULL(SUM(TienVAT),0) AS TienVAT,
           ISNULL(SUM(TongThanhToan),0) AS TongThanhToan, COUNT(*) AS SoPhieu, ISNULL(SUM(TongSLCai),0) AS TongSLCai
    FROM PhieuBanHang WHERE TrangThai <> N'Đã hủy' AND NgayBan BETWEEN @tu AND @den`)).recordset[0];

  /* Ty le chiet khau NPP tren toan ky — dung de phan bo CK NPP xuong tung ma hang, nho vay
     tong "doanh thu thuan" cua cac dong CONG LAI dung bang TienTruocVAT cua ca ky. */
  const tongTienHang = so(tongPhieu.TongTienHang);
  const tyLeSauCK = tongTienHang > 0 ? so(tongPhieu.TienTruocVAT) / tongTienHang : 1;

  const mat = [];   // ma hang thieu gia von
  const chiTiet = rows.map(r => {
    const slCai = so(r.SLCai);
    const doanhThu = tien(so(r.TienHang) * tyLeSauCK);
    /* "Chưa khai" = CHƯA CÓ DÒNG trong GiaVonHangHoa (NULL). Khai đúng bằng 0 là có chủ ý
       (hàng khuyến mại/mẫu) — không đếm là thiếu, để 2 tab hiểu giống nhau. */
    const chuaKhai = !coGiaVon || r.GiaVon == null;
    const giaVon1 = chuaKhai ? 0 : so(r.GiaVon);
    const giaVon = tien(slCai * giaVon1);
    if (chuaKhai) mat.push(r.MaHang);
    return {
      MaHang: r.MaHang, TenHang: r.TenHang, SLCai: slCai,
      TienHang: tien(r.TienHang), DoanhThu: doanhThu,
      GiaVon1: tien(giaVon1), GiaVon: giaVon,
      LaiGop: tien(doanhThu - giaVon),
      TyLeLai: doanhThu > 0 ? lam2((doanhThu - giaVon) / doanhThu * 100) : null,
      ThieuGiaVon: chuaKhai,
      NguonGia: coGiaVon ? (r.NguonGia || '') : ''
    };
  });

  /* --- Chi phi kinh doanh: phieu chi co tai khoan thuoc loai TinhChiPhiKD = 1 ---
     ⚠️ CAC KHOAN DA NAM TRONG GIA VON (mua nguyen phu lieu, gia cong/in theu, luong may/cat) PHAI
     khai TinhChiPhiKD = 0, khong thi bi TRU HAI LAN: 1 lan qua gia von, 1 lan qua day => lo ao dung
     bang tien mua NPL trong ky. migration_v672 da tat co cho 2 loai chac chan thuoc gia von;
     rieng "Chi lương" phai tu quyet dinh (luong may/cat nam trong gia thanh, luong van phong thi khong). */
  const chiPhi = (await rqKy(pool, ky).query(`
    SELECT ISNULL(lt.TenLoai, N'(chưa phân loại)') AS TenLoai,
           ISNULL(tk.TenTK, N'(không chọn tài khoản)') AS TenTK,
           SUM(pc.SoTien) AS SoTien, COUNT(*) AS SoPhieu
    FROM PhieuChi pc
    JOIN DanhMucTaiKhoan tk ON tk.TaiKhoanID = pc.TaiKhoanID
    JOIN DanhMucLoaiTaiKhoan lt ON lt.LoaiTKID = tk.LoaiTKID AND lt.TinhChiPhiKD = 1
    WHERE pc.NgayChi BETWEEN @tu AND @den
    GROUP BY lt.TenLoai, tk.TenTK
    ORDER BY SUM(pc.SoTien) DESC`)).recordset
    .map(r => ({ TenLoai: r.TenLoai, TenTK: r.TenTK, SoTien: tien(r.SoTien), SoPhieu: r.SoPhieu }));

  /* Phieu chi KHONG gan tai khoan (hoac tai khoan khong thuoc loai tinh CPKD) — bao cho nguoi dung
     biet co bao nhieu tien dang nam ngoai bao cao lai/lo, keo tuong lai/lo ao. */
  const chiNgoai = (await rqKy(pool, ky).query(`
    SELECT ISNULL(SUM(pc.SoTien),0) AS SoTien, COUNT(*) AS SoPhieu
    FROM PhieuChi pc
    LEFT JOIN DanhMucTaiKhoan tk ON tk.TaiKhoanID = pc.TaiKhoanID
    LEFT JOIN DanhMucLoaiTaiKhoan lt ON lt.LoaiTKID = tk.LoaiTKID
    WHERE pc.NgayChi BETWEEN @tu AND @den AND ISNULL(lt.TinhChiPhiKD, 0) = 0`)).recordset[0];

  // Danh sach loai tai khoan DANG duoc tinh la chi phi KD — hien len UI de doi chieu voi gia von.
  const loaiCPKD = (await pool.request().query(
    `SELECT TenLoai FROM DanhMucLoaiTaiKhoan WHERE TinhChiPhiKD = 1 ORDER BY TenLoai`)).recordset.map(r => r.TenLoai);

  const doanhThuThuan = tien(tongPhieu.TienTruocVAT);
  const tongGiaVon = tien(chiTiet.reduce((s, r) => s + r.GiaVon, 0));
  const laiGop = tien(doanhThuThuan - tongGiaVon);
  const tongChiPhi = tien(chiPhi.reduce((s, r) => s + r.SoTien, 0));

  return {
    chiTiet, chiPhi,
    tong: {
      SoPhieu: tongPhieu.SoPhieu, TongSLCai: so(tongPhieu.TongSLCai),
      TongTienHang: tien(tongPhieu.TongTienHang), TienCKNPP: tien(tongPhieu.TienCKNPP),
      DoanhThuThuan: doanhThuThuan, TienVAT: tien(tongPhieu.TienVAT),
      TongThanhToan: tien(tongPhieu.TongThanhToan),
      GiaVon: tongGiaVon, LaiGop: laiGop,
      TyLeLaiGop: doanhThuThuan > 0 ? lam2(laiGop / doanhThuThuan * 100) : null,
      ChiPhiKD: tongChiPhi,
      LoiNhuan: tien(laiGop - tongChiPhi)
    },
    thieuGiaVon: [...new Set(mat)],
    loaiCPKD,
    chiNgoaiBaoCao: { SoTien: tien(chiNgoai.SoTien), SoPhieu: chiNgoai.SoPhieu },
    coBangGiaVon: coGiaVon,
    ghiChu: 'Doanh thu thuần = tiền hàng sau chiết khấu NPP, CHƯA gồm thuế GTGT (thuế GTGT là khoản thu hộ, không phải doanh thu). '
      + 'Giá vốn lấy từ bảng "Giá vốn hàng hóa" — mã nào chưa khai sẽ tính 0 và được liệt kê để bổ sung. '
      + 'Chi phí kinh doanh CHỈ gồm chi phí NGOÀI giá vốn (bán hàng, quản lý…); tiền mua vải/phụ kiện/gia công đã nằm trong giá vốn nên không tính lại ở đây.'
  };
}

/* ================================================================================================
   ROUTES
   ================================================================================================ */
const CN = c => [requireAuth, requirePermission('BAOCAO', 'view'), requireChucNang('BAOCAO', c)];

router.get('/tonhanghoa', ...CN('tonhanghoa'), async (req, res) => {
  const pool = await getPool(); const ky = layKy(req.query);
  res.json({ success: true, ky, data: await baoCaoTonHangHoa(pool, ky) });
});
router.get('/tonvai', ...CN('tonvai'), async (req, res) => {
  const pool = await getPool(); const ky = layKy(req.query);
  res.json({ success: true, ky, data: await baoCaoTonVai(pool, ky) });
});
router.get('/tonphukien', ...CN('tonphukien'), async (req, res) => {
  const pool = await getPool(); const ky = layKy(req.query);
  res.json({ success: true, ky, data: await baoCaoTonPhuKien(pool, ky) });
});
router.get('/taichinh', ...CN('taichinh'), async (req, res) => {
  const pool = await getPool(); const ky = layKy(req.query);
  res.json({ success: true, ky, data: await baoCaoTaiChinh(pool, ky) });
});
router.get('/kinhdoanh', ...CN('kinhdoanh'), async (req, res) => {
  const pool = await getPool(); const ky = layKy(req.query);
  res.json({ success: true, ky, data: await baoCaoKinhDoanh(pool, ky) });
});

/* ================================================================================================
   CHI TIET XUAT NHAP CUA 1 MA  (bam vao ma hang / ma vai / ma phu kien tren bao cao ton kho)
   Tra ve danh sach CHUNG TU trong ky, xep theo ngay, kem TON LUY KE sau moi chung tu.
   Ton dau ky lay DUNG cong thuc cua bao cao (lui tu ton hien tai) nen 2 man hinh luon khop nhau.
   ================================================================================================ */
router.get('/tonhanghoa/chitiet', ...CN('tonhanghoa'), async (req, res) => {
  const pool = await getPool();
  const ky = layKy(req.query);
  const maHang = String(req.query.maHang || '').trim();
  if (!maHang) return res.status(400).json({ success: false, message: 'Thiếu mã hàng.' });

  const h = (await pool.request().input('m', sql.NVarChar, maHang).query(`
    SELECT MaHangID, MaHang, TenHang, DonViCoBan, DonViQuyDoi, LoaiRi, DonHangID
    FROM TheKhoHangHoa WHERE MaHang = @m`)).recordset[0];
  if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy mã hàng.' });

  // Ton dau ky: dung lai chinh ham bao cao roi loc ra ma nay -> chac chan khop so tren bang tong hop.
  const bang = await baoCaoTonHangHoa(pool, ky);
  const dongTong = (bang.rows || []).find(r => r.MaHang === h.MaHang) || { TonDau: 0, TonCuoi: 0 };

  const rq = () => pool.request().input('id', sql.Int, h.MaHangID)
    .input('tu', sql.Date, ky.tuNgay).input('den', sql.Date, ky.denNgay);

  /* --- NHAP: PHIEU NHAP KHO HANG HOA (v6.91) ---
     Da bo duong "tung lan ghi tien do Kho nhap" cho khop voi bang tong hop: tu v6.91 nguon nhap duy
     nhat la phieu nhap kho. Neu hai man hinh lay hai nguon khac nhau thi bam vao mot ma se thay chi
     tiet khong cong ra dung cot "Nhap trong ky" - dung kieu lech tung lam mat long tin vao bao cao. */
  const nhap = (await coBang(pool, 'PhieuNhapKhoHangChiTiet')) ? (await rq().query(`
    SELECT p.NgayNhap AS Ngay, p.SoPhieu, p.LoaiNhap,
           ISNULL(ncc.TenNCC, ISNULL(d.MaDH, N'')) AS DoiTuong,
           ISNULL(SUM(ct.SoLuongChinh), 0) AS PhatSinh
    FROM PhieuNhapKhoHangChiTiet ct
    JOIN PhieuNhapKhoHang p ON p.PhieuNKID = ct.PhieuNKID
    LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID
    LEFT JOIN DonHangSanXuat d ON d.DonHangID = p.DonHangID
    WHERE ct.MaHangID = @id AND p.TrangThai <> N'Đã hủy' AND p.NgayNhap BETWEEN @tu AND @den
    GROUP BY p.NgayNhap, p.SoPhieu, p.LoaiNhap, ncc.TenNCC, d.MaDH, p.PhieuNKID
    ORDER BY p.NgayNhap, p.SoPhieu`)).recordset : [];

  // --- XUAT 1: phieu ban hang ---
  const xuatBH = (await rq().query(`
    SELECT p.NgayBan AS Ngay, p.SoPhieu, p.TenKhach, ms.TenMau, ct.SoLuongCai
    FROM PhieuBanHangChiTiet ct
    JOIN PhieuBanHang p ON p.PhieuBHID = ct.PhieuBHID
    LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
    WHERE ct.MaHangID = @id AND p.TrangThai <> N'Đã hủy' AND p.NgayBan BETWEEN @tu AND @den
    ORDER BY p.NgayBan, p.PhieuBHID`)).recordset;

  // --- XUAT 2: don khach dat da tru ton truc tiep (du lieu truoc v6.23) ---
  const coDaTru = await coCot(pool, 'DonKhachDatHang', 'DaTruTon');
  const coPhieuBH = await coCot(pool, 'DonKhachDatHang', 'PhieuBHID');
  const xuatDon = coDaTru ? (await rq().query(`
    SELECT CAST(d.ThoiGian AS DATE) AS Ngay, d.DonID, d.TenKhach, ms.TenMau, d.SoLuongDat, d.DonVi
    FROM DonKhachDatHang d
    LEFT JOIN MauSac ms ON ms.MauSacID = d.MauSacID
    WHERE d.MaHangID = @id AND d.DaTruTon = 1 ${coPhieuBH ? 'AND d.PhieuBHID IS NULL' : ''}
      AND CAST(d.ThoiGian AS DATE) BETWEEN @tu AND @den
    ORDER BY d.ThoiGian`)).recordset : [];

  const laGop = donVi => {
    const qd = String(h.DonViQuyDoi || '').trim().toLowerCase();
    const dv = String(donVi || '').trim().toLowerCase();
    return qd ? dv === qd : dv === 'ri';
  };
  const heSo = Number(h.LoaiRi) || 1;
  const rows = [];
  nhap.forEach(r => { if (so(r.PhatSinh)) rows.push({
    Ngay: r.Ngay,
    Loai: r.LoaiNhap === 'SanXuat' ? 'Nhập kho (từ sản xuất)' : 'Nhập kho (từ NCC)',
    SoPhieu: r.SoPhieu, DoiTuong: r.DoiTuong || '', Nhap: lam2(r.PhatSinh), Xuat: 0 }); });
  xuatBH.forEach(r => rows.push({
    Ngay: r.Ngay, Loai: 'Phiếu bán hàng', SoPhieu: r.SoPhieu, DoiTuong: r.TenKhach || '',
    TenMau: r.TenMau || '', Nhap: 0,
    Xuat: donViChinhLaGop(h) && heSo > 0 ? lam2(so(r.SoLuongCai) / heSo) : so(r.SoLuongCai) }));
  xuatDon.forEach(r => {
    const cai = laGop(r.DonVi) ? so(r.SoLuongDat) * heSo : so(r.SoLuongDat);
    rows.push({ Ngay: r.Ngay, Loai: 'Đơn khách (dữ liệu cũ)', SoPhieu: 'Đơn #' + r.DonID,
      DoiTuong: r.TenKhach || '', TenMau: r.TenMau || '', Nhap: 0,
      Xuat: donViChinhLaGop(h) && heSo > 0 ? lam2(cai / heSo) : cai });
  });
  rows.sort((a, b) => new Date(a.Ngay) - new Date(b.Ngay));
  let luy = so(dongTong.TonDau);
  rows.forEach(r => { luy = lam2(luy + so(r.Nhap) - so(r.Xuat)); r.TonLuyKe = luy; });

  res.json({ success: true, ky, data: {
    ma: h.MaHang, ten: h.TenHang, donVi: h.DonViCoBan || 'Cái',
    tonDau: so(dongTong.TonDau), tonCuoi: so(dongTong.TonCuoi), rows,
    ghiChu: 'Phần nhập/sửa tay trực tiếp trên thẻ kho không có ngày nên không hiện ở đây — nó nằm trong "Tồn đầu kỳ".'
  } });
});

/* ---------------- Chi tiet TON KHO VAI cua 1 ma vai ---------------- */
router.get('/tonvai/chitiet', ...CN('tonvai'), async (req, res) => {
  const pool = await getPool();
  const ky = layKy(req.query);
  const maVai = String(req.query.maVai || '').trim();
  if (!maVai) return res.status(400).json({ success: false, message: 'Thiếu mã vải.' });
  const v = (await pool.request().input('m', sql.NVarChar, maVai).query(`
    SELECT v.VaiID, v.MaVai, lv.TenLoaiVai, ms.TenMau FROM DanhMucVai v
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = v.LoaiVaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID WHERE v.MaVai = @m`)).recordset[0];
  if (!v) return res.status(404).json({ success: false, message: 'Không tìm thấy mã vải.' });

  const coMet = await coCot(pool, 'VaiCay', 'SoMet');
  const rq = () => pool.request().input('id', sql.Int, v.VaiID)
    .input('tu', sql.Date, ky.tuNgay).input('den', sql.Date, ky.denNgay);

  const dau = (await rq().query(`
    SELECT ISNULL((SELECT SUM(KGNhap) FROM VaiCay WHERE VaiID=@id AND NgayNhap < @tu), 0)
         - ISNULL((SELECT SUM(ct.KGXuat) FROM PhieuXuatVaiChiTiet ct
                   JOIN PhieuXuatVai px ON px.PhieuXuatID = ct.PhieuXuatID
                   JOIN VaiCay c ON c.CayID = ct.CayID
                   WHERE c.VaiID=@id AND px.NgayXuat < @tu), 0) AS TonDau`)).recordset[0];

  const nhap = (await rq().query(`
    SELECT c.NgayNhap AS Ngay, c.MaCay, c.KGNhap AS KG, ${coMet ? 'c.SoMet' : '0'} AS Met,
           ISNULL(ncc.TenNCC, N'') AS DoiTuong, CONCAT(N'PN#', c.PhieuNhapID) AS SoPhieu, c.PhieuNhapID AS PhieuID
    FROM VaiCay c
    LEFT JOIN PhieuNhapVai pn ON pn.PhieuNhapID = c.PhieuNhapID
    LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = pn.NCC_ID
    WHERE c.VaiID=@id AND c.NgayNhap BETWEEN @tu AND @den
    ORDER BY c.NgayNhap, c.CayID`)).recordset;

  const xuat = (await rq().query(`
    SELECT px.NgayXuat AS Ngay, c.MaCay, ct.KGXuat AS KG, ${coMet ? 'ct.SoMet' : '0'} AS Met,
           ISNULL(px.NguoiNhan, N'') AS DoiTuong, ISNULL(d.MaDH, px.MaDon) AS MaDon,
           CONCAT(N'PX#', px.PhieuXuatID) AS SoPhieu, px.PhieuXuatID AS PhieuID
    FROM PhieuXuatVaiChiTiet ct
    JOIN PhieuXuatVai px ON px.PhieuXuatID = ct.PhieuXuatID
    JOIN VaiCay c ON c.CayID = ct.CayID
    LEFT JOIN DonHangSanXuat d ON d.DonHangID = px.DonHangID
    WHERE c.VaiID=@id AND px.NgayXuat BETWEEN @tu AND @den
    ORDER BY px.NgayXuat, px.PhieuXuatID`)).recordset;

  const rows = [
    ...nhap.map(r => ({ Ngay: r.Ngay, Loai: 'Nhập kho', SoPhieu: r.SoPhieu, PhieuID: r.PhieuID,
      MaCay: r.MaCay, DoiTuong: r.DoiTuong, Nhap: lam2(r.KG), Xuat: 0, NhapMet: lam2(r.Met), XuatMet: 0 })),
    ...xuat.map(r => ({ Ngay: r.Ngay, Loai: 'Xuất kho', SoPhieu: r.SoPhieu, PhieuID: r.PhieuID,
      MaCay: r.MaCay, DoiTuong: [r.DoiTuong, r.MaDon].filter(Boolean).join(' · '),
      Nhap: 0, Xuat: lam2(r.KG), NhapMet: 0, XuatMet: lam2(r.Met) }))
  ].sort((a, b) => new Date(a.Ngay) - new Date(b.Ngay));

  let luy = lam2(dau.TonDau);
  rows.forEach(r => { luy = lam2(luy + r.Nhap - r.Xuat); r.TonLuyKe = luy; });
  res.json({ success: true, ky, data: {
    ma: v.MaVai, ten: [v.TenLoaiVai, v.TenMau].filter(Boolean).join(' · '), donVi: 'KG',
    tonDau: lam2(dau.TonDau), tonCuoi: luy, rows, coMet
  } });
});

/* ---------------- Chi tiet TON KHO PHU KIEN cua 1 ma ---------------- */
router.get('/tonphukien/chitiet', ...CN('tonphukien'), async (req, res) => {
  const pool = await getPool();
  const ky = layKy(req.query);
  const ma = String(req.query.maPhuKien || '').trim();
  if (!ma) return res.status(400).json({ success: false, message: 'Thiếu mã phụ kiện.' });
  const pk = (await pool.request().input('m', sql.NVarChar, ma).query(`
    SELECT PhuKienID, MaPhuKien, TenPhuKien, DonViCoBan FROM DanhMucPhuKien WHERE MaPhuKien = @m`)).recordset[0];
  if (!pk) return res.status(404).json({ success: false, message: 'Không tìm thấy mã phụ kiện.' });

  const rq = () => pool.request().input('id', sql.Int, pk.PhuKienID)
    .input('tu', sql.Date, ky.tuNgay).input('den', sql.Date, ky.denNgay);

  const dau = (await rq().query(`
    SELECT ISNULL(SUM(CASE WHEN p.LoaiPhieu = N'Nhập' THEN ct.SoLuong ELSE -ct.SoLuong END), 0) AS TonDau
    FROM PhieuPhuKienChiTiet ct JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
    WHERE ct.PhuKienID = @id AND p.Ngay < @tu`)).recordset[0];

  const rows = (await rq().query(`
    SELECT p.Ngay, p.LoaiPhieu, p.PhieuID, ct.SoLuong, ct.DonVi, ct.DonGia, ct.GhiChu,
           ISNULL(ncc.TenNCC, N'') AS TenNCC, ISNULL(d.MaDH, p.MaDon) AS MaDon
    FROM PhieuPhuKienChiTiet ct
    JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
    LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID
    LEFT JOIN DonHangSanXuat d ON d.DonHangID = p.DonHangID
    WHERE ct.PhuKienID = @id AND p.Ngay BETWEEN @tu AND @den
    ORDER BY p.Ngay, p.PhieuID`)).recordset.map(r => ({
      Ngay: r.Ngay, Loai: r.LoaiPhieu === 'Nhập' ? 'Nhập kho' : 'Xuất kho',
      SoPhieu: (r.LoaiPhieu === 'Nhập' ? 'PN#' : 'PX#') + r.PhieuID, PhieuID: r.PhieuID,
      LoaiPhieu: r.LoaiPhieu,
      DoiTuong: [r.TenNCC, r.MaDon].filter(Boolean).join(' · '),
      DonVi: r.DonVi || pk.DonViCoBan, DonGia: r.DonGia == null ? null : tien(r.DonGia),
      Nhap: r.LoaiPhieu === 'Nhập' ? lam2(r.SoLuong) : 0,
      Xuat: r.LoaiPhieu === 'Nhập' ? 0 : lam2(r.SoLuong),
      GhiChu: r.GhiChu || ''
    }));
  let luy = lam2(dau.TonDau);
  rows.forEach(r => { luy = lam2(luy + r.Nhap - r.Xuat); r.TonLuyKe = luy; });
  res.json({ success: true, ky, data: {
    ma: pk.MaPhuKien, ten: pk.TenPhuKien, donVi: pk.DonViCoBan || '',
    tonDau: lam2(dau.TonDau), tonCuoi: luy, rows,
    ghiChu: 'Tồn cộng thẳng theo số lượng ghi trên phiếu, KHÔNG quy đổi — dòng nào ghi khác ĐVT cơ bản cần kiểm lại.'
  } });
});

/* ---------------- Chi tiet THU CHI: theo QUY (tien mat / tung ngan hang) hoac theo LOAI TAI KHOAN ---- */
router.get('/taichinh/chitiet', ...CN('taichinh'), async (req, res) => {
  const pool = await getPool();
  const ky = layKy(req.query);
  const loai = String(req.query.loai || 'quy');            // 'quy' | 'loaitk'
  const khoa = String(req.query.khoa || '').trim();        // quy: 'TienMat' | '<TaiKhoanNHID>' | 'ChuaGan'; loaitk: tên loại
  const coTKNH = await coBang(pool, 'DanhMucTaiKhoanNganHang') && await coCot(pool, 'PhieuThu', 'TaiKhoanNHID');
  const cotNH = coTKNH ? 'TaiKhoanNHID' : 'CAST(NULL AS INT)';

  const rq = () => pool.request().input('tu', sql.Date, ky.tuNgay).input('den', sql.Date, ky.denNgay);
  const dsThu = (await rq().query(`
    SELECT t.NgayThu AS Ngay, t.SoPhieu, t.SoTien, t.HinhThuc, t.DienGiai, ${cotNH} AS TaiKhoanNHID,
           ISNULL(t.TenDoiTuong, N'') AS DoiTuong, ISNULL(tk.TenTK, N'') AS TenTK, ISNULL(lt.TenLoai, N'(chưa phân loại)') AS TenLoai
    FROM PhieuThu t
    LEFT JOIN DanhMucTaiKhoan tk ON tk.TaiKhoanID = t.TaiKhoanID
    LEFT JOIN DanhMucLoaiTaiKhoan lt ON lt.LoaiTKID = tk.LoaiTKID
    WHERE t.NgayThu BETWEEN @tu AND @den`)).recordset;
  const dsChi = (await rq().query(`
    SELECT c.NgayChi AS Ngay, c.SoPhieu, c.SoTien, c.HinhThuc, c.DienGiai, ${cotNH} AS TaiKhoanNHID,
           ISNULL(c.TenDoiTuong, N'') AS DoiTuong, ISNULL(tk.TenTK, N'') AS TenTK, ISNULL(lt.TenLoai, N'(chưa phân loại)') AS TenLoai
    FROM PhieuChi c
    LEFT JOIN DanhMucTaiKhoan tk ON tk.TaiKhoanID = c.TaiKhoanID
    LEFT JOIN DanhMucLoaiTaiKhoan lt ON lt.LoaiTKID = tk.LoaiTKID
    WHERE c.NgayChi BETWEEN @tu AND @den`)).recordset;

  const laTM = h => String(h || '').trim() !== 'Chuyển khoản';
  let loc, tieuDe = '';
  if (loai === 'loaitk') {
    loc = r => String(r.TenLoai) === khoa;
    tieuDe = 'Loại tài khoản: ' + khoa;
  } else if (khoa === 'TienMat') {
    loc = r => laTM(r.HinhThuc); tieuDe = 'Quỹ tiền mặt';
  } else if (khoa === 'ChuaGan') {
    loc = r => !laTM(r.HinhThuc) && !r.TaiKhoanNHID; tieuDe = 'Chuyển khoản (chưa gán tài khoản)';
  } else {
    const id = parseInt(khoa, 10);
    loc = r => !laTM(r.HinhThuc) && Number(r.TaiKhoanNHID) === id;
    const nh = coTKNH ? (await pool.request().input('id', sql.Int, id)
      .query('SELECT TenNganHang, SoTaiKhoan FROM DanhMucTaiKhoanNganHang WHERE TaiKhoanNHID=@id')).recordset[0] : null;
    tieuDe = nh ? `${nh.TenNganHang} · ${nh.SoTaiKhoan}` : 'Tài khoản ngân hàng';
  }

  const rows = [
    ...dsThu.filter(loc).map(r => ({ Ngay: r.Ngay, Loai: 'Phiếu thu', SoPhieu: r.SoPhieu,
      DoiTuong: r.DoiTuong, TenTK: r.TenTK, TenLoai: r.TenLoai, HinhThuc: r.HinhThuc,
      Thu: tien(r.SoTien), Chi: 0, DienGiai: r.DienGiai || '' })),
    ...dsChi.filter(loc).map(r => ({ Ngay: r.Ngay, Loai: 'Phiếu chi', SoPhieu: r.SoPhieu,
      DoiTuong: r.DoiTuong, TenTK: r.TenTK, TenLoai: r.TenLoai, HinhThuc: r.HinhThuc,
      Thu: 0, Chi: tien(r.SoTien), DienGiai: r.DienGiai || '' }))
  ].sort((a, b) => new Date(a.Ngay) - new Date(b.Ngay) || String(a.SoPhieu).localeCompare(String(b.SoPhieu)));

  /* So du dau ky CHI tinh cho nhom QUY (tien co so du); nhom LOAI TAI KHOAN la dong tien theo khoan
     muc nen khong co "so du", cot luy ke chi la cong don trong ky. */
  let dauKy = 0;
  if (loai !== 'loaitk') {
    const cfg = (await pool.request().query(
      `SELECT ConfigValue FROM CauHinhHeThong WHERE ConfigKey = 'QUY_TIEN_MAT_DAU_KY'`)).recordset[0];
    const truoc = (await pool.request().input('tu', sql.Date, ky.tuNgay).query(`
      SELECT HinhThuc, ${cotNH} AS TaiKhoanNHID, SUM(SoTien) AS T, N'thu' AS L FROM PhieuThu WHERE NgayThu < @tu GROUP BY HinhThuc, ${coTKNH ? 'TaiKhoanNHID' : 'CAST(NULL AS INT)'}
      UNION ALL
      SELECT HinhThuc, ${cotNH} AS TaiKhoanNHID, SUM(SoTien) AS T, N'chi' AS L FROM PhieuChi WHERE NgayChi < @tu GROUP BY HinhThuc, ${coTKNH ? 'TaiKhoanNHID' : 'CAST(NULL AS INT)'}`)).recordset;
    dauKy = truoc.filter(loc).reduce((s2, r) => s2 + (r.L === 'thu' ? so(r.T) : -so(r.T)), 0);
    if (khoa === 'TienMat') dauKy += so(cfg && cfg.ConfigValue);
    else if (coTKNH && khoa !== 'ChuaGan') {
      const nh = (await pool.request().input('id', sql.Int, parseInt(khoa, 10))
        .query('SELECT SoDuDauKy FROM DanhMucTaiKhoanNganHang WHERE TaiKhoanNHID=@id')).recordset[0];
      dauKy += so(nh && nh.SoDuDauKy);
    }
  }
  let luy = tien(dauKy);
  rows.forEach(r => { luy = tien(luy + r.Thu - r.Chi); r.SoDu = luy; });
  res.json({ success: true, ky, data: {
    tieuDe, laQuy: loai !== 'loaitk', dauKy: tien(dauKy), cuoiKy: luy, rows,
    tongThu: tien(rows.reduce((s2, r) => s2 + r.Thu, 0)),
    tongChi: tien(rows.reduce((s2, r) => s2 + r.Chi, 0))
  } });
});

/* ---------------- GIA VON HANG HOA (khai tay / nap tu lenh SX) ---------------- */
router.get('/giavon', ...CN('giavon'), async (req, res) => {
  const pool = await getPool();
  if (!(await coBang(pool, 'GiaVonHangHoa'))) {
    return res.status(400).json({ success: false, message: 'Chưa chạy migration_v672.sql — bảng GiaVonHangHoa chưa tồn tại.' });
  }
  const rows = (await pool.request().query(`
    SELECT h.MaHangID, h.MaHang, h.TenHang, h.LoaiHang, h.GiaBan, h.DonViCoBan, d.MaDH,
           gv.GiaVon, gv.NguonGia, gv.MaDHNguon, gv.NgayCapNhat, gv.GhiChu
    FROM TheKhoHangHoa h
    LEFT JOIN GiaVonHangHoa gv ON gv.MaHangID = h.MaHangID
    LEFT JOIN DonHangSanXuat d ON d.DonHangID = h.DonHangID
    ORDER BY h.MaHang`)).recordset.map(r => ({
      MaHangID: r.MaHangID, MaHang: r.MaHang, TenHang: r.TenHang, LoaiHang: r.LoaiHang,
      GiaBan: tien(r.GiaBan), DonVi: r.DonViCoBan, MaDH: r.MaDH || null,
      GiaVon: r.GiaVon == null ? null : tien(r.GiaVon),
      NguonGia: r.NguonGia || '', MaDHNguon: r.MaDHNguon || '', NgayCapNhat: r.NgayCapNhat || null,
      GhiChu: r.GhiChu || '',
      LaiGop1: (r.GiaVon != null && so(r.GiaBan) > 0) ? tien(so(r.GiaBan) - so(r.GiaVon)) : null
    }));
  res.json({ success: true, data: rows });
});

// Khai tay gia von 1 ma hang
router.put('/giavon/:maHangId', requireAuth, requirePermission('BAOCAO', 'edit'), requireChucNang('BAOCAO', 'giavon'), async (req, res) => {
  const pool = await getPool();
  const giaVon = so(req.body.giaVon);
  if (giaVon < 0) return res.status(400).json({ success: false, message: 'Giá vốn không được âm.' });
  const mh = parseInt(req.params.maHangId, 10);
  const co = (await pool.request().input('id', sql.Int, mh)
    .query('SELECT MaHangID FROM TheKhoHangHoa WHERE MaHangID=@id')).recordset[0];
  if (!co) return res.status(404).json({ success: false, message: 'Không tìm thấy mã hàng.' });
  await pool.request()
    .input('mh', sql.Int, mh).input('gv', sql.Decimal(18, 2), giaVon)
    .input('gc', sql.NVarChar, req.body.ghiChu || null)
    .input('u', sql.Int, (req.session && req.session.user) ? req.session.user.userId : null)
    .query(`
      MERGE GiaVonHangHoa AS t
      USING (SELECT @mh AS MaHangID) AS s ON t.MaHangID = s.MaHangID
      WHEN MATCHED THEN UPDATE SET GiaVon=@gv, NguonGia=N'Khai tay', MaDHNguon=NULL,
           NgayCapNhat=CAST(SYSDATETIME() AS DATE), NguoiCapNhatID=@u, GhiChu=@gc
      WHEN NOT MATCHED THEN INSERT (MaHangID, GiaVon, NguonGia, NgayCapNhat, NguoiCapNhatID, GhiChu)
           VALUES (@mh, @gv, N'Khai tay', CAST(SYSDATETIME() AS DATE), @u, @gc);`);
  res.json({ success: true });
});

/* Nap gia von tu GIA THANH cua lenh SX (dung ham tinhGiaThanh cua qlsx.js — 1 nguon su that).
   Chi ghi de nhung ma hang co lien ket lenh SX va CHUA khai tay (tru khi ep = true). */
router.post('/giavon/naptulenhsx', requireAuth, requirePermission('BAOCAO', 'edit'), requireChucNang('BAOCAO', 'giavon'), async (req, res) => {
  const pool = await getPool();
  if (!(await coBang(pool, 'GiaVonHangHoa'))) {
    return res.status(400).json({ success: false, message: 'Chưa chạy migration_v672.sql — bảng GiaVonHangHoa chưa tồn tại.' });
  }
  const { tinhGiaThanh, getOrderByMaDH } = require('./qlsx');
  if (typeof tinhGiaThanh !== 'function' || typeof getOrderByMaDH !== 'function') {
    return res.status(500).json({ success: false, message: 'Không gọi được hàm tính giá thành của phân hệ QLSX.' });
  }
  const ep = req.body && req.body.ep === true;   // true = ghi đè cả những mã đã khai tay
  /* v6.91: HAI đường lần ra lệnh SX của một mã hàng — phải gộp cả hai:
       (A) TheKhoHangHoa.DonHangID   — thẻ kho tạo tay có chọn lệnh SX (dữ liệu cũ)
       (B) PhieuNhapKhoHang.DonHangID — phiếu nhập kho loại "Từ sản xuất" (đường CHUẨN từ v6.89)
     Mã hàng do PHIẾU tự sinh ra KHÔNG có TheKhoHangHoa.DonHangID, nên nếu chỉ đi đường (A) thì đúng
     những mã mới nhất lại là những mã không bao giờ nạp được giá vốn. */
  const coPhieuNK = await coBang(pool, 'PhieuNhapKhoHang');
  const ds = (await pool.request().query(`
    SELECT MaHangID, MaHang, MaDH, NguonGia FROM (
      SELECT h.MaHangID, h.MaHang, d.MaDH, gv.NguonGia, 1 AS ThuTuUuTien
      FROM TheKhoHangHoa h
      JOIN DonHangSanXuat d ON d.DonHangID = h.DonHangID
      LEFT JOIN GiaVonHangHoa gv ON gv.MaHangID = h.MaHangID
      ${coPhieuNK ? `
      UNION ALL
      SELECT h.MaHangID, h.MaHang, d.MaDH, gv.NguonGia, 2 AS ThuTuUuTien
      FROM PhieuNhapKhoHangChiTiet ct
      JOIN PhieuNhapKhoHang p ON p.PhieuNKID = ct.PhieuNKID AND p.TrangThai <> N'Đã hủy'
                             AND p.LoaiNhap = N'SanXuat' AND p.DonHangID IS NOT NULL
      JOIN DonHangSanXuat d ON d.DonHangID = p.DonHangID
      JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
      LEFT JOIN GiaVonHangHoa gv ON gv.MaHangID = h.MaHangID` : ''}
    ) u
    -- Một mã có thể ra từ cả 2 đường / nhiều dòng phiếu -> chỉ giữ MỘT dòng cho mỗi mã.
    GROUP BY MaHangID, MaHang, MaDH, NguonGia
    ORDER BY MaHang`)).recordset;

  /* ================================================================================================
     v6.91.1 — LAY DUNG "GIA THANH 1 SAN PHAM" (gt.giaThanh1SP), KHONG tu chia lai.

     ⚠️ TRUOC DAY o day tu tinh `tongCong / slCai` voi mot mau so RIENG (luy ke cong doan Kho nhap).
     Hai hau qua:
       - Man "Gia thanh san pham" (QLSX) hien mot so, bao cao ton kho hien MOT SO KHAC cho cung mot
         lenh SX — khong ai doi chieu duoc, va nguoi dung doc ra thanh "bao cao dang lay Tong chi phi".
       - Mau so chia sai (vd = 1) la gia von thanh dung TONG CHI PHI ca lenh, sai hang tram lan.

     Ly do cu de KHONG dung giaThanh1SP la: slDungTinh co the theo don vi RI nen giaThanh1SP la gia 1
     RI. Ly do do DA HET HIEU LUC tu v6.91.1: tinhGiaThanh() nay lay SL nhap kho TU PHIEU NHAP KHO va
     DA QUY VE CAI (xem qlsx.js, khoi "SL hoan thanh"). Nen giaThanh1SP la GIA 1 CAI - dung don vi voi
     GiaBan va GiaVonHangHoa.GiaVon.

     => Mot so duy nhat, hien o ca hai man hinh. KHONG them lai phep chia nao o day.
     ================================================================================================ */
  let capNhat = 0, boQua = 0, khongTinhDuoc = [];
  const giaThanhTheoDon = new Map();   // 1 lệnh SX ra nhiều mã thẻ kho -> chỉ tính giá thành 1 lần
  for (const r of ds) {
    if (!ep && r.NguonGia === 'Khai tay') { boQua++; continue; }
    try {
      let gt = giaThanhTheoDon.get(r.MaDH);
      if (gt === undefined) {
        const order = await getOrderByMaDH(pool, r.MaDH);
        gt = order ? await tinhGiaThanh(pool, order) : null;
        giaThanhTheoDon.set(r.MaDH, gt);
      }
      if (!gt) { khongTinhDuoc.push(r.MaHang + ' (không thấy lệnh SX ' + r.MaDH + ')'); continue; }
      const g = so(gt.giaThanh1SP);
      if (!(g > 0)) {
        khongTinhDuoc.push(r.MaHang + ' (' + r.MaDH + ': chưa có "Giá thành 1 sản phẩm"'
          + (gt.slDungTinh > 0 ? ' — chưa đủ số liệu chi phí' : ' — chưa có SL hoàn thành, cần lập phiếu nhập kho cho lệnh này') + ')');
        continue;
      }
      await pool.request()
        .input('mh', sql.Int, r.MaHangID).input('gv', sql.Decimal(18, 2), so(g))
        .input('madh', sql.NVarChar, r.MaDH)
        .input('u', sql.Int, (req.session && req.session.user) ? req.session.user.userId : null)
        .query(`
          MERGE GiaVonHangHoa AS t
          USING (SELECT @mh AS MaHangID) AS s ON t.MaHangID = s.MaHangID
          WHEN MATCHED THEN UPDATE SET GiaVon=@gv, NguonGia=N'Lệnh SX', MaDHNguon=@madh,
               NgayCapNhat=CAST(SYSDATETIME() AS DATE), NguoiCapNhatID=@u
          WHEN NOT MATCHED THEN INSERT (MaHangID, GiaVon, NguonGia, MaDHNguon, NgayCapNhat, NguoiCapNhatID)
               VALUES (@mh, @gv, N'Lệnh SX', @madh, CAST(SYSDATETIME() AS DATE), @u);`);
      capNhat++;
    } catch (err) {
      khongTinhDuoc.push(r.MaHang + ' (lỗi: ' + err.message + ')');
    }
  }
  res.json({ success: true, data: { capNhat, boQua, khongTinhDuoc, tongMaCoLenhSX: ds.length } });
});

/* ================================================================================================
   XUAT EXCEL — 1 route dung chung cho ca 5 bao cao
   ================================================================================================ */
function themSheet(wb, ten, cols, rows, dongTong) {
  const ws = wb.addWorksheet(ten);
  ws.columns = cols;
  ws.getRow(1).font = { bold: true };
  rows.forEach(r => ws.addRow(r));
  if (dongTong) {
    const t = ws.addRow(dongTong);
    t.font = { bold: true };
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return ws;
}

/* ⚠️ /export nhan ?loai= tu do va goi lai CHINH 5 ham bao cao => phai kiem requireChucNang THEO LOAI,
   khong thi user chi co quyen "Ton kho vai" van tai duoc file lai/lo va so du quy.
   (Dung lo hong "shared multi-tab endpoint" da ghi trong project_qlnoibo_permission_fix_scope.) */
const CN_THEO_LOAI = {
  tonhanghoa: 'tonhanghoa', tonvai: 'tonvai', tonphukien: 'tonphukien',
  taichinh: 'taichinh', kinhdoanh: 'kinhdoanh'
};
router.get('/export', requireAuth, requirePermission('BAOCAO', 'view'), async (req, res, next) => {
  const ma = CN_THEO_LOAI[String(req.query.loai || 'tonhanghoa')];
  if (!ma) return res.status(400).json({ success: false, message: 'Loại báo cáo không hợp lệ.' });
  return requireChucNang('BAOCAO', ma)(req, res, next);
}, async (req, res) => {
  try {
    const pool = await getPool();
    const ky = layKy(req.query);
    const loai = String(req.query.loai || 'tonhanghoa');
    const wb = new ExcelJS.Workbook();
    const nhan = `${ky.tuNgay} .. ${ky.denNgay}`;
    let tenFile = loai;

    if (loai === 'tonhanghoa') {
      const kq = await baoCaoTonHangHoa(pool, ky);
      themSheet(wb, 'Tồn kho hàng hóa', [
        { header: 'Mã hàng', key: 'MaHang', width: 18 },
        { header: 'Tên hàng', key: 'TenHang', width: 34 },
        { header: 'Danh mục', key: 'TenDanhMuc', width: 18 },
        { header: 'ĐVT', key: 'DonVi', width: 8 },
        { header: 'Tồn đầu kỳ', key: 'TonDau', width: 12 },
        { header: 'Nhập trong kỳ', key: 'Nhap', width: 13 },
        { header: 'Xuất trong kỳ', key: 'Xuat', width: 13 },
        { header: 'Tồn cuối kỳ', key: 'TonCuoi', width: 12 },
        // v6.91: giá nhập + giá trị tồn theo giá nhập (tiền THẬT đã bỏ ra), đặt trước giá bán.
        { header: 'Giá nhập (1 ĐVT)', key: 'GiaNhap', width: 15 },
        { header: 'Nguồn giá nhập', key: 'NguonGiaNhap', width: 20 },
        { header: 'Giá trị tồn (theo giá nhập)', key: 'GiaTriTonNhap', width: 24 },
        { header: 'Giá bán (1 cái)', key: 'GiaBan', width: 14 },
        { header: 'Giá trị tồn (theo giá bán)', key: 'GiaTriTon', width: 22 }
      ], kq.rows, { MaHang: 'TỔNG', ...kq.tong });
    } else if (loai === 'tonvai') {
      const kq = await baoCaoTonVai(pool, ky);
      themSheet(wb, 'Tồn kho vải', [
        { header: 'Mã vải', key: 'MaVai', width: 18 },
        { header: 'Loại vải', key: 'TenLoaiVai', width: 20 },
        { header: 'Màu', key: 'TenMau', width: 16 },
        { header: 'Khổ', key: 'KhoVai', width: 8 },
        { header: 'Tồn đầu (KG)', key: 'TonDauKG', width: 13 },
        { header: 'Nhập (KG)', key: 'NhapKG', width: 12 },
        { header: 'Xuất (KG)', key: 'XuatKG', width: 12 },
        { header: 'Tồn cuối (KG)', key: 'TonCuoiKG', width: 13 },
        { header: 'Tồn cuối (mét)', key: 'TonCuoiMet', width: 13 },
        { header: 'Đơn giá BQ', key: 'DonGiaBQ', width: 13 },
        { header: 'Giá trị tồn', key: 'GiaTriTon', width: 16 }
      ], kq.rows, { MaVai: 'TỔNG', ...kq.tong });
    } else if (loai === 'tonphukien') {
      const kq = await baoCaoTonPhuKien(pool, ky);
      themSheet(wb, 'Tồn kho phụ kiện', [
        { header: 'Mã phụ kiện', key: 'MaPhuKien', width: 18 },
        { header: 'Tên phụ kiện', key: 'TenPhuKien', width: 32 },
        { header: 'Loại', key: 'TenLoai', width: 18 },
        { header: 'Size', key: 'Size', width: 10 },
        { header: 'ĐVT', key: 'DonVi', width: 10 },
        { header: 'Tồn đầu kỳ', key: 'TonDau', width: 12 },
        { header: 'Nhập trong kỳ', key: 'Nhap', width: 13 },
        { header: 'Xuất trong kỳ', key: 'Xuat', width: 13 },
        { header: 'Tồn cuối kỳ', key: 'TonCuoi', width: 12 },
        { header: 'Đơn giá BQ', key: 'DonGiaBQ', width: 13 },
        { header: 'Giá trị tồn', key: 'GiaTriTon', width: 16 }
      ], kq.rows, { MaPhuKien: 'TỔNG', ...kq.tong });
    } else if (loai === 'taichinh') {
      const kq = await baoCaoTaiChinh(pool, ky);
      themSheet(wb, 'Quỹ', [
        { header: 'Quỹ / Tài khoản', key: 'Ten', width: 32 },
        { header: 'Số tài khoản', key: 'SoTaiKhoan', width: 20 },
        { header: 'Đầu kỳ', key: 'DauKy', width: 16 },
        { header: 'Thu trong kỳ', key: 'Thu', width: 16 },
        { header: 'Chi trong kỳ', key: 'Chi', width: 16 },
        { header: 'Cuối kỳ', key: 'CuoiKy', width: 16 }
      ], kq.quy, { Ten: 'TỔNG', ...kq.tongQuy });
      themSheet(wb, 'Dòng tiền theo loại TK', [
        { header: 'Loại tài khoản', key: 'TenLoai', width: 32 },
        { header: 'Tính chi phí KD', key: 'TinhChiPhiKD', width: 16 },
        { header: 'Thu', key: 'Thu', width: 16 },
        { header: 'Chi', key: 'Chi', width: 16 }
      ], kq.theoTK.map(r => ({ ...r, TinhChiPhiKD: r.TinhChiPhiKD ? 'Có' : '' })));
      const c = kq.congNo;
      themSheet(wb, 'Công nợ cuối kỳ', [
        { header: 'Khoản mục', key: 'K', width: 42 },
        { header: 'Số tiền', key: 'V', width: 18 }
      ], [
        { K: 'PHẢI THU KHÁCH HÀNG', V: c.PhaiThu },
        { K: '  Tổng phiếu bán hàng', V: c.PhaiThu_BanHang },
        { K: '  Điều chỉnh', V: c.PhaiThu_DieuChinh },
        { K: '  Đã thu', V: -c.PhaiThu_DaThu },
        { K: '', V: null },
        { K: 'PHẢI TRẢ NHÀ CUNG CẤP', V: c.PhaiTra },
        { K: '  Nhập vải', V: c.PhaiTra_Vai },
        { K: '  Nhập phụ kiện', V: c.PhaiTra_PhuKien },
        { K: '  Điều chỉnh', V: c.PhaiTra_DieuChinh },
        { K: '  Đã trả', V: -c.PhaiTra_DaTra }
      ]);
    } else if (loai === 'kinhdoanh') {
      const kq = await baoCaoKinhDoanh(pool, ky);
      const t = kq.tong;
      themSheet(wb, 'Kết quả kinh doanh', [
        { header: 'Chỉ tiêu', key: 'K', width: 46 },
        { header: 'Số tiền', key: 'V', width: 20 }
      ], [
        { K: 'Tổng tiền hàng (sau CK shop)', V: t.TongTienHang },
        { K: 'Chiết khấu NPP', V: -t.TienCKNPP },
        { K: 'DOANH THU THUẦN (chưa gồm thuế GTGT)', V: t.DoanhThuThuan },
        { K: 'Giá vốn hàng bán', V: -t.GiaVon },
        { K: 'LÃI GỘP', V: t.LaiGop },
        { K: 'Chi phí kinh doanh', V: -t.ChiPhiKD },
        { K: 'LỢI NHUẬN', V: t.LoiNhuan },
        { K: '', V: null },
        { K: 'Thuế GTGT đầu ra (thu hộ, không tính doanh thu)', V: t.TienVAT },
        { K: 'Tổng thanh toán trên phiếu', V: t.TongThanhToan },
        { K: 'Số phiếu bán hàng', V: t.SoPhieu },
        { K: 'Tổng SL bán (cái)', V: t.TongSLCai }
      ]);
      themSheet(wb, 'Theo mã hàng', [
        { header: 'Mã hàng', key: 'MaHang', width: 18 },
        { header: 'Tên hàng', key: 'TenHang', width: 34 },
        { header: 'SL bán (cái)', key: 'SLCai', width: 12 },
        { header: 'Doanh thu', key: 'DoanhThu', width: 16 },
        { header: 'Giá vốn 1 cái', key: 'GiaVon1', width: 14 },
        { header: 'Giá vốn', key: 'GiaVon', width: 16 },
        { header: 'Lãi gộp', key: 'LaiGop', width: 16 },
        { header: 'Tỷ lệ lãi (%)', key: 'TyLeLai', width: 13 },
        { header: 'Nguồn giá vốn', key: 'NguonGia', width: 14 }
      ], kq.chiTiet);
      themSheet(wb, 'Chi phí kinh doanh', [
        { header: 'Loại tài khoản', key: 'TenLoai', width: 28 },
        { header: 'Tài khoản', key: 'TenTK', width: 34 },
        { header: 'Số tiền', key: 'SoTien', width: 18 },
        { header: 'Số phiếu', key: 'SoPhieu', width: 10 }
      ], kq.chiPhi);
    } else {
      return res.status(400).json({ success: false, message: 'Loại báo cáo không hợp lệ.' });
    }

    // Ghi ky bao cao vao o dau tien cua moi sheet (de in ra biet la ky nao)
    wb.eachSheet(ws => {
      ws.spliceRows(1, 0, []);
      ws.getCell('A1').value = `Kỳ báo cáo: ${nhan}`;
      ws.getCell('A1').font = { bold: true, italic: true };
      ws.views = [{ state: 'frozen', ySplit: 2 }];
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="baocao_${tenFile}_${ky.tuNgay}_${ky.denNgay}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[baocao GET /export] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi xuất Excel: ' + err.message });
  }
});

module.exports = router;
