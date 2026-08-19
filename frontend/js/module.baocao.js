/* Phan he BAO CAO KINH DOANH (v6.26)
   6 tab: Ton kho hang hoa / Ton kho vai / Ton kho phu kien / Bao cao tai chinh / Ket qua kinh doanh
          / Gia von hang hoa
   Moi tab deu dung CHUNG 1 thanh chon ky (tu ngay - den ngay) o dau man hinh, tru tab Gia von. */
window.ModuleBaoCao = (function () {
  let activeTab = 'tonhanghoa';
  let container, currentUser;
  // Ky bao cao dung chung cho moi tab — doi ky o tab nay sang tab khac van giu.
  let ky = { tuNgay: '', denNgay: '' };

  function getTabs() {
    return [
      { key: 'tonhanghoa', label: 'Tồn kho hàng hóa' },
      { key: 'tonvai', label: 'Tồn kho vải' },
      { key: 'tonphukien', label: 'Tồn kho phụ kiện' },
      { key: 'taichinh', label: 'Báo cáo tài chính' },
      { key: 'kinhdoanh', label: 'Kết quả kinh doanh' },
      { key: 'giavon', label: 'Giá vốn hàng hóa' }
    ];
  }

  function macDinhKy() {
    if (ky.tuNgay && ky.denNgay) return;
    const h = new Date();
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    ky = { tuNgay: iso(new Date(h.getFullYear(), h.getMonth(), 1)), denNgay: iso(h) };
  }

  async function render(el, user, tabKey) {
    container = el; currentUser = user;
    if (tabKey) activeTab = tabKey;
    macDinhKy();
    const rawPerm = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.BAOCAO || {});
    const perm = effectivePerm(user, 'BAOCAO', activeTab, rawPerm);
    container.innerHTML = '<div id="bcBody"><div class="empty-hint">Đang tải...</div></div>';

    if (activeTab === 'giavon') return renderGiaVon(perm);
    if (activeTab === 'taichinh') return renderTaiChinh(perm);
    if (activeTab === 'kinhdoanh') return renderKinhDoanh(perm);
    return renderTonKho(perm, activeTab);
  }

  /* ---------------- Thanh chon ky dung chung ---------------- */
  function thanhKyHtml(themNut) {
    return `<div class="toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <label style="font-size:13px;">Từ ngày <input type="date" id="bcTu" value="${ky.tuNgay}" style="width:auto;"></label>
      <label style="font-size:13px;">Đến ngày <input type="date" id="bcDen" value="${ky.denNgay}" style="width:auto;"></label>
      <button type="button" class="btn small" id="bcXem">Xem báo cáo</button>
      <span style="border-left:1px solid var(--border);height:22px;"></span>
      <button type="button" class="btn small secondary bc-nhanh" data-loai="thang">Tháng này</button>
      <button type="button" class="btn small secondary bc-nhanh" data-loai="thangtruoc">Tháng trước</button>
      <button type="button" class="btn small secondary bc-nhanh" data-loai="quy">Quý này</button>
      <button type="button" class="btn small secondary bc-nhanh" data-loai="nam">Năm nay</button>
      <span style="margin-left:auto;display:flex;gap:6px;">
        ${themNut || ''}
        <button type="button" class="btn small secondary" id="bcIn">🖨️ In</button>
        <button type="button" class="btn small secondary" id="bcExcel">📊 Xuất Excel</button>
      </span>
    </div>`;
  }

  function wireKy(loaiExport, tenFile) {
    const body = document.getElementById('bcBody');
    const doc = () => {
      ky.tuNgay = document.getElementById('bcTu').value || ky.tuNgay;
      ky.denNgay = document.getElementById('bcDen').value || ky.denNgay;
    };
    body.querySelector('#bcXem').addEventListener('click', () => {
      doc();
      if (ky.tuNgay > ky.denNgay) return toast('"Từ ngày" đang lớn hơn "Đến ngày".', 'error');
      render(container, currentUser, activeTab).catch(err => toast(err.message, 'error'));
    });
    body.querySelectorAll('.bc-nhanh').forEach(b => b.addEventListener('click', () => {
      const h = new Date();
      const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const l = b.dataset.loai;
      if (l === 'thang') ky = { tuNgay: iso(new Date(h.getFullYear(), h.getMonth(), 1)), denNgay: iso(h) };
      else if (l === 'thangtruoc') ky = { tuNgay: iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), denNgay: iso(new Date(h.getFullYear(), h.getMonth(), 0)) };
      else if (l === 'quy') { const q = Math.floor(h.getMonth() / 3) * 3; ky = { tuNgay: iso(new Date(h.getFullYear(), q, 1)), denNgay: iso(h) }; }
      else ky = { tuNgay: iso(new Date(h.getFullYear(), 0, 1)), denNgay: iso(h) };
      render(container, currentUser, activeTab).catch(err => toast(err.message, 'error'));
    }));
    const nutIn = body.querySelector('#bcIn');
    if (nutIn) nutIn.addEventListener('click', () => inBaoCao());
    const nutXls = body.querySelector('#bcExcel');
    if (nutXls) nutXls.addEventListener('click', () =>
      taiFile(`/api/baocao/export?loai=${loaiExport}&tuNgay=${ky.tuNgay}&denNgay=${ky.denNgay}`,
        `${tenFile}_${ky.tuNgay}_${ky.denNgay}.xlsx`));
  }

  /* Tai file Excel qua fetch (khong dung <a download> — v6.21.1 tung luu ra file "export" khong duoi,
     va khi backend tra JSON loi thi file xlsx hong ma nguoi dung khong biet vi sao). */
  function taiFile(url, ten) {
    fetch(url, { credentials: 'same-origin' }).then(async res => {
      const kieu = res.headers.get('content-type') || '';
      if (!res.ok || kieu.includes('application/json')) {
        let m = 'HTTP ' + res.status;
        try { const j = await res.json(); if (j && j.message) m = j.message; } catch (e) { /* không phải JSON */ }
        throw new Error(m);
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = ten;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }).catch(err => toast('Không tải được file: ' + err.message, 'error'));
  }

  // In: lay nguyen phan bang dang hien tren man hinh (bo cac nut bam).
  function inBaoCao() {
    const body = document.getElementById('bcBody');
    const ban = body.cloneNode(true);
    ban.querySelectorAll('.toolbar, button, input, .khong-in').forEach(e => e.remove());
    const tenTab = (getTabs().find(t => t.key === activeTab) || {}).label || 'Báo cáo';
    printHtml(tenTab, `<h2 style="text-align:center;margin:0 0 2px;">${tenTab.toUpperCase()}</h2>
      <div style="text-align:center;font-style:italic;margin-bottom:10px;">Kỳ báo cáo: từ ${fmtDate(ky.tuNgay)} đến ${fmtDate(ky.denNgay)}</div>
      ${ban.innerHTML}`, {
      logo: true,
      extraStyle: `table{width:100%;border-collapse:collapse;font-size:12px;}
        th,td{border:1px solid #333;padding:4px 6px;}
        th{background:#eee;text-align:center;}
        .empty-hint{font-size:11px;color:#555;font-style:italic;}`
    });
  }

  /* v6.27: dòng TỔNG CỘNG nằm ở ĐẦU bảng và DÍNH lại khi cuộn (bảng dài vẫn thấy số tổng).
     `top` phải bằng chiều cao THẬT của <thead> — bảng tồn vải có 2 dòng tiêu đề, các bảng khác 1 dòng,
     đoán bằng hằng số là lệch. Gọi sau mỗi lần đổi innerHTML. */
  function dinhDongTong(goc) {
    const el = goc || document;
    el.querySelectorAll('table').forEach(tb => {
      const dong = tb.querySelector('tbody tr.row-tong');
      if (!dong) return;
      const thead = tb.querySelector('thead');
      const cao = thead ? thead.getBoundingClientRect().height : 0;
      dong.querySelectorAll('td').forEach(td => { td.style.top = Math.round(cao) + 'px'; });
    });
    /* Thu hẹp cửa sổ -> tiêu đề cột xuống dòng -> <thead> cao lên -> phải đo lại, không thì dòng tổng
       dính sai chỗ (đè lên tiêu đề hoặc hở một khoảng). Gắn 1 lần duy nhất cho cả phân hệ. */
    if (!dinhDongTong.daGanResize) {
      dinhDongTong.daGanResize = true;
      let hen;
      window.addEventListener('resize', () => {
        clearTimeout(hen);
        hen = setTimeout(() => {
          const b = document.getElementById('bcBody');
          if (b) dinhDongTong(b);
        }, 150);
      });
    }
  }

  const oSo = v => `<td style="text-align:right;">${v == null ? '' : fmtNumber(v)}</td>`;
  const oTien = v => `<td style="text-align:right;">${v == null ? '' : fmtNumber(v)}</td>`;

  /* ================================================================================================
     v6.33: BAM VAO MA (hang hoa / vai / phu kien) -> POPUP CHI TIET XUAT NHAP TRONG KY.
     Ton dau ky lay tu chinh ham bao cao o backend nen so tren popup LUON khop bang tong hop.
     ================================================================================================ */
  const nhanApi = { tonhanghoa: 'maHang', tonvai: 'maVai', tonphukien: 'maPhuKien' };
  async function moChiTietTon(loai, ma) {
    const res = await apiGet(`/api/baocao/${loai}/chitiet?${nhanApi[loai]}=${encodeURIComponent(ma)}`
      + `&tuNgay=${ky.tuNgay}&denNgay=${ky.denNgay}`);
    const d = res.data || { rows: [] };
    const laVai = loai === 'tonvai';
    const rows = d.rows || [];
    const oCay = laVai ? '<th>Mã cây</th>' : '';
    const oMet = (laVai && d.coMet) ? '<th>Nhập (m)</th><th>Xuất (m)</th>' : '';
    const soCot = 6 + (laVai ? 1 : 0) + ((laVai && d.coMet) ? 2 : 0);
    const bang = `
      <table><thead><tr>
        <th style="width:40px;">STT</th><th>Ngày</th><th>Loại</th><th>Số phiếu</th>${oCay}
        <th>Đối tượng</th><th>Nhập</th><th>Xuất</th>${oMet}<th>Tồn lũy kế</th></tr></thead>
      <tbody>
        <tr style="font-weight:bold;background:#f1f3f4;">
          <td colspan="${soCot - 1}" style="text-align:right;">TỒN ĐẦU KỲ</td>
          <td style="text-align:right;">${fmtNumber(d.tonDau)}</td></tr>
        ${rows.map((r, i) => `<tr>
          <td style="text-align:center;">${i + 1}</td>
          <td>${fmtDate(r.Ngay)}</td>
          <td>${r.Nhap ? '<span style="color:#137333;">' : '<span style="color:#c0392b;">'}${escapeHtml(r.Loai)}</span></td>
          <td>${escapeHtml(r.SoPhieu || '')}</td>
          ${laVai ? `<td>${escapeHtml(r.MaCay || '')}</td>` : ''}
          <td>${escapeHtml(r.DoiTuong || r.TenMau || '')}</td>
          <td style="text-align:right;color:#137333;">${r.Nhap ? fmtNumber(r.Nhap) : ''}</td>
          <td style="text-align:right;color:#c0392b;">${r.Xuat ? fmtNumber(r.Xuat) : ''}</td>
          ${(laVai && d.coMet) ? `<td style="text-align:right;">${r.NhapMet ? fmtNumber(r.NhapMet) : ''}</td>
            <td style="text-align:right;">${r.XuatMet ? fmtNumber(r.XuatMet) : ''}</td>` : ''}
          <td style="text-align:right;"><b>${fmtNumber(r.TonLuyKe)}</b></td></tr>`).join('')
          || `<tr><td colspan="${soCot}" class="empty-hint">Không có phát sinh trong kỳ</td></tr>`}
        <tr style="font-weight:bold;background:#e8f0fe;">
          <td colspan="${soCot - 1}" style="text-align:right;">TỒN CUỐI KỲ</td>
          <td style="text-align:right;">${fmtNumber(d.tonCuoi)}</td></tr>
      </tbody></table>`;

    const modal = openModal(`
      <h3>Chi tiết xuất nhập — ${escapeHtml(d.ma)}</h3>
      <p class="p-meta">${escapeHtml(d.ten || '')} &nbsp;·&nbsp; ĐVT: <b>${escapeHtml(d.donVi || '')}</b>
        &nbsp;·&nbsp; Kỳ: ${fmtDate(ky.tuNgay)} – ${fmtDate(ky.denNgay)}</p>
      <div style="max-height:56vh;overflow:auto;">${bang}</div>
      ${d.ghiChu ? `<div class="empty-hint" style="margin-top:6px;">📘 ${escapeHtml(d.ghiChu)}</div>` : ''}
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="ctDong">Đóng</button>
        <button type="button" class="btn" id="ctIn">🖨️ In</button>
      </div>`);
    modal.querySelector('#ctDong').addEventListener('click', closeModal);
    modal.querySelector('#ctIn').addEventListener('click', () => printHtml(`Chi tiết ${d.ma}`,
      `<h2 style="text-align:center;margin:0 0 2px;">CHI TIẾT XUẤT NHẬP — ${escapeHtml(d.ma)}</h2>
       <div style="text-align:center;font-style:italic;margin-bottom:10px;">${escapeHtml(d.ten || '')} · Kỳ ${fmtDate(ky.tuNgay)} – ${fmtDate(ky.denNgay)}</div>
       ${bang}`, { logo: true, extraStyle: 'table{width:100%;border-collapse:collapse;font-size:12px;}th,td{border:1px solid #333;padding:4px 6px;}th{background:#eee;text-align:center;}' }));
  }
  // Gắn sự kiện cho mọi ô mã trong bảng tồn kho (dùng lại sau mỗi lần vẽ bảng).
  function wireMoChiTiet(goc, loai) {
    goc.querySelectorAll('.bc-ma').forEach(a => a.addEventListener('click', () =>
      moChiTietTon(loai, a.dataset.ma).catch(err => toast(err.message, 'error'))));
  }

  /* ================================================================================================
     TAB 1-3: TON KHO (hang hoa / vai / phu kien) — cung 1 khung Nhap-Xuat-Ton
     ================================================================================================ */
  async function renderTonKho(perm, loai) {
    const body = document.getElementById('bcBody');
    const res = await apiGet(`/api/baocao/${loai}?tuNgay=${ky.tuNgay}&denNgay=${ky.denNgay}`);
    const d = res.data || { rows: [], tong: {} };
    const rows = d.rows || [], t = d.tong || {};
    const tenFile = loai === 'tonvai' ? 'ton_kho_vai' : (loai === 'tonphukien' ? 'ton_kho_phu_kien' : 'ton_kho_hang_hoa');

    let bang;
    if (loai === 'tonvai') {
      bang = `<table><thead><tr>
          <th rowspan="2">Mã vải</th><th rowspan="2">Loại vải</th><th rowspan="2">Màu</th><th rowspan="2">Khổ</th>
          <th colspan="4">SỐ LƯỢNG (KG)</th><th colspan="4">SỐ MÉT</th>
          <th rowspan="2">Đơn giá BQ</th><th rowspan="2">Giá trị tồn</th></tr>
        <tr><th>Tồn đầu</th><th>Nhập</th><th>Xuất</th><th>Tồn cuối</th>
            <th>Tồn đầu</th><th>Nhập</th><th>Xuất</th><th>Tồn cuối</th></tr></thead>
        <tbody>${rows.length ? `<tr class="row-tong">
          <td colspan="4" style="text-align:right;">TỔNG</td>
          ${oSo(t.TonDauKG)}${oSo(t.NhapKG)}${oSo(t.XuatKG)}${oSo(t.TonCuoiKG)}
          <td colspan="4"></td><td></td>${oTien(t.GiaTriTon)}</tr>` : ''}
        ${rows.map(r => `<tr>
          <td><a href="javascript:void(0)" class="bc-ma" data-ma="${escapeHtml(r.MaVai)}" title="Xem chi tiết xuất nhập trong kỳ">${escapeHtml(r.MaVai)}</a></td><td>${escapeHtml(r.TenLoaiVai)}</td><td>${escapeHtml(r.TenMau)}</td>
          ${oSo(r.KhoVai)}
          ${oSo(r.TonDauKG)}${oSo(r.NhapKG)}${oSo(r.XuatKG)}<td style="text-align:right;"><b>${fmtNumber(r.TonCuoiKG)}</b></td>
          ${oSo(r.TonDauMet)}${oSo(r.NhapMet)}${oSo(r.XuatMet)}${oSo(r.TonCuoiMet)}
          ${oTien(r.DonGiaBQ)}${oTien(r.GiaTriTon)}</tr>`).join('')
          || '<tr><td colspan="14" class="empty-hint">Không có phát sinh trong kỳ</td></tr>'}</tbody></table>`;
    } else if (loai === 'tonphukien') {
      bang = `<table><thead><tr>
          <th>Mã phụ kiện</th><th>Tên phụ kiện</th><th>Loại</th><th>Size</th><th>ĐVT</th>
          <th>Tồn đầu kỳ</th><th>Nhập trong kỳ</th><th>Xuất trong kỳ</th><th>Tồn cuối kỳ</th>
          <th>Đơn giá BQ</th><th>Giá trị tồn</th></tr></thead>
        <tbody>${rows.length ? `<tr class="row-tong">
          <td colspan="5" style="text-align:right;">TỔNG</td>
          ${oSo(t.TonDau)}${oSo(t.Nhap)}${oSo(t.Xuat)}${oSo(t.TonCuoi)}<td></td>${oTien(t.GiaTriTon)}</tr>` : ''}
        ${rows.map(r => `<tr>
          <td><a href="javascript:void(0)" class="bc-ma" data-ma="${escapeHtml(r.MaPhuKien)}" title="Xem chi tiết xuất nhập trong kỳ">${escapeHtml(r.MaPhuKien)}</a></td><td>${escapeHtml(r.TenPhuKien)}</td><td>${escapeHtml(r.TenLoai)}</td>
          <td>${escapeHtml(r.Size)}</td><td>${escapeHtml(r.DonVi)}</td>
          ${oSo(r.TonDau)}${oSo(r.Nhap)}${oSo(r.Xuat)}<td style="text-align:right;"><b>${fmtNumber(r.TonCuoi)}</b></td>
          ${oTien(r.DonGiaBQ)}${oTien(r.GiaTriTon)}</tr>`).join('')
          || '<tr><td colspan="11" class="empty-hint">Không có phát sinh trong kỳ</td></tr>'}</tbody></table>`;
    } else {
      bang = `<table><thead><tr>
          <th>Mã hàng</th><th>Tên hàng</th><th>Danh mục</th><th>ĐVT</th>
          <th>Tồn đầu kỳ</th><th>Nhập trong kỳ</th><th>Xuất trong kỳ</th><th>Tồn cuối kỳ</th>
          <th>Giá bán (1 cái)</th><th>Giá trị tồn</th></tr></thead>
        <tbody>${rows.length ? `<tr class="row-tong">
          <td colspan="4" style="text-align:right;">TỔNG</td>
          ${oSo(t.TonDau)}${oSo(t.Nhap)}${oSo(t.Xuat)}${oSo(t.TonCuoi)}<td></td>${oTien(t.GiaTriTon)}</tr>` : ''}
        ${rows.map(r => `<tr>
          <td><a href="javascript:void(0)" class="bc-ma" data-ma="${escapeHtml(r.MaHang)}" title="Xem chi tiết xuất nhập trong kỳ">${escapeHtml(r.MaHang)}</a></td><td>${escapeHtml(r.TenHang)}</td><td>${escapeHtml(r.TenDanhMuc)}</td>
          <td>${escapeHtml(r.DonVi)}</td>
          ${oSo(r.TonDau)}${oSo(r.Nhap)}${oSo(r.Xuat)}<td style="text-align:right;"><b>${fmtNumber(r.TonCuoi)}</b></td>
          ${oTien(r.GiaBan)}${oTien(r.GiaTriTon)}</tr>`).join('')
          || '<tr><td colspan="10" class="empty-hint">Không có phát sinh trong kỳ</td></tr>'}</tbody></table>`;
    }

    body.innerHTML = thanhKyHtml('')
      + (d.canhBao ? `<div class="empty-hint" style="color:#b26a00;margin-bottom:8px;">⚠️ ${escapeHtml(d.canhBao)}</div>` : '')
      + `<div class="empty-hint" style="margin-bottom:8px;">📘 <b>Cách đọc:</b> Tồn đầu kỳ + Nhập − Xuất = Tồn cuối kỳ (luôn cân đối).
           ${escapeHtml(d.ghiChu || '')}</div>`
      + `<div class="bang-cuon" style="max-height:calc(100vh - 260px);">${bang}</div>`;
    dinhDongTong(body);
    wireMoChiTiet(body, loai);   // v6.33: bấm mã -> chi tiết xuất nhập
    wireKy(loai, tenFile);
  }

  /* v6.33: bấm 1 QUỸ (tiền mặt / tài khoản ngân hàng) hoặc 1 LOẠI TÀI KHOẢN -> popup chi tiết thu chi.
     Quỹ thì có số dư đầu kỳ và cột "Số dư" cộng dồn; loại tài khoản là khoản mục nên không có số dư,
     cột cuối chỉ là cộng dồn trong kỳ. */
  async function moChiTietThuChi(loai, khoa) {
    const res = await apiGet(`/api/baocao/taichinh/chitiet?loai=${loai}&khoa=${encodeURIComponent(khoa)}`
      + `&tuNgay=${ky.tuNgay}&denNgay=${ky.denNgay}`);
    const d = res.data || { rows: [] };
    const rows = d.rows || [];
    const nhanCuoi = d.laQuy ? 'Số dư' : 'Cộng dồn';
    const bang = `
      <table><thead><tr><th style="width:40px;">STT</th><th>Ngày</th><th>Loại</th><th>Số phiếu</th>
        <th>Đối tượng</th><th>Tài khoản</th><th>Hình thức</th><th>Thu</th><th>Chi</th><th>${nhanCuoi}</th>
        <th>Diễn giải</th></tr></thead>
      <tbody>
        ${d.laQuy ? `<tr style="font-weight:bold;background:#f1f3f4;">
          <td colspan="9" style="text-align:right;">SỐ DƯ ĐẦU KỲ</td>
          <td style="text-align:right;">${fmtNumber(d.dauKy)}</td><td></td></tr>` : ''}
        ${rows.map((r, i) => `<tr>
          <td style="text-align:center;">${i + 1}</td>
          <td>${fmtDate(r.Ngay)}</td>
          <td style="color:${r.Thu ? '#137333' : '#c0392b'};">${escapeHtml(r.Loai)}</td>
          <td>${escapeHtml(r.SoPhieu || '')}</td>
          <td>${escapeHtml(r.DoiTuong || '')}</td>
          <td>${escapeHtml(r.TenTK || '')}</td>
          <td>${escapeHtml(r.HinhThuc || '')}</td>
          <td style="text-align:right;color:#137333;">${r.Thu ? fmtNumber(r.Thu) : ''}</td>
          <td style="text-align:right;color:#c0392b;">${r.Chi ? fmtNumber(r.Chi) : ''}</td>
          <td style="text-align:right;"><b>${fmtNumber(r.SoDu)}</b></td>
          <td>${escapeHtml(r.DienGiai || '')}</td></tr>`).join('')
          || '<tr><td colspan="11" class="empty-hint">Không có phiếu thu/chi nào trong kỳ</td></tr>'}
        <tr style="font-weight:bold;background:#e8f0fe;">
          <td colspan="7" style="text-align:right;">CỘNG PHÁT SINH TRONG KỲ</td>
          <td style="text-align:right;">${fmtNumber(d.tongThu)}</td>
          <td style="text-align:right;">${fmtNumber(d.tongChi)}</td>
          <td style="text-align:right;">${d.laQuy ? fmtNumber(d.cuoiKy) : ''}</td><td></td></tr>
      </tbody></table>`;
    const modal = openModal(`
      <h3>Chi tiết thu chi — ${escapeHtml(d.tieuDe || '')}</h3>
      <p class="p-meta">Kỳ: ${fmtDate(ky.tuNgay)} – ${fmtDate(ky.denNgay)}
        ${d.laQuy ? ` &nbsp;·&nbsp; Đầu kỳ <b>${fmtNumber(d.dauKy)}</b> → Cuối kỳ <b>${fmtNumber(d.cuoiKy)}</b> đ` : ''}</p>
      <div style="max-height:56vh;overflow:auto;">${bang}</div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="tcDong">Đóng</button>
        <button type="button" class="btn" id="tcIn">🖨️ In</button>
      </div>`);
    modal.querySelector('#tcDong').addEventListener('click', closeModal);
    modal.querySelector('#tcIn').addEventListener('click', () => printHtml('Chi tiết thu chi',
      `<h2 style="text-align:center;margin:0 0 2px;">CHI TIẾT THU CHI</h2>
       <div style="text-align:center;font-style:italic;margin-bottom:10px;">${escapeHtml(d.tieuDe || '')} · Kỳ ${fmtDate(ky.tuNgay)} – ${fmtDate(ky.denNgay)}</div>
       ${bang}`, { logo: true, extraStyle: 'table{width:100%;border-collapse:collapse;font-size:12px;}th,td{border:1px solid #333;padding:4px 6px;}th{background:#eee;text-align:center;}' }));
  }

  /* ================================================================================================
     TAB 4: BAO CAO TAI CHINH
     ================================================================================================ */
  async function renderTaiChinh(perm) {
    const body = document.getElementById('bcBody');
    const res = await apiGet(`/api/baocao/taichinh?tuNgay=${ky.tuNgay}&denNgay=${ky.denNgay}`);
    const d = res.data || {};
    const quy = d.quy || [], tq = d.tongQuy || {}, cn = d.congNo || {}, tk = d.theoTK || [];
    if (d.canhBao) toast(d.canhBao, 'info');
    const mau = v => Number(v) < 0 ? '#c0392b' : '#137333';

    body.innerHTML = thanhKyHtml('')
      + `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        <div style="flex:1;min-width:210px;border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:#e8f0fe;">
          <div style="font-size:13px;">💰 <b>Tiền đang có (cuối kỳ)</b></div>
          <div style="font-size:22px;font-weight:bold;color:${mau(tq.CuoiKy)};">${fmtNumber(tq.CuoiKy)} đ</div>
          <div style="font-size:12px;color:#5f6368;">Đầu kỳ ${fmtNumber(tq.DauKy)} + thu ${fmtNumber(tq.Thu)} − chi ${fmtNumber(tq.Chi)}</div>
        </div>
        <div style="flex:1;min-width:210px;border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:#e6f4ea;">
          <div style="font-size:13px;">📥 <b>Phải thu khách hàng</b></div>
          <div style="font-size:22px;font-weight:bold;color:#137333;">${fmtNumber(cn.PhaiThu)} đ</div>
          <div style="font-size:12px;color:#5f6368;">Bán hàng ${fmtNumber(cn.PhaiThu_BanHang)} − đã thu ${fmtNumber(cn.PhaiThu_DaThu)}</div>
        </div>
        <div style="flex:1;min-width:210px;border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:#fdecea;">
          <div style="font-size:13px;">📤 <b>Phải trả nhà cung cấp</b></div>
          <div style="font-size:22px;font-weight:bold;color:#c0392b;">${fmtNumber(cn.PhaiTra)} đ</div>
          <div style="font-size:12px;color:#5f6368;">Nhập vải ${fmtNumber(cn.PhaiTra_Vai)} + phụ kiện ${fmtNumber(cn.PhaiTra_PhuKien)} − đã trả ${fmtNumber(cn.PhaiTra_DaTra)}</div>
        </div>
        <div style="flex:1;min-width:210px;border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:#fff8e1;">
          <div style="font-size:13px;">⚖️ <b>Chênh lệch phải thu − phải trả</b></div>
          <div style="font-size:22px;font-weight:bold;color:${mau(Number(cn.PhaiThu) - Number(cn.PhaiTra))};">${fmtNumber(Number(cn.PhaiThu) - Number(cn.PhaiTra))} đ</div>
          <div style="font-size:12px;color:#5f6368;">Không tính tiền mặt/ngân hàng</div>
        </div>
      </div>

      <h3 style="margin:14px 0 6px;font-size:15px;">A. Quỹ tiền mặt & ngân hàng</h3>
      <table><thead><tr><th>Quỹ / Tài khoản</th><th>Số tài khoản</th><th>Đầu kỳ</th><th>Thu trong kỳ</th><th>Chi trong kỳ</th><th>Cuối kỳ</th></tr></thead>
      <tbody>${quy.length ? `<tr class="row-tong"><td colspan="2" style="text-align:right;">TỔNG</td>
          ${oTien(tq.DauKy)}${oTien(tq.Thu)}${oTien(tq.Chi)}${oTien(tq.CuoiKy)}</tr>` : ''}
        ${quy.map(q => `<tr>
        <td><a href="javascript:void(0)" class="bc-quy" data-khoa="${escapeHtml(q.Khoa || '')}" title="Xem chi tiết thu chi của quỹ này">${escapeHtml(q.Ten)}</a></td><td>${escapeHtml(q.SoTaiKhoan || '')}</td>
        ${oTien(q.DauKy)}
        <td style="text-align:right;color:#137333;">${fmtNumber(q.Thu)} <span style="font-size:11px;color:#5f6368;">(${q.SoPhieuThu})</span></td>
        <td style="text-align:right;color:#c0392b;">${fmtNumber(q.Chi)} <span style="font-size:11px;color:#5f6368;">(${q.SoPhieuChi})</span></td>
        <td style="text-align:right;"><b>${fmtNumber(q.CuoiKy)}</b></td></tr>`).join('')
        || '<tr><td colspan="6" class="empty-hint">Chưa có quỹ nào</td></tr>'}</tbody></table>

      <h3 style="margin:16px 0 6px;font-size:15px;">B. Công nợ tại ngày ${fmtDate(ky.denNgay)}</h3>
      <table><thead><tr><th style="width:60%;">Khoản mục</th><th>Số tiền</th></tr></thead><tbody>
        <tr style="font-weight:bold;background:#e6f4ea;"><td>PHẢI THU KHÁCH HÀNG</td>${oTien(cn.PhaiThu)}</tr>
        <tr><td style="padding-left:24px;">Tổng phiếu bán hàng (lũy kế đến cuối kỳ)</td>${oTien(cn.PhaiThu_BanHang)}</tr>
        <tr><td style="padding-left:24px;">Điều chỉnh công nợ</td>${oTien(cn.PhaiThu_DieuChinh)}</tr>
        <tr><td style="padding-left:24px;">Đã thu của khách</td><td style="text-align:right;">−${fmtNumber(cn.PhaiThu_DaThu)}</td></tr>
        <tr style="font-weight:bold;background:#fdecea;"><td>PHẢI TRẢ NHÀ CUNG CẤP</td>${oTien(cn.PhaiTra)}</tr>
        <tr><td style="padding-left:24px;">Tiền nhập vải</td>${oTien(cn.PhaiTra_Vai)}</tr>
        <tr><td style="padding-left:24px;">Tiền nhập phụ kiện</td>${oTien(cn.PhaiTra_PhuKien)}</tr>
        <tr><td style="padding-left:24px;">Điều chỉnh công nợ</td>${oTien(cn.PhaiTra_DieuChinh)}</tr>
        <tr><td style="padding-left:24px;">Đã trả nhà cung cấp</td><td style="text-align:right;">−${fmtNumber(cn.PhaiTra_DaTra)}</td></tr>
      </tbody></table>

      <h3 style="margin:16px 0 6px;font-size:15px;">C. Dòng tiền trong kỳ theo loại tài khoản</h3>
      <table><thead><tr><th>Loại tài khoản</th><th>Tính chi phí KD</th><th>Thu</th><th>Chi</th></tr></thead>
      <tbody>${tk.length ? `<tr class="row-tong"><td colspan="2" style="text-align:right;">TỔNG</td>
          ${oTien(tk.reduce((s2, r) => s2 + (Number(r.Thu) || 0), 0))}
          ${oTien(tk.reduce((s2, r) => s2 + (Number(r.Chi) || 0), 0))}</tr>` : ''}
        ${tk.map(r => `<tr>
        <td><a href="javascript:void(0)" class="bc-loaitk" data-khoa="${escapeHtml(r.TenLoai)}" title="Xem chi tiết thu chi của loại tài khoản này">${escapeHtml(r.TenLoai)}</a></td><td style="text-align:center;">${r.TinhChiPhiKD ? '✔' : ''}</td>
        <td style="text-align:right;color:#137333;">${Number(r.Thu) ? fmtNumber(r.Thu) : ''}</td>
        <td style="text-align:right;color:#c0392b;">${Number(r.Chi) ? fmtNumber(r.Chi) : ''}</td></tr>`).join('')
        || '<tr><td colspan="4" class="empty-hint">Không có phiếu thu/chi trong kỳ</td></tr>'}</tbody></table>

      <div class="empty-hint" style="margin-top:10px;">📘 ${escapeHtml(d.ghiChu || '')}</div>`;
    dinhDongTong(body);
    // v6.33: bấm quỹ / loại tài khoản -> chi tiết thu chi
    body.querySelectorAll('.bc-quy').forEach(a => a.addEventListener('click', () =>
      moChiTietThuChi('quy', a.dataset.khoa).catch(err => toast(err.message, 'error'))));
    body.querySelectorAll('.bc-loaitk').forEach(a => a.addEventListener('click', () =>
      moChiTietThuChi('loaitk', a.dataset.khoa).catch(err => toast(err.message, 'error'))));
    wireKy('taichinh', 'bao_cao_tai_chinh');
  }

  /* ================================================================================================
     TAB 5: KET QUA KINH DOANH
     ================================================================================================ */
  async function renderKinhDoanh(perm) {
    const body = document.getElementById('bcBody');
    const res = await apiGet(`/api/baocao/kinhdoanh?tuNgay=${ky.tuNgay}&denNgay=${ky.denNgay}`);
    const d = res.data || {};
    const t = d.tong || {}, ct = d.chiTiet || [], cp = d.chiPhi || [];
    const mau = v => Number(v) < 0 ? '#c0392b' : '#137333';
    const dongCT = (nhan, giaTri, dam, indent, amTinh) => `<tr${dam ? ' style="font-weight:bold;background:#f1f3f4;"' : ''}>
      <td${indent ? ' style="padding-left:24px;"' : ''}>${nhan}</td>
      <td style="text-align:right;${dam ? 'color:' + mau(giaTri) + ';' : ''}">${amTinh ? '−' : ''}${fmtNumber(Math.abs(Number(giaTri) || 0))}</td></tr>`;

    body.innerHTML = thanhKyHtml('')
      + (!d.coBangGiaVon ? `<div class="empty-hint" style="color:#c0392b;margin-bottom:8px;">⚠️ Chưa chạy <b>migration_v672.sql</b> — giá vốn đang tính bằng 0, lãi/lỗ chưa đúng.</div>` : '')
      + (d.thieuGiaVon && d.thieuGiaVon.length ? `<div class="empty-hint" style="color:#c0392b;margin-bottom:8px;">
          ⚠️ <b>${d.thieuGiaVon.length} mã hàng chưa khai giá vốn</b> nên đang tính giá vốn = 0 (lãi đang bị thổi lên):
          ${escapeHtml(d.thieuGiaVon.slice(0, 12).join(', '))}${d.thieuGiaVon.length > 12 ? '…' : ''}
          — sang tab <b>Giá vốn hàng hóa</b> để bổ sung.</div>` : '')
      + `<div class="empty-hint" style="margin-bottom:8px;background:#f8f9fa;border-left:3px solid #1a73e8;padding:6px 10px;">
          🧮 <b>Chi phí kinh doanh chỉ gồm chi phí NGOÀI giá vốn.</b>
          Tiền mua vải / phụ kiện / gia công / in thêu đã nằm trong <b>giá vốn</b> — nếu tính lại ở đây thì bị
          <b>trừ hai lần</b> và báo lỗ ảo. Đang tính là chi phí KD:
          <b>${(d.loaiCPKD && d.loaiCPKD.length) ? escapeHtml(d.loaiCPKD.join(' · ')) : 'chưa loại nào'}</b>
          — sửa ở <b>Danh mục → Loại tài khoản</b>.
          ${d.chiNgoaiBaoCao && d.chiNgoaiBaoCao.SoTien ? `<br>Có ${fmtNumber(d.chiNgoaiBaoCao.SoTien)} đ
          (${d.chiNgoaiBaoCao.SoPhieu} phiếu chi) nằm ngoài chi phí KD — phần lớn là tiền mua NPL/gia công, <b>đúng là phải nằm ngoài</b>.` : ''}</div>`

      + `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        <div style="flex:1;min-width:200px;border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:#e8f0fe;">
          <div style="font-size:13px;">💵 <b>Doanh thu thuần</b></div>
          <div style="font-size:22px;font-weight:bold;">${fmtNumber(t.DoanhThuThuan)} đ</div>
          <div style="font-size:12px;color:#5f6368;">${t.SoPhieu || 0} phiếu · ${fmtNumber(t.TongSLCai)} cái</div>
        </div>
        <div style="flex:1;min-width:200px;border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:#fff8e1;">
          <div style="font-size:13px;">📦 <b>Giá vốn hàng bán</b></div>
          <div style="font-size:22px;font-weight:bold;">${fmtNumber(t.GiaVon)} đ</div>
          <div style="font-size:12px;color:#5f6368;">Lãi gộp ${fmtNumber(t.LaiGop)} (${t.TyLeLaiGop == null ? '—' : t.TyLeLaiGop + '%'})</div>
        </div>
        <div style="flex:1;min-width:200px;border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:#fdecea;">
          <div style="font-size:13px;">🧾 <b>Chi phí kinh doanh</b></div>
          <div style="font-size:22px;font-weight:bold;">${fmtNumber(t.ChiPhiKD)} đ</div>
          <div style="font-size:12px;color:#5f6368;">Từ phiếu chi có tài khoản tính CPKD</div>
        </div>
        <div style="flex:1;min-width:200px;border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:${Number(t.LoiNhuan) < 0 ? '#fdecea' : '#e6f4ea'};">
          <div style="font-size:13px;">${Number(t.LoiNhuan) < 0 ? '📉' : '📈'} <b>${Number(t.LoiNhuan) < 0 ? 'LỖ' : 'LỢI NHUẬN'}</b></div>
          <div style="font-size:24px;font-weight:bold;color:${mau(t.LoiNhuan)};">${fmtNumber(t.LoiNhuan)} đ</div>
          <div style="font-size:12px;color:#5f6368;">Lãi gộp − chi phí KD</div>
        </div>
      </div>

      <h3 style="margin:14px 0 6px;font-size:15px;">A. Kết quả kinh doanh</h3>
      <table style="max-width:760px;"><thead><tr><th style="width:65%;">Chỉ tiêu</th><th>Số tiền</th></tr></thead><tbody>
        ${dongCT('Tổng tiền hàng (đã trừ chiết khấu shop)', t.TongTienHang, false, false, false)}
        ${dongCT('Chiết khấu NPP', t.TienCKNPP, false, true, true)}
        ${dongCT('DOANH THU THUẦN <span style="font-weight:normal;font-size:11px;">(chưa gồm thuế GTGT)</span>', t.DoanhThuThuan, true, false, false)}
        ${dongCT('Giá vốn hàng bán', t.GiaVon, false, true, true)}
        ${dongCT('LÃI GỘP' + (t.TyLeLaiGop == null ? '' : ` <span style="font-weight:normal;font-size:11px;">(${t.TyLeLaiGop}% doanh thu)</span>`), t.LaiGop, true, false, false)}
        ${dongCT('Chi phí kinh doanh', t.ChiPhiKD, false, true, true)}
        ${dongCT(Number(t.LoiNhuan) < 0 ? 'LỖ' : 'LỢI NHUẬN', t.LoiNhuan, true, false, false)}
        <tr><td colspan="2" style="border:none;height:8px;"></td></tr>
        <tr><td style="color:#5f6368;">Thuế GTGT đầu ra <span style="font-size:11px;">(thu hộ nhà nước — không phải doanh thu)</span></td>${oTien(t.TienVAT)}</tr>
        <tr><td style="color:#5f6368;">Tổng thanh toán ghi trên phiếu bán hàng</td>${oTien(t.TongThanhToan)}</tr>
      </tbody></table>

      <h3 style="margin:16px 0 6px;font-size:15px;">B. Lãi gộp theo mã hàng</h3>
      <div class="bang-cuon" style="max-height:400px;">
      <table><thead><tr><th>Mã hàng</th><th>Tên hàng</th><th>SL bán (cái)</th><th>Doanh thu</th>
        <th>Giá vốn 1 cái</th><th>Giá vốn</th><th>Lãi gộp</th><th>Tỷ lệ lãi</th><th>Nguồn giá vốn</th></tr></thead>
      <tbody>${ct.length ? `<tr class="row-tong"><td colspan="2" style="text-align:right;">TỔNG</td>
          ${oSo(ct.reduce((s2, r) => s2 + (Number(r.SLCai) || 0), 0))}
          ${oTien(t.DoanhThuThuan)}<td></td>${oTien(t.GiaVon)}
          <td style="text-align:right;color:${mau(t.LaiGop)};">${fmtNumber(t.LaiGop)}</td>
          <td style="text-align:right;">${t.TyLeLaiGop == null ? '' : t.TyLeLaiGop + '%'}</td><td></td></tr>` : ''}
        ${ct.map(r => `<tr${r.ThieuGiaVon ? ' style="background:#fff4f4;"' : ''}>
        <td>${escapeHtml(r.MaHang)}</td><td>${escapeHtml(r.TenHang)}</td>
        ${oSo(r.SLCai)}${oTien(r.DoanhThu)}
        <td style="text-align:right;">${r.ThieuGiaVon ? '<span style="color:#c0392b;">chưa khai</span>' : fmtNumber(r.GiaVon1)}</td>
        ${oTien(r.GiaVon)}
        <td style="text-align:right;color:${mau(r.LaiGop)};"><b>${fmtNumber(r.LaiGop)}</b></td>
        <td style="text-align:right;">${r.TyLeLai == null ? '' : r.TyLeLai + '%'}</td>
        <td>${escapeHtml(r.NguonGia || '')}</td></tr>`).join('')
        || '<tr><td colspan="9" class="empty-hint">Không có phiếu bán hàng trong kỳ</td></tr>'}</tbody></table></div>

      <h3 style="margin:16px 0 6px;font-size:15px;">C. Chi tiết chi phí kinh doanh</h3>
      <table><thead><tr><th>Loại tài khoản</th><th>Tài khoản</th><th>Số tiền</th><th>Số phiếu</th></tr></thead>
      <tbody>${cp.length ? `<tr class="row-tong"><td colspan="2" style="text-align:right;">TỔNG CHI PHÍ KD</td>
          ${oTien(t.ChiPhiKD)}<td style="text-align:center;">${cp.reduce((s2, r) => s2 + (Number(r.SoPhieu) || 0), 0)}</td></tr>` : ''}
        ${cp.map(r => `<tr><td>${escapeHtml(r.TenLoai)}</td><td>${escapeHtml(r.TenTK)}</td>
        ${oTien(r.SoTien)}<td style="text-align:center;">${r.SoPhieu}</td></tr>`).join('')
        || '<tr><td colspan="4" class="empty-hint">Không có chi phí nào trong kỳ</td></tr>'}</tbody></table>

      <div class="empty-hint" style="margin-top:10px;">📘 ${escapeHtml(d.ghiChu || '')}</div>`;
    dinhDongTong(body);
    wireKy('kinhdoanh', 'ket_qua_kinh_doanh');
  }

  /* ================================================================================================
     TAB 6: GIA VON HANG HOA (khai tay / nap tu lenh SX)
     ================================================================================================ */
  async function renderGiaVon(perm) {
    const body = document.getElementById('bcBody');
    let rows = [];
    try {
      rows = (await apiGet('/api/baocao/giavon')).data || [];
    } catch (err) {
      body.innerHTML = `<div class="empty-hint" style="color:#c0392b;">${escapeHtml(err.message)}</div>`;
      return;
    }
    const chuaKhai = rows.filter(r => r.GiaVon == null).length;

    body.innerHTML = `
      <div class="toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="search" id="gvTim" placeholder="Tìm mã hàng / tên hàng..." style="width:260px;">
        <label style="font-size:13px;"><input type="checkbox" id="gvChuaKhai"> Chỉ hiện mã CHƯA khai giá vốn</label>
        ${perm.canEdit ? `<button type="button" class="btn small" id="gvNap">⟳ Lấy giá thành từ lệnh SX</button>` : ''}
        <span class="empty-hint" style="margin-left:auto;padding:0;">${rows.length} mã hàng · <b style="color:${chuaKhai ? '#c0392b' : '#137333'};">${chuaKhai} chưa khai</b></span>
      </div>
      <div class="empty-hint" style="margin-bottom:8px;">📘 Giá vốn là <b>giá thành 1 cái</b>, dùng để tính lãi/lỗ.
        Nút <b>“Lấy giá thành từ lệnh SX”</b> nạp tự động cho mã hàng có liên kết lệnh SX (không đè lên mã đã khai tay).
        Mã <b>đặt ngoài</b> không có lệnh SX thì bấm vào ô giá vốn để khai tay.
        Giá vốn được <b>chốt lại</b> — sửa chi phí lệnh SX sau này không làm đổi lãi/lỗ của kỳ đã báo cáo.</div>
      <div class="bang-cuon" style="max-height:calc(100vh - 280px);">
      <table><thead><tr><th>Mã hàng</th><th>Tên hàng</th><th>Loại</th><th>Lệnh SX</th>
        <th>Giá bán (1 cái)</th><th>Giá vốn (1 cái)</th><th>Lãi gộp 1 cái</th><th>Nguồn</th><th>Cập nhật</th>
        ${perm.canEdit ? '<th>Thao tác</th>' : ''}</tr></thead>
      <tbody id="gvBody">${rows.map(r => dongGiaVonHtml(r, perm)).join('')
        || `<tr><td colspan="${soCotGiaVon(perm)}" class="empty-hint">Chưa có mã hàng nào</td></tr>`}</tbody></table></div>`;

    const loc = () => {
      const q = (document.getElementById('gvTim').value || '').trim().toLowerCase();
      const chi = document.getElementById('gvChuaKhai').checked;
      document.getElementById('gvBody').innerHTML = rows.filter(r =>
        (!chi || r.GiaVon == null)
        && (!q || String(r.MaHang).toLowerCase().includes(q) || String(r.TenHang || '').toLowerCase().includes(q))
      ).map(r => dongGiaVonHtml(r, perm)).join('') || `<tr><td colspan="${soCotGiaVon(perm)}" class="empty-hint">Không có dòng nào khớp</td></tr>`;
      gan();
    };
    const gan = () => {
      body.querySelectorAll('.gv-sua').forEach(b => b.addEventListener('click', () =>
        suaGiaVon(rows.find(x => String(x.MaHangID) === b.dataset.id)).catch(err => toast(err.message, 'error'))));
    };
    document.getElementById('gvTim').addEventListener('input', loc);
    document.getElementById('gvChuaKhai').addEventListener('change', loc);
    gan();

    const nutNap = document.getElementById('gvNap');
    if (nutNap) nutNap.addEventListener('click', async () => {
      if (!confirm('Nạp giá vốn từ giá thành của lệnh SX cho tất cả mã hàng có liên kết lệnh SX?\n\nMã đã KHAI TAY sẽ được giữ nguyên.')) return;
      const cu = nutNap.textContent; nutNap.disabled = true; nutNap.textContent = 'Đang tính...';
      try {
        const kq = (await apiPost('/api/baocao/giavon/naptulenhsx', {})).data || {};
        let m = `Đã cập nhật ${kq.capNhat} mã` + (kq.boQua ? `, giữ nguyên ${kq.boQua} mã khai tay` : '');
        if (kq.khongTinhDuoc && kq.khongTinhDuoc.length) {
          m += `. ${kq.khongTinhDuoc.length} mã chưa tính được giá thành.`;
          console.warn('[giá vốn] không tính được:', kq.khongTinhDuoc);
        }
        toast(m, 'success');
        render(container, currentUser, activeTab);
      } catch (err) {
        toast(err.message, 'error');
      } finally { nutNap.disabled = false; nutNap.textContent = cu; }
    });
  }

  const soCotGiaVon = perm => perm.canEdit ? 10 : 9;
  function dongGiaVonHtml(r, perm) {
    const thieu = r.GiaVon == null;
    return `<tr${thieu ? ' style="background:#fff4f4;"' : ''}>
      <td>${escapeHtml(r.MaHang)}</td><td>${escapeHtml(r.TenHang || '')}</td>
      <td>${r.LoaiHang === 'NhaSanXuat' ? 'Nhà SX' : 'Đặt ngoài'}</td>
      <td>${escapeHtml(r.MaDH || '')}</td>
      ${oTien(r.GiaBan)}
      <td style="text-align:right;">${thieu ? '<span style="color:#c0392b;">chưa khai</span>' : `<b>${fmtNumber(r.GiaVon)}</b>`}</td>
      <td style="text-align:right;color:${Number(r.LaiGop1) < 0 ? '#c0392b' : '#137333'};">${r.LaiGop1 == null ? '' : fmtNumber(r.LaiGop1)}</td>
      <td>${escapeHtml(r.NguonGia || '')}${r.MaDHNguon ? ` <span style="font-size:11px;color:#5f6368;">(${escapeHtml(r.MaDHNguon)})</span>` : ''}</td>
      <td>${r.NgayCapNhat ? fmtDate(r.NgayCapNhat) : ''}</td>
      ${perm.canEdit ? `<td><button class="btn small secondary gv-sua" data-id="${r.MaHangID}">Khai giá vốn</button></td>` : ''}</tr>`;
  }

  async function suaGiaVon(r) {
    if (!r) return;
    const form = openModal(`<h3>Khai giá vốn — ${escapeHtml(r.MaHang)}</h3>
      <form id="gvForm">
        <div class="empty-hint" style="margin-bottom:8px;">${escapeHtml(r.TenHang || '')}${r.MaDH ? ` · lệnh SX ${escapeHtml(r.MaDH)}` : ' · không có lệnh SX (hàng đặt ngoài)'}
          ${r.GiaBan ? `<br>Giá bán 1 cái: <b>${fmtNumber(r.GiaBan)} đ</b>` : ''}</div>
        <div class="form-grid">
          <label>Giá vốn 1 cái (đ) <input type="number" name="giaVon" min="0" step="1" required value="${r.GiaVon == null ? '' : r.GiaVon}"></label>
          <label>Ghi chú <input type="text" name="ghiChu" maxlength="255" value="${escapeHtml(r.GhiChu || '')}"></label>
        </div>
        <div class="empty-hint">Khai tay sẽ được <b>giữ nguyên</b> khi bấm “Lấy giá thành từ lệnh SX”.</div>
        <div class="modal-actions"><button type="submit" class="btn">Lưu</button>
          <button type="button" class="btn secondary" id="btnHuy">Hủy</button></div>
      </form>`).querySelector('#gvForm');
    form.querySelector('#btnHuy').addEventListener('click', closeModal);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPut('/api/baocao/giavon/' + r.MaHangID, {
          giaVon: Number(fd.get('giaVon')), ghiChu: fd.get('ghiChu') || null
        });
        closeModal(); toast('Đã lưu giá vốn.', 'success');
        render(container, currentUser, activeTab);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  return { render, getTabs };
})();
