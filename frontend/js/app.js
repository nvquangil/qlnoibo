// Dieu phoi chinh cua ung dung: kiem tra dang nhap, dung sidebar theo quyen, chuyen doi giua cac phan he

// Thu tu trong mang nay quyet dinh phan he nao duoc chon mac dinh khi vua dang nhap (phan he dau
// tien ma user co quyen xem) - QLSX dat len dau de "Dashboard quan ly san xuat" la trang chu sau
// dang nhap (theo yeu cau v5.0), DANHMUC/USERS chi la cong cu quan tri nen chuyen xuong duoi.
const MODULES = [
  /* v6.67: DASHBOARD đứng ĐẦU nên ai được cấp quyền xem sẽ thấy nó NGAY khi đăng nhập (init() mở
     phân hệ đầu tiên mà user có quyền). Ai KHÔNG có quyền thì mục này bị lọc khỏi danh sách và
     trang chủ vẫn là Quản lý sản xuất như trước — không đổi gì với người đang dùng. */
  { code: 'DASHBOARD', label: 'Dashboard kinh doanh', icon: '📈', mod: window.ModuleDashboard },
  { code: 'QLSX', label: 'Quản lý sản xuất', icon: '🧵', mod: window.ModuleQLSX },
  { code: 'KHOVAI', label: 'Quản lý kho vải', icon: '🧶', mod: window.ModuleKhoVai },
  // v6.24.6: Quản lý phụ kiện đứng TRƯỚC Thẻ kho hàng hóa (theo thứ tự làm việc: NPL trước, thành phẩm sau).
  { code: 'PHUKIEN', label: 'Quản lý phụ kiện', icon: '🧷', mod: window.ModulePhuKien },
  { code: 'KHOHANG', label: 'Thẻ kho hàng hóa', icon: '📦', mod: window.ModuleKhoHang },
  // v6.23: phân hệ công nợ (phiếu thu / phiếu chi / công nợ khách hàng / công nợ NCC)
  { code: 'CONGNO', label: 'Quản lý công nợ', icon: '💵', mod: window.ModuleCongNo },
  // v6.26: báo cáo tồn kho (hàng hóa/vải/phụ kiện) + tài chính + kết quả kinh doanh
  { code: 'BAOCAO', label: 'Báo cáo kinh doanh', icon: '📊', mod: window.ModuleBaoCao },
  // v7.23: đi tuyến thị trường (shop bán lẻ, ghé thăm GPS, lộ trình, doanh số NVKD)
  { code: 'DMS', label: 'Đi tuyến thị trường', icon: '🛣️', mod: window.ModuleDMS },
  { code: 'HRM', label: 'Quản lý nhân sự', icon: '👥', mod: window.ModuleHRM },
  { code: 'PAYROLL', label: 'Tính lương', icon: '💰', mod: window.ModulePayroll },
  { code: 'MYPAY', label: 'Bảng lương của tôi', icon: '🧾', mod: window.ModuleMyPay },
  { code: 'DANHMUC', label: 'Danh mục', icon: '📋', mod: window.ModuleDanhMuc },
  { code: 'USERS', label: 'Quản lý User', icon: '👤', mod: window.ModuleUsers }
];

let currentUser = null;

async function init() {
  try {
    const { user } = await apiGet('/api/auth/session');
    currentUser = user;
  } catch (e) {
    window.location.href = '/login.html';
    return;
  }

  document.getElementById('userInfo').innerHTML =
    `<strong>${escapeHtml(currentUser.hoTen)}</strong><br><span style="opacity:.7">${escapeHtml(currentUser.groups.join(', ') || currentUser.boPhan || '')}</span>`;

  document.getElementById('btnLogout').addEventListener('click', async () => {
    await apiPost('/api/auth/logout', {});
    window.location.href = '/login.html';
  });
  document.getElementById('btnChangePassword').addEventListener('click', openChangePasswordForm);

  initMobileNav();
  initNotifications();
  registerServiceWorker();

  const visibleModules = MODULES.filter(m => currentUser.isAdmin || (currentUser.permissions[m.code] && currentUser.permissions[m.code].canView));
  renderSidebar(visibleModules);

  // v5.7: doc lai trang thai tu URL hash (#CODE/TAB, xem renderSidebar - moi menu gio la <a href="#...">
  // that su) neu co va con hop le (dung quyen) - dung khi mo tab moi/mo lai 1 duong link cu the (yeu cau
  // v5.7 "giữ shift click hoặc chuột phải để mở tab mới") thay vi luon quay ve phan he dau tien.
  const fromHash = parseModuleHash(visibleModules);
  if (fromHash) {
    switchModule(fromHash.code, fromHash.tab);
  } else if (visibleModules.length) {
    const first = visibleModules[0];
    const tabs = visibleTabsOf(first.code, first.mod.getTabs ? first.mod.getTabs(currentUser) : []);
    switchModule(first.code, tabs[0] ? tabs[0].key : undefined);
  } else {
    document.getElementById('content').innerHTML = '<div class="empty-hint">Tài khoản của bạn chưa được cấp quyền truy cập phân hệ nào. Liên hệ Admin để được cấp quyền.</div>';
  }
}

function parseModuleHash(visibleModules) {
  const raw = (location.hash || '').replace(/^#/, '');
  if (!raw) return null;
  const [code, tab] = raw.split('/');
  if (!visibleModules.some(m => m.code === code)) return null;
  return { code, tab: tab || undefined };
}

// Menu 2 cap: bam ten phan he -> so/cuon danh sach chuc nang cua no ngay ben duoi (accordion, chi
// mo 1 phan he tai 1 thoi diem); bam 1 chuc nang -> render man hinh do vao #content ben phai, khong
// chuyen trang. Danh sach chuc nang cua tung phan he lay tu mod.getTabs(user) (moi module tu quyet
// dinh chuc nang nao dang hien theo quyen cua user, xem module.*.js).
let expandedModuleCode = null;

// Loc bo cac chuc nang (tab) bi an theo phan quyen chi tiet cua nhom (v5.0 - xem
// migration_v5_chucnang.sql + loadUserContext.js). currentUser.hiddenChucNang la mang key dang
// "MODULECODE:machucnang"; admin luon co mang rong (khong bao gio bi an gi).
function visibleTabsOf(moduleCode, tabs) {
  const hidden = currentUser.hiddenChucNang || [];
  if (!hidden.length) return tabs;
  return tabs.filter(t => hidden.indexOf(moduleCode + ':' + t.key) === -1);
}

// v5.7: moi muc menu gio la <a href="#CODE/TAB"> THAT SU (truoc day khong co href, trinh duyet coi nhu
// <span>, khong the shift-click/chuot-phai "Mo trong tab moi" - yeu cau v5.7 "Tất cả các menu có thể
// giữ shift click chuột để mở tab mới hoặc chuột phải vào chọn mở tab mới"). Bam CHUOT TRAI THUONG
// (khong giu Ctrl/Shift/Meta, khong phai chuot giua) van xu ly ngay trong SPA (preventDefault, khong
// reload trang) nhu truoc; cac to hop khac de trinh duyet tu mo tab/cua so moi theo href.
function renderSidebar(visibleModules) {
  const nav = document.getElementById('navMenu');
  nav.innerHTML = visibleModules.map(m => {
    const tabs = visibleTabsOf(m.code, m.mod.getTabs ? m.mod.getTabs(currentUser) : []);
    const firstTabKey = tabs[0] ? tabs[0].key : '';
    const subHtml = tabs.map(t => `<a class="nav-fn" href="#${encodeURIComponent(m.code)}/${encodeURIComponent(t.key)}" data-code="${m.code}" data-tab="${t.key}">${escapeHtml(t.label)}</a>`).join('');
    return `<div class="nav-group">
      <a class="nav-mod" href="#${encodeURIComponent(m.code)}/${encodeURIComponent(firstTabKey)}" data-code="${m.code}"><span>${m.icon} ${m.label}</span><span class="nav-arrow">▸</span></a>
      <div class="nav-sub" data-code="${m.code}">${subHtml}</div>
    </div>`;
  }).join('');

  function isPlainLeftClick(e) { return !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0; }

  nav.querySelectorAll('.nav-mod').forEach(a => a.addEventListener('click', (e) => {
    if (!isPlainLeftClick(e)) return; // Ctrl/Shift/Meta/giua-chuot -> de trinh duyet tu mo tab/cua so moi
    e.preventDefault();
    const code = a.dataset.code;
    toggleModuleMenu(code);
    // v5.7: bam TIEU DE phan he (truoc day CHI xo/cuon submenu, khong dong cham #content) gio CUNG mo
    // luon man hinh dau tien cua phan he do khi dang MO RONG no - sua tan goc loi "1 so man hinh (vd Ra
    // lệnh sản xuất) tưởng chừng không refresh về trang trắng khi bấm lại": nguyen nhan thuc su la nguoi
    // dung bam vao TIEU DE (chi xo/cuon menu) thay vi bam dung muc con ben duoi, nen #content cu (da
    // dien du lieu tu truoc) khong bao gio duoc ve lai. Chi kich hoat khi dang MO RONG (khong phai luc
    // dang THU GON lai) - tranh render khi nguoi dung chi dinh dong submenu.
    if (expandedModuleCode === code) {
      const entry = MODULES.find(m => m.code === code);
      if (entry && entry.mod) {
        const tabs = visibleTabsOf(code, entry.mod.getTabs ? entry.mod.getTabs(currentUser) : []);
        switchModule(code, tabs[0] ? tabs[0].key : undefined);
      }
    }
  }));
  nav.querySelectorAll('.nav-fn').forEach(a => a.addEventListener('click', (e) => {
    if (!isPlainLeftClick(e)) return;
    e.preventDefault();
    switchModule(a.dataset.code, a.dataset.tab);
  }));
}

function toggleModuleMenu(code) {
  expandedModuleCode = expandedModuleCode === code ? null : code;
  applyExpandedState();
}

function applyExpandedState() {
  document.querySelectorAll('.nav-sub').forEach(el => el.classList.toggle('open', el.dataset.code === expandedModuleCode));
  document.querySelectorAll('.nav-mod').forEach(el => el.classList.toggle('expanded', el.dataset.code === expandedModuleCode));
}

async function switchModule(code, tabKey) {
  expandedModuleCode = code;
  applyExpandedState();
  document.querySelectorAll('.nav-fn').forEach(a => a.classList.toggle('active', a.dataset.code === code && a.dataset.tab === tabKey));
  const entry = MODULES.find(m => m.code === code);
  if (!entry || !entry.mod) return;
  document.getElementById('pageTitle').textContent = entry.icon + ' ' + entry.label;
  const content = document.getElementById('content');
  // v5.97: chuyển hẳn màn hình khác -> đóng SẠCH mọi cửa sổ đang mở lồng nhau (từ v5.97 modal có ngăn
  // xếp "đóng thì quay về bảng trước"; không dọn ở đây thì các bảng cha còn treo trong DOM).
  if (typeof closeAllModals === 'function') closeAllModals();
  content.innerHTML = '<div class="empty-hint">Đang tải...</div>';
  // v5.7: phan anh trang thai hien tai len URL (#CODE/TAB) - dung replaceState (KHONG dung pushState)
  // de khong cong don lich su "Back" cho tung lan chuyen menu (day khong phai dieu huong nhieu trang
  // rieng biet); muc dich chinh la de href cua menu (xem renderSidebar) luon dung, va mo tab moi/F5 tu
  // 1 duong link cu the se quay lai dung man hinh (xem parseModuleHash trong init()).
  try { history.replaceState(null, '', '#' + encodeURIComponent(code) + (tabKey ? '/' + encodeURIComponent(tabKey) : '')); } catch (e) { /* noop - vd trinh duyet chan History API */ }
  try {
    await entry.mod.render(content, currentUser, tabKey);
  } catch (err) {
    content.innerHTML = `<div class="empty-hint">Lỗi tải dữ liệu: ${escapeHtml(err.message)}</div>`;
  }
}

// Doi mat khau tu phuc vu - bat cu user nao dang nhap deu bam duoc (khong phu thuoc phan quyen
// phan he), khac voi Admin reset mat khau ho (da co san trong module.users.js openUserForm).
function openChangePasswordForm() {
  const html = `
    <h3>Đổi mật khẩu</h3>
    <form id="cpForm">
      <div class="form-row"><label>Mật khẩu hiện tại *</label><input type="password" name="currentPassword" required autocomplete="current-password"></div>
      <div class="form-row"><label>Mật khẩu mới * (tối thiểu 6 ký tự)</label><input type="password" name="newPassword" minlength="6" required autocomplete="new-password"></div>
      <div class="form-row"><label>Nhập lại mật khẩu mới *</label><input type="password" name="confirmPassword" minlength="6" required autocomplete="new-password"></div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
        <button type="submit" class="btn">Đổi mật khẩu</button>
      </div>
    </form>`;
  const modal = openModal(html);
  modal.querySelector('#btnCancel').addEventListener('click', closeModal);
  modal.querySelector('#cpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newPassword = fd.get('newPassword'), confirmPassword = fd.get('confirmPassword');
    if (newPassword !== confirmPassword) { toast('Mật khẩu mới nhập lại không khớp.', 'error'); return; }
    try {
      await apiPut('/api/auth/change-password', { currentPassword: fd.get('currentPassword'), newPassword });
      closeModal(); toast('Đã đổi mật khẩu. Lần đăng nhập sau vui lòng dùng mật khẩu mới.', 'success');
    } catch (err) { toast(err.message, 'error'); }
  });
}

// PWA: cho phep "Them vao man hinh chinh" tren mobile, mo len giong app thuc (khong co thanh dia
// chi) - can ca manifest.json (khai bao ten/icon) va 1 service worker dang ky duoc (dieu kien bat
// buoc de Chrome/Edge hien banner cai dat), du service worker khong cache gi nhieu.
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* khong chan luong dung nếu loi */ });
  }
}

init();
