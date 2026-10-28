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
/* v9.03: tra ve { moi, anhDoi } — `anhDoi` = anh THAT SU duoc ghi moi (de dem cho dung, xem
   capNhatAnhDaiDien). Noi goi cu doc gia tri boolean van chay: xem ham boc `laDongMauMoi` ben duoi. */
async function damBaoDongMau(pool, tran, maHangId, mauSacId, linkAnh, ghiChu) {
  const rq = () => (tran ? new sql.Request(tran) : pool.request());
  const kq = await rq()
    .input('mh', sql.Int, maHangId)
    .input('ms', sql.Int, mauSacId)
    .input('anh', sql.NVarChar(500), linkAnh || null)
    .input('gc', sql.NVarChar, ghiChu || null)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM TheKhoChiTietMau WHERE MaHangID=@mh AND MauSacID=@ms)
      BEGIN
        INSERT INTO TheKhoChiTietMau (MaHangID, MauSacID, LinkAnh, SoCatCai, NhapCai, XuatCai, GhiChu)
        VALUES (@mh, @ms, @anh, 0, 0, 0, @gc);
        SELECT 1 AS Moi, CASE WHEN @anh IS NULL THEN 0 ELSE 1 END AS AnhDoi;
      END
      ELSE
      BEGIN
        DECLARE @doi INT = 0;
        /* Chi dem khi anh KHAC cai dang luu. ISNULL giu nguyen khi gui NULL (khong bao gio xoa anh). */
        IF @anh IS NOT NULL AND EXISTS (SELECT 1 FROM TheKhoChiTietMau
                                         WHERE MaHangID=@mh AND MauSacID=@ms AND ISNULL(LinkAnh, N'') <> @anh)
          SET @doi = 1;
        UPDATE TheKhoChiTietMau
           SET LinkAnh = ISNULL(@anh, LinkAnh), GhiChu = ISNULL(@gc, GhiChu)
         WHERE MaHangID=@mh AND MauSacID=@ms;
        SELECT 0 AS Moi, @doi AS AnhDoi;
      END`);
  const r = kq.recordset[0] || {};
  return { moi: !!r.Moi, anhDoi: !!r.AnhDoi };
}

/* Anh dai dien cua MA HANG. Chi ghi khi co anh moi — ISNULL de gui trong khong xoa mat anh cu
   (loi nay da tung xay ra o v5.11: edit-save NULL hoa TheKhoHangHoa.AnhDaiDien).
   ⚠️ v9.03: tra ve true KHI VA CHI KHI anh THAT SU DOI. Tu v9.03 form Sua phieu dien san anh dang
   luu roi gui lai nguyen xi, nen ban cu ("co gia tri = da ghi") se bao "da cap nhat anh cho N ma"
   moi lan bam Luu — cau thong bao duy nhat chung minh anh da vao duoc thi lai keu sai, nguoi dung
   quen luon khong doc. Loc ngay trong WHERE roi dem rowsAffected. */
async function capNhatAnhDaiDien(pool, tran, maHangId, anh) {
  if (!anh) return false;
  const rq = tran ? new sql.Request(tran) : pool.request();
  const kq = await rq.input('mh', sql.Int, maHangId).input('anh', sql.NVarChar(500), anh)
    .query(`UPDATE TheKhoHangHoa SET AnhDaiDien = @anh
             WHERE MaHangID = @mh AND ISNULL(AnhDaiDien, N'') <> @anh`);
  return !!kq.rowsAffected[0];
}

/* ================================================================================================
   v7.85 — CO AN MA HANG KHOI DANH SACH THE KHO (migration_v697).

   Bo tich "Tao the kho luon khi luu" tren phieu nhap kho = danh dau AN, KHONG xoa gi ca (Nguyen
   chot: "chi la khong hien o ben the kho", ma hang / ton kho giu nguyen). Tich lai = bo an.

   ⚠️ CHAN AN MA DA CO SO LIEU THE KHO THAT. Mot ma hang xuat hien tren NHIEU phieu nhap. Ma dung
   lau nay, the kho da khai day du, chi can mot lan lap phieu moi lo bo tich la ca ma bien mat khoi
   danh sach — nguoi dung khong hieu vi sao. Nen: dong mau nao co So cat / Nhap tay / Xuat khac 0
   thi ma do KHONG bi an, va bao lai ten ma de nguoi dung biet.
   ================================================================================================ */
let __coCotAn = null;
async function coCotAnTheKho(pool) {
  if (__coCotAn === null) {
    try {
      const r = (await pool.request().query(
        `SELECT COL_LENGTH('TheKhoHangHoa','AnTheKho') AS t`)).recordset[0] || {};
      __coCotAn = r.t != null;
    } catch (e) { __coCotAn = false; }
  }
  return __coCotAn;
}

/* Dat / bo co an cho mot danh sach MaHangID.
   Tra ve { daDoi: [MaHangID], boQua: [MaHangID] } — boQua = ma co so lieu the kho that (chi khi an).
   Chua chay migration -> tra ve rong, khong nem loi (phieu nhap kho van luu binh thuong). */
async function datAnTheKho(pool, tran, maHangIds, an) {
  const ds = [...new Set((maHangIds || []).map(Number).filter(x => x > 0))];
  if (!ds.length || !await coCotAnTheKho(pool)) return { daDoi: [], boQua: [] };
  const rq = () => (tran ? new sql.Request(tran) : pool.request());
  const danhSach = ds.join(',');

  let boQua = [];
  if (an) {
    /* ⚠️ Doc TheKhoChiTietMau (so lieu KHAI TAY tren the kho), KHONG doc vw_TonTheoMau: view do gom
       ca so luong tu PHIEU NHAP, ma phieu nhap thi ma nao cung co => khong ma nao an duoc ca. */
    boQua = (await rq().query(`
      SELECT DISTINCT MaHangID FROM TheKhoChiTietMau
      WHERE MaHangID IN (${danhSach})
        AND (ISNULL(SoCatCai,0) <> 0 OR ISNULL(NhapCai,0) <> 0 OR ISNULL(XuatCai,0) <> 0)`))
      .recordset.map(r => r.MaHangID);
  }
  const daDoi = ds.filter(id => !boQua.includes(id));
  if (daDoi.length) {
    await rq().input('an', sql.Bit, an ? 1 : 0)
      .query(`UPDATE TheKhoHangHoa SET AnTheKho = @an WHERE MaHangID IN (${daDoi.join(',')})`);
  }
  return { daDoi, boQua };
}

module.exports = { damBaoDongMau, capNhatAnhDaiDien, coCotAnTheKho, datAnTheKho };
