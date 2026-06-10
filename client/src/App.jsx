import { useCallback, useEffect, useState } from "react";
import RecorderPanel from "./components/RecorderPanel.jsx";
import MeetingHistory from "./components/MeetingHistory.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import ShortcutHelp from "./components/ShortcutHelp.jsx";

const API_BASE = "http://localhost:8080";
const SETTINGS_KEY = "meeting_recorder_settings";

function readSettings() {
  try {
    const saved = window.localStorage.getItem(SETTINGS_KEY);
    if (!saved) {
      return { transcriberEndpoint: "" };
    }
    return { transcriberEndpoint: "", ...JSON.parse(saved) };
  } catch {
    return { transcriberEndpoint: "" };
  }
}

function App() {
  const [meetings, setMeetings] = useState([]);
  const [settings, setSettings] = useState(readSettings);
  const [serverOnline, setServerOnline] = useState(false);
  const [globalMessage, setGlobalMessage] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [loadingMeetings, setLoadingMeetings] = useState(false);

  const saveSettings = useCallback((nextSettings) => {
    setSettings(nextSettings);
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/health`);
      if (!response.ok) {
        throw new Error("Backend health check failed.");
      }
      setServerOnline(true);
    } catch {
      setServerOnline(false);
    }
  }, []);

  const loadMeetings = useCallback(async () => {
    setLoadingMeetings(true);
    setGlobalError("");

    try {
      const response = await fetch(`${API_BASE}/api/meetings`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Could not load meeting history.");
      }

      setMeetings(Array.isArray(data.meetings) ? data.meetings : []);
    } catch (error) {
      setGlobalError(error.message || "Could not load meeting history.");
    } finally {
      setLoadingMeetings(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    loadMeetings();
  }, [checkHealth, loadMeetings]);

  const handleRecordingSaved = useCallback(
    async (meeting) => {
      setGlobalError("");
      setGlobalMessage("Recording saved and compressed successfully.");
      await loadMeetings();

      window.setTimeout(() => {
        setGlobalMessage((current) =>
          current === "Recording saved and compressed successfully." ? "" : current
        );
      }, 5000);

      return meeting;
    },
    [loadMeetings]
  );

  return (
    <main className="app-shell">
      <header className="hero-card">
        <div>
          <span className="eyebrow">Local desktop-style web app</span>
          <h1>Meeting Recorder + Compressor</h1>
          <p>
            Record meeting audio locally, compress it with FFmpeg, keep history,
            and prepare files for your transcription workflow.
          </p>
        </div>

        <div className={`server-pill ${serverOnline ? "online" : "offline"}`}>
          <span className="status-dot" />
          {serverOnline ? "Backend online" : "Backend offline"}
        </div>
      </header>

      {globalMessage && <div className="alert success">{globalMessage}</div>}
      {globalError && <div className="alert error">{globalError}</div>}

      <section className="dashboard-grid">
        <div className="left-column">
          <RecorderPanel
            apiBase={API_BASE}
            onSaved={handleRecordingSaved}
            serverOnline={serverOnline}
            onServerRetry={checkHealth}
          />
          <ShortcutHelp />
        </div>

        <div className="right-column">
          <SettingsPanel settings={settings} onSave={saveSettings} />
        </div>
      </section>

      <MeetingHistory
        apiBase={API_BASE}
        meetings={meetings}
        loading={loadingMeetings}
        reloadMeetings={loadMeetings}
        transcriberEndpoint={settings.transcriberEndpoint}
        setGlobalMessage={setGlobalMessage}
        setGlobalError={setGlobalError}
      />
    </main>
  );
}

export default App;
