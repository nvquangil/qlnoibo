/* ================================================================================================
   KIEM CHUNG v9.04 — "PHIEU BAN HANG CO QUYEN SUA MA KHONG SUA DUOC"
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-26: "phieu ban hang co phieu khong sua duoc du user co quyen sua, vi du PX26609".

   NGUYEN NHAN: backend chan CA Sua LAN Huy khi phieu da co PHIEU THU (sua/huy lam tien da thu lech
   voi cong no). Man danh sach lai AN LUON nut Sua ma khong noi gi, trong khi nut Huy VAN HIEN
   => nguoi dung thay minh co quyen, co nut Huy, ma nut Sua bien mat khong loi giai thich.

   v9.04: nut van hien o trang thai KHOA (.act-khoa), bam vao thi mo modal noi ro ly do + liet ke
   phieu thu dang chan (route /api/banhang/phieu/:id/phieuthu).

   BA CHO DE SAI, moi cho mot nhom phep kiem ben duoi:
     1. Dieu kien khoa o frontend phai KHOP backend: backend `so(daThu) > 0`, frontend phai la
        `Number(r.DaThu) > 0`. Ban cu `!Number(r.DaThu)` con khoa oan phieu co tong thu AM.
     2. Route liet ke phieu thu phai gate bang quyen CUA MAN BAN HANG (KHOHANG/view), khong duoc
        dung CONGNO/view — nguoi ban hang khong co quyen Cong no se an 403 => lai thanh nut cam.
     3. Nut khoa phai co handler. Nut khong handler = "bam khong co gi xay ra" (bai hoc cu).

   Chay:  node backend\utils\kiem_sua_phieu_ban_hang.js   (tu thu muc goc QLNoiBo)
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m) => (dk ? OK(m) : NO(m));

/* Bo comment truoc khi kiem "file KHONG duoc chua X" — khong thi chinh cai comment giai thich loi
   lai lam phep kiem bao sai (da vap 3 lan trong kiem_ho_so_nhan_su.js). */
function boComment(s) {
  /* ⚠️ Dau MO COMMENT chi tinh khi dung sau ky tu mo hop le. Neu khong, chuoi
     accept="image/ *" (viet lien) trong module.khohang.js (2 cho) bi coi la mo comment, roi nuot
     sach toi dau DONG COMMENT ke tiep — mat 43 dong code that. Ra cheo v9.04 bat duoc. */
  return s.replace(/(^|[\s{(:;,=])\/\*[\s\S]*?\*\//g, '$1 ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const sBH = doc('routes/banhang.js');
const sKH = doc('../frontend/js/module.khohang.js');
const sIndex = doc('../frontend/index.html');
const mBH = boComment(sBH);
const mKH = boComment(sKH);

console.log('\n=== 1. Backend: luat chan van nguyen ven ===');
kiem((mBH.match(/so\(daThu\) > 0/g) || []).length >= 2,
  'CA PUT /phieu/:id LAN /huy van chan theo so(daThu) > 0 (2 cho — dem, khong chi test co/khong)');
kiem((mBH.match(/xóa phiếu thu đó trước khi/g) || []).length >= 2,
  'ca Sua lan Huy deu tra cau "xoa phieu thu do truoc khi ..." (2 cho)');

console.log('\n=== 2. Backend: route liet ke phieu thu dang chan (v9.04 moi) ===');
const iRoute = mBH.indexOf("router.get('/phieu/:id/phieuthu'");
kiem(iRoute >= 0, "co route GET /phieu/:id/phieuthu");
const dongRoute = iRoute >= 0 ? mBH.slice(iRoute, mBH.indexOf('\n});', iRoute) + 4) : '';
kiem(/requirePermission\('KHOHANG', 'view'\)/.test(dongRoute),
  'gate bang KHOHANG/view (quyen cua CHINH man ban hang)');
kiem(/requireChucNang\('KHOHANG', CN\)/.test(dongRoute), 'gate them chuc nang Phieu ban hang (CN)');
kiem(!/CONGNO/.test(dongRoute),
  'KHONG gate bang CONGNO — nguoi ban hang khong co quyen do, se an 403 va nut thanh cam');
kiem(/FROM PhieuThu WHERE PhieuBHID = @id/.test(dongRoute), 'doc dung PhieuThu theo PhieuBHID');
kiem(/input\('id', sql\.Int/.test(dongRoute), 'tham so hoa id (khong noi chuoi vao SQL)');
/* Chi doc — khong duoc co lenh ghi nao lot vao route nay. */
kiem(!/\b(INSERT|UPDATE|DELETE)\b/i.test(dongRoute), 'route chi DOC, khong co INSERT/UPDATE/DELETE');
kiem(/tongDaThu/.test(dongRoute), 'tra them tongDaThu — so TUOI de frontend phan biet "vua xoa xong" vs "lech so lieu"');
/* DienGiai do ke toan go tay, phieu thu "Chuyen thang" (v6.54) tu sinh kem TEN NHA CUNG CAP. Nguoi
   ban hang khong co quyen Cong no van doc duoc o day => cat bot cho do lo du lieu phan he khac. */
kiem(/LEFT\(ISNULL\(DienGiai, N''\), 120\)/.test(dongRoute), 'DienGiai cat con 120 ky tu');

console.log('\n=== 3. Frontend: dieu kien khoa khop backend ===');
kiem(/const bhBiKhoa = \(r\) => Number\(r\.DaThu\) > 0;/.test(mKH),
  'bhBiKhoa dung Number(r.DaThu) > 0 (KHOP backend so(daThu) > 0)');
kiem(!/!Number\(r\.DaThu\) \?/.test(mKH),
  'da bo dieu kien cu `!Number(r.DaThu) ?` (khoa oan ca phieu co tong thu AM)');

console.log('\n=== 4. Frontend: nut van HIEN, chi doi sang trang thai khoa ===');
/* Nut Sua va nut Huy phai cung MOT dieu kien hien (perm.canEdit && chua huy) — khac nhau o cho
   bi khoa hay khong. Dem so lan xuat hien cua dieu kien do trong cot Thao tac. */
/* Regex noi long khoang trang/xuong dong — khoa cung tung dau cach thi dinh dang lai code cho de
   doc la bao SAI oan du code dung (ra cheo v9.04 nhac). */
kiem((mKH.match(/perm\.canEdit\s*&&\s*r\.TrangThai\s*!==\s*'Đã hủy'\s*\?\s*\(?\s*bhBiKhoa\(r\)/g) || []).length === 2,
  'CA Sua lan Huy deu hien khi co quyen + phieu chua huy (2 cho)');
kiem(/btnKhoaHtml\(r, 'sửa'\)/.test(mKH) && /btnKhoaHtml\(r, 'hủy'\)/.test(mKH),
  'khi bi khoa thi ve nut khoa cho CA hai viec (sua / huy)');
kiem(/class="btn small secondary act-khoa"/.test(mKH), 'nut khoa mang class act-khoa');
kiem(/data-viec="\$\{escapeHtml\(viec\)\}"/.test(mKH) && /data-dathu="\$\{Number\(r\.DaThu\) \|\| 0\}"/.test(mKH),
  'nut khoa mang data-viec + data-dathu de handler biet noi gi');

console.log('\n=== 5. Frontend: nut khoa CO handler (khong phai nut cam) ===');
const iH = mKH.indexOf(".act-khoa').forEach");
kiem(iH >= 0, "co body.querySelectorAll('.act-khoa').forEach(... addEventListener)");
/* Cat ĐÚNG tới hết handler, khong dem ky tu: cua so co dinh se tran sang handler .act-xoa ben canh
   (von co san try/catch) lam phep kiem "phai co catch" KHONG THE TRUOT => vo dung (ra cheo v9.04). */
const iEnd = mKH.indexOf(".act-xoa').forEach", iH);
const hKhoa = iH >= 0 ? mKH.slice(iH, iEnd > iH ? iEnd : mKH.length) : '';
kiem(iEnd > iH, 'cat duoc dung pham vi handler .act-khoa (moc ket thuc: .act-xoa)');
kiem(/apiGet\('\/api\/banhang\/phieu\/' \+ b\.dataset\.id \+ '\/phieuthu'\)/.test(hKhoa),
  'handler goi dung route cua man ban hang');
kiem(/catch \(err\)/.test(hKhoa) && /toast\(/.test(hKhoa),
  'co catch + toast — goi API trong handler async BAT BUOC phai bat loi');
kiem(/openModal\(/.test(hKhoa), 'mo modal giai thich');
/* Dung mKH (da bo comment): neu test tren ban CON comment thi xoa modal ma de lai comment nhac toi
   cau nay van ĐAT oan. */
kiem(/đây không phải vấn đề quyền/.test(mKH),
  'modal noi ro "day khong phai van de quyen" (dung cau hoi cua Nguyen)');
kiem(/Công nợ → Phiếu thu/.test(mKH), 'modal chi duong: Cong no -> Phieu thu');
kiem(/addEventListener\('click', closeModal\)/.test(hKhoa), 'nut Dong co gan closeModal');
/* Danh sach rong co HAI nghia khac han nhau — phai phan biet bang so TUOI tu API, khong dung anh
   chup data-dathu, khong thi vu oan cho CSDL dung luc ke toan vua xoa phieu thu xong. */
kiem(/kq\.tongDaThu/.test(hKhoa), 'dung tongDaThu TUOI tu API (khong chi dua vao data-dathu)');
kiem(/renderBanHang\(perm\)/.test(hKhoa), 'co duong tai lai danh sach sau khi xu ly xong');

console.log('\n=== 6. index.html ===');
const v = parseFloat((sIndex.match(/module\.khohang\.js\?v=([\d.]+)/) || [])[1] || 0);
kiem(v >= 9.04, `module.khohang.js?v= >= 9.04  [duoc: ${v}]`);

console.log('\n=== 7. Khong con duong nao an nut ma khong noi ly do ===');
// Moi class nut trong cot Thao tac deu phai co mot cho gan handler tuong ung.
['act-sua', 'act-huy', 'act-khoa', 'act-xoa'].forEach(c => {
  kiem(new RegExp('class="btn[^"]*' + c + '"').test(mKH) && mKH.includes("." + c + "').forEach"),
    `nut .${c} vua duoc ve vua co handler`);
});
// Nut khoa va nut that phai o HAI NHANH cua cung mot ternary, khong duoc ve ca hai.
kiem((mKH.match(/act-sua" data-id/g) || []).length === 1 && (mKH.match(/act-huy" data-id/g) || []).length === 1,
  'moi loai nut that chi ve DUNG MOT lan (nut khoa nam o nhanh con lai)');
/* Tu v9.04 MOI phieu chua huy deu co chu "Sua"/"Huy" (nut khoa cung mang chu do) nen cot Thao tac
   KHONG gan data-notim la go "sua" ra nguyen bang — o tim coi nhu hong. */
kiem(/<td data-notim><button class="btn small secondary act-in"/.test(mKH),
  'cot Thao tac cua Phieu ban hang gan data-notim (chu tren nut khong vao chuoi tim)');

console.log(`\n=== KET QUA: ${dat} dat, ${truot} sai ===`);
process.exit(truot ? 1 : 0);
