/* ================================================================================================
   LENH SX (DonHangSanXuat) DANG DUOC DUNG O DAU?  (v7.11)

   VAN DE THUC TE: xoa lenh SX truoc day chi lam `DELETE FROM DonHangSanXuat` roi bat exception va
   tra ve MOT cau bao loi chung chung ("lenh da co The kho hang hoa, xuat vai hoac du lieu lien ket
   khac"). Hau qua: lenh VUA RA XONG, CHUA BAT DAU lam gi cung khong xoa duoc, vi chi can co
      - 1 dong `ChiDinhVaiSX`  (Chi dinh vai SX khai NGAY luc ra lenh), hoac
      - 1 dong `ThongBao`      (thong bao "co lenh SX moi" tu sinh)
   la khoa ngoai NO ACTION da chan lai — ma nguoi dung khong he biet vuong o dau de go.

   CACH LAM: dò khoa ngoai LUC CHAY (sys.foreign_keys) roi CHIA HAI NHOM:

     1. XOA KEM  — du lieu THUOC VE chinh lenh SX, khong co y nghia gi khi lenh mat:
        chi dinh vai SX, thong bao ve lenh, cac bang DonHang.. / TaiLieu.. / TienDo.. (phan lon da
        ON DELETE CASCADE nen khong hien o day, nhung cu de rule cho bang moi sau nay).
     2. CHAN     — NGHIEP VU KHAC da phat sinh, xoa lenh la mat dau vet: phieu xuat vai, phieu xuat
        vat tu, phieu phu kien, phieu nhap kho hang, the kho hang hoa. Bao RO ten + so dong de nguoi
        dung biet phai huy/go gan cai gi truoc.

   Nguyen tac: liet ke ten bang bang tay la chac chan co ngay bo sot (repo nay da bi dung loi do o
   maHangThamChieu.js), nen ten bang lay tu sys.foreign_keys; chi PHAN LOAI la co danh sach tay.
   ================================================================================================ */
const { sql } = require('../db');

let __fk = null;

/* Moi FK NO ACTION tro vao DonHangSanXuat(DonHangID). Cache trong tien trinh (deploy nao cung
   pm2 restart nen chay migration them bang moi la co ngay). */
async function dsBangThamChieuDonHang(pool) {
  if (__fk) return __fk;
  __fk = (await pool.request().query(`
    SELECT OBJECT_SCHEMA_NAME(fk.parent_object_id) AS Luoc,
           OBJECT_NAME(fk.parent_object_id)        AS Bang,
           COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS Cot
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    WHERE fk.referenced_object_id = OBJECT_ID('DonHangSanXuat')
      AND COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) = 'DonHangID'
      AND fk.delete_referential_action = 0
  `)).recordset.map(r => ({ bang: r.Luoc + '.' + r.Bang, ten: r.Bang, cot: r.Cot }));
  return __fk;
}

/* Bang THUOC VE lenh SX -> xoa kem, khong chan. */
const XOA_KEM = ['ChiDinhVaiSX', 'ThongBao'];
function laXoaKem(ten) {
  return XOA_KEM.indexOf(ten) !== -1
    || /^(DonHang|TaiLieu|TienDo|BangKe|GiaoVai|ChiPhiChung|ChiDinh)/.test(ten);
}

/* Ten hien thi cho nguoi dung — cau bao loi phai doc duoc, khong phai ten bang ky thuat. */
const TEN_BANG_VN = {
  PhieuXuatVai: 'phiếu xuất vải',
  PhieuXuatVatTu: 'phiếu xuất vật tư / NPL',
  PhieuXuatVatTuPhuKien: 'phiếu xuất phụ kiện',
  PhieuPhuKien: 'phiếu phụ kiện',
  PhieuNhapKhoHang: 'phiếu nhập kho hàng hóa',
  TheKhoHangHoa: 'mã hàng ở Thẻ kho hàng hóa',
  PhieuNhapVai: 'phiếu nhập vải',
  DinhMucVaiDonHang: 'định mức & hao hụt'
};
function tenBangVN(ten) { return TEN_BANG_VN[ten] || ten; }

/* Ra soat truoc khi xoa 1 lenh SX.
   Tra ve { chan: [{ten, so}], xoaKem: [{bang, cot}] } — `chan` rong = xoa duoc. */
async function raSoatXoaDonHang(pool, donHangId, tran) {
  const fks = await dsBangThamChieuDonHang(pool);
  const chan = [];
  const xoaKem = [];
  for (const f of fks) {
    if (laXoaKem(f.ten)) { xoaKem.push(f); continue; }
    const rq = tran ? new sql.Request(tran) : pool.request();
    // Ten bang/cot lay tu sys.foreign_keys (khong phai dau vao nguoi dung) nen noi chuoi an toan.
    const so = (await rq.input('dh', sql.Int, donHangId)
      .query(`SELECT COUNT(*) AS So FROM ${f.bang} WHERE ${f.cot} = @dh`)).recordset[0].So;
    if (so > 0) chan.push({ ten: tenBangVN(f.ten), so });
  }
  return { chan, xoaKem };
}

/* Cau bao loi day du cho nguoi dung: vuong o dau, bao nhieu, phai lam gi. */
function cauBaoChan(chan) {
  return 'Không xóa được lệnh SX này vì đã phát sinh nghiệp vụ khác: '
    + chan.map(c => `${c.ten} (${c.so})`).join(', ')
    + '. Hủy / gỡ gán lệnh SX ở các phiếu đó trước rồi xóa lại.';
}

module.exports = { dsBangThamChieuDonHang, raSoatXoaDonHang, tenBangVN, cauBaoChan };
