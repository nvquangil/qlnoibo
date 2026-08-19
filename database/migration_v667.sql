/* ================================================================
   MIGRATION v6.21 — TY LE CHIET KHAU SHOP / NPP: DANH CHUNG 1 TY LE
   ----------------------------------------------------------------
   Yeu cau: "phan chiet khau shop va NPP danh chung ty le chu khong tung ma hang"
            "gia CK cua NPP = gia shop sau CK 33% x 17%"  => CHIET KHAU CHONG:
              Gia shop = GiaBan   x (1 - CK_SHOP/100)
              Gia NPP  = Gia shop x (1 - CK_NPP/100)
            vd GiaBan 100.000, 33%/17% -> shop 67.000 -> NPP 55.610

   Ty le luu o CauHinhHeThong (bang da co san tu schema.sql, khong tao bang moi):
      CK_SHOP = 33
      CK_NPP  = 17
   -> Sua 1 cho, ca bang The kho + bang ke in + file Excel doi theo.

   !! MIGRATION NAY LA TUY CHON: backend tu mac dinh 33/17 khi chua co 2 dong nay, va luu bang MERGE
      (lan bam "Luu ty le" dau tien se tu tao dong). Chay de gia tri nam san trong CSDL cho ro rang.

   ---- Ve migration_v666 (v6.20) ----
   v6.20 tung them 2 cot TheKhoHangHoa.PhanTramCKShop / PhanTramCKNPP de khai % THEO TUNG MA HANG.
   Cach do DA BO. 2 cot nay KHONG con duoc doc/ghi. CO TINH GIU LAI (khong DROP) de:
     - ban DB da chay v666 khong bi loi gi,
     - ban DB chua chay v666 cung khong can chay nua.
   Neu muon don sach, chay tay:
     -- ALTER TABLE dbo.TheKhoHangHoa DROP COLUMN PhanTramCKShop, PhanTramCKNPP;

   Chay 1 lan. IDEMPOTENT. YEU CAU: schema.sql.
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

/* Chi INSERT khi CHUA co - KHONG ghi de gia tri nguoi dung da tu sua tren giao dien. */
MERGE CauHinhHeThong AS t
USING (VALUES ('CK_SHOP', N'33'), ('CK_NPP', N'17')) AS s (ConfigKey, ConfigValue)
  ON t.ConfigKey = s.ConfigKey
WHEN NOT MATCHED THEN INSERT (ConfigKey, ConfigValue) VALUES (s.ConfigKey, s.ConfigValue);
GO

SELECT ConfigKey, ConfigValue FROM CauHinhHeThong WHERE ConfigKey IN ('CK_SHOP', 'CK_NPP');
GO

PRINT '';
PRINT '=== MIGRATION v667 HOAN TAT ===';
PRINT 'Doi ty le ngay tren tab "The kho / Ton kho" (o CK shop / CK NPP + nut Luu ty le).';
GO
SET NOEXEC OFF;
GO
