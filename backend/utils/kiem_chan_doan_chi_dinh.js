/* ================================================================================================
   KIEM CHUNG BA TANG PHONG VE CHONG "LECH ID TRUNG TEN"                                    v7.37
   ------------------------------------------------------------------------------------------------
   KHONG CAN CSDL. Goi DUNG cac ham that trong utils/chanDoanChiDinhVai.js voi pool GIA.

   Kiem:
     1. phanLoai() — 8 canh, moi canh phai ra DUNG mot nhan (thu tu uu tien khong duoc dao)
     2. timIdTheoTen() — sinh SQL so ten CHUAN HOA (bo het khoang trang) va UU TIEN ban co cay vai
     3. chanDoanDon() — 6 phep dem cua cau SQL deu co, khong cau nao lech ngoac
     4. danhMucTrungTen() — sinh 2 cau, co cot SoCay de biet ban nao dang giu hang

   CACH DUNG (trong thu muc backend):
       node utils/kiem_chan_doan_chi_dinh.js
       node utils/kiem_chan_doan_chi_dinh.js --sql     (in kem cac cau SQL sinh ra)
   Thoat 0 = dat, 1 = co muc khong dat.
   ================================================================================================ */
const { chanDoanDon, phanLoai, danhMucTrungTen, timIdTheoTen } = require('./chanDoanChiDinhVai');
const inSQL = process.argv.includes('--sql');

let dat = 0, truot = 0;
function ok(dieuKien, nhan, chiTiet) {
  if (dieuKien) { dat++; console.log('  OK   ' + nhan); }
  else { truot++; console.log('  TRUOT ' + nhan + (chiTiet ? '  -> ' + chiTiet : '')); }
}
const sqlGia = { Int: 'Int', NVarChar: 'NVarChar' };
function poolGia(traLoi) {
  const daChay = [];
  const req = () => {
    const thamSo = {};
    const r = {
      input(t, k, v) { thamSo[t] = v; return r; },
      async query(text) { daChay.push(String(text)); return { recordset: traLoi(String(text), thamSo) || [] }; }
    };
    return r;
  };
  return { request: req, daChay };
}
/* Dong mac dinh: khong khop gi ca. Tung canh chi ghi de vai con so. */
const DONG0 = {
  Id: 1, TenPhieu: 'Vải áo', Kieu: 'Chính', LoaiVaiID: 2153, MauSacID: 7405,
  TenLoaiVai: 'Thô karo Thắng Liên 6111', TenMau: 'Thắng Liên kẻ xanh 4',
  SoKGYeuCau: 167, SoMet: 167, DVTVaiYeuCau: 'Kg',
  KhopID_ConHang: 0, KhopID_ChiConMet: 0, KhopID_HetHan: 0,
  KhopTen_ConHang: 0, KhopTenLoai_ConHang: 0, KhopTenMau_ConHang: 0
};

(async () => {
  console.log('');
  console.log('=== 1. phanLoai(): moi canh ra dung MOT nhan ===');
  const canh = [
    { ten: 'Khop ID va con hang', ghi: { KhopID_ConHang: 3 }, nhan: '', xuatDuoc: true },
    { ten: 'Thieu MauSacID (go tu do)', ghi: { MauSacID: null, TenMau: null }, nhan: 'THIEU-ID' },
    { ten: 'Thieu LoaiVaiID', ghi: { LoaiVaiID: null, TenLoaiVai: null }, nhan: 'THIEU-ID' },
    { ten: 'LECH ID trung ten (benh chinh)', ghi: { KhopTen_ConHang: 5 }, nhan: 'LECH-ID' },
    { ten: 'Con MET nhung KG = 0', ghi: { KhopID_ChiConMet: 2 }, nhan: 'CON-MET-KG-0' },
    { ten: 'Khop ID nhung het ca KG va MET', ghi: { KhopID_HetHan: 2 }, nhan: 'HET-THAT' },
    { ten: 'Cung ten LOAI, khac mau', ghi: { KhopTenLoai_ConHang: 4 }, nhan: 'LECH-MAU' },
    { ten: 'Cung ten MAU, khac loai', ghi: { KhopTenMau_ConHang: 4 }, nhan: 'LECH-LOAI' },
    { ten: 'Kho chua co gi', ghi: {}, nhan: 'CHUA-NHAP' }
  ];
  canh.forEach(c => {
    const r = phanLoai({ ...DONG0, ...c.ghi });
    ok(r.nhan === c.nhan, `${c.ten} -> nhan "${c.nhan || '(xuat duoc)'}"`, `ra "${r.nhan}"`);
    if (c.xuatDuoc) ok(r.xuatDuoc === true, '   xuatDuoc = true');
    else {
      ok(r.xuatDuoc === false, '   xuatDuoc = false');
      ok(typeof r.lyDo === 'string' && r.lyDo.length > 20, '   co ly do bang tieng Viet, du dai de doc',
        JSON.stringify(r.lyDo));
    }
  });

  console.log('');
  console.log('=== 2. Thu tu uu tien nhan: LECH-ID phai THANG CON-MET-KG-0 ===');
  /* Mot dong co the vua co cay "chi con met" khop ID, vua co cay khop TEN o ID khac. Uu tien phai la
     LECH-ID vi do la thu SUA DUOC ngay (gop danh muc), con CON-MET-KG-0 chi la may chua cap nhat. */
  const caHai = phanLoai({ ...DONG0, KhopID_ChiConMet: 2, KhopTen_ConHang: 5 });
  ok(caHai.nhan === 'LECH-ID', 'Vua lech ID vua con-met -> bao LECH-ID (thu sua duoc ngay)', caHai.nhan);
  /* THIEU-ID phai thang tat ca: khong co ID thi moi phep dem theo ID deu vo nghia. */
  const thieu = phanLoai({ ...DONG0, MauSacID: null, KhopTen_ConHang: 5, KhopID_ChiConMet: 2 });
  ok(thieu.nhan === 'THIEU-ID', 'Thieu ID -> bao THIEU-ID truoc moi nhan khac', thieu.nhan);
  /* Nhung "khop ID va con hang" phai thang CA THIEU-ID: neu da xuat duoc thi khong phai loi. */
  const xuatDuocDu = phanLoai({ ...DONG0, KhopID_ConHang: 1, MauSacID: null });
  ok(xuatDuocDu.xuatDuoc === true && xuatDuocDu.nhan === '',
    'Da khop cay va con hang -> KHONG bao loi du thieu ID', JSON.stringify(xuatDuocDu.nhan));

  console.log('');
  console.log('=== 3. Ghi chu "chua khai KG lan MET" ===');
  const khongSo = phanLoai({ ...DONG0, SoKGYeuCau: null, SoMet: null });
  ok(/chưa khai KG lẫn số mét/.test(khongSo.lyDo), 'Dong khong khai KG lan MET -> noi them trong ly do',
    khongSo.lyDo);
  const coSo = phanLoai({ ...DONG0 });
  ok(!/chưa khai KG lẫn số mét/.test(coSo.lyDo), 'Dong da khai so thi KHONG noi cau do');

  console.log('');
  console.log('=== 4. timIdTheoTen(): so ten CHUAN HOA + uu tien ban co cay vai ===');
  const p1 = poolGia(() => [{ Id: 2144 }]);
  const id = await timIdTheoTen(p1, sqlGia, 'LoaiVai', 'LoaiVaiID', 'TenLoaiVai', 'LoaiVaiID',
    '  Thô karo   Thắng Liên 6111  ');
  ok(id === 2144, 'Ten co khoang trang dau/doi van tim ra ban da co (2144), KHONG tao moi', String(id));
  const cau = p1.daChay[0] || '';
  ok(/REPLACE\(LOWER\(LTRIM\(RTRIM/.test(cau), 'Cau SQL so theo ten DA CHUAN HOA (bo khoang trang, ha thuong)');
  ok(/ORDER BY[\s\S]*VaiCay[\s\S]*DESC/.test(cau),
    'ORDER BY uu tien ban DANG CO CAY VAI (dem VaiCay) truoc', cau.replace(/\s+/g, ' ').slice(0, 200));
  ok(/DanhMucVai[\s\S]*DESC/.test(cau), 'Roi den ban co nhieu ma vai');
  ok(/TOP 1/.test(cau), 'Chi lay 1 ban (TOP 1)');
  const mo = (cau.match(/\(/g) || []).length, dong = (cau.match(/\)/g) || []).length;
  ok(mo === dong, `Ngoac can bang (${mo}/${dong})`);
  /* Ten rong -> khong truy van gi */
  const p2 = poolGia(() => []);
  ok((await timIdTheoTen(p2, sqlGia, 'LoaiVai', 'LoaiVaiID', 'TenLoaiVai', 'LoaiVaiID', '   ')) === null
     && p2.daChay.length === 0, 'Ten rong -> tra null va KHONG chay cau SQL nao');
  /* Khong tim thay -> tra null de ben goi tu INSERT */
  const p3 = poolGia(() => []);
  ok((await timIdTheoTen(p3, sqlGia, 'MauSac', 'MauSacID', 'TenMau', 'MauSacID', 'Mau moi chua co')) === null,
    'Chua co ten do -> tra null (ben goi se INSERT)');

  console.log('');
  console.log('=== 5. chanDoanDon(): cau SQL co du 6 phep dem ===');
  const pd = poolGia(() => [{ ...DONG0 }]);
  const kq = await chanDoanDon(pd, sqlGia, 5076);
  ok(Array.isArray(kq) && kq.length === 1, 'Tra ve mang cac dong da phan loai');
  ok(kq[0].nhan === 'CHUA-NHAP', 'Dong mac dinh (khong khop gi) -> CHUA-NHAP', kq[0].nhan);
  const cd = pd.daChay[0] || '';
  ['KhopID_ConHang', 'KhopID_ChiConMet', 'KhopID_HetHan',
    'KhopTen_ConHang', 'KhopTenLoai_ConHang', 'KhopTenMau_ConHang']
    .forEach(c => ok(cd.indexOf(c) !== -1, '   co phep dem ' + c));
  ok(/KGCon > 0 OR .*MetCon > 0/.test(cd), '   "con hang" tinh CA MET (khong chi KGCon)');
  ok(/LEFT JOIN LoaiVai/.test(cd) && /LEFT JOIN MauSac/.test(cd),
    '   JOIN danh muc bang LEFT (dong thieu ID van ra, khong bi bien mat)');
  const mo2 = (cd.match(/\(/g) || []).length, dong2 = (cd.match(/\)/g) || []).length;
  ok(mo2 === dong2, `   ngoac can bang (${mo2}/${dong2})`);
  if (inSQL) console.log('\n----- SQL chanDoanDon -----\n' + cd.trim());

  console.log('');
  console.log('=== 6. danhMucTrungTen(): 2 cau, co cot SoCay ===');
  const pt = poolGia(() => []);
  const tr = await danhMucTrungTen(pt);
  ok(tr && Array.isArray(tr.loaiVai) && Array.isArray(tr.mauSac), 'Tra ve { loaiVai, mauSac }');
  ok(pt.daChay.length === 2, 'Chay dung 2 cau (loai vai + mau)', 'so cau=' + pt.daChay.length);
  pt.daChay.forEach((c, i) => {
    ok(/SoCay/.test(c), `   cau ${i + 1} co cot SoCay (de biet ban nao dang giu hang)`);
    ok(/SoChiDinh/.test(c), `   cau ${i + 1} co cot SoChiDinh`);
    const a = (c.match(/\(/g) || []).length, b = (c.match(/\)/g) || []).length;
    ok(a === b, `   cau ${i + 1} ngoac can bang (${a}/${b})`);
  });
  if (inSQL) pt.daChay.forEach((c, i) => console.log(`\n----- SQL danhMucTrungTen #${i + 1} -----\n` + c.trim()));

  console.log('');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  console.log(truot ? '>> CO MUC KHONG DAT - phai sua truoc khi giao.' : '>> DAT TAT CA.');
  process.exit(truot ? 1 : 0);
})().catch(err => { console.error('LOI KIEM CHUNG: ' + err.stack); process.exit(1); });
