// XOA TOAN BO danh muc + du lieu giao dich cua 2 phan he Kho vai va Phu kien (Loai vai, Mau sac,
// Nha cung cap, Danh muc vai, cay vai, phieu nhap/xuat vai, Loai phu kien, Danh muc phu kien,
// phieu phu kien) - dung khi can nap lai tu dau bang importExcel.js trong luc test/dev, tranh
// chay import nhieu lan lam ton kho bi cong trung.
//
// AN TOAN: mac dinh CHI XEM TRUOC so dong se bi xoa, KHONG xoa gi. Phai them --confirm moi xoa thuc.
// KHONG dung script nay tren database da co du lieu van hanh that ma khong chac chan - luon backup
// (SSMS > chuot phai database > Tasks > Back Up...) truoc khi chay --confirm.
//
// Cach dung (chay tu thu muc backend/):
//   node scripts/resetImportData.js              (xem truoc, KHONG xoa)
//   node scripts/resetImportData.js --confirm     (xoa THAT)
//
// Mau sac va Nha cung cap la 2 bang DUNG CHUNG voi cac phan he khac (Kho hang hoa cung dung Mau
// sac; QLSX dung ca Loai vai/Mau sac qua DonHangChiTietVai). Neu cac phan he do da co du lieu tham
// chieu toi, lenh DELETE se bi SQL Server tu choi (loi khoa ngoai) - script se BAO LOI RO cho tung
// bang bi chan va TIEP TUC voi bang khac, khong bao gio tu dong xoa lan sang du lieu ngoai pham vi
// Kho vai/Phu kien.

const { sql, getPool } = require('../db');

const confirm = process.argv.includes('--confirm');

// Thu tu xoa: con (chi tiet/giao dich) truoc, cha (danh muc) sau - dung chieu FK.
const TABLES_IN_ORDER = [
  { name: 'PhieuXuatVaiChiTiet', label: 'Chi tiết phiếu xuất vải' },
  { name: 'PhieuXuatVai', label: 'Phiếu xuất vải' },
  { name: 'VaiCay', label: 'Cây vải (tồn kho theo cây)' },
  { name: 'PhieuNhapVai', label: 'Phiếu nhập vải' },
  { name: 'DanhMucVai', label: 'Danh mục Mã vải' },
  { name: 'LoaiVai', label: 'Danh mục Loại vải' },
  { name: 'PhieuPhuKienChiTiet', label: 'Chi tiết phiếu phụ kiện' },
  { name: 'PhieuPhuKien', label: 'Phiếu phụ kiện (Nhập/Xuất)' },
  { name: 'DanhMucPhuKien', label: 'Danh mục Phụ kiện' },
  { name: 'LoaiPhuKien', label: 'Danh mục Loại phụ kiện' },
  { name: 'MauSac', label: 'Màu sắc (dùng chung với phân hệ khác)' },
  { name: 'NhaCungCap', label: 'Nhà cung cấp (dùng chung với phân hệ khác)' }
];

async function main() {
  const pool = await getPool();
  console.log(confirm
    ? '=== XÓA THẬT — sẽ xóa dữ liệu khỏi database, không thể hoàn tác ==='
    : '=== CHỈ XEM TRƯỚC — chưa xóa gì. Thêm --confirm vào lệnh để xóa thật. ===');
  console.log('');

  let totalDeleted = 0;
  for (const t of TABLES_IN_ORDER) {
    const cnt = await pool.request().query(`SELECT COUNT(*) AS c FROM ${t.name}`);
    const total = cnt.recordset[0].c;

    if (!confirm) {
      console.log(`  [${t.name}] ${t.label}: ${total} dòng hiện có (sẽ bị xóa nếu chạy --confirm).`);
      continue;
    }
    if (total === 0) {
      console.log(`  [${t.name}] ${t.label}: đã trống, bỏ qua.`);
      continue;
    }
    try {
      await pool.request().query(`DELETE FROM ${t.name}`);
      console.log(`  [${t.name}] ${t.label}: đã xóa ${total} dòng.`);
      totalDeleted += total;
    } catch (e) {
      console.error(`  [${t.name}] ${t.label}: KHÔNG xóa được (còn ${total} dòng) — ${e.message}`);
      console.error('    -> Có bảng NGOÀI phạm vi Kho vải/Phụ kiện đang tham chiếu tới đây (VD đơn hàng');
      console.error('       sản xuất, thẻ kho hàng hóa). Bỏ qua bảng này để không ảnh hưởng phân hệ khác.');
    }
  }

  console.log('');
  console.log(confirm ? `Hoàn tất. Tổng số dòng đã xóa: ${totalDeleted}.` : 'Xem xong. Chạy lại kèm --confirm để xóa thật.');
  process.exit(0);
}

main().catch(err => { console.error('Lỗi không xử lý được:', err); process.exit(1); });
