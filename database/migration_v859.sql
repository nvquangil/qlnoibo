/* ================================================================================================
   MIGRATION v8.59 — TACH DAI SIZE TRONG MOT LENH SAN XUAT

   Yeu cau Nguyen (2026-10-01): mot lenh cat chung mot so do nhieu size, nhung DONG GOI va NHAP KHO
   lai tach theo DAI SIZE. Vi du he so so cat = 11 -> moi lop cat ra 11 cai = dai 2-7 (6 cai) +
   dai 8-12 (5 cai). He so 10 -> dai 8-12 (5) + dai 13-17 (5).

   KHAI NIEM:
     - "Dai size" THUOC VE TUNG LENH (khong phai danh muc dung chung toan he thong).
     - He so cua dai = so cai trong 1 RI CUA DAI DO.
     - ⚠️ BAT BIEN: TONG he so cac dai = DonHangSanXuat.HeSoQuyDoi cua lenh (6 + 5 = 11).
       Rang buoc nay he thong KIEM O TANG UNG DUNG (form khoa nut Luu khi chua khop), KHONG dat
       CHECK constraint o DB: he so lenh nam o BANG KHAC, CHECK khong tham chieu cheo bang duoc.

   QUYET DINH DA CHOT (xem PRD_v859_TACH_DAI_SIZE.md):
     Q1 nut "Tach dai size" hien khi he so > 6, KHONG chan cung.
     Q2 cong doan nhap theo dai: May + QC + Giao gia cong + Dong goi + Kho nhap.
     Q3 N dai, khong khoa 2.
     Q4 moi dai mot ma hang the kho.
     Q5 giao viec may TACH theo dai.
     Q6 in theu TACH theo dai.

   ⚠️ VI SAO THEM COT CHU KHONG TAO BANG TIEN DO RIENG:
   Moi ham dang cong `SUM(SoLuongLuyKe)` / `SUM(SoLuongNhan ...)` — luong khoan may, luong gia cong,
   so cong no nha gia cong, bao cao nang suat, gia thanh — TU DUNG ma KHONG phai sua. Tach dai chi
   lam NHIEU DONG HON, tong khong doi. Dong cu co DaiSizeID = NULL nen moi truy van hien tai giu
   nguyen ket qua.

   AN TOAN: moi cot deu NULL, khong DEFAULT, khong backfill. Lenh KHONG tach chay y het hom nay.
   Khoa ngoai de NO ACTION (mac dinh) — CO Y: xoa mot dai dang co tien do se bi DB chan. Tang ung
   dung phai kiem TRUOC va bao bang tieng nguoi, dung de SQL Server nem ten khoa ngoai ra man hinh
   (bai hoc v8.55 — FK PhanCongMay chan DELETE don gia cong doan may).

   CHAY 1 LAN. Neu pm2 dang chay thi PHAI restart lai sau khi chay migration.
   ================================================================================================ */

/* ---------- 1. Bang dai size cua tung lenh ---------- */
IF OBJECT_ID('DonHangDaiSize') IS NULL
BEGIN
    CREATE TABLE DonHangDaiSize (
        ID         INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID  INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        TenDai     NVARCHAR(100) NOT NULL,   -- "2-7", "8-12", "13-17"
        HeSo       INT NOT NULL,             -- so cai trong 1 ri CUA DAI NAY
        ThuTu      INT NULL,
        CreatedAt  DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    /* Xoa lenh thi xoa luon dai cua no (ON DELETE CASCADE o tren) — dai khong co y nghia doc lap. */
    CREATE INDEX IX_DonHangDaiSize_DonHang ON DonHangDaiSize(DonHangID);
    /* Khong cho 2 dai trung ten trong cung mot lenh — nguoi nhap se khong phan biet duoc o o chon. */
    CREATE UNIQUE INDEX UX_DonHangDaiSize_Ten ON DonHangDaiSize(DonHangID, TenDai);
    PRINT N'Da tao bang DonHangDaiSize.';
END ELSE PRINT N'Bang DonHangDaiSize da ton tai, bo qua.';
GO

/* ---------- 2. Tien do theo mau: them chieu dai size ----------
   Ap cho MOI cong doan ghi theo mau (May, QC, Dong goi, Kho nhap). NULL = lenh khong tach,
   hoac dong ghi truoc ban nay. */
IF COL_LENGTH('TienDoChiTietMau', 'DaiSizeID') IS NULL
BEGIN
    ALTER TABLE TienDoChiTietMau ADD DaiSizeID INT NULL
        FOREIGN KEY REFERENCES DonHangDaiSize(ID);
    PRINT N'Da them cot TienDoChiTietMau.DaiSizeID.';
END ELSE PRINT N'Cot TienDoChiTietMau.DaiSizeID da ton tai, bo qua.';
GO

/* ---------- 3. Giao viec may cho cong nhan (Q5 = tach) ----------
   ⚠️ CHI la chieu THEO DOI. Cong thuc luong khoan may GIU NGUYEN (SoLuong x ThanhTien) vi don gia
   cong doan may tinh theo CONG DOAN (tra khoa, vat so...), KHONG doi theo size. Tach dai o day
   khong lam doi mot dong luong nao — neu sau nay don gia co khac theo dai thi phai them don gia
   theo dai, KHONG phai sua cot nay. */
IF COL_LENGTH('PhanCongMay', 'DaiSizeID') IS NULL
BEGIN
    ALTER TABLE PhanCongMay ADD DaiSizeID INT NULL
        FOREIGN KEY REFERENCES DonHangDaiSize(ID);
    PRINT N'Da them cot PhanCongMay.DaiSizeID.';
END ELSE PRINT N'Cot PhanCongMay.DaiSizeID da ton tai, bo qua.';
GO

/* ---------- 4. Giao / nhan nha gia cong (Q2 = tach) ----------
   ⚠️ Bang nay nuoi CA Bang luong gia cong LAN So cong no nha gia cong (dung chung
   backend/utils/luongGiaCongInThe.js, co y tu v7.53). Them cot nay chi lam NHIEU DONG HON;
   SUM(SoLuongNhan x don gia) KHONG doi -> tien khong nhay. Nhung SO CONG NO SE HIEN TACH DONG,
   nguoi doc so se thay khac truoc — da bao truoc trong PRD.
   Don gia van theo HANG MUC, KHONG theo dai. */
IF COL_LENGTH('DonHangChiTietNhaGiaCong', 'DaiSizeID') IS NULL
BEGIN
    ALTER TABLE DonHangChiTietNhaGiaCong ADD DaiSizeID INT NULL
        FOREIGN KEY REFERENCES DonHangDaiSize(ID);
    PRINT N'Da them cot DonHangChiTietNhaGiaCong.DaiSizeID.';
END ELSE PRINT N'Cot DonHangChiTietNhaGiaCong.DaiSizeID da ton tai, bo qua.';
GO

/* ---------- 5. Giao / nhan nha in theu (Q6 = tach) ---------- */
IF COL_LENGTH('DonHangNhaInTheu', 'DaiSizeID') IS NULL
BEGIN
    ALTER TABLE DonHangNhaInTheu ADD DaiSizeID INT NULL
        FOREIGN KEY REFERENCES DonHangDaiSize(ID);
    PRINT N'Da them cot DonHangNhaInTheu.DaiSizeID.';
END ELSE PRINT N'Cot DonHangNhaInTheu.DaiSizeID da ton tai, bo qua.';
GO

PRINT N'migration_v859.sql hoan tat. NHO: pm2 restart qlnoibo.';
GO

/* ================================================================================================
   KIEM TRA SAU KHI CHAY — chay 2 cau nay, ca hai phai ra ket qua nhu mo ta:

   -- (a) Phai ra 5 dong: 1 bang moi + 4 cot moi
   SELECT 'Bang DonHangDaiSize' AS Doi_tuong,
          CASE WHEN OBJECT_ID('DonHangDaiSize') IS NULL THEN N'THIEU' ELSE N'OK' END AS Trang_thai
   UNION ALL SELECT 'TienDoChiTietMau.DaiSizeID',
          CASE WHEN COL_LENGTH('TienDoChiTietMau','DaiSizeID') IS NULL THEN N'THIEU' ELSE N'OK' END
   UNION ALL SELECT 'PhanCongMay.DaiSizeID',
          CASE WHEN COL_LENGTH('PhanCongMay','DaiSizeID') IS NULL THEN N'THIEU' ELSE N'OK' END
   UNION ALL SELECT 'DonHangChiTietNhaGiaCong.DaiSizeID',
          CASE WHEN COL_LENGTH('DonHangChiTietNhaGiaCong','DaiSizeID') IS NULL THEN N'THIEU' ELSE N'OK' END
   UNION ALL SELECT 'DonHangNhaInTheu.DaiSizeID',
          CASE WHEN COL_LENGTH('DonHangNhaInTheu','DaiSizeID') IS NULL THEN N'THIEU' ELSE N'OK' END;

   -- (b) Phai ra 0 dong (chua ai tach dai -> chua co du lieu nao bi gan dai)
   SELECT COUNT(*) AS SoDongDaGanDai FROM TienDoChiTietMau WHERE DaiSizeID IS NOT NULL;
   ================================================================================================ */
