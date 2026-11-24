/* ==================================================================================================
   v9.61 — NHẬT KÝ HỢP ĐỒNG (audit trail) — CHỈ THÊM, mỗi dòng băm nối dòng trước.
   --------------------------------------------------------------------------------------------------
   Nguyen 14/11/2026: "Xem lịch sử log (Audit Trail) của từng hợp đồng: ai xem lúc mấy giờ, IP nào, mã OTP
   xác nhận lúc mấy giờ." Nhật ký là BẰNG CHỨNG của bản ký OTP nên:
     · không có route sửa/xóa — chỉ ghi(); xóa hợp đồng (CASCADE) mới mất;
     · Hash = SHA-256(HashTruoc + HanhDong + ChiTiet + IP + UA + UserID + BenKyID + Luc) — ai sửa tay một
       dòng trong CSDL là kiemChuoi() phát hiện từ dòng đó trở đi (như sổ cái nối chuỗi);
     · không ném lỗi ra ngoài luồng nghiệp vụ: ghi nhật ký hỏng thì console.error, hợp đồng vẫn đi tiếp
       (nhưng KHÔNG nuốt im: route ký trả thêm canhBao).
   Dòng Luc do SQL sinh (SYSDATETIME) — đọc lại ngay sau INSERT để băm đúng giá trị đã lưu.
   ================================================================================================== */
'use strict';
const crypto = require('crypto');
const { sql } = require('../db');

const sha256 = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');

/* Chuỗi để băm — thứ tự cố định, giá trị null -> '' (đổi quy tắc này là mọi chuỗi cũ "sai" — đừng đổi). */
function chuoiBam(d) {
  return [d.HashTruoc || '', d.HanhDong || '', d.ChiTiet || '', d.IP || '', d.UserAgent || '',
    d.UserID == null ? '' : String(d.UserID), d.BenKyID == null ? '' : String(d.BenKyID), d.Luc || ''].join('|');
}
/* SYSDATETIME() trả DATETIME2(7); mssql đọc thành Date (mất phần 100 ns) ⇒ băm theo ISO ms. Để kiemChuoi
   băm lại đúng, Luc được CHUẨN HÓA qua CONVERT(varchar(23), Luc, 121) ở CẢ HAI chỗ (ghi và kiểm). */
const SQL_LUC = (cot) => `CONVERT(varchar(23), ${cot}, 121)`;

async function ghi(pool, o) {
  try {
    const hd = Number(o.hopDongId);
    if (!hd) throw new Error('thiếu hopDongId');
    const cuoi = (await pool.request().input('hd', sql.Int, hd)
      .query(`SELECT TOP 1 Hash FROM HopDongMBNhatKy WHERE HopDongMBID=@hd ORDER BY NhatKyID DESC`)).recordset[0];
    const hashTruoc = cuoi ? cuoi.Hash : null;
    const chiTiet = o.chiTiet == null ? null : (typeof o.chiTiet === 'string' ? o.chiTiet : JSON.stringify(o.chiTiet));
    const ins = (await pool.request()
      .input('hd', sql.Int, hd)
      .input('hanh', sql.NVarChar(40), String(o.hanhDong || '').slice(0, 40))
      .input('ct', sql.NVarChar(sql.MAX), chiTiet)
      .input('ip', sql.NVarChar(64), o.ip ? String(o.ip).slice(0, 64) : null)
      .input('ua', sql.NVarChar(300), o.ua ? String(o.ua).slice(0, 300) : null)
      .input('uid', sql.Int, o.userId || null)
      .input('ben', sql.Int, o.benKyId || null)
      .input('ht', sql.Char(64), hashTruoc)
      .query(`INSERT INTO HopDongMBNhatKy (HopDongMBID, HanhDong, ChiTiet, IP, UserAgent, UserID, BenKyID, HashTruoc, Hash)
              OUTPUT INSERTED.NhatKyID, ${SQL_LUC('INSERTED.Luc')} AS Luc
              VALUES (@hd, @hanh, @ct, @ip, @ua, @uid, @ben, @ht, REPLICATE('0', 64))`)).recordset[0];
    const hash = sha256(chuoiBam({ HashTruoc: hashTruoc, HanhDong: String(o.hanhDong || '').slice(0, 40), ChiTiet: chiTiet,
      IP: o.ip ? String(o.ip).slice(0, 64) : '', UserAgent: o.ua ? String(o.ua).slice(0, 300) : '',
      UserID: o.userId || null, BenKyID: o.benKyId || null, Luc: ins.Luc }));
    await pool.request().input('id', sql.Int, ins.NhatKyID).input('h', sql.Char(64), hash)
      .query('UPDATE HopDongMBNhatKy SET Hash=@h WHERE NhatKyID=@id');
    return { ok: true, nhatKyId: ins.NhatKyID, hash };
  } catch (e) {
    console.error('[hopdong] KHÔNG ghi được nhật ký: ' + e.message);
    return { ok: false, loi: e.message };
  }
}

/* Đọc nhật ký + kiểm chuỗi băm. Trả { rows, chuoiOk, dongHong } — dongHong = NhatKyID đầu tiên không khớp. */
async function doc(pool, hopDongId) {
  const rows = (await pool.request().input('hd', sql.Int, Number(hopDongId)).query(`
    SELECT n.NhatKyID, n.HanhDong, n.ChiTiet, n.IP, n.UserAgent, n.UserID, n.BenKyID, n.HashTruoc, n.Hash,
           ${SQL_LUC('n.Luc')} AS Luc, u.HoTen AS NguoiThucHien
    FROM HopDongMBNhatKy n LEFT JOIN Users u ON u.UserID = n.UserID
    WHERE n.HopDongMBID=@hd ORDER BY n.NhatKyID`)).recordset;
  let truoc = null, dongHong = null;
  for (const r of rows) {
    const mong = sha256(chuoiBam({ HashTruoc: truoc, HanhDong: r.HanhDong, ChiTiet: r.ChiTiet, IP: r.IP, UserAgent: r.UserAgent,
      UserID: r.UserID, BenKyID: r.BenKyID, Luc: r.Luc }));
    if ((r.HashTruoc || null) !== truoc || r.Hash !== mong) { dongHong = r.NhatKyID; break; }
    truoc = r.Hash;
  }
  return { rows, chuoiOk: dongHong == null, dongHong };
}

module.exports = { ghi, doc, sha256, chuoiBam };
