/* ================================================================================================
   migration_v698.sql   (v7.95)
   CHUYEN QUY NOI BO  ->  PhieuThu.LaChuyenQuy / PhieuChi.LaChuyenQuy

   Nguyen: "rut tien tu TK ngan hang ve tien mat thi sao. CK tu TKNH nay sang TKNH khac".

   BOI CANH. He thong KHONG co nghiep vu nay. Rut tien / CK giua 2 TKNH dang phai go HAI PHIEU ROI
   TAY khong biet gi ve nhau, hau qua:
     - muc A (Quy) thoi phong ca cot Thu va cot Chi bang tien chi doi cho trong noi bo;
     - muc C (Dong tien theo loai) roi vao "(chua phan loai)" vi khong co loai tai khoan nao dung;
     - `chiNgoai` cua bao cao lai/lo bi thoi -> nhin nhu co tien dang nam ngoai bao cao;
     - XOA NHAM MOT VE la lech quy VINH VIEN, khong con duong nao truy ra.

   ⚠️ VI SAO PHAI LA COT CO RIENG, KHONG DUNG `HinhThuc` LAM DAU NHAN BIET.
   Chuyen thang (v6.54) nhan biet bang HinhThuc = N'Chuyển thẳng' duoc, vi tien do KHONG qua quy nao
   ca -> khong can dinh tuyen. Chuyen quy thi NGUOC LAI: tien co that trong quy, chi la doi cho.
       ve CHI phai giu HinhThuc = N'Chuyển khoản' + TaiKhoanNHID  -> tru dung tai khoan ngan hang
       ve THU phai giu HinhThuc = N'Tiền mặt'                     -> cong dung ket tien mat
   Doi HinhThuc thanh N'Chuyển quỹ' la muc A mat duong dinh tuyen ve dung quy (xem `laTM` +
   `themQuy` trong routes/baocao.js): ca hai ve roi ra ngoai moi quy, so du hai quy deu sai.
   Nen dau nhan biet BAT BUOC la mot cot rieng.

   CACH GHEP CAP: dung LAI dung co che chuyen thang v6.54 — PhieuThu.PhieuChiKemID <->
   PhieuChi.PhieuThuKemID (migration_v675). Nho vay:
     - DELETE /phieuthu/:id  da xoa ca cap san (phieuChiKem() doc theo COT LIEN KET, khong theo
       HinhThuc) -> khong phai viet lai gi;
     - DELETE + PUT /phieuchi/:id da bi chan san (chanPhieuChiKem()) -> khong xoa/sua le mot ve duoc;
     - PUT /phieuthu/:id da bi chan san -> muon sua thi xoa ca cap roi lap lai.
   Chi con phan BAO CAO va FORM la moi.

   NULL/0 = phieu binh thuong -> du lieu dang co KHONG doi hanh vi.
   Idempotent — chay lai nhieu lan khong loi.
   ================================================================================================ */
IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('PhieuThu', 'LaChuyenQuy') IS NULL
BEGIN
  ALTER TABLE PhieuThu ADD LaChuyenQuy BIT NULL;
  PRINT '  + PhieuThu.LaChuyenQuy (1 = ve THU cua mot lan chuyen quy noi bo)';
END
ELSE PRINT '  = PhieuThu.LaChuyenQuy da co';
GO

IF COL_LENGTH('PhieuChi', 'LaChuyenQuy') IS NULL
BEGIN
  ALTER TABLE PhieuChi ADD LaChuyenQuy BIT NULL;
  PRINT '  + PhieuChi.LaChuyenQuy (1 = ve CHI cua mot lan chuyen quy noi bo)';
END
ELSE PRINT '  = PhieuChi.LaChuyenQuy da co';
GO

/* Ca hai ve deu duoc danh dau, khong chi mot ve. Ly do: bao cao quet RIENG tung bang
   (routes/baocao.js muc A doc PhieuThu va PhieuChi bang hai cau khac nhau, muc C bang hai nhanh
   UNION khac nhau). Neu chi danh dau mot ve thi ben kia phai JOIN nguoc qua cot lien ket moi biet,
   ma cau muc A dang GROUP BY nen khong co cho JOIN — se lai bo sot dung mot ve. */

PRINT '';
PRINT '=== migration_v698 XONG ===';
PRINT 'Cach dung: Cong no -> Phieu thu -> nut "Chuyen quy noi bo": chon quy NGUON -> quy DICH -> so tien.';
PRINT 'He thong sinh 1 phieu chi (tru quy nguon) + 1 phieu thu (cong quy dich) buoc vao nhau.';
PRINT 'Sua: khong sua truc tiep — XOA phieu thu (phieu chi di kem tu mat) roi lap lai.';
PRINT 'Bao cao tai chinh: so du tung quy DOI THAT, nhung dong TONG ghi ro phan chuyen noi bo;';
PRINT '  muc C co dong rieng "Chuyen quy noi bo"; lai/lo khong tinh khoan nay vao chi ngoai bao cao.';
PRINT 'PHAI pm2 restart qlnoibo (sua routes/congno.js + routes/baocao.js) + Ctrl+F5.';
PRINT '';
