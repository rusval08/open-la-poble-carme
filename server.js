const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
const DATA_FILE = process.env.DATA_FILE ? path.resolve(process.env.DATA_FILE) : path.join(DATA_DIR, "campionat-data.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "2026";
const ADMIN_SECRET = process.env.ADMIN_SECRET || crypto.createHash("sha256").update(`${ADMIN_PASSWORD}:open-la-pobla`).digest("hex");

const clients = new Set();
const pendingFinishTimers = new Map();
let lastBackupAt = 0;
const SCOREBOARD_COUNT = 6;
const PLAYER_COUNT = 128;
const RECTIFICATION_MS = 20000;
const MANUAL_ROUNDS = [
  ["r128", 64],
  ["r64", 32],
  ["r32", 16],
  ["r16", 8],
  ["qf", 4],
  ["sf", 2],
  ["final", 1],
];
const ROUND_KEYS = MANUAL_ROUNDS.map(([key]) => key);

function defaultPlayers() {
  return Array.from({ length: PLAYER_COUNT }, (_, index) => ({
    seed: index + 1,
    name: "",
  }));
}

function normalizePlayerName(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value.name === "string") return value.name.trim();
  return "";
}

function defaultBracketManual() {
  return Object.fromEntries(
    MANUAL_ROUNDS.map(([key, count]) => [
      key,
      Array.from({ length: count }, () => ({
        top: "",
        bottom: "",
        table: "",
        winner: "",
        score: "",
        topManual: false,
        bottomManual: false,
      })),
    ]),
  );
}

function loadSavedData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    return {};
  }
}

function saveData() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const payload = JSON.stringify(
      {
        scoreboards: state.scoreboards,
        players: state.players,
        bracketManual: state.bracketManual,
      },
      null,
      2,
    );
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, payload);
    fs.renameSync(tempFile, DATA_FILE);
    writeBackupSnapshot(payload);
  } catch (error) {
    console.error("No s'han pogut guardar les dades:", error.message);
  }
}

function writeBackupSnapshot(payload) {
  const now = Date.now();
  if (now - lastBackupAt < 5 * 60 * 1000) return;
  lastBackupAt = now;
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date(now).toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(path.join(BACKUP_DIR, `campionat-${stamp}.json`), payload);
  } catch (error) {
    console.error("No s'ha pogut crear backup:", error.message);
