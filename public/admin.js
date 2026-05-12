/* ════════════════════════════════════════════
   WAVE PROFILE — admin.js
   ════════════════════════════════════════════ */

// ─── Theme Toggle ─────────────────────────────────────────────────────────
const html = document.documentElement;
const savedTheme = localStorage.getItem("theme") || "dark";
html.dataset.theme = savedTheme;
document.getElementById("themeToggle").addEventListener("click", () => {
  const next = html.dataset.theme === "dark" ? "light" : "dark";
  html.dataset.theme = next;
  localStorage.setItem("theme", next);
});

// ─── Session ──────────────────────────────────────────────────────────────
let session = { username: "", password: "" };

const loginCard  = document.getElementById("loginCard");
const adminPanel = document.getElementById("adminPanel");
const loginError = document.getElementById("loginError");
const addError   = document.getElementById("addError");
const addSuccess = document.getElementById("addSuccess");

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 4000);
}
function showSuccess(el, msg) {
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 3000);
}

// Check stored session
const storedUser = sessionStorage.getItem("adm_user");
const storedPass = sessionStorage.getItem("adm_pass");
if (storedUser && storedPass) {
  session = { username: storedUser, password: storedPass };
  showPanel();
}

// ─── Login ────────────────────────────────────────────────────────────────
document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("inputPass").addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});

async function login() {
  const username = document.getElementById("inputUser").value.trim();
  const password = document.getElementById("inputPass").value;
  if (!username || !password) return showError(loginError, "กรุณากรอก username และ password");

  const btn = document.getElementById("loginBtn");
  btn.disabled = true;
  btn.textContent = "กำลังเข้าสู่ระบบ...";

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const d = await res.json();
      showError(loginError, d.error || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    } else {
      session = { username, password };
      sessionStorage.setItem("adm_user", username);
      sessionStorage.setItem("adm_pass", password);
      showPanel();
    }
  } catch {
    showError(loginError, "เชื่อมต่อ server ไม่ได้");
  } finally {
    btn.disabled = false;
    btn.textContent = "เข้าสู่ระบบ";
  }
}

function showPanel() {
  loginCard.style.display = "none";
  adminPanel.classList.add("visible");
  loadAdminSongs();
}

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  session = { username: "", password: "" };
  sessionStorage.removeItem("adm_user");
  sessionStorage.removeItem("adm_pass");
  adminPanel.classList.remove("visible");
  loginCard.style.display = "";
  document.getElementById("inputUser").value = "";
  document.getElementById("inputPass").value = "";
});

// ─── Load Songs ───────────────────────────────────────────────────────────
async function loadAdminSongs() {
  const list = document.getElementById("adminSongList");
  const count = document.getElementById("songCount");
  list.innerHTML = '<p class="songs-empty">กำลังโหลด...</p>';

  try {
    const res = await fetch("/api/songs");
    const songs = await res.json();
    count.textContent = `(${songs.length} เพลง)`;

    if (!songs.length) {
      list.innerHTML = '<p class="songs-empty">ยังไม่มีเพลง</p>';
      return;
    }

    list.innerHTML = songs.map((s) => `
      <div class="admin-song-item" data-id="${s._id}">
        <img class="admin-song-img"
             src="https://img.youtube.com/vi/${s.videoId}/mqdefault.jpg"
             alt="" loading="lazy"
             onerror="this.style.background='#333'" />
        <div class="admin-song-info">
          <p class="admin-song-title">${escHtml(s.title)}</p>
          <p class="admin-song-artist">${escHtml(s.artist)}</p>
          <p class="admin-song-id">youtu.be/${s.videoId}</p>
        </div>
        <button class="btn-delete" data-id="${s._id}" onclick="deleteSong('${s._id}', this)">ลบ</button>
      </div>
    `).join("");
  } catch {
    list.innerHTML = '<p class="songs-empty">โหลดไม่สำเร็จ</p>';
  }
}

// ─── Add Song ─────────────────────────────────────────────────────────────
document.getElementById("addBtn").addEventListener("click", addSong);
document.getElementById("inputUrl").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSong();
});

async function addSong() {
  const youtubeUrl = document.getElementById("inputUrl").value.trim();
  const title      = document.getElementById("inputTitle").value.trim();
  const artist     = document.getElementById("inputArtist").value.trim();

  if (!youtubeUrl) return showError(addError, "กรุณาใส่ YouTube URL");

  const btn = document.getElementById("addBtn");
  btn.disabled = true;
  btn.textContent = "กำลังเพิ่ม...";

  try {
    const res = await fetch("/api/songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...session, youtubeUrl, title, artist }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(addError, data.error || "เพิ่มไม่สำเร็จ");
    } else {
      showSuccess(addSuccess, `✅ เพิ่ม "${data.title}" สำเร็จ`);
      document.getElementById("inputUrl").value    = "";
      document.getElementById("inputTitle").value  = "";
      document.getElementById("inputArtist").value = "";
      loadAdminSongs();
    }
  } catch {
    showError(addError, "เชื่อมต่อ server ไม่ได้");
  } finally {
    btn.disabled = false;
    btn.textContent = "เพิ่มเพลง";
  }
}

// ─── Delete Song ──────────────────────────────────────────────────────────
async function deleteSong(id, btn) {
  if (!confirm("ลบเพลงนี้?")) return;
  btn.disabled = true;
  btn.textContent = "...";

  try {
    const res = await fetch(`/api/songs/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session),
    });
    if (res.ok) {
      loadAdminSongs();
    } else {
      const d = await res.json();
      alert(d.error || "ลบไม่สำเร็จ");
      btn.disabled = false;
      btn.textContent = "ลบ";
    }
  } catch {
    alert("เชื่อมต่อ server ไม่ได้");
    btn.disabled = false;
    btn.textContent = "ลบ";
  }
}

window.deleteSong = deleteSong;

function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
