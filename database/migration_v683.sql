/* ================================================================================================
   migration_v683.sql   (v6.94)
   DANH MUC HANG HOA (MA HANG) — them chuc nang de phan quyen duoc.

   ⚠️ KHONG tao bang moi. `TheKhoHangHoa` DA LA danh muc hang hoa; truoc gio chi THIEU MOT MAN HINH
   de sua Ma hang / Ten hang, nen go sai la khong sua duoc. Tao bang `DanhMucHangHoa` rieng se thanh
   HAI nguon su that cho cung mot thu — chac chan lech nhau.
   File nay vi vay CHI them 1 dong ChucNang.

   Khong chay file nay thi tab "Hàng hóa (mã hàng)" VAN hoat dong (effectivePerm: khong co dong cau
   hinh rieng thi khong han che them) — chi la khong hien trong Ma tran phan quyen de chan bot ai.
   ================================================================================================ */
MERGE ChucNang AS t
USING (VALUES
    ('DANHMUC','hanghoa', N'Hàng hóa (mã hàng)', 12)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
     VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '';
PRINT '=== migration_v683 XONG ===';
PRINT 'Vao Quan ly User -> Ma tran phan quyen -> cap DANHMUC/hanghoa neu muon gioi han rieng tab nay.';
PRINT 'PHAI pm2 restart qlnoibo (sua backend/routes/danhmuc.js + utils/maHangThamChieu.js moi).';
GO
