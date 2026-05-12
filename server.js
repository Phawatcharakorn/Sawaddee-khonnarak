import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const ADMIN_USER = process.env.ADMIN_USER || "wave";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "wave2005";

// ─── Song Model ────────────────────────────────────────────────────────────
const songSchema = new mongoose.Schema({
  videoId: { type: String, required: true, unique: true },
  title:   { type: String, default: "Unknown" },
  artist:  { type: String, default: "Unknown" },
  order:   { type: Number, default: 0 },
  addedAt: { type: Date, default: Date.now },
});
const Song = mongoose.model("Song", songSchema);

// ─── Initial Songs ─────────────────────────────────────────────────────────
const INITIAL_IDS = [
  "ZwcmNkzm7m0", "7RWbq-lbBlk", "EGeFZHiQhKs", "zqS7JsbDZ4Y",
  "6O1aB3ooWtM", "MgY01n03QLU", "0dF1qj3kXHQ", "SqhHwymWLK0",
  "YVev0EXDSm0", "eGpJIsRfBFo", "3Nf5HriW9XA",
];

async function fetchYTMeta(videoId) {
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (!r.ok) return { title: videoId, artist: "Unknown" };
    const d = await r.json();
    return { title: d.title || videoId, artist: d.author_name || "Unknown" };
  } catch {
    return { title: videoId, artist: "Unknown" };
  }
}

async function seedSongs() {
  for (let i = 0; i < INITIAL_IDS.length; i++) {
    const videoId = INITIAL_IDS[i];
    if (await Song.findOne({ videoId })) continue;
    const meta = await fetchYTMeta(videoId);
    await Song.create({ videoId, title: meta.title, artist: meta.artist, order: i });
    console.log(`  ✅ ${meta.title}`);
  }
}

// ─── Connect DB ────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");
    console.log("🎵 Seeding songs...");
    await seedSongs();
    console.log("🎵 Done");
  })
  .catch((e) => console.error("❌ MongoDB:", e.message));

// ─── Express ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function dbReady(req, res, next) {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ error: "Database not ready" });
  next();
}

// GET /api/songs
app.get("/api/songs", dbReady, async (_req, res) => {
  const songs = await Song.find().sort({ order: 1, addedAt: 1 });
  res.json(songs);
});

// POST /api/admin/login — verify credentials
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body ?? {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
  }
});

// POST /api/songs — add song
app.post("/api/songs", async (req, res) => {
  const { username, password, youtubeUrl, title, artist } = req.body ?? {};
  if (username !== ADMIN_USER || password !== ADMIN_PASS)
    return res.status(401).json({ error: "Unauthorized" });

  const match = youtubeUrl?.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
  if (!match) return res.status(400).json({ error: "YouTube URL ไม่ถูกต้อง" });
  const videoId = match[1];

  if (await Song.findOne({ videoId }))
    return res.status(409).json({ error: "มีเพลงนี้แล้ว" });

  let t = title, a = artist;
  if (!t) {
    const meta = await fetchYTMeta(videoId);
    t = meta.title;
    a = a || meta.artist;
  }

  const count = await Song.countDocuments();
  const song = await Song.create({ videoId, title: t, artist: a || "Unknown", order: count });
  res.status(201).json(song);
});

// PATCH /api/songs/:id — update title/artist
app.patch("/api/songs/:id", async (req, res) => {
  const { username, password, title, artist } = req.body ?? {};
  if (username !== ADMIN_USER || password !== ADMIN_PASS)
    return res.status(401).json({ error: "Unauthorized" });
  const song = await Song.findByIdAndUpdate(
    req.params.id,
    { title, artist },
    { new: true }
  );
  if (!song) return res.status(404).json({ error: "Not found" });
  res.json(song);
});

// DELETE /api/songs/:id
app.delete("/api/songs/:id", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (username !== ADMIN_USER || password !== ADMIN_PASS)
    return res.status(401).json({ error: "Unauthorized" });
  await Song.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () =>
  console.log(`🎵 About-me server running on http://localhost:${PORT}`)
);
