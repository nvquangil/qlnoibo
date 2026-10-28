/* ================================================================================================
   PHIEU NHAP KHO HANG HOA  (v6.89)  - module KHOHANG, chuc nang 'nhapkho', migration_v681 + v682.

   HAI LOAI NHAP:
     - NhaCungCap : hang mua ngoai, CO don gia -> TANG CONG NO PHAI TRA cho NCC.
     - SanXuat    : hang xuong minh lam ra, gan LENH SX, KHONG sinh cong no.

   LUU PHIEU LAM DUNG 3 VIEC — khong hon:
     1. Tao MA HANG trong danh muc neu chua co (de xuat/ban duoc ngay).
     2. Cong CONG NO phai tra NCC (chi loai NhaCungCap).
     3. Len BAO CAO TON KHO hang hoa.
   Phieu KHONG ghi vao o "Nhap" cua the kho. THE KHO chi duoc tao khi nguoi dung bam "Tao the kho".

   TON KHO co HAI NGUON RỜI NHAU (migration_v682, view vw_TonTheoMau):
     Nguon 1 - THE KHO  : TheKhoChiTietMau.NhapCai (khai tay o the kho / QLSX cong doan KN)
     Nguon 2 - CHUNG TU : PhieuNhapKhoHangChiTiet.SoLuongChinh cua phieu chua huy  <- file nay
   TON = Nguon1 + Nguon2 - XuatCai. Hai nguon khong the dem hai lan vi phieu KHONG ghi vao NhapCai.

   MA HANG CHUA CO -> SINH MA LUON, nhung PHAI khai du Ten hang + 2 DVT + ty le quy doi. Ban v6.78
   mac dinh ngam 'Cái'/'Ri'/1 — ma quan kho theo Ri ma bi gan LoaiRi=1 thi moi phep quy doi ton ve
   sau sai gap LoaiRi lan va khong co gi bao loi.

   ⚠️ Lich su de khong lap lai: v6.78-v6.86 phieu vua sinh ma vua ghi NhapCai, con nut "Tao the kho"
   lai mo form TAO MOI ⇒ luon bao "ma da ton tai". v6.87 thu bo han viec sinh ma ⇒ khong xuat duoc
   hang. v6.89 tach dung ranh: phieu lo ma hang + cong no + ton; the kho lo mau/anh/gia ban.
   ================================================================================================ */
const express = require('express');
const ExcelJS = require('exceljs');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');
const { so, tien, laDonViGop, donViChinhLaGop, slSangCai, sinhSoPhieu } = require('../utils/banHangCommon');
const { noiDangDungMaHang } = require('../utils/maHangThamChieu');
const { damBaoDongMau, capNhatAnhDaiDien, datAnTheKho, coCotAnTheKho } = require('../utils/theKhoMau');
// v7.46: mot ban do cot TheKhoHangHoa.TenHoaDon (migration_v690) — dung chung, khong tu viet lai.
const { coCotTenHoaDon } = require('../utils/maHangCapNhat');
// v8.07: tu dong nap Gia von hang hoa TU gia nhap NCC moi khi luu/sua/huy/xoa phieu — xem ghi chu
// chi tiet trong chinh ham nay (giaNhapHangHoa.js). Goi SAU KHI COMMIT, tu boc try/catch rieng.
const { napGiaVonTuMaHang } = require('../utils/giaNhapHangHoa');
// v8.90: hang TU SAN XUAT -> nap gia von tu giaThanh1SP cua chinh lenh SX. Song song voi duong NCC
// o tren, nhung nguon gia khac han nhau nen la ham rieng — xem ghi chu trong giaVonLenhSX.js.
const { napGiaVonTuLenhSX, loiNhanGiaVon } = require('../utils/giaVonLenhSX');
// v9.09: SL da lap phieu nhap kho cua tung lenh, QUY VE CAI — de biet lenh nao da nhap xong.
// ⚠️ KHONG tu cong SoLuongChinh o day: don vi chinh cua ma hang co the la Ri. Xem ghi chu trong file.
const { slPhieuNhapTheoDon } = require('../utils/slNhapKhoChungTu');

const router = express.Router();

['get', 'post', 'put', 'delete'].forEach(method => {
  const goc = router[method].bind(router);
  router[method] = (path, ...handlers) => goc(path, ...handlers.map(h => (
    h.length >= 4 ? h : (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)
  )));
});

const CN = 'nhapkho';

/* Quy SL nguoi dung go ve DON VI CHINH cua ma hang (giong slSangDonViChinh ben banHangCommon,
   nhung o day nhan san doi tuong ma hang da doc tu CSDL). */
function veDonViChinh(soLuong, donVi, mh) {
  const he = so(mh.LoaiRi) || 1;
  const cai = slSangCai(soLuong, donVi, mh.LoaiRi, mh);
  return Math.round(donViChinhLaGop(mh) ? cai / he : cai);
}

/* ================================================================================================
   ⚠️ v6.89 — PHAN HE NAY KHONG CON GHI VAO TheKhoChiTietMau.NhapCai.

   Ham ghiNhapKho() da bi GO BO. Ton kho hang hoa nay co HAI NGUON RỜI NHAU (migration_v682):
     Nguon 1 - THE KHO  : TheKhoChiTietMau.NhapCai  (nguoi dung khai tay o the kho, hoac QLSX cong doan KN)
     Nguon 2 - CHUNG TU : PhieuNhapKhoHangChiTiet.SoLuongChinh cua phieu CHUA HUY  <- chinh la file nay
   View vw_TonTheoMau / vw_TonKhoHangHoa cong hai nguon lai. Vi phieu nhap KHONG BAO GIO ghi vao
   NhapCai, hai nguon khong the dem hai lan — bat bien nay do CAU TRUC bao dam, khong phai do co/flag.

   HE QUA phai nho:
     - Huy / xoa / sua phieu thi ton TU DONG dung theo, KHONG con phai tru NhapCai bang tay.
     - Cung vi the KHONG con the "chan huy phieu khi hang da ban het": truoc day phep tru NhapCai
       lam viec do. Nay huy phieu co the lam ton am — dung utils/kiem_ton_am.js de soi.
   ⚠️ KHONG them lai duong ghi NhapCai o day. Them lai la dem hai lan ngay lap tuc.
   ================================================================================================ */

/* ================================================================================================
   DANH MUC PHUC VU FORM
   ================================================================================================ */
router.get('/danhmuc', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const q = (t) => pool.request().query(t).then(r => r.recordset);
  const [ncc, donHang, theKho, nhom, mauSac, donVi] = await Promise.all([
    q('SELECT NCC_ID, TenNCC FROM NhaCungCap ORDER BY TenNCC'),
    /* v8.47 — DOI DIEU KIEN HIEN LENH SX: lenh chi can DA GHI NHAN it nhat 1 lan o cong doan
       KHO NHAP ('KN') la hien ra ngay, khong phai doi chay het luong toi 'Hoàn thành'.
       Ly do: to kho nhap hang theo tung dot; bat cho den khi lenh dong hoan toan moi cho lap phieu
       la phieu luon lap muon hon thuc te.
       ⚠️ DAY LA NOI LONG so voi v6.80 (truoc: BAT BUOC TrangThai = 'Hoàn thành'). Danh doi da biet:
       lenh dang chay co the lap phieu nhap kho, nen so "% hoan thanh" cua lenh va ton kho se lech
       nhau TRONG KHI lenh chua xong — chap nhan, vi so lieu do chinh la nhap bo sung nhieu dot.
       GIU LAI ve 'Hoàn thành' bang OR: lenh nao truoc day hien duoc thi VAN hien, khong co lenh nao
       bien mat khoi o chon sau khi nang cap (vd lenh cu da hoan thanh nhung chua tung ghi 'KN').
       v6.89: BO cac lenh DA GAN vao mot phieu nhap khac (phieu chua huy) — mot lenh SX chi nhap kho
       mot lan, de lai trong danh sach la mo duong nhap trung ca lenh.
       ⛔ LUAT v6.89 NAY DA BI THAY THE O v9.09 — "mot lenh chi nhap kho mot lan" la sai voi thuc te
          (to kho nhap theo tung dot). Nay lenh o lai den khi NHAP XONG; chong nhap trung bang cach
          hien ro "da nhap X/Y cai" ngay tren tung dong cua o chon, khong bang cach giau lenh di.
       ⚠️ Phai GIU LAI lenh cua CHINH phieu dang sua (?phieuNKID=), khong thi mo form Sua se thay o
       lenh SX rong roi bam Luu la mat lien ket - dung kieu loi am tham. */
    /* v7.87: NHAP BO SUNG. `?keCaDaNhap=1` -> GIU LAI ca lenh da nhap xong, de nguoi dung sua/xem lai.
       v9.09 DOI NGHIA O TICH: truoc day no la "hien ca lenh DA CO PHIEU"; nay la "hien ca lenh DA
       NHAP DU" — vi lenh dang nhap do dang bay gio TU DONG o lai trong danh sach, khong phai tich gi.
       v9.09 — BO HAN bo loc NOT EXISTS(phieu nao do), VA BO LUON `TOP`. Luat moi tinh bang JS o
       locLenhChoPhieuNhap() vi no can luy ke cong doan KN, thu khong the viet lai trong cau nay.

       🔴 VI SAO PHAI BO `TOP` chu khong phai nang len 500: ban cu dat TOP 300 SAU bo loc
       "NOT EXISTS(phieu)" nen no DAO SAU tuy y vao lich su — luon du 300 lenh chua lap phieu, ke ca
       lenh tu 2 nam truoc. Doi thanh "TOP 500 roi moi loc bang JS" la THU HEP cua so: lenh xep hang
       501 tro di khong bao gio vao duoc danh sach du chua tung lap phieu, va o chon la <select>
       thuan khong co o tim nen khong voi toi duoc. Ra soat cheo bat duoc — da bo TOP.
       Doi lai: cat con 300 o cuoi locLenhChoPhieuNhap(), tuc 300 lenh CON PHAI NHAP moi nhat.
       Hai subquery tuong quan (so phieu, so phieu gan nhat) cung da chuyen sang slPhieuNhapTheoDon()
       — giu lai o day la moi dong lenh do bang phieu hai lan trong khi PhieuNhapKhoHang khong co
       index tren DonHangID. */
    q(`SELECT d.DonHangID, d.MaDH, d.TenSanPham, d.TrangThai
       FROM DonHangSanXuat d
       WHERE (d.TrangThai = N'Hoàn thành'
              OR EXISTS (SELECT 1 FROM TienDoSanXuat td
                           JOIN CongDoanSanXuat cd ON cd.StageID = td.StageID
                          WHERE td.DonHangID = d.DonHangID AND cd.MaCongDoan = 'KN'))
       ORDER BY d.DonHangID DESC`),
    q('SELECT TheKhoDanhMucID, TenTheKho FROM TheKhoDanhMuc ORDER BY TenTheKho'),
    /* ⚠️ Ten bang la DanhMucNhomSanPham (migration_v54), KHONG phai NhomSanPham.
       v6.98 tro xuong go sai ten bang, va `.catch(() => [])` NUOT LOI nen o "Loai hang" tren phieu
       luon trong ma khong co dau hieu gi. Da bo .catch: sai ten bang thi phai NO ra de con biet. */
    q('SELECT NhomSanPhamID, TenNhom FROM DanhMucNhomSanPham ORDER BY TenNhom'),
    q('SELECT MauSacID, TenMau FROM MauSac ORDER BY TenMau'),
    /* v7.02: tra ve ca LaDonViGop de form biet don vi nao la don vi GOP (Ri, Ta, Thung) — dung lam
       goi y cho o "DVT quy doi". Thieu co nay thi form phai doan theo ten "Ri", danh muc khong co
       "Ri" la doan sai. */
    q('SELECT TenDonVi, LaDonViGop FROM DanhMucDonViTinh ORDER BY ISNULL(ThuTu, 999), TenDonVi').catch(() => [])
  ]);
  /* v7.46: TenHoaDon (migration_v690) — de go trung ma da co thi dong khai dien lai duoc ten da khai,
     khong de trong roi ghi de. Chua chay migration thi tra NULL. */
  const cotTenHDdm = (await coCotTenHoaDon(pool)) ? 'TenHoaDon' : 'CAST(NULL AS NVARCHAR(255)) AS TenHoaDon';
  const hang = await q(`
    SELECT MaHangID, MaHang, TenHang, LoaiRi, DonViCoBan, DonViQuyDoi, GiaBan, ${cotTenHDdm}
    FROM TheKhoHangHoa ORDER BY MaHang`);
  const donHangLoc = await locLenhChoPhieuNhap(pool, donHang, {
    keCaDaNhap: req.query.keCaDaNhap === '1',
    phieuNKID: parseInt(req.query.phieuNKID, 10) || 0
  });
  res.json({ success: true, data: { ncc, donHang: donHangLoc, theKho, nhom, mauSac, donVi, hang } });
});

/* ================================================================================================
   v9.09 — LENH SX O LAI TRONG O CHON CHO DEN KHI NHAP XONG

   Nguyen 2026-10-28: "khi kho nhap cap nhat lan dau du chua hoan thanh nhung phieu nhap kho hang hoa
   hien lenh sx do luon. khi nao lenh do hoan thanh phieu nhap cuoi cung nhap xong lenh do se khong
   hien nua."

   TRUOC (v6.89): lenh BIEN MAT ngay sau phieu DAU TIEN. To kho nhap theo nhieu dot nen tu dot 2 tro
   di lenh khong con trong o chon, phai biet duong tich "Nhap bo sung" — khong ai noi cho ho biet,
   dung kieu loi "khong co nut de bam" (xem feedback_qlnoibo_an_nut_khong_noi_ly_do).

   NAY — AN lenh khi va chi khi ca BA dieu cung dung:
     (1) da co it nhat MOT phieu nhap kho chua huy, VA
     (2) lenh o trang thai 'Hoàn thành', VA
     (3) DA NHAP DU: tong SL tren cac phieu (quy ve CAI) >= luy ke cong doan Kho nhap (CAI).

   Vi sao moc (3) la LUY KE KN chu khong phai SL cat: chung tu nhap kho phai khop voi cai TO KHO da
   ghi nhan, khong phai voi san luong cat. Hai so nay duoc phep lech (xem ghi chu v8.47 o tren) va
   lech do chinh la "con hang chua lam phieu".

   LUI VE AN TOAN:
     - Lenh CU khong co luy ke KN (canNhap = 0, vd lenh truoc v6.89 chi co TrangThai='Hoàn thành'):
       quay ve dung luat cu "co phieu la an". Khong lenh cu nao doi hanh vi sau khi nang cap.
     - Lenh cua CHINH phieu dang sua (?phieuNKID=) LUON duoc giu, du da nhap du. Ban SQL cu lam viec
       nay bang `p.PhieuNKID <> X`, nhung ban do SAI khi lenh co tu 2 phieu tro len: van con phieu
       khac X ton tai => lenh bi an => mo form Sua thay o lenh SX rong, bam Luu la mat lien ket.
       Ban JS nay giu vo dieu kien nen het han loi do.
     - Moi loi doc (KN / phieu) deu bat lai: hong mot nguon thi coi nhu 0 => KHONG an lenh nao. Tha
       thua lenh trong o chon con hon lenh bien mat khong ly do.
   ================================================================================================ */
async function locLenhChoPhieuNhap(pool, ds, { keCaDaNhap, phieuNKID }) {
  let luyKeKN = {}, daLapPhieu = {};
  try {
    luyKeKN = await require('./qlsx').slKhoNhapTheoDon(pool);
  } catch (e) { console.error('[nhapkho /danhmuc] khong doc duoc luy ke cong doan KN (coi nhu 0, khong an lenh nao): ', e); }
  try {
    daLapPhieu = await slPhieuNhapTheoDon(pool);
  } catch (e) { console.error('[nhapkho /danhmuc] khong doc duoc SL da lap phieu (coi nhu 0, khong an lenh nao): ', e); }

  let donDangSua = 0;
  if (phieuNKID) {
    try {
      const r = (await pool.request().input('p', sql.Int, phieuNKID)
        .query('SELECT DonHangID FROM PhieuNhapKhoHang WHERE PhieuNKID = @p')).recordset[0];
      donDangSua = (r && r.DonHangID) ? Number(r.DonHangID) : 0;
    } catch (e) { console.error('[nhapkho /danhmuc] khong doc duoc lenh cua phieu dang sua: ', e); }
  }

  const dungSo = (d) => {
    const id = Number(d.DonHangID);
    const p = daLapPhieu[id] || {};
    /* Lam tron ve so nguyen cai TRUOC khi so: SoLuongChinh la INT nhung tich voi LoaiRi co the ra
       so le qua DECIMAL cua SQL; luy ke KN la INT. De nguyen so le thi 119.999 >= 120 la false
       vinh vien => lenh khong bao gio an. */
    const canNhapCai = Math.round(Number((luyKeKN[id] || {}).SLKhoNhapCai) || 0);
    const daNhapCai  = Math.round(Number(p.SLCai) || 0);
    const soPhieu    = Number(p.SoLanNhap) || 0;
    const tt         = String(d.TrangThai || '').trim();
    const daDu       = canNhapCai > 0 ? (daNhapCai >= canNhapCai) : (soPhieu > 0);
    /* Lenh ĐÃ HỦY: GIU NGUYEN luat cu "co phieu la an". Khong cho no roi vao nhanh moi, vi
       `TrangThai <> Hoàn thành` se lam no nam lai danh sach VINH VIEN (ra soat cheo bat duoc). */
    const nhapXong   = soPhieu > 0 && (tt === 'Đã hủy' || (tt === 'Hoàn thành' && daDu));
    return Object.assign({}, d, {
      SoPhieuDaNhap: soPhieu,
      SoPhieuGanNhat: p.SoPhieuGanNhat || null,
      DaNhapCai: daNhapCai,
      CanNhapCai: canNhapCai,
      ConThieuCai: Math.max(0, canNhapCai - daNhapCai),
      NhapXong: nhapXong ? 1 : 0
    });
  };

  const ra = [];
  let coDonDangSua = false;
  for (const d of ds) {
    const id = Number(d.DonHangID);
    const r = dungSo(d);
    if (r.NhapXong && !keCaDaNhap && id !== donDangSua) continue;
    if (id === donDangSua) coDonDangSua = true;
    ra.push(r);
    if (ra.length >= 300) break;
  }
  /* Lenh cua phieu DANG SUA phai co mat du no bi `break` cat o moc 300, du no khong qua noi dieu
     kien WHERE (vd lenh chua tung ghi KN, chua Hoàn thành — phieu cu tu thoi luat con long hon).
     Thieu buoc nay la mo form Sua thay o lenh SX rong, bam Luu la am tham go phieu khoi lenh. */
  if (donDangSua && !coDonDangSua) {
    const g = ds.find(x => Number(x.DonHangID) === donDangSua);
    if (g) ra.unshift(dungSo(g));
    else {
      try {
        const r2 = (await pool.request().input('d', sql.Int, donDangSua).query(
          'SELECT DonHangID, MaDH, TenSanPham, TrangThai FROM DonHangSanXuat WHERE DonHangID = @d')).recordset[0];
        if (r2) ra.unshift(dungSo(r2));
      } catch (e) { console.error('[nhapkho /danhmuc] khong lay duoc lenh cua phieu dang sua: ', e); }
    }
  }
  return ra;
}

/* ================================================================================================
   v6.83: CAC PHIEU NHAP KHO CUA MOT MA HANG.
   Dung o form The kho hang hoa: chon "Nguon hang = Nha san xuat" thi hien danh sach phieu nhap da
   nhap ma hang do, bam sang xem duoc.
   CHI DE XEM - khong dien nguoc gi vao the kho. Phieu nhap luu xong LA DA CONG TON roi; dien them
   so luong vao the kho nua la ton bi dem hai lan.
   ================================================================================================ */
router.get('/theo-mahang/:maHangId', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const rs = (await pool.request().input('mh', sql.Int, req.params.maHangId).query(`
    SELECT p.PhieuNKID, p.SoPhieu, p.NgayNhap, p.LoaiNhap, p.TrangThai,
           ncc.TenNCC, d.MaDH,
           SUM(ct.SoLuong) AS SoLuong, MAX(ct.DonVi) AS DonVi,
           SUM(ISNULL(ct.ThanhTien, 0)) AS ThanhTien
    FROM PhieuNhapKhoHangChiTiet ct
    JOIN PhieuNhapKhoHang p ON p.PhieuNKID = ct.PhieuNKID
    LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID
    LEFT JOIN DonHangSanXuat d ON d.DonHangID = p.DonHangID
    WHERE ct.MaHangID = @mh
    GROUP BY p.PhieuNKID, p.SoPhieu, p.NgayNhap, p.LoaiNhap, p.TrangThai, ncc.TenNCC, d.MaDH
    ORDER BY p.NgayNhap DESC, p.PhieuNKID DESC`)).recordset;
  res.json({ success: true, data: rs });
});

/* ================================================================================================
   DANH SACH PHIEU
   ================================================================================================ */
async function danhSach(pool, q) {
  const rq = pool.request();
  const dk = [];
  if (q.tuNgay) { rq.input('tu', sql.Date, q.tuNgay); dk.push('p.NgayNhap >= @tu'); }
  if (q.denNgay) { rq.input('den', sql.Date, q.denNgay); dk.push('p.NgayNhap <= @den'); }
  if (q.loaiNhap) { rq.input('ln', sql.NVarChar, q.loaiNhap); dk.push('p.LoaiNhap = @ln'); }
  if (q.soPhieu) { rq.input('sp', sql.NVarChar, '%' + String(q.soPhieu).trim() + '%'); dk.push('p.SoPhieu LIKE @sp'); }
  return (await rq.query(`
    SELECT p.*, ncc.TenNCC, d.MaDH, u.HoTen AS NguoiTao,
           (SELECT COUNT(*) FROM PhieuNhapKhoHangChiTiet ct WHERE ct.PhieuNKID = p.PhieuNKID) AS SoDong
    FROM PhieuNhapKhoHang p
    LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID
    LEFT JOIN DonHangSanXuat d ON d.DonHangID = p.DonHangID
    LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    ${dk.length ? 'WHERE ' + dk.join(' AND ') : ''}
    ORDER BY p.NgayNhap DESC, p.PhieuNKID DESC`)).recordset;
}
router.get('/phieu', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  res.json({ success: true, data: await danhSach(pool, req.query) });
});

router.get('/next-sophieu', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  res.json({ success: true, data: await sinhSoPhieu(pool, 'PhieuNhapKhoHang', 'SoPhieu', 'NK', null, 4) });
});

/* ---------- Excel: DANH SACH (dat TRUOC /phieu/:id keo Express hieu "export" la :id) ---------- */
function boDau(s) {
  const d = new RegExp('[\\u0300-\\u036f]', 'g');
  return String(s || '').normalize('NFD').replace(d, '')
    .replace(new RegExp('đ', 'g'), 'd').replace(new RegExp('Đ', 'g'), 'D')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function keBang(ws, r1, r2, c1, c2) {
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
    ws.getCell(r, c).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  }
}
router.get('/phieu/export', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const ds = await danhSach(pool, req.query);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Phiếu nhập kho');
  ws.mergeCells('A1:I1');
  ws.getCell('A1').value = 'DANH SÁCH PHIẾU NHẬP KHO HÀNG HÓA';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { horizontal: 'center' };
  ws.addRow([]);
  ws.columns = [{ key: 'stt', width: 6 }, { key: 'sp', width: 14 }, { key: 'ngay', width: 12 },
    { key: 'loai', width: 16 }, { key: 'nguon', width: 28 }, { key: 'hd', width: 14 },
    { key: 'sl', width: 10 }, { key: 'tien', width: 16 }, { key: 'tt', width: 14 }];
  const hdr = ws.addRow(['STT', 'Số phiếu', 'Ngày', 'Loại nhập', 'Nhà cung cấp / Lệnh SX', 'Số HĐ', 'SL', 'Tổng tiền', 'Trạng thái']);
  hdr.font = { bold: true };
  hdr.alignment = { horizontal: 'center', vertical: 'middle' };
  const d1 = hdr.number + 1;
  ds.forEach((r, i) => ws.addRow([i + 1, r.SoPhieu, r.NgayNhap ? new Date(r.NgayNhap) : null,
    r.LoaiNhap === 'SanXuat' ? 'Từ sản xuất' : 'Từ nhà cung cấp',
    r.LoaiNhap === 'SanXuat' ? (r.MaDH || '') : (r.TenNCC || ''),
    r.SoHoaDon || '', so(r.TongSLCai), so(r.TongTien), r.TrangThai]));
  const d2 = ws.rowCount;
  if (ds.length) {
    const cSL = ws.getColumn('sl').letter, cT = ws.getColumn('tien').letter;
    const t = ws.addRow(['', '', '', '', 'TỔNG CỘNG', '',
      { formula: `SUM(${cSL}${d1}:${cSL}${d2})` }, { formula: `SUM(${cT}${d1}:${cT}${d2})` }, '']);
    t.font = { bold: true };
  }
  ws.getColumn('ngay').numFmt = 'dd/mm/yyyy';
  ws.getColumn('sl').numFmt = '#,##0';
  ws.getColumn('tien').numFmt = '#,##0';
  keBang(ws, hdr.number, ws.rowCount, 1, 9);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="PhieuNhapKho_DanhSach.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

/* ---------- Excel: 1 PHIEU ---------- */
router.get('/phieu/:id/export', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const { h, ct } = await docPhieu(pool, req.params.id);
  if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập kho.' });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Phiếu nhập kho');
  ws.columns = [{ key: 'stt', width: 6 }, { key: 'ma', width: 16 }, { key: 'ten', width: 32 },
    { key: 'mau', width: 14 }, { key: 'sl', width: 10 }, { key: 'dv', width: 10 },
    { key: 'gia', width: 14 }, { key: 'tt', width: 16 }, { key: 'gc', width: 20 }];
  ws.mergeCells('A1:I1');
  ws.getCell('A1').value = 'PHIẾU NHẬP KHO HÀNG HÓA';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { horizontal: 'center' };
  ws.mergeCells('A2:I2');
  ws.getCell('A2').value = `Số phiếu: ${h.SoPhieu}     Ngày: ${h.NgayNhap ? new Date(h.NgayNhap).toLocaleDateString('vi-VN') : ''}`;
  ws.getCell('A2').alignment = { horizontal: 'center' };
  ws.addRow([]);
  ws.addRow(['Loại nhập:', h.LoaiNhap === 'SanXuat' ? 'Từ sản xuất' : 'Từ nhà cung cấp']);
  ws.addRow([h.LoaiNhap === 'SanXuat' ? 'Lệnh sản xuất:' : 'Nhà cung cấp:', h.LoaiNhap === 'SanXuat' ? (h.MaDH || '') : (h.TenNCC || '')]);
  ws.addRow(['Số hóa đơn:', h.SoHoaDon || '']);
  ws.addRow(['Ghi chú:', h.GhiChu || '']);
  ws.addRow([]);
  const hdr = ws.addRow(['STT', 'Mã hàng', 'Tên hàng', 'Màu', 'Số lượng', 'ĐVT', 'Đơn giá', 'Thành tiền', 'Ghi chú']);
  hdr.font = { bold: true };
  hdr.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const d1 = hdr.number + 1;
  ct.forEach((r, i) => ws.addRow([i + 1, r.MaHang, r.TenHang, r.TenMau || '', so(r.SoLuong),
    r.DonVi || '', so(r.DonGia), so(r.ThanhTien), r.GhiChu || '']));
  const d2 = ws.rowCount;
  if (ct.length) {
    const cT = ws.getColumn('tt').letter;
    const t = ws.addRow(['', '', '', '', '', '', 'TỔNG CỘNG', { formula: `SUM(${cT}${d1}:${cT}${d2})` }, '']);
    t.font = { bold: true };
  }
  ws.getColumn('sl').numFmt = '#,##0.##';
  ['gia', 'tt'].forEach(k => { ws.getColumn(k).numFmt = '#,##0'; });
  keBang(ws, hdr.number, ws.rowCount, 1, 9);
  const ten = [boDau(h.SoPhieu), boDau(h.LoaiNhap === 'SanXuat' ? h.MaDH : h.TenNCC)].filter(Boolean).join('_') || 'phieu';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="PhieuNhapKho_${ten}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

/* ---------- CHI TIET ---------- */
async function docPhieu(pool, id) {
  const h = (await pool.request().input('id', sql.Int, id).query(`
    SELECT p.*, ncc.TenNCC, ncc.DiaChi AS DiaChiNCC, ncc.SDT AS SdtNCC, d.MaDH, d.TenSanPham, u.HoTen AS NguoiTao
    FROM PhieuNhapKhoHang p
    LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID
    LEFT JOIN DonHangSanXuat d ON d.DonHangID = p.DonHangID
    LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    WHERE p.PhieuNKID = @id`)).recordset[0];
  if (!h) return { h: null, ct: [] };
  /* LEFT JOIN chu khong INNER: neu vi ly do nao do ma hang bi xoa khoi danh muc thi dong phieu van
     phai hien ra (voi ma trong) chu khong duoc BIEN MAT khoi man xem va ban in — phieu in thieu hang
     ma khong ai biet la kieu loi te nhat. */
  // v7.46: TenHoaDon (migration_v690) — chua chay migration thi tra NULL, form chay nhu cu.
  const cotTenHD = (await coCotTenHoaDon(pool)) ? 'hh.TenHoaDon' : 'CAST(NULL AS NVARCHAR(255)) AS TenHoaDon';
  /* v7.85: tra ve co AN de form SUA PHIEU tich/bo tich cho DUNG trang thai hien tai. Khong tra ve
     thi form luon hien o tich SAN — mo phieu dang bi an ra roi bam Luu la ma hien lai am tham. */
  const cotAn = (await coCotAnTheKho(pool)) ? 'ISNULL(hh.AnTheKho, 0) AS AnTheKho' : 'CAST(0 AS BIT) AS AnTheKho';
  /* v9.03 — TRA VE ANH DANG LUU (anh mau cua dong + anh dai dien cua ma).
     PhieuNhapKhoHangChiTiet KHONG co cot anh: anh tren form phieu nhap la "ghi xuyen" — dung mot lan
     luc Luu roi thoi. Nen mo SUA phieu truoc day o anh LUON TRONG, nguoi dung tuong anh bi mat va
     tai len lai (file moi, file cu thanh mo coi). Nay dien san anh that de nhin la biet da co hay chua.
     ⚠️ Doc tu TheKhoChiTietMau theo (MaHangID, MauSacID) — KHONG phai tu phieu. */
  const ct = (await pool.request().input('id', sql.Int, id).query(`
    SELECT ct.*, hh.MaHang, hh.TenHang, hh.LoaiRi, hh.DonViCoBan, hh.DonViQuyDoi, ms.TenMau,
           -- v6.98: cac truong CAP MA HANG de form Sua phieu dien san dong khai (khoi sang man khac)
           hh.GiaBan, hh.NhomSanPhamID, hh.TheKhoDanhMucID, hh.MaBarcode, ${cotTenHD}, ${cotAn},
           tkm.LinkAnh AS AnhMauDangLuu, hh.AnhDaiDien AS AnhDaiDienDangLuu
    FROM PhieuNhapKhoHangChiTiet ct
    LEFT JOIN TheKhoHangHoa hh ON hh.MaHangID = ct.MaHangID
    LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
    LEFT JOIN TheKhoChiTietMau tkm ON tkm.MaHangID = ct.MaHangID AND tkm.MauSacID = ct.MauSacID
    WHERE ct.PhieuNKID = @id ORDER BY ct.ID`)).recordset;
  return { h, ct };
}
router.get('/phieu/:id', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const { h, ct } = await docPhieu(pool, req.params.id);
  if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập kho.' });
  res.json({ success: true, data: { header: h, chiTiet: ct } });
});

/* ================================================================================================
   TRA MA HANG + MAU KY THUAT CHO DONG HANG CUA PHIEU
   ⚠️ v6.87: KHONG con tao ma hang o day. Ma chua co trong danh muc thi dong do luu dang
   "cho tao the kho" (xem ghi chu dau file).
   ================================================================================================ */
/* v6.98: MA MAU = CHINH TEN MAU (cat 30 ky tu cho khop NVARCHAR(30)).
   ⚠️ Truoc day sinh ma bang cach bo dau + bo khoang trang + them so khi trung ("Đỏ đậm" -> "DODAM",
   trung thi "DODAM2"). Nguoi dung khong bao gio go nhung ma do, chung chi lam ban danh muc mau.
   Ten mau da UNIQUE tren TenMau o tang tra cuu ben duoi (tim theo ten truoc khi tao) nen dung ten lam
   ma khong sinh xung dot moi. */
const MAU_MAC_DINH = '(Không phân màu)';
async function timHoacTaoMau(pool, tran, d) {
  if (d.mauSacId) return Number(d.mauSacId);
  const ten = String(d.tenMau || '').trim() || MAU_MAC_DINH;
  const rq = () => (tran ? new sql.Request(tran) : pool.request());
  const co = (await rq().input('t', sql.NVarChar, ten).query('SELECT MauSacID FROM MauSac WHERE TenMau=@t')).recordset[0];
  if (co) return co.MauSacID;
  /* Chua co -> tao mau moi, MaMau = chinh ten (cat 30 ky tu). Neu ma nay da bi mot mau KHAC chiem
     (ten khac nhung cat 30 ky tu ra giong nhau) thi moi phai them so — truong hop rat hiem, va co so
     la co ly do that su chu khong phai sinh bua. */
  let ma = ten.slice(0, 30), i = 1;
  while ((await rq().input('m', sql.NVarChar, ma).query('SELECT 1 AS x FROM MauSac WHERE MaMau=@m')).recordset[0]) {
    i++; ma = (ten.slice(0, 28) + i).slice(0, 30);
  }
  return (await rq().input('MaMau', sql.NVarChar, ma).input('TenMau', sql.NVarChar, ten)
    .query('INSERT INTO MauSac (MaMau, TenMau) OUTPUT INSERTED.MauSacID VALUES (@MaMau, @TenMau)')).recordset[0].MauSacID;
}

/* ================================================================================================
   TIM MA HANG, CHUA CO THI TAO LUON (v6.88).

   ⚠️ v6.87 da thu bo duong tao ma o day (de dong "cho tao the kho") — SAI YEU CAU: hang nhap ve la
   phai xuat/ban duoc NGAY, ma phieu xuat/ban hang chi chon duoc ma DA CO trong danh muc. Bat nguoi
   dung tao the kho truoc moi xuat duoc la chan luong nghiep vu that.
   => Giu nguyen: nhap kho ma chua co ma thi SINH MA LUON.

   Cai thuc su sai o v6.78-v6.86 khong phai cho nay, ma la nut "Tao the kho" o phieu nhap: no mo form
   TAO MOI trong khi ma da duoc sinh ra ⇒ luon bao "ma da ton tai". Da sua o frontend (mo form SUA).

   KHAC v6.78 mot diem QUAN TRONG: ĐVT + ty le quy doi khong con mac dinh ngam 'Cái'/'Ri'/1.
   Ma quan kho theo Ri ma bi gan LoaiRi = 1 thi MOI phep quy doi ton kho ve sau deu sai gap LoaiRi
   lan, va khong co gi bao loi. Nay bat khai ro tren dong phieu.
   ================================================================================================ */
async function timHoacTaoMaHang(pool, tran, d) {
  const rq = () => (tran ? new sql.Request(tran) : pool.request());
  if (d.maHangId) {
    const h = (await rq().input('id', sql.Int, d.maHangId)
      .query('SELECT MaHangID, MaHang, LoaiRi, DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa WHERE MaHangID=@id')).recordset[0];
    if (h) return h;
  }
  const ma = String(d.maHang || '').trim().toUpperCase();
  if (!ma) throw new Error('Dòng hàng chưa có mã hàng.');
  const co = (await rq().input('m', sql.NVarChar, ma)
    .query('SELECT MaHangID, MaHang, LoaiRi, DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa WHERE MaHang=@m')).recordset[0];
  if (co) {
    /* v7.46: MA DA CO nhung nguoi dung GO TAY ma (khong chon tu danh sach) nen dong khai van hien —
       go "Ten viet hoa don" o day thi GHI LUON, khoi phai sang Danh muc sua lai.
       ⚠️ CHI GHI KHI CO GIA TRI. O nay tren phieu nhap KHONG the dung de XOA: go tay ma thi form
       khong biet ten hoa don dang luu la gi nen o de trong; coi "trong = xoa" la moi lan nhap kho lai
       xoa mat ten da khai. Muon xoa thi vao Danh muc -> Hang hoa (o do form co dien san gia tri cu).
       KHONG dung den truong nao khac cua ma da co: dong phieu nhap khong phai cho sua ca cap ma hang. */
    const tenHD = String(d.tenHoaDon || '').trim();
    if (tenHD && await coCotTenHoaDon(pool)) {
      await rq().input('id', sql.Int, co.MaHangID)
        .input('TenHoaDon', sql.NVarChar, tenHD)
        .query('UPDATE TheKhoHangHoa SET TenHoaDon = @TenHoaDon WHERE MaHangID = @id');
    }
    return co;
  }

  // ---- Ma moi: bat khai du thong tin TOI THIEU de ton kho quy doi dung ----
  const tenHang = String(d.tenHang || '').trim();
  if (!tenHang) throw new Error(`Mã mới "${ma}" phải có Tên hàng.`);
  const dvChinh = String(d.donViCoBan || '').trim();
  const dvQuyDoi = String(d.donViQuyDoi || '').trim();
  if (!dvChinh || !dvQuyDoi) {
    throw new Error(`Mã mới "${ma}" phải khai ĐVT chính và ĐVT quy đổi — thiếu thì tồn kho không quy đổi được.`);
  }
  const heSo = parseInt(d.loaiRi, 10);
  if (!(heSo >= 1)) {
    throw new Error(`Mã mới "${ma}" phải khai tỷ lệ quy đổi (1 ${dvQuyDoi} = ? ${dvChinh}).`);
  }
  const coTenHD = await coCotTenHoaDon(pool);   // v7.46 (migration_v690)
  const id = (await rq()
    .input('MaHang', sql.NVarChar, ma)
    .input('TenHang', sql.NVarChar, tenHang)
    .input('TenHoaDon', sql.NVarChar, String(d.tenHoaDon || '').trim() || null)
    .input('GiaBan', sql.Decimal(14, 2), so(d.giaBan) || 0)
    .input('LoaiRi', sql.Int, heSo)
    .input('TheKhoDanhMucID', sql.Int, d.theKhoDanhMucId || null)
    .input('NhomSanPhamID', sql.Int, d.nhomSanPhamId || null)
    .input('DonViCoBan', sql.NVarChar, dvChinh)
    .input('DonViQuyDoi', sql.NVarChar, dvQuyDoi)
    .input('LoaiHang', sql.NVarChar, d.loaiHang === 'NhaSanXuat' ? 'NhaSanXuat' : 'DatNgoai')
    .input('MaBarcode', sql.NVarChar, String(d.maBarcode || '').trim() || null)
    .query(`INSERT INTO TheKhoHangHoa (MaHang, TenHang, GiaBan, LoaiRi, TheKhoDanhMucID, NhomSanPhamID,
              DonViCoBan, DonViQuyDoi, LoaiHang, MaBarcode${coTenHD ? ', TenHoaDon' : ''})
            OUTPUT INSERTED.MaHangID
            VALUES (@MaHang, @TenHang, @GiaBan, @LoaiRi, @TheKhoDanhMucID, @NhomSanPhamID,
              @DonViCoBan, @DonViQuyDoi, @LoaiHang, @MaBarcode${coTenHD ? ', @TenHoaDon' : ''})`)).recordset[0].MaHangID;
  return { MaHangID: id, MaHang: ma, LoaiRi: heSo, DonViCoBan: dvChinh, DonViQuyDoi: dvQuyDoi, laMoi: true };
}

/* Chuan hoa 1 dong hang cua phieu -> ban ghi san sang INSERT. */
async function chuanDong(pool, tran, d, loai) {
  const mh = await timHoacTaoMaHang(pool, tran, d);
  /* ⚠️ v6.99 — PHIEU NHAP KHO KHONG BAO GIO SUA MOT MA HANG DA CO.
     v6.98 tung cho "dong khai" ghi de thong tin cap ma hang (Gia ban / DVT / ty le / Barcode...).
     Nguy hiem: 2 o DVT va ty le tren form LUON co gia tri mac dinh, nen chi can lap phieu cho mot ma
     dang co ton la DVT/ty le cua no bi ghi de am tham => moi phep quy doi ton kho sai gap <ty le> lan.
     Ma da co thi sua o Danh muc -> Hang hoa (ma hang). Ma MOI thi INSERT ben tren da ghi day du.
     ⚠️ KHONG mo lai duong nay. */
  const donGia = loai === 'NhaCungCap' ? so(d.donGia) : 0;
  const chung = {
    soLuong: so(d.soLuong), donGia, thanhTien: tien(donGia * so(d.soLuong)),
    ghiChu: d.ghiChu || null, laMaMoi: !!mh.laMoi
  };

  const msId = await timHoacTaoMau(pool, tran, d);
  const donVi = d.donVi || mh.DonViCoBan || 'Cái';
  const slChinh = veDonViChinh(d.soLuong, donVi, mh);
  if (slChinh <= 0) throw new Error(`Dòng ${mh.MaHang}: số lượng quy về đơn vị chính (${mh.DonViCoBan || 'Cái'}) = 0.`);
  /* Ma quan kho theo Ri chi nhap duoc boi so cua he so - giong luc ban (banhang.js). Khong chan
     thi 7 Cai cua ma Ri6 se lam tron thanh 1 Ri = mat 1 cai, sai am tham. */
  const he = so(mh.LoaiRi) || 1;
  const soCai = slSangCai(d.soLuong, donVi, mh.LoaiRi, mh);
  if (donViChinhLaGop(mh) && he > 1 && soCai % he !== 0) {
    throw new Error(`Mã ${mh.MaHang} quản kho theo Ri (1 Ri = ${he} Cái) nên chỉ nhập được bội số của ${he} Cái — đang nhập ${soCai} Cái.`);
  }
  return Object.assign(chung, {
    maHangId: mh.MaHangID, maHang: mh.MaHang, mauSacId: msId, donVi, slChinh, soCai,
    // v6.96: anh di kem de tao luon the kho (neu phieu tich "Tao the kho")
    anhMau: d.anhMau || null, anhDaiDien: d.anhDaiDien || null
  });
}

/* ================================================================================================
   v6.96 — LUU PHIEU LA TAO LUON THE KHO (khi nguoi dung tich chon).

   Phieu nhap kho da khai du mo(i thu the kho can biet ve MAU: ma hang + mau + anh mau + anh dai dien.
   Bat nguoi dung bam thêm "Tao the kho" roi khai lai mau la lam hai lan cung mot viec.

   ⚠️ CHI tao dong mau + ghi anh. KHONG ghi so luong vao NhapCai — ton den tu chinh bang phieu
   (vw_TonTheoMau). Ghi vao NhapCai la dem hai lan. Xem utils/theKhoMau.js.
   ================================================================================================ */
/* ⚠️ v9.03 — HAM NAY LUON DUOC GOI, KE CA KHI BO TICH "Tao the kho luon khi luu".
   Nguyen bao 2026-10-25: "mot so ma hang hoa khi lam phieu nhap tai anh len nhung o the kho hang hoa
   khong co anh tung mau" + "xem trong thu muc upload cua server CO anh tung mau, nhung khong the hien
   tren the kho hay catalogue" => file da len /uploads nhung TheKhoChiTietMau.LinkAnh van NULL.
   Mot trong ba nguyen nhan (ca ba deu IM LANG) la: bo tich o "Tao the kho" thi truoc day CA KHOI nay
   bi bo qua -> anh da tai len thanh FILE MO COI, khong co duong nao gan lai.
   Nay: anh LUON duoc ghi. O tich chi con quyet dinh AN/HIEN ma trong danh sach The kho (dung nghia
   tu v7.85, xem dongBoCoAnTheKho) — ghi anh khong tao ton, khong lam hien lai ma da an. */
async function taoTheKhoTuDong(pool, tran, dsGhi) {
  let soMau = 0, soAnh = 0, soAnhMau = 0;
  const daAnhDaiDien = new Set();
  for (const d of dsGhi) {
    if (!d.maHangId) continue;
    /* ⚠️ v7.60 — ANH DAI DIEN PHAI XU LY TRUOC KHI BO QUA DONG VI THIEU MAU.
       Ban cu viet `if (!d.maHangId || !d.mauSacId) continue;` o dau vong lap. Anh dai dien la cua
       MA HANG, khong lien quan gi den mau — nhung dong nao khong xac dinh duoc mau la anh dai dien
       cua ca ma do bi bo luon, am tham, khong bao gi. */
    if (d.anhDaiDien && !daAnhDaiDien.has(d.maHangId)) {
      daAnhDaiDien.add(d.maHangId);
      if (await capNhatAnhDaiDien(pool, tran, d.maHangId, d.anhDaiDien)) soAnh++;
    }
    if (!d.mauSacId) continue;
    /* v9.03: dem anh THAT SU doi (damBaoDongMau tra { moi, anhDoi }), khong dem "dong co mang anh".
       Tu v9.03 form Sua phieu dien san anh dang luu roi gui lai y nguyen — dem kieu cu la lan nao bam
       Luu cung bao "Da ghi N anh mau" ke ca khong doi gi, lam cau thong bao nay mat gia tri. */
    const kq = await damBaoDongMau(pool, tran, d.maHangId, d.mauSacId, d.anhMau, null);
    if (kq.anhDoi) soAnhMau++;
    if (kq.moi) soMau++;
  }
  return { soMau, soAnh, soAnhMau };
}

/* ================================================================================================
   v7.85 — O TICH LA CONG TAC HAI CHIEU, KHONG PHAI "CHI LAM KHI TICH".

   Nguyen: "sua phieu bo dau tich tao the kho di la se khong co trong danh sach the kho. ma hang,
   ton kho van con nguyen chi la khong hien o ben the kho."

   Truoc day bo tich chi la KHONG LAM GI — nen lo de nguyen dau tich luc lap phieu thi khong co
   duong nao go ma hang do ra khoi danh sach The kho. Nay:
       bo tich  -> danh dau AN (TheKhoHangHoa.AnTheKho = 1). KHONG xoa dong mau, KHONG xoa anh.
       tich lai -> bo an + tao/cap nhat dong mau nhu cu.
   Ma hang, ton kho, ban hang KHONG doi — xem migration_v697.
   ================================================================================================ */
async function dongBoCoAnTheKho(pool, tran, dsGhi, taoTheKho) {
  const ids = dsGhi.map(d => d.maHangId).filter(Boolean);
  const kq = await datAnTheKho(pool, tran, ids, taoTheKho === false);
  /* Doi ID sang MA HANG de bao cho nguoi doc hieu duoc. */
  const tenTheoId = new Map(dsGhi.filter(d => d.maHangId).map(d => [Number(d.maHangId), d.maHang]));
  const ten = (ds) => ds.map(id => tenTheoId.get(Number(id))).filter(Boolean);
  return { an: taoTheKho === false, daDoi: ten(kq.daDoi), boQua: ten(kq.boQua) };
}
/* Cau thong bao dung chung cho POST va PUT — hai ban chu khac nhau la nguoi dung tuong hai viec. */
function loiNhanCoAn(co) {
  if (!co.an) return co.daDoi.length ? ` Đã hiện lại ${co.daDoi.length} mã trong danh sách Thẻ kho.` : '';
  return (co.daDoi.length ? ` Đã ẩn ${co.daDoi.length} mã khỏi danh sách Thẻ kho (${co.daDoi.join(', ')}) — mã hàng và tồn kho giữ nguyên.` : '')
    + (co.boQua.length ? ` KHÔNG ẩn ${co.boQua.join(', ')} vì thẻ kho của mã này đã có số liệu khai tay (số cắt / nhập / xuất).` : '');
}

/* INSERT mot dong + cong ton. Dung CHUNG cho POST va PUT — hai ban sao khac nhau la duong chac chan
   de ton kho lech (da tung xay ra o repo nay).
   v6.89: CHI insert dong phieu. Ton kho khong ghi o day nua — view doc thang tu bang nay. */
async function ghiDong(pool, tran, phieuId, d) {
  await new sql.Request(tran)
    .input('P', sql.Int, phieuId).input('MH', sql.Int, d.maHangId).input('MS', sql.Int, d.mauSacId)
    .input('SL', sql.Decimal(14, 2), d.soLuong).input('DV', sql.NVarChar, d.donVi)
    .input('SLC', sql.Int, d.slChinh).input('DG', sql.Decimal(14, 2), d.donGia || null)
    .input('TT', sql.Decimal(18, 2), d.thanhTien).input('GC', sql.NVarChar, d.ghiChu)
    .query(`INSERT INTO PhieuNhapKhoHangChiTiet (PhieuNKID, MaHangID, MauSacID, SoLuong, DonVi,
              SoLuongChinh, DonGia, ThanhTien, GhiChu)
            VALUES (@P, @MH, @MS, @SL, @DV, @SLC, @DG, @TT, @GC)`);
}

/* ================================================================================================
   LUU PHIEU
   ================================================================================================ */
router.post('/phieu', requireAuth, requirePermission('KHOHANG', 'create'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  const loai = b.loaiNhap === 'SanXuat' ? 'SanXuat' : 'NhaCungCap';
  const dong = Array.isArray(b.dong) ? b.dong.filter(d => d && so(d.soLuong) > 0) : [];
  if (!dong.length) return res.status(400).json({ success: false, message: 'Phiếu chưa có dòng hàng nào có số lượng > 0.' });
  if (loai === 'NhaCungCap' && !b.nccId) {
    return res.status(400).json({ success: false, message: 'Nhập từ nhà cung cấp thì phải chọn nhà cung cấp — số tiền này sẽ vào công nợ phải trả.' });
  }
  /* v9.09: doi xung voi phep tren. Thieu phep nay thi phieu tu san xuat luu duoc voi DonHangID = NULL,
     va dau hieu duy nhat la mot cau canh bao noi vao toast THANH CONG, lai noi ve "gia von" chu khong
     noi "phieu vua bi go khoi lenh SX". Ra soat cheo v9.09 bat duoc. */
  if (loai === 'SanXuat' && !b.donHangId) {
    return res.status(400).json({ success: false, message: 'Nhập từ sản xuất thì phải chọn lệnh SX — không chọn thì phiếu không gắn vào lệnh nào và không tính được giá vốn.' });
  }

  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    const soPhieu = await sinhSoPhieu(new sql.Request(tran), 'PhieuNhapKhoHang', 'SoPhieu', 'NK', null, 4);

    // Chuan hoa tung dong TRUOC khi ghi dau phieu, de con tinh duoc tong
    const dsGhi = [];
    for (const d of dong) dsGhi.push(await chuanDong(pool, tran, d, loai));

    const tongSLCai = dsGhi.reduce((s, d) => s + d.soCai, 0);
    const tongTien = tien(dsGhi.reduce((s, d) => s + d.thanhTien, 0));

    const phieuId = (await new sql.Request(tran)
      .input('SoPhieu', sql.NVarChar, soPhieu)
      .input('NgayNhap', sql.Date, b.ngayNhap || new Date())
      .input('LoaiNhap', sql.NVarChar, loai)
      .input('NCC_ID', sql.Int, loai === 'NhaCungCap' ? (b.nccId || null) : null)
      .input('DonHangID', sql.Int, loai === 'SanXuat' ? (b.donHangId || null) : null)
      .input('SoHoaDon', sql.NVarChar, b.soHoaDon || null)
      .input('NgayHoaDon', sql.Date, b.ngayHoaDon || null)
      .input('TongSLCai', sql.Int, tongSLCai)
      .input('TongTien', sql.Decimal(18, 2), tongTien)
      .input('GhiChu', sql.NVarChar, b.ghiChu || null)
      .input('NguoiTaoID', sql.Int, req.session.user.userId)
      .query(`INSERT INTO PhieuNhapKhoHang (SoPhieu, NgayNhap, LoaiNhap, NCC_ID, DonHangID, SoHoaDon,
                NgayHoaDon, TongSLCai, TongTien, GhiChu, NguoiTaoID)
              OUTPUT INSERTED.PhieuNKID
              VALUES (@SoPhieu, @NgayNhap, @LoaiNhap, @NCC_ID, @DonHangID, @SoHoaDon,
                @NgayHoaDon, @TongSLCai, @TongTien, @GhiChu, @NguoiTaoID)`)).recordset[0].PhieuNKID;

    for (const d of dsGhi) await ghiDong(pool, tran, phieuId, d);

    // v6.96: tich "Tao the kho" -> tao luon dong mau + ghi anh (khong ghi so luong)
    const tk = await taoTheKhoTuDong(pool, tran, dsGhi);   // v9.03: LUON ghi anh, ke ca khi bo tich
    const co = await dongBoCoAnTheKho(pool, tran, dsGhi, b.taoTheKho);   // v7.85

    await tran.commit();
    const maMoi = dsGhi.filter(d => d.laMaMoi).map(d => d.maHang);
    // v8.07: hang tu NCC -> tu nap gia von tu gia nhap. Loi o day KHONG duoc chan phieu da luu xong.
    let gvMsg = '';
    if (loai === 'NhaCungCap') {
      try {
        const kqGv = await napGiaVonTuMaHang(pool, dsGhi.map(d => d.maHangId), req.session.user.userId);
        if (kqGv.capNhat) gvMsg = ` Đã tự cập nhật giá vốn cho ${kqGv.capNhat} mã.`;
      } catch (e) { console.error('[nhapkho POST /phieu] loi nap gia von tu gia nhap NCC (khong anh huong phieu da luu): ', e); }
    } else if (loai === 'SanXuat') {
      /* v8.90: lenh SX da co gia thanh -> tu dien vao Gia von hang hoa, khoi phai bam nut.
         ⚠️ Nap cho MOI ma cua ca lenh, khong chi ma tren phieu nay — mau so cua giaThanh1SP la SL
         nhap kho cua CA LENH, nen ma nhap o dot truoc cung phai duoc tinh lai. */
      if (!b.donHangId) {
        gvMsg = ' ⚠️ Phiếu không chọn lệnh SX nên KHÔNG cập nhật được giá vốn — sửa phiếu và chọn lệnh.';
      } else {
        try {
          gvMsg = loiNhanGiaVon(await napGiaVonTuLenhSX(pool, b.donHangId, null, req.session.user.userId));
        } catch (e) { console.error('[nhapkho POST /phieu] loi nap gia von tu lenh SX (khong anh huong phieu da luu): ', e); }
      }
    }
    res.json({
      success: true,
      data: { phieuNKID: phieuId, soPhieu, tongTien, maMoi },
      message: `Đã lưu phiếu ${soPhieu}.`
        + (maMoi.length ? ` Đã sinh ${maMoi.length} mã hàng mới (${maMoi.join(', ')}).` : '')
        + (tk.soMau ? ` Đã tạo ${tk.soMau} dòng màu trong thẻ kho.` : '')
        + (tk.soAnhMau ? ` Đã ghi ${tk.soAnhMau} ảnh màu.` : '')
        + loiNhanCoAn(co)
        + (tk.soAnh ? ` Đã cập nhật ảnh đại diện cho ${tk.soAnh} mã.` : '')
        + gvMsg
    });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* transaction co the da ket thuc */ }
    console.error('[nhapkho POST /phieu] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu phiếu nhập kho (đã quay lui, dữ liệu giữ nguyên): ' + err.message });
  }
});

/* ================================================================================================
   SUA PHIEU - GO phieu cu (tru lai ton) roi GHI LAI theo du lieu moi, TAT CA trong 1 transaction.
   Giu nguyen SoPhieu va PhieuNKID. Cung cach lam voi phieu ban hang (banhang.js PUT /phieu/:id) —
   hai duong "sua" ma lam khac nhau thi som muon ton kho se lech.
   ================================================================================================ */
router.put('/phieu/:id', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  const cu = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT * FROM PhieuNhapKhoHang WHERE PhieuNKID=@id')).recordset[0];
  if (!cu) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập kho.' });
  if (cu.TrangThai === 'Đã hủy') return res.status(400).json({ success: false, message: 'Phiếu đã hủy — không sửa được. Hãy lập phiếu mới.' });

  const loai = b.loaiNhap === 'SanXuat' ? 'SanXuat' : 'NhaCungCap';
  const dong = Array.isArray(b.dong) ? b.dong.filter(d => d && so(d.soLuong) > 0) : [];
  if (!dong.length) return res.status(400).json({ success: false, message: 'Phiếu chưa có dòng hàng nào có số lượng > 0.' });
  if (loai === 'NhaCungCap' && !b.nccId) {
    return res.status(400).json({ success: false, message: 'Nhập từ nhà cung cấp thì phải chọn nhà cung cấp.' });
  }
  // v9.09: xem ghi chu o POST /phieu — mat lien ket lenh SX la loi am tham, phai chan ngay.
  if (loai === 'SanXuat' && !b.donHangId) {
    return res.status(400).json({ success: false, message: 'Nhập từ sản xuất thì phải chọn lệnh SX — ô lệnh SX đang trống, chọn lại rồi lưu.' });
  }

  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    /* 1. GO ban cu: chi can XOA dong cu. v6.89 khong con phai tru NhapCai — ton doc thang tu bang
       nay nen xoa dong la ton tu giam dung phan cua ban cu. */
    await new sql.Request(tran).input('id', sql.Int, req.params.id)
      .query('DELETE FROM PhieuNhapKhoHangChiTiet WHERE PhieuNKID=@id');

    // 2. GHI LAI theo du lieu moi
    const dsGhi = [];
    for (const d of dong) dsGhi.push(await chuanDong(pool, tran, d, loai));
    for (const d of dsGhi) await ghiDong(pool, tran, req.params.id, d);
    // v6.96: sua phieu cung dong bo lai the kho (them mau moi / doi anh); khong dung den so luong.
    const tk2 = await taoTheKhoTuDong(pool, tran, dsGhi);   // v9.03: LUON ghi anh, ke ca khi bo tich
    const co2 = await dongBoCoAnTheKho(pool, tran, dsGhi, b.taoTheKho);   // v7.85

    await new sql.Request(tran)
      .input('id', sql.Int, req.params.id)
      .input('NgayNhap', sql.Date, b.ngayNhap || cu.NgayNhap)
      .input('LoaiNhap', sql.NVarChar, loai)
      .input('NCC_ID', sql.Int, loai === 'NhaCungCap' ? (b.nccId || null) : null)
      .input('DonHangID', sql.Int, loai === 'SanXuat' ? (b.donHangId || null) : null)
      .input('SoHoaDon', sql.NVarChar, b.soHoaDon || null)
      .input('NgayHoaDon', sql.Date, b.ngayHoaDon || null)
      .input('TongSLCai', sql.Int, dsGhi.reduce((s2, d) => s2 + d.soCai, 0))
      .input('TongTien', sql.Decimal(18, 2), tien(dsGhi.reduce((s2, d) => s2 + d.thanhTien, 0)))
      .input('GhiChu', sql.NVarChar, b.ghiChu || null)
      .query(`UPDATE PhieuNhapKhoHang SET NgayNhap=@NgayNhap, LoaiNhap=@LoaiNhap, NCC_ID=@NCC_ID,
                DonHangID=@DonHangID, SoHoaDon=@SoHoaDon, NgayHoaDon=@NgayHoaDon,
                TongSLCai=@TongSLCai, TongTien=@TongTien, GhiChu=@GhiChu
              WHERE PhieuNKID=@id`);
    await tran.commit();
    const maMoi2 = dsGhi.filter(d => d.laMaMoi).map(d => d.maHang);
    /* v8.07: tu nap gia von tu gia nhap NCC. Tinh theo LOAI MOI (sau sua) — neu doi tu NhaCungCap
       sang SanXuat thi khong cham vao gia von cu (gia nhap cua ma do se tu giam theo BQGQ o lan
       phieu NCC KHAC gan nhat, khong can lam gi them o day). Loi o day KHONG duoc chan phieu da sua. */
    let gvMsg2 = '';
    if (loai === 'NhaCungCap') {
      try {
        const kqGv2 = await napGiaVonTuMaHang(pool, dsGhi.map(d => d.maHangId), req.session.user.userId);
        if (kqGv2.capNhat) gvMsg2 = ` Đã tự cập nhật giá vốn cho ${kqGv2.capNhat} mã.`;
      } catch (e) { console.error('[nhapkho PUT /phieu/:id] loi nap gia von tu gia nhap NCC (khong anh huong phieu da sua): ', e); }
    } else if (loai === 'SanXuat') {
      /* v8.90: SUA phieu lam doi SL nhap kho -> doi mau so cua giaThanh1SP -> gia von phai tinh lai
         cho MOI ma cua lenh (ke ca ma vua bi go khoi phieu nay). */
      if (!b.donHangId) {
        gvMsg2 = ' ⚠️ Phiếu không chọn lệnh SX nên KHÔNG cập nhật được giá vốn.';
      } else {
        try {
          gvMsg2 = loiNhanGiaVon(await napGiaVonTuLenhSX(pool, b.donHangId, null, req.session.user.userId));
        } catch (e) { console.error('[nhapkho PUT /phieu/:id] loi nap gia von tu lenh SX (khong anh huong phieu da sua): ', e); }
      }
      /* ⚠️ Doi loai phieu SanXuat -> NhaCungCap: nhanh NCC o tren se chay va ghi de gia thanh SX
         bang BQGQ gia mua. Do la hanh vi cua duong NCC (v8.07), khong sua o day. */
    }
    res.json({
      success: true,
      message: 'Đã lưu thay đổi và tính lại tồn kho.'
        + (maMoi2.length ? ` Đã sinh ${maMoi2.length} mã hàng mới: ${maMoi2.join(', ')}.` : '')
        + (tk2.soMau ? ` Đã tạo thêm ${tk2.soMau} dòng màu trong thẻ kho.` : '')
        + (tk2.soAnhMau ? ` Đã ghi ${tk2.soAnhMau} ảnh màu.` : '')
        + loiNhanCoAn(co2)
        + gvMsg2
    });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* da ket thuc */ }
    console.error('[nhapkho PUT /phieu/:id] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi sửa phiếu (đã quay lui, dữ liệu giữ nguyên): ' + err.message });
  }
});

/* ---------- HUY / XOA ----------
   v6.89: KHONG con ham truLaiTon(). Doi TrangThai sang 'Đã hủy' la view vw_NhapKhoTuPhieu tu loai
   phieu do ra khoi ton (dieu kien TrangThai <> N'Đã hủy'); xoa phieu thi chi tiet mat theo CASCADE.
   ⚠️ Doi lai: khong con chan duoc "huy phieu khi hang da ban het" (truoc day phep tru NhapCai lam
   viec do). Huy phieu ma hang da xuat di co the lam ton am — chay utils/kiem_ton_am.js de soi. */

router.put('/phieu/:id/huy', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const h = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT TrangThai, LoaiNhap, DonHangID FROM PhieuNhapKhoHang WHERE PhieuNKID=@id')).recordset[0];
  if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập kho.' });
  if (h.TrangThai === 'Đã hủy') return res.status(400).json({ success: false, message: 'Phiếu này đã hủy rồi.' });
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    await new sql.Request(tran).input('id', sql.Int, req.params.id)
      .query(`UPDATE PhieuNhapKhoHang SET TrangThai = N'Đã hủy' WHERE PhieuNKID=@id`);
    await tran.commit();
    /* v8.07: phieu tu NCC bi huy -> BQGQ gia nhap cua cac ma tren phieu nay THAY DOI (cong thuc loai
       phieu Da huy), nen tinh lai gia von cho dung nhung ma do. Loi o day KHONG duoc chan viec huy. */
    let gvMsg3 = '';
    if (h.LoaiNhap === 'NhaCungCap') {
      try {
        const idsCt = (await pool.request().input('id', sql.Int, req.params.id)
          .query('SELECT DISTINCT MaHangID FROM PhieuNhapKhoHangChiTiet WHERE PhieuNKID=@id')).recordset.map(x => x.MaHangID);
        const kqGv3 = await napGiaVonTuMaHang(pool, idsCt, req.session.user.userId);
        if (kqGv3.capNhat) gvMsg3 = ` Đã cập nhật lại giá vốn cho ${kqGv3.capNhat} mã.`;
      } catch (e) { console.error('[nhapkho PUT /phieu/:id/huy] loi nap gia von tu gia nhap NCC (khong anh huong viec huy): ', e); }
    } else if (h.LoaiNhap === 'SanXuat' && h.DonHangID) {
      /* v8.90: huy phieu -> SL nhap kho giam -> mau so cua giaThanh1SP giam -> gia thanh TANG.
         ⚠️ Huy phieu CUOI CUNG cua lenh KHONG lam giaThanh1SP thanh null: tinhGiaThanh() lui ve
         luy ke cong doan KN roi SL CAT. SL cat thuong LON HON SL nhap kho that => gia von TUT,
         lai gop PHINH. Vi vay ham chi ghi khi gt.donViSLDungTinh === 'Cái' (mau so den tu phieu
         nhap kho) — xem DIEU (2) trong giaVonLenhSX.js. */
      try {
        gvMsg3 = loiNhanGiaVon(await napGiaVonTuLenhSX(pool, h.DonHangID, null, req.session.user.userId));
      } catch (e) { console.error('[nhapkho PUT /phieu/:id/huy] loi nap gia von tu lenh SX (khong anh huong viec huy): ', e); }
    }
    res.json({ success: true, message: 'Đã hủy phiếu — tồn kho và công nợ trả về như trước.' + gvMsg3 });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* da ket thuc */ }
    res.status(400).json({ success: false, message: 'Lỗi khi hủy phiếu (đã quay lui): ' + err.message });
  }
});

/* v6.94: da chuyen phan "ma hang dang duoc dung o dau" sang backend/utils/maHangThamChieu.js —
   dung CHUNG voi Danh muc hang hoa (routes/danhmuc.js). Mot ban duy nhat, khong sao chep. */

/* ================================================================================================
   XOA PHIEU NHAP KHO — XOA LUON MA HANG NEU CHUA XUAT BAN (v6.92)

   Quy tac (nguoi dung chot):
     - Ma hang CHUA co phieu xuat  -> xoa phieu VA xoa luon ma hang khoi danh muc.
     - Ma hang DA co phieu xuat    -> KHONG cho xoa; phai huy phieu xuat truoc.

   ⚠️ CHAN TRUOC, XOA SAU: kiem tra het roi moi mo transaction. Neu xoa phieu truoc roi moi phat hien
   con phieu ban hang thi phai quay lui — ma quay lui giua chuoi DELETE nhieu bang la cho de sinh loi
   nhat. Chan truoc thi truong hop that bai khong he dong vao du lieu.

   ⚠️ Ma hang duoc GIU LAI (khong xoa) khi con bat ky rang buoc nao khac, ke ca phieu nhap kho KHAC:
   xoa mot trong hai phieu nhap cua cung mot ma khong duoc keo mat ca ma hang.
   ================================================================================================ */
router.delete('/phieu/:id', requireAuth, requirePermission('KHOHANG', 'delete'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const phieuId = parseInt(req.params.id, 10);
  const h = (await pool.request().input('id', sql.Int, phieuId)
    .query('SELECT PhieuNKID, SoPhieu, TrangThai, LoaiNhap, DonHangID FROM PhieuNhapKhoHang WHERE PhieuNKID=@id')).recordset[0];
  if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập kho.' });

  // Cac ma hang co tren phieu nay
  const maTrenPhieu = (await pool.request().input('id', sql.Int, phieuId).query(`
    SELECT DISTINCT ct.MaHangID, hh.MaHang, hh.TenHang
    FROM PhieuNhapKhoHangChiTiet ct
    JOIN TheKhoHangHoa hh ON hh.MaHangID = ct.MaHangID
    WHERE ct.PhieuNKID = @id`)).recordset;

  /* ---- BUOC 1: CHAN neu ma hang da co PHIEU XUAT (phieu ban hang) chua huy ---- */
  const vuongXuat = [];
  for (const m of maTrenPhieu) {
    const bh = (await pool.request().input('mh', sql.Int, m.MaHangID).query(`
      SELECT DISTINCT p.SoPhieu
      FROM PhieuBanHangChiTiet ct
      JOIN PhieuBanHang p ON p.PhieuBHID = ct.PhieuBHID
      WHERE ct.MaHangID = @mh AND p.TrangThai <> N'Đã hủy'`)).recordset.map(x => x.SoPhieu);
    if (bh.length) vuongXuat.push({ ma: m.MaHang, phieu: bh });
  }
  if (vuongXuat.length) {
    return res.status(400).json({
      success: false,
      message: 'KHÔNG xóa được phiếu ' + h.SoPhieu + ' — hàng đã xuất bán. Phải HỦY phiếu bán hàng trước:\n'
        + vuongXuat.map(v => '• ' + v.ma + ': ' + v.phieu.join(', ')).join('\n')
    });
  }

  /* ---- BUOC 2: xoa phieu, roi xoa nhung ma hang khong con rang buoc nao ---- */
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    await new sql.Request(tran).input('id', sql.Int, phieuId)
      .query('DELETE FROM PhieuNhapKhoHang WHERE PhieuNKID=@id');   // chi tiet xoa theo CASCADE

    const daXoaMa = [], giuLaiMa = [], giuLaiIds = [];
    for (const m of maTrenPhieu) {
      const vuong = await noiDangDungMaHang(pool, m.MaHangID, tran);
      if (vuong.length) {
        giuLaiMa.push(m.MaHang + ' (còn: ' + vuong.join(', ') + ')');
        giuLaiIds.push(m.MaHangID);
        continue;
      }
      // Khong con gi tham chieu -> xoa ma hang. TheKhoChiTietMau / GiaVonHangHoa mat theo CASCADE.
      await new sql.Request(tran).input('mh', sql.Int, m.MaHangID)
        .query('DELETE FROM TheKhoHangHoa WHERE MaHangID = @mh');
      daXoaMa.push(m.MaHang);
    }

    await tran.commit();
    /* v8.07: ma hang GIU LAI (khong bi xoa theo phieu) co the mat dong dong gop cua CHINH phieu nay
       vao BQGQ gia nhap -> tinh lai gia von cho dung. Ma DA XOA thi GiaVonHangHoa da mat theo CASCADE
       roi, khong can dong gi them. Loi o day KHONG duoc chan viec xoa phieu (da commit xong). */
    let gvMsg4 = '';
    if (h.LoaiNhap === 'NhaCungCap' && giuLaiIds.length) {
      try {
        const kqGv4 = await napGiaVonTuMaHang(pool, giuLaiIds, req.session.user.userId);
        if (kqGv4.capNhat) gvMsg4 = ' Đã cập nhật lại giá vốn cho ' + kqGv4.capNhat + ' mã.';
      } catch (e) { console.error('[nhapkho DELETE /phieu/:id] loi nap gia von tu gia nhap NCC (khong anh huong viec xoa): ', e); }
    } else if (h.LoaiNhap === 'SanXuat' && h.DonHangID) {
      /* v8.90: ma GIU LAI mat dong gop cua phieu vua xoa vao mau so -> tinh lai. KHONG gate theo
         giuLaiIds: ham tu lay moi ma CON LAI cua lenh; ma da bi xoa thi GiaVonHangHoa cung mat
         theo CASCADE roi, khong con gi de ghi. */
      try {
        gvMsg4 = loiNhanGiaVon(await napGiaVonTuLenhSX(pool, h.DonHangID, null, req.session.user.userId));
      } catch (e) { console.error('[nhapkho DELETE /phieu/:id] loi nap gia von tu lenh SX (khong anh huong viec xoa): ', e); }
    }
    let msg = 'Đã xóa phiếu nhập kho ' + h.SoPhieu + '.';
    if (daXoaMa.length) msg += ' Đã xóa luôn ' + daXoaMa.length + ' mã hàng khỏi danh mục: ' + daXoaMa.join(', ') + '.';
    if (giuLaiMa.length) msg += ' GIỮ LẠI ' + giuLaiMa.length + ' mã vì còn dữ liệu liên quan: ' + giuLaiMa.join('; ') + '.';
    msg += gvMsg4;
    res.json({ success: true, data: { daXoaMa, giuLaiMa }, message: msg });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* da ket thuc */ }
    console.error('[nhapkho DELETE /phieu/:id] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi xóa phiếu (đã quay lui, dữ liệu giữ nguyên): ' + err.message });
  }
});


module.exports = router;
