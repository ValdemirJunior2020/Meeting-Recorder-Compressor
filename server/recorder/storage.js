const fs = require("fs");
const path = require("path");

const SERVER_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(SERVER_ROOT, "data");
const RAW_DIR = path.join(SERVER_ROOT, "recordings", "raw");
const COMPRESSED_DIR = path.join(SERVER_ROOT, "recordings", "compressed");
const MEETINGS_FILE = path.join(DATA_DIR, "meetings.json");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureStorage() {
  ensureDir(DATA_DIR);
  ensureDir(RAW_DIR);
  ensureDir(COMPRESSED_DIR);

  if (!fs.existsSync(MEETINGS_FILE)) {
    fs.writeFileSync(MEETINGS_FILE, "[]\n", "utf8");
  }
}

function loadMeetings() {
  ensureStorage();

  try {
    const raw = fs.readFileSync(MEETINGS_FILE, "utf8");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    fs.writeFileSync(MEETINGS_FILE, "[]\n", "utf8");
    return [];
  }
}

function saveMeetings(meetings) {
  ensureStorage();
  fs.writeFileSync(MEETINGS_FILE, `${JSON.stringify(meetings, null, 2)}\n`, "utf8");
}

function addMeeting(meeting) {
  const meetings = loadMeetings();
  const nextMeetings = [meeting, ...meetings];
  saveMeetings(nextMeetings);
  return meeting;
}

function deleteMeeting(id) {
  const meetings = loadMeetings();
  const meeting = meetings.find((item) => item.id === id);

  if (!meeting) {
    return null;
  }

  const nextMeetings = meetings.filter((item) => item.id !== id);
  saveMeetings(nextMeetings);
  return meeting;
}

module.exports = {
  SERVER_ROOT,
  DATA_DIR,
  RAW_DIR,
  COMPRESSED_DIR,
  MEETINGS_FILE,
  ensureStorage,
  loadMeetings,
  saveMeetings,
  addMeeting,
  deleteMeeting,
};
