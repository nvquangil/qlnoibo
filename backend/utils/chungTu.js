/* ==================================================================================================
   v8.77 — DOC CHI TIET 1 CHUNG TU (dung chung cho So cong no VA Bao cao kinh doanh)
   --------------------------------------------------------------------------------------------------
   Truoc v8.77 ham nay nam THANG trong routes/congno.js. Tach ra day vi Bao cao kinh doanh cung can
   doc dung nhung chung tu do, ma hai man hinh KHONG the dung chung mot route: quyen khac nhau
   (CONGNO/view vs BAOCAO/view). Tach PHAN DOC ra, moi route tu gate quyen cua minh roi goi vao day.

   🔴 VI SAO PHAI CO HANG CT_LOAI — doc truoc khi them loai moi
   Loi da vo o v7.48: soChiTietNCC() sinh 7 ma CtLoai ma route /chungtu chi xu ly 4. Sinh o mot ben,
   doc o ben kia, hai danh sach khong ai buoc phai khop nhau => nguoi dung bam vao dong "Nhap kho hang
   hoa" thi nhan "Loai chung tu khong ho tro xem chi tiet".
   Tu v8.77, MOI noi sinh CtLoai phai lay ma tu CT_LOAI nay, khong go chuoi tay. Bo tu kiem
   utils/kiem_chungtu_congno_ncc.js doi chieu hai dau — lech la test do.

   QUYEN: ham nay KHONG kiem tra quyen. Route goi vao phai tu gate.
   Nguyen tac da chot (congno.js v6.55): nguoi xem duoc con so thi xem duoc chung tu tao ra con so do,
   khong bat ho phai co them quyen cua phan he Kho vai / Phu kien / Kho hang.

   TRA VE: { data: { tieuDe, header, dong[] } }  khi doc duoc
           { status, message }                    khi khong doc duoc (route tu doi thanh HTTP)
   ================================================================================================== */

const { sql } = require('../db');
const { bieuThucTienCay, bieuThucSoLuongTinhTien, bieuThucDonViSQL,
        bieuThucTienTraVai, coCotDonGiaTra } = require('./tienVaiNhap');   // v8.91

/* MOT NOI DUY NHAT khai cac loai chung tu doc duoc. Khoa = ma CtLoai, gia tri = nhan mac dinh. */
const CT_LOAI = Object.freeze({
  PT:   'Phiếu thu',
  PC:   'Phiếu chi',
  PNV:  'Phiếu nhập vải',
  PXV:  'Phiếu xuất vải',
  PNPK: 'Phiếu nhập phụ kiện',
  PXPK: 'Phiếu xuất phụ kiện',
  PNKH: 'Phiếu nhập kho hàng hóa',
  PNL:  'Phiếu nhập lại (khách trả)',
  PBH:  'Phiếu bán hàng'
});
const CT_MA = Object.freeze(Object.keys(CT_LOAI));

async function coCot(pool, bang, cot) {
  const r = (await pool.request().query(`SELECT COL_LENGTH('${bang}','${cot}') AS c`)).recordset[0] || {};
  return r.c != null;
}

const soPhieuDem5 = (tienTo, id) => tienTo + String(id).padStart(5, '0');

async function docChungTu(pool, loai, id) {
  loai = String(loai || '').trim();
  id = parseInt(id, 10);
  if (!id) return { status: 400, message: 'Thiếu mã chứng từ.' };
  if (!CT_LOAI[loai]) {
    return { status: 400, message: `Loại chứng từ "${loai || '(trống)'}" không hỗ trợ xem chi tiết.` };
  }
  const rq = () => pool.request().input('id', sql.Int, id);

  if (loai === 'PT') {
    /* v8.78: phieu thu nay co the la THU LAI TU NCC (migration_v875 them PhieuThu.NCC_ID). Do cot
       truoc roi moi JOIN — CSDL chua chay migration van mo duoc phieu thu nhu cu, khong bao
       "Invalid column name". Nhanh PC o duoi da JOIN NhaCungCap tu truoc, nay hai ben doi xung. */
    const coNCC = await coCot(pool, 'PhieuThu', 'NCC_ID');
    const h = (await rq().query(`
      SELECT t.*, tk.MaTK, tk.TenTK, u.HoTen AS NguoiTao${coNCC ? ', ncc.TenNCC' : ''}
      FROM PhieuThu t LEFT JOIN DanhMucTaiKhoan tk ON tk.TaiKhoanID = t.TaiKhoanID
      ${coNCC ? 'LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = t.NCC_ID' : ''}
      LEFT JOIN Users u ON u.UserID = t.NguoiTaoID WHERE t.PhieuThuID = @id`)).recordset[0];
    if (!h) return { status: 404, message: 'Không tìm thấy phiếu thu.' };
    const nhan = String(h.LoaiDoiTuong || '') === 'NhaCungCap' ? 'Phiếu thu lại từ NCC ' : 'Phiếu thu ';
    return { data: { tieuDe: nhan + (h.SoPhieu || ''), header: h, dong: [] } };
  }

  if (loai === 'PC') {
    const h = (await rq().query(`
      SELECT c.*, tk.MaTK, tk.TenTK, ncc.TenNCC, u.HoTen AS NguoiTao
      FROM PhieuChi c LEFT JOIN DanhMucTaiKhoan tk ON tk.TaiKhoanID = c.TaiKhoanID
      LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = c.NCC_ID
      LEFT JOIN Users u ON u.UserID = c.NguoiTaoID WHERE c.PhieuChiID = @id`)).recordset[0];
    if (!h) return { status: 404, message: 'Không tìm thấy phiếu chi.' };
    return { data: { tieuDe: 'Phiếu chi ' + (h.SoPhieu || ''), header: h, dong: [] } };
  }

  if (loai === 'PNV') {
    const h = (await rq().query(`
      SELECT pn.*, ncc.TenNCC FROM PhieuNhapVai pn
      LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = pn.NCC_ID WHERE pn.PhieuNhapID = @id`)).recordset[0];
    if (!h) return { status: 404, message: 'Không tìm thấy phiếu nhập vải.' };
    // v6.56.1: DanhMucVai KHONG co cot TenVai — ten vai la ghep Loai vai + Mau, giong moi truy van
    // khac trong khovai.js. Ma hien la MaCay, phan ten ghep tu 2 bang kia.
    const dong = (await rq().query(`
      SELECT vc.MaCay,
             LTRIM(RTRIM(ISNULL(lv.TenLoaiVai, ISNULL(dv.MaVai, '')) + ISNULL(N' - ' + ms.TenMau, ''))) AS Ten,
             ${await bieuThucSoLuongTinhTien(pool, 'vc', 'pnv')} AS SoLuong,
             ${await bieuThucDonViSQL(pool, 'pnv')} AS DonVi, vc.DonGiaNhap AS DonGia,
             ${await bieuThucTienCay(pool, 'vc', 'pnv')} AS ThanhTien
      FROM VaiCay vc
      JOIN PhieuNhapVai pnv ON pnv.PhieuNhapID = vc.PhieuNhapID
      LEFT JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
      LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
      LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
      WHERE vc.PhieuNhapID = @id ORDER BY vc.CayID`)).recordset;
    // v6.56.2: tieu de dung DUNG so phieu nhu man Phieu nhap kho vai, khong dung so hoa don NCC.
    const so = soPhieuDem5('NKV-', id);
    return { data: {
      tieuDe: 'Phiếu nhập vải ' + so + (h.SoHoaDon ? ` (HĐ ${h.SoHoaDon})` : ''), header: h, dong } };
  }

  /* v7.48: PNPK (nhap) va PXPK (xuat) dung CUNG hai bang — chi khac tien to so phieu va nhan tieu de.
     Viet hai nhanh rieng la som muon lech mot ben. */
  if (loai === 'PNPK' || loai === 'PXPK') {
    const laXuat = loai === 'PXPK';
    const h = (await rq().query(`
      SELECT p.*, ncc.TenNCC FROM PhieuPhuKien p
      LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID WHERE p.PhieuID = @id`)).recordset[0];
    if (!h) return { status: 404, message: 'Không tìm thấy phiếu phụ kiện.' };
    const dong = (await rq().query(`
      SELECT pk.MaPhuKien AS MaCay, pk.TenPhuKien AS Ten, ct.SoLuong, pk.DonViCoBan AS DonVi,
             ct.DonGia, (ISNULL(ct.SoLuong,0) * ISNULL(ct.DonGia,0)) AS ThanhTien
      FROM PhieuPhuKienChiTiet ct LEFT JOIN DanhMucPhuKien pk ON pk.PhuKienID = ct.PhuKienID
      WHERE ct.PhieuID = @id ORDER BY ct.ID`)).recordset;
    // v6.56.2: so phieu dem 5 chu so, GIONG chuoi so cong no dang hien (NPK-/XPK-).
    const so = soPhieuDem5(laXuat ? 'XPK-' : 'NPK-', id);
    /* v8.77: truoc day nhan cung la "Phieu tra phu kien NCC" cho MOI phieu xuat — sai voi phieu xuat
       cho san xuat (chiem da so). Nay doc co LaTraNCC (migration_v676) de goi dung ten. */
    let nhan = laXuat ? 'Phiếu xuất phụ kiện ' : 'Phiếu nhập phụ kiện ';
    if (laXuat && await coCot(pool, 'PhieuPhuKien', 'LaTraNCC') && h.LaTraNCC) nhan = 'Phiếu trả phụ kiện NCC ';
    return { data: {
      tieuDe: nhan + so + (h.SoHoaDon ? ` (HĐ ${h.SoHoaDon})` : ''), header: h, dong } };
  }

  if (loai === 'PNKH') {
    const h = (await rq().query(`
      SELECT p.*, ncc.TenNCC, u.HoTen AS NguoiTao FROM PhieuNhapKhoHang p
      LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID
      LEFT JOIN Users u ON u.UserID = p.NguoiTaoID WHERE p.PhieuNKID = @id`)).recordset[0];
    if (!h) return { status: 404, message: 'Không tìm thấy phiếu nhập kho hàng hóa.' };
    const dong = (await rq().query(`
      SELECT hh.MaHang AS MaCay,
             LTRIM(RTRIM(ISNULL(hh.TenHang, '') + ISNULL(N' - ' + ms.TenMau, ''))) AS Ten,
             ct.SoLuong, ct.DonVi, ct.DonGia, ct.ThanhTien
      FROM PhieuNhapKhoHangChiTiet ct
      LEFT JOIN TheKhoHangHoa hh ON hh.MaHangID = ct.MaHangID
      LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
      WHERE ct.PhieuNKID = @id ORDER BY ct.ID`)).recordset;
    return { data: {
      tieuDe: 'Phiếu nhập kho hàng hóa ' + (h.SoPhieu || '') + (h.SoHoaDon ? ` (HĐ ${h.SoHoaDon})` : ''),
      header: h, dong } };
  }

  /* PNL = phieu NHAP LAI (hang khach tra). TenDoiTuong / SoTien la BUT DANH cho modal xem chung tu
     dung chung (no doc dung 2 ten nay) — khong phai cot that cua bang. Doi ten o modal thi phai doi
     ca o day. */
  if (loai === 'PNL') {
    const h = (await rq().query(`
      SELECT p.*, p.TenKhach AS TenDoiTuong, p.TongThanhToan AS SoTien, u.HoTen AS NguoiTao
      FROM PhieuNhapLai p LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
      WHERE p.PhieuNLID = @id`)).recordset[0];
    if (!h) return { status: 404, message: 'Không tìm thấy phiếu nhập lại.' };
    const dong = (await rq().query(`
      SELECT hh.MaHang AS MaCay,
             LTRIM(RTRIM(ISNULL(hh.TenHang, '') + ISNULL(N' - ' + ms.TenMau, ''))) AS Ten,
             ct.SoLuong, ct.DonVi, ct.GiaBan AS DonGia, ct.ThanhTien
      FROM PhieuNhapLaiChiTiet ct
      LEFT JOIN TheKhoHangHoa hh ON hh.MaHangID = ct.MaHangID
      LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
      WHERE ct.PhieuNLID = @id ORDER BY ct.ID`)).recordset;
    return { data: { tieuDe: 'Phiếu nhập lại (khách trả) ' + (h.SoPhieu || ''), header: h, dong } };
  }

  if (loai === 'PXV') {
    /* NCC_ID / LaTraNCC den tu migration_v6.66 — do cot truoc khi JOIN, khong thi CSDL chua chay
       migration se bao "Invalid column name" thay vi mo duoc phieu. */
    const coNCC = await coCot(pool, 'PhieuXuatVai', 'NCC_ID');
    const h = (await rq().query(`
      SELECT px.*${coNCC ? ', ncc.TenNCC' : ''} FROM PhieuXuatVai px
      ${coNCC ? 'LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = px.NCC_ID' : ''}
      WHERE px.PhieuXuatID = @id`)).recordset[0];
    if (!h) return { status: 404, message: 'Không tìm thấy phiếu xuất vải.' };
    const coGia = await coCot(pool, 'VaiCay', 'DonGiaNhap');
    /* v8.91: don gia hien o bang chung tu phai la CHINH don gia da ghi no/giam no, khong phai
       luon luon DonGiaNhap. Phieu tra NCC tu v8.91 co the go don gia rieng (ct.DonGiaTra) — neu
       cho nay van doc DonGiaNhap thi so cong no NCC ghi 50.000/kg ma bam vao chinh dong do de xem
       chung tu lai thay 85.000/kg: hai man hinh, hai con so, cung mot phieu.
       Dong xuat cho san xuat co DonGiaTra = NULL nen COALESCE tu lui ve DonGiaNhap — dung nhu cu. */
    const cotGia = coGia
      ? ((await coCotDonGiaTra(pool)) ? 'COALESCE(ct.DonGiaTra, vc.DonGiaNhap)' : 'vc.DonGiaNhap')
      : 'CAST(NULL AS DECIMAL(14,2))';
    const cotThanhTien = coGia
      ? await bieuThucTienTraVai(pool, 'ct', 'vc')
      : 'CAST(NULL AS DECIMAL(14,2))';
    const dong = (await rq().query(`
      SELECT vc.MaCay,
             LTRIM(RTRIM(ISNULL(lv.TenLoaiVai, ISNULL(dv.MaVai, '')) + ISNULL(N' - ' + ms.TenMau, ''))) AS Ten,
             ct.KGXuat AS SoLuong, N'Kg' AS DonVi, ${cotGia} AS DonGia,
             ${cotThanhTien} AS ThanhTien
      FROM PhieuXuatVaiChiTiet ct
      JOIN VaiCay vc ON vc.CayID = ct.CayID
      LEFT JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
      LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
      LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
      WHERE ct.PhieuXuatID = @id ORDER BY ct.ID`)).recordset;
    // Chuoi so phieu GIONG so dang hien o so cong no / bao cao (XKV-#####), de doi chieu khong phai doan.
    const so = soPhieuDem5('XKV-', id);
    /* v8.77: nhanh nay KHONG loc LaTraNCC nen no doc duoc CA phieu xuat thuong (xuat cho san xuat).
       Truoc day nhan cung la "Phieu tra vai NCC" — dung voi so cong no (cho do chi co phieu tra),
       nhung sai han khi mo tu Bao cao ton kho. */
    const laTra = (await coCot(pool, 'PhieuXuatVai', 'LaTraNCC')) && h.LaTraNCC;
    return { data: {
      tieuDe: (laTra ? 'Phiếu trả vải NCC ' : 'Phiếu xuất kho vải ') + so, header: h, dong } };
  }

  /* v8.77 — PBH moi them. Truoc day so cong no mo phieu ban hang bang cach goi thang
     /api/banhang/phieu/:id tu frontend (module.congno.js:1095) — ma route do gate KHOHANG/view,
     nen nguoi chi co quyen Cong no bam vao la nhan 403. Dua ve day thi ca So cong no lan Bao cao
     deu mo duoc bang quyen cua chinh man hinh minh. */
  if (loai === 'PBH') {
    /* TenDoiTuong / SoTien la BUT DANH cho modal xem chung tu dung chung (no doc dung 2 ten nay).
       ⚠️ SoTien phai lay TongThanhToan — KHONG duoc de modal tu cong SUM(ThanhTien) cua cac dong:
       tong dong moi la tien hang, CHUA tru CK NPP va CHUA cong VAT, nen lech voi so ghi no o so
       cong no. Hai con so khac nhau tren cung mot man hinh la dung kieu loi lam mat long tin
       vao bao cao. */
    /* DaThu lay y het route /api/banhang/phieu/:id — so cong no can no de hien "Da thu". */
    const h = (await rq().query(`
      SELECT p.*, p.TenKhach AS TenDoiTuong, p.TongThanhToan AS SoTien, u.HoTen AS NguoiTao,
             ISNULL((SELECT SUM(t.SoTien) FROM PhieuThu t WHERE t.PhieuBHID = p.PhieuBHID), 0) AS DaThu
      FROM PhieuBanHang p LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
      WHERE p.PhieuBHID = @id`)).recordset[0];
    if (!h) return { status: 404, message: 'Không tìm thấy phiếu bán hàng.' };
    /* SoLuong theo DON VI ghi tren phieu (Cai / Ri); ThanhTien da tinh san = GiaBan x SoLuongCai.
       Tra CA HAI bo ten cot:
         - MaCay / Ten / DonGia : khuon CHUNG cua modal xem chung tu (Bao cao dung bo nay)
         - MaHang / TenHang / TenMau / GiaBanLe / PhanTramCKShop / GiaBan : bo RIENG cua man So cong
           no, no hien them cot gia ban le va % CK shop theo mau Word.
       Du mot chut, nhung nho vay ca hai man hinh doc duoc tu MOT nguon — khong phai viet route thu hai. */
    const dong = (await rq().query(`
      SELECT hh.MaHang AS MaCay,
             LTRIM(RTRIM(ISNULL(hh.TenHang, '') + ISNULL(N' - ' + ms.TenMau, ''))) AS Ten,
             hh.MaHang, hh.TenHang, ms.TenMau,
             ct.SoLuong, ISNULL(ct.DonVi, hh.DonViCoBan) AS DonVi,
             ct.GiaBanLe, ct.PhanTramCKShop, ct.GiaBan, ct.GiaBan AS DonGia, ct.ThanhTien
      FROM PhieuBanHangChiTiet ct
      JOIN TheKhoHangHoa hh ON hh.MaHangID = ct.MaHangID
      LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
      WHERE ct.PhieuBHID = @id ORDER BY ct.ID`)).recordset;
    const huy = String(h.TrangThai || '') === 'Đã hủy' ? ' (ĐÃ HỦY)' : '';
    return { data: {
      tieuDe: 'Phiếu bán hàng ' + (h.SoPhieu || '') + huy, header: h, dong } };
  }

  /* Khong bao gio toi day: moi ma trong CT_LOAI deu co nhanh o tren, va ma ngoai CT_LOAI da bi chan
     ngay dau ham. Giu lai de neu ai them ma vao CT_LOAI ma quen viet nhanh thi bao ro rang. */
  return { status: 500, message: `Loại "${loai}" có trong CT_LOAI nhưng chưa có nhánh đọc.` };
}

module.exports = { CT_LOAI, CT_MA, docChungTu };
