require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { spawn } = require("child_process");

const {
  RAW_DIR,
  COMPRESSED_DIR,
  ensureStorage,
  loadMeetings,
  addMeeting,
  deleteMeeting,
} = require("./recorder/storage");
const {
  compressAudio,
  getOutputExtension,
  normalizeCompressionMode,
} = require("./recorder/ffmpeg");
const { uploadToTranscriber } = require("./recorder/uploader");

const PORT = Number(process.env.PORT || 8080);
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

ensureStorage();

app.use(cors());
app.use(express.json());

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function slugify(value) {
  return String(value || "meeting")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "meeting";
}

function safeTimestamp(date = new Date()) {
  const pad = (number) => String(number).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function sizeInMB(bytes) {
  return Number((bytes / (1024 * 1024)).toFixed(2));
}

function savingsPercent(rawBytes, compressedBytes) {
  if (!rawBytes || rawBytes <= 0) return 0;
  const savings = ((rawBytes - compressedBytes) / rawBytes) * 100;
  return Number(Math.max(0, savings).toFixed(1));
}

function removeFileIfExists(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(`Could not delete file ${filePath}:`, error.message);
  }
}


function openCompressedFileLocation(filePath) {
  return new Promise((resolve, reject) => {
    if (!filePath || !fs.existsSync(filePath)) {
      reject(new Error("Compressed audio file was not found."));
      return;
    }

    const platform = process.platform;
    let command;
    let args;

    if (platform === "win32") {
      command = "explorer.exe";
      args = [`/select,${filePath}`];
    } else if (platform === "darwin") {
      command = "open";
      args = ["-R", filePath];
    } else {
      command = "xdg-open";
      args = [path.dirname(filePath)];
    }

    const opener = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });

    opener.on("error", reject);
    opener.unref();
    resolve();
  });
}

function publicMeeting(meeting) {
  return meeting;
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "Meeting Recorder + Compressor",
    serverTime: new Date().toISOString(),
  });
});

app.post(
  "/api/recordings",
  upload.single("audio"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Audio file is required." });
    }

    const id = uuidv4();
    const meetingName = String(req.body.meetingName || "Untitled Meeting").trim() || "Untitled Meeting";
    const meetingType = String(req.body.meetingType || "Other").trim() || "Other";
    const notes = String(req.body.notes || "").trim();
    const compressionMode = normalizeCompressionMode(req.body.compressionMode);
    const durationSeconds = Math.max(0, Number.parseInt(req.body.durationSeconds || "0", 10) || 0);
    const createdAt = new Date().toISOString();

    const baseName = `${safeTimestamp()}-${slugify(meetingName)}-${id.slice(0, 8)}`;
    const rawFilename = `${baseName}-raw.webm`;
    const outputExtension = getOutputExtension(compressionMode);
    const compressedFilename = `${baseName}-compressed${outputExtension}`;

    const rawPath = path.join(RAW_DIR, rawFilename);
    const compressedPath = path.join(COMPRESSED_DIR, compressedFilename);

    try {
      fs.writeFileSync(rawPath, req.file.buffer);

      await compressAudio(rawPath, compressedPath, compressionMode);

      const rawStats = fs.statSync(rawPath);
      const compressedStats = fs.statSync(compressedPath);

      const meeting = {
        id,
        meetingName,
        meetingType,
        notes,
        createdAt,
        durationSeconds,
        rawFilename,
        compressedFilename,
        rawPath,
        compressedPath,
        rawSizeMB: sizeInMB(rawStats.size),
        compressedSizeMB: sizeInMB(compressedStats.size),
        savingsPercent: savingsPercent(rawStats.size, compressedStats.size),
        compressionMode,
      };

      addMeeting(meeting);

      return res.status(201).json({
        message: "Recording saved and compressed successfully.",
        meeting: publicMeeting(meeting),
      });
    } catch (error) {
      removeFileIfExists(rawPath);
      removeFileIfExists(compressedPath);
      throw error;
    }
  })
);

app.get(
  "/api/meetings",
  asyncHandler(async (req, res) => {
    const meetings = loadMeetings().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json({ meetings: meetings.map(publicMeeting) });
  })
);

app.get(
  "/api/meetings/:id/download",
  asyncHandler(async (req, res) => {
    const meeting = loadMeetings().find((item) => item.id === req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: "Meeting was not found." });
    }

    if (!meeting.compressedPath || !fs.existsSync(meeting.compressedPath)) {
      return res.status(404).json({ message: "Compressed audio file was not found." });
    }

    return res.download(meeting.compressedPath, meeting.compressedFilename);
  })
);


app.post(
  "/api/meetings/:id/open-folder",
  asyncHandler(async (req, res) => {
    const meeting = loadMeetings().find((item) => item.id === req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: "Meeting was not found." });
    }

    await openCompressedFileLocation(meeting.compressedPath);

    return res.json({ message: "Compressed file location opened." });
  })
);

app.delete(
  "/api/meetings/:id",
  asyncHandler(async (req, res) => {
    const deleted = deleteMeeting(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Meeting was not found." });
    }

    removeFileIfExists(deleted.rawPath);
    removeFileIfExists(deleted.compressedPath);

    return res.json({ message: "Meeting deleted.", meeting: publicMeeting(deleted) });
  })
);

app.post(
  "/api/meetings/:id/upload-to-transcriber",
  asyncHandler(async (req, res) => {
    const meeting = loadMeetings().find((item) => item.id === req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: "Meeting was not found." });
    }

    if (!meeting.compressedPath || !fs.existsSync(meeting.compressedPath)) {
      return res.status(404).json({ message: "Compressed audio file was not found." });
    }

    const result = await uploadToTranscriber(meeting.compressedPath, meeting);

    return res.json({
      message: "Compressed audio uploaded to transcription tool.",
      uploadStatus: result.status,
      response: result.data,
    });
  })
);

app.use((req, res) => {
  res.status(404).json({ message: "Endpoint was not found." });
});

app.use((error, req, res, next) => {
  console.error(error);

  const statusCode = error.statusCode || 500;
  const message =
    error.message || "Unexpected server error while processing your recording.";

  res.status(statusCode).json({ message });
});

app.listen(PORT, () => {
  console.log(`Meeting Recorder + Compressor backend running on http://localhost:${PORT}`);
});
