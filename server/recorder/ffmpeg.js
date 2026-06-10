const { spawn } = require("child_process");
const path = require("path");

let ffmpegStaticPath = null;

try {
  ffmpegStaticPath = require("ffmpeg-static");
} catch {
  ffmpegStaticPath = null;
}

const FFMPEG_BINARY = ffmpegStaticPath || process.env.FFMPEG_PATH || "ffmpeg";

const MODES = {
  smallest: {
    extension: ".opus",
    args: ["-vn", "-ac", "1", "-ar", "16000", "-c:a", "libopus", "-b:a", "16k"],
  },
  balanced: {
    extension: ".opus",
    args: ["-vn", "-ac", "1", "-ar", "16000", "-c:a", "libopus", "-b:a", "24k"],
  },
  better: {
    extension: ".mp3",
    args: ["-vn", "-ac", "1", "-ar", "22050", "-acodec", "libmp3lame", "-b:a", "64k"],
  },
};

function normalizeCompressionMode(mode) {
  return MODES[mode] ? mode : "smallest";
}

function getOutputExtension(mode) {
  return MODES[normalizeCompressionMode(mode)].extension;
}

function compressAudio(inputPath, outputPath, mode = "smallest") {
  const normalizedMode = normalizeCompressionMode(mode);
  const preset = MODES[normalizedMode];

  return new Promise((resolve, reject) => {
    const args = ["-y", "-i", inputPath, ...preset.args, outputPath];
    const ffmpeg = spawn(FFMPEG_BINARY, args, {
      windowsHide: true,
    });

    let stderr = "";

    ffmpeg.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on("error", (error) => {
      const binaryName = path.basename(FFMPEG_BINARY || "ffmpeg");
      reject(
        new Error(
          `FFmpeg could not start using ${binaryName}. Install FFmpeg or run npm install again. ${error.message}`
        )
      );
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve({ outputPath, mode: normalizedMode });
        return;
      }

      const cleanError = stderr.trim().split("\n").slice(-8).join("\n");
      reject(new Error(`FFmpeg compression failed. ${cleanError}`));
    });
  });
}

module.exports = {
  compressAudio,
  getOutputExtension,
  normalizeCompressionMode,
};
