// Cac ham dung chung cho toan bo frontend (goi API, thong bao, tien ich dinh dang)

// v5.56: TIMEOUT bắt buộc. Trước đây nếu backend KHÔNG trả lời (vd handler async ném lỗi mà thiếu
// try/catch — Express 4 không tự bắt nên request TREO vĩnh viễn) thì lời gọi này không bao giờ kết thúc:
// không lỗi, không thông báo, người dùng thấy "bấm nút không có gì xảy ra". Nay quá 30 giây sẽ báo lỗi rõ.
const API_TIMEOUT_MS = 30000;
async function apiFetch(url, options = {}) {
  const opts = Object.assign({ credentials: 'include', headers: {} }, options);
  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
  }
  let res;
  const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), API_TIMEOUT_MS) : null;
  if (ctrl) opts.signal = ctrl.signal;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    if (e && e.name === 'AbortError') {
      throw new Error('Máy chủ không phản hồi sau 30 giây (' + url + '). Kiểm tra log backend: pm2 logs qlnoibo');
    }
    throw new Error('Không kết nối được máy chủ: ' + (e && e.message ? e.message : e));
  } finally {
    if (timer) clearTimeout(timer);
  }
  let data;
  try { data = await res.json(); } catch (e) { data = {}; }
  if (res.status === 401) {
    // Chi chuyen ve /login.html neu dang KHONG o san trang login - tranh vong lap tai lien tuc
    // (truoc day: check phien luc vua vao trang login cung tra ve 401 -> redirect ve chinh no -> reload -> lap vo han,
    // dong thoi dang nhap sai mat khau cung bi redirect thay vi hien thong bao loi that su).
    const onLoginPage = window.location.pathname.endsWith('/login.html');
    if (!onLoginPage) {
      window.location.href = '/login.html';
    }
    throw new Error(data.message || 'Chưa đăng nhập hoặc sai thông tin đăng nhập.');
  }
  if (!res.ok || data.success === false) {
    /* v7.27: GẮN status + body vào Error. Trước đây chỉ còn `message`, nên chỗ gọi không phân biệt
       được "sai/không được phép" (400) với "cần người dùng xác nhận rồi làm tiếp" (409) — muốn hỏi
       lại một câu là phải viết fetch riêng, tức là có hai đường gọi API song song. */
    const err = new Error(data.message || 'Có lỗi xảy ra (' + res.status + ')');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function apiGet(url) { return apiFetch(url); }
function apiPost(url, body) { return apiFetch(url, { method: 'POST', body: JSON.stringify(body) }); }
function apiPut(url, body) { return apiFetch(url, { method: 'PUT', body: JSON.stringify(body) }); }
function apiDelete(url) { return apiFetch(url, { method: 'DELETE' }); }

async function uploadFile(file, prefix) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('prefix', prefix || 'anh');
  const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Lỗi tải ảnh lên.');
  return data.url;
}

/* v6.07 — ĐƯỜNG DẪN ẢNH XEM TRƯỚC CỠ NHỎ.
   anhNho('/uploads/x.jpg', 160) -> '/anh/160/x.jpg' (máy chủ tự tạo + ghi đệm, xem backend/routes/anh.js).
   Dùng cho MỌI ô ảnh nhỏ trong bảng/danh sách: ô 40px không có lý gì phải tải file gốc vài MB.
   Chỗ XEM ẢNH TO (lightbox, bản in) vẫn dùng đường dẫn GỐC để không giảm chất lượng.
   Đường dẫn không nằm trong /uploads/ (data:, http://...) được trả về NGUYÊN VẸN. */
const ANH_CANH_CHO_PHEP = [80, 160, 320, 640, 800, 1200];
function anhNho(url, canh) {
  const s = String(url == null ? '' : url).trim();
  if (!s || s.indexOf('/uploads/') !== 0) return s;
  const ten = s.slice('/uploads/'.length);
  if (!ten || ten.indexOf('/') !== -1) return s;   // file trong thư mục con -> để nguyên
  let c = Number(canh) || 160;
  if (ANH_CANH_CHO_PHEP.indexOf(c) === -1) c = ANH_CANH_CHO_PHEP.reduce((a, b) => (Math.abs(b - c) < Math.abs(a - c) ? b : a));
  return `/anh/${c}/${ten}`;
}

function toast(message, type) {
  let el = document.getElementById('__toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '__toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(el.__timer);
  el.__timer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '/' + dt.getFullYear();
}

function fmtNumber(n) {
  if (n === null || n === undefined || n === '') return '';
  return Number(n).toLocaleString('vi-VN');
}

/* v6.23: SỐ TIỀN BẰNG CHỮ cho phiếu bán hàng (mẫu Word có dòng "Số tiền bằng chữ").
   Quy tắc tiếng Việt: đọc theo nhóm 3 chữ số (tỷ / triệu / nghìn), "linh" cho hàng chục = 0,
   "mười" cho 10-19, "mốt/tư/lăm" ở hàng đơn vị khi hàng chục >= 2. Làm tròn về đồng. */
function docSoTienBangChu(n) {
  const soTien = Math.round(Number(n) || 0);
  if (!soTien) return 'Không đồng';
  if (soTien < 0) return 'Âm ' + docSoTienBangChu(-soTien).toLowerCase();
  const chuSo = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  // Đọc 1 nhóm 3 chữ số. `daydu` = true khi còn nhóm lớn hơn ở trước (phải đọc "không trăm").
  function docNhom(so, dayDu) {
    const tram = Math.floor(so / 100), chuc = Math.floor((so % 100) / 10), dv = so % 10;
    let s = '';
    if (tram > 0 || dayDu) s += chuSo[tram] + ' trăm';
    if (chuc === 0 && dv > 0 && (tram > 0 || dayDu)) s += ' linh';
    if (chuc === 1) s += ' mười';
    else if (chuc > 1) s += ' ' + chuSo[chuc] + ' mươi';
    if (dv > 0) {
      if (chuc >= 2 && dv === 1) s += ' mốt';
      else if (chuc >= 1 && dv === 5) s += ' lăm';
      else if (chuc >= 2 && dv === 4) s += ' tư';
      else s += ' ' + chuSo[dv];
    }
    return s.trim();
  }
  const donVi = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];
  const nhom = [];
  let x = soTien;
  while (x > 0) { nhom.push(x % 1000); x = Math.floor(x / 1000); }
  let ra = '';
  for (let i = nhom.length - 1; i >= 0; i--) {
    if (nhom[i] === 0) continue;
    ra += (ra ? ' ' : '') + docNhom(nhom[i], i < nhom.length - 1) + donVi[i];
  }
  ra = ra.replace(/\s+/g, ' ').trim();
  return ra.charAt(0).toUpperCase() + ra.slice(1) + ' đồng';
}

/* v6.25.1: TIỀN hiển thị KHÔNG có số sau dấu phẩy (VND không có xu). Dùng cho mọi ô tiền của
   phiếu bán hàng — phiếu cũ đã lỡ lưu số lẻ cũng hiện tròn đồng. */
function fmtTien(n) { return fmtNumber(Math.round(Number(n) || 0)); }

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

// v5.19 (muc 1.2/1.3): chuyen fmtDualUnit tu module.khohang.js (dinh nghia rieng, che khuat trong IIFE
// cua module do) sang day de module.qlsx.js (Cau truc vai/In lenh san xuat) cung dung CHUNG 1 cong
// thuc/dinh dang - sua bug "Tổng cộng" cu o qlsx dang NHAN (soLuong * heSo) thay vi CHIA LAY THUONG/DU
// dung quy uoc "N Ri5 dư M Cái" da dung o Bao gia Aloha/The kho hang hoa. Goi voi (soLuong, heSo,
// donViCoBan, donViQuyDoi) - vd fmtDualUnit(23, 5, 'Cái', 'Ri') => "23 Cái (4 Ri5 dư 3 Cái)".
/* ================================================================================================
   v6.31 — QUY TAC "DON VI GOP" DUNG CHUNG TOAN HE THONG  (thay cho viec so ten voi 'Ri')
   ------------------------------------------------------------------------------------------------
   TRUOC: he thong hoi "don vi nay co ten la Ri khong?" -> ai khai don vi gop ten khac (Tá, Thùng...)
          la KHONG nhan he so -> tru ton thieu gap <ty le> lan, khong bao loi gi.
   NAY:   hoi "don vi nay CO PHAI la DON VI QUY DOI cua CHINH ma hang do khong?"
          -> khai ten gi cung chay dung, va du lieu cu (DonViQuyDoi = 'Ri') cho ket qua Y HET nhu truoc.

   `laDonViGop(donVi, mh)`  : so luong ghi theo don vi nay co phai NHAN he so khong.
   `donViChinhLaGop(mh)`    : ton kho cua ma hang nay dang luu theo don vi GOP (phai CHIA khi quy tu goc).
   `mh` = object co { DonViCoBan, DonViQuyDoi }.

   NHANH TUONG THICH NGUOC: ma hang chua khai DonViQuyDoi thi van hieu 'Ri' la don vi gop —
   go bo duoc khi moi ma hang deu da khai day du DVT quy doi.
   ================================================================================================ */
function chuanDV(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
function laDonViGop(donVi, mh) {
  const dv = chuanDV(donVi), qd = chuanDV(mh && mh.DonViQuyDoi);
  if (qd) return dv === qd;
  return dv === 'ri';
}
function donViChinhLaGop(mh) {
  const cb = chuanDV(mh && mh.DonViCoBan), qd = chuanDV(mh && mh.DonViQuyDoi);
  if (qd) return cb === qd;
  return cb === 'ri';
}
/* Danh sach <option> don vi tinh LAY TU DANH MUC, nhung LUON GIU gia tri dang luu du no khong con
   trong danh muc — neu khong, mo form sua roi bam Luu la don vi bi doi am tham sang dong dau danh sach,
   keo theo ton kho bi dien giai lai sai gap <ty le> lan. */
function optDonVi(dsDonVi, dangChon, opts) {
  opts = opts || {};
  const ds = (dsDonVi || []).map(x => (typeof x === 'string' ? x : x.TenDonVi)).filter(Boolean);
  const chon = String(dangChon == null ? '' : dangChon).trim();
  if (chon && !ds.some(x => String(x).trim() === chon)) ds.unshift(chon);
  const dau = opts.choTrong ? `<option value="">${escapeHtml(opts.nhanTrong || '-- không chọn --')}</option>` : '';
  return dau + ds.map(x => `<option value="${escapeHtml(x)}" ${String(x).trim() === chon ? 'selected' : ''}>${escapeHtml(x)}</option>`).join('');
}

function fmtDualUnit(soLuong, heSo, donViCoBan, donViQuyDoi) {
  const n = Number(soLuong) || 0;
  const he = Number(heSo) || 1;
  const dvCoBan = escapeHtml(donViCoBan || 'Cái');
  const dvQuyDoi = escapeHtml(donViQuyDoi || 'Ri');
  if (he <= 1) return `${fmtNumber(n)} ${dvCoBan}`;
  // v5.46: nếu đơn vị chính là Ri (đơn vị LỚN) -> quy đổi ra Cái = NHÂN hệ số (chẵn), VD "50 Ri (= 300 Cái)".
  // (Trước đây luôn CHIA -> sai khi đơn vị chính là Ri, ra "8 Cái6 dư 2 Ri" vô nghĩa.)
  if (donViChinhLaGop({ DonViCoBan: donViCoBan, DonViQuyDoi: donViQuyDoi })) {
    return `${fmtNumber(n)} ${dvCoBan} (= ${fmtNumber(n * he)} ${dvQuyDoi})`;
  }
  // đơn vị chính là Cái (đơn vị NHỎ) -> quy đổi ra Ri = CHIA lấy thương + phần dư Cái.
  const soQuyDoi = Math.trunc(n / he);
  const du = n - soQuyDoi * he;
  const duPart = du !== 0 ? ` dư ${fmtNumber(du)} ${dvCoBan}` : '';
  return `${fmtNumber(n)} ${dvCoBan} (${fmtNumber(soQuyDoi)} ${dvQuyDoi}${he}${duPart})`;
}

// v5.21 (muc 1/2, yeu cau "Làm lại dòng tổng cộng... đơn vị tính chính là ri thì đơn vị quy đổi sẽ là
// ri x hệ số quy đổi (cái)"): dinh dang dong "Tong cong" CUA CAU TRUC VAI - KHAC ban chat voi fmtDualUnit()
// o tren (vay muon tu The kho hang hoa, LUON CHIA - dung cho N Cai -> M Ri). Cau truc vai thi NGUOC LAI:
// SL da la don vi CHINH (vd Ri, nguoi dung nhap truc tiep), can NHAN (hoac CHIA, tuy dong danh muc) voi
// He so de ra don vi QUY DOI - xem DanhMucDonViQuyDoi (migration_v521.sql). donViQuyDoi/phepTinh de
// trong/null (chua chon dong danh muc nao o Ra lenh SX) -> chi hien SL don vi chinh, khong quy doi gi ca.
function fmtQuyDoi(total, heSo, phepTinh, donViChinh, donViQuyDoi) {
  const n = Number(total) || 0;
  const he = Number(heSo) || 1;
  const dvChinh = escapeHtml(donViChinh || 'Cái');
  if (!donViQuyDoi || !phepTinh || he === 1) return `${fmtNumber(n)} ${dvChinh}`;
  const dvQuyDoi = escapeHtml(donViQuyDoi);
  const ketQua = phepTinh === 'Chia' ? (n / he) : (n * he);
  const dauPhep = phepTinh === 'Chia' ? '÷' : '×';
  return `${fmtNumber(n)} ${dvChinh} (${dauPhep}${fmtNumber(he)} = ${fmtNumber(ketQua)} ${dvQuyDoi})`;
}

function opt(list, valueKey, labelKey, selected) {
  return list.map(item => `<option value="${item[valueKey]}" ${String(item[valueKey]) === String(selected) ? 'selected' : ''}>${escapeHtml(item[labelKey])}</option>`).join('');
}

// v5.3: giao (AND) quyen cap PHAN HE (vd user.permissions.QLSX, da tinh san nhom+override user o
// backend) voi quyen RIENG theo TUNG CHUC NANG (user.chucNangPerm['QLSX:orders'] - xem migration_v53.sql
// + loadUserContext.js) de ra quyen CUOI CUNG cho DUNG 1 tab/man hinh dang mo. Chuc nang chi co the
// SIET CHAT THEM (an nut Sua/Xoa), khong the noi rong hon quyen cap phan he. Goi ham nay THAY CHO viec
// dung thang user.permissions[moduleCode] moi khi 1 man hinh con (renderX(perm)) quyet dinh hien nut
// Sua/Xoa - tham so maChucNang phai KHOP DUNG voi key cua tab dang mo (activeTab / getTabs()).
function effectivePerm(user, moduleCode, maChucNang, modulePerm) {
  if (user && user.isAdmin) return { canView: true, canCreate: true, canEdit: true, canDelete: true };
  const base = modulePerm || { canView: false, canCreate: false, canEdit: false, canDelete: false };
  const cn = user && user.chucNangPerm && user.chucNangPerm[moduleCode + ':' + maChucNang];
  if (!cn) return base; // khong co dong cau hinh rieng cho chuc nang nay -> khong bi han che them
  return {
    canView: !!base.canView && !!cn.canView,
    canCreate: !!base.canCreate && !!cn.canEdit, // "them" o cap chuc nang gop chung voi "sua" (xem auth.js actionFromMethod)
    canEdit: !!base.canEdit && !!cn.canEdit,
    canDelete: !!base.canDelete && !!cn.canDelete
  };
}

// Phim Esc dong moi popup form dang mo (dung 1 listener chung gan luc mo modal, tu go bo khi dong -
// khong dung listener toan cuc thuong truc de tranh xung dot voi cac o input/form khac tren trang).
let __modalEscHandler = null;
let __modalDragMoveHandler = null;
let __modalDragUpHandler = null;

// v5.3 (muc 1): form nhap lieu to gap doi mac dinh (xem .modal trong style.css) + keo di chuyen +
// resize (keo goc) + thu nho ("thu nho de xem cai khac xong tiep tuc lam"). Thanh keo (.modal-dragbar)
// duoc CHEN THEM boc ngoai innerHtml goc cua tung man hinh goi ham nay - KHONG doi cau truc ho da co
// (h3, form...) nen moi cho goi modal.querySelector('#id')/'.modal' hien tai van chay dung nhu cu.
// Khi THU NHO: modal co lai thanh 1 thanh nho goc man hinh + backdrop chuyen "trong suot, xuyen click"
// (pointer-events:none) de nguoi dung thao tac binh thuong voi man hinh phia sau, bam lai thanh de mo
// tiep - dung nhu yeu cau "xem cai khac xong tiep tuc lam", khong mat du lieu dang nhap do.
// Bam nen sau modal KHONG CON tu dong dong nhu truoc (de tranh mat du lieu nho tay); dong bang nut
// ✕ tren thanh keo hoac phim Esc.
// opts.onClose (tuy chon): ham duoc goi THAY VI dong han khi bam ✕/Esc - dung cho truong hop 1 modal
// con (vd "Dat hang nhanh") can QUAY VE modal cha (vd "Chi tiet ma hang") thay vi mat het luon (v5.3 muc 2).
/* ==================================================================================================
   v5.97 — CỬA SỔ LỒNG NHAU: ĐÓNG THÌ QUAY VỀ BẢNG TRƯỚC, KHÔNG THOÁT SẠCH
   Trước đây openModal() gọi closeModal() ở dòng đầu -> mở bảng con là XÓA HẲN bảng cha, nên đóng bảng
   con là mất hết, phải bấm lại từ đầu. Nay giữ 1 NGĂN XẾP (stack): mở bảng con thì bảng cha được ẨN
   (giữ nguyên DOM, giữ nguyên chỗ đang cuộn/đang gõ); đóng bảng con thì bảng cha HIỆN LẠI y như cũ.

   XỬ LÝ PATTERN "ĐÓNG RỒI MỞ LẠI DANH SÁCH": rất nhiều màn hình đang viết `closeModal(); openDanhSach()`
   (lưu xong thì vẽ lại danh sách). Nếu coi đó là "mở bảng con" thì ngăn xếp cứ dày lên và bảng cha cũ
   (dữ liệu lỗi thời) nằm bên dưới. Cách nhận biết: closeModal() ghi lại MỐC THỜI GIAN; nếu openModal()
   xảy ra trong vòng 600ms sau đó thì hiểu là MỞ THAY THẾ -> hủy bảng đang hiện thay vì đẩy xuống stack.
   Muốn chắc chắn thay thế: openModal(html, { thayThe: true }). Muốn thoát sạch: closeModal({ tatCa: true }).
   ================================================================================================== */
let __modalStack = [];          // các modal đang bị che (mới nhất ở cuối)
let __modalVuaDongLuc = 0;      // mốc closeModal() gần nhất (dùng cho quy tắc 600ms ở trên)
const __MODAL_TOI_DA = 8;       // chặn ngăn xếp dày vô hạn nếu có màn hình nào lỡ mở lồng liên tục

function __modalThaoHandlers(bd) {
  const h = bd && bd.__handlers;
  if (!h) return;
  if (h.esc) document.removeEventListener('keydown', h.esc);
  if (h.move) document.removeEventListener('pointermove', h.move);
  if (h.up) document.removeEventListener('pointerup', h.up);
}
function __modalGanHandlers(bd) {
  const h = bd && bd.__handlers;
  if (!h) return;
  if (h.esc) document.addEventListener('keydown', h.esc);
  if (h.move) document.addEventListener('pointermove', h.move);
  if (h.up) document.addEventListener('pointerup', h.up);
}
function __modalHuy(bd) {
  if (!bd) return;
  if (bd.__selObserver) { try { bd.__selObserver.disconnect(); } catch (e) { } }
  __modalThaoHandlers(bd);
  bd.remove();
}
// Đóng SẠCH mọi cửa sổ (dùng khi chuyển hẳn sang phân hệ/màn hình khác — xem switchModule ở app.js).
function closeAllModals() { closeModal({ tatCa: true }); }

function openModal(innerHtml, opts) {
  opts = opts || {};
  const dangHien = document.getElementById('__modal');
  if (dangHien) {
    const thayThe = opts.thayThe || (Date.now() - __modalVuaDongLuc) < 600;
    if (thayThe) {
      __modalHuy(dangHien);
    } else {
      dangHien.removeAttribute('id');       // chỉ modal TRÊN CÙNG mới mang id __modal
      dangHien.style.display = 'none';
      __modalThaoHandlers(dangHien);        // tránh Esc/kéo-thả của bảng cha ăn sự kiện của bảng con
      __modalStack.push(dangHien);
      while (__modalStack.length > __MODAL_TOI_DA) __modalHuy(__modalStack.shift());
    }
  }
  __modalVuaDongLuc = 0;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = '__modal';
  backdrop.innerHTML = `<div class="modal">
      <div class="modal-dragbar" title="Kéo để di chuyển">
        <span class="modal-dragbar-grip">⠿⠿</span>
        <span class="modal-dragbar-spacer"></span>
        <button type="button" class="modal-btn-min" title="Thu nhỏ để xem màn hình khác, bấm lại để mở tiếp">–</button>
        <button type="button" class="modal-btn-close" title="Đóng (Esc)">✕</button>
      </div>
      <div class="modal-body">${innerHtml}</div>
    </div>`;
  document.body.appendChild(backdrop);
  const doClose = () => { if (opts.onClose) opts.onClose(); else closeModal(); };
  __modalEscHandler = (e) => { if (e.key === 'Escape') doClose(); };
  document.addEventListener('keydown', __modalEscHandler);

  const modalEl = backdrop.querySelector('.modal');
  const dragbar = backdrop.querySelector('.modal-dragbar');
  const btnMin = backdrop.querySelector('.modal-btn-min');
  const btnClose = backdrop.querySelector('.modal-btn-close');

  // v5.97: đang có bảng cha bên dưới -> nói rõ bấm ✕ là QUAY LẠI, không phải thoát hết.
  if (__modalStack.length) btnClose.title = 'Quay lại bảng trước (Esc)';
  btnClose.addEventListener('click', doClose);

  let minimized = false;
  btnMin.addEventListener('click', () => {
    minimized = !minimized;
    modalEl.classList.toggle('minimized', minimized);
    backdrop.classList.toggle('passthrough', minimized);
    btnMin.textContent = minimized ? '▢' : '–';
    btnMin.title = minimized ? 'Mở lại' : 'Thu nhỏ để xem màn hình khác, bấm lại để mở tiếp';
  });
  // Bam vao thanh keo luc dang thu nho = mo lai luon (khong can nham dung nut nho ti).
  dragbar.addEventListener('click', () => { if (minimized) btnMin.click(); });

  // Keo tha bang chuot/cham (Pointer Events gop chung ca 2) - dung transform:translate() de khong
  // pha vo canh giua flexbox cua backdrop luc chua keo lan nao; gioi han khong keo mat het ra ngoai
  // man hinh de luon con thay duoc thanh keo/nut dong.
  let dragging = false, startX = 0, startY = 0, curX = 0, curY = 0;
  dragbar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || minimized) return;
    dragging = true;
    startX = e.clientX - curX; startY = e.clientY - curY;
    modalEl.classList.add('dragging');
  });
  __modalDragMoveHandler = (e) => {
    if (!dragging) return;
    const margin = 40;
    curX = Math.min(Math.max(e.clientX - startX, margin - window.innerWidth), window.innerWidth - margin);
    curY = Math.min(Math.max(e.clientY - startY, margin - window.innerHeight), window.innerHeight - margin);
    modalEl.style.transform = `translate(${curX}px, ${curY}px)`;
  };
  __modalDragUpHandler = () => { dragging = false; modalEl.classList.remove('dragging'); };
  document.addEventListener('pointermove', __modalDragMoveHandler);
  document.addEventListener('pointerup', __modalDragUpHandler);
  // v5.97: giữ bộ handler NGAY TRÊN phần tử để lát nữa quay về bảng cha thì gắn lại đúng bộ của nó
  // (3 biến __modal*Handler chỉ giữ được của modal trên cùng).
  backdrop.__handlers = { esc: __modalEscHandler, move: __modalDragMoveHandler, up: __modalDragUpHandler };

  // v5.51: mọi <select> trong modal thành ô "gõ để tìm" + tự áp cho các dòng thêm động (Thêm cây/Thêm dòng...).
  const __mbody = backdrop.querySelector('.modal-body');
  enhanceSelects(__mbody);
  try {
    backdrop.__selObserver = new MutationObserver(muts => {
      for (const m of muts) for (const n of m.addedNodes) if (n && n.nodeType === 1) enhanceSelects(n);
      // v5.61.1: nội dung trong modal đổi (thêm dòng, đổi bản...) -> đo lại chiều cao thanh công cụ dính.
      if (typeof capNhatThanhCongCuDinh === 'function') capNhatThanhCongCuDinh(modalEl);
    });
    backdrop.__selObserver.observe(__mbody, { childList: true, subtree: true });
  } catch (e) {}
  // v5.61.1: thanh công cụ ở đầu modal cũng đứng yên khi cuộn trong modal.
  if (typeof capNhatThanhCongCuDinh === 'function') {
    setTimeout(() => capNhatThanhCongCuDinh(modalEl), 0);
  }

  return backdrop;
}

/* ================================================================================================
   v5.61.1: THANH CÔNG CỤ ĐỨNG YÊN khi cuộn + đẩy dòng tiêu đề bảng xuống dưới thanh đó.
   Vì sao cần JS: chiều cao thanh công cụ THAY ĐỔI (nhiều nút thì xuống 2 dòng, màn hình hẹp thì
   xuống 3 dòng) nên không thể đặt cứng bằng CSS. Ở đây chỉ ĐO chiều cao rồi gán biến --bar-h cho
   vùng cuộn; CSS lo phần còn lại (xem style.css: .toolbar.sticky-bar và table thead th).
   Chỉ thanh Ở ĐẦU vùng cuộn mới được dính — tránh dính nhầm thanh nút nằm giữa form.
   ================================================================================================ */
function capNhatThanhCongCuDinh(scroller) {
  if (!scroller || scroller.nodeType !== 1) return;
  try {
    // Khoảng cách từ đỉnh phần tử tới đỉnh NỘI DUNG của vùng cuộn (không phụ thuộc đang cuộn tới đâu).
    const cachDau = (el) => el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    const hienDuoc = (el) => el && el.offsetParent !== null;

    scroller.querySelectorAll('.tabs.sticky-tabs').forEach(el => el.classList.remove('sticky-tabs'));
    scroller.querySelectorAll('.toolbar.sticky-bar').forEach(el => el.classList.remove('sticky-bar'));

    // v5.82 — ĐIỆN THOẠI/MÁY TÍNH BẢNG (≤900px): KHÔNG dính thanh tab và thanh công cụ. Lý do:
    //  (1) trên màn hình hẹp thanh công cụ xếp DỌC, cao 150–250px -> dính lại thì che gần hết bảng;
    //  (2) bảng rộng hơn màn hình nên vùng cuộn còn CUỘN NGANG; thanh công cụ chỉ rộng bằng màn hình
    //      nên khi cuộn ngang nó trượt ra ngoài, để lại khoảng TRONG SUỐT -> dòng dữ liệu lộ lên phía
    //      trên, trông như "tiêu đề bảng nằm giữa bảng" (đúng lỗi trong 2 ảnh người dùng gửi).
    // Bỏ dính 2 thanh này -> tiêu đề bảng dính ngay đỉnh vùng cuộn (--tabs-h/--bar-h = 0), không đè.
    const heHep = (window.innerWidth || document.documentElement.clientWidth || 0) <= 900;

    // 0) MỐC GỐC: trong cửa sổ bật lên, thanh tiêu đề cửa sổ (kéo/đóng) đã dính sẵn ở trên cùng
    //    -> mọi thứ dính bên dưới phải trừ đi chiều cao của nó, nếu không sẽ bị che.
    // v5.82: lấy ĐÚNG trị số `top` đang áp cho thanh tiêu đề (máy tính -22px, điện thoại -16px vì
    // modal đổi padding) thay vì cứng 22 — trước đây trên điện thoại lệch 6px nên có khe hở.
    const dragbar = scroller.querySelector(':scope > .modal-dragbar');
    let top0 = 0;
    if (dragbar && dragbar.offsetParent !== null) {
      const buTru = parseFloat(getComputedStyle(dragbar).top) || 0;   // số âm
      top0 = Math.max(0, dragbar.offsetHeight + buTru);
    }
    scroller.style.setProperty('--top0', top0 + 'px');

    // 1) THANH TAB — nằm trên cùng màn hình chức năng.
    let tabsH = 0;
    const tabs = scroller.querySelector('.tabs');
    if (!heHep && hienDuoc(tabs) && cachDau(tabs) < 120) {
      tabs.classList.add('sticky-tabs');
      tabsH = tabs.offsetHeight;
    }
    scroller.style.setProperty('--tabs-h', tabsH + 'px');

    // 2) THANH CÔNG CỤ (nút + bộ lọc) — ngay dưới thanh tab. Ngưỡng nới rộng vì có thể nằm sau tab.
    let barH = 0;
    const bar = scroller.querySelector('.toolbar');
    if (!heHep && hienDuoc(bar) && cachDau(bar) < tabsH + 220) {
      bar.classList.add('sticky-bar');
      barH = bar.offsetHeight;
    }
    scroller.style.setProperty('--bar-h', barH + 'px');

    // 3) BẢNG 2 DÒNG TIÊU ĐỀ (vd Đơn khách đặt hàng: dòng tên cột + dòng ô lọc): đo ĐÚNG chiều cao
    //    dòng 1 để dòng 2 dính khít bên dưới. Trước đây CSS đoán cứng 34px -> ô lọc cao hơn thì
    //    dòng 2 đè lên dòng 1 (hoặc hở 1 vạch). Chỉ đo bảng nào thật sự có 2 dòng tiêu đề.
    scroller.querySelectorAll('table').forEach(tb => {
      const dong = tb.querySelectorAll('thead tr');
      if (dong.length > 1 && dong[0].offsetHeight) tb.style.setProperty('--th-h', dong[0].offsetHeight + 'px');

      // v5.82 — VÙNG CUỘN LỒNG TRONG: rất nhiều màn hình bọc bảng bằng div có overflow:auto
      // (bảng lương, chấm công, sổ cắt, phân công may, bảng kê...). Bảng dính vào CHÍNH div đó, nhưng
      // 3 biến --top0/--tabs-h/--bar-h lại THỪA HƯỞNG của màn hình/cửa sổ bên ngoài -> tiêu đề bị đẩy
      // xuống 100–250px, ĐÈ LÊN các dòng đầu (nhìn như "tiêu đề nằm giữa bảng").
      // Xử lý CHUNG ở đây thay vì sửa từng màn hình: tìm vùng cuộn gần nhất của bảng, đặt lại = 0.
      // (class .lap-wrap/.bang-cuon trong style.css làm việc tương tự cho các bảng nhập liệu.)
      let cha = tb.parentElement;
      while (cha && cha !== scroller) {
        const st = getComputedStyle(cha);
        if (/(auto|scroll|overlay)/.test(st.overflowY) || /(auto|scroll|overlay)/.test(st.overflowX)) {
          cha.style.setProperty('--top0', '0px');
          cha.style.setProperty('--tabs-h', '0px');
          cha.style.setProperty('--bar-h', '0px');
          break;   // chỉ vùng cuộn GẦN NHẤT quyết định chỗ dính
        }
        cha = cha.parentElement;
      }
    });
    // 4) Dòng tiêu đề bảng tự dính dưới cùng chồng này (xem style.css: table thead th).
  } catch (e) { /* không để lỗi giao diện phụ làm hỏng màn hình */ }
}
function capNhatMoiThanhCongCuDinh() {
  capNhatThanhCongCuDinh(document.querySelector('.content'));
  const m = document.querySelector('#__modal .modal');
  if (m) capNhatThanhCongCuDinh(m);
}
// Nội dung màn hình được vẽ lại liên tục (mỗi lần đổi tab/lọc) -> theo dõi và đo lại, có gộp nhịp.
(function theoDoiThanhCongCu() {
  let hen = null;
  const chay = () => { clearTimeout(hen); hen = setTimeout(capNhatMoiThanhCongCuDinh, 60); };
  const batDau = () => {
    const c = document.querySelector('.content');
    if (c) { try { new MutationObserver(chay).observe(c, { childList: true, subtree: true }); } catch (e) {} }
    window.addEventListener('resize', chay);
    chay();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', batDau);
  else batDau();
})();

// v5.51: Nâng cấp MỌI <select> trong 1 vùng thành ô "gõ để tìm trong danh sách" (combobox).
// GIỮ NGUYÊN <select> gốc (ẩn đi) làm nguồn giá trị -> mọi code đọc .value / lắng nghe 'change' /
// nạp lại <option> qua opt() vẫn chạy y như cũ. Opt-out 1 select: thêm thuộc tính data-nosearch.
function enhanceSelects(root) {
  if (!root || root.nodeType !== 1) return;
  const list = [];
  if (root.tagName === 'SELECT') list.push(root);
  if (root.querySelectorAll) root.querySelectorAll('select').forEach(s => list.push(s));
  list.forEach(enhanceOneSelect);
}
function enhanceOneSelect(sel) {
  if (!sel || sel.multiple || sel.dataset.ssEnhanced != null || sel.dataset.nosearch != null) return;
  sel.dataset.ssEnhanced = '1';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'ss-input ss-combo';
  input.autocomplete = 'off';
  input.placeholder = 'Gõ để tìm...';
  if (sel.required) sel.required = false;   // <select> ẩn + required sẽ lỗi "not focusable"; validate bằng JS như cũ
  sel.style.display = 'none';
  sel.parentNode.insertBefore(input, sel);

  let panel = null, hi = -1, shown = [];
  function syncText() { const o = sel.options[sel.selectedIndex]; input.value = o ? o.text : ''; input.disabled = sel.disabled; }
  function reposition() { if (!panel) return; const r = input.getBoundingClientRect(); panel.style.left = r.left + 'px'; panel.style.top = (r.bottom + 2) + 'px'; panel.style.width = Math.max(r.width, 200) + 'px'; }
  function close() { if (panel) { panel.remove(); panel = null; window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', reposition); } hi = -1; }
  function build(showAll) {
    const typed = showAll ? '' : input.value.trim().toLowerCase();
    const all = Array.from(sel.options);
    shown = (typed ? all.filter(o => o.text.toLowerCase().includes(typed)) : all).slice(0, 60);
    if (!shown.length) { close(); return; }
    if (!panel) { panel = document.createElement('div'); panel.className = 'ss-dropdown'; document.body.appendChild(panel); window.addEventListener('scroll', reposition, true); window.addEventListener('resize', reposition); }
    reposition(); hi = -1;
    panel.innerHTML = shown.map((o, i) => `<div class="ss-option" data-i="${i}">${escapeHtml(o.text)}</div>`).join('');
    Array.from(panel.children).forEach((el, i) => el.addEventListener('mousedown', (e) => { e.preventDefault(); pick(shown[i]); }));
  }
  function pick(o) { if (!o) return; sel.value = o.value; input.value = o.text; close(); sel.dispatchEvent(new Event('change', { bubbles: true })); }
  function hl() { if (!panel) return; Array.from(panel.children).forEach((el, i) => el.classList.toggle('ss-option-active', i === hi)); if (panel.children[hi]) panel.children[hi].scrollIntoView({ block: 'nearest' }); }

  syncText();
  try { new MutationObserver(syncText).observe(sel, { childList: true, attributes: true, attributeFilter: ['disabled'] }); } catch (e) {}
  sel.addEventListener('change', syncText);
  input.addEventListener('focus', () => { syncText(); input.select(); build(true); });
  input.addEventListener('input', () => build(false));
  input.addEventListener('blur', () => setTimeout(() => { close(); syncText(); }, 150));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!panel) build(true); else { hi = Math.min(shown.length - 1, hi + 1); hl(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (panel) { hi = Math.max(0, hi - 1); hl(); } }
    /* v7.18 — SỬA LỖI MẤT DÒNG VỪA GÕ.
       Cũ: Enter chỉ chọn khi đã bấm mũi tên xuống (hi >= 0). Người dùng gõ mã rồi Enter luôn (thói
       quen bình thường) thì KHÔNG có option nào được chọn — <select> ẩn vẫn rỗng — mà vì ô nằm trong
       <form> nên Enter LƯU LUÔN PHIẾU. Dòng vừa gõ bị lọc bỏ (không có mã hàng) nên phiếu lưu thiếu
       dòng đó, không báo lỗi gì: "thêm hàng vào mà tồn kho không đổi".
       Nay: đang mở danh sách gợi ý thì Enter LUÔN chọn (dòng đang tô, hoặc gợi ý ĐẦU TIÊN) và chặn
       submit — muốn lưu thì bấm Enter lần nữa hoặc bấm nút Lưu. */
    else if (e.key === 'Enter') {
      if (panel && shown.length) { e.preventDefault(); pick(shown[hi >= 0 ? hi : 0]); }
    }
    else if (e.key === 'Escape') { close(); }
  });
}

function closeModal(opts) {
  opts = opts || {};
  const el = document.getElementById('__modal');
  __modalHuy(el);   // v5.97: gộp việc ngắt observer + tháo handler + xóa DOM
  __modalEscHandler = null;
  __modalDragMoveHandler = null;
  __modalDragUpHandler = null;
  // v5.8: dong luon dropdown goi y (.ss-dropdown) neu con dang mo - panel nay duoc chen THANG vao
  // <body> (khong nam trong modal, xem __ssOpenDropdown trong file nay) nen KHONG tu mat theo khi modal
  // dong: neu modal dong trong luc dropdown dang mo MA KHONG qua 1 cu mousedown ra ngoai truoc do (vd
  // nguoi dung go Enter de submit form ngay trong luc dropdown dang mo nhung chua highlight dong nao -
  // xem onKeydown) thi panel se troi lai tren man hinh vinh vien, khong bao gio bi don. Goi don gian,
  // an toan ngay ca khi khong co dropdown nao dang mo (kiem tra null truoc trong ham).
  __ssCloseDropdown();

  /* v5.97: QUAY VỀ BẢNG TRƯỚC (nếu đang mở lồng nhau). `tatCa: true` = thoát sạch mọi cấp — dùng khi
     chuyển hẳn phân hệ/màn hình khác, để không còn cửa sổ nào treo lơ lửng trong DOM. */
  if (opts.tatCa) {
    while (__modalStack.length) __modalHuy(__modalStack.pop());
    __modalVuaDongLuc = 0;
    return;
  }
  const cha = __modalStack.pop();
  if (cha) {
    cha.id = '__modal';
    cha.style.display = '';               // trả về display mặc định của .modal-backdrop (flex)
    __modalGanHandlers(cha);
    const h = cha.__handlers || {};
    __modalEscHandler = h.esc || null;
    __modalDragMoveHandler = h.move || null;
    __modalDragUpHandler = h.up || null;
    // Đo lại thanh dính/tiêu đề bảng cho bảng cha vừa hiện lại (kích thước có thể đã đổi).
    if (typeof capNhatMoiThanhCongCuDinh === 'function') setTimeout(capNhatMoiThanhCongCuDinh, 0);
  }
  // Ghi mốc để openModal() ngay sau đây hiểu là "mở THAY THẾ" chứ không phải mở thêm bảng con
  // (pattern `closeModal(); openDanhSach()` sau khi lưu).
  __modalVuaDongLuc = Date.now();
}

function statusBadge(trangThai) {
  const map = {
    'Hoàn thành': 'ok', 'Đang sản xuất': 'info', 'Chưa bắt đầu': 'warn', 'Trễ hạn': 'danger',
    'Chờ xử lý': 'warn', 'Đã hủy': 'danger', 'Đã giao': 'ok',
    'Đã xuất hàng': 'ok'   // v6.23: đơn khách đặt đã có phiếu bán hàng (đã trừ tồn)
  };
  return `<span class="badge ${map[trangThai] || 'info'}">${escapeHtml(trangThai || '')}</span>`;
}

// Trang thai don hang kem cong doan hien tai, vd "Đang sản xuất - May" (chi ap dung khi dang san xuat;
// Hoan thanh/Chua bat dau/Tre han giu nguyen vi ghep them cong doan se khong co nghia).
// v5.0: tham so thu 3 (tenNhaGiaCong) tuy chon - khi dang o cong doan "May" thi ghi kem ten nha gia
// cong dang lam don nay (yeu cau Dashboard QLSX), vi don co the giao gia cong ngoai (khong theo doi
// tien do noi bo o cong doan nay). Bo qua tham so nay tren cac man hinh khong co du lieu nha gia cong.
// v5.9 (yeu cau "Mã công đoạn... mở rộng thành sửa lại toàn bộ các chỗ so sánh trực tiếp theo TÊN công
// đoạn... sang so sánh theo mã/StageID"): them tham so thu 4 maCongDoan (tuy chon) - kiem tra "dang o
// cong doan May" gio dua theo ma on dinh ('MAY', xem migration_v59.sql) thay vi tenCongDoan === 'May'
// (ten hien thi, tu do doi duoc qua Danh muc tu sau khi nang cap nay). tenCongDoan VAN dung de HIEN
// THI (khong doi) - chi doi cach SO SANH. Man hinh nao chua truyen maCongDoan se coi nhu khong khop
// (an toan - chi mat phan "(ten nha gia cong)" hien kem, khong gay loi).
function statusWithStage(trangThai, tenCongDoan, tenNhaGiaCong, maCongDoan) {
  const map = { 'Hoàn thành': 'ok', 'Đang sản xuất': 'info', 'Chưa bắt đầu': 'warn', 'Trễ hạn': 'danger' };
  let text = (trangThai === 'Đang sản xuất' && tenCongDoan) ? `${trangThai} - ${tenCongDoan}` : (trangThai || '');
  if (trangThai === 'Đang sản xuất' && maCongDoan === 'MAY' && tenNhaGiaCong) text += ` (${tenNhaGiaCong})`;
  return `<span class="badge ${map[trangThai] || 'info'}">${escapeHtml(text)}</span>`;
}

/* ================= MOBILE NAV (hamburger) ================= */
// Luu y: menu gio la accordion 2 cap (xem app.js) - bam vao TIEU DE phan he (.nav-mod) chi de
// so/cuon submenu, KHONG duoc dong sidebar (nguoi dung can thay duoc submenu vua mo). Chi dong
// sidebar khi bam dung 1 CHUC NANG la (.nav-fn) - luc do da chuyen man hinh xong, sidebar nen tu dong.
function initMobileNav() {
  const btn = document.getElementById('btnHamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobileOverlay');
  if (!btn || !sidebar || !overlay) return;
  function close() { sidebar.classList.remove('open'); overlay.classList.remove('show'); }
  btn.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('show'); });
  overlay.addEventListener('click', close);
  document.getElementById('navMenu').addEventListener('click', (e) => {
    if (e.target.closest('.nav-fn')) close();
  });
}

/* ================= THONG BAO (bell + panel + poll) ================= */
let __notifPollTimer = null;
function initNotifications() {
  const bell = document.getElementById('btnNotifBell');
  const panel = document.getElementById('notifPanel');
  const readAllBtn = document.getElementById('btnNotifReadAll');
  if (!bell || !panel) return;

  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    const willShow = panel.style.display === 'none';
    panel.style.display = willShow ? 'block' : 'none';
    if (willShow) loadNotifications();
  });
  document.addEventListener('click', (e) => {
    if (panel.style.display !== 'none' && !panel.contains(e.target) && e.target !== bell) panel.style.display = 'none';
  });
  readAllBtn.addEventListener('click', async () => {
    try { await apiPut('/api/notifications/read-all', {}); loadNotifications(); } catch (e) { /* im lang */ }
  });

  initWebPush();          // v5.67: nút bật thông báo đẩy trên thiết bị này
  loadNotifications();
  clearInterval(__notifPollTimer);
  // v5.3 (muc 4): rut ngan chu ky kiem tra (45s -> 15s) de thong bao moi "day len" nhanh hon, gan
  // voi cam giac thoi gian thuc hon ma khong can nguoi dung tu lam moi trang.
  __notifPollTimer = setInterval(loadNotifications, 15000);
}

/* ================================================================================================
   v5.67 — WEB PUSH: bật thông báo đẩy cho CHÍNH thiết bị đang dùng.
   Điều kiện bắt buộc của trình duyệt:
     - Trang phải chạy HTTPS (hoặc localhost). Vào bằng http://<tên máy>:3000 trong LAN thì
       trình duyệt KHÔNG cho đăng ký -> nút sẽ báo rõ lý do thay vì im lặng.
     - iPhone/iPad: phải "Thêm vào MH chính" (cài như app) rồi mở từ biểu tượng đó mới bật được.
   Mỗi thiết bị đăng ký một lần; hỏi quyền đúng lúc người dùng BẤM NÚT (không tự hỏi khi vào trang
   — trình duyệt phạt nặng kiểu xin quyền tự động và người dùng hay bấm Chặn theo phản xạ).
   ================================================================================================ */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function initWebPush() {
  const box = document.getElementById('pushBox');
  const nhan = document.getElementById('pushTrangThai');
  const btnBat = document.getElementById('btnBatPush');
  const btnThu = document.getElementById('btnThuPush');
  if (!box || !nhan || !btnBat) return;
  box.style.display = 'flex';

  const hoTro = ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
  const antoan = window.isSecureContext;   // HTTPS hoặc localhost

  if (!antoan) {
    nhan.textContent = 'Thông báo đẩy cần HTTPS. Hãy vào bằng địa chỉ https:// (tên miền công ty) thay vì http://.';
    btnBat.style.display = 'none';
    return;
  }
  if (!hoTro) {
    nhan.textContent = 'Trình duyệt này không hỗ trợ thông báo đẩy. Dùng Chrome/Edge (máy tính, Android) hoặc Safari đã cài app (iPhone).';
    btnBat.style.display = 'none';
    return;
  }

  let cauHinh = null;
  try { cauHinh = (await apiGet('/api/notifications/push/config')).data; } catch (e) { cauHinh = null; }
  if (!cauHinh || !cauHinh.batDuoc || !cauHinh.publicKey) {
    nhan.textContent = 'Máy chủ chưa bật thông báo đẩy (xem HUONG_DAN_CAI_DAT.md — BƯỚC 2.86).';
    btnBat.style.display = 'none';
    return;
  }

  const reg = await navigator.serviceWorker.ready.catch(() => null);
  const dangCo = reg ? await reg.pushManager.getSubscription() : null;

  function veTrangThai(daBat) {
    if (daBat) {
      nhan.textContent = `Đang bật trên máy này (tài khoản của bạn có ${cauHinh.soThietBi || 1} thiết bị).`;
      btnBat.textContent = '🔕 Tắt trên máy này';
      btnThu.style.display = '';
    } else {
      nhan.textContent = Notification.permission === 'denied'
        ? 'Bạn đã CHẶN thông báo cho trang này. Mở biểu tượng ổ khóa trên thanh địa chỉ → Thông báo → Cho phép.'
        : 'Bật để nhận thông báo ngay trên màn hình, kể cả khi không mở phần mềm.';
      btnBat.textContent = '🔔 Bật trên máy này';
      btnThu.style.display = 'none';
    }
  }
  veTrangThai(!!dangCo);

  btnBat.onclick = async () => {
    btnBat.disabled = true;
    try {
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {                                   // ĐANG BẬT -> tắt
        await apiPost('/api/notifications/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
        veTrangThai(false);
        toast('Đã tắt thông báo trên máy này.', 'info');
      } else {                                     // ĐANG TẮT -> xin quyền + đăng ký
        const quyen = await Notification.requestPermission();
        if (quyen !== 'granted') {
          veTrangThai(false);
          toast('Bạn chưa cho phép hiện thông báo.', 'error');
          return;
        }
        const moi = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(cauHinh.publicKey)
        });
        const j = moi.toJSON();
        await apiPost('/api/notifications/push/subscribe', { endpoint: j.endpoint, keys: j.keys });
        veTrangThai(true);
        toast('Đã bật thông báo trên máy này.', 'success');
      }
    } catch (err) {
      toast('Không bật được thông báo: ' + err.message, 'error');
    } finally { btnBat.disabled = false; }
  };

  btnThu.onclick = async () => {
    btnThu.disabled = true;
    try { const r = await apiPost('/api/notifications/push/test', {}); toast(r.message || 'Đã gửi.', 'success'); }
    catch (err) { toast(err.message, 'error'); }
    finally { btnThu.disabled = false; }
  };
}

// So sanh giua 2 lan poll de biet thong bao nao la MOI thuc su (chua tung thay qua) - null = chua
// tai lan nao (vua dang nhap xong): lan dau chi gom 1 popup tong hop so luong chua doc (tranh spam
// nhieu popup cung luc neu co san nhieu thong bao cu chua doc tu truoc); tu lan poll thu 2 tro di,
// so sanh voi lan truoc de day popup rieng cho tung thong bao MOI phat sinh trong luc dang dung app.
let __lastNotifIds = null;

async function loadNotifications() {
  const badge = document.getElementById('notifBadge');
  const list = document.getElementById('notifList');
  if (!badge || !list) return;
  try {
    const res = await apiGet('/api/notifications');
    const rows = res.data || [];
    const unread = res.unread || 0;
    badge.style.display = unread > 0 ? 'inline-block' : 'none';
    badge.textContent = unread > 99 ? '99+' : String(unread);
    list.innerHTML = rows.length ? rows.map(r => `
      <div class="notif-item ${r.DaDoc ? '' : 'unread'}" data-id="${r.NotificationID}">
        <div class="notif-msg">${escapeHtml(r.NoiDung)}</div>
        <div class="notif-time">${fmtDateTime(r.CreatedAt)}</div>
      </div>`).join('') : '<div class="empty-hint">Không có thông báo nào</div>';
    list.querySelectorAll('.notif-item').forEach(el => el.addEventListener('click', async () => {
      try { await apiPut('/api/notifications/' + el.dataset.id + '/read', {}); } catch (e) { /* im lang */ }
      loadNotifications();
    }));

    if (__lastNotifIds === null) {
      if (unread > 0) showNotifPopup(`Bạn có ${unread} thông báo chưa đọc`);
    } else {
      const newOnes = rows.filter(r => !r.DaDoc && !__lastNotifIds.has(r.NotificationID));
      if (newOnes.length === 1) showNotifPopup(newOnes[0].NoiDung);
      else if (newOnes.length > 1) showNotifPopup(`Có ${newOnes.length} thông báo mới`);
    }
    __lastNotifIds = new Set(rows.map(r => r.NotificationID));
  } catch (e) { /* chua dang nhap hoac loi tam thoi - im lang, khong lam gian doan man hinh chinh */ }
}

// v5.3 (muc 4): popup thong bao gio hien TO O GIUA TRANG (truoc la toast nho goc man hinh), kem 1
// lop nen mo phia sau de noi bat - bam vao popup (hoac nen) se mo panel chuong thong bao ra luon.
// Tu dong an sau 6 giay neu khong bam vao. Goi lai ham nay khi popup DANG hien (vd co thong bao moi
// hon phat sinh truoc khi popup cu kip an) se THAY NOI DUNG + RESET GIO NGAY LAP TUC - dung yeu cau
// "tu dong day len khi co cai moi, khong can refresh trang".
function showNotifPopup(text) {
  let el = document.getElementById('__notifPopup');
  let backdrop = document.getElementById('__notifPopupBackdrop');
  if (!el) {
    backdrop = document.createElement('div');
    backdrop.id = '__notifPopupBackdrop';
    backdrop.className = 'notif-popup-backdrop';
    document.body.appendChild(backdrop);
    el = document.createElement('div');
    el.id = '__notifPopup';
    el.className = 'notif-popup';
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="notif-popup-icon">🔔</div><div class="notif-popup-text">${escapeHtml(text)}</div>`;
  el.className = 'notif-popup show';
  backdrop.className = 'notif-popup-backdrop show';
  clearTimeout(el.__timer);
  function hide() {
    el.className = 'notif-popup';
    backdrop.className = 'notif-popup-backdrop';
  }
  el.onclick = () => { hide(); const bell = document.getElementById('btnNotifBell'); if (bell) bell.click(); };
  backdrop.onclick = hide;
  el.__timer = setTimeout(hide, 6000);
}

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return fmtDate(d) + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
}

/* ================= COMBOBOX TIM KIEM (go ky tu bat ky, khong can dung framework) =================
   v5.8: thay <datalist> (trinh duyet TU VE, KHONG the chinh CSS - bi cat gon chu khi nhan dai, xem yeu
   cau v5.8 "ô tìm kiếm... list cây hiện phía dưới điều chỉnh để hiện hết thông tin của cây") bang 1
   dropdown TU DUNG: 1 <div class="ss-dropdown"> duoc "portal" thang vao <body> (khong nam long trong
   modal) va dinh vi bang getBoundingClientRect() cua o nhap - tranh bi .modal{overflow:auto} cat mat
   khi dropdown "tran" xuong duoi vung nhin cua modal, dong thoi cho phep CSS tuy chinh thoai mai (khac
   han <datalist> nguyen sinh). Giu NGUYEN 100% hop dong ben ngoai: 3 ham searchableSelectHtml/
   wireSearchableSelect/getSearchableValue cung id/tham so nhu truoc; #{id}_text (o nhap chu) va
   #{id}_val (input an luu ID that su) van dung DUNG id do - code ngoai dang doc/ghi truc tiep 2 o nay
   (vd QR scanner trong module.qlsx.js, dong gva_*) khong can sua gi. Loc theo ky tu go (truoc day hoan
   toan do trinh duyet dam nhiem qua <datalist>) nay chuyen sang loc kieu CHUA (substring, khong con
   doi hoi khop dung phan dau chuoi nhu 1 so trinh duyet lam voi datalist) ngay trong wireSearchableSelect. */
function searchableSelectHtml(id, list, valueKey, labelFn, selectedValue) {
  const selectedItem = selectedValue != null ? list.find(it => String(it[valueKey]) === String(selectedValue)) : null;
  return `<input type="text" class="ss-input" id="${id}_text" autocomplete="off"
      value="${escapeHtml(selectedItem ? labelFn(selectedItem) : '')}" placeholder="Gõ để tìm...">
    <input type="hidden" id="${id}_val" value="${selectedItem ? selectedItem[valueKey] : (selectedValue || '')}">`;
}

// Dropdown goi y dang mo (chi 1 cai TON TAI tren toan trang tai 1 thoi diem, dung chung cho MOI o
// searchable-select) - portal vao <body>, dinh vi bang JS thay vi position:absolute trong DOM tai cho
// (tranh bi modal/cac khoi cha co overflow:hidden|auto cat mat).
let __ssOpenDropdown = null; // { panel, textEl, reposition, items, highlighted }

function __ssCloseDropdown() {
  if (__ssOpenDropdown) {
    __ssOpenDropdown.panel.remove();
    window.removeEventListener('scroll', __ssOpenDropdown.reposition, true);
    window.removeEventListener('resize', __ssOpenDropdown.reposition);
    __ssOpenDropdown = null;
  }
}
// Bam ra ngoai ca o nhap lan panel goi y -> dong dropdown (gan 1 LAN DUY NHAT tren document, dung
// chung cho moi instance thay vi moi o nhap tu gan/go rieng mousedown cua minh).
document.addEventListener('mousedown', (e) => {
  if (!__ssOpenDropdown) return;
  if (e.target === __ssOpenDropdown.textEl || __ssOpenDropdown.panel.contains(e.target)) return;
  __ssCloseDropdown();
});

// Goi ngay sau khi chen HTML tren vao DOM, truyen dung list/valueKey/labelFn da dung luc render HTML.
// onResolve (tuy chon, v5.3): duoc goi voi item da khop (hoac null neu chua khop) MOI LAN nguoi dung
// go/doi gia tri - dung khi can lam gi them ngay luc chon xong (vd tu dien Don vi tinh theo phu kien
// vua chon trong pkRowTemplate cua module.phukien.js).
// anhFn (tuy chon, v5.88): ham nhan 1 item -> tra ve DUONG DAN ANH. Co thi moi dong trong danh sach
// so xuong hien kem anh nho ben trai (dung cho danh sach phu kien/NPL - nhin anh chon nhanh hon doc ten).
function wireSearchableSelect(id, list, valueKey, labelFn, onResolve, anhFn) {
  const textEl = document.getElementById(id + '_text');
  const hiddenEl = document.getElementById(id + '_val');
  if (!textEl || !hiddenEl) return;
  // v5.42: "list" có thể là MẢNG hoặc HÀM trả về mảng — cho phép lọc ĐỘNG tại thời điểm mở/gõ
  // (vd ẩn cây vải đã được chọn ở picker khác). Backward-compatible: mảng -> bọc thành hàm.
  const getList = typeof list === 'function' ? list : () => list;

  function resolve() {
    const typed = textEl.value.trim().toLowerCase();
    const match = getList().find(it => labelFn(it).trim().toLowerCase() === typed);
    hiddenEl.value = match ? match[valueKey] : '';
    textEl.classList.toggle('ss-invalid', !!typed && !match);
    if (onResolve) onResolve(match || null);
  }

  function pickItem(it) {
    textEl.value = labelFn(it);
    __ssCloseDropdown();
    resolve();
  }

  function openDropdown() {
    const typed = textEl.value.trim().toLowerCase();
    const arr = getList();
    const items = (typed ? arr.filter(it => labelFn(it).toLowerCase().includes(typed)) : arr).slice(0, 50);
    if (!items.length) { __ssCloseDropdown(); return; }
    let panel;
    if (__ssOpenDropdown && __ssOpenDropdown.textEl === textEl) {
      panel = __ssOpenDropdown.panel;
    } else {
      __ssCloseDropdown();
      panel = document.createElement('div');
      panel.className = 'ss-dropdown';
      document.body.appendChild(panel);
      const reposition = () => {
        const r = textEl.getBoundingClientRect();
        panel.style.left = r.left + 'px';
        panel.style.top = (r.bottom + 2) + 'px';
        panel.style.width = Math.max(r.width, 260) + 'px';
      };
      reposition();
      window.addEventListener('scroll', reposition, true);
      window.addEventListener('resize', reposition);
      __ssOpenDropdown = { panel, textEl, reposition, items: [], highlighted: -1 };
    }
    const st = __ssOpenDropdown;
    st.items = items;
    st.highlighted = -1;
    // v5.88: co anhFn thi moi dong hien ANH NHO ben trai + ten ben phai.
    panel.innerHTML = items.map((it, i) => {
      let url = '';
      try { url = anhFn ? (anhFn(it) || '') : ''; } catch (e) { url = ''; }
      return `<div class="ss-option${url ? ' ss-option-coanh' : ''}" data-i="${i}">${url ? `<img class="ss-option-anh" src="${escapeHtml(url)}" alt="">` : ''}<span>${escapeHtml(labelFn(it))}</span></div>`;
    }).join('');
    Array.from(panel.children).forEach((optEl, i) => {
      optEl.addEventListener('mousedown', (e) => { e.preventDefault(); pickItem(items[i]); });
    });
  }

  function moveHighlight(delta) {
    if (!__ssOpenDropdown || __ssOpenDropdown.textEl !== textEl || !__ssOpenDropdown.items.length) return;
    const st = __ssOpenDropdown;
    st.highlighted = Math.max(0, Math.min(st.items.length - 1, st.highlighted + delta));
    Array.from(st.panel.children).forEach((el, i) => el.classList.toggle('ss-option-active', i === st.highlighted));
    st.panel.children[st.highlighted].scrollIntoView({ block: 'nearest' });
  }

  function onKeydown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (__ssOpenDropdown && __ssOpenDropdown.textEl === textEl) moveHighlight(1); else openDropdown();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === 'Enter') {
      if (__ssOpenDropdown && __ssOpenDropdown.textEl === textEl && __ssOpenDropdown.highlighted >= 0) {
        e.preventDefault();
        pickItem(__ssOpenDropdown.items[__ssOpenDropdown.highlighted]);
      }
    } else if (e.key === 'Escape') {
      __ssCloseDropdown();
    }
  }

  // v5.3: mot so man hinh goi lai wireSearchableSelect nhieu lan tren CUNG 1 o input khi danh sach loc
  // thay doi (vd doi don hang trong Phieu Xuat phu kien -> refreshAllRowsPhuKienList). Neu khong go bo
  // listener cu, moi lan goi lai se cong don them 1 bo listener. Luu tung handler tren chinh element
  // de go DUNG no truoc khi gan lai (xoa bang tham chieu cu, TRUOC khi ghi de bang tham chieu moi).
  if (textEl.__ssInputHandler) textEl.removeEventListener('input', textEl.__ssInputHandler);
  if (textEl.__ssResolve) textEl.removeEventListener('change', textEl.__ssResolve);
  if (textEl.__ssKeydownHandler) textEl.removeEventListener('keydown', textEl.__ssKeydownHandler);
  if (textEl.__ssFocusOpenHandler) textEl.removeEventListener('focus', textEl.__ssFocusOpenHandler);

  const inputHandler = () => { resolve(); openDropdown(); };
  textEl.__ssResolve = resolve;
  textEl.__ssInputHandler = inputHandler;
  textEl.__ssKeydownHandler = onKeydown;
  textEl.__ssFocusOpenHandler = openDropdown;
  textEl.addEventListener('input', inputHandler);
  textEl.addEventListener('change', resolve);
  textEl.addEventListener('keydown', onKeydown);
  textEl.addEventListener('focus', textEl.__ssFocusOpenHandler);
  if (!textEl.__ssFocusWired) {
    textEl.addEventListener('focus', () => textEl.select());
    textEl.__ssFocusWired = true;
  }
}

function getSearchableValue(id) {
  const el = document.getElementById(id + '_val');
  return el ? el.value : '';
}

/* ================= O TIM KIEM CHO BANG DANH SACH (dung chung nhieu module) =================
   v5.10: yeu cau "các danh mục có thêm ô tìm kiếm, đánh ký ký tự bất kỳ để tìm" - loc THUAN CLIENT-SIDE
   tren cac dong <tr> da render san (danh sach danh muc la du lieu nho, da tai het 1 lan, khong can goi
   lai API/debounce), khop kieu CHUA (substring, khong phan biet hoa thuong, giong het cach loc cua
   wireSearchableSelect o tren) tren TOAN BO noi dung dong (moi cot cung luc, khong rieng 1 cot). Dung
   chung cho module.danhmuc.js (moi tab) va module.phukien.js (tab Danh muc phu kien) thay vi khai bao
   rieng tung noi. .toolbar da co san flex + style input/select (xem style.css) nen chi can chen <input>
   vao, khong can style rieng. */
/* ================================================================================================
   v6.66.1: BAM VAO DONG PHIEU DE MO CHI TIET (xem/in)
   Yeu cau: "danh sach phieu xuat nhap vai, phu kien click vao ra chi tiet nhu xem in".
   Cach lam: KHONG gan them handler rieng, ma bam dong = bam ho cai nut .act-view co san trong chinh
   dong do. Nho vay chi co MOT duong mo chi tiet - sua logic xem/in thi bam dong tu dung theo,
   khong the lech. Dong nao khong co nut .act-view (dong trong, dong tong) thi bo qua.
   Bam vao nut / link / o nhap trong dong thi KHONG mo - khong thi bam nut Xoa cung bung modal xem.
   ================================================================================================ */
function ganBamDongXemChiTiet(root) {
  if (!root) return;
  root.querySelectorAll('table tbody tr').forEach(tr => {
    const nut = tr.querySelector('.act-view');
    if (!nut || tr.dataset.bamDong) return;
    tr.dataset.bamDong = '1';
    tr.classList.add('dong-bam-duoc');
    tr.addEventListener('click', (e) => {
      if (e.target.closest('button, a, input, select, textarea, label')) return;
      nut.click();
    });
  });
}

function searchBoxHtml(id) {
  return `<input type="text" id="${id || 'dmSearchBox'}" placeholder="Gõ để tìm..." autocomplete="off" style="min-width:220px;">`;
}
function wireTableSearch(body, id) {
  const input = body.querySelector('#' + (id || 'dmSearchBox'));
  const table = body.querySelector('table');
  if (!input || !table) return;
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll(':scope > tr'));
  if (!rows.length) return;
  // Lay so cot tu <thead> (khong dung rows[0].children.length) - neu bang dang rong (chi co 1 dong
  // "Chua co du lieu" gom 1 <td colspan> duy nhat) thi rows[0].children.length se sai (ra 1 thay vi
  // dung so cot that), lam dong "khong tim thay" hien hep hon ca bang.
  const colCount = table.querySelectorAll('thead th').length || rows[0].children.length;
  const noResultRow = document.createElement('tr');
  noResultRow.style.display = 'none';
  noResultRow.innerHTML = `<td colspan="${colCount}" class="empty-hint">Không tìm thấy kết quả phù hợp.</td>`;
  tbody.appendChild(noResultRow);
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    let anyVisible = false;
    rows.forEach(tr => {
      const match = !q || tr.textContent.toLowerCase().includes(q);
      tr.style.display = match ? '' : 'none';
      if (match) anyVisible = true;
    });
    noResultRow.style.display = (q && !anyVisible) ? '' : 'none';
  });
}

/* ================= LUU NHAP DANG DO (localStorage) =================
   v5.3 (muc 3): chong mat du lieu khi dang nhap lieu dai (nhieu dong) ma tat/bat lai trinh duyet
   truoc khi bam Luu ("khi nhap lieu do neu chua luu, tat di bat lai se refresh trang moi nhap lai tu
   dau"). Day la 1 web app thong thuong chay trong trinh duyet cua nguoi dung (KHONG phai artifact
   Claude.ai) nen localStorage dung binh thuong, khong bi cam. Chi ap dung cho vai man hinh nhap lieu
   NHIEU DONG cu the (xem module.khovai.js) - KHONG dung de luu du lieu nhay cam. */
function saveDraft(key, data) {
  try { localStorage.setItem('qlnb_draft_' + key, JSON.stringify(data)); } catch (e) { /* vd trinh duyet chan localStorage - im lang, khong lam gian doan nhap lieu */ }
}
function loadDraft(key) {
  try {
    const raw = localStorage.getItem('qlnb_draft_' + key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function clearDraft(key) {
  try { localStorage.removeItem('qlnb_draft_' + key); } catch (e) { /* im lang */ }
}

/* ================= IN PHIEU (dung chung cho tat ca man hinh Nhap/Xuat) =================
   v5.8: doi tu window.open('', '_blank') (tao TAB/CUA SO moi) sang 1 <iframe> AN gan ngay vao trang
   hien tai + iframe.contentWindow.print() - fix loi "đang có lệnh in thì không thao tác được bên
   chính" (yeu cau v5.8). Dieu tra rieng cho thay goc van de: window.open('', '_blank') LUON kich hoat
   hanh vi CHUYEN TAB tu dong cua trinh duyet moi khi duoc goi tu 1 cu click that su cua nguoi dung -
   day la hanh vi trinh duyet, KHONG co flag/API JS nao tat duoc (v5.7 da ghi chu dieu nay khi bo
   w.focus(), nhung do la fix "sai vi tri" - van con tao tab moi, chi bot 1 phan nho cua trieu chung).
   Iframe AN (0x0, khong hien) khong tao browsing context/tab moi nen KHONG kich hoat hanh vi chuyen
   tab do - hop thoai in hien ra (native, do he dieu hanh/trinh duyet ve) nhung tab CHINH van nguyen,
   thao tac binh thuong duoc trong luc do. Iframe cung KHONG bi popup blocker chan (khac window.open)
   nen khong con can meo "mo cua so TRUOC khi await du lieu" nhu ban v5.5 cu (openPrintWindow +
   printPhieuInto tach roi) - gop lai thanh 1 ham duy nhat printHtml(), goi duoc o BAT KY dau (truoc
   hay sau await) deu an toan nhu nhau. */
// Tieu de cong ty in dau trang cho MOI phieu (dung chung, khong can sua tung man hinh Nhap/Xuat).
// v5.4: da nhan va doi chieu dung file "mau_phieu.docx" nguoi dung dinh kem - ten cong ty + dia chi
// khop voi dau trang cua ca 4 mau phieu (Nhap/Xuat kho vai, Nhap/Xuat kho phu kien). Khong con la
// placeholder/suy doan nhu cac ban truoc (xem lich su o v5.1) - neu mau that su thay doi sau nay
// (them logo/ma so thue...), can gui lai file moi de cap nhat.
const COMPANY_LETTERHEAD_HTML = `
  <div class="p-letterhead">
    <div class="p-company">CÔNG TY TNHH THỜI TRANG MOYN</div>
    <div class="p-address">Thôn Đại tự, xã Hoài Đức, TP Hà Nội</div>
  </div>`;

/* v6.25.1: ĐẦU PHIẾU CÓ LOGO (logo trái - tên/địa chỉ giữa, đúng khuôn mẫu Word).
   THAY LOGO: đặt file ảnh tên `logo.png` vào thư mục `frontend/` (cùng chỗ index.html) là xong;
   chưa có thì tự dùng icon của phần mềm (/icons/icon-192.png) nên phiếu không bao giờ vỡ bố cục.
   Chỉ phiếu nào truyền opts.logo = true mới hiện logo — các phiếu cũ giữ nguyên đầu phiếu như trước. */
const COMPANY_LOGO_SRC = '/logo.png';
const COMPANY_LETTERHEAD_LOGO_HTML = `
  <div class="p-letterhead" style="display:flex;align-items:center;gap:14px;text-align:left;">
    <img src="${COMPANY_LOGO_SRC}" alt=""
         onerror="this.onerror=null;this.src='/icons/icon-192.png';"
         style="height:62px;width:auto;max-width:130px;object-fit:contain;">
    <div style="flex:1;text-align:center;">
      <div class="p-company">CÔNG TY TNHH THỜI TRANG MOYN</div>
      <div class="p-address">Thôn Đại tự, xã Hoài Đức, TP Hà Nội</div>
    </div>
  </div>`;

// v5.4: dinh dang "Ngay D thang M nam YYYY" - dong tieu de ngay dung chung cho ca 4 mau phieu in
// (mau_phieu.docx: dong nay tach rieng, KHONG gop chung voi "So phieu" nhu cach lam truoc day).
function fmtNgayThangNam(dateVal) {
  if (!dateVal) return 'Ngày ..... tháng ..... năm .....';
  const d = new Date(dateVal);
  return `Ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
}

// v5.43: đầu phiếu in kho (nhập/xuất vải + phụ kiện) — TÊN PHIẾU căn giữa; dòng dưới: ngày tháng
// căn giữa trang + Số phiếu căn phải CÙNG 1 dòng. Dùng chung cho cả 4 phiếu để đồng nhất.
function phieuHeaderHtml(title, dateVal, soVal) {
  return `<h2 style="text-align:center;margin:0 0 4px;">${escapeHtml(title)}</h2>
      <div style="display:flex;align-items:baseline;margin:0 0 10px;font-size:13px;">
        <span style="flex:1;"></span>
        <span style="flex:1;text-align:center;white-space:nowrap;">${fmtNgayThangNam(dateVal)}</span>
        <span style="flex:1;text-align:right;"><b>Số:</b> ${escapeHtml(String(soVal == null ? '' : soVal))}</span>
      </div>`;
}

// v5.8: ham IN DUY NHAT dung chung cho toan bo app (thay the printPhieu/openPrintWindow/printPhieuInto
// cua ban v5.5-v5.7). opts.extraStyle (tuy chon): CSS bo sung/ghi de rieng cho 1 loai phieu (vd @page
// kich thuoc rieng cho in tem A6 - xem printTemHangLoat trong module.khovai.js); opts.noLetterhead
// (tuy chon): bo qua dau trang cong ty (tem QR khong can dau trang).
function printHtml(title, bodyHtml, opts) {
  opts = opts || {};
  /* v6.73: iframe phải RỘNG ĐÚNG BẰNG VÙNG IN (A4 210mm − lề 2×10mm = 190mm) thì đo chiều cao nội
     dung mới ra đúng số trang. Trước đây để 0×0 nên mọi phép đo đều vô nghĩa.
     Đẩy ra ngoài màn hình thay vì thu về 0 — người dùng vẫn không thấy gì, mà trình duyệt vẫn dàn
     trang thật để đo. Bản IN không đổi: lúc in trình duyệt dàn theo @page chứ không theo cỡ iframe. */
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '190mm';
  iframe.style.height = '297mm';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  /* v6.65: ĐẶT TÊN FILE KHI IN / CHIA SẺ TRÊN ĐIỆN THOẠI.
     Bản in dựng trong iframe, và <title> của iframe chỉ có tác dụng trên trình duyệt máy tính.
     Trên điện thoại (Chrome Android, Safari iOS) hộp "Chia sẻ / Lưu PDF" lấy tên từ TITLE CỦA TRANG
     CHÍNH — nên phiếu nào cũng ra tên kiểu "QLNoiBo.pdf", không phân biệt được phiếu nào của khách nào.
     Cách xử lý: đổi tạm title của trang chính trong lúc in, xong thì trả lại. Trả lại trong cleanup()
     nên dù người dùng bấm Hủy hay in lỗi, tiêu đề trang vẫn về đúng như cũ. */
  const titleGoc = document.title;
  if (title) document.title = String(title).replace(/[\\/:*?"<>|]/g, '-');

  let cleaned = false;
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    document.title = titleGoc;
    // Doi 1 chut sau khi hop thoai in dong (afterprint) roi moi go iframe khoi trang - go NGAY LAP TUC
    // co the cat ngang qua trinh in tren 1 so trinh duyet.
    setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 1000);
  }

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <html><head><title>${escapeHtml(title)}</title>
    <style>
      @page{size:A4;margin:10mm;}
      body{font-family:Arial,sans-serif;padding:0;margin:0;color:#111;}
      table{border-collapse:collapse;width:100%;margin-top:10px;}
      th,td{border:1px solid #999;padding:6px 8px;font-size:13px;text-align:left;}
      th{background:#f0f2f5;}
      .p-letterhead{text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px;}
      .p-company{font-size:16px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;}
      .p-address{font-size:12.5px;color:#333;margin-top:2px;}
      h2{margin:0 0 4px;} h3{margin:18px 0 4px;}
      .p-meta{font-size:13px;margin:2px 0;}
      .p-sign{display:flex;justify-content:space-between;margin-top:50px;text-align:center;font-size:13px;}
      .p-sign > div{flex:1;}
      .p-sign .line{margin-top:60px;border-top:1px solid #333;padding-top:4px;width:70%;margin-left:auto;margin-right:auto;}
      /* v6.73: SỐ TRANG "Trang k / n". body phải position:relative để các ô số trang đặt tuyệt đối
         tính mốc theo body. Ô số trang KHÔNG chiếm chiều cao (absolute) nên không đẩy nội dung. */
      /* v6.73.2: CẮT TRANG CỨNG. Mỗi .p-page cao đúng vùng nội dung dùng được, chừa sẵn dải trống
         cuối trang cho số trang — nhờ vậy số trang KHÔNG BAO GIỜ đè lên bảng dữ liệu.
         Cách cũ (đặt tuyệt đối theo toạ độ) không có dải trống nào nên luôn có nguy cơ chồng chữ. */
      .p-page{position:relative;overflow:visible;page-break-after:always;break-after:page;}
      .p-page:last-child{page-break-after:auto;break-after:auto;}
      .p-sotrang{position:absolute;bottom:2px;right:0;font-size:11px;color:#555;white-space:nowrap;}
      ${opts.extraStyle || ''}
    </style></head>
    <body>${opts.noLetterhead ? '' : (opts.logo ? COMPANY_LETTERHEAD_LOGO_HTML : COMPANY_LETTERHEAD_HTML)}${bodyHtml}</body></html>`);
  doc.close();

  /* ================================================================================================
     v6.73 — ĐÁNH SỐ TRANG "Trang k / n" CHO MỌI PHIẾU IN.
     Vì sao phải tự tính: Chrome KHÔNG hỗ trợ `@page { @bottom-right { content: counter(page) } }`
     (chỉ các bộ dàn trang chuyên dụng mới có), nên không có cách khai báo thuần CSS.
     Cách làm: đo chiều cao nội dung, chia cho chiều cao một trang in, rồi đặt ô số trang tuyệt đối
     tại đáy mỗi trang. Đặt ở ĐÂY (printHtml) nên MỌI phiếu của hệ thống đều có, không phiếu nào sót.

     ⚠️ HẠN CHẾ CẦN BIẾT: số trang tính theo chiều cao nội dung. Nếu trình duyệt đẩy nguyên một khối
     (dòng bảng, khối chữ ký) xuống trang sau để không cắt đôi, nội dung thật sẽ tụt so với mốc đã
     tính và ô số trang có thể lệch vài chục pixel. Tổng số trang thì vẫn đúng.
     ================================================================================================ */
  function chenSoTrang() {
    if (opts.khongSoTrang) return;                 // phiếu nào không muốn đánh số thì truyền cờ này
    const d2 = iframe.contentWindow.document;
    const b2 = d2.body;
    if (!b2 || !b2.children.length) return;

    const MM = 96 / 25.4;                          // 1mm ở 96dpi
    const caoTrang = Math.round((297 - 20) * MM);  // A4 297mm trừ lề trên + dưới (10mm mỗi bên)
    const caoChan = 26;                            // dải trống DÀNH RIÊNG cho số trang, cuối mỗi trang
    const dung = caoTrang - caoChan;               // chiều cao nội dung thật sự dùng được mỗi trang

    /* Gom các khối đang có ra trước, rồi rót lại vào từng trang. Phải chụp danh sách con TRƯỚC khi
       bắt đầu chuyển, vì b2.children là danh sách SỐNG — vừa duyệt vừa gỡ phần tử sẽ nhảy cóc. */
    const khoi = Array.prototype.slice.call(b2.children);
    b2.innerHTML = '';

    const dsTrang = [];
    function trangMoi() {
      const t = d2.createElement('div');
      t.className = 'p-page';
      t.style.height = dung + 'px';
      b2.appendChild(t);
      dsTrang.push(t);
      return t;
    }
    let trang = trangMoi();
    const conLai = () => dung - trang.scrollHeight;

    /* Bảng cao hơn một trang thì CẮT THEO DÒNG: giữ nguyên <thead> ở mỗi phần để trang nào cũng có
       tiêu đề cột. Không cắt thì cả bảng bị đẩy sang trang sau, để lại nửa trang trống. */
    function rotBang(tb) {
      const than = tb.tBodies[0];
      if (!than || !than.rows.length) { trang.appendChild(tb); return; }
      const dong = Array.prototype.slice.call(than.rows);
      let phan = tb.cloneNode(true);
      const thanMoi = () => { const t = phan.tBodies[0]; t.innerHTML = ''; return t; };
      let than2 = thanMoi();
      const dsPhan = [phan];
      trang.appendChild(phan);
      dong.forEach(tr => {
        const them = () => than2.appendChild(tr.cloneNode(true));
        them();
        if (trang.scrollHeight <= dung) return;    // còn chỗ -> giữ nguyên
        than2.removeChild(than2.lastChild);        // trả lại dòng vừa làm tràn

        /* ================================================================================================
           v7.31 — SỬA LỖI MẤT DỮ LIỆU KHI IN (bảng nhỏ ở cuối phiếu biến mất).
           Bản cũ:  if (!than2.rows.length) return;   // "đành để tràn, không mất dữ liệu"
           Nhưng ngay TRƯỚC dòng đó đã `removeChild` dòng vừa thêm, rồi `return` -> DÒNG BỊ MẤT HẲN.
           Xảy ra khi trang hiện tại đã gần đầy: bảng mới vào chưa kịp có dòng nào thì đã tràn, nên
           MỌI dòng của bảng đó đều rơi vào nhánh này và mất sạch — bảng in ra rỗng.
           Đúng ca "khối công nợ cuối phiếu: xem phiếu thì có, in ra không có" (phiếu PX26093): trang 1
           gần đầy nên bảng công nợ 2 dòng bị bỏ trắng, trong khi phiếu khác còn chỗ nên vẫn in đủ.
           Nay: hết chỗ thì SANG TRANG MỚI rồi rót dòng vào đó. Chỉ khi đang ở TRANG MỚI CÒN TRỐNG mà
           một dòng vẫn tràn (dòng cao hơn cả trang in) thì mới để nó tràn — vẫn KHÔNG bỏ dòng nào.
           ================================================================================================ */
        const trangDangTrong = !than2.rows.length && trang.children.length <= 1;
        if (trangDangTrong) { them(); return; }    // dòng cao hơn cả trang: để tràn, KHÔNG bỏ

        trang = trangMoi();
        phan = tb.cloneNode(true);
        than2 = thanMoi();
        dsPhan.push(phan);
        trang.appendChild(phan);
        them();
      });
      /* Phần bảng nào không nhận được dòng nào (trang trước hết chỗ ngay từ đầu) thì gỡ đi, kẻo in ra
         một bảng chỉ có tiêu đề cột trống. */
      dsPhan.forEach(ph => {
        const t = ph.tBodies[0];
        if ((!t || !t.rows.length) && ph.parentNode) ph.parentNode.removeChild(ph);
      });
    }

    khoi.forEach(el => {
      trang.appendChild(el);
      if (trang.scrollHeight <= dung) return;      // vừa khít, giữ nguyên
      trang.removeChild(el);
      if (el.tagName === 'TABLE') {
        /* KHÔNG sang trang mới trước khi cắt bảng: rotBang() tự rót dòng vào CHỖ CÒN TRỐNG của trang
           hiện tại rồi mới sang trang. Sang trang trước là bỏ phí nửa trang, phiếu dài ra vô cớ —
           đã đo bằng mô phỏng: bảng 40 dòng ra 3 trang thay vì 2. */
        rotBang(el);
      } else {
        if (trang.children.length) trang = trangMoi();
        trang.appendChild(el);                     // khối đơn cao hơn trang: để tràn còn hơn cắt mất
      }
    });

    // Trang cuối rỗng (khối cuối vừa khít trang trước) thì bỏ đi, kẻo in ra một trang trắng.
    if (dsTrang.length > 1 && !dsTrang[dsTrang.length - 1].children.length) {
      b2.removeChild(dsTrang.pop());
    }
    dsTrang.forEach((t, i) => {
      const o = d2.createElement('div');
      o.className = 'p-sotrang';
      o.textContent = `Trang ${i + 1} / ${dsTrang.length}`;
      t.appendChild(o);                            // nằm TRONG dải trống cuối trang -> không đè dữ liệu
    });
  }

  iframe.onload = () => {
    try {
      try { chenSoTrang(); } catch (e) { console.warn('[printHtml] khong danh so trang duoc:', e.message); }
      iframe.contentWindow.onafterprint = cleanup;
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      toast('Không mở được hộp thoại in. Có thể thử Ctrl+P nếu cửa sổ in đã hiện nội dung.', 'error');
      cleanup();
    }
  };
  // An toan: phong truong hop onload/afterprint khong bao gio fire (hiem) - khong de iframe rac vinh vien.
  setTimeout(cleanup, 120000);
}

/* ================= QUET QR BANG CAMERA (thu vien html5-qrcode qua CDN) =================
   onDecode(text) duoc goi 1 lan khi quet thanh cong, sau do (MAC DINH) tu dong dung camera va dong modal.
   v5.12: them tham so opts.continuous (mac dinh false - KHONG truyen = giu nguyen het hanh vi cu). Khi
   continuous=true, camera KHONG tu dung/dong sau moi lan quet duoc - cho phep quet lien tiep NHIEU ma QR
   (vd nhieu cay vai lien tuc) chi voi 1 lan mo camera, nguoi dung tu bam "Dong"/Esc khi quet xong (yeu
   cau v5.12: "công đoạn giao vải... Phiếu xuất kho vải: khi quét QR liên tục tự thêm cây tìm thấy"). Ben
   goi (caller) van chi nhan onDecode() cho MOI ma MOI phat hien - tu dong bo qua neu giai ma ra CUNG 1
   chuoi lien tiep nhu lan truoc (camera quet ~10 lan/giay, ma QR con nam trong khung hinh se bi doc lai
   nhieu lan/giay chu khong phai nguoi dung chu dinh "quet lai"), tranh caller tu them trung 1 cay nhieu
   lan chi vi camera chua kip roi khoi vi tri.
   v5.6: dung OVERLAY RIENG (id "__qrScanner"), KHONG di qua openModal()/closeModal() dung chung nua.
   Ly do (bug v5.6 "quét bằng QR để xuất kho không ra, bị out phiếu xuất"): openModal() luon closeModal()
   modal DANG MO truoc do (chi cho 1 modal id "__modal" ton tai cung luc - xem ghi chu tren openModal()).
   Neu goi openQrScanner() TU BEN TRONG 1 modal dang mo (form Xuat kho, Giao vai...), no se am tham GO
   BO modal cha ngay khi mo camera - bien "modal" cha (van con tro toi node vua bi go) khong con gan vao
   trang nua, khien field vua quet duoc ghi vao 1 ban sao vo hinh, ngoai man hinh chinh la "vi sao bi out
   phieu xuat". Overlay rieng nay khong dung/khong dung toi #__modal nen mo/dong khong dung cham gi den
   modal dang mo phia sau - cac diem goi (.x-qr, .xe-qr, .gva-qr trong module.khovai.js/qlsx.js va nut
   "Quét QR" o tab Tồn theo cây) deu khong can sua gi them, tu dong het loi vi dung chung ham nay. */
function openQrScanner(onDecode, opts) {
  opts = opts || {};
  const continuous = !!opts.continuous;
  if (typeof Html5Qrcode === 'undefined') {
    toast('Không tải được thư viện quét QR (kiểm tra kết nối internet).', 'error');
    return;
  }
  // Truy cap camera (getUserMedia) chi duoc trinh duyet cho phep tren "secure context": HTTPS, hoac
  // localhost/127.0.0.1. Neu may khac trong mang LAN mo bang dia chi IP qua HTTP thuan (vd
  // http://192.168.1.20:3000), trinh duyet se TU CHAN truy cap camera truoc ca khi hien hop thoai xin
  // quyen - loi nay KHONG phai do nguoi dung tu choi quyen, ma do thieu HTTPS. Kiem tra truoc va bao
  // dung nguyen nhan thay vi de Html5Qrcode nem loi chung chung roi doan sai la "chua cap quyen".
  if (!window.isSecureContext) {
    // v5.71: nói rõ 2 đường ra thay vì chỉ báo "cần HTTPS".
    toast('Trình duyệt CHẶN camera vì trang đang mở bằng http (không phải https).\n' +
      '• Cách nhanh: dùng MÁY QUÉT CẦM TAY (USB) — bấm vào ô mã rồi quét, không cần https.\n' +
      '• Cách gốc: mở phần mềm bằng địa chỉ https nội bộ (xem HUONG_DAN — bật HTTPS cho máy chủ).', 'error');
    return;
  }
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = '__qrScanner';
  backdrop.innerHTML = `<div class="modal">
      <div class="modal-dragbar" title="Quét mã QR">
        <span class="modal-dragbar-spacer"></span>
        <button type="button" class="modal-btn-close" title="Đóng (Esc)">✕</button>
      </div>
      <div class="modal-body">
        <h3>Quét mã QR</h3>
        <div id="qrReaderBox" style="width:100%;min-height:280px;"></div>
        <p style="font-size:12px;color:#5f6368;">${continuous
          ? 'Chế độ quét liên tục: lần lượt đưa từng mã QR vào camera — mỗi cây tìm thấy sẽ tự thêm vào danh sách. Camera vẫn mở để quét cây tiếp theo, bấm "Đóng" khi quét xong.'
          : 'Đưa camera vào mã QR trên cây vải. Cần cấp quyền truy cập camera cho trình duyệt.'}</p>
        <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancelQr">Đóng</button></div>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  // Bat capture-phase + stopPropagation de Esc chi dong overlay QR nay, khong lam kich hoat luon
  // __modalEscHandler cua modal cha (dang lang nghe bubble-phase tren cung document).
  const escHandler = (e) => { if (e.key === 'Escape') { e.stopPropagation(); stopAndClose(); } };
  document.addEventListener('keydown', escHandler, true);
  function removeOverlay() {
    document.removeEventListener('keydown', escHandler, true);
    backdrop.remove();
  }

  const qr = new Html5Qrcode('qrReaderBox');
  let stopped = false;
  let lastCode = null; // v5.12: chi dung khi continuous=true - xem giai thich trong callback qr.start() ben duoi
  function stopAndClose() {
    if (stopped) return;
    stopped = true;
    qr.stop().catch(() => {}).finally(removeOverlay);
  }
  qr.start(
    { facingMode: 'environment' },
    {
      fps: 10,
      // v5.7: qrbox truoc day la SO PIXEL CO DINH (220) - tren dien thoai, khung video quet THUC TE co
      // the nho hon 220px (modal gioi han max-width:96vw o man hinh <=900px, xem style.css) khien vung
      // quet (crop box) roi RA NGOAI khung hinh that (camera van hien binh thuong vi phan xem-truoc
      // khong phu thuoc vao qrbox, chi vung DUOC QUET moi bi anh huong) - day la nguyen nhan gay loi
      // thuc te "camera mở nhưng không quét được" tren mobile. Doi sang HAM callback (viewfinderWidth/
      // Height la kich thuoc THAT SU cua khung video luc do, do thu vien tu truyen vao) tra ve 1 kich
      // thuoc LUON nho hon/bang khung hinh that (70% canh ngan nhat) - responsive theo dung man hinh.
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const size = Math.max(150, Math.floor(minEdge * 0.7));
        return { width: size, height: size };
      }
    },
    (decodedText) => {
      if (!continuous) { stopAndClose(); onDecode(decodedText); return; }
      // v5.12: che do quet lien tuc - KHONG dung/dong camera o day (khac nhanh mac dinh o tren). Bo qua
      // neu giai ma ra CUNG 1 chuoi nhu lan quet lien truoc do (xem giai thich o dau file).
      if (decodedText === lastCode) return;
      lastCode = decodedText;
      onDecode(decodedText);
    },
    () => {}
  ).catch((err) => {
    // Phan biet ro nguyen nhan thay vi 1 thong bao chung chung, de nguoi dung tu xu ly dung huong:
    // NotAllowedError = da tu choi quyen (hoac trinh duyet/OS chan quyen camera cho site nay) ->
    // vao cai dat trinh duyet cap lai quyen; NotFoundError = may khong co camera hoac camera dang
    // duoc app khac dung (NotReadableError) -> kiem tra thiet bi. SecurityError (phat hien qua thuc te
    // trien khai v5.3) = trinh duyet coi TRANG la secure context (isSecureContext=true, nen KHONG bi
    // chan o buoc kiem tra phia tren) nhung van TU CHOI cap quyen camera vi chuoi chung thuc HTTPS chua
    // duoc tin cay THAT SU - thuong gap khi thiet bi moi "bam qua canh bao do" chu CHUA cai rootCA.pem
    // (xem Buoc 2.7 phan (b) trong HUONG_DAN_CAI_DAT.md), hoac tren iOS thieu buoc bat "Tin cay hoan
    // toan" cho chung chi. Truong hop khong roi vao 4 loai tren, hien luon ten loi that (err.name) thay
    // vi chi 1 cau chung chung, de biet chinh xac trinh duyet dang bao gi ma khong can mo console.
    const name = err && err.name;
    let msg = 'Không mở được camera (' + (name || 'không rõ loại lỗi') + (err && err.message ? ': ' + err.message : '') + '). Kiểm tra quyền truy cập camera của trình duyệt.';
    if (name === 'NotAllowedError') msg = 'Trình duyệt đã CHẶN quyền camera cho trang này. Vào biểu tượng 🔒/ⓘ cạnh địa chỉ trang → Quyền của trang → Camera → Cho phép, rồi thử lại.';
    else if (name === 'NotFoundError' || name === 'OverconstrainedError') msg = 'Không tìm thấy camera trên thiết bị này (hoặc không có camera sau/environment).';
    else if (name === 'NotReadableError') msg = 'Camera đang được ứng dụng khác sử dụng — đóng ứng dụng đó rồi thử lại.';
    else if (name === 'SecurityError') msg = 'Trình duyệt coi chứng chỉ HTTPS của trang này là CHƯA ĐỦ TIN CẬY để cấp quyền camera (dù trang vẫn mở xem được bình thường). Rất có thể thiết bị này mới "bấm qua cảnh báo đỏ" chứ CHƯA cài rootCA.pem — xem lại Bước 2.7 phần (b) trong HUONG_DAN_CAI_DAT.md; trên iPhone/iPad nhớ bật thêm "Tin cậy hoàn toàn" ở Cài đặt chung → Giới thiệu → Cài đặt về Chứng chỉ.';
    console.error('[QR Scanner] getUserMedia error:', err);
    toast(msg, 'error');
    stopped = true;
    removeOverlay();
  });
  backdrop.querySelector('#btnCancelQr').addEventListener('click', stopAndClose);
}
