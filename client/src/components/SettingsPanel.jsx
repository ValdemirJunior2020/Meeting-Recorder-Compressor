import { useState } from "react";

function SettingsPanel({ settings, onSave }) {
  const [endpoint, setEndpoint] = useState(settings.transcriberEndpoint || "");
  const [saved, setSaved] = useState(false);

  const save = () => {
    onSave({ ...settings, transcriberEndpoint: endpoint.trim() });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <section className="card settings-card">
      <div className="card-header">
        <div>
          <span className="eyebrow">Settings</span>
          <h2>Transcription endpoint</h2>
        </div>
      </div>

      <label>
        Upload endpoint preview
        <input
          type="url"
          value={endpoint}
          placeholder="https://your-transcriber.example.com/upload"
          onChange={(event) => setEndpoint(event.target.value)}
        />
      </label>

      <button className="secondary-button full-width" type="button" onClick={save}>
        Save endpoint setting
      </button>

      {saved && <div className="alert compact success">Endpoint setting saved locally.</div>}

      <p className="hint-text">
        This setting is stored in your browser localStorage and enables the Upload button.
        The actual backend upload still reads <code>TRANSCRIBER_UPLOAD_URL</code> from <code>server/.env</code>.
      </p>
    </section>
  );
}

export default SettingsPanel;
