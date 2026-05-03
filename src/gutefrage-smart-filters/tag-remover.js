// src/gutefrage-smart-filters/tag-remover.js — Tag removal and author blocking
// Provides: TagRemover class, waitForTagPageReady helper, DEFAULT_TAGS
// Exports via window.__GSF__

(function () {
  'use strict';

  var tagLog = TM.createLogger('Gutefrage Tag Remover');

  var DEFAULT_TAGS = ['islam', 'allah', 'muslime', 'koran', 'mohammed'];

  /**
   * Waits for the tag page to be fully loaded and ready for interaction.
   * Adjusts delay proportionally to DOM size.
   * @returns {Promise<void>}
   */
  async function waitForTagPageReady() {
    if (document.readyState !== 'complete') await new Promise(function (r) { window.addEventListener('load', r); });
    try { await TM.dom.waitForElement('.Tag-container, .Tag, article, main', 8000); } catch (e) { /* timeout */ }
    var delay = Math.min(3000, Math.max(500, document.querySelectorAll('*').length / 100));
    await new Promise(function (r) { setTimeout(r, delay); });
  }

  /**
   * Manages removal of unwanted tags from Gutefrage posts.
   * Provides automatic tag removal, manual remove buttons, and author blocking.
   */
  class TagRemover {
    constructor() {
      this.tagsToRemove = GM_getValue('customTagsToRemove', DEFAULT_TAGS);
      this.init();
    }

    /**
     * Initializes tag removal features: buttons, auto-remove, and observer.
     */
    init() {
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
      var hideButton = tagElement.querySelector('.Tag-action');
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
      this.tagsToRemove = GM_getValue('customTagsToRemove', DEFAULT_TAGS);

      var tagsRemoved = 0, maxAttempts = 3;
      for (var attempt = 1; attempt <= maxAttempts; attempt++) {
        var tagContainers = document.querySelectorAll('.Tag-container');
        tagLog.log('Attempt ' + attempt + '/' + maxAttempts + ', found ' + tagContainers.length + ' containers');

        if (tagContainers.length === 0 && attempt < maxAttempts) {
          await new Promise(function (r) { setTimeout(r, 2000); });
          continue;
        }

        for (var i = 0; i < tagContainers.length; i++) {
          var tagSlug = tagContainers[i].querySelector('.Tag');
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
      var btnStyle = [
        'color:white; border:none; padding:4px 12px; margin-left:8px; border-radius:12px;',
        'font-size:13px; font-weight:500; cursor:pointer; transition:background-color 0.2s;',
        'display:inline-flex; align-items:center; height:24px; white-space:nowrap;'
      ].join(' ');

      Array.prototype.forEach.call(document.querySelectorAll('article.ListingElement, .ContentCard'), function (article) {
        if (article.querySelector('.custom-remove-tags-button')) return;

        var buttonContainer = article.querySelector('.ListingElement-bottomBar--withItemActions .u-flex:last-child');
        if (!buttonContainer) buttonContainer = article.querySelector('.ContentCard-action, .ContentCard-actions');
        if (!buttonContainer) {
          var tagSection = article.querySelector('.Tag');
          if (tagSection) buttonContainer = tagSection.parentElement;
        }
        if (!buttonContainer) return;

        var removeBtn = document.createElement('button');
        removeBtn.className = 'Tag custom-remove-tags-button';
        removeBtn.style.cssText = 'background-color:#dc3545; ' + btnStyle;
        removeBtn.textContent = 'Tags entfernen';
        removeBtn.title = 'Removes unwanted tags from this post';

        removeBtn.addEventListener('mouseenter', function () { this.style.backgroundColor = '#c82333'; });
        removeBtn.addEventListener('mouseleave', function () { this.style.backgroundColor = '#dc3545'; });

        removeBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var ql = article.querySelector('a[href*="/frage/"], .ContentCard-link, .ListingElement-questionLink');
          if (ql) {
            var url = new URL(ql.href);
            url.searchParams.set('removeTagsAuto', 'true');
            removeBtn.textContent = 'Wird bearbeitet...';
            removeBtn.style.backgroundColor = '#28a745';
            if (typeof GM_openInTab !== 'undefined') {
              GM_openInTab(url.href, { active: false, insert: true, setParent: true });
            } else {
              window.open(url.href, '_blank');
            }
            setTimeout(function () {
              removeBtn.textContent = 'Tags entfernen';
              removeBtn.style.backgroundColor = '#dc3545';
            }, 2000);
          }
        });

        buttonContainer.appendChild(removeBtn);

        var authorEl = article.querySelector('.ContentMeta-author a');
        if (authorEl) {
          var blockBtn = document.createElement('button');
          blockBtn.className = 'Tag custom-block-author-button';
          blockBtn.style.cssText = 'background-color:#6c757d; ' + btnStyle;
          blockBtn.textContent = 'Autor sperren';
          blockBtn.title = 'Hides all posts from this author';
          blockBtn.addEventListener('mouseenter', function () { this.style.backgroundColor = '#545b62'; });
          blockBtn.addEventListener('mouseleave', function () { this.style.backgroundColor = '#6c757d'; });
          blockBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var name = authorEl.textContent.trim();
            var blocked = GM_getValue('blockedAuthors', []);
            if (blocked.indexOf(name) === -1) {
              blocked.push(name);
              GM_setValue('blockedAuthors', blocked);
            }
            var container = article.closest('.Plate.ListingElement') || article;
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
      var urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('removeTagsAuto') !== 'true') return;

      tagLog.log('Auto-remove mode activated');

      var notification = document.createElement('div');
      notification.style.cssText = [
        'position:fixed; top:20px; left:50%; transform:translateX(-50%);',
        'background:#ffc107; color:#000; padding:15px 20px; border-radius:8px;',
        'z-index:10000; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-size:14px; font-weight:500;'
      ].join(' ');
      notification.textContent = 'Warte auf vollstandiges Laden der Seite...';
      document.body.appendChild(notification);

      var progressInterval = setInterval(function () {
        var containers = document.querySelectorAll('.Tag-container');
        notification.textContent = 'Seite wird geladen... (' + containers.length + ' Tags gefunden)';
      }, 1000);

      try {
        var tagsRemoved = await this.removeUnwantedTags();
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
      var self = this;
      TM.dom.observeMutations(function (node) {
        if (node.matches && (node.matches('article.ListingElement, .ContentCard') || node.querySelector('article.ListingElement, .ContentCard'))) {
          self.addRemoveButtons();
        }
      });
    }
  }

  window.__GSF__ = window.__GSF__ || {};
  window.__GSF__.TagRemover = TagRemover;
  window.__GSF__.DEFAULT_TAGS = DEFAULT_TAGS;
  window.__GSF__.waitForTagPageReady = waitForTagPageReady;
})();
