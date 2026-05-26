// ==UserScript==
// @name         PromptInjector
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      3.1.0
// @author       marmoris-x
// @description  Injects structured, multi-lingual prompt prefixes into any AI chat input
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=chatgpt.com
// @homepage     https://github.com/marmoris-x/tampermonkey-scripts
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/PromptInjector.user.js
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/PromptInjector.user.js
// @match        *://*/*
// @sandbox      JavaScript
// @tag          ai
// @grant        GM.getValue
// @grant        GM.registerMenuCommand
// @grant        GM.setValue
// @grant        GM.unregisterMenuCommand
// @grant        unsafeWindow
// @grant        window.onurlchange
// @run-at       document-idle
// @compatible   firefox chrome edge
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  
  (function() {
    var SCRIPT_KEY_DOMAINS = "promptinjector_domains";
    var SCRIPT_KEY_SETTINGS = "promptinjector_settings_";
    var INPUT_SELECTOR = 'textarea, input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), [contenteditable="true"],[contenteditable=""],[contenteditable="plaintext-only"]';
    var DEFAULT_SETTINGS = {
      webSearch: false,
      language: "none",
      fatwaSearch: false,
      customLangs: []
    };
    var ISO_639_1_DB = new Map([
      ["aa", { name: "Afar", nativeName: "Afaraf" }],
      ["ab", { name: "Abkhazian", nativeName: "аҧсуа бызшәа" }],
      ["ae", { name: "Avestan", nativeName: "avesta" }],
      ["af", { name: "Afrikaans", nativeName: "Afrikaans" }],
      ["ak", { name: "Akan", nativeName: "Akan" }],
      ["am", { name: "Amharic", nativeName: "አማርኛ" }],
      ["an", { name: "Aragonese", nativeName: "aragonés" }],
      ["ar", { name: "Arabic", nativeName: "العربية" }],
      ["as", { name: "Assamese", nativeName: "অসমীয়া" }],
      ["av", { name: "Avaric", nativeName: "авар мацӀ" }],
      ["ay", { name: "Aymara", nativeName: "aymar aru" }],
      ["az", { name: "Azerbaijani", nativeName: "Azərbaycan dili" }],
      ["ba", { name: "Bashkir", nativeName: "башҡорт теле" }],
      ["be", { name: "Belarusian", nativeName: "беларуская мова" }],
      ["bg", { name: "Bulgarian", nativeName: "български език" }],
      ["bh", { name: "Bihari", nativeName: "भोजपुरी" }],
      ["bi", { name: "Bislama", nativeName: "Bislama" }],
      ["bm", { name: "Bambara", nativeName: "bamanankan" }],
      ["bn", { name: "Bengali", nativeName: "বাংলা" }],
      ["bo", { name: "Tibetan", nativeName: "བོད་ཡིག" }],
      ["br", { name: "Breton", nativeName: "brezhoneg" }],
      ["bs", { name: "Bosnian", nativeName: "bosanski jezik" }],
      ["ca", { name: "Catalan", nativeName: "català" }],
      ["ce", { name: "Chechen", nativeName: "нохчийн мотт" }],
      ["ch", { name: "Chamorro", nativeName: "Chamoru" }],
      ["co", { name: "Corsican", nativeName: "corsu" }],
      ["cr", { name: "Cree", nativeName: "ᓀᐦᐃᔭᐍᐏᐣ" }],
      ["cs", { name: "Czech", nativeName: "čeština" }],
      ["cu", { name: "Old Church Slavonic", nativeName: "ѩзыкъ словѣньскъ" }],
      ["cv", { name: "Chuvash", nativeName: "чӑваш чӗлхи" }],
      ["cy", { name: "Welsh", nativeName: "Cymraeg" }],
      ["da", { name: "Danish", nativeName: "dansk" }],
      ["de", { name: "German", nativeName: "Deutsch" }],
      ["dv", { name: "Divehi", nativeName: "ދިވެހި" }],
      ["dz", { name: "Dzongkha", nativeName: "རྫོང་ཁ" }],
      ["ee", { name: "Ewe", nativeName: "Eʋegbe" }],
      ["el", { name: "Greek", nativeName: "Ελληνικά" }],
      ["en", { name: "English", nativeName: "English" }],
      ["eo", { name: "Esperanto", nativeName: "Esperanto" }],
      ["es", { name: "Spanish", nativeName: "Español" }],
      ["et", { name: "Estonian", nativeName: "eesti" }],
      ["eu", { name: "Basque", nativeName: "euskara" }],
      ["fa", { name: "Persian", nativeName: "فارسی" }],
      ["ff", { name: "Fulah", nativeName: "Fulfulde" }],
      ["fi", { name: "Finnish", nativeName: "suomi" }],
      ["fj", { name: "Fijian", nativeName: "vosa Vakaviti" }],
      ["fo", { name: "Faroese", nativeName: "føroyskt" }],
      ["fr", { name: "French", nativeName: "Français" }],
      ["fy", { name: "Western Frisian", nativeName: "Frysk" }],
      ["ga", { name: "Irish", nativeName: "Gaeilge" }],
      ["gd", { name: "Scottish Gaelic", nativeName: "Gàidhlig" }],
      ["gl", { name: "Galician", nativeName: "galego" }],
      ["gn", { name: "Guarani", nativeName: "Avañe'ẽ" }],
      ["gu", { name: "Gujarati", nativeName: "ગુજરાતી" }],
      ["gv", { name: "Manx", nativeName: "Gaelg" }],
      ["ha", { name: "Hausa", nativeName: "هَوُسَ" }],
      ["he", { name: "Hebrew", nativeName: "עברית" }],
      ["hi", { name: "Hindi", nativeName: "हिन्दी" }],
      ["ho", { name: "Hiri Motu", nativeName: "Hiri Motu" }],
      ["hr", { name: "Croatian", nativeName: "hrvatski jezik" }],
      ["ht", { name: "Haitian", nativeName: "Kreyòl ayisyen" }],
      ["hu", { name: "Hungarian", nativeName: "magyar" }],
      ["hy", { name: "Armenian", nativeName: "Հայերեն" }],
      ["hz", { name: "Herero", nativeName: "Otjiherero" }],
      ["ia", { name: "Interlingua", nativeName: "Interlingua" }],
      ["id", { name: "Indonesian", nativeName: "Bahasa Indonesia" }],
      ["ie", { name: "Interlingue", nativeName: "Interlingue" }],
      ["ig", { name: "Igbo", nativeName: "Asụsụ Igbo" }],
      ["ii", { name: "Nuosu", nativeName: "ꆈꌠ꒿ Nuosuhxop" }],
      ["ik", { name: "Inupiaq", nativeName: "Iñupiaq" }],
      ["io", { name: "Ido", nativeName: "Ido" }],
      ["is", { name: "Icelandic", nativeName: "Íslenska" }],
      ["it", { name: "Italian", nativeName: "Italiano" }],
      ["iu", { name: "Inuktitut", nativeName: "ᐃᓄᒃᑎᑐᑦ" }],
      ["ja", { name: "Japanese", nativeName: "日本語" }],
      ["jv", { name: "Javanese", nativeName: "basa Jawa" }],
      ["ka", { name: "Georgian", nativeName: "ქართული" }],
      ["kg", { name: "Kongo", nativeName: "Kikongo" }],
      ["ki", { name: "Kikuyu", nativeName: "Gĩkũyũ" }],
      ["kj", { name: "Kwanyama", nativeName: "Kuanyama" }],
      ["kk", { name: "Kazakh", nativeName: "қазақ тілі" }],
      ["kl", { name: "Kalaallisut", nativeName: "kalaallisut" }],
      ["km", { name: "Khmer", nativeName: "ភាសាខ្មែរ" }],
      ["kn", { name: "Kannada", nativeName: "ಕನ್ನಡ" }],
      ["ko", { name: "Korean", nativeName: "한국어" }],
      ["kr", { name: "Kanuri", nativeName: "Kanuri" }],
      ["ks", { name: "Kashmiri", nativeName: "कश्मीरी" }],
      ["ku", { name: "Kurdish", nativeName: "Kurdî" }],
      ["kv", { name: "Komi", nativeName: "коми кыв" }],
      ["kw", { name: "Cornish", nativeName: "Kernewek" }],
      ["ky", { name: "Kyrgyz", nativeName: "кыргыз тілі" }],
      ["la", { name: "Latin", nativeName: "latine" }],
      ["lb", { name: "Luxembourgish", nativeName: "Lëtzebuergesch" }],
      ["lg", { name: "Ganda", nativeName: "Luganda" }],
      ["li", { name: "Limburgish", nativeName: "Limburgs" }],
      ["ln", { name: "Lingala", nativeName: "Lingála" }],
      ["lo", { name: "Lao", nativeName: "ພາສາລາວ" }],
      ["lt", { name: "Lithuanian", nativeName: "lietuvių kalba" }],
      ["lu", { name: "Luba-Katanga", nativeName: "Kiluba" }],
      ["lv", { name: "Latvian", nativeName: "latviešu valoda" }],
      ["mg", { name: "Malagasy", nativeName: "fiteny malagasy" }],
      ["mh", { name: "Marshallese", nativeName: "Kajin M̧ajeļ" }],
      ["mi", { name: "Māori", nativeName: "te reo Māori" }],
      ["mk", { name: "Macedonian", nativeName: "македонски јазик" }],
      ["ml", { name: "Malayalam", nativeName: "മലയാളം" }],
      ["mn", { name: "Mongolian", nativeName: "Монгол хэл" }],
      ["mr", { name: "Marathi", nativeName: "मराठी" }],
      ["ms", { name: "Malay", nativeName: "Bahasa Melayu" }],
      ["mt", { name: "Maltese", nativeName: "Malti" }],
      ["my", { name: "Burmese", nativeName: "ဗမာစာ" }],
      ["na", { name: "Nauru", nativeName: "Dorerin Naoero" }],
      ["nb", { name: "Norwegian Bokmål", nativeName: "Norsk bokmål" }],
      ["nd", { name: "Northern Ndebele", nativeName: "isiNdebele" }],
      ["ne", { name: "Nepali", nativeName: "नेपाली" }],
      ["ng", { name: "Ndonga", nativeName: "Owambo" }],
      ["nl", { name: "Dutch", nativeName: "Nederlands" }],
      ["nn", { name: "Norwegian Nynorsk", nativeName: "Norsk nynorsk" }],
      ["no", { name: "Norwegian", nativeName: "Norsk" }],
      ["nr", { name: "Southern Ndebele", nativeName: "isiNdebele" }],
      ["nv", { name: "Navajo", nativeName: "Diné bizaad" }],
      ["ny", { name: "Chichewa", nativeName: "chiCheŵa" }],
      ["oc", { name: "Occitan", nativeName: "occitan" }],
      ["oj", { name: "Ojibwe", nativeName: "ᐊᓂᔑᓈᐯᒧᐎᓐ" }],
      ["om", { name: "Oromo", nativeName: "Afaan Oromoo" }],
      ["or", { name: "Oriya", nativeName: "ଓଡ଼ିଆ" }],
      ["os", { name: "Ossetian", nativeName: "ирон æвзаг" }],
      ["pa", { name: "Panjabi", nativeName: "ਪੰਜਾਬੀ" }],
      ["pi", { name: "Pāli", nativeName: "पाऴि" }],
      ["pl", { name: "Polish", nativeName: "polski" }],
      ["ps", { name: "Pashto", nativeName: "پښتو" }],
      ["pt", { name: "Portuguese", nativeName: "Português" }],
      ["qu", { name: "Quechua", nativeName: "Runa Simi" }],
      ["rm", { name: "Romansh", nativeName: "rumantsch grischun" }],
      ["rn", { name: "Kirundi", nativeName: "Ikirundi" }],
      ["ro", { name: "Romanian", nativeName: "Română" }],
      ["ru", { name: "Russian", nativeName: "Русский" }],
      ["rw", { name: "Kinyarwanda", nativeName: "Ikinyarwanda" }],
      ["sa", { name: "Sanskrit", nativeName: "संस्कृतम्" }],
      ["sc", { name: "Sardinian", nativeName: "sardu" }],
      ["sd", { name: "Sindhi", nativeName: "सिन्धी" }],
      ["se", { name: "Northern Sami", nativeName: "davvisámegiella" }],
      ["sg", { name: "Sango", nativeName: "yângâ tî sängö" }],
      ["si", { name: "Sinhala", nativeName: "සිංහල" }],
      ["sk", { name: "Slovak", nativeName: "slovenčina" }],
      ["sl", { name: "Slovenian", nativeName: "slovenščina" }],
      ["sm", { name: "Samoan", nativeName: "gagana fa'a Samoa" }],
      ["sn", { name: "Shona", nativeName: "chiShona" }],
      ["so", { name: "Somali", nativeName: "Soomaaliga" }],
      ["sq", { name: "Albanian", nativeName: "Shqip" }],
      ["sr", { name: "Serbian", nativeName: "српски језик" }],
      ["ss", { name: "Swati", nativeName: "SiSwati" }],
      ["st", { name: "Southern Sotho", nativeName: "Sesotho" }],
      ["su", { name: "Sundanese", nativeName: "Basa Sunda" }],
      ["sv", { name: "Swedish", nativeName: "svenska" }],
      ["sw", { name: "Swahili", nativeName: "Kiswahili" }],
      ["ta", { name: "Tamil", nativeName: "தமிழ்" }],
      ["te", { name: "Telugu", nativeName: "తెలుగు" }],
      ["tg", { name: "Tajik", nativeName: "тоҷикӣ" }],
      ["th", { name: "Thai", nativeName: "ไทย" }],
      ["ti", { name: "Tigrinya", nativeName: "ትግርኛ" }],
      ["tk", { name: "Turkmen", nativeName: "Türkmen" }],
      ["tl", { name: "Tagalog", nativeName: "Wikang Tagalog" }],
      ["tn", { name: "Tswana", nativeName: "Setswana" }],
      ["to", { name: "Tonga", nativeName: "faka Tonga" }],
      ["tr", { name: "Turkish", nativeName: "Türkçe" }],
      ["ts", { name: "Tsonga", nativeName: "Xitsonga" }],
      ["tt", { name: "Tatar", nativeName: "татар теле" }],
      ["tw", { name: "Twi", nativeName: "Twi" }],
      ["ty", { name: "Tahitian", nativeName: "Reo Tahiti" }],
      ["ug", { name: "Uighur", nativeName: "Uyƣurqə" }],
      ["uk", { name: "Ukrainian", nativeName: "українська мова" }],
      ["ur", { name: "Urdu", nativeName: "اردو" }],
      ["uz", { name: "Uzbek", nativeName: "O'zbek" }],
      ["ve", { name: "Venda", nativeName: "Tshivenḓa" }],
      ["vi", { name: "Vietnamese", nativeName: "Tiếng Việt" }],
      ["vo", { name: "Volapük", nativeName: "Volapük" }],
      ["wa", { name: "Walloon", nativeName: "walon" }],
      ["wo", { name: "Wolof", nativeName: "Wollof" }],
      ["xh", { name: "Xhosa", nativeName: "isiXhosa" }],
      ["yi", { name: "Yiddish", nativeName: "ייִדיש" }],
      ["yo", { name: "Yoruba", nativeName: "Yorùbá" }],
      ["za", { name: "Zhuang", nativeName: "Saɯ cueŋƅ" }],
      ["zh", { name: "Chinese", nativeName: "中文" }],
      ["zu", { name: "Zulu", nativeName: "isiZulu" }]
    ]);
    var PROMPT_PREFIXES = {
      webSearch: "THINK EXTREMELY ULTRA SUPER HARD AND USE MULTIPLE TIMES GOOGLE SEARCH WITH EXTREMELY DIFFERENT SOURCES: ",
      language: {
        de: "RECHERCHIERE GRÜNDLICH IN DEUTSCHEN QUELLEN; DIE IN DEUTSCH VERFASST WORDEN SIND: ",
        en: "THOROUGHLY RESEARCH ENGLISH-LANGUAGE SOURCES; THOSE WRITTEN IN ENGLISH: ",
        ar: "ابحث بدقة في المصادر العربية؛ تلك المكتوبة باللغة العربية: "
      },
      fatwaSearch: "ACCORDING TO AHLUL ATHAR: "
    };
    function buildPrompt(userText, settings2) {
      var prefix = "";
      if (settings2.webSearch) {
        prefix += PROMPT_PREFIXES.webSearch;
      }
      if (settings2.language !== "none") {
        var langCode = settings2.language;
        var langData = ISO_639_1_DB.get(langCode);
        if (langData) {
          if (PROMPT_PREFIXES.language[langCode]) {
            prefix += PROMPT_PREFIXES.language[langCode];
          } else {
            var langName = langData.name.toUpperCase();
            prefix += "THOROUGHLY RESEARCH " + langName + "-LANGUAGE SOURCES; THOSE WRITTEN IN " + langName + ": ";
          }
        }
      }
      if (settings2.fatwaSearch) {
        prefix += PROMPT_PREFIXES.fatwaSearch;
      }
      return prefix + (userText || "");
    }
    function debug(msg, data) {
    }
    window.addEventListener("error", function(e) {
      debug("Unhandled error", e.error);
    });
    window.addEventListener("unhandledrejection", function(e) {
      debug("Unhandled rejection", e.reason);
    });
    function loadDomains() {
      return GM.getValue(SCRIPT_KEY_DOMAINS, "[]").then(function(raw) {
        return new Set(JSON.parse(raw));
      }).catch(function(e) {
        return new Set();
      });
    }
    function saveDomains(set) {
      return GM.setValue(SCRIPT_KEY_DOMAINS, JSON.stringify(Array.from(set))).catch(function(e) {
      });
    }
    function loadSettings(hostname) {
      return GM.getValue(SCRIPT_KEY_SETTINGS + hostname, null).then(function(raw) {
        var stored = raw ? JSON.parse(raw) : {};
        var result = {};
        for (var k in DEFAULT_SETTINGS) {
          if (DEFAULT_SETTINGS.hasOwnProperty(k)) {
            result[k] = DEFAULT_SETTINGS[k];
          }
        }
        for (var k2 in stored) {
          if (stored.hasOwnProperty(k2)) {
            result[k2] = stored[k2];
          }
        }
        if (result.fatwaSearch === void 0 && result.ahlulAthar !== void 0) {
          result.fatwaSearch = result.ahlulAthar;
          delete result.ahlulAthar;
        }
        return result;
      }).catch(function(e) {
        var fallback = {};
        for (var k3 in DEFAULT_SETTINGS) {
          if (DEFAULT_SETTINGS.hasOwnProperty(k3)) {
            fallback[k3] = DEFAULT_SETTINGS[k3];
          }
        }
        return fallback;
      });
    }
    function saveSettings(hostname, obj) {
      return GM.setValue(SCRIPT_KEY_SETTINGS + hostname, JSON.stringify(obj)).catch(function(e) {
      });
    }
    function readField(element) {
      if (element.isContentEditable) {
        return element.innerText || element.textContent || "";
      }
      return element.value || "";
    }
    function writeField(element, value) {
      if (element.isContentEditable) {
        element.focus();
        try {
          var inputEvent = new InputEvent("input", {
            inputType: "insertText",
            data: value,
            bubbles: true,
            cancelable: true
          });
          element.dispatchEvent(inputEvent);
          if (element.innerText === value || element.textContent === value) return;
        } catch (e1) {
        }
        try {
          var success = document.execCommand("selectAll", false, null) && document.execCommand("insertText", false, value);
          if (success) return;
        } catch (e2) {
        }
        try {
          element.focus();
          var range = document.createRange();
          range.selectNodeContents(element);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          element.dispatchEvent(new InputEvent("input", {
            inputType: "insertFromPaste",
            data: value,
            bubbles: true,
            cancelable: true
          }));
          if (element.innerText === value || element.textContent === value) return;
        } catch (e3) {
        }
        element.textContent = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
      var proto = element instanceof (unsafeWindow && unsafeWindow.HTMLTextAreaElement) ? unsafeWindow.HTMLTextAreaElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof (unsafeWindow && unsafeWindow.HTMLInputElement) ? unsafeWindow.HTMLInputElement.prototype : HTMLInputElement.prototype;
      var nativeSetter = Object.getOwnPropertyDescriptor(proto, "value").set;
      var ownDescriptor = Object.getOwnPropertyDescriptor(element, "value");
      var effectiveSetter = ownDescriptor && ownDescriptor.set && ownDescriptor.set !== nativeSetter ? nativeSetter : nativeSetter;
      if (effectiveSetter) {
        effectiveSetter.call(element, value);
      } else {
        element.value = value;
      }
      if (element._valueTracker) {
        delete element._valueTracker;
      }
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
    var boundFields = new WeakSet();
    var processingFields = new WeakSet();
    var observerTimeout = null;
    function initFields() {
      document.querySelectorAll(INPUT_SELECTOR).forEach(function(el) {
        if (boundFields.has(el)) return;
        boundFields.add(el);
      });
    }
    function createFieldObserver() {
      var observer = new MutationObserver(function(mutations) {
        var shouldScan = false;
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type !== "childList") continue;
          for (var j = 0; j < m.addedNodes.length; j++) {
            var node = m.addedNodes[j];
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if (node.matches && node.matches(INPUT_SELECTOR) && !boundFields.has(node)) {
              boundFields.add(node);
              continue;
            }
            if (node.querySelectorAll) {
              var inputs = node.querySelectorAll(INPUT_SELECTOR);
              if (inputs.length > 0) {
                shouldScan = true;
                break;
              }
            }
          }
          if (shouldScan) break;
        }
        if (shouldScan) {
          clearTimeout(observerTimeout);
          observerTimeout = setTimeout(initFields, 200);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      initFields();
      return observer;
    }
    function createAutoInjector() {
      function handleKeydown(e) {
        var target = e.target;
        if (!target || !target.matches || !target.matches(INPUT_SELECTOR)) return;
        if (processingFields.has(target)) return;
        var hasModifier = e.ctrlKey || e.metaKey || e.altKey;
        var isNavigation = e.key === "Tab" || e.key === "Escape" || e.key === "Enter";
        var isDelete = e.key === "Backspace" || e.key === "Delete";
        if (hasModifier || isNavigation || isDelete) return;
        var currentText = readField(target);
        if (currentText.length > 0) return;
        processingFields.add(target);
        try {
          var fullText = buildPrompt(currentText, settings);
          writeField(target, fullText);
        } finally {
          setTimeout(function() {
            processingFields.delete(target);
          }, 150);
        }
      }
      function handlePaste(e) {
        var target = e.target;
        if (!target || !target.matches || !target.matches(INPUT_SELECTOR)) return;
        if (processingFields.has(target)) return;
        if (readField(target).length > 0) return;
        setTimeout(function() {
          if (processingFields.has(target)) return;
          var currentText = readField(target);
          if (currentText.length > 0) {
            processingFields.add(target);
            try {
              var fullText = buildPrompt(currentText, settings);
              writeField(target, fullText);
            } finally {
              setTimeout(function() {
                processingFields.delete(target);
              }, 150);
            }
          }
        }, 10);
      }
      document.addEventListener("keydown", handleKeydown, true);
      document.addEventListener("paste", handlePaste, true);
    }
    var settings = {
      webSearch: false,
      language: "none",
      fatwaSearch: false,
      customLangs: []
    };
    function setupSpaPolyfill() {
      if (!("onurlchange" in window)) {
        var lastUrl = location.href;
        var handler = function() {
          var url = location.href;
          if (url !== lastUrl) {
            lastUrl = url;
            window.dispatchEvent(new Event("urlchange"));
          }
        };
        window.addEventListener("popstate", handler);
        window.addEventListener("hashchange", handler);
        var titleEl = document.querySelector("title");
        if (titleEl) {
          new MutationObserver(handler).observe(titleEl, { childList: true });
        }
        setInterval(handler, 500);
      }
    }
    (async function() {
      var hostname = location.hostname;
      var domains = await loadDomains();
      var isActive = domains.has(hostname);
      if (!isActive && hostname === "www.google.com") {
        var params = new URLSearchParams(location.search);
        if (params.get("udm") === "50") {
          domains.add(hostname);
          await saveDomains(domains);
          isActive = true;
        }
      }
      var menuIds = new Map();
      function registerMenuCommand(id, text, callback) {
        var cmdId = GM.registerMenuCommand(text, callback, {
          id,
          autoClose: true
        });
        menuIds.set(id, cmdId);
        return cmdId;
      }
      var toggleCb = function() {
        loadDomains().then(function(currentDomains) {
          if (currentDomains.has(hostname)) {
            currentDomains.delete(hostname);
          } else {
            currentDomains.add(hostname);
          }
          return saveDomains(currentDomains).then(function() {
            registerMenuCommand(
              "pi_toggle_active",
              "PromptInjector: " + (currentDomains.has(hostname) ? "✅ Aktiv" : "❌ Inaktiv") + " auf " + hostname,
              toggleCb
            );
            location.reload();
          });
        }).catch(function(e) {
        });
      };
      function rebuildMenus(settings2, hostname2) {
        menuIds.forEach(function(id) {
          GM.unregisterMenuCommand(id);
        });
        menuIds.clear();
        registerMenuCommand(
          "pi_toggle_active",
          "PromptInjector: " + (isActive ? "✅ Active on" : "❌ Inactive on") + " " + hostname2,
          toggleCb
        );
        registerMenuCommand(
          "pi_toggle_webSearch",
          "Web Search: " + (settings2.webSearch ? "✓" : "✗"),
          function() {
            settings2.webSearch = !settings2.webSearch;
            saveSettings(hostname2, settings2);
            rebuildMenus(settings2, hostname2);
          }
        );
        var currentLangLabel = "none";
        if (settings2.language !== "none" && ISO_639_1_DB.has(settings2.language)) {
          currentLangLabel = ISO_639_1_DB.get(settings2.language).name;
        }
        registerMenuCommand(
          "pi_lang_set",
          "Source Language: " + currentLangLabel,
          function() {
            var code = prompt(
              'Enter ISO 639-1 language code (e.g. "de" for German, "fr" for French).\nLeave empty to disable language filter.\nCurrent: ' + currentLangLabel
            );
            if (code === null) return;
            code = code.trim().toLowerCase();
            if (code === "") {
              settings2.language = "none";
            } else if (ISO_639_1_DB.has(code)) {
              if (settings2.fatwaSearch && code !== "ar") {
                if (!confirm("Fatwa Search requires Arabic. Disable Fatwa Search to change language?")) return;
                settings2.fatwaSearch = false;
              }
              settings2.language = code;
            } else {
              alert("Invalid language code. Please enter a valid ISO 639-1 code.");
              return;
            }
            saveSettings(hostname2, settings2);
            rebuildMenus(settings2, hostname2);
          }
        );
        registerMenuCommand(
          "pi_toggle_fatwaSearch",
          "Fatwa Search: " + (settings2.fatwaSearch ? "✓" : "✗"),
          function() {
            settings2.fatwaSearch = !settings2.fatwaSearch;
            if (settings2.fatwaSearch) {
              settings2.language = "ar";
            }
            saveSettings(hostname2, settings2);
            rebuildMenus(settings2, hostname2);
          }
        );
      }
      registerMenuCommand(
        "pi_toggle_active",
        "PromptInjector: " + (isActive ? "✅ Aktiv" : "❌ Inaktiv") + " auf " + hostname,
        toggleCb
      );
      if (!isActive) return;
      settings = await loadSettings(hostname);
      if (settings.fatwaSearch && settings.language !== "ar") {
        settings.language = "ar";
        await saveSettings(hostname, settings);
      }
      setupSpaPolyfill();
      rebuildMenus(settings, hostname);
      createFieldObserver();
      createAutoInjector();
      window.addEventListener("urlchange", function() {
        setTimeout(initFields, 300);
      });
    })().catch(function(err) {
      console.error("[PromptInjector] Init error:", err);
    });
  })();

})();