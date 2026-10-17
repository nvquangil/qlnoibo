const { sql } = require('../db');
const { capNhatTrangThaiCay } = require('./tonVai');   // v7.36: MOT ban cong thuc TrangThai cay vai

// Logic xuat kho vai dung chung cho:
//  - Xuat thu cong tu phan he Kho vai (routes/khovai.js -> POST /xuat)
//  - Cap vai truc tiep cho don hang tu phan he Quan ly san xuat (routes/qlsx.js -> POST /orders/:maDH/vaicap)
// Tra ve { phieuXuatId, chiTiet: [{ cayId, maCay, kgXuat, kgCon }] }
/* v6.66: THEM `laTraNCC` + `nccId` - phieu xuat vai co the la TRA HANG VE NHA CUNG CAP, khi do
   GIAM cong no phai tra (congno.js congNoNCC + soChiTietNCC, don gia lay VaiCay.DonGiaNhap).
   Do cot truoc khi ghi: he thong chua chay migration_v676 van xuat kho binh thuong, chi khong co
   phan tra NCC - tot hon la vo ca duong xuat vai dang chay that. */
let __coCotTraNCC = null;
async function coCotTraNCC(pool) {
  if (__coCotTraNCC === null) {
    try {
      const r = (await pool.request().query(
        `SELECT COL_LENGTH('PhieuXuatVai','LaTraNCC') AS a, COL_LENGTH('PhieuXuatVai','NCC_ID') AS b`)).recordset[0] || {};
      __coCotTraNCC = r.a != null && r.b != null;
    } catch (e) { __coCotTraNCC = false; }
  }
  return __coCotTraNCC;
}

/* v8.91: don gia tra go tay (migration_v879). Chua chay migration thi van xuat kho binh thuong,
   chi la khong luu duoc don gia go va cong no van dung VaiCay.DonGiaNhap.
   ⚠️ DUNG CHUNG ham do cot cua utils/tienVaiNhap.js — KHONG tu do rieng o day. Ly do: ban nhap dau
   cua v8.91 co hai ban do cot rieng, moi ban mot cache; chay migration ma quen pm2 restart thi mot
   ben thay cot, mot ben khong => phieu IN ra don gia go tay con cong no NCC ghi no theo gia nhap.
   Ham chung do cot MOI LAN GOI (khong cache) nen hai ben khong bao gio lech nhau. */
const { coCotDonGiaTra, chuanDonGiaTra } = require('./tienVaiNhap');

async function xuatKhoVai(pool, { ngayXuat, maDon, donHangId, chuyen, nguoiNhan, mucDich, ghiChu, nguoiTaoId, rolls, laTraNCC, nccId }) {
  if (!ngayXuat || !Array.isArray(rolls) || !rolls.length) {
    throw new Error('Thiếu ngày xuất hoặc danh sách cây vải.');
  }
  const traNCC = !!laTraNCC;
  if (traNCC && !nccId) throw new Error('Phiếu xuất đánh dấu "Trả nhà cung cấp" nhưng chưa chọn nhà cung cấp.');
  const coTra = await coCotTraNCC(pool);
  if (traNCC && !coTra) throw new Error('Chưa chạy migration_v676 nên chưa lưu được phiếu trả nhà cung cấp.');
  const coDgTra = await coCotDonGiaTra(pool);   // v8.91
  // Go don gia ma CSDL chua co cot thi phai bao — im lang la nguoi dung go gia roi mat sach.
  if (traNCC && !coDgTra && (rolls || []).some(r => r && chuanDonGiaTra(r.donGiaTra) != null)) {
    throw new Error('Chưa chạy migration_v879 nên chưa lưu được Đơn giá trả. Bỏ trống cột Đơn giá để dùng giá nhập, hoặc chạy migration rồi pm2 restart.');
  }

  const rqPhieu = pool.request()
    .input('NgayXuat', sql.Date, ngayXuat)
    .input('MaDon', sql.NVarChar, maDon || null)
    .input('DonHangID', sql.Int, donHangId || null)
    .input('Chuyen', sql.NVarChar, chuyen || null)
    .input('NguoiNhan', sql.NVarChar, nguoiNhan || null)
    .input('MucDich', sql.NVarChar, mucDich || null)
    .input('GhiChu', sql.NVarChar, ghiChu || null)
    .input('NguoiTaoID', sql.Int, nguoiTaoId || null);
  if (coTra) {
    rqPhieu.input('LaTraNCC', sql.Bit, traNCC ? 1 : 0)
           .input('NCC_ID', sql.Int, traNCC ? nccId : null);
  }
  const phieuResult = await rqPhieu
    .query(`INSERT INTO PhieuXuatVai (NgayXuat, MaDon, DonHangID, Chuyen, NguoiNhan, MucDich, GhiChu, NguoiTaoID${coTra ? ', LaTraNCC, NCC_ID' : ''})
            OUTPUT INSERTED.PhieuXuatID
            VALUES (@NgayXuat, @MaDon, @DonHangID, @Chuyen, @NguoiNhan, @MucDich, @GhiChu, @NguoiTaoID${coTra ? ', @LaTraNCC, @NCC_ID' : ''})`);
  const phieuXuatId = phieuResult.recordset[0].PhieuXuatID;

  const chiTiet = [];
  for (const roll of rolls) {
    const cayResult = await pool.request().input('id', sql.Int, roll.cayId).query('SELECT * FROM VaiCay WHERE CayID=@id');
    /* v7.36: truoc day la `continue` IM LANG -> cayId sai/khong con thi phieu van duoc tao nhung
       THIEU DONG do (hoac rong hoan toan), nguoi dung thay "luu thanh cong ma khong xuat gi".
       Nay bao loi ro rang; ca ham nam trong 1 giao dich nen phieu khong bi tao nua vo. */
    if (!cayResult.recordset.length) {
      throw new Error(`Không tìm thấy cây vải (CayID=${roll.cayId}) — có thể cây đã bị xóa. Tải lại trang rồi chọn lại.`);
    }
    const cay = cayResult.recordset[0];
    const kgXuat = Number(roll.kgXuat) || 0;
    const soMet = (roll.soMet === '' || roll.soMet == null) ? null : Number(roll.soMet);   // v5.50
    /* v8.91: don gia tra NCC go tay. ĐỂ TRỐNG => NULL => cong no dung VaiCay.DonGiaNhap nhu cu.
       Luat chuan hoa (ke ca vi sao so 0 cung thanh NULL) nam o utils/tienVaiNhap.js — MOT ban. */
    const dgTra = chuanDonGiaTra(roll.donGiaTra);

    await pool.request()
      .input('PhieuXuatID', sql.Int, phieuXuatId)
      .input('CayID', sql.Int, roll.cayId)
      .input('KGXuat', sql.Decimal(10, 2), kgXuat)
      .input('SoMet', sql.Decimal(10, 2), soMet)   // v5.50
      .input('KieuVai', sql.NVarChar, roll.kieuVai === 'Phối' ? 'Phối' : 'Chính')   // v5.31: Chính/Phối tung cay
      .input('DonGiaTra', sql.Decimal(18, 2), coDgTra ? dgTra : null)
      .query(`INSERT INTO PhieuXuatVaiChiTiet (PhieuXuatID, CayID, KGXuat, SoMet, KieuVai${coDgTra ? ', DonGiaTra' : ''})
              VALUES (@PhieuXuatID, @CayID, @KGXuat, @SoMet, @KieuVai${coDgTra ? ', @DonGiaTra' : ''})`);

    /* v7.36: dung HAM CHUNG capNhatTrangThaiCay (utils/tonVai.js) thay vi copy cong thuc.
       Ham do xet CA MET — truoc day cho nay chi xet KG nen cay quan theo MET/CAY (KGNhap = 0 =>
       kgCon = 0) bi danh 'Hết' NGAY LAN XUAT DAU TIEN du con nguyen met. */
    const tt = await capNhatTrangThaiCay(pool, sql, roll.cayId) || {};

    chiTiet.push({ cayId: roll.cayId, maCay: cay.MaCay, kgXuat, kgCon: tt.kgCon, metCon: tt.metCon });
  }
  return { phieuXuatId, chiTiet };
}

module.exports = { xuatKhoVai };
