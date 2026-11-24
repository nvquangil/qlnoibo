/* ================================================================================================
   bangLuongTuDong.js — v9.53 (Nguyen 14/11/2026: "Lương công nhật – tính lương khi có biến động ngày
   công, phiếu thu chi hay ký hợp đồng tự động tính lương luôn, không cần bấm tính lương").

   CÁCH LÀM: CỜ BẨN + TÍNH LẠI LÚC XEM, không tính ngay lúc ghi.
   · Mỗi nơi làm đổi đầu vào của bảng lương (chấm công, phiếu chi tạm ứng, hợp đồng, KPI, cấu hình)
     gọi danhDau(...) ⇒ ghi "tháng m/yyyy cần tính lại, vì ..." vào CauHinh (khóa BANG_LUONG_TU_DONG).
   · GET /bangluong (tab Lương công nhật) và GET /bangluong/cuatoi (nhân viên tự xem) gọi
     tinhLaiNeuCan(...) TRƯỚC khi đọc bảng: có cờ ⇒ chạy đúng hàm của nút "Tính lương"
     (payroll.tinhBangLuongThang), xóa cờ, trả về "đã tự tính lại lúc ... vì ..." để màn hình nói.
   Vì sao không tính ngay lúc ghi: một buổi sửa chấm công 40 dòng = 40 lần tính cả bảng (DELETE+INSERT
   47 người) mà không ai xem; tổng hợp theo lịch 23:30 cũng vậy. Tính lúc xem thì mỗi lần mở tab tối
   đa MỘT lần tính, và luôn ra số mới nhất — đúng cái người dùng cần: mở lên là thấy số đúng.

   🔴 ĐÃ CHỐT THÌ KHÔNG TỰ TÍNH (giữ luật v9.32): cờ vẫn ghi, màn hình hiện "có biến động sau khi
      chốt: ...", kế toán tự quyết. Tự tính đè lên bảng đã chốt là đổi tiền đã trả.
   🔴 danhDau KHÔNG BAO GIỜ ném: nó chạy ở cuối route phiếu chi (sau khi phiếu ĐÃ ghi — ném là người
      dùng thấy "lỗi" dù phiếu đã vào sổ) và cuối lịch chấm công. Hỏng cờ chỉ mất một lần tự tính.
   🔴 Ngày truyền vào là CHUỖI 'yyyy-mm-dd' (từ req.body hoặc CONVERT(varchar(10), cột, 23)). Đối
      tượng Date của driver (useUTC=true) đọc theo UTC. Không truyền new Date() — thiếu ngày thì để
      null, hàm tự lấy tháng hiện tại theo giờ máy chủ.

   Dạng lưu (một JSON cho mọi tháng, tỉa còn 14 tháng gần nhất):
     { "2026-11": { can: true, lan: 3, luc: "2026-11-14 09:12", lyDo: ["Sửa tay chấm công 12/11", ...],
                    lanCuoi: { luc, lyDo, soNhanVien, soThieuHopDong, soCanhBao } } }
   `lan` đếm số lần đánh dấu: biến động đến TRONG LÚC đang tính thì sau khi tính xong cờ vẫn còn
   (so `lan` trước/sau) — lần xem kế tiếp tính nữa, không nuốt biến động.
   ================================================================================================ */
'use strict';
const { sql } = require('../db');

const KHOA = 'BANG_LUONG_TU_DONG';
const TOI_DA_LY_DO = 8;      // giữ 8 lý do gần nhất của một tháng — đủ để biết vì sao, không phình JSON
const TOI_DA_THANG = 12;     // hợp đồng lùi ngày cả năm cũng chỉ đánh dấu 12 tháng gần nhất
const GIU_THANG = 14;        // tỉa JSON: giữ 14 tháng gần nhất

/* ---------- tháng ---------- */
const khoaThang = (nam, thang) => `${nam}-${String(thang).padStart(2, '0')}`;
const soThang = (nam, thang) => nam * 12 + (thang - 1);                 // chỉ số liên tục để cộng/trừ tháng
const tuSoThang = (i) => ({ nam: Math.floor(i / 12), thang: (i % 12) + 1 });
function thangHienTai() { const d = new Date(); return { nam: d.getFullYear(), thang: d.getMonth() + 1 }; }
function thangTruoc(t) { return tuSoThang(soThang(t.nam, t.thang) - 1); }
/* 'yyyy-mm-dd' / 'yyyy-mm-ddThh:mm' → {nam, thang}; Date (từ CSDL, useUTC) → theo UTC; khác → null. */
function thangTuNgay(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : { nam: v.getUTCFullYear(), thang: v.getUTCMonth() + 1 };
  const m = /^(\d{4})-(\d{1,2})/.exec(String(v).trim());
  if (!m) return null;
  const nam = Number(m[1]), thang = Number(m[2]);
  return nam >= 2000 && nam <= 2100 && thang >= 1 && thang <= 12 ? { nam, thang } : null;
}
/* Tháng trừ lương của phiếu chi tạm ứng — CÙNG LUẬT với utils/tamUngNhanVien.js:
   ISNULL(TruLuongThang, MONTH(NgayChi)). Thiếu cả ngày chi ⇒ tháng hiện tại. */
function thangTruLuong(truLuongNam, truLuongThang, ngayChi) {
  const n = parseInt(truLuongNam, 10), t = parseInt(truLuongThang, 10);
  if (n >= 2000 && n <= 2100 && t >= 1 && t <= 12) return { nam: n, thang: t };
  return thangTuNgay(ngayChi) || thangHienTai();
}
function bayGio() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
/* 'yyyy-mm-dd' → 'dd/mm/yyyy' cho câu lý do; không đúng dạng thì trả nguyên. */
function ddmmyyyy(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s || '');
}

/* ---------- đọc / ghi JSON ở CauHinh ---------- */
async function docBanDo(pool) {
  const r = (await pool.request().input('k', sql.NVarChar, KHOA).query('SELECT GiaTri FROM CauHinh WHERE Khoa=@k')).recordset[0];
  if (!r || !r.GiaTri) return {};
  try { const o = JSON.parse(r.GiaTri); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; }
  catch (e) { return {}; }
}
async function ghiBanDo(pool, banDo) {
  const khoas = Object.keys(banDo).sort();
  while (khoas.length > GIU_THANG) delete banDo[khoas.shift()];
  const json = JSON.stringify(banDo);
  /* Cùng mẫu UPDATE-rồi-INSERT của CHAM_CONG / CHAM_CONG_TU_DONG trong routes/payroll.js. */
  const up = await pool.request().input('k', sql.NVarChar, KHOA).input('v', sql.NVarChar(sql.MAX), json)
    .query('UPDATE CauHinh SET GiaTri=@v, UpdatedAt=SYSDATETIME() WHERE Khoa=@k');
  if (!up.rowsAffected[0]) {
    await pool.request().input('k', sql.NVarChar, KHOA).input('v', sql.NVarChar(sql.MAX), json)
      .query('INSERT INTO CauHinh (Khoa, GiaTri, UpdatedAt) VALUES (@k, @v, SYSDATETIME())');
  }
}
/* Đọc-sửa-ghi phải TUẦN TỰ trong tiến trình: hai hook cùng lúc (lịch chấm công + kế toán lưu phiếu)
   mà xen nhau thì một cờ bị ghi đè mất. Xếp hàng bằng một promise chuỗi. */
let hangDoi = Promise.resolve();
function tuanTu(fn) {
  const p = hangDoi.then(fn, fn);
  hangDoi = p.catch(() => {});
  return p;
}
const muc = (banDo, k) => (banDo[k] && typeof banDo[k] === 'object' ? banDo[k] : {});

/* ---------- đánh dấu ---------- */
/* dsThang: [{nam, thang}, ...] — MỘT lần đọc-ghi cho cả danh sách. Trả true/false, không ném. */
async function danhDauNhieu(pool, dsThang, lyDo) {
  const ds = (dsThang || []).filter(t => t && t.nam >= 2000 && t.nam <= 2100 && t.thang >= 1 && t.thang <= 12);
  if (!ds.length) return false;
  const ly = String(lyDo || 'Có biến động').trim().slice(0, 120) || 'Có biến động';
  try {
    await tuanTu(async () => {
      const banDo = await docBanDo(pool);
      const luc = bayGio();
      ds.forEach(t => {
        const k = khoaThang(t.nam, t.thang);
        const o = muc(banDo, k);
        o.can = true; o.lan = (Number(o.lan) || 0) + 1; o.luc = luc;
        const cu = Array.isArray(o.lyDo) ? o.lyDo.filter(x => x !== ly) : [];
        cu.push(ly);                                   // lý do lặp (sửa tay 20 dòng) thì dồn về một, đứng cuối
        o.lyDo = cu.slice(-TOI_DA_LY_DO);
        banDo[k] = o;
      });
      await ghiBanDo(pool, banDo);
    });
    return true;
  } catch (e) { console.warn('[bangLuongTuDong danhDau] ' + e.message); return false; }
}
function danhDau(pool, nam, thang, lyDo) {
  return danhDauNhieu(pool, [{ nam: parseInt(nam, 10), thang: parseInt(thang, 10) }], lyDo);
}
/* Tháng của một ngày ('yyyy-mm-dd'); thiếu/sai ngày ⇒ tháng hiện tại. */
function danhDauTheoNgay(pool, ngay, lyDo) {
  const t = thangTuNgay(ngay) || thangHienTai();
  return danhDau(pool, t.nam, t.thang, lyDo);
}
/* Tháng hiện tại + tháng trước — cho biến động không gắn với một ngày (cấu hình lương, trạng thái NV). */
function danhDauGanDay(pool, lyDo) {
  const ht = thangHienTai();
  return danhDauNhieu(pool, [thangTruoc(ht), ht], lyDo);
}
/* TỪ tháng của `ngay` ĐẾN tháng hiện tại (hợp đồng lùi ngày hiệu lực ảnh hưởng mọi tháng từ đó),
   tối đa TOI_DA_THANG tháng gần nhất. Ngày ở tương lai ⇒ chỉ tháng đó (tới tháng ấy sẽ tự tính). */
function danhDauTuNgay(pool, ngay, lyDo) {
  const bd = thangTuNgay(ngay) || thangHienTai();
  const ht = thangHienTai();
  const iBd = soThang(bd.nam, bd.thang), iHt = soThang(ht.nam, ht.thang);
  const lo = Math.max(iBd, iHt - (TOI_DA_THANG - 1)), hi = Math.max(iHt, iBd);
  const ds = [];
  for (let i = lo; i <= hi; i++) ds.push(tuSoThang(i));
  return danhDauNhieu(pool, ds, lyDo);
}

/* ---------- mốc cờ của một tháng ---------- */
/* Đọc TRƯỚC khi tính (tự động hay bấm tay). Không ném: lỗi đọc ⇒ coi như không có cờ. */
async function docMoc(pool, nam, thang) {
  try {
    const o = muc(await docBanDo(pool), khoaThang(nam, thang));
    return { can: !!o.can, lan: Number(o.lan) || 0, luc: o.luc || null,
      lyDo: Array.isArray(o.lyDo) ? o.lyDo.slice() : [], lanCuoi: o.lanCuoi || null };
  } catch (e) { return { can: false, lan: 0, luc: null, lyDo: [], lanCuoi: null }; }
}
/* Ghi nhận SAU khi tính xong (cach = 'tuDong' | 'tay'): xóa cờ nếu không có biến động mới trong lúc
   tính (so `lan` với mốc đã đọc), lưu "lần tính gần nhất" để màn hình nói. Trả về lanCuoi; không ném. */
async function ghiNhanDaTinh(pool, nam, thang, kq, moc, cach) {
  const k = khoaThang(nam, thang);
  const lanCuoi = { luc: bayGio(), cach: cach === 'tay' ? 'tay' : 'tuDong', lyDo: (moc && moc.lyDo) || [],
    soNhanVien: Number(kq && kq.soNhanVien) || 0,
    soThieuHopDong: ((kq && kq.thieuHopDong) || []).length, soCanhBao: ((kq && kq.canhBao) || []).length };
  try {
    await tuanTu(async () => {
      const banDo = await docBanDo(pool);
      const m = muc(banDo, k);
      if ((Number(m.lan) || 0) === ((moc && moc.lan) || 0)) { m.can = false; m.lyDo = []; }   // không có biến động mới trong lúc tính
      m.lanCuoi = lanCuoi;
      banDo[k] = m;
      await ghiBanDo(pool, banDo);
    });
  } catch (e) { console.warn('[bangLuongTuDong ghiNhanDaTinh] ' + e.message); }
  return lanCuoi;
}

/* ---------- tính lại lúc xem ---------- */
const dangTinh = new Map();   // 'yyyy-mm' → promise: hai người mở cùng lúc thì chờ chung MỘT lần tính
async function tinhLaiNeuCan(pool, nam, thang, userId) {
  nam = parseInt(nam, 10); thang = parseInt(thang, 10);
  if (!nam || !thang || thang < 1 || thang > 12) return { daTinhLai: false };
  const k = khoaThang(nam, thang);
  if (dangTinh.has(k)) return dangTinh.get(k);
  const p = (async () => {
    let moc = { can: false, lan: 0, luc: null, lyDo: [], lanCuoi: null };
    try {
      moc = await docMoc(pool, nam, thang);
      const header = (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang)
        .query(`SELECT BangLuongID, TrangThai FROM BangLuong WHERE Nam=@n AND Thang=@t AND Loai=N'CongNhat'`)).recordset[0];
      const daChot = !!header && String(header.TrangThai || '').trim() === 'Đã chốt';
      const ht = thangHienTai(), tr = thangTruoc(ht);
      const ganDay = (nam === ht.nam && thang === ht.thang) || (nam === tr.nam && thang === tr.thang);
      let can = moc.can;
      /* Tháng này / tháng trước chưa có bảng ⇒ tạo lần đầu, không bắt bấm nút. Tháng cũ hơn chưa từng
         có bảng thì KHÔNG tự tạo (ai mở xem T3 năm ngoái không nên vô tình sinh một bảng lương). */
      if (!can && !header && ganDay) { can = true; moc.lyDo = ['Chưa có bảng lương tháng này — tạo lần đầu']; }
      if (!can) return { daTinhLai: false, lanCuoi: moc.lanCuoi };
      if (!header && !ganDay) return { daTinhLai: false, chuaCoBang: true, lyDo: moc.lyDo, luc: moc.luc, lanCuoi: moc.lanCuoi };
      if (daChot) return { daTinhLai: false, daChot: true, lyDo: moc.lyDo, luc: moc.luc, lanCuoi: moc.lanCuoi };

      const payroll = require('../routes/payroll');   // nạp muộn: payroll.js require file này ở đầu
      const kq = await payroll.tinhBangLuongThang(pool, nam, thang, userId == null ? null : userId);
      const lanCuoi = await ghiNhanDaTinh(pool, nam, thang, kq, moc, 'tuDong');
      return { daTinhLai: true, luc: lanCuoi.luc, lyDo: moc.lyDo, lanCuoi, ketQua: kq };
    } catch (e) {
      if (e && e.daChot) return { daTinhLai: false, daChot: true, lyDo: moc.lyDo, luc: moc.luc, lanCuoi: moc.lanCuoi };
      console.error('[bangLuongTuDong tinhLaiNeuCan ' + k + '] ' + (e && e.message));
      return { daTinhLai: false, loi: String((e && e.message) || e), lyDo: moc.lyDo, lanCuoi: moc.lanCuoi };   // cờ GIỮ nguyên
    } finally { dangTinh.delete(k); }
  })();
  dangTinh.set(k, p);
  return p;
}

module.exports = { KHOA, danhDau, danhDauNhieu, danhDauTheoNgay, danhDauGanDay, danhDauTuNgay,
  docMoc, ghiNhanDaTinh, tinhLaiNeuCan,
  thangTuNgay, thangTruLuong, thangHienTai, thangTruoc, ddmmyyyy, bayGio, docBanDo };
