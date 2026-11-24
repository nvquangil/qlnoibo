/* ================================================================================================
   nghiPhep.js — v9.55 (Nguyen 14/11/2026): LỊCH NGHỈ LỄ CHUNG + PHIẾU NGHỈ (phép / không lương /
   thai sản / tai nạn) → GHI VÀO BẢNG CHẤM CÔNG để bảng lương đọc như cũ.

   NGUYÊN TẮC
   · Phiếu nghỉ là NGUỒN SỰ THẬT; dòng ChamCongNgay sinh ra từ phiếu mang Nguon = 'PhieuNghi', MaCham =
     Loai (P/KL/TS/TN), SoCong = 0. Bộ tính lương (utils/luongCongNhat.js gomChamCong) đã hiểu các mã này:
     P → cột Phép (không lương, không xăng, mất chuyên cần); KL/TS/TN → không công, không lương.
   · CHỈ ghi NGÀY LÀM VIỆC trong khoảng (bỏ Chủ nhật + lễ chung) — một dòng P rơi vào Chủ nhật là
     "có phép" vô cớ, mất chuyên cần oan.
   · MÁY THẮNG PHIẾU: ngày đã có dòng Nguon='May' (người đi làm sớm hơn phiếu) hay 'ThuCong' (nhân sự sửa
     tay) thì KHÔNG ghi đè; chỉ chèn khi chưa có dòng, chỉ sửa dòng do chính phiếu sinh ra. Chiều ngược
     lại, tổng hợp từ máy (payroll.js tongHopChamCongThang) được phép ghi đè dòng 'PhieuNghi' thành 'May'.
   · Sửa/xóa phiếu: gỡ dòng 'PhieuNghi' của khoảng cũ rồi ÁP LẠI mọi phiếu của các tháng bị đụng —
     hai phiếu chồng ngày của cùng người vẫn đúng. Tổng hợp từ máy cũng áp lại phiếu của tháng đó
     (để "Xóa bảng công tháng" + tổng hợp lại không làm mất phép).
   · Lễ chung (NgayLeChung) KHÔNG có công (Nguyen chốt): chỉ loại khỏi ngày làm việc + OT ngày đó vào
     cột Lễ/Tết (cấu hình chấm công đọc hợp nhất bảng này với ô ngày lễ cũ — xem dongBoNgayLe).
   ================================================================================================ */
'use strict';
const { sql } = require('../db');
const { dsNgayLamViec } = require('./luongCongNhat');

const LOAI_NGHI = { P: 'Nghỉ phép', KL: 'Nghỉ không lương', TS: 'Nghỉ thai sản', TN: 'Nghỉ tai nạn' };
const NGUON = 'PhieuNghi';
const laNgay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').slice(0, 10));
const catNgay = (s) => String(s || '').slice(0, 10);
const khoaThang = (nam, thang) => `${nam}-${String(thang).padStart(2, '0')}`;
const cuoiThangCua = (nam, thang) => `${khoaThang(nam, thang)}-${String(new Date(Date.UTC(nam, thang, 0)).getUTCDate()).padStart(2, '0')}`;
function homNayVN() {   // giờ máy chủ (VN) — không toISOString (lệch +7, bài học cũ)
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/* Các tháng (nam, thang) mà một khoảng ngày chạm tới — để đánh dấu bảng lương + áp lại phiếu. */
function dsThangCua(tu, den) {
  const ra = [];
  if (!laNgay(tu) || !laNgay(den)) return ra;
  let n = Number(tu.slice(0, 4)), t = Number(tu.slice(5, 7));
  const nd = Number(den.slice(0, 4)), td = Number(den.slice(5, 7));
  for (let i = 0; i < 24 && (n < nd || (n === nd && t <= td)); i++) {
    ra.push({ nam: n, thang: t });
    t++; if (t > 12) { t = 1; n++; }
  }
  return ra;
}

async function coBang(pool, ten) {
  try { const r = (await pool.request().input('t', sql.NVarChar, ten).query('SELECT OBJECT_ID(@t) AS o')).recordset[0] || {}; return r.o != null; }
  catch (e) { return false; }
}

/* ---------- LỄ CHUNG ---------- */
/* Set 'yyyy-mm-dd'. nam null = mọi năm. Chưa có bảng (chưa migration_v892) ⇒ Set rỗng, không nổ. */
async function docNgayLe(pool, nam) {
  if (!(await coBang(pool, 'NgayLeChung'))) return new Set();
  const rq = pool.request();
  let where = '';
  if (nam) { rq.input('n', sql.Int, nam); where = 'WHERE YEAR(Ngay) = @n'; }
  const rows = (await rq.query(`SELECT CONVERT(varchar(10), Ngay, 23) AS Ngay FROM NgayLeChung ${where}`)).recordset;
  return new Set(rows.map(r => r.Ngay));
}
/* Danh sách ngày lễ DUY NHẤT: bảng NgayLeChung. Ô "Ngày lễ / Tết" cũ của Cài đặt chấm công (cfg.ngayLe)
   chỉ còn vai trò NGUỒN CHÉP một lần: bảng trống mà ô cũ có ngày thì chép sang, từ đó bảng là sự thật
   (xóa một ngày ở lịch là mất hẳn, không bị ô cũ "trả lại"). Chưa chạy migration_v892 (không có bảng)
   thì vẫn dùng ô cũ như trước. */
async function dongBoNgayLe(pool, dsCu) {
  const cu = (Array.isArray(dsCu) ? dsCu : []).map(s => catNgay(String(s).trim())).filter(laNgay);
  if (!(await coBang(pool, 'NgayLeChung'))) return { ds: Array.from(new Set(cu)).sort(), daChep: 0, coBang: false };
  let daChep = 0;
  try {
    const dem = (await pool.request().query('SELECT COUNT(*) AS n FROM NgayLeChung')).recordset[0];
    if ((!dem || !Number(dem.n)) && cu.length) {
      for (const s of cu) {
        const r = await pool.request().input('d', sql.Date, s).input('t', sql.NVarChar(100), 'Lễ (chuyển từ Cài đặt chấm công cũ)')
          .query('IF NOT EXISTS (SELECT 1 FROM NgayLeChung WHERE Ngay=@d) INSERT INTO NgayLeChung (Ngay, TenLe) VALUES (@d, @t)');
        daChep += (r.rowsAffected && r.rowsAffected[0]) || 0;
      }
    }
  } catch (e) { console.warn('[nghiPhep dongBoNgayLe] ' + e.message); }
  return { ds: Array.from(await docNgayLe(pool, null)).sort(), daChep, coBang: true };
}

/* ---------- PHIẾU NGHỈ → CHẤM CÔNG ---------- */
/* Ghi các ngày làm việc của phiếu NẰM TRONG [tuChan, denChan] (mặc định cả khoảng phiếu) vào ChamCongNgay.
   Trả số ngày đã MERGE (chèn mới hoặc sửa dòng PhieuNghi). */
async function apDungPhieuNghi(pool, phieu, ngayLe, tuChan, denChan) {
  const tu = laNgay(tuChan) && catNgay(tuChan) > catNgay(phieu.TuNgay) ? catNgay(tuChan) : catNgay(phieu.TuNgay);
  const den = laNgay(denChan) && catNgay(denChan) < catNgay(phieu.DenNgay) ? catNgay(denChan) : catNgay(phieu.DenNgay);
  const ma = String(phieu.Loai || '').trim().toUpperCase();
  if (!LOAI_NGHI[ma] || !laNgay(tu) || !laNgay(den) || tu > den) return 0;
  /* v9.73: giấy NỬA ngày (PhieuNghi.NuaNgay, migration_v899) ⇒ dòng chấm công MaCham = loại, SoCong = 0,5 — gomChamCong
     cộng phép 0,5 (nhánh 'P' lấy SoCong khi > 0). Nửa ngày còn lại: theo máy chấm công / sửa tay (máy vẫn thắng giấy —
     ngày đã có dòng Nguon='May' thì giấy không ghi, phép nửa ngày chỉ nằm trên giấy). */
  const soCongNghi = phieu.NuaNgay ? 0.5 : 0;
  const ghiChu = `Phiếu ${phieu.SoPhieu || ('#' + phieu.PhieuNghiID)}: ${LOAI_NGHI[ma]}${phieu.NuaNgay ? ' (nửa ngày)' : ''}`;
  let n = 0;
  for (const ngay of dsNgayLamViec(tu, den, ngayLe)) {
    const r = await pool.request().input('nv', sql.Int, phieu.NhanVienID).input('ngay', sql.Date, ngay)
      .input('ma', sql.NVarChar, ma).input('gc', sql.NVarChar, ghiChu.slice(0, 255)).input('sc', sql.Decimal(4, 2), soCongNghi).query(`
      MERGE ChamCongNgay AS t USING (SELECT @nv AS NhanVienID, @ngay AS Ngay) AS s
        ON t.NhanVienID = s.NhanVienID AND t.Ngay = s.Ngay
      WHEN MATCHED AND t.Nguon = N'${NGUON}' THEN UPDATE SET MaCham=@ma, SoCong=@sc, SoGioLam=0, GioVao=NULL, GioRa=NULL,
           GioTangCaThuong=0, GioTangCaChuNhat=0, GioTangCaLeTet=0, GhiChu=@gc
      WHEN NOT MATCHED THEN INSERT (NhanVienID, Ngay, MaCham, SoCong, GhiChu, Nguon)
           VALUES (@nv, @ngay, @ma, @sc, @gc, N'${NGUON}');`);
    n += (r.rowsAffected && r.rowsAffected[0]) || 0;
  }
  return n;
}
/* Gỡ MỌI dòng do phiếu sinh ra trong khoảng (của người đó) — rồi caller áp lại phiếu các tháng bị đụng. */
async function goDongPhieuNghi(pool, nhanVienId, tu, den) {
  if (!laNgay(tu) || !laNgay(den)) return 0;
  const r = await pool.request().input('nv', sql.Int, nhanVienId).input('tu', sql.Date, catNgay(tu)).input('den', sql.Date, catNgay(den))
    .query(`DELETE FROM ChamCongNgay WHERE NhanVienID=@nv AND Ngay BETWEEN @tu AND @den AND Nguon = N'${NGUON}'`);
  return (r.rowsAffected && r.rowsAffected[0]) || 0;
}
/* Áp lại TẤT CẢ phiếu chạm tới tháng (nam, thang) — gọi sau tổng hợp từ máy và sau sửa/xóa phiếu. */
async function apDungPhieuNghiThang(pool, nam, thang) {
  if (!(await coBang(pool, 'PhieuNghi'))) return { phieu: 0, ngay: 0 };
  const dau = `${khoaThang(nam, thang)}-01`, cuoi = cuoiThangCua(nam, thang);
  let coNua = false;
  try { coNua = (await pool.request().query("SELECT COL_LENGTH('PhieuNghi','NuaNgay') AS c")).recordset[0].c != null; } catch (e) { coNua = false; }   // v9.73
  const ds = (await pool.request().input('dau', sql.Date, dau).input('cuoi', sql.Date, cuoi).query(`
    SELECT PhieuNghiID, SoPhieu, NhanVienID, Loai, CONVERT(varchar(10), TuNgay, 23) AS TuNgay, CONVERT(varchar(10), DenNgay, 23) AS DenNgay${coNua ? ', NuaNgay' : ''}
    FROM PhieuNghi WHERE TuNgay <= @cuoi AND DenNgay >= @dau ORDER BY TuNgay, PhieuNghiID`)).recordset;
  if (!ds.length) return { phieu: 0, ngay: 0 };
  const ngayLe = await docNgayLe(pool, null);
  let ngay = 0;
  for (const p of ds) ngay += await apDungPhieuNghi(pool, p, ngayLe, dau, cuoi);
  return { phieu: ds.length, ngay };
}
/* Số phiếu NP<yy><4 số> chạy suốt năm — cùng quy tắc sinhSoPhieu của phiếu thu/chi. */
async function sinhSoPhieuNghi(pool) {
  const yy = String(new Date().getFullYear()).slice(-2), prefix = 'NP' + yy;
  const rs = (await pool.request().input('p', sql.NVarChar, prefix + '%').query('SELECT SoPhieu AS S FROM PhieuNghi WHERE SoPhieu LIKE @p')).recordset;
  const re = new RegExp('^NP(\\d{2})(\\d+)$');
  let mx = 0;
  rs.forEach(r => { const m = re.exec(String(r.S || '').trim()); if (m && m[1] === yy) mx = Math.max(mx, parseInt(m[2], 10) || 0); });
  return prefix + String(mx + 1).padStart(4, '0');
}

module.exports = { LOAI_NGHI, NGUON, laNgay, catNgay, homNayVN, dsThangCua, cuoiThangCua, docNgayLe, dongBoNgayLe,
  apDungPhieuNghi, goDongPhieuNghi, apDungPhieuNghiThang, sinhSoPhieuNghi, coBang };
