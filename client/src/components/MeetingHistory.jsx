import { useState } from "react";

function formatDate(dateValue) {
  if (!dateValue) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateValue));
}

function formatDuration(seconds) {
  const value = Number(seconds || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainingSeconds = value % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function modeLabel(mode) {
  if (mode === "balanced") return "Balanced";
  if (mode === "better") return "Better Quality";
  return "Smallest File";
}

function MeetingHistory({
  apiBase,
  meetings,
  loading,
  reloadMeetings,
  transcriberEndpoint,
  setGlobalMessage,
  setGlobalError,
}) {
  const [busyId, setBusyId] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const copyPath = async (meeting) => {
    try {
      await navigator.clipboard.writeText(meeting.compressedPath || "");
      setCopiedId(meeting.id);
      setGlobalMessage("Compressed file path copied.");
      setGlobalError("");
      window.setTimeout(() => setCopiedId(""), 2000);
    } catch {
      setGlobalError("Could not copy the file path.");
    }
  };


  const openFolder = async (meeting) => {
    setBusyId(meeting.id);
    setGlobalError("");
    setGlobalMessage("");

    try {
      const response = await fetch(`${apiBase}/api/meetings/${meeting.id}/open-folder`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Could not open the compressed file location.");
      }

      setGlobalMessage(data?.message || "Compressed file location opened.");
    } catch (error) {
      setGlobalError(error.message || "Could not open the compressed file location.");
    } finally {
      setBusyId("");
    }
  };

  const deleteMeeting = async (meeting) => {
    const confirmed = window.confirm(
      `Delete this meeting and its saved audio files?\n\n${meeting.meetingName}`
    );

    if (!confirmed) return;

    setBusyId(meeting.id);
    setGlobalError("");

    try {
      const response = await fetch(`${apiBase}/api/meetings/${meeting.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Could not delete the meeting.");
      }

      setGlobalMessage("Meeting deleted.");
      await reloadMeetings();
    } catch (error) {
      setGlobalError(error.message || "Could not delete the meeting.");
    } finally {
      setBusyId("");
    }
  };

  const uploadToTranscriber = async (meeting) => {
    setBusyId(meeting.id);
    setGlobalError("");
    setGlobalMessage("");

    try {
      const response = await fetch(
        `${apiBase}/api/meetings/${meeting.id}/upload-to-transcriber`,
        { method: "POST" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Could not upload to the transcription tool.");
      }

      setGlobalMessage(data?.message || "Compressed audio uploaded to transcription tool.");
    } catch (error) {
      setGlobalError(error.message || "Could not upload to the transcription tool.");
    } finally {
      setBusyId("");
    }
  };

  const hasTranscriberEndpoint = Boolean(transcriberEndpoint?.trim());

  return (
    <section className="card history-card">
      <div className="card-header history-header">
        <div>
          <span className="eyebrow">History</span>
          <h2>Saved meetings</h2>
        </div>
        <button className="secondary-button" type="button" onClick={reloadMeetings}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="empty-state">Loading meeting history...</div>
      ) : meetings.length === 0 ? (
        <div className="empty-state">
          No recordings yet. Start your first meeting recording above.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Meeting</th>
                <th>Type</th>
                <th>Duration</th>
                <th>Mode</th>
                <th>Size</th>
                <th>Savings</th>
                <th>Compressed path</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((meeting) => (
                <tr key={meeting.id}>
                  <td>{formatDate(meeting.createdAt)}</td>
                  <td>
                    <strong>{meeting.meetingName}</strong>
                    {meeting.notes && <p className="table-note">{meeting.notes}</p>}
                  </td>
                  <td>{meeting.meetingType}</td>
                  <td>{formatDuration(meeting.durationSeconds)}</td>
                  <td>
                    <span className={`badge mode-${meeting.compressionMode || "smallest"}`}>
                      {modeLabel(meeting.compressionMode)}
                    </span>
                  </td>
                  <td>
                    <div className="size-stack">
                      <span>Raw: {meeting.rawSizeMB} MB</span>
                      <span>Compressed: {meeting.compressedSizeMB} MB</span>
                    </div>
                  </td>
                  <td>
                    <span className="savings-pill">{meeting.savingsPercent}%</span>
                  </td>
                  <td>
                    <code className="path-code">{meeting.compressedPath}</code>
                  </td>
                  <td>
                    <div className="table-actions">
                      <a
                        className="mini-button"
                        href={`${apiBase}/api/meetings/${meeting.id}/download`}
                      >
                        Download
                      </a>
                      <button
                        className="mini-button"
                        type="button"
                        onClick={() => copyPath(meeting)}
                      >
                        {copiedId === meeting.id ? "Copied" : "Copy Path"}
                      </button>
                      <button
                        className="mini-button"
                        type="button"
                        disabled={busyId === meeting.id}
                        onClick={() => openFolder(meeting)}
                      >
                        Open Folder
                      </button>
                      <button
                        className="mini-button"
                        type="button"
                        disabled={!hasTranscriberEndpoint || busyId === meeting.id}
                        title={
                          hasTranscriberEndpoint
                            ? "Send compressed file to backend transcriber endpoint"
                            : "Add your endpoint in Settings first"
                        }
                        onClick={() => uploadToTranscriber(meeting)}
                      >
                        Upload
                      </button>
                      <button
                        className="mini-button danger-mini"
                        type="button"
                        disabled={busyId === meeting.id}
                        onClick={() => deleteMeeting(meeting)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default MeetingHistory;
