/* ================================================================================================
   KIEM CHUNG v9.08 — HANG MAU: "KHACH MUA LUON" (chot ban o cap DONG)
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-27: "nhung mau khach mua luon thi xu ly nhu the nao de theo doi" -> chot: danh dau
   o CAP DONG, theo SO LUONG. Kem: phieu nhap lai gan nhan "Gui mau".

   🔴 BAT BIEN SONG CON cua tinh nang nay — MOT CONG THUC, HAI MAN:
        Con o khach / Con tra duoc = SoLuongCai - DaTraCai - MauDaChotCai
      Chi tinh o utils/dongDaBanChoKhach.js. Thieu ve tru MauDaChotCai o do la hang khach da MUA DUT
      van tra lai duoc => ton kho tang khong, tien khong doi. Day la loi TIEN, khong phai loi giao dien.

   BON CHO DE SAI:
     1. Tru thieu MauDaChotCai (bat biên tren).
     2. Route chot lo dung vao tien/ton (tuyet doi khong duoc — phieu gui mau DA tru ton + ghi cong no).
     3. Nhan so CONG DON thay vi SO TUYET DOI => bam nham khong lui lai duoc.
     4. Khong do cot => CSDL chua chay migration_v884 la vo 500 thay vi chay nhu cu.

   Chay:  node backend\utils\kiem_chot_ban_hang_mau.js   (tu thu muc goc QLNoiBo)
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m) => (dk ? OK(m) : NO(m));

const boComment = (s) => s
  .replace(/(^|[\s{(:;,=])\/\*[\s\S]*?\*\//g, '$1 ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const sUtil = doc('utils/dongDaBanChoKhach.js');
const sBH = doc('routes/banhang.js');
const sNL = doc('routes/nhaplai.js');
const sFeKH = doc('../frontend/js/module.khohang.js');
const sFeNL = doc('../frontend/js/module.nhaplai.js');
const sMig = doc('../database/migration_v884.sql');
const sCaiDat = doc('../database/CAI_DAT_DAY_DU.sql');
const sIndex = doc('../frontend/index.html');
const mUtil = boComment(sUtil), mBH = boComment(sBH), mNL = boComment(sNL);
const mFeKH = boComment(sFeKH), mFeNL = boComment(sFeNL);

console.log('\n=== 0. Cac file JS PHAI parse duoc (vm.Script — thay node --check) ===');
[['utils/dongDaBanChoKhach.js', sUtil], ['routes/banhang.js', sBH], ['routes/nhaplai.js', sNL],
 ['module.khohang.js', sFeKH], ['module.nhaplai.js', sFeNL]].forEach(([ten, src]) => {
  try { new (require('vm').Script)(src, { filename: ten }); OK(ten + ' parse duoc'); }
  catch (e) { NO(ten + ' KHONG parse duoc: ' + e.message); }
});

console.log('\n=== 1. BAT BIEN: mot cong thuc, tru du ba ve ===');
kiem(/ConTraCai: Math\.max\(0, so\(r\.SoLuongCai\) - so\(r\.DaTraCai\) - so\(r\.MauDaChotCai\)\)/.test(mUtil),
  'ConTraCai = SoLuongCai - DaTraCai - MauDaChotCai (TRU DU BA VE)');
/* Chi duoc co DUNG MOT cho tinh con so nay trong ca he thong. */
const demCongThuc = (mUtil.match(/so\(r\.SoLuongCai\) - so\(r\.DaTraCai\)/g) || []).length;
kiem(demCongThuc === 1, `chi MOT cho tinh ConTraCai trong util  [dem: ${demCongThuc}]`);
/* ⚠️ Regex phai noi long (co "|| 0)" chen giua) — ban dau viet chat qua nen BO SOT dung mot cho
   that o module.khohang.js, bao OK oan (ra cheo v9.08 bat duoc). Ngoai le DUY NHAT duoc phep la
   `toiDa` — tran CHOT (da gui - da tra), khong phai "con o khach"; no phai mang comment danh dau. */
[['routes/banhang.js', mBH], ['routes/nhaplai.js', mNL], ['module.khohang.js', mFeKH], ['module.nhaplai.js', mFeNL]]
  .forEach(([ten, s]) => {
    const pham = (s.match(/SoLuongCai[^\n;]{0,24}[-−]\s*\w*(daTra|DaTraCai)/g) || []);
    const laTranChot = ten === 'module.khohang.js' && pham.length === 1
      && /const toiDa = Math\.max\(0, Number\(r\.SoLuongCai \|\| 0\) - daTra\);\s*\/\/ chốt \+ đã trả/.test(sFeKH);
    kiem(pham.length === 0 || laTranChot,
      `${ten}: KHONG tu tinh lai "con o khach" (chi duoc phep mot ngoai le co ten: tran chot toiDa)  [thay: ${pham.length}]`);
  });
kiem(/function coCotMauChot/.test(mUtil) && /COL_LENGTH\('PhieuBanHangChiTiet','MauDaChotCai'\)/.test(mUtil),
  'co do cot MauDaChotCai — CSDL chua chay migration van chay nhu cu');
kiem(/coChot \? 'ISNULL\(ct\.MauDaChotCai, 0\)' : 'CAST\(0 AS INT\)'/.test(mUtil),
  'chua co cot thi MauDaChotCai = 0 (khong phai NULL — NULL vao phep tru la ra NaN)');
kiem(/coCotMauChot/.test(mUtil.slice(mUtil.indexOf('module.exports'))), 'coCotMauChot duoc export');

console.log('\n=== 2. Route chot: KHONG dung vao tien / ton ===');
const iR = mBH.indexOf("router.put('/hangmau/chot/:ctId'");
kiem(iR >= 0, 'co route PUT /hangmau/chot/:ctId');
const iRHet = iR >= 0 ? mBH.indexOf('\n  });', iR) : -1;
kiem(iR >= 0 && iRHet > iR, 'cat duoc dung than route');
const rChot = iR >= 0 && iRHet > iR ? mBH.slice(iR, iRHet + 6) : '';
kiem(/requirePermission\('KHOHANG', 'edit'\)/.test(rChot) && /requireChucNang\('KHOHANG', 'hangmau'\)/.test(rChot),
  'gate: KHOHANG/edit + chuc nang hangmau');
/* 🔴 Tuyet doi khong duoc dung vao tien/ton o route nay. */
kiem(!/ghiXuatKho|TheKhoChiTietMau|PhieuThu|TongThanhToan\s*=|ThanhTien\s*=/.test(rChot),
  'KHONG dung vao ton kho / tien / phieu thu');
const demUpdate = (rChot.match(/UPDATE /g) || []).length;
kiem(demUpdate === 1 && /UPDATE PhieuBanHangChiTiet/.test(rChot),
  `chi MOT lenh UPDATE, dung vao PhieuBanHangChiTiet  [dem: ${demUpdate}]`);
kiem(/WHERE ID = @id/.test(rChot), 'UPDATE bam theo DUNG dong (ID), khong theo ma hang + mau');
kiem(/soCai \+ daTra > daGui/.test(rChot), 'chan chot + da tra > da gui');
kiem(/LaHangMau/.test(rChot) && /khong phai phi|không phải phiếu GỬI MẪU/i.test(rChot),
  'chan chot tren phieu KHONG phai gui mau');
kiem(/Đã hủy/.test(rChot), 'chan chot tren phieu da huy');
kiem(/migration_v884/.test(rChot), 'chua chay migration thi bao ro ten file migration');
/* So TUYET DOI: doc soCai tu body roi GAN THANG, khong cong don. */
kiem(/MauDaChotCai = NULLIF\(@sl, 0\)/.test(rChot),
  'ghi SO TUYET DOI (go 0 = bo danh dau), KHONG cong don');
kiem(/ISNULL\(MauChotNgay, CAST\(GETDATE\(\) AS DATE\)\)/.test(rChot),
  'ngay chot giu lan dau, sua so luong khong lam troi ngay');

console.log('\n=== 2b. 🔴 SUA PHIEU BAN HANG phai CHAN khi da co "doi sau" bam vao ID dong ===');
/* Sua phieu = DELETE het PhieuBanHangChiTiet roi INSERT lai => dong mang ID MOI. Hai thu bam theo
   ID do deu bay sach, khong mot loi bao:
     · PhieuNhapLaiChiTiet.PhieuBHChiTietID -> DaTraCai ve 0  (lo nay co tu v7.59)
     · MauDaChotCai nam ngay tren dong bi xoa                  (lo moi cua v9.08)
   Hau qua CA HAI: hang da tra / da mua dut van tra lai duoc lan nua => TON KHO TANG KHONG. */
const iSua = mBH.indexOf("router.put('/phieu/:id'");
const iSuaHet = iSua >= 0 ? mBH.indexOf('const coDonIDs = await coCotDonIDs(pool);', iSua) : -1;
kiem(iSua >= 0 && iSuaHet > iSua, 'cat duoc phan guard dau PUT /phieu/:id');
const rSua = iSua >= 0 && iSuaHet > iSua ? mBH.slice(iSua, iSuaHet) : '';
kiem(/MauDaChotCai/.test(rSua), 'PUT /phieu/:id CHAN khi phieu da co dong "khach mua luon"');
kiem(/PhieuNhapLaiChiTiet/.test(rSua), 'PUT /phieu/:id CHAN khi phieu da co dong khach tra lai');
kiem(/coCotMauChot\(pool\)/.test(rSua), 'guard do cot — CSDL chua chay migration_v884 van sua phieu duoc nhu cu');
kiem(/LyDoKhongSua/.test(mBH), 'GET /phieu/:id tra LyDoKhongSua — chan NGAY luc bam Sua, khong doi toi luc Luu');
kiem(/d\.header\.LyDoKhongSua/.test(mFeKH), 'nut Sua o danh sach doc LyDoKhongSua va bao ro truoc khi mo form');

console.log('\n=== 3. So Hang mau: cot + nut ===');
kiem(/<th>Khách mua luôn<\/th>/.test(mFeKH), 'bang co cot "Khach mua luon"');
kiem(/class="btn small secondary hm-chot"/.test(mFeKH), 'co nut hm-chot tung dong');
kiem(/<td data-notim>/.test(mFeKH.slice(mFeKH.indexOf('hm-chot') - 400, mFeKH.indexOf('hm-chot') + 400)),
  'cot Thao tac cua so hang mau gan data-notim (luat v9.05)');
const iHd = mFeKH.indexOf(".hm-chot').forEach");
kiem(iHd >= 0, 'co handler .hm-chot');
const hChot = iHd >= 0 ? mFeKH.slice(iHd, mFeKH.indexOf('\n    }));', iHd) + 9) : '';
kiem(/apiPut\('\/api\/banhang\/hangmau\/chot\/' \+ b\.dataset\.id/.test(hChot), 'goi dung route');
kiem(/try \{/.test(hChot) && /catch \(err\)/.test(hChot) && /finally \{/.test(hChot),
  'handler co try/catch/finally — nut khong cam, khong ket disabled (bai hoc v9.06)');
kiem(/soCai > toiDa/.test(hChot), 'chan ngay o client khi vuot toi da (cung luat backend)');
kiem(/b\.dataset\.gc \|\| ''/.test(hChot) && /data-gc="/.test(mFeKH),
  'prompt ghi chu MOI SAN ghi chu dang co — sua so luong khong xoa trang ghi chu cu');
kiem(/dispatchEvent\(new Event\('input'\)\)/.test(mFeKH),
  've lai bang thi loc lai theo o tim dang co chu (khong de o tim con chu ma bang hien du dong)');
kiem(/tiền và tồn kho KHÔNG đổi|tiền và tồn KHÔNG đổi/i.test(sFeKH),
  'noi ro voi nguoi dung: tien va ton KHONG doi');
kiem((mFeKH.match(/MauDaChotCai/g) || []).length >= 2, 'cot du lieu MauDaChotCai duoc dung de hien');

console.log('\n=== 4. Phieu nhap lai: nhan "Gui mau" ===');
kiem(/Number\(r\.LaHangMau\) === 1/.test(mFeNL), 'bang chon ma hang: gan nhan theo LaHangMau cua dong');
kiem(/Gửi mẫu/.test(sFeNL), 'co chu "Gui mau" tren nhan');
kiem(/\[GỬI MẪU\]/.test(sFeNL), 'o chon phieu xuat cung ghi ro phieu gui mau (che do mot phieu)');
kiem(/ISNULL\(p\.LaHangMau, 0\)/.test(mNL) && /coCotHangMau/.test(mNL),
  'route /phieuxuat tra them LaHangMau, co do cot');
kiem(/khách MUA LUÔN|MUA LUÔN/.test(sNL),
  'cau tu choi cua phieu nhap lai noi ro phan khach mua luon (khong de nguoi dung thac mac so mat di dau)');
/* Khong co cot nay thi dong da chot 3/5 hien "Da ban 5 · Da tra 0 · Con tra duoc 2" — phep tru
   khong ra, nguoi dung tuong phan mem sai. */
kiem(/<th class="num">Khách mua luôn<\/th>/.test(mFeNL), 'bang chon ma hang co cot "Khach mua luon"');
kiem(/fmtNumber\(r\.MauDaChotCai\)/.test(mFeNL), 'cot do hien dung so MauDaChotCai cua dong');

console.log('\n=== 5. Migration + CAI_DAT_DAY_DU ===');
['MauDaChotCai', 'MauChotNgay', 'MauChotGhiChu'].forEach(c => {
  kiem(new RegExp(`IF COL_LENGTH\\('PhieuBanHangChiTiet', '${c}'\\) IS NULL`).test(sMig), `migration co guard cho ${c}`);
  kiem(new RegExp(`ALTER TABLE PhieuBanHangChiTiet ADD ${c}`).test(sMig), `migration them cot ${c}`);
});
kiem(!/UPDATE /i.test(sMig), 'migration KHONG backfill — du lieu cu giu nguyen, khong tu dong chot ban cai gi');
/* 🔴 CAI_DAT_DAY_DU.sql LA FILE SINH RA (tao_file_cai_dat.js) — KHONG SUA TAY, sua tay thi lan sinh
   sau mat sach. Kiem DUNG mot thu: migration_v884 da duoc GOP vao chua. Ban dau toi kiem bang
   "file co chua ten cot" — chuoi do khop ca CHU TRONG COMMENT nen khong bao gio do, va che dung
   viec toi lo sua tay vao file gop (ra cheo v9.08 bat duoc). */
kiem(/\[\s*\d+\/\d+\]\s+migration_v884\.sql/.test(sCaiDat),
  'CAI_DAT_DAY_DU.sql da gop migration_v884 (chay: node database\\tao_file_cai_dat.js)');
kiem(!/MauDaChotCai[\s\S]{0,200}CREATE TABLE PhieuBanHangChiTiet|CREATE TABLE PhieuBanHangChiTiet[\s\S]{0,1400}MauDaChotCai\s+INT NULL,/.test(sCaiDat),
  'KHONG sua tay 3 cot vao CREATE TABLE cua file gop (cot phai vao qua ALTER cua migration)');

console.log('\n=== 6. index.html ===');
[['module.khohang.js', 9.08], ['module.nhaplai.js', 9.08]].forEach(([f, min]) => {
  const v = parseFloat((sIndex.match(new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)')) || [])[1] || 0);
  kiem(v >= min, `${f}?v= >= ${min}  [duoc: ${v}]`);
});

console.log(`\n=== KET QUA: ${dat} dat, ${truot} sai ===`);
process.exit(truot ? 1 : 0);
