/* ================================================================================================
   migration_v697.sql   (v7.85)
   AN MA HANG KHOI DANH SACH THE KHO  ->  TheKhoHangHoa.AnTheKho

   Nguyen: "sua phieu bo dau tich tao the kho di la se khong co trong danh sach the kho. ma hang,
   ton kho van con nguyen chi la khong hien o ben the kho."

   BOI CANH. O tich "Tao the kho luon khi luu" tren phieu nhap kho (v6.96) TICH SAN. Bo tich chi lam
   backend KHONG tao dong mau — nhung MA HANG thi van duoc sinh (timHoacTaoMaHang chay truoc va
   khong phu thuoc o tich), nen ma do van nam trong danh sach The kho kem dong "⏳ chua tao the kho".
   Lo de nguyen dau tich khi lap phieu la co mot ma hang khong mong muon nam trong danh sach, ma
   khong co duong nao go ra ngoai viec xoa han ca ma.

   VI SAO PHAI THEM COT chu khong suy tu du lieu. Cach re hon la "ma nao khong con dong mau nao thi
   an" — khong can migration. Nhung Nguyen da chot: bo tich thi GIU NGUYEN du lieu, chi an di. Da
   giu nguyen dong mau thi khong con gi de suy ra ca => bat buoc phai co co rieng.
   Them nua, co rieng con phan biet duoc hai canh khac han nhau:
       AnTheKho = 1     -> nguoi dung CHU DONG khong muon lap the kho cho ma nay
       AnTheKho = NULL  -> chua lap the kho (van hien, kem dong "⏳ chua tao the kho" de nhac)
   Suy tu du lieu thi hai canh nay nhap lam mot, va hang vua nhap kho ma chua kip lap the se BIEN MAT
   khoi danh sach — khong ai biet trong kho dang co hang do.

   ⚠️ CO NAY CHI DE HIEN THI O TAB "THE KHO / TON KHO".
   Ma hang, ton kho, ban hang, don khach GIU NGUYEN — GET /khohang/items van tra ve du moi ma (8 man
   hinh khac dung chung endpoint nay), viec loc bo nam o dung mot cho: ham ve bang cua tab The kho.
   Loc o backend la ban hang mat sach hang vua nhap.

   NULL = hien (mac dinh) -> du lieu dang co khong doi hanh vi.
   Idempotent — chay lai nhieu lan khong loi.
   ================================================================================================ */
IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('TheKhoHangHoa', 'AnTheKho') IS NULL
BEGIN
  ALTER TABLE TheKhoHangHoa ADD AnTheKho BIT NULL;
  PRINT '  + TheKhoHangHoa.AnTheKho (NULL/0 = hien trong danh sach The kho, 1 = an)';
END
ELSE PRINT '  = TheKhoHangHoa.AnTheKho da co';
GO

PRINT '';
PRINT '=== migration_v697 XONG ===';
PRINT 'Cach dung: Kho hang hoa -> Phieu nhap kho -> Sua phieu -> BO tich "Tao the kho luon khi luu".';
PRINT 'Tich lai la hien tro lai. Ma hang / ton kho / ban hang KHONG doi.';
PRINT 'PHAI pm2 restart qlnoibo (sua routes/nhapkho.js + khohang.js + utils/theKhoMau.js) + Ctrl+F5.';
PRINT '';
