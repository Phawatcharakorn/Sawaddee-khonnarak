/* ════════════════════════════════════════════
   WAVE PROFILE — app.js
   ════════════════════════════════════════════ */

// ─── Theme Toggle ─────────────────────────────────────────────────────────
const html = document.documentElement;
const themeToggle = document.getElementById("themeToggle");

const savedTheme = localStorage.getItem("theme") || "dark";
html.dataset.theme = savedTheme;

themeToggle.addEventListener("click", () => {
  const next = html.dataset.theme === "dark" ? "light" : "dark";
  html.dataset.theme = next;
  localStorage.setItem("theme", next);
});

// ─── Birthday Countdown ───────────────────────────────────────────────────
const BDAY_MONTH = 2;  // February
const BDAY_DAY   = 14;

function updateCountdown() {
  const now     = new Date();
  const thisYear = now.getFullYear();
  let bday = new Date(thisYear, BDAY_MONTH - 1, BDAY_DAY, 0, 0, 0);
  if (bday <= now) bday = new Date(thisYear + 1, BDAY_MONTH - 1, BDAY_DAY, 0, 0, 0);

  const label = document.getElementById("cdLabel");

  // Check if today IS the birthday
  if (now.getMonth() + 1 === BDAY_MONTH && now.getDate() === BDAY_DAY) {
    label.textContent = "🎉 Happy Birthday! วันนี้วันเกิดเลย!";
    ["cd-days","cd-hours","cd-mins","cd-secs"].forEach(id => {
      document.getElementById(id).textContent = "00";
    });
    return;
  }

  label.textContent = "🎂 วันเกิดอีก";

  const diff = bday - now;
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins  = Math.floor((diff % 3600000)  / 60000);
  const secs  = Math.floor((diff % 60000)    / 1000);

  document.getElementById("cd-days").textContent  = String(days).padStart(2,"0");
  document.getElementById("cd-hours").textContent = String(hours).padStart(2,"0");
  document.getElementById("cd-mins").textContent  = String(mins).padStart(2,"0");
  document.getElementById("cd-secs").textContent  = String(secs).padStart(2,"0");
}

updateCountdown();
setInterval(updateCountdown, 1000);

// ─── Music Player ─────────────────────────────────────────────────────────
let songs = [];
let currentIdx = 0;
let ytPlayer = null;
let isPlaying = false;
let progressInterval = null;

const vinyl      = document.getElementById("vinyl");
const vinylArt   = document.getElementById("vinylArt");
const songTitle  = document.getElementById("songTitle");
const songArtist = document.getElementById("songArtist");
const btnPlay    = document.getElementById("btnPlay");
const btnPrev    = document.getElementById("btnPrev");
const btnNext    = document.getElementById("btnNext");
const progressFill  = document.getElementById("progressFill");
const progressThumb = document.getElementById("progressThumb");
const progressBar   = document.getElementById("progressBar");
const curTime    = document.getElementById("curTime");
const durTime    = document.getElementById("durTime");
const playlist   = document.getElementById("playlist");

function formatTime(sec) {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// Load songs from API
async function loadSongs() {
  try {
    const res = await fetch("/api/songs");
    songs = await res.json();
    renderPlaylist();
    if (songs.length > 0) updateSongDisplay(0);
  } catch (e) {
    playlist.innerHTML = '<li class="playlist-loading">โหลดไม่สำเร็จ</li>';
  }
}

function updateSongDisplay(idx) {
  const song = songs[idx];
  if (!song) return;
  songTitle.textContent  = song.title;
  songArtist.textContent = song.artist;
  vinylArt.src = `https://img.youtube.com/vi/${song.videoId}/hqdefault.jpg`;
  vinylArt.onerror = () => {
    vinylArt.src = `https://img.youtube.com/vi/${song.videoId}/mqdefault.jpg`;
  };

  // Highlight active in playlist
  document.querySelectorAll(".playlist-item").forEach((el, i) => {
    el.classList.toggle("active", i === idx);
  });
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
      <img class="pl-thumb" src="https://img.youtube.com/vi/${s.videoId}/mqdefault.jpg" alt="" loading="lazy" onerror="this.style.background='#333'"/>
      <div class="pl-info">
        <p class="pl-title">${escHtml(s.title)}</p>
        <p class="pl-artist">${escHtml(s.artist)}</p>
      </div>
    </li>
  `).join("");

  playlist.querySelectorAll(".playlist-item").forEach(el => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.idx);
      playSong(idx);
    });
  });
}

function escHtml(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ─── YouTube IFrame API ───────────────────────────────────────────────────
window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player("yt-player", {
    height: "1",
    width: "1",
    videoId: songs[0]?.videoId || "ZwcmNkzm7m0",
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      enablejsapi: 1,
      modestbranding: 1,
      rel: 0,
      iv_load_policy: 3,
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
    },
  });
};

function onPlayerReady() {
  // Player is ready
}

function onPlayerStateChange(e) {
  if (e.data === YT.PlayerState.ENDED) {
    nextSong();
  }
  if (e.data === YT.PlayerState.PLAYING) {
    setPlaying(true);
  }
  if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.BUFFERING) {
    if (e.data === YT.PlayerState.PAUSED) setPlaying(false);
  }
}

function setPlaying(state) {
  isPlaying = state;
  vinyl.classList.toggle("playing", state);

  const iconPlay  = btnPlay.querySelector(".icon-play");
  const iconPause = btnPlay.querySelector(".icon-pause");
  iconPlay.style.display  = state ? "none"  : "block";
  iconPause.style.display = state ? "block" : "none";

  if (state) {
    progressInterval = setInterval(updateProgress, 800);
  } else {
    clearInterval(progressInterval);
  }
}

function updateProgress() {
  if (!ytPlayer || !ytPlayer.getCurrentTime) return;
  try {
    const cur = ytPlayer.getCurrentTime() || 0;
    const dur = ytPlayer.getDuration()    || 0;
    if (dur > 0) {
      const pct = (cur / dur) * 100;
      progressFill.style.width        = pct + "%";
      progressThumb.style.left        = pct + "%";
      curTime.textContent = formatTime(cur);
      durTime.textContent = formatTime(dur);
    }
  } catch {}
}

function playSong(idx) {
  if (!songs.length) return;
  currentIdx = ((idx % songs.length) + songs.length) % songs.length;
  updateSongDisplay(currentIdx);
  if (ytPlayer && ytPlayer.loadVideoById) {
    ytPlayer.loadVideoById(songs[currentIdx].videoId);
    setPlaying(true);
  }
  progressFill.style.width = "0%";
  progressThumb.style.left = "0%";
  curTime.textContent = "0:00";
  durTime.textContent = "0:00";
}

function nextSong() { playSong(currentIdx + 1); }
function prevSong() { playSong(currentIdx - 1); }

// Controls
btnPlay.addEventListener("click", () => {
  if (!ytPlayer) return;
  if (isPlaying) {
    ytPlayer.pauseVideo();
  } else {
    if (ytPlayer.getPlayerState() === -1 || ytPlayer.getPlayerState() === 5) {
      playSong(currentIdx);
    } else {
      ytPlayer.playVideo();
      setPlaying(true);
    }
  }
});

btnNext.addEventListener("click", nextSong);
btnPrev.addEventListener("click", prevSong);

// Seek on progress bar click
progressBar.addEventListener("click", (e) => {
  if (!ytPlayer || !ytPlayer.getDuration) return;
  try {
    const rect = progressBar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const dur = ytPlayer.getDuration();
    if (dur > 0) {
      ytPlayer.seekTo(pct * dur, true);
    }
  } catch {}
});

// ─── Init ─────────────────────────────────────────────────────────────────
loadSongs();
