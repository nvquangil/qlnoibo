/* ================================================================================================
   migration_v679.sql   (v6.71)
   CONG KHAI TUNG MA HANG LEN CATALOGUE.

   TRUOC DAY: bat/tat cong khai chi lam duoc theo CA DANH MUC (TheKhoDanhMuc.CongKhai - v5.62).
   Ca danh muc bat len la MOI ma hang con ton deu hien ra cho khach xem. Muon giau 1 ma (hang mau,
   hang de rieng cho 1 khach, hang loi...) thi khong co cach nao ngoai viec chuyen no sang danh muc
   khac hoac cho ton ve 0.

   NAY: them cong tac RIENG cho tung ma hang. Ma hang hien tren catalogue khi VA CHI KHI:
        TheKhoDanhMuc.CongKhai = 1   VA   TheKhoHangHoa.CongKhai = 1
   Cong tac danh muc van la cong tac TONG - tat danh muc thi ca danh muc bien mat, khong ma nao lot.

   ⚠️ MAC DINH = 1 (HIEN), KHONG phai 0.
   Neu de 0 thi ngay sau khi chay migration, TOAN BO hang dang ban tren catalogue bien mat mot luc
   ma khong ai kip biet. De 1 thi khong co gi doi, roi ai muon giau ma nao thi tat ma do.
   Rieng ma TAO MOI tu v6.71 cung mac dinh HIEN (dung thoi quen cu), nguoi lap the tu tat neu can.
   ================================================================================================ */

IF COL_LENGTH('TheKhoHangHoa', 'CongKhai') IS NULL
BEGIN
  ALTER TABLE TheKhoHangHoa ADD CongKhai BIT NOT NULL CONSTRAINT DF_TheKhoHangHoa_CongKhai DEFAULT 1;
  PRINT '  + Da them TheKhoHangHoa.CongKhai (mac dinh 1 = HIEN tren catalogue)';
END
ELSE PRINT '  = TheKhoHangHoa.CongKhai da co, bo qua';
GO

PRINT '';
PRINT '=== migration_v679 XONG ===';
PRINT 'Khong co gi doi ngay: moi ma hang van HIEN nhu truoc.';
PRINT 'Vao The kho hang hoa -> Sua ma hang -> bo tich "Hien tren catalogue" de giau tung ma.';
GO
