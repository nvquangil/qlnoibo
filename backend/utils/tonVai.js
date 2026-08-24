/* ================================================================================================
   "CON HANG" CUA MOT CAY VAI — MOT DINH NGHIA DUY NHAT                                    v7.36
   ------------------------------------------------------------------------------------------------
   VI SAO CO FILE NAY: truoc day 8 cho trong he thong tu viet dieu kien "con ton" bang `KGCon > 0`:
       backend/routes/khovai.js  141 (GET /rolls), 177 (cay theo phieu nhap), 339 (/vaichophep)
       backend/routes/qlsx.js    2358 (/vaicay-kho), 2375 (/vaicay-kho-loc)
       frontend/js/module.khovai.js 187, 209, 251 (tab Ton theo cay)
   Nhung `KGCon = KGNhap - KG da xuat`, va form nhap kho CHO PHEP KG = 0 khi vai quan theo MET/CAY
   (khovai.js: `const kg = Number(roll.kgNhap) || 0`). Cay nhu vay co KGCon = 0 NGAY TU LUC NHAP, du
   con nguyen met => bi coi la "het" o MOI man xuat kho => vai co that trong kho ma khong ai xuat duoc.

   DINH NGHIA DUNG: cay con hang khi CON KG *HOAC* CON MET.

   Gom vao mot cho de sau nay khong con canh 8 ban dieu kien troi khoi nhau. Sua o day la sua het.
   ================================================================================================ */

/* Dieu kien SQL. `a` la alias cua vw_TonCayVai trong cau truy van (vd 't', 'vc').
   Dung: `WHERE ${conHangSQL('t')}` */
function conHangSQL(a) {
  return `(${a}.KGCon > 0 OR ${a}.MetCon > 0)`;
}

/* Kiem tren MOT DONG da doc ve (dung cho cac cho loc bang JS sau khi SELECT *). */
function conHang(r) {
  if (!r) return false;
  return (Number(r.KGCon) || 0) > 0 || (Number(r.MetCon) || 0) > 0;
}

/* Cay "vo hinh": chua bao gio co KG (nhap theo met/cay) nhung van con met. Dung de canh bao / soi. */
function chiConMet(r) {
  return conHang(r) && (Number(r.KGCon) || 0) <= 0;
}

/* ================================================================================================
   TINH LAI TrangThai CUA MOT CAY VAI (Nguyên cây / Cây lẻ / Hết)
   ------------------------------------------------------------------------------------------------
   `VaiCay.TrangThai` la cot LUU SAN chu khong tinh tu view, nen moi cho lam doi KGNhap / SoMet hoac
   so da xuat deu phai goi ham nay.

   v6.58 da gom cong thuc nay vao khovai.js (`capNhatTrangThaiCay`) nhung BA cho khac VAN COPY cong
   thuc: PUT /xuat/:id, DELETE /xuat/:id va utils/vaiXuatService.js. v7.36 dua han sang day de ca
   bon cho goi CUNG MOT BAN — sua cong thuc chi phai sua mot lan.

   v7.36 sua cong thuc: xet CA MET. Truoc day chi xet KG nen cay quan theo MET/CAY (KGNhap = 0)
   bi danh 'Hết' ngay lan xuat dau tien du con nguyen met.
   ================================================================================================ */
async function capNhatTrangThaiCay(pool, sql, cayId) {
  const cay = await pool.request().input('id', sql.Int, cayId)
    .query('SELECT KGNhap, SoMet FROM VaiCay WHERE CayID=@id');
  if (!cay.recordset.length) return null;
  const kgNhap = Number(cay.recordset[0].KGNhap) || 0;
  const metNhap = Number(cay.recordset[0].SoMet) || 0;
  const sum = await pool.request().input('id', sql.Int, cayId).query(
    `SELECT ISNULL(SUM(KGXuat),0) AS Tong, ISNULL(SUM(SoMet),0) AS TongMet
     FROM PhieuXuatVaiChiTiet WHERE CayID=@id`);
  const daXuatKG = Number(sum.recordset[0].Tong) || 0;
  const daXuatMet = Number(sum.recordset[0].TongMet) || 0;
  const kgCon = Math.round((kgNhap - daXuatKG) * 100) / 100;
  const metCon = Math.round((metNhap - daXuatMet) * 100) / 100;
  const chuaXuatGi = daXuatKG <= 0 && daXuatMet <= 0;
  const conHangCay = kgCon > 0.05 || metCon > 0.05;
  const trangThai = chuaXuatGi ? 'Nguyên cây' : (conHangCay ? 'Cây lẻ' : 'Hết');
  await pool.request().input('id', sql.Int, cayId).input('TrangThai', sql.NVarChar, trangThai)
    .query('UPDATE VaiCay SET TrangThai=@TrangThai WHERE CayID=@id');
  return { trangThai, kgCon, metCon };
}

module.exports = { conHangSQL, conHang, chiConMet, capNhatTrangThaiCay };
