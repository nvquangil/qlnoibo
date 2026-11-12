/* ================================================================================================
   kiem_sua_phieu_nhap_lai.js  —  bo tu kiem cho v9.21
   "Phieu nhap lai hang hoa: TU KHONG SUA DUOC -> SUA DUOC."

   🔴 Phep quan trong nhat (muc 2) la KIEM HANH VI THAT: require thang utils/dongDaBanChoKhach.js
   roi goi voi POOL GIA, bat cau SQL sinh ra. Vi cot "DA TRA" quyet dinh ca hai thu:
     · form sua co hien ra dong nao khong,
     · va co chan "tra vuot so da ban" dung hay khong (tien + ton kho).
   Regex tren file nguon KHONG du de biet dieu kien co that su duoc gan vao cau SQL hay khong.

   Chay:  node backend\utils\kiem_sua_phieu_nhap_lai.js
   KHONG copy file nay sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const be = fs.readFileSync(path.join(GOC, 'backend', 'routes', 'nhaplai.js'), 'utf8');
const util = fs.readFileSync(path.join(GOC, 'backend', 'utils', 'dongDaBanChoKhach.js'), 'utf8');
const fe = fs.readFileSync(path.join(GOC, 'frontend', 'js', 'module.nhaplai.js'), 'utf8');
const html = fs.readFileSync(path.join(GOC, 'frontend', 'index.html'), 'utf8');
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}

console.log('\n=== 1. BIEN DICH (thay cho node --check) ===');
[['backend/routes/nhaplai.js', be], ['backend/utils/dongDaBanChoKhach.js', util],
 ['frontend/js/module.nhaplai.js', fe]].forEach(([f, s]) => {
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

/* Cat mot khoi `function X(...) {...}` bang cach dem ngoac nhon — de trich ham THUAN ra chay that. */
function trichKhoi(nguon, moc) {
  const i = nguon.indexOf(moc);
  if (i < 0) return null;
  let mo = 0, j = nguon.indexOf('{', i);
  if (j < 0) return null;
  for (; j < nguon.length; j++) {
    if (nguon[j] === '{') mo++;
    else if (nguon[j] === '}') { mo--; if (mo === 0) return nguon.slice(i, j + 1); }
  }
  return null;
}

console.log('\n=== 2. HANH VI THAT: boPhieuNLID co vao cau SQL khong (pool gia) ===');
const { layDongDaBan } = require('./dongDaBanChoKhach');
function poolGia(bat) {
  return {
    request: () => {
      const r = {
        thamSo: {},
        input(ten, kieu, gt) { this.thamSo[ten] = gt === undefined ? kieu : gt; return this; },
        async query(cau) {
          bat.push({ cau, thamSo: this.thamSo });
          // COL_LENGTH -> tra co cot; cau chinh -> tra rong
          return { recordset: /COL_LENGTH/.test(cau) ? [{ c: 10 }] : [] };
        }
      };
      return r;
    }
  };
}
const sqlGia = { NVarChar: 'nvarchar', Int: 'int' };
(async () => {
  const batKhong = [];
  await layDongDaBan(poolGia(batKhong), sqlGia, { tenKhach: 'A' });
  const batCo = [];
  await layDongDaBan(poolGia(batCo), sqlGia, { tenKhach: 'A', boPhieuNLID: 77 });

  const cauChinh = (ds) => (ds.find(x => /FROM PhieuBanHangChiTiet ct/.test(x.cau)) || {});
  const ck = cauChinh(batKhong), cc = cauChinh(batCo);
  kiem('bat duoc cau SQL chinh o ca hai lan goi', !!ck.cau && !!cc.cau);
  kiem('🔴 KHONG truyen boPhieuNLID -> cau SQL KHONG co dieu kien loai tru (hanh vi cu nguyen ven)',
       !!ck.cau && !/np\.PhieuNLID <> @bonl/.test(ck.cau) && ck.thamSo && ck.thamSo.bonl === undefined,
       '5 man khac dang goi ham nay — doi hanh vi mac dinh la sai so "da tra" o khap noi');
  kiem('🔴 CO truyen boPhieuNLID -> cau SQL co AND np.PhieuNLID <> @bonl VA co tham so bonl',
       !!cc.cau && /AND np\.PhieuNLID <> @bonl/.test(cc.cau) && cc.thamSo && Number(cc.thamSo.bonl) === 77,
       'thieu mot trong hai la form sua mo ra TRONG TRON hoac chan oan "tra vuot"');
  kiem('dieu kien loai tru nam DUNG trong subquery DaTraCai (khong lot ra WHERE ngoai)',
       !!cc.cau && /SUM\(nl\.SoLuongCai\)[\s\S]{0,260}?AND np\.PhieuNLID <> @bonl\), 0\) AS DaTraCai/.test(cc.cau));

  console.log('\n=== 3. BACKEND: route SUA ===');
  kiem('co PUT /phieu/:id, gac quyen EDIT + dung chuc nang nhaplai',
       /router\.put\('\/phieu\/:id', requireAuth, requirePermission\('KHOHANG', 'edit'\), requireChucNang\('KHOHANG', CN\)/.test(be));
  const fnPut = (() => {
    const i = be.indexOf("router.put('/phieu/:id',");
    if (i < 0) return '';
    const j = be.indexOf("router.put('/phieu/:id/huy'", i);
    return be.slice(i, j > 0 ? j : i + 6000);
  })();
  kiem('phieu DA HUY khong sua duoc (ton da tra lai roi)',
       /cu\.TrangThai === 'Đã hủy'/.test(fnPut) && /ĐÃ HỦY nên không sửa được/.test(fnPut));
  kiem('🔴 chay chuanBiPhieu voi boPhieuNLID = CHINH phieu nay VA ep tenKhach = khach CU',
       /Object\.assign\(\{\}, req\.body \|\| \{\}, \{ boPhieuNLID: id, tenKhach: cu\.TenKhach \}\)/.test(fnPut),
       'UI khoa o chon khach la CHUA DU — mot request thu cong van doi duoc khach => cong no nhay giua hai khach');
  kiem('🔴 hoan ton ban cu bang truLaiTon() — KHONG viet phep ton rieng o route nay',
       /await truLaiTon\(pool, tran, id/.test(fnPut)
         && !/TheKhoChiTietMau/.test(fnPut),
       'cam nhac TEN BANG ton trong route: moi phep ton phai di qua truLaiTon/ghiXuatKho, khong thi lai ' +
       'sinh "duong sua ton thu hai" dung cai v6.66 so (regex cu chi bat dang XuatCai += nen XANH OAN)');
  kiem('🔴 THU TU: truLaiTon() chay TRUOC khi xoa chi tiet',
       fnPut.indexOf('await truLaiTon(') >= 0
         && fnPut.indexOf('await truLaiTon(') < fnPut.indexOf('DELETE FROM PhieuNhapLaiChiTiet'),
       'dao thu tu = truLaiTon doc bang RONG = ton hoan THIEU, im lang khong mot loi nao');
  kiem('cau loi "khong du ton" noi dung viec dang lam khi SUA (khong ghi "tra lai")',
       /await truLaiTon\(pool, tran, id, 'sửa phiếu'\)/.test(fnPut) && /\$\{viec \|\| 'trả lại'\}/.test(be));
  kiem('xoa chi tiet cu roi ghi lai, ton ghi bang ghiXuatKho(-slChinh) y het POST',
       /DELETE FROM PhieuNhapLaiChiTiet WHERE PhieuNLID=@id/.test(fnPut)
         && /ghiXuatKho\(pool, tran, d\.maHangId, d\.mauSacId, -d\.slChinh, null, 'nhaplai'\)/.test(fnPut));
  kiem('GIU NGUYEN SoPhieu / NguoiTaoID (sua khong phai lap phieu moi)',
       !/UPDATE PhieuNhapLai SET[\s\S]{0,700}?SoPhieu\s*=/.test(fnPut)
         && !/NguoiTaoID\s*=\s*@/.test(fnPut) && /soPhieu: cu\.SoPhieu/.test(fnPut));
  kiem('ca khoi nam trong transaction co rollback',
       /const tran = new sql\.Transaction\(pool\)/.test(fnPut) && /await tran\.rollback\(\)/.test(fnPut));
  kiem('🔴 POST /phieu EP boPhieuNLID = null (khong tin body khi TAO MOI)',
       /const b = Object\.assign\(\{\}, req\.body \|\| \{\}, \{ boPhieuNLID: null \}\);/.test(be),
       'client gui co nay luc tao moi = bo qua phan da tra cua mot phieu khac => tra vuot, ton tang khong');
  kiem('chuanBiPhieu doc b.boPhieuNLID va truyen xuong layDongDaBan',
       /layDongDaBan\(pool, tenKhach, null, b\.boPhieuNLID \|\| null\)/.test(be));
  kiem('hai route lay dong nhan ?boPhieuNLID',
       /layDongDaBan\(pool, p\.TenKhach, Number\(req\.params\.id\), req\.query\.boPhieuNLID \|\| null\)/.test(be)
         && /layDongDaBan\(pool, req\.query\.tenKhach, null, req\.query\.boPhieuNLID \|\| null\)/.test(be));

  console.log('\n=== 4. FRONTEND ===');
  kiem('openForm nhan suaId (MOT form cho ca Lap va Sua)', /async function openForm\(suaId\) \{/.test(fe));
  kiem('nut Sua o bang + noi day co .catch', /class="btn small secondary nl-sua"/.test(fe)
       && /openForm\(b\.dataset\.id\)\.catch\(err => toast\(err\.message, 'error'\)\)/.test(fe));
  kiem('phieu DA HUY: nut Sua hien KHOA kem ly do (luat v9.04), khong giau di',
       /disabled title="Phiếu đã hủy — tồn kho và công nợ đã trả về như trước/.test(fe));
  kiem('luu: SUA di apiPut, LAP MOI van apiPost',
       /sua \? await apiPut\('\/api\/nhaplai\/phieu\/' \+ suaId, than\)/.test(fe)
         && /: await apiPost\('\/api\/nhaplai\/phieu', than\)/.test(fe));
  kiem('🔴 BA noi goi API deu kem boPhieuNLID khi sua (dong 1 phieu / tim ma hang / tinh tien)',
       /\/dong` \+ \(sua \? '\?boPhieuNLID=' \+ encodeURIComponent\(suaId\) : ''\)/.test(fe)
         && /const boNL = sua \? '&boPhieuNLID=' \+ encodeURIComponent\(suaId\) : '';/.test(fe)
         && /boPhieuNLID: sua \? suaId : null/.test(fe),
       'thieu mot noi la form sua trong tron hoac o tong bao do oan "tra vuot"');
  kiem('nap san bang taiDong({ giuChon: true }) — khong xoa daNhap vua nap',
       /await taiDong\(\{ giuChon: true \}\);/.test(fe));
/* So VI TRI chu khong so chuoi nhieu dong (file co the la CRLF — chuoi co \n se do oan). */
  kiem('nap san dat o CUOI ham (sau khi da gan handler nlfLuu)',
       fe.indexOf("$('nlfLuu').onclick") >= 0 && fe.indexOf('ctCu.forEach(') > fe.indexOf("$('nlfLuu').onclick"),
       'dat truoc la goi $(nlfKhach).onchange() khi handler chua ton tai');
  kiem('che do sua KHOA o chon khach (doi khach = doi ca bo dong ban + cong no hai khach)',
       /id="nlfKhach"[^>]*\$\{sua \? 'disabled/.test(fe));
  kiem('canh bao khi phieu cu co dong KHONG gan dong ban goc (se bi bo khi luu)',
       /không gắn với dòng phiếu bán nào — sửa và lưu sẽ BỎ các dòng đó/.test(fe));
  kiem('prefill KHONG that bai im lang: khach khong con trong danh sach thi CHEN option',
       /khách của phiếu — không còn phiếu bán hiệu lực/.test(fe));
  kiem('prefill KHONG that bai im lang: phieu ban goc da huy thi lui "moi phieu" + NOI RA',
       /Phiếu bán gốc của phiếu này không còn hiệu lực \(đã hủy\)/.test(fe));
  kiem('SUA giu nguyen SDT/dia chi DA LUU tren phieu (khong lay lai tu bang khach)',
       /sdt: \(sua \? \(pCu\.SDT \|\| null\) : \(sel\.dataset\.sdt \|\| null\)\)/.test(fe));

console.log('\n=== 4c. v9.22: SUA chi hien MA DANG CO TRONG PHIEU ===');
  /* KIEM HANH VI: trich ham thuan locDongTheoCheDo roi chay tren du lieu that. */
  const thanLoc = trichKhoi(fe, 'function locDongTheoCheDo(');
  kiem('tim thay locDongTheoCheDo', !!thanLoc);
  if (thanLoc) {
    let fLoc = null;
    try { const s = {}; vm.runInNewContext(thanLoc + '; __r = locDongTheoCheDo;', s); fLoc = s.__r; }
    catch (e) { sai++; console.log('  ❌ khong nap duoc locDongTheoCheDo: ' + e.message); }
    if (fLoc) {
      const dsTat = [{ PhieuBHChiTietID: 1 }, { PhieuBHChiTietID: 2 }, { PhieuBHChiTietID: 3 }];
      const giu = new Set([1, 3]);
      const CA = [
        ['🔴 che do SUA: chi con ma dang co trong phieu',
          () => JSON.stringify(fLoc(dsTat, giu, true)) === JSON.stringify([{ PhieuBHChiTietID: 1 }, { PhieuBHChiTietID: 3 }])],
        ['da tich "Them ma khac" -> tra NGUYEN danh sach',
          () => fLoc(dsTat, giu, false).length === 3],
        ['che do LAP MOI (chiMa=false) -> khong loc gi', () => fLoc(dsTat, new Set(), false).length === 3],
        ['khoa dang CHUOI vs SO van khop (du lieu tu API)',
          () => fLoc([{ PhieuBHChiTietID: '7' }], new Set([7]), true).length === 1],
        ['khoaGiu rong khi dang loc -> bang rong (co cau empty-hint rieng)',
          () => fLoc(dsTat, new Set(), true).length === 0],
        ['dsTat rong / khoaGiu null -> khong no', () => fLoc(null, null, true).length === 0]
      ];
      CA.forEach(([ten, phep]) => { let ok = false; try { ok = phep(); } catch (e) { ok = false; } kiem(ten, ok); });
    }
  }
  kiem('🔴 bang loc theo HOP daNhap + boGoc (dong dat SL=0 KHONG roi bang)',
       /const chiMaTrongPhieu = sua && !\(\(\$\('nlfThemMa'\) \|\| \{\}\)\.checked\);/.test(fe)
         && /const khoaGiu = new Set\(\[\.\.\.daNhap\.keys\(\), \.\.\.boGoc\]\);/.test(fe)
         && /const ds = locDongTheoCheDo\(dsTat, khoaGiu, chiMaTrongPhieu\);/.test(fe)
         && /boGoc\.add\(Number\(d\.PhieuBHChiTietID\)\);/.test(fe),
       'Nguyen 2026-11-05: "sua la hien ra phieu da nhap lai va nhung ma da nhap lai thoi"');
  kiem('🔴 o "Phieu xuat" KHOA khi sua (doi phieu = xoa sach SL dang sua)',
       /<select id="nlfPhieu" style="width:100%;" \$\{sua \? 'disabled title="Sửa phiếu không đổi được phiếu xuất gốc/.test(fe));
  kiem('🔴 dong khong hien lai duoc thi BO khoi daNhap + noi dung (khong hua "van giu khi luu")',
       /thieu\.forEach\(k => daNhap\.delete\(k\)\);/.test(fe)
         && /sửa và lưu sẽ BỎ \$\{thieu\.length\} dòng đó/.test(fe)
         && !/VẪN được giữ khi lưu/.test(fe),
       'backend TU CHOI ca hai nguyen nhan (phieu ban da huy / ConTraCai=0) => hua giu la ngo cut im lang');
  kiem('van co duong BO SUNG ma: o "Them ma khac" (mac dinh TAT)',
       /id="nlfThemMa"> ➕ Thêm mã khác vào phiếu/.test(fe)
         && /\$\('nlfThemMa'\)\.onchange = \(\) => taiDong\(\{ giuChon: true \}\);/.test(fe),
       'bat/tat o nay phai GIU SL dang sua do (giuChon), khong thi mat sach so vua go');
  kiem('o "moi phieu" van duoc DUNG (an di) khi sua — taiDong va phan nap san deu doc .checked',
       /<input type="checkbox" id="nlfMoiPhieu">/.test(fe) && /\$\{sua \? 'display:none;' : ''\}/.test(fe),
       'bo han o do la TypeError o $(nlfMoiPhieu).checked');
  kiem('nhan bang + goi y doi theo che do sua',
       /Các mã đã nhập lại trong phiếu/.test(fe) && /Chỉ hiện các mã đang có trong phiếu này\./.test(fe));
  kiem('🔴 LUOI: thieu dong tren bang thi tu mo rong "moi phieu" roi BAO neu van thieu',
       /let thieu = \[\.\.\.daNhap\.keys\(\)\]\.filter\(k => !dongTrenBang\(\)\.has\(k\)\);/.test(fe)
         && /dòng của phiếu không hiện được/.test(fe),
       'dong an ma daNhap van giu = nguoi dung thay it hon thuc te, bam Luu lai ghi du');

console.log('\n=== 4b. Co boPhieuNLID KHONG RO sang man khac ===');
  const fileKhacDungUtil = ['backend/routes/banhang.js', 'backend/routes/congno.js',
    'backend/utils/danh_dau_hang_mau.js'].filter(f => {
      try { return /boPhieuNLID/.test(fs.readFileSync(path.join(GOC, f), 'utf8')); } catch (e) { return false; }
    });
  kiem('chi nhaplai.js + util + bo kiem nhac toi boPhieuNLID',
       fileKhacDungUtil.length === 0,
       'man khac truyen co nay = bo qua phan da tra cua mot phieu => tra vuot: ' + fileKhacDungUtil.join(', '));

  console.log('\n=== 5. BUMP ===');
  kiem('index.html bump module.nhaplai.js?v=9.22', html.includes('module.nhaplai.js?v=9.22'));

  console.log('\n' + '='.repeat(70));
  console.log(sai === 0 ? `✅ ${dat} phep DAT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phep`);
  console.log('='.repeat(70) + '\n');
  process.exit(sai === 0 ? 0 : 1);
})();
