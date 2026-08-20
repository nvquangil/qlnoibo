/* ================================================================================================
   TAO / CAP NHAT DONG MAU CUA THE KHO HANG HOA  (v6.96)

   Dung chung boi:
     - routes/nhapkho.js  : luu phieu nhap kho co tich "Tao the kho" -> tu tao dong mau + anh
     - routes/khohang.js  : form The kho hang hoa (POST /items khi ma da co)
   MOT ban duy nhat — hai ban sao la som muon lech nhau (repo nay da bi dung loi do voi ghiXuatKho).

   ⚠️ NhapCai LUON = 0 khi TAO dong moi, va TUYET DOI khong sua NhapCai khi dong da co.
   So luong ton den tu PHIEU NHAP KHO (nguon chung tu, xem migration_v682 + vw_TonTheoMau). Ghi so vao
   NhapCai o day la tao nguon ton THU HAI cho cung lo hang => ton dem hai lan, va sai am tham.
   ================================================================================================ */
const { sql } = require('../db');

/* Bao dam co dong (MaHangID, MauSacID) trong TheKhoChiTietMau.
   - Chua co -> INSERT voi NhapCai = 0.
   - Da co   -> chi cap nhat LinkAnh / GhiChu, va CHI KHI co gia tri gui len (ISNULL giu cai cu).
   Tra ve true neu vua TAO MOI dong. */
async function damBaoDongMau(pool, tran, maHangId, mauSacId, linkAnh, ghiChu) {
  const rq = () => (tran ? new sql.Request(tran) : pool.request());
  const kq = await rq()
    .input('mh', sql.Int, maHangId)
    .input('ms', sql.Int, mauSacId)
    .input('anh', sql.NVarChar, linkAnh || null)
    .input('gc', sql.NVarChar, ghiChu || null)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM TheKhoChiTietMau WHERE MaHangID=@mh AND MauSacID=@ms)
      BEGIN
        INSERT INTO TheKhoChiTietMau (MaHangID, MauSacID, LinkAnh, SoCatCai, NhapCai, XuatCai, GhiChu)
        VALUES (@mh, @ms, @anh, 0, 0, 0, @gc);
        SELECT 1 AS Moi;
      END
      ELSE
      BEGIN
        UPDATE TheKhoChiTietMau
           SET LinkAnh = ISNULL(@anh, LinkAnh), GhiChu = ISNULL(@gc, GhiChu)
         WHERE MaHangID=@mh AND MauSacID=@ms;
        SELECT 0 AS Moi;
      END`);
  return !!(kq.recordset[0] && kq.recordset[0].Moi);
}

/* Anh dai dien cua MA HANG. Chi ghi khi co anh moi — ISNULL de gui trong khong xoa mat anh cu
   (loi nay da tung xay ra o v5.11: edit-save NULL hoa TheKhoHangHoa.AnhDaiDien). */
async function capNhatAnhDaiDien(pool, tran, maHangId, anh) {
  if (!anh) return false;
  const rq = tran ? new sql.Request(tran) : pool.request();
  await rq.input('mh', sql.Int, maHangId).input('anh', sql.NVarChar, anh)
    .query('UPDATE TheKhoHangHoa SET AnhDaiDien = ISNULL(@anh, AnhDaiDien) WHERE MaHangID = @mh');
  return true;
}

module.exports = { damBaoDongMau, capNhatAnhDaiDien };
