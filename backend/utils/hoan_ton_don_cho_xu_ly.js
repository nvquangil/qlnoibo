/* ================================================================================================
   HOAN TON CHO CAC DON KHACH DAT DANG CHO  (chay 1 lan sau migration_v668 / v6.23)
   ------------------------------------------------------------------------------------------------
   VI SAO PHAI CHAY: tu v6.23 don khach dat KHONG con tru ton (chi PHIEU BAN HANG moi tru).
   Nhung cac don TAO TRUOC v6.23 dang o 'Cho xu ly'/'Cho xac nhan' co DaTruTon = 1 => ton kho DA bi
   tru roi. Neu de nguyen, khi xuat phieu ban hang cho nhung don do se bi TRU LAN 2 (ton am, ban thieu).
   Script nay: hoan lai phan da tru (XuatCai -= SL) va dat DaTruTon = 0 cho dung nhung don do.

   Don 'Da giao' / 'Da xuat hang' KHONG dung den: hang da ra khoi kho thuc te, giu nguyen so da tru.
   Don 'Da huy' KHONG dung den: cac duong huy cu da hoan ton theo DaTruTon.

   CACH DUNG (o may chu, trong thu muc backend):
     node utils/hoan_ton_don_cho_xu_ly.js            -> CHAY THU, chi in ra, KHONG ghi gi
     node utils/hoan_ton_don_cho_xu_ly.js --ghi      -> ghi that (co backup JSON truoc khi ghi)
   An toan: 1 transaction duy nhat, loi la quay lui toan bo. Chay lai lan 2 se khong tim thay don nao
   (vi DaTruTon da = 0) nen khong bao gio hoan ton 2 lan.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const { sql, getPool } = require('../db');

const GHI = process.argv.includes('--ghi');

// Quy SL don ve DON VI CHINH cua ma hang - PHAI GIONG orderQtyToBase() trong routes/khohang.js,
// vi day chinh la cong thuc da dung luc TRU ton truoc v6.23 (hoan phai dung dung so da tru).
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
function orderQtyToBase(soLuong, orderDonVi, donViCoBan, loaiRi, donViQuyDoi) {
  const n = Number(soLuong) || 0, he = Number(loaiRi) || 1;
  const mh = { DonViCoBan: donViCoBan, DonViQuyDoi: donViQuyDoi };
  const cai = laDonViGop(orderDonVi, mh) ? n * he : n;
  const base = donViChinhLaGop(mh) ? cai / he : cai;
  return Math.round(base);
}

(async () => {
  let pool;
  try {
    pool = await getPool();
  } catch (err) {
    console.error('KHONG ket noi duoc CSDL: ' + err.message);
    process.exit(1);
  }
  try {
    const coCot = (await pool.request().query(`SELECT COL_LENGTH('DonKhachDatHang','DaTruTon') AS c`)).recordset[0].c;
    if (coCot == null) {
      console.log('CSDL chua co cot DonKhachDatHang.DaTruTon => khong co don nao tung tru ton. Khong can chay.');
      process.exit(0);
    }
    const rows = (await pool.request().query(`
      SELECT o.DonID, o.TenKhach, o.MaHangID, o.MauSacID, o.SoLuongDat, o.DonVi, o.TrangThai,
             h.MaHang, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi, ms.TenMau
      FROM DonKhachDatHang o
      JOIN TheKhoHangHoa h ON h.MaHangID = o.MaHangID
      LEFT JOIN MauSac ms ON ms.MauSacID = o.MauSacID
      WHERE o.TrangThai IN (N'Chờ xác nhận', N'Chờ xử lý') AND ISNULL(o.DaTruTon, 0) = 1
      ORDER BY o.DonID`)).recordset;

    if (!rows.length) {
      console.log('Khong co don nao dang cho ma da tru ton => KHONG can lam gi (co the da chay truoc do).');
      process.exit(0);
    }

    // Gop theo (MaHangID, MauSacID) de mot lan UPDATE
    const gop = new Map();
    rows.forEach(r => {
      const sl = orderQtyToBase(r.SoLuongDat, r.DonVi, r.DonViCoBan, r.LoaiRi, r.DonViQuyDoi);
      const k = r.MaHangID + '|' + r.MauSacID;
      if (!gop.has(k)) gop.set(k, { MaHangID: r.MaHangID, MauSacID: r.MauSacID, MaHang: r.MaHang, TenMau: r.TenMau, sl: 0, don: [] });
      const g = gop.get(k);
      g.sl += sl;
      g.don.push({ DonID: r.DonID, TenKhach: r.TenKhach, SoLuongDat: r.SoLuongDat, DonVi: r.DonVi, slChinh: sl, TrangThai: r.TrangThai });
    });

    console.log('=== SE HOAN TON (cong lai vao ton kho) ===');
    let tong = 0;
    for (const g of gop.values()) {
      console.log(`  ${g.MaHang} - ${g.TenMau || '(khong mau)'}: +${g.sl}  (tu ${g.don.length} don: ${g.don.map(d => '#' + d.DonID).join(', ')})`);
      tong += g.sl;
    }
    console.log(`Tong: ${rows.length} don, ${gop.size} dong the kho, +${tong} don vi chinh.`);

    if (!GHI) {
      console.log('');
      console.log('=> Day la CHAY THU, chua ghi gi. Chay lai voi  --ghi  de thuc hien.');
      process.exit(0);
    }

    // Backup truoc khi ghi
    const dir = path.join(__dirname, '..', 'backup');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `hoan_ton_don_cho_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify({ ngay: new Date().toISOString(), don: rows, gop: [...gop.values()] }, null, 2), 'utf8');
    console.log('Da ghi file sao luu: ' + file);

    const tran = new sql.Transaction(pool);
    await tran.begin();
    try {
      for (const g of gop.values()) {
        await new sql.Request(tran).input('mh', sql.Int, g.MaHangID).input('ms', sql.Int, g.MauSacID).input('sl', sql.Int, g.sl)
          .query('UPDATE TheKhoChiTietMau SET XuatCai = XuatCai - @sl WHERE MaHangID=@mh AND MauSacID=@ms');
      }
      /* CHI dat DaTruTon = 0 cho DUNG cac DonID da doc o tren (va da hoan ton). Neu dung dieu kien
         chung, don nao vua duoc tao xen giua luc chay se bi danh dau da hoan MA KHONG duoc hoan. */
      const ids = rows.map(r => r.DonID);
      for (let i = 0; i < ids.length; i += 500) {
        const lo = ids.slice(i, i + 500).join(',');
        await new sql.Request(tran).query(`UPDATE DonKhachDatHang SET DaTruTon = 0 WHERE DonID IN (${lo})`);
      }
      await tran.commit();
      console.log('XONG. Da hoan ton va dat DaTruTon = 0 cho ' + rows.length + ' don.');
      console.log('Kiem tra lai: The kho / Ton kho -> cot "Kha dung" phai bang so hang thuc te con ban duoc.');
    } catch (err) {
      await tran.rollback();
      console.error('LOI khi ghi - da QUAY LUI toan bo, du lieu giu nguyen: ' + err.message);
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('LOI: ' + err.message);
    process.exit(1);
  }
})();
