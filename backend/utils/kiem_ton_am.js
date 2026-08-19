/* ================================================================================================
   SOI TON AM / LECH DON VI CUA THE KHO HANG HOA   (chi DOC, KHONG ghi gi - chay bao nhieu lan cung duoc)
   ------------------------------------------------------------------------------------------------
   Dung khi: sua don vi chinh cua ma hang (vd Cai -> Ri) va nhap lai so luong theo Ri, nhung TON bi AM
   vi phan DA XUAT (XuatCai) van la so cu tinh theo Cai, hoac cac don khach dat cu ghi sai don vi.

   In ra cho TUNG ma hang / mau co van de:
     - NhapCai, XuatCai, Ton hien tai (theo DON VI CHINH dang khai)
     - Cac nguon LAM RA HANG: phieu ban hang (v6.23) + don khach dat DA TRU TON (du lieu cu)
     - So "DA XUAT DUNG" tinh lai theo don vi chinh HIEN TAI, va chenh lech so voi XuatCai dang luu
     - Cac don dang GIU hang (chua xuat) - de biet vi sao cot Kha dung thap

   CACH DUNG (trong thu muc backend):
     node utils/kiem_ton_am.js                -> chi cac ma dang AM kho
     node utils/kiem_ton_am.js --tat-ca       -> moi ma co phat sinh xuat (kiem tra tong the)
     node utils/kiem_ton_am.js --ma=ABC123    -> chi 1 ma hang

   ---- NAN LAI SO DA XUAT (v6.24.1) ----
   Dung khi cot Xuat bi LAN LON DON VI (mot phan don ghi Ri, mot phan ghi Cai) nen KHONG the chia/nhan
   ca cot cho he so. Che do nay dat lai:
        XuatCai = TONG cua tung chung tu, quy doi RIENG theo don vi ghi tren chinh chung tu do
                  (phieu ban hang + don khach dat da tru ton)
     node utils/kiem_ton_am.js --ma=ABC123 --nan          (chay thu, in truoc/sau)
     node utils/kiem_ton_am.js --ma=ABC123 --nan --ghi    (ghi that, co backup JSON)

   ---- NAN MOI DONG CO SO XUAT AM (v6.24.5) ----
   So xuat AM (XuatCai < 0) la chac chan hong: khong the xuat kho so am. Thuong do HOAN TON nhieu hon
   da tru (loi co DaTruTon mac dinh 1 - moi lan xoa/huy don lai tru them vao cot Xuat). Quet ca he thong:
     node utils/kiem_ton_am.js --nan --xuat-am
     node utils/kiem_ton_am.js --nan --xuat-am --ghi
   !! CANH BAO: neu truoc day co ai SUA TAY so Xuat tren man hinh The kho (hang hong, mat mat, xuat
      ngoai luong...) thi phan do KHONG co chung tu nen se bi MAT sau khi nan. Ban chay thu se in ro
      chenh lech de quyet dinh truoc.
   ================================================================================================ */
const { sql, getPool } = require('../db');

/* Nhan ca tham so 1 GACH (-nan, -ghi...) va tach tham so dinh lien nhau (--ma=ABC--nan). */
const argvGoc = process.argv.slice(2).map(a => (/^-[a-zA-Z]/.test(a) && !a.startsWith('--')) ? '-' + a : a);
const TAT_CA = argvGoc.includes('--tat-ca');
const NAN = argvGoc.includes('--nan');
const GHI = argvGoc.includes('--ghi');
/* v6.24.5: nan TAT CA cac dong co SO XUAT AM (XuatCai < 0) - khong can chi ro tung ma.
   Xuat AM la chac chan hong (khong the xuat kho so am), thuong do hoan ton nhieu hon da tru:
   loi co DaTruTon mac dinh 1 -> moi lan XOA/HUY don lai tru them vao cot Xuat. */
const XUAT_AM = argvGoc.includes('--xuat-am');
const argvSach = [];
argvGoc.forEach(a => {
  const m = /^(--[a-zA-Z-]+=)(.*)$/.exec(a);
  if (m && m[2].indexOf('--') > 0) { const i = m[2].indexOf('--'); argvSach.push(m[1] + m[2].slice(0, i)); argvSach.push(m[2].slice(i)); }
  else argvSach.push(a);
});
const argMa = (argvSach.find(a => a.startsWith('--ma=')) || '').split('=')[1];

// Quy SL don ve DON VI CHINH cua ma hang - GIONG orderQtyToBase() (khohang.js) va slSangDonViChinh() (banhang.js)
/* v6.31: "don vi GOP" = DonViQuyDoi cua CHINH ma hang (khong so ten voi 'Ri').
   PHAI GIONG laDonViGop/donViChinhLaGop trong routes/khohang.js, banhang.js, public.js, common.js. */
function chuanDV(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
function laDonViGop(donVi, mh) {
  const dv = chuanDV(donVi), qd = chuanDV(mh && mh.DonViQuyDoi);
  return qd ? dv === qd : dv === 'ri';
}
function donViChinhLaGop(mh) {
  const cb = chuanDV(mh && mh.DonViCoBan), qd = chuanDV(mh && mh.DonViQuyDoi);
  return qd ? cb === qd : cb === 'ri';
}
function veDonViChinh(soLuong, donVi, donViCoBan, loaiRi, donViQuyDoi) {
  const n = Number(soLuong) || 0, he = Number(loaiRi) || 1;
  const mh = { DonViCoBan: donViCoBan, DonViQuyDoi: donViQuyDoi };
  const cai = laDonViGop(donVi, mh) ? n * he : n;
  const base = donViChinhLaGop(mh) ? cai / he : cai;
  return Math.round(base);
}
const soDep = n => (Number(n) || 0).toLocaleString('vi-VN');

(async () => {
  let pool;
  try { pool = await getPool(); }
  catch (err) { console.error('KHONG ket noi duoc CSDL: ' + err.message); process.exit(1); }

  try {
    const coBangPBH = (await pool.request().query(`SELECT OBJECT_ID('dbo.PhieuBanHangChiTiet') AS o`)).recordset[0].o != null;
    const coCotDaTruTon = (await pool.request().query(`SELECT COL_LENGTH('DonKhachDatHang','DaTruTon') AS c`)).recordset[0].c != null;

    const rq = pool.request();
    let loc = '';
    if (argMa) { rq.input('ma', sql.NVarChar, argMa); loc = 'AND h.MaHang = @ma'; }
    const dong = (await rq.query(`
      SELECT h.MaHangID, h.MaHang, h.TenHang, h.DonViCoBan, h.DonViQuyDoi, h.LoaiRi,
             ct.MauSacID, ms.TenMau, ct.NhapCai, ct.XuatCai, (ct.NhapCai - ct.XuatCai) AS Ton
      FROM TheKhoChiTietMau ct
      JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
      LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
      WHERE 1=1 ${loc}
      ORDER BY h.MaHang, ms.TenMau`)).recordset;

    // Nguon xuat 1: phieu ban hang (v6.23)
    const pbh = coBangPBH ? (await pool.request().query(`
      SELECT ct.MaHangID, ct.MauSacID, ct.SoLuong, ct.DonVi, p.SoPhieu, p.NgayBan, p.TrangThai
      FROM PhieuBanHangChiTiet ct JOIN PhieuBanHang p ON p.PhieuBHID = ct.PhieuBHID
      WHERE p.TrangThai <> N'Đã hủy'`)).recordset : [];
    // Nguon xuat 2: don khach dat DA TRU TON (du lieu truoc v6.23)
    const donDaTru = (await pool.request().query(`
      SELECT o.DonID, o.MaHangID, o.MauSacID, o.SoLuongDat, o.DonVi, o.TrangThai, o.ThoiGian
             ${coCotDaTruTon ? ', o.DaTruTon' : ''}
      FROM DonKhachDatHang o
      WHERE ${coCotDaTruTon ? 'ISNULL(o.DaTruTon, 0) = 1' : "o.TrangThai <> N'Đã hủy'"}`)).recordset;
    // Don DANG GIU (chua xuat) - khong lam ton am nhung lam giam "Kha dung"
    const donGiu = (await pool.request().query(`
      SELECT o.DonID, o.MaHangID, o.MauSacID, o.SoLuongDat, o.DonVi, o.TrangThai, o.ThoiGian
      FROM DonKhachDatHang o
      WHERE o.TrangThai IN (N'Chờ xác nhận', N'Chờ xử lý') ${coCotDaTruTon ? 'AND ISNULL(o.DaTruTon, 0) = 0' : ''}`)).recordset;

    const loc2 = (arr, r) => arr.filter(x => x.MaHangID === r.MaHangID && String(x.MauSacID) === String(r.MauSacID));

    console.log('=== SOI TON THE KHO HANG HOA ===');
    console.log(`Nguon xuat: ${pbh.length} dong phieu ban hang${coBangPBH ? '' : ' (CHUA co bang PhieuBanHang - chua chay migration_v668)'}, `
      + `${donDaTru.length} don khach dat DA TRU TON, ${donGiu.length} don dang giu.`);
    console.log('');

    let soVanDe = 0;
    for (const r of dong) {
      const dsPBH = loc2(pbh, r), dsCu = loc2(donDaTru, r), dsGiu = loc2(donGiu, r);
      const xuatPBH = dsPBH.reduce((s, x) => s + veDonViChinh(x.SoLuong, x.DonVi, r.DonViCoBan, r.LoaiRi, r.DonViQuyDoi), 0);
      const xuatCu = dsCu.reduce((s, x) => s + veDonViChinh(x.SoLuongDat, x.DonVi, r.DonViCoBan, r.LoaiRi, r.DonViQuyDoi), 0);
      const xuatDung = xuatPBH + xuatCu;
      const lech = Number(r.XuatCai) - xuatDung;
      const am = Number(r.Ton) < 0;
      if (!TAT_CA && !am && !lech) continue;
      soVanDe++;

      const dvc = r.DonViCoBan || 'Cái';
      console.log(`${am ? '### AM KHO ' : (lech ? '### LECH   ' : '    ')}${r.MaHang} - ${r.TenHang} | mau: ${r.TenMau || '(khong mau)'}`);
      console.log(`    Don vi chinh: ${dvc} | quy doi: ${r.DonViQuyDoi || '-'} | he so LoaiRi = ${r.LoaiRi}`);
      console.log(`    Nhap ${soDep(r.NhapCai)} | Xuat ${soDep(r.XuatCai)} | TON = ${soDep(r.Ton)} ${dvc}${am ? '   <-- AM' : ''}`);
      console.log(`    Da xuat DUNG (tinh lai theo don vi chinh hien tai) = ${soDep(xuatDung)} `
        + `(phieu ban hang ${soDep(xuatPBH)} + don cu da tru ${soDep(xuatCu)})`);
      if (lech) {
        console.log(`    >>> LECH ${lech > 0 ? '+' : ''}${soDep(lech)}: cot XuatCai dang ${lech > 0 ? 'LON HON' : 'NHO HON'} so thuc te.`
          + ` Nan lai XuatCai = ${soDep(xuatDung)} thi ton se thanh ${soDep(Number(r.NhapCai) - xuatDung)}.`);
      }
      if (dsCu.length) {
        console.log('    Don cu DA TRU TON:');
        dsCu.forEach(x => console.log(`      #${x.DonID} ${String(x.ThoiGian).slice(0, 10)} | ${soDep(x.SoLuongDat)} ${x.DonVi}`
          + ` -> ${soDep(veDonViChinh(x.SoLuongDat, x.DonVi, r.DonViCoBan, r.LoaiRi, r.DonViQuyDoi))} ${dvc} | ${x.TrangThai}`
          + (String(x.DonVi) !== dvc ? `   <-- don vi don (${x.DonVi}) KHAC don vi chinh (${dvc})` : '')));
      }
      if (dsPBH.length) {
        console.log('    Phieu ban hang:');
        dsPBH.forEach(x => console.log(`      ${x.SoPhieu} ${String(x.NgayBan).slice(0, 10)} | ${soDep(x.SoLuong)} ${x.DonVi}`
          + ` -> ${soDep(veDonViChinh(x.SoLuong, x.DonVi, r.DonViCoBan, r.LoaiRi, r.DonViQuyDoi))} ${dvc}`));
      }
      if (dsGiu.length) {
        const giu = dsGiu.reduce((s, x) => s + veDonViChinh(x.SoLuongDat, x.DonVi, r.DonViCoBan, r.LoaiRi, r.DonViQuyDoi), 0);
        console.log(`    Dang GIU cho ${dsGiu.length} don chua xuat: ${soDep(giu)} ${dvc}`
          + ` => Kha dung = ${soDep(Number(r.Ton) - giu)} ${dvc}`);
        dsGiu.forEach(x => console.log(`      #${x.DonID} ${String(x.ThoiGian).slice(0, 10)} | ${soDep(x.SoLuongDat)} ${x.DonVi} | ${x.TrangThai}`
          + (String(x.DonVi) !== dvc ? `   <-- don vi don (${x.DonVi}) KHAC don vi chinh (${dvc})` : '')));
      }
      console.log('');
    }

    if (!soVanDe) console.log(TAT_CA ? 'Khong co dong nao.' : 'KHONG co ma nao am kho hay lech XuatCai. (Chay voi --tat-ca de xem toan bo.)');
    else console.log(`=> ${soVanDe} dong can xu ly.`);

    /* ------------------------- NAN LAI SO DA XUAT TU CHUNG TU ------------------------- */
    if (NAN) {
      /* v6.40: cho phep NAN TOAN BO he thong bang --nan --tat-ca.
         Dung khi cot Xuat cua NHIEU ma bi lech don vi (mot phan don ghi Ri, mot phan ghi Cai) —
         nhan/chia ca cot cho he so la SAI (xem ket qua --nhan-tat-ca: 26/52 ma am kho).
         Cach dung o day khong doan gi ca: doc TUNG chung tu, quy doi theo don vi ghi tren
         CHINH chung tu do, roi dat lai XuatCai = tong. Ma nao dang dung thi khong bi dong vao. */
      if (!argMa && !XUAT_AM && !TAT_CA) {
        console.error('');
        console.error('Che do --nan can chon pham vi:');
        console.error('   --nan --ma=<MaHang>     : 1 ma hang');
        console.error('   --nan --xuat-am         : ca he thong, chi cac dong co so xuat AM');
        console.error('   --nan --tat-ca          : CA HE THONG, moi dong lech so voi chung tu');
        process.exit(1);
      }
      const nguon = XUAT_AM ? dong.filter(r => Number(r.XuatCai) < 0) : dong;
      if (XUAT_AM) console.log(`(Che do --xuat-am: chi xet ${nguon.length} dong co XuatCai < 0)`);
      else if (!argMa) console.log(`(Che do --tat-ca: xet ca ${nguon.length} dong co phat sinh)`);
      const canNan = nguon.map(r => {
        const xuatDung = loc2(pbh, r).reduce((s, x) => s + veDonViChinh(x.SoLuong, x.DonVi, r.DonViCoBan, r.LoaiRi, r.DonViQuyDoi), 0)
          + loc2(donDaTru, r).reduce((s, x) => s + veDonViChinh(x.SoLuongDat, x.DonVi, r.DonViCoBan, r.LoaiRi, r.DonViQuyDoi), 0);
        return { r, xuatDung, lech: Number(r.XuatCai) - xuatDung };
      }).filter(x => x.lech !== 0);

      console.log('');
      console.log('=== NAN LAI SO DA XUAT (tinh tu tung chung tu) ===');
      if (!canNan.length) { console.log('Khong dong nao lech - khong can nan.'); process.exit(0); }
      let tongLech = 0;
      canNan.forEach(({ r, xuatDung, lech }) => {
        const dvc = r.DonViCoBan || 'Cái';
        tongLech += lech;
        if (XUAT_AM || !argMa) console.log(`  ${r.MaHang} - ${r.TenHang}`);
        console.log(`  ${(r.TenMau || '(khong mau)').padEnd(18)} Xuat ${soDep(r.XuatCai)} -> ${soDep(xuatDung)}`
          + ` | Ton ${soDep(r.Ton)} -> ${soDep(Number(r.NhapCai) - xuatDung)} ${dvc}`
          + `   (${lech > 0 ? 'giam' : 'tang'} ${soDep(Math.abs(lech))})`);
      });
      /* v6.41: LIET KE ma sẽ ÂM KHO sau khi nắn — đó là dấu hiệu CỘT NHẬP còn để theo ri
         (nắn xuất về đúng số cái/bộ trong khi nhập vẫn là số ri thì tất nhiên âm).
         Phải sửa cột NHẬP cho các mã này TRƯỚC, rồi mới nắn xuất. */
      const seAm = canNan.filter(({ r, xuatDung }) => (Number(r.NhapCai) - xuatDung) < 0);
      if (seAm.length) {
        const maAm = [...new Set(seAm.map(x => x.r.MaHang))];
        console.log('');
        console.log(`!! ${seAm.length} dong (${maAm.length} ma) se AM KHO sau khi nan:`);
        console.log('   ' + maAm.join(', '));
        console.log('   Nghia la COT NHAP cua nhung ma nay VAN DE THEO RI (nan xuat ve dung don vi thi tat nhien am).');
        console.log('');
        console.log('   LAM THEO THU TU NAY:');
        console.log('   1) Sua cot NHAP cua cac ma do truoc (nhan he so):');
        console.log(`        node utils/sua_don_vi_the_kho.js --ma=${maAm.join(',')} --cot=nhap --nhan`);
        console.log(`        node utils/sua_don_vi_the_kho.js --ma=${maAm.join(',')} --cot=nhap --nhan --ghi`);
        console.log('   2) Roi moi nan cot XUAT:');
        console.log('        node utils/kiem_ton_am.js --nan --tat-ca --ghi');
        console.log('');
        console.log('   (Chay --ghi ngay bay gio VAN DUOC — cot Xuat se dung, nhung ton con am cho den khi lam buoc 1.)');
      }

      console.log('');
      if (tongLech > 0) {
        console.log(`!! CANH BAO: tong so da xuat GIAM ${soDep(tongLech)} sau khi nan.`);
        console.log('   Nghia la co phan xuat KHONG CO CHUNG TU (sua tay tren man hinh The kho, hang hong,');
        console.log('   xuat ngoai luong...). Neu do la xuat THAT thi DUNG nan - hay bo sung chung tu truoc.');
      }
      if (!GHI) { console.log(''); console.log('=> CHAY THU, chua ghi gi. Them --ghi de thuc hien.'); process.exit(0); }

      const fs = require('fs'), path = require('path');
      const dir = path.join(__dirname, '..', 'backup');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `nan_xuat_${argMa || 'xuat-am'}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(file, JSON.stringify({ ngay: new Date().toISOString(), maHang: argMa || '(tat ca dong xuat am)', canNan }, null, 2), 'utf8');
      console.log('Da ghi file sao luu: ' + file);

      const tran = new sql.Transaction(pool);
      await tran.begin();
      try {
        for (const { r, xuatDung } of canNan) {
          await new sql.Request(tran).input('mh', sql.Int, r.MaHangID).input('ms', sql.Int, r.MauSacID)
            .input('x', sql.Int, xuatDung)
            .query('UPDATE TheKhoChiTietMau SET XuatCai = @x WHERE MaHangID = @mh AND MauSacID = @ms');
        }
        await tran.commit();
        console.log(`XONG. Da nan ${canNan.length} dong. Mo lai The kho / Ton kho (Ctrl+F5) de kiem tra.`);
      } catch (err) {
        try { await tran.rollback(); } catch (e) { /* transaction co the da ket thuc */ }
        console.error('LOI khi ghi - da QUAY LUI toan bo: ' + err.message);
        process.exit(1);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error('LOI: ' + err.message);
    process.exit(1);
  }
})();
