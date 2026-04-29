#!/usr/bin/env bash
# Rebuild index.html — the self-contained single-file demo.
#
# What this does:
#   1. Bundles src/DateTimePicker.tsx + a small Demo wrapper into one ESM
#      JavaScript file via esbuild (React + react-dom kept external).
#   2. Inlines that JS, the source CSS, and a tiny HTML scaffold into
#      index.html. The result has no <link>/<script src=…> to local
#      files — only an importmap pointing at esm.sh for React.
#
# Run after editing src/DateTimePicker.tsx or src/DateTimePicker.css.
# Requires: bash, sed, npx (any modern Node.js).

set -euo pipefail
cd "$(dirname "$0")"

echo "[1/3] Bundling demo via esbuild…"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

# Prepare a temporary build dir: source TSX with the CSS-import line stripped
# (CSS lives inline in the final HTML), plus a small Demo entry.
sed "/^import '.\/DateTimePicker.css';$/d" src/DateTimePicker.tsx > "$TMPDIR/DateTimePicker.tsx"
cat > "$TMPDIR/demo.tsx" <<'TSX'
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DateTimePicker } from './DateTimePicker.tsx';

function Demo() {
  const [value, setValue] = useState<string>('');
  const [disabled, setDisabled] = useState<boolean>(false);
  const fmt = (s: string): string => {
    if (!s) return '(leer)';
    const d = new Date(s);
    return Number.isNaN(d.getTime())
      ? '(invalid)'
      : d.toLocaleString('de-CH', { dateStyle: 'long', timeStyle: 'short' });
  };
  return (
    <div className="demo-card">
      <div className="demo-row">
        <label htmlFor="dtp-demo">Datum &amp; Zeit:</label>
        <DateTimePicker id="dtp-demo" value={value} onChange={setValue} disabled={disabled} />
      </div>
      <div className="demo-row">
        <label>Wert (raw):</label>
        <span className="demo-output">{value || '(leer)'}</span>
      </div>
      <div className="demo-row">
        <label>Lesbar:</label>
        <span>{fmt(value)}</span>
      </div>
      <div className="demo-buttons">
        <button className="demo-btn primary" onClick={() => setValue(new Date().toISOString().slice(0, 16))}>
          Jetzt
        </button>
        <button className="demo-btn" onClick={() => setValue('')}>
          Zurücksetzen
        </button>
        <button className="demo-btn" onClick={() => setDisabled((d) => !d)}>
          {disabled ? 'Aktivieren' : 'Deaktivieren'}
        </button>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Demo />);
TSX

npx --yes esbuild@0.28.0 \
  --bundle "$TMPDIR/demo.tsx" \
  --outfile="$TMPDIR/bundle.js" \
  --format=esm \
  --target=es2022 \
  --jsx=automatic \
  --jsx-import-source=react \
  --external:react \
  --external:react-dom/client \
  --external:react/jsx-runtime \
  --log-level=warning

BUNDLE_BYTES=$(wc -c < "$TMPDIR/bundle.js")
echo "    bundle: ${BUNDLE_BYTES} bytes"

echo "[2/3] Composing index.html…"
CSS=$(cat src/DateTimePicker.css)
BUNDLE=$(cat "$TMPDIR/bundle.js")

{
cat <<'HEADER'
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DateTimePicker — Demo</title>
  <style>
HEADER
echo "$CSS"
cat <<'STYLE_END'
    /* --- Demo wrapper --- */
    body {
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 680px;
      margin: 40px auto;
      padding: 0 20px;
      color: #111827;
      background: #ffffff;
    }
    h1 { font-size: 24px; margin-bottom: 6px; }
    .lead { color: #6b7280; margin-top: 0; margin-bottom: 24px; }
    .demo-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
    }
    .demo-row { margin-bottom: 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .demo-row label { font-size: 13px; color: #6b7280; min-width: 80px; }
    .demo-output {
      font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
      background: #1f2937;
      color: #e5e7eb;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 13px;
    }
    .demo-buttons { margin-top: 16px; display: flex; gap: 8px; }
    .demo-btn { padding: 6px 14px; border: 1px solid #d1d5db; background: #ffffff; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .demo-btn:hover { background: #f3f4f6; }
    .demo-btn.primary { background: #4f46e5; color: white; border-color: #4f46e5; }
    .demo-btn.primary:hover { background: #4338ca; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
    .footer a { color: #4f46e5; }
  </style>
</head>
<body>
  <h1>DateTimePicker</h1>
  <p class="lead">Klick auf den Trigger öffnet das Popup. Tag / Monat / Jahr / Stunde / Minute via Tastatur, Mausrad oder Pfeiltasten anpassen, mit Enter bestätigen.</p>

  <div id="root"></div>

  <p class="footer">
    Source: <a href="https://github.com/Ranudar/datetime-picker">github.com/Ranudar/datetime-picker</a> ·
    Single-file demo, kein Build-Schritt am Client. React via esm.sh (importmap); Komponente vorab via esbuild gebündelt und inline. Direkt aus dem Browser über <code>file://</code> öffenbar (Internet-Verbindung für CDN-React erforderlich).
  </p>

  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@19.2.5",
      "react/jsx-runtime": "https://esm.sh/react@19.2.5/jsx-runtime",
      "react-dom/client": "https://esm.sh/react-dom@19.2.5/client?deps=react@19.2.5"
    }
  }
  </script>

  <script type="module">
STYLE_END
echo "$BUNDLE"
cat <<'FOOTER'
  </script>
</body>
</html>
FOOTER
} > index.html

HTML_BYTES=$(wc -c < index.html)
echo "    index.html: ${HTML_BYTES} bytes"

echo "[3/3] Done. Open index.html in a browser to test."
