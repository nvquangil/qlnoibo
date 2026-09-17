/* ================================================================================================
   GIA NHAP CUA MA HANG  (v7.88)

   Nguyen: "danh muc hang hoa (ma hang) them cot gia nhap" -> chot: TU TINH tu phieu nhap kho, theo
   DVT CHINH (cung don vi voi cot Gia ban); rieng "nhap tu san xuat lay tu gia thanh 1 cai".

   ⚠️ BAN CONG THUC NAY DA CO TU v6.91 trong routes/baocao.js (bao cao Ton kho hang hoa). Tach ra
   day de DANH MUC HANG HOA dung LAI dung con so do. Viet ban thu hai la hai man hinh cung goi
   "gia nhap" ma ra hai so khac nhau — nguoi dung khong biet tin cai nao, va do ra thi phai doc ca
   hai cau SQL moi hieu vi sao lech.

   HAI NGUON, UU TIEN A TRUOC:
     A) HANG MUA NGOAI — BINH QUAN GIA QUYEN tu phieu nhap cua NHA CUNG CAP:
            gia = SUM(ThanhTien) / SUM(SoLuongChinh)
        Chia cho SoLuongChinh (KHONG phai SoLuong) de ra dung DON VI CHINH.
        Chi tinh dong CO TIEN (ThanhTien > 0): dong gia 0 keo binh quan tut xuong sai.
        ⚠️ KHONG lay "lan nhap gan nhat": mot lo mua le gia cao la ca ma nhin nhu dat len, trong khi
        tien that da bo ra la binh quan. Bao cao ton kho dang dung BQGQ — hai cho phai giong nhau.
     B) HANG TU SAN XUAT — phieu loai 'SanXuat' LUON co DonGia = 0 (nhapkho.js khong sinh cong no
        ao), nen khong the lay gia tu phieu. Lay GIA THANH 1 CAI da chot trong bang GiaVonHangHoa
        (nut "Nạp từ lệnh SX" o Bao cao -> Gia von).
     Ma vua mua ngoai vua tu san xuat -> uu tien A: tien THAT da bo ra nam o phieu NCC.

   ⚠️ DON VI CUA HAI NGUON KHAC NHAU:
        A da la gia 1 DON VI CHINH      -> giu nguyen
        B la gia 1 DON VI GOC (1 Cai)   -> ma nao co DON VI CHINH LA DON VI GOP thi phai NHAN he so
   Bo qua cho nay la ma quan theo Ri hien gia nhap be gap <he so> lan so voi gia ban.
   ================================================================================================ */
const { so, donViChinhLaGop } = require('./banHangCommon');
const { sql } = require('../db');

async function coBang(pool, ten) {
  try {
    const r = (await pool.request().query(`SELECT OBJECT_ID('dbo.${ten}', 'U') AS t`)).recordset[0] || {};
    return r.t != null;
  } catch (e) { return false; }
}

/* Tra ve Map(MaHangID -> { gia, goc, nguon }).
     gia   : con so
     goc   : true = gia theo DON VI GOC, phai nhan he so neu don vi chinh la gop (xem giaTheoDvChinh)
     nguon : chuoi de hien cho nguoi dung biet so nay o dau ra */
async function mapGiaNhap(pool) {
  const map = new Map();
  if (!await coBang(pool, 'PhieuNhapKhoHangChiTiet')) return map;
  const coGiaVon = await coBang(pool, 'GiaVonHangHoa');
  const rs = (await pool.request().query(`
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
  rs.forEach(r => {
    const slMua = so(r.SLMua), tienMua = so(r.TienMua);
    if (slMua > 0 && tienMua > 0) {
      map.set(r.MaHangID, { gia: tienMua / slMua, goc: false, nguon: 'Phiếu nhập (BQGQ)' });
    } else if (so(r.GiaVon) > 0) {
      map.set(r.MaHangID, {
        gia: so(r.GiaVon), goc: true,
        nguon: r.NguonGia === 'Lệnh SX' ? (r.MaDHNguon ? 'Lệnh SX ' + r.MaDHNguon : 'Lệnh SX') : (r.NguonGia || 'Khai tay')
      });
    }
  });
  return map;
}

/* Quy gia ve DUNG DON VI CHINH cua ma hang. `mh` can co DonViCoBan / DonViQuyDoi / LoaiRi.
   `laGop` truyen vao la ham donViChinhLaGop cua chinh noi goi — de khong nhan ban them mot ban
   dinh nghia "don vi chinh la don vi gop" thu N trong repo nay. */
function giaTheoDvChinh(gn, mh, laGop) {
  if (!gn) return null;
  const heSo = laGop(mh) ? (so(mh.LoaiRi) || 1) : 1;
  return gn.goc ? gn.gia * heSo : gn.gia;
}

/* ================================================================================================
   v8.07 — TỰ ĐỘNG nạp Giá vốn hàng hóa TỪ giá nhập NCC.

   Nguyen: "giá vốn hàng hóa nếu nhập kho từ nhà cung cấp có giá nhập thì lấy luôn giá nhập không
   phải khai giá" -> chốt qua 2 câu hỏi: (1) TỰ ĐỘNG chạy mỗi khi lưu/sửa/hủy phiếu nhập kho từ NCC
   (không cần bấm nút riêng); (2) KHÔNG ghi đè mã đã "Khai tay" — chỉ ghi mã còn trống hoặc đang lấy
   từ nguồn tự động khác (vd 'Lệnh SX').

   Trước v8.07, "Giá nhập" (cột ở Danh mục hàng hóa) và "Giá vốn" (bảng GiaVonHangHoa, dùng tính
   lãi/lỗ) là HAI THỨ TÁCH RỜI: cột Giá nhập chỉ để XEM, còn Giá vốn cho hàng "Đặt ngoài" (mua NCC)
   vẫn phải khai tay 100% dù hệ thống đã biết sẵn giá nhập.

   ⚠️ Vì chạy TỰ ĐỘNG lặp lại (không phải nạp 1 lần rồi thôi như nút "Nạp từ lệnh SX"), giá vốn của
   những mã KHÔNG khai tay sẽ TRÔI THEO bình quân gia quyền mới nhất mỗi lần có phiếu nhập NCC liên
   quan — tức KHÔNG còn "chốt lại" bất biến như triết lý ban đầu của màn Giá vốn (xem renderGiaVon).
   Đây là lựa chọn CÓ CHỦ Ý của Nguyen (đã hỏi rõ, đã xác nhận đánh đổi này), không phải sơ suất.

   Chỉ tính lại cho DANH SÁCH MaHangID truyền vào (mã hàng trên đúng phiếu vừa đổi) — không quét lại
   toàn bảng — nên rẻ và không đụng phiếu khác đang ghi. Dùng LẠI đúng mapGiaNhap()/giaTheoDvChinh()
   — một nguồn sự thật với cột "Giá nhập" và nút "Nạp từ lệnh SX" — không viết công thức thứ hai.

   Gọi hàm này SAU KHI phiếu chính đã commit, bọc try/catch RIÊNG ở nơi gọi — lỗi ở đây tuyệt đối
   không được làm hỏng việc lưu/sửa/hủy phiếu (giống triết lý themCotStt ở common.js: một phần phụ
   lỗi thì bỏ qua phần đó, không kéo sập cả thao tác chính). */
async function napGiaVonTuMaHang(pool, maHangIds, userId) {
  const ids = [...new Set((maHangIds || []).map(Number))].filter(n => Number.isInteger(n) && n > 0);
  if (!ids.length) return { capNhat: 0, boQua: 0 };
  if (!await coBang(pool, 'GiaVonHangHoa')) return { capNhat: 0, boQua: 0 };

  const mhRows = (await pool.request().query(`
    SELECT h.MaHangID, h.DonViCoBan, h.DonViQuyDoi, h.LoaiRi, gv.NguonGia
    FROM TheKhoHangHoa h
    LEFT JOIN GiaVonHangHoa gv ON gv.MaHangID = h.MaHangID
    WHERE h.MaHangID IN (${ids.join(',')})`)).recordset;   // ids da loc Number.isInteger o tren -> an toan

  const gnMap = await mapGiaNhap(pool);
  let capNhat = 0, boQua = 0;
  for (const mh of mhRows) {
    if (mh.NguonGia === 'Khai tay') { boQua++; continue; }   // Nguyen chot: khai tay giu nguyen, khong dam
    const gia = giaTheoDvChinh(gnMap.get(mh.MaHangID), mh, donViChinhLaGop);
    if (!(gia > 0)) continue;   // chua co nguon nao tinh duoc -> bo qua, khong bia gia 0
    await pool.request()
      .input('mh', sql.Int, mh.MaHangID).input('gv', sql.Decimal(18, 2), gia)
      .input('u', sql.Int, userId || null)
      .query(`
        MERGE GiaVonHangHoa AS t
        USING (SELECT @mh AS MaHangID) AS s ON t.MaHangID = s.MaHangID
        WHEN MATCHED THEN UPDATE SET GiaVon=@gv, NguonGia=N'Phiếu nhập NCC', MaDHNguon=NULL,
             NgayCapNhat=CAST(SYSDATETIME() AS DATE), NguoiCapNhatID=@u
        WHEN NOT MATCHED THEN INSERT (MaHangID, GiaVon, NguonGia, NgayCapNhat, NguoiCapNhatID)
             VALUES (@mh, @gv, N'Phiếu nhập NCC', CAST(SYSDATETIME() AS DATE), @u);`);
    capNhat++;
  }
  return { capNhat, boQua };
}

module.exports = { mapGiaNhap, giaTheoDvChinh, napGiaVonTuMaHang };
