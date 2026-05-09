'use strict';

export function makeDraggableByHeader(element) {
  let isDragging = false;
  let startX, startY, initialX, initialY;
  const header = element.querySelector(".mdx-toolbar-header");
  if (!header) return;
  header.addEventListener("mousedown", (e) => {
    if (e.target.closest(".mdx-close-btn")) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = element.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    element.style.transition = "none";
    header.style.cursor = "grabbing";
  });
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    element.style.left = `${initialX + deltaX}px`;
    element.style.top = `${initialY + deltaY}px`;
    element.style.right = "auto";
  });
  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      element.style.transition = "";
      if (header) header.style.cursor = "grab";
    }
  });
}

function makeModalDraggable(element) {
  let isDragging = false;
  let startX, startY, initialX, initialY;
  const header = element.querySelector(".mdx-preview-header");
  if (!header) return;
  header.addEventListener("mousedown", (e) => {
    if (e.target.closest(".mdx-preview-close")) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = element.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    element.style.transition = "none";
    element.style.transform = "none";
    header.style.cursor = "grabbing";
  });
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    element.style.left = `${initialX + deltaX}px`;
    element.style.top = `${initialY + deltaY}px`;
  });
  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      element.style.transition = "";
      if (header) header.style.cursor = "grab";
    }
  });
}

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export class MarkdownPreviewModal {
  constructor() {
    this.modal = null;
    this.markdownOptions = {
      includeImages: true,
      preserveTables: true,
      keepCodeFormatting: true,
      simplifyLayout: false,
      preserveLinks: true,
      addSeparators: true,
      includeXPath: false,
      textOnly: false
    };
    this.onGenerateMarkdown = null;
    this.currentMarkdown = "";
  }

  show(generateMarkdownCallback) {
    this.onGenerateMarkdown = generateMarkdownCallback;
    if (!this.modal) this.createModal();
    this.updateContent();
    this.modal.style.display = "flex";
  }

  hide() {
    if (this.modal) this.modal.style.display = "none";
  }

  createModal() {
    this.modal = document.createElement("div");
    this.modal.className = "mdx-preview";
    this.modal.innerHTML = `
      <div class="mdx-preview-header">
        <div class="mdx-toolbar-dots">
          <span class="mdx-dot mdx-dot-red"></span>
          <span class="mdx-dot mdx-dot-yellow"></span>
          <span class="mdx-dot mdx-dot-green"></span>
        </div>
        <span class="mdx-preview-title">Markdown Preview</span>
        <button class="mdx-preview-close" title="Close">×</button>
      </div>
      <div class="mdx-preview-options">
        <label class="mdx-option-textonly"><input type="checkbox" name="textOnly"> 👁️ Visual Text Mode (As You See)</label>
        <label><input type="checkbox" name="includeImages" checked> Include Images</label>
        <label><input type="checkbox" name="preserveTables" checked> Preserve Tables</label>
        <label><input type="checkbox" name="preserveLinks" checked> Preserve Links</label>
        <label><input type="checkbox" name="keepCodeFormatting" checked> Keep Code Formatting</label>
        <label><input type="checkbox" name="simplifyLayout"> Simplify Layout</label>
        <label><input type="checkbox" name="addSeparators" checked> Add Separators</label>
        <label><input type="checkbox" name="includeXPath"> Include XPath Headers</label>
      </div>
      <div class="mdx-preview-content">
        <div class="mdx-preview-tabs">
          <button class="mdx-tab active" data-tab="preview">Preview</button>
          <button class="mdx-tab" data-tab="markdown">Markdown</button>
          <button class="mdx-wrap-toggle" title="Toggle word wrap">↔️ Wrap</button>
        </div>
        <div class="mdx-preview-pane active" data-pane="preview"></div>
        <div class="mdx-preview-pane" data-pane="markdown"></div>
      </div>
      <div class="mdx-preview-actions">
        <button class="mdx-download-btn">Download .md</button>
        <button class="mdx-copy-markdown-btn">Copy Markdown</button>
      </div>
    `;
    document.body.appendChild(this.modal);
    makeModalDraggable(this.modal);
    this.modal.style.position = "fixed";
    this.modal.style.top = "50%";
    this.modal.style.left = "50%";
    this.modal.style.transform = "translate(-50%, -50%)";
    this.modal.style.zIndex = "2147483646";
    this.modal.style.display = "none";
    this.modal.style.flexDirection = "column";
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.modal.querySelector(".mdx-preview-close").addEventListener("click", () => this.hide());
    this.modal.querySelectorAll(".mdx-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => this.switchTab(e.target.dataset.tab));
    });
    const wrapToggle = this.modal.querySelector(".mdx-wrap-toggle");
    wrapToggle.addEventListener("click", () => {
      this.modal.querySelectorAll(".mdx-preview-pane").forEach((p) => p.classList.toggle("wrap"));
      wrapToggle.classList.toggle("active");
    });
    this.modal.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener("change", async (e) => {
        this.markdownOptions[e.target.name] = e.target.checked;
        if (e.target.name === "textOnly") {
          const linksCb = this.modal.querySelector('input[name="preserveLinks"]');
          const imagesCb = this.modal.querySelector('input[name="includeImages"]');
          if (e.target.checked) {
            if (linksCb) {
              linksCb.checked = false;
              linksCb.disabled = true;
              this.markdownOptions.preserveLinks = false;
            }
            if (imagesCb) {
              imagesCb.disabled = true;
            }
          } else {
            if (linksCb) linksCb.disabled = false;
            if (imagesCb) imagesCb.disabled = false;
          }
        }
        await this.updateContent();
      });
    });
    this.modal.querySelector(".mdx-copy-markdown-btn").addEventListener("click", () => this.copyToClipboard());
    this.modal.querySelector(".mdx-download-btn").addEventListener("click", () => this.downloadMarkdown());
  }

  switchTab(tabName) {
    this.modal.querySelectorAll(".mdx-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === tabName);
    });
    this.modal.querySelectorAll(".mdx-preview-pane").forEach((p) => {
      p.classList.toggle("active", p.dataset.pane === tabName);
    });
  }

  async updateContent() {
    if (!this.onGenerateMarkdown) return;
    try {
      this.currentMarkdown = await this.onGenerateMarkdown(this.markdownOptions);
      const mdPane = this.modal.querySelector('[data-pane="markdown"]');
      mdPane.innerHTML = `<pre><code>${escapeHtml(this.currentMarkdown)}</code></pre>`;
      const previewPane = this.modal.querySelector('[data-pane="preview"]');
      if (window.marked && window.marked.parse) {
        window.marked.setOptions && window.marked.setOptions({
          gfm: true,
          breaks: true,
          tables: true,
          headerIds: false,
          mangle: false
        });
        const html = window.marked.parse(this.currentMarkdown);
        previewPane.innerHTML = `<div class="mdx-markdown-preview">${html}</div>`;
      } else {
        previewPane.innerHTML = `<div class="mdx-markdown-preview"><pre>${escapeHtml(this.currentMarkdown)}</pre></div>`;
      }
    } catch (error) {
      console.error("[MarkdownExtraction] Preview error:", error);
      this.showToast("Error generating markdown", "error");
    }
  }

  async copyToClipboard() {
    try {
      if (typeof GM_setClipboard !== "undefined") {
        GM_setClipboard(this.currentMarkdown, "text");
        this.showToast("Markdown copied to clipboard!");
      } else if (typeof GM !== "undefined" && GM.setClipboard) {
        await GM.setClipboard(this.currentMarkdown, "text");
        this.showToast("Markdown copied to clipboard!");
      } else {
        await navigator.clipboard.writeText(this.currentMarkdown);
        this.showToast("Markdown copied to clipboard!");
      }
    } catch (err) {
      console.error("[MarkdownExtraction] Copy failed:", err);
      try {
        await navigator.clipboard.writeText(this.currentMarkdown);
        this.showToast("Markdown copied to clipboard!");
      } catch (err2) {
        this.showToast("Failed to copy. Please try again.", "error");
      }
    }
  }

  downloadMarkdown() {
    const timestamp = (new Date()).toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const filename = `markdown-export-${timestamp}.md`;
    try {
      if (typeof GM_download !== "undefined") {
        GM_download({
          url: URL.createObjectURL(new Blob([this.currentMarkdown], { type: "text/markdown" })),
          name: filename,
          saveAs: true
        });
      } else if (typeof GM !== "undefined" && GM.download) {
        GM.download({
          url: URL.createObjectURL(new Blob([this.currentMarkdown], { type: "text/markdown" })),
          name: filename,
          saveAs: true
        });
      } else {
        const blob = new Blob([this.currentMarkdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      this.showToast(`Downloaded ${filename}`);
    } catch (err) {
      console.error("[MarkdownExtraction] Download failed:", err);
      const blob = new Blob([this.currentMarkdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast(`Downloaded ${filename}`);
    }
  }

  showToast(message, type = "success") {
    const existing = document.querySelector(".mdx-toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.className = `mdx-toast mdx-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3e3);
  }

  getOptions() {
    return { ...this.markdownOptions };
  }

  setOptions(options) {
    this.markdownOptions = { ...this.markdownOptions, ...options };
    Object.entries(options).forEach(([key, value]) => {
      const cb = this.modal?.querySelector(`input[name="${key}"]`);
      if (cb && typeof value === "boolean") cb.checked = value;
    });
  }

  destroy() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    this.onGenerateMarkdown = null;
  }
}
