/* ================================================================================================
   KIEM CHUNG v9.06 — PHIEU NHAP LAI: MOI LOI GOI API PHAI DUOC BAT VA NOI RA
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-27: "an Luu phieu tra lai khong hoat dong... nhap du SL thi luu duoc, it hon thi
   khong hoat dong".

   NGUYEN NHAN: apiFetch THROW khi may chu tra 400 (v7.27 gan status vao Error). Cac handler cua
   form nhap lai khong co try/catch nen loi nghiep vu tu backend (tra qua so con lai, ma quan kho
   theo Ri phai tra boi so Ri, khac %CK giua cac phieu...) chet im lang. Te nhat o nut Luu: dong
   `disabled = false` nam SAU await nen khong bao gio chay -> nut bi khoa vinh vien, bam tiep khong
   co gi xay ra. Cac nhanh `if (!kq.success)` cu la MA CHET vi apiPost khong bao gio tra ve khi
   success=false.

   Chay:  node backend\utils\kiem_nhaplai_bat_loi.js   (tu thu muc goc QLNoiBo)
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m) => (dk ? OK(m) : NO(m));

// Bo comment truoc khi kiem (dau mo comment chi tinh sau ky tu mo hop le — bai hoc accept="image/ *").
const boComment = (s) => s
  .replace(/(^|[\s{(:;,=])\/\*[\s\S]*?\*\//g, '$1 ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const sNL = doc('../frontend/js/module.nhaplai.js');
const mNL = boComment(sNL);
const sIndex = doc('../frontend/index.html');

console.log('\n=== 0. File PHAI parse duoc (thay cho node --check khi khong co trong tay) ===');
/* vm.Script BIEN DICH ma khong chay — khong can window/document. Toan bo bo kiem ben duoi la so
   chuoi; khong co phep nay thi file vo cu phap van co the "N dat, 0 sai" (dung kieu da sap may
   that v7.98, v8.73). */
try {
  new (require('vm').Script)(sNL, { filename: 'module.nhaplai.js' });
  OK('module.nhaplai.js parse duoc (vm.Script)');
} catch (e) { NO('module.nhaplai.js KHONG parse duoc: ' + e.message); }

console.log('\n=== 1. Nut Luu: try/catch/finally dung cho ===');
const iLuu = mNL.indexOf("$('nlfLuu').onclick");
kiem(iLuu >= 0, 'co handler nlfLuu.onclick');
const iLuuHet = mNL.indexOf('\n    };', iLuu);
kiem(iLuuHet > iLuu, 'cat duoc dung than handler nlfLuu (khong tran sang phan sau cua file)');
const hLuu = iLuu >= 0 && iLuuHet > iLuu ? mNL.slice(iLuu, iLuuHet + 7) : '';
kiem(/try \{/.test(hLuu) && /catch \(err\)/.test(hLuu), 'apiPost nam trong try/catch');
kiem(/toast\(err\.message, 'error', 8000\)/.test(hLuu), 'catch: toast cau tu choi cua backend (8s cho du doc)');
kiem(/finally \{/.test(hLuu) && /disabled = false/.test(hLuu.slice(hLuu.indexOf('finally'))),
  'disabled = false nam trong FINALLY — loi hay thanh cong deu mo lai nut');
kiem(!/if \(!kq\.success\)/.test(hLuu), 'da bo nhanh if(!kq.success) — ma chet vi apiPost throw truoc');
/* Thu tu: disabled=true phai dat TRUOC try — bam hai lan lien khong tao hai phieu. */
const iDis = hLuu.indexOf('disabled = true');
kiem(iDis >= 0 && iDis < hLuu.indexOf('try {'), 'disabled = true dat TRUOC try (chan bam dup)');
/* 🔴 Ra cheo v9.06: closeModal() GO modal khoi DOM nen trong finally $('nlfLuu') la null —
   TypeError o moi lan luu THANH CONG. Phai bat phan tu MOT lan truoc try. */
kiem(/const nut = \$\('nlfLuu'\);/.test(hLuu) && /nut\.disabled = false/.test(hLuu),
  'bat phan tu nut MOT lan truoc try; finally dung bien da bat (khong tra lai theo id sau closeModal)');
kiem(/xemPhieu\(kq\.data\.phieuNLID\)\.catch\(/.test(hLuu),
  'xemPhieu sau luu co .catch rieng — loi mo ban xem khong doi lot thanh loi LUU');

console.log('\n=== 2. tinhTong: loi nghiep vu phai VE RA cho tong tien, khong dung im so cu ===');
const iTT = mNL.indexOf('function tinhTong');
const iTTCuoi = iTT >= 0 ? mNL.indexOf('\n    }', mNL.indexOf('setTimeout', iTT)) : -1;
kiem(iTT >= 0 && iTTCuoi > iTT, 'cat duoc dung than tinhTong');
const hTT = iTTCuoi > iTT ? mNL.slice(iTT, iTTCuoi + 6) : '';
kiem(/try \{ kq = await apiPost\('\/api\/nhaplai\/tinhthu'/.test(hTT), 'apiPost /tinhthu nam trong try');
kiem(/const oTong = \$\('nlfTong'\);/.test(hTT) && /if \(!oTong\) return;/.test(hTT),
  'chot null #nlfTong — hen 250ms no SAU khi modal dong khong duoc TypeError');
kiem(/catch \(err\)/.test(hTT) && /oTong/.test(hTT.slice(hTT.indexOf('catch'))),
  'catch: ve cau loi vao o tong tien (thay ngay khi go, truoc khi bam Luu)');
kiem(/escapeHtml\(err\.message\)/.test(hTT), 'cau loi di qua escapeHtml');
kiem(!/if \(!kq\.success\)/.test(hTT), 'da bo nhanh if(!kq.success) chet trong tinhTong');

console.log('\n=== 3. Moi duong tai du lieu phai noi ra khi loi (kiem tren mNL da boc comment) ===');
kiem(/Không tải được danh sách mã hàng/.test(mNL), 'taiDong: loi hien vao #nlfBang thay vi treo "Dang tai..."');
kiem(/-- Lỗi tải danh sách phiếu xuất --/.test(mNL) && /Không tải được danh sách phiếu xuất/.test(mNL),
  'nlfKhach.onchange: ghi ly do vao CHINH o chon + toast (khong de o trong khong ly do)');
kiem(/Không tải được danh sách phiếu nhập lại/.test(mNL),
  'taiBang tu do loi ben trong — moi noi goi (nut Loc, sau luu/huy/xoa) duoc phep ban-roi-quen');
kiem((mNL.match(/xemPhieu\([^)]*\)\.catch\(/g) || []).length >= 2,
  'CA HAI noi goi xemPhieu deu co .catch (danh sach + sau luu)');
kiem(!/if \(!kq\.success\)/.test(mNL), 'khong con nhanh if(!kq.success) chet nao trong ca file');
kiem(/try \{ r = await fetch\(url/.test(mNL), 'taiFile: fetch duoc boc try — mat mang khong con cam');

console.log('\n=== 4. Khong con await apiXXX nao TRON ngoai try ===');
/* Hai apiGet dau openForm (danh sach khach + so phieu) nam TRUOC openModal va duoc do o NOI GOI
   bang openForm().catch(...) — kiem rieng. Phan than form (tu `const $ =` tro di) thi moi
   `await api...` phai co try { dang mo trong 600 ky tu truoc no. */
kiem(/openForm\(\)\.catch\(err => toast\(err\.message, 'error'\)\)/.test(mNL),
  'noi goi openForm co .catch — API loi thi "+ Lap phieu" khong con cam');
const iThan = mNL.indexOf("const $ = (id) => document.getElementById(id);");
/* Mút cuối neo vào HÀM KẾ TIẾP sau openForm, không cộng số ký tự cứng: cộng +4000 là số thần —
   file dài thêm là cửa sổ với sang vùng khác và phép kiem trượt vì lý do chẳng liên quan. */
const iHet = mNL.indexOf('function dauPhieuHtml');
const vungForm = iThan >= 0 && iHet > iThan ? mNL.slice(iThan, iHet) : '';
kiem(iThan >= 0 && iHet > iThan, 'cat duoc dung pham vi than form (moc cuoi: dauPhieuHtml)');
let tron = 0;
let vt = -1;
while ((vt = vungForm.indexOf('await api', vt + 1)) >= 0) {
  const truocDo = vungForm.slice(Math.max(0, vt - 600), vt);
  if (!/try\s*\{[^}]*$/.test(truocDo)) tron++;
}
kiem(iThan >= 0 && tron === 0, `moi await api... trong than form deu nam trong try  [tron: ${tron}]`);
kiem(/\.nl-huy'\)[\s\S]{0,250}?try \{/.test(mNL), 'nut Huy phieu da boc try/catch (cung lop loi)');
kiem(/\.nl-xoa'\)[\s\S]{0,250}?try \{/.test(mNL), 'nut Xoa phieu da boc try/catch (cung lop loi)');

console.log('\n=== 4b. O SL tra: noi truoc luat boi so Ri ngay tren o nhap ===');
/* Backend van la nguoi chan cuoi (chuanBiPhieu). Day chi la noi TRUOC: step = he so Ri + dong chu
   "boi so N" duoi o — nguoi dung khoi go 14 vao hang Ri5 roi moi biet. */
kiem(/step="\$\{\(donViChinhLaGop\(r\) && Number\(r\.LoaiRi\) > 1\) \? Number\(r\.LoaiRi\) : 1\}"/.test(mNL),
  'input SL tra: step = he so Ri khi ma quan kho theo Ri');
kiem(/bội số/.test(mNL), 'co dong chu "boi so N" duoi o nhap cua hang Ri');

console.log('\n=== 5. index.html ===');
const v = parseFloat((sIndex.match(/module\.nhaplai\.js\?v=([\d.]+)/) || [])[1] || 0);
kiem(v >= 9.06, `module.nhaplai.js?v= >= 9.06  [duoc: ${v}]`);

console.log(`\n=== KET QUA: ${dat} dat, ${truot} sai ===`);
process.exit(truot ? 1 : 0);
