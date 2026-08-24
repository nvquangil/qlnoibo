/* ================================================================================================
   KIEM CHUNG NGUON "NHAP LAI" (hang khach tra) CHO KHO HANG HOA                            v7.38
   ------------------------------------------------------------------------------------------------
   KHONG CAN CSDL. Kiem 4 thu:
     1. Cac cau SQL trong utils/nhapLaiHangHoa.js: can ngoac, du dieu kien, quy dung don vi chinh
     2. Bieu thuc quy don vi GIONG HET sqlXuatBH trong baocao.js (hai con so khong duoc lech nhau)
     3. KHONG cong nhap lai vao NhapKy/NhapSauKy — so lieu bang tong hop dang DUNG, chi them dong de xem
     4. Dem <th>/<td>/colspan cua bang "Chi tiet theo mau" trong frontend/js/module.khohang.js

   CACH DUNG (trong thu muc backend):
       node utils/kiem_nhap_lai_hang_hoa.js
   Thoat 0 = dat, 1 = co muc khong dat.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const NL = require('./nhapLaiHangHoa');

let dat = 0, truot = 0;
function ok(dieuKien, nhan, chiTiet) {
  if (dieuKien) { dat++; console.log('  OK   ' + nhan); }
  else { truot++; console.log('  TRUOT ' + nhan + (chiTiet ? '  -> ' + chiTiet : '')); }
}
const canBang = s => (s.match(/\(/g) || []).length === (s.match(/\)/g) || []).length;

(async () => {
  console.log('');
  console.log('=== 1. CAC CAU SQL ===');
  const cau = {
    SQL_TONG_THEO_MAU: NL.SQL_TONG_THEO_MAU,
    SQL_CHUNG_TU: NL.SQL_CHUNG_TU,
    SQL_DONG_THEO_MA: NL.SQL_DONG_THEO_MA
  };
  Object.entries(cau).forEach(([ten, s]) => {
    ok(canBang(s), `${ten}: ngoac can bang`,
      `${(s.match(/\(/g) || []).length} mo / ${(s.match(/\)/g) || []).length} dong`);
    ok(/PhieuNhapLaiChiTiet ct/.test(s), `${ten}: doc tu PhieuNhapLaiChiTiet`);
    ok(/JOIN PhieuNhapLai p ON p\.PhieuNLID = ct\.PhieuNLID/.test(s), `${ten}: JOIN dung khoa PhieuNLID`);
    ok(/p\.TrangThai <> N'Đã hủy'/.test(s), `${ten}: BO phieu da huy`);
    /* Quy doi don vi can bang TheKhoHangHoa (DonViCoBan/DonViQuyDoi/LoaiRi) -> phai JOIN bang do. */
    ok(/JOIN TheKhoHangHoa h ON h\.MaHangID = ct\.MaHangID/.test(s), `${ten}: JOIN TheKhoHangHoa de quy don vi`);
    ok(!/undefined|\[object/.test(s), `${ten}: khong co 'undefined' / '[object'`);
  });
  ok(/AS NhapLai\b/.test(cau.SQL_TONG_THEO_MAU) && /GROUP BY ct\.MaHangID, ct\.MauSacID/.test(cau.SQL_TONG_THEO_MAU),
    'Tong theo mau: tra cot NhapLai, GROUP BY (MaHangID, MauSacID)');
  ok(/AS PhatSinh\b/.test(cau.SQL_CHUNG_TU) && /GROUP BY p\.PhieuNLID/.test(cau.SQL_CHUNG_TU),
    'Chung tu: tra cot PhatSinh, gom theo PHIEU (mot phieu nhieu mau -> mot dong)');
  ok(/ORDER BY p\.NgayNhap/.test(cau.SQL_CHUNG_TU), 'Chung tu: sap theo ngay');

  console.log('');
  console.log('=== 2. BIEU THUC QUY DON VI phai GIONG HET sqlXuatBH trong baocao.js ===');
  /* Neu hai bieu thuc lech nhau thi cung mot ma hang se ra hai con so khac nhau o hai man hinh —
     dung kieu lech tung lam mat long tin vao bao cao (ghi chu baocao.js:744-746). */
  const duongBaoCao = path.join(__dirname, '..', 'routes', 'baocao.js');
  const src = fs.readFileSync(duongBaoCao, 'utf8');
  const chuan = s => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim();
  const bieuThucNL = chuan(NL.SL_VE_DON_VI_CHINH);
  /* Lay khoi CASE cua sqlXuatBH: tu 'SUM(CASE WHEN LOWER' den 'END) AS SL' */
  const m = src.match(/SUM\(CASE WHEN LOWER[\s\S]*?END\) AS SL/);
  ok(!!m, 'Tim duoc bieu thuc quy don vi cua sqlXuatBH trong baocao.js');
  if (m) {
    const bieuThucBC = chuan(m[0]).replace(/^SUM\(/, '').replace(/\) AS SL$/, '');
    /* So sanh phan COT LIEU: ca hai deu phai chia h.LoaiRi khi don vi chinh la don vi GOP. */
    const cot = t => t.replace(/\s/g, '');
    ok(cot(bieuThucNL).indexOf('CAST(ct.SoLuongCaiASDECIMAL(18,4))/h.LoaiRi') !== -1,
      'Bieu thuc cua util: chia h.LoaiRi khi don vi chinh la don vi GOP');
    ok(cot(bieuThucBC).indexOf('CAST(ct.SoLuongCaiASDECIMAL(18,4))/h.LoaiRi') !== -1,
      'Bieu thuc cua baocao.js: cung phep chia do');
    ok(cot(bieuThucNL).indexOf('LOWER(LTRIM(RTRIM(h.DonViCoBan)))') !== -1
       && cot(bieuThucNL).indexOf("N'ri'") !== -1,
      'Bieu thuc cua util: so DonViCoBan voi DonViQuyDoi, lui ve N\'ri\' khi chua khai');
    ok(cot(bieuThucNL).indexOf('h.LoaiRi>0') !== -1, 'Co chan LoaiRi > 0 (khong chia cho 0)');
  }

  console.log('');
  console.log('=== 3. KHONG DUOC dung vao phep tinh ton (so lieu dang DUNG) ===');
  /* Nguoi dung da xac nhan: Ton dau ky / Nhap / Xuat / Ton cuoi cua bang tong hop DANG DUNG HET.
     Yeu cau chi la HIEN dong nhap lai. Nen ban nay chi THEM DONG DE XEM, khong sua phep tinh nao. */
  ok(!('SQL_TONG_THEO_MA' in NL) && !('SQL_TONG_THEO_MA_SAU_KY' in NL),
    'Util KHONG con xuat cau tong-theo-ma (cau tung dung de cong vao NhapKy) — khong con duong lam lech ton',
    Object.keys(NL).join(', '));
  ok(!/gomVao\(map, nhapLai/.test(src), 'baocao.js KHONG gomVao nhap lai vao NhapKy/NhapSauKy');
  ok(/KHONG cong nhap lai vao NhapKy/.test(src), 'baocao.js co ghi chu canh bao de sau nay khong ai cong lai');
  /* Dong nhap lai o bang chi tiet phai la NHAP (duong), khong duoc ghi vao cot Xuat */
  const iDong = src.indexOf("Loai: 'Nhập lại (khách trả)'");
  ok(iDong !== -1, 'baocao.js co dong chung tu "Nhập lại (khách trả)"');
  if (iDong !== -1) {
    const doan = src.slice(iDong - 200, iDong + 300);
    ok(/Nhap: lam2\(r\.PhatSinh\)/.test(doan), 'Dong nhap lai ghi vao cot NHAP (khong phai Xuat)');
    ok(/Xuat: 0/.test(doan), 'Dong nhap lai co Xuat = 0');
    ok(/SoPhieu: r\.SoPhieu/.test(doan) && /DoiTuong: r\.TenKhach/.test(doan),
      'Dong nhap lai co so phieu + ten khach de doi chieu');
  }

  console.log('');
  console.log('=== 3b. DONG NHAP LAI XEN VAO BANG "Lich su dat hang" (v7.39) ===');
  ok(/p\.TrangThai/.test(cau.SQL_DONG_THEO_MA),
    'SQL_DONG_THEO_MA lay TRANG THAI THAT cua phieu nhap lai (khong gan cung chuoi)');
  ok(!/GROUP BY/.test(cau.SQL_DONG_THEO_MA),
    'KHONG gom nhom — mot phieu tra nhieu mau phai thay tung mau');
  ok(/LEFT JOIN MauSac/.test(cau.SQL_DONG_THEO_MA),
    'JOIN mau bang LEFT (dong khong co mau van ra, khong bi mat)');
  const kho = fs.readFileSync(path.join(__dirname, '..', 'routes', 'khohang.js'), 'utf8');
  ok(/DonID: null, LaNhapLai: true/.test(kho),
    'khohang.js: dong nhap lai co DonID = null va co LaNhapLai (de frontend an nut thao tac)');
  ok(/SoLuongDat: -\(Number\(r\.SL\)/.test(kho), 'khohang.js: so luong doi dau thanh AM');
  ok(/TrangThai: r\.TrangThai/.test(kho), 'khohang.js: dung trang thai that cua phieu');
  ok(/SoPhieuBH: r\.SoPhieu/.test(kho), 'khohang.js: cot "Phieu ban hang" nhan so PHIEU NHAP LAI');
  ok(/new Date\(b\.ThoiGian\) - new Date\(a\.ThoiGian\)/.test(kho),
    'khohang.js: tron xong SAP LAI theo thoi gian giam dan (dong nhap lai nam dung mach thoi gian)');
  const feAll = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'js', 'module.khohang.js'), 'utf8');
  ok(/if \(r\.LaNhapLai\) return '<span class="empty-hint"/.test(feAll),
    'module.khohang.js: o Thao tac AN HET nut voi dong nhap lai (khong co DonID -> bam se im lang)');
  ok(/nhomCua = \(r\) => \(r\.LaNhapLai \? 'nhapLai'/.test(feAll),
    'module.khohang.js: dong Tong co NHOM RIENG cho nhap lai — de roi vao nhom "cho" thi so AM se TRU sai');
  ok(/Khách trả lại:/.test(feAll), 'module.khohang.js: dong Tong in ra nhom "Khách trả lại"');
  ok(/soDon = ds\.length - demDon\.nhapLai/.test(feAll),
    'module.khohang.js: dem "don" khong tinh dong nhap lai (do la phieu, khong phai don khach)');
  ok(/'Hoàn thành'\]/.test(feAll), 'module.khohang.js: bo loc trang thai co "Hoàn thành"');
  /* v7.39.1: bam so phieu nhap lai -> mo chi tiet */
  ok(/act-h-phieunl/.test(feAll), 'module.khohang.js: so phieu nhap lai la link bam duoc (act-h-phieunl)');
  ok(/window\.ModuleNhapLai && typeof window\.ModuleNhapLai\.xemPhieu === 'function'/.test(feAll),
    'Goi qua window.ModuleNhapLai va KIEM TON TAI truoc (xemPhieu la bien cuc bo cua module.nhaplai.js)');
  ok(/Không mở được phiếu nhập lại/.test(feAll), 'Co bat loi + toast (khong de nut "im lang")');
  ok(/color:#c0392b;font-weight:700/.test(feAll), 'So luong nhap lai in MAU DO');
  /* Be rong cot: Thao tac phai la 160px (mot nua cua 320px) va khong con 320px sot lai */
  const iTd = feAll.indexOf('<th style="width:92px">Thời gian</th>');
  ok(iTd !== -1, 'Dong tieu de bang lich su da khai be rong cot');
  if (iTd !== -1) {
    const doanTd = feAll.slice(iTd, iTd + 500);
    ok(/width:160px">Thao tác/.test(doanTd), 'Cot Thao tac = 160px', doanTd.match(/width:\d+px">Thao tác/));
    ok(!/width:320px/.test(doanTd), 'Khong con 320px sot lai');
    const soTh = (doanTd.slice(0, doanTd.indexOf('</tr>')).match(/<th/g) || []).length;
    ok(soTh === 8, 'Dong tieu de van dung 8 <th> (khong lam mat/them cot)', 'dem=' + soTh);
  }

  console.log('');
  console.log('=== 4. DEM COT bang "Chi tiet theo mau" (module.khohang.js) ===');
  const fe = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'js', 'module.khohang.js'), 'utf8');
  const iTieuDe = fe.indexOf('<th>Ảnh</th><th>Ghi chú</th><th>Màu</th>');
  ok(iTieuDe !== -1, 'Tim duoc dong tieu de cua bang');
  if (iTieuDe !== -1) {
    const dongTD = fe.slice(iTieuDe, fe.indexOf('</thead>', iTieuDe));
    const soTh = (dongTD.match(/<th/g) || []).length;
    ok(soTh === 8, 'Dong tieu de co dung 8 <th> (them cot "Nhap lai")', 'dem=' + soTh);
    ok(/<th>Nhập lại<\/th>/.test(dongTD), 'Co <th>Nhập lại</th>');
    /* Than bang: tu sau </thead> den </table> dau tien */
    const iThan = fe.indexOf('</thead>', iTieuDe);
    const than = fe.slice(iThan, fe.indexOf('</table>', iThan));
    /* CHI dem o cua DONG DU LIEU. Phai TRU o `<td colspan="...">` cua dong "chua co du lieu" —
       ban dau tinh ca no nen bao 9/8 va tuong bang sai, trong khi bang dung. */
    const soTdTong = (than.match(/<td/g) || []).length;
    const soTdGop = (than.match(/<td colspan=/g) || []).length;
    const soTd = soTdTong - soTdGop;
    ok(soTd === 8, 'Mot dong du lieu co dung 8 <td>', `dem=${soTd} (tong ${soTdTong} - ${soTdGop} o colspan)`);
    const cs = than.match(/colspan="(\d+)"/);
    ok(cs && cs[1] === '8', 'colspan cua dong "chua co du lieu" = 8', cs ? cs[1] : 'khong tim thay');
    ok(/c\.NhapLai/.test(than), 'Than bang co doc c.NhapLai (backend tra ve truong nay)');
    ok(/đã trừ .*trả lại/.test(than), 'Co dong phu giai thich vi sao cot Xuat thap hon tong phieu ban');
  }

  console.log('');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  console.log(truot ? '>> CO MUC KHONG DAT - phai sua truoc khi giao.' : '>> DAT TAT CA.');
  process.exit(truot ? 1 : 0);
})().catch(err => { console.error('LOI KIEM CHUNG: ' + err.stack); process.exit(1); });
