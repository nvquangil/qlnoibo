/* ================================================================================================
   kiem_tam_ung_tru_luong.js  —  bộ tự kiểm cho v9.32 (phiếu chi cho nhân viên + tạm ứng trừ lương)

   🔴 Phép quan trọng nhất (mục 3): TÍNH LƯƠNG HAI LẦN PHẢI RA CÙNG MỘT SỐ. Đây chính là chỗ bản
   thiết kế đầu tiên sẽ hỏng: `POST /bangluong/tinh` xóa sạch BangLuongChiTiet rồi ghi lại, nên nếu
   tạm ứng được GHI SẴN vào bảng lương thì lần tính thứ hai nó về 0 và ThucLinh tăng đúng bằng số đã
   ứng = TRẢ THỪA TIỀN, im lặng.

   Chạy:  node backend\utils\kiem_tam_ung_tru_luong.js
   KHÔNG copy file này sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const tu = require('./tamUngNhanVien');
const nguonTu = fs.readFileSync(path.join(__dirname, 'tamUngNhanVien.js'), 'utf8');
const nguonCN = fs.readFileSync(path.join(GOC, 'backend', 'routes', 'congno.js'), 'utf8');
const nguonPR = fs.readFileSync(path.join(GOC, 'backend', 'routes', 'payroll.js'), 'utf8');
const nguonFeCN = fs.readFileSync(path.join(GOC, 'frontend', 'js', 'module.congno.js'), 'utf8');
const nguonFePR = fs.readFileSync(path.join(GOC, 'frontend', 'js', 'module.payroll.js'), 'utf8');
const sqlMig = fs.readFileSync(path.join(GOC, 'database', 'migration_v886.sql'), 'utf8');
const sqlDayDu = fs.readFileSync(path.join(GOC, 'database', 'CAI_DAT_DAY_DU.sql'), 'utf8');
const html = fs.readFileSync(path.join(GOC, 'frontend', 'index.html'), 'utf8');

let sai = 0, dat = 0;
const kiem = (ten, dung, td) => dung
  ? (dat++, console.log('  ✓ ' + ten))
  : (sai++, console.log('  ❌ ' + ten + (td ? ' — ' + td : '')));

/* ------------------------------------------------------------------------------------------------
   POOL GIẢ: ba phiếu chi trong tháng 11/2026.
     NV 1: hai phiếu tạm ứng 500k + 300k  -> tổng 800k
     NV 2: một phiếu CÔNG TÁC PHÍ 200k    -> KHÔNG trừ lương
     NV 1: một phiếu tạm ứng tháng 12     -> không thuộc tháng 11
   ------------------------------------------------------------------------------------------------ */
const PHIEU = [
  { PhieuChiID: 1, SoPhieu: 'PC26001', NhanVienID: 1, LoaiChiNV: 'TamUng', SoTien: 500000, nam: 2026, thang: 11, NgayChi: '2026-11-05' },
  { PhieuChiID: 2, SoPhieu: 'PC26002', NhanVienID: 1, LoaiChiNV: 'TamUng', SoTien: 300000, nam: 2026, thang: 11, NgayChi: '2026-11-20' },
  { PhieuChiID: 3, SoPhieu: 'PC26003', NhanVienID: 2, LoaiChiNV: 'CongTacPhi', SoTien: 200000, nam: 2026, thang: 11, NgayChi: '2026-11-10' },
  { PhieuChiID: 4, SoPhieu: 'PC26004', NhanVienID: 1, LoaiChiNV: 'TamUng', SoTien: 900000, nam: 2026, thang: 12, NgayChi: '2026-11-28' }
];
function poolGia(coCot = true) {
  return {
    request() {
      const ctx = {};
      const r = {
        input(ten, kieu, gt) { ctx[ten] = gt; return r; },
        async query(q) {
          if (/COL_LENGTH\('PhieuChi','NhanVienID'\)/.test(q))
            return { recordset: [coCot ? { a: 4, b: 20, c: 1 } : { a: null, b: null, c: null }] };
          const loc = PHIEU.filter(p => p.LoaiChiNV === 'TamUng' && p.nam === ctx.nam && p.thang === ctx.thang
            && (ctx.nv == null || p.NhanVienID === ctx.nv));
          if (/GROUP BY pc\.NhanVienID/.test(q)) {
            const m = new Map();
            loc.forEach(p => m.set(p.NhanVienID, (m.get(p.NhanVienID) || 0) + p.SoTien));
            return { recordset: Array.from(m, ([NhanVienID, Tong]) => ({ NhanVienID, Tong })) };
          }
          if (/ORDER BY pc\.NgayChi/.test(q)) return { recordset: loc.map(p => Object.assign({}, p)) };
          return { recordset: [] };
        }
      };
      return r;
    }
  };
}

(async () => {
  console.log('\n=== 1. BIÊN DỊCH ===');
  [['utils/tamUngNhanVien.js', nguonTu], ['routes/congno.js', nguonCN], ['routes/payroll.js', nguonPR],
   ['frontend/module.congno.js', nguonFeCN], ['frontend/module.payroll.js', nguonFePR]].forEach(([f, s]) => {
    try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
    catch (e) { sai++; console.log('  ❌ ' + f + ' VỠ CÚ PHÁP: ' + e.message); }
  });

  console.log('\n=== 2. CỘNG TẠM ỨNG — chạy thật trên pool giả ===');
  tu.xoaCacheCot();
  const p = poolGia(true);
  const m = await tu.tongTamUngTheoThang(p, 2026, 11);
  kiem('NV1: cộng ĐÚNG hai phiếu tạm ứng tháng 11 = 800.000', m.get(1) === 800000, 'được ' + m.get(1));
  kiem('🔴 NV2 chỉ có CÔNG TÁC PHÍ -> KHÔNG trừ lương', !m.has(2),
       'chỉ loại TamUng mới trừ lương; trừ nhầm là lấy mất tiền của người ta');
  kiem('🔴 phiếu ghi "trừ vào lương tháng 12" KHÔNG lọt vào tháng 11', m.get(1) !== 1700000);
  const m12 = await tu.tongTamUngTheoThang(p, 2026, 12);
  kiem('…và nó nằm đúng ở tháng 12', m12.get(1) === 900000, 'được ' + m12.get(1));
  const ct = await tu.chiTietTamUng(p, 1, 2026, 11);
  kiem('xem chi tiết: đúng 2 phiếu, tổng khớp con số trên bảng lương',
       ct.length === 2 && ct.reduce((s, x) => s + x.SoTien, 0) === m.get(1));

  tu.xoaCacheCot();
  const mKhongCot = await tu.tongTamUngTheoThang(poolGia(false), 2026, 11);
  kiem('máy CHƯA chạy migration_v886 -> trả rỗng, không nổ, bảng lương vẫn tính được', mKhongCot.size === 0);
  tu.xoaCacheCot();

  console.log('\n=== 3. 🔴 TÍNH LƯƠNG HAI LẦN PHẢI RA CÙNG MỘT SỐ ===');
  /* Mô phỏng đúng hai dòng quyết định trong POST /bangluong/tinh: lấy tổng từ phiếu chi rồi trừ.
     Bản CŨ ghi TamUng=0 nên lần hai ThucLinh nhảy lên — chính là lỗi phải chặn. */
  const coLayTuPhieuChi = /const tamUngMap = await tongTamUngTheoThang\(pool, nam, thang\);/.test(nguonPR);
  /* v9.45: route không còn tự trừ `c.thucLinh = Math.round(... - tamUng)` — nó đưa tạm ứng VÀO bộ tính
     (`tamUng: Number(tamUngMap.get(...))`) và bộ tính thuần `luongCongNhat.js` trừ ở `thucLinhTho`.
     Kiểm cả hai nửa: route truyền vào, bộ tính trừ ra. (Bộ kiểm v9.45 chạy bộ tính thật trên 47 dòng.) */
  const nguonBoTinh = fs.readFileSync(path.join(GOC, 'backend', 'utils', 'luongCongNhat.js'), 'utf8');
  const coTruVaoThucLinh = /tamUng: Number\(tamUngMap\.get\(Number\(e\.NhanVienID\)\)\) \|\| 0/.test(nguonPR)
    && /const thucLinhTho = tnChiuThue \+ tnMienThue - tongBH - tienThueTru - tamUng \+ dieuChinh;/.test(nguonBoTinh);
  kiem('route tính lương LẤY tạm ứng từ phiếu chi', coLayTuPhieuChi);
  kiem('…và TRỪ nó vào thực lĩnh', coTruVaoThucLinh);
  kiem('🔴 KHÔNG còn ghi cứng TamUng = 0 khi tính lương',
       !/\.input\('TamUng', sql\.Decimal\(14, 2\), 0\)/.test(nguonPR),
       'ghi 0 = mỗi lần tính lại là xóa sạch tạm ứng, ThucLinh tăng đúng bằng số đã ứng');
  if (coLayTuPhieuChi && coTruVaoThucLinh) {
    const tinhMot = async () => {
      const map = await tu.tongTamUngTheoThang(poolGia(true), 2026, 11);
      const tamUng = Number(map.get(1)) || 0;
      return { tamUng, thucLinh: Math.round(10000000 - 1050000 - 0 + 730000 - tamUng) };
    };
    tu.xoaCacheCot(); const l1 = await tinhMot();
    const l2 = await tinhMot();
    const l3 = await tinhMot();
    kiem('🔴 tính 3 lần liên tiếp -> tạm ứng và thực lĩnh KHÔNG đổi',
         l1.tamUng === l2.tamUng && l2.tamUng === l3.tamUng
           && l1.thucLinh === l2.thucLinh && l2.thucLinh === l3.thucLinh,
         JSON.stringify([l1, l2, l3]));
    kiem('thực lĩnh đã trừ đúng 800.000', l1.thucLinh === 10000000 - 1050000 + 730000 - 800000, 'được ' + l1.thucLinh);
  }
  kiem('🔴 route sửa tay tạm ứng bị CHẶN, kèm chỉ dẫn sửa ở đâu',
       /Tạm ứng nay lấy tự động từ phiếu chi/.test(nguonPR),
       'để sửa tay là số đó sống tới lần tính lương kế tiếp rồi biến mất');
  kiem('có route xem TỪNG PHIẾU tạo nên con số (không để thành hộp đen)',
       /router\.get\('\/bangluong\/tamung\/:nhanVienId'/.test(nguonPR));

  console.log('\n=== 4. PHIẾU CHI — backend ===');
  kiem('chuẩn hóa: chỉ giữ id của ĐÚNG loại đối tượng (đổi loại không để sót id cũ)',
       /nhanVienId = laNV \? \(parseInt\(b\.nhanVienId, 10\) \|\| null\) : null/.test(nguonCN));
  kiem('🔴 loại chi lạ -> "Khac" (fail-safe về phía KHÔNG trừ lương)',
       /LOAI_CHI_NV\.includes\(b\.loaiChiNV\) \? b\.loaiChiNV : 'Khac'/.test(nguonCN));
  kiem('tháng trừ lương chỉ gán cho TẠM ỨNG', /const laTamUng = loaiChiNV === 'TamUng';/.test(nguonCN));
  kiem('tháng/năm được kiểm miền (1-12, 2000-2100)',
       /thang >= 1 && thang <= 12/.test(nguonCN) && /nam >= 2000 && nam <= 2100/.test(nguonCN));
  kiem('chi cho nhân viên mà KHÔNG chọn ai -> chặn', /phải chọn nhân viên/.test(nguonCN));
  kiem('chưa chạy migration -> báo rõ, không ghi im lặng', /chưa chạy migration_v886\.sql/.test(nguonCN));
  kiem('🔴 PUT ghi ĐÈ bốn cột nhân viên (không ISNULL giữ cũ)',
       /NhanVienID=@NhanVienID, LoaiChiNV=@LoaiChiNV, TruLuongNam=@TruLuongNam, TruLuongThang=@TruLuongThang,/.test(nguonCN),
       'giữ giá trị cũ = sửa phiếu sang loại khác mà tiền vẫn bị trừ lương');
  kiem('danh sách nhân viên gác bằng quyền CONGNO, KHÔNG bắt phải có quyền DANHMUC',
       /router\.get\('\/nhanvien', requireAuth, requirePermission\('CONGNO', 'view'\)/.test(nguonCN));
  kiem('…và chỉ trả 4 trường cho ô chọn, không kèm lương/hồ sơ',
       /SELECT NhanVienID, MaNhanVien, HoTen, BoPhan/.test(nguonCN)
         && !/LuongCoBan[\s\S]{0,80}FROM NhanVien WHERE ISNULL\(TrangThaiLaoDong/.test(nguonCN));

  console.log('\n=== 5. GIAO DIỆN ===');
  kiem('phiếu chi lấy nhân viên qua /api/congno/nhanvien', /apiGet\('\/api\/congno\/nhanvien'\)/.test(nguonFeCN));
  kiem('có ô chọn nhân viên + loại chi + tháng trừ lương',
       /id="chiNV"/.test(nguonFeCN) && /id="chiLoaiNV"/.test(nguonFeCN) && /id="chiTLThang"/.test(nguonFeCN));
  kiem('ô "trừ vào lương tháng" CHỈ hiện khi loại là Tạm ứng',
       /oTL\.style\.display = \(laNV && modal\.querySelector\('#chiLoaiNV'\)\.value === 'TamUng'\)/.test(nguonFeCN));
  kiem('🔴 hỏi lại TRƯỚC khi lưu tạm ứng (nói rõ trừ vào tháng nào)',
       /sẽ TRỪ vào bảng lương tháng/.test(nguonFeCN));
  kiem('tháng trừ mặc định theo ngày chi, nhưng tôn trọng nếu người dùng tự chọn',
       /let nguoiDungTuChonThang/.test(nguonFeCN) && /if \(nguoiDungTuChonThang\) return;/.test(nguonFeCN));
  kiem('🔴 bảng lương KHÔNG còn ô gõ tay tạm ứng',
       !/class="tu-inp"/.test(nguonFePR) && !/bangluong\/chitiet\/' \+ inp\.dataset\.id/.test(nguonFePR));
  kiem('…thay bằng link xem từng phiếu', /class="tu-xem"/.test(nguonFePR) && /bangluong\/tamung\//.test(nguonFePR));
  kiem('ghi chú dưới bảng nói rõ tạm ứng lấy từ đâu', /lấy tự động từ <b>Công nợ → Phiếu chi<\/b>/.test(nguonFePR));

  console.log('\n=== 6. MIGRATION + BUMP ===');
  kiem('migration chỉ THÊM cột, không xóa/sửa dữ liệu',
       !/DELETE FROM/i.test(sqlMig) && !/DROP (TABLE|COLUMN)/i.test(sqlMig) && !/UPDATE PhieuChi SET/i.test(sqlMig));
  kiem('có index phục vụ cộng tạm ứng theo (NV, năm, tháng)', /IX_PhieuChi_TamUngNV/.test(sqlMig));
  kiem('🔴 đã gộp vào CAI_DAT_DAY_DU.sql (máy cài mới phải có cột)',
       /migration_v886\.sql/.test(sqlDayDu) && /IX_PhieuChi_TamUngNV/.test(sqlDayDu));
  kiem('bump module.congno.js >= 9.32', (() => {
    const x = html.match(/module\.congno\.js\?v=([\d.]+)/); return !!x && parseFloat(x[1]) >= 9.32;
  })());
  kiem('bump module.payroll.js >= 9.32', (() => {
    const x = html.match(/module\.payroll\.js\?v=([\d.]+)/); return !!x && parseFloat(x[1]) >= 9.32;
  })());

  console.log('\n' + '='.repeat(70));
  console.log(sai === 0 ? `✅ ${dat} phép ĐẠT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phép`);
  console.log('='.repeat(70) + '\n');
  process.exit(sai === 0 ? 0 : 1);
})().catch(e => { console.log('❌ NỔ: ' + e.stack); process.exit(1); });
