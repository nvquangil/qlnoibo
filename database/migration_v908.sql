/* ================================================================================================
   migration_v908.sql — v9.99: TÁCH CHẤM CÔNG + CÔNG ĐOẠN MAY THÀNH CHỨC NĂNG RIÊNG TRONG "BẢNG LƯƠNG CỦA TÔI"
   ------------------------------------------------------------------------------------------------
   ⚠️ BẢN CẬP NHẬT (23/11, lần 2) — nếu đã chạy bản trước thì CHẠY LẠI file này: nay khai HAI dòng
      chức năng thay vì một. MERGE nên chạy lại hoàn toàn vô hại.

   Nguyen 23/11/2026: *"Bảng lương của tôi đang hiện bảng chấm công trên 1 trang. Sửa thành 1 chức
   năng bảng chấm công trong bảng lương của tôi. Vẫn auto có khi tạo user."*
   Tiếp: *"Tách luôn công đoạn may thành chức năng riêng trong bảng lương của tôi."*

   Trước: chấm công là CỘT PHẢI (v9.69), công đoạn may là MỤC CUỐI (v9.90) của trang phiếu lương.
   Nay:   mỗi cái là MỘT CHỨC NĂNG (menu con) riêng của phân hệ MYPAY:
            MYPAY/chamcongcuatoi     — Chấm công của tôi
            MYPAY/congdoanmaycuatoi  — Công đoạn may của tôi

   🔴 Cả hai MacDinhCho = 1 (TICK SẴN) — KHÁC hẳn hai dòng MYPAY đã có trước đó:
        MYPAY/sanluongcuatoi      (v895) MacDinhCho = 0 — phải tick mới có
        MYPAY/congdoanmaytatca    (v907) MacDinhCho = 0 — phải tick mới có
      Ở đây là 1 vì Nguyen chốt *"vẫn auto có khi tạo user"*: đây không phải quyền MỞ RỘNG phạm vi
      (người dùng chỉ xem dữ liệu CỦA CHÍNH MÌNH — máy chủ lọc theo Users.NhanVienID của phiên),
      nên mặc định phải CÓ, y như 'MYPAY/luongcuatoi' (migration_v620). Quản trị muốn giấu thì bỏ
      tick ở Ma trận phân quyền → Chức năng.
      ⚠️ Riêng 'congdoanmaycuatoi' chỉ là CÁI MENU. Ai thật sự GHI được vẫn do máy chủ quyết theo
         bộ phận ("May") — chanNeuKhongPhaiThoMay() trong routes/qlsx.js, đúng chốt v9.90 "chỉ cần
         thuộc bộ phận May, không phải tick gì". Người không thuộc bộ phận May mở mục này ra sẽ
         thấy CÂU LÝ DO, không phải trang trắng (luật "ẩn mà không nói lý do = tệ hơn nút câm").

   Cơ chế "auto có khi tạo user": KHÔNG có bước chép quyền lúc tạo tài khoản. Hệ thống đọc
   ISNULL(ChucNangPermissions.CanView, ISNULL(ChucNang.MacDinhCho, 1)) — nghĩa là chưa có dòng cấu
   hình riêng thì lấy MacDinhCho. Đặt 1 ở đây là đủ để mọi user cũ VÀ mới đều thấy ngay.
   (routes/users.js → bieuThucMacDinhChucNang(); backend/utils/loadUserContext.js.)

   KHÔNG tạo bảng/cột mới. KHÔNG đụng dữ liệu chấm công / PhanCongMay — chỉ khai danh mục chức năng.
   Chạy SAU: migration_v684.sql (cột MacDinhCho). Chạy TRƯỚC khi pm2 restart.
   Chạy lại nhiều lần vô hại (MERGE theo khóa ModuleCode + MaChucNang).
   ================================================================================================ */

SET NOCOUNT ON;
GO

/* ---- 1. Khai HAI chức năng mới (MacDinhCho = 1: tick sẵn cho mọi nhóm) --------------------- */
IF COL_LENGTH('ChucNang', 'MacDinhCho') IS NULL
BEGIN
  /* Bản cài chưa có cột MacDinhCho: vẫn khai được dòng chức năng, và mặc định của hệ thống khi
     thiếu cột cũng là CHO XEM (bieuThucMacDinhChucNang trả hằng '1') — đúng ý "auto có". */
  MERGE ChucNang AS t
  USING (VALUES
    ('MYPAY', 'chamcongcuatoi',    N'Chấm công của tôi — giờ vào / giờ ra', 2),
    ('MYPAY', 'congdoanmaycuatoi', N'Công đoạn may của tôi — thợ may tự ghi', 3)
  ) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
  WHEN MATCHED THEN UPDATE SET t.TenChucNang = s.TenChucNang, t.ThuTu = s.ThuTu
  WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);

  PRINT N'v908: da khai MYPAY/chamcongcuatoi + MYPAY/congdoanmaycuatoi (ban cai chua co cot MacDinhCho - mac dinh van la CHO XEM).';
END
ELSE
BEGIN
  MERGE ChucNang AS t
  USING (VALUES
    ('MYPAY', 'chamcongcuatoi',    N'Chấm công của tôi — giờ vào / giờ ra', 2, 1),
    ('MYPAY', 'congdoanmaycuatoi', N'Công đoạn may của tôi — thợ may tự ghi', 3, 1)
  ) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
  WHEN MATCHED THEN UPDATE SET t.TenChucNang = s.TenChucNang, t.ThuTu = s.ThuTu, t.MacDinhCho = s.MacDinhCho
  WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho)
    VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu, s.MacDinhCho);

  PRINT N'v908: da khai MYPAY/chamcongcuatoi + MYPAY/congdoanmaycuatoi (MacDinhCho = 1 - tick san, user moi tu co).';
END
GO

/* ---- 2. Kiểm tra sau khi chạy (CHỈ ĐỌC) ---------------------------------------------------- */
/* a) NĂM dòng chức năng của MYPAY. Kỳ vọng:
      luongcuatoi         MacDinhCho 1 (hoặc NULL — bản cũ khai trước khi có cột)
      chamcongcuatoi      MacDinhCho 1   <= dòng vừa thêm
      congdoanmaycuatoi   MacDinhCho 1   <= dòng vừa thêm
      sanluongcuatoi      MacDinhCho 0
      congdoanmaytatca    MacDinhCho 0                                                           */
SELECT ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho
FROM ChucNang WHERE ModuleCode = 'MYPAY' ORDER BY ThuTu, MaChucNang;

/* b) 🔴 CÓ NHÓM NÀO ĐANG BỊ CHẶN KHÔNG? Dòng cấu hình riêng (nếu ai đó đã bấm Lưu ở Ma trận phân
      quyền) GHI ĐÈ MacDinhCho. Câu này liệt kê nhóm đang CanView = 0 với chức năng mới — kỳ vọng
      KHÔNG CÓ DÒNG NÀO ngay sau khi chạy (vì chưa ai cấu hình riêng cho mã chức năng vừa tạo). */
SELECT cn.MaChucNang, g.GroupID, g.TenNhom, cp.CanView
FROM ChucNangPermissions cp
JOIN ChucNang cn ON cn.ChucNangID = cp.ChucNangID
JOIN Groups g ON g.GroupID = cp.GroupID
WHERE cn.ModuleCode = 'MYPAY' AND cn.MaChucNang IN ('chamcongcuatoi', 'congdoanmaycuatoi')
  AND ISNULL(cp.CanView, 1) = 0
ORDER BY cn.MaChucNang, g.TenNhom;

/* c) Nhắc: ai KHÔNG gắn hồ sơ nhân viên thì vào chức năng này sẽ thấy câu "chưa được liên kết"
      (không phải lỗi — màn hình nói rõ cách xử lý). Danh sách tài khoản đang thiếu liên kết: */
SELECT u.UserID, u.Username, u.HoTen
FROM Users u
WHERE u.NhanVienID IS NULL AND u.IsActive = 1
ORDER BY u.Username;
GO
