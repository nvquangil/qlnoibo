/* ================================================================================================
   PHÂN HỆ SAO LƯU CSDL                                                                      v9.39
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-11-10: *"Phần backup tôi chưa thấy nút. Làm riêng hẳn 1 chức năng backup"*.

   v9.37 đặt màn này thành một TAB nằm trong "Quản lý User" để khỏi phải thêm phân hệ. Sai hướng:
   sao lưu không phải việc con của quản lý tài khoản, và chôn nó vào đó thì không ai tìm ra — đúng
   như Nguyen vừa phản ánh. Nay là PHÂN HỆ RIÊNG trên thanh menu, có biểu tượng riêng.

   🔴 CHỈ ADMIN THẤY, và KHÔNG cần migration:
   app.js lọc menu bằng `currentUser.isAdmin || permissions[code].canView`. Phân hệ này cố ý KHÔNG
   có dòng trong bảng `Modules`, nên không ai được cấp quyền xem ⇒ chỉ Admin thấy. Đó là ý đồ: file
   .bak chứa TOÀN BỘ dữ liệu công ty (lương từng người, giá vốn, công nợ, giá bán từng khách) —
   đây không phải thứ để phân quyền lắt nhắt. Backend (routes/saoluu.js) chặn độc lập bằng `isAdmin`;
   màn hình ẩn mà máy chủ hở thì vẫn thủng.
   ================================================================================================ */
window.ModuleSaoLuu = (function () {
  let container = null;

  function getTabs() {
    return [{ key: 'saoluu', label: 'Sao lưu & khôi phục' }];
  }

  /* Người dùng chọn giờ bằng ô <input type="time">, hệ thống lưu kiểu cron 5 trường.
     Chỉ đổi qua lại cho lịch CHẠY HẰNG NGÀY — đúng phạm vi đã chốt ("mỗi ngày 1 lần"). Cron đang
     mang biểu thức khác (ai đó khai tay một lịch chạy nhiều lần trong ngày) thì ô giờ hiện RỖNG chứ
     KHÔNG đoán bừa, và chỉ bị ghi đè khi người dùng thực sự chọn giờ mới.
     (Cố ý KHÔNG viết ví dụ biểu thức cron vào đây: ký tự sao-gạch-chéo sẽ ĐÓNG SỚM khối comment
      này — lỗi đã làm vỡ v8.61.) */
  function gioTuCron(c) {
    const p = String(c || '').trim().split(/\s+/);
    if (p.length !== 5 || !/^\d{1,2}$/.test(p[0]) || !/^\d{1,2}$/.test(p[1])) return '';
    if (p[2] !== '*' || p[3] !== '*' || p[4] !== '*') return '';
    return String(p[1]).padStart(2, '0') + ':' + String(p[0]).padStart(2, '0');
  }
  function cronTuGio(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return null;
    return `${Number(m[2])} ${Number(m[1])} * * *`;
  }

  async function render(el, user) {
    container = el;
    if (!user || !user.isAdmin) {
      container.innerHTML = '<div class="card"><h3>Sao lưu</h3>'
        + '<p class="empty-hint">Chỉ quản trị viên xem được mục này — file sao lưu chứa toàn bộ dữ liệu công ty.</p></div>';
      return;
    }
    await veMan();
  }

  async function veMan() {
    container.innerHTML = '<div class="empty-hint">Đang đọc trạng thái sao lưu…</div>';
    let d;
    try {
      d = (await apiGet('/api/saoluu/trangthai')).data;
    } catch (err) {
      container.innerHTML = `<div class="card"><h3>Sao lưu CSDL</h3>
        <p style="color:#c0392b;">Không đọc được trạng thái: ${escapeHtml(err.message)}</p></div>`;
      return;
    }
    const mb = (n) => (Number(n) / 1024 / 1024).toFixed(1) + ' MB';
    const gio = (v) => v ? new Date(v).toLocaleString('vi-VN') : '—';
    const ch = d.cauHinh || {};
    const m = d.moiNhat;
    const soGio = m ? (Date.now() - new Date(m.luc).getTime()) / 3600000 : null;
    const quaHan = !m || soGio > 36;

    container.innerHTML = `
      <div class="card">
        <h3 style="margin-top:0;">💾 Sao lưu cơ sở dữ liệu</h3>

        ${d.canhBao.map(c => `<div style="background:#fdecea;border:1px solid #f5c6cb;border-radius:6px;padding:10px;margin-bottom:8px;color:#8a1c1c;">${escapeHtml(c)}</div>`).join('')}

        ${/* Con số quan trọng nhất của cả màn — để to, đổi màu theo tình trạng. Sao lưu chạy ngầm mà
             chết 3 tháng không ai biết là kịch bản hay gặp nhất; màn này trả lời đúng một câu hỏi:
             "bản dùng được gần nhất là bao giờ?" */''}
        <div style="border:2px solid ${quaHan ? '#c0392b' : '#137333'};border-radius:8px;padding:14px;margin-bottom:12px;background:${quaHan ? '#fff5f5' : '#f3fbf5'};">
          <div style="font-size:13px;color:#5f6368;">Bản sao lưu dùng được gần nhất</div>
          <div style="font-size:22px;font-weight:700;color:${quaHan ? '#c0392b' : '#137333'};">
            ${m ? gio(m.luc) : 'CHƯA CÓ BẢN NÀO'}
          </div>
          ${m ? `<div style="font-size:13px;color:#5f6368;">${escapeHtml(m.ten)} · ${mb(m.dungLuong)}
                 · ${soGio < 24 ? Math.round(soGio) + ' giờ trước' : Math.floor(soGio / 24) + ' ngày trước'}</div>` : ''}
        </div>

        ${/* v9.41: câu trả lời cho "hỏng NGAY BÂY GIỜ thì mất bao nhiêu dữ liệu" — con số đáng hỏi
             nhất của cả màn hình, và là lý do thật để bật sao lưu log. */''}
        ${(() => {
          const do_ = (n, t) => `<div style="border:1px solid ${n ? '#f5c6cb' : '#cfe3d4'};border-radius:8px;
            padding:10px;margin-bottom:12px;background:${n ? '#fff5f5' : '#f7fbf8'};">${t}</div>`;
          /* 🔴 KHÔNG được tính từ bản log khi CHƯA CÓ bản đầy đủ nào. Chuỗi log phải bắt đầu từ một
             bản đầy đủ — có .trn mà không có .bak thì khôi phục được ĐÚNG BẰNG KHÔNG. Bản đầu chỉ
             hỏi "có .trn không", nên sau khi đổi thư mục lưu, màn hình hiện "mất nhiều nhất 20 phút"
             màu xanh trong khi sự thật là mất 100%. Nói lạc quan hơn sự thật là kiểu sai tệ nhất mà
             một màn hình sao lưu có thể mắc. */
          const mocFull = m ? new Date(m.luc).getTime() : null;
          if (mocFull == null) {
            return do_(true, '<b style="color:#c0392b;">KHÔNG KHÔI PHỤC ĐƯỢC</b>'
              + '<span style="font-size:13px;color:#5f6368;"> — chưa có bản sao lưu đầy đủ nào trong thư mục này.'
              + (d.soBanLog ? ' Các file .trn đang có là vô dụng nếu không có một bản .bak đi trước.' : '')
              + ' Bấm "Sao lưu ngay".</span>');
          }
          const mocLog = ch.batLog && d.moiNhatLog ? new Date(d.moiNhatLog.luc).getTime() : null;
          const dungLog = mocLog != null && mocLog > mocFull;
          const h = (Date.now() - (dungLog ? mocLog : mocFull)) / 3600000;
          /* Ngưỡng theo CHU KỲ THẬT, không ghim cứng 6 giờ — chọn chu kỳ 4 giờ thì 6 giờ là quá lỏng. */
          const chuKy = { '*/30 * * * *': 0.5, '0 * * * *': 1, '0 */2 * * *': 2, '0 */4 * * *': 4 }[ch.gioChayLog] || 1;
          const xau = h > (dungLog ? chuKy * 3 : 36);
          /* Thư mục sao lưu nằm CÙNG ổ với file CSDL ⇒ hỏng ổ là mất cả hai ⇒ con số dưới đây chỉ
             đúng khi ổ đó còn sống. Nói ra, không thì con số to nhất màn hình mâu thuẫn với cảnh
             báo nằm ngay phía trên nó. */
          const kyO = String(d.thuMuc || '').match(/^([A-Za-z]):/);
          const cungO = !!(kyO && d.mayChu && (d.mayChu.oCuaCSDL || []).indexOf(kyO[1].toUpperCase()) !== -1);
          return do_(xau,
            '<span style="font-size:13px;color:#5f6368;">Hỏng ngay bây giờ thì mất nhiều nhất</span>'
            + `<b style="font-size:17px;color:${xau ? '#c0392b' : '#137333'};margin-left:8px;">`
            + (h < 1 ? Math.max(1, Math.round(h * 60)) + ' phút'
                     : (h < 48 ? Math.round(h) + ' giờ' : Math.floor(h / 24) + ' ngày')) + '</b>'
            + '<span style="font-size:13px;color:#5f6368;"> dữ liệu — tính từ '
            + (dungLog ? 'bản sao lưu log gần nhất.'
                       : 'bản sao lưu đầy đủ gần nhất. Bật <b>Sao lưu log</b> ở dưới để giảm xuống còn một chu kỳ log.')
            + (cungO && !d.thuMucPhu
                ? ` <b style="color:#c0392b;">Và chỉ đúng nếu ổ ${kyO[1].toUpperCase()}: còn sống</b> — `
                  + 'ổ đó đang chứa cả file CSDL lẫn bản sao lưu; hỏng ổ là mất tất cả.'
                : '')
            + '</span>');
        })()}

        <div class="modal-actions" style="justify-content:flex-start;margin:0 0 12px;">
          <button type="button" class="btn" id="btnSaoLuuNgay">💾 Sao lưu ngay</button>
          ${ch.batLog ? '<button type="button" class="btn secondary" id="btnSaoLuuLog">📝 Sao lưu log ngay</button>' : ''}
          <span class="empty-hint" id="slTienTrinh" style="margin-left:10px;"></span>
        </div>

        <div class="form-grid">
          <div class="form-row"><label>Đang có</label><div class="readonly-fact">${d.soBan} bản · ${mb(d.tongDungLuong)}</div></div>
          <div class="form-row"><label>Chỗ trống ổ đích</label><div class="readonly-fact">${(() => {
            if (d.choTrongMB == null) return '(không đo được — máy chủ cần Node ≥ 18.15; phép giữ trống bị bỏ qua)';
            const gb = d.choTrongMB / 1024, nguong = Number(ch.nguongTrongGB) || 5;
            /* Nói đúng MỐC máy chủ dùng: dưới ngưỡng mới xóa. "Sắp chạm" chỉ là nhắc, không được viết
               như thể lần tới chắc chắn xóa — nói sai theo chiều làm người dùng hoảng cũng là nói sai. */
            if (gb < nguong) return `${gb.toFixed(1)} GB — <span style="color:#c0392b;">DƯỚI ngưỡng ${nguong} GB: lần sao lưu tới sẽ xóa bản cũ nhất (tối đa 3) để lấy chỗ</span>`;
            if (gb < nguong * 1.5) return `${gb.toFixed(1)} GB — ngưỡng giữ trống ${nguong} GB <span style="color:#b06000;">(sắp chạm: xuống dưới ${nguong} GB thì lần sao lưu sau sẽ xóa bản cũ nhất)</span>`;
            return `${gb.toFixed(1)} GB — ngưỡng giữ trống ${nguong} GB`;
          })()}</div></div>
          ${d.mayChu ? `<div class="form-row"><label>SQL Server</label><div class="readonly-fact">${escapeHtml(d.mayChu.edition)}</div></div>
          <div class="form-row"><label>Dữ liệu / Log</label><div class="readonly-fact">${Math.round(d.mayChu.dataMB)} MB / ${Math.round(d.mayChu.logMB)} MB — chế độ ${escapeHtml(d.mayChu.recoveryModel)}</div></div>` : ''}
        </div>

        ${d.lanCuoi ? `<div class="empty-hint" style="text-align:left;margin-top:8px;">
          Lần chạy gần nhất (${gio(d.lanCuoi.luc)}, ${d.lanCuoi.soGiay}s):
          <b style="color:${d.lanCuoi.thanhCong ? '#137333' : '#c0392b'};">${d.lanCuoi.thanhCong ? 'THÀNH CÔNG' : 'THẤT BẠI'}</b>
          — ${escapeHtml(d.lanCuoi.thongDiep)}
          ${d.lanCuoi.loiPhu ? `<div style="color:#c0392b;margin-top:4px;"><b>Bản sao thứ hai HỎNG:</b>
             ${escapeHtml(d.lanCuoi.loiPhu)}</div>` : ''}</div>` : ''}
      </div>

      <div class="card">
        <h3 style="margin-top:0;">Cấu hình</h3>
        ${/* Trình duyệt KHÔNG duyệt được ổ đĩa của MÁY CHỦ (và không nên — đó là máy khác). Nên thay
             cho hộp thoại chọn thư mục: liệt kê ổ của máy chủ kèm chỗ trống + đánh dấu ổ đang chứa
             CSDL, bấm là điền sẵn đường dẫn, rồi "Kiểm tra" bằng phép thử THẬT. */''}
        <div id="slODia" class="empty-hint" style="text-align:left;margin-bottom:8px;">Đang đọc danh sách ổ đĩa…</div>
        <div class="form-grid">
          <div class="form-row"><label>Thư mục lưu *</label>
            <input id="slThuMuc" value="${escapeHtml(ch.thuMuc || '')}" placeholder="VD: E:\\BackupQLNoiBo"></div>
          <div class="form-row"><label>Giờ chạy hằng ngày</label>
            <input id="slGio" type="time" value="${escapeHtml(gioTuCron(ch.gioChay))}"></div>
          <div class="form-row"><label>Giữ lại (ngày)</label>
            <input id="slNgay" type="number" min="1" max="3650" value="${Number(ch.soNgayGiu) || 30}"></div>
          <div class="form-row"><label>Luôn giữ ít nhất (bản)</label>
            <input id="slLuonGiu" type="number" min="1" max="100" value="${Number(ch.soBanLuonGiu) || 3}"></div>
          ${/* v9.44 — Nguyen: "khi còn 5Gb thì xóa file cũ nhất để lưu file mới. Có chỗ cài đặt". */''}
          <div class="form-row"><label>Giữ trống ổ đích (GB)</label>
            <input id="slNguongTrong" type="number" min="1" max="1000" step="0.5" value="${Number(ch.nguongTrongGB) || 5}"
              title="Ổ đích còn ít hơn số này thì xóa bản sao lưu cũ nhất để lấy chỗ cho bản mới — nhưng không bao giờ xóa xuống dưới 'Luôn giữ ít nhất'."></div>
          <div class="form-row"><label>Email báo khi hỏng</label>
            <input id="slEmail" value="${escapeHtml(ch.emailBao || '')}" placeholder="a@cty.vn, b@cty.vn"></div>
          ${/* v9.40 — bản sao NGOÀI MÁY. SQL Server không ghi thẳng lên ổ Google Drive được (ổ ảo
               chỉ tồn tại trong phiên đăng nhập của người dùng, dịch vụ SQL ở phiên khác), nên
               phần mềm chép bản đã xác minh sang đó. */''}
          <div class="form-row"><label>Bản sao thứ hai (tùy chọn)</label>
            <input id="slThuMucPhu" value="${escapeHtml(ch.thuMucPhu || '')}" placeholder="VD: G:\\BackupQLNoiBo (Google Drive)"></div>
          <div class="form-row"><label>Bản sao thứ hai giữ (ngày)</label>
            <input id="slNgayPhu" type="number" min="1" max="3650" value="${Number(ch.soNgayGiuPhu) || Number(ch.soNgayGiu) || 30}"></div>
          <div class="form-row"><label>Bật lịch tự động</label>
            <label style="display:flex;gap:6px;align-items:center;">
              <input type="checkbox" id="slBat" ${ch.bat !== false ? 'checked' : ''}> Chạy tự động mỗi ngày</label></div>
          ${/* v9.41 — sao lưu transaction log. KHÔNG có ô "số ngày giữ log": hạn của file log bị
               buộc vào bản đầy đủ cũ nhất còn giữ (xem donLogCu). Cho gõ một con số thứ hai ở đây
               là mời người dùng phá chuỗi log mà không biết mình đang phá. */''}
          <div class="form-row"><label>Sao lưu transaction log</label>
            <label style="display:flex;gap:6px;align-items:center;">
              <input type="checkbox" id="slBatLog" ${ch.batLog ? 'checked' : ''}> Bật (cần CSDL ở chế độ FULL)</label></div>
          <div class="form-row"><label>Sao lưu log mỗi</label>
            <select id="slGioLog">
              ${[['0 * * * *', '1 giờ — mất nhiều nhất 1 giờ dữ liệu'],
                 ['0 */2 * * *', '2 giờ'],
                 ['0 */4 * * *', '4 giờ'],
                 ['*/30 * * * *', '30 phút']]
                .map(([v, t]) => `<option value="${v}" ${ch.gioChayLog === v ? 'selected' : ''}>${t}</option>`).join('')}
            </select></div>
        </div>
        <div class="empty-hint" style="text-align:left;">
          "Luôn giữ ít nhất" là lưới an toàn: dù đã quá hạn, hệ thống <b>không bao giờ</b> xóa đến mức
          còn ít hơn số này — tránh cảnh sao lưu hỏng dài ngày mà vẫn dọn đều, đến lúc cần thì không còn bản nào.
          <br><b>Giữ trống ổ đích:</b> trước mỗi lần sao lưu, ổ còn ít hơn ngưỡng này (cộng chỗ cho bản sắp
          ghi) thì phần mềm <b>tự xóa bản cũ nhất</b> — kéo theo các bản log cũ hơn nó — rồi đo lại, cho tới
          khi đủ chỗ. Nó dừng ở "luôn giữ ít nhất": xóa tới đó mà vẫn thiếu thì <b>từ chối sao lưu</b> và báo
          đỏ, vì xóa nốt bản cuối để lấy chỗ là vừa không có chỗ vừa không còn gì để khôi phục.
          Chỉ áp cho thư mục chính; bản sao thứ hai có hạn giữ riêng.
        </div>
        <div class="empty-hint" style="text-align:left;margin-top:6px;">
          <b>Sao lưu transaction log</b> giải quyết hai việc khác nhau:
          <br>① <b>Chặn file log phình.</b> Ở chế độ FULL, sao lưu đầy đủ hằng ngày <b>không</b> cắt log
          — chỉ sao lưu log mới cắt. Không làm thì log phình tới khi đầy ổ.
          <br>② <b>Giảm mức mất dữ liệu.</b> Chỉ có bản <code>.bak</code> thì khôi phục được về đúng
          lúc bản đó chạy (01:15 sáng) — hỏng lúc 4 giờ chiều là mất cả ngày làm việc. Có thêm bản log
          thì khôi phục về <b>bất kỳ thời điểm nào</b>.
          <br>🔴 File <code>.trn</code> tạo thành một <b>chuỗi liên tục</b>: xóa một file ở giữa là mất
          khả năng khôi phục của tất cả các mốc sau nó. Vì thế phần mềm <b>tự</b> quyết hạn giữ file log
          (chỉ xóa bản cũ hơn bản đầy đủ cũ nhất còn giữ) — không có ô để gõ.
          <br>⚠️ Sao lưu log <b>không làm file .ldf nhỏ lại</b>, chỉ làm nó thôi phình. Muốn lấy lại
          dung lượng đã chiếm phải chạy <code>DBCC SHRINKFILE</code> một lần — nói tôi biết nếu cần.
        </div>
        <div class="empty-hint" style="text-align:left;margin-top:6px;">
          <b>Bản sao thứ hai</b> dùng cho ổ mà SQL Server <b>không ghi thẳng được</b> — Google Drive,
          OneDrive, Dropbox, ổ ánh xạ mạng. Những ổ đó chỉ tồn tại trong phiên đăng nhập của anh, còn
          dịch vụ SQL Server chạy ở phiên khác nên với nó ổ đó không có thật (cấp quyền không sửa được).
          Nên SQL ghi xuống ổ trong máy, rồi <b>phần mềm chép</b> bản đã kiểm sang đây.
          Đây là bản sống sót khi máy chủ hỏng ổ hoặc dính mã độc tống tiền.
          <b>Lưu ý:</b> chép xong là xong phần của phần mềm — Google Drive còn phải tải lên dần, nên
          đừng coi bản trên Drive là đã an toàn ngay lập tức.
          ${d.thuMucPhu ? `<br>Hiện có <b>${d.soBanPhu == null ? '?' : d.soBanPhu}</b> bản ở ${escapeHtml(d.thuMucPhu)}.` : ''}
        </div>
        <div class="modal-actions" style="justify-content:flex-start;margin:6px 0 0;">
          <button type="button" class="btn secondary" id="btnKiemThuMuc">Kiểm tra thư mục</button>
          <button type="button" class="btn" id="btnLuuCauHinh">Lưu cấu hình</button>
          <span class="empty-hint" id="slKetQuaKiem" style="margin-left:10px;"></span>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top:0;">Các bản đang có</h3>
        <table><thead><tr><th>Tên file</th><th>Lúc</th><th style="text-align:right;">Dung lượng</th><th></th></tr></thead>
        <tbody>${d.danhSach.length ? d.danhSach.map(b => `<tr>
          <td>${escapeHtml(b.ten)}</td><td>${gio(b.luc)}</td>
          <td style="text-align:right;">${mb(b.dungLuong)}</td>
          <td><a class="btn small" href="/api/saoluu/tai/${encodeURIComponent(b.ten)}">Tải về</a></td>
        </tr>`).join('') : '<tr><td colspan="4" class="empty-hint">Chưa có bản nào.</td></tr>'}</tbody></table>
        <div class="empty-hint" style="text-align:left;">
          Khôi phục từ một bản: tải file .bak về rồi dùng SQL Server Management Studio (Restore Database).
          Phần mềm <b>cố ý không có nút khôi phục</b> — khôi phục là ghi đè toàn bộ dữ liệu hiện tại,
          không phải thao tác nên đặt sau một cú bấm chuột.
          ${ch.batLog ? '<br>Muốn khôi phục về <b>đúng một thời điểm</b> (không phải mốc 01:15): phục hồi '
            + 'bản <code>.bak</code> <b>WITH NORECOVERY</b>, rồi lần lượt các bản <code>.trn</code> sau nó '
            + 'theo đúng thứ tự thời gian, bản cuối dùng <code>WITH STOPAT</code>.' : ''}
        </div>
      </div>

      ${!ch.batLog ? '' : `<div class="card">
        <h3 style="margin-top:0;">Bản sao lưu log gần đây</h3>
        <div class="form-grid">
          <div class="form-row"><label>Đang có</label><div class="readonly-fact">${d.soBanLog} bản · ${mb(d.tongDungLuongLog)}</div></div>
          ${d.mayChu && d.mayChu.logDungPhanTram != null
            ? `<div class="form-row"><label>Log đang dùng</label><div class="readonly-fact">${d.mayChu.logDungPhanTram}% của ${Math.round(d.mayChu.logMB)} MB</div></div>` : ''}
        </div>
        ${d.lanCuoiLog ? `<div class="empty-hint" style="text-align:left;margin-top:6px;">
          Lần sao lưu log gần nhất (${gio(d.lanCuoiLog.luc)}, ${d.lanCuoiLog.soGiay}s):
          <b style="color:${d.lanCuoiLog.thanhCong ? '#137333' : '#c0392b'};">${d.lanCuoiLog.thanhCong ? 'THÀNH CÔNG' : 'THẤT BẠI'}</b>
          — ${escapeHtml(d.lanCuoiLog.thongDiep)}</div>` : ''}
        <table style="margin-top:6px;"><thead><tr><th>Tên file</th><th>Lúc</th><th style="text-align:right;">Dung lượng</th><th></th></tr></thead>
        <tbody>${d.danhSachLog.length ? d.danhSachLog.map(b => `<tr>
          <td>${escapeHtml(b.ten)}</td><td>${gio(b.luc)}</td>
          <td style="text-align:right;">${mb(b.dungLuong)}</td>
          <td><a class="btn small" href="/api/saoluu/tai/${encodeURIComponent(b.ten)}">Tải về</a></td>
        </tr>`).join('') : '<tr><td colspan="4" class="empty-hint">Chưa có bản log nào.</td></tr>'}</tbody></table>
        <div class="empty-hint" style="text-align:left;">
          Chỉ hiện 12 bản mới nhất. Phần mềm giữ <b>mọi</b> bản log kể từ bản sao lưu đầy đủ cũ nhất
          còn trên ổ — xóa bớt tay là làm đứt chuỗi khôi phục.
        </div>
      </div>`}`;

    noiDay(d);
  }

  /* `d` = dữ liệu trạng thái vừa vẽ. Trước v9.40 hàm này khai không tham số trong khi nơi gọi vẫn
     truyền `d` — vô hại lúc đó, nhưng nay nút "Sao lưu ngay" CẦN `d.moiNhat` làm mốc so sánh khi
     trình duyệt hết giờ chờ. Thiếu tham số là ReferenceError ngay lần bấm đầu. */
  function noiDay(d) {
    const body = container;

    /* ---- Danh sách ổ đĩa của MÁY CHỦ: bấm là điền sẵn đường dẫn gợi ý ---- */
    (async () => {
      const el = body.querySelector('#slODia');
      try {
        const o = (await apiGet('/api/saoluu/odia')).data;
        /* 🔴 `sqlThayDuoc === false` là thông tin QUAN TRỌNG NHẤT của danh sách này. Nguyen chọn
           G:\ (Google Drive) ngày 10/11/2026 và nhận "BACKUP DATABASE is terminating abnormally" —
           không có cách nào đoán ra. `null` = chưa hỏi được ⇒ KHÔNG tô cảnh báo (nói bừa "SQL không
           thấy ổ này" khi chưa biết thì tệ hơn im lặng). */
        const nhan = (x) => {
          if (x.sqlThayDuoc === false) return { mau: '#8a8a8a', hau: ' 🚫 SQL không ghi được',
            chu: 'SQL Server KHÔNG nhìn thấy ổ này (Google Drive / OneDrive / ổ mạng). '
               + 'Dùng được cho ô "Bản sao thứ hai", KHÔNG dùng được cho thư mục sao lưu chính.' };
          if (x.coCSDL) return { mau: '#c0392b', hau: ' ⚠️ có CSDL',
            chu: 'Ổ này ĐANG CHỨA CSDL — chọn ở đây thì ổ hỏng là mất cả hai' };
          return { mau: '', hau: '', chu: 'Bấm để điền đường dẫn gợi ý' };
        };
        el.innerHTML = 'Ổ trên máy chủ: ' + o.danhSach.map(x => {
          const n = nhan(x);
          return `<a href="#" data-o="${escapeHtml(x.goiY)}" data-sql="${x.sqlThayDuoc === false ? '0' : '1'}"
             style="margin-right:12px;${n.mau ? 'color:' + n.mau + ';' : ''}" title="${escapeHtml(n.chu)}">
             ${x.o}: ${x.choTrongMB == null ? '' : '(' + Math.round(x.choTrongMB / 1024) + ' GB trống)'}${n.hau}</a>`;
        }).join('')
          + (o.oCuaCSDL.length ? `<div style="color:#c0392b;margin-top:4px;">CSDL đang nằm trên ổ: ${o.oCuaCSDL.join(', ')} — nên chọn ổ KHÁC.</div>` : '')
          + (o.hoiDuocSQL ? '<div style="color:#5f6368;margin-top:4px;">Ổ ghi 🚫 là ổ ảo theo phiên đăng nhập '
              + '(Google Drive, OneDrive, ổ mạng): dịch vụ SQL Server không thấy chúng. Bấm vào để điền vào '
              + 'ô <b>Bản sao thứ hai</b>.</div>' : '');
        el.querySelectorAll('a[data-o]').forEach(a => a.addEventListener('click', (e) => {
          e.preventDefault();
          /* Ổ SQL không thấy thì điền vào ô BẢN SAO THỨ HAI, không điền vào thư mục chính — điền vào
             chính là dắt người dùng thẳng vào lỗi mà họ vừa mất buổi sáng để gỡ. */
          const dich = a.dataset.sql === '0' ? '#slThuMucPhu' : '#slThuMuc';
          body.querySelector(dich).value = a.dataset.o;
          body.querySelector(dich).focus();
        }));
      } catch (err) { el.textContent = 'Không đọc được danh sách ổ: ' + err.message; }
    })();

    const oKetQua = body.querySelector('#slKetQuaKiem');
    const layForm = () => {
      const g = cronTuGio(body.querySelector('#slGio').value);
      const o = {
        thuMuc: body.querySelector('#slThuMuc').value.trim(),
        soNgayGiu: Number(body.querySelector('#slNgay').value),
        soBanLuonGiu: Number(body.querySelector('#slLuonGiu').value),
        nguongTrongGB: Number(body.querySelector('#slNguongTrong').value),
        emailBao: body.querySelector('#slEmail').value.trim(),
        thuMucPhu: body.querySelector('#slThuMucPhu').value.trim(),
        soNgayGiuPhu: Number(body.querySelector('#slNgayPhu').value),
        bat: body.querySelector('#slBat').checked,
        batLog: body.querySelector('#slBatLog').checked,
        gioChayLog: body.querySelector('#slGioLog').value
      };
      /* Ô giờ để rỗng (cron đang là biểu thức lạ) thì KHÔNG gửi gioChay — giữ nguyên biểu thức cũ
         thay vì âm thầm đổi lịch của người ta. */
      if (g) o.gioChay = g;
      return o;
    };

    body.querySelector('#btnKiemThuMuc').addEventListener('click', async (e) => {
      const nutK = e.currentTarget;
      nutK.disabled = true;
      oKetQua.textContent = 'Đang bắt SQL Server ghi thử một file vào đó…';
      try {
        const r = (await apiPost('/api/saoluu/kiemthumuc', {
          thuMuc: body.querySelector('#slThuMuc').value.trim(),
          thuMucPhu: body.querySelector('#slThuMucPhu').value.trim()
        })).data;
        oKetQua.innerHTML = `<span style="color:${r.ok ? '#137333' : '#c0392b'};">${escapeHtml(r.thongDiep)}</span>`
          + (r.phu ? `<div style="color:${r.phu.ok ? '#137333' : '#c0392b'};margin-top:4px;">
               <b>Bản sao thứ hai:</b> ${escapeHtml(r.phu.thongDiep)}</div>` : '');
      } catch (err) {
        oKetQua.innerHTML = `<span style="color:#c0392b;">${escapeHtml(err.message)}</span>`;
      } finally { nutK.disabled = false; }
    });

    body.querySelector('#btnLuuCauHinh').addEventListener('click', async (e) => {
      const nutL = e.currentTarget;
      nutL.disabled = true;
      try {
        const r = (await apiPut('/api/saoluu/cauhinh', layForm())).data;
        toast(r.lich && r.lich.chay
          ? 'Đã lưu. Lịch chạy lúc ' + gioTuCron(r.lich.gioChay) + ' mỗi ngày.'
          : 'Đã lưu. ⚠️ Lịch KHÔNG chạy: ' + ((r.lich && r.lich.lyDo) || 'chưa rõ'),
        r.lich && r.lich.chay ? 'success' : 'error');
        veMan();
      } catch (err) {
        toast(err.message, 'error');
        nutL.disabled = false;
      }
    });

    const nut = body.querySelector('#btnSaoLuuNgay');
    const bao = body.querySelector('#slTienTrinh');
    nut.addEventListener('click', async () => {
      /* Khóa nút NGAY: sao lưu mất vài chục giây, bấm hai lần là người dùng tưởng lần một hỏng.
         (Backend cũng chặn chạy chồng bằng cờ __dangChay — hai lớp.) */
      nut.disabled = true;
      bao.textContent = 'Đang sao lưu… có thể mất vài chục giây, đừng đóng trang.';
      /* Mốc để biết sau này có bản MỚI hay không — dùng khi trình duyệt hết giờ chờ. */
      const mocCu = (d.moiNhat && new Date(d.moiNhat.luc).getTime()) || 0;
      try {
        const kq = (await apiPost('/api/saoluu/chay', {})).data;
        toast(kq.thongDiep, kq.thanhCong ? 'success' : 'error');
        if (kq.loiPhu) toast('Bản sao thứ hai hỏng: ' + kq.loiPhu, 'error');
      } catch (err) {
        /* 🔴 apiFetch cắt mọi lời gọi ở 30 giây (common.js). BACKUP vẫn CHẠY TIẾP ở máy chủ sau khi
           trình duyệt bỏ cuộc — y hệt cái bẫy 15 giây của driver mssql mà backend đã né bằng kết nối
           riêng, chỉ khác tầng. Báo "thất bại" lúc này là NÓI SAI: nó dạy người dùng bỏ qua cảnh báo
           của chính màn hình sao lưu. Nên hết giờ thì ĐI HỎI LẠI máy chủ, đừng kết luận. */
        bao.textContent = 'Trình duyệt hết giờ chờ, nhưng máy chủ có thể vẫn đang sao lưu — đang theo dõi…';
        let xong = false;
        for (let i = 0; i < 40 && !xong; i++) {          // tối đa ~10 phút
          await new Promise(r => setTimeout(r, 15000));
          try {
            const t = (await apiGet('/api/saoluu/trangthai')).data;
            const moc = (t.moiNhat && new Date(t.moiNhat.luc).getTime()) || 0;
            if (moc > mocCu) { toast('Sao lưu đã xong: ' + (t.moiNhat ? t.moiNhat.ten : ''), 'success'); xong = true; }
            else if (t.lanCuoi && new Date(t.lanCuoi.luc).getTime() > mocCu && !t.lanCuoi.thanhCong) {
              toast('Sao lưu thất bại: ' + t.lanCuoi.thongDiep, 'error'); xong = true;
            }
          } catch (e2) { /* máy chủ đang bận ghi file — thử lại vòng sau */ }
        }
        if (!xong) toast('Vẫn chưa thấy bản mới sau 10 phút. Mở lại màn này để xem kết quả.', 'error');
      } finally {
        nut.disabled = false;
        bao.textContent = '';
        veMan();   // vẽ lại để thấy bản mới + trạng thái mới
      }
    });

    /* v9.41: sao lưu log chạy tay. Chỉ sao lưu phần phát sinh từ lần log trước nên rất nhanh —
       không cần cơ chế quay vòng như nút sao lưu đầy đủ. */
    const nutLog = body.querySelector('#btnSaoLuuLog');
    if (nutLog) nutLog.addEventListener('click', async () => {
      nutLog.disabled = true;
      bao.textContent = 'Đang sao lưu transaction log…';
      try {
        const kq = (await apiPost('/api/saoluu/chaylog', {})).data;
        toast(kq.thongDiep, kq.thanhCong ? 'success' : 'error');
      } catch (err) {
        toast('Lỗi khi sao lưu log: ' + err.message, 'error');
      } finally {
        nutLog.disabled = false;
        bao.textContent = '';
        veMan();
      }
    });
  }

  return { getTabs, render };
})();
