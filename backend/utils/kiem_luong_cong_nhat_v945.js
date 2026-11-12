/* ================================================================================================
   kiem_luong_cong_nhat_v945.js — bo tu kiem cho v9.45 (luong cong nhat theo bang THUC TE T10/2026)

   🔴 PHEP QUAN TRONG NHAT: chay THAT bo tinh `tinhLuongV945` tren DUNG 47 dong cua file
   `Thang 10.2026.xlsx` (2 sheet) voi thong so suy tu file, roi so TUNG KHOAN voi so trong file.
   Khong so chuoi, khong doan: lech dong nao la cong thuc giai ma SAI dong do.

   Nhung cho CO Y khac file (Nguyen chot 11/11 — khong phai loi):
     · OT: mot cong thuc cho moi nguoi = muc gio x 1,5 x gio OT. File dung 4 ty le lan lon (1/6, 0,15,
       0,13, 0,10) va he so 1,0 o sheet 2 => dong CO OT thi: cac khoan KHONG-OT phai khop file,
       con tien OT + thuc linh kiem theo cong thuc MOI.
     · Cong chuan: MOT so cho ca thang. Sheet 1 chia 26, sheet 2 chia 27. O day sheet 1 chay CC=26,
       sheet 2 chay CC=27 de kiem cong thuc; khi chay that voi mot CC thi KPI cua Soan/Duyen doi.
     · Lam tron thuc linh: sheet 1 lam tron nghin, sheet 2 KHONG. Gop mot bang (Nguyen chot) thi
       mot cau hinh LamTronThucLinh cho ca hai. O day sheet 2 chay lamTron=1 de so DUNG DONG.
     · Khoan thang (KPI, chuc vu) chan tren 1 x muc thang: Hop 31 cong/26 nhan dung 500k nhu file;
       Duyen 27/26 ve 500k (file 519.231). GIA DINH cua toi — ghi o bao cao ban giao.
     · Lan KTT: KPI 8tr du 26,5/27 cong — file khong theo cong thuc => dung o "tien ghi de".
     · Sam: thu viec 70% (829.630 = 8tr/27 x 4 x 0,7), khong phai 85% => khai TyLeThuViec o hop dong.
     · 4 nguoi luong khoan (Phuong/May/Hung trai vai, Vuong chan de) file ep Thanh tien = 0 bang
       cach go Tong vao cot BH — KHONG dua vao bo kiem (ho ra khoi bang cong nhat).

   Chay:  node backend\utils\kiem_luong_cong_nhat_v945.js
   KHONG copy file nay sang D:\QLSX. KHONG dung toi CSDL.
   ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const doc = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8') : '';
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}
const fmt = (n) => Number(n).toLocaleString('vi-VN');
const bang = (a, b) => Math.abs(Number(a) - Number(b)) < 0.5;
const r0 = (n) => Math.round(n);
const lamTronNghin = (n) => Math.round(n / 1000) * 1000;

console.log('\n=== 1. BIEN DICH (vm.Script, khong chay) ===');
[['backend/utils/luongCongNhat.js'], ['backend/routes/payroll.js'], ['backend/routes/hrm.js'],
 ['frontend/js/module.payroll.js'], ['frontend/js/module.hrm.js'], ['frontend/js/module.mypay.js']].forEach(([f]) => {
  const s = doc(...f.split('/'));
  if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

const { tinhLuongV945, gomChamCong } = require('./luongCongNhat');

/* Cau hinh nhu CauHinhLuong sau migration_v890 (BH 8/1,5/1; OT 1,5; KHONG tru thue; lam tron nghin). */
const CFG = { BhxhNld: 8, BhytNld: 1.5, BhtnNld: 1, GioChuanNgay: 8, HsTangCaThuong: 1.5,
  GiamTruBanThan: 15500000, GiamTruNPT: 6200000, TruThueTNCN: false, TyLeThuViec: 85,
  LamTronThucLinh: 1000, DiMuonChamChuocPhut: 5 };
const BAC_THUE = [
  { TuMuc: 0, DenMuc: 5000000, ThueSuat: 0.05, TruDi: 0 }, { TuMuc: 5000000, DenMuc: 10000000, ThueSuat: 0.10, TruDi: 250000 },
  { TuMuc: 10000000, DenMuc: 18000000, ThueSuat: 0.15, TruDi: 750000 }, { TuMuc: 18000000, DenMuc: 32000000, ThueSuat: 0.20, TruDi: 1650000 },
  { TuMuc: 32000000, DenMuc: null, ThueSuat: 0.25, TruDi: 3250000 }];

/* ================================================================================================
   2. SHEET 1 — "LUONG CONG NHAT T10/2026", 36 nguoi, luong NGAY, cong chuan 26 (KPI ke toan /26)
   Cot: ten, dg = luong ngay, tong = Tong tien (file), ot = tien lam them (file), gioOT, kpi, xang,
        cc = chuyen can, tu = tam ung, bh = muc dong BH (suy tu tien BH: 840k=8tr, 630k=6tr,
        584k=5,56tr, 558k=5,31tr), tt = Thanh tien (file), codinh = luong co dinh thang,
        dc = dieu chinh tay, tn = phu cap trach nhiem (Hop "TN, KPI" 500k co dinh).
   So ngay KHONG lay o cot "So ngay LV" (file hien 2 chu so le, that nhieu hon — Ngoc 21,33 that ra
   21,3333) ma SUY NGUOC: (Tong − OT − KPI − xang − CC) ÷ don gia, de phep so luong dung den dong.
   ================================================================================================ */
const S1 = [
  { ten: 'Soan - Ke toan', dg: 500000, tong: 12201923, ot: 0, gioOT: 0, kpi: 451923, xang: 0, cc: 0, tu: 3120000, bh: 8000000, tt: 8242000, quyKPI: 500000 },
  { ten: 'Duyen - Ke toan', dg: 450000, tong: 12669231, ot: 0, gioOT: 0, kpi: 519231, xang: 0, cc: 0, tu: 0, bh: 8000000, tt: 11829000, quyKPI: 500000, kpiChan: 500000, ttChan: 11810000 },
  { ten: 'Giang - Sale', dg: 385000, tong: 10395000, ot: 0, gioOT: 0, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 5560000, tt: 9811000 },
  { ten: 'Linh - TK anh', dg: 450000, tong: 12150000, ot: 0, gioOT: 0, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 5560000, tt: 11566000 },
  { ten: 'Hoai - TL', dg: 385000, tong: 10318000, ot: 0, gioOT: 0, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 6000000, tt: 9688000 },
  { ten: 'C Hue - Quan ly chuyen', dg: 536000, tong: 15544000, ot: 0, gioOT: 0, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 6000000, tt: 14914000 },
  { ten: 'Chu Yen - Lai xe', dg: 430000, tong: 11610000, ot: 0, gioOT: 0, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 11610000 },
  { ten: 'Hong - Kho', dg: 385000, tong: 10281765, ot: 0, gioOT: 0, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 5560000, tt: 9698000 },
  { ten: 'Hop - Kho', dg: 357000, tong: 12116900, ot: 249900, gioOT: 7, kpi: 500000, xang: 0, cc: 300000, tu: 0, bh: 5310000, tt: 11559000, tn: 500000, ccMuc: 300000 },
  { ten: 'Lan Anh - Kho', dg: 500000, tong: 13885621, ot: 0, gioOT: 0, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 13886000 },
  { ten: 'A Cong - Cat (0 cong)', dg: 470000, tong: 0, ot: 0, gioOT: 0, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 0 },
  { ten: 'C Nhung - To cat', dg: 330000, tong: 9642500, ot: 27500, gioOT: 0.5, kpi: 0, xang: 405000, cc: 300000, tu: 0, bh: 5310000, tt: 9085000, xangNgay: 15000, ccMuc: 300000 },
  // 13-15 Phuong / May / Hung trai vai: luong khoan — BO
  { ten: 'Quoc - La', dg: 300000, tong: 8399167, ot: 832500, gioOT: 18.5, kpi: 0, xang: 0, cc: 0, tu: 4000000, bh: 0, tt: 4399000 },
  { ten: 'O Tam - Nau an (co dinh 10tr)', dg: 335000, tong: 10000000, ot: 0, gioOT: 0, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 10000000, codinh: 10000000, ngay: 31 },
  { ten: 'Hang be - Phu', dg: 280000, tong: 8008000, ot: 168000, gioOT: 4, kpi: 0, xang: 0, cc: 0, tu: 1600000, bh: 0, tt: 6408000 },
  { ten: 'C Huong (0 cong, chuyen khoan)', dg: 230000, tong: 0, ot: 0, gioOT: 0, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 0 },
  { ten: 'Co Lan - La', dg: 240000, tong: 7940000, ot: 420000, gioOT: 10.5, kpi: 0, xang: 0, cc: 200000, tu: 0, bh: 0, tt: 7940000, ccMuc: 200000 },
  { ten: 'Co Loan', dg: 210000, tong: 6020000, ot: 0, gioOT: 0, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 6020000 },
  { ten: 'Co Dau', dg: 210000, tong: 5390000, ot: 140000, gioOT: 4, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 5390000 },
  { ten: 'Co Van', dg: 200000, tong: 5911111, ot: 133333, gioOT: 4, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 5911000 },
  { ten: 'Hien - Phu', dg: 200000, tong: 5155556, ot: 400000, gioOT: 12, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 5156000 },
  { ten: 'Khanh - Phu', dg: 200000, tong: 5877778, ot: 133333, gioOT: 4, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 5878000 },
  { ten: 'Mai - Phu', dg: 240000, tong: 7200000, ot: 360000, gioOT: 9, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 7200000 },
  { ten: 'Ngoc - La (dieu chinh -200k)', dg: 230000, tong: 4983333, ot: 76667, gioOT: 2, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 4783000, dc: -200000 },
  { ten: 'Phuong - May CN', dg: 250000, tong: 5565278, ot: 162500, gioOT: 5, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 5565000 },
  // 29 Vuong chan de: luong khoan — BO
  { ten: 'Tho 1 kim', dg: 280000, tong: 8302000, ot: 182000, gioOT: 5, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 8302000 },
  { ten: 'Cuong chan de', dg: 300000, tong: 8517000, ot: 117000, gioOT: 3, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 8517000 },
  { ten: 'C Lieu KCS', dg: 270000, tong: 7155000, ot: 1080000, gioOT: 24, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 7155000 },
  { ten: 'C Nghia Phu', dg: 270000, tong: 8482500, ot: 1597500, gioOT: 35.5, kpi: 0, xang: 0, cc: 0, tu: 3000000, bh: 0, tt: 5483000 },
  { ten: 'Lien - 1 kim', dg: 250000, tong: 6060049, ot: 187500, gioOT: 4.5, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 6060000 },
  { ten: 'C Mai may moi', dg: 280000, tong: 1120000, ot: 0, gioOT: 0, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 1120000 },
  { ten: 'Thuy - phu', dg: 200000, tong: 5400000, ot: 0, gioOT: 0, kpi: 0, xang: 0, cc: 0, tu: 0, bh: 0, tt: 5400000 }
];
const CC1 = 26;

console.log('\n=== 2. SHEET 1 — 32 nguoi luong NGAY (bo 4 nguoi luong khoan), CC=26 ===');
let khopThucLinh1 = 0, dongKhongOT = 0;
S1.forEach(r => {
  const nonOT = r.tong - r.ot;                                   // phan KHONG phu thuoc cong thuc OT
  const ngay = r.ngay != null ? r.ngay : (r.dg > 0 ? (nonOT - r.kpi - r.xang - r.cc) / r.dg : 0);
  const e = {
    KieuLuong: 'Ngay', DonGiaNgay: r.dg, LuongCoDinhThang: r.codinh || 0, MucDongBH: r.bh,
    QuyKPI: r.quyKPI || 0, KieuThuong: r.quyKPI ? 'KPI' : null, diemKPI: r.quyKPI ? 100 : null,
    PhuCapChucVu: r.tn || 0, PhuCapChuyenCan: r.ccMuc || 0,
    PhuCapXangXe: r.xangNgay ? r.xangNgay * CC1 : 0, SoCongXangXe: r.xangNgay ? CC1 : 0,
    congThuViec: 0, congChinhThuc: ngay, congLe: 0, soPhep: 0, soNgayMuon: 0, gioOT: r.gioOT, conThuViec: false,
    tamUng: r.tu, dieuChinh: r.dc || 0
  };
  const c = tinhLuongV945(e, CFG, CC1, BAC_THUE);
  const loi = [];
  // Luong = don gia x ngay (lam tron dong) — O Tam ghi de 10tr
  const luongFile = r.codinh ? r.codinh : r0(r.dg * ngay);
  if (!bang(c.luongNgayCong, luongFile)) loi.push(`luong ${fmt(c.luongNgayCong)} ≠ ${fmt(luongFile)}`);
  // KPI / TN / xang / chuyen can
  const kpiMong = r.kpiChan != null ? r.kpiChan : r.kpi;
  if (!bang(c.thuong + c.pcChucVu, kpiMong)) loi.push(`KPI+TN ${fmt(c.thuong + c.pcChucVu)} ≠ ${fmt(kpiMong)}`);
  if (!bang(c.pcXangXe, r.xang)) loi.push(`xang ${fmt(c.pcXangXe)} ≠ ${fmt(r.xang)}`);
  if (!bang(c.chuyenCan, r.cc)) loi.push(`chuyen can ${fmt(c.chuyenCan)} ≠ ${fmt(r.cc)}`);
  // BH = 10,5% muc dong (file lam tron tay len nghin: 583.800 -> 584k; lech < 500d chap nhan vi thuc linh lam tron nghin)
  if (!bang(c.tongBH, r0(r.bh * 0.105))) loi.push(`BH ${fmt(c.tongBH)} ≠ ${fmt(r0(r.bh * 0.105))}`);
  if (c.thueDaTru) loi.push('thue bi TRU du cong tac tat');
  if (!bang(c.tamUng, r.tu)) loi.push(`tam ung ${fmt(c.tamUng)} ≠ ${fmt(r.tu)}`);
  // OT: cong thuc MOI (Nguyen chot) = don gia ngay / 8 x 1,5 x gio
  const otMoi = r0(r.gioOT * (r.dg / 8) * 1.5);
  if (!bang(c.tangCa, otMoi)) loi.push(`OT ${fmt(c.tangCa)} ≠ cong thuc moi ${fmt(otMoi)}`);
  // Thuc linh: dong KHONG OT phai = file; dong co OT = lam tron nghin(nonOT + OT moi − TU − BH + DC)
  const ttMong = r.gioOT === 0
    ? (r.ttChan != null ? r.ttChan : r.tt)
    : lamTronNghin(luongFile + kpiMong + r.xang + r.cc + otMoi - r.tu - r0(r.bh * 0.105) + (r.dc || 0));
  if (!bang(c.thucLinh, ttMong)) loi.push(`THUC LINH ${fmt(c.thucLinh)} ≠ ${fmt(ttMong)}`);
  if (r.gioOT === 0) { dongKhongOT++; if (bang(c.thucLinh, ttMong)) khopThucLinh1++; }
  kiem(`${r.ten}: ${r.gioOT ? 'khoan khong-OT khop file, OT theo cong thuc moi = ' + fmt(otMoi) : 'thuc linh = file ' + fmt(r.tt)}${r.ttChan != null ? ' (CHAN KPI: ' + fmt(r.ttChan) + ')' : ''}`,
    !loi.length, loi.join('; '));
});
kiem(`Sheet 1: ${khopThucLinh1}/${dongKhongOT} dong KHONG co OT khop thuc linh file den dong (tru Duyen chan KPI)`, khopThucLinh1 === dongKhongOT);
kiem('Tong tam ung sheet 1 = 11.720.000 (file ghi dong tong 8.720.000 — THIEU 3tr, loi Excel #1 trong PRD)',
  S1.reduce((s, r) => s + r.tu, 0) === 11720000);

/* ================================================================================================
   3. SHEET 2 — "BANG LUONG CONG NHAT THANG 10/2026", 11 nguoi, luong THANG, CC=27, KHONG lam tron
   ================================================================================================ */
console.log('\n=== 3. SHEET 2 — 11 nguoi luong THANG, CC=27, lamTron=1 ===');
const CFG2 = Object.assign({}, CFG, { LamTronThucLinh: 1 });
const CC2 = 27;
const S2 = [
  { ten: 'Lan - KTT (1 phep, KPI ghi de 8tr)', cb: 10000000, tv: 16, ct: 9.5, phep: 1, gioOT: 0, quyKPI: 8000000, ghiDe: 8000000, xangNgay: 20000, chucVu: 2000000, ccMuc: 500000, bh: 0,
    mong: { luong: 8555556, thuong: 8000000, xang: 520000, chucVu: 1962963, cc: 0, bh: 0, tt: 19038519 } },
  { ten: 'Huong - HCNS (dong BH 7tr)', cb: 7000000, tv: 7, ct: 20, phep: 0, gioOT: 0, quyKPI: 2000000, xangNgay: 30000, chucVu: 0, ccMuc: 500000, bh: 7000000,
    mong: { luong: 6727778, thuong: 2000000, xang: 810000, chucVu: 0, cc: 500000, bh: 735000, tt: 9302778 } },
  { ten: 'Thinh - KHSX', cb: 7000000, tv: 18, ct: 9, phep: 0, gioOT: 0, quyKPI: 4000000, xangNgay: 20000, chucVu: 0, ccMuc: 500000, bh: 0,
    mong: { luong: 6300000, thuong: 4000000, xang: 540000, chucVu: 0, cc: 500000, bh: 0, tt: 11340000 } },
  { ten: 'Ngoc - Ky thuat (BH 8tr, khong chuyen can)', cb: 8000000, tv: 0, ct: 27, phep: 0, gioOT: 0, quyKPI: 7000000, xangNgay: 20000, chucVu: 0, ccMuc: 0, bh: 8000000,
    mong: { luong: 8000000, thuong: 7000000, xang: 540000, chucVu: 0, cc: 0, bh: 840000, tt: 14700000 } },
  { ten: 'Yen - Ky thuat', cb: 5400000, tv: 0, ct: 27, phep: 0, gioOT: 0, quyKPI: 500000, xangNgay: 20000, chucVu: 0, ccMuc: 500000, bh: 0,
    mong: { luong: 5400000, thuong: 500000, xang: 540000, chucVu: 0, cc: 500000, bh: 0, tt: 6940000 } },
  { ten: 'Xuan - Ky thuat (6 ngay thu viec)', cb: 8000000, tv: 6, ct: 0, phep: 0, gioOT: 0, quyKPI: 4000000, xangNgay: 30000, chucVu: 0, ccMuc: 500000, bh: 0,
    mong: { luong: 1511111, thuong: 888889, xang: 180000, chucVu: 0, cc: 0, bh: 0, tt: 2580000 } },
  { ten: 'Huong - Media (thuong SP 247 anh x 20k)', cb: 7000000, tv: 23, ct: 0, phep: 0, gioOT: 0, sanPham: 4940000, xangNgay: 20000, chucVu: 0, ccMuc: 500000, bh: 0,
    mong: { luong: 5068519, thuong: 4940000, xang: 460000, chucVu: 0, cc: 0, bh: 0, tt: 10468519 } },
  { ten: 'Thanh - Kho (27 ngay thu viec, chuc vu 1tr)', cb: 8000000, tv: 27, ct: 0, phep: 0, gioOT: 0, xangNgay: 20000, chucVu: 1000000, ccMuc: 300000, bh: 0,
    mong: { luong: 6800000, thuong: 0, xang: 540000, chucVu: 1000000, cc: 300000, bh: 0, tt: 8640000 } },
  { ten: 'Ha - May mau', cb: 8000000, tv: 24, ct: 0, phep: 0, gioOT: 0, quyKPI: 3000000, xangNgay: 20000, chucVu: 0, ccMuc: 500000, bh: 0,
    mong: { luong: 6044444, thuong: 2666667, xang: 480000, chucVu: 0, cc: 0, bh: 0, tt: 9191111 } },
  { ten: 'Loan - QC (thu viec, OT 11,5h)', cb: 5400000, tv: 19.5, ct: 0, phep: 0, gioOT: 11.5, conTV: true, quyKPI: 3000000, xangNgay: 20000, chucVu: 1600000, ccMuc: 500000, bh: 0,
    mong: { luong: 3315000, thuong: 2166667, xang: 400000, chucVu: 1155556, cc: 0, bh: 0, otFile: 244375, otMoi: 366563, dgGioOT: 31875 } },
  { ten: 'Sam - TK da nghi (thu viec 70%)', cb: 8000000, tv: 4, ct: 0, phep: 0, gioOT: 0, tyLeTV: 70, xangNgay: 0, chucVu: 0, ccMuc: 500000, bh: 0,
    mong: { luong: 829630, thuong: 0, xang: 0, chucVu: 0, cc: 0, bh: 0, tt: 829630 } }
];
let khop2 = 0;
S2.forEach(r => {
  const e = {
    KieuLuong: 'Thang', LuongCoBan: r.cb, MucDongBH: r.bh, TyLeThuViec: r.tyLeTV || null,
    QuyKPI: r.quyKPI || 0, KieuThuong: r.sanPham ? 'SanPham' : (r.quyKPI ? 'KPI' : null),
    diemKPI: r.quyKPI ? 100 : null, tienKPIGhiDe: r.ghiDe != null ? r.ghiDe : null, thuongSanPham: r.sanPham || 0,
    PhuCapChucVu: r.chucVu, PhuCapChuyenCan: r.ccMuc,
    PhuCapXangXe: r.xangNgay * CC2, SoCongXangXe: CC2,
    congThuViec: r.tv, congChinhThuc: r.ct, congLe: 0, soPhep: r.phep, soNgayMuon: 0, gioOT: r.gioOT, conThuViec: !!r.conTV,
    tamUng: 0, dieuChinh: 0
  };
  const c = tinhLuongV945(e, CFG2, CC2, BAC_THUE);
  const m = r.mong, loi = [];
  if (!bang(c.luongNgayCong, m.luong)) loi.push(`luong ${fmt(c.luongNgayCong)} ≠ ${fmt(m.luong)}`);
  if (!bang(c.thuong, m.thuong)) loi.push(`thuong ${fmt(c.thuong)} ≠ ${fmt(m.thuong)}`);
  if (!bang(c.pcXangXe, m.xang)) loi.push(`xang ${fmt(c.pcXangXe)} ≠ ${fmt(m.xang)}`);
  if (!bang(c.pcChucVu, m.chucVu)) loi.push(`chuc vu ${fmt(c.pcChucVu)} ≠ ${fmt(m.chucVu)}`);
  if (!bang(c.chuyenCan, m.cc)) loi.push(`chuyen can ${fmt(c.chuyenCan)} ≠ ${fmt(m.cc)}`);
  if (!bang(c.tongBH, m.bh)) loi.push(`BH ${fmt(c.tongBH)} ≠ ${fmt(m.bh)}`);
  if (m.tt != null) {
    if (!bang(c.thucLinh, m.tt)) loi.push(`THUC NHAN ${fmt(c.thucLinh)} ≠ ${fmt(m.tt)}`);
    else khop2++;
  } else {
    if (!bang(c.tangCa, m.otMoi)) loi.push(`OT moi ${fmt(c.tangCa)} ≠ ${fmt(m.otMoi)} (file ${fmt(m.otFile)} he so 1,0)`);
    if (!bang(c.donGiaGioOT, m.dgGioOT)) loi.push(`don gia gio OT ${c.donGiaGioOT} ≠ ${m.dgGioOT} (25.000 x 1,5 x 0,85)`);
    const ttMoi = m.luong + m.thuong + m.otMoi + m.xang + m.chucVu + m.cc - m.bh;
    if (!bang(c.thucLinh, ttMoi)) loi.push(`thuc nhan ${fmt(c.thucLinh)} ≠ ${fmt(ttMoi)}`);
  }
  kiem(`${r.ten}: ${m.tt != null ? 'thuc nhan = file ' + fmt(m.tt) : 'khoan khong-OT khop, OT moi ' + fmt(m.otMoi)}`, !loi.length, loi.join('; '));
});
kiem(`Sheet 2: ${khop2}/10 dong khong OT khop Thuc nhan file DEN DONG (Loan co OT kiem rieng)`, khop2 === 10);
/* Excel cong cac o CHUA lam tron (Loan 7.281.597,22; Ha 9.191.111,11…) nen dong tong file 100.312.153
   lech 1đ so voi tong cac o da hien — cho phep ±2đ. */
kiem('Sheet 2 tong file 100.312.153 = tong 11 dong ±2đ (Loan lay so file 7.281.597)',
  Math.abs(S2.reduce((s, r) => s + (r.mong.tt != null ? r.mong.tt : 7281597), 0) - 100312153) <= 2);

/* ================================================================================================
   4. LUAT RIENG — moi luat mot phep, doi mot bien, nhin mot so doi
   ================================================================================================ */
console.log('\n=== 4. LUAT RIENG ===');
const goc = { KieuLuong: 'Thang', LuongCoBan: 8100000, MucDongBH: 0, QuyKPI: 2700000, KieuThuong: 'KPI', diemKPI: 100,
  PhuCapChuyenCan: 500000, PhuCapChucVu: 0, PhuCapXangXe: 540000, SoCongXangXe: 27,
  congThuViec: 0, congChinhThuc: 27, congLe: 0, soPhep: 0, soNgayMuon: 0, gioOT: 0, conThuViec: false, tamUng: 0, dieuChinh: 0 };
const T = (them, cfg, cc) => tinhLuongV945(Object.assign({}, goc, them), cfg || CFG2, cc || 27, BAC_THUE);
{
  const a = T({});
  kiem('du 27 cong, khong phep, khong muon => chuyen can 500k', a.chuyenCan === 500000 && a.duChuyenCan === true);
  kiem('1 ngay PHEP => mat chuyen can (Lan KTT)', T({ congChinhThuc: 26, soPhep: 1 }).chuyenCan === 0);
  kiem('du cong nhung DI MUON 1 ngay => mat chuyen can (Nguyen: "không đi muộn")', T({ soNgayMuon: 1 }).chuyenCan === 0);
  kiem('thieu cong (26/27) => mat chuyen can', T({ congChinhThuc: 26 }).chuyenCan === 0);
  kiem('le huong luong (LT) tinh vao cong chuyen can: 26 CT + 1 LT = du', T({ congChinhThuc: 26, congLe: 1 }).chuyenCan === 500000);
  kiem('phep KHONG huong luong: 26 CT + 1 phep => luong = 8,1tr/27 x 26', bang(T({ congChinhThuc: 26, soPhep: 1 }).luongNgayCong, 7800000));
  kiem('le huong NGUYEN luong: 26 CT + 1 LT => luong = 8,1tr', bang(T({ congChinhThuc: 26, congLe: 1 }).luongNgayCong, 8100000));
  kiem('xang: phep KHONG tinh (26 di lam + 1 phep => 20k x 26)', T({ congChinhThuc: 26, soPhep: 1 }).pcXangXe === 520000);
  kiem('xang: lam tron nua len (25,5 ngay => 26 ngay)', T({ congChinhThuc: 25.5 }).pcXangXe === 520000);
  kiem('KPI: chua cham => thuong 0 + co chuaDanhGiaKPI (khong bia 100 diem)', (() => { const x = T({ diemKPI: null }); return x.thuong === 0 && x.chuaDanhGiaKPI === true; })());
  kiem('KPI 50 diem => nua quy', T({ diemKPI: 50 }).thuong === 1350000);
  kiem('KPI diem 120 bi chan 100', T({ diemKPI: 120 }).thuong === 2700000);
  kiem('KPI prorate theo tong cong CO phep (26 + 1 phep = 27/27 => du)', T({ congChinhThuc: 26, soPhep: 1 }).thuong === 2700000);
  kiem('KPI chan tren: 31 cong / CC 27 => dung quy, khong x 31/27', T({ congChinhThuc: 31 }).thuong === 2700000);
  kiem('KPI tien ghi de thang diem', T({ diemKPI: 10, tienKPIGhiDe: 999000 }).thuong === 999000);
  kiem('thuong SAN PHAM = tong SL x don gia, KHONG prorate (6 ngay van nhan du)', T({ KieuThuong: 'SanPham', thuongSanPham: 4940000, congChinhThuc: 6 }).thuong === 4940000);
  kiem('khong khai KieuThuong => thuong 0 du co QuyKPI', T({ KieuThuong: null }).thuong === 0);
  kiem('luong co dinh thang ghi de phan LUONG, khoan khac van theo cong', (() => { const x = T({ LuongCoDinhThang: 10000000, congChinhThuc: 31 }); return x.luongNgayCong === 10000000 && x.pcXangXe === 620000; })());
  kiem('BH tren MUC DONG, khong tren luong: 5,56tr => 583.800', T({ MucDongBH: 5560000 }).tongBH === 583800);
  kiem('BH: muc dong trong => 0 du luong 8,1tr', T({ MucDongBH: 0 }).tongBH === 0);
  kiem('thu viec: ty le hop dong (70) thang cau hinh (85)', bang(T({ congThuViec: 4, congChinhThuc: 0, TyLeThuViec: 70 }).luongNgayCong, 840000));
  kiem('thu viec: hop dong trong => cau hinh 85', bang(T({ congThuViec: 4, congChinhThuc: 0 }).luongNgayCong, 1020000));
  kiem('OT kieu Thang: 8,1tr/27/8 = 37.500/h x 1,5 => 56.250/h; 10h = 562.500', (() => { const x = T({ gioOT: 10 }); return x.donGiaGioOT === 56250 && x.tangCa === 562500; })());
  kiem('OT con thu viec x 0,85 (Loan)', T({ gioOT: 10, conThuViec: true }).tangCa === r0(10 * 37500 * 1.5 * 0.85));
  kiem('OT he so lay tu cfg.HsTangCaThuong (2.0 => 75.000/h)', T({ gioOT: 1 }, Object.assign({}, CFG2, { HsTangCaThuong: 2 })).tangCa === 75000);
  kiem('OT kieu Ngay: 300k/8 x 1,5 = 56.250/h (Quoc)', T({ KieuLuong: 'Ngay', DonGiaNgay: 300000, gioOT: 1 }).tangCa === 56250);
  const kThue = { KieuLuong: 'Thang', LuongCoBan: 40000000, QuyKPI: 0, KieuThuong: null, PhuCapChuyenCan: 0, PhuCapXangXe: 0, SoCongXangXe: 0 };
  const tTat = T(kThue), tBat = T(kThue, Object.assign({}, CFG2, { TruThueTNCN: true }));
  kiem('thue TNCN van TINH khi cong tac tat (40tr => thue > 0)', tTat.thue > 0 && tTat.thueDaTru === false);
  kiem('cong tac tat: thuc linh KHONG tru thue', tTat.thucLinh === 40000000);
  kiem('cong tac bat: thuc linh tru dung so thue da tinh', tBat.thueDaTru === true && tBat.thucLinh === 40000000 - tBat.thue && tBat.thue === tTat.thue);
  kiem('cong tac nhan ca bit SQL (1) lan boolean', T(kThue, Object.assign({}, CFG2, { TruThueTNCN: 1 })).thueDaTru === true);
  kiem('lam tron thuc linh theo cau hinh (1000): 8.241.923 => 8.242.000', T({ KieuLuong: 'Ngay', DonGiaNgay: 500000, congChinhThuc: 23.5, QuyKPI: 500000, diemKPI: 100, tamUng: 3120000, MucDongBH: 8000000, PhuCapChuyenCan: 0, PhuCapXangXe: 0 }, Object.assign({}, CFG2, { LamTronThucLinh: 1000 }), 26).thucLinh === 8242000);
  kiem('dieu chinh am di thang vao thuc linh (Ngoc -200k)', T({ dieuChinh: -200000 }).thucLinh === T({}).thucLinh - 200000);
  kiem('tam ung lon hon luong => thuc linh AM (khong chan ve 0 — de man hinh canh bao)', T({ tamUng: 50000000 }).thucLinh < 0);
}

/* ================================================================================================
   5. GOM CHAM CONG — phan tach TV/CT theo ngay, phep/le/khong luong, di muon co cham chuoc
   ================================================================================================ */
console.log('\n=== 5. gomChamCong ===');
{
  const rows = [
    { ngay: '2026-10-01', maCham: 'X', soCong: 1, gioVao: '07:58', gioOT: 1.5 },
    { ngay: '2026-10-02', maCham: 'X', soCong: 1, gioVao: '08:04', gioOT: 0 },     // tre 4' < 5' cham chuoc: KHONG muon
    { ngay: '2026-10-15', maCham: 'X', soCong: 0.5, gioVao: '08:06', gioOT: 0 },   // tre 6' > 5': MUON; dung moc TV (<=)
    { ngay: '2026-10-16', maCham: 'X', soCong: 1, gioVao: '09:30', gioOT: 2 },     // sau moc: chinh thuc; MUON
    { ngay: '2026-10-17', maCham: 'P', soCong: 1, gioVao: null, gioOT: 0 },        // phep
    { ngay: '2026-10-18', maCham: 'LT', soCong: 1, gioVao: null, gioOT: 0 },       // le huong luong
    { ngay: '2026-10-19', maCham: 'KL', soCong: 0, gioVao: null, gioOT: 0 },       // khong luong: khong gi
    { ngay: '2026-10-20', maCham: 'TS', soCong: 1, gioVao: null, gioOT: 0 },       // thai san: khong gi
    { ngay: '2026-10-21', maCham: 'X', soCong: 0, gioVao: '08:00', gioOT: 0.5 },   // 0 cong (ve som?) -> khong dem cong, OT van cong
    { ngay: '2026-10-22', maCham: 'X', soCong: 1, gioVao: null, gioOT: 0 }         // khong co gio vao (nhap tay): khong tinh muon
  ];
  const g = gomChamCong(rows, '2026-10-15', '08:00', 5);
  kiem('cong thu viec = 2,5 (01, 02, 15 — ngay = moc tinh la thu viec)', g.congThuViec === 2.5, JSON.stringify(g));
  kiem('cong chinh thuc = 2 (16, 22)', g.congChinhThuc === 2, JSON.stringify(g));
  kiem('phep = 1, le = 1', g.soPhep === 1 && g.congLe === 1);
  kiem('di muon = 2 (06\' va 09:30), 04\' duoc cham chuoc, khong gio vao khong tinh', g.soNgayMuon === 2);
  kiem('gio OT cong don = 4', g.gioOT === 4);
  const g2 = gomChamCong(rows, null, '08:00', 5);
  kiem('khong moc thu viec => tat ca la chinh thuc (4,5)', g2.congThuViec === 0 && g2.congChinhThuc === 4.5);
  const g3 = gomChamCong(rows, '2026-10-15', null, 5);
  kiem('khong cau hinh gio vao => khong ai bi tinh muon', g3.soNgayMuon === 0);
  kiem('rows rong => toan 0', JSON.stringify(gomChamCong([], null, '08:00', 5)) === JSON.stringify({ congThuViec: 0, congChinhThuc: 0, congLe: 0, soPhep: 0, soNgayMuon: 0, gioOT: 0 }));
}

/* ================================================================================================
   6. KHOP NOI — cac phep so chuoi, viet SAU CUNG, tren ban da dung yen. Loc comment truoc khi tim
   "KHONG chua" (quy tac bo kiem: da vap 7 lan).
   ================================================================================================ */
console.log('\n=== 6. KHOP NOI (chuoi) ===');
const boComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const fPayrollBE = doc('backend', 'routes', 'payroll.js'), fHrmBE = doc('backend', 'routes', 'hrm.js');
const fPayrollFE = doc('frontend', 'js', 'module.payroll.js'), fHrmFE = doc('frontend', 'js', 'module.hrm.js');
const html = doc('frontend', 'index.html');
const mig = doc('database', 'migration_v890.sql'), full = doc('database', 'CAI_DAT_DAY_DU.sql');
const codePayrollBE = boComment(fPayrollBE), codePayrollFE = boComment(fPayrollFE), codeHrmFE = boComment(fHrmFE);
kiem('payroll.js (BE) dung bo tinh moi tinhLuongV945', /tinhLuongV945\(/.test(codePayrollBE));
kiem('payroll.js (BE) KHONG con goi bo tinh cu tinhLuongCongNhat(', !/tinhLuongCongNhat\(/.test(codePayrollBE));
kiem('payroll.js (BE) tra thieuHopDong + canhBao + truThue', /thieuHopDong, canhBao, truThue/.test(codePayrollBE));
kiem('payroll.js (BE) giu DieuChinh qua lan tinh lai (doc truoc DELETE)', codePayrollBE.indexOf('dieuChinhCu') > -1 && codePayrollBE.indexOf('SELECT NhanVienID, DieuChinh, LyDoDieuChinh') < codePayrollBE.indexOf('DELETE FROM BangLuongChiTiet WHERE BangLuongID=@id'));
kiem('payroll.js (BE) co 3 route KPI voi requireChucNang(\'PAYROLL\', \'kpi\')', (codePayrollBE.match(/requireChucNang\('PAYROLL', 'kpi'\)/g) || []).length === 3);
kiem('payroll.js (BE) PUT /config luu 4 tham so v890 (probe cot, khong cache)', /COL_LENGTH\('CauHinhLuong','TruThueTNCN'\)/.test(codePayrollBE) && /TruThueTNCN=@TruThue/.test(codePayrollBE));
kiem('payroll.js (BE) chi tiet: dieu chinh khac 0 phai co ly do', /Điều chỉnh khác 0 thì PHẢI ghi lý do/.test(fPayrollBE));
kiem('payroll.js (BE) DELETE + INSERT chi tiet trong MOT giao dich (tran.begin/commit/rollback)',
  /const tran = new sql\.Transaction\(pool\);\s*await tran\.begin\(\);/.test(codePayrollBE) && /await tran\.commit\(\);/.test(codePayrollBE) && /await tran\.rollback\(\);/.test(codePayrollBE)
  && /new sql\.Request\(tran\)\.input\('id', sql\.Int, blId\)\.query\('DELETE FROM BangLuongChiTiet/.test(codePayrollBE));
kiem('payroll.js (BE) loc TrangThaiLaoDong bang ISNULL (NULL khong bi loai im lang) o ca /tinh lan /kpi', (codePayrollBE.match(/ISNULL\(nv\.TrangThaiLaoDong, N''\) <> N'Đã nghỉ việc'/g) || []).length >= 2);
kiem('payroll.js (BE) canh bao hop dong het han (DenNgay < dau thang) ma con Hieu luc', /String\(e\.DenNgay\) < dauThang/.test(codePayrollBE));
kiem('hrm.js (BE) bind 6 cot v890 + luu san pham hop dong', /bindHopDongV890\(/.test(boComment(fHrmBE)) && /luuSanPhamHopDong\(/.test(boComment(fHrmBE)));
kiem('hrm.js (BE) CHI ghi 6 cot v890 khi client co gui kieuLuong (JS cu khong ghi NULL de)', (boComment(fHrmBE).match(/const guiV890 = (b|req\.body)\.kieuLuong !== undefined;/g) || []).length === 2 && (boComment(fHrmBE).match(/const ghiV890 = coV890 && guiV890;/g) || []).length === 2);
kiem('hrm.js (BE) bao canhBao khi client gui ma may chu chua co cot', (fHrmBE.match(/CHƯA chạy migration_v890\.sql — hợp đồng đã lưu nhưng/g) || []).length === 2);
kiem('module.hrm.js hien canhBao cua may chu sau khi luu', /if \(kq && kq\.canhBao\) toast\(kq\.canhBao, 'error'\)/.test(codeHrmFE));
kiem('module.mypay.js: thue chi in dau tru khi ThueDaTru, co dong Dieu chinh, bump >= 9.45', (() => {
  const s = doc('frontend', 'js', 'module.mypay.js'), m = /module\.mypay\.js\?v=([\d.]+)/.exec(html);
  return /r\.ThueDaTru \? line\('Thuế TNCN', '-' \+ money\(r\.ThueTNCN\)\)/.test(s) && /r\.LyDoDieuChinh/.test(s) && !!m && parseFloat(m[1]) >= 9.45;
})());
kiem('module.payroll.js: tab kpi + renderKPI + openSanPhamThangModal', /key: 'kpi'/.test(codePayrollFE) && /async function renderKPI\(/.test(codePayrollFE) && /function openSanPhamThangModal\(/.test(codePayrollFE));
kiem('module.payroll.js: sua dieu chinh goi PUT /bangluong/chitiet voi dieuChinh + lyDoDieuChinh', /bangluong\/chitiet\/\$\{r\.ID\}`, \{ dieuChinh, lyDoDieuChinh \}/.test(codePayrollFE));
kiem('module.payroll.js: tinhLuong hien thieuHopDong + canhBao', /r\.thieuHopDong/.test(codePayrollFE) && /r\.canhBao/.test(codePayrollFE));
kiem('module.payroll.js: in 3 chu ky', /NGƯỜI LẬP/.test(fPayrollFE) && /KẾ TOÁN TRƯỞNG/.test(fPayrollFE) && /GIÁM ĐỐC/.test(fPayrollFE));
kiem('module.payroll.js: KHONG con o sua tam ung tay (tu-inp)', !/tu-inp/.test(codePayrollFE));
kiem('module.payroll.js: cau hinh co cong tac thue + 3 tham so', /c_truThue/.test(codePayrollFE) && /c_tyLeTV/.test(codePayrollFE) && /c_lamTron/.test(codePayrollFE) && /c_chamChuoc/.test(codePayrollFE));
kiem('module.hrm.js: form hop dong co 6 o v890 + gui sanPham', ['f_kieuluong', 'f_dongiangay', 'f_mucdongbh', 'f_luongcodinh', 'f_nghetthuviec', 'f_kieuthuong'].every(id => codeHrmFE.indexOf(`id="${id}"`) > -1) && /sanPham: kieuThuong === 'SanPham' \? sanPham : \[\]/.test(codeHrmFE));
kiem('module.hrm.js: bo cau "chỉ dùng để in hợp đồng" (nay co tinh luong that)', !/chỉ dùng để in hợp đồng/.test(codeHrmFE));
kiem('index.html bump module.payroll.js >= 9.45', (() => { const m = /module\.payroll\.js\?v=([\d.]+)/.exec(html); return !!m && parseFloat(m[1]) >= 9.45; })());
kiem('index.html bump module.hrm.js >= 9.45', (() => { const m = /module\.hrm\.js\?v=([\d.]+)/.exec(html); return !!m && parseFloat(m[1]) >= 9.45; })());
kiem('migration_v890: 6 cot HopDongLaoDong + 3 bang + 4 cot CauHinhLuong + ChucNang kpi', ['KieuLuong', 'DonGiaNgay', 'MucDongBH', 'LuongCoDinhThang', 'NgayHetThuViec', 'KieuThuong', 'HopDongSanPham', 'DanhGiaKPI', 'ThuongSanPhamThang', 'TruThueTNCN', 'TyLeThuViec', 'LamTronThucLinh', 'DiMuonChamChuocPhut', "'PAYROLL', 'kpi'"].every(k => mig.indexOf(k) > -1));
kiem('migration_v890: CHECK o batch rieng sau GO (them cot roi moi CHECK)', (() => { const a = mig.indexOf('ADD KieuLuong'), g = mig.indexOf('\nGO', a), c = mig.indexOf('CHECK (KieuLuong', a); return a > -1 && g > -1 && c > g; })());
kiem('CAI_DAT_DAY_DU.sql da gop [123/123] migration_v890', /\[123\/123\]\s+migration_v890\.sql/.test(full));
kiem('TRIEN_KHAI doc co muc v9.45', /v9\.45/.test(doc('docs', 'TRIEN_KHAI_v936_v940.md')));

console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
process.exit(sai ? 1 : 0);
