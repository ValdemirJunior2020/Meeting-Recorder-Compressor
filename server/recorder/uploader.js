const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

async function uploadToTranscriber(filePath, metadata = {}) {
  const uploadUrl = process.env.TRANSCRIBER_UPLOAD_URL;

  if (!uploadUrl || !uploadUrl.trim()) {
    const error = new Error("Transcriber upload URL is not configured.");
    error.statusCode = 400;
    throw error;
  }

  if (!fs.existsSync(filePath)) {
    const error = new Error("Compressed audio file was not found.");
    error.statusCode = 404;
    throw error;
  }

  const form = new FormData();
  form.append("audio", fs.createReadStream(filePath), path.basename(filePath));
  form.append("metadata", JSON.stringify(metadata));

  const response = await axios.post(uploadUrl, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 120000,
  });

  return {
    status: response.status,
    data: response.data,
  };
}

module.exports = {
  uploadToTranscriber,
};
