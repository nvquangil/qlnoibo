// Phan he QUAN LY USER: tai khoan, nhom quyen, ma tran phan quyen theo phan he
window.ModuleUsers = (function () {
  let activeTab = 'users';
  let container, currentUser;
  let groupsCache = [], boPhanCache = [], stagesCache = [], modulesCache = [], nhanVienCache = [];

  /* v7.10 (migration_v684) — CHUC NANG kieu "NANG LUC MO RONG" (ChucNang.MacDinhCho = 0, vd
     QLSX/xemtatca = xem tat ca lenh SX). Khac cac dong con lai:
       - KHONG tick san (mac dinh la KHONG co quyen) - phai tu tick moi duoc cap;
       - chi o "Xem" co y nghia, "Sua"/"Xoa" khong dung den nen khoa lai cho khoi hieu nham.
     Ban cai chua chay migration_v684 thi MacDinhCho luon = 1 -> khong dong nao la nang luc, giao
     dien y nguyen nhu truoc. */
  // MacDinhCho la BIT: driver tra ve true/false, nhung nhan ca 0/1 cho chac (JSON/driver co the doi kieu).
  function laNangLuc(r) { return !!r && (r.MacDinhCho === false || r.MacDinhCho === 0); }
  function nhanNangLuc(r) {
    return laNangLuc(r)
      ? ' <span style="color:#a00;font-size:11px;">(quyền mở rộng — mặc định KHÔNG có, phải tự tick ô Xem)</span>'
      : '';
  }

  function getTabs() {
    return [
      { key: 'users', label: 'Tài khoản' },
      { key: 'groups', label: 'Nhóm quyền' },
      { key: 'perm', label: 'Ma trận phân quyền' }
    ];
  }

  async function render(el, user, tabKey) {
    container = el; currentUser = user;
    if (tabKey) activeTab = tabKey;
    const perm = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.USERS || {});
    container.innerHTML = `<div id="uBody"></div>`;

    const [groupsRes, bpRes, stageRes, modRes, nvRes] = await Promise.all([
      apiGet('/api/users/groups/list'), apiGet('/api/danhmuc/bophan'),
      apiGet('/api/danhmuc/congdoan'), apiGet('/api/users/modules/list'),
      apiGet('/api/danhmuc/nhanvien').catch(() => ({ data: [] }))
    ]);
    groupsCache = groupsRes.data; boPhanCache = bpRes.data; stagesCache = stageRes.data; modulesCache = modRes.data; nhanVienCache = nvRes.data || [];

    if (activeTab === 'users') return renderUsers(perm);
    if (activeTab === 'groups') return renderGroups(perm);
    if (activeTab === 'perm') return renderPermMatrix(perm);
  }

  async function renderUsers(perm) {
    const body = document.getElementById('uBody');
    const res = await apiGet('/api/users');
    const rows = res.data;
    body.innerHTML = `
      <div class="toolbar">${perm.canCreate ? '<button class="btn" id="btnAdd">+ Tạo tài khoản</button>' : ''}</div>
      <table><thead><tr><th>Username</th><th>Họ tên</th><th>Bộ phận</th><th>Nhóm quyền</th><th>Trạng thái</th><th style="width:120px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${escapeHtml(r.Username)}</td><td>${escapeHtml(r.HoTen)}</td><td>${escapeHtml(r.TenBoPhan)}</td>
        <td>${escapeHtml(r.Nhom)}</td><td>${r.IsActive ? '<span class="badge ok">Hoạt động</span>' : '<span class="badge danger">Đã khóa</span>'}</td>
        <td>${perm.canEdit ? '<button class="btn small secondary act-edit">Sửa</button>' : ''} ${perm.canDelete ? '<button class="btn small danger act-del">Xóa</button>' : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-hint">Chưa có tài khoản</td></tr>'}</tbody></table>`;

    if (perm.canCreate) document.getElementById('btnAdd').addEventListener('click', () => openUserForm(null, perm));
    body.querySelectorAll('tbody tr').forEach((tr, i) => {
      const row = rows[i]; if (!row) return;
      const editBtn = tr.querySelector('.act-edit'), delBtn = tr.querySelector('.act-del');
      if (editBtn) editBtn.addEventListener('click', async () => {
        const detail = await apiGet('/api/users/' + row.UserID);
        openUserForm(detail.data, perm);
      });
      if (delBtn) delBtn.addEventListener('click', async () => {
        if (!confirm(`Xóa tài khoản "${row.Username}"?`)) return;
        try { await apiDelete('/api/users/' + row.UserID); toast('Đã xóa.', 'success'); render(container, currentUser); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
  }

  function openUserForm(row, perm) {
    const isEdit = !!row;
    const html = `
      <h3>${isEdit ? 'Sửa tài khoản: ' + escapeHtml(row.Username) : 'Tạo tài khoản mới'}</h3>
      <form id="uForm">
        <div class="form-grid">
          <div class="form-row"><label>Tên đăng nhập *</label><input name="username" value="${escapeHtml(row ? row.Username : '')}" ${isEdit ? 'readonly' : 'required'}></div>
          <div class="form-row"><label>${isEdit ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu *'}</label><input type="password" name="password" ${isEdit ? '' : 'required'}></div>
          <div class="form-row"><label>Họ tên *</label><input name="hoTen" value="${escapeHtml(row ? row.HoTen : '')}" required></div>
          <div class="form-row"><label>Email</label><input name="email" value="${escapeHtml(row ? row.Email : '')}"></div>
          <div class="form-row"><label>Bộ phận</label><select name="boPhanId">
            <option value="">--</option>${opt(boPhanCache, 'BoPhanID', 'TenBoPhan', row ? row.BoPhanID : '')}</select></div>
          <div class="form-row"><label>Liên kết nhân viên (để nhân viên tự xem lương)</label><select name="nhanVienId">
            <option value="">-- Không liên kết --</option>${nhanVienCache.map(nv => `<option value="${nv.NhanVienID}" ${row && row.NhanVienID === nv.NhanVienID ? 'selected' : ''}>${escapeHtml((nv.MaNhanVien ? nv.MaNhanVien + ' - ' : '') + nv.HoTen)}</option>`).join('')}</select></div>
          <div class="form-row"><label>Trạng thái</label><select name="isActive">
            <option value="true" ${!row || row.IsActive ? 'selected' : ''}>Hoạt động</option>
            <option value="false" ${row && !row.IsActive ? 'selected' : ''}>Khóa</option></select></div>
        </div>
        <div class="form-row"><label>Nhóm quyền</label>
          <div>${groupsCache.map(g => `<label style="display:inline-block;margin-right:14px;font-weight:normal;">
            <input type="checkbox" name="groupIds" value="${g.GroupID}" ${row && row.groupIds && row.groupIds.indexOf(g.GroupID) !== -1 ? 'checked' : ''}> ${escapeHtml(g.TenNhom)}</label>`).join('')}</div>
        </div>
        <div class="form-row"><label>Công đoạn sản xuất được phép cập nhật (chỉ áp dụng cho phân hệ Quản lý sản xuất)</label>
          ${/* v7.10: truoc day o nay ganh CA "pham vi xem lenh SX" (bo trong = xem het) nen khong the
               "xem het ma van ghi tien do 1 cong doan". Nay da co quyen rieng QLSX/xemtatca. */''}
          <div style="font-size:12px;color:#5f6368;margin-bottom:4px;">Muốn user <b>xem hết mọi lệnh SX</b> mà vẫn chỉ ghi tiến độ ở công đoạn của mình: giữ nguyên các ô dưới đây, rồi vào <b>Ma trận phân quyền</b> tick ô "Xem" của dòng <i>Xem tất cả lệnh SX (mọi công đoạn)</i>.</div>
          <div>${stagesCache.map(s => `<label style="display:inline-block;margin-right:14px;font-weight:normal;">
            <input type="checkbox" name="stageIds" value="${s.StageID}" ${row && row.stageIds && row.stageIds.indexOf(s.StageID) !== -1 ? 'checked' : ''}> ${escapeHtml(s.TenCongDoan)}</label>`).join('')}</div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Lưu</button>
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    modal.querySelector('#uForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = {
        username: fd.get('username'), password: fd.get('password') || undefined,
        hoTen: fd.get('hoTen'), email: fd.get('email'), boPhanId: fd.get('boPhanId') || null,
        nhanVienId: fd.get('nhanVienId') || null,
        isActive: fd.get('isActive') === 'true',
        groupIds: fd.getAll('groupIds').map(Number), stageIds: fd.getAll('stageIds').map(Number)
      };
      try {
        if (isEdit) await apiPut('/api/users/' + row.UserID, body);
        else await apiPost('/api/users', body);
        closeModal(); toast('Đã lưu.', 'success'); render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  async function renderGroups(perm) {
    const body = document.getElementById('uBody');
    body.innerHTML = `
      <div class="toolbar">${perm.canCreate ? '<button class="btn" id="btnAdd">+ Thêm nhóm quyền</button>' : ''}</div>
      <table><thead><tr><th>Tên nhóm</th><th>Mô tả</th><th>Toàn quyền (Admin)</th><th style="width:100px">Thao tác</th></tr></thead>
      <tbody>${groupsCache.map(g => `<tr><td>${escapeHtml(g.TenNhom)}</td><td>${escapeHtml(g.MoTa)}</td>
        <td>${g.IsAdmin ? '<span class="badge ok">Có</span>' : ''}</td>
        <td>${perm.canDelete && !g.IsAdmin ? `<button class="btn small danger act-del" data-id="${g.GroupID}">Xóa</button>` : ''}</td></tr>`).join('')}</tbody></table>
      <p style="color:#5f6368;font-size:13px;margin-top:10px;">Gán tài khoản vào nhóm ở tab "Tài khoản". Cấu hình quyền chi tiết của từng nhóm ở tab "Ma trận phân quyền".</p>`;

    if (perm.canCreate) document.getElementById('btnAdd').addEventListener('click', () => {
      const html = `<h3>Thêm nhóm quyền</h3><form id="gForm">
        <div class="form-row"><label>Tên nhóm *</label><input name="tenNhom" required></div>
        <div class="form-row"><label>Mô tả</label><input name="moTa"></div>
        <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button><button class="btn" type="submit">Lưu</button></div>
      </form>`;
      const modal = openModal(html);
      modal.querySelector('#btnCancel').addEventListener('click', closeModal);
      modal.querySelector('#gForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try { await apiPost('/api/users/groups', { tenNhom: fd.get('tenNhom'), moTa: fd.get('moTa') }); closeModal(); toast('Đã lưu.', 'success'); render(container, currentUser); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
    body.querySelectorAll('.act-del').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Xóa nhóm quyền này?')) return;
      try { await apiDelete('/api/users/groups/' + btn.dataset.id); toast('Đã xóa.', 'success'); render(container, currentUser); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  // v5.0 (muc 1): them che do "Theo tung user" ben canh "Theo nhom" da co - cho phep chon dung 1
  // tai khoan va tick thang vao o phan quyen CHO RIENG nguoi do (ghi de len quyen tinh tu nhom ho
  // dang thuoc). Khong tick "Ghi de rieng" = user do van dung dung quyen theo nhom nhu truoc gio.
  async function renderPermMatrix(perm) {
    const body = document.getElementById('uBody');
    body.innerHTML = `
      <div class="toolbar">
        <label style="margin-right:16px;"><input type="radio" name="permMode" value="group" checked> Theo nhóm quyền</label>
        <label><input type="radio" name="permMode" value="user"> Theo từng user</label>
      </div>
      <div id="permModeGroupBlock"></div>
      <div id="permModeUserBlock" style="display:none;"></div>`;

    renderGroupMode(perm);
    let userModeLoaded = false;
    body.querySelectorAll('input[name="permMode"]').forEach(r => r.addEventListener('change', (e) => {
      const isUser = e.target.value === 'user';
      document.getElementById('permModeGroupBlock').style.display = isUser ? 'none' : '';
      document.getElementById('permModeUserBlock').style.display = isUser ? '' : 'none';
      if (isUser && !userModeLoaded) { userModeLoaded = true; renderUserMode(perm); }
    }));
  }

  function renderGroupMode(perm) {
    const holderRoot = document.getElementById('permModeGroupBlock');
    const nonAdminGroups = groupsCache.filter(g => !g.IsAdmin);
    holderRoot.innerHTML = `
      <div class="toolbar"><label>Chọn nhóm quyền: </label><select id="selGroup">${opt(nonAdminGroups, 'GroupID', 'TenNhom')}</select></div>
      <div id="matrixHolder"></div>
      <div id="chucNangHolder" style="margin-top:22px;"></div>`;
    const sel = document.getElementById('selGroup');
    async function loadMatrix() {
      if (!sel.value) { document.getElementById('matrixHolder').innerHTML = '<div class="empty-hint">Không có nhóm nào để cấu hình (nhóm Admin luôn có toàn quyền).</div>'; document.getElementById('chucNangHolder').innerHTML = ''; return; }
      const res = await apiGet('/api/users/permissions/' + sel.value);
      const rows = res.data;
      document.getElementById('matrixHolder').innerHTML = `
        <h3 style="margin-top:0;">1. Theo phân hệ (được vào phân hệ nào, được Thêm/Sửa/Xóa trong đó không)</h3>
        <table><thead><tr><th>Phân hệ</th><th>Xem</th><th>Thêm</th><th>Sửa</th><th>Xóa</th></tr></thead>
        <tbody>${rows.map(r => `<tr data-mid="${r.ModuleID}">
          <td>${escapeHtml(r.TenModule)}</td>
          <td><input type="checkbox" class="cv" ${r.CanView ? 'checked' : ''}></td>
          <td><input type="checkbox" class="cc" ${r.CanCreate ? 'checked' : ''}></td>
          <td><input type="checkbox" class="ce" ${r.CanEdit ? 'checked' : ''}></td>
          <td><input type="checkbox" class="cd" ${r.CanDelete ? 'checked' : ''}></td>
        </tr>`).join('')}</tbody></table>
        ${perm.canEdit ? '<button class="btn" id="btnSaveMatrix" style="margin-top:12px;">Lưu ma trận phân quyền</button>' : ''}`;
      if (perm.canEdit) {
        document.getElementById('btnSaveMatrix').addEventListener('click', async () => {
          const permissions = Array.from(document.querySelectorAll('#matrixHolder tbody tr')).map(tr => ({
            moduleId: Number(tr.dataset.mid),
            canView: tr.querySelector('.cv').checked, canCreate: tr.querySelector('.cc').checked,
            canEdit: tr.querySelector('.ce').checked, canDelete: tr.querySelector('.cd').checked
          }));
          try { await apiPut('/api/users/permissions/' + sel.value, { permissions }); toast('Đã lưu phân quyền. User cần đăng nhập lại để nhận quyền mới.', 'success'); }
          catch (err) { toast(err.message, 'error'); }
        });
      }
      loadChucNangMatrix();
    }

    // Lop phan quyen chi tiet hon: trong 1 phan he da duoc xem o tren, cho Xem/Sua/Xoa RIENG tung
    // MAN HINH CON (tab) cu the (v5.0: chi co Xem; v5.3: bo sung Sua/Xoa - xem migration_v53.sql).
    // Mac dinh ca 3 deu duoc phep (tick san) - bo tick Xem = an tab do khoi menu cua nhom nay (xem
    // app.js visibleTabsOf()); bo tick Sua/Xoa = van thay tab nhung nut Sua/Xoa trong do bi an/chan,
    // ke ca khi nhom van con quyen Sua/Xoa o cap PHAN HE ben tren (2 lop la AND - xem effectivePerm()
    // trong common.js va requireChucNang trong backend/middleware/auth.js). Can chay migration_v5_chucnang.sql
    // + migration_v53.sql truoc.
    async function loadChucNangMatrix() {
      const holder = document.getElementById('chucNangHolder');
      if (!sel.value) { holder.innerHTML = ''; return; }
      const res = await apiGet('/api/users/permissions-chucnang/' + sel.value);
      const rows = res.data;
      if (!rows.length) {
        holder.innerHTML = res.message ? `<div class="empty-hint">${escapeHtml(res.message)}</div>` : '';
        return;
      }
      const byModule = {};
      rows.forEach(r => { (byModule[r.ModuleCode] = byModule[r.ModuleCode] || []).push(r); });
      holder.innerHTML = `
        <h3>2. Theo từng chức năng (Xem/Sửa/Xóa riêng cho từng màn hình con trong phân hệ đã cho xem ở trên)</h3>
        <p style="color:#5f6368;font-size:13px;margin-top:-6px;">Mặc định mọi chức năng đều được cả 3 quyền (đã tick sẵn). Bỏ tick "Xem" = ẩn hẳn tab khỏi menu của nhóm này. Bỏ tick "Sửa"/"Xóa" = tab vẫn hiện nhưng thao tác đó bị chặn, dù phân hệ ở mục 1 vẫn cho phép (2 lớp phải cùng cho phép mới thực hiện được).<br><span style="color:#a00;">Riêng dòng ghi <b>"quyền mở rộng"</b> thì ngược lại: mặc định KHÔNG có, phải tự tick ô "Xem" mới được cấp (vd <i>Xem tất cả lệnh SX</i> — cho xem hết lệnh SX mà vẫn giữ nguyên danh sách công đoạn được ghi tiến độ).</span></p>
        ${Object.keys(byModule).map(mc => `
          <div class="card">
            <b>${escapeHtml(mc)}</b>
            <table style="margin-top:8px;"><thead><tr><th>Chức năng</th><th style="width:70px">Xem</th><th style="width:70px">Sửa</th><th style="width:70px">Xóa</th></tr></thead>
            <tbody>${byModule[mc].map(r => `<tr data-cnid="${r.ChucNangID}">
                <td>${escapeHtml(r.TenChucNang)}${nhanNangLuc(r)}</td>
                <td><input type="checkbox" class="cn-view" ${r.CanView ? 'checked' : ''}></td>
                <td><input type="checkbox" class="cn-edit" ${r.CanEdit ? 'checked' : ''} ${laNangLuc(r) ? 'disabled' : ''}></td>
                <td><input type="checkbox" class="cn-delete" ${r.CanDelete ? 'checked' : ''} ${laNangLuc(r) ? 'disabled' : ''}></td>
              </tr>`).join('')}</tbody></table>
          </div>`).join('')}
        ${perm.canEdit ? '<button class="btn" id="btnSaveChucNang">Lưu phân quyền chức năng</button>' : ''}`;
      if (perm.canEdit) {
        document.getElementById('btnSaveChucNang').addEventListener('click', async () => {
          const items = Array.from(holder.querySelectorAll('tbody tr[data-cnid]')).map(tr => ({
            chucNangId: Number(tr.dataset.cnid),
            canView: tr.querySelector('.cn-view').checked,
            canEdit: tr.querySelector('.cn-edit').checked,
            canDelete: tr.querySelector('.cn-delete').checked
          }));
          try { await apiPut('/api/users/permissions-chucnang/' + sel.value, { items }); toast('Đã lưu phân quyền chức năng. User cần đăng nhập lại để nhận quyền mới.', 'success'); }
          catch (err) { toast(err.message, 'error'); }
        });
      }
    }

    sel.addEventListener('change', loadMatrix);
    if (nonAdminGroups.length) loadMatrix();
    else document.getElementById('matrixHolder').innerHTML = '<div class="empty-hint">Chưa có nhóm quyền nào ngoài Admin.</div>';
  }

  // v5.0 (muc 1): che do "Theo tung user" - chon 1 tai khoan, tick "Ghi de rieng" cho phan he/chuc
  // nang nao muon set quyen KHAC voi nhom ho dang thuoc. Bo tick = xoa ghi de, user tro lai dung
  // quyen tinh tu nhom nhu binh thuong (khong lam mat du lieu phan quyen theo nhom da cau hinh).
  async function renderUserMode(perm) {
    const holderRoot = document.getElementById('permModeUserBlock');
    const usersRes = await apiGet('/api/users');
    const users = usersRes.data;
    holderRoot.innerHTML = `
      <div class="toolbar"><label>Chọn tài khoản: </label><select id="selUser">${users.length ? opt(users, 'UserID', 'Username') : ''}</select></div>
      <div id="userMatrixHolder"></div>
      <div id="userChucNangHolder" style="margin-top:22px;"></div>`;
    const selU = document.getElementById('selUser');

    async function loadUserMatrix() {
      const matrixHolder = document.getElementById('userMatrixHolder');
      const cnHolder = document.getElementById('userChucNangHolder');
      if (!selU.value) { matrixHolder.innerHTML = '<div class="empty-hint">Chưa có tài khoản nào.</div>'; cnHolder.innerHTML = ''; return; }
      const res = await apiGet('/api/users/permissions-user/' + selU.value);
      const rows = res.data;
      if (!rows.length) {
        matrixHolder.innerHTML = res.message ? `<div class="empty-hint">${escapeHtml(res.message)}</div>` : '';
        cnHolder.innerHTML = '';
        return;
      }
      matrixHolder.innerHTML = `
        <h3 style="margin-top:0;">1. Theo phân hệ (ghi đè riêng cho user này, bỏ qua nhóm)</h3>
        <p style="color:#5f6368;font-size:13px;margin-top:-6px;">Chỉ tick "Ghi đè riêng" cho phân hệ nào muốn đặt quyền KHÁC với (các) nhóm mà user này đang thuộc. Không tick = user vẫn dùng đúng quyền tính theo nhóm như bình thường.</p>
        <table><thead><tr><th>Phân hệ</th><th>Ghi đè riêng</th><th>Xem</th><th>Thêm</th><th>Sửa</th><th>Xóa</th></tr></thead>
        <tbody>${rows.map(r => `<tr data-mid="${r.ModuleID}">
          <td>${escapeHtml(r.TenModule)}</td>
          <td><input type="checkbox" class="ov" ${r.HasOverride ? 'checked' : ''}></td>
          <td><input type="checkbox" class="cv" ${r.CanView ? 'checked' : ''} ${r.HasOverride ? '' : 'disabled'}></td>
          <td><input type="checkbox" class="cc" ${r.CanCreate ? 'checked' : ''} ${r.HasOverride ? '' : 'disabled'}></td>
          <td><input type="checkbox" class="ce" ${r.CanEdit ? 'checked' : ''} ${r.HasOverride ? '' : 'disabled'}></td>
          <td><input type="checkbox" class="cd" ${r.CanDelete ? 'checked' : ''} ${r.HasOverride ? '' : 'disabled'}></td>
        </tr>`).join('')}</tbody></table>
        ${perm.canEdit ? '<button class="btn" id="btnSaveUserMatrix" style="margin-top:12px;">Lưu phân quyền riêng</button>' : ''}`;

      matrixHolder.querySelectorAll('tbody tr').forEach(tr => {
        const ov = tr.querySelector('.ov');
        ov.addEventListener('change', () => {
          ['.cv', '.cc', '.ce', '.cd'].forEach(s => { tr.querySelector(s).disabled = !ov.checked; });
        });
      });

      if (perm.canEdit) {
        document.getElementById('btnSaveUserMatrix').addEventListener('click', async () => {
          const permissions = Array.from(matrixHolder.querySelectorAll('tbody tr')).map(tr => ({
            moduleId: Number(tr.dataset.mid), override: tr.querySelector('.ov').checked,
            canView: tr.querySelector('.cv').checked, canCreate: tr.querySelector('.cc').checked,
            canEdit: tr.querySelector('.ce').checked, canDelete: tr.querySelector('.cd').checked
          }));
          try { await apiPut('/api/users/permissions-user/' + selU.value, { permissions }); toast('Đã lưu phân quyền riêng. User cần đăng nhập lại để nhận quyền mới.', 'success'); }
          catch (err) { toast(err.message, 'error'); }
        });
      }
      loadUserChucNangMatrix();
    }

    async function loadUserChucNangMatrix() {
      const holder = document.getElementById('userChucNangHolder');
      if (!selU.value) { holder.innerHTML = ''; return; }
      const res = await apiGet('/api/users/permissions-chucnang-user/' + selU.value);
      const rows = res.data;
      if (!rows.length) {
        holder.innerHTML = res.message ? `<div class="empty-hint">${escapeHtml(res.message)}</div>` : '';
        return;
      }
      const byModule = {};
      rows.forEach(r => { (byModule[r.ModuleCode] = byModule[r.ModuleCode] || []).push(r); });
      holder.innerHTML = `
        <h3>2. Theo từng chức năng — Xem/Sửa/Xóa (ghi đè riêng, bỏ qua nhóm)</h3>
        <p style="color:#5f6368;font-size:13px;margin-top:-6px;">Chỉ tick "Ghi đè" cho chức năng nào muốn đặt Xem/Sửa/Xóa RIÊNG cho user này, khác với (các) nhóm mà họ đang thuộc.</p>
        ${Object.keys(byModule).map(mc => `
          <div class="card">
            <b>${escapeHtml(mc)}</b>
            <table style="margin-top:8px;"><thead><tr><th>Chức năng</th><th style="width:80px">Ghi đè</th><th style="width:70px">Xem</th><th style="width:70px">Sửa</th><th style="width:70px">Xóa</th></tr></thead>
            <tbody>${byModule[mc].map(r => `<tr data-cnid="${r.ChucNangID}"${laNangLuc(r) ? ' data-nangluc="1"' : ''}>
                <td>${escapeHtml(r.TenChucNang)}${nhanNangLuc(r)}</td>
                <td><input type="checkbox" class="cn-ov" ${r.HasOverride ? 'checked' : ''}></td>
                <td><input type="checkbox" class="cn-view" ${r.CanView ? 'checked' : ''} ${r.HasOverride ? '' : 'disabled'}></td>
                <td><input type="checkbox" class="cn-edit" ${r.CanEdit ? 'checked' : ''} ${r.HasOverride && !laNangLuc(r) ? '' : 'disabled'}></td>
                <td><input type="checkbox" class="cn-delete" ${r.CanDelete ? 'checked' : ''} ${r.HasOverride && !laNangLuc(r) ? '' : 'disabled'}></td>
              </tr>`).join('')}</tbody></table>
          </div>`).join('')}
        ${perm.canEdit ? '<button class="btn" id="btnSaveUserChucNang">Lưu phân quyền chức năng riêng</button>' : ''}`;

      holder.querySelectorAll('tbody tr[data-cnid]').forEach(tr => {
        const ov = tr.querySelector('.cn-ov');
        ov.addEventListener('change', () => {
          // v7.10: dong NANG LUC (data-nangluc) chi dung o "Xem" - Sua/Xoa phai KHOA lai ngay ca khi
          // da tick "Ghi de", keo mo ra roi lai hieu nham la co y nghia.
          const nangLuc = tr.dataset.nangluc === '1';
          tr.querySelector('.cn-view').disabled = !ov.checked;
          ['.cn-edit', '.cn-delete'].forEach(s => { tr.querySelector(s).disabled = !ov.checked || nangLuc; });
        });
      });

      if (perm.canEdit) {
        document.getElementById('btnSaveUserChucNang').addEventListener('click', async () => {
          const items = Array.from(holder.querySelectorAll('tbody tr[data-cnid]')).map(tr => ({
            chucNangId: Number(tr.dataset.cnid), override: tr.querySelector('.cn-ov').checked,
            canView: tr.querySelector('.cn-view').checked,
            canEdit: tr.querySelector('.cn-edit').checked,
            canDelete: tr.querySelector('.cn-delete').checked
          }));
          try { await apiPut('/api/users/permissions-chucnang-user/' + selU.value, { items }); toast('Đã lưu phân quyền chức năng riêng. User cần đăng nhập lại để nhận quyền mới.', 'success'); }
          catch (err) { toast(err.message, 'error'); }
        });
      }
    }

    selU.addEventListener('change', loadUserMatrix);
    if (users.length) loadUserMatrix();
    else document.getElementById('userMatrixHolder').innerHTML = '<div class="empty-hint">Chưa có tài khoản nào.</div>';
  }

  return { render, getTabs };
})();
