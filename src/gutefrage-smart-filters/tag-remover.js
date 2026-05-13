// src/gutefrage-smart-filters/tag-remover.js — Tag removal and author blocking
// Provides: TagRemover class, waitForTagPageReady helper, DEFAULT_TAGS

import { createLogger } from './_logger.js';
import { waitForElement, observeMutations } from './_dom.js';

const tagLog = createLogger('Gutefrage Tag Remover');

export const DEFAULT_TAGS = ['islam', 'allah', 'muslime', 'koran', 'mohammed'];

const TAG_REMOVER_CSS = [
  '.gf-tr-btn { color:white; border:none; padding:4px 12px; margin-left:8px; border-radius:12px; font-size:13px; font-weight:500; cursor:pointer; transition:background-color 0.2s; display:inline-flex; align-items:center; height:24px; white-space:nowrap; }',
  '.gf-tr-btn-remove { background-color:#dc3545; }',
  '.gf-tr-btn-remove:hover { background-color:#c82333; }',
  '.gf-tr-btn-block { background-color:#6c757d; }',
  '.gf-tr-btn-block:hover { background-color:#545b62; }',
  '.gf-tr-notification { position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#ffc107; color:#000; padding:15px 20px; border-radius:8px; z-index:10000; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-size:14px; font-weight:500; }'
].join('\n');

/**
 * Waits for the tag page to be fully loaded and ready for interaction.
 * Adjusts delay proportionally to DOM size.
 * @returns {Promise<void>}
 */
export async function waitForTagPageReady() {
  if (document.readyState !== 'complete') await new Promise(function (r) { window.addEventListener('load', r); });
  try { await waitForElement('.Tag-container, .Tag, article, main', 8000); } catch (e) { /* timeout */ }
  const delay = Math.min(3000, Math.max(500, document.querySelectorAll('*').length / 100));
  await new Promise(function (r) { setTimeout(r, delay); });
}

/**
 * Manages removal of unwanted tags from Gutefrage posts.
 * Provides automatic tag removal, manual remove buttons, and author blocking.
 */
export class TagRemover {
  constructor() {
    this.tagsToRemove = DEFAULT_TAGS;
    this.init();
  }

  /**
   * Initializes tag removal features: buttons, auto-remove, and observer.
   */
  init() {
    GM_addStyle(TAG_REMOVER_CSS);
    this.addRemoveButtons();
    this.autoRemoveAndClose();
    this.observeNewContent();
  }

  /**
   * Clicks the hide button on a tag element to remove it.
   * @param {Element} tagElement - The tag container element
   * @returns {boolean} Whether the tag was successfully removed
   */
  removeTag(tagElement) {
    const hideButton = tagElement.querySelector('.Tag-action');
    if (hideButton) {
      hideButton.click();
      tagLog.log('Tag removed:', tagElement.getAttribute('aria-label'));
      return true;
    }
    return false;
  }

  /**
   * Removes all unwanted tags from the page with multi-attempt retry logic.
   * @returns {Promise<number>} Number of tags removed
   */
  async removeUnwantedTags() {
    tagLog.log('Starting tag removal process...');
    await waitForTagPageReady();
    this.tagsToRemove = await GM.getValue('customTagsToRemove', DEFAULT_TAGS);

    let tagsRemoved = 0;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const tagContainers = document.querySelectorAll('.Tag-container');
      tagLog.log('Attempt ' + attempt + '/' + maxAttempts + ', found ' + tagContainers.length + ' containers');

      if (tagContainers.length === 0 && attempt < maxAttempts) {
        await new Promise(function (r) { setTimeout(r, 2000); });
        continue;
      }

      for (let i = 0; i < tagContainers.length; i++) {
        let tagSlug = tagContainers[i].querySelector('.Tag');
        tagSlug = tagSlug ? tagSlug.getAttribute('data-tag-slug') : null;
        if (tagSlug && this.tagsToRemove.indexOf(tagSlug.toLowerCase()) !== -1) {
          if (this.removeTag(tagContainers[i])) {
            tagsRemoved++;
            await new Promise(function (r) { setTimeout(r, 200); });
          }
        }
      }
      if (tagContainers.length > 0) break;
    }

    tagLog.log('Completed. Total tags removed: ' + tagsRemoved);
    return tagsRemoved;
  }

  /**
   * Injects "Tags entfernen" and "Autor sperren" buttons on each post.
   * Skips articles that already have the buttons.
   */
  addRemoveButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('article.ListingElement, .ContentCard'), function (article) {
      if (article.querySelector('.custom-remove-tags-button')) return;

      let buttonContainer = article.querySelector('.ListingElement-bottomBar--withItemActions .u-flex:last-child');
      if (!buttonContainer) buttonContainer = article.querySelector('.ContentCard-action, .ContentCard-actions');
      if (!buttonContainer) {
        const tagSection = article.querySelector('.Tag');
        if (tagSection) buttonContainer = tagSection.parentElement;
      }
      if (!buttonContainer) return;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'Tag custom-remove-tags-button gf-tr-btn gf-tr-btn-remove';
      removeBtn.textContent = 'Tags entfernen';
      removeBtn.title = 'Removes unwanted tags from this post';

      removeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const ql = article.querySelector('a[href*="/frage/"], .ContentCard-link, .ListingElement-questionLink');
        if (ql) {
          const url = new URL(ql.href);
          url.searchParams.set('removeTagsAuto', 'true');
          removeBtn.textContent = 'Wird bearbeitet...';
          removeBtn.classList.remove('gf-tr-btn-remove');
          removeBtn.classList.add('gf-tr-btn-done');
          removeBtn.style.backgroundColor = '#28a745';
          if (typeof GM_openInTab !== 'undefined') {
            GM_openInTab(url.href, { active: false, insert: true, setParent: true });
          } else {
            window.open(url.href, '_blank');
          }
          setTimeout(function () {
            removeBtn.textContent = 'Tags entfernen';
            removeBtn.style.backgroundColor = '#dc3545';
            removeBtn.classList.remove('gf-tr-btn-done');
            removeBtn.classList.add('gf-tr-btn-remove');
          }, 2000);
        }
      });

      buttonContainer.appendChild(removeBtn);

      const authorEl = article.querySelector('.ContentMeta-author a');
      if (authorEl) {
        const blockBtn = document.createElement('button');
        blockBtn.className = 'Tag custom-block-author-button gf-tr-btn gf-tr-btn-block';
        blockBtn.textContent = 'Autor sperren';
        blockBtn.title = 'Hides all posts from this author';
        blockBtn.addEventListener('click', async function (e) {
          e.preventDefault();
          e.stopPropagation();
          const name = authorEl.textContent.trim();
          const blocked = await GM.getValue('blockedAuthors', []);
          if (blocked.indexOf(name) === -1) {
            blocked.push(name);
            await GM.setValue('blockedAuthors', blocked);
          }
          const container = article.closest('.Plate.ListingElement') || article;
          container.style.display = 'none';
        });
        buttonContainer.appendChild(blockBtn);
      }
    });
  }

  /**
   * Auto-removes tags when the removeTagsAuto URL parameter is set.
   * Shows a progress notification and closes the tab on completion.
   */
  async autoRemoveAndClose() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('removeTagsAuto') !== 'true') return;

    tagLog.log('Auto-remove mode activated');

    const notification = document.createElement('div');
    notification.className = 'gf-tr-notification';
    notification.textContent = 'Warte auf vollstandiges Laden der Seite...';
    document.body.appendChild(notification);

    const progressInterval = setInterval(function () {
      const containers = document.querySelectorAll('.Tag-container');
      notification.textContent = 'Seite wird geladen... (' + containers.length + ' Tags gefunden)';
    }, 1000);

    try {
      const tagsRemoved = await this.removeUnwantedTags();
      clearInterval(progressInterval);
      notification.style.background = '#4CAF50';
      notification.style.color = '#fff';
      notification.textContent = '✓ ' + tagsRemoved + ' Tag(s) entfernt! Tab wird geschlossen...';
      setTimeout(function () {
        window.close();
        setTimeout(function () {
          notification.textContent = 'Bitte schließen Sie diesen Tab manuell.';
          notification.style.background = '#17a2b8';
        }, 500);
      }, 2000);
    } catch (error) {
      clearInterval(progressInterval);
      tagLog.error('Error:', error);
      notification.style.background = '#dc3545';
      notification.style.color = '#fff';
      notification.textContent = 'Fehler beim Entfernen der Tags!';
    }
  }

  /**
   * Observes for dynamically added content and injects remove buttons.
   */
  observeNewContent() {
    const self = this;
    observeMutations(function (node) {
      if (node.matches && (node.matches('article.ListingElement, .ContentCard') || node.querySelector('article.ListingElement, .ContentCard'))) {
        self.addRemoveButtons();
      }
    });
  }
}
