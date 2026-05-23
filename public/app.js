/* ════════════════════════════════════════════
   WAVE PROFILE — app.js
   ════════════════════════════════════════════ */

// ─── Theme ────────────────────────────────────────────────────────────────
const html = document.documentElement;
html.dataset.theme = localStorage.getItem("theme") || "dark";
document.getElementById("themeToggle").addEventListener("click", () => {
  const next = html.dataset.theme === "dark" ? "light" : "dark";
  html.dataset.theme = next;
  localStorage.setItem("theme", next);
});

// ─── Birthday Countdown ───────────────────────────────────────────────────
const BDAY_MONTH = 2, BDAY_DAY = 14;
function updateCountdown() {
  const now = new Date();
  const label = document.getElementById("cdLabel");
  if (now.getMonth() + 1 === BDAY_MONTH && now.getDate() === BDAY_DAY) {
    label.textContent = "🎉 Happy Birthday Wave! 🎉";
    ["cd-days","cd-hours","cd-mins","cd-secs"].forEach(id => {
      document.getElementById(id).textContent = "00";
    });
    return;
  }
  label.textContent = "🎂 วันเกิดอีก";
  let bday = new Date(now.getFullYear(), BDAY_MONTH - 1, BDAY_DAY);
  if (bday <= now) bday = new Date(now.getFullYear() + 1, BDAY_MONTH - 1, BDAY_DAY);
  const diff = bday - now;
  document.getElementById("cd-days").textContent  = String(Math.floor(diff / 86400000)).padStart(2,"0");
  document.getElementById("cd-hours").textContent = String(Math.floor((diff % 86400000) / 3600000)).padStart(2,"0");
  document.getElementById("cd-mins").textContent  = String(Math.floor((diff % 3600000) / 60000)).padStart(2,"0");
  document.getElementById("cd-secs").textContent  = String(Math.floor((diff % 60000) / 1000)).padStart(2,"0");
}
updateCountdown();
setInterval(updateCountdown, 1000);

// ─── Player State ─────────────────────────────────────────────────────────
let songs      = [];
let shuffled   = [];
let currentIdx = 0;
let isShuffle  = false;
let isPlaying  = false;
let ytPlayer   = null;
let volVisible = false;
let progressInterval = null;

// ─── Elements ─────────────────────────────────────────────────────────────
const vinyl         = document.getElementById("vinyl");
const vinylArt      = document.getElementById("vinylArt");
const songTitle     = document.getElementById("songTitle");
const songArtist    = document.getElementById("songArtist");
const btnPlay       = document.getElementById("btnPlay");
const btnPrev       = document.getElementById("btnPrev");
const btnNext       = document.getElementById("btnNext");
const btnShuffle    = document.getElementById("btnShuffle");
const btnVol        = document.getElementById("btnVol");
const progressFill  = document.getElementById("progressFill");
const progressThumb = document.getElementById("progressThumb");
const progressBar   = document.getElementById("progressBar");
const curTime       = document.getElementById("curTime");
const durTime       = document.getElementById("durTime");
const playlist      = document.getElementById("playlist");
const volumeWrap    = document.getElementById("volumeWrap");
const volumeSlider  = document.getElementById("volumeSlider");

function formatTime(sec) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2,"0")}`;
}
function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ─── Load Songs ───────────────────────────────────────────────────────────
async function loadSongs() {
  try {
    const res = await fetch("/api/songs");
    songs = await res.json();
    rebuildShuffled();
    renderStories();
    renderPlaylist();
    if (songs.length > 0) updateSongDisplay(0);
  } catch {
    playlist.innerHTML = '<li class="playlist-loading">โหลดไม่สำเร็จ</li>';
  }
}

function rebuildShuffled() {
  shuffled = [...Array(songs.length).keys()];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
}

function getQueue() { return isShuffle ? shuffled : songs.map((_, i) => i); }

function updateSongDisplay(idx) {
  const song = songs[idx];
  if (!song) return;
  songTitle.textContent  = song.title;
  songArtist.textContent = song.artist;
  vinylArt.style.backgroundImage = `url(https://img.youtube.com/vi/${song.videoId}/mqdefault.jpg)`;
  document.querySelectorAll(".playlist-item").forEach((el, i) => {
    el.classList.toggle("active", i === idx);
  });
  const active = playlist.querySelector(".playlist-item.active");
  if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  updateMediaSession(song);
  syncStories();
}

function updateMediaSession(song) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title:  song.title,
    artist: song.artist,
    artwork: [{ src: `https://img.youtube.com/vi/${song.videoId}/mqdefault.jpg`, sizes: "320x180", type: "image/jpeg" }],
  });
}

function renderStories() {
  const wrap = document.getElementById("storiesScroll");
  if (!wrap || !songs.length) return;
  wrap.innerHTML = songs.map((s, i) => `
    <div class="story-item" data-idx="${i}">
      <div class="story-ring">
        <div class="story-img-wrap">
          <img class="story-img" src="https://img.youtube.com/vi/${s.videoId}/mqdefault.jpg" alt="" loading="lazy" />
        </div>
      </div>
      <span class="story-label">${escHtml(s.title)}</span>
    </div>
  `).join("");
  wrap.querySelectorAll(".story-item").forEach(el => {
    el.addEventListener("click", () => playSong(parseInt(el.dataset.idx)));
  });
  syncStories();
}

function syncStories() {
  document.querySelectorAll(".story-item").forEach((el, i) => {
    el.classList.toggle("active", i === currentIdx && isPlaying);
  });
  const active = document.querySelector(".story-item.active");
  if (active) active.scrollIntoView({ inline: "nearest", behavior: "smooth", block: "nearest" });
}

function renderPlaylist() {
  if (!songs.length) {
    playlist.innerHTML = '<li class="playlist-loading">ยังไม่มีเพลง</li>';
    return;
  }
  playlist.innerHTML = songs.map((s, i) => `
    <li class="playlist-item" data-idx="${i}">
      <span class="pl-index">${i + 1}</span>
      <span class="pl-playing-icon">♫</span>
      <img class="pl-thumb"
           src="https://img.youtube.com/vi/${s.videoId}/mqdefault.jpg"
           alt="" loading="lazy"
           onerror="this.style.background='#333'" />
      <div class="pl-info">
        <p class="pl-title">${escHtml(s.title)}</p>
        <p class="pl-artist">${escHtml(s.artist)}</p>
      </div>
    </li>
  `).join("");

  playlist.querySelectorAll(".playlist-item").forEach(el => {
    el.addEventListener("click", () => playSong(parseInt(el.dataset.idx)));
  });
}

// ─── YouTube IFrame API ───────────────────────────────────────────────────
window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player("yt-player", {
    height: "1", width: "1",
    videoId: songs[0]?.videoId || "ZwcmNkzm7m0",
    playerVars: { autoplay:0, controls:0, disablekb:1, enablejsapi:1,
                  modestbranding:1, rel:0, iv_load_policy:3, playsinline:1 },
    events: { onReady: onPlayerReady, onStateChange: onPlayerStateChange },
  });
};

function onPlayerReady() {
  ytPlayer.setVolume(parseInt(volumeSlider.value));
}

function onPlayerStateChange(e) {
  if (e.data === YT.PlayerState.ENDED)    { nextSong(); return; }
  if (e.data === YT.PlayerState.PLAYING)  { setPlaying(true); }
  if (e.data === YT.PlayerState.PAUSED)   { setPlaying(false); }
}

function setPlaying(state) {
  isPlaying = state;
  vinyl.classList.toggle("playing", state);
  btnPlay.querySelector(".icon-play").style.display  = state ? "none"  : "block";
  btnPlay.querySelector(".icon-pause").style.display = state ? "block" : "none";
  clearInterval(progressInterval);
  if (state) progressInterval = setInterval(updateProgress, 800);
  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = state ? "playing" : "paused";
  }
  syncStories();
}

function updateProgress() {
  if (!ytPlayer?.getCurrentTime) return;
  try {
    const cur = ytPlayer.getCurrentTime() || 0;
    const dur = ytPlayer.getDuration()    || 0;
    if (dur > 0) {
      const pct = (cur / dur) * 100;
      progressFill.style.width = pct + "%";
      progressThumb.style.left = pct + "%";
      curTime.textContent = formatTime(cur);
      durTime.textContent = formatTime(dur);
    }
  } catch {}
}

function playSong(idx) {
  if (!songs.length) return;
  currentIdx = ((idx % songs.length) + songs.length) % songs.length;
  updateSongDisplay(currentIdx);
  if (ytPlayer?.loadVideoById) {
    ytPlayer.loadVideoById(songs[currentIdx].videoId);
    setPlaying(true);
  }
  progressFill.style.width = "0%";
  progressThumb.style.left = "0%";
  curTime.textContent = "0:00";
  durTime.textContent = "0:00";
}

function nextSong() {
  const queue = getQueue();
  const pos = queue.indexOf(currentIdx);
  const nextPos = (pos + 1) % queue.length;
  playSong(queue[nextPos]);
}

function prevSong() {
  const queue = getQueue();
  const pos = queue.indexOf(currentIdx);
  const prevPos = (pos - 1 + queue.length) % queue.length;
  playSong(queue[prevPos]);
}

// ─── Controls ─────────────────────────────────────────────────────────────
btnPlay.addEventListener("click", () => {
  if (!ytPlayer) return;
  startAudioKeepalive();
  if (isPlaying) {
    ytPlayer.pauseVideo();
  } else {
    const state = ytPlayer.getPlayerState?.();
    if (state === -1 || state === 5 || state === undefined) playSong(currentIdx);
    else { ytPlayer.playVideo(); setPlaying(true); }
  }
});
btnNext.addEventListener("click", nextSong);
btnPrev.addEventListener("click", prevSong);

// Shuffle
btnShuffle.addEventListener("click", () => {
  isShuffle = !isShuffle;
  btnShuffle.classList.toggle("active", isShuffle);
  if (isShuffle) rebuildShuffled();
});

// Volume toggle
btnVol.addEventListener("click", () => {
  volVisible = !volVisible;
  volumeWrap.classList.toggle("visible", volVisible);
});

// Volume slider
volumeSlider.addEventListener("input", () => {
  const v = parseInt(volumeSlider.value);
  ytPlayer?.setVolume?.(v);
  const iconOn  = btnVol.querySelector(".icon-vol-on");
  const iconOff = btnVol.querySelector(".icon-vol-off");
  if (v === 0) {
    iconOn.style.display  = "none";
    iconOff.style.display = "block";
  } else {
    iconOn.style.display  = "block";
    iconOff.style.display = "none";
  }
});

// Seek
progressBar.addEventListener("click", e => {
  if (!ytPlayer?.getDuration) return;
  try {
    const rect = progressBar.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    const dur  = ytPlayer.getDuration();
    if (dur > 0) ytPlayer.seekTo(pct * dur, true);
  } catch {}
});

// ─── Admin Quick-Add Modal ─────────────────────────────────────────────────
const modalOverlay  = document.getElementById("modalOverlay");
const modalClose    = document.getElementById("modalClose");
const modalStepPass = document.getElementById("modalStepPass");
const modalStepAdd  = document.getElementById("modalStepAdd");
const modalPass     = document.getElementById("modalPass");
const modalPassErr  = document.getElementById("modalPassErr");
const modalUrl      = document.getElementById("modalUrl");
const modalAddErr   = document.getElementById("modalAddErr");
const modalAddOk    = document.getElementById("modalAddOk");
const modalLoginBtn = document.getElementById("modalLoginBtn");
const modalAddBtn   = document.getElementById("modalAddBtn");
const fabAdmin      = document.getElementById("fabAdmin");

let adminSession = { username: "", password: "" };
const storedUser = sessionStorage.getItem("adm_user");
const storedPass = sessionStorage.getItem("adm_pass");
if (storedUser && storedPass) adminSession = { username: storedUser, password: storedPass };

fabAdmin.addEventListener("click", () => {
  modalOverlay.classList.add("open");
  if (adminSession.password) {
    modalStepPass.style.display = "none";
    modalStepAdd.style.display  = "";
  } else {
    modalStepPass.style.display = "";
    modalStepAdd.style.display  = "none";
    setTimeout(() => modalPass.focus(), 300);
  }
});
modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", e => { if (e.target === modalOverlay) closeModal(); });
function closeModal() {
  modalOverlay.classList.remove("open");
  if (previewingEl) {
    previewingEl.classList.remove("previewing");
    previewingEl = null;
    if (isPlaying && songs[currentIdx]) ytPlayer?.loadVideoById?.(songs[currentIdx].videoId);
    else ytPlayer?.stopVideo?.();
  }
}

modalPass.addEventListener("keydown", e => { if (e.key === "Enter") doModalLogin(); });
modalLoginBtn.addEventListener("click", doModalLogin);

async function doModalLogin() {
  const pass = modalPass.value.trim();
  if (!pass) return;
  modalLoginBtn.disabled = true;
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "wave", password: pass }),
    });
    if (res.ok) {
      adminSession = { username: "wave", password: pass };
      sessionStorage.setItem("adm_user", "wave");
      sessionStorage.setItem("adm_pass", pass);
      modalStepPass.style.display = "none";
      modalStepAdd.style.display  = "";
      modalPass.value = "";
      setTimeout(() => modalUrl.focus(), 100);
    } else {
      modalPassErr.textContent = "รหัสผ่านไม่ถูกต้อง";
      modalPassErr.style.display = "block";
      setTimeout(() => (modalPassErr.style.display = "none"), 3000);
    }
  } catch {
    modalPassErr.textContent = "เชื่อมต่อ server ไม่ได้";
    modalPassErr.style.display = "block";
  } finally {
    modalLoginBtn.disabled = false;
  }
}

// ─── Search ───────────────────────────────────────────────────────────────
const modalSearch   = document.getElementById("modalSearch");
const btnSearch     = document.getElementById("btnSearch");
const searchResults = document.getElementById("searchResults");

async function doSearch() {
  const q = modalSearch.value.trim();
  if (!q) return;
  btnSearch.disabled = true;
  btnSearch.textContent = "...";
  searchResults.innerHTML = '<li style="color:var(--text-muted);font-size:12px;padding:8px 4px">กำลังค้นหา...</li>';
  try {
    const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!res.ok) { searchResults.innerHTML = `<li style="color:#ff6b6b;font-size:12px;padding:8px 4px">${data.error}</li>`; return; }
    if (!data.length) { searchResults.innerHTML = '<li style="color:var(--text-muted);font-size:12px;padding:8px 4px">ไม่พบเพลง</li>'; return; }
    searchResults.innerHTML = data.map(s => `
      <li class="sr-item" data-id="${s.videoId}" data-title="${escHtml(s.title)}" data-artist="${escHtml(s.artist)}">
        <div class="sr-thumb-wrap">
          <img class="sr-thumb" src="${s.thumb}" alt="" loading="lazy" />
          <div class="sr-preview-btn">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <div class="sr-info">
          <p class="sr-title">${escHtml(s.title)}</p>
          <p class="sr-artist">${escHtml(s.artist)}</p>
        </div>
        <button class="sr-add" title="เพิ่มเพลง">+</button>
      </li>
    `).join("");
    searchResults.querySelectorAll(".sr-item").forEach(el => {
      el.querySelector(".sr-add").addEventListener("click", () => addFromSearch(el));
      el.querySelector(".sr-thumb-wrap").addEventListener("click", () => previewSong(el));
    });
  } catch {
    searchResults.innerHTML = '<li style="color:#ff6b6b;font-size:12px;padding:8px 4px">เชื่อมต่อไม่ได้</li>';
  } finally {
    btnSearch.disabled = false;
    btnSearch.textContent = "ค้นหา";
  }
}

let previewingEl = null;

function previewSong(el) {
  const videoId = el.dataset.id;
  const isThisOne = previewingEl === el;

  // stop current preview
  if (previewingEl) {
    previewingEl.classList.remove("previewing");
    previewingEl.querySelector(".sr-preview-btn svg path").setAttribute("d", "M8 5v14l11-7z");
    previewingEl = null;
  }

  if (isThisOne) {
    // toggled off — restore original song if was playing
    if (isPlaying && songs[currentIdx]) ytPlayer?.loadVideoById?.(songs[currentIdx].videoId);
    else ytPlayer?.stopVideo?.();
    return;
  }

  // start preview
  el.classList.add("previewing");
  el.querySelector(".sr-preview-btn svg path").setAttribute("d", "M6 19h4V5H6v14zm8-14v14h4V5h-4z");
  previewingEl = el;
  startAudioKeepalive();
  ytPlayer?.loadVideoById?.(videoId);
}

async function addFromSearch(el) {
  const btn    = el.querySelector(".sr-add");
  const videoId = el.dataset.id;
  const title   = el.dataset.title;
  const artist  = el.dataset.artist;
  btn.disabled = true;
  btn.textContent = "✓";
  try {
    const res = await fetch("/api/songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...adminSession, youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`, title, artist }),
    });
    const data = await res.json();
    if (res.ok) {
      btn.style.background = "#6bffb8";
      btn.style.color = "#000";
      modalAddOk.textContent = `✅ เพิ่ม "${data.title}" แล้ว`;
      modalAddOk.style.display = "block";
      setTimeout(() => (modalAddOk.style.display = "none"), 3000);
      await loadSongs();
    } else {
      btn.disabled = false;
      btn.textContent = "+";
      modalAddErr.textContent = data.error || "เพิ่มไม่สำเร็จ";
      modalAddErr.style.display = "block";
      setTimeout(() => (modalAddErr.style.display = "none"), 3000);
    }
  } catch {
    btn.disabled = false;
    btn.textContent = "+";
  }
}

btnSearch.addEventListener("click", doSearch);
modalSearch.addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });

modalUrl.addEventListener("keydown", e => { if (e.key === "Enter") doModalAdd(); });
modalAddBtn.addEventListener("click", doModalAdd);

async function doModalAdd() {
  const youtubeUrl = modalUrl.value.trim();
  if (!youtubeUrl) return;
  modalAddBtn.disabled = true;
  modalAddBtn.textContent = "กำลังเพิ่ม...";
  try {
    const res = await fetch("/api/songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...adminSession, youtubeUrl }),
    });
    const data = await res.json();
    if (res.ok) {
      modalAddOk.textContent = `✅ เพิ่ม "${data.title}" แล้ว`;
      modalAddOk.style.display = "block";
      modalUrl.value = "";
      setTimeout(() => (modalAddOk.style.display = "none"), 3000);
      // Reload playlist
      await loadSongs();
    } else {
      modalAddErr.textContent = data.error || "เพิ่มไม่สำเร็จ";
      modalAddErr.style.display = "block";
      setTimeout(() => (modalAddErr.style.display = "none"), 3000);
    }
  } catch {
    modalAddErr.textContent = "เชื่อมต่อ server ไม่ได้";
    modalAddErr.style.display = "block";
  } finally {
    modalAddBtn.disabled = false;
    modalAddBtn.textContent = "เพิ่มเพลง";
  }
}

// ─── Media Session Action Handlers ────────────────────────────────────────
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play",          () => { ytPlayer?.playVideo?.(); setPlaying(true); });
  navigator.mediaSession.setActionHandler("pause",         () => { ytPlayer?.pauseVideo?.(); setPlaying(false); });
  navigator.mediaSession.setActionHandler("nexttrack",     nextSong);
  navigator.mediaSession.setActionHandler("previoustrack", prevSong);
}

// ─── Background Audio Keepalive ───────────────────────────────────────────
// Silent AudioContext prevents browser from suspending audio when screen locks
let _audioCtx = null;
function startAudioKeepalive() {
  if (_audioCtx) return;
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(_audioCtx.destination);
    osc.start();
  } catch {}
}

// Resume playback if browser paused it during screen lock
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isPlaying && ytPlayer?.playVideo) {
    setTimeout(() => { try { ytPlayer.playVideo(); } catch {} }, 300);
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────
loadSongs();
