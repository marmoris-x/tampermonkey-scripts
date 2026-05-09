'use strict';

import { MarkdownConverter } from './converter.js';
import { ContentAnalyzer } from './content-analyzer.js';
import { MarkdownPreviewModal, makeDraggableByHeader } from './preview-modal.js';

export class MarkdownExtraction {
  constructor() {
    this.selectedElements = new Set();
    this.highlightBoxes = new Map();
    this.toolbar = null;
    this.markdownPreviewModal = null;
    this.selectionCounter = 0;
    this.markdownConverter = null;
    this.contentAnalyzer = null;
    this.documentClickHandler = null;
    this.linkClickHandler = null;
    this.documentHoverHandler = null;
    this.documentMouseOutHandler = null;
    this.keyboardHandler = null;
    this.init();
  }

  async init() {
    this.markdownConverter = new MarkdownConverter();
    this.contentAnalyzer = new ContentAnalyzer();
    this.createToolbar();
    this.setupEventListeners();
  }

  createToolbar() {
    this.toolbar = document.createElement("div");
    this.toolbar.className = "mdx-toolbar";
    this.toolbar.innerHTML = `
      <div class="mdx-toolbar-header">
        <div class="mdx-toolbar-dots">
          <span class="mdx-dot mdx-dot-red"></span>
          <span class="mdx-dot mdx-dot-yellow"></span>
          <span class="mdx-dot mdx-dot-green"></span>
        </div>
        <span class="mdx-toolbar-title">Markdown Extraction</span>
        <button class="mdx-close-btn" title="Close">×</button>
      </div>
      <div class="mdx-toolbar-content">
        <div class="mdx-selection-info">
          <span class="mdx-selection-count">0 elements selected</span>
          <button class="mdx-clear-btn" title="Clear selection" disabled>Clear</button>
        </div>
        <div class="mdx-toolbar-actions">
          <button class="mdx-preview-btn" disabled>Preview Markdown</button>
          <button class="mdx-copy-btn" disabled>Copy to Clipboard</button>
        </div>
        <div class="mdx-toolbar-instructions">
          <p>💡 <strong>Ctrl/Cmd + Click</strong> to select multiple elements</p>
          <p>📝 Selected elements will be converted to clean markdown</p>
          <p>⌨️ Press <strong>ESC</strong> to exit</p>
          <p>⌨️ <strong>Ctrl/Cmd + A</strong> to select all visible elements</p>
      </div>
    `;
    document.body.appendChild(this.toolbar);
    this.toolbar.style.position = "fixed";
    this.toolbar.style.top = "20px";
    this.toolbar.style.right = "20px";
    this.toolbar.style.zIndex = "2147483647";
    makeDraggableByHeader(this.toolbar);
  }

  setupEventListeners() {
    this.toolbar.querySelector(".mdx-close-btn").addEventListener("click", () => this.deactivate());
    this.toolbar.querySelector(".mdx-clear-btn").addEventListener("click", () => this.clearSelection());
    this.toolbar.querySelector(".mdx-preview-btn").addEventListener("click", () => this.showPreview());
    this.toolbar.querySelector(".mdx-copy-btn").addEventListener("click", () => this.copyDirectly());
    this.documentClickHandler = (event) => this.handleElementClick(event);
    document.addEventListener("click", this.documentClickHandler, true);
    this.linkClickHandler = (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", this.linkClickHandler, true);
    this.documentHoverHandler = (event) => this.handleElementHover(event);
    document.addEventListener("mouseover", this.documentHoverHandler, true);
    this.documentMouseOutHandler = (event) => this.handleElementMouseOut(event);
    document.addEventListener("mouseout", this.documentMouseOutHandler, true);
    this.keyboardHandler = (event) => this.handleKeyboard(event);
    document.addEventListener("keydown", this.keyboardHandler);
  }

  handleElementClick(event) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    event.stopPropagation();
    const element = event.target;
    if (element.closest(".mdx-toolbar") || element.closest(".mdx-preview") || element.closest(".mdx-selection-badge-fixed")) {
      return;
    }
    if (this.selectedElements.has(element)) {
      this.deselectElement(element);
    } else {
      this.selectElement(element);
    }
    this.updateUI();
  }

  handleElementHover(event) {
    const element = event.target;
    if (element.closest(".mdx-toolbar") || element.closest(".mdx-preview") || element.closest(".mdx-selection-badge-fixed") || element.hasAttribute("data-mdx-badge")) {
      return;
    }
    element.classList.add("mdx-hover-candidate");
  }

  handleElementMouseOut(event) {
    event.target.classList.remove("mdx-hover-candidate");
  }

  handleKeyboard(event) {
    if (event.key === "Escape") {
      this.deactivate();
    } else if ((event.ctrlKey || event.metaKey) && event.key === "a") {
      event.preventDefault();
      const elements = document.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, td, th, div, span, article, section");
      for (const el of elements) {
        if (el.textContent.trim() && this.isVisible(el) && !this.selectedElements.has(el)) {
          this.selectElement(el);
        }
      }
      this.updateUI();
    }
  }

  isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  selectElement(element) {
    this.selectedElements.add(element);
    this.createHighlightBox(element);
    element.classList.add("mdx-selected");
    this.selectionCounter++;
  }

  deselectElement(element) {
    this.selectedElements.delete(element);
    const badge = this.highlightBoxes.get(element);
    if (badge) {
      if (badge._updatePosition) {
        window.removeEventListener("scroll", badge._updatePosition, true);
        window.removeEventListener("resize", badge._updatePosition);
      }
      badge.remove();
      this.highlightBoxes.delete(element);
    }
    element.style.outline = "";
    element.style.outlineOffset = "";
    element.removeAttribute("data-mdx-selection-order");
    element.classList.remove("mdx-selected");
    this.selectionCounter--;
  }

  createHighlightBox(element) {
    element.setAttribute("data-mdx-selection-order", this.selectionCounter + 1);
    element.style.outline = "2px solid #0fbbaa";
    element.style.outlineOffset = "2px";
    const badge = document.createElement("div");
    badge.className = "mdx-selection-badge-fixed";
    badge.textContent = this.selectionCounter + 1;
    badge.setAttribute("data-mdx-badge", "true");
    badge.title = "Click to deselect";
    const rect = element.getBoundingClientRect();
    badge.style.cssText = `
      position: fixed !important;
      top: ${rect.top - 12}px !important;
      left: ${rect.left - 12}px !important;
      width: 24px !important;
      height: 24px !important;
      background: #0fbbaa !important;
      color: #070708 !important;
      border-radius: 50% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 12px !important;
      font-weight: bold !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
      z-index: 2147483645 !important;
      cursor: pointer !important;
      transition: transform 0.2s ease, background 0.2s ease !important;
      pointer-events: auto !important;
      border: none !important;
      padding: 0 !important;
      margin: 0 !important;
      line-height: 1 !important;
      text-align: center !important;
      text-decoration: none !important;
      box-sizing: border-box !important;
    `;
    badge.addEventListener("mouseenter", () => {
      badge.style.setProperty("background", "#ff3c74", "important");
      badge.style.setProperty("transform", "scale(1.1)", "important");
    });
    badge.addEventListener("mouseleave", () => {
      badge.style.setProperty("background", "#0fbbaa", "important");
      badge.style.setProperty("transform", "scale(1)", "important");
    });
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.deselectElement(element);
      this.updateUI();
    });
    const updatePosition = () => {
      const newRect = element.getBoundingClientRect();
      badge.style.top = `${newRect.top - 12}px`;
      badge.style.left = `${newRect.left - 12}px`;
    };
    badge._updatePosition = updatePosition;
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    document.body.appendChild(badge);
    this.highlightBoxes.set(element, badge);
    return badge;
  }

  clearSelection() {
    for (const element of this.selectedElements) {
      const badge = this.highlightBoxes.get(element);
      if (badge) {
        if (badge._updatePosition) {
          window.removeEventListener("scroll", badge._updatePosition, true);
          window.removeEventListener("resize", badge._updatePosition);
        }
        badge.remove();
      }
      element.style.outline = "";
      element.style.outlineOffset = "";
      element.removeAttribute("data-mdx-selection-order");
      element.classList.remove("mdx-selected");
    }
    this.selectedElements.clear();
    this.highlightBoxes.clear();
    this.selectionCounter = 0;
    this.updateUI();
  }

  updateUI() {
    const count = this.selectedElements.size;
    this.toolbar.querySelector(".mdx-selection-count").textContent = `${count} element${count !== 1 ? "s" : ""} selected`;
    const hasSelection = count > 0;
    this.toolbar.querySelector(".mdx-preview-btn").disabled = !hasSelection;
    this.toolbar.querySelector(".mdx-copy-btn").disabled = !hasSelection;
    this.toolbar.querySelector(".mdx-clear-btn").disabled = !hasSelection;
  }

  async showPreview() {
    if (!this.markdownPreviewModal) {
      this.markdownPreviewModal = new MarkdownPreviewModal();
    }
    this.markdownPreviewModal.show(async (options) => {
      return await this.generateMarkdown(options);
    });
  }

  async generateMarkdown(options) {
    const elements = Array.from(this.selectedElements);
    const sortedElements = elements.sort((a, b) => {
      const orderA = parseInt(a.getAttribute("data-mdx-selection-order") || "0");
      const orderB = parseInt(b.getAttribute("data-mdx-selection-order") || "0");
      return orderA - orderB;
    });
    const markdownParts = [];
    for (let i = 0; i < sortedElements.length; i++) {
      const element = sortedElements[i];
      if (options.includeXPath) {
        const xpath = this.getXPath(element);
        markdownParts.push(`### Element ${i + 1} - XPath: \`${xpath}\`\n`);
      }
      const elementsToConvert = [element];
      const analysis = await this.contentAnalyzer.analyze(elementsToConvert);
      const markdown = await this.markdownConverter.convert(elementsToConvert, {
        ...options,
        analysis
      });
      markdownParts.push(markdown.trim());
      if (options.addSeparators && i < sortedElements.length - 1) {
        markdownParts.push("\n---\n");
      }
    }
    return markdownParts.join("\n");
  }

  getXPath(element) {
    if (element.id) return `//*[@id="${element.id}"]`;
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = current.previousSibling;
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) index++;
        sibling = sibling.previousSibling;
      }
      const tagName = current.nodeName.toLowerCase();
      parts.unshift(index > 0 ? `${tagName}[${index + 1}]` : tagName);
      current = current.parentNode;
    }
    return "/" + parts.join("/");
  }

  async copyDirectly() {
    if (this.selectedElements.size === 0) return;
    const options = {
      includeImages: true,
      preserveTables: true,
      keepCodeFormatting: true,
      simplifyLayout: false,
      preserveLinks: true,
      addSeparators: true,
      includeXPath: false,
      textOnly: false
    };
    const markdown = await this.generateMarkdown(options);
    try {
      if (typeof GM_setClipboard !== "undefined") {
        GM_setClipboard(markdown, "text");
      } else if (typeof GM !== "undefined" && GM.setClipboard) {
        await GM.setClipboard(markdown, "text");
      } else {
        await navigator.clipboard.writeText(markdown);
      }
      this.showNotification("Markdown copied to clipboard!");
    } catch (err) {
      try {
        await navigator.clipboard.writeText(markdown);
        this.showNotification("Markdown copied to clipboard!");
      } catch (err2) {
        this.showNotification("Copy failed. Please try again.", "error");
      }
    }
  }

  showNotification(message, type = "success") {
    const existing = document.querySelector(".mdx-toast");
    if (existing) existing.remove();
    const notification = document.createElement("div");
    notification.className = `mdx-toast mdx-toast-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    requestAnimationFrame(() => notification.classList.add("show"));
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    }, 3e3);
  }

  deactivate() {
    document.removeEventListener("click", this.documentClickHandler, true);
    document.removeEventListener("click", this.linkClickHandler, true);
    document.removeEventListener("mouseover", this.documentHoverHandler, true);
    document.removeEventListener("mouseout", this.documentMouseOutHandler, true);
    document.removeEventListener("keydown", this.keyboardHandler);
    this.clearSelection();
    if (this.toolbar) {
      this.toolbar.remove();
      this.toolbar = null;
    }
    if (this.markdownPreviewModal) {
      this.markdownPreviewModal.destroy();
      this.markdownPreviewModal = null;
    }
    document.querySelectorAll(".mdx-hover-candidate").forEach((el) => {
      el.classList.remove("mdx-hover-candidate");
    });
  }
}
