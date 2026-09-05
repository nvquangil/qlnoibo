/* ==================================================================================================
   SOI VẢI MUA THEO MÉT — cây nào đang ra TIỀN 0 vì công thức tính theo KG        (v7.62)
   --------------------------------------------------------------------------------------------------
   Trước v7.62 cả hệ thống chỉ có MỘT công thức: tiền = KGNhap × DonGiaNhap. Vải mua theo mét (khai
   số mét, bỏ trống KG) vì thế ra 0 ở CẢ phiếu nhập LẪN công nợ nhà cung cấp — nghĩa là số nợ NCC
   đang THIẾU đúng phần vải đó.

   v7.62 thêm `PhieuNhapVai.DonViTinhGia` (Kg / Met). Người dùng đã chốt: **dữ liệu cũ để nguyên**,
   chỉ áp dụng từ nay. Công cụ này để NHÌN RÕ phần đang bị bỏ sót — chạy rồi tự quyết định.

   CHỈ ĐỌC. Không sửa gì. Muốn đổi một phiếu cũ sang tính theo mét thì vào Sửa phiếu, đổi ô
   "Đơn giá tính theo" — và nhớ rằng làm thế là CÔNG NỢ NCC TĂNG.

   Chạy:  node utils/soi_tien_vai_theo_met.js
          node utils/soi_tien_vai_theo_met.js --ncc=5
          node utils/soi_tien_vai_theo_met.js --chi-tiet
   ================================================================================================== */
const { sql, getPool } = require('../db');
const { coCotDonViTinhGia } = require('./tienVaiNhap');

const args = process.argv.slice(2);
const co = (t) => args.indexOf(t) !== -1;
function layChuoi(t) {
  const gan = args.find(x => x.indexOf(t + '=') === 0);
  if (gan) {
    const v = gan.slice(t.length + 1).trim();
    if (v) return v;
    const sau = args[args.indexOf(gan) + 1];
    return (sau && sau.indexOf('--') !== 0) ? sau.trim() : '';
  }
  const i = args.indexOf(t);
  if (i >= 0) { const sau = args[i + 1]; return (sau && sau.indexOf('--') !== 0) ? sau.trim() : ''; }
  return '';
}
const NCC = layChuoi('--ncc').trim();
const CHI_TIET = co('--chi-tiet');

const so = (v) => Number(v || 0);
const tienVN = (v) => Math.round(so(v)).toLocaleString('vi-VN');
const hai = (n) => String(n).padStart(2, '0');
const ngayVN = (d) => { const x = new Date(d); return isNaN(x) ? '' : `${hai(x.getDate())}/${hai(x.getMonth() + 1)}/${x.getFullYear()}`; };

(async () => {
  const pool = await getPool();
  const coDVT = await coCotDonViTinhGia(pool);

  console.log('');
  console.log('Cot PhieuNhapVai.DonViTinhGia: ' + (coDVT
    ? 'DA CO (da chay migration_v694)'
    : 'CHUA CO -> he thong dang tinh tien vai THUAN THEO KG'));

  const rq = pool.request();
  if (NCC) rq.input('ncc', sql.Int, Number(NCC));
  /* Cay "dang bi bo sot": co don gia, co SO MET, ma KG = 0, VA phieu chua duoc danh dau tinh theo met.
     Do la dung tap hop se ra tien 0 trong khi thuc te co mua hang. */
  const rows = (await rq.query(`
    SELECT pn.PhieuNhapID, pn.NgayNhap, pn.SoHoaDon, pn.NCC_ID, ncc.TenNCC,
           ${coDVT ? 'ISNULL(pn.DonViTinhGia, N\'Kg\')' : 'CAST(N\'Kg\' AS NVARCHAR(10))'} AS DonViTinhGia,
           vc.CayID, vc.MaCay, vc.KGNhap, vc.SoMet, vc.DonGiaNhap,
           lv.TenLoaiVai, ms.TenMau
    FROM VaiCay vc
    JOIN PhieuNhapVai pn ON pn.PhieuNhapID = vc.PhieuNhapID
    LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = pn.NCC_ID
    LEFT JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
    WHERE ISNULL(vc.DonGiaNhap, 0) > 0
      AND ISNULL(vc.KGNhap, 0) <= 0
      AND ISNULL(vc.SoMet, 0) > 0
      ${coDVT ? "AND ISNULL(pn.DonViTinhGia, N'Kg') <> N'Met'" : ''}
      ${NCC ? 'AND pn.NCC_ID = @ncc' : ''}
    ORDER BY ncc.TenNCC, pn.PhieuNhapID, vc.CayID`)).recordset;

  if (!rows.length) {
    console.log('');
    console.log('KHONG co cay nao dang bi bo sot tien: moi cay co don gia deu co KG,');
    console.log('hoac phieu cua no da duoc danh dau tinh theo MET.');
    process.exit(0);
  }

  /* Gom theo NCC roi den phieu. */
  const theoNCC = new Map();
  rows.forEach(r => {
    const k = r.NCC_ID == null ? '(khong ro NCC)' : (r.TenNCC || ('NCC #' + r.NCC_ID));
    if (!theoNCC.has(k)) theoNCC.set(k, { tien: 0, cay: 0, phieu: new Map() });
    const g = theoNCC.get(k);
    const tien = so(r.SoMet) * so(r.DonGiaNhap);
    g.tien += tien; g.cay++;
    if (!g.phieu.has(r.PhieuNhapID)) g.phieu.set(r.PhieuNhapID, { ngay: r.NgayNhap, hd: r.SoHoaDon, tien: 0, cay: [] });
    const p = g.phieu.get(r.PhieuNhapID);
    p.tien += tien; p.cay.push({ ...r, tien });
  });

  let tongTien = 0, tongCay = 0, tongPhieu = 0;
  console.log('');
  console.log('=== VAI CO DON GIA + CO SO MET NHUNG KG = 0 (dang ra tien 0) ===');
  theoNCC.forEach((g, ten) => {
    tongTien += g.tien; tongCay += g.cay; tongPhieu += g.phieu.size;
    console.log('');
    console.log(`${ten}  ·  ${g.phieu.size} phieu · ${g.cay} cay · NEU tinh theo met: +${tienVN(g.tien)} d`);
    g.phieu.forEach((p, id) => {
      console.log(`    NKV-${String(id).padStart(5, '0')} · ${ngayVN(p.ngay)}`
        + (p.hd ? ` · HD ${p.hd}` : '') + ` · ${p.cay.length} cay · +${tienVN(p.tien)} d`);
      if (CHI_TIET) {
        p.cay.forEach(c => console.log(`        ${c.MaCay} · ${c.TenLoaiVai || ''}`
          + (c.TenMau ? ' - ' + c.TenMau : '')
          + ` · ${so(c.SoMet)} m x ${tienVN(c.DonGiaNhap)} = ${tienVN(c.tien)} d`));
      }
    });
  });

  console.log('');
  console.log('================================================================');
  console.log(`TONG: ${theoNCC.size} nha cung cap · ${tongPhieu} phieu · ${tongCay} cay`);
  console.log(`Neu tinh cac cay nay theo MET thi cong no phai tra se TANG: ${tienVN(tongTien)} d`);
  console.log('');
  console.log('LUU Y:');
  console.log('  · Day la so DANG BI BO SOT, khong phai so dang sai. He thong hien ghi 0 cho cac cay nay.');
  console.log('  · Muon tinh: vao Kho vai -> Nhap kho -> Sua tung phieu -> doi o "Don gia tinh theo"');
  console.log('    sang MET. Cong no NCC se TANG dung bang so o tren -> phai co nguoi doi chieu.');
  console.log('  · Khong dinh tinh lai: bo qua, phieu tu nay tro di chon dung don vi la du.');
  if (!CHI_TIET) console.log('  · Xem tung cay: them --chi-tiet');
  process.exit(0);
})().catch(err => { console.error('LOI: ' + err.message); process.exit(1); });
