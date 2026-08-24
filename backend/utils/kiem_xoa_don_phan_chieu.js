/* ================================================================================================
   KIEM CHUNG THU TU XOA DON PHAN CHIEU (khoa ngoai PhieuBanHangChiTiet.DonID)               v7.42
   ------------------------------------------------------------------------------------------------
   KHONG CAN CSDL — kiem TINH tren ma nguon.

   LOI DA XAY RA: "The DELETE statement conflicted with the REFERENCE constraint
   FK__PhieuBanH__DonID__..., table dbo.PhieuBanHangChiTiet, column 'DonID'".
   `PhieuBanHangChiTiet.DonID` la khoa ngoai tro toi `DonKhachDatHang.DonID`. Tu v7.22, xoa/sua phieu
   thi XOA HAN don PHAN CHIEU — nhung dong chi tiet VAN CON va DonID cua no van tro toi don do.

   BA CHO phai go `DonID` ve NULL TRUOC khi xoa don:
       routes/banhang.js  goChiTietPhieu()        (sua phieu: go roi ghi lai)
       routes/banhang.js  DELETE /phieu/:id       (xoa phieu)
       routes/khohang.js  DELETE /orders/:id      (xoa don khach — ca don thuoc phieu DA HUY)

   Kiem bang VI TRI trong file: lenh go phai dung TRUOC moi lenh xoa trong CUNG mot ham.

   CACH DUNG (trong thu muc backend):
       node utils/kiem_xoa_don_phan_chieu.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');

let dat = 0, truot = 0;
function ok(dieuKien, nhan, chiTiet) {
  if (dieuKien) { dat++; console.log('  OK   ' + nhan); }
  else { truot++; console.log('  TRUOT ' + nhan + (chiTiet ? '  -> ' + chiTiet : '')); }
}
const doc = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

/* Cat doan ma tu `tuKhoaBatDau` den `tuKhoaKetThuc` (hoac het file) de kiem thu tu TRONG PHAM VI do,
   thay vi so vi tri tren ca file — hai ham khac nhau khong duoc so thu tu voi nhau. */
function doan(src, batDau, ketThuc) {
  const i = src.indexOf(batDau);
  if (i === -1) return null;
  const j = ketThuc ? src.indexOf(ketThuc, i + batDau.length) : -1;
  return src.slice(i, j === -1 ? src.length : j);
}

(async () => {
  const bh = doc('routes', 'banhang.js');
  const kh = doc('routes', 'khohang.js');

  console.log('');
  console.log('=== 1. Ham go rang buoc dung chung ===');
  ok(/async function goRangBuocDonTrenChiTiet\(tran, phieuBHID\)/.test(bh),
    'banhang.js co ham goRangBuocDonTrenChiTiet(tran, phieuBHID)');
  const ham = doan(bh, 'async function goRangBuocDonTrenChiTiet', '\nasync function goChiTietPhieu');
  ok(ham && /UPDATE PhieuBanHangChiTiet SET DonID = NULL WHERE PhieuBHID = @id/.test(ham),
    'Ham do UPDATE ... SET DonID = NULL theo PhieuBHID');
  ok(ham && /DonID IS NOT NULL/.test(ham),
    'Co dieu kien DonID IS NOT NULL (khong ghi de vo ich len dong da NULL)');
  const soGoi = (bh.match(/await goRangBuocDonTrenChiTiet\(/g) || []).length;
  ok(soGoi === 2, 'Duoc goi dung 2 lan trong banhang.js (goChiTietPhieu + DELETE /phieu/:id)',
    'dem=' + soGoi);

  console.log('');
  console.log('=== 2. goChiTietPhieu(): GO truoc, XOA sau ===');
  const dGo = doan(bh, 'async function goChiTietPhieu', '\n/* v7.17: HUY don khach dat');
  ok(!!dGo, 'Cat duoc than ham goChiTietPhieu');
  if (dGo) {
    const iGo = dGo.indexOf('await goRangBuocDonTrenChiTiet(');
    const iXoa = dGo.indexOf('DELETE FROM DonKhachDatHang');
    const iXoaCT = dGo.indexOf('DELETE FROM PhieuBanHangChiTiet');
    ok(iGo !== -1, 'Co goi go rang buoc');
    ok(iXoa !== -1, 'Co lenh xoa don phan chieu');
    ok(iGo !== -1 && iXoa !== -1 && iGo < iXoa,
      'GO dung TRUOC XOA don (day chinh la cho loi phat sinh)', `iGo=${iGo} iXoa=${iXoa}`);
    ok(iXoaCT === -1 || iGo < iXoaCT, 'GO cung dung truoc DELETE chi tiet');
  }

  console.log('');
  console.log('=== 3. DELETE /phieu/:id: GO truoc, XOA sau ===');
  const dDel = doan(bh, "router.delete('/phieu/:id'", '\n/* ====');
  ok(!!dDel, 'Cat duoc than route DELETE /phieu/:id');
  if (dDel) {
    const iGo = dDel.indexOf('await goRangBuocDonTrenChiTiet(');
    /* Route nay co HAI lenh xoa don (trong vong lap va sau vong lap) — go phai truoc CA HAI. */
    const dsXoa = [...dDel.matchAll(/DELETE FROM DonKhachDatHang/g)].map(m => m.index);
    const iPhieu = dDel.indexOf('DELETE FROM PhieuBanHang WHERE');
    ok(iGo !== -1, 'Co goi go rang buoc');
    ok(dsXoa.length === 2, 'Co dung 2 lenh xoa don phan chieu', 'dem=' + dsXoa.length);
    ok(dsXoa.every(i => iGo < i), 'GO dung truoc CA HAI lenh xoa don',
      `iGo=${iGo} dsXoa=${JSON.stringify(dsXoa)}`);
    ok(iPhieu === -1 || iGo < iPhieu, 'GO dung truoc ca DELETE FROM PhieuBanHang');
    /* Go phai nam NGAY SAU tran.begin() — de trong transaction, quay lui duoc neu loi giua chung. */
    const iBegin = dDel.indexOf('await tran.begin()');
    ok(iBegin !== -1 && iGo > iBegin, 'GO nam TRONG transaction (sau tran.begin) -> quay lui duoc');
  }

  console.log('');
  console.log('=== 4. khohang.js DELETE /orders/:id: GO truoc, XOA sau ===');
  /* ⚠️ Phai cat theo ROUTE, khong theo `phieuBHDangChuaDon(...)`: chuoi do xuat hien 3 lan trong file
     (PUT /orders/:id/status, DELETE /orders/:id, PUT /orders/:id) — lay lan dau se cat sai route va
     bao TRUOT oan (da mac dung loi nay khi viet bo kiem nay). */
  const dDon = doan(kh, "router.delete('/orders/:id'", "router.put('/orders/:id'");
  ok(!!dDon, 'Cat duoc than route DELETE /orders/:id');
  ok(dDon && /phieuBHDangChuaDon\(pool, req\.params\.id\)/.test(dDon),
    'Doan cat dung la route xoa don (co goi phieuBHDangChuaDon)');
  if (dDon) {
    const iGo = dDon.indexOf('UPDATE PhieuBanHangChiTiet SET DonID = NULL WHERE DonID = @id');
    const iXoa = dDon.indexOf('DELETE FROM DonKhachDatHang WHERE DonID=@id');
    ok(iGo !== -1, 'Co lenh go DonID ve NULL (theo DonID, khong theo PhieuBHID)');
    ok(iXoa !== -1, 'Co lenh xoa don');
    ok(iGo !== -1 && iXoa !== -1 && iGo < iXoa, 'GO dung truoc XOA', `iGo=${iGo} iXoa=${iXoa}`);
    /* Van phai GIU cai chan "don dang nam trong phieu chua huy" — go rang buoc KHONG duoc bien thanh
       cho phep xoa don dang duoc mot phieu SONG su dung. */
    ok(/Không xóa được: đơn này nằm trong phiếu bán hàng/.test(kh),
      'VAN giu chan don dang nam trong phieu CHUA huy (thong bao ro rang, khong phai loi FK tho)');
  }

  console.log('');
  console.log('=== 5. Khong con cho nao xoa don ma chua go ===');
  const moiCho = [...bh.matchAll(/DELETE FROM DonKhachDatHang/g)].map(m => m.index);
  ok(moiCho.length === 3, 'banhang.js co dung 3 lenh xoa don (1 trong goChiTietPhieu + 2 trong DELETE)',
    'dem=' + moiCho.length);
  const iGo1 = bh.indexOf('await goRangBuocDonTrenChiTiet(');
  ok(iGo1 !== -1 && iGo1 < moiCho[0],
    'Lan goi go DAU TIEN dung truoc lenh xoa don dau tien trong file');

  console.log('');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  console.log(truot ? '>> CO MUC KHONG DAT - phai sua truoc khi giao.' : '>> DAT TAT CA.');
  process.exit(truot ? 1 : 0);
})().catch(err => { console.error('LOI KIEM CHUNG: ' + err.stack); process.exit(1); });
