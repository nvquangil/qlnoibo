/* ================================================================================================
   HAM DUNG CHUNG CHO PHIEU BAN HANG / PHIEU NHAP LAI   (v6.66)

   ⚠️ VI SAO CO FILE NAY: cac ham quy doi don vi + tru/hoan ton dang bi CHEP LAI o nhieu file
   (banhang.js, khohang.js, public.js, common.js). Moi lan sua phai nho sua het - da tung lech.
   Phieu nhap lai la ban ghi NGUOC cua phieu ban hang, neu chep them ban thu 5 thi chi can 1 lan
   quen la "ban 1 Ri" tru 6 cai ma "tra lai 1 Ri" chi cong 1 cai.

   TRANG THAI RE-WIRE: banhang.js VAN dang giu ban sao rieng cua cac ham nay (chua go, de tranh
   dung vao duong tru ton dang chay that trong cung mot lan sua). Sua CONG THUC o day thi PHAI
   sua doi xung ben banhang.js cho toi khi banhang.js duoc chuyen sang require file nay.
   ================================================================================================ */
const { sql } = require('../db');

function so(v) { const n = Number(v); return isFinite(n) ? n : 0; }
function lam2(v) { return Math.round(so(v) * 100) / 100; }
/* TIEN luon lam tron ve DONG - VND khong co xu. */
function tien(v) { return Math.round(so(v)); }

/* ---------- QUY DOI DON VI ----------
   Cau hoi dung KHONG phai "don vi nay ten la Ri a?" ma la "don vi nay co phai DON VI QUY DOI cua
   CHINH ma hang do khong?" (v6.31). `mh` = { DonViCoBan, DonViQuyDoi }. */
function chuanDV(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
function laDonViGop(donVi, mh) {
  const dv = chuanDV(donVi), qd = chuanDV(mh && mh.DonViQuyDoi);
  return qd ? dv === qd : dv === 'ri';
}
function donViChinhLaGop(mh) {
  const cb = chuanDV(mh && mh.DonViCoBan), qd = chuanDV(mh && mh.DonViQuyDoi);
  return qd ? cb === qd : cb === 'ri';
}
/* slSangCai()        -> dung cho TIEN va BAN IN. Gia luon la gia 1 CAI.
   slSangDonViChinh() -> dung cho TON KHO. TheKhoChiTietMau.NhapCai/XuatCai luu theo DON VI CHINH. */
function slSangCai(soLuong, donVi, loaiRi, mh) {
  const n = so(soLuong), he = so(loaiRi) || 1;
  return Math.round(laDonViGop(donVi, mh) ? n * he : n);
}
function slSangDonViChinh(soLuong, donVi, donViCoBan, loaiRi, mhIn) {
  const he = so(loaiRi) || 1;
  const mh = mhIn || { DonViCoBan: donViCoBan, DonViQuyDoi: null };
  const cai = slSangCai(soLuong, donVi, loaiRi, mh);
  const base = donViChinhLaGop({ DonViCoBan: donViCoBan, DonViQuyDoi: mh.DonViQuyDoi }) ? cai / he : cai;
  return Math.round(base);
}

/* ---------- SO PHIEU <tienTo><yy><n so>, chay suot ca nam ---------- */
async function sinhSoPhieu(nguon, bang, cot, tienTo, tienToCu, soChuSo) {
  const yy = String(new Date().getFullYear()).slice(-2);
  const dsTienTo = [tienTo].concat(tienToCu ? [tienToCu] : []);
  const rq = typeof nguon.request === 'function' ? nguon.request() : nguon;
  dsTienTo.forEach((t, i) => rq.input('p' + i, sql.NVarChar, t + yy + '%'));
  const rs = await rq.query(`SELECT ${cot} AS S FROM ${bang} WHERE ` + dsTienTo.map((t, i) => `${cot} LIKE @p${i}`).join(' OR '));
  const nums = rs.recordset.map(r => {
    const chuoi = String(r.S || '').trim();
    for (const t of dsTienTo) {
      const m = new RegExp('^' + t + '(\\d{2})(\\d+)$').exec(chuoi);
      if (m && m[1] === yy) return parseInt(m[2], 10) || 0;
    }
    return 0;
  });
  return tienTo + yy + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(soChuSo || 4, '0');
}

/* ---------- TRU / HOAN TON THANH PHAM ----------
   `sl` theo DON VI CHINH cua ma hang.  sl > 0 = TRU ton;  sl < 0 = HOAN ton.
   HOAN: chi UPDATE, KHONG tao dong moi - dong mau co the da bi xoa khoi the kho, tao moi se sinh
   XuatCai am = ton ao duong. */
async function ghiXuatKho(pool, tran, maHangId, mauSacId, sl, nhanLoi, nhan) {
  const rq = () => (tran ? new sql.Request(tran) : pool.request());
  if (sl > 0) {
    const kq = await rq().input('mh', sql.Int, maHangId).input('ms', sql.Int, mauSacId).input('sl', sql.Int, sl)
      .query(`UPDATE TheKhoChiTietMau SET XuatCai = XuatCai + @sl
              WHERE MaHangID=@mh AND MauSacID=@ms AND (NhapCai - XuatCai) >= @sl`);
    if (!kq.rowsAffected[0]) {
      throw new Error(`Không đủ tồn kho để xuất${nhanLoi ? ' (' + nhanLoi + ')' : ''} — có người vừa bán/xuất mã này. Mở lại phiếu và kiểm tra tồn.`);
    }
    return;
  }
  const kq = await rq().input('mh', sql.Int, maHangId).input('ms', sql.Int, mauSacId).input('sl', sql.Int, -sl)
    .query('UPDATE TheKhoChiTietMau SET XuatCai = XuatCai - @sl WHERE MaHangID=@mh AND MauSacID=@ms');
  if (!kq.rowsAffected[0]) {
    console.warn('[%s ghiXuatKho] khong tim thay dong the kho de HOAN ton (MaHangID=%s, MauSacID=%s) - bo qua.',
      nhan || 'banHangCommon', maHangId, mauSacId);
  }
}

module.exports = {
  so, lam2, tien, chuanDV, laDonViGop, donViChinhLaGop,
  slSangCai, slSangDonViChinh, sinhSoPhieu, ghiXuatKho
};
