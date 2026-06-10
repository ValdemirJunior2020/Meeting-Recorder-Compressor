import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_MEETING_NAME = "Untitled Meeting";
const MIME_TYPE = "audio/webm;codecs=opus";

function formatTimer(totalSeconds) {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function normalizeMessage(error) {
  if (!error) return "Something went wrong.";
  return error.message || String(error);
}

function RecorderPanel({ apiBase, onSaved, serverOnline, onServerRetry }) {
  const [meetingName, setMeetingName] = useState("");
  const [meetingType, setMeetingType] = useState("Zoom");
  const [notes, setNotes] = useState("");
  const [compressionMode, setCompressionMode] = useState("smallest");
  const [audioSource, setAudioSource] = useState("microphone");
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [panelMessage, setPanelMessage] = useState("");
  const [panelError, setPanelError] = useState("");

  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const captureStreamRef = useRef(null);
  const recorderRef = useRef(null);
  const startedAtRef = useRef(null);
  const intervalRef = useRef(null);
  const latestDurationRef = useRef(0);
  const isRecordingRef = useRef(false);
  const isSavingRef = useRef(false);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  const stopAllTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (captureStreamRef.current) {
      captureStreamRef.current.getTracks().forEach((track) => track.stop());
      captureStreamRef.current = null;
    }
  }, []);

  const uploadRecording = useCallback(
    async (blob, durationSeconds) => {
      setIsSaving(true);
      setPanelError("");
      setPanelMessage("Saving and compressing...");

      try {
        const formData = new FormData();
        formData.append("meetingName", meetingName.trim() || DEFAULT_MEETING_NAME);
        formData.append("meetingType", meetingType);
        formData.append("notes", notes.trim());
        formData.append("compressionMode", compressionMode);
        formData.append("durationSeconds", String(durationSeconds));
        formData.append("audio", blob, "recording.webm");

        const response = await fetch(`${apiBase}/api/recordings`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "The recording could not be saved.");
        }

        setPanelMessage("Recording saved and compressed successfully.");
        await onSaved(data.meeting);
      } catch (error) {
        setPanelMessage("");
        setPanelError(normalizeMessage(error));
      } finally {
        setIsSaving(false);
      }
    },
    [apiBase, compressionMode, meetingName, meetingType, notes, onSaved]
  );

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current || isSavingRef.current) {
      return;
    }

    setPanelError("");
    setPanelMessage("");

    if (!serverOnline) {
      await onServerRetry();
    }

    try {
      if (!navigator.mediaDevices) {
        throw new Error("This browser does not support local audio recording.");
      }

      let recordingStream;

      if (audioSource === "screen") {
        if (!navigator.mediaDevices.getDisplayMedia) {
          throw new Error("This browser does not support tab/system audio capture.");
        }

        const captureStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        captureStreamRef.current = captureStream;

        const audioTracks = captureStream.getAudioTracks();
        if (!audioTracks.length) {
          stopAllTracks();
          throw new Error(
            "No audio track was shared. Choose a tab/window and enable Share audio when the browser asks."
          );
        }

        recordingStream = new MediaStream(audioTracks);
      } else {
        recordingStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
          },
          video: false,
        });
      }

      streamRef.current = recordingStream;
      chunksRef.current = [];

      const options = MediaRecorder.isTypeSupported(MIME_TYPE)
        ? { mimeType: MIME_TYPE }
        : undefined;

      const recorder = new MediaRecorder(recordingStream, options);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        setPanelError(event.error?.message || "MediaRecorder failed while recording.");
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        stopAllTracks();

        if (!blob.size) {
          setPanelError("The recording was empty. No audio data was captured.");
          setPanelMessage("");
          return;
        }

        await uploadRecording(blob, Math.max(1, latestDurationRef.current));
      };

      recorder.start(1000);
      startedAtRef.current = Date.now();
      latestDurationRef.current = 0;
      setElapsedSeconds(0);
      setIsRecording(true);
      setPanelMessage("Recording...");

      intervalRef.current = window.setInterval(() => {
        const nextElapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        latestDurationRef.current = nextElapsed;
        setElapsedSeconds(nextElapsed);
      }, 1000);
    } catch (error) {
      stopAllTracks();
      setIsRecording(false);
      setPanelMessage("");
      setPanelError(normalizeMessage(error));
    }
  }, [audioSource, onServerRetry, serverOnline, stopAllTracks, uploadRecording]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current || isSavingRef.current) {
      return;
    }

    latestDurationRef.current = Math.max(
      1,
      Math.floor((Date.now() - startedAtRef.current) / 1000)
    );

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsRecording(false);
    setPanelError("");
    setPanelMessage("Saving and compressing...");

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      stopAllTracks();
      setPanelError("No active recorder was found.");
      setPanelMessage("");
    }
  }, [stopAllTracks]);

  useEffect(() => {
    const handleShortcut = (event) => {
      const key = event.key?.toLowerCase();
      if (event.ctrlKey && event.shiftKey && key === "r") {
        event.preventDefault();
        event.stopPropagation();

        if (isRecordingRef.current) {
          stopRecording();
        } else {
          startRecording();
        }
      }
    };

    window.addEventListener("keydown", handleShortcut, true);
    return () => window.removeEventListener("keydown", handleShortcut, true);
  }, [startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      stopAllTracks();
    };
  }, [stopAllTracks]);

  const controlsLocked = isRecording || isSaving;

  return (
    <section className="card recorder-card">
      <div className="card-header">
        <div>
          <span className="eyebrow">Recorder</span>
          <h2>Capture meeting audio</h2>
        </div>
        <div className={`recording-badge ${isRecording ? "active" : ""}`}>
          <span className="recording-dot" />
          {isRecording ? "Recording" : "Idle"}
        </div>
      </div>

      {panelMessage && <div className="alert compact success">{panelMessage}</div>}
      {panelError && <div className="alert compact error">{panelError}</div>}

      <div className="timer-box">
        <span>Recording timer</span>
        <strong>{formatTimer(elapsedSeconds)}</strong>
      </div>

      <div className="form-grid two-columns">
        <label>
          Meeting name
          <input
            type="text"
            value={meetingName}
            placeholder="QA Calibration Meeting"
            onChange={(event) => setMeetingName(event.target.value)}
            disabled={controlsLocked}
          />
        </label>

        <label>
          Meeting type
          <select
            value={meetingType}
            onChange={(event) => setMeetingType(event.target.value)}
            disabled={controlsLocked}
          >
            <option>Zoom</option>
            <option>Microsoft Teams</option>
            <option>Google Meet</option>
            <option>Other</option>
          </select>
        </label>

        <label>
          Audio source
          <select
            value={audioSource}
            onChange={(event) => setAudioSource(event.target.value)}
            disabled={controlsLocked}
          >
            <option value="microphone">Microphone</option>
            <option value="screen">Tab / system audio when supported</option>
          </select>
        </label>

        <label>
          Compression quality
          <select
            value={compressionMode}
            onChange={(event) => setCompressionMode(event.target.value)}
            disabled={controlsLocked}
          >
            <option value="smallest">Smallest File</option>
            <option value="balanced">Balanced</option>
            <option value="better">Better Quality</option>
          </select>
        </label>
      </div>

      <label className="notes-label">
        Notes
        <textarea
          value={notes}
          placeholder="Discussed refunds, agent utilization, follow-up items..."
          onChange={(event) => setNotes(event.target.value)}
          disabled={controlsLocked}
        />
      </label>

      <div className="button-row recorder-actions">
        <button
          className={`primary-button ${isRecording ? "recording" : ""}`}
          type="button"
          onClick={startRecording}
          disabled={isRecording || isSaving}
        >
          {isRecording ? "Recording..." : "Start Recording"}
        </button>

        <button
          className="danger-button"
          type="button"
          onClick={stopRecording}
          disabled={!isRecording || isSaving}
        >
          Stop Recording
        </button>
      </div>

      <p className="hint-text">
        Shortcut: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd> toggles start/stop while this page is focused.
      </p>
    </section>
  );
}

export default RecorderPanel;
