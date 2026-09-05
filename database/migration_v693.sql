/* ================================================================================================
   migration_v693.sql   (v7.59)
   HANG MAU / CHO KHACH MUON  —  danh dau tren PHIEU BAN HANG, khong dung toi luong tien

   YEU CAU: "hang gui mau cho khach muon van lam phieu ban hang tinh vao cong no, khi khach tra thi
   lam phieu nhap lai. Lam the nao de biet mau do da gui cho khach do roi ma VAN DUNG LUONG PHIEU
   BAN HANG BINH THUONG?"

   CACH LAM — CHI THEM CO, KHONG SUA GI DANG CHAY:
     · Phieu ban hang van TRU TON va van vao CONG NO y het truoc (khong dong vao phep tinh nao).
     · Them mot CO tren DAU PHIEU: `LaHangMau`. 1 = lan giao nay la GUI MAU / CHO MUON.
     · Khi khach tra: dung PHIEU NHAP LAI (da co san) — hoan ton + TRU cong no dung so da ghi no,
       gan thang vao dong phieu ban goc qua `PhieuNhapLaiChiTiet.PhieuBHChiTietID`.

   ⚠️ VI SAO KHONG DUNG "PHIEU NHAP KHO" DE NHAN MAU TRA VE (cach dang lam):
   `PhieuNhapKhoHang` chi co hai loai nguon: 'NhaCungCap' (sinh cong no PHAI TRA cho NCC) va
   'SanXuat'. KHONG duong nao cham vao cong no KHACH HANG. Nhan mau tra ve bang phieu nhap kho thi
   hang ve kho nhung TIEN MAU TREO VINH VIEN o so cong no khach — va neu lo chon mot NCC thi con de
   them mot khoan phai tra khong co that. Phieu nhap lai moi la chung tu dung.

   KHONG can bang moi: "con o khach bao nhieu" tinh duoc tu du lieu san
       con o khach = SL dong phieu ban (LaHangMau = 1, phieu chua huy)
                    - SUM(SL cac dong phieu nhap lai tro ve dung dong do, phieu nhap lai chua huy)
   Cong thuc nay DA CO SAN trong `layDongDaBan()` (cot DaTraCai / ConTraCai) — tu ban nay no nam o
   utils/dongDaBanChoKhach.js de MOI man hinh doc CHUNG mot ban, khong the lech nhau.
   ================================================================================================ */
IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

/* ---------------- 1. Co tren dau phieu ban hang ---------------- */
IF COL_LENGTH('PhieuBanHang', 'LaHangMau') IS NULL
BEGIN
  ALTER TABLE PhieuBanHang ADD LaHangMau BIT NULL;
  PRINT '  + PhieuBanHang.LaHangMau (1 = gui mau / cho khach muon; NULL hoac 0 = ban binh thuong)';
END
ELSE PRINT '  = PhieuBanHang.LaHangMau da co';
GO

/* KHONG backfill: khong co cach nao suy ra phieu cu nao la gui mau. Phieu cu = ban binh thuong
   (dung voi so sach hien tai). Muon danh dau nguoc mot phieu cu thi vao Sua phieu, tich o do. */

/* Loc "cac phieu gui mau" chay theo khach + ngay -> co chi muc cho nhe. Chi muc LOC (filtered index)
   nen chi phi gan nhu 0 khi phan lon phieu la ban binh thuong. */
IF COL_LENGTH('PhieuBanHang', 'LaHangMau') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PhieuBanHang_HangMau' AND object_id = OBJECT_ID('PhieuBanHang'))
BEGIN
  CREATE INDEX IX_PhieuBanHang_HangMau ON PhieuBanHang(TenKhach, NgayBan) WHERE LaHangMau = 1;
  PRINT '  + Chi muc IX_PhieuBanHang_HangMau (loc: chi cac phieu gui mau)';
END
ELSE PRINT '  = Chi muc IX_PhieuBanHang_HangMau da co';
GO

/* ---------------- 2. Chuc nang cho tab so theo doi ----------------
   Key PHAI trung key tab o frontend getTabs() (module.khohang.js) — effectivePerm tra theo
   'KHOHANG:' + activeTab. Dat sai key = tab luon bi coi la khong co quyen. */
MERGE ChucNang AS t
USING (VALUES
    ('KHOHANG','hangmau', N'Hàng mẫu ở khách', 8)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN
  INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
PRINT '  + ChucNang KHOHANG/hangmau';
GO

PRINT '';
PRINT '=== migration_v693 XONG ===';
PRINT 'PHAI pm2 restart qlnoibo + Ctrl+F5.';
PRINT 'PHAI cap quyen: Quan ly User -> Ma tran phan quyen -> KHOHANG / "Hàng mẫu ở khách".';
PRINT '';
PRINT 'Tu day:';
PRINT '  · Form phieu ban hang co o tich "Gui mau / cho khach muon" (dau phieu). Luong tien KHONG doi.';
PRINT '  · Chon khach o form ban hang -> tu nhac khach do dang giu mau gi, tu bao gio, con bao nhieu.';
PRINT '  · Tab moi "Hàng mẫu ở khách": SL gui / da tra / con o khach / so ngay da muon + xuat Excel.';
PRINT '  · Popup The kho cua ma hang: ma do dang co mau o nhung khach nao.';
PRINT '  · So chi tiet cong no khach: dong phieu gui mau duoc danh dau rieng.';
PRINT '  · Khach TRA MAU: lam PHIEU NHAP LAI (KHONG phai phieu nhap kho) -> hoan ton + TRU cong no.';
GO
