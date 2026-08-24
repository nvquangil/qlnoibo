/* ================================================================================================
   KIEM CHUNG "CONG NO TRUOC CHUNG TU" (dung chung phieu ban hang + phieu nhap lai)          v7.41
   ------------------------------------------------------------------------------------------------
   KHONG CAN CSDL. Goi DUNG ham that (utils/congNoTruocChungTu.js) voi pool GIA, kiem:
     1. Cong thuc: truoc = ban + dieu chinh - da thu - tra lai
     2. MOC "truoc chung tu": bang CUA CHINH chung tu thi so ca ID cung ngay; bang KHAC chi so ngay
     3. Ket qua cho phieu ban hang GIONG HET ban cu trong banhang.js (khong doi so lieu dang chay)
     4. DAU: ban hang lam TANG no, nhap lai lam GIAM no
     5. Thieu bang PhieuNhapLai -> khong nem loi, coi nhu tra lai = 0
     6. Frontend in du 3 dong va khong tu tinh lai TongCongNo

   CACH DUNG (trong thu muc backend):
       node utils/kiem_cong_no_truoc.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const { congNoTruocChungTu } = require('./congNoTruocChungTu');

let dat = 0, truot = 0;
function ok(dieuKien, nhan, chiTiet) {
  if (dieuKien) { dat++; console.log('  OK   ' + nhan); }
  else { truot++; console.log('  TRUOT ' + nhan + (chiTiet ? '  -> ' + chiTiet : '')); }
}
const sqlGia = { NVarChar: 'NVarChar', Date: 'Date', Int: 'Int' };

/* Pool gia: tra so theo kich ban + ghi lai cau SQL de kiem moc so sanh. */
function poolGia({ ban = 0, dc = 0, thu = 0, traLai = 0, loiNhapLai = false } = {}) {
  const daChay = [];
  const req = () => {
    const r = {
      input() { return r; },
      async query(text) {
        const t = String(text);
        daChay.push(t);
        if (/FROM PhieuNhapLai\b/.test(t)) {
          if (loiNhapLai) throw new Error("Invalid object name 'PhieuNhapLai'.");
          return { recordset: [{ S: traLai }] };
        }
        return { recordset: [{ BanTruoc: ban, DieuChinhTruoc: dc, ThuTruoc: thu }] };
      }
    };
    return r;
  };
  return { request: req, daChay };
}

(async () => {
  console.log('');
  console.log('=== 1. CONG THUC ===');
  const p = poolGia({ ban: 100000000, dc: 5000000, thu: 30000000, traLai: 2000000 });
  const kq = await congNoTruocChungTu(p, sqlGia, { tenKhach: 'A', ngay: '2026-08-01', loai: 'PBH', id: 10 });
  ok(kq.congNoTruoc === 73000000,
    'truoc = 100tr + 5tr - 30tr - 2tr = 73.000.000', String(kq.congNoTruoc));
  ok(kq.banTruoc === 100000000 && kq.dieuChinhTruoc === 5000000
     && kq.thuTruoc === 30000000 && kq.traLaiTruoc === 2000000,
    'Tra ve DU 4 thanh phan de doi chieu khi lech');
  const p0 = poolGia({});
  ok((await congNoTruocChungTu(p0, sqlGia, { tenKhach: 'A', ngay: '2026-08-01', loai: 'PBH', id: 1 })).congNoTruoc === 0,
    'Khach moi (khong phat sinh gi) -> 0, khong phai null');

  console.log('');
  console.log('=== 2. MOC "TRUOC CHUNG TU NAY" ===');
  /* Phieu BAN HANG: bang PhieuBanHang so ca ID cung ngay; bang PhieuNhapLai chi so ngay. */
  const pB = poolGia({});
  await congNoTruocChungTu(pB, sqlGia, { tenKhach: 'A', ngay: '2026-08-01', loai: 'PBH', id: 7 });
  const cauB = pB.daChay.join('\n');
  ok(/NgayBan = @ngay AND PhieuBHID < @id/.test(cauB),
    'Xem phieu BAN HANG: bang PhieuBanHang so ca "cung ngay ma PhieuBHID nho hon"');
  ok(!/NgayNhap = @ngay AND PhieuNLID < @id/.test(cauB),
    'Xem phieu BAN HANG: bang PhieuNhapLai CHI so ngay (khong so ID cheo bang)');
  /* Phieu NHAP LAI: dao lai. */
  const pN = poolGia({});
  await congNoTruocChungTu(pN, sqlGia, { tenKhach: 'A', ngay: '2026-08-01', loai: 'PNL', id: 7 });
  const cauN = pN.daChay.join('\n');
  ok(/NgayNhap = @ngay AND PhieuNLID < @id/.test(cauN),
    'Xem phieu NHAP LAI: bang PhieuNhapLai so ca "cung ngay ma PhieuNLID nho hon"');
  ok(!/NgayBan = @ngay AND PhieuBHID < @id/.test(cauN),
    'Xem phieu NHAP LAI: bang PhieuBanHang CHI so ngay');
  /* Ca hai canh: dieu chinh va phieu thu LUON chi so ngay */
  [cauB, cauN].forEach((c, i) => {
    ok(/CongNoDieuChinh[\s\S]*?Ngay < @ngay/.test(c), `Canh ${i + 1}: dieu chinh chi so ngay`);
    ok(/PhieuThu[\s\S]*?NgayThu < @ngay/.test(c), `Canh ${i + 1}: phieu thu chi so ngay`);
    ok(/TrangThai <> N'Đã hủy'/.test(c), `Canh ${i + 1}: BO phieu da huy`);
    ok(/LTRIM\(RTRIM\(TenKhach\)\) = @ten/.test(c), `Canh ${i + 1}: gom theo TEN KHACH da TRIM`);
  });

  console.log('');
  console.log('=== 3. GIONG HET ban cu trong banhang.js (khong doi so dang chay) ===');
  /* Ban cu: banTruoc + dieuChinhTruoc - thuTruoc - traLaiTruoc, moc y nhu tren.
     Mo phong lai cong thuc cu BANG TAY roi so voi ham moi. */
  const canh = [
    { ban: 0, dc: 0, thu: 0, traLai: 0 },
    { ban: 50000000, dc: 0, thu: 0, traLai: 0 },
    { ban: 50000000, dc: 0, thu: 50000000, traLai: 0 },
    { ban: 80000000, dc: 1000000, thu: 20000000, traLai: 5000000 },
    { ban: 10000000, dc: 0, thu: 30000000, traLai: 0 }        // thu qua -> cong no AM
  ];
  for (const c of canh) {
    const moi = (await congNoTruocChungTu(poolGia(c), sqlGia,
      { tenKhach: 'A', ngay: '2026-08-01', loai: 'PBH', id: 9 })).congNoTruoc;
    const cu = c.ban + c.dc - c.thu - c.traLai;
    ok(moi === cu, `ban=${c.ban} dc=${c.dc} thu=${c.thu} traLai=${c.traLai} -> ${cu}`,
      `moi=${moi} cu=${cu}`);
  }

  console.log('');
  console.log('=== 4. DAU: ban hang TANG no, nhap lai GIAM no ===');
  const truoc = 73000000, tienPhieu = 3000000;
  ok(truoc + tienPhieu === 76000000, 'Phieu BAN HANG: TongCongNo = truoc + tien phieu = 76.000.000');
  ok(truoc - tienPhieu === 70000000, 'Phieu NHAP LAI: CongNoHienTai = truoc - tien phieu = 70.000.000');
  /* Kiem code THAT trong nhaplai.js dung dau TRU */
  const nl = fs.readFileSync(path.join(__dirname, '..', 'routes', 'nhaplai.js'), 'utf8');
  ok(/TongCongNo = lam2\(kqNo\.congNoTruoc - so\(h\.TongThanhToan\)\)/.test(nl),
    'nhaplai.js dung DAU TRU (tra hang giam no)');
  ok(/loai: 'PNL'/.test(nl), "nhaplai.js truyen loai: 'PNL'");
  ok(/h\.CongNoTruoc = null/.test(nl),
    'Loi tinh cong no -> tra null de frontend bao "(khong lay duoc)", khong im lang ra 0');
  const bh = fs.readFileSync(path.join(__dirname, '..', 'routes', 'banhang.js'), 'utf8');
  ok(/loai: 'PBH'/.test(bh), "banhang.js truyen loai: 'PBH'");
  ok(/congNoTruoc \+ so\(header\.TongThanhToan\)/.test(bh), 'banhang.js van dung DAU CONG');
  ok(!/AS BanTruoc/.test(bh),
    'banhang.js KHONG con ban SQL rieng (da dung ham chung) -> hai phieu khong the lech nhau');

  console.log('');
  console.log('=== 5. THIEU BANG PhieuNhapLai (chua chay migration_v676) ===');
  const pL = poolGia({ ban: 40000000, loiNhapLai: true });
  const kqL = await congNoTruocChungTu(pL, sqlGia, { tenKhach: 'A', ngay: '2026-08-01', loai: 'PBH', id: 3 });
  ok(kqL.congNoTruoc === 40000000, 'Khong nem loi, coi nhu tra lai = 0', String(kqL.congNoTruoc));
  ok(kqL.traLaiTruoc === 0, 'traLaiTruoc = 0');

  console.log('');
  console.log('=== 6. FRONTEND: khoi cong no phieu nhap lai ===');
  const fe = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'js', 'module.nhaplai.js'), 'utf8');
  ok(/function khoiCongNoNhapLaiHtml/.test(fe), 'Co ham khoiCongNoNhapLaiHtml');
  ok(/Công nợ trước phiếu/.test(fe), 'In dong "Công nợ trước phiếu"');
  ok(/Hàng trả lại \(trừ công nợ\)/.test(fe), 'In dong "Hàng trả lại (trừ công nợ)"');
  ok(/CÔNG NỢ HIỆN TẠI/.test(fe), 'In dong "CÔNG NỢ HIỆN TẠI"');
  ok(/\(không lấy được\)/.test(fe), 'Thieu du lieu -> in dong do bao ro (khong bo mat khoi)');
  ok(/chưa phát sinh/.test(fe), 'Cong no truoc = 0 VAN in ra dong, ghi "chưa phát sinh"');
  ok(/fmtTien\(h\.TongCongNo\)/.test(fe),
    'In TongCongNo do BACKEND tinh — frontend KHONG tu tinh lai (hai noi khong the lech)');
  /* Phai co ca o modal XEM va ban IN.
     ⚠️ Phai TRU dinh nghia ham: `function khoiCongNoNhapLaiHtml(h)` cung khop mau `...Html(h)` nen
     dem tho se ra 3 va tuong thieu/thua mot cho, trong khi code dung. */
  const soKhop = (fe.match(/khoiCongNoNhapLaiHtml\(h\)/g) || []).length;
  const soKhai = (fe.match(/function\s+khoiCongNoNhapLaiHtml\(h\)/g) || []).length;
  const soLanDung = soKhop - soKhai;
  ok(soLanDung === 2, 'Dung o CA modal xem VA ban in (2 cho)',
    `dem=${soLanDung} (khop ${soKhop} - khai bao ${soKhai})`);

  console.log('');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  console.log(truot ? '>> CO MUC KHONG DAT - phai sua truoc khi giao.' : '>> DAT TAT CA.');
  process.exit(truot ? 1 : 0);
})().catch(err => { console.error('LOI KIEM CHUNG: ' + err.stack); process.exit(1); });
