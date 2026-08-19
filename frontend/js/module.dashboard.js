/* ================================================================================================
   DASHBOARD KINH DOANH  (v6.70.1)
   Hiện NGAY khi đăng nhập cho ai được cấp quyền xem module DASHBOARD (app.js xếp phân hệ này lên
   đầu MODULES nên nó là phân hệ mặc định; ai không có quyền thì vào trang cũ như trước).

   Nội dung: doanh thu + tình hình công nợ của NHỮNG KHÁCH ĐƯỢC CHỌN theo dõi.

   DANH SÁCH KHÁCH THEO DÕI (v6.68) lưu theo TÀI KHOẢN ở máy chủ (bảng CauHinhNguoiDung) — chọn một
   lần là xong, đăng nhập ở máy nào cũng giữ nguyên. Chưa chọn ai = xem TẤT CẢ khách.

   ⚠️ Số "Còn nợ" ở đây PHẢI khớp màn "Công nợ khách hàng". Backend dùng đúng một công thức
   (routes/dashboard.js) — đừng tính lại ở client, hai bản tính rồi sẽ trôi khỏi nhau.
   ================================================================================================ */
(function () {
  const KHOA_LUU = 'dashboard_khach_theo_doi';
  let container = null, currentUser = null, dsKhachTatCa = [], soLieu = null;
  let dsTheoDoi = [];   // nạp 1 lần khi mở màn, sau đó chỉ đổi khi người dùng bấm Áp dụng

  function getTabs() { return [{ key: 'kinhdoanh', label: 'Kinh doanh' }]; }

  function khachTheoDoi() { return dsTheoDoi; }

  /* v6.68: LƯU THEO TÀI KHOẢN (bảng CauHinhNguoiDung) — chọn 1 lần là xong, đăng nhập máy nào cũng
     thấy. localStorage chỉ còn là bản dự phòng cho trường hợp CHƯA chạy migration_v678, và cũng để
     lấy lại danh sách cũ mà người dùng đã chọn ở v6.67. */
  async function napKhachTheoDoi() {
    let tuMay = [];
    try { tuMay = locTrung(JSON.parse(localStorage.getItem(KHOA_LUU) || '[]')); } catch (e) { tuMay = []; }
    try {
      const kq = await apiGet('/api/dashboard/cauhinh/' + KHOA_LUU);
      if (kq.chuaCoBang) { dsTheoDoi = locTrung(tuMay); return; }
      if (Array.isArray(kq.data)) {
        /* Dọn dữ liệu đã bị nhân lên do lỗi v6.68 (tìm theo document trúng cả modal cũ còn trong DOM).
           Sạch xong thì GHI ĐÈ lại lên máy chủ luôn, để lần sau không phải dọn nữa. */
        const sach = locTrung(kq.data);
        dsTheoDoi = sach;
        if (sach.length !== kq.data.length) await luuKhachTheoDoi(sach);
        return;
      }
      /* Máy chủ chưa có gì mà máy này còn danh sách cũ (v6.67) -> ĐẨY LÊN luôn, để lần sau vào từ
         máy khác cũng thấy. Không làm bước này thì người dùng tưởng mất lựa chọn đã chọn hôm trước. */
      dsTheoDoi = tuMay;
      if (tuMay.length) await luuKhachTheoDoi(tuMay);
    } catch (e) { dsTheoDoi = tuMay; }
  }
  const locTrung = (ds) => [...new Set((Array.isArray(ds) ? ds : []).map(x => String(x || '').trim()).filter(Boolean))];
  async function luuKhachTheoDoi(ds) {
    dsTheoDoi = locTrung(ds);
    ds = dsTheoDoi;
    try { localStorage.setItem(KHOA_LUU, JSON.stringify(ds)); } catch (e) { /* chế độ riêng tư chặn */ }
    try { await apiPost('/api/dashboard/cauhinh/' + KHOA_LUU, { giaTri: ds }); }
    catch (e) { toast('Chưa lưu được lựa chọn lên máy chủ (' + e.message + ') — tạm nhớ trên máy này.', 'error'); }
  }

  // Mặc định: từ đầu tháng đến hôm nay
  function kyMacDinh() {
    const n = new Date();
    const dau = new Date(n.getFullYear(), n.getMonth(), 1);
    const iso = (d) => d.toISOString().slice(0, 10);
    return { tu: iso(dau), den: iso(n) };
  }

  async function render(el, user) {
    container = el; currentUser = user;
    const k = kyMacDinh();
    container.innerHTML = `
      <div class="toolbar" style="gap:8px;flex-wrap:wrap;align-items:flex-end;">
        <div><label>Từ ngày</label><input type="date" id="dbTu" value="${k.tu}"></div>
        <div><label>Đến ngày</label><input type="date" id="dbDen" value="${k.den}"></div>
        <button class="btn secondary" id="dbLoc">Xem</button>
        <button class="btn secondary" id="dbKy">Tháng này</button>
        <button class="btn secondary" id="dbKyNam">Năm nay</button>
        <div style="flex:1"></div>
        <button class="btn" id="dbChonKhach">👥 Chọn khách theo dõi</button>
      </div>
      <div id="dbBody"><div class="empty-hint">Đang tải...</div></div>`;
    document.getElementById('dbLoc').onclick = taiSoLieu;
    document.getElementById('dbChonKhach').onclick = moChonKhach;
    document.getElementById('dbKy').onclick = () => { const x = kyMacDinh(); dat(x.tu, x.den); };
    document.getElementById('dbKyNam').onclick = () => {
      const n = new Date();
      dat(`${n.getFullYear()}-01-01`, n.toISOString().slice(0, 10));
    };
    function dat(tu, den) {
      document.getElementById('dbTu').value = tu;
      document.getElementById('dbDen').value = den;
      taiSoLieu();
    }
    // Nạp danh sách khách theo dõi TRƯỚC khi gọi số liệu, không thì lần vẽ đầu ra "tất cả khách".
    await napKhachTheoDoi();
    dsKhachTatCa = (await apiGet('/api/dashboard/khach')).data || [];
    await taiSoLieu();
  }

  async function taiSoLieu() {
    const body = document.getElementById('dbBody');
    if (!body) return;
    body.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    const p = new URLSearchParams();
    p.set('tuNgay', document.getElementById('dbTu').value);
    p.set('denNgay', document.getElementById('dbDen').value);
    const ds = khachTheoDoi();
    if (ds.length) p.set('khach', ds.join('|'));
    const kq = await apiGet('/api/dashboard/kinhdoanh?' + p.toString());
    if (!kq.success) { body.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(kq.message || '')}</div>`; return; }
    soLieu = kq.data;
    veBody();
  }

  function the(nhan, gt, mau, phu) {
    return `<div style="flex:1;min-width:170px;border:1px solid #cfd8dc;border-radius:6px;padding:10px 12px;background:#fff;">
      <div style="font-size:12px;color:#5f6368;">${nhan}</div>
      <div style="font-size:22px;font-weight:700;color:${mau};line-height:1.3;">${gt}</div>
      ${phu ? `<div style="font-size:12px;color:#78909c;">${phu}</div>` : ''}</div>`;
  }

  function veBody() {
    const t = soLieu.tong, rows = soLieu.rows || [];
    const body = document.getElementById('dbBody');
    body.innerHTML = `
      ${soLieu.canhBao ? `<div class="empty-hint" style="color:#e65100;">${escapeHtml(soLieu.canhBao)}</div>` : ''}
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        ${the('Doanh thu trong kỳ', fmtTien(t.doanhThu) + ' đ', '#1565c0', `${rows.reduce((s, r) => s + r.SoPhieu, 0)} phiếu bán`)}
        ${the('Hàng khách trả', fmtTien(t.traLai) + ' đ', '#e65100', 'trừ vào doanh thu')}
        ${the('Doanh thu thuần', fmtTien(t.doanhThuThuan) + ' đ', '#2e7d32', 'bán − trả lại')}
        ${the('Đã thu trong kỳ', fmtTien(t.daThuKy) + ' đ', '#00838f', '')}
        ${the('CÒN NỢ (lũy kế)', fmtTien(t.conNo) + ' đ', '#c62828', 'tính đến hiện tại, không theo kỳ')}
        ${the('Số khách', fmtNumber(t.soKhach), '#455a64', '')}
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
        ${bieuDoTron(rows, 'DoanhThuThuan', 'Tỷ lệ doanh thu thuần theo khách')}
        ${bieuDoTron(rows, 'ConNo', 'Tỷ lệ công nợ theo khách')}
      </div>
      ${bieuDoThang()}
      ${bangKhach(rows)}`;
    body.querySelectorAll('.db-congno').forEach(a => a.onclick = (e) => {
      e.preventDefault();
      /* Bấm tên khách -> mở thẳng SỔ CHI TIẾT công nợ của khách đó ở phân hệ Công nợ.
         Chỉ mở khi người dùng CÓ quyền vào đó, không thì báo rõ thay vì đưa vào màn trắng. */
      const coQuyen = currentUser.isAdmin || (currentUser.permissions.CONGNO && currentUser.permissions.CONGNO.canView);
      if (!coQuyen) return toast('Tài khoản của bạn chưa được cấp quyền xem phân hệ Công nợ.', 'error');
      location.hash = '#CONGNO/congnokh';
      location.reload();
    });
  }

  /* ================================================================================================
     v6.68: BIỂU ĐỒ TRÒN (donut) TỶ LỆ % THEO KHÁCH.
     Đây cũng là chỗ THAY dòng chữ "đang theo dõi N khách" — nhìn vòng tròn là biết đang theo dõi ai
     và mỗi người chiếm bao nhiêu, không cần đọc danh sách tên.

     Vẽ bằng SVG thuần (stroke-dasharray trên đường tròn), KHÔNG kéo thư viện từ CDN — máy trong
     xưởng nhiều khi không ra được internet, kéo CDN là dashboard trắng bảng.
     Chỉ tính phần DƯƠNG: khách trả lại nhiều hơn mua (doanh thu âm) hay đã trả thừa (nợ âm) thì
     không có "phần trăm của miếng bánh" nào cả — cộng số âm vào tổng sẽ ra tỷ lệ vô nghĩa (>100%).
     ================================================================================================ */
  const MAU_TRON = ['#1565c0', '#2e7d32', '#e65100', '#6a1b9a', '#00838f', '#c62828',
                    '#f9a825', '#4527a0', '#00695c', '#ad1457', '#37474f', '#558b2f'];
  /* v6.70: hết 12 màu khai sẵn thì SINH THÊM theo vòng màu, để chọn bao nhiêu khách cũng đủ màu.
     Bước 137° (gần góc vàng) nên hai màu cạnh nhau luôn khác hẳn, không ra một dải xanh na ná. */
  function mauThu(i) {
    if (i < MAU_TRON.length) return MAU_TRON[i];
    const k = i - MAU_TRON.length;
    return `hsl(${(k * 137) % 360}, 62%, ${k % 2 ? 38 : 52}%)`;
  }
  function bieuDoTron(rows, cot, tieuDe) {
    const duong = rows.filter(r => Number(r[cot]) > 0)
      .map(r => ({ ten: r.TenKhach, gt: Number(r[cot]) }))
      .sort((a, b) => b.gt - a.gt);
    const tong = duong.reduce((s, x) => s + x.gt, 0);
    if (!tong) {
      return `<div style="flex:1;min-width:300px;border:1px solid #cfd8dc;border-radius:6px;padding:12px;background:#fff;">
        <b>${tieuDe}</b><div class="empty-hint">Chưa có số liệu để chia tỷ lệ.</div></div>`;
    }
    /* v6.70: ĐANG CHỌN KHÁCH THEO DÕI thì hiện ĐỦ, không gộp đuôi — biểu đồ chính là chỗ thể hiện
       "đang theo dõi những ai", gộp bớt đi là mất đúng thứ người dùng muốn nhìn.
       Chỉ khi xem TẤT CẢ khách (chưa chọn ai) mới gộp đuôi, vì lúc đó có thể hàng trăm khách và
       vòng tròn sẽ thành vụn màu vô nghĩa. */
    const dangChonKhach = khachTheoDoi().length > 0;
    const TOI_DA = 12;
    let mieng = duong;
    if (!dangChonKhach && duong.length > TOI_DA) {
      mieng = duong.slice(0, TOI_DA);
      const con = duong.slice(TOI_DA);
      mieng = mieng.concat([{ ten: `${con.length} khách khác`, gt: con.reduce((s, x) => s + x.gt, 0) }]);
    }

    const R = 60, C = 2 * Math.PI * R;   // bán kính & chu vi đường tròn
    let moc = 0;
    const vong = mieng.map((m, i) => {
      const dai = m.gt / tong * C;
      const el = `<circle cx="80" cy="80" r="${R}" fill="none" stroke="${mauThu(i)}"
        stroke-width="30" stroke-dasharray="${dai.toFixed(2)} ${(C - dai).toFixed(2)}"
        stroke-dashoffset="${(-moc).toFixed(2)}" transform="rotate(-90 80 80)"><title>${escapeHtml(m.ten)}: ${fmtTien(m.gt)} đ (${(m.gt / tong * 100).toFixed(1)}%)</title></circle>`;
      moc += dai;
      return el;
    }).join('');

    return `<div style="flex:1;min-width:300px;border:1px solid #cfd8dc;border-radius:6px;padding:12px;background:#fff;">
      <b>${tieuDe}</b>
      <div style="display:flex;gap:14px;align-items:center;margin-top:8px;flex-wrap:wrap;">
        <svg width="160" height="160" viewBox="0 0 160 160" style="flex:0 0 auto;">
          ${vong}
          <text x="80" y="76" text-anchor="middle" style="font-size:11px;fill:#5f6368;">${mieng.length} khách</text>
          <text x="80" y="92" text-anchor="middle" style="font-size:12px;font-weight:700;fill:#263238;">${fmtNumber(Math.round(tong / 1000000))} tr</text>
        </svg>
        <div style="flex:1;min-width:170px;font-size:12.5px;max-height:200px;overflow:auto;">
          ${mieng.map((m, i) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
            <span style="width:11px;height:11px;border-radius:2px;background:${mauThu(i)};flex:0 0 auto;"></span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(m.ten)}">${escapeHtml(m.ten)}</span>
            <b>${(m.gt / tong * 100).toFixed(1)}%</b>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
  }

  /* Biểu đồ cột doanh thu thuần 12 tháng — vẽ bằng div, KHÔNG kéo thư viện ngoài:
     máy trong xưởng nhiều khi không ra được internet, kéo CDN là dashboard trắng bảng. */
  function bieuDoThang() {
    const ds = (soLieu.theoThang || []).slice(-12);
    if (!ds.length) return '';
    const max = Math.max(...ds.map(x => Math.abs(x.DoanhThuThuan)), 1);
    return `
      <div style="border:1px solid #cfd8dc;border-radius:6px;padding:12px;background:#fff;margin-bottom:12px;">
        <b>Doanh thu thuần 12 tháng gần nhất</b>
        <div style="display:flex;align-items:flex-end;gap:6px;height:170px;margin-top:12px;">
          ${ds.map(x => {
            const cao = Math.round(Math.abs(x.DoanhThuThuan) / max * 130);
            const am = x.DoanhThuThuan < 0;
            return `<div style="flex:1;text-align:center;" title="${fmtTien(x.DoanhThuThuan)} đ">
              <div style="font-size:10px;color:#5f6368;">${fmtNumber(Math.round(x.DoanhThuThuan / 1000000))}tr</div>
              <div style="height:${cao}px;background:${am ? '#ef9a9a' : '#64b5f6'};border-radius:3px 3px 0 0;"></div>
              <div style="font-size:11px;color:#5f6368;">T${x.Thang}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function bangKhach(rows) {
    if (!rows.length) return '<div class="empty-hint">Chưa có phát sinh nào trong kỳ đã chọn.</div>';
    return `
      <div class="table-wrap">
      <table class="data-table phieu-ke"><thead><tr>
        <th style="width:50px;">STT</th><th>Khách hàng</th>
        <th class="num">Số phiếu</th><th class="num">Doanh thu</th><th class="num">Hàng trả</th>
        <th class="num">Doanh thu thuần</th><th class="num">Đã thu trong kỳ</th><th class="num">CÒN NỢ</th>
      </tr></thead><tbody>
        ${rows.map((r, i) => `<tr>
          <td>${i + 1}</td>
          <td><a href="#" class="db-congno"><b>${escapeHtml(r.TenKhach)}</b></a></td>
          <td class="num">${fmtNumber(r.SoPhieu)}</td>
          <td class="num">${fmtTien(r.DoanhThu)}</td>
          <td class="num">${r.TraLai ? fmtTien(r.TraLai) : ''}</td>
          <td class="num">${fmtTien(r.DoanhThuThuan)}</td>
          <td class="num">${fmtTien(r.DaThuKy)}</td>
          <td class="num" style="color:${r.ConNo > 0 ? '#c62828' : '#2e7d32'};font-weight:700;">${fmtTien(r.ConNo)}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr style="font-weight:700;background:#f4f6f8;">
        <td colspan="3">TỔNG CỘNG</td>
        <td class="num">${fmtTien(soLieu.tong.doanhThu)}</td>
        <td class="num">${fmtTien(soLieu.tong.traLai)}</td>
        <td class="num">${fmtTien(soLieu.tong.doanhThuThuan)}</td>
        <td class="num">${fmtTien(soLieu.tong.daThuKy)}</td>
        <td class="num">${fmtTien(soLieu.tong.conNo)}</td>
      </tr></tfoot></table></div>`;
  }

  function moChonKhach() {
    const dangChon = new Set(khachTheoDoi());
    /* ⚠️ v6.69.1 — PHẢI hứng phần tử modal do openModal() trả về và TÌM TRONG NÓ, tuyệt đối không
       dùng document.querySelectorAll. Từ v5.97 modal có NGĂN XẾP: mở cái mới KHÔNG gỡ cái cũ khỏi
       DOM. Tìm theo `document` sẽ quét trúng cả những lần mở trước còn nằm lại -> mở n lần thì mỗi
       khách bị đếm n lần, danh sách nhân lên 2-3 lần đúng như lỗi đã gặp. */
    const modal = openModal(`
      <div class="modal-head"><h3>Chọn khách hàng hiển thị trên dashboard</h3></div>
      <div class="modal-body">
        <input type="text" id="dbTim" placeholder="Gõ để tìm khách..." style="width:100%;margin-bottom:8px;">
        <div class="empty-hint">Không tích khách nào = xem tất cả. Nút <b>Chọn hết / Bỏ chọn hết</b> chỉ tác động lên các dòng đang hiện sau khi gõ tìm. Lựa chọn lưu theo <b>tài khoản của anh/chị</b> — chọn một lần, đăng nhập ở máy nào cũng giữ nguyên.</div>
        <div class="table-wrap" style="max-height:400px;overflow:auto;">
        <table class="data-table phieu-ke"><thead><tr>
          <th style="width:40px;"></th><th>Khách hàng</th><th class="num">Số phiếu</th>
          <th class="num">Tổng đã mua</th><th>Mua lần cuối</th>
        </tr></thead><tbody>
          ${dsKhachTatCa.map(k => `<tr data-tim="${escapeHtml(String(k.TenKhach).toLowerCase())}">
            <td><input type="checkbox" class="db-tick" value="${escapeHtml(k.TenKhach)}" ${dangChon.has(k.TenKhach) ? 'checked' : ''}></td>
            <td>${escapeHtml(k.TenKhach)}</td>
            <td class="num">${fmtNumber(k.SoPhieu)}</td>
            <td class="num">${fmtTien(k.TongMua)}</td>
            <td>${fmtDate(k.LanCuoi)}</td>
          </tr>`).join('')}
        </tbody></table></div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" id="dbcHuy">Hủy</button>
        ${/* v6.70.1: thêm "Chọn hết" cho cân với "Bỏ chọn hết".
             CẢ HAI chỉ tác động lên các dòng ĐANG HIỆN (sau khi gõ tìm) — gõ tìm rồi bấm Chọn hết
             mà nó tích luôn cả những khách đang bị ẩn thì người dùng không hề thấy mình vừa chọn gì.
             Không gõ tìm thì "đang hiện" = tất cả, nên vẫn đúng nghĩa thông thường. */''}
        <button class="btn secondary" id="dbcChonHet">Chọn hết</button>
        <button class="btn secondary" id="dbcBoHet">Bỏ chọn hết</button>
        <button class="btn" id="dbcLuu">Áp dụng</button>
      </div>`, { rong: true });
    const tim = modal.querySelector('#dbTim');
    tim.oninput = () => {
      const q = tim.value.trim().toLowerCase();
      modal.querySelectorAll('tr[data-tim]').forEach(tr => {
        tr.style.display = !q || tr.dataset.tim.includes(q) ? '' : 'none';
      });
    };
    modal.querySelector('#dbcHuy').onclick = () => closeModal();
    // Chỉ lấy dòng ĐANG HIỆN: dòng bị ô tìm ẩn đi có style.display = 'none'.
    const oDangHien = () => Array.from(modal.querySelectorAll('tr[data-tim]'))
      .filter(tr => tr.style.display !== 'none')
      .map(tr => tr.querySelector('.db-tick')).filter(Boolean);
    modal.querySelector('#dbcChonHet').onclick = () => oDangHien().forEach(cb => { cb.checked = true; });
    modal.querySelector('#dbcBoHet').onclick = () => oDangHien().forEach(cb => { cb.checked = false; });
    modal.querySelector('#dbcLuu').onclick = async () => {
      // Set(): lưới an toàn thứ hai — dù có lọt trùng ở đâu thì mỗi khách vẫn chỉ còn đúng 1 lần.
      const chon = [...new Set(Array.from(modal.querySelectorAll('.db-tick:checked')).map(cb => cb.value))];
      await luuKhachTheoDoi(chon);
      closeModal();
      taiSoLieu();
    };
  }

  window.ModuleDashboard = { getTabs, render };
})();
