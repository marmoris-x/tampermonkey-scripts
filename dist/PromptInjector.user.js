// ==UserScript==
// @name         PromptInjector
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.0.0
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
// @grant        GM.addElement
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

  const SCRIPT_KEY_DOMAINS = "promptinjector_domains";
  const SCRIPT_KEY_SETTINGS = "promptinjector_settings_";
  const SCRIPT_KEY_CUSTOM_LANGS = "promptinjector_customLangs";
  const HOST_ID = "__promptinjector_ui_host";
  const INPUT_SELECTOR = `textarea, input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), [contenteditable="true"],[contenteditable=""]`;
  const DEFAULT_SETTINGS = {
    webSearch: false,
    language: "none",
    ahlulAthar: false,
    customLangs: []
  };
  const THEME = {
    bg: "linear-gradient(135deg, #0d0d1a 0%, #111827 55%, #0a1628 100%)",
    border: "rgba(99, 102, 241, 0.35)",
    text: "#e2e8f0",
    accent: "#6366f1"
  };
  const ISO_639_1_DB = new Map([
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
  const TOP_25_LANGS = [
    "en",
    "zh",
    "es",
    "de",
    "ja",
    "fr",
    "ar",
    "pt",
    "ru",
    "ko",
    "hi",
    "it",
    "nl",
    "tr",
    "pl",
    "sv",
    "vi",
    "th",
    "id",
    "uk",
    "ro",
    "cs",
    "he",
    "el",
    "fa"
  ];
  const PROMPT_PREFIXES = {
    webSearch: "THINK EXTREMELY ULTRA SUPER HARD AND USE MULTIPLE TIMES GOOGLE SEARCH WITH EXTREMELY DIFFERENT SOURCES: ",
    language: {
      de: "RECHERCHIERE GRÜNDLICH IN DEUTSCHEN QUELLEN; DIE IN DEUTSCH VERFASST WORDEN SIND: ",
      en: "THOROUGHLY RESEARCH ENGLISH-LANGUAGE SOURCES; THOSE WRITTEN IN ENGLISH: ",
      ar: "ابحث بدقة في المصادر العربية؛ تلك المكتوبة باللغة العربية: "
    },
    ahlulAthar: "GEMÄß AHLUL ATHAR: "
  };
  function buildPrompt(userText, settings2) {
    let prefix = "";
    if (settings2.webSearch) {
      prefix += PROMPT_PREFIXES.webSearch;
    }
    if (settings2.language !== "none") {
      const langCode = settings2.language;
      const langData = ISO_639_1_DB.get(langCode);
      if (langData) {
        if (PROMPT_PREFIXES.language[langCode]) {
          prefix += PROMPT_PREFIXES.language[langCode];
        } else {
          const langName = langData.name.toUpperCase();
          prefix += `THOROUGHLY RESEARCH ${langName}-LANGUAGE SOURCES; THOSE WRITTEN IN ${langName}: `;
        }
      }
    }
    if (settings2.ahlulAthar) {
      prefix += PROMPT_PREFIXES.ahlulAthar;
    }
    return prefix + (userText || "");
  }
  function debug(msg, data) {
  }
  window.addEventListener("error", (e) => {
    debug("Unhandled error", e.error);
  });
  window.addEventListener("unhandledrejection", (e) => {
    debug("Unhandled rejection", e.reason);
  });
  async function loadDomains() {
    try {
      const raw = await GM.getValue(SCRIPT_KEY_DOMAINS, "[]");
      return new Set(JSON.parse(raw));
    } catch (e) {
      return new Set();
    }
  }
  async function saveDomains(set) {
    try {
      await GM.setValue(SCRIPT_KEY_DOMAINS, JSON.stringify([...set]));
    } catch (e) {
    }
  }
  async function loadSettings(hostname) {
    try {
      const raw = await GM.getValue(SCRIPT_KEY_SETTINGS + hostname, null);
      const stored = raw ? JSON.parse(raw) : {};
      return { ...DEFAULT_SETTINGS, ...stored };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }
  async function saveSettings(hostname, obj) {
    try {
      await GM.setValue(SCRIPT_KEY_SETTINGS + hostname, JSON.stringify(obj));
    } catch (e) {
    }
  }
  async function loadCustomLangs() {
    try {
      const raw = await GM.getValue(SCRIPT_KEY_CUSTOM_LANGS, "[]");
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }
  async function saveCustomLangs(langs) {
    try {
      await GM.setValue(SCRIPT_KEY_CUSTOM_LANGS, JSON.stringify(langs));
    } catch (e) {
    }
  }
  function readField(element) {
    if (element.isContentEditable) {
      return element.innerText || element.textContent || "";
    }
    return element.value || "";
  }
  function writeField(element, value) {
    var _a;
    if (element.isContentEditable) {
      element.focus();
      try {
        const inputEvent = new InputEvent("input", {
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
        const success = document.execCommand("selectAll", false, null) && document.execCommand("insertText", false, value);
        if (success) return;
      } catch (e2) {
      }
      element.textContent = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    const proto = element instanceof (unsafeWindow == null ? void 0 : unsafeWindow.HTMLTextAreaElement) ? unsafeWindow.HTMLTextAreaElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof (unsafeWindow == null ? void 0 : unsafeWindow.HTMLInputElement) ? unsafeWindow.HTMLInputElement.prototype : HTMLInputElement.prototype;
    const nativeSetter = (_a = Object.getOwnPropertyDescriptor(proto, "value")) == null ? void 0 : _a.set;
    const ownDescriptor = Object.getOwnPropertyDescriptor(element, "value");
    const effectiveSetter = (ownDescriptor == null ? void 0 : ownDescriptor.set) && ownDescriptor.set !== nativeSetter ? nativeSetter : nativeSetter;
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
  async function registerDomainGuard() {
    const hostname = location.hostname;
    const domains = await loadDomains();
    const isActive = domains.has(hostname);
    const labelText = (active, host) => active ? `PromptInjector: ✅ Aktiv auf ${host}` : `PromptInjector: ❌ Inaktiv auf ${host}`;
    let menuId = GM.registerMenuCommand(
      labelText(isActive, hostname),
      async () => {
        try {
          const currentDomains = await loadDomains();
          if (currentDomains.has(hostname)) {
            currentDomains.delete(hostname);
          } else {
            currentDomains.add(hostname);
          }
          await saveDomains(currentDomains);
          GM.unregisterMenuCommand(menuId);
          menuId = GM.registerMenuCommand(
            labelText(!currentDomains.has(hostname), hostname),
            arguments.callee
          );
          location.reload();
        } catch (e) {
        }
      }
    );
    return { hostname, isActive, domains };
  }
  let lastGearPos = { top: 0, left: 0 };
  function positionGear(hostEl, gearEl, field) {
    const rect = field.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    let top = rect.top + scrollY + rect.height / 2 - 11;
    let left = rect.right + scrollX + 4;
    if (rect.right + 30 > window.innerWidth) {
      left = rect.left + scrollX - 26;
    }
    if (Math.abs(top - lastGearPos.top) > 1 || Math.abs(left - lastGearPos.left) > 1) {
      hostEl.style.top = top + "px";
      hostEl.style.left = left + "px";
      lastGearPos = { top, left };
    }
    gearEl.hidden = false;
  }
  const boundFields = new WeakSet();
  let observerTimeout = null;
  function initFields() {
    document.querySelectorAll(INPUT_SELECTOR).forEach((el) => {
      if (boundFields.has(el)) return;
      boundFields.add(el);
    });
  }
  function createFieldObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const m of mutations) {
        if (m.type !== "childList") continue;
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.matches && node.matches(INPUT_SELECTOR) && !boundFields.has(node)) {
            boundFields.add(node);
            continue;
          }
          if (node.querySelectorAll) {
            const inputs = node.querySelectorAll(INPUT_SELECTOR);
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
  function isSubmitButtonFor(btn, field) {
    let el = field;
    for (let i = 0; i < 5; i++) {
      if (!el || !el.parentElement) break;
      el = el.parentElement;
      if (el.contains(btn)) return true;
    }
    return false;
  }
  const injectedEvents = new WeakSet();
  function createEventInterceptor(gearEl, panelEl, hostEl) {
    let lastFocusedField2 = null;
    let focusoutTimer = null;
    let rafId = null;
    document.addEventListener("focusin", (e) => {
      const target = e.target;
      if (target.matches && target.matches(INPUT_SELECTOR)) {
        clearTimeout(focusoutTimer);
        lastFocusedField2 = target;
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          positionGear(hostEl, gearEl, target);
        });
      }
    });
    document.addEventListener("focusout", () => {
      focusoutTimer = setTimeout(() => {
        gearEl.hidden = true;
        lastFocusedField2 = null;
      }, 150);
    });
    gearEl.addEventListener("click", (e) => {
      e.stopPropagation();
      panelEl.hidden = !panelEl.hidden;
    });
    document.addEventListener("click", (e) => {
      if (!panelEl.hidden && !panelEl.contains(e.target) && e.target !== gearEl) {
        panelEl.hidden = true;
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const field = lastFocusedField2 || document.activeElement;
        if (field && boundFields.has(field)) {
          if (injectedEvents.has(field)) return;
          injectedEvents.add(field);
          const userText = readField(field);
          const fullText = buildPrompt(userText, settings);
          writeField(field, fullText);
          setTimeout(() => injectedEvents.delete(field), 100);
        }
      }
    });
    document.addEventListener("click", (e) => {
      const btn = e.target.closest('button, input[type="submit"]');
      if (!btn || !lastFocusedField2) return;
      if (!isSubmitButtonFor(btn, lastFocusedField2)) return;
      if (injectedEvents.has(lastFocusedField2)) return;
      injectedEvents.add(lastFocusedField2);
      const userText = readField(lastFocusedField2);
      const fullText = buildPrompt(userText, settings);
      writeField(lastFocusedField2, fullText);
      setTimeout(() => injectedEvents.delete(lastFocusedField2), 100);
    });
    document.addEventListener("submit", () => {
      const field = lastFocusedField2;
      if (!field || !boundFields.has(field)) return;
      if (injectedEvents.has(field)) return;
      injectedEvents.add(field);
      const userText = readField(field);
      const fullText = buildPrompt(userText, settings);
      writeField(field, fullText);
      setTimeout(() => injectedEvents.delete(field), 100);
    });
  }
  let settings = { ...DEFAULT_SETTINGS };
  function setupSpaPolyfill() {
    if (!("onurlchange" in window)) {
      let lastUrl = location.href;
      const handler = () => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          window.dispatchEvent(new Event("urlchange"));
        }
      };
      window.addEventListener("popstate", handler);
      window.addEventListener("hashchange", handler);
      const titleEl = document.querySelector("title");
      if (titleEl) {
        new MutationObserver(handler).observe(titleEl, { childList: true });
      }
      setInterval(handler, 500);
    }
  }
  function registerBoot() {
    (async function() {
      const { hostname, isActive } = await registerDomainGuard();
      if (!isActive) return;
      settings = await loadSettings(hostname);
      let customLangs = await loadCustomLangs();
      if (settings.ahlulAthar && settings.language !== "ar") {
        settings.language = "ar";
        await saveSettings(hostname, settings);
      }
      setupSpaPolyfill();
      const host = document.createElement("div");
      host.id = HOST_ID;
      host.style.cssText = "position:absolute;z-index:2147483647;pointer-events:none;top:0;left:0";
      document.body.appendChild(host);
      let shadowRoot;
      try {
        shadowRoot = host.attachShadow({ mode: "closed" });
      } catch (e) {
        shadowRoot = host.attachShadow({ mode: "open" });
      }
      const CSS_TEXT = `
      :host {
        all: initial;
        contain: strict;
        isolation: isolate;
        position: absolute;
        z-index: 2147483647;
        pointer-events: none;
      }
      #gear {
        all: unset;
        pointer-events: auto;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px; height: 22px;
        background: #111827;
        border: 1px solid ${THEME.border};
        border-radius: 4px;
        color: ${THEME.text};
        font-size: 13px;
        opacity: 0.8;
        transition: opacity .15s;
      }
      #gear:hover { opacity: 1; }
      #gear:focus-visible {
        outline: 2px solid ${THEME.accent};
        outline-offset: 2px;
      }
      #panel {
        pointer-events: auto;
        position: fixed;
        background: ${THEME.bg};
        border: 1px solid ${THEME.border};
        border-radius: 6px;
        padding: 12px 16px;
        color: ${THEME.text};
        font: 13px/1.6 system-ui, sans-serif;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 240px;
        box-shadow: 0 4px 24px rgba(0,0,0,.5);
      }
      #panel[hidden] { display: none; }
      label {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
      }
      select {
        background: #1a1a2e;
        color: ${THEME.text};
        border: 1px solid ${THEME.border};
        border-radius: 3px;
        padding: 2px 4px;
        min-width: 150px;
      }
      select:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      input[type="checkbox"] { accent-color: ${THEME.accent}; }
      #custom-lang-controls { display: flex; gap: 4px; margin-top: 4px; }
      #custom-lang-controls button {
        background: ${THEME.accent};
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        padding: 2px 8px;
        font-size: 12px;
      }
      #custom-lang-controls button:hover {
        filter: brightness(1.15);
      }
      .default-option { color: ${THEME.text}; }
      .none-option { color: #666; }
      .custom-option { color: #93c5fd; }
      .note {
        color: #94a3b8;
        font-size: 11px;
        line-height: 1.4;
      }
    `;
      if (typeof CSSStyleSheet.prototype.replaceSync === "function") {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(CSS_TEXT);
        shadowRoot.adoptedStyleSheets = [sheet];
      } else {
        const styleEl = document.createElement("style");
        styleEl.textContent = CSS_TEXT;
        shadowRoot.appendChild(styleEl);
      }
      const gear = document.createElement("button");
      gear.id = "gear";
      gear.setAttribute("aria-label", "Prompt-Einstellungen");
      gear.setAttribute("tabindex", "0");
      gear.textContent = "⚙";
      shadowRoot.appendChild(gear);
      const panel = document.createElement("div");
      panel.id = "panel";
      panel.hidden = true;
      const createLabeledCheckbox = (id, labelText, checked) => {
        const label = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.id = id;
        cb.checked = checked;
        label.appendChild(cb);
        label.append(" " + labelText);
        return label;
      };
      const createOption = (value, text, className) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = text;
        if (className) opt.className = className;
        return opt;
      };
      const webSearchLabel = createLabeledCheckbox(
        "webSearch",
        "Web Search",
        settings.webSearch
      );
      panel.appendChild(webSearchLabel);
      const langLabel = document.createElement("label");
      langLabel.textContent = "Sprache: ";
      const langSelect = document.createElement("select");
      langSelect.id = "lang-select";
      const noneOption = createOption("none", "– (keine)", "none-option");
      langSelect.appendChild(noneOption);
      TOP_25_LANGS.forEach((code) => {
        if (ISO_639_1_DB.has(code)) {
          const lang = ISO_639_1_DB.get(code);
          langSelect.appendChild(
            createOption(code, `${lang.name} (${lang.nativeName})`, "default-option")
          );
        }
      });
      customLangs.forEach((code) => {
        if (ISO_639_1_DB.has(code) && !TOP_25_LANGS.includes(code)) {
          const lang = ISO_639_1_DB.get(code);
          langSelect.appendChild(
            createOption(code, `${lang.name} (${lang.nativeName})`, "custom-option")
          );
        }
      });
      langSelect.value = settings.language;
      langLabel.appendChild(langSelect);
      panel.appendChild(langLabel);
      const ahlulAtharLabel = createLabeledCheckbox(
        "ahlulAthar",
        "Ahlul Athar",
        settings.ahlulAthar
      );
      panel.appendChild(ahlulAtharLabel);
      const customLangControls = document.createElement("div");
      customLangControls.id = "custom-lang-controls";
      customLangControls.style.display = "none";
      const addLangBtn = document.createElement("button");
      addLangBtn.textContent = "+ Sprache";
      const removeLangBtn = document.createElement("button");
      removeLangBtn.textContent = "– Sprache";
      customLangControls.appendChild(addLangBtn);
      customLangControls.appendChild(removeLangBtn);
      const enableCustomLangsLabel = createLabeledCheckbox(
        "enableCustomLangs",
        "Eigene Sprachen aktivieren",
        false
      );
      panel.appendChild(enableCustomLangsLabel);
      panel.appendChild(customLangControls);
      const hint = document.createElement("div");
      hint.className = "note";
      hint.textContent = "Drücke Enter nach Texteingabe — der Prefix wird automatisch vorangestellt.";
      panel.appendChild(hint);
      shadowRoot.appendChild(panel);
      shadowRoot.getElementById("webSearch").addEventListener("change", async (e) => {
        settings.webSearch = e.target.checked;
        await saveSettings(hostname, settings);
      });
      langSelect.addEventListener("change", async (e) => {
        settings.language = e.target.value;
        await saveSettings(hostname, settings);
      });
      const ahlulAtharCheckbox = shadowRoot.getElementById("ahlulAthar");
      ahlulAtharCheckbox.addEventListener("change", async (e) => {
        settings.ahlulAthar = e.target.checked;
        if (e.target.checked) {
          settings.language = "ar";
          langSelect.value = "ar";
          langSelect.disabled = true;
        } else {
          langSelect.disabled = false;
        }
        await saveSettings(hostname, settings);
      });
      ahlulAtharCheckbox.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (!settings.ahlulAthar) return;
        if (confirm(
          "Ahlul Athar ist aktiviert. Möchten Sie die Sprache für diese Session manuell überschreiben?"
        )) {
          langSelect.disabled = false;
          langSelect.focus();
        }
      });
      shadowRoot.getElementById("enableCustomLangs").addEventListener("change", (e) => {
        customLangControls.style.display = e.target.checked ? "flex" : "none";
      });
      addLangBtn.addEventListener("click", async () => {
        const code = prompt(
          'ISO-639-1-Code der Sprache eingeben (z.B. "sw" für Swahili):'
        );
        if (code && ISO_639_1_DB.has(code) && !customLangs.includes(code)) {
          customLangs.push(code);
          await saveCustomLangs(customLangs);
          const lang = ISO_639_1_DB.get(code);
          langSelect.appendChild(
            createOption(code, `${lang.name} (${lang.nativeName})`, "custom-option")
          );
        }
      });
      removeLangBtn.addEventListener("click", async () => {
        const code = prompt(
          "ISO-639-1-Code der zu entfernenden Sprache eingeben:"
        );
        if (code && customLangs.includes(code)) {
          customLangs = customLangs.filter((c) => c !== code);
          await saveCustomLangs(customLangs);
          const opt = langSelect.querySelector(`option[value="${code}"]`);
          if (opt) opt.remove();
        }
      });
      if (settings.ahlulAthar) {
        langSelect.disabled = true;
      }
      panel.addEventListener("keydown", (e) => {
        if (e.key === "Escape") panel.hidden = true;
      });
      createFieldObserver();
      createEventInterceptor(gear, panel, host);
      window.addEventListener("urlchange", (_info) => {
        gear.hidden = true;
        panel.hidden = true;
        lastFocusedField = null;
        setTimeout(initFields, 300);
      });
    })();
  }
  
  registerBoot();

})();