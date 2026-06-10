function ShortcutHelp() {
  return (
    <section className="card shortcut-card">
      <div className="card-header">
        <div>
          <span className="eyebrow">Shortcut</span>
          <h2>Fast start / stop</h2>
        </div>
      </div>

      <div className="shortcut-keys">
        <kbd>Ctrl</kbd>
        <span>+</span>
        <kbd>Shift</kbd>
        <span>+</span>
        <kbd>R</kbd>
      </div>

      <p className="hint-text">
        Press the shortcut once to start recording and again to stop. Duplicate recordings are blocked while a recording is active or saving.
      </p>
    </section>
  );
}

export default ShortcutHelp;
