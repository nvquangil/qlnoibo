/* ================================================================================================
   CHAN DOAN - LENH DH2608064 "SL theo mau bi NHAN DOI o cong doan QC"
   ⚠️ FILE NAY CHI DOC. Khong UPDATE, khong DELETE, khong INSERT. Chay bao nhieu lan cung duoc.

   Ten file co Y dat KHONG theo `migration_v*` vi `tao_file_cai_dat.js` quet `migration_v*.sql`
   va se nuot file chan doan vao ban cai dat.

   ------------------------------------------------------------------------------------------------
   CAU HOI PHAI TRA LOI: so 600 bi nhan doi o TANG NAO?
     TANG 1 - Du lieu GHI SAI: mot lan ghi Cat co HAI dong TienDoChiTietMau cho CUNG mot mau
              (vi du 1 dong DaiSizeID NULL cu + 1 dong co DaiSizeID sau khi tach dai size v8.59).
     TANG 2 - Co HAI ban ghi TienDoSanXuat cua cong doan Cat cung duoc tinh:
              `effectiveTienDoIds` giu MOI ban ghi co SoDoID IS NULL, va chi loc MAX theo tung
              SoDoID. Ghi Cat hai lan ma CA HAI deu khong gan so do => cong ca hai = nhan doi.
     TANG 3 - Mau PHOI khong bi loc: bo loc dua vao DonHangChiTietVai.Kieu = N'Phối'. Neu cay phoi
              KHONG duoc khai Kieu='Phối' thi mau phoi duoc cong vao nhu mau chinh.
     TANG 4 - Hien thi: du lieu dung nhung man QC cong nham.

   CACH DUNG: chay tuan tu, doc ket luan ghi trong tung muc.
   ================================================================================================ */

DECLARE @MaDH NVARCHAR(50) = N'DH2608064';
DECLARE @DonHangID INT = (SELECT TOP 1 DonHangID FROM DonHangSanXuat WHERE MaDH = @MaDH);

IF @DonHangID IS NULL
BEGIN
    PRINT 'KHONG TIM THAY lenh ' + @MaDH + ' - kiem lai ma.';
    RETURN;
END

PRINT '=== Lenh ' + @MaDH + ' -> DonHangID = ' + CAST(@DonHangID AS VARCHAR(20)) + ' ===';

/* ---------- 0. Thong tin lenh ---------- */
SELECT DonHangID, MaDH, HeSoQuyDoi, TrangThai
FROM DonHangSanXuat WHERE DonHangID = @DonHangID;

/* ================================================================================================
   TANG 2 - CAC BAN GHI TIEN DO CUA CONG DOAN CAT
   Doc cot `SoDoID`:
     - Neu co >= 2 dong ma SoDoID deu NULL  => DUNG LA TANG 2. Ca hai deu duoc cong.
     - Neu moi SoDoID xuat hien 1 lan        => tang 2 KHONG phai nguyen nhan, di tiep tang 1.
   Cot `TinhVaoTong` noi ro dong do co duoc `effectiveTienDoIds` giu lai hay khong.
   ================================================================================================ */
SELECT td.TienDoID, td.NgayGhiNhan, td.SoDoID, td.SttSoCat, td.NhomTienDoID,
       u.HoTen AS NguoiGhi,
       (SELECT SUM(x.SoLuongLuyKe) FROM TienDoChiTietMau x WHERE x.TienDoID = td.TienDoID) AS TongCaiCuaBanGhi,
       CASE WHEN td.SoDoID IS NULL THEN 'CO (vi SoDoID NULL -> giu tat ca)'
            WHEN td.TienDoID = (SELECT MAX(t2.TienDoID) FROM TienDoSanXuat t2
                                WHERE t2.DonHangID = td.DonHangID AND t2.StageID = td.StageID
                                  AND t2.SoDoID = td.SoDoID)
            THEN 'CO (ban ghi moi nhat cua so do nay)'
            ELSE 'KHONG (da bi ban ghi moi hon thay the)' END AS TinhVaoTong
FROM TienDoSanXuat td
JOIN CongDoanSanXuat cc ON cc.StageID = td.StageID
LEFT JOIN Users u ON u.UserID = td.NguoiCapNhatID
WHERE td.DonHangID = @DonHangID AND cc.MaCongDoan = 'CAT'
ORDER BY td.TienDoID;

/* ================================================================================================
   TANG 1 - CHI TIET MAU CUA TUNG BAN GHI CAT
   Doc cot `DaiSizeID`: cung mot TienDoID + cung MauSacID ma ra HAI dong (mot NULL, mot co so)
   => dung la tang 1, do v8.59 tach dai size tao dong moi thay vi cap nhat dong cu.
   ================================================================================================ */
SELECT td.TienDoID, td.SoDoID, ms.TenMau, tc.MauSacID, tc.DaiSizeID,
       tc.SoLuongLuyKe, tc.DonViDaChon
FROM TienDoChiTietMau tc
JOIN TienDoSanXuat td ON td.TienDoID = tc.TienDoID
JOIN CongDoanSanXuat cc ON cc.StageID = td.StageID
LEFT JOIN MauSac ms ON ms.MauSacID = tc.MauSacID
WHERE td.DonHangID = @DonHangID AND cc.MaCongDoan = 'CAT'
ORDER BY td.TienDoID, tc.MauSacID, tc.DaiSizeID;

/* Tom tat tang 1: mau nao co NHIEU HON MOT dong trong CUNG mot ban ghi Cat */
SELECT td.TienDoID, ms.TenMau, COUNT(*) AS SoDong, SUM(tc.SoLuongLuyKe) AS CongLai
FROM TienDoChiTietMau tc
JOIN TienDoSanXuat td ON td.TienDoID = tc.TienDoID
JOIN CongDoanSanXuat cc ON cc.StageID = td.StageID
LEFT JOIN MauSac ms ON ms.MauSacID = tc.MauSacID
WHERE td.DonHangID = @DonHangID AND cc.MaCongDoan = 'CAT'
GROUP BY td.TienDoID, ms.TenMau
HAVING COUNT(*) > 1;

/* ================================================================================================
   TANG 3 - BO LOC MAU PHOI
   `getStageActualQtyByColor` loai mau nao co dong DonHangChiTietVai voi Kieu = N'Phối'.
   Neu bang duoi KHONG co dong Kieu='Phối' nao trong khi lenh thuc te CO vai phoi => mau phoi dang
   duoc cong vao nhu mau chinh.
   ⚠️ `Kieu` la DU LIEU go tay - sai chinh ta ('Phoi' khong dau, 'phối' thuong) la bo loc truot het.
   ================================================================================================ */
/* ⚠️ SUA 2026-10-07: cot BoLoc truoc day CHI kiem `Kieu = N'Phối'` nen bao "KHOP bo loc" cho ca
   nhung dong co MauSacID = NULL - SAI SU THAT va suyt lam doc nham ket qua. Bo loc THAT trong
   getStageActualQtyByColor la:
       MauSacID NOT IN (SELECT MauSacID FROM DonHangChiTietVai
                        WHERE DonHangID=@id AND Kieu = N'Phối' AND MauSacID IS NOT NULL)
   tuc dong Phoi co MauSacID NULL thi KHONG loai duoc gi ca. */
SELECT v.ID, v.Kieu, v.MauSacID, ms.TenMau,
       CASE WHEN v.Kieu = N'Phối' AND v.MauSacID IS NOT NULL
                 THEN 'Loai duoc mau nay khoi tong'
            WHEN v.Kieu = N'Phối'
                 THEN '*** MauSacID NULL -> BO LOC VO HIEU, mau phoi VAN BI CONG ***'
            ELSE 'Mau CHINH' END AS BoLoc
FROM DonHangChiTietVai v
LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID
WHERE v.DonHangID = @DonHangID
ORDER BY v.Kieu, v.ID;

/* ================================================================================================
   KET QUA CUOI - CON SO MA HE THONG DANG TINH LA "SL TU CAT THEO MAU"
   Day la ban sao Y HET cau SQL trong getStageActualQtyByColor(). So nao hien o man QC phai bang
   so o day. Neu so o day = 600 ma man QC hien 1200 => loi nam o TANG 4 (hien thi), khong phai
   du lieu; bao lai de sua frontend.
   ================================================================================================ */
SELECT ms.TenMau, tc.MauSacID, SUM(tc.SoLuongLuyKe) AS SL_TU_CAT
FROM TienDoChiTietMau tc
LEFT JOIN MauSac ms ON ms.MauSacID = tc.MauSacID
WHERE tc.TienDoID IN (
        SELECT t.TienDoID FROM TienDoSanXuat t
        JOIN CongDoanSanXuat c2 ON c2.StageID = t.StageID
        WHERE t.DonHangID = @DonHangID AND c2.MaCongDoan = 'CAT'
          AND (t.SoDoID IS NULL
               OR t.TienDoID = (SELECT MAX(t2.TienDoID) FROM TienDoSanXuat t2
                                WHERE t2.DonHangID = t.DonHangID AND t2.StageID = t.StageID
                                  AND t2.SoDoID = t.SoDoID)))
  AND tc.MauSacID NOT IN (SELECT MauSacID FROM DonHangChiTietVai
                          WHERE DonHangID = @DonHangID AND Kieu = N'Phối' AND MauSacID IS NOT NULL)
GROUP BY ms.TenMau, tc.MauSacID
ORDER BY ms.TenMau;

/* Tong cong - so nay phai la 600 */
SELECT SUM(tc.SoLuongLuyKe) AS TONG_SL_TU_CAT
FROM TienDoChiTietMau tc
WHERE tc.TienDoID IN (
        SELECT t.TienDoID FROM TienDoSanXuat t
        JOIN CongDoanSanXuat c2 ON c2.StageID = t.StageID
        WHERE t.DonHangID = @DonHangID AND c2.MaCongDoan = 'CAT'
          AND (t.SoDoID IS NULL
               OR t.TienDoID = (SELECT MAX(t2.TienDoID) FROM TienDoSanXuat t2
                                WHERE t2.DonHangID = t.DonHangID AND t2.StageID = t.StageID
                                  AND t2.SoDoID = t.SoDoID)))
  AND tc.MauSacID NOT IN (SELECT MauSacID FROM DonHangChiTietVai
                          WHERE DonHangID = @DonHangID AND Kieu = N'Phối' AND MauSacID IS NOT NULL);

/* ================================================================================================
   *** TRUY VAN QUYET DINH *** - TUNG CAY VAI TRONG SO CAT, KEM KieuVai (Chinh / Phoi)

   Day la cho phai nhin. `TienDoChiTietMau` duoc ghi bang cach CONG MOI CAY trong ban cat vao theo
   MauSacID cua cay (xem qlsx.js, vong `for (const c of grp.chiTietCay)`: mauTongHop[mauSacId] +=
   soLuongLop * heSo). Vong do KHONG phan biet cay CHINH hay cay PHOI.

   => Neu cay vai PHOI co CUNG MauSacID voi cay vai CHINH (rat hay gap: than ao xanh, bo co cung
      xanh) thi hai cay cong vao CUNG MOT O => mau do bi NHAN DOI. Bo loc mau Phoi o tang doc
      (getStageActualQtyByColor) khong cuu duoc, vi no loai theo MAU - ma mau do dung la mau chinh,
      loai di thi mat sach.

   CACH DOC:
     - Cot `KieuVai` co ca 'Chính' lan 'Phối', va cot `MauSacID` cua hai dong do GIONG NHAU
       => DA XAC DINH NGUYEN NHAN. Loi nam o TANG GHI, khong phai tang doc.
     - Cot `KieuVai` toan NULL => cay khong di qua Phieu xuat kho vai, he thong khong co cach nao
       biet cay nao la phoi. Phai khai KieuVai tren phieu xuat vai.
     - Chi co 'Chính' => cay phoi khong nam trong so cat, nguyen nhan o cho khac (xem lai tang 1/2).
   ================================================================================================ */
SELECT td.TienDoID, td.SoDoID, tcc.CayID, tcc.SttCay,
       tcc.SoLuongLop, tcc.HeSoQuyDoi,
       tcc.SoLuongLop * tcc.HeSoQuyDoi AS SoCaiCongVao,
       dv.MauSacID, ms.TenMau, dv.MaVai,
       (SELECT TOP 1 px.KieuVai
          FROM PhieuXuatVaiChiTiet px
          JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
         WHERE px.CayID = tcc.CayID AND p.DonHangID = @DonHangID
         ORDER BY px.ID DESC) AS KieuVai
FROM TienDoCatChiTietCay tcc
JOIN TienDoSanXuat td ON td.TienDoID = tcc.TienDoID
JOIN CongDoanSanXuat cc ON cc.StageID = td.StageID
LEFT JOIN VaiCay vc ON vc.CayID = tcc.CayID
LEFT JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
WHERE td.DonHangID = @DonHangID AND cc.MaCongDoan = 'CAT'
ORDER BY ms.TenMau, KieuVai, tcc.CayID;

/* Tom tat: moi mau, bao nhieu cai den tu cay CHINH, bao nhieu tu cay PHOI.
   Cot `Tu_Phoi` > 0 => dung la dang cong nham vai phoi vao san luong. */
SELECT ms.TenMau, dv.MauSacID,
       SUM(CASE WHEN kv.KieuVai = N'Phối' THEN tcc.SoLuongLop * tcc.HeSoQuyDoi ELSE 0 END) AS Tu_Phoi,
       SUM(CASE WHEN kv.KieuVai = N'Chính' THEN tcc.SoLuongLop * tcc.HeSoQuyDoi ELSE 0 END) AS Tu_Chinh,
       SUM(CASE WHEN kv.KieuVai IS NULL THEN tcc.SoLuongLop * tcc.HeSoQuyDoi ELSE 0 END) AS Khong_Ro,
       SUM(tcc.SoLuongLop * tcc.HeSoQuyDoi) AS Tong_He_Thong_Dang_Tinh
FROM TienDoCatChiTietCay tcc
JOIN TienDoSanXuat td ON td.TienDoID = tcc.TienDoID
JOIN CongDoanSanXuat cc ON cc.StageID = td.StageID
LEFT JOIN VaiCay vc ON vc.CayID = tcc.CayID
LEFT JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
OUTER APPLY (SELECT TOP 1 px.KieuVai
               FROM PhieuXuatVaiChiTiet px
               JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
              WHERE px.CayID = tcc.CayID AND p.DonHangID = @DonHangID
              ORDER BY px.ID DESC) kv
WHERE td.DonHangID = @DonHangID AND cc.MaCongDoan = 'CAT'
GROUP BY ms.TenMau, dv.MauSacID
ORDER BY ms.TenMau;

/* ================================================================================================
   PHU - SO CAT THAT (cay vai da dung), de doi chieu voi con so 600 Nguyen noi.
   ================================================================================================ */
SELECT td.TienDoID, td.SoDoID, tcc.CayID, tcc.SttCay, tcc.SoLuongLop, tcc.HeSoQuyDoi,
       tcc.SoLuongLop * tcc.HeSoQuyDoi AS SoCaiTinhRa,
       dv.MauSacID, ms.TenMau
FROM TienDoCatChiTietCay tcc
JOIN TienDoSanXuat td ON td.TienDoID = tcc.TienDoID
JOIN CongDoanSanXuat cc ON cc.StageID = td.StageID
LEFT JOIN VaiCay vc ON vc.CayID = tcc.CayID
LEFT JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
WHERE td.DonHangID = @DonHangID AND cc.MaCongDoan = 'CAT'
ORDER BY td.TienDoID, tcc.CayID;
