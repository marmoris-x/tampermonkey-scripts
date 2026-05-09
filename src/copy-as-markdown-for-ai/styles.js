'use strict';

export const styles = `
/* === Markdown Extraction — Tampermonkey Userscript Styles === */

:root {
  --mdx-bg: #16161a;
  --mdx-surface: #1e1e24;
  --mdx-border: #2d2d38;
  --mdx-text: #e4e4ec;
  --mdx-muted: #8888a0;
  --mdx-accent: #0fbbaa;
  --mdx-accent-hover: #0d9f92;
  --mdx-danger: #ff3c74;
  --mdx-danger-hover: #ff5c84;
  --mdx-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --mdx-font-mono: "SF Mono", "Cascadia Code", "Roboto Mono", Consolas, monospace;
}

/* === Toolbar === */
.mdx-toolbar {
  position: fixed;
  background: var(--mdx-bg);
  border: 1px solid var(--mdx-border);
  border-radius: 14px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  font-family: var(--mdx-font);
  font-size: 13px;
  width: 330px;
  z-index: 2147483647;
  color: var(--mdx-text);
  overflow: hidden;
  pointer-events: auto;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.mdx-toolbar *,
.mdx-preview * {
  font-family: inherit;
  box-sizing: border-box;
}

.mdx-toolbar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: var(--mdx-surface);
  border-bottom: 1px solid var(--mdx-border);
  cursor: grab;
  user-select: none;
}
.mdx-toolbar-header:active { cursor: grabbing; }

.mdx-toolbar-dots {
  display: flex;
  gap: 7px;
  flex-shrink: 0;
}
.mdx-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s ease;
  padding: 0;
}
.mdx-dot-red { background: #ff5f57; }
.mdx-dot-red:hover { background: #ff3030; }
.mdx-dot-yellow { background: #ffbd2e; }
.mdx-dot-yellow:hover { background: #ffaa00; }
.mdx-dot-green { background: #28ca42; }
.mdx-dot-green:hover { background: #1eb533; }

.mdx-toolbar-title {
  flex: 1;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: var(--mdx-text);
  letter-spacing: 0.01em;
}

.mdx-close-btn {
  background: transparent;
  border: none;
  color: var(--mdx-muted);
  font-size: 22px;
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
  line-height: 1;
}
.mdx-close-btn:hover { background: var(--mdx-danger); color: #fff; }

.mdx-toolbar-content { padding: 16px; }

/* === Selection Info === */
.mdx-selection-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  padding: 10px 14px;
  background: var(--mdx-surface);
  border-radius: 10px;
  border: 1px solid var(--mdx-border);
}
.mdx-selection-count {
  color: var(--mdx-accent);
  font-weight: 600;
  font-size: 13px;
}
.mdx-clear-btn {
  background: transparent;
  border: 1px solid var(--mdx-border);
  color: var(--mdx-muted);
  padding: 5px 14px;
  border-radius: 7px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}
.mdx-clear-btn:hover:not(:disabled) { border-color: var(--mdx-danger); color: var(--mdx-danger); }
.mdx-clear-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* === Toolbar Actions === */
.mdx-toolbar-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.mdx-preview-btn,
.mdx-copy-btn {
  flex: 1;
  padding: 11px 16px;
  border-radius: 9px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  letter-spacing: 0.01em;
}

.mdx-preview-btn {
  background: var(--mdx-accent);
  color: #070708;
}
.mdx-preview-btn:hover:not(:disabled) {
  background: var(--mdx-accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(15, 187, 170, 0.3);
}

.mdx-copy-btn {
  background: var(--mdx-surface);
  color: var(--mdx-text);
  border: 1px solid var(--mdx-border);
}
.mdx-copy-btn:hover:not(:disabled) {
  border-color: var(--mdx-accent);
  color: var(--mdx-accent);
}

.mdx-toolbar button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

/* === Instructions === */
.mdx-toolbar-instructions {
  background: var(--mdx-surface);
  border-radius: 10px;
  padding: 12px 14px;
  border: 1px solid var(--mdx-border);
}
.mdx-toolbar-instructions p {
  margin: 5px 0;
  color: var(--mdx-muted);
  font-size: 12px;
  line-height: 1.6;
}
.mdx-toolbar-instructions strong {
  color: var(--mdx-text);
  font-weight: 600;
}

/* === Selection Highlight === */
.mdx-hover-candidate {
  outline: 2px dashed var(--mdx-accent) !important;
  outline-offset: 2px;
  cursor: pointer !important;
  transition: outline-color 0.15s ease;
}

.mdx-selected {
  /* outline is set inline */
}

/* === Preview Modal === */
.mdx-preview {
  position: fixed;
  background: var(--mdx-bg);
  border: 1px solid var(--mdx-border);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  font-family: var(--mdx-font);
  width: 640px;
  max-width: 92vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  z-index: 2147483646;
  color: var(--mdx-text);
  overflow: hidden;
}

.mdx-preview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  background: var(--mdx-surface);
  border-bottom: 1px solid var(--mdx-border);
  cursor: grab;
  user-select: none;
}
.mdx-preview-header:active { cursor: grabbing; }

.mdx-preview-title {
  flex: 1;
  color: var(--mdx-text);
  font-weight: 600;
  font-size: 14px;
}

.mdx-preview-close {
  background: transparent;
  border: none;
  color: var(--mdx-muted);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  transition: all 0.2s ease;
}
.mdx-preview-close:hover { background: var(--mdx-danger); color: #fff; }

/* === Options === */
.mdx-preview-options {
  display: flex;
  gap: 14px;
  padding: 14px 18px;
  background: var(--mdx-surface);
  border-bottom: 1px solid var(--mdx-border);
  flex-wrap: wrap;
}
.mdx-preview-options label {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--mdx-muted);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}
.mdx-option-textonly {
  color: var(--mdx-accent) !important;
  font-weight: 600;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--mdx-border);
  margin-bottom: 6px;
  width: 100%;
}
.mdx-preview-options input[type="checkbox"] {
  width: 15px;
  height: 15px;
  cursor: pointer;
  accent-color: var(--mdx-accent);
}

/* === Content Area === */
.mdx-preview-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.mdx-preview-tabs {
  display: flex;
  align-items: center;
  background: var(--mdx-surface);
  border-bottom: 1px solid var(--mdx-border);
}

.mdx-tab {
  flex: 1;
  padding: 12px;
  background: transparent;
  border: none;
  color: var(--mdx-muted);
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.mdx-tab:hover { color: var(--mdx-text); }
.mdx-tab.active { color: var(--mdx-accent); }
.mdx-tab.active::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--mdx-accent);
  border-radius: 2px 2px 0 0;
}

.mdx-wrap-toggle {
  margin-left: auto;
  padding: 7px 14px;
  background: transparent;
  border: 1px solid var(--mdx-border);
  color: var(--mdx-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 7px;
  margin-right: 8px;
}
.mdx-wrap-toggle:hover { border-color: var(--mdx-accent); color: var(--mdx-accent); }
.mdx-wrap-toggle.active { background: var(--mdx-accent); color: #070708; border-color: var(--mdx-accent); }

.mdx-preview-pane {
  display: none;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 18px;
  min-height: 0;
}
.mdx-preview-pane.active { display: block; }

.mdx-preview-pane pre {
  margin: 0;
  white-space: pre;
  overflow-x: auto;
  font-family: var(--mdx-font-mono);
}
.mdx-preview-pane.wrap pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: hidden;
}
.mdx-preview-pane code {
  color: var(--mdx-text);
  font-family: var(--mdx-font-mono);
  font-size: 12.5px;
  line-height: 1.65;
}

/* Scrollbar */
.mdx-preview-pane::-webkit-scrollbar { width: 6px; }
.mdx-preview-pane::-webkit-scrollbar-track { background: transparent; }
.mdx-preview-pane::-webkit-scrollbar-thumb { background: var(--mdx-border); border-radius: 3px; }
.mdx-preview-pane::-webkit-scrollbar-thumb:hover { background: #3d3d48; }

/* Markdown Preview Rendered */
.mdx-markdown-preview {
  color: var(--mdx-text);
  line-height: 1.7;
  font-size: 14px;
}
.mdx-markdown-preview h1, .mdx-markdown-preview h2, .mdx-markdown-preview h3,
.mdx-markdown-preview h4, .mdx-markdown-preview h5, .mdx-markdown-preview h6 {
  color: #fff;
  margin: 18px 0 10px 0;
  font-weight: 600;
}
.mdx-markdown-preview h1 { font-size: 1.5em; }
.mdx-markdown-preview h2 { font-size: 1.3em; }
.mdx-markdown-preview a { color: var(--mdx-accent); text-decoration: none; }
.mdx-markdown-preview a:hover { text-decoration: underline; }
.mdx-markdown-preview code {
  background: var(--mdx-surface);
  padding: 2px 6px;
  border-radius: 5px;
  font-family: var(--mdx-font-mono);
  font-size: 0.9em;
}
.mdx-markdown-preview pre {
  background: var(--mdx-surface);
  padding: 14px;
  border-radius: 10px;
  overflow-x: auto;
  border: 1px solid var(--mdx-border);
}
.mdx-markdown-preview pre code { background: none; padding: 0; }
.mdx-markdown-preview table {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
  font-size: 13px;
}
.mdx-markdown-preview th, .mdx-markdown-preview td {
  border: 1px solid var(--mdx-border);
  padding: 9px 13px;
  text-align: left;
}
.mdx-markdown-preview th { background: var(--mdx-surface); font-weight: 600; }
.mdx-markdown-preview blockquote {
  border-left: 3px solid var(--mdx-accent);
  margin: 16px 0;
  padding-left: 16px;
  color: var(--mdx-muted);
}
.mdx-markdown-preview hr { border: none; border-top: 1px solid var(--mdx-border); margin: 24px 0; }

/* === Preview Actions === */
.mdx-preview-actions {
  display: flex;
  gap: 8px;
  padding: 14px 18px;
  background: var(--mdx-surface);
  border-top: 1px solid var(--mdx-border);
}

.mdx-download-btn,
.mdx-copy-markdown-btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 9px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-size: 13px;
  letter-spacing: 0.01em;
}

.mdx-download-btn {
  background: var(--mdx-surface);
  color: var(--mdx-text);
  border: 1px solid var(--mdx-border);
}
.mdx-download-btn:hover { border-color: var(--mdx-accent); color: var(--mdx-accent); }

.mdx-copy-markdown-btn {
  background: var(--mdx-accent);
  color: #070708;
}
.mdx-copy-markdown-btn:hover {
  background: var(--mdx-accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(15, 187, 170, 0.3);
}

/* === Toast Notification === */
.mdx-toast {
  position: fixed;
  bottom: 28px;
  right: 28px;
  background: var(--mdx-bg);
  color: var(--mdx-text);
  padding: 13px 22px;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
  font-family: var(--mdx-font);
  font-size: 13.5px;
  font-weight: 500;
  z-index: 2147483647;
  transform: translateY(120px);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid var(--mdx-border);
  letter-spacing: 0.01em;
}
.mdx-toast.show { transform: translateY(0); opacity: 1; }
.mdx-toast-success { border-left: 3px solid var(--mdx-accent); }
.mdx-toast-error { border-left: 3px solid var(--mdx-danger); }

/* === Selection Badge (inline styles overridden where needed) === */
.mdx-selection-badge-fixed {
  pointer-events: auto !important;
}
`;
