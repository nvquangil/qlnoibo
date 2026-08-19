(async function () {
  // Neu da dang nhap roi thi vao thang trang chinh
  try {
    await apiGet('/api/auth/session');
    window.location.href = '/index.html';
  } catch (e) { /* chua dang nhap, o lai trang login */ }
})();

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('loginError');
  errorEl.textContent = '';
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  try {
    await apiPost('/api/auth/login', { username, password });
    window.location.href = '/index.html';
  } catch (err) {
    errorEl.textContent = err.message;
  }
});
