// Phan he QUAN LY CONG NO (v6.23): Phieu thu / Phieu chi / Cong no khach hang / Cong no NCC / Dieu chinh
window.ModuleCongNo = (function () {
  let activeTab = 'phieuthu';
  let container, currentUser;
  let dm = { khachHang: [], ncc: [], nhaGiaCong: [], taiKhoan: [], nganHang: [] };

  function getTabs() {
    return [
      { key: 'phieuthu', label: 'Phiếu thu' },
      { key: 'phieuchi', label: 'Phiếu chi' },
      { key: 'congnokh', label: 'Công nợ khách hàng' },
      { key: 'congnoncc', label: 'Công nợ nhà cung cấp' },
      { key: 'dieuchinh', label: 'Điều chỉnh công nợ' },
      { key: 'soquy', label: 'Sổ quỹ' }
    ];
  }

  async function render(el, user, tabKey) {
    container = el; currentUser = user;
    if (tabKey) activeTab = tabKey;
    const rawPerm = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.CONGNO || {});
    const perm = effectivePerm(user, 'CONGNO', activeTab, rawPerm);
    container.innerHTML = '<div id="cnBody"><div class="empty-hint">Đang tải...</div></div>';

    // Danh mục dùng chung cho mọi tab (tải lại mỗi lần render để không hiện danh mục cũ).
    try {
      const [kh, ncc, ngc, tk, nh] = await Promise.all([
        apiGet('/api/danhmuc/khachhang').catch(() => ({ data: [] })),
        apiGet('/api/danhmuc/nhacungcap').catch(() => ({ data: [] })),
        apiGet('/api/danhmuc/nhagiacong').catch(() => ({ data: [] })),
        apiGet('/api/congno/taikhoan').catch(() => ({ data: [] })),
        apiGet('/api/congno/taikhoannganhang').catch(() => ({ data: [] }))   // v6.24
      ]);
      dm = { khachHang: kh.data || [], ncc: ncc.data || [], nhaGiaCong: ngc.data || [],
             taiKhoan: tk.data || [], nganHang: nh.data || [] };
    } catch (e) { /* vẫn render được, chỉ thiếu dropdown */ }

    if (activeTab === 'phieuthu') return renderPhieuThu(perm);
    if (activeTab === 'phieuchi') return renderPhieuChi(perm);
    if (activeTab === 'congnokh') return renderCongNoKH(perm);
    if (activeTab === 'congnoncc') return renderCongNoNCC(perm);
    if (activeTab === 'soquy') return renderSoQuy(perm);
    return renderDieuChinh(perm);
  }

  const HINH_THUC = ['Tiền mặt', 'Chuyển khoản'];
  // v6.54: chỉ PHIẾU THU có thêm hình thức này (phiếu chi không tự chuyển thẳng cho ai được).
  const HT_CHUYEN_THANG = 'Chuyển thẳng';
  /* v6.25: PHIẾU THU chỉ hiện tài khoản thuộc loại "Thu", PHIẾU CHI chỉ hiện loại "Chi"
     (loại khai "Cả hai" thì hiện ở cả 2). Khai ở Danh mục → Loại tài khoản, cột "Dùng cho phiếu".
     Backend cũng chặn lại khi lưu, không chỉ ẩn trên form. */
  /* v6.53: chỉ CHẶN khi khai rõ ràng là 'Thu' hoặc 'Chi'. Mọi giá trị khác — 'Cả hai', 'Cả 2',
     rỗng, NULL của dữ liệu cũ, hay chữ gõ khác đi — đều coi là DÙNG CHO CẢ HAI.
     Trước đây so khớp đúng chuỗi 'Cả hai', nên loại tài khoản khai lệch một chữ là biến mất khỏi cả
     hai form mà không có cách nào biết vì sao. */
  const tkTheoPhieu = loai => dm.taiKhoan.filter(t => {
    const lp = String(t.LoaiPhieu || '').trim();
    return (lp !== 'Thu' && lp !== 'Chi') || lp === loai;
  });
  function oTaiKhoanHtml(loaiPhieu, dangChon) {
    const ds = tkTheoPhieu(loaiPhieu);
    return `<select name="taiKhoanId"><option value="">-- không chọn --</option>${ds.map(t =>
      `<option value="${t.TaiKhoanID}" ${String(dangChon || '') === String(t.TaiKhoanID) ? 'selected' : ''}>${escapeHtml(t.MaTK + ' - ' + t.TenTK)}${t.TinhChiPhiKD ? ' (tính CPKD)' : ''}</option>`).join('')}</select>
      <div class="empty-hint" style="margin-top:2px;">${ds.length ? `Chỉ hiện tài khoản dùng cho <b>phiếu ${loaiPhieu.toLowerCase()}</b>.`
        : `Chưa có loại tài khoản nào khai "dùng cho phiếu ${loaiPhieu.toLowerCase()}" — vào <b>Danh mục → Loại tài khoản</b>.`}</div>`;
  }
  const tenTK = id => { const t = dm.taiKhoan.find(x => String(x.TaiKhoanID) === String(id)); return t ? t.MaTK + ' - ' + t.TenTK : ''; };
  function taiFile(url, ten) {
    fetch(url, { credentials: 'same-origin' }).then(async res => {
      const kieu = res.headers.get('content-type') || '';
      if (!res.ok || kieu.includes('application/json')) {
        let m = 'HTTP ' + res.status;
        try { const j = await res.json(); if (j && j.message) m = j.message; } catch (e) { /* không phải JSON */ }
        throw new Error(m);
      }
      const blob = await res.blob();
      /* v6.52: ƯU TIÊN TÊN FILE DO SERVER ĐẶT (Content-Disposition) — server mới là chỗ biết tên
         khách/NCC, còn `ten` truyền vào đây chỉ là tên chung chung ("cong_no_khach.xlsx"). Trước đây
         gán đè `a.download = ten` nên tên khách server đặt bị vứt đi. Không đọc được header (proxy
         cắt mất, khác miền...) thì mới lùi về `ten`. */
      const cd = res.headers.get('content-disposition') || '';
      const khop = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      const tenFile = khop ? decodeURIComponent(khop[1]) : ten;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = tenFile;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }).catch(err => toast('Xuất Excel lỗi: ' + err.message, 'error'));
  }

  /* v6.47: BẤM TIÊU ĐỀ CỘT ĐỂ SẮP XẾP.
     Sắp xếp ngay trên DOM của bảng đã dựng, nên không phải sửa hàm render nào — bấm lần nữa thì đảo
     chiều. Dòng TỔNG đánh dấu `data-tong` luôn bị đẩy xuống cuối, không tham gia sắp xếp (nếu để nó
     lẫn vào thì cứ sắp theo cột tiền là dòng tổng nhảy lên đầu).
     Mũi tên chiều sắp xếp gắn vào <span> riêng, KHÔNG ghi đè textContent của <th> — nhiều tiêu đề có
     thẻ con bên trong, ghi đè là mất sạch. */
  function wireTableSort(box) {
    const soHoa = s => {
      const t = String(s).replace(/\s/g, '');
      // Phải khớp TOÀN BỘ ô mới coi là số — "Cty ABC 123" mà nhặt ra 123 thì sắp xếp tên ra loạn.
      if (!/^-?[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
      const n = Number(t.replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    };
    const ngayHoa = s => {
      const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : null;
    };
    box.querySelectorAll('table').forEach(table => {
      const thead = table.tHead, tbody = table.tBodies[0];
      if (!thead || !thead.rows.length || !tbody) return;
      const ths = Array.from(thead.rows[0].cells);
      ths.forEach((th, idx) => {
        if (th.hasAttribute('data-nosort')) return;
        th.style.cursor = 'pointer';
        th.title = 'Bấm để sắp xếp theo cột này';
        th.addEventListener('click', () => {
          const tang = th.dataset.sort !== 'asc';
          ths.forEach(x => {
            delete x.dataset.sort;
            const s = x.querySelector('.sort-ar'); if (s) s.remove();
          });
          th.dataset.sort = tang ? 'asc' : 'desc';
          const ar = document.createElement('span');
          ar.className = 'sort-ar'; ar.textContent = tang ? ' ▲' : ' ▼';
          ar.style.cssText = 'font-size:10px;color:#1a73e8;';
          th.appendChild(ar);

          const tong = Array.from(tbody.rows).filter(tr => tr.hasAttribute('data-tong'));
          const ds = Array.from(tbody.rows).filter(tr => !tr.hasAttribute('data-tong') && !tr.querySelector('.empty-hint'));
          const lay = tr => (tr.cells[idx] ? tr.cells[idx].innerText.trim() : '');
          ds.sort((a, b) => {
            const x = lay(a), y = lay(b);
            const nx = ngayHoa(x), ny = ngayHoa(y);
            if (nx !== null && ny !== null) return tang ? nx - ny : ny - nx;
            const sx = soHoa(x), sy = soHoa(y);
            if (sx !== null && sy !== null) return tang ? sx - sy : sy - sx;
            return tang ? x.localeCompare(y, 'vi') : y.localeCompare(x, 'vi');
          });
          ds.forEach(tr => tbody.appendChild(tr));
          tong.forEach(tr => tbody.appendChild(tr));   // dòng TỔNG luôn xuống cuối
        });
      });
    });
  }

  /* v6.24: chọn "Chuyển khoản" thì hiện ô SỐ TÀI KHOẢN (danh mục Tài khoản ngân hàng); chọn "Tiền mặt"
     thì ẩn VÀ xóa giá trị — nếu chỉ ẩn, FormData vẫn gửi id cũ và sổ quỹ ngân hàng sẽ cộng nhầm. */
  function wireHinhThuc(modal, tienTo) {
    const sel = modal.querySelector('#' + tienTo + 'HT');
    const o = modal.querySelector('#' + tienTo + 'ONH');
    if (!sel || !o) return;
    const dongBo = () => {
      const ck = sel.value === 'Chuyển khoản';
      o.style.display = ck ? '' : 'none';
      if (!ck) { const s = o.querySelector('select'); if (s) s.value = ''; }
    };
    sel.addEventListener('change', dongBo);
    dongBo();
  }

  /* ============================== IN PHIẾU THU / PHIẾU CHI (v6.25.2) ==============================
     Một hàm dựng cho cả 2 loại — chỉ khác nhãn (thu/chi, nộp/nhận) nên tách 2 hàm sẽ lệch nhau dần.
     Theo khuôn chứng từ kế toán VN: ngày tháng, số phiếu, người nộp/nhận, lý do, số tiền + bằng chữ,
     hình thức (kèm STK nếu chuyển khoản), rồi hàng chữ ký. */
  function inPhieuThuChi(r, loai) {
    const laThu = loai === 'Thu';
    const ngay = new Date(laThu ? r.NgayThu : r.NgayChi);
    const soTien = Number(r.SoTien) || 0;
    const doiTuong = laThu ? (r.TenDoiTuong || '') : (r.TenNCC || r.TenNhaGiaCong || r.TenDoiTuong || '');
    const dong = (nhan, giaTri) => giaTri
      ? `<p style="margin:4px 0;"><b>${nhan}:</b> ${escapeHtml(String(giaTri))}</p>` : '';
    printHtml(`${laThu ? 'Phiếu thu' : 'Phiếu chi'} ${r.SoPhieu || ''}`, `
      <h2 style="text-align:center;margin:0 0 2px;">${laThu ? 'PHIẾU THU' : 'PHIẾU CHI'}</h2>
      <div style="text-align:center;margin-bottom:2px;">Ngày ${ngay.getDate()} tháng ${ngay.getMonth() + 1} năm ${ngay.getFullYear()}</div>
      <div style="text-align:right;margin-bottom:10px;"><b>Số: ${escapeHtml(r.SoPhieu || '')}</b></div>
      ${dong(laThu ? 'Họ tên người nộp tiền' : 'Họ tên người nhận tiền', doiTuong)}
      ${dong(laThu ? 'Lý do nộp' : 'Lý do chi', r.DienGiai)}
      ${dong('Tài khoản', (r.MaTK ? r.MaTK + ' - ' : '') + (r.TenTK || ''))}
      ${dong('Hình thức thanh toán', (r.HinhThuc || '') + (r.SoTaiKhoan ? ` — ${r.TenNganHang || ''} ${r.SoTaiKhoan}` : ''))}
      ${laThu && r.SoPhieuBH ? dong('Thu cho phiếu xuất kho', r.SoPhieuBH) : ''}
      <p style="margin:10px 0 2px;font-size:15px;"><b>Số tiền: ${fmtTien(soTien)} đ</b></p>
      <p style="margin:0 0 4px;"><i>Bằng chữ: ${escapeHtml(docSoTienBangChu(soTien))}</i></p>
      <p style="margin:4px 0;">Kèm theo: ............ chứng từ gốc.</p>
      <div class="p-sign" style="display:flex;justify-content:space-between;margin-top:30px;text-align:center;font-size:13px;">
        <div style="flex:1;"><div class="line">Giám đốc</div></div>
        <div style="flex:1;"><div class="line">Kế toán</div></div>
        <div style="flex:1;"><div class="line">Thủ quỹ</div></div>
        <div style="flex:1;"><div class="line">${laThu ? 'Người nộp tiền' : 'Người nhận tiền'}</div></div>
        <div style="flex:1;"><div class="line">Người lập phiếu</div></div>
      </div>`, { logo: true });
  }

  /* ============================== 1. PHIẾU THU ============================== */
  async function renderPhieuThu(perm) {
    const body = document.getElementById('cnBody');
    const res = await apiGet('/api/congno/phieuthu');
    const rows = res.data || [];
    const tong = rows.reduce((s, r) => s + (Number(r.SoTien) || 0), 0);
    body.innerHTML = `
      <div class="toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        ${searchBoxHtml()}
        ${perm.canCreate ? '<button class="btn" id="btnAddThu">+ Tạo phiếu thu</button>' : ''}
        ${/* v7.32: xuất chi tiết PHIẾU THU ra Excel. Dùng CHUNG route /api/congno/export của công nợ
             (chỉ khác tham số) nên định dạng file, đầu trang, kẻ bảng đồng nhất với các file kia. */''}
        <button class="btn small secondary" id="btnXuatThu">⬇️ Xuất Excel</button>
        <span class="empty-hint" style="padding:0;margin-left:auto;">Tổng đã thu: <b>${fmtTien(tong)}</b> đ · ${rows.length} phiếu · Số phiếu tiếp theo: <b>${escapeHtml(res.soPhieuTiepTheo || '')}</b></span>
      </div>
      <table><thead><tr><th>Số phiếu</th><th>Ngày</th><th>Người/Khách nộp</th><th>Phiếu bán hàng</th><th>Tài khoản</th>
        <th>Số tiền</th><th>Hình thức</th><th>Diễn giải</th><th>Người tạo</th><th style="width:160px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        ${/* v6.56: bấm số phiếu -> popup chi tiết (có nút In luôn). */''}
        <td><a href="javascript:void(0)" class="act-ct-xem" data-loai="PT" data-id="${r.PhieuThuID}"><b>${escapeHtml(r.SoPhieu)}</b></a></td><td>${fmtDate(r.NgayThu)}</td>
        <td>${escapeHtml(r.TenDoiTuong || '')}${r.LoaiDoiTuong === 'Khac' ? ' <span class="badge">Khác</span>' : ''}</td>
        <td>${escapeHtml(r.SoPhieuBH || '')}</td><td>${escapeHtml((r.MaTK ? r.MaTK + ' - ' : '') + (r.TenTK || ''))}</td>
        <td style="text-align:right;"><b>${fmtTien(r.SoTien)}</b></td>
        <td>${escapeHtml(r.HinhThuc || '')}${r.SoTaiKhoan ? `<div style="font-size:11px;color:#5f6368;">${escapeHtml(r.TenNganHang || '')} — ${escapeHtml(r.SoTaiKhoan)}</div>` : ''}</td>
        <td>${escapeHtml(r.DienGiai || '')}</td><td>${escapeHtml(r.NguoiTao || '')}</td>
        <td><button class="btn small secondary act-in" data-id="${r.PhieuThuID}" title="In phiếu thu">🖨️</button>
          ${perm.canEdit ? `<button class="btn small secondary act-sua" data-id="${r.PhieuThuID}">Sửa</button> ` : ''}${perm.canDelete ? `<button class="btn small danger act-xoa" data-id="${r.PhieuThuID}">Xóa</button>` : ''}</td>
      </tr>`).join('') || '<tr><td colspan="10" class="empty-hint">Chưa có phiếu thu nào</td></tr>'}</tbody></table>`;
    wireTableSearch(body);
    body.querySelector('#btnXuatThu').addEventListener('click', () =>
      taiFile('/api/congno/export?loai=phieuthu', 'phieu_thu.xlsx'));
    const btn = body.querySelector('#btnAddThu');
    if (btn) btn.addEventListener('click', () => formPhieuThu(null, perm));
    body.querySelectorAll('.act-in').forEach(b => b.addEventListener('click', () =>
      inPhieuThuChi(rows.find(r => String(r.PhieuThuID) === b.dataset.id), 'Thu')));
    noiDaySoPhieu(body, () => renderPhieuThu(perm));   // v6.56: bấm số phiếu xem chi tiết
    body.querySelectorAll('.act-sua').forEach(b => b.addEventListener('click', () =>
      formPhieuThu(rows.find(r => String(r.PhieuThuID) === b.dataset.id), perm)));
    body.querySelectorAll('.act-xoa').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Xóa phiếu thu này? Công nợ khách hàng sẽ tăng lại tương ứng.')) return;
      try { await apiDelete('/api/congno/phieuthu/' + b.dataset.id); toast('Đã xóa.', 'success'); renderPhieuThu(perm); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  async function formPhieuThu(row, perm) {
    const isEdit = !!row;
    // Danh sách phiếu bán hàng để gán phiếu thu vào 1 phiếu bán hàng (không bắt buộc).
    let phieuBH = [];
    try { phieuBH = (await apiGet('/api/banhang/phieu')).data || []; } catch (e) { /* không có quyền bán hàng */ }
    const modal = openModal(`
      <h3>${isEdit ? 'Sửa phiếu thu ' + escapeHtml(row.SoPhieu) : 'Tạo phiếu thu'}</h3>
      <form id="fThu">
        <div class="form-grid">
          <div class="form-row"><label>Ngày thu *</label><input type="date" name="ngay" required value="${isEdit ? String(row.NgayThu).slice(0, 10) : new Date().toISOString().slice(0, 10)}"></div>
          <div class="form-row"><label>Loại đối tượng</label>
            <select name="loaiDoiTuong" id="thuLoai">
              <option value="KhachHang" ${isEdit && row.LoaiDoiTuong === 'Khac' ? '' : 'selected'}>Khách hàng (giảm công nợ)</option>
              <option value="Khac" ${isEdit && row.LoaiDoiTuong === 'Khac' ? 'selected' : ''}>Khác (không vào công nợ)</option>
            </select></div>
          <div class="form-row"><label>Khách hàng (chọn từ danh mục)</label>
            <select name="khachHangId" id="thuKH"><option value="">-- không chọn --</option>${opt(dm.khachHang, 'KhachHangID', 'TenKhachHang', isEdit ? row.KhachHangID : '')}</select></div>
          <div class="form-row"><label>Tên khách / người nộp *</label>
            <input name="tenDoiTuong" id="thuTen" required value="${escapeHtml(isEdit ? (row.TenDoiTuong || '') : '')}" placeholder="Gõ đúng tên khách như trên phiếu bán hàng">
            <div class="empty-hint" style="margin-top:2px;">Công nợ khách hàng nhóm theo <b>TÊN KHÁCH</b> — phải gõ giống tên trên phiếu bán hàng mới trừ đúng nợ.</div></div>
          ${/* v6.24.5: chỉ hiện PHIẾU XUẤT CỦA CHÍNH KHÁCH ĐANG CHỌN (trước liệt kê tất cả, rất dễ
               gán nhầm phiếu của khách khác). Danh sách cập nhật ngay khi đổi khách. */''}
          <div class="form-row"><label>Phiếu xuất kho của khách này (nếu thu cho 1 phiếu)</label>
            <select name="phieuBHID" id="thuPhieuBH"></select>
            <div class="empty-hint" id="thuPhieuBHTT" style="margin-top:2px;"></div></div>
          <div class="form-row"><label>Tài khoản thu</label>
            ${oTaiKhoanHtml('Thu', isEdit ? row.TaiKhoanID : '')}</div>
          <div class="form-row"><label>Số tiền *</label><input type="number" name="soTien" step="0.01" min="0" required value="${isEdit ? row.SoTien : ''}"></div>
          <div class="form-row"><label>Hình thức</label><select name="hinhThuc" id="thuHT">${/* value đặt rõ ràng: nhãn có thêm chữ "(không qua quỹ)" nên KHÔNG được để trình duyệt lấy nhãn làm giá trị */''}${[...HINH_THUC, HT_CHUYEN_THANG].map(h => `<option value="${escapeHtml(h)}" ${isEdit && row.HinhThuc === h ? 'selected' : ''}>${h}${h === HT_CHUYEN_THANG ? ' (không qua quỹ)' : ''}</option>`).join('')}</select></div>
          ${/* v6.54: CHUYỂN THẲNG — khách trả tiền nhưng chuyển thẳng cho NCC / trả hộ chi phí,
               tiền không qua quỹ mình. Chọn xong hiện 2 ô dưới; lưu xong hệ thống tự sinh phiếu chi
               đi kèm nên công nợ hai đầu đều đúng và sổ quỹ triệt tiêu, số dư không đổi. */''}
          <div class="form-row" id="thuOCT" style="display:none;">
            <label>Tiền chuyển thẳng cho</label>
            <select name="ctNccId" id="thuCTNcc"><option value="">-- Nhà cung cấp (giảm nợ phải trả) --</option>${opt(dm.ncc, 'NCC_ID', 'TenNCC', isEdit ? '' : '')}</select>
            <select name="ctTaiKhoanChiId" id="thuCTTK" style="margin-top:4px;"><option value="">-- hoặc Loại chi phí --</option>${tkTheoPhieu('Chi').map(t => `<option value="${t.TaiKhoanID}">${escapeHtml(t.MaTK + ' - ' + t.TenTK)}</option>`).join('')}</select>
            <div class="empty-hint" style="margin-top:2px;">Chọn <b>một trong hai</b>. Lưu xong hệ thống tự tạo <b>phiếu chi</b> cùng ngày, cùng số tiền — sổ quỹ cộng rồi trừ nên số dư không đổi.</div>
          </div>
          <div class="form-row" id="thuONH"><label>Số tài khoản nhận/chi *</label>
            <select name="taiKhoanNHID" id="thuNH"><option value="">-- chọn tài khoản ngân hàng --</option>${dm.nganHang.map(t => `<option value="${t.TaiKhoanNHID}" ${isEdit && String(row.TaiKhoanNHID) === String(t.TaiKhoanNHID) ? 'selected' : (!isEdit && t.MacDinh ? 'selected' : '')}>${escapeHtml(t.TenNganHang + ' — ' + t.SoTaiKhoan + (t.ChuTaiKhoan ? ' (' + t.ChuTaiKhoan + ')' : ''))}</option>`).join('')}</select>
            ${dm.nganHang.length ? '' : '<div class="empty-hint" style="margin-top:2px;color:#c0392b;">Chưa khai tài khoản ngân hàng nào — vào <b>Danh mục → Tài khoản ngân hàng</b>.</div>'}</div>
        </div>
        <div class="form-row"><label>Diễn giải</label><input name="dienGiai" value="${escapeHtml(isEdit ? (row.DienGiai || '') : '')}"></div>
        <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button><button type="submit" class="btn">Lưu</button></div>
      </form>`);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    wireHinhThuc(modal, 'thu');
    /* v6.54: chọn "Chuyển thẳng" -> hiện ô đối tượng nhận, ẩn ô số tài khoản ngân hàng (tiền không
       vào tài khoản nào của mình). Đổi sang hình thức khác thì XÓA giá trị 2 ô kia — chỉ ẩn thôi thì
       FormData vẫn gửi lên và backend lại đi tạo phiếu chi không ai muốn. */
    const oCT = modal.querySelector('#thuOCT');
    const selHT = modal.querySelector('#thuHT');
    const dongBoCT = () => {
      const la = selHT.value === HT_CHUYEN_THANG;
      oCT.style.display = la ? '' : 'none';
      const oNH = modal.querySelector('#thuONH');
      if (la && oNH) oNH.style.display = 'none';
      if (!la) {
        modal.querySelector('#thuCTNcc').value = '';
        modal.querySelector('#thuCTTK').value = '';
      }
    };
    selHT.addEventListener('change', dongBoCT);
    dongBoCT();
    // Chọn một trong hai: chọn bên này thì bỏ bên kia, tránh gửi lên cả hai rồi backend phải đoán.
    modal.querySelector('#thuCTNcc').addEventListener('change', e => { if (e.target.value) modal.querySelector('#thuCTTK').value = ''; });
    modal.querySelector('#thuCTTK').addEventListener('change', e => { if (e.target.value) modal.querySelector('#thuCTNcc').value = ''; });
    /* Lọc danh sách phiếu xuất theo TÊN KHÁCH đang nhập (so sánh bỏ khoảng trắng thừa, không phân
       biệt hoa/thường) — cùng khóa nhóm với công nợ khách hàng. */
    const selPhieu = modal.querySelector('#thuPhieuBH');
    const ttPhieu = modal.querySelector('#thuPhieuBHTT');
    function veDsPhieu() {
      const ten = (modal.querySelector('#thuTen').value || '').trim().toLowerCase();
      const ds = ten ? phieuBH.filter(p => String(p.TenKhach || '').trim().toLowerCase() === ten && p.TrangThai !== 'Đã hủy') : [];
      const dangChon = isEdit ? String(row.PhieuBHID || '') : '';
      selPhieu.innerHTML = '<option value="">-- không gán --</option>'
        + ds.map(p => `<option value="${p.PhieuBHID}" ${dangChon === String(p.PhieuBHID) ? 'selected' : ''}>${escapeHtml(p.SoPhieu)} · ${fmtDate(p.NgayBan)} · ${fmtNumber(p.TongThanhToan)}đ (đã thu ${fmtNumber(p.DaThu)}, còn ${fmtNumber(Number(p.TongThanhToan) - Number(p.DaThu))})</option>`).join('');
      ttPhieu.textContent = !ten ? 'Chọn/nhập tên khách ở trên để hiện phiếu xuất của khách đó.'
        : (ds.length ? `${ds.length} phiếu xuất của khách này.` : 'Khách này chưa có phiếu xuất kho nào.');
    }
    // Chọn khách từ danh mục -> tự điền tên (tên mới là khóa nhóm công nợ).
    modal.querySelector('#thuKH').addEventListener('change', (e) => {
      const k = dm.khachHang.find(x => String(x.KhachHangID) === e.target.value);
      if (k) modal.querySelector('#thuTen').value = k.TenKhachHang;
      veDsPhieu();
    });
    modal.querySelector('#thuTen').addEventListener('input', veDsPhieu);
    veDsPhieu();
    modal.querySelector('#fThu').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        ngay: fd.get('ngay'), loaiDoiTuong: fd.get('loaiDoiTuong'),
        khachHangId: fd.get('khachHangId') || null, tenDoiTuong: fd.get('tenDoiTuong'),
        taiKhoanId: fd.get('taiKhoanId') || null, phieuBHID: fd.get('phieuBHID') || null,
        soTien: fd.get('soTien'), hinhThuc: fd.get('hinhThuc'), dienGiai: fd.get('dienGiai') || null,
        taiKhoanNHID: fd.get('taiKhoanNHID') || null,
        // v6.54: đối tượng nhận tiền khi chuyển thẳng (backend tự sinh phiếu chi tương ứng)
        ctNccId: fd.get('ctNccId') || null, ctTaiKhoanChiId: fd.get('ctTaiKhoanChiId') || null
      };
      if (payload.hinhThuc === HT_CHUYEN_THANG && !payload.ctNccId && !payload.ctTaiKhoanChiId) {
        toast('Chọn "Chuyển thẳng" thì phải chọn Nhà cung cấp hoặc Loại chi phí nhận tiền.', 'error');
        return;
      }
      try {
        let kq;
        if (isEdit) kq = await apiPut('/api/congno/phieuthu/' + row.PhieuThuID, payload);
        else kq = await apiPost('/api/congno/phieuthu', payload);
        closeModal();
        // v6.54: báo rõ đã sinh kèm phiếu chi nào — để người dùng biết mà đối chiếu, không thấy tự dưng có phiếu chi lạ.
        const spc = kq && kq.data && kq.data.soPhieuChi;
        toast(spc ? `Đã lưu phiếu thu + tự tạo phiếu chi ${spc} (chuyển thẳng).` : 'Đã lưu phiếu thu.', 'success');
        renderPhieuThu(perm);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ============================== 2. PHIẾU CHI ============================== */
  async function renderPhieuChi(perm) {
    const body = document.getElementById('cnBody');
    const res = await apiGet('/api/congno/phieuchi');
    const rows = res.data || [];
    const tong = rows.reduce((s, r) => s + (Number(r.SoTien) || 0), 0);
    const tongCPKD = rows.filter(r => r.TinhChiPhiKD).reduce((s, r) => s + (Number(r.SoTien) || 0), 0);
    body.innerHTML = `
      <div class="toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        ${searchBoxHtml()}
        ${perm.canCreate ? '<button class="btn" id="btnAddChi">+ Tạo phiếu chi</button>' : ''}
        <button class="btn small secondary" id="btnXuatChi">⬇️ Xuất Excel</button>
        <span class="empty-hint" style="padding:0;margin-left:auto;">Tổng đã chi: <b>${fmtTien(tong)}</b> đ (trong đó tính chi phí KD: <b>${fmtTien(tongCPKD)}</b> đ) · Số phiếu tiếp theo: <b>${escapeHtml(res.soPhieuTiepTheo || '')}</b></span>
      </div>
      <table><thead><tr><th>Số phiếu</th><th>Ngày</th><th>Đối tượng nhận</th><th>Tài khoản</th><th>Tính CPKD</th>
        <th>Số tiền</th><th>Hình thức</th><th>Diễn giải</th><th>Người tạo</th><th style="width:160px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        ${/* v6.56: bấm số phiếu -> popup chi tiết (có nút In luôn). */''}
        <td><a href="javascript:void(0)" class="act-ct-xem" data-loai="PC" data-id="${r.PhieuChiID}"><b>${escapeHtml(r.SoPhieu)}</b></a></td><td>${fmtDate(r.NgayChi)}</td>
        <td>${escapeHtml(r.TenNCC || r.TenNhaGiaCong || r.TenDoiTuong || '')}<div style="font-size:11px;color:#5f6368;">${escapeHtml(r.LoaiDoiTuong || '')}</div></td>
        <td>${escapeHtml((r.MaTK ? r.MaTK + ' - ' : '') + (r.TenTK || ''))}</td>
        <td>${r.TinhChiPhiKD ? '<span class="badge warn">Có</span>' : '<span class="badge">Không</span>'}</td>
        <td style="text-align:right;"><b>${fmtTien(r.SoTien)}</b></td>
        <td>${escapeHtml(r.HinhThuc || '')}${r.SoTaiKhoan ? `<div style="font-size:11px;color:#5f6368;">${escapeHtml(r.TenNganHang || '')} — ${escapeHtml(r.SoTaiKhoan)}</div>` : ''}</td>
        <td>${escapeHtml(r.DienGiai || '')}</td><td>${escapeHtml(r.NguoiTao || '')}</td>
        <td><button class="btn small secondary act-in" data-id="${r.PhieuChiID}" title="In phiếu chi">🖨️</button>
          ${perm.canEdit ? `<button class="btn small secondary act-sua" data-id="${r.PhieuChiID}">Sửa</button> ` : ''}${perm.canDelete ? `<button class="btn small danger act-xoa" data-id="${r.PhieuChiID}">Xóa</button>` : ''}</td>
      </tr>`).join('') || '<tr><td colspan="10" class="empty-hint">Chưa có phiếu chi nào</td></tr>'}</tbody></table>`;
    wireTableSearch(body);
    body.querySelector('#btnXuatChi').addEventListener('click', () =>
      taiFile('/api/congno/export?loai=phieuchi', 'phieu_chi.xlsx'));
    const btn = body.querySelector('#btnAddChi');
    if (btn) btn.addEventListener('click', () => formPhieuChi(null, perm));
    body.querySelectorAll('.act-in').forEach(b => b.addEventListener('click', () =>
      inPhieuThuChi(rows.find(r => String(r.PhieuChiID) === b.dataset.id), 'Chi')));
    noiDaySoPhieu(body, () => renderPhieuChi(perm));   // v6.56
    body.querySelectorAll('.act-sua').forEach(b => b.addEventListener('click', () =>
      formPhieuChi(rows.find(r => String(r.PhieuChiID) === b.dataset.id), perm)));
    body.querySelectorAll('.act-xoa').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Xóa phiếu chi này? Công nợ nhà cung cấp sẽ tăng lại tương ứng.')) return;
      try { await apiDelete('/api/congno/phieuchi/' + b.dataset.id); toast('Đã xóa.', 'success'); renderPhieuChi(perm); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  function formPhieuChi(row, perm) {
    const isEdit = !!row;
    const loai = isEdit ? (row.LoaiDoiTuong || 'NhaCungCap') : 'NhaCungCap';
    const modal = openModal(`
      <h3>${isEdit ? 'Sửa phiếu chi ' + escapeHtml(row.SoPhieu) : 'Tạo phiếu chi'}</h3>
      <form id="fChi">
        <div class="form-grid">
          <div class="form-row"><label>Ngày chi *</label><input type="date" name="ngay" required value="${isEdit ? String(row.NgayChi).slice(0, 10) : new Date().toISOString().slice(0, 10)}"></div>
          <div class="form-row"><label>Chi cho</label>
            <select name="loaiDoiTuong" id="chiLoai">
              <option value="NhaCungCap" ${loai === 'NhaCungCap' ? 'selected' : ''}>Nhà cung cấp (giảm công nợ NCC)</option>
              <option value="NhaGiaCong" ${loai === 'NhaGiaCong' ? 'selected' : ''}>Nhà gia công / in thêu</option>
              <option value="NhanVien" ${loai === 'NhanVien' ? 'selected' : ''}>Nhân viên</option>
              <option value="Khac" ${loai === 'Khac' ? 'selected' : ''}>Khác</option>
            </select></div>
          <div class="form-row" id="oNCC"><label>Nhà cung cấp</label>
            <select name="nccId" id="chiNCC"><option value="">-- không chọn --</option>${opt(dm.ncc, 'NCC_ID', 'TenNCC', isEdit ? row.NCC_ID : '')}</select>
            <div class="empty-hint" style="margin-top:2px;">Chọn NCC thì tiền này mới trừ vào <b>công nợ nhà cung cấp</b>.</div></div>
          <div class="form-row" id="oNGC"><label>Nhà gia công / in thêu</label>
            <select name="nhaGiaCongId"><option value="">-- không chọn --</option>${opt(dm.nhaGiaCong, 'NhaGiaCongID', 'TenNha', isEdit ? row.NhaGiaCongID : '')}</select></div>
          <div class="form-row"><label>Tên đối tượng nhận</label><input name="tenDoiTuong" id="chiTen" value="${escapeHtml(isEdit ? (row.TenDoiTuong || '') : '')}"></div>
          <div class="form-row"><label>Tài khoản chi (quyết định có tính chi phí KD)</label>
            ${oTaiKhoanHtml('Chi', isEdit ? row.TaiKhoanID : '')}</div>
          <div class="form-row"><label>Số tiền *</label><input type="number" name="soTien" step="0.01" min="0" required value="${isEdit ? row.SoTien : ''}"></div>
          <div class="form-row"><label>Hình thức</label><select name="hinhThuc" id="chiHT">${HINH_THUC.map(h => `<option ${isEdit && row.HinhThuc === h ? 'selected' : ''}>${h}</option>`).join('')}</select></div>
          <div class="form-row" id="chiONH"><label>Số tài khoản nhận/chi *</label>
            <select name="taiKhoanNHID" id="chiNH"><option value="">-- chọn tài khoản ngân hàng --</option>${dm.nganHang.map(t => `<option value="${t.TaiKhoanNHID}" ${isEdit && String(row.TaiKhoanNHID) === String(t.TaiKhoanNHID) ? 'selected' : (!isEdit && t.MacDinh ? 'selected' : '')}>${escapeHtml(t.TenNganHang + ' — ' + t.SoTaiKhoan + (t.ChuTaiKhoan ? ' (' + t.ChuTaiKhoan + ')' : ''))}</option>`).join('')}</select>
            ${dm.nganHang.length ? '' : '<div class="empty-hint" style="margin-top:2px;color:#c0392b;">Chưa khai tài khoản ngân hàng nào — vào <b>Danh mục → Tài khoản ngân hàng</b>.</div>'}</div>
        </div>
        <div class="form-row"><label>Diễn giải</label><input name="dienGiai" value="${escapeHtml(isEdit ? (row.DienGiai || '') : '')}"></div>
        <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button><button type="submit" class="btn">Lưu</button></div>
      </form>`);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    wireHinhThuc(modal, 'chi');
    /* Ẩn ô nào thì XÓA giá trị ô đó — nếu chỉ display:none, FormData vẫn gửi id đã chọn trước đó và
       tiền trả nhà gia công lại bị trừ vào công nợ NCC (backend cũng đã NULL hóa theo loại, đây là
       lớp chặn thứ 2 để người dùng thấy đúng ngay trên form). */
    const dongBoO = () => {
      const l = modal.querySelector('#chiLoai').value;
      const oNCC = modal.querySelector('#oNCC'), oNGC = modal.querySelector('#oNGC');
      oNCC.style.display = l === 'NhaCungCap' ? '' : 'none';
      oNGC.style.display = l === 'NhaGiaCong' ? '' : 'none';
      if (l !== 'NhaCungCap') oNCC.querySelector('select').value = '';
      if (l !== 'NhaGiaCong') oNGC.querySelector('select').value = '';
    };
    modal.querySelector('#chiLoai').addEventListener('change', dongBoO);
    dongBoO();
    modal.querySelector('#chiNCC').addEventListener('change', (e) => {
      const n = dm.ncc.find(x => String(x.NCC_ID) === e.target.value);
      if (n) modal.querySelector('#chiTen').value = n.TenNCC;
    });
    modal.querySelector('#fChi').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        ngay: fd.get('ngay'), loaiDoiTuong: fd.get('loaiDoiTuong'),
        nccId: fd.get('nccId') || null, nhaGiaCongId: fd.get('nhaGiaCongId') || null,
        tenDoiTuong: fd.get('tenDoiTuong'), taiKhoanId: fd.get('taiKhoanId') || null,
        soTien: fd.get('soTien'), hinhThuc: fd.get('hinhThuc'), dienGiai: fd.get('dienGiai') || null,
        taiKhoanNHID: fd.get('taiKhoanNHID') || null
      };
      try {
        if (isEdit) await apiPut('/api/congno/phieuchi/' + row.PhieuChiID, payload);
        else await apiPost('/api/congno/phieuchi', payload);
        closeModal(); toast('Đã lưu phiếu chi.', 'success'); renderPhieuChi(perm);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ============================== 3. CÔNG NỢ KHÁCH HÀNG ============================== */
  async function renderCongNoKH(perm) {
    const body = document.getElementById('cnBody');
    const rows = (await apiGet('/api/congno/congnokh')).data || [];
    const t = rows.reduce((a, r) => ({
      PhaiThu: a.PhaiThu + Number(r.PhaiThu || 0), DaThu: a.DaThu + Number(r.DaThu || 0),
      DieuChinh: a.DieuChinh + Number(r.DieuChinh || 0), ConNo: a.ConNo + Number(r.ConNo || 0)
    }), { PhaiThu: 0, DaThu: 0, DieuChinh: 0, ConNo: 0 });
    body.innerHTML = `
      <div class="toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        ${searchBoxHtml()}
        ${/* v7.34: ghi rõ "tổng hợp" — sổ chi tiết theo mẫu kế toán nằm trong popup từng khách. */''}
        <button class="btn small secondary" id="btnXuat" title="Bảng tổng hợp công nợ + sổ chi tiết của tất cả khách + các sheet chứng từ">⬇️ Xuất tổng hợp (Excel)</button>
        <span class="empty-hint" style="padding:0;margin-left:auto;">Tổng còn phải thu: <b style="color:#c0392b;">${fmtNumber(t.ConNo)}</b> đ / ${rows.length} khách</span>
      </div>
      <div class="empty-hint" style="text-align:left;">Phải thu = tổng <b>phiếu bán hàng</b> (chưa hủy) + điều chỉnh · Đã thu = tổng <b>phiếu thu</b> · Bấm tên khách để xem sổ chi tiết.</div>
      <table><thead><tr><th>Khách hàng</th><th>Phải thu (phiếu BH)</th><th>Điều chỉnh</th><th>Đã thu</th><th>Còn nợ</th><th>Số phiếu BH</th><th>Số phiếu thu</th><th>Bán gần nhất</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><a href="javascript:void(0)" class="act-ct" data-khach="${escapeHtml(r.TenKhach)}"><b>${escapeHtml(r.TenKhach)}</b></a></td>
        <td style="text-align:right;">${fmtNumber(r.PhaiThu)}</td>
        <td style="text-align:right;">${r.DieuChinh ? fmtNumber(r.DieuChinh) : ''}</td>
        <td style="text-align:right;">${fmtNumber(r.DaThu)}</td>
        <td style="text-align:right;"><b style="color:${Number(r.ConNo) > 0 ? '#c0392b' : '#137333'};">${fmtNumber(r.ConNo)}</b></td>
        <td style="text-align:center;">${r.SoPhieu || 0}</td><td style="text-align:center;">${r.SoPhieuThu || 0}</td>
        <td>${r.LanCuoi ? fmtDate(r.LanCuoi) : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="empty-hint">Chưa có công nợ khách hàng nào</td></tr>'}
        ${/* v6.47: data-tong để wireTableSort() luôn giữ dòng này ở cuối bảng. */''}
        ${rows.length ? `<tr data-tong style="font-weight:bold;background:#f1f3f4;"><td>TỔNG</td><td style="text-align:right;">${fmtNumber(t.PhaiThu)}</td>
          <td style="text-align:right;">${fmtNumber(t.DieuChinh)}</td><td style="text-align:right;">${fmtNumber(t.DaThu)}</td>
          <td style="text-align:right;">${fmtNumber(t.ConNo)}</td><td colspan="3"></td></tr>` : ''}</tbody></table>`;
    wireTableSearch(body);
    wireTableSort(body);   // v6.47: bấm tiêu đề cột để sắp xếp
    body.querySelector('#btnXuat').addEventListener('click', () => taiFile('/api/congno/export?loai=kh', 'cong_no_khach_hang.xlsx'));
    body.querySelectorAll('.act-ct').forEach(a => a.addEventListener('click', () => soChiTietKH(a.dataset.khach)));
  }

  /* Mở SỔ CHI TIẾT công nợ của MỘT khách. Gọi từ 2 chỗ: bảng "Công nợ khách hàng" ở đây và
     Dashboard kinh doanh (bấm tên khách) — xem `window.ModuleCongNo.soChiTietKH` ở cuối file.
     v7.44: BỌC try/catch. Route /congnokh/chitiet còn chặn thêm requireChucNang('CONGNO','congnokh'),
     nên tài khoản có quyền xem phân hệ Công nợ mà KHÔNG được cấp chức năng này sẽ bị 403; không bắt
     lỗi thì apiGet throw giữa hàm và người dùng thấy "bấm mà không có gì xảy ra". */
  async function soChiTietKH(khach) {
    let d;
    try { d = (await apiGet('/api/congno/congnokh/chitiet?khach=' + encodeURIComponent(khach))).data; }
    catch (err) { toast('Không mở được sổ công nợ của "' + khach + '": ' + err.message, 'error'); return; }
    const modal = openModal(`
      <h3>Sổ công nợ: ${escapeHtml(khach)}</h3>
      <div style="margin-bottom:8px;">Còn nợ: <b style="color:#c0392b;font-size:16px;">${fmtNumber(d.conNo)}</b> đ</div>
      <div style="max-height:60vh;overflow:auto;">
      <table><thead><tr><th>Ngày</th><th>Loại</th><th>Số phiếu</th><th>Phát sinh</th><th>Thanh toán</th><th>Còn nợ lũy kế</th><th>Diễn giải</th></tr></thead>
      ${/* v6.52: SỐ PHIẾU BÁN HÀNG bấm được -> mở chi tiết phiếu. Chỉ dòng có PhieuBHID mới bấm được;
           phiếu thu / điều chỉnh không có màn chi tiết riêng nên để chữ thường, không giả vờ bấm được. */''}
      <tbody>${(d.rows || []).map(r => `<tr>
        <td>${fmtDate(r.Ngay)}</td><td>${escapeHtml(r.Loai)}</td>
        <td>${oSoPhieu(r)}</td>
        <td style="text-align:right;">${Number(r.PhatSinh) ? fmtNumber(r.PhatSinh) : ''}</td>
        <td style="text-align:right;">${Number(r.ThanhToan) ? fmtNumber(r.ThanhToan) : ''}</td>
        <td style="text-align:right;"><b>${fmtNumber(r.LuyKe)}</b></td><td>${escapeHtml(r.DienGiai || '')}</td></tr>`).join('')
        || '<tr><td colspan="7" class="empty-hint">Chưa có phát sinh nào</td></tr>'}</tbody></table></div>
      ${/* v6.47: xuất riêng sổ của khách này. v7.34: thêm khối kỳ + nút xuất mẫu sổ kế toán. */''}
      ${khoiXuatSoHtml()}
      <div class="modal-actions">
        <button type="button" class="btn small secondary" id="btnXuatCT" title="File gồm: sổ chi tiết + chi tiết từng dòng hàng của phiếu bán hàng + danh sách phiếu thu">⬇️ Xuất Excel sổ này (kèm chứng từ)</button>
        <button type="button" class="btn secondary" id="btnDong">Đóng</button></div>`);
    modal.querySelector('#btnDong').addEventListener('click', closeModal);
    modal.querySelector('#btnXuatCT').addEventListener('click', () =>
      taiFile('/api/congno/export?loai=kh&khach=' + encodeURIComponent(khach), 'cong_no_khach.xlsx'));
    noiDayXuatSo(modal, 'loai=kh&khach=' + encodeURIComponent(khach), 'so_chi_tiet_cong_no.xlsx');   // v7.34
    noiDaySoPhieu(modal, () => soChiTietKH(khach));   // v6.55
  }

  /* ================================================================================================
     v7.34 — KHỐI XUẤT EXCEL trong popup sổ công nợ (dùng CHUNG cho khách hàng và nhà cung cấp).
     Hai nút, hai mục đích khác nhau — đặt cạnh nhau để không ai phải đoán:
       • "Xuất sổ chi tiết"  -> ?kieu=so  : mẫu SỔ KẾ TOÁN 9 cột (Mã / Ngày / Số / Diễn giải / Số lượng
                                /Đơn giá / Thành tiền / 2 cột tiền), có Dư đầu kỳ – Phát sinh trong kỳ
                                – Dư cuối kỳ và các dòng hàng thụt lề dưới từng chứng từ. Theo KỲ.
       • "Xuất tổng hợp"     -> không kèm kieu : giữ ĐÚNG file như trước (bảng tổng hợp + sổ chi tiết
                                của tất cả đối tượng + các sheet chứng từ).
     Kỳ mặc định: 01/01 năm nay -> hôm nay. Để trống cả hai ô = lấy toàn bộ phát sinh từ đầu.
     ================================================================================================ */
  function ngayISO(d) {
    const h = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${h(d.getMonth() + 1)}-${h(d.getDate())}`;
  }
  function khoiXuatSoHtml() {
    const nay = new Date();
    return `
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 0;padding-top:8px;border-top:1px solid #e0e0e0;">
        <span style="font-size:12px;color:#5f6368;">Kỳ:</span>
        <input type="date" id="soTuNgay" value="${ngayISO(new Date(nay.getFullYear(), 0, 1))}" style="width:auto;">
        <span style="font-size:12px;color:#5f6368;">đến</span>
        <input type="date" id="soDenNgay" value="${ngayISO(nay)}" style="width:auto;">
        <button type="button" class="btn small" id="btnXuatSo"
          title="Mẫu sổ kế toán 9 cột: Dư đầu kỳ – phát sinh từng chứng từ (kèm dòng hàng) – Dư cuối kỳ">⬇️ Xuất sổ chi tiết</button>
      </div>`;
  }
  /* `duong` là phần query xác định đối tượng, vd 'loai=kh&khach=...' hoặc 'loai=ncc&nccId=12'. */
  function noiDayXuatSo(modal, duong, tenFile) {
    const nut = modal.querySelector('#btnXuatSo');
    if (!nut) return;
    nut.addEventListener('click', () => {
      const tu = (modal.querySelector('#soTuNgay') || {}).value || '';
      const den = (modal.querySelector('#soDenNgay') || {}).value || '';
      if (tu && den && tu > den) return toast('Từ ngày phải nhỏ hơn hoặc bằng đến ngày.', 'error');
      taiFile(`/api/congno/export?${duong}&kieu=so&tuNgay=${tu}&denNgay=${den}`, tenFile);
    });
  }

  /* v6.55: ô SỐ PHIẾU trong sổ công nợ — bấm được với mọi chứng từ có màn chi tiết.
     Backend trả kèm CtLoai ('PBH'|'PT'|'PC'|'PNV'|'PNPK') + CtID; dòng Điều chỉnh không có nên để
     chữ thường. Gom vào 1 hàm để hai sổ (khách hàng / nhà cung cấp) dùng chung, không trôi khỏi nhau. */
  function oSoPhieu(r) {
    const nhan = escapeHtml(r.SoPhieu || '');
    if (!r.CtLoai || !r.CtID) return nhan || '';
    return `<a href="javascript:void(0)" class="act-ct-xem" data-loai="${r.CtLoai}" data-id="${r.CtID}"><b>${nhan || '(xem)'}</b></a>`;
  }
  /* Popup chi tiết chứng từ. Phiếu bán hàng vẫn dùng hàm riêng vì có khối chiết khấu/VAT/đã thu
     theo mẫu Word; 4 loại còn lại chung một khuôn header + bảng dòng. */
  async function xemChungTu(loai, id, quayLai) {
    if (loai === 'PBH') return xemPhieuBanHangTuCongNo(id, quayLai);
    let d;
    try { d = (await apiGet(`/api/congno/chungtu?loai=${encodeURIComponent(loai)}&id=${encodeURIComponent(id)}`)).data; }
    catch (err) { toast('Không mở được chứng từ: ' + err.message, 'error'); return; }
    const h = d.header || {};
    const dong = d.dong || [];
    const ngay = h.NgayThu || h.NgayChi || h.NgayNhap || h.Ngay;
    const doiTuong = h.TenDoiTuong || h.TenNCC || '';
    const tong = dong.reduce((s, x) => s + (Number(x.ThanhTien) || 0), 0);
    const m = openModal(`
      <h3>${escapeHtml(d.tieuDe || 'Chứng từ')}</h3>
      <div style="font-size:13px;margin-bottom:8px;">
        <b>Ngày:</b> ${fmtDate(ngay)}${doiTuong ? ` · <b>Đối tượng:</b> ${escapeHtml(doiTuong)}` : ''}
        ${h.MaTK ? ` · <b>Tài khoản:</b> ${escapeHtml(h.MaTK + ' - ' + (h.TenTK || ''))}` : ''}
        ${h.HinhThuc ? ` · <b>Hình thức:</b> ${escapeHtml(h.HinhThuc)}` : ''}
        ${h.SoTien != null ? `<div style="font-size:15px;margin-top:4px;">Số tiền: <b style="color:#c0392b;">${fmtNumber(h.SoTien)}</b> đ</div>` : ''}
        ${h.DienGiai || h.GhiChu ? `<div style="color:#5f6368;">Diễn giải: ${escapeHtml(h.DienGiai || h.GhiChu)}</div>` : ''}
        ${h.NguoiTao ? `<div style="color:#5f6368;">Người tạo: ${escapeHtml(h.NguoiTao)}</div>` : ''}
      </div>
      ${dong.length ? `<div style="max-height:50vh;overflow:auto;">
        <table><thead><tr><th>STT</th><th>Mã</th><th>Tên</th><th>SL</th><th>ĐVT</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
        <tbody>${dong.map((x, i) => `<tr>
          <td>${i + 1}</td><td>${escapeHtml(x.MaCay || '')}</td><td>${escapeHtml(x.Ten || '')}</td>
          <td style="text-align:right;">${fmtNumber(x.SoLuong)}</td><td>${escapeHtml(x.DonVi || '')}</td>
          <td style="text-align:right;">${fmtNumber(x.DonGia)}</td>
          <td style="text-align:right;"><b>${fmtNumber(x.ThanhTien)}</b></td></tr>`).join('')}
          <tr style="font-weight:bold;background:#f1f3f4;"><td colspan="6" style="text-align:right;">TỔNG</td>
            <td style="text-align:right;">${fmtNumber(tong)}</td></tr></tbody></table></div>` : ''}
      <div class="modal-actions">
        ${/* v6.56: phiếu thu/chi in được ngay trong popup — dùng lại inPhieuThuChi() của danh sách,
             header trả về từ /chungtu có đủ các trường mẫu phiếu cần. */''}
        ${(loai === 'PT' || loai === 'PC') ? '<button type="button" class="btn small secondary" id="btnInCT">🖨️ In phiếu</button>' : ''}
        <button type="button" class="btn secondary" id="btnDongCT">Đóng</button></div>`);
    const bIn = m.querySelector('#btnInCT');
    if (bIn) bIn.addEventListener('click', () => inPhieuThuChi(h, loai === 'PT' ? 'Thu' : 'Chi'));
    m.querySelector('#btnDongCT').addEventListener('click', () => { closeModal(); if (quayLai) quayLai(); });
  }
  // Gắn sự kiện cho mọi ô số phiếu bấm được trong 1 popup sổ.
  function noiDaySoPhieu(modal, quayLai) {
    modal.querySelectorAll('.act-ct-xem').forEach(a => a.addEventListener('click',
      () => xemChungTu(a.dataset.loai, a.dataset.id, quayLai)));
  }

  /* v6.52: XEM CHI TIẾT 1 PHIẾU BÁN HÀNG ngay từ sổ công nợ.
     Tự dựng bảng ở đây thay vì gọi sang module Thẻ kho: hàm xem bên đó gắn với `perm` và bộ nút
     Sửa/Hủy/Xóa của chính màn hình nó — gọi chéo sang là kéo theo cả mớ nút mà người xem sổ công nợ
     có thể không có quyền dùng. Ở đây chỉ cần XEM.
     `quayLai` để đóng popup phiếu thì về lại đúng sổ đang xem (app chỉ cho 1 modal cùng lúc). */
  async function xemPhieuBanHangTuCongNo(phieuId, quayLai) {
    let d;
    try { d = (await apiGet('/api/banhang/phieu/' + phieuId)).data; }
    catch (err) { toast('Không mở được phiếu: ' + err.message, 'error'); return; }
    const h = d.header || {};
    const ct = d.chiTiet || [];
    const so = v => Number(v) || 0;
    const m = openModal(`
      <h3>Phiếu bán hàng ${escapeHtml(h.SoPhieu || '')} ${h.TrangThai === 'Đã hủy' ? '<span class="badge danger">Đã hủy</span>' : ''}</h3>
      <div style="font-size:13px;margin-bottom:8px;">
        <b>Ngày:</b> ${fmtDate(h.NgayBan)} · <b>Khách:</b> ${escapeHtml(h.TenKhach || '')}
        ${h.GhiChu ? `<div style="color:#5f6368;">Ghi chú: ${escapeHtml(h.GhiChu)}</div>` : ''}
      </div>
      <div style="max-height:52vh;overflow:auto;">
      <table><thead><tr><th>STT</th><th>Mã hàng</th><th>Tên hàng</th><th>Màu</th><th>SL</th><th>ĐVT</th>
        <th>Giá bán lẻ</th><th>% CK shop</th><th>Giá bán</th><th>Thành tiền</th></tr></thead>
      <tbody>${ct.map((c, i) => `<tr>
        <td>${i + 1}</td><td>${escapeHtml(c.MaHang || '')}</td><td>${escapeHtml(c.TenHang || '')}</td>
        <td>${escapeHtml(c.TenMau || '')}</td>
        <td style="text-align:right;">${fmtNumber(c.SoLuong)}</td><td>${escapeHtml(c.DonVi || '')}</td>
        <td style="text-align:right;">${fmtNumber(c.GiaBanLe)}</td>
        <td style="text-align:right;">${fmtNumber(c.PhanTramCKShop)}%</td>
        <td style="text-align:right;">${fmtNumber(c.GiaBan)}</td>
        <td style="text-align:right;"><b>${fmtNumber(c.ThanhTien)}</b></td></tr>`).join('')
        || '<tr><td colspan="10" class="empty-hint">Phiếu không có dòng hàng</td></tr>'}</tbody></table></div>
      <div style="margin-top:8px;font-size:13px;text-align:right;">
        Tiền hàng: <b>${fmtNumber(h.TongTienHang)}</b>
        ${so(h.TienCKNPP) ? ` · CK NPP (${fmtNumber(h.PhanTramCKNPP)}%): <b>−${fmtNumber(h.TienCKNPP)}</b>` : ''}
        ${so(h.TienVAT) ? ` · GTGT (${fmtNumber(h.PhanTramVAT)}%): <b>${fmtNumber(h.TienVAT)}</b>` : ''}
        <div style="font-size:15px;margin-top:4px;">Tổng thanh toán: <b style="color:#c0392b;">${fmtNumber(h.TongThanhToan)}</b> đ
          · Đã thu: <b>${fmtNumber(h.DaThu)}</b> đ</div>
      </div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnDongPBH">Đóng</button></div>`);
    m.querySelector('#btnDongPBH').addEventListener('click', () => { closeModal(); if (quayLai) quayLai(); });
  }

  /* ============================== 4. CÔNG NỢ NHÀ CUNG CẤP ============================== */
  async function renderCongNoNCC(perm) {
    const body = document.getElementById('cnBody');
    const res = await apiGet('/api/congno/congnoncc');
    const rows = res.data || [];
    if (res.canhBao) toast(res.canhBao, 'info');
    const t = rows.reduce((a, r) => ({
      TienVai: a.TienVai + Number(r.TienVai || 0), TienPhuKien: a.TienPhuKien + Number(r.TienPhuKien || 0),
      DieuChinh: a.DieuChinh + Number(r.DieuChinh || 0), PhaiTra: a.PhaiTra + Number(r.PhaiTra || 0),
      DaTra: a.DaTra + Number(r.DaTra || 0), ConNo: a.ConNo + Number(r.ConNo || 0)
    }), { TienVai: 0, TienPhuKien: 0, DieuChinh: 0, PhaiTra: 0, DaTra: 0, ConNo: 0 });
    body.innerHTML = `
      <div class="toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        ${searchBoxHtml()}
        <button class="btn small secondary" id="btnXuat" title="Bảng tổng hợp công nợ + sổ chi tiết của tất cả NCC + sheet phiếu chi">⬇️ Xuất tổng hợp (Excel)</button>
        <span class="empty-hint" style="padding:0;margin-left:auto;">Tổng còn phải trả: <b style="color:#c0392b;">${fmtNumber(t.ConNo)}</b> đ / ${rows.length} NCC</span>
      </div>
      <div class="empty-hint" style="text-align:left;">Phải trả tự tính từ <b>phiếu nhập vải</b> (KG × đơn giá từng cây) + <b>phiếu nhập phụ kiện</b> (SL × đơn giá) + điều chỉnh nhập tay (gia công, in thêu, nợ đầu kỳ). Đã trả = tổng <b>phiếu chi</b> có chọn NCC. Bấm tên NCC để xem sổ chi tiết.</div>
      <table><thead><tr><th>Nhà cung cấp</th><th>Tiền nhập vải</th><th>Tiền nhập phụ kiện</th><th>Điều chỉnh</th><th>Phải trả</th><th>Đã trả</th><th>Còn nợ</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><a href="javascript:void(0)" class="act-ct" data-id="${r.NCC_ID}"><b>${escapeHtml(r.TenNCC)}</b></a>
          <div style="font-size:11px;color:#5f6368;">${r.SoPhieuNhapVai || 0} PN vải · ${r.SoPhieuNhapPK || 0} PN phụ kiện · ${r.SoPhieuChi || 0} phiếu chi</div></td>
        <td style="text-align:right;">${fmtNumber(r.TienVai)}</td><td style="text-align:right;">${fmtNumber(r.TienPhuKien)}</td>
        <td style="text-align:right;">${r.DieuChinh ? fmtNumber(r.DieuChinh) : ''}</td>
        <td style="text-align:right;">${fmtNumber(r.PhaiTra)}</td><td style="text-align:right;">${fmtNumber(r.DaTra)}</td>
        <td style="text-align:right;"><b style="color:${Number(r.ConNo) > 0 ? '#c0392b' : '#137333'};">${fmtNumber(r.ConNo)}</b></td></tr>`).join('')
        || '<tr><td colspan="7" class="empty-hint">Chưa có nhà cung cấp nào</td></tr>'}
        ${rows.length ? `<tr data-tong style="font-weight:bold;background:#f1f3f4;"><td>TỔNG</td><td style="text-align:right;">${fmtNumber(t.TienVai)}</td>
          <td style="text-align:right;">${fmtNumber(t.TienPhuKien)}</td><td style="text-align:right;">${fmtNumber(t.DieuChinh)}</td>
          <td style="text-align:right;">${fmtNumber(t.PhaiTra)}</td><td style="text-align:right;">${fmtNumber(t.DaTra)}</td>
          <td style="text-align:right;">${fmtNumber(t.ConNo)}</td></tr>` : ''}</tbody></table>`;
    wireTableSearch(body);
    wireTableSort(body);   // v6.47
    body.querySelector('#btnXuat').addEventListener('click', () => taiFile('/api/congno/export?loai=ncc', 'cong_no_nha_cung_cap.xlsx'));
    body.querySelectorAll('.act-ct').forEach(a => a.addEventListener('click', () => soChiTietNCC(a.dataset.id)));
  }

  async function soChiTietNCC(nccId) {
    const d = (await apiGet('/api/congno/congnoncc/chitiet?nccId=' + encodeURIComponent(nccId))).data;
    const modal = openModal(`
      <h3>Sổ công nợ NCC: ${escapeHtml(d.tenNCC || '')}</h3>
      <div style="margin-bottom:8px;">Còn nợ: <b style="color:#c0392b;font-size:16px;">${fmtNumber(d.conNo)}</b> đ</div>
      <div style="max-height:60vh;overflow:auto;">
      <table><thead><tr><th>Ngày</th><th>Loại</th><th>Số phiếu / HĐ</th><th>Phát sinh</th><th>Đã trả</th><th>Còn nợ lũy kế</th><th>Diễn giải</th></tr></thead>
      ${/* v6.55: số phiếu bấm được — nhập vải / nhập phụ kiện / phiếu chi đều có màn chi tiết. */''}
      <tbody>${(d.rows || []).map(r => `<tr>
        <td>${fmtDate(r.Ngay)}</td><td>${escapeHtml(r.Loai)}</td><td>${oSoPhieu(r)}</td>
        <td style="text-align:right;">${Number(r.PhatSinh) ? fmtNumber(r.PhatSinh) : ''}</td>
        <td style="text-align:right;">${Number(r.ThanhToan) ? fmtNumber(r.ThanhToan) : ''}</td>
        <td style="text-align:right;"><b>${fmtNumber(r.LuyKe)}</b></td><td>${escapeHtml(r.DienGiai || '')}</td></tr>`).join('')
        || '<tr><td colspan="7" class="empty-hint">Chưa có phát sinh nào</td></tr>'}</tbody></table></div>
      ${khoiXuatSoHtml() /* v7.34 */}
      <div class="modal-actions">
        <button type="button" class="btn small secondary" id="btnXuatCT">⬇️ Xuất Excel sổ này</button>
        <button type="button" class="btn secondary" id="btnDong">Đóng</button></div>`);
    modal.querySelector('#btnDong').addEventListener('click', closeModal);
    modal.querySelector('#btnXuatCT').addEventListener('click', () =>
      taiFile('/api/congno/export?loai=ncc&nccId=' + encodeURIComponent(nccId), 'cong_no_ncc.xlsx'));
    noiDayXuatSo(modal, 'loai=ncc&nccId=' + encodeURIComponent(nccId), 'so_chi_tiet_cong_no_ncc.xlsx');   // v7.34
    noiDaySoPhieu(modal, () => soChiTietNCC(nccId));   // v6.55
  }

  /* ============================== 5. ĐIỀU CHỈNH CÔNG NỢ ============================== */
  async function renderDieuChinh(perm) {
    const body = document.getElementById('cnBody');
    const rows = (await apiGet('/api/congno/dieuchinh')).data || [];
    body.innerHTML = `
      <div class="toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        ${searchBoxHtml()}
        ${perm.canCreate ? '<button class="btn" id="btnAdd">+ Thêm điều chỉnh</button>' : ''}
      </div>
      <div class="empty-hint" style="text-align:left;">Dùng cho các khoản KHÔNG tự tính được: <b>nợ đầu kỳ</b>, tiền <b>gia công / in thêu</b>, giảm giá, bù trừ...
        Số tiền <b>dương = tăng nợ</b>, <b>âm = giảm nợ</b>.</div>
      <table><thead><tr><th>Ngày</th><th>Loại</th><th>Đối tượng</th><th>Số tiền</th><th>Diễn giải</th><th>Người tạo</th><th style="width:80px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${fmtDate(r.Ngay)}</td><td>${r.LoaiDoiTuong === 'KhachHang' ? 'Khách hàng' : 'Nhà cung cấp'}</td>
        ${/* v6.69: KHÁCH HÀNG phải hiện ĐÚNG CHUỖI TenDoiTuong đã lưu trên bút toán.
             Trước đây ưu tiên r.TenKhachHang (tên HIỆN TẠI trong danh mục, join theo KhachHangID) —
             trong khi màn Công nợ khách hàng lại gom theo TenDoiTuong (tên LÚC LẬP). Cùng một bút
             toán mà hai tab hiện hai tên khác nhau, đối chiếu là loạn ngay.
             NCC thì giữ TenNCC vì công nợ NCC gom theo NCC_ID, không theo tên. */''}
        <td>${escapeHtml(r.LoaiDoiTuong === 'KhachHang'
              ? (r.TenDoiTuong || r.TenKhachHang || '')
              : (r.TenNCC || r.TenDoiTuong || ''))}</td>
        <td style="text-align:right;"><b style="color:${Number(r.SoTien) < 0 ? '#137333' : '#c0392b'};">${fmtNumber(r.SoTien)}</b></td>
        <td>${escapeHtml(r.DienGiai || '')}</td><td>${escapeHtml(r.NguoiTao || '')}</td>
        ${/* v6.45: thêm nút Sửa — trước chỉ có Xóa, gõ sai 1 con số là phải xóa rồi nhập lại. */''}
        <td>${perm.canEdit ? `<button class="btn small secondary act-sua" data-id="${r.ID}">Sửa</button> ` : ''}${perm.canDelete ? `<button class="btn small danger act-xoa" data-id="${r.ID}">Xóa</button>` : ''}</td></tr>`).join('')
        || '<tr><td colspan="7" class="empty-hint">Chưa có điều chỉnh nào</td></tr>'}</tbody></table>`;
    wireTableSearch(body);
    const btn = body.querySelector('#btnAdd');
    if (btn) btn.addEventListener('click', () => formDieuChinh(perm));
    body.querySelectorAll('.act-sua').forEach(b => b.addEventListener('click', () => {
      const row = rows.find(x => String(x.ID) === b.dataset.id);
      if (row) formDieuChinh(perm, row);
    }));
    body.querySelectorAll('.act-xoa').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Xóa điều chỉnh này?')) return;
      try { await apiDelete('/api/congno/dieuchinh/' + b.dataset.id); toast('Đã xóa.', 'success'); renderDieuChinh(perm); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  /* v6.45: dùng CHUNG cho Thêm và Sửa — truyền `row` là vào chế độ sửa. Một form duy nhất để hai
     đường không trôi khỏi nhau như đã xảy ra với "Đặt hàng nhanh" (v6.44). */
  function formDieuChinh(perm, row) {
    const sua = !!row;
    const loaiHT = row ? row.LoaiDoiTuong : 'NhaCungCap';
    const modal = openModal(`
      <h3>${sua ? 'Sửa' : 'Thêm'} điều chỉnh công nợ</h3>
      <form id="fDC">
        <div class="form-grid">
          <div class="form-row"><label>Ngày *</label><input type="date" name="ngay" required value="${row && row.Ngay ? String(row.Ngay).slice(0, 10) : new Date().toISOString().slice(0, 10)}"></div>
          <div class="form-row"><label>Loại *</label>
            <select name="loaiDoiTuong" id="dcLoai">
              <option value="NhaCungCap" ${loaiHT === 'NhaCungCap' ? 'selected' : ''}>Nhà cung cấp (nợ phải trả)</option>
              <option value="KhachHang" ${loaiHT === 'KhachHang' ? 'selected' : ''}>Khách hàng (nợ phải thu)</option>
            </select></div>
          <div class="form-row" id="oNCC" style="${loaiHT === 'NhaCungCap' ? '' : 'display:none;'}"><label>Nhà cung cấp</label>
            <select name="nccId" id="dcNCC"><option value="">-- không chọn --</option>${opt(dm.ncc, 'NCC_ID', 'TenNCC', row ? (row.NCC_ID || '') : '')}</select></div>
          <div class="form-row" id="oKH" style="${loaiHT === 'KhachHang' ? '' : 'display:none;'}"><label>Khách hàng</label>
            <select name="khachHangId" id="dcKH"><option value="">-- không chọn --</option>${opt(dm.khachHang, 'KhachHangID', 'TenKhachHang', row ? (row.KhachHangID || '') : '')}</select></div>
          <div class="form-row"><label>Tên đối tượng *</label><input name="tenDoiTuong" id="dcTen" required value="${row ? escapeHtml(row.TenDoiTuong || '') : ''}">
            <div class="empty-hint" style="margin-top:2px;">Với khách hàng: phải gõ <b>đúng tên</b> như trên phiếu bán hàng (công nợ nhóm theo tên).</div></div>
          <div class="form-row"><label>Số tiền * (âm = giảm nợ)</label><input type="number" name="soTien" step="0.01" required placeholder="VD: 5000000 hoặc -200000" value="${row && row.SoTien != null ? escapeHtml(String(row.SoTien)) : ''}"></div>
        </div>
        <div class="form-row"><label>Diễn giải</label><input name="dienGiai" placeholder="VD: Nợ đầu kỳ 01/01, tiền gia công tháng 7..." value="${row ? escapeHtml(row.DienGiai || '') : ''}"></div>
        <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button><button type="submit" class="btn">${sua ? 'Lưu thay đổi' : 'Lưu'}</button></div>
      </form>`);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    const dongBo = () => {
      const l = modal.querySelector('#dcLoai').value;
      const oNCC = modal.querySelector('#oNCC'), oKH = modal.querySelector('#oKH');
      oNCC.style.display = l === 'NhaCungCap' ? '' : 'none';
      oKH.style.display = l === 'KhachHang' ? '' : 'none';
      if (l !== 'NhaCungCap') oNCC.querySelector('select').value = '';
      if (l !== 'KhachHang') oKH.querySelector('select').value = '';
    };
    modal.querySelector('#dcLoai').addEventListener('change', dongBo);
    modal.querySelector('#dcNCC').addEventListener('change', (e) => {
      const n = dm.ncc.find(x => String(x.NCC_ID) === e.target.value);
      if (n) modal.querySelector('#dcTen').value = n.TenNCC;
    });
    modal.querySelector('#dcKH').addEventListener('change', (e) => {
      const k = dm.khachHang.find(x => String(x.KhachHangID) === e.target.value);
      if (k) modal.querySelector('#dcTen').value = k.TenKhachHang;
    });
    modal.querySelector('#fDC').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        ngay: fd.get('ngay'), loaiDoiTuong: fd.get('loaiDoiTuong'),
        nccId: fd.get('nccId') || null, khachHangId: fd.get('khachHangId') || null,
        tenDoiTuong: fd.get('tenDoiTuong'), soTien: fd.get('soTien'), dienGiai: fd.get('dienGiai') || null
      };
      try {
        if (sua) await apiPut('/api/congno/dieuchinh/' + row.ID, payload);
        else await apiPost('/api/congno/dieuchinh', payload);
        closeModal(); toast(sua ? 'Đã cập nhật điều chỉnh.' : 'Đã lưu điều chỉnh.', 'success'); renderDieuChinh(perm);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ============================== 6. SỔ QUỸ (v6.24) ==============================
     Số dư = số dư đầu kỳ + tổng THU − tổng CHI, tách riêng quỹ TIỀN MẶT và TỪNG TÀI KHOẢN NGÂN HÀNG.
     Không có bảng sổ quỹ riêng: luôn tính lại từ phiếu thu/chi nên không bao giờ lệch với chứng từ. */
  async function renderSoQuy(perm) {
    const body = document.getElementById('cnBody');
    const res = await apiGet('/api/congno/soquy');
    const quy = res.data || [];
    if (res.canhBao) toast(res.canhBao, 'info');
    const tongDu = quy.reduce((s, q) => s + (Number(q.soDu) || 0), 0);
    const bieuTuong = q => q.loai === 'TienMat' ? '💵' : (q.loai === 'ChuaGan' ? '❓' : '🏦');
    body.innerHTML = `
      <div class="toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <b style="font-size:14px;">Tổng tiền đang có: <span style="color:#1a73e8;">${fmtNumber(tongDu)}</span> đ</b>
        <span class="empty-hint" style="padding:0;margin-left:auto;">Đầu kỳ tiền mặt khai ở <b>Danh mục → Cấu hình hệ thống → QUY_TIEN_MAT_DAU_KY</b>; đầu kỳ từng ngân hàng khai ở <b>Danh mục → Tài khoản ngân hàng</b>.</span>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
        ${quy.map(q => `<div class="act-quy" data-loai="${q.loai}" data-id="${q.taiKhoanNHID || ''}"
            style="flex:1;min-width:230px;cursor:pointer;border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:${q.loai === 'TienMat' ? '#fff8e1' : (q.loai === 'ChuaGan' ? '#fdecea' : '#e8f0fe')};">
          <div style="font-size:13px;">${bieuTuong(q)} <b>${escapeHtml(q.ten)}</b></div>
          ${q.soTaiKhoan ? `<div style="font-size:12px;color:#5f6368;">STK: ${escapeHtml(q.soTaiKhoan)}${q.chuTaiKhoan ? ' · ' + escapeHtml(q.chuTaiKhoan) : ''}</div>` : ''}
          <div style="font-size:20px;font-weight:bold;margin:4px 0;color:${Number(q.soDu) < 0 ? '#c0392b' : '#137333'};">${fmtNumber(q.soDu)} đ</div>
          <div style="font-size:12px;color:#5f6368;">Đầu kỳ ${fmtNumber(q.dauKy)} + thu ${fmtNumber(q.thu)} − chi ${fmtNumber(q.chi)}</div>
          <div style="font-size:11px;color:#5f6368;">${q.soPhieuThu} phiếu thu · ${q.soPhieuChi} phiếu chi — bấm để xem sổ</div>
        </div>`).join('') || '<div class="empty-hint">Chưa có quỹ nào.</div>'}
      </div>
      <table><thead><tr><th>Quỹ</th><th>Số tài khoản</th><th>Đầu kỳ</th><th>Tổng thu</th><th>Tổng chi</th><th>Số dư hiện tại</th></tr></thead>
      ${/* v6.81: BẢNG DƯỚI cũng bấm được. Trước đây chỉ mấy THẺ ở trên có class .act-quy; bảng này
           trông y hệt một danh sách bấm được nhưng lại trơ ra — người dùng bấm mãi không thấy gì.
           Dùng ĐÚNG class .act-quy + data-loai/data-id như thẻ, nên phần gắn sự kiện bên dưới
           (body.querySelectorAll('.act-quy')) tự nhận, không phải viết thêm đường xử lý thứ hai. */''}
      <tbody>${quy.map(q => `<tr class="act-quy dong-bam-duoc" data-loai="${q.loai}" data-id="${q.taiKhoanNHID || ''}" title="Bấm để xem sổ quỹ chi tiết">
        <td>${bieuTuong(q)} ${escapeHtml(q.ten)}</td><td>${escapeHtml(q.soTaiKhoan || '')}</td>
        <td style="text-align:right;">${fmtNumber(q.dauKy)}</td>
        <td style="text-align:right;color:#137333;">${fmtNumber(q.thu)}</td>
        <td style="text-align:right;color:#c0392b;">${fmtNumber(q.chi)}</td>
        <td style="text-align:right;"><b>${fmtNumber(q.soDu)}</b></td></tr>`).join('')}
        ${quy.length ? `<tr style="font-weight:bold;background:#f1f3f4;"><td colspan="5" style="text-align:right;">TỔNG TIỀN ĐANG CÓ</td>
          <td style="text-align:right;">${fmtNumber(tongDu)}</td></tr>` : ''}</tbody></table>`;
    body.querySelectorAll('.act-quy').forEach(el => el.addEventListener('click', () =>
      soChiTietQuy(el.dataset.loai, el.dataset.id).catch(err => toast(err.message, 'error'))));
  }

  async function soChiTietQuy(loai, id) {
    const d = (await apiGet(`/api/congno/soquy/chitiet?loai=${encodeURIComponent(loai)}${id ? '&taiKhoanNHID=' + id : ''}`)).data;
    const modal = openModal(`
      <h3>Sổ quỹ: ${escapeHtml(d.ten)}</h3>
      <div style="margin-bottom:8px;">Số dư đầu kỳ: <b>${fmtNumber(d.dauKy)}</b> đ &nbsp;·&nbsp; Số dư hiện tại:
        <b style="font-size:16px;color:${Number(d.soDu) < 0 ? '#c0392b' : '#137333'};">${fmtNumber(d.soDu)}</b> đ</div>
      <div style="max-height:60vh;overflow:auto;">
      <table><thead><tr><th>Ngày</th><th>Loại</th><th>Số phiếu</th><th>Đối tượng</th><th>Thu</th><th>Chi</th><th>Số dư</th><th>Diễn giải</th></tr></thead>
      <tbody><tr style="background:#f1f3f4;"><td colspan="6"><i>Số dư đầu kỳ</i></td><td style="text-align:right;"><b>${fmtNumber(d.dauKy)}</b></td><td></td></tr>
        ${(d.rows || []).map(r => `<tr>
        ${/* v6.79: số phiếu BẤM ĐƯỢC — dùng chung oSoPhieu() với sổ công nợ, để hai màn không có
             hai kiểu hiển thị/mở phiếu khác nhau. */''}
        <td>${fmtDate(r.Ngay)}</td><td>${escapeHtml(r.Loai)}</td><td>${oSoPhieu(r)}</td>
        <td>${escapeHtml(r.DoiTuong || '')}</td>
        <td style="text-align:right;color:#137333;">${Number(r.Thu) ? fmtNumber(r.Thu) : ''}</td>
        <td style="text-align:right;color:#c0392b;">${Number(r.Chi) ? fmtNumber(r.Chi) : ''}</td>
        <td style="text-align:right;"><b>${fmtNumber(r.SoDu)}</b></td><td>${escapeHtml(r.DienGiai || '')}</td></tr>`).join('')
        || '<tr><td colspan="8" class="empty-hint">Chưa có phiếu thu/chi nào cho quỹ này</td></tr>'}</tbody></table></div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnDong">Đóng</button></div>`);
    modal.querySelector('#btnDong').addEventListener('click', closeModal);
    /* v6.79: bấm số phiếu -> mở chi tiết phiếu thu/chi ĐÈ LÊN sổ quỹ. Đóng nó thì QUAY VỀ sổ quỹ,
       không phải mở lại từ đầu — nhờ ngăn xếp modal của v5.97 (openModal không đóng cái trước nữa).
       KHÔNG truyền `quayLai`: truyền vào là nó tự đóng rồi mở lại sổ quỹ, tức mất chỗ đang cuộn và
       nháy màn hình một cái. Để ngăn xếp tự lo thì sổ quỹ vẫn nằm nguyên bên dưới. */
    noiDaySoPhieu(modal);
  }

  /* v7.44: MỞ RA cho module khác gọi lại ĐÚNG popup sổ chi tiết này (Dashboard kinh doanh bấm tên
     khách). Một nghiệp vụ = một form: không dựng lại bảng sổ ở dashboard, cũng không nhảy sang tab
     "Công nợ khách hàng" rồi để người dùng tự tìm lại tên khách.
     Chuỗi hàm này (soChiTietKH -> oSoPhieu/noiDaySoPhieu -> xemChungTu) KHÔNG dùng `dm`, `container`
     hay `currentUser`, nên gọi được khi render() của phân hệ Công nợ chưa từng chạy. Thêm gì vào
     popup mà cần `dm` thì phải nạp danh mục trước, kẻo dashboard gọi ra popup rỗng. */
  return { render, getTabs, soChiTietKH };
})();
