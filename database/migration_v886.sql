/* ================================================================================================
   MIGRATION v8.86 (app v9.32) — PHIẾU CHI CHO NHÂN VIÊN + TẠM ỨNG TRỪ LƯƠNG

   Nguyen 2026-11-06: *"phiếu chi nếu chọn chi cho nhân viên hiển thị list nhân viên. chọn tạm ứng
   thì ghi nhận vào bảng lương tháng đó để trừ lương"*.

   Chốt qua hỏi đáp:
     · Tạm ứng trên bảng lương = **TỰ TÍNH từ phiếu chi** (ô sửa tay thành chỉ đọc).
     · Phiếu chi có ô **"Trừ vào lương tháng"**, mặc định = tháng của ngày chi.
     · Chi cho nhân viên có **nhiều loại**; CHỈ loại 'TamUng' mới trừ lương.

   🔴 VÌ SAO PHẢI TỰ TÍNH, KHÔNG GHI THẲNG VÀO BẢNG LƯƠNG:
   routes/payroll.js (POST /bangluong/tinh) làm: DELETE toàn bộ BangLuongChiTiet của tháng rồi
   INSERT lại với TamUng = 0. Nếu tạm ứng được GHI vào bảng lương lúc lập phiếu chi thì chỉ cần ai
   đó bấm "Tính lương" lại một lần là **tạm ứng bay sạch và ThucLinh tăng đúng bằng số đã ứng** —
   tức TRẢ THỪA TIỀN, không một thông báo nào. Đúng họ lỗi `DaTraCai` về 0 ở v7.59.
   ⇒ Nguồn sự thật là PHIẾU CHI. Bảng lương cộng lại từ đó mỗi lần tính; tính bao nhiêu lần cũng đúng.

   Cột LoaiDoiTuong của PhieuChi vốn đã nhận giá trị N'NhanVien' (xem mặc định khi tạo bảng), chỉ
   thiếu chỗ lưu LÀ AI và trừ vào tháng nào.

   AN TOÀN: chỉ THÊM cột NULL, không sửa/xóa dữ liệu nào. Phiếu chi cũ giữ nguyên.
   CHẠY 1 LẦN. pm2 restart sau khi chạy.
   ================================================================================================ */

IF COL_LENGTH('PhieuChi', 'NhanVienID') IS NULL
BEGIN
    ALTER TABLE PhieuChi ADD NhanVienID INT NULL
        CONSTRAINT FK_PhieuChi_NhanVien FOREIGN KEY REFERENCES NhanVien(NhanVienID);
    PRINT N'  + Cot PhieuChi.NhanVienID';
END ELSE PRINT N'  = Cot PhieuChi.NhanVienID da co';
GO

/* Loại chi cho nhân viên. CHỈ N'TamUng' mới trừ lương — các loại khác là chi phí bình thường.
   Để NVARCHAR tự do (không CHECK) vì danh sách loại còn có thể thêm; ứng dụng kiểm. */
IF COL_LENGTH('PhieuChi', 'LoaiChiNV') IS NULL
BEGIN
    ALTER TABLE PhieuChi ADD LoaiChiNV NVARCHAR(20) NULL;
    PRINT N'  + Cot PhieuChi.LoaiChiNV (TamUng / HoanUng / CongTacPhi / ThuongTienMat / Khac)';
END ELSE PRINT N'  = Cot PhieuChi.LoaiChiNV da co';
GO

/* Trừ vào lương tháng nào. Mặc định ứng dụng điền theo ngày chi, nhưng cho sửa:
   ứng ngày 28/11 có thể muốn trừ vào lương tháng 12. */
IF COL_LENGTH('PhieuChi', 'TruLuongNam') IS NULL
BEGIN
    ALTER TABLE PhieuChi ADD TruLuongNam SMALLINT NULL, TruLuongThang TINYINT NULL;
    PRINT N'  + Cot PhieuChi.TruLuongNam / TruLuongThang';
END ELSE PRINT N'  = Cot PhieuChi.TruLuongNam da co';
GO

/* Bảng lương mỗi lần tính phải cộng tạm ứng theo (nhân viên, năm, tháng) — index cho việc đó. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PhieuChi_TamUngNV')
BEGIN
    CREATE INDEX IX_PhieuChi_TamUngNV ON PhieuChi(NhanVienID, TruLuongNam, TruLuongThang)
        INCLUDE (SoTien, LoaiChiNV);
    PRINT N'  + Index IX_PhieuChi_TamUngNV';
END ELSE PRINT N'  = Index IX_PhieuChi_TamUngNV da co';
GO

PRINT N'migration_v886.sql hoan tat. NHO: pm2 restart qlnoibo.';
GO

/* ================================================================================================
   KIEM TRA SAU KHI CHAY:

   -- (a) Ba cot phai co
   SELECT CASE WHEN COL_LENGTH('PhieuChi','NhanVienID')   IS NULL THEN N'THIEU' ELSE N'OK' END AS NhanVienID,
          CASE WHEN COL_LENGTH('PhieuChi','LoaiChiNV')    IS NULL THEN N'THIEU' ELSE N'OK' END AS LoaiChiNV,
          CASE WHEN COL_LENGTH('PhieuChi','TruLuongThang')IS NULL THEN N'THIEU' ELSE N'OK' END AS TruLuongThang;

   -- (b) Phieu chi cu khong bi dong vao (tat ca phai NULL)
   SELECT COUNT(*) AS SoPhieuCu_CoNhanVien FROM PhieuChi WHERE NhanVienID IS NOT NULL;

   -- (c) Sau khi dung mot thoi gian: tam ung thang nay theo nhan vien
   SELECT nv.MaNhanVien, nv.HoTen, SUM(pc.SoTien) AS TamUng, COUNT(*) AS SoPhieu
   FROM PhieuChi pc JOIN NhanVien nv ON nv.NhanVienID = pc.NhanVienID
   WHERE pc.LoaiChiNV = N'TamUng' AND pc.TruLuongNam = YEAR(GETDATE()) AND pc.TruLuongThang = MONTH(GETDATE())
   GROUP BY nv.MaNhanVien, nv.HoTen ORDER BY nv.HoTen;
   ================================================================================================ */
