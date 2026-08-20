/* ================================================================================================
   MA HANG DANG DUOC DUNG O DAU?  (v6.94)

   Dung chung cho: xoa phieu nhap kho (routes/nhapkho.js) va xoa ma hang o Danh muc hang hoa
   (routes/danhmuc.js). MOT ban duy nhat — hai ban sao la som muon lech nhau (repo nay da bi dung
   loi do voi ghiXuatKho / cong no).

   DO KHOA NGOAI LUC CHAY qua sys.foreign_keys thay vi liet ke ten bang bang tay: hien co ~8 bang tro
   vao TheKhoHangHoa va moi migration lai co the them bang moi. Liet ke tay la chac chan co ngay bo
   sot, va bo sot khong phai "xoa duoc nhieu hon" ma la loi 547 hoac xoa mat du lieu nguoi dung.

   BO QUA cac FK co ON DELETE CASCADE (delete_referential_action <> 0): chung tu bien mat theo ma hang
   nen khong phai ly do giu ma hang lai. Vd TheKhoChiTietMau, GiaVonHangHoa.
   ================================================================================================ */
const { sql } = require('../db');

let __fk = null;

/* Danh sach {bang, cot} cua moi FK NO ACTION tro vao TheKhoHangHoa(MaHangID). Cache trong tien trinh;
   chay migration them bang moi thi pm2 restart la co (deploy nao cung restart). */
async function dsBangThamChieuMaHang(pool) {
  if (__fk) return __fk;
  __fk = (await pool.request().query(`
    SELECT OBJECT_SCHEMA_NAME(fk.parent_object_id) AS Luoc,
           OBJECT_NAME(fk.parent_object_id)        AS Bang,
           COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS Cot
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    WHERE fk.referenced_object_id = OBJECT_ID('TheKhoHangHoa')
      AND COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) = 'MaHangID'
      AND fk.delete_referential_action = 0
  `)).recordset.map(r => ({ bang: r.Luoc + '.' + r.Bang, cot: r.Cot }));
  return __fk;
}

/* Ten hien thi cho nguoi dung — cau bao loi phai doc duoc, khong phai ten bang ky thuat. */
const TEN_BANG_VN = {
  PhieuBanHangChiTiet: 'phiếu bán hàng',
  DonKhachDatHang: 'đơn khách đặt hàng',
  PhieuNhapLaiChiTiet: 'phiếu nhập lại (khách trả)',
  PhieuNhapKhoHangChiTiet: 'phiếu nhập kho',
  BaoGiaAlohaChiTiet: 'báo giá Aloha',
  BaoGiaChiTiet: 'báo giá'
};
function tenBangVN(bangDayDu) {
  const t = String(bangDayDu).split('.').pop();
  return TEN_BANG_VN[t] || t;
}

/* Tra ve danh sach TEN VIET (da bo trung) cac cho dang tham chieu ma hang nay. Rong = xoa duoc.
   `rq` cho phep truyen sql.Request cua transaction dang mo; bo trong thi dung pool. */
async function noiDangDungMaHang(pool, maHangId, tran) {
  const fks = await dsBangThamChieuMaHang(pool);
  const vuong = [];
  for (const f of fks) {
    const rq = tran ? new sql.Request(tran) : pool.request();
    // Ten bang lay tu sys.foreign_keys (khong phai dau vao nguoi dung) nen noi chuoi o day an toan.
    const co = (await rq.input('mh', sql.Int, maHangId)
      .query(`SELECT TOP 1 1 AS x FROM ${f.bang} WHERE ${f.cot} = @mh`)).recordset.length;
    if (co) vuong.push(tenBangVN(f.bang));
  }
  return [...new Set(vuong)];
}

module.exports = { dsBangThamChieuMaHang, noiDangDungMaHang, tenBangVN };
