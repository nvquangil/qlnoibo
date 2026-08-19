const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, canUpdateStage, requireChucNang, requireChucNangAny } = require('../middleware/auth');
const { checkOverdueOrders } = require('../utils/checkOverdue');
const { notifyStageUsers } = require('./notifications');

const router = express.Router();
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// v5.9 (yeu cau "Mã công đoạn... mở rộng thành sửa lại toàn bộ các chỗ đang so sánh trực tiếp theo TÊN
// công đoạn... sang so sánh theo mã/StageID"): MA_CONG_DOAN_MAY la MA ON DINH (CongDoanSanXuat.MaCongDoan,
// vd 'MAY'), KHONG con la TEN hien thi ('May') - ten hien thi (TenCongDoan) tu do doi duoc qua Danh muc
// tu sau khi nang cap nay (MaCongDoan cua 8 cong doan he thong da duoc KHOA qua cot LaHeThong, xem
// migration_v59.sql + backend/routes/danhmuc.js) ma KHONG lam gian doan logic ben duoi nua.
const MA_CONG_DOAN_MAY = 'MAY';

// Tinh cong doan KE TIEP thuc su, co xet bo qua "May" neu don hang giao gia cong ngoai (khong phai
// "Nha Lam") - theo yeu cau v5.0: "Neu giao don hang khac ten nha gia cong la nha lam thi khong nhay
// sang cong doan May (de do sang phan tinh luong nha gia cong)". Chi bo qua khi don hang DA co
// NhaGiaCongID (da lam buoc "Giao/nhan nha gia cong") va KHONG phai "Nha Lam"; neu chua giao cho ai thi
// van đi qua May như bình thường (gia dinh se lam noi bo, tranh nhay cong đoan sai khi chua ro).
// v5.8: doi tu so sanh CHUOI (order.TenNhaGiaCong !== 'Nhà Làm') sang co LaNoiBoNhaGiaCong (BIT, xem
// migration_v58.sql + getOrderByMaDH ben duoi) - khong con phu thuoc ten hien thi, tranh sai neu ai do
// doi ten/them khoang trang dong "Nhà Làm" trong Danh mục Nhà gia công.
// v5.9: doi tu so sanh TenCongDoan sang MaCongDoan (xem MA_CONG_DOAN_MAY o tren) - cung ly do, ap dung
// cho chinh cong doan "May".
// v5.18 (muc 1.2.1/1.2.2): bo "Chỉ định phụ kiện" (PK) va "Giao vải" (GV) ra khoi luong Ghi nhan tien
// do - 2 cong doan nay LUON bi bo qua khi tinh cong doan KE TIEP (khong con dieu kien gi, khac voi
// May chi bo qua CO DIEU KIEN o duoi). Van GIU NGUYEN 2 dong CongDoanSanXuat nay trong danh muc (khong
// xoa) de khong pha vo du lieu lich su (TienDoSanXuat.StageID cu, bao cao...) - chi khong con la diem
// dung tren duong di cua don hang MOI nua. Xem migration_v518.sql ve buoc chuyen cac don dang o dung
// GV/PK sang CAT khi nang cap.
// v5.20 (muc 1, "xac dinh lai luong ghi tien do san xuat"): them 'HT' (Hoan thien) vao danh sach bo qua
// KHONG DIEU KIEN - cong doan nay KHONG con trong luong moi (Ra lenh SX -> Tai lieu KT -> Ky thuat ->
// Chi dinh vai sx -> Xuat vai -> Cat -> Chi dinh phu kien -> Xuat phu kien -> Giao nha in theu -> Nhan
// nha in theu -> Giao nha gia cong -> Nhan nha gia cong -> May -> Nhat chi -> QC -> La -> Dong goi ->
// Kho nhap) - GIU NGUYEN dong CongDoanSanXuat (LaHeThong=1, khong xoa) cung ly do voi GV/PK o tren. Xem
// migration_v520.sql ve buoc chuyen cac don dang dung o HT sang "Nhat chi" (NCH, cong doan ke tiep thuc
// su trong danh muc moi) khi nang cap.
const MA_CONG_DOAN_BO_QUA = ['GV', 'PK', 'HT', 'GNGC', 'NNGC', 'GNIT', 'NNIT'];   // v5.31: an GNGC/NNGC cu; v5.33: an GNIT/NNIT (in theu cu trung voi GIT/NIT moi)

// v5.20 (muc 1/2/3): 2 cong doan MOI thay 1 phan modal "Giao/nhan nha gia cong & nha in" (openVendorForm)
// da bi XOA khoi Danh sach lenh san xuat (yeu cau muc 3) - nay la 2 CONG DOAN THAT trong chinh luong Ghi
// nhan tien do, GAN VOI cot da co san tren DonHangSanXuat (NhaGiaCongID/NgayGiaoGC/NgayNhanGC - KHONG doi
// schema). Cap Giao/Nhan chi BAT BUOC (khong bi bo qua) khi don hang THUC SU co dung dich vu gia cong ngoai.
// v5.21 (muc 8, "Tách Giao nhà in thêu, nhận nhà in thêu ra thành chức năng riêng... không phải trong ghi
// nhận tiến độ"): DAO NGUOC lai phan "Giao/Nhan nha in theu" cua v5.20 - GNIT/NNIT KHONG con la 2 cong
// doan trong CongDoanSanXuat nua (da XOA khoi migration_v520.sql truoc khi migration nay tung duoc trien
// khai - an toan sua truc tiep vi CHUA deploy, xem [[project_qlnoibo_v520_pending_deploy]]), thay bang 2
// chuc nang DOC LAP (tab rieng trong Quan ly san xuat, phan quyen rieng ChucNang 'giaonhaintheu'/
// 'nhannhaintheu') KHONG gate/chan luong Ghi nhan tien do nua - xem GET/POST /giaonhaintheu, /nhannhaintheu
// o duoi (dung LAI dung 3 cot DonHangSanXuat.NhaInID/NgayGiaoIn/NgayNhanIn, khong doi schema).
// v5.22 (muc 1.1, "xóa bỏ Giao nhà in thêu, nhận nhà in thêu, giao nhà gia công, nhận nhà gia công ở
// trong tiến độ sản xuất"): DAO NGUOC not GNGC/NNGC theo DUNG cach v5.21 da lam cho GNIT/NNIT - 2 cong
// doan nay CUNG KHONG con trong CongDoanSanXuat/tinhNextStage nua (da XOA khoi migration_v520.sql, van
// AN TOAN sua truc tiep vi CA CHUOI v5.20->v5.21->v5.22 chua tung deploy). Viec "giao/nhan nha gia cong"
// von da co san 1 co che RIENG, DAY DU hon nhieu tu v5.19 (DonHangChiTietNhaGiaCong + GiaoNhaGiaCongChiTiet/
// NhanNhaGiaCongChiTiet - nhieu nha gia cong, nhieu lan giao/nhan, gia/SL rieng tung lan) qua 2 tab doc
// lap /giaonhagiacong, /nhannhagiacong (ChucNang da co san tu v5.19, KHONG can them dong ChucNang moi) -
// nen viec BAT BUOC di qua 1 cong doan GNGC/NNGC rieng trong Ghi nhan tien do la THUA (2 co che song song
// cung ghi nhan 1 viec). 2 cot don-gia-tri NgayGiaoGC/NgayNhanGC tren DonHangSanXuat (khac voi NhaInID/
// NgayGiaoIn/NgayNhanIn ben nha in - cac cot do VAN con dung qua GNIT/NNIT) tu nay KHONG con noi nao ghi
// nua (khong xoa cot, chi thanh "mo coi" - xem POST /orders/:maDH/tiendo, da bo nhanh GNGC/NNGC). Muc
// 1.4 (yeu cau "Khi chọn chức năng hiện ra danh sách các lệnh sản xuất...") xay lai 2 tab nay theo dung
// mo hinh danh-sach-don-hang-truoc, giong GNIT/NNIT. (LICH SU - tab "Giao nhà gia công" + GET
// /giaonhagiacong/orders mo ta o day da bi XOA HAN tu v5.24, xem doan v5.24 ngay duoi day.)
// v5.23 (sua sai v5.21 muc 3 - user phan hoi "Sau công đoạn cắt có công đoạn giao gia công... Nếu giao
// gia công... Nếu giao nhà làm thì chuyển sang công đoạn may"): toggle "Kenh san xuat" (NhaLam/GiaCong)
// v5.21 dat SAI cho o Ky thuat (KT) - dung ra phai la 1 CONG DOAN THAT rieng, dung NGAY SAU Cat, TRUOC
// May. Them CongDoanSanXuat MOI MaCongDoan='GC' ("Giao gia công"), ThuTu=30 (giua CAT=20 va MAY=70, tai
// dung cho GNGC cu da bo o v5.22 - xem migration_v523.sql). tinhNextStage() KHONG can them dieu kien
// skip cho 'GC' - day la cong doan BAT BUOC, luon di qua dung 1 lan cho moi don (giong CAT/MAY/NCH...).
// v5.24 (sua tiep, phan hoi "có những công đoạn trùng nhau" - xem migration_v524.sql): thiet ke lai HOAN
// TOAN cong doan 'GC'. KHONG con la 1 RADIO (chon 1 trong 2 "NhaLam"/"GiaCong", cot DonHangSanXuat.
// KenhSanXuat) nhu v5.23 - doi thanh 2 CHECKBOX DOC LAP DaGiaoNhaLam/DaGiaoGiaCong (co the tick CA HAI -
// don hang chia mot phan lam noi bo mot phan thue ngoai). KenhSanXuat GIU NGUYEN cot (da them tu
// migration_v521.sql) nhung tu nay KHONG con noi nao ghi/doc nua ("mo coi", da backfill 1 lan sang 2 cot
// moi trong migration_v524.sql). "Nha gia cong dai dien" (searchable-select rieng, v5.21-v5.23) VA o
// "Don gia gia cong" rieng da bi XOA khoi form 'GC' - viec giao nha gia cong tu nay CHI con 1 co che DUY
// NHAT: "Nha gia cong chi tiet" (DonHangChiTietNhaGiaCong, da co san tu v5.19) nhung THEM cot SoLuong
// (moi, migration_v524.sql) nhap NGAY tai day, KHONG con phai qua tab rieng "Giao nha gia cong" nua (tab
// do da bi XOA - xem module.qlsx.js). Xem POST /orders/:maDH/tiendo nhanh 'GC' (gio CHI con ghi 2 co
// boolean, khong con ghi NhaGiaCongID/DonGiaGiaCongNgoai/KenhSanXuat nua - viec luu nha gia cong+SL da
// tach rieng qua nut "Lưu nhà gia công" instant-save, khong doi tu truoc).
function tinhNextStage(stages, curIndex, order) {
  let nextIndex = curIndex + 1;
  while (nextIndex < stages.length) {
    const candidate = stages[nextIndex];
    const ma = candidate.MaCongDoan;
    if (MA_CONG_DOAN_BO_QUA.indexOf(ma) !== -1) { nextIndex++; continue; }
    // v5.24: doi tu 1 co "giaCongNgoai" suy ra tu KenhSanXuat (don gia tri) sang 2 co doc lap
    // DaGiaoNhaLam/DaGiaoGiaCong (co the CA HAI cung = 1, don hang chia mot phan lam noi bo mot phan
    // thue ngoai). Chi bo qua "May" khi 100% gia cong ngoai (DaGiaoGiaCong=1 VA DaGiaoNhaLam=0) - neu co
    // ca 2 (hoac chi Nha Lam), don VAN phai di qua May cho phan lam noi bo. Don CU chua tung mo lai "Giao
    // gia công" tu sau nang cap (ca 2 co van con gia tri mac dinh 0 truoc khi backfill/lan dau mo) - xem
    // migration_v524.sql cho buoc backfill 1 lan tu KenhSanXuat/suy luan NhaGiaCongID cu.
    const chiGiaCongNgoai = !!order.DaGiaoGiaCong && !order.DaGiaoNhaLam;
    // May: bo qua NEU CHI gia cong ngoai (khong co phan Nha Lam nao) - viec giao nha gia cong THUC TE gio
    // nhap truc tiep tai chinh cong doan 'GC' (Nha gia cong chi tiet + SoLuong, xem tren), khong con 1
    // cong doan trung gian nao khac thay the.
    if (ma === MA_CONG_DOAN_MAY && chiGiaCongNgoai) { nextIndex++; continue; }
    // v5.31: don CHI gia cong ngoai - sau "Nhan gia cong" (NGC) nhay THANG sang QC, bo qua "Nhat chi" (NCH)
    // (nha gia cong da lam xong khau nay). Don co "Giao nha lam" van di qua May -> NCH binh thuong.
    if (ma === 'NCH' && chiGiaCongNgoai) { nextIndex++; continue; }
    // v5.30: "Nhan gia cong" (NGC) chi ap dung don co giao gia cong ngoai - bo qua neu don khong giao gia cong.
    if (ma === 'NGC' && !order.DaGiaoGiaCong) { nextIndex++; continue; }
    // v5.33: don KHONG in theu -> bo qua Giao/Nhan in theu (GIT/NIT), Cat nhay thang sang Giao gia cong.
    if ((ma === 'GIT' || ma === 'NIT') && !order.CoInTheu) { nextIndex++; continue; }
    break;
  }
  return nextIndex < stages.length ? nextIndex : -1;
}

// ============ DANH MUC DUNG CHO FORM (dropdowns) ============
// v4.0: bo sung donViTinh (dropdown Don vi trong cau truc vai/mau don hang), nhanVien (loc dang lam,
// dung cho cong doan Cat/May) va congDoanMay (dung cho khoi "Giao viec noi bo" o cong doan May).
router.get('/danhmuc', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const [loaiVai, mauSac, nhaGiaCong, nhaIn, congDoan, khachHang, donViTinh, nhanVien, congDoanMay, phuKien, loaiPhuKien, donViQuyDoi] = await Promise.all([
    pool.request().query('SELECT * FROM LoaiVai ORDER BY TenLoaiVai'),
    pool.request().query('SELECT * FROM MauSac ORDER BY TenMau'),
    pool.request().query("SELECT * FROM NhaGiaCong WHERE LoaiHinh = N'GiaCong' ORDER BY TenNha"),
    pool.request().query("SELECT * FROM NhaGiaCong WHERE LoaiHinh = N'InTheu' ORDER BY TenNha"),
    pool.request().query('SELECT * FROM CongDoanSanXuat ORDER BY ThuTu'),
    pool.request().query('SELECT * FROM KhachHang ORDER BY TenKhachHang'),
    pool.request().query('SELECT * FROM DanhMucDonViTinh ORDER BY TenDonVi'),
    pool.request().query("SELECT nv.*, bp.TenBoPhan FROM NhanVien nv LEFT JOIN BoPhan bp ON bp.BoPhanID=nv.BoPhanID WHERE nv.TrangThai=N'Đang làm' ORDER BY nv.HoTen"),
    pool.request().query('SELECT * FROM CongDoanMay ORDER BY TenCongDoan'),
    // v5.0: danh muc phu kien - dung cho khoi "Phu kien can dung (NPL)" trong form Ra lenh san xuat
    // v5.7: JOIN them LoaiPhuKien de co TenLoai (dung cho bo loc "Loai phu kien" o cong doan Phu kien -
    // yeu cau v5.7 "thêm lọc loại phụ kiện") - mirror dung pattern da co san trong phukien.js /danhmuc.
    pool.request().query(`
      SELECT dm.*, lpk.TenLoai FROM DanhMucPhuKien dm
      LEFT JOIN LoaiPhuKien lpk ON lpk.LoaiPhuKienID = dm.LoaiPhuKienID
      ORDER BY dm.MaPhuKien`),
    pool.request().query('SELECT * FROM LoaiPhuKien ORDER BY TenLoai'),
    // v5.21 (muc 1): danh muc CAP don vi quy doi - dung cho o chon "Don vi quy doi" o Ra lenh san xuat
    // (xem migration_v521.sql + renderLenhForm()/openEditOrderForm() trong module.qlsx.js).
    pool.request().query('SELECT * FROM DanhMucDonViQuyDoi ORDER BY DonViChinh')
  ]);
  res.json({
    success: true,
    data: {
      loaiVai: loaiVai.recordset, mauSac: mauSac.recordset,
      nhaGiaCong: nhaGiaCong.recordset, nhaIn: nhaIn.recordset,
      congDoan: congDoan.recordset, khachHang: khachHang.recordset,
      donViQuyDoi: donViQuyDoi.recordset,
      donViTinh: donViTinh.recordset, nhanVien: nhanVien.recordset, congDoanMay: congDoanMay.recordset,
      phuKien: phuKien.recordset, loaiPhuKien: loaiPhuKien.recordset
    }
  });
});

// ============ DANH SACH DON HANG (loc theo cong doan neu khong phai Admin/Quan ly/Giao nhan) ============
router.get('/orders', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'orders'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    /* v6.43: TÊN KHÁCH HIỂN THỊ = tên tự do gõ ở Ra lệnh SX (nếu có) -> nếu không thì tên trong
       Danh mục khách hàng. Đổi ngay tại nguồn đọc nên mọi danh sách/bản in tự đúng. */
    SELECT d.DonHangID, d.MaDH, d.TenSanPham,
           ISNULL(NULLIF(LTRIM(RTRIM(d.TenKhachHangTuDo)), ''), kh.TenKhachHang) AS TenKhachHang,
           d.NgayDat, d.NgayGiaoDuKien,
           d.TongSoLuong, d.PhanTramHoanThanh, d.TrangThai, c.TenCongDoan, c.StageID AS CongDoanID, c.MaCongDoan,
           d.AnhSanPham, d.NhaGiaCongID, ncc1.TenNha AS TenNhaGiaCong, d.NgayGiaoGC, d.NgayNhanGC, d.SoNgayGC,
           d.NhaInID, d.NgayGiaoIn, d.NgayNhanIn, d.SoNgayIn,
           /* v5.99: đơn NHIỀU SƠ ĐỒ cắt nhiều đợt — đếm số sơ đồ của đơn và số sơ đồ ĐÃ CÓ SỔ CẮT,
              để (1) hiện nhắc "còn phải cắt" và (2) tổ Cắt vẫn thấy đơn dù con trỏ công đoạn đã đi tiếp. */
           (SELECT COUNT(*) FROM DonHangChiTietSoDo sd WHERE sd.DonHangID = d.DonHangID) AS SoSoDo,
           (SELECT COUNT(DISTINCT td.SoDoID) FROM TienDoSanXuat td
              JOIN CongDoanSanXuat cc ON cc.StageID = td.StageID
              WHERE td.DonHangID = d.DonHangID AND cc.MaCongDoan = 'CAT' AND td.SoDoID IS NOT NULL
                AND EXISTS (SELECT 1 FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = td.TienDoID)) AS SoSoDoDaCat
    FROM DonHangSanXuat d
    LEFT JOIN KhachHang kh ON kh.KhachHangID = d.KhachHangID
    LEFT JOIN CongDoanSanXuat c ON c.StageID = d.CongDoanHienTaiID
    LEFT JOIN NhaGiaCong ncc1 ON ncc1.NhaGiaCongID = d.NhaGiaCongID
    ORDER BY d.DonHangID DESC`);

  const user = req.session.user;
  let orders = result.recordset;
  // v5.52: gộp Mã Rập từ các sơ đồ của đơn (DonHangChiTietSoDo) — hiện ở Danh sách lệnh SX + các phiếu.
  const _mr = (await pool.request().query(`SELECT DonHangID, MaRap FROM DonHangChiTietSoDo WHERE MaRap IS NOT NULL AND LTRIM(RTRIM(MaRap)) <> ''`)).recordset;
  const _mrMap = {};
  for (const s of _mr) { (_mrMap[s.DonHangID] = _mrMap[s.DonHangID] || []).push(s.MaRap); }
  orders.forEach(o => { o.MaRap = [...new Set(_mrMap[o.DonHangID] || [])].join(', '); });
  // v5.18 (muc 1.1): nguoi dung KHONG duoc phan cong bat ky cong doan nao (UserCongDoan rong - dung
  // cho tai khoan "chi xem" thuan tuy, khong phai cong nhan thao tac 1 cong doan cu the) truoc day bi
  // loc con 0 dong (mang rong .indexOf(...) luon la -1 voi moi don) - danh sach trong khong nghia ly gi
  // vi ho khong bi gioi han o 1 cong doan nao ca, nen phai duoc thay TOAN BO thay vi thay trong. Nguoi
  // CO duoc phan cong (VD to Cat/May) van chi thay dung don hang o cong doan cua ho nhu truoc, khong doi.
  const seesAll = user.isAdmin || user.boPhan === 'Quản lý' || user.boPhan === 'Giao nhận'
    || !Array.isArray(user.congDoanIds) || user.congDoanIds.length === 0;
  // v5.9: doi tu so sanh TEN cong doan (user.congDoan, mang chuoi) sang StageID (user.congDoanIds, xem
  // loadUserContext.js) - truoc day doi ten 1 cong doan trong Danh muc se khien user dang duoc phan cong
  // dung cong doan do BI MAT quyen nhin thay don hang (vi UserCongDoan.StageID khong doi, nhung so sanh
  // lai theo TEN da khac) ma khong co dong nao trong bang phan quyen thuc su thay doi - loi ngam, kho phat hien.
  /* v5.99 — ĐƠN TỪ 2 SƠ ĐỒ TRỞ LÊN CHƯA CẮT ĐỦ THÌ TỔ CẮT VẪN PHẢI THẤY.
     Trước đây user được phân công đoạn chỉ thấy đơn có CongDoanHienTaiID = công đoạn của mình; ghi sổ
     cắt sơ đồ 1 xong là con trỏ đi tiếp (sang giao in thêu / giao gia công — đúng, để bên đó làm luôn
     phần đã cắt) nên đơn BIẾN MẤT khỏi danh sách của tổ Cắt dù còn sơ đồ 2 chưa cắt.
     Nay: đơn còn sơ đồ chưa có sổ cắt (`ConPhaiCat`) vẫn hiện cho người được phân công đoạn Cắt. */
  orders.forEach(o => {
    const soSoDo = Number(o.SoSoDo) || 0;
    const daCat = Number(o.SoSoDoDaCat) || 0;
    o.ConPhaiCat = soSoDo >= 2 && daCat < soSoDo;
    o.SoSoDoConLai = o.ConPhaiCat ? (soSoDo - daCat) : 0;
  });
  if (!seesAll) {
    const catStage = (await pool.request().query("SELECT TOP 1 StageID FROM CongDoanSanXuat WHERE MaCongDoan='CAT'")).recordset[0];
    const laToCat = !!catStage && user.congDoanIds.indexOf(catStage.StageID) !== -1;
    orders = orders.filter(o => user.congDoanIds.indexOf(o.CongDoanID) !== -1 || (laToCat && o.ConPhaiCat));
  }
  res.json({ success: true, data: orders });
});

// v5.55: danh sách lệnh SX ĐÃ QUA công đoạn Kỹ thuật (đã ghi tiến độ KT) — dùng cho "Bổ sung sơ đồ".
// KHÔNG lọc theo công đoạn được phân của user (bổ sung sơ đồ là chức năng XUYÊN công đoạn: thấy hết đơn đã qua KT).
router.get('/orders-quakythuat', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const rows = (await pool.request().query(`
    SELECT d.DonHangID, d.MaDH, d.TenSanPham,
           ISNULL(NULLIF(LTRIM(RTRIM(d.TenKhachHangTuDo)), ''), kh.TenKhachHang) AS TenKhachHang,   -- v6.43
           d.TrangThai, c.TenCongDoan,
      (SELECT COUNT(*) FROM DonHangChiTietSoDo sd WHERE sd.DonHangID = d.DonHangID) AS SoSoDo
    FROM DonHangSanXuat d
    LEFT JOIN KhachHang kh ON kh.KhachHangID = d.KhachHangID
    LEFT JOIN CongDoanSanXuat c ON c.StageID = d.CongDoanHienTaiID
    WHERE EXISTS (SELECT 1 FROM TienDoSanXuat td JOIN CongDoanSanXuat kt ON kt.StageID = td.StageID
                  WHERE td.DonHangID = d.DonHangID AND kt.MaCongDoan = N'KT')
    ORDER BY d.DonHangID DESC`)).recordset;
  const _mr = (await pool.request().query(`SELECT DonHangID, MaRap FROM DonHangChiTietSoDo WHERE MaRap IS NOT NULL AND LTRIM(RTRIM(MaRap)) <> ''`)).recordset;
  const _mrMap = {};
  for (const s of _mr) { (_mrMap[s.DonHangID] = _mrMap[s.DonHangID] || []).push(s.MaRap); }
  rows.forEach(o => { o.MaRap = [...new Set(_mrMap[o.DonHangID] || [])].join(', '); });
  res.json({ success: true, data: rows });
});

// ============ CHI TIET 1 DON (bao gom chi tiet vai) ============
// v4.0: bo sung slCatTheoMau (SL luy ke moi nhat tai cong doan "Cắt" theo TUNG mau - dung hien thi
// o form "Ghi nhan tien do" cong doan "Kho nhập") va theKho (nhan don vi + ty le quy doi lay tu
// TheKhoHangHoa da lien ket voi don hang nay, mac dinh Cái/Ri/1 neu chua co The kho).
router.get('/orders/:maDH', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'orders'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const chiTietVai = await getChiTietVaiNested(pool, order.DonHangID);

  // v5.9: tra cuu StageID cong doan "Cắt" theo MA on dinh (MaCongDoan='CAT', xem migration_v59.sql)
  // thay vi TEN hien thi - doi ten "Cắt" trong Danh muc tu sau khi nang cap nay se khong con lam gian
  // doan bao cao SL cat/nhap kho (getStageActualQty... ben duoi van nhan StageID nhu cu, chi doi cach TRA
  // CUU ra StageID o day).
  const catStageResult = await pool.request().query("SELECT TOP 1 StageID FROM CongDoanSanXuat WHERE MaCongDoan=N'CAT'");
  const catStageId = catStageResult.recordset.length ? catStageResult.recordset[0].StageID : null;
  const slCatTheoMau = await getStageActualQtyByColor(pool, order.DonHangID, catStageId);
  const slCatTong = Object.values(slCatTheoMau).reduce((s, v) => s + (Number(v) || 0), 0);
  // v5.2: tong so dong "ban cat" (cay vai) cua lan ghi tien do Cat gan nhat - hien tham khao o cong doan May.
  const slCatSoBan = await getStageBanCount(pool, order.DonHangID, catStageId);
  /* v6.12: + TỔNG số bàn cắt của CẢ ĐƠN (mọi lần cắt, mọi sơ đồ) để công đoạn May hiện "6/7" — biết ngay
     số đang tính là của mấy bàn trên tổng bao nhiêu bàn đã cắt. slCatSoBan ở trên chỉ đếm trong LẦN CẮT
     đang được tính (nhóm NhomTienDoID gần nhất), nên đơn cắt nhiều đợt thì 2 số này khác nhau. */
  const slCatSoBanTatCa = catStageId ? Number((await pool.request()
    .input('id', sql.Int, order.DonHangID).input('st', sql.Int, catStageId).query(`
      SELECT COUNT(*) AS c FROM TienDoSanXuat td
      WHERE td.DonHangID=@id AND td.StageID=@st
        AND EXISTS (SELECT 1 FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = td.TienDoID)`)).recordset[0].c) || 0 : 0;
  // v5.27.1 (Option 4): danh sach mau cho May/Kho nhap lay tu ket qua Cat (khong tu Cau truc vai - mau
  // o Ra lenh SX gio go tu do chi tham khao). Rong khi chua ghi tien do Cat (dung logic: chua cat thi
  // chua co mau de nhap SL May/Kho theo mau).
  const catMauList = await getCatMauList(pool, order.DonHangID, catStageId);

  const theKhoResult = await pool.request().input('id', sql.Int, order.DonHangID)
    .query('SELECT TOP 1 DonViCoBan, DonViQuyDoi, LoaiRi FROM TheKhoHangHoa WHERE DonHangID=@id');
  const theKho = theKhoResult.recordset[0] || { DonViCoBan: 'Cái', DonViQuyDoi: 'Ri', LoaiRi: 1 };

  const chiTietPhuKien = await getChiTietPhuKien(pool, order.DonHangID);
  // v5.18 (muc 1.2.2/1.2.3): doi nguon du lieu tu GiaoVaiSanXuat ("giao tam") sang Phieu xuat kho vai
  // THAT (PhieuXuatVaiChiTiet) - xem getVaiCayDaXuatChoDon(). Giu nguyen ten field "giaoVai" tra ve o
  // res.json ben duoi de tuong thich voi frontend hien co (module.qlsx.js: detail.giaoVai/giaoVaiList).
  const giaoVai = await getVaiCayDaXuatChoDon(pool, order.DonHangID);
  // v5.2: danh sach cong doan may da gan rieng cho don hang nay (xem GET/PUT /orders/:maDH/congdoanmay)
  const congDoanMayDon = await getCongDoanMayDonHang(pool, order.DonHangID);
  // v5.6: mau chinh nao DA co tien do phu thuoc - dung o form Sua lenh san xuat de khoa/canh bao truoc
  // khi xoa mau do khoi cau truc vai (xem PUT /orders/:maDH).
  const mauSacsWithProgress = await getMauSacsWithProgress(pool, order.DonHangID);
  // v5.13: bo sung soDoList (DonHangChiTietSoDo) + nhaGiaCongChiTiet (DonHangChiTietNhaGiaCong) - tai
  // du lieu ngay tu dau (giong giaoVai/chiTietPhuKien o tren) de openProgressForm/openEditOrderForm
  // khong can goi API rieng luc mo form; sau khi them/xoa dong, frontend tu goi lai 2 endpoint rieng
  // (GET /orders/:maDH/sodo, /nhagiacongchitiet) de lam tuoi CHI danh sach do, khong phai tai lai ca form.
  const soDoList = await getSoDoList(pool, order.DonHangID);
  const nhaGiaCongChiTiet = await getNhaGiaCongChiTiet(pool, order.DonHangID);

  res.json({ success: true, data: { ...order, chiTietVai, slCatTheoMau, slCatTong, slCatSoBan, slCatSoBanTatCa, catMauList, theKho, chiTietPhuKien, giaoVai, congDoanMayDon, mauSacsWithProgress, soDoList, nhaGiaCongChiTiet } });
});

// v5.0: chi tiet vai LONG NHAU - moi dong "Chính" mang theo mang "phoi" cua chinh no (loc theo
// MauChinhLienKetID) - dung cho form "Ra lenh san xuat" (sua/xem lai) va phieu in "Lenh san xuat".
async function getChiTietVaiNested(pool, donHangId) {
  const result = await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT ct.*, lv.TenLoaiVai, ms.TenMau FROM DonHangChiTietVai ct
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = ct.LoaiVaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
    WHERE ct.DonHangID = @id
    ORDER BY ct.ID`);
  const rows = result.recordset;
  const chinhRows = rows.filter(r => r.Kieu !== 'Phối' || !r.MauChinhLienKetID);
  return chinhRows.map(c => ({ ...c, phoi: rows.filter(p => p.MauChinhLienKetID === c.ID) }));
}

// v5.6: tra ve danh sach MauSacID (mau CHINH) cua don hang nay DA co tien do ghi nhan phu thuoc -
// hoac da duoc "Giao vai" (GiaoVaiSanXuat, qua VaiCay/DanhMucVai), hoac da co SL luy ke o Cat/May/...
// (TienDoChiTietMau). Dung de CHAN sua/xoa mau chinh nay khoi cau truc vai o form Sua lenh san xuat
// (yeu cau v5.6 "sua lenh sx sua ca phan chon vai") - tranh lech du lieu doi chieu theo mau da dung.
async function getMauSacsWithProgress(pool, donHangId) {
  const result = await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT DISTINCT dv.MauSacID AS MauSacID
    FROM GiaoVaiSanXuat gv
    JOIN VaiCay vc ON vc.CayID = gv.CayID
    JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
    WHERE gv.DonHangID = @id
    UNION
    -- v5.18 (muc 1.2.2): "Giao vai" (GiaoVaiSanXuat) khong con duoc ghi moi nua - bo sung nguon THAT
    -- (Phieu xuat kho vai) de mau da duoc xuat kho THAT cho don hang van bi khoa/canh bao dung nhu
    -- truoc, khong chi phu thuoc vao TienDoChiTietMau (tien do Cat...) o nhanh duoi.
    SELECT DISTINCT dv.MauSacID AS MauSacID
    FROM PhieuXuatVaiChiTiet ct
    JOIN PhieuXuatVai px ON px.PhieuXuatID = ct.PhieuXuatID
    JOIN VaiCay vc ON vc.CayID = ct.CayID
    JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
    WHERE px.DonHangID = @id
    UNION
    SELECT DISTINCT tc.MauSacID AS MauSacID
    FROM TienDoChiTietMau tc
    JOIN TienDoSanXuat td ON td.TienDoID = tc.TienDoID
    WHERE td.DonHangID = @id`);
  return result.recordset.map(r => r.MauSacID);
}

async function getChiTietPhuKien(pool, donHangId, ten) {
  const rq = pool.request().input('id', sql.Int, donHangId);
  let where = 'ct.DonHangID = @id';
  if (ten != null) { rq.input('ten', sql.NVarChar, String(ten)); where += " AND ISNULL(ct.TenPhieu, N'') = @ten"; }   // v5.54: lọc theo BẢN
  // v5.88: + ảnh phụ kiện -> bảng "Đã chỉ định" và bản in Chỉ định NPL đều có cột Ảnh.
  const coAnhPK = await coCotQLSX(pool, 'DanhMucPhuKien', 'AnhDaiDien');
  const result = await rq.query(`
    SELECT ct.*, dm.MaPhuKien, dm.TenPhuKien, dm.DonViCoBan AS DonViGoc,
      ${coAnhPK ? 'dm.AnhDaiDien' : "CAST(NULL AS NVARCHAR(500)) AS AnhDaiDien"}
    FROM DonHangChiTietPhuKien ct
    JOIN DanhMucPhuKien dm ON dm.PhuKienID = ct.PhuKienID
    WHERE ${where} ORDER BY ct.ID`);
  return result.recordset;
}

// Danh sach cay vai da "giao tam" cho don hang (chua tru The kho vai - xem GiaoVaiSanXuat).
// v5.18 (muc 1.2.2): KHONG con duoc goi tu GET /orders/:maDH nua (xem getVaiCayDaXuatChoDon() ben
// duoi) - GIU LAI ham nay + route GET/POST/DELETE /orders/:maDH/giaovai CHI de khong pha vo du lieu
// lich su (GiaoVaiSanXuat cua cac don da qua giai doan nay truoc khi nang cap) - khong con duong nao
// trong UI moi ghi them du lieu vao bang nay nua.
async function getGiaoVaiSanXuat(pool, donHangId) {
  const result = await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT gv.*, vc.MaCay, vc.KGNhap, dv.MaVai, lv.TenLoaiVai, ms.TenMau
    FROM GiaoVaiSanXuat gv
    JOIN VaiCay vc ON vc.CayID = gv.CayID
    JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
    WHERE gv.DonHangID = @id ORDER BY gv.ID`);
  return result.recordset;
}

// v5.18 (muc 1.2.2/1.2.3): THAY THE getGiaoVaiSanXuat() lam nguon du lieu cho GET /orders/:maDH (van
// tra ve qua field ten "giaoVai" de khong phai doi frontend detail.giaoVai/giaoVaiList o nhieu noi) -
// liet ke cay vai đã THUC SU duoc xuat kho vai cho don hang nay qua Phieu xuat kho vai (PhieuXuatVai
// co DonHangID, PhieuXuatVaiChiTiet.KGXuat) - THAY vi ban ghi "giao tam" GiaoVaiSanXuat (buoc "Giao
// vai" da bi bo khoi Ghi nhan tien do - xem tinhNextStage()). Giu dung TEN cot dau ra (KGGiao/NgayGiao/
// MaCay/KGNhap/MaVai/TenLoaiVai/TenMau) nhu ham cu de renderStageFields('CAT')/catCayRowHtml o
// module.qlsx.js dung tiep duoc voi it thay doi nhat.
async function getVaiCayDaXuatChoDon(pool, donHangId) {
  const result = await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT ct.ID, px.DonHangID, ct.CayID, ct.KGXuat AS KGGiao, px.NgayXuat AS NgayGiao,
           px.GhiChu, px.NguoiTaoID, px.CreatedAt, px.PhieuXuatID, px.MaDon,
           vc.MaCay, vc.KGNhap, dv.MaVai, lv.TenLoaiVai, ms.TenMau
    FROM PhieuXuatVaiChiTiet ct
    JOIN PhieuXuatVai px ON px.PhieuXuatID = ct.PhieuXuatID
    JOIN VaiCay vc ON vc.CayID = ct.CayID
    JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
    WHERE px.DonHangID = @id
    ORDER BY px.NgayXuat, ct.ID`);
  return result.recordset;
}

// v5.13: danh sach "so do" (Met so do/Kho vai so do/Ma rap/Ghi chu) cua 1 don hang - THAY THE bo gia
// tri DUY NHAT truoc day nam thang tren TienDoSanXuat (MetSoDoDai/KhoVaiSoDo/MaRap, van giu nguyen
// cot cu de KHONG mat du lieu lich su cac lan Ghi tien do Ky thuat TRUOC nang cap) bang 1 danh sach
// NHIEU dong o CAP DON HANG (DonHangChiTietSoDo, xem migration_v513.sql) - dung CHUNG mo hinh voi
// Giao vai/Phu kien: danh sach rieng, them/xoa qua nut "Luu" rieng, doc lap voi lan "Gui" chinh cua
// Ghi tien do. Cong doan Cat doc lai danh sach nay de cho chon "So do nao" (neu > 1 dong) - xem
// POST /orders/:maDH/tiendo va renderStageFields('CAT') trong module.qlsx.js.
async function getSoDoList(pool, donHangId) {
  const result = await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT * FROM DonHangChiTietSoDo WHERE DonHangID = @id ORDER BY ID`);
  return result.recordset;
}

// v5.13: danh sach nha gia cong CHI TIET (nhieu dong + ghi chu) cho cong doan Ky thuat - BO SUNG cho
// o chon don-nha-gia-cong hien co (DonHangSanXuat.NhaGiaCongID, qua searchableSelectHtml('ktNhaGiaCong')
// trong renderStageFields('KT')) - o do VAN LA nguon DUY NHAT quyet dinh co bo qua cong doan May hay
// khong (xem tinhNextStage() dau file nay) va hien o Dashboard/bao cao vendor, KHONG doi thanh nhieu
// gia tri duoc vi se pha vo logic dieu huong 1-doi-1 dang phu thuoc vao no. Danh sach nay chi de GHI
// NHAN/THEO DOI (vd don hang thuc te co lam viec voi nhieu xuong gia cong khac nhau cho cac phan
// khac nhau) - xem migration_v513.sql.
// v5.24 (bo TongDaGiao/TongDaNhan them tu v5.22): theo yeu cau nguoi dung "Trong nhận nhà gia công
// không hiện tổng đã nhận" - ham nay dung chung cho CA form 'GC' (Ghi nhan tien do, ghi duoc, xem
// PUT/POST /orders/:maDH/nhagiacongchitiet o tren) LAN man hinh XEM "Nhận nhà gia công" moi (chi doc) -
// ca 2 noi gio deu CHI hien dung nha gia cong + SoLuong CO DINH da gan, khong con tong hop giao/nhan
// tu bang ledger nao nua (GiaoNhaGiaCongChiTiet/NhanNhaGiaCongChiTiet da mo coi tu v5.24).
async function getNhaGiaCongChiTiet(pool, donHangId) {
  // v5.30: kem TenHangMuc + don gia CHUNG cua hang muc (DonHangHangMucGiaCong.DonGia, chi xem) - don gia
  // khong con nhap rieng tung nha nua. SoLuongNhan tra ve qua ct.* (cot moi migration_v530).
  const result = await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT ct.*, ncc.TenNha, hm.TenHangMuc, dhg.DonGia AS DonGiaHangMuc
    FROM DonHangChiTietNhaGiaCong ct
    JOIN NhaGiaCong ncc ON ncc.NhaGiaCongID = ct.NhaGiaCongID
    LEFT JOIN HangMucGiaCong hm ON hm.HangMucGiaCongID = ct.HangMucGiaCongID
    -- v5.56: nhiều bản đơn giá gia công → TOP 1 (bản đầu tiên), tránh nhân dòng giao nhà gia công.
    OUTER APPLY (SELECT TOP 1 x.DonGia FROM DonHangHangMucGiaCong x
                 WHERE x.HangMucGiaCongID = ct.HangMucGiaCongID AND x.DonHangID = ct.DonHangID
                 ORDER BY ISNULL(x.TenPhieu, N''), x.ID) dhg
    WHERE ct.DonHangID = @id ORDER BY ct.ID`);
  return result.recordset;
}

// v5.2: dem so dong "cay/ban cat" (TienDoCatChiTietCay) cua lan ghi tien do MOI NHAT tai cong doan
// Cat - dung hien thi "Tong so ban cat" o cong doan May (tham khao, theo yeu cau v5.2 muc 6).
// v5.16 (muc 2.2.2, yeu cau "Số lượng tổng bàn cắt cộng tất cả ở các sơ đồ có vải chính vào"): 2 thay
// doi - (1) neu ban ghi MOI NHAT co NhomTienDoID (nop tu 1 lan Gửi co >= 2 so do trong 1 don hang, xem
// POST /orders/:maDH/tiendo + migration_v516.sql), dem GOM CA NHOM (moi ban ghi cung NhomTienDoID),
// khong chi rieng 1 ban ghi "moi nhat" nhu truoc (khi khong co nhom, NhomTienDoID rong -> hanh vi CU
// khong doi, chi 1 ban ghi duy nhat); (2) CHI dem cay co mau (qua VaiCay->DanhMucVai->MauSacID+LoaiVaiID)
// trung 1 dong "Chính" (Kieu <> 'Phối', cung quy uoc voi getChiTietVaiNested) trong DonHangChiTietVai cua
// don hang nay - cay thuoc mau PHOI van duoc luu binh thuong, chi khong tinh vao "bàn cắt" nay.
// v5.35: "Tổng số bàn cắt" = so BAN (so do) trong lan Cat gan nhat = so ban ghi TienDoSanXuat CO cay cat
// trong batch (moi lan "Gửi" 1 so do -> 1 ban ghi = 1 ban). TRUOC dem COUNT(*) cay -> SAI (2 ban x 2 cay
// hien 4). NAY COUNT(DISTINCT TienDoID) -> dung (2). (Doi ten tu getStageCayCount.)
// v5.48: tập bản ghi TienDoSanXuat "hiệu lực" để tổng hợp.
//  - Công đoạn CẮT: CỘNG DỒN theo từng SƠ ĐỒ — lấy bản ghi MỚI NHẤT của mỗi SoDoID (cắt lại 1 sơ đồ thì
//    lấy lần mới nhất; thêm sơ đồ mới thì cộng thêm). Bản ghi không gắn sơ đồ (SoDoID NULL) giữ tất cả.
//    Nhờ vậy cắt BỔ SUNG nhiều đợt (vải về từng phần) vẫn tính đúng tổng, không chỉ theo lần Gửi cuối.
//  - Công đoạn KHÁC (May/Kho nhập...): GIỮ NGUYÊN "batch gần nhất" (SoLuongLuyKe là luỹ kế, không cộng dồn).
async function effectiveTienDoIds(pool, donHangId, stageId) {
  if (!stageId) return [];
  const catId = await getCatStageId(pool);
  if (Number(stageId) === Number(catId)) {
    const r = await pool.request().input('id', sql.Int, donHangId).input('stage', sql.Int, stageId).query(`
      SELECT t.TienDoID FROM TienDoSanXuat t
      WHERE t.DonHangID=@id AND t.StageID=@stage
        AND (t.SoDoID IS NULL
             OR t.TienDoID = (SELECT MAX(t2.TienDoID) FROM TienDoSanXuat t2
                              WHERE t2.DonHangID=t.DonHangID AND t2.StageID=t.StageID AND t2.SoDoID=t.SoDoID))`);
    return r.recordset.map(x => x.TienDoID);
  }
  const latest = await pool.request().input('id', sql.Int, donHangId).input('stage', sql.Int, stageId)
    .query('SELECT TOP 1 TienDoID, NhomTienDoID FROM TienDoSanXuat WHERE DonHangID=@id AND StageID=@stage ORDER BY TienDoID DESC');
  if (!latest.recordset.length) return [];
  const batchTag = latest.recordset[0].NhomTienDoID || latest.recordset[0].TienDoID;
  const r = await pool.request().input('b', sql.Int, batchTag)
    .query('SELECT TienDoID FROM TienDoSanXuat WHERE TienDoID=@b OR NhomTienDoID=@b');
  return r.recordset.map(x => x.TienDoID);
}
async function getStageBanCount(pool, donHangId, stageId) {
  const ids = await effectiveTienDoIds(pool, donHangId, stageId);
  if (!ids.length) return 0;
  const cnt = await pool.request()
    .query(`SELECT COUNT(DISTINCT td.TienDoID) AS Cnt
            FROM TienDoSanXuat td
            WHERE td.TienDoID IN (${ids.join(',')})
              AND EXISTS (SELECT 1 FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = td.TienDoID)`);
  return Number(cnt.recordset[0].Cnt) || 0;
}

// v5.27.1 (Option 4): danh sach MAU cho theo doi tien do May/Kho nhap - lay tu KET QUA CAT (cay vai da
// cat, TienDoChiTietMau.MauSacID that tu DanhMucVai) chu KHONG tu DonHangChiTietVai (mau o Ra lenh SX gio
// go tu do, chi tham khao). Nho vay TienDoChiTietMau.MauSacID luon co gia tri THAT (NOT NULL, khong loi),
// va mau o Ra lenh SX hoan toan tach roi khoi cac cong doan sau. Moi phan tu: {MauSacID, TenMau, SoLuong-cat}.
async function getCatMauList(pool, donHangId, stageId) {
  const ids = await effectiveTienDoIds(pool, donHangId, stageId);
  if (!ids.length) return [];
  const result = await pool.request().input('id', sql.Int, donHangId)
    .query(`SELECT ct.MauSacID, ms.TenMau, SUM(ct.SoLuongLuyKe) AS SoLuong
            FROM TienDoChiTietMau ct
            LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
            WHERE ct.TienDoID IN (${ids.join(',')})
              /* ================================================================================
                 CHI MAU CHINH - dung DUNG nguon cua Bang ke ban thanh pham (routes/bangke.js).
                 Nguoi dung xac nhan cach BTP loc la dung, nen hai cho phai cung mot luat; hai luat
                 khac nhau thi "Tong SL ban cat" va bang ke BTP ra hai con so, khong ai doi chieu noi.

                 NGUON CHAC CHAN = KieuVai cua DONG PHIEU XUAT KHO VAI, va phai la phieu xuat cua
                 CHINH don nay. Cau truc vai KHONG dung lam nguon chinh: tu v6.43 mau o Ra lenh SX go
                 tu do (MauSacID = NULL) nen khong khop duoc.

                 Lich su: v5.36 loc theo danh sach mau Chinh -> trang bang khi thieu MauSacID.
                 v6.12 dao thanh loai tru mau Phoi theo MauSacID -> nhung dong Phoi cung NULL nen
                 khong loai duoc gi, mau phoi van bi cong (dung loi dang sua).

                 LUOI AN TOAN: don nao CHUA co phieu xuat kho vai nao khai KieuVai thi GIU NGUYEN moi
                 mau. Khong co luoi nay thi hang cap vai khong qua phieu xuat se ra SL = 0 - dung kieu
                 hong cua v5.36.

                 KHONG so khop mau theo TEN. Da can nhac va bo o bangke.js v6.60.1: noi mo theo chu,
                 trung ten la loai nham mau chinh ma khong ai biet.
                 KHONG go dau backtick trong khoi nay - no nam trong chuoi template JS, mot dau
                 backtick la dut chuoi va sap ca file (su co v6.61).
                 ================================================================================ */
              AND (
                NOT EXISTS (SELECT 1 FROM PhieuXuatVai p0
                            JOIN PhieuXuatVaiChiTiet px0 ON px0.PhieuXuatID = p0.PhieuXuatID
                            WHERE p0.DonHangID = @id AND px0.KieuVai IS NOT NULL)
                OR EXISTS (
                  SELECT 1
                  FROM TienDoCatChiTietCay cc
                  JOIN TienDoSanXuat td2 ON td2.TienDoID = cc.TienDoID
                  JOIN VaiCay vc ON vc.CayID = cc.CayID
                  JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
                  WHERE td2.DonHangID = @id AND dv.MauSacID = ct.MauSacID
                    AND EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px
                                JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
                                WHERE px.CayID = cc.CayID AND px.KieuVai = N'Chính'
                                  AND p.DonHangID = @id))
              )
              /* Lop chan phu, y nhu bangke.js: gat mau duoc khai RO la Phoi trong Cau truc vai. */
              AND NOT EXISTS (SELECT 1 FROM DonHangChiTietVai cv
                              WHERE cv.DonHangID = @id AND cv.Kieu = N'Phối'
                                AND cv.MauSacID IS NOT NULL AND cv.MauSacID = ct.MauSacID)
            GROUP BY ct.MauSacID, ms.TenMau
            ORDER BY ms.TenMau`);
  return result.recordset.map(r => ({ MauSacID: r.MauSacID, TenMau: r.TenMau || '', SoLuong: Number(r.SoLuong) || 0 }));
}

// v5.30: tong SL (mau chinh) tu ket qua Cat gan nhat = tong SoLuong tung mau (dung chung getCatMauList).
// Dung hien o Giao/Nhan nha in theu ("chi hien tong so luong mau chinh tu tat ca so do cat cua lenh SX").
let __catStageIdCache = null;
async function getCatStageId(pool) {
  if (__catStageIdCache != null) return __catStageIdCache;
  const r = await pool.request().query("SELECT StageID FROM CongDoanSanXuat WHERE MaCongDoan = 'CAT'");
  __catStageIdCache = r.recordset.length ? r.recordset[0].StageID : 0;
  return __catStageIdCache;
}
async function getTongSLCatForOrder(pool, donHangId) {
  const stageId = await getCatStageId(pool);
  if (!stageId) return 0;
  const list = await getCatMauList(pool, donHangId, stageId);
  return list.reduce((s, r) => s + (Number(r.SoLuong) || 0), 0);
}

// v5.2: danh sach cong doan may DA GAN cho don hang nay (chon o cong doan "Ky thuat"), kem don gia/he
// so RIENG cua don hang (bang DonHangCongDoanMay) - dung loc dropdown "Cong doan may" o khoi giao viec
// noi bo cong doan May (chi hien cac cong doan da duoc gan cho don hang, khong hien full danh muc).
async function getCongDoanMayDonHang(pool, donHangId) {
  const result = await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT dhg.CongDoanMayID, cd.TenCongDoan, cd.MaCongDoan, dhg.DonGia, dhg.HeSo
    FROM DonHangCongDoanMay dhg
    JOIN CongDoanMay cd ON cd.CongDoanMayID = dhg.CongDoanMayID
    WHERE dhg.DonHangID = @id ORDER BY cd.TenCongDoan`);
  return result.recordset;
}

/* v5.87 — GHI 1 DÒNG CÂY VẢI CỦA CÔNG ĐOẠN CẮT (dùng chung cho cả 2 nhánh: đơn 1 sơ đồ và đơn nhiều
   sơ đồ — trước đây 2 chỗ copy y hệt nhau, sửa 1 chỗ quên chỗ kia).
   Kèm ẢNH CHỤP CÂY VẢI (AnhCay, migration_v660): chỉ lưu ĐƯỜNG DẪN /uploads/... như mọi ảnh khác.
   Dò cột nên chưa chạy migration thì phần còn lại vẫn ghi bình thường, chỉ mất ảnh. */
const __cotQLSX = new Map();
async function coCotQLSX(pool, bang, cot) {
  const key = bang + '.' + cot;
  if (__cotQLSX.has(key)) return __cotQLSX.get(key);
  const r = (await pool.request().query(`SELECT COL_LENGTH('${bang}','${cot}') AS c`)).recordset[0] || {};
  __cotQLSX.set(key, r.c != null);
  return r.c != null;
}
/* v6.01: GIẬT CẤP — số CÁI cắt giật cấp của từng cây. KHÔNG cộng vào số lớp, chỉ cộng vào TỔNG SL cái
   của bàn cắt (xem soCaiGiatCapCua() + 3 chỗ tính TienDoChiTietMau bên dưới). Cột SoLuongCai tính sẵn
   (= lớp × hệ số) GIỮ NGUYÊN — phần giật cấp được cộng ở tầng code, không sửa cột tính sẵn. */
function soCaiGiatCapCua(c) {
  const n = Number(c && c.soCaiGiatCap);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}
/* v6.08 — HỆ SỐ QUY ĐỔI SỬA ĐƯỢC TỪNG CÂY ở công đoạn Cắt.
   v5.13 đã bỏ ô nhập hệ số từng dòng và ép dùng DonHangSanXuat.HeSoQuyDoi; nay mở lại theo yêu cầu.
   Bảng TienDoCatChiTietCay vốn đã có cột HeSoQuyDoi riêng cho từng cây (và SoLuongCai là cột tính sẵn
   = SoLuongLop * HeSoQuyDoi) nên KHÔNG phải đổi CSDL — chỉ cần thôi ghi đè bằng hệ số của đơn.
   Client gửi số > 0 thì dùng; bỏ trống / ≤ 0 / không phải số -> vẫn lấy hệ số của ĐƠN (máy chủ là chốt
   chặn cuối, không bao giờ để hệ số = 0 làm SL cái thành 0). */
function heSoCuaDong(c, heSoDonHang) {
  const n = Number(c && c.heSoQuyDoi);
  return Number.isFinite(n) && n > 0 ? n : heSoDonHang;
}
async function ghiChiTietCayCat(pool, tienDoId, c, soLuongLop, heSo) {
  const coAnh = await coCotQLSX(pool, 'TienDoCatChiTietCay', 'AnhCay');
  const coGiatCap = await coCotQLSX(pool, 'TienDoCatChiTietCay', 'SoCaiGiatCap');   // v6.01
  const rq = pool.request()
    .input('TienDoID', sql.Int, tienDoId)
    .input('CayID', sql.Int, c.cayId)
    .input('SttCay', sql.NVarChar, c.sttCay || null)
    .input('SoLuongLop', sql.Int, soLuongLop)
    .input('HeSoQuyDoi', sql.Decimal(10, 3), heSo)
    .input('SoKgMetSuDung', sql.Decimal(10, 2), c.kgMetSuDung || null);
  if (coAnh) rq.input('AnhCay', sql.NVarChar, c.anhCay || null);
  if (coGiatCap) rq.input('SoCaiGiatCap', sql.Int, soCaiGiatCapCua(c) || null);
  await rq.query(`INSERT INTO TienDoCatChiTietCay (TienDoID, CayID, SttCay, SoLuongLop, HeSoQuyDoi, SoKgMetSuDung${coAnh ? ', AnhCay' : ''}${coGiatCap ? ', SoCaiGiatCap' : ''})
                  VALUES (@TienDoID, @CayID, @SttCay, @SoLuongLop, @HeSoQuyDoi, @SoKgMetSuDung${coAnh ? ', @AnhCay' : ''}${coGiatCap ? ', @SoCaiGiatCap' : ''})`);
}

async function getOrderByMaDH(pool, maDH) {
  // v5.6: bo sung join lay TenNhaIn (thieu tu truoc - chi co TenNhaGiaCong) - dung cho phieu bao cao
  // (in phieu: hien ten nha gia cong/nha in trong bang lich su, yeu cau v5.6).
  // v5.8: bo sung LaNoiBoNhaGiaCong (tu NhaGiaCong.LaNoiBo, xem migration_v58.sql) - dung o tinhNextStage()
  // ben tren VA o frontend (module.qlsx.js isNhaLam()/showGiaoViec o cong doan May) thay cho so sanh
  // chuoi TenNhaGiaCong === 'Nhà Làm'.
  // v5.9: bo sung c.MaCongDoan (thay dung o frontend statusWithStage() de quyet dinh hien ten nha gia
  // cong canh trang thai khi don dang o dung cong doan "May", thay so sanh truoc day theo TenCongDoan).
  // v5.21 (muc 1/2): bo sung join DanhMucDonViQuyDoi (qua DonHangSanXuat.DonViQuyDoiID, xem
  // migration_v521.sql) - lay TenDonViQuyDoi/PhepTinhQuyDoi de frontend dinh dang dong "Tong cong" cua
  // Cau truc vai dung theo dong danh muc da chon (fmtQuyDoi() trong common.js), thay vi hardcode 'Ri'/Chia.
  const result = await pool.request().input('MaDH', sql.NVarChar, maDH).query(`
    SELECT d.*,
           ISNULL(NULLIF(LTRIM(RTRIM(d.TenKhachHangTuDo)), ''), kh.TenKhachHang) AS TenKhachHang,   -- v6.43
           c.TenCongDoan, c.MaCongDoan, ncc1.TenNha AS TenNhaGiaCong, ncc1.LaNoiBo AS LaNoiBoNhaGiaCong, ncc2.TenNha AS TenNhaIn,
           dvqd.DonViQuyDoi AS TenDonViQuyDoi, dvqd.PhepTinh AS PhepTinhQuyDoi
    FROM DonHangSanXuat d
    LEFT JOIN KhachHang kh ON kh.KhachHangID = d.KhachHangID
    LEFT JOIN CongDoanSanXuat c ON c.StageID = d.CongDoanHienTaiID
    LEFT JOIN NhaGiaCong ncc1 ON ncc1.NhaGiaCongID = d.NhaGiaCongID
    LEFT JOIN NhaGiaCong ncc2 ON ncc2.NhaGiaCongID = d.NhaInID
    LEFT JOIN DanhMucDonViQuyDoi dvqd ON dvqd.ID = d.DonViQuyDoiID
    WHERE d.MaDH = @MaDH`);
  return result.recordset[0] || null;
}

// Lay SL luy ke thuc te cua 1 don hang tai 1 cong doan cu the (vd Cat, Kho nhap), dung cho bao cao nang suat.
// Lay ban ghi tien do MOI NHAT tai dung cong doan do, roi cong don SoLuongLuyKe qua tat ca mau trong ban ghi ay
// (vi moi lan "Ghi tien do" nguoi dung nhap lai SL luy ke cho tung mau cung luc, xem POST /orders/:maDH/tiendo).
// Luu y: doi chieu theo TEN cong doan ('Cắt', 'Kho nhập') - neu doi ten 2 cong doan nay trong Danh muc,
// bao cao se khong tinh duoc va tra ve 0, xem HUONG_DAN_CAI_DAT.md phan "Bao cao theo don hang".
// v5.21 (yeu cau "Tổng SL cắt... đang cộng sai. Đang chỉ lấy tổng của 1 bàn"): don hang co >= 2 so do
// (nop qua catGroups, xem POST /orders/:maDH/tiendo + migration_v516.sql) tao NHIEU ban ghi TienDoSanXuat
// CUNG mot lan "Gửi" - ban ghi MOI NHAT chi la 1 TRONG SO N ban ghi do (moi ban ghi = 1 "bàn cắt"/so do),
// khong phai toan bo. Truoc day ham nay CHI cong SoLuongLuyKe cua rieng ban ghi moi nhat (dung cho don
// 0/1 so do, SAI cho don >= 2 so do) - nay dong nhat CACH LAY voi getStageCayCount() (da dung dung tu
// v5.16): tim NhomTienDoID cua ban ghi moi nhat, coi ca nhom (TienDoID = batchTag HOAC NhomTienDoID =
// batchTag) la 1 lan ghi nhan DUY NHAT can cong don, thay vi chi rieng 1 ban ghi.
async function getStageActualQty(pool, donHangId, stageId) {
  const ids = await effectiveTienDoIds(pool, donHangId, stageId);
  if (!ids.length) return 0;
  const sumResult = await pool.request()
    .query(`SELECT ISNULL(SUM(ct.SoLuongLuyKe),0) AS Tong FROM TienDoChiTietMau ct
            WHERE ct.TienDoID IN (${ids.join(',')})`);
  return Number(sumResult.recordset[0].Tong) || 0;
}

// v4.0: giong getStageActualQty nhung tra ve theo TUNG mau (map MauSacID -> SoLuongLuyKe) thay vi cong
// don tat ca mau lai - dung cho form "Kho nhập" (hien thi "SL tong tu Cat" theo dung mau) va de tinh
// DELTA khi cap nhat The kho hang hoa (xem POST /orders/:maDH/tiendo).
// v5.21: cung sua bug gop nhom NhomTienDoID nhu getStageActualQty() o tren (cung ly do) - neu khong sua
// dong thoi, don >= 2 so do se hien SAI ca o "SL tong tu Cat theo mau" (form Kho nhap) LAN DELTA cong vao
// The kho hang hoa (chi tinh theo 1 bàn thay vi tat ca).
async function getStageActualQtyByColor(pool, donHangId, stageId) {
  const ids = await effectiveTienDoIds(pool, donHangId, stageId);
  if (!ids.length) return {};
  const result = await pool.request().input('id', sql.Int, donHangId)
    .query(`SELECT ct.MauSacID, SUM(ct.SoLuongLuyKe) AS SoLuongLuyKe FROM TienDoChiTietMau ct
            WHERE ct.TienDoID IN (${ids.join(',')})
              -- v5.36: chỉ màu CHÍNH (bỏ màu Phối) - v6.12: đổi IN(Chính) -> NOT IN(Phối), xem getCatMauList.
              AND ct.MauSacID NOT IN (SELECT MauSacID FROM DonHangChiTietVai
                                      WHERE DonHangID=@id AND Kieu = N'Phối' AND MauSacID IS NOT NULL)
            GROUP BY ct.MauSacID`);
  const map = {};
  result.recordset.forEach(r => { map[r.MauSacID] = Number(r.SoLuongLuyKe) || 0; });
  return map;
}

// Lich su cap vai cho 1 don hang (PhieuXuatVai co DonHangID gan voi don nay) - dung chung cho:
//  - GET /orders/:maDH/vaicap (xem rieng lich su)
//  - GET /orders/:maDH/print (hien thi khoi "Xuat vai" trong phieu bao cao, v4.0)
async function getVaiCapHistory(pool, donHangId) {
  const result = await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT px.PhieuXuatID, px.NgayXuat, px.GhiChu, vc.MaCay, dv.MaVai, lv.TenLoaiVai, ms.TenMau, ct.KGXuat
    FROM PhieuXuatVai px
    JOIN PhieuXuatVaiChiTiet ct ON ct.PhieuXuatID = px.PhieuXuatID
    JOIN VaiCay vc ON vc.CayID = ct.CayID
    JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
    WHERE px.DonHangID = @id
    ORDER BY px.NgayXuat DESC`);
  const tongKG = result.recordset.reduce((s, r) => s + (Number(r.KGXuat) || 0), 0);
  return { chiTiet: result.recordset, tongKG: Math.round(tongKG * 100) / 100 };
}

/* Ma don hang SX: DH + yy + mm + so thu tu.  VD DH2608015
   v6.22: SO THU TU CHAY SUOT CA NAM, KHONG reset dau moi thang (yeu cau nguoi dung).
     - Truoc: dem trong prefix 'DH'+yy+mm => sang thang lai ve 001 (DH2607014 -> DH2608001).
     - Nay:  dem trong prefix 'DH'+yy     => DH2607014 -> DH2608015.
   Van GIU nguyen dinh dang ma (co thang o giua) nen KHONG anh huong ma cu, khong can migration.
   Chi dem cac ma DUNG dinh dang DH+yy+mm+so (regex) - ma go tay kieu khac se bi bo qua thay vi
   parseInt lung tung ra so lon lam nhay so thu tu.
   Luu y: padStart(3) chi de dep so nho; qua 999 don/nam thi ra 1000, 1001... van dung thu tu. */
async function generateOrderId(pool) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefixNam = 'DH' + yy;
  const result = await pool.request().input('prefix', sql.NVarChar, prefixNam + '%')
    .query('SELECT MaDH FROM DonHangSanXuat WHERE MaDH LIKE @prefix');
  const nums = result.recordset.map(r => {
    const m = /^DH(\d{2})(\d{2})(\d+)$/.exec(String(r.MaDH || '').trim());
    return m && m[1] === yy ? parseInt(m[3], 10) || 0 : 0;
  });
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return prefixNam + mm + String(next).padStart(3, '0');
}

// ============ TAO DON HANG MOI ============
// Xac nhan phan quyen (yeu cau v4.0 muc 2): route nay gate boi requirePermission('QLSX','create') - theo seed
// hien tai chi nhom Admin/Kinh doanh co CanCreate=1 tren module QLSX, cac bo phan khac (Ky thuat/Cat/May/Kho...)
// chi co CanEdit=1 (chi cap nhat tien do, khong tao duoc don hang moi). Logic nay da dung, khong can sua.
// v5.0: "Ra lenh san xuat" - tach rieng khoi "Danh sach don hang", bo sung Ma SP/Size/Thiet ke/Ky
// thuat rap/Dong hinh in/Ghi chu lenh + cau truc vai chinh LONG mau phoi ben trong (moi dong trong
// chiTietVai la 1 mau CHINH kem mang "phoi" cua rieng no) + phu kien can dung (chi dinh NPL, chua tru kho).
// v5.27.1 (yeu cau): xem truoc Ma DH tu sinh NGAY tren form Ra lenh (chua luu). Chi la XEM TRUOC -
// backend van sinh lai ma that luc POST /orders (phong khi co don khac tao xen giua). KHONG ghi DB.
router.get('/next-madh', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'ralenh'), async (req, res) => {
  try { const pool = await getPool(); res.json({ success: true, data: { maDH: await generateOrderId(pool) } }); }
  catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

router.post('/orders', requireAuth, requirePermission('QLSX', 'create'), requireChucNang('QLSX', 'ralenh'), async (req, res) => {
  try {
    const {
      tenSanPham, maSanPham, size, khachHangId, ngayDat, ngayGiao, anhSanPham,
      thietKeVien, kyThuatRap, dongHinhIn, anhHinhIn, ghiChuLenh, chiTietVai, chiTietPhuKien,
      heSoQuyDoi,
      // v6.43: tên khách GÕ TỰ DO — chỉ khi tên đó KHÔNG có trong danh mục (frontend đã dò trước).
      // Không tạo bản ghi khách mới; tên chỉ sống trong chính lệnh SX này và các bản in của nó.
      tenKhachHangTuDo,
      // v5.21 (muc 1/2): dong "Danh mục đơn vị quy đổi" da chon (neu co, FK toi DanhMucDonViQuyDoi) -
      // xem migration_v521.sql + fmtQuyDoi() trong common.js.
      donViQuyDoiId,
      mac, phuLieu   // v5.42: Mác (tự do) + Phụ kiện (nhiều dòng, nối \n)
    } = req.body;
    if (!tenSanPham) {
      return res.status(400).json({ success: false, message: 'Thiếu tên sản phẩm.' });
    }
    const pool = await getPool();
    const maDH = await generateOrderId(pool);
    const firstStage = await pool.request().query('SELECT TOP 1 StageID FROM CongDoanSanXuat ORDER BY ThuTu');
    const stageId = firstStage.recordset.length ? firstStage.recordset[0].StageID : null;

    // v5.13 (muc 1.1.1): bo o nhap tay "Tong so luong" - tinh THANG tu tong SL cac dong mau CHINH khai
    // bao trong Cau truc vai (chiTietVai la mang mau CHINH, phoi nam long ben trong .phoi va KHONG co SL
    // rieng - xem v5.7 ghi chu o module.qlsx.js) thay vi tin theo 1 con so nguoi dung tu go rieng, de
    // tranh 2 con so lech nhau (tong go tay khac tong thuc te cua tung mau).
    const tongSoLuongComputed = Array.isArray(chiTietVai)
      ? chiTietVai.reduce((s, c) => s + (Number(c.soLuong) || 0), 0)
      : 0;

    const result = await pool.request()
      .input('MaDH', sql.NVarChar, maDH)
      .input('TenSanPham', sql.NVarChar, tenSanPham)
      .input('MaSanPham', sql.NVarChar, maSanPham || null)
      .input('Size', sql.NVarChar, size || null)
      .input('KhachHangID', sql.Int, khachHangId || null)
      .input('TenKhachHangTuDo', sql.NVarChar(200), (tenKhachHangTuDo || '').trim() || null)   // v6.43
      .input('NgayDat', sql.Date, ngayDat || null)
      .input('NgayGiaoDuKien', sql.Date, ngayGiao || null)
      .input('TongSoLuong', sql.Int, tongSoLuongComputed)
      .input('CongDoanHienTaiID', sql.Int, stageId)
      .input('AnhSanPham', sql.NVarChar, anhSanPham || null)
      .input('ThietKeVien', sql.NVarChar, thietKeVien || null)
      .input('KyThuatRap', sql.NVarChar, kyThuatRap || null)
      .input('DongHinhIn', sql.NVarChar, dongHinhIn || null)
      // v6.02: NHIỀU ảnh hình in — các đường dẫn nối bằng '\n' (quy ước như PhuLieu) ⇒ phải là NVARCHAR(MAX),
      // để mặc định driver có thể cắt bớt và MẤT ảnh lặng lẽ. Cột đã nới rộng ở migration_v663.sql.
      .input('AnhHinhIn', sql.NVarChar(sql.MAX), anhHinhIn || null)
      .input('GhiChuLenh', sql.NVarChar, ghiChuLenh || null)
      // v5.13 (muc 1.1.2): "He so quy doi" (Cai/Ri) khai bao 1 LAN o day, dung CHUNG cho cong doan Cat
      // (xem POST /orders/:maDH/tiendo) thay vi nhap lai o tung cay vai moi lan Ghi tien do.
      .input('HeSoQuyDoi', sql.Decimal(10, 3), Number(heSoQuyDoi) || 1)
      // v5.21 (muc 1/2): FK toi dong "Danh mục đơn vị quy đổi" da chon (chi dung de DINH DANG hien thi -
      // xem fmtQuyDoi()/getOrderByMaDH() - HeSoQuyDoi o tren VAN la con so THAT su dung cho Cat, khong doi).
      .input('DonViQuyDoiID', sql.Int, donViQuyDoiId || null)
      .input('CoInTheu', sql.Bit, req.body.coInTheu ? 1 : 0)   // v5.33
      .input('Mac', sql.NVarChar, mac || null)                  // v5.42
      .input('PhuLieu', sql.NVarChar(sql.MAX), phuLieu || null) // v5.42 (nhiều dòng phụ kiện, nối \n)
      .query(`INSERT INTO DonHangSanXuat
              (MaDH, TenSanPham, MaSanPham, Size, KhachHangID, TenKhachHangTuDo, NgayDat, NgayGiaoDuKien, TongSoLuong, CongDoanHienTaiID, AnhSanPham, ThietKeVien, KyThuatRap, DongHinhIn, AnhHinhIn, GhiChuLenh, HeSoQuyDoi, DonViQuyDoiID, CoInTheu, Mac, PhuLieu)
              OUTPUT INSERTED.DonHangID
              VALUES (@MaDH, @TenSanPham, @MaSanPham, @Size, @KhachHangID, @TenKhachHangTuDo, @NgayDat, @NgayGiaoDuKien, @TongSoLuong, @CongDoanHienTaiID, @AnhSanPham, @ThietKeVien, @KyThuatRap, @DongHinhIn, @AnhHinhIn, @GhiChuLenh, @HeSoQuyDoi, @DonViQuyDoiID, @CoInTheu, @Mac, @PhuLieu)`);
    const donHangId = result.recordset[0].DonHangID;

    if (Array.isArray(chiTietVai)) {
      for (const ct of chiTietVai) {
        const insChinh = await pool.request()
          .input('DonHangID', sql.Int, donHangId)
          .input('LoaiVaiID', sql.Int, ct.loaiVaiId || null)
          .input('Kieu', sql.NVarChar, 'Chính')
          .input('MauSacID', sql.Int, ct.mauSacId || null)
          .input('DonViTinh', sql.NVarChar, ct.donVi || null)
          .input('SoLuong', sql.Int, Number(ct.soLuong) || 0)
          .input('AnhMau', sql.NVarChar, ct.anhMau || null)
          .input('TenLoaiVaiTuDo', sql.NVarChar, ct.tenLoaiVaiTuDo || null)
          .input('TenMauTuDo', sql.NVarChar, ct.tenMauTuDo || null)
          .input('GhiChu', sql.NVarChar, ct.ghiChu || null)
          .query(`INSERT INTO DonHangChiTietVai (DonHangID, LoaiVaiID, Kieu, MauSacID, DonViTinh, SoLuong, AnhMau, TenLoaiVaiTuDo, TenMauTuDo, GhiChu)
                  OUTPUT INSERTED.ID
                  VALUES (@DonHangID, @LoaiVaiID, @Kieu, @MauSacID, @DonViTinh, @SoLuong, @AnhMau, @TenLoaiVaiTuDo, @TenMauTuDo, @GhiChu)`);
        const chinhId = insChinh.recordset[0].ID;

        if (Array.isArray(ct.phoi)) {
          for (const p of ct.phoi) {
            await pool.request()
              .input('DonHangID', sql.Int, donHangId)
              .input('LoaiVaiID', sql.Int, p.loaiVaiId || ct.loaiVaiId || null)
              .input('Kieu', sql.NVarChar, 'Phối')
              .input('MauSacID', sql.Int, p.mauSacId || null)
              .input('DonViTinh', sql.NVarChar, p.donVi || null)
              .input('SoLuong', sql.Int, Number(p.soLuong) || 0)
              .input('MauChinhLienKetID', sql.Int, chinhId)
              .input('TenLoaiVaiTuDo', sql.NVarChar, p.tenLoaiVaiTuDo || null)
              .input('TenMauTuDo', sql.NVarChar, p.tenMauTuDo || null)
              // v6.58: BỔ SUNG GhiChu — dòng Chính có ghi lại, dòng Phối thì quên, nên mỗi lần lưu
              // lệnh là ghi chú của mọi dòng vải phối bay sạch (cả bảng bị xóa rồi chèn lại).
              .input('GhiChu', sql.NVarChar, p.ghiChu || null)
              .query(`INSERT INTO DonHangChiTietVai (DonHangID, LoaiVaiID, Kieu, MauSacID, DonViTinh, SoLuong, MauChinhLienKetID, TenLoaiVaiTuDo, TenMauTuDo, GhiChu)
                      VALUES (@DonHangID, @LoaiVaiID, @Kieu, @MauSacID, @DonViTinh, @SoLuong, @MauChinhLienKetID, @TenLoaiVaiTuDo, @TenMauTuDo, @GhiChu)`);
          }
        }
      }
    }

    if (Array.isArray(chiTietPhuKien)) {
      for (const pk of chiTietPhuKien) {
        if (!pk.phuKienId) continue;
        await pool.request()
          .input('DonHangID', sql.Int, donHangId)
          .input('PhuKienID', sql.Int, pk.phuKienId)
          .input('SoLuong', sql.Decimal(14, 2), Number(pk.soLuong) || 0)
          .input('DonVi', sql.NVarChar, pk.donVi || null)
          .input('GhiChu', sql.NVarChar, pk.ghiChu || null)
          .query(`INSERT INTO DonHangChiTietPhuKien (DonHangID, PhuKienID, SoLuong, DonVi, GhiChu)
                  VALUES (@DonHangID, @PhuKienID, @SoLuong, @DonVi, @GhiChu)`);
      }
    }
    res.json({ success: true, data: { maDH, donHangId } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi tạo đơn hàng: ' + err.message });
  }
});

// ============ SUA / XOA LENH SAN XUAT (v5.2 - "Danh sach lenh san xuat", theo phan quyen) ============
// Chi sua cac truong THONG TIN CHUNG cua lenh - cau truc vai / phu kien chi dinh la du lieu goc luc
// tao lenh, KHONG sua o day (neu can dieu chinh vai/phu kien thuc te thi dung cong doan "Giao vai" /
// "Phu kien" trong Ghi tien do).
router.put('/orders/:maDH', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'orders'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const {
      tenSanPham, maSanPham, size, khachHangId, tenKhachHangTuDo, ngayDat, ngayGiao,   // v6.43: + tên khách gõ tự do
      thietKeVien, kyThuatRap, dongHinhIn, anhHinhIn, ghiChuLenh,
      // v5.6: chiTietVai nay la TUY CHON - chi gui khi nguoi dung THUC SU sua cau truc vai o form Sua
      // lenh san xuat (yeu cau v5.6 "sua lenh sx sua ca phan chon vai"). Khong gui (undefined) = giu
      // nguyen cau truc vai cu, tuong thich nguoc 100% voi cac ban truoc.
      chiTietVai,
      // v5.13 (muc 1.1.2): "He so quy doi" gio sua duoc ngay tai day (form Sua lenh san xuat luon gui
      // truong nay, xem module.qlsx.js).
      heSoQuyDoi,
      // v5.21 (muc 1/2): dong "Danh mục đơn vị quy đổi" da chon (neu co) - xem ghi chu tai POST /orders.
      donViQuyDoiId,
      mac, phuLieu,   // v5.42: Mác + Phụ kiện (form Sửa luôn gửi)
      anhSanPham   // v5.42: sửa ảnh sản phẩm ở form Sửa (gửi lại URL cũ nếu không đổi)
    } = req.body;
    if (!tenSanPham) {
      return res.status(400).json({ success: false, message: 'Thiếu tên sản phẩm.' });
    }
    // v5.13 (muc 1.1.1): bo o nhap tay "Tong so luong" - neu chiTietVai co gui kem (form Sua LUON gui,
    // xem ghi chu tren) thi tinh lai TongSoLuong tu tong SL cac dong mau CHINH; neu khong gui (goi tu
    // noi khac trong tuong lai, vd 1 API rieng chi sua thong tin chung) thi GIU NGUYEN gia tri cu qua
    // ISNULL, khong vo tinh ghi de ve 0.
    const tongSoLuongComputed = Array.isArray(chiTietVai)
      ? chiTietVai.reduce((s, c) => s + (Number(c.soLuong) || 0), 0)
      : null;

    // Chan xoa 1 mau CHINH da co tien do ghi nhan phu thuoc (Giao vai/Cat/May...) - xem getMauSacsWithProgress.
    // Van cho phep: them mau moi, sua SL/anh/don vi cua mau da co, sua tu do toan bo phoi (khong theo doi
    // tien do rieng theo mau phoi).
    /* v6.49: BO CHAN (yeu cau: "khong rang buoc du dang o cong doan nao"). Truoc day chan cung o day
       va khoa o nhap ben frontend.
       CAI GIA PHAI BIET: tien do da ghi (TienDoChiTietMau, so cat, luong khoan may) van tro toi
       MauSacID vua bi go khoi cau truc vai -> cac bang doi chieu theo mau se con dong "mo coi": so
       lieu KHONG mat, nhung khong con dong cau truc vai tuong ung de doi chieu. Van GHI LOG lai de
       con lan ra khi so lieu lech. */
    if (Array.isArray(chiTietVai)) {
      const protectedMauSacs = await getMauSacsWithProgress(pool, order.DonHangID);
      if (protectedMauSacs.length) {
        const submittedMauSacs = new Set(chiTietVai.map(c => String(c.mauSacId)));
        const missing = protectedMauSacs.filter(m => !submittedMauSacs.has(String(m)));
        if (missing.length) {
          console.warn(`[qlsx PUT /orders/${order.MaDH}] Da XOA khoi cau truc vai cac mau DA CO TIEN DO: ${missing.join(', ')} (nguoi sua: ${req.session.user.userId}). Tien do cua cac mau nay tro thanh mo coi.`);
        }
      }
    }

    await pool.request()
      .input('id', sql.Int, order.DonHangID)
      .input('TenSanPham', sql.NVarChar, tenSanPham)
      .input('MaSanPham', sql.NVarChar, maSanPham || null)
      .input('Size', sql.NVarChar, size || null)
      .input('KhachHangID', sql.Int, khachHangId || null)
      .input('TenKhachHangTuDo', sql.NVarChar(200), (tenKhachHangTuDo || '').trim() || null)   // v6.43
      .input('NgayDat', sql.Date, ngayDat || null)
      .input('NgayGiaoDuKien', sql.Date, ngayGiao || null)
      .input('TongSoLuong', sql.Int, tongSoLuongComputed)
      .input('ThietKeVien', sql.NVarChar, thietKeVien || null)
      .input('KyThuatRap', sql.NVarChar, kyThuatRap || null)
      .input('DongHinhIn', sql.NVarChar, dongHinhIn || null)
      // v6.02: NHIỀU ảnh hình in — các đường dẫn nối bằng '\n' (quy ước như PhuLieu) ⇒ phải là NVARCHAR(MAX),
      // để mặc định driver có thể cắt bớt và MẤT ảnh lặng lẽ. Cột đã nới rộng ở migration_v663.sql.
      .input('AnhHinhIn', sql.NVarChar(sql.MAX), anhHinhIn || null)
      .input('GhiChuLenh', sql.NVarChar, ghiChuLenh || null)
      .input('HeSoQuyDoi', sql.Decimal(10, 3), Number(heSoQuyDoi) || 1)
      .input('DonViQuyDoiID', sql.Int, donViQuyDoiId || null)
      .input('CoInTheu', sql.Bit, req.body.coInTheu ? 1 : 0)   // v5.33
      .input('Mac', sql.NVarChar, mac || null)                  // v5.42
      .input('PhuLieu', sql.NVarChar(sql.MAX), phuLieu || null) // v5.42
      .input('AnhSanPham', sql.NVarChar, anhSanPham || null)    // v5.42
      .query(`UPDATE DonHangSanXuat SET TenSanPham=@TenSanPham, MaSanPham=@MaSanPham, Size=@Size, KhachHangID=@KhachHangID, TenKhachHangTuDo=@TenKhachHangTuDo,
              NgayDat=@NgayDat, NgayGiaoDuKien=@NgayGiaoDuKien, TongSoLuong=ISNULL(@TongSoLuong, TongSoLuong), ThietKeVien=@ThietKeVien,
              KyThuatRap=@KyThuatRap, DongHinhIn=@DongHinhIn, AnhHinhIn=@AnhHinhIn, GhiChuLenh=@GhiChuLenh, HeSoQuyDoi=@HeSoQuyDoi,
              DonViQuyDoiID=@DonViQuyDoiID, CoInTheu=@CoInTheu, Mac=@Mac, PhuLieu=@PhuLieu, AnhSanPham=ISNULL(@AnhSanPham, AnhSanPham), UpdatedAt=SYSDATETIME()
              WHERE DonHangID=@id`);

    // v5.6: thay toan bo cau truc vai cu bang bo moi (da qua kiem tra an toan o tren) - dung LAI dung
    // logic INSERT nhu luc tao lenh (POST /orders) de nhat quan.
    if (Array.isArray(chiTietVai)) {
      await pool.request().input('id', sql.Int, order.DonHangID).query('DELETE FROM DonHangChiTietVai WHERE DonHangID=@id');
      for (const ct of chiTietVai) {
        const insChinh = await pool.request()
          .input('DonHangID', sql.Int, order.DonHangID)
          .input('LoaiVaiID', sql.Int, ct.loaiVaiId || null)
          .input('Kieu', sql.NVarChar, 'Chính')
          .input('MauSacID', sql.Int, ct.mauSacId || null)
          .input('DonViTinh', sql.NVarChar, ct.donVi || null)
          .input('SoLuong', sql.Int, Number(ct.soLuong) || 0)
          .input('AnhMau', sql.NVarChar, ct.anhMau || null)
          .input('TenLoaiVaiTuDo', sql.NVarChar, ct.tenLoaiVaiTuDo || null)
          .input('TenMauTuDo', sql.NVarChar, ct.tenMauTuDo || null)
          .input('GhiChu', sql.NVarChar, ct.ghiChu || null)
          .query(`INSERT INTO DonHangChiTietVai (DonHangID, LoaiVaiID, Kieu, MauSacID, DonViTinh, SoLuong, AnhMau, TenLoaiVaiTuDo, TenMauTuDo, GhiChu)
                  OUTPUT INSERTED.ID
                  VALUES (@DonHangID, @LoaiVaiID, @Kieu, @MauSacID, @DonViTinh, @SoLuong, @AnhMau, @TenLoaiVaiTuDo, @TenMauTuDo, @GhiChu)`);
        const chinhId = insChinh.recordset[0].ID;

        if (Array.isArray(ct.phoi)) {
          for (const p of ct.phoi) {
            await pool.request()
              .input('DonHangID', sql.Int, order.DonHangID)
              .input('LoaiVaiID', sql.Int, p.loaiVaiId || ct.loaiVaiId || null)
              .input('Kieu', sql.NVarChar, 'Phối')
              .input('MauSacID', sql.Int, p.mauSacId || null)
              .input('DonViTinh', sql.NVarChar, p.donVi || null)
              .input('SoLuong', sql.Int, Number(p.soLuong) || 0)
              .input('MauChinhLienKetID', sql.Int, chinhId)
              .input('TenLoaiVaiTuDo', sql.NVarChar, p.tenLoaiVaiTuDo || null)
              .input('TenMauTuDo', sql.NVarChar, p.tenMauTuDo || null)
              // v6.58: BỔ SUNG GhiChu — dòng Chính có ghi lại, dòng Phối thì quên, nên mỗi lần lưu
              // lệnh là ghi chú của mọi dòng vải phối bay sạch (cả bảng bị xóa rồi chèn lại).
              .input('GhiChu', sql.NVarChar, p.ghiChu || null)
              .query(`INSERT INTO DonHangChiTietVai (DonHangID, LoaiVaiID, Kieu, MauSacID, DonViTinh, SoLuong, MauChinhLienKetID, TenLoaiVaiTuDo, TenMauTuDo, GhiChu)
                      VALUES (@DonHangID, @LoaiVaiID, @Kieu, @MauSacID, @DonViTinh, @SoLuong, @MauChinhLienKetID, @TenLoaiVaiTuDo, @TenMauTuDo, @GhiChu)`);
          }
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi cập nhật lệnh sản xuất: ' + err.message });
  }
});

router.delete('/orders/:maDH', requireAuth, requirePermission('QLSX', 'delete'), requireChucNang('QLSX', 'orders'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    await pool.request().input('id', sql.Int, order.DonHangID).query('DELETE FROM DonHangSanXuat WHERE DonHangID=@id');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Không thể xóa (lệnh đã có Thẻ kho hàng hóa, xuất vải hoặc dữ liệu liên kết khác).' });
  }
});

// ============ IN PHIEU "LENH SAN XUAT" (theo mau file Chi dinh san xuat) ============
router.get('/orders/:maDH/lenh', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'orders'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const chiTietVai = await getChiTietVaiNested(pool, order.DonHangID);
  const chiTietPhuKien = await getChiTietPhuKien(pool, order.DonHangID);
  const soDoList = await getSoDoList(pool, order.DonHangID);   // v5.52
  const MaRap = [...new Set(soDoList.map(s => s.MaRap).filter(Boolean))].join(', ');
  res.json({ success: true, data: { ...order, chiTietVai, chiTietPhuKien, soDoList, MaRap } });
});

// ============ GIAO / NHAN NHA GIA CONG & NHA IN ============
// v5.20 (muc 3): da XOA POST /orders/:maDH/vendor (backend cua modal openVendorForm da bi xoa o frontend
// - xem ghi chu tai module.qlsx.js). v5.24: NhaGiaCongID/DonGiaGiaCongNgoai tren DonHangSanXuat KHONG
// con duoc ghi o dau ca (mo coi, xem ghi chu dau file) - viec chon nha gia cong gio HOAN TOAN qua
// DonHangChiTietNhaGiaCong (nhieu dong, + SoLuong moi) nhap truc tiep tai cong doan 'GC', luu qua nut
// instant-save "Lưu nhà gia công" (POST /orders/:maDH/nhagiacongchitiet, xem duoi).
// v5.21 (muc 8): NhaInID/NgayGiaoIn/NgayNhanIn (nha in/theu) KHONG con ghi qua Ghi nhan tien do nua (xem
// ghi chu dau file) - chuyen sang 2 route DOC LAP duoi day, mirror dung mo hinh chuc nang con cua
// v5.14/v5.19 (tab rieng trong QLSX, KHONG phai 1 cong doan trong CongDoanSanXuat).
// v5.22 (muc 1.1): Giao/Nhan nha gia cong (NgayGiaoGC/NgayNhanGC) CUNG khong con ghi qua Ghi nhan tien
// do nua cung ly do (xem ghi chu dau file). v5.24: "Giao nha gia cong" (tab rieng v5.19-v5.22) da bi XOA
// HAN - viec giao nha gia cong gio CHI con qua cong doan 'GC' (khoi NHA GIA CONG CHI TIET o duoi); "Nhan
// nha gia cong" con lai la 1 tab XEM don gian (khoi NHAN NHA GIA CONG, cuoi file nay).
// "Giao nha in theu": chon 1 nha in/theu (dropdown LoaiHinh='InTheu') + ngay giao - CHO PHEP giao lai/doi
// nha bat ky luc nao (khong khoa sau khi da giao, khac voi nha gia cong o cho khong co "chi tiet" nhieu
// nha). "Nhan nha in theu": CHI hien don DA duoc giao (NhaInID IS NOT NULL) - chi ghi ngay nhan, KHONG can
// nhap so luong (dung y "Phân này không cần nhập số lượng" cua yeu cau).
router.get('/giaonhaintheu', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'giaonhaintheu'), async (req, res) => {
  const pool = await getPool();
  const rows = (await pool.request().query(`
    SELECT d.DonHangID, d.MaDH, d.TenSanPham, d.NhaInID, ncc.TenNha AS TenNhaIn, d.NgayGiaoIn, d.NgayNhanIn
    FROM DonHangSanXuat d
    LEFT JOIN NhaGiaCong ncc ON ncc.NhaGiaCongID = d.NhaInID
    ORDER BY d.DonHangID DESC`)).recordset;
  for (const r of rows) r.TongSLCat = await getTongSLCatForOrder(pool, r.DonHangID);   // v5.30
  res.json({ success: true, data: rows });
});

router.post('/orders/:maDH/giaonhaintheu', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'giaonhaintheu'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const { nhaInId, ngayGiaoIn } = req.body;
    if (!nhaInId) return res.status(400).json({ success: false, message: 'Thiếu nhà in/thêu.' });
    await pool.request()
      .input('id', sql.Int, order.DonHangID)
      .input('nin', sql.Int, nhaInId)
      .input('ngay', sql.Date, ngayGiaoIn || new Date())
      .query('UPDATE DonHangSanXuat SET NhaInID=@nin, NgayGiaoIn=@ngay, UpdatedAt=SYSDATETIME() WHERE DonHangID=@id');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu: ' + err.message });
  }
});

router.get('/nhannhaintheu', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'nhannhaintheu'), async (req, res) => {
  const pool = await getPool();
  const rows = (await pool.request().query(`
    SELECT d.DonHangID, d.MaDH, d.TenSanPham, d.NhaInID, ncc.TenNha AS TenNhaIn, d.NgayGiaoIn, d.NgayNhanIn
    FROM DonHangSanXuat d
    JOIN NhaGiaCong ncc ON ncc.NhaGiaCongID = d.NhaInID
    WHERE d.NhaInID IS NOT NULL
    ORDER BY d.DonHangID DESC`)).recordset;
  for (const r of rows) r.TongSLCat = await getTongSLCatForOrder(pool, r.DonHangID);   // v5.30
  res.json({ success: true, data: rows });
});

router.post('/orders/:maDH/nhannhaintheu', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'nhannhaintheu'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    if (!order.NhaInID) return res.status(400).json({ success: false, message: 'Đơn hàng chưa được giao cho nhà in/thêu nào — vào "Giao nhà in thêu" trước.' });
    const { ngayNhanIn } = req.body;
    await pool.request()
      .input('id', sql.Int, order.DonHangID)
      .input('ngay', sql.Date, ngayNhanIn || new Date())
      .query('UPDATE DonHangSanXuat SET NgayNhanIn=@ngay, UpdatedAt=SYSDATETIME() WHERE DonHangID=@id');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu: ' + err.message });
  }
});

// ============ IN THEU v5.32: nhieu nha in theu/don + SL giao + SL nhan, 2 cong doan GIT (Giao) / NIT (Nhan) ============
// Thay cho 2 tab "Giao/Nhan nha in theu" cu (da bo o frontend). Bang DonHangNhaInTheu (migration_v532).
/* v6.01: mỗi dòng giao in thêu ghi thêm HẠNG MỤC IN THÊU — chọn trong danh sách hạng mục đã khai ở
   "Đơn giá in thêu" (Tài liệu kỹ thuật) của ĐÚNG đơn đó. Lưu dạng CHỮ (tên hạng mục) chứ không lưu
   khóa ngoại, vì màn Đơn giá in thêu khi Lưu là xóa hết dòng của bản rồi chèn lại (ID đổi mỗi lần sửa).
   Bảng lương gia công in thêu đọc cột này để lấy đơn giá của ĐÚNG hạng mục (xem payroll.js loadInThe). */
async function getInTheList(pool, donHangId) {
  const coHM = await coCotQLSX(pool, 'DonHangNhaInTheu', 'HangMucInThe');
  const r = await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT it.ID, it.NhaInID, it.SoLuongGiao, it.SoLuongNhan, it.GhiChu, ncc.TenNha,
           ${coHM ? 'it.HangMucInThe' : "CAST(NULL AS NVARCHAR(200)) AS HangMucInThe"}
    FROM DonHangNhaInTheu it JOIN NhaGiaCong ncc ON ncc.NhaGiaCongID = it.NhaInID
    WHERE it.DonHangID = @id ORDER BY it.ID`);
  return r.recordset;
}
// v6.01: danh sách hạng mục in/thêu của đơn (tên + đơn giá) để form Giao in thêu có ô chọn.
// Nhiều BẢN đơn giá (TenPhieu) -> gộp theo TÊN hạng mục, đơn giá lấy của bản ĐẦU TIÊN (cùng quy ước
// với payroll: ORDER BY ISNULL(TenPhieu,''), ID) — xem [[project_qlnoibo_v554_multiban]].
async function getHangMucInTheList(pool, donHangId) {
  // ROW_NUMBER theo ID (không phải MIN(DonGia)) để đơn giá hiện ở ô chọn TRÙNG với đơn giá bảng lương lấy
  // (payroll.js: TOP 1 ... ORDER BY ISNULL(TenPhieu,N''), ID) — hiện 1 giá khác giá tính lương là gây nhầm.
  const r = await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT x.Ten, x.DonGia FROM (
      SELECT g.Ten, g.DonGia, ROW_NUMBER() OVER (PARTITION BY g.Ten ORDER BY g.ID) AS rn
      FROM DonHangDonGiaInThe g
      WHERE g.DonHangID = @id AND LTRIM(RTRIM(ISNULL(g.Ten, N''))) <> N''
        AND ISNULL(g.TenPhieu, N'') = (SELECT MIN(ISNULL(y.TenPhieu, N'')) FROM DonHangDonGiaInThe y WHERE y.DonHangID = @id)
    ) x WHERE x.rn = 1 ORDER BY x.Ten`);
  return r.recordset.map(x => ({ Ten: x.Ten, DonGia: x.DonGia == null ? null : Number(x.DonGia) }));
}
router.get('/orders/:maDH/inthe', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  res.json({
    success: true,
    data: {
      rows: await getInTheList(pool, order.DonHangID),
      hangMucs: await getHangMucInTheList(pool, order.DonHangID),   // v6.01
      tongSLCat: await getTongSLCatForOrder(pool, order.DonHangID)
    }
  });
});
router.post('/orders/:maDH/inthe', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const rows = Array.isArray(req.body.rows) ? req.body.rows.filter(r => r.nhaInId) : [];
    const coHM = await coCotQLSX(pool, 'DonHangNhaInTheu', 'HangMucInThe');   // v6.01
    for (const r of rows) {
      const rq = pool.request()
        .input('DonHangID', sql.Int, order.DonHangID)
        .input('NhaInID', sql.Int, r.nhaInId)
        .input('SoLuongGiao', sql.Int, r.soLuongGiao || null)
        .input('GhiChu', sql.NVarChar, r.ghiChu || null);
      if (coHM) rq.input('HangMucInThe', sql.NVarChar(200), (r.hangMucInThe || '').trim() || null);
      await rq.query(`INSERT INTO DonHangNhaInTheu (DonHangID, NhaInID, SoLuongGiao, GhiChu${coHM ? ', HangMucInThe' : ''})
                      VALUES (@DonHangID, @NhaInID, @SoLuongGiao, @GhiChu${coHM ? ', @HangMucInThe' : ''})`);
    }
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi lưu nhà in thêu: ' + err.message }); }
});
router.put('/orders/:maDH/inthe/:id/nhan', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    await pool.request().input('id', sql.Int, req.params.id).input('donHangId', sql.Int, order.DonHangID).input('SoLuongNhan', sql.Int, req.body.soLuongNhan || null)
      .query('UPDATE DonHangNhaInTheu SET SoLuongNhan=@SoLuongNhan WHERE ID=@id AND DonHangID=@donHangId');
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi lưu số lượng nhận: ' + err.message }); }
});
/* v6.01: sửa HẠNG MỤC IN THÊU của 1 dòng ĐÃ GIAO — cần thiết vì các dòng giao từ trước v6.01 chưa có
   hạng mục, mà bảng lương lại đọc cột này; không có route này thì phải xóa dòng rồi giao lại. */
router.put('/orders/:maDH/inthe/:id/hangmuc', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    if (!(await coCotQLSX(pool, 'DonHangNhaInTheu', 'HangMucInThe')))
      return res.status(400).json({ success: false, message: 'Chưa chạy migration_v662.sql — chưa có cột Hạng mục in thêu.' });
    await pool.request().input('id', sql.Int, req.params.id).input('donHangId', sql.Int, order.DonHangID)
      .input('hm', sql.NVarChar(200), (req.body.hangMucInThe || '').trim() || null)
      .query('UPDATE DonHangNhaInTheu SET HangMucInThe=@hm WHERE ID=@id AND DonHangID=@donHangId');
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi lưu hạng mục in thêu: ' + err.message }); }
});
router.delete('/orders/:maDH/inthe/:id', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    await pool.request().input('id', sql.Int, req.params.id).input('donHangId', sql.Int, order.DonHangID)
      .query('DELETE FROM DonHangNhaInTheu WHERE ID=@id AND DonHangID=@donHangId');
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi xóa: ' + err.message }); }
});

// ============ SO DO (Ky thuat, v5.13 muc 1.2.1.1/1.2.2.1) ============
// Danh sach NHIEU so do (Met so do/Kho vai so do/Ma rap/Ghi chu) cho 1 don hang - dung CHUNG mo hinh
// voi Giao vai/Phu kien: danh sach rieng cua don hang, them/xoa qua nut "Luu"/"Xoa" luu NGAY (khong
// doi lan "Gui" chinh cua Ghi tien do). Cong doan Cat doc lai danh sach nay de cho chon "So do nao"
// dang cat (chi hien o chon khi > 1 dong - xem module.qlsx.js), ghi vao TienDoSanXuat.SoDoID.
router.get('/orders/:maDH/sodo', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  res.json({ success: true, data: await getSoDoList(pool, order.DonHangID) });
});

router.post('/orders/:maDH/sodo', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ success: false, message: 'Thiếu dữ liệu sơ đồ.' });
    for (const r of rows) {
      await pool.request()
        .input('DonHangID', sql.Int, order.DonHangID)
        .input('MetSoDoDai', sql.Decimal(10, 2), r.metSoDoDai || null)
        .input('KhoVaiSoDo', sql.Decimal(10, 2), r.khoVaiSoDo || null)
        .input('MaRap', sql.NVarChar, r.maRap || null)
        .input('GhiChu', sql.NVarChar, r.ghiChu || null)
        .query(`INSERT INTO DonHangChiTietSoDo (DonHangID, MetSoDoDai, KhoVaiSoDo, MaRap, GhiChu)
                VALUES (@DonHangID, @MetSoDoDai, @KhoVaiSoDo, @MaRap, @GhiChu)`);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu sơ đồ: ' + err.message });
  }
});

router.delete('/orders/:maDH/sodo/:id', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    await pool.request().input('id', sql.Int, req.params.id).input('donHangId', sql.Int, order.DonHangID)
      .query('DELETE FROM DonHangChiTietSoDo WHERE ID=@id AND DonHangID=@donHangId');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Không thể xóa (có thể đã có lần Ghi tiến độ Cắt dùng sơ đồ này).' });
  }
});

// ============ NHA GIA CONG CHI TIET (Ky thuat -> chuyen sang cong doan 'GC' tu v5.23, v5.13 muc 1.2.1.2) ============
// Day la co che DUY NHAT con lai de gan nha gia cong cho don hang (thay the han "Nha gia cong (dai
// dien)" DonHangSanXuat.NhaGiaCongID - cot nay MO COI tu v5.24, xem ghi chu dau file). Nhap truc tiep
// tai cong doan 'GC' trong Ghi nhan tien do qua nut instant-save "Luu nha gia cong" - moi dong la 1 nha
// gia cong duoc giao cho don, voi DonGia + SoLuong (moi, v5.24) rieng, dung tinh luong sau nay.
// v5.24: 4 route nay (GET/POST/PUT/DELETE) tung la NOI DUNG CHUNG cho 2 man hinh - form 'GC' (Ghi nhan
// tien do) VA tab XEM rieng "Nhận nhà gia công" (ChucNang 'nhannhagiacong'). v5.26: tab XEM rieng do da
// bi XOA HAN (xem khoi "NHAN NHA GIA CONG" cu, da xoa, phia duoi) - 4 route nay tu nay CHI con phuc vu
// form 'GC'. Van KHONG gate requireChucNang rieng (chi quyen module QLSX view/edit co ban) - giu nguyen
// cho don gian, khong anh huong gi.
router.get('/orders/:maDH/nhagiacongchitiet', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  res.json({ success: true, data: await getNhaGiaCongChiTiet(pool, order.DonHangID) });
});

router.post('/orders/:maDH/nhagiacongchitiet', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ success: false, message: 'Thiếu dữ liệu nhà gia công.' });
    for (const r of rows) {
      if (!r.nhaGiaCongId) continue;
      await pool.request()
        .input('DonHangID', sql.Int, order.DonHangID)
        .input('NhaGiaCongID', sql.Int, r.nhaGiaCongId)
        // v5.30: moi dong nha gia cong thuoc 1 HANG MUC gia cong (don gia dung chung cua hang muc - lay
        // tu Ky thuat, chi xem). Cot DonGia cu giu lai (mo coi), ghi null. SoLuong nhap tung nha.
        .input('HangMucGiaCongID', sql.Int, r.hangMucGiaCongId || null)
        .input('GhiChu', sql.NVarChar, r.ghiChu || null)
        .input('DonGia', sql.Decimal(14, 2), r.donGia || null)
        .input('SoLuong', sql.Int, r.soLuong || null)
        .query(`INSERT INTO DonHangChiTietNhaGiaCong (DonHangID, NhaGiaCongID, HangMucGiaCongID, GhiChu, DonGia, SoLuong) VALUES (@DonHangID, @NhaGiaCongID, @HangMucGiaCongID, @GhiChu, @DonGia, @SoLuong)`);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu danh sách nhà gia công: ' + err.message });
  }
});

router.delete('/orders/:maDH/nhagiacongchitiet/:id', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    await pool.request().input('id', sql.Int, req.params.id).input('donHangId', sql.Int, order.DonHangID)
      .query('DELETE FROM DonHangChiTietNhaGiaCong WHERE ID=@id AND DonHangID=@donHangId');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi xóa: ' + err.message });
  }
});

// v5.16 (muc 2.1.3, yeu cau "Đã ghi nhận: có thể sửa được"): truoc day danh sach nay chi Them/Xoa -
// bo sung PUT de sua 1 dong DA ghi nhan (doi nha gia cong va/hoac ghi chu) ma khong can xoa roi them lai.
router.put('/orders/:maDH/nhagiacongchitiet/:id', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const { nhaGiaCongId, ghiChu, donGia, soLuong, hangMucGiaCongId } = req.body;
    if (!nhaGiaCongId) return res.status(400).json({ success: false, message: 'Thiếu nhà gia công.' });
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('donHangId', sql.Int, order.DonHangID)
      .input('NhaGiaCongID', sql.Int, nhaGiaCongId)
      .input('HangMucGiaCongID', sql.Int, hangMucGiaCongId || null)   // v5.30
      .input('GhiChu', sql.NVarChar, ghiChu || null)
      .input('DonGia', sql.Decimal(14, 2), donGia || null)
      .input('SoLuong', sql.Int, soLuong || null)
      .query('UPDATE DonHangChiTietNhaGiaCong SET NhaGiaCongID=@NhaGiaCongID, HangMucGiaCongID=@HangMucGiaCongID, GhiChu=@GhiChu, DonGia=@DonGia, SoLuong=@SoLuong WHERE ID=@id AND DonHangID=@donHangId');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi cập nhật: ' + err.message });
  }
});

// v5.30: cong doan "Nhan gia cong" (NGC) - CHI cap nhat SO LUONG NHAN cho 1 dong nha gia cong da giao
// (khong doi nha/hang muc/SL giao). Nhap tai cong doan NGC, luu ngay qua nut "💾 Lưu số lượng nhận".
router.put('/orders/:maDH/nhagiacongchitiet/:id/nhan', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('donHangId', sql.Int, order.DonHangID)
      .input('SoLuongNhan', sql.Int, req.body.soLuongNhan || null)
      .query('UPDATE DonHangChiTietNhaGiaCong SET SoLuongNhan=@SoLuongNhan WHERE ID=@id AND DonHangID=@donHangId');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu số lượng nhận: ' + err.message });
  }
});

// v5.26 (phan hoi truc tiep qua AskUserQuestion: "bỏ hẳn 'Giao nhà gia công'/'Nhận nhà gia công'"): khoi
// route "NHAN NHA GIA CONG" (GET /nhannhagiacong/orders, phuc vu tab XEM rieng "Nhận nhà gia công" cua
// v5.24/v5.25) da bi XOA HAN - tab do khong con nua (xem module.qlsx.js). Nghiep vu nay tu nay CHI con o
// cong doan 'GC' (nhap, xem khoi NHA GIA CONG CHI TIET phia tren) + bao cao "Lịch sử cập nhật tiến độ"
// khi in lenh san xuat (xem khoi tiem log gan cuoi file nay). ChucNang 'nhannhagiacong' (seed tu
// migration_v519.sql) MO COI - giu nguyen lam checkbox phan quyen "chet", giong 'giaonhagiacong' da mo
// coi tu v5.24 (dung quy uoc chung, xem HUONG_DAN_CAI_DAT.md).

// ============ CHI DINH VAI SX (v5.47.1: BANG RIENG, doc lap Ra lenh SX) ============
// Nguoi dung CHON Loai vai + Mau TU DANH MUC (co ID) + ro Chinh/Phoi + KG yeu cau -> bang ChiDinhVaiSX.
// KHONG lien quan cau truc vai (go tu do) cua Ra lenh SX. La nguon KHOA xuat kho vai (xem khovai.js).
// v5.47.2: Loai vai/Mau GO TU DO — neu chua co trong danh muc thi TU TAO (mot so vai chua co, chi dinh
// xong moi di mua). Sau nay nhap cay vai voi dung Loai vai/Mau nay -> gate xuat kho khop duoc.
function slugMaMauQ(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 26) || 'MAU';
}
async function resolveLoaiVaiId(pool, name) {
  const t = (name || '').trim(); if (!t) return null;
  const f = (await pool.request().input('t', sql.NVarChar, t).query('SELECT LoaiVaiID FROM LoaiVai WHERE TenLoaiVai=@t')).recordset[0];
  if (f) return f.LoaiVaiID;
  const ins = await pool.request().input('t', sql.NVarChar, t).query('INSERT INTO LoaiVai (TenLoaiVai) OUTPUT INSERTED.LoaiVaiID VALUES (@t)');
  return ins.recordset[0].LoaiVaiID;
}
async function resolveMauSacIdQ(pool, name) {
  const t = (name || '').trim(); if (!t) return null;
  const f = (await pool.request().input('t', sql.NVarChar, t).query('SELECT MauSacID FROM MauSac WHERE TenMau=@t')).recordset[0];
  if (f) return f.MauSacID;
  let base = slugMaMauQ(t), code = base, i = 1;
  while ((await pool.request().input('m', sql.NVarChar, code).query('SELECT 1 AS x FROM MauSac WHERE MaMau=@m')).recordset[0]) { i++; code = (base + i).slice(0, 30); }
  const ins = await pool.request().input('m', sql.NVarChar, code).input('t', sql.NVarChar, t)
    .query('INSERT INTO MauSac (MaMau, TenMau) OUTPUT INSERTED.MauSacID VALUES (@m, @t)');
  return ins.recordset[0].MauSacID;
}
router.get('/chidinhvaisx', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'chidinhvaisx'), async (req, res) => {
  const pool = await getPool();
  /* v5.70: thêm TÌNH TRẠNG XUẤT KHO để ngay tại màn Chỉ định vải SX biết đơn nào đã xuất vải.
       SoPhieuXuat    - số phiếu xuất kho vải đã lập cho đơn (0 = chưa xuất gì)
       TongKGChiDinh  - tổng SL chỉ định của TẤT CẢ các bản (nhiều bản có tên -> cộng hết)
       TongKGDaXuat   - tổng KG đã xuất thực tế theo các phiếu xuất của đơn
     Frontend so 2 số này để hiện Chưa xuất / Xuất một phần / Đã xuất kho. */
  const rows = (await pool.request().query(`
    SELECT d.DonHangID, d.MaDH, d.TenSanPham,
      CASE WHEN EXISTS (SELECT 1 FROM ChiDinhVaiSX v WHERE v.DonHangID=d.DonHangID) THEN 1 ELSE 0 END AS DaChiDinh,
      (SELECT COUNT(*) FROM PhieuXuatVai p WHERE p.DonHangID = d.DonHangID) AS SoPhieuXuat,
      ISNULL((SELECT SUM(v.SoKGYeuCau) FROM ChiDinhVaiSX v WHERE v.DonHangID = d.DonHangID), 0) AS TongKGChiDinh,
      ISNULL((SELECT SUM(ct.KGXuat) FROM PhieuXuatVaiChiTiet ct
              JOIN PhieuXuatVai p ON p.PhieuXuatID = ct.PhieuXuatID
              WHERE p.DonHangID = d.DonHangID), 0) AS TongKGDaXuat
    FROM DonHangSanXuat d ORDER BY d.DonHangID DESC`)).recordset;
  res.json({ success: true, data: rows });
});
// v5.54: danh sách các BẢN chỉ định (nhóm theo TenPhieu) của 1 đơn.
/* ==================================================================================================
   v5.96 — SỬA / THÊM CÂY VÀO MỘT SỔ CẮT ĐÃ GHI
   Nhu cầu thật ở xưởng: bàn cắt làm dở, hôm sau cắt tiếp CÙNG sổ cắt đó — trước đây phải ghi tiến độ
   mới (thành 2 sổ) hoặc không sửa được STT/số lớp đã ghi.
   Cách làm: ghi đè toàn bộ danh sách cây của ĐÚNG 1 bản ghi tiến độ (xóa hết rồi ghi lại), sau đó
   TÍNH LẠI tổng SL cái theo màu của bản ghi đó (TienDoChiTietMau) — đây là số liệu mà "Kho nhập" và
   các báo cáo năng suất đọc, nên KHÔNG được bỏ bước này, nếu không sổ cắt và SL cắt sẽ lệch nhau.
   Chỉ cho sửa bản ghi thuộc ĐÚNG đơn hàng và ĐÚNG công đoạn Cắt.
   ================================================================================================== */
router.put('/orders/:maDH/socat/:tienDoId', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const td = (await pool.request().input('id', sql.Int, req.params.tienDoId).query(`
      SELECT td.TienDoID, td.DonHangID, c.MaCongDoan FROM TienDoSanXuat td
      JOIN CongDoanSanXuat c ON c.StageID = td.StageID WHERE td.TienDoID=@id`)).recordset[0];
    if (!td || td.DonHangID !== order.DonHangID) return res.status(404).json({ success: false, message: 'Không tìm thấy sổ cắt của đơn hàng này.' });
    if (td.MaCongDoan !== 'CAT') return res.status(400).json({ success: false, message: 'Bản ghi này không phải công đoạn Cắt.' });

    const chiTietCay = Array.isArray(req.body.chiTietCay) ? req.body.chiTietCay : [];
    const hopLe = chiTietCay.filter(c => c.cayId && Number(c.soLuongLop) > 0);
    if (!hopLe.length) return res.status(400).json({ success: false, message: 'Sổ cắt phải có ít nhất 1 cây vải với số lớp > 0.' });

    const tienDoId = Number(req.params.tienDoId);
    const heSoDonHang = Number(order.HeSoQuyDoi) || 1;

    // 1) Ghi lại danh sách cây (xóa hết dòng cũ rồi ghi mới — kiểm tra hợp lệ ở trên nên không sợ rỗng).
    await pool.request().input('id', sql.Int, tienDoId).query('DELETE FROM TienDoCatChiTietCay WHERE TienDoID=@id');
    const mauTongHop = {};
    for (const c of hopLe) {
      const soLuongLop = Number(c.soLuongLop) || 0;
      const cayInfo = await pool.request().input('id', sql.Int, c.cayId)
        .query('SELECT dv.MauSacID FROM VaiCay vc JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID WHERE vc.CayID=@id');
      const mauSacId = cayInfo.recordset.length ? cayInfo.recordset[0].MauSacID : null;
      const heSoDong = heSoCuaDong(c, heSoDonHang);   // v6.08: hệ số riêng từng cây (sửa được ở form)
      await ghiChiTietCayCat(pool, tienDoId, c, soLuongLop, heSoDong);
      // v6.01: + phần GIẬT CẤP (số cái) — không cộng vào lớp, nhưng cộng vào tổng SL cái theo màu.
      if (mauSacId != null) mauTongHop[mauSacId] = (mauTongHop[mauSacId] || 0) + soLuongLop * heSoDong + soCaiGiatCapCua(c);
    }

    // 2) Tính lại SL cái theo màu của CHÍNH bản ghi này (xóa dòng cũ + ghi lại theo tổng mới).
    await pool.request().input('id', sql.Int, tienDoId).query('DELETE FROM TienDoChiTietMau WHERE TienDoID=@id');
    for (const mauSacId of Object.keys(mauTongHop)) {
      await pool.request().input('TienDoID', sql.Int, tienDoId).input('MauSacID', sql.Int, mauSacId)
        .input('SoLuongLuyKe', sql.Int, Math.round(mauTongHop[mauSacId]))
        .query('INSERT INTO TienDoChiTietMau (TienDoID, MauSacID, SoLuongLuyKe) VALUES (@TienDoID, @MauSacID, @SoLuongLuyKe)');
    }

    // 3) Đầu sổ cắt: STT sổ cắt / NV cắt / NV trải vải (chỉ đổi khi client GỬI khóa tương ứng).
    const b = req.body;
    const co = (k) => Object.prototype.hasOwnProperty.call(b, k);
    if (co('sttSoCat') || co('nhanVienCatId')) {
      const rq = pool.request().input('id', sql.Int, tienDoId);
      const dat = [];
      if (co('sttSoCat')) { rq.input('Stt', sql.Int, b.sttSoCat || null); dat.push('SttSoCat=@Stt'); }
      if (co('nhanVienCatId')) { rq.input('NvCat', sql.Int, b.nhanVienCatId || null); dat.push('NhanVienCatID=@NvCat'); }
      if (dat.length) await rq.query(`UPDATE TienDoSanXuat SET ${dat.join(', ')} WHERE TienDoID=@id`);
    }
    if (co('nhanVienTraiVaiIds') && Array.isArray(b.nhanVienTraiVaiIds)) {
      await pool.request().input('id', sql.Int, tienDoId).query('DELETE FROM TienDoTraiVai WHERE TienDoID=@id');
      for (const nvId of b.nhanVienTraiVaiIds) {
        if (!nvId) continue;
        await pool.request().input('TienDoID', sql.Int, tienDoId).input('NhanVienID', sql.Int, nvId)
          .query('INSERT INTO TienDoTraiVai (TienDoID, NhanVienID) VALUES (@TienDoID, @NhanVienID)');
      }
      // Cột đơn lẻ giữ người ĐẦU TIÊN để tương thích dữ liệu/báo cáo cũ (giống lúc ghi mới).
      await pool.request().input('id', sql.Int, tienDoId)
        .input('nv', sql.Int, (b.nhanVienTraiVaiIds.find(x => x) || null))
        .query('UPDATE TienDoSanXuat SET NhanVienTraiVaiID=@nv WHERE TienDoID=@id');
    }

    res.json({ success: true, data: { tienDoId, soCay: hopLe.length } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi sửa sổ cắt: ' + err.message });
  }
});

/* ==================================================================================================
   v6.12 — SỬA / XÓA GHI NHẬN TIẾN ĐỘ **MAY** SAU KHI ĐÃ GỬI (làm giống sổ cắt ở công đoạn Cắt)
   Trước đây bấm "Gửi" ở công đoạn May là xong, gõ nhầm SL thì không sửa được, phải ghi thêm 1 lần nữa
   cho "bù" — lịch sử rối và số luỹ kế sai.
   1 lần ghi nhận May gồm: 1 dòng TienDoSanXuat + các dòng TienDoChiTietMau (SL luỹ kế theo màu)
   + (nếu có giao việc nội bộ) các dòng PhanCongMay.
   LƯU Ý: công đoạn May KHÔNG đụng tới Thẻ kho hàng hóa (chỉ 'KN' Kho nhập mới cộng thẻ kho), nên sửa/xóa
   ở đây không làm lệch tồn kho thành phẩm. Nhưng PhanCongMay là nguồn tính LƯƠNG KHOÁN MAY ⇒ xóa 1 lần
   ghi nhận là mất luôn phần giao việc/lương của lần đó (đã ghi rõ trong hộp xác nhận ở frontend).
   ================================================================================================== */
async function timTienDoMay(pool, tienDoId, donHangId) {
  const td = (await pool.request().input('id', sql.Int, tienDoId).query(`
    SELECT td.TienDoID, td.DonHangID, c.MaCongDoan FROM TienDoSanXuat td
    JOIN CongDoanSanXuat c ON c.StageID = td.StageID WHERE td.TienDoID=@id`)).recordset[0];
  if (!td || td.DonHangID !== donHangId) return { loi: 'Không tìm thấy ghi nhận của đơn hàng này.' };
  if (td.MaCongDoan !== MA_CONG_DOAN_MAY) return { loi: 'Bản ghi này không phải công đoạn May — không sửa ở đây.' };
  return { td };
}
router.get('/orders/:maDH/ghinhanmay', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const recs = (await pool.request().input('id', sql.Int, order.DonHangID).query(`
    SELECT td.TienDoID, td.NgayGhiNhan, td.ThoiGianNhap, td.GhiChu, u.HoTen AS NguoiCapNhat,
           (SELECT COUNT(*) FROM PhanCongMay pc WHERE pc.TienDoID = td.TienDoID) AS SoDongGiaoViec,
           /* v6.21.2: TONG SL DA GIAO cua lan nay. Lan tao boi nut "Luu giao viec (chua Gui)" KHONG co
              dong TienDoChiTietMau (SL theo mau chi ghi khi Gui) => truoc day nhan hien "0 cai", nguoi
              dung bao "lan giao khong hien ra so luong". */
           ISNULL((SELECT SUM(pc.SoLuong) FROM PhanCongMay pc WHERE pc.TienDoID = td.TienDoID), 0) AS TongSLGiaoViec
    FROM TienDoSanXuat td
    JOIN CongDoanSanXuat c ON c.StageID = td.StageID
    LEFT JOIN Users u ON u.UserID = td.NguoiCapNhatID
    WHERE td.DonHangID = @id AND c.MaCongDoan = '${MA_CONG_DOAN_MAY}'
    ORDER BY td.TienDoID`)).recordset;
  if (!recs.length) return res.json({ success: true, data: { records: [] } });
  const mau = (await pool.request().input('id', sql.Int, order.DonHangID).query(`
    SELECT ct.TienDoID, ct.MauSacID, ms.TenMau, ct.SoLuongLuyKe
    FROM TienDoChiTietMau ct
    JOIN TienDoSanXuat td ON td.TienDoID = ct.TienDoID
    JOIN CongDoanSanXuat c ON c.StageID = td.StageID
    LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
    WHERE td.DonHangID = @id AND c.MaCongDoan = '${MA_CONG_DOAN_MAY}'
    ORDER BY ms.TenMau`)).recordset;
  /* v6.21.2: kèm CHI TIẾT GIAO VIỆC của từng lần (ai - công đoạn may - màu - SL) để màn hình
     "Ghi nhận May đã gửi" xem được ngay số lượng đã giao, không phải mò xuống bảng lịch sử. */
  const giaoViec = (await pool.request().input('id', sql.Int, order.DonHangID).query(`
    SELECT pc.TienDoID, pc.ID, nv.HoTen AS TenNhanVien, pc.SoLuong,
           ISNULL(dm.TenCongDoan, cd.TenCongDoan) AS TenCongDoan, ms.TenMau
    FROM PhanCongMay pc
    JOIN TienDoSanXuat td ON td.TienDoID = pc.TienDoID
    JOIN CongDoanSanXuat c ON c.StageID = td.StageID
    JOIN NhanVien nv ON nv.NhanVienID = pc.NhanVienID
    LEFT JOIN CongDoanMay cd ON cd.CongDoanMayID = pc.CongDoanMayID
    LEFT JOIN DonHangDonGiaCongDoanMay dm ON dm.ID = pc.DonGiaCongDoanMayID
    LEFT JOIN MauSac ms ON ms.MauSacID = pc.MauSacID
    WHERE td.DonHangID = @id AND c.MaCongDoan = '${MA_CONG_DOAN_MAY}'
    ORDER BY pc.ID`)).recordset;
  res.json({
    success: true,
    data: {
      records: recs.map(r => ({
        ...r,
        mau: mau.filter(m => m.TienDoID === r.TienDoID),
        giaoViec: giaoViec.filter(g => g.TienDoID === r.TienDoID)
      }))
    }
  });
});
router.put('/orders/:maDH/ghinhanmay/:tienDoId', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const { loi } = await timTienDoMay(pool, Number(req.params.tienDoId), order.DonHangID);
    if (loi) return res.status(400).json({ success: false, message: loi });
    const id = Number(req.params.tienDoId);
    const b = req.body;
    if (Array.isArray(b.chiTietMau)) {
      const hopLe = b.chiTietMau.filter(m => m.mauSacId != null && Number(m.soLuong) >= 0);
      await pool.request().input('id', sql.Int, id).query('DELETE FROM TienDoChiTietMau WHERE TienDoID=@id');
      for (const m of hopLe) {
        await pool.request().input('TienDoID', sql.Int, id).input('MauSacID', sql.Int, m.mauSacId)
          .input('SoLuongLuyKe', sql.Int, Math.round(Number(m.soLuong) || 0))
          .query('INSERT INTO TienDoChiTietMau (TienDoID, MauSacID, SoLuongLuyKe) VALUES (@TienDoID, @MauSacID, @SoLuongLuyKe)');
      }
    }
    const co = (k) => Object.prototype.hasOwnProperty.call(b, k);
    if (co('ngayGhiNhan') || co('ghiChu')) {
      const rq = pool.request().input('id', sql.Int, id);
      const dat = [];
      if (co('ngayGhiNhan') && b.ngayGhiNhan) { rq.input('ng', sql.Date, b.ngayGhiNhan); dat.push('NgayGhiNhan=@ng'); }
      if (co('ghiChu')) { rq.input('gc', sql.NVarChar, b.ghiChu || null); dat.push('GhiChu=@gc'); }
      if (dat.length) await rq.query(`UPDATE TienDoSanXuat SET ${dat.join(', ')} WHERE TienDoID=@id`);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi sửa ghi nhận May: ' + err.message });
  }
});
router.delete('/orders/:maDH/ghinhanmay/:tienDoId', requireAuth, requirePermission('QLSX', 'delete'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const { loi } = await timTienDoMay(pool, Number(req.params.tienDoId), order.DonHangID);
    if (loi) return res.status(400).json({ success: false, message: loi });
    const id = Number(req.params.tienDoId);
    // Xóa con trước (PhanCongMay = giao việc nội bộ, nguồn tính lương khoán may), rồi mới xóa bản ghi.
    for (const q of ['DELETE FROM PhanCongMay WHERE TienDoID=@id', 'DELETE FROM TienDoChiTietMau WHERE TienDoID=@id']) {
      try { await pool.request().input('id', sql.Int, id).query(q); } catch (e) { /* bảng có thể chưa có ở DB cũ */ }
    }
    const kq = await pool.request().input('id', sql.Int, id).query('DELETE FROM TienDoSanXuat WHERE TienDoID=@id');
    if (!kq.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Ghi nhận đã bị xóa trước đó.' });
    res.json({ success: true });   // KHÔNG kéo lùi công đoạn hiện tại của đơn (giống xóa sổ cắt v5.99)
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Không xóa được ghi nhận May: ' + err.message });
  }
});

/* v5.85: DANH SÁCH PHIẾU XUẤT KHO VẢI CỦA 1 ĐƠN — cho popup "bấm vào trạng thái Đã xuất kho ở màn
   Chỉ định vải SX để xem đã xuất những phiếu nào". Đặt ở qlsx.js (gate 'chidinhvaisx') thay vì gọi
   sang /api/khovai/xuat để người chỉ làm QLSX không cần thêm quyền phân hệ Kho vải mới xem được. */
router.get('/chidinhvaisx/:maDH/phieuxuat', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'chidinhvaisx'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const rows = (await pool.request().input('id', sql.Int, order.DonHangID).query(`
    SELECT p.PhieuXuatID, p.NgayXuat, p.MaDon, p.NguoiNhan, p.GhiChu, u.HoTen AS NguoiTao,
      (SELECT COUNT(*) FROM PhieuXuatVaiChiTiet ct WHERE ct.PhieuXuatID = p.PhieuXuatID) AS SoLuongCay,
      ISNULL((SELECT SUM(ct.KGXuat) FROM PhieuXuatVaiChiTiet ct WHERE ct.PhieuXuatID = p.PhieuXuatID), 0) AS TongKGXuat,
      ISNULL((SELECT SUM(ct.SoMet) FROM PhieuXuatVaiChiTiet ct WHERE ct.PhieuXuatID = p.PhieuXuatID), 0) AS TongMet
    FROM PhieuXuatVai p
    LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    WHERE p.DonHangID = @id
    ORDER BY p.PhieuXuatID DESC`)).recordset;
  res.json({ success: true, data: rows });
});
/* v5.99 — XÓA 1 SỔ CẮT (1 bản ghi tiến độ công đoạn Cắt).
   Xóa hết cây của sổ + tổng SL cái theo màu của sổ + danh sách trải vải, rồi xóa bản ghi tiến độ.
   HỆ QUẢ (đã ghi rõ trong hộp xác nhận ở frontend): tổng SL cắt của đơn giảm đi đúng phần của sổ này,
   nên các con số phía sau đọc theo SL cắt (Kho nhập đối chiếu, lương trải vải cắt, báo cáo năng suất)
   sẽ đổi theo. KHÔNG kéo lùi con trỏ công đoạn của đơn — công đoạn sau vẫn đang làm dở phần đã cắt. */
router.delete('/orders/:maDH/socat/:tienDoId', requireAuth, requirePermission('QLSX', 'delete'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const td = (await pool.request().input('id', sql.Int, req.params.tienDoId).query(`
      SELECT td.TienDoID, td.DonHangID, c.MaCongDoan FROM TienDoSanXuat td
      JOIN CongDoanSanXuat c ON c.StageID = td.StageID WHERE td.TienDoID=@id`)).recordset[0];
    if (!td || td.DonHangID !== order.DonHangID) return res.status(404).json({ success: false, message: 'Không tìm thấy sổ cắt của đơn hàng này.' });
    if (td.MaCongDoan !== 'CAT') return res.status(400).json({ success: false, message: 'Bản ghi này không phải công đoạn Cắt — không xóa ở đây.' });

    const id = Number(req.params.tienDoId);
    // Xóa con trước rồi mới xóa cha (không phụ thuộc vào việc khóa ngoại có CASCADE hay không).
    for (const sql1 of [
      'DELETE FROM TienDoCatChiTietCay WHERE TienDoID=@id',
      'DELETE FROM TienDoChiTietMau WHERE TienDoID=@id',
      'DELETE FROM TienDoTraiVai WHERE TienDoID=@id'
    ]) {
      try { await pool.request().input('id', sql.Int, id).query(sql1); } catch (e) { /* bảng có thể không tồn tại ở DB cũ */ }
    }
    const kq = await pool.request().input('id', sql.Int, id).query('DELETE FROM TienDoSanXuat WHERE TienDoID=@id');
    if (!kq.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Sổ cắt đã bị xóa trước đó.' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Không xóa được sổ cắt: ' + err.message });
  }
});

/* v5.97: CHI TIẾT 1 PHIẾU XUẤT KHO VẢI — để bấm thẳng vào phiếu trong popup "đã xuất kho" là xem
   được nội dung phiếu, không phải sang phân hệ Quản lý kho vải. Cố ý đặt ở qlsx.js (gate
   'chidinhvaisx') để người chỉ làm QLSX cũng xem được mà không cần cấp quyền phân hệ Kho vải.
   Chỉ trả phiếu THUỘC ĐÚNG đơn hàng đó — không thành cửa xem mọi phiếu xuất trong kho. */
router.get('/chidinhvaisx/:maDH/phieuxuat/:phieuId', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'chidinhvaisx'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const header = (await pool.request().input('id', sql.Int, req.params.phieuId).input('dh', sql.Int, order.DonHangID).query(`
    SELECT p.PhieuXuatID, p.NgayXuat, p.MaDon, p.Chuyen, p.NguoiNhan, p.MucDich, p.GhiChu,
           d.MaDH, d.TenSanPham, u.HoTen AS NguoiTao,
           STUFF((SELECT DISTINCT ', ' + sd.MaRap FROM DonHangChiTietSoDo sd
                  WHERE sd.DonHangID = p.DonHangID AND sd.MaRap IS NOT NULL AND LTRIM(RTRIM(sd.MaRap)) <> ''
                  FOR XML PATH('')), 1, 2, '') AS MaRap
    FROM PhieuXuatVai p
    LEFT JOIN DonHangSanXuat d ON d.DonHangID = p.DonHangID
    LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    WHERE p.PhieuXuatID = @id AND p.DonHangID = @dh`)).recordset[0];
  if (!header) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu xuất của đơn hàng này.' });
  const lines = (await pool.request().input('id', sql.Int, req.params.phieuId).query(`
    SELECT ct.KGXuat, ct.SoMet, ct.KieuVai, vc.MaCay, vc.KhoVaiThucTe, dv.MaVai, lv.TenLoaiVai, ms.TenMau
    FROM PhieuXuatVaiChiTiet ct
    JOIN VaiCay vc ON vc.CayID = ct.CayID
    LEFT JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
    WHERE ct.PhieuXuatID = @id ORDER BY ct.ID`)).recordset;
  res.json({ success: true, data: { header, lines } });
});
router.get('/chidinhvaisx/:maDH/phieu', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'chidinhvaisx'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const phieu = (await pool.request().input('id', sql.Int, order.DonHangID).query(`
    SELECT ISNULL(TenPhieu, N'') AS TenPhieu, COUNT(*) AS SoDong
    FROM ChiDinhVaiSX WHERE DonHangID=@id GROUP BY ISNULL(TenPhieu, N'') ORDER BY ISNULL(TenPhieu, N'')`)).recordset;
  const _sd = await getSoDoList(pool, order.DonHangID);
  const MaRap = [...new Set(_sd.map(s => s.MaRap).filter(Boolean))].join(', ');
  res.json({ success: true, data: { order: { MaDH: order.MaDH, TenSanPham: order.TenSanPham, MaRap }, phieu } });
});
router.get('/chidinhvaisx/:maDH', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'chidinhvaisx'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const ten = req.query.ten != null ? String(req.query.ten) : '';   // v5.54: lọc theo BẢN
  const rows = (await pool.request().input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten).query(`
    SELECT cd.Id, cd.Kieu, cd.LoaiVaiID, cd.MauSacID, cd.SoKGYeuCau, cd.SoMet, cd.DVTVaiYeuCau, lv.TenLoaiVai, ms.TenMau
    FROM ChiDinhVaiSX cd
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = cd.LoaiVaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = cd.MauSacID
    WHERE cd.DonHangID=@id AND ISNULL(cd.TenPhieu, N'')=@ten ORDER BY cd.Kieu, cd.Id`)).recordset;
  const _sd = await getSoDoList(pool, order.DonHangID);   // v5.52
  const MaRap = [...new Set(_sd.map(s => s.MaRap).filter(Boolean))].join(', ');
  res.json({ success: true, data: { order: { MaDH: order.MaDH, TenSanPham: order.TenSanPham, MaRap }, ten, rows } });
});
router.put('/chidinhvaisx/:maDH', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'chidinhvaisx'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const ten = req.body.ten != null ? String(req.body.ten).trim() : '';       // v5.54: tên bản (mới)
    const oldTen = req.body.oldTen != null ? String(req.body.oldTen) : ten;     // bản đang sửa (để ghi đè/đổi tên)
    // Ghi đè theo BẢN: xóa dòng của bản cũ rồi chèn lại với tên bản mới (hỗ trợ đổi tên).
    await pool.request().input('id', sql.Int, order.DonHangID).input('ot', sql.NVarChar, oldTen)
      .query(`DELETE FROM ChiDinhVaiSX WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ot`);
    for (const it of items) {
      const lv = await resolveLoaiVaiId(pool, it.tenLoaiVai);   // gõ tự do -> tự tạo trong danh mục nếu chưa có
      const ms = await resolveMauSacIdQ(pool, it.tenMau);
      if (!lv && !ms && (it.soKG === '' || it.soKG == null) && (it.soMet === '' || it.soMet == null)) continue;
      await pool.request()
        .input('dh', sql.Int, order.DonHangID)
        .input('ten', sql.NVarChar, ten)
        .input('kieu', sql.NVarChar, it.kieu === 'Phối' ? 'Phối' : 'Chính')
        .input('lv', sql.Int, lv)
        .input('ms', sql.Int, ms)
        .input('kg', sql.Decimal(10, 2), (it.soKG === '' || it.soKG == null) ? null : Number(it.soKG))
        .input('met', sql.Decimal(10, 2), (it.soMet === '' || it.soMet == null) ? null : Number(it.soMet))   // v5.50
        .input('dvt', sql.NVarChar, it.dvt || 'Kg')
        .query(`INSERT INTO ChiDinhVaiSX (DonHangID, TenPhieu, Kieu, LoaiVaiID, MauSacID, SoKGYeuCau, SoMet, DVTVaiYeuCau)
                VALUES (@dh, @ten, @kieu, @lv, @ms, @kg, @met, @dvt)`);
    }
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi lưu chỉ định vải SX: ' + err.message }); }
});
router.delete('/chidinhvaisx/:maDH', requireAuth, requirePermission('QLSX', 'delete'), requireChucNang('QLSX', 'chidinhvaisx'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const ten = req.query.ten != null ? String(req.query.ten) : '';   // v5.54: xóa 1 BẢN
    await pool.request().input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten)
      .query(`DELETE FROM ChiDinhVaiSX WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ten`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

/* ==================================================================================================
   v6.04 — ĐỊNH MỨC & HAO HỤT (chuyển từ phân hệ Kho vải sang đây)
   Khác bản cũ ở 4 điểm (đúng yêu cầu người dùng):
     1) Khai theo ĐÚNG 1 LỆNH SX chọn từ danh sách (DinhMucVai.DonHangID) — bỏ hẳn việc gõ "Tên mẫu hàng"
        phải khớp CHỮ với Tên sản phẩm (lệch 1 dấu cách là báo cáo trống, đây là gốc của mọi sai sót cũ).
     2) Khai theo LOẠI VẢI (LoaiVaiID) — không theo từng mã vải/mã cây.
     3) Chọn ĐƠN VỊ TÍNH cho định mức: Kg hoặc Mét (vải quản lý cả 2 kiểu).
     4) "SL hoàn thành" = SL NHẬP KHO thực tế (tiến độ công đoạn 'KN'), không phải TongSoLuong × %.
   Bảng DinhMucVai giữ nguyên + 3 cột mới (migration_v664.sql). Route cũ ở khovai.js còn nhưng tab đã bỏ.
   ================================================================================================== */
/* v6.06 — MÃ RẬP của 1 đơn: gộp CẢ 2 NGUỒN.
   Nguồn chính: bảng Sơ đồ (DonHangChiTietSoDo.MaRap) — công đoạn Kỹ thuật khai từ v5.13.
   Nguồn cũ: TienDoSanXuat.MaRap — các lần Ghi tiến độ Kỹ thuật TRƯỚC v5.13 ghi thẳng vào cột này.
   Chỉ đọc 1 nguồn là đơn cũ hiện TRỐNG mã rập dù Kỹ thuật đã cập nhật (đúng lỗi người dùng báo).
   Cùng tinh thần với cách sổ cắt lấy bù ISNULL(td.MaRap, sd.MaRap) ở v5.89. */
async function getMaRapCuaDon(pool, donHangId) {
  const r = (await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT DISTINCT LTRIM(RTRIM(x.MaRap)) AS MaRap FROM (
      SELECT MaRap FROM DonHangChiTietSoDo WHERE DonHangID = @id
      UNION ALL
      SELECT MaRap FROM TienDoSanXuat WHERE DonHangID = @id
    ) x
    WHERE x.MaRap IS NOT NULL AND LTRIM(RTRIM(x.MaRap)) <> ''`)).recordset;
  return r.map(x => x.MaRap).join(', ');
}
/* v6.06 — ĐƠN VỊ TÍNH của đơn (theo ĐÚNG cái đã khai ở Ra lệnh sản xuất): lấy ĐVT của dòng Cấu trúc vải
   đầu tiên có khai (DonHangChiTietVai.DonViTinh — đúng nguồn mà bản in Lệnh SX đang dùng), thiếu thì lùi
   về "Đơn vị chính" của dòng Đơn vị quy đổi đã chọn, cuối cùng mới mặc định 'Cái'. */
async function getDonViTinhCuaDon(pool, donHangId) {
  const r = (await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT TOP 1 ct.DonViTinh FROM DonHangChiTietVai ct
    WHERE ct.DonHangID = @id AND LTRIM(RTRIM(ISNULL(ct.DonViTinh, N''))) <> N''
    ORDER BY ct.ID`)).recordset[0];
  if (r && r.DonViTinh) return String(r.DonViTinh).trim();
  const q = (await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT dvqd.DonViChinh FROM DonHangSanXuat d
    JOIN DanhMucDonViQuyDoi dvqd ON dvqd.ID = d.DonViQuyDoiID WHERE d.DonHangID = @id`)).recordset[0];
  return (q && q.DonViChinh) ? String(q.DonViChinh).trim() : 'Cái';
}
async function getKhoNhapStageId(pool) {
  const r = (await pool.request().query("SELECT StageID FROM CongDoanSanXuat WHERE MaCongDoan = 'KN'")).recordset[0];
  return r ? r.StageID : null;
}
// KG/mét đã cấp cho 1 đơn, gom theo LOẠI VẢI (nguồn duy nhất: phiếu xuất kho vải gắn đơn hàng này).
async function getVaiDaCapTheoLoai(pool, donHangId) {
  const rows = (await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT dv.LoaiVaiID, lv.TenLoaiVai,
           ISNULL(SUM(ct.KGXuat), 0) AS TongKG,
           ISNULL(SUM(ct.SoMet), 0) AS TongMet
    FROM PhieuXuatVai px
    JOIN PhieuXuatVaiChiTiet ct ON ct.PhieuXuatID = px.PhieuXuatID
    JOIN VaiCay vc ON vc.CayID = ct.CayID
    JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
    WHERE px.DonHangID = @id
    GROUP BY dv.LoaiVaiID, lv.TenLoaiVai`)).recordset;
  return rows.map(r => ({
    LoaiVaiID: r.LoaiVaiID, TenLoaiVai: r.TenLoaiVai || '',
    TongKG: Math.round((Number(r.TongKG) || 0) * 100) / 100,
    TongMet: Math.round((Number(r.TongMet) || 0) * 100) / 100
  }));
}
async function getDinhMucRows(pool, donHangId) {
  return (await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT dm.ID, dm.LoaiVaiID, lv.TenLoaiVai, dm.DinhMucKGTrenSP, dm.DonViTinh, dm.TyLeHaoHut, dm.GhiChu
    FROM DinhMucVai dm
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dm.LoaiVaiID
    WHERE dm.DonHangID = @id
    ORDER BY dm.ID`)).recordset;
}
// Danh sách lệnh SX để chọn (kèm: đã khai mấy dòng định mức, SL nhập kho, có vượt định mức không).
router.get('/dinhmuc', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'dinhmuc'), async (req, res) => {
  const pool = await getPool();
  /* v6.05: danh sách kèm MÃ RẬP + đơn vị quy đổi (cột số lượng hiện được ĐVT) + ảnh sản phẩm.
     v6.06: mã rập và ĐVT lấy qua getMaRapCuaDon/getDonViTinhCuaDon (gộp đủ nguồn — xem 2 hàm đó). */
  const orders = (await pool.request().query(`
    SELECT d.DonHangID, d.MaDH, d.TenSanPham, d.MaSanPham, d.TongSoLuong, d.TrangThai, d.AnhSanPham,
           d.HeSoQuyDoi, dvqd.DonViQuyDoi AS TenDonViQuyDoi, dvqd.PhepTinh AS PhepTinhQuyDoi,
           (SELECT COUNT(*) FROM DinhMucVai dm WHERE dm.DonHangID = d.DonHangID) AS SoDongDinhMuc
    FROM DonHangSanXuat d
    LEFT JOIN DanhMucDonViQuyDoi dvqd ON dvqd.ID = d.DonViQuyDoiID
    ORDER BY d.DonHangID DESC`)).recordset;
  const knStage = await getKhoNhapStageId(pool);
  for (const o of orders) {
    o.SLNhapKho = knStage ? await getStageActualQty(pool, o.DonHangID, knStage) : 0;
    o.MaRap = await getMaRapCuaDon(pool, o.DonHangID);              // v6.06
    o.DonViTinhLenh = await getDonViTinhCuaDon(pool, o.DonHangID);   // v6.06
  }
  res.json({ success: true, data: orders });
});
// Định mức + báo cáo hao hụt của ĐÚNG 1 lệnh SX.
router.get('/dinhmuc/:maDH', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'dinhmuc'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const knStage = await getKhoNhapStageId(pool);
  const slNhapKho = knStage ? await getStageActualQty(pool, order.DonHangID, knStage) : 0;
  const rows = await getDinhMucRows(pool, order.DonHangID);
  const daCap = await getVaiDaCapTheoLoai(pool, order.DonHangID);
  const capCua = (loaiVaiId) => daCap.find(x => String(x.LoaiVaiID) === String(loaiVaiId)) || null;

  const lam2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const baoCao = rows.map(r => {
    const laMet = String(r.DonViTinh || 'Kg').trim().toLowerCase().indexOf('m') === 0;   // 'Mét'/'m' -> mét
    const c = capCua(r.LoaiVaiID);
    const daCapSo = c ? (laMet ? c.TongMet : c.TongKG) : 0;
    const dinhMuc = Number(r.DinhMucKGTrenSP) || 0;
    const lyThuyet = lam2(dinhMuc * slNhapKho);
    const haoHut = dinhMuc > 0 ? lam2(daCapSo - lyThuyet) : null;
    const haoHutPT = (lyThuyet > 0) ? Math.round(((daCapSo - lyThuyet) / lyThuyet) * 1000) / 10 : null;
    const choPhep = r.TyLeHaoHut == null ? null : Number(r.TyLeHaoHut);
    return {
      ID: r.ID, LoaiVaiID: r.LoaiVaiID, TenLoaiVai: r.TenLoaiVai || '',
      DinhMuc: dinhMuc || null, DonViTinh: r.DonViTinh || 'Kg', TyLeHaoHut: choPhep, GhiChu: r.GhiChu || '',
      DaCap: lam2(daCapSo), LyThuyet: dinhMuc > 0 ? lyThuyet : null, HaoHut: haoHut, HaoHutPhanTram: haoHutPT,
      VuotDinhMuc: haoHutPT != null && choPhep != null && haoHutPT > choPhep
    };
  });
  // Loại vải ĐÃ CẤP nhưng CHƯA khai định mức — vẫn phải hiện ra, nếu không sẽ tưởng là đã tính hết.
  const thieu = daCap
    .filter(c => c.LoaiVaiID != null && !rows.some(r => String(r.LoaiVaiID) === String(c.LoaiVaiID)))
    .map(c => ({
      ID: null, LoaiVaiID: c.LoaiVaiID, TenLoaiVai: c.TenLoaiVai, DinhMuc: null, DonViTinh: null,
      TyLeHaoHut: null, GhiChu: '', DaCap: c.TongKG, DaCapMet: c.TongMet,
      LyThuyet: null, HaoHut: null, HaoHutPhanTram: null, VuotDinhMuc: false, ChuaKhai: true
    }));
  res.json({
    success: true,
    data: {
      order: {
        MaDH: order.MaDH, TenSanPham: order.TenSanPham, MaSanPham: order.MaSanPham,
        TongSoLuong: order.TongSoLuong, HeSoQuyDoi: order.HeSoQuyDoi,
        TenDonViQuyDoi: order.TenDonViQuyDoi, PhepTinhQuyDoi: order.PhepTinhQuyDoi,
        // v6.05: mã rập (Kỹ thuật cập nhật) + ảnh sản phẩm — hiện ở màn nhập liệu và bản in.
        // v6.06: mã rập gộp cả 2 nguồn + ĐVT lấy đúng theo Ra lệnh sản xuất (xem 2 hàm helper).
        MaRap: await getMaRapCuaDon(pool, order.DonHangID),
        DonViTinhLenh: await getDonViTinhCuaDon(pool, order.DonHangID),
        AnhSanPham: order.AnhSanPham || null,
        Size: order.Size || null
      },
      slNhapKho, rows: baoCao.concat(thieu), daCap
    }
  });
});
// Ghi đè toàn bộ dòng định mức của 1 lệnh SX (cùng cách làm với Chỉ định vải SX: xóa hết rồi chèn lại).
router.put('/dinhmuc/:maDH', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'dinhmuc'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const hopLe = items.filter(it => it.loaiVaiId);
    const trung = hopLe.map(it => String(it.loaiVaiId)).filter((v, i, a) => a.indexOf(v) !== i);
    if (trung.length) return res.status(400).json({ success: false, message: 'Có loại vải bị khai TRÙNG — mỗi loại vải chỉ 1 dòng định mức.' });

    await pool.request().input('id', sql.Int, order.DonHangID).query('DELETE FROM DinhMucVai WHERE DonHangID=@id');
    for (const it of hopLe) {
      await pool.request()
        .input('DonHangID', sql.Int, order.DonHangID)
        // MauHang giữ lại để tương thích dữ liệu/route cũ (NOT NULL trong schema) — ghi Tên sản phẩm của đơn.
        .input('MauHang', sql.NVarChar, order.TenSanPham || order.MaDH)
        .input('LoaiVaiID', sql.Int, it.loaiVaiId)
        .input('DinhMuc', sql.Decimal(10, 4), (it.dinhMuc === '' || it.dinhMuc == null) ? null : Number(it.dinhMuc))
        .input('DonViTinh', sql.NVarChar(20), (String(it.donViTinh || 'Kg').trim().toLowerCase().indexOf('m') === 0) ? 'Mét' : 'Kg')
        .input('TyLeHaoHut', sql.Decimal(5, 2), (it.tyLeHaoHut === '' || it.tyLeHaoHut == null) ? null : Number(it.tyLeHaoHut))
        .input('GhiChu', sql.NVarChar, it.ghiChu || null)
        .query(`INSERT INTO DinhMucVai (DonHangID, MauHang, LoaiVaiID, DinhMucKGTrenSP, DonViTinh, TyLeHaoHut, GhiChu)
                VALUES (@DonHangID, @MauHang, @LoaiVaiID, @DinhMuc, @DonViTinh, @TyLeHaoHut, @GhiChu)`);
    }
    res.json({ success: true, data: { soDong: hopLe.length } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu định mức: ' + err.message });
  }
});

/* ==================================================================================================
   v6.15 — GIÁ THÀNH SẢN PHẨM CỦA 1 LỆNH SẢN XUẤT
   Gom mọi chi phí ĐÃ CÓ trong hệ thống về 1 chỗ, không nhập lại số liệu:
     1. VẢI      = với TỪNG CÂY đã cắt: (kg/mét đã dùng khi cắt) × (đơn giá nhập CỦA CHÍNH CÂY ĐÓ).
                   Cây nào chưa khai "KG/mét đã dùng" thì lùi về KG đã XUẤT cho đơn của cây đó và ĐÁNH DẤU
                   (thiếu số liệu) — thà báo thiếu chứ không âm thầm tính 0.
     2. PHỤ KIỆN = SL xuất cho đơn × đơn giá của LẦN NHẬP GẦN NHẤT có đơn giá (phiếu XUẤT không có cột
                   đơn giá — xem migration_v54.sql). Mã nào chưa từng nhập có giá thì đánh dấu thiếu.
     3. GIA CÔNG NGOÀI = SL nhận × đơn giá hạng mục gia công (giống bảng lương gia công).
        MAY NHÀ LÀM    = Σ(SL giao × thành tiền/cái) — DÙNG ĐÚNG công thức của bảng lương khoán may
                         (dual-path: đơn giá mới DonHangDonGiaCongDoanMay.ThanhTien, cũ = DonGia × HeSo).
                         ⚠ Sửa công thức lương ở payroll.js thì phải sửa đồng bộ ở đây, kẻo 2 nơi lệch nhau.
     4. IN THÊU  = SL nhận × đơn giá hạng mục in thêu (quy tắc v6.01).
     5. CHI PHÍ CHUNG = các dòng nhập tay (bảng ChiPhiChungDonHang, migration_v665).
   Giá thành 1 SP = TỔNG / SL hoàn thành (ưu tiên SL NHẬP KHO thực tế; chưa nhập kho thì lấy SL cắt).
   ================================================================================================== */
async function tinhGiaThanh(pool, order) {
  const donHangId = order.DonHangID;
  const lam2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  // ---- 1. VẢI theo từng cây đã cắt ----
  const coGiatCap = await coCotQLSX(pool, 'TienDoCatChiTietCay', 'SoCaiGiatCap');
  const vai = (await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT vc.CayID, vc.MaCay, dv.MaVai, lv.TenLoaiVai, ms.TenMau, vc.DonGiaNhap,
           SUM(ISNULL(cay.SoKgMetSuDung, 0)) AS KgMetDaDung,
           SUM(cay.SoLuongLop) AS TongLop,
           ISNULL((SELECT SUM(ct.KGXuat) FROM PhieuXuatVaiChiTiet ct
                   JOIN PhieuXuatVai px ON px.PhieuXuatID = ct.PhieuXuatID
                   WHERE ct.CayID = vc.CayID AND px.DonHangID = @id), 0) AS KgDaXuatChoDon
    FROM TienDoCatChiTietCay cay
    JOIN TienDoSanXuat td ON td.TienDoID = cay.TienDoID
    JOIN CongDoanSanXuat c ON c.StageID = td.StageID AND c.MaCongDoan = 'CAT'
    JOIN VaiCay vc ON vc.CayID = cay.CayID
    JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
    WHERE td.DonHangID = @id
    GROUP BY vc.CayID, vc.MaCay, dv.MaVai, lv.TenLoaiVai, ms.TenMau, vc.DonGiaNhap
    ORDER BY vc.MaCay`)).recordset.map(r => {
      const daDung = Number(r.KgMetDaDung) || 0;
      const thieuSL = daDung <= 0;
      const sl = thieuSL ? (Number(r.KgDaXuatChoDon) || 0) : daDung;
      const dg = Number(r.DonGiaNhap) || 0;
      return {
        MaCay: r.MaCay, MaVai: r.MaVai, TenLoaiVai: r.TenLoaiVai || '', TenMau: r.TenMau || '',
        SoLuong: lam2(sl), DonGia: dg, ThanhTien: lam2(sl * dg),
        TongLop: Number(r.TongLop) || 0,
        ThieuSoLuong: thieuSL, ThieuDonGia: dg <= 0,
        NguonSoLuong: thieuSL ? 'KG đã xuất cho đơn (chưa khai KG/mét đã dùng ở sổ cắt)' : 'KG/mét đã dùng ở sổ cắt'
      };
    });

  // ---- 2. PHỤ KIỆN đã xuất cho đơn ----
  const phuKien = (await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT dm.PhuKienID, dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai, dm.DonViCoBan,
           SUM(ct.SoLuong) AS SoLuong,
           (SELECT TOP 1 n.DonGia FROM PhieuPhuKienChiTiet n
              JOIN PhieuPhuKien pn ON pn.PhieuID = n.PhieuID
              WHERE n.PhuKienID = dm.PhuKienID AND pn.LoaiPhieu = N'Nhập' AND ISNULL(n.DonGia, 0) > 0
              ORDER BY pn.Ngay DESC, pn.PhieuID DESC) AS DonGia
    FROM PhieuPhuKienChiTiet ct
    JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
    JOIN DanhMucPhuKien dm ON dm.PhuKienID = ct.PhuKienID
    LEFT JOIN LoaiPhuKien lpk ON lpk.LoaiPhuKienID = dm.LoaiPhuKienID
    WHERE p.DonHangID = @id AND p.LoaiPhieu = N'Xuất'
    GROUP BY dm.PhuKienID, dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai, dm.DonViCoBan
    ORDER BY dm.MaPhuKien`)).recordset.map(r => {
      const sl = Number(r.SoLuong) || 0, dg = Number(r.DonGia) || 0;
      return {
        MaPhuKien: r.MaPhuKien, TenPhuKien: r.TenPhuKien, TenLoai: r.TenLoai || '', DonVi: r.DonViCoBan || '',
        SoLuong: lam2(sl), DonGia: dg, ThanhTien: lam2(sl * dg), ThieuDonGia: dg <= 0
      };
    });

  // ---- 3a. GIA CÔNG NGOÀI ----
  const giaCong = (await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT ncc.TenNha, hm.TenHangMuc, ISNULL(ct.SoLuongNhan, 0) AS SoLuong,
           ISNULL(ISNULL(dhg.DonGia, hm.DonGiaMacDinh), 0) AS DonGia
    FROM DonHangChiTietNhaGiaCong ct
    LEFT JOIN NhaGiaCong ncc ON ncc.NhaGiaCongID = ct.NhaGiaCongID
    LEFT JOIN HangMucGiaCong hm ON hm.HangMucGiaCongID = ct.HangMucGiaCongID
    OUTER APPLY (SELECT TOP 1 x.DonGia FROM DonHangHangMucGiaCong x
                 WHERE x.HangMucGiaCongID = ct.HangMucGiaCongID AND x.DonHangID = ct.DonHangID
                 ORDER BY ISNULL(x.TenPhieu, N''), x.ID) dhg
    WHERE ct.DonHangID = @id
    ORDER BY ncc.TenNha`)).recordset.map(r => ({
      TenNha: r.TenNha || '', TenHangMuc: r.TenHangMuc || '', SoLuong: Number(r.SoLuong) || 0,
      DonGia: Number(r.DonGia) || 0, ThanhTien: lam2((Number(r.SoLuong) || 0) * (Number(r.DonGia) || 0))
    }));

  // ---- 3b. MAY NHÀ LÀM (lương khoán may của chính đơn này) ----
  const mayNhaLam = (await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT ISNULL(dm.TenCongDoan, cm.TenCongDoan) AS TenCongDoan, nv.HoTen, pc.SoLuong,
           ISNULL(dm.ThanhTien, ISNULL(ISNULL(dhg.DonGia, g.DonGia), 0) * ISNULL(ISNULL(dhg.HeSo, g.HeSo), 1)) AS DonGia
    FROM PhanCongMay pc
    JOIN TienDoSanXuat td ON td.TienDoID = pc.TienDoID
    LEFT JOIN NhanVien nv ON nv.NhanVienID = pc.NhanVienID
    LEFT JOIN DonHangDonGiaCongDoanMay dm ON dm.ID = pc.DonGiaCongDoanMayID
    LEFT JOIN CongDoanMay cm ON cm.CongDoanMayID = pc.CongDoanMayID
    LEFT JOIN DonHangCongDoanMay dhg ON dhg.DonHangID = td.DonHangID AND dhg.CongDoanMayID = pc.CongDoanMayID
    LEFT JOIN DonGiaCongDoanMay g ON g.CongDoanMayID = pc.CongDoanMayID
    WHERE td.DonHangID = @id
    ORDER BY ISNULL(dm.TenCongDoan, cm.TenCongDoan), nv.HoTen`)).recordset.map(r => ({
      TenCongDoan: r.TenCongDoan || '', HoTen: r.HoTen || '', SoLuong: Number(r.SoLuong) || 0,
      DonGia: Number(r.DonGia) || 0, ThanhTien: lam2((Number(r.SoLuong) || 0) * (Number(r.DonGia) || 0))
    }));

  // ---- 4. IN THÊU ----
  const coHM = await coCotQLSX(pool, 'DonHangNhaInTheu', 'HangMucInThe');
  const hmCol = coHM ? 'it.HangMucInThe' : "CAST(NULL AS NVARCHAR(200))";
  const inThe = (await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT ncc.TenNha, ${hmCol} AS HangMucInThe, ISNULL(it.SoLuongNhan, 0) AS SoLuong,
           CASE WHEN LTRIM(RTRIM(ISNULL(${hmCol}, N''))) <> N'' THEN ISNULL(hm.DonGia, 0)
                ELSE ISNULL(dg.TongDonGia, 0) END AS DonGia
    FROM DonHangNhaInTheu it
    LEFT JOIN NhaGiaCong ncc ON ncc.NhaGiaCongID = it.NhaInID
    OUTER APPLY (SELECT SUM(x.DonGia) AS TongDonGia FROM DonHangDonGiaInThe x
                 WHERE x.DonHangID = it.DonHangID
                   AND ISNULL(x.TenPhieu, N'') = (SELECT MIN(ISNULL(y.TenPhieu, N'')) FROM DonHangDonGiaInThe y WHERE y.DonHangID = it.DonHangID)) dg
    OUTER APPLY (SELECT TOP 1 x.DonGia FROM DonHangDonGiaInThe x
                 WHERE x.DonHangID = it.DonHangID
                   AND LTRIM(RTRIM(ISNULL(x.Ten, N''))) = LTRIM(RTRIM(ISNULL(${hmCol}, N'')))
                 ORDER BY ISNULL(x.TenPhieu, N''), x.ID) hm
    WHERE it.DonHangID = @id
    ORDER BY ncc.TenNha`)).recordset.map(r => ({
      TenNha: r.TenNha || '', HangMucInThe: r.HangMucInThe || '', SoLuong: Number(r.SoLuong) || 0,
      DonGia: Number(r.DonGia) || 0, ThanhTien: lam2((Number(r.SoLuong) || 0) * (Number(r.DonGia) || 0))
    }));

  /* ---- 4b. BỘ PHẬN CẮT (tiền bàn cắt) ----
     Dùng ĐÚNG công thức của bảng "Lương trải vải cắt" (v5.91): mỗi sổ cắt = mét sơ đồ × khổ vải ×
     tổng số lớp × đơn giá (CauHinh['LUONG_CAT'].donGia, mặc định 1100). Mét/khổ lấy bù từ sơ đồ đã chọn
     (ISNULL(td.X, sd.X)) vì 2 cột đó chỉ được ghi ở công đoạn Kỹ thuật — xem GET /socat v5.89.
     ⚠ Sửa công thức lương cắt ở payroll.js thì phải sửa đồng bộ ở đây. */
  let donGiaCat = 1100;
  try {
    const r = (await pool.request().query("SELECT GiaTri FROM CauHinh WHERE Khoa = N'LUONG_CAT'")).recordset[0];
    if (r && r.GiaTri) { const j = JSON.parse(r.GiaTri); if (Number(j.donGia) > 0) donGiaCat = Number(j.donGia); }
  } catch (e) { /* chưa có bảng CauHinh / chưa khai -> dùng mặc định 1100 */ }
  const boPhanCat = (await pool.request().input('id', sql.Int, donHangId).input('g', sql.Decimal(18, 4), donGiaCat).query(`
    SELECT td.TienDoID, td.NgayGhiNhan, td.SttSoCat,
           ISNULL(td.MetSoDoDai, sd.MetSoDoDai) AS MetSoDo,
           ISNULL(td.KhoVaiSoDo, sd.KhoVaiSoDo) AS KhoVai,
           ISNULL((SELECT SUM(cay.SoLuongLop) FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = td.TienDoID), 0) AS TongLop,
           ISNULL(td.MetSoDoDai, sd.MetSoDoDai) * ISNULL(td.KhoVaiSoDo, sd.KhoVaiSoDo)
             * ISNULL((SELECT SUM(cay.SoLuongLop) FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = td.TienDoID), 0)
             * @g AS ThanhTien
    FROM TienDoSanXuat td
    JOIN CongDoanSanXuat c ON c.StageID = td.StageID AND c.MaCongDoan = 'CAT'
    LEFT JOIN DonHangChiTietSoDo sd ON sd.ID = td.SoDoID
    WHERE td.DonHangID = @id
      AND EXISTS (SELECT 1 FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = td.TienDoID)
    ORDER BY td.TienDoID`)).recordset.map((r, i) => ({
      SoSo: i + 1, SttSoCat: r.SttSoCat, NgayGhiNhan: r.NgayGhiNhan,
      MetSoDo: r.MetSoDo == null ? null : Number(r.MetSoDo),
      KhoVai: r.KhoVai == null ? null : Number(r.KhoVai),
      TongLop: Number(r.TongLop) || 0,
      DonGia: donGiaCat,
      ThanhTien: lam2(r.ThanhTien),
      ThieuSoDo: r.MetSoDo == null || r.KhoVai == null   // chưa khai mét/khổ sơ đồ -> tiền = 0
    }));

  // ---- 5. CHI PHÍ CHUNG (nhập tay) ----
  const chiPhiChung = (await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT ID, TenChiPhi, SoTien, GhiChu FROM ChiPhiChungDonHang WHERE DonHangID=@id ORDER BY ISNULL(ThuTu, ID), ID`)).recordset
    .map(r => ({ ID: r.ID, TenChiPhi: r.TenChiPhi, SoTien: Number(r.SoTien) || 0, GhiChu: r.GhiChu || '' }));

  const tong = (ds, k) => lam2(ds.reduce((s, x) => s + (Number(x[k]) || 0), 0));
  const tongVai = tong(vai, 'ThanhTien');
  const tongPK = tong(phuKien, 'ThanhTien');
  const tongGC = tong(giaCong, 'ThanhTien');
  const tongMay = tong(mayNhaLam, 'ThanhTien');
  const tongIn = tong(inThe, 'ThanhTien');
  const tongCat = tong(boPhanCat, 'ThanhTien');   // v6.17
  const tongChung = tong(chiPhiChung, 'SoTien');
  const tongCong = lam2(tongVai + tongPK + tongGC + tongMay + tongIn + tongCat + tongChung);

  // SL hoàn thành: ưu tiên SL NHẬP KHO thực tế; chưa nhập kho thì lấy SL cắt (báo rõ đang lấy nguồn nào).
  const stages = (await pool.request().query("SELECT StageID, MaCongDoan FROM CongDoanSanXuat WHERE MaCongDoan IN ('KN','CAT')")).recordset;
  const knStage = stages.find(s => s.MaCongDoan === 'KN');
  const catStage = stages.find(s => s.MaCongDoan === 'CAT');
  const slNhapKho = knStage ? await getStageActualQty(pool, donHangId, knStage.StageID) : 0;
  const slCat = catStage ? await getTongSLCatForOrder(pool, donHangId) : 0;
  const slDungTinh = slNhapKho > 0 ? slNhapKho : slCat;
  const nguonSL = slNhapKho > 0 ? 'SL nhập kho thực tế' : (slCat > 0 ? 'SL cắt (chưa nhập kho)' : 'chưa có số liệu');

  return {
    order: {
      MaDH: order.MaDH, TenSanPham: order.TenSanPham, MaSanPham: order.MaSanPham, Size: order.Size,
      TenKhachHang: order.TenKhachHang || null, TongSoLuong: order.TongSoLuong, AnhSanPham: order.AnhSanPham || null,
      HeSoQuyDoi: order.HeSoQuyDoi, TenDonViQuyDoi: order.TenDonViQuyDoi, PhepTinhQuyDoi: order.PhepTinhQuyDoi,
      MaRap: await getMaRapCuaDon(pool, donHangId), DonViTinhLenh: await getDonViTinhCuaDon(pool, donHangId)
    },
    vai, phuKien, giaCong, mayNhaLam, inThe, boPhanCat, chiPhiChung, donGiaCat,
    tong: { vai: tongVai, phuKien: tongPK, giaCong: tongGC, mayNhaLam: tongMay, inThe: tongIn, boPhanCat: tongCat, chiPhiChung: tongChung, tongCong },
    slNhapKho, slCat, slDungTinh, nguonSL,
    giaThanh1SP: slDungTinh > 0 ? Math.round((tongCong / slDungTinh) * 100) / 100 : null
  };
}
// Danh sách lệnh SX để chọn (kèm tổng chi phí nhanh — chỉ để nhìn, chi tiết mở từng lệnh).
router.get('/giathanh', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'giathanh'), async (req, res) => {
  const pool = await getPool();
  const rows = (await pool.request().query(`
    SELECT d.DonHangID, d.MaDH, d.TenSanPham, d.MaSanPham, d.TongSoLuong, d.TrangThai,
           (SELECT COUNT(*) FROM ChiPhiChungDonHang cp WHERE cp.DonHangID = d.DonHangID) AS SoChiPhiChung
    FROM DonHangSanXuat d ORDER BY d.DonHangID DESC`)).recordset;
  res.json({ success: true, data: rows });
});
router.get('/giathanh/:maDH', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'giathanh'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    res.json({ success: true, data: await tinhGiaThanh(pool, order) });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi tính giá thành: ' + err.message });
  }
});
// Ghi đè danh sách CHI PHÍ CHUNG của 1 lệnh SX (xóa hết rồi chèn lại — cùng cách với Chỉ định vải SX).
router.put('/giathanh/:maDH/chiphichung', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'giathanh'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const items = (Array.isArray(req.body.items) ? req.body.items : [])
      .filter(it => String(it.tenChiPhi || '').trim() || Number(it.soTien) > 0);
    await pool.request().input('id', sql.Int, order.DonHangID).query('DELETE FROM ChiPhiChungDonHang WHERE DonHangID=@id');
    let i = 0;
    for (const it of items) {
      i++;
      await pool.request()
        .input('DonHangID', sql.Int, order.DonHangID)
        .input('TenChiPhi', sql.NVarChar(200), String(it.tenChiPhi || 'Chi phí chung').trim().slice(0, 200))
        .input('SoTien', sql.Decimal(18, 2), Number(it.soTien) || 0)
        .input('GhiChu', sql.NVarChar(255), it.ghiChu || null)
        .input('ThuTu', sql.Int, i)
        .query(`INSERT INTO ChiPhiChungDonHang (DonHangID, TenChiPhi, SoTien, GhiChu, ThuTu)
                VALUES (@DonHangID, @TenChiPhi, @SoTien, @GhiChu, @ThuTu)`);
    }
    res.json({ success: true, data: { soDong: items.length } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu chi phí chung: ' + err.message });
  }
});

// ============ MA CONG DOAN (MAY) + DON GIA CONG DOAN MAY ============
// v5.0: bo sung Ma cong doan / Bo phan cho danh muc CongDoanMay da co, + bang gia rieng dung tinh
// luong cong nhan may sau nay (1 cong doan = 1 don gia dang dung, sua de cap nhat gia moi).
router.get('/dongiamay', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'dongiamay'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT cd.CongDoanMayID, cd.MaCongDoan, cd.TenCongDoan, cd.BoPhanMay, cd.GhiChu,
           g.ID AS DonGiaID, g.DonGia, g.HeSo
    FROM CongDoanMay cd
    LEFT JOIN DonGiaCongDoanMay g ON g.CongDoanMayID = cd.CongDoanMayID
    ORDER BY cd.TenCongDoan`);
  res.json({ success: true, data: result.recordset });
});

router.post('/macongdoan', requireAuth, requirePermission('QLSX', 'create'), requireChucNang('QLSX', 'dongiamay'), async (req, res) => {
  try {
    const { maCongDoan, tenCongDoan, boPhanMay, ghiChu } = req.body;
    if (!tenCongDoan) return res.status(400).json({ success: false, message: 'Thiếu tên công đoạn.' });
    const pool = await getPool();
    const result = await pool.request()
      .input('MaCongDoan', sql.NVarChar, maCongDoan || null)
      .input('TenCongDoan', sql.NVarChar, tenCongDoan)
      .input('BoPhanMay', sql.NVarChar, boPhanMay || null)
      .input('GhiChu', sql.NVarChar, ghiChu || null)
      .query(`INSERT INTO CongDoanMay (MaCongDoan, TenCongDoan, BoPhanMay, GhiChu)
              OUTPUT INSERTED.* VALUES (@MaCongDoan, @TenCongDoan, @BoPhanMay, @GhiChu)`);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi thêm công đoạn (tên có thể đã tồn tại): ' + err.message });
  }
});

router.put('/dongiamay/:congDoanMayId', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'dongiamay'), async (req, res) => {
  try {
    const { donGia, heSo } = req.body;
    const pool = await getPool();
    const cdId = req.params.congDoanMayId;
    const existing = await pool.request().input('id', sql.Int, cdId).query('SELECT ID FROM DonGiaCongDoanMay WHERE CongDoanMayID=@id');
    if (existing.recordset.length) {
      await pool.request().input('id', sql.Int, cdId).input('g', sql.Decimal(14, 2), Number(donGia) || 0).input('h', sql.Decimal(10, 4), Number(heSo) || 1)
        .query('UPDATE DonGiaCongDoanMay SET DonGia=@g, HeSo=@h, UpdatedAt=SYSDATETIME() WHERE CongDoanMayID=@id');
    } else {
      await pool.request().input('id', sql.Int, cdId).input('g', sql.Decimal(14, 2), Number(donGia) || 0).input('h', sql.Decimal(10, 4), Number(heSo) || 1)
        .query('INSERT INTO DonGiaCongDoanMay (CongDoanMayID, DonGia, HeSo) VALUES (@id, @g, @h)');
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu đơn giá: ' + err.message });
  }
});

// Tai file mau Excel (dung lam file de nhap lieu roi tai len lai qua /dongiamay/import)
router.get('/dongiamay/template', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'dongiamay'), async (req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Mã công đoạn', 'Tên công đoạn', 'Bộ phận', 'Đơn giá', 'Hệ số'],
    ['MC001', 'May cổ', '1 kim', 500, 1]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'DonGiaCongDoanMay');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="Mau_DonGiaCongDoanMay.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// Tai file Excel len de nhap/cap nhat hang loat Ma cong doan + Don gia (theo dung cot cua file mau tren)
router.post('/dongiamay/import', requireAuth, requirePermission('QLSX', 'create'), requireChucNang('QLSX', 'dongiamay'), memUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Không nhận được file.' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
    const pool = await getPool();
    let count = 0;
    for (const r of rows) {
      const maCongDoan = r['Mã công đoạn'] || r['MaCongDoan'] || null;
      const tenCongDoan = r['Tên công đoạn'] || r['TenCongDoan'];
      const boPhanMay = r['Bộ phận'] || r['BoPhanMay'] || null;
      const donGia = Number(r['Đơn giá'] || r['DonGia']) || 0;
      const heSo = Number(r['Hệ số'] || r['HeSo']) || 1;
      if (!tenCongDoan) continue;

      let cdResult = await pool.request().input('t', sql.NVarChar, tenCongDoan).query('SELECT CongDoanMayID FROM CongDoanMay WHERE TenCongDoan=@t');
      let cdId;
      if (cdResult.recordset.length) {
        cdId = cdResult.recordset[0].CongDoanMayID;
        await pool.request().input('id', sql.Int, cdId).input('ma', sql.NVarChar, maCongDoan).input('bp', sql.NVarChar, boPhanMay)
          .query('UPDATE CongDoanMay SET MaCongDoan=@ma, BoPhanMay=@bp WHERE CongDoanMayID=@id');
      } else {
        const ins = await pool.request().input('ma', sql.NVarChar, maCongDoan).input('t', sql.NVarChar, tenCongDoan).input('bp', sql.NVarChar, boPhanMay)
          .query('INSERT INTO CongDoanMay (MaCongDoan, TenCongDoan, BoPhanMay) OUTPUT INSERTED.CongDoanMayID VALUES (@ma, @t, @bp)');
        cdId = ins.recordset[0].CongDoanMayID;
      }

      const giaExisting = await pool.request().input('id', sql.Int, cdId).query('SELECT ID FROM DonGiaCongDoanMay WHERE CongDoanMayID=@id');
      if (giaExisting.recordset.length) {
        await pool.request().input('id', sql.Int, cdId).input('g', sql.Decimal(14, 2), donGia).input('h', sql.Decimal(10, 4), heSo)
          .query('UPDATE DonGiaCongDoanMay SET DonGia=@g, HeSo=@h, UpdatedAt=SYSDATETIME() WHERE CongDoanMayID=@id');
      } else {
        await pool.request().input('id', sql.Int, cdId).input('g', sql.Decimal(14, 2), donGia).input('h', sql.Decimal(10, 4), heSo)
          .query('INSERT INTO DonGiaCongDoanMay (CongDoanMayID, DonGia, HeSo) VALUES (@id, @g, @h)');
      }
      count++;
    }
    res.json({ success: true, data: { count } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi nhập Excel: ' + err.message });
  }
});

// ============ GIAO VAI SAN XUAT TAM (chua tru The kho vai - xem migration_v5_qlsx.sql) ============
// Proxy sang du lieu cay vai kho (vw_TonCayVai) de man hinh QLSX chon cay ma khong can quyen module KHOVAI.
router.get('/vaicay-kho', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().query('SELECT * FROM vw_TonCayVai WHERE KGCon > 0 ORDER BY NgayNhap DESC');
  res.json({ success: true, data: result.recordset });
});

// v5.2: giong /vaicay-kho nhung LOC theo dung loai vai + mau da khai bao o "Ra lenh san xuat" cho don
// hang nay (ca mau chinh va mau phoi) - dung cho cong doan "Giao vai" trong Ghi tien do, tranh hien het
// toan bo cay con ton trong kho (yeu cau v5.2 muc 4). Neu dong chi tiet vai chua chon Loai vai (loaiVaiId
// null luc Ra lenh), chi loc theo Mau de khong bo sot cay hop le.
router.get('/orders/:maDH/vaicay-kho-loc', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const result = await pool.request().input('id', sql.Int, order.DonHangID).query(`
    SELECT DISTINCT vc.* FROM vw_TonCayVai vc
    JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
    JOIN DonHangChiTietVai ct ON ct.DonHangID = @id AND ct.MauSacID = dv.MauSacID
      AND (ct.LoaiVaiID IS NULL OR ct.LoaiVaiID = dv.LoaiVaiID)
    WHERE vc.KGCon > 0
    ORDER BY vc.NgayNhap DESC`);
  res.json({ success: true, data: result.recordset });
});

router.get('/orders/:maDH/giaovai', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const data = await getGiaoVaiSanXuat(pool, order.DonHangID);
  res.json({ success: true, data });
});

router.post('/orders/:maDH/giaovai', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  try {
    const user = req.session.user;
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const { ngayGiao, rolls } = req.body;
    if (!ngayGiao || !Array.isArray(rolls) || !rolls.length) {
      return res.status(400).json({ success: false, message: 'Thiếu ngày giao hoặc danh sách cây vải.' });
    }
    for (const r of rolls) {
      if (!r.cayId) continue;
      await pool.request()
        .input('DonHangID', sql.Int, order.DonHangID)
        .input('CayID', sql.Int, r.cayId)
        .input('KGGiao', sql.Decimal(10, 2), Number(r.kgGiao) || 0)
        .input('NgayGiao', sql.Date, ngayGiao)
        .input('GhiChu', sql.NVarChar, r.ghiChu || null)
        .input('NguoiTaoID', sql.Int, user.userId)
        .query(`INSERT INTO GiaoVaiSanXuat (DonHangID, CayID, KGGiao, NgayGiao, GhiChu, NguoiTaoID)
                VALUES (@DonHangID, @CayID, @KGGiao, @NgayGiao, @GhiChu, @NguoiTaoID)`);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi giao vải sản xuất: ' + err.message });
  }
});

router.delete('/orders/:maDH/giaovai/:id', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM GiaoVaiSanXuat WHERE ID=@id');
  res.json({ success: true });
});

// ============ PHU KIEN CAN DUNG - NAY LA 1 CONG DOAN RIENG TRONG GHI TIEN DO (v5.2) ============
// Truoc day chi ghi duoc luc "Ra lenh san xuat" (tao 1 lan, khong sua/them duoc sau do). Tu v5.2, phan
// "Phu kien can dung" bi bo khoi form Ra lenh (xem POST /orders, frontend khong con gui chiTietPhuKien
// luc tao) va chuyen sang ghi nhan tai cong doan "Phu kien" trong Ghi tien do, dung 3 route CRUD nay
// (mirror dung pattern GET/POST/DELETE cua GiaoVaiSanXuat o tren).
router.get('/orders/:maDH/phukien', requireAuth, requirePermission('QLSX', 'view'), requireChucNangAny('QLSX', ['tiendo', 'chidinhnpl']), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const ten = req.query.ten != null ? String(req.query.ten) : undefined;   // v5.54: lọc theo bản (bỏ trống = tất cả)
  const data = await getChiTietPhuKien(pool, order.DonHangID, ten);
  res.json({ success: true, data });
});
// v5.54: danh sách BẢN chỉ định NPL của 1 đơn.
router.get('/orders/:maDH/phukien-phieu', requireAuth, requirePermission('QLSX', 'view'), requireChucNangAny('QLSX', ['tiendo', 'chidinhnpl']), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const phieu = (await pool.request().input('id', sql.Int, order.DonHangID).query(`
    SELECT ISNULL(TenPhieu, N'') AS TenPhieu, COUNT(*) AS SoDong
    FROM DonHangChiTietPhuKien WHERE DonHangID=@id GROUP BY ISNULL(TenPhieu, N'') ORDER BY ISNULL(TenPhieu, N'')`)).recordset;
  res.json({ success: true, data: phieu });
});
router.delete('/orders/:maDH/phukien-phieu', requireAuth, requirePermission('QLSX', 'edit'), requireChucNangAny('QLSX', ['tiendo', 'chidinhnpl']), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  await pool.request().input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten)
    .query("DELETE FROM DonHangChiTietPhuKien WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ten");
  res.json({ success: true });
});

router.post('/orders/:maDH/phukien', requireAuth, requirePermission('QLSX', 'edit'), requireChucNangAny('QLSX', ['tiendo', 'chidinhnpl']), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const { rows } = req.body;
    const tenPhieu = req.body.tenPhieu != null ? String(req.body.tenPhieu) : null;   // v5.54: bản NPL
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ success: false, message: 'Thiếu danh sách phụ kiện.' });
    }
    for (const pk of rows) {
      if (!pk.phuKienId) continue;
      await pool.request()
        .input('DonHangID', sql.Int, order.DonHangID)
        .input('TenPhieu', sql.NVarChar, tenPhieu)
        .input('PhuKienID', sql.Int, pk.phuKienId)
        .input('SoLuong', sql.Decimal(14, 2), Number(pk.soLuong) || 0)
        .input('DonVi', sql.NVarChar, pk.donVi || null)
        .input('GhiChu', sql.NVarChar, pk.ghiChu || null)
        .query(`INSERT INTO DonHangChiTietPhuKien (DonHangID, TenPhieu, PhuKienID, SoLuong, DonVi, GhiChu)
                VALUES (@DonHangID, @TenPhieu, @PhuKienID, @SoLuong, @DonVi, @GhiChu)`);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi ghi nhận phụ kiện: ' + err.message });
  }
});

router.delete('/orders/:maDH/phukien/:id', requireAuth, requirePermission('QLSX', 'edit'), requireChucNangAny('QLSX', ['tiendo', 'chidinhnpl']), async (req, res) => {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM DonHangChiTietPhuKien WHERE ID=@id');
  res.json({ success: true });
});

// ============ CONG DOAN MAY GAN RIENG CHO DON HANG + DON GIA RIENG (v5.2, dung o cong doan "Ky thuat") ============
// Khac DonGiaCongDoanMay (gia MAC DINH toan he thong, xem /dongiamay o tren): bang DonHangCongDoanMay
// luu dung gia/he so AP DUNG CHO DON HANG NAY (co the khac gia mac dinh tuy do phuc tap tung don), theo
// yeu cau v5.2: "cap nhat don gia tung cong doan de tinh luong sau nay". GET tra ve TOAN BO danh muc
// CongDoanMay kem co (DaChon) + gia dang ap dung (uu tien gia rieng don hang, fallback gia mac dinh) de
// ve checklist o form "Ky thuat"; PUT ghi de toan bo danh sach da chon (xoa het roi chen lai).
router.get('/orders/:maDH/congdoanmay', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const result = await pool.request().input('id', sql.Int, order.DonHangID).query(`
    SELECT cd.CongDoanMayID, cd.MaCongDoan, cd.TenCongDoan, cd.BoPhanMay,
           ISNULL(dhg.DonGia, g.DonGia) AS DonGia, ISNULL(dhg.HeSo, g.HeSo) AS HeSo,
           CASE WHEN dhg.ID IS NULL THEN 0 ELSE 1 END AS DaChon
    FROM CongDoanMay cd
    LEFT JOIN DonGiaCongDoanMay g ON g.CongDoanMayID = cd.CongDoanMayID
    LEFT JOIN DonHangCongDoanMay dhg ON dhg.CongDoanMayID = cd.CongDoanMayID AND dhg.DonHangID = @id
    ORDER BY cd.TenCongDoan`);
  res.json({ success: true, data: result.recordset });
});

// v5.34c (Giai doan C, muc 6): May giao viec lay cong doan tu "Đơn giá công đoạn may" MOI (Tai lieu may),
// khong con tu DonHangCongDoanMay (KT) nua. Chi doc (ID/TenCongDoan/ThanhTien) - don gia sua o Tai lieu may.
router.get('/orders/:maDH/dongiacongdoanmay', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const result = await pool.request().input('id', sql.Int, order.DonHangID).query(`
    SELECT ID, TenCongDoan, GiayGio, HeSoCongDoan, HeSoCongNhan, ThanhTien
    FROM DonHangDonGiaCongDoanMay WHERE DonHangID = @id
      -- v5.56: đơn giá may có thể có NHIỀU BẢN → chỉ lấy BẢN ĐẦU TIÊN cho ô chọn công đoạn khi giao việc May
      -- (nếu lấy hết, danh sách công đoạn bị lặp và giao việc dễ chọn sai bản).
      AND ISNULL(TenPhieu, N'') = (SELECT MIN(ISNULL(x.TenPhieu, N'')) FROM DonHangDonGiaCongDoanMay x WHERE x.DonHangID = @id)
    ORDER BY ThuTu, ID`);
  res.json({ success: true, data: result.recordset });
});

// v5.35: So cat DA GHI NHAN (lan Cat gan nhat) - de XEM LAI + IN so cat ke ca sau khi don da qua cong doan Cat.
router.get('/orders/:maDH/socat', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const catStage = (await pool.request().query("SELECT StageID FROM CongDoanSanXuat WHERE MaCongDoan='CAT'")).recordset[0];
  if (!catStage) return res.json({ success: true, data: { maDH: req.params.maDH, records: [] } });
  const latest = await pool.request().input('id', sql.Int, order.DonHangID).input('stage', sql.Int, catStage.StageID)
    .query('SELECT TOP 1 TienDoID, NhomTienDoID FROM TienDoSanXuat WHERE DonHangID=@id AND StageID=@stage ORDER BY TienDoID DESC');
  if (!latest.recordset.length) return res.json({ success: true, data: { maDH: req.params.maDH, records: [] } });
  const tag = latest.recordset[0].NhomTienDoID || latest.recordset[0].TienDoID;
  /* v5.98: ?tatCa=1 -> trả về MỌI sổ cắt của đơn (mọi lần cắt, mọi sơ đồ), không chỉ lần cắt gần nhất.
     Cần cho màn hình Cắt: vào lại chọn xem/in ĐÚNG sổ cắt nào, và đếm được đã ghi bao nhiêu sơ đồ.
     Không có tham số này thì giữ NGUYÊN hành vi cũ (chỉ lần cắt gần nhất) để không phá chỗ đang dùng. */
  const layTatCa = String(req.query.tatCa || '') === '1';
  const dieuKienTD = layTatCa
    ? 'td.DonHangID = @donId AND td.StageID = @stageId'
    : '(td.TienDoID=@tag OR td.NhomTienDoID=@tag)';
  const ganThamSo = (rq) => {
    if (layTatCa) rq.input('donId', sql.Int, order.DonHangID).input('stageId', sql.Int, catStage.StageID);
    else rq.input('tag', sql.Int, tag);
    return rq;
  };
  /* v5.89 — SỬA "Mét sơ đồ / Khổ / Mã rập KHÔNG hiện trên sổ cắt".
     Nguyên nhân: 3 cột đó nằm trên TienDoSanXuat và CHỈ được ghi ở công đoạn Kỹ thuật; khi ghi tiến độ
     CẮT (cả nhánh 1 sơ đồ lẫn nhánh nhiều sơ đồ) không ai ghi -> luôn NULL.
     Cách chữa ở ĐÂY (đọc) thay vì ở chỗ ghi: lấy bù từ chính SƠ ĐỒ đã chọn (td.SoDoID ->
     DonHangChiTietSoDo) — nhờ vậy các bản ghi CŨ cũng hiện đủ ngay, không phải sửa dữ liệu.
     Đồng thời gộp ĐẦY ĐỦ người trải vải (TienDoTraiVai có thể 2 người; cột đơn lẻ chỉ giữ người đầu). */
  const recs = (await ganThamSo(pool.request()).query(`
    SELECT td.TienDoID, td.NgayGhiNhan, td.SttSoCat, td.SoDoID,
           ISNULL(td.MetSoDoDai, sd.MetSoDoDai) AS MetSoDoDai,
           ISNULL(td.KhoVaiSoDo, sd.KhoVaiSoDo) AS KhoVaiSoDo,
           ISNULL(NULLIF(LTRIM(RTRIM(ISNULL(td.MaRap, N''))), N''), sd.MaRap) AS MaRap,
           nvc.HoTen AS NhanVienCat,
           ISNULL(STUFF((SELECT ', ' + nv2.HoTen FROM TienDoTraiVai tv
                         JOIN NhanVien nv2 ON nv2.NhanVienID = tv.NhanVienID
                         WHERE tv.TienDoID = td.TienDoID FOR XML PATH('')), 1, 2, ''), nvt.HoTen) AS NhanVienTraiVai
    FROM TienDoSanXuat td
    LEFT JOIN NhanVien nvc ON nvc.NhanVienID = td.NhanVienCatID
    LEFT JOIN NhanVien nvt ON nvt.NhanVienID = td.NhanVienTraiVaiID
    LEFT JOIN DonHangChiTietSoDo sd ON sd.ID = td.SoDoID
    WHERE ${dieuKienTD}
      AND EXISTS (SELECT 1 FROM TienDoCatChiTietCay c WHERE c.TienDoID=td.TienDoID)
    ORDER BY td.TienDoID`)).recordset;
  const coAnhCay = await coCotQLSX(pool, 'TienDoCatChiTietCay', 'AnhCay');   // v5.87
  const coGiatCap = await coCotQLSX(pool, 'TienDoCatChiTietCay', 'SoCaiGiatCap');   // v6.01
  const cays = (await ganThamSo(pool.request()).query(`
    SELECT cay.TienDoID, cay.CayID, cay.SttCay, cay.SoLuongLop, cay.HeSoQuyDoi, cay.SoLuongCai, cay.SoKgMetSuDung,
           vc.MaCay, ms.TenMau, lv.TenLoaiVai,
           ${coGiatCap ? 'cay.SoCaiGiatCap' : 'CAST(NULL AS INT) AS SoCaiGiatCap'},
           ${coAnhCay ? 'cay.AnhCay' : "CAST(NULL AS NVARCHAR(500)) AS AnhCay"}
    FROM TienDoCatChiTietCay cay
    JOIN TienDoSanXuat td ON td.TienDoID = cay.TienDoID
    JOIN VaiCay vc ON vc.CayID = cay.CayID
    JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
    WHERE ${dieuKienTD}
    ORDER BY cay.TienDoID, cay.ID`)).recordset;
  /* v5.90: SỐ THỨ TỰ SƠ ĐỒ dạng "1/2" — đơn có nhiều sơ đồ thì mỗi sổ cắt phải nói rõ đang cắt sơ đồ
     thứ mấy trên tổng bao nhiêu. Thứ tự lấy theo đúng thứ tự sơ đồ của đơn (DonHangChiTietSoDo.ID). */
  const soDoList = await getSoDoList(pool, order.DonHangID);
  const viTriSoDo = {};
  soDoList.forEach((s, i) => { viTriSoDo[s.ID] = i + 1; });
  const records = recs.map(r => ({
    ...r,
    SoDoThuTu: r.SoDoID != null ? (viTriSoDo[r.SoDoID] || null) : null,
    TongSoSoDo: soDoList.length,
    cays: cays.filter(c => c.TienDoID === r.TienDoID)
  }));
  // v5.89: kèm thông tin ĐƠN HÀNG để bản in sổ cắt có đầu phiếu đầy đủ (trước chỉ có mỗi Mã ĐH).
  const order4in = {
    MaDH: order.MaDH, MaSanPham: order.MaSanPham, TenSanPham: order.TenSanPham,
    TenKhachHang: order.TenKhachHang || null, TongSoLuong: order.TongSoLuong,
    NgayGiaoDuKien: order.NgayGiaoDuKien, Size: order.Size,
    AnhSanPham: order.AnhSanPham || null,   // v5.90: ảnh đơn hàng trên bản in sổ cắt
    TongSoSoDo: soDoList.length,
    MaRap: [...new Set(soDoList.map(s => s.MaRap).filter(Boolean))].join(', ')
  };
  res.json({ success: true, data: { maDH: req.params.maDH, order: order4in, records } });
});

// v5.38: đọc giao việc LA (là) / DG (đóng gói) đã ghi (theo màu) - hiện "đã giao" ở công đoạn LA/DG.
router.get('/orders/:maDH/phancongladonggoi', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const rows = (await pool.request().input('id', sql.Int, order.DonHangID).query(`
    SELECT pc.ID, pc.NhanVienID, nv.HoTen AS TenNhanVien, pc.MauSacID, ms.TenMau, pc.SoLuong, c.MaCongDoan, td.NgayGhiNhan
    FROM PhanCongLaDongGoi pc
    JOIN TienDoSanXuat td ON td.TienDoID = pc.TienDoID
    JOIN CongDoanSanXuat c ON c.StageID = td.StageID
    JOIN NhanVien nv ON nv.NhanVienID = pc.NhanVienID
    LEFT JOIN MauSac ms ON ms.MauSacID = pc.MauSacID
    WHERE td.DonHangID = @id AND c.MaCongDoan IN ('LA','DG')
    ORDER BY td.NgayGhiNhan DESC, pc.ID DESC`)).recordset;
  res.json({ success: true, data: rows });
});

router.put('/orders/:maDH/congdoanmay', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const { items } = req.body;
    // v5.7: loai TRUNG CongDoanMayID trong danh sach gui len - fix GOC loi thuc te da xay ra "Violation
    // of UNIQUE KEY constraint 'UQ_DonHangCongDoanMay'... duplicate key value is (1009, 6)". Nguyen nhan
    // o frontend: 1 loi hiem trong o-go-tim (wireSearchableSelect ve lai khu vuc NGAY luc dang xu ly su
    // kien chon ket qua, lam o input dang go bi go khoi DOM giua chung khien trinh duyet tu phat sinh
    // them 1 su kien 'change' phu, goi lai callback chon 1 lan nua cho CUNG 1 lan chon - xem
    // module.qlsx.js). Da them 1 lop chan o frontend (state) + doi render sang tick sau, nhung loc
    // lai o day la lop an toan THAT SU cuoi cung, khong phu thuoc frontend con loi tuong tu nao khac hay
    // khong trong tuong lai.
    const seen = new Set();
    const dedupedItems = Array.isArray(items) ? items.filter(it => {
      if (!it.congDoanMayId) return false;
      const key = String(it.congDoanMayId);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }) : [];

    // v5.7: boc DELETE+INSERT trong 1 SQL transaction (truoc day KHONG co - moi lenh la 1 giao dich rieng
    // le). Day la route TRUC TIEP gay ra loi that trong yeu cau v5.7: neu 1 INSERT giua chung loi (vi du
    // do 1 nguyen nhan khac chua luong truoc gay trung key), phan DA CHAY truoc do (DELETE + cac INSERT
    // truoc no) van bi giu lai rieng le, chi con LUU DUOC MOT PHAN danh sach - day chinh la nguyen nhan
    // giai thich vi sao "chọn 2 công đoạn may... nhưng sang May chỉ hiển thị công đoạn đầu tiên". Co
    // transaction, loi giua chung se ROLLBACK TOAN BO (giu nguyen danh sach cu), khong con tinh trang
    // "luu duoc 1 nua". Day la lan DAU TIEN dung sql.Transaction trong toan bo code nay (chua co route
    // nao khac dung) - co y CHI ap dung rieng cho route nay vi day la route DUY NHAT da co bao loi that
    // tu nguoi dung, khong ap dung dai tra cho cac route DELETE+INSERT khac trong cung file (xem
    // HUONG_DAN_CAI_DAT.md - phan quyet dinh v5.7 - de biet ly do khong mo rong dai tra).
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction).input('id', sql.Int, order.DonHangID).query('DELETE FROM DonHangCongDoanMay WHERE DonHangID=@id');
      for (const it of dedupedItems) {
        await new sql.Request(transaction)
          .input('DonHangID', sql.Int, order.DonHangID)
          .input('CongDoanMayID', sql.Int, it.congDoanMayId)
          .input('DonGia', sql.Decimal(14, 2), Number(it.donGia) || 0)
          .input('HeSo', sql.Decimal(10, 4), Number(it.heSo) || 1)
          .query(`INSERT INTO DonHangCongDoanMay (DonHangID, CongDoanMayID, DonGia, HeSo) VALUES (@DonHangID, @CongDoanMayID, @DonGia, @HeSo)`);
      }
      await transaction.commit();
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu công đoạn may cho đơn hàng: ' + err.message });
  }
});

// ============ DON GIA GIA CONG (v5.24 muc 1.1.1, "thêm trường đơn giá Giao gia công. Thêm nhiều dòng
// đơn giá") ============ Mirror dung cap CongDoanMay/DonGiaCongDoanMay/DonHangCongDoanMay o tren, don
// gian hon 1 bang (DonGiaMacDinh/HeSoMacDinh nam thang tren HangMucGiaCong, khong tach rieng bang gia
// mac dinh) - danh muc khai bao o Ky thuat (nhieu dong), gia THUC TE cho DUNG don hang co the ghi de
// rieng (DonHangHangMucGiaCong, giong DonHangCongDoanMay). Day CHI la 1 bang gia THAM KHAO/ke hoach o
// Ky thuat - KHONG lien ket voi DonGia nhap rieng cho tung dong "Nha gia cong chi tiet" o cong doan
// "Giao gia công" (2 co che doc lap: 1 ben la don gia THEO HANG MUC lam viec, 1 ben la don gia da
// THUONG LUONG voi TUNG NHA GIA CONG cu the).
// v5.25 (phan hoi truc tiep "Đơn giá sẽ được nhập liệu ở chỗ này không cần thêm chức năng đơn giá gia
// công (xóa chức năng đơn giá gia công)"): BO HAN man hinh danh muc rieng "Đơn giá gia công" (tab do
// CHUA BAO GIO co ham render o frontend - loi ReferenceError neu bam vao, xem module.qlsx.js) - GET
// /dongiagiacong (danh sach toan bo danh muc) va PUT /dongiagiacong/:id (sua gia mac dinh CUA rieng
// danh muc) khong con ai goi nua, da XOA. POST /hangmucgiacong (them hang muc MOI) VAN GIU vi day la
// route dung boi nut "+ Mới" NGAY trong khu vuc "Đơn giá Giao gia công" o Ky thuat (khong con man hinh
// danh muc rieng nao goi ChucNang 'dongiagiacong' nua nen doi gate sang 'tiendo' cho dung boi canh su
// dung THUC TE - xem migration_v524.sql, da bo dong seed ChucNang 'dongiagiacong').
router.post('/hangmucgiacong', requireAuth, requirePermission('QLSX', 'create'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  try {
    const { tenHangMuc, donGiaMacDinh, heSoMacDinh, ghiChu } = req.body;
    if (!tenHangMuc) return res.status(400).json({ success: false, message: 'Thiếu tên hạng mục.' });
    const pool = await getPool();
    const result = await pool.request()
      .input('Ten', sql.NVarChar, tenHangMuc)
      .input('DonGia', sql.Decimal(14, 2), donGiaMacDinh || null)
      .input('HeSo', sql.Decimal(10, 4), heSoMacDinh || 1)
      .input('GhiChu', sql.NVarChar, ghiChu || null)
      .query(`INSERT INTO HangMucGiaCong (TenHangMuc, DonGiaMacDinh, HeSoMacDinh, GhiChu)
              OUTPUT INSERTED.* VALUES (@Ten, @DonGia, @HeSo, @GhiChu)`);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi thêm hạng mục (tên có thể đã tồn tại): ' + err.message });
  }
});

router.get('/orders/:maDH/hangmucgiacong', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const result = await pool.request().input('id', sql.Int, order.DonHangID).query(`
    SELECT hm.HangMucGiaCongID, hm.TenHangMuc,
           ISNULL(dhg.DonGia, hm.DonGiaMacDinh) AS DonGia, ISNULL(dhg.HeSo, hm.HeSoMacDinh) AS HeSo,
           CASE WHEN dhg.ID IS NULL THEN 0 ELSE 1 END AS DaChon
    FROM HangMucGiaCong hm
    -- v5.56: nhiều bản đơn giá gia công → TOP 1 (bản đầu tiên), tránh nhân dòng hạng mục trong danh sách.
    OUTER APPLY (SELECT TOP 1 x.ID, x.DonGia, x.HeSo FROM DonHangHangMucGiaCong x
                 WHERE x.HangMucGiaCongID = hm.HangMucGiaCongID AND x.DonHangID = @id
                 ORDER BY ISNULL(x.TenPhieu, N''), x.ID) dhg
    ORDER BY hm.TenHangMuc`);
  res.json({ success: true, data: result.recordset });
});

router.put('/orders/:maDH/hangmucgiacong', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const { items } = req.body;
    // v5.7 (fix goc cho congdoanmay, ap dung cung phong ngua o day): loai TRUNG HangMucGiaCongID + boc
    // trong 1 transaction, tranh loi UNIQUE KEY / luu duoc 1 phan - xem ghi chu chi tiet tai PUT
    // /orders/:maDH/congdoanmay o tren.
    const seen = new Set();
    const dedupedItems = Array.isArray(items) ? items.filter(it => {
      if (!it.hangMucGiaCongId) return false;
      const key = String(it.hangMucGiaCongId);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }) : [];
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      // v5.56: màn Kỹ thuật này chỉ quản lý BẢN KHÔNG TÊN (bản mặc định) — KHÔNG xóa các bản có tên do
      // tab "Đơn giá giao gia công" (Tài liệu may) tạo, nếu không lưu ở đây sẽ NUỐT hết các bản kia.
      await new sql.Request(transaction).input('id', sql.Int, order.DonHangID)
        .query(`DELETE FROM DonHangHangMucGiaCong WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=N''`);
      for (const it of dedupedItems) {
        await new sql.Request(transaction)
          .input('DonHangID', sql.Int, order.DonHangID)
          .input('HangMucGiaCongID', sql.Int, it.hangMucGiaCongId)
          .input('DonGia', sql.Decimal(14, 2), Number(it.donGia) || 0)
          .input('HeSo', sql.Decimal(10, 4), Number(it.heSo) || 1)
          .query(`INSERT INTO DonHangHangMucGiaCong (DonHangID, HangMucGiaCongID, DonGia, HeSo) VALUES (@DonHangID, @HangMucGiaCongID, @DonGia, @HeSo)`);
      }
      await transaction.commit();
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu đơn giá gia công cho đơn hàng: ' + err.message });
  }
});

// ============ GIAO VIEC NOI BO (PhanCongMay) DA GHI NHAN - xem lai + Admin sua (v5.5) ============
// Truoc v5.5, khoi "Giao viec noi bo" o cong doan May la MOT CHIEU: them dong -> Gui -> INSERT vao
// PhanCongMay, nhung KHONG co API nao doc lai nhung gi da giao truoc do - moi lan mo lai form May la
// 1 form trang moi, khong thay lai lich su da giao. Route GET nay liet ke TOAN BO PhanCongMay cua don
// hang (qua moi lan ghi tien do May, khong chi lan gan nhat) de hien thi trong form; PUT chi Admin
// (yeu cau v5.5 "Quyen Admin co the sua ten nhan vien va so luong da giao") duoc sua lai 1 dong.
router.get('/orders/:maDH/phancongmay', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const result = await pool.request().input('id', sql.Int, order.DonHangID).query(`
    SELECT pc.ID, pc.NhanVienID, nv.HoTen AS TenNhanVien, pc.CongDoanMayID, pc.DonGiaCongDoanMayID,
           ISNULL(dm.TenCongDoan, cd.TenCongDoan) AS TenCongDoan,
           pc.MauSacID, ms.TenMau, pc.SoLuong, td.NgayGhiNhan
    FROM PhanCongMay pc
    JOIN TienDoSanXuat td ON td.TienDoID = pc.TienDoID
    JOIN NhanVien nv ON nv.NhanVienID = pc.NhanVienID
    LEFT JOIN CongDoanMay cd ON cd.CongDoanMayID = pc.CongDoanMayID
    LEFT JOIN DonHangDonGiaCongDoanMay dm ON dm.ID = pc.DonGiaCongDoanMayID
    LEFT JOIN MauSac ms ON ms.MauSacID = pc.MauSacID
    WHERE td.DonHangID = @id
    ORDER BY td.NgayGhiNhan DESC, pc.ID DESC`);
  res.json({ success: true, data: result.recordset });
});

/* v6.18 — BỎ chặn cứng "chỉ Admin" ở sửa/xóa việc đã giao (v5.5/v5.30).
   Vì sao: chặn bằng cờ isAdmin thì KHÔNG PHÂN QUYỀN ĐƯỢC — admin phải tự làm hộ tổ May, còn cấp quyền
   trong Ma trận phân quyền cũng vô tác dụng. Nay 2 route này đi theo đúng ma trận như mọi route khác:
   requirePermission('QLSX','edit'/'delete') + requireChucNang('QLSX','tiendo'). Muốn giữ chặt thì chỉ cần
   KHÔNG cấp quyền Sửa/Xóa chức năng "Ghi nhận tiến độ" cho nhóm đó. */
router.put('/orders/:maDH/phancongmay/:id', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  try {
    const { nhanVienId, soLuong } = req.body;
    if (!nhanVienId) return res.status(400).json({ success: false, message: 'Thiếu nhân viên.' });
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('NhanVienID', sql.Int, nhanVienId)
      .input('SoLuong', sql.Int, Number(soLuong) || 0)
      .query('UPDATE PhanCongMay SET NhanVienID=@NhanVienID, SoLuong=@SoLuong WHERE ID=@id');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi sửa việc đã giao: ' + err.message });
  }
});

// v5.30 (muc 4): xoa 1 dong giao viec noi bo da ghi nhan (nut "Xóa" canh "Sửa" o cong doan May).
// v6.18: bo chan cung isAdmin, doi sang quyen XOA cua chuc nang 'tiendo' (xem ghi chu o PUT ben tren).
router.delete('/orders/:maDH/phancongmay/:id', requireAuth, requirePermission('QLSX', 'delete'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM PhanCongMay WHERE ID=@id');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi xóa việc đã giao: ' + err.message });
  }
});

/* ==================================================================================================
   v6.18 — LƯU NGAY "GIAO VIỆC NỘI BỘ" Ở CÔNG ĐOẠN MAY (không phải bấm "Gửi")
   Nhu cầu: giao việc cho công nhân rải rác trong ngày, giao được ai thì lưu người đó; "Gửi" để dành cho
   lúc CHỐT công đoạn (Gửi mới đẩy con trỏ công đoạn sang bước sau).
   Ràng buộc kỹ thuật: PhanCongMay.TienDoID là NOT NULL ⇒ phải có 1 bản ghi tiến độ May để gắn vào.
   Cách làm: DÙNG LẠI bản ghi tiến độ May của ĐÚNG NGÀY đó nếu đã có (không sinh thêm bản ghi mỗi lần
   bấm Lưu), chưa có thì tạo 1 bản ghi mới — và TUYỆT ĐỐI KHÔNG đụng tới CongDoanHienTaiID / % hoàn thành
   (đó là việc của "Gửi"). Nhờ vậy bấm Lưu nhiều lần trong ngày vẫn chỉ 1 lần ghi nhận May.
   ================================================================================================== */
router.post('/orders/:maDH/giaoviecmay', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  try {
    const pool = await getPool();
    const user = req.session.user;
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const items = (Array.isArray(req.body.items) ? req.body.items : [])
      .filter(g => g.nhanVienId && g.dongiaCongDoanMayId && g.soLuong !== '' && g.soLuong != null);
    if (!items.length) return res.status(400).json({ success: false, message: 'Chưa có dòng giao việc nào (cần chọn nhân viên và nhập số lượng).' });

    const stage = (await pool.request().query(`SELECT TOP 1 StageID FROM CongDoanSanXuat WHERE MaCongDoan = '${MA_CONG_DOAN_MAY}'`)).recordset[0];
    if (!stage) return res.status(400).json({ success: false, message: 'Chưa khai báo công đoạn May trong danh mục.' });
    const ngay = req.body.ngayGhiNhan || new Date();

    // Tìm bản ghi tiến độ May CÙNG NGÀY để gắn thêm vào (tránh mỗi lần Lưu lại sinh 1 lần ghi nhận mới).
    let tienDoId = ((await pool.request().input('id', sql.Int, order.DonHangID).input('st', sql.Int, stage.StageID)
      .input('ng', sql.Date, ngay).query(`
        SELECT TOP 1 TienDoID FROM TienDoSanXuat
        WHERE DonHangID=@id AND StageID=@st AND NgayGhiNhan=@ng ORDER BY TienDoID DESC`)).recordset[0] || {}).TienDoID;
    if (!tienDoId) {
      tienDoId = (await pool.request()
        .input('DonHangID', sql.Int, order.DonHangID)
        .input('NgayGhiNhan', sql.Date, ngay)
        .input('StageID', sql.Int, stage.StageID)
        .input('NguoiCapNhatID', sql.Int, user.userId)
        .input('GhiChu', sql.NVarChar, req.body.ghiChu || 'Giao việc nội bộ (lưu riêng, chưa Gửi)')
        .query(`INSERT INTO TienDoSanXuat (DonHangID, NgayGhiNhan, StageID, NguoiCapNhatID, GhiChu)
                OUTPUT INSERTED.TienDoID
                VALUES (@DonHangID, @NgayGhiNhan, @StageID, @NguoiCapNhatID, @GhiChu)`)).recordset[0].TienDoID;
    }
    for (const g of items) {
      await pool.request()
        .input('TienDoID', sql.Int, tienDoId)
        .input('NhanVienID', sql.Int, g.nhanVienId)
        .input('CongDoanMayID', sql.Int, null)
        .input('DonGiaCongDoanMayID', sql.Int, g.dongiaCongDoanMayId)
        .input('MauSacID', sql.Int, g.mauSacId || null)
        .input('SoLuong', sql.Int, Number(g.soLuong) || 0)
        .query(`INSERT INTO PhanCongMay (TienDoID, NhanVienID, CongDoanMayID, DonGiaCongDoanMayID, MauSacID, SoLuong)
                VALUES (@TienDoID, @NhanVienID, @CongDoanMayID, @DonGiaCongDoanMayID, @MauSacID, @SoLuong)`);
    }
    res.json({ success: true, data: { tienDoId, soDong: items.length } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu giao việc nội bộ: ' + err.message });
  }
});

// ============ LICH SU CAP VAI CHO DON HANG (chi xem - v4.0: bo tao phieu cap vai tu QLSX) ============
// v4.0: bo route POST tao phieu cap vai (+ GET /rolls-available) khoi QLSX - cap vai cho don hang gio
// chi thuc hien tu phan he Kho vai (routes/khovai.js), noi da co day du nghiep vu chon cay/QR/kiem ke.
// GIU LAI route GET nay vi con dung de hien thi lich su "Xuất vải" trong phieu in bao cao don hang (/print).
router.get('/orders/:maDH/vaicap', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const data = await getVaiCapHistory(pool, order.DonHangID);
  res.json({ success: true, data });
});

// ============ GHI NHAN TIEN DO (chuyen sang cong doan tiep theo) ============
// v4.0: form thay doi theo TUNG cong doan (xem module.qlsx.js -> openProgressForm), route nay nhan them:
//  - nhanVienTraiVaiId / nhanVienCatId: rieng cong doan "Cắt"
//  - chiTietMau[].phu: chi tiet mau phu theo mau chinh, rieng cong doan "Cắt" -> luu TienDoChiTietMauPhu
//  - giaoViecMay: giao viec may noi bo (khi NhaGiaCong cua don la "Nhà Làm") -> luu PhanCongMay
//  - chiTietMau[].donViDaChon: rieng cong doan "Kho nhập" - dung tinh DELTA quy doi ve don vi co ban
//    truoc khi cong don vao The kho hang hoa (xem khoi try/catch rieng o cuoi route).
router.post('/orders/:maDH/tiendo', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  try {
    const user = req.session.user;
    const {
      congDoan, ngayGhiNhan, ghiChu, metSoDoDai, khoVaiSoDo, maRap, sttSoCat,
      nhanVienTraiVaiId, nhanVienTraiVaiIds, nhanVienCatId, chiTietMau, chiTietCay, giaoViecMay,
      // v5.24 (sua tiep v5.23, xem ghi chu dau file + migration_v524.sql): nhaGiaCongId/donGiaGiaCongNgoai/
      // kenhSanXuat KHONG con duoc doc o route nay nua - viec chon nha gia cong + SL/don gia gio HOAN TOAN
      // qua nut instant-save rieng "Lưu nhà gia công" (POST /orders/:maDH/nhagiacongchitiet, khong doi tu
      // truoc, chi them soLuong). "Kenh san xuat" tu 1 chuoi don (KenhSanXuat) doi thanh 2 co doc lap -
      // BAT BUOC gui kem o cong doan 'GC' (form luon gui ca 2, xem module.qlsx.js submit handler).
      daGiaoNhaLam, daGiaoGiaCong,
      // v5.20 (muc 1/2): ngayGiaoGC/ngayNhanGC tung dung rieng cho 2 cong doan GNGC/NNGC. v5.21 (muc 8):
      // nhaInId/ngayGiaoIn/ngayNhanIn KHONG con duoc doc o route nay nua - da chuyen sang 2 route doc lap
      // POST /orders/:maDH/giaonhaintheu, /nhannhaintheu (xem khoi GIAO/NHAN NHA GIA CONG & NHA IN o tren).
      // v5.22 (muc 1.1): ngayGiaoGC/ngayNhanGC CUNG khong con duoc doc o route nay nua cung ly do (GNGC/
      // NNGC da bi xoa khoi day - xem dau file) - bo luon khoi destructure, KHONG chi don gian bo nhanh
      // xu ly (tranh 2 bien "mo coi" khong dung toi).
      // v5.13 (muc 1.2.2.1): so do DANG cat (DonHangChiTietSoDo.ID) - CHI co y nghia o cong doan Cat,
      // frontend chi gui khi don hang co > 1 dong so do da khai bao (xem module.qlsx.js renderStageFields
      // 'CAT') - de trong/khong gui neu don chi co 0 hoac 1 so do (khong co gi de chon).
      soDoId,
      // v5.16 (muc 2.2.1/2.2.2): khi don hang co >= 2 sơ đồ, frontend gui mang catGroups (1 phan tu/so do
      // co du lieu) THAY VI cac field phang sttSoCat/nhanVienTraiVaiIds/nhanVienCatId/soDoId/chiTietCay o
      // tren - xem nhanh rieng ben duoi (isMultiCatGroups).
      catGroups
    } = req.body;

    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

    // v5.9 (yeu cau "Mã công đoạn... mở rộng thành sửa lại toàn bộ các chỗ so sánh trực tiếp theo TÊN
    // công đoạn sang so sánh theo mã/StageID"): congDoan gui tu frontend gio la StageID (so - xem
    // #pCongDoanSelect trong module.qlsx.js), KHONG con la TEN cong doan nhu truoc. Tra cuu stage TRUOC
    // khi kiem tra quyen (chuyen tu vi tri cu ben duoi len day) de canUpdateStage() so sanh theo StageID
    // (on dinh - xem duoi) thay vi TEN, ma van hien duoc TEN cong doan than thien trong thong bao loi qua
    // stage.TenCongDoan (thay vi hien thang so StageID cho nguoi dung).
    const stageResult = await pool.request().input('t', sql.Int, congDoan).query('SELECT * FROM CongDoanSanXuat WHERE StageID=@t');
    if (!stageResult.recordset.length) return res.status(400).json({ success: false, message: 'Công đoạn không hợp lệ.' });
    const stage = stageResult.recordset[0];

    // v5.9: canUpdateStage() gio nhan StageID, so sanh voi user.congDoanIds (mang StageID - xem
    // loadUserContext.js va middleware/auth.js) thay vi TEN cong doan - doi ten cong doan trong Danh muc
    // tu sau khi nang cap nay se KHONG con lam user dang duoc phan cong dung cong doan do bi mat quyen.
    if (!canUpdateStage(user, stage.StageID)) {
      return res.status(403).json({ success: false, message: `Tài khoản của bạn không có quyền cập nhật công đoạn "${stage.TenCongDoan}".` });
    }

    // v5.18 (muc 1.2.2, yeu cau "điều kiện cập nhật bên cắt khi có phiếu xuất kho vải"): tu khi bo
    // buoc "Giao vải" (GV) khoi Ghi nhan tien do, KHONG con gi bat buoc phai co truoc khi ghi Cat -
    // them dieu kien CUNG (chan o backend, khong chi canh bao o frontend) rang don hang phai co IT
    // NHAT 1 dong Phieu xuat kho vai (PhieuXuatVaiChiTiet qua PhieuXuatVai.DonHangID) truoc khi duoc
    // phep ghi nhan tien do cong doan "Cắt" - xem getVaiCayDaXuatChoDon() (nguon cay vai cho form Cat).
    if (stage.MaCongDoan === 'CAT') {
      const daXuatResult = await pool.request().input('id', sql.Int, order.DonHangID).query(`
        SELECT TOP 1 1 AS X FROM PhieuXuatVaiChiTiet ct
        JOIN PhieuXuatVai px ON px.PhieuXuatID = ct.PhieuXuatID
        WHERE px.DonHangID = @id`);
      if (!daXuatResult.recordset.length) {
        return res.status(400).json({
          success: false,
          message: 'Chưa có Phiếu xuất kho vải nào cho đơn hàng này — vào Kho vải > Xuất kho vải để xuất vải cho đơn hàng trước khi ghi nhận tiến độ công đoạn "Cắt".'
        });
      }
    }

    // v5.9: 4 dieu kien duoi day (isKhoNhap + Ky thuat/May/Cat ben duoi) doi tu so sanh stage.TenCongDoan
    // (TEN hien thi, tu do doi duoc qua Danh muc tu sau khi nang cap nay) sang stage.MaCongDoan (MA on
    // dinh, da duoc KHOA cho 8 cong doan he thong qua cot LaHeThong - xem migration_v59.sql +
    // backend/routes/danhmuc.js). 'KN' = Kho nhập (xem migration_v59.sql cho toan bo bang ma).
    const isKhoNhap = stage.MaCongDoan === 'KN';

    // v5.24 (sua tiep v5.23 - checkbox doc lap thay radio): ghi 2 co DaGiaoNhaLam/DaGiaoGiaCong - nguon
    // THAT SU cho tinhNextStage() (May) va frontend showGiaoViec (module.qlsx.js), thay cho cot don gia
    // tri KenhSanXuat (v5.21-v5.23, tu nay "mo coi"). Form 'GC' luon gui ca 2 (khong con field nao de
    // trong = "giu nguyen" nhu nhaGiaCongId truoc day - day la 2 checkbox, gia tri gui len luon phan anh
    // dung trang thai HIEN TAI cua o tick). Viec chon nha gia cong + SL/don gia gio HOAN TOAN qua nut
    // instant-save rieng "Lưu nhà gia công" (POST /orders/:maDH/nhagiacongchitiet, xem duoi) - KHONG con
    // ghi NhaGiaCongID/DonGiaGiaCongNgoai o day nua.
    if (stage.MaCongDoan === 'GC' && (daGiaoNhaLam !== undefined || daGiaoGiaCong !== undefined)) {
      await pool.request()
        .input('id', sql.Int, order.DonHangID)
        .input('nl', sql.Bit, daGiaoNhaLam ? 1 : 0)
        .input('gc', sql.Bit, daGiaoGiaCong ? 1 : 0)
        .query('UPDATE DonHangSanXuat SET DaGiaoNhaLam=@nl, DaGiaoGiaCong=@gc, UpdatedAt=SYSDATETIME() WHERE DonHangID=@id');
    }

    // v5.21 (muc 8): khai bao nha in/theu tai "Ky thuat" da bi XOA (khong con can biet NhaInID tu som -
    // GNIT/NNIT khong con la dieu kien trong tinhNextStage() nua) - viec chon nha in/theu + ghi ngay
    // giao/nhan gio HOAN TOAN thuoc ve 2 route doc lap POST /orders/:maDH/giaonhaintheu, /nhannhaintheu
    // (xem khoi GIAO/NHAN NHA GIA CONG & NHA IN o tren).

    // v5.22 (muc 1.1): GNGC/NNGC (Giao/Nhan nha gia cong) da bi XOA khoi day - KHONG con la 2 cong doan
    // trong Ghi nhan tien do (xem ghi chu tai tinhNextStage() dau file). NgayGiaoGC/NgayNhanGC tren
    // DonHangSanXuat tu nay khong con noi nao ghi nua (khong xoa cot, chi "mo coi").
    // v5.24: viec giao nha gia cong THUC TE gio HOAN TOAN qua nhanh 'GC' o TREN (POST/PUT
    // /orders/:maDH/nhagiacongchitiet, nut instant-save "Luu nha gia cong") - khong con qua route
    // /giaonhagiacong*/log, /nhannhagiacong*/log nao ca (da XOA han cung ledger GiaoNhaGiaCongChiTiet/
    // NhanNhaGiaCongChiTiet, xem khoi NHAN NHA GIA CONG o duoi).

    // Kho nhap: lay SL luy ke CU (truoc lan ghi nhan nay) theo tung mau - dung tinh DELTA sau khi luu xong
    // ban ghi tien do moi (phai lay TRUOC khi INSERT ben duoi, neu khong se lay nham chinh ban ghi vua tao).
    const oldQtyByColor = isKhoNhap ? await getStageActualQtyByColor(pool, order.DonHangID, stage.StageID) : {};

    // v5.7: chup lai (snapshot) TEN nha gia cong HIEN TAI cua don hang NGAY LUC ghi nhan tien do "May" -
    // yeu cau v5.7 "Lịch sử cập nhật tiến độ - May hiển thị tên nhà gia công". NhaGiaCongID/TenNhaGiaCong
    // tren DonHangSanXuat la 1 gia tri DUY NHAT (khong co lich su rieng theo tung lan "May").
    // v5.24: nhanh 'GC' o tren KHONG con ghi NhaGiaCongID nua (da doi sang DonHangChiTietNhaGiaCong nhieu
    // dong qua nut instant-save rieng - xem ghi chu dau file) nen NhaGiaCongID/TenNhaGiaCong tren
    // DonHangSanXuat tu nay la "mo coi" (khong con noi nao ghi) - snapshot nay CHI con y nghia cho don
    // hang CU da tung co gia tri nay tu truoc v5.24, don MOI se snapshot ra NULL. Khong xoa co che nay vi
    // van an toan (khong loi), chi khong con phan anh dung thuc te nhieu-nha-gia-cong nua - can 1 dot rieng
    // neu muon nang cap tiep (vd noi cac ten nha gia cong tu DonHangChiTietNhaGiaCong).
    // v5.9: doi tu stage.TenCongDoan === 'May' sang stage.MaCongDoan === MA_CONG_DOAN_MAY.
    const tenNhaGiaCongTaiThoiDiem = stage.MaCongDoan === MA_CONG_DOAN_MAY ? (order.TenNhaGiaCong || null) : null;

    // v5.16 (muc 2.2.1/2.2.2): don hang co >= 2 sơ đồ gui payload.catGroups (mang, 1 phan tu/so do co du
    // lieu) THAY VI cac field phang - xu ly rieng ca nhanh nay (tao NHIEU ban ghi TienDoSanXuat, xem
    // khoi if ben duoi), KHONG di qua duong tao 1 ban ghi DUY NHAT nhu truoc (van GIU NGUYEN 100% o
    // nhanh else cho moi truong hop khac - 0/1 so do, hoac cong doan khac Cat).
    const isMultiCatGroups = stage.MaCongDoan === 'CAT' && Array.isArray(catGroups) && catGroups.length > 0;
    let tienDoId;
    let chiTietMauFinal = chiTietMau;

    if (isMultiCatGroups) {
      const heSoDonHang = Number(order.HeSoQuyDoi) || 1;
      const createdIds = [];
      for (const grp of catGroups) {
        const grpResult = await pool.request()
          .input('DonHangID', sql.Int, order.DonHangID)
          .input('NgayGhiNhan', sql.Date, ngayGhiNhan || new Date())
          .input('StageID', sql.Int, stage.StageID)
          .input('NguoiCapNhatID', sql.Int, user.userId)
          .input('GhiChu', sql.NVarChar, ghiChu || null)
          .input('SttSoCat', sql.Int, grp.sttSoCat || null)
          .input('NhanVienTraiVaiID', sql.Int, (Array.isArray(grp.nhanVienTraiVaiIds) && grp.nhanVienTraiVaiIds.length ? grp.nhanVienTraiVaiIds[0] : null))
          .input('NhanVienCatID', sql.Int, grp.nhanVienCatId || null)
          .input('SoDoID', sql.Int, grp.soDoId || null)
          .query(`INSERT INTO TienDoSanXuat (DonHangID, NgayGhiNhan, StageID, NguoiCapNhatID, GhiChu, SttSoCat, NhanVienTraiVaiID, NhanVienCatID, SoDoID)
                  OUTPUT INSERTED.TienDoID
                  VALUES (@DonHangID, @NgayGhiNhan, @StageID, @NguoiCapNhatID, @GhiChu, @SttSoCat, @NhanVienTraiVaiID, @NhanVienCatID, @SoDoID)`);
        const grpTienDoId = grpResult.recordset[0].TienDoID;
        createdIds.push(grpTienDoId);
        tienDoId = grpTienDoId;

        if (Array.isArray(grp.nhanVienTraiVaiIds)) {
          for (const nvId of grp.nhanVienTraiVaiIds) {
            if (!nvId) continue;
            await pool.request().input('TienDoID', sql.Int, grpTienDoId).input('NhanVienID', sql.Int, nvId)
              .query('INSERT INTO TienDoTraiVai (TienDoID, NhanVienID) VALUES (@TienDoID, @NhanVienID)');
          }
        }

        const mauTongHop = {};
        if (Array.isArray(grp.chiTietCay)) {
          for (const c of grp.chiTietCay) {
            if (!c.cayId) continue;
            const soLuongLop = Number(c.soLuongLop) || 0;
            const heSoDong = heSoCuaDong(c, heSoDonHang);   // v6.08
            const soLuongCai = soLuongLop * heSoDong + soCaiGiatCapCua(c);   // v6.01: + giật cấp (cái)
            const cayInfo = await pool.request().input('id', sql.Int, c.cayId)
              .query('SELECT dv.MauSacID FROM VaiCay vc JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID WHERE vc.CayID=@id');
            const mauSacId = cayInfo.recordset.length ? cayInfo.recordset[0].MauSacID : null;

            await ghiChiTietCayCat(pool, grpTienDoId, c, soLuongLop, heSoDong);   // v5.87 (kèm ảnh cây)

            if (mauSacId != null) mauTongHop[mauSacId] = (mauTongHop[mauSacId] || 0) + soLuongCai;
          }
        }
        for (const mauSacId of Object.keys(mauTongHop)) {
          await pool.request()
            .input('TienDoID', sql.Int, grpTienDoId)
            .input('MauSacID', sql.Int, mauSacId)
            .input('SoLuongLuyKe', sql.Int, Math.round(mauTongHop[mauSacId]))
            .query('INSERT INTO TienDoChiTietMau (TienDoID, MauSacID, SoLuongLuyKe) VALUES (@TienDoID, @MauSacID, @SoLuongLuyKe)');
        }
      }
      // v5.16: gan chung NhomTienDoID (= TienDoID cua nhom DAU TIEN trong lan nop nay) cho MOI ban ghi
      // vua tao - dung de getStageCayCount() cong don DUNG qua ca N ban ghi (xem ham do).
      if (createdIds.length > 1) {
        const batchTag = createdIds[0];
        for (const id of createdIds) {
          await pool.request().input('id', sql.Int, id).input('nhom', sql.Int, batchTag)
            .query('UPDATE TienDoSanXuat SET NhomTienDoID=@nhom WHERE TienDoID=@id');
        }
      }
      // Da xu ly TienDoChiTietMau rieng cho TUNG nhom o tren (moi nhom 1 tienDoId khac nhau) - dat null
      // de KHONG di qua nhanh "if (Array.isArray(chiTietMauFinal))" chung ben duoi (tranh ghi trung/ghi
      // nham vao 1 tienDoId "dai dien" khong dung ngu nghia).
      chiTietMauFinal = null;
    } else {
      const tdResult = await pool.request()
        .input('DonHangID', sql.Int, order.DonHangID)
        .input('NgayGhiNhan', sql.Date, ngayGhiNhan || new Date())
        .input('StageID', sql.Int, stage.StageID)
        .input('NguoiCapNhatID', sql.Int, user.userId)
        .input('GhiChu', sql.NVarChar, ghiChu || null)
        .input('MetSoDoDai', sql.Decimal(10, 2), metSoDoDai || null)
        .input('KhoVaiSoDo', sql.Decimal(10, 2), khoVaiSoDo || null)
        .input('MaRap', sql.NVarChar, maRap || null)
        .input('SttSoCat', sql.Int, sttSoCat || null)
        // v5.2: neu co danh sach nhieu nhan vien trai vai (nhanVienTraiVaiIds, checkbox toi da 2 nguoi o
        // Cat), giu lai NGUOI DAU TIEN o cot don le nay de tuong thich nguoc voi bao cao/du lieu cu; danh
        // sach DAY DU duoc luu them o bang TienDoTraiVai ben duoi (sau khi co tienDoId).
        .input('NhanVienTraiVaiID', sql.Int, (Array.isArray(nhanVienTraiVaiIds) && nhanVienTraiVaiIds.length ? nhanVienTraiVaiIds[0] : nhanVienTraiVaiId) || null)
        .input('NhanVienCatID', sql.Int, nhanVienCatId || null)
        .input('TenNhaGiaCongTaiThoiDiem', sql.NVarChar, tenNhaGiaCongTaiThoiDiem)
        // v5.13 (muc 1.2.2.1): chi co y nghia o cong doan Cat (frontend chi gui khi don co > 1 so do) -
        // NULL cho moi cong doan khac hoac don chua khai bao/chi co 1 so do.
        .input('SoDoID', sql.Int, stage.MaCongDoan === 'CAT' ? (soDoId || null) : null)
        .query(`INSERT INTO TienDoSanXuat (DonHangID, NgayGhiNhan, StageID, NguoiCapNhatID, GhiChu, MetSoDoDai, KhoVaiSoDo, MaRap, SttSoCat, NhanVienTraiVaiID, NhanVienCatID, TenNhaGiaCongTaiThoiDiem, SoDoID)
                OUTPUT INSERTED.TienDoID
                VALUES (@DonHangID, @NgayGhiNhan, @StageID, @NguoiCapNhatID, @GhiChu, @MetSoDoDai, @KhoVaiSoDo, @MaRap, @SttSoCat, @NhanVienTraiVaiID, @NhanVienCatID, @TenNhaGiaCongTaiThoiDiem, @SoDoID)`);
      tienDoId = tdResult.recordset[0].TienDoID;

      // v5.2: luu DAY DU danh sach nhan vien trai vai (cho phep toi da 2 nguoi, xem TienDoTraiVai trong
      // migration_v52_qlsx.sql) - khong chan cung backend neu frontend gui > 2 (frontend da tu gioi han),
      // chi luu dung nhung gi nhan duoc.
      if (Array.isArray(nhanVienTraiVaiIds)) {
        for (const nvId of nhanVienTraiVaiIds) {
          if (!nvId) continue;
          await pool.request().input('TienDoID', sql.Int, tienDoId).input('NhanVienID', sql.Int, nvId)
            .query('INSERT INTO TienDoTraiVai (TienDoID, NhanVienID) VALUES (@TienDoID, @NhanVienID)');
        }
      }

      // v5.0 Cong doan "Cắt": UI moi ghi theo TUNG CAY vai (STT cay A/B/C, SL lop, he so quy doi ->
      // SL cai = lop*he so), thay cho cach cu nhap truc tiep theo mau+"mau phu" tu do. Mau cua tung cay
      // lay qua VaiCay -> DanhMucVai.MauSacID, roi cong don ve dung dinh dang chiTietMau (theo mau chinh)
      // nhu truoc de KHONG pha vo pipeline "SL tong tu Cat" (Kho nhap) / bao cao nang suat da co san.
      // v5.9: doi tu stage.TenCongDoan === 'Cắt' sang stage.MaCongDoan === 'CAT' (xem migration_v59.sql).
      if (stage.MaCongDoan === 'CAT' && Array.isArray(chiTietCay) && chiTietCay.length) {
        const mauTongHop = {};
        // v5.13 (muc 1.2.2.2): He so KHONG con nhap tay tung dong/tung cay (da bo o ".cat-heso" o
        // module.qlsx.js) - lay THANG tu DonHangSanXuat.HeSoQuyDoi (khai bao 1 lan o Ra lenh san xuat,
        // xem POST/PUT /orders), dung CHUNG cho MOI cay trong lan Ghi tien do Cat nay. Khong con tin theo
        // gia tri client gui (neu co gui vi ly do tuong thich nguoc, bo qua - server la nguon su that).
        const heSoDonHang = Number(order.HeSoQuyDoi) || 1;
        for (const c of chiTietCay) {
          if (!c.cayId) continue;
          const soLuongLop = Number(c.soLuongLop) || 0;
          const heSo = heSoCuaDong(c, heSoDonHang);   // v6.08: hệ số riêng từng cây (mặc định = của đơn)
          const soLuongCai = soLuongLop * heSo + soCaiGiatCapCua(c);   // v6.01: + giật cấp (cái)
          const cayInfo = await pool.request().input('id', sql.Int, c.cayId)
            .query('SELECT dv.MauSacID FROM VaiCay vc JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID WHERE vc.CayID=@id');
          const mauSacId = cayInfo.recordset.length ? cayInfo.recordset[0].MauSacID : null;

          await ghiChiTietCayCat(pool, tienDoId, c, soLuongLop, heSo);   // v5.87 (kèm ảnh cây)

          if (mauSacId != null) mauTongHop[mauSacId] = (mauTongHop[mauSacId] || 0) + soLuongCai;
        }
        chiTietMauFinal = Object.keys(mauTongHop).map(mauSacId => ({ mauSacId, soLuong: mauTongHop[mauSacId] }));
      }
    }

    if (Array.isArray(chiTietMauFinal)) {
      for (const m of chiTietMauFinal) {
        const ctResult = await pool.request()
          .input('TienDoID', sql.Int, tienDoId)
          .input('MauSacID', sql.Int, m.mauSacId)
          .input('SoLuongLuyKe', sql.Int, Number(m.soLuong) || 0)
          // v5.7: luu lai don vi da chon (Cai/Ri...) NGAY tren dong lich su - yeu cau v5.7 "Lịch sử cập
          // nhật tiến độ - Kho nhập hiển thị đơn vị tính". Truoc day m.donViDaChon (gui tu frontend cho
          // cong doan "Kho nhap") chi dung TAM để tính delta cho The kho hang hoa roi bi bo, khong luu.
          // Voi cac cong doan khac m.donViDaChon la undefined -> NULL, khong anh huong.
          .input('DonViDaChon', sql.NVarChar, m.donViDaChon || null)
          .query(`INSERT INTO TienDoChiTietMau (TienDoID, MauSacID, SoLuongLuyKe, DonViDaChon)
                  OUTPUT INSERTED.ID
                  VALUES (@TienDoID, @MauSacID, @SoLuongLuyKe, @DonViDaChon)`);
        const chiTietMauId = ctResult.recordset[0].ID;

        // Chi tiet mau phu (rieng cong doan "Cắt") - moi mau chinh co the co nhieu dong mau phu
        if (Array.isArray(m.phu)) {
          for (const p of m.phu) {
            await pool.request()
              .input('TienDoChiTietMauID', sql.Int, chiTietMauId)
              .input('TenMauPhu', sql.NVarChar, p.tenMauPhu || null)
              .input('SoLuong', sql.Int, Number(p.soLuong) || 0)
              .query('INSERT INTO TienDoChiTietMauPhu (TienDoChiTietMauID, TenMauPhu, SoLuong) VALUES (@TienDoChiTietMauID, @TenMauPhu, @SoLuong)');
          }
        }
      }
    }

    // Giao viec may noi bo (rieng cong doan "May" khi NhaGiaCong cua don la "Nhà Làm")
    // v5.6: bo yeu cau BAT BUOC chon mau (g.mauSacId) - yeu cau v5.6 "không cần chọn mầu", tham khao
    // SL theo mau lay tu "SL cắt theo màu" (mauQtyRowsHtml, da co san) thay vi bat nhap lai o day.
    // MauSacID nay tro thanh optional (xem migration_v56.sql: ALTER COLUMN PhanCongMay.MauSacID NULL).
    if (Array.isArray(giaoViecMay)) {
      for (const g of giaoViecMay) {
        if (!g.nhanVienId) continue;
        await pool.request()
          .input('TienDoID', sql.Int, tienDoId)
          .input('NhanVienID', sql.Int, g.nhanVienId)
          .input('CongDoanMayID', sql.Int, g.congDoanMayId || null)
          .input('DonGiaCongDoanMayID', sql.Int, g.dongiaCongDoanMayId || null)   // v5.34c (muc 6): cong doan tu don gia MOI
          .input('MauSacID', sql.Int, g.mauSacId || null)
          .input('SoLuong', sql.Int, Number(g.soLuong) || 0)
          .query('INSERT INTO PhanCongMay (TienDoID, NhanVienID, CongDoanMayID, DonGiaCongDoanMayID, MauSacID, SoLuong) VALUES (@TienDoID, @NhanVienID, @CongDoanMayID, @DonGiaCongDoanMayID, @MauSacID, @SoLuong)');
      }
    }
    // v5.38: giao viec LA (là) / DG (đóng gói) theo MÀU - bang RIENG PhanCongLaDongGoi (KHONG dung PhanCongMay
    // de khong lan vao luong khoan may). Stage suy tu TienDoSanXuat.StageID cua tienDoId nay.
    const giaoViecLaDG = req.body.giaoViecLaDG;
    if (Array.isArray(giaoViecLaDG)) {
      for (const g of giaoViecLaDG) {
        if (!g.nhanVienId) continue;
        await pool.request()
          .input('TienDoID', sql.Int, tienDoId)
          .input('NhanVienID', sql.Int, g.nhanVienId)
          .input('MauSacID', sql.Int, g.mauSacId || null)
          .input('SoLuong', sql.Int, Number(g.soLuong) || 0)
          .query('INSERT INTO PhanCongLaDongGoi (TienDoID, NhanVienID, MauSacID, SoLuong) VALUES (@TienDoID, @NhanVienID, @MauSacID, @SoLuong)');
      }
    }

    const allStages = await pool.request().query('SELECT * FROM CongDoanSanXuat ORDER BY ThuTu');
    const stages = allStages.recordset;
    const curIndex = stages.findIndex(s => s.StageID === stage.StageID);
    // v5.0: bo qua cong doan "May" neu don hang giao gia cong ngoai (khac "Nha Lam") - xem tinhNextStage().
    const nextIndex = curIndex === -1 ? -1 : tinhNextStage(stages, curIndex, order);
    const isLast = curIndex === -1 || nextIndex === -1;
    const nextStageId = isLast ? null : stages[nextIndex].StageID;
    const nextStageName = isLast ? null : stages[nextIndex].TenCongDoan;

    // v5.48: KHÔNG kéo lùi con trỏ tiến độ khi ghi nhận LẠI công đoạn ĐÃ QUA (vd cắt bổ sung khi đơn đã
    // sang May). Chỉ dời con trỏ nếu điểm-đến (sau công đoạn vừa ghi) VƯỢT con trỏ hiện tại.
    const lenStages = stages.length;
    const curPointerIdx = order.CongDoanHienTaiID
      ? stages.findIndex(s => s.StageID === order.CongDoanHienTaiID)
      : lenStages;                                 // NULL = đã hoàn thành = coi như sau công đoạn cuối
    const wouldBeIdx = isLast ? lenStages : nextIndex;
    const advanced = wouldBeIdx > curPointerIdx;

    let finalStageId, finalPercent, finalTrangThai;
    if (advanced) {
      finalStageId = nextStageId;                  // null nếu isLast (hoàn thành)
      finalPercent = isLast ? 100 : Math.round(((curIndex + 1) / lenStages) * 100);
      finalTrangThai = isLast ? 'Hoàn thành' : 'Đang sản xuất';
    } else {
      // Ghi bổ sung công đoạn đã qua -> GIỮ NGUYÊN con trỏ + trạng thái hiện tại (không lùi).
      finalStageId = order.CongDoanHienTaiID || null;
      finalPercent = order.CongDoanHienTaiID ? Math.round(((curPointerIdx + 1) / lenStages) * 100) : 100;
      finalTrangThai = order.CongDoanHienTaiID ? 'Đang sản xuất' : 'Hoàn thành';
    }

    await pool.request()
      .input('id', sql.Int, order.DonHangID)
      .input('StageID', sql.Int, finalStageId)
      .input('Percent', sql.Int, finalPercent)
      .input('TrangThai', sql.NVarChar, finalTrangThai)
      .query(`UPDATE DonHangSanXuat SET CongDoanHienTaiID=@StageID, PhanTramHoanThanh=@Percent, TrangThai=@TrangThai, UpdatedAt=SYSDATETIME()
              WHERE DonHangID=@id`);

    // Bao cho cac user phu trach cong doan KE TIEP biet de cap nhat tien do (CHI khi thuc su tien toi cong doan moi).
    // Boc try/catch rieng - loi gui thong bao khong duoc lam hong ket qua ghi nhan tien do chinh.
    if (advanced && nextStageId) {
      try {
        await notifyStageUsers(pool, { stageId: nextStageId, stageName: nextStageName, order, excludeUserId: user.userId });
      } catch (notifyErr) {
        console.error('Lỗi khi gửi thông báo cho công đoạn tiếp theo:', notifyErr);
      }
    }

    // Cong doan "Kho nhập": cong don DELTA vao The kho hang hoa lien ket voi don hang nay (tu tao The kho +
    // chi tiet mau neu chua co). Boc rieng try/catch - loi phan nay CHI log ra console, khong anh huong
    // ket qua tra ve cho phan ghi nhan tien do chinh (da luu thanh cong o tren).
    // v5.4: KHONG con tu dong tao The kho hang hoa tai day nua. Truoc day, lan dau ghi tien do "Kho nhap"
    // se tu dong INSERT The kho + chi tiet mau; gio viec tao The kho la thao tac TUONG MINH cua nguoi dung
    // qua Kho hang > "Tao the kho moi" (chi liet ke don hang da co tien do Kho nhap va CHUA co the kho -
    // xem GET /khohang/donhang). O day CHI cong don delta neu The kho DA TON TAI tu truoc (giu nguyen logic
    // delta cho cac don da duoc gan the kho) - khong mat du lieu neu chua co the kho, vi so lieu Kho nhap
    // tung cong doan van luu du trong TienDoSanXuat, se duoc doc lai (getSoNhapTheoMau) khi tao the kho sau.
    if (isKhoNhap && Array.isArray(chiTietMau) && chiTietMau.length) {
      try {
        const theKhoRow = (await pool.request().input('id', sql.Int, order.DonHangID)
          .query('SELECT * FROM TheKhoHangHoa WHERE DonHangID=@id')).recordset[0];

        if (theKhoRow) {
          const loaiRi = Number(theKhoRow.LoaiRi) || 1;
          for (const m of chiTietMau) {
            const oldQty = Number(oldQtyByColor[m.mauSacId]) || 0;
            const newQty = Number(m.soLuong) || 0;
            let delta = newQty - oldQty;
            // Cong thuc quy doi giu dung nhu khovai.js/khohang.js dang dung (donVi === don vi quy doi -> nhan LoaiRi),
            // chi khac o cho so sanh voi nhan don vi quy doi thuc te cua The kho (co the khac 'Ri' neu doi ten danh muc).
            if (m.donViDaChon && theKhoRow.DonViQuyDoi && m.donViDaChon === theKhoRow.DonViQuyDoi) {
              delta = delta * loaiRi;
            }
            if (!delta) continue;

            const ctRow = (await pool.request().input('mh', sql.Int, theKhoRow.MaHangID).input('ms', sql.Int, m.mauSacId)
              .query('SELECT ID FROM TheKhoChiTietMau WHERE MaHangID=@mh AND MauSacID=@ms')).recordset[0];
            if (ctRow) {
              await pool.request().input('id', sql.Int, ctRow.ID).input('delta', sql.Int, delta)
                .query('UPDATE TheKhoChiTietMau SET NhapCai = NhapCai + @delta WHERE ID=@id');
            } else {
              await pool.request()
                .input('MaHangID', sql.Int, theKhoRow.MaHangID).input('MauSacID', sql.Int, m.mauSacId).input('delta', sql.Int, delta)
                .query('INSERT INTO TheKhoChiTietMau (MaHangID, MauSacID, SoCatCai, NhapCai, XuatCai) VALUES (@MaHangID, @MauSacID, 0, @delta, 0)');
            }
          }
        }
      } catch (theKhoErr) {
        console.error('Lỗi khi cập nhật Thẻ kho hàng hóa từ tiến độ "Kho nhập":', theKhoErr);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi ghi nhận tiến độ: ' + err.message });
  }
});

// ============ ADMIN EP CHUYEN CONG DOAN THU CONG ============
router.put('/orders/:maDH/forcestage', requireAuth, requirePermission('QLSX', 'edit'), requireChucNang('QLSX', 'tiendo'), async (req, res) => {
  const user = req.session.user;
  if (!user.isAdmin) return res.status(403).json({ success: false, message: 'Chỉ Admin được phép ép công đoạn.' });

  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

  const stages = (await pool.request().query('SELECT * FROM CongDoanSanXuat ORDER BY ThuTu')).recordset;
  const { stageId } = req.body;
  const curIndex = stages.findIndex(s => s.StageID === Number(stageId));
  const percent = curIndex === -1 ? 0 : Math.round(((curIndex + 1) / stages.length) * 100);
  const trangThai = curIndex === stages.length - 1 ? 'Hoàn thành' : 'Đang sản xuất';

  await pool.request()
    .input('id', sql.Int, order.DonHangID)
    .input('StageID', sql.Int, stageId)
    .input('Percent', sql.Int, percent)
    .input('TrangThai', sql.NVarChar, trangThai)
    .query(`UPDATE DonHangSanXuat SET CongDoanHienTaiID=@StageID, PhanTramHoanThanh=@Percent, TrangThai=@TrangThai, UpdatedAt=SYSDATETIME()
            WHERE DonHangID=@id`);
  res.json({ success: true });
});

// ============ IN PHIEU BAO CAO DON HANG ============
// v3.0: bo sung SL yeu cau cat (TongSoLuong), SL cat thuc te + SL nhap kho thuc te
// (lay tu tien do cong doan 'Cắt' / 'Kho nhập'), va SL tung phu kien da xuat kem don hang nay.
router.get('/orders/:maDH/print', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'orders'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderByMaDH(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const _soDoIn = await getSoDoList(pool, order.DonHangID);
  order.MaRap = [...new Set(_soDoIn.map(s => s.MaRap).filter(Boolean))].join(', ');   // v5.52: Mã rập từ sơ đồ
  /* v6.03: phiếu báo cáo có thêm SỐ LƯỢNG SƠ ĐỒ (đã khai / đã có sổ cắt) — đơn nhiều sơ đồ cắt nhiều đợt
     thì đây là thông tin đọc phiếu là biết ngay còn sơ đồ nào chưa cắt (cùng nguồn với cột ở GET /orders). */
  order.SoSoDo = _soDoIn.length;
  const _demCat = (await pool.request().input('id', sql.Int, order.DonHangID).query(`
    SELECT COUNT(DISTINCT td.SoDoID) AS DaCat, COUNT(*) AS SoSoCat FROM TienDoSanXuat td
    JOIN CongDoanSanXuat c ON c.StageID = td.StageID
    WHERE td.DonHangID = @id AND c.MaCongDoan = 'CAT'
      AND EXISTS (SELECT 1 FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = td.TienDoID)`)).recordset[0];
  order.SoSoDoDaCat = Number(_demCat.DaCat) || 0;
  /* v6.04: đơn CŨ (trước v5.13) không có dòng nào trong bảng Sơ đồ mà vẫn có sổ cắt — dùng số sổ cắt làm
     số sơ đồ để phiếu không ghi "Chưa khai báo sơ đồ" trong khi thực tế đã cắt. */
  order.SoSoDoTuSoCat = Number(_demCat.SoSoCat) || 0;

  // v5.7: them td.TenNhaGiaCongTaiThoiDiem (yeu cau "Lịch sử... May hiển thị tên nhà gia công", chi co
  // gia tri cho dong "May" tu sau khi nang cap - xem migration_v57.sql + POST .../tiendo).
  const logs = await pool.request().input('id', sql.Int, order.DonHangID).query(`
    SELECT td.NgayGhiNhan, td.ThoiGianNhap, c.TenCongDoan, u.HoTen AS NguoiCapNhat, td.GhiChu,
           td.MetSoDoDai, td.KhoVaiSoDo, td.MaRap, td.SttSoCat, td.TienDoID, td.TenNhaGiaCongTaiThoiDiem
    FROM TienDoSanXuat td
    LEFT JOIN CongDoanSanXuat c ON c.StageID = td.StageID
    LEFT JOIN Users u ON u.UserID = td.NguoiCapNhatID
    WHERE td.DonHangID = @id
    ORDER BY td.NgayGhiNhan, td.ThoiGianNhap`);

  const tienDoIds = logs.recordset.map(l => l.TienDoID);
  let chiTietMau = [];
  if (tienDoIds.length) {
    const idList = tienDoIds.join(',');
    // v5.7: them tc.DonViDaChon (yeu cau "Lịch sử... Kho nhập hiển thị đơn vị tính", chi co gia tri cho
    // dong "Kho nhập" tu sau khi nang cap - xem migration_v57.sql + POST .../tiendo).
    const ctResult = await pool.request().query(`
      SELECT tc.TienDoID, ms.TenMau, tc.SoLuongLuyKe, tc.DonViDaChon FROM TienDoChiTietMau tc
      JOIN MauSac ms ON ms.MauSacID = tc.MauSacID
      WHERE tc.TienDoID IN (${idList})`);
    chiTietMau = ctResult.recordset;
  }
  const logsWithMau = logs.recordset.map(l => ({
    ...l,
    chiTietMau: chiTietMau.filter(c => c.TienDoID === l.TienDoID)
  }));

  // v5.24 (bo han khoi tiem log tong hop GNGC/NNGC them tu v5.22): GiaoNhaGiaCongChiTiet/
  // NhanNhaGiaCongChiTiet da mo coi (khong con noi nao ghi tu v5.24 - xem ghi chu dau file), nen khoi
  // tiem "dong tong hop" KIEU CU (nhieu lan giao/nhan rieng) se LUON tra ve rong - da XOA han. 'GC' gio
  // la 1 cong doan THAT trong CongDoanSanXuat (tu v5.23) nen moi lan Ghi tien do tai day DA TU SINH 1
  // dong TienDoSanXuat binh thuong (nam trong logs/logsWithMau o tren, khong can them logic rieng cho
  // BAN THAN su kien "da nop cong doan Giao gia cong").
  // v5.25 (phan hoi "chức năng riêng vẫn phải cập nhật vào trong theo dõi lệnh sản xuất" - tab "Nhận nhà
  // gia công" van la 1 chuc nang DOC LAP, khong phai 1 cong doan, nhung du lieu cua no can hien lai o day
  // giong nhu Giao/Nhan nha in theu o duoi): them 1 dong TONG HOP CHO MOI dong "Nha gia cong chi tiet" DA
  // gan cho don hang - khac ban v5.22 cu (query tu 2 bang ledger MO COI da xoa), lan nay doc THANG tu
  // DonHangChiTietNhaGiaCong CON SONG (dung CreatedAt lam moc thoi gian "luc gan nha gia cong nay" - bang
  // nay khong con khai niem "nhieu lan giao/nhan" nua, moi dong chi tiet la 1 lan gan CO DINH nen chi can
  // 1 dong log/nha gia cong, khong phai 2 dong giao+nhan rieng nhu kieu cu).
  const ngcChiTietLogs = await pool.request().input('id', sql.Int, order.DonHangID).query(`
    SELECT ct.CreatedAt, ct.SoLuong, ct.DonGia, ncc.TenNha
    FROM DonHangChiTietNhaGiaCong ct
    JOIN NhaGiaCong ncc ON ncc.NhaGiaCongID = ct.NhaGiaCongID
    WHERE ct.DonHangID = @id`);
  ngcChiTietLogs.recordset.forEach(r => {
    logsWithMau.push({
      NgayGhiNhan: r.CreatedAt, ThoiGianNhap: r.CreatedAt, TenCongDoan: 'Giao gia công',
      NguoiCapNhat: '',
      GhiChu: `Nhà gia công: ${r.TenNha}${r.SoLuong != null ? ' — SL: ' + r.SoLuong : ''}${r.DonGia != null ? ' — Đơn giá: ' + r.DonGia : ''}`,
      chiTietMau: []
    });
  });

  // v5.21 (muc 8, "Cập nhật tiến độ có ghi nhận giao nhận nhà gia công, giao nhận nhà in"): Giao/Nhan
  // nha in theu KHONG con la 1 cong doan (xem ghi chu tai dau file) nen KHONG tu sinh dong TienDoSanXuat
  // nao - chen THEM 2 dong TONG HOP (khong co TienDoID/StageID that, chi la thong tin hien thi) tu chinh
  // NgayGiaoIn/NgayNhanIn cua don hang, roi sap xep lai theo ngay, de bao cao "Lich su cap nhat tien do"
  // van phan anh du 2 su kien nay nhu yeu cau.
  if (order.NgayGiaoIn) {
    logsWithMau.push({
      NgayGhiNhan: order.NgayGiaoIn, ThoiGianNhap: order.NgayGiaoIn, TenCongDoan: 'Giao nhà in thêu',
      NguoiCapNhat: '', GhiChu: order.TenNhaIn ? ('Nhà in/thêu: ' + order.TenNhaIn) : '', chiTietMau: []
    });
  }
  if (order.NgayNhanIn) {
    logsWithMau.push({
      NgayGhiNhan: order.NgayNhanIn, ThoiGianNhap: order.NgayNhanIn, TenCongDoan: 'Nhận nhà in thêu',
      NguoiCapNhat: '', GhiChu: order.TenNhaIn ? ('Nhà in/thêu: ' + order.TenNhaIn) : '', chiTietMau: []
    });
  }
  logsWithMau.sort((a, b) => new Date(a.ThoiGianNhap || a.NgayGhiNhan) - new Date(b.ThoiGianNhap || b.NgayGhiNhan));

  // v5.9: tra cuu theo MaCongDoan (ma on dinh, xem migration_v59.sql) thay vi TenCongDoan (ten hien thi,
  // tu do doi duoc qua Danh muc tu sau khi nang cap nay ma khong lam gian doan bao cao nang suat nay nua).
  const stageLookup = await pool.request().query("SELECT StageID, MaCongDoan FROM CongDoanSanXuat WHERE MaCongDoan IN (N'CAT', N'KN')");
  const catStage = stageLookup.recordset.find(s => s.MaCongDoan === 'CAT');
  const khoNhapStage = stageLookup.recordset.find(s => s.MaCongDoan === 'KN');
  const slYeuCauCat = order.TongSoLuong || 0;
  const slCatThucTe = await getStageActualQty(pool, order.DonHangID, catStage ? catStage.StageID : null);
  // v5.7: uu tien SL nhap kho DA QUY DOI thuc su (TheKhoChiTietMau.NhapCai - da duoc cong don dung 1
  // don vi "Cai" qua tung lan delta*LoaiRi, xem POST .../tiendo) thay cho tong SoLuongLuyKe THO (co the
  // dang lan lon don vi Cai/Ri neu nguoi dung tung chon "Ri" luc ghi Kho nhap) - yeu cau v5.7 "Báo cáo
  // năng suất Cắt/Nhập kho - SL nhập kho thực tế hiển thị số lượng đã quy đổi". Chi ap dung DUOC neu don
  // hang DA co The kho hang hoa (v5.4+ khong con tu dong tao) - neu chua co, fallback ve cach tinh CU
  // (tong tho) vi day la du lieu DUY NHAT dang co, con hon khong hien gi.
  const theKhoRow = (await pool.request().input('id', sql.Int, order.DonHangID)
    .query('SELECT MaHangID FROM TheKhoHangHoa WHERE DonHangID=@id')).recordset[0];
  let slNhapKhoThucTe;
  let slNhapKhoQuyDoi = false;
  if (theKhoRow) {
    const sumRow = (await pool.request().input('mh', sql.Int, theKhoRow.MaHangID)
      .query('SELECT ISNULL(SUM(NhapCai),0) AS Tong FROM TheKhoChiTietMau WHERE MaHangID=@mh')).recordset[0];
    slNhapKhoThucTe = Number(sumRow.Tong) || 0;
    slNhapKhoQuyDoi = true;
  } else {
    slNhapKhoThucTe = await getStageActualQty(pool, order.DonHangID, khoNhapStage ? khoNhapStage.StageID : null);
  }

  // v5.7: them cot SLTheoChiDinh (mirror dung join da co san va dang hoat dong o phukien.js
  // getPhieuDetail()/printPhieuXuatPK()) - yeu cau v5.7 "Phụ kiện xuất kèm đơn hàng - thêm cột SL chỉ
  // định". Can them dm.PhuKienID vao SELECT + GROUP BY de subquery tham chieu dung (SQL Server khong
  // suy luan phu thuoc ham nhu MySQL).
  const phuKienResult = await pool.request().input('id', sql.Int, order.DonHangID).query(`
    SELECT dm.MaPhuKien, dm.TenPhuKien, ISNULL(ct.DonVi, dm.DonViCoBan) AS DonVi, SUM(ct.SoLuong) AS TongSoLuong,
      (SELECT SUM(dpk.SoLuong) FROM DonHangChiTietPhuKien dpk WHERE dpk.DonHangID = @id AND dpk.PhuKienID = dm.PhuKienID) AS SLTheoChiDinh
    FROM PhieuPhuKienChiTiet ct
    JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
    JOIN DanhMucPhuKien dm ON dm.PhuKienID = ct.PhuKienID
    WHERE p.DonHangID = @id AND p.LoaiPhieu = N'Xuất'
    GROUP BY dm.MaPhuKien, dm.TenPhuKien, ISNULL(ct.DonVi, dm.DonViCoBan), dm.PhuKienID
    ORDER BY dm.MaPhuKien`);

  // v4.0: bo sung khoi "Xuat vai" trong phieu in - tai su dung dung logic GET /orders/:maDH/vaicap
  const vaiXuat = await getVaiCapHistory(pool, order.DonHangID);
  // v5.7: them cau truc vai (chinh/phoi) cua CHINH don hang - yeu cau v5.7 "Xuất vải kèm đơn hàng in
  // hiển thị Vải chính: loại vải, Vải phối: loại vải". Khac voi vaiXuat (lich su TUNG lan xuat cay vai
  // that su, giu nguyen khong doi) - day la ban KHAI BAO cau truc vai cua don (giong khoi da lam o
  // printLenhSanXuat()), hien nhu 1 dong tom tat THAM KHAO ben canh bang lich su xuat.
  const chiTietVai = await getChiTietVaiNested(pool, order.DonHangID);

  res.json({
    success: true,
    data: {
      order, logs: logsWithMau,
      baoCaoNangSuat: { slYeuCauCat, slCatThucTe, slNhapKhoThucTe, slNhapKhoQuyDoi },
      phuKienXuat: phuKienResult.recordset,
      vaiXuat, chiTietVai
    }
  });
});

// ============ DASHBOARD ============
router.get('/dashboard', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'dashboard'), async (req, res) => {
  const pool = await getPool();
  const ordersResult = await pool.request().query(`
    SELECT d.MaDH, d.TenSanPham,
           ISNULL(NULLIF(LTRIM(RTRIM(d.TenKhachHangTuDo)), ''), kh.TenKhachHang) AS TenKhachHang,   -- v6.43
           d.PhanTramHoanThanh, d.TrangThai, c.TenCongDoan, c.MaCongDoan,
           d.NgayGiaoDuKien, d.TongSoLuong, d.AnhSanPham,
           d.NhaGiaCongID, ncc1.TenNha AS TenNhaGiaCong, d.NgayGiaoGC, d.NgayNhanGC, d.SoNgayGC,
           d.NhaInID, ncc2.TenNha AS TenNhaIn, d.NgayGiaoIn, d.NgayNhanIn, d.SoNgayIn
    FROM DonHangSanXuat d
    LEFT JOIN KhachHang kh ON kh.KhachHangID = d.KhachHangID
    LEFT JOIN CongDoanSanXuat c ON c.StageID = d.CongDoanHienTaiID
    LEFT JOIN NhaGiaCong ncc1 ON ncc1.NhaGiaCongID = d.NhaGiaCongID
    LEFT JOIN NhaGiaCong ncc2 ON ncc2.NhaGiaCongID = d.NhaInID`);
  const orders = ordersResult.recordset;

  const total = orders.length;
  const completed = orders.filter(o => o.TrangThai === 'Hoàn thành').length;
  const inProgress = orders.filter(o => o.TrangThai === 'Đang sản xuất').length;
  const notStarted = orders.filter(o => o.TrangThai === 'Chưa bắt đầu').length;
  /* v6.50 — SỬA Ô "TRỄ HẠN" LUÔN BẰNG 0.
     Trước đây đếm theo o.TrangThai === 'Trễ hạn'. Nhưng KHÔNG CÓ CHỖ NÀO ghi trạng thái đó vào CSDL:
     utils/checkOverdue.js chỉ đọc ngày giao rồi GỬI EMAIL, không UPDATE TrangThai. Nên cột này đứng
     im ở 0 kể cả khi có 19 lệnh đã quá ngày giao.
     Nay tính SỐNG từ NgayGiaoDuKien, đúng cùng một luật với danh sách lệnh SX (v6.48) — một định
     nghĩa duy nhất, hai màn hình không thể vênh nhau nữa.
     Gắn luôn nhóm hạn vào từng đơn để popup "bấm vào ô Trễ hạn" lọc theo đúng nhóm này. */
  const homNay = new Date(); homNay.setHours(0, 0, 0, 0);
  const nhomHan = (o) => {
    if (o.TrangThai === 'Hoàn thành' || o.TrangThai === 'Đã hủy') return '';
    if (!o.NgayGiaoDuKien) return '';
    const d = new Date(o.NgayGiaoDuKien);
    if (isNaN(d)) return '';
    d.setHours(0, 0, 0, 0);
    const con = Math.round((d - homNay) / 86400000);
    return con < 0 ? 'qua' : (con <= 5 ? 'sap' : '');
  };
  orders.forEach(o => { o.NhomHan = nhomHan(o); });
  const overdue = orders.filter(o => o.NhomHan === 'qua').length;
  const soonDue = orders.filter(o => o.NhomHan === 'sap').length;
  // v4.0: danh sach rieng cac don CHUA hoan thanh, dung hien thi bang o Dashboard (xem module.qlsx.js).
  // v5.6: mo rong tu CHI "Dang san xuat" sang moi trang thai CHUA "Hoan thanh" (bao gom ca "Chua bat
  // dau" va "Tre han") - yeu cau v5.6 "hien thi het cac lenh san xuat chua hoan thanh, ke ca chua bat dau".
  const ordersInProgress = orders.filter(o => o.TrangThai !== 'Hoàn thành');

  const stagesResult = await pool.request().query('SELECT * FROM CongDoanSanXuat ORDER BY ThuTu');
  const stageCounts = {};
  stagesResult.recordset.forEach(s => { stageCounts[s.TenCongDoan] = 0; });
  orders.forEach(o => { if (o.TenCongDoan && stageCounts.hasOwnProperty(o.TenCongDoan)) stageCounts[o.TenCongDoan]++; });

  function buildVendorSummary(field) {
    const isGC = field === 'GiaCong';
    const map = {};
    orders.forEach(o => {
      const ten = isGC ? o.TenNhaGiaCong : o.TenNhaIn;
      if (!ten) return;
      if (!map[ten]) map[ten] = { ten, tongDon: 0, hoanThanh: 0, dangGiu: 0, tongNgay: 0, soDonTinhNgay: 0 };
      map[ten].tongDon++;
      const ngayNhan = isGC ? o.NgayNhanGC : o.NgayNhanIn;
      const ngayGiao = isGC ? o.NgayGiaoGC : o.NgayGiaoIn;
      const soNgay = isGC ? o.SoNgayGC : o.SoNgayIn;
      if (ngayNhan) map[ten].hoanThanh++; else if (ngayGiao) map[ten].dangGiu++;
      if (ngayNhan && soNgay != null && soNgay >= 0) { map[ten].tongNgay += soNgay; map[ten].soDonTinhNgay++; }
    });
    return Object.values(map).map(m => ({
      ten: m.ten, tongDon: m.tongDon, hoanThanh: m.hoanThanh, dangGiu: m.dangGiu,
      ngayTB: m.soDonTinhNgay ? Math.round((m.tongNgay / m.soDonTinhNgay) * 10) / 10 : null
    }));
  }

  res.json({
    success: true,
    data: {
      total, completed, inProgress, notStarted, overdue, soonDue,   // v6.50: + soonDue
      stageCounts, stages: stagesResult.recordset.map(s => s.TenCongDoan),
      orders, ordersInProgress,
      reportGiaCong: buildVendorSummary('GiaCong'),
      reportIn: buildVendorSummary('InTheu')
    }
  });
});

// ============ CANH BAO TRE HAN THU CONG ============
router.post('/canhbao/chay-ngay', requireAuth, requirePermission('QLSX', 'view'), requireChucNang('QLSX', 'dashboard'), async (req, res) => {
  try {
    const result = await checkOverdueOrders();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Lỗi khi kiểm tra trễ hạn.' });
  }
});

module.exports = router;
/* v6.26: phân hệ Báo cáo kinh doanh nạp GIÁ VỐN từ chính hàm tính giá thành ở đây — 1 nguồn sự thật,
   sửa công thức giá thành là báo cáo tự đúng theo. Gắn kèm vào router (router là function nên nhận
   thuộc tính bình thường), không đổi kiểu export nên server.js giữ nguyên. */
module.exports.tinhGiaThanh = tinhGiaThanh;
module.exports.getOrderByMaDH = getOrderByMaDH;
