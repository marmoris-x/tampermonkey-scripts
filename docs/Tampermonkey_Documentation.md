# Source: https://www.tampermonkey.net/documentation.php

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
# Table des matières
En-tête de script utilisateur
[@name](https://www.tampermonkey.net/documentation.php?q=name#meta:name)[@namespace](https://www.tampermonkey.net/documentation.php?q=name#meta:namespace)[@copyright](https://www.tampermonkey.net/documentation.php?q=name#meta:copyright)[@version](https://www.tampermonkey.net/documentation.php?q=version)[@description](https://www.tampermonkey.net/documentation.php?q=description)[@icon, @iconURL, @defaulticon](https://www.tampermonkey.net/documentation.php?q=icon#meta:icon)[@icon64, @icon64URL](https://www.tampermonkey.net/documentation.php?q=icon#meta:icon64)[@grant](https://www.tampermonkey.net/documentation.php?q=grant)[@author](https://www.tampermonkey.net/documentation.php?q=author)[@homepage, @homepageURL, @website, @source](https://www.tampermonkey.net/documentation.php?q=homepage)[@antifeature](https://www.tampermonkey.net/documentation.php?q=antifeature)[@require](https://www.tampermonkey.net/documentation.php?q=externals#meta:require)[@resource](https://www.tampermonkey.net/documentation.php?q=externals#meta:resource)[@include](https://www.tampermonkey.net/documentation.php?q=include#meta:include)[@match](https://www.tampermonkey.net/documentation.php?q=include#meta:match)[@exclude](https://www.tampermonkey.net/documentation.php?q=include#meta:exclude)[@run-at](https://www.tampermonkey.net/documentation.php?q=run_at)[@run-in <sup>v5.3+</sup>](https://www.tampermonkey.net/documentation.php?q=run_in)[@sandbox <sup>4.18+</sup>](https://www.tampermonkey.net/documentation.php?q=sandbox)[@tag](https://www.tampermonkey.net/documentation.php?q=tag)[@connect](https://www.tampermonkey.net/documentation.php?q=connect)[@noframes](https://www.tampermonkey.net/documentation.php?q=noframes)[@updateURL](https://www.tampermonkey.net/documentation.php?q=update_url#meta:updateURL)[@downloadURL](https://www.tampermonkey.net/documentation.php?q=update_url#meta:downloadURL)[@supportURL](https://www.tampermonkey.net/documentation.php?q=update_url#meta:supportURL)[@webRequest](https://www.tampermonkey.net/documentation.php?q=webRequest)[@unwrap](https://www.tampermonkey.net/documentation.php?q=unwrap)
Interface de programmation d'applications
[unsafeWindow](https://www.tampermonkey.net/documentation.php?q=unsafeWindow)[Subresource Integrity](https://www.tampermonkey.net/documentation.php?q=sri)[GM_addElement(tag_name, attributes), GM_addElement(parent_node, tag_name, attributes)](https://www.tampermonkey.net/documentation.php?q=GM_addElement)[GM_addStyle(css)](https://www.tampermonkey.net/documentation.php?q=GM_addStyle)[GM_download(details), GM_download(url, name)](https://www.tampermonkey.net/documentation.php?q=GM_download)[GM_getResourceText(name)](https://www.tampermonkey.net/documentation.php?q=GM_getResource#api:GM_getResourceText)[GM_getResourceURL(name)](https://www.tampermonkey.net/documentation.php?q=GM_getResource#api:GM_getResourceURL)[GM_info](https://www.tampermonkey.net/documentation.php?q=GM_info)[GM_log(message)](https://www.tampermonkey.net/documentation.php?q=GM_log)[GM_notification(details, ondone), GM_notification(text, title, image, onclick)](https://www.tampermonkey.net/documentation.php?q=GM_notification)[GM_openInTab(url, options), GM_openInTab(url, loadInBackground)](https://www.tampermonkey.net/documentation.php?q=GM_openInTab)[GM_registerMenuCommand(name, callback, options_or_accessKey)](https://www.tampermonkey.net/documentation.php?q=GM_registerMenuCommand#api:GM_registerMenuCommand)[GM_unregisterMenuCommand(menuCmdId)](https://www.tampermonkey.net/documentation.php?q=GM_registerMenuCommand#api:GM_unregisterMenuCommand)[GM_setClipboard(data, info, cb)](https://www.tampermonkey.net/documentation.php?q=GM_setClipboard)[GM_getTab(callback)](https://www.tampermonkey.net/documentation.php?q=GM_tabs#api:GM_getTab)[GM_saveTab(tab, cb)](https://www.tampermonkey.net/documentation.php?q=GM_tabs#api:GM_saveTab)[GM_getTabs(callback)](https://www.tampermonkey.net/documentation.php?q=GM_tabs#api:GM_getTabs)[GM_setValue(key, value)](https://www.tampermonkey.net/documentation.php?q=GM_values#api:GM_setValue)[GM_getValue(key, defaultValue)](https://www.tampermonkey.net/documentation.php?q=GM_values#api:GM_getValue)[GM_deleteValue(key)](https://www.tampermonkey.net/documentation.php?q=GM_values#api:GM_deleteValue)[GM_listValues()](https://www.tampermonkey.net/documentation.php?q=GM_values#api:GM_listValues)[GM_setValues(values) <sup>v5.3+</sup>](https://www.tampermonkey.net/documentation.php?q=GM_values#api:GM_setValues)[GM_getValues(keysOrDefaults) <sup>v5.3+</sup>](https://www.tampermonkey.net/documentation.php?q=GM_values#api:GM_getValues)[GM_deleteValues(keys) <sup>v5.3+</sup>](https://www.tampermonkey.net/documentation.php?q=GM_values#api:GM_deleteValues)[GM_addValueChangeListener(key, (key, old_value, new_value, remote) => void)](https://www.tampermonkey.net/documentation.php?q=GM_values#api:GM_addValueChangeListener)[GM_removeValueChangeListener(listenerId)](https://www.tampermonkey.net/documentation.php?q=GM_values#api:GM_removeValueChangeListener)[GM_xmlhttpRequest(details)](https://www.tampermonkey.net/documentation.php?q=GM_xmlhttpRequest)[GM_webRequest(rules, listener)](https://www.tampermonkey.net/documentation.php?q=GM_webRequest)[GM_cookie.list(details[, callback])](https://www.tampermonkey.net/documentation.php?q=GM_cookie#api:GM_cookie.list)[GM_cookie.set(details[, callback])](https://www.tampermonkey.net/documentation.php?q=GM_cookie#api:GM_cookie.set)[GM_cookie.delete(details, callback)](https://www.tampermonkey.net/documentation.php?q=GM_cookie#api:GM_cookie.delete)[GM_audio.setMute(details, callback?)](https://www.tampermonkey.net/documentation.php?q=GM_audio#api:GM_audio.setMute)[GM_audio.getState(callback)](https://www.tampermonkey.net/documentation.php?q=GM_audio#api:GM_audio.getState)[GM_audio.addStateChangeListener(listener, callback)](https://www.tampermonkey.net/documentation.php?q=GM_audio#api:GM_audio.addStateChangeListener)[GM_audio.removeStateChangeListener(listener, callback)](https://www.tampermonkey.net/documentation.php?q=GM_audio#api:GM_audio.removeStateChangeListener)[window.onurlchange](https://www.tampermonkey.net/documentation.php?q=window#api:window.onurlchange)[window.close](https://www.tampermonkey.net/documentation.php?q=window#api:window.close)[window.focus](https://www.tampermonkey.net/documentation.php?q=window#api:window.focus)[<><![CDATA[...]]></>](https://www.tampermonkey.net/documentation.php?q=CDATA)
Réglages
[Content Script API](https://www.tampermonkey.net/documentation.php?q=content_script_api)
Déploiement
[Overview](https://www.tampermonkey.net/documentation.php?q=deploying#deployment:overview)[Creating the Provisioning JSON](https://www.tampermonkey.net/documentation.php?q=deploying#deployment:json)[Hash Handling](https://www.tampermonkey.net/documentation.php?q=deploying#deployment:hash)[Managed Storage Schema](https://www.tampermonkey.net/documentation.php?q=deploying#deployment:schema)[Extension IDs](https://www.tampermonkey.net/documentation.php?q=deploying#deployment:extension-ids)[Firefox Deployment](https://www.tampermonkey.net/documentation.php?q=deploying#deployment:firefox)[Chromium-Based Browsers](https://www.tampermonkey.net/documentation.php?q=deploying#deployment:chrome)
4/27/2026, 8:05:22 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=antifeature

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:homepage) [](https://www.tampermonkey.net/documentation.php?q=meta:require)
## @antifeature
This tag allows script developers to disclose whether they monetize their scripts. It is for example required by [GreasyFork](https://greasyfork.org).
Syntax: <tag> <type> <description>
_< type>_ can have the following values:
  * ads
  * tracking
  * miner

```
// @antifeature       ads         We show you ads
// @antifeature:fr    ads         Nous vous montrons des publicités
// @antifeature       tracking    We have some sort of analytics included
// @antifeature       miner       We use your computer's resources to mine a crypto currency

```

Internationalization is done by adding an appendix naming the locale.
4/27/2026, 8:07:58 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3ACDATA

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:window.focus) [](https://www.tampermonkey.net/documentation.php?q=settings:content_script_api)
## <></>
CDATA-based way of storing meta data is supported via compatibility option. Tampermonkey tries to automatically detect whether a script needs this option to be enabled.

```
var inline_src = (<><![CDATA[
    console.log('Hello World!');
]]></>).toString();

eval(inline_src);

```

4/27/2026, 8:05:40 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_addElement

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:Subresource_Integrity) [](https://www.tampermonkey.net/documentation.php?q=api:GM_addStyle)
## GM_addElement(tag_name, attributes), GM_addElement(parent_node, tag_name, attributes)
`GM_addElement` allows Tampermonkey scripts to add new elements to the page that Tampermonkey is running on. This can be useful for a variety of purposes, such as adding `script` and `img` tags if the page limits these elements with a content security policy (CSP).
It creates an HTML element specified by _"tag_name"_ and applies all given _"attributes"_ and returns the injected HTML element. If a _"parent_node"_ is given, then it is attached to it or to document head or body otherwise. In case of an error it returns `null`.
For suitable _"attributes"_ , please consult the appropriate documentation. For example:
  * [script tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script)
  * [img tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img)
  * [style tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/style)

```
GM_addElement('script', {
  textContent: 'window.foo = "bar";'
});

GM_addElement('script', {
  src: 'https://example.com/script.js',
  type: 'text/javascript'
});

GM_addElement(document.getElementsByTagName('div')[0], 'img', {
  src: 'https://example.com/image.png'
});

GM_addElement(shadowDOM, 'style', {
  textContent: 'div { color: black; };'
});

```

4/27/2026, 8:05:49 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_addStyle

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_addElement) [](https://www.tampermonkey.net/documentation.php?q=api:GM_download)
## GM_addStyle(css)
Adds the given style to the document and returns the injected style element.
4/27/2026, 8:05:53 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_audio.removeStateChangeListener

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_cookie.delete) [](https://www.tampermonkey.net/documentation.php?q=api:window.onurlchange)
## GM_audio.setMute(details, callback?)
Sets the mute state of the current tab.
**Parameters**
  * **details** _object_ , describing the new mute state of the tab:
    * **isMuted** _boolean_ , `true` to mute the tab, `false` to un‑mute it.
  * **callback** _(optional)_ _function?_ , called when the operation finishes.
    * **error** _(optional)_ _string_ , contains an error message if setting the mute state fails, otherwise it is `undefined`.

**Return value**
  * _Callback style_ : nothing (result is delivered via the callback).
  * _Promise style_ : returns a `Promise<void>` that resolves on success and rejects with an error string on failure.

**Example (callback)**

```
// ==UserScript==
...
// @grant      GM_audio
// ==/UserScript==

GM_audio.setMute({ isMuted: true }, function(err) {
  if (err) console.error('mute failed:', err);
  else console.log('tab muted');
});

```

**Example (Promise)**

```
// ==UserScript==
...
// @grant      GM.audio
// ==/UserScript==

await GM.audio.setMute({ isMuted: false });
console.log('tab un‑muted');

```

## GM_audio.getState(callback)
Retrieves the current audio state of the tab.
**Parameters**
  * **callback** _function_ , to be called with an object describing the tab’s audio state:
    * **info** _object_ , representing the retrieved state
      * **isMuted** _(optional)_ _boolean_ , whether the tab is currently muted.
      * **muteReason** _(optional)_ _string_ , the reason why the tab was muted, if it is currently muted.
        * `user` – User action (e.g., mute button).
        * `capture` – Tab capture API call.
        * `extension` – Extension call.
      * **isAudible** _(optional)_ _boolean_ , whether the tab is currently playing audio.

**Return value**
  * _Callback style_ : nothing (state delivered via the callback).
  * _Promise style_ : returns a `Promise` that resolves with the callback’s `info` object on success or rejects on error.

**Example (callback)**

```
// ==UserScript==
...
// @grant      GM_audio
// ==/UserScript==

GM_audio.getState(function(state) {
  if (!state) return console.error('failed to read state');
  console.log('muted?', state.isMuted, 'reason:', state.muteReason);
  console.log('audible?', state.isAudible);
});

```

**Example (Promise)**

```
// ==UserScript==
...
// @grant      GM.audio
// ==/UserScript==

const state = await GM.audio.getState();
console.log(`muted=${state.isMuted} (reason=${state.muteReason}) audible=${state.isAudible}`);

```

## GM_audio.addStateChangeListener(listener, callback)
Registers a listener that is called whenever the tab’s mute or audible state changes.
**Parameters**
  * **listener** _function_ , to be called when state changes. The function will be passed one argument:
    * **info** _object_ , representing the retrieved state change
      * **muted** _(optional)_ _string | false_ , mute reason or `false` if not muted.
      * **audible** _(optional)_ _boolean_ , whether the tab is currently playing audio.
  * **callback** _(optional)_ _function?_ , called once the registration attempt is complete. The function will be passed one argument:
    * **error** _(optional)_ _string?_ , containing an error message if registration fails, or `undefined` otherwise.

**Return value**
  * _Callback style_ : nothing (listener registered via callback).
  * _Promise style_ : returns a `Promise<void>` that resolves when the listener has been successfully registered.

**Example (callback)**

```
// ==UserScript==
...
// @grant      GM_audio
// ==/UserScript==

GM_audio.addStateChangeListener(function(e) {
  if ('muted' in e) console.log('muted:', e.muted);
  if ('audible' in e) console.log('audible:', e.audible);
});

```

**Example (Promise)**

```
// ==UserScript==
...
// @grant      GM.audio
// ==/UserScript==

await GM.audio.addStateChangeListener(ev => {
  if (ev.muted) console.log('muted by', ev.muted);
});

```

## GM_audio.removeStateChangeListener(listener, callback)
Unregisters a previously added state‑change listener.
**Parameters**
  * **listener** _function_ , The exact listener function that was passed to `addStateChangeListener`:
  * **callback** _(optional)_ _function?_ , called once the listener has been removed

**Return value**
  * _Callback style_ : nothing.
  * _Promise style_ : returns a `Promise<void>` that resolves when the listener has been removed.

**Example (callback)**

```
// ==UserScript==
...
// @grant      GM_audio
// ==/UserScript==

function onAudio(ev) { console.log(ev); }
GM_audio.addStateChangeListener(onAudio);
...
GM_audio.removeStateChangeListener(onAudio, () => console.log('listener removed'));

```

**Example (Promise)**

```
// ==UserScript==
...
// @grant      GM.audio
// ==/UserScript==

await GM.audio.removeStateChangeListener(onAudio);
console.log('listener removed');

```

4/27/2026, 8:06:06 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_audio.setMute

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_cookie.delete) [](https://www.tampermonkey.net/documentation.php?q=api:window.onurlchange)
## GM_audio.setMute(details, callback?)
Sets the mute state of the current tab.
**Parameters**
  * **details** _object_ , describing the new mute state of the tab:
    * **isMuted** _boolean_ , `true` to mute the tab, `false` to un‑mute it.
  * **callback** _(optional)_ _function?_ , called when the operation finishes.
    * **error** _(optional)_ _string_ , contains an error message if setting the mute state fails, otherwise it is `undefined`.

**Return value**
  * _Callback style_ : nothing (result is delivered via the callback).
  * _Promise style_ : returns a `Promise<void>` that resolves on success and rejects with an error string on failure.

**Example (callback)**

```
// ==UserScript==
...
// @grant      GM_audio
// ==/UserScript==

GM_audio.setMute({ isMuted: true }, function(err) {
  if (err) console.error('mute failed:', err);
  else console.log('tab muted');
});

```

**Example (Promise)**

```
// ==UserScript==
...
// @grant      GM.audio
// ==/UserScript==

await GM.audio.setMute({ isMuted: false });
console.log('tab un‑muted');

```

## GM_audio.getState(callback)
Retrieves the current audio state of the tab.
**Parameters**
  * **callback** _function_ , to be called with an object describing the tab’s audio state:
    * **info** _object_ , representing the retrieved state
      * **isMuted** _(optional)_ _boolean_ , whether the tab is currently muted.
      * **muteReason** _(optional)_ _string_ , the reason why the tab was muted, if it is currently muted.
        * `user` – User action (e.g., mute button).
        * `capture` – Tab capture API call.
        * `extension` – Extension call.
      * **isAudible** _(optional)_ _boolean_ , whether the tab is currently playing audio.

**Return value**
  * _Callback style_ : nothing (state delivered via the callback).
  * _Promise style_ : returns a `Promise` that resolves with the callback’s `info` object on success or rejects on error.

**Example (callback)**

```
// ==UserScript==
...
// @grant      GM_audio
// ==/UserScript==

GM_audio.getState(function(state) {
  if (!state) return console.error('failed to read state');
  console.log('muted?', state.isMuted, 'reason:', state.muteReason);
  console.log('audible?', state.isAudible);
});

```

**Example (Promise)**

```
// ==UserScript==
...
// @grant      GM.audio
// ==/UserScript==

const state = await GM.audio.getState();
console.log(`muted=${state.isMuted} (reason=${state.muteReason}) audible=${state.isAudible}`);

```

## GM_audio.addStateChangeListener(listener, callback)
Registers a listener that is called whenever the tab’s mute or audible state changes.
**Parameters**
  * **listener** _function_ , to be called when state changes. The function will be passed one argument:
    * **info** _object_ , representing the retrieved state change
      * **muted** _(optional)_ _string | false_ , mute reason or `false` if not muted.
      * **audible** _(optional)_ _boolean_ , whether the tab is currently playing audio.
  * **callback** _(optional)_ _function?_ , called once the registration attempt is complete. The function will be passed one argument:
    * **error** _(optional)_ _string?_ , containing an error message if registration fails, or `undefined` otherwise.

**Return value**
  * _Callback style_ : nothing (listener registered via callback).
  * _Promise style_ : returns a `Promise<void>` that resolves when the listener has been successfully registered.

**Example (callback)**

```
// ==UserScript==
...
// @grant      GM_audio
// ==/UserScript==

GM_audio.addStateChangeListener(function(e) {
  if ('muted' in e) console.log('muted:', e.muted);
  if ('audible' in e) console.log('audible:', e.audible);
});

```

**Example (Promise)**

```
// ==UserScript==
...
// @grant      GM.audio
// ==/UserScript==

await GM.audio.addStateChangeListener(ev => {
  if (ev.muted) console.log('muted by', ev.muted);
});

```

## GM_audio.removeStateChangeListener(listener, callback)
Unregisters a previously added state‑change listener.
**Parameters**
  * **listener** _function_ , The exact listener function that was passed to `addStateChangeListener`:
  * **callback** _(optional)_ _function?_ , called once the listener has been removed

**Return value**
  * _Callback style_ : nothing.
  * _Promise style_ : returns a `Promise<void>` that resolves when the listener has been removed.

**Example (callback)**

```
// ==UserScript==
...
// @grant      GM_audio
// ==/UserScript==

function onAudio(ev) { console.log(ev); }
GM_audio.addStateChangeListener(onAudio);
...
GM_audio.removeStateChangeListener(onAudio, () => console.log('listener removed'));

```

**Example (Promise)**

```
// ==UserScript==
...
// @grant      GM.audio
// ==/UserScript==

await GM.audio.removeStateChangeListener(onAudio);
console.log('listener removed');

```

4/27/2026, 8:06:06 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_cookie.delete

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_webRequest) [](https://www.tampermonkey.net/documentation.php?q=api:GM_audio.setMute)
## GM_cookie.list(details[, callback])
Note: `httpOnly` cookies are supported at the BETA versions of Tampermonkey only for now
Tampermonkey checks if the script has `@include` or `@match` access to given `details.url` arguments!
### Parameters:
  * **details** _object_ , containing properties of the cookies to retrieve
    * **url** _string?_ , representing the URL to retrieve cookies from (defaults to current document URL)
    * **domain** _string?_ , representing the domain of the cookies to retrieve
    * **name** _string?_ , representing the name of the cookies to retrieve
    * **path** _string?_ , representing the path of the cookies to retrieve
    * **partitionKey** v5.2+ _object_?, representing the [partition key](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/cookies#storage_partitioning) of the cookies, use an empty object to retrieve all cookies
      * **topLevelSite** _string_?, representing the top frame site of the cookies
  * **callback** _function?_ , to be called when the cookies have been retrieved. The function will be passed two arguments:
    * **cookies** _object[]_ , representing the retrieved cookies
    * **error** _string_ , representing an error message if an error occurred, null otherwise.

The cookie objects have the following properties:
  * **domain** _string_ , representing the domain of the cookie
  * **expirationDate** _number?_ , the expiration date of the cookie in seconds since the Unix epoch. If not specified, the cookie never expires.
  * **firstPartyDomain** _string?_ : the first party domain of the cookie.
  * **partitionKey** v5.2+ _object_?, containing the partition key of the cookie
    * **topLevelSite** _string_?, representing the top frame site of the cookie
  * **hostOnly** _boolean_ , indicating whether the cookie is a host-only cookie
  * **httpOnly** _boolean_ , indicating whether the cookie is an HTTP-only cookie
  * **name** _string_ , representing the name of the cookie
  * **path** _string_ , representing the path of the cookie
  * **sameSite** _string_ , indicating the SameSite attribute of the cookie
  * **secure** _boolean_ , indicating whether the cookie requires a secure connection
  * **session** _boolean_ , indicating whether the cookie is a session cookie
  * **value** _string_ , representing the value of the cookie

### Example usage:

```
// Retrieve all cookies with name "mycookie"
GM_cookie.list({ name: "mycookie" }, function(cookies, error) {
  if (!error) {
    console.log(cookies);
  } else {
    console.error(error);
  }
});

// Retrieve all cookies for the current domain
const cookies = await GM.cookie.list()
console.log(cookies);

```

## GM_cookie.set(details[, callback])
Sets a cookie with the given details. Supported properties are defined [here](https://developer.chrome.com/extensions/cookies#method-set).
### Parameters:
  * **details** : An object containing the details of the cookie to be set. The object can have the following properties:
    * **url** _string?_ , the URL to associate the cookie with. If not specified, the cookie is associated with the current document's URL.
    * **name** _string_ , the name of the cookie.
    * **value** _string_ , the value of the cookie.
    * **domain** _string?_ , the domain of the cookie.
    * **firstPartyDomain** _string?_ : the first party domain of the cookie.
    * **partitionKey** v5.2+ _object_?, containing the [partition key of the cookie](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/cookies#storage_partitioning)
      * **topLevelSite** _string_?, representing the top frame site of the cookie
    * **path** _string?_ , the path of the cookie.
    * **secure** _boolean?_ , whether the cookie should only be sent over HTTPS.
    * **httpOnly** _boolean?_ , whether the cookie should be marked as HttpOnly.
    * **expirationDate** _number?_ , the expiration date of the cookie in seconds since the Unix epoch. If not specified, the cookie never expires.
  * **callback** _function?_ , a function to be called when the operation is complete. The function is passed one argument:
    * **error** _string?_ , if there was an error setting the cookie, this contains an error message. Otherwise, it is `undefined`.

### Example:

```
GM_cookie.set({
  url: 'https://example.com',
  name: 'name',
  value: 'value',
  domain: '.example.com',
  path: '/',
  secure: true,
  httpOnly: true,
  expirationDate: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30) // Expires in 30 days
}, function(error) {
  if (error) {
    console.error(error);
  } else {
    console.log('Cookie set successfully.');
  }
});

GM.cookie.set({
  name: 'name',
  value: 'value'
})
.then(() => {
  console.log('Cookie set successfully.');
})
.catch((error) => {
  console.error(error);
});

```

## GM_cookie.delete(details, callback)
Deletes a cookie.
### Parameters:
The `details` object can have the following properties:
  * **url** _string?_ , the URL associated with the cookie. If `url` is not specified, the current document's URL will be used.
  * **name** _string_ , the name of the cookie to delete.
  * **firstPartyDomain** _string?_ : the first party domain of the cookie to delete.
  * **partitionKey** v5.2+ _object_?, representing the partition key of the cookie to delete
    * **topLevelSite** _string_?, representing the top frame site of the cookies

The `callback` function is optional and will be called when the cookie has been deleted or an error has occurred. It takes one argument:
  * **error** _string?_ , an error message, or `undefined` if the cookie was deleted successfully.

### Example:

```
GM_cookie.delete({ name: 'cookie_name' }, function(error) {
    if (error) {
        console.error(error);
    } else {
        console.log('Cookie deleted successfully');
    }
});

```

4/27/2026, 8:06:11 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_cookie.list

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_webRequest) [](https://www.tampermonkey.net/documentation.php?q=api:GM_audio.setMute)
## GM_cookie.list(details[, callback])
Note: `httpOnly` cookies are supported at the BETA versions of Tampermonkey only for now
Tampermonkey checks if the script has `@include` or `@match` access to given `details.url` arguments!
### Parameters:
  * **details** _object_ , containing properties of the cookies to retrieve
    * **url** _string?_ , representing the URL to retrieve cookies from (defaults to current document URL)
    * **domain** _string?_ , representing the domain of the cookies to retrieve
    * **name** _string?_ , representing the name of the cookies to retrieve
    * **path** _string?_ , representing the path of the cookies to retrieve
    * **partitionKey** v5.2+ _object_?, representing the [partition key](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/cookies#storage_partitioning) of the cookies, use an empty object to retrieve all cookies
      * **topLevelSite** _string_?, representing the top frame site of the cookies
  * **callback** _function?_ , to be called when the cookies have been retrieved. The function will be passed two arguments:
    * **cookies** _object[]_ , representing the retrieved cookies
    * **error** _string_ , representing an error message if an error occurred, null otherwise.

The cookie objects have the following properties:
  * **domain** _string_ , representing the domain of the cookie
  * **expirationDate** _number?_ , the expiration date of the cookie in seconds since the Unix epoch. If not specified, the cookie never expires.
  * **firstPartyDomain** _string?_ : the first party domain of the cookie.
  * **partitionKey** v5.2+ _object_?, containing the partition key of the cookie
    * **topLevelSite** _string_?, representing the top frame site of the cookie
  * **hostOnly** _boolean_ , indicating whether the cookie is a host-only cookie
  * **httpOnly** _boolean_ , indicating whether the cookie is an HTTP-only cookie
  * **name** _string_ , representing the name of the cookie
  * **path** _string_ , representing the path of the cookie
  * **sameSite** _string_ , indicating the SameSite attribute of the cookie
  * **secure** _boolean_ , indicating whether the cookie requires a secure connection
  * **session** _boolean_ , indicating whether the cookie is a session cookie
  * **value** _string_ , representing the value of the cookie

### Example usage:

```
// Retrieve all cookies with name "mycookie"
GM_cookie.list({ name: "mycookie" }, function(cookies, error) {
  if (!error) {
    console.log(cookies);
  } else {
    console.error(error);
  }
});

// Retrieve all cookies for the current domain
const cookies = await GM.cookie.list()
console.log(cookies);

```

## GM_cookie.set(details[, callback])
Sets a cookie with the given details. Supported properties are defined [here](https://developer.chrome.com/extensions/cookies#method-set).
### Parameters:
  * **details** : An object containing the details of the cookie to be set. The object can have the following properties:
    * **url** _string?_ , the URL to associate the cookie with. If not specified, the cookie is associated with the current document's URL.
    * **name** _string_ , the name of the cookie.
    * **value** _string_ , the value of the cookie.
    * **domain** _string?_ , the domain of the cookie.
    * **firstPartyDomain** _string?_ : the first party domain of the cookie.
    * **partitionKey** v5.2+ _object_?, containing the [partition key of the cookie](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/cookies#storage_partitioning)
      * **topLevelSite** _string_?, representing the top frame site of the cookie
    * **path** _string?_ , the path of the cookie.
    * **secure** _boolean?_ , whether the cookie should only be sent over HTTPS.
    * **httpOnly** _boolean?_ , whether the cookie should be marked as HttpOnly.
    * **expirationDate** _number?_ , the expiration date of the cookie in seconds since the Unix epoch. If not specified, the cookie never expires.
  * **callback** _function?_ , a function to be called when the operation is complete. The function is passed one argument:
    * **error** _string?_ , if there was an error setting the cookie, this contains an error message. Otherwise, it is `undefined`.

### Example:

```
GM_cookie.set({
  url: 'https://example.com',
  name: 'name',
  value: 'value',
  domain: '.example.com',
  path: '/',
  secure: true,
  httpOnly: true,
  expirationDate: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30) // Expires in 30 days
}, function(error) {
  if (error) {
    console.error(error);
  } else {
    console.log('Cookie set successfully.');
  }
});

GM.cookie.set({
  name: 'name',
  value: 'value'
})
.then(() => {
  console.log('Cookie set successfully.');
})
.catch((error) => {
  console.error(error);
});

```

## GM_cookie.delete(details, callback)
Deletes a cookie.
### Parameters:
The `details` object can have the following properties:
  * **url** _string?_ , the URL associated with the cookie. If `url` is not specified, the current document's URL will be used.
  * **name** _string_ , the name of the cookie to delete.
  * **firstPartyDomain** _string?_ : the first party domain of the cookie to delete.
  * **partitionKey** v5.2+ _object_?, representing the partition key of the cookie to delete
    * **topLevelSite** _string_?, representing the top frame site of the cookies

The `callback` function is optional and will be called when the cookie has been deleted or an error has occurred. It takes one argument:
  * **error** _string?_ , an error message, or `undefined` if the cookie was deleted successfully.

### Example:

```
GM_cookie.delete({ name: 'cookie_name' }, function(error) {
    if (error) {
        console.error(error);
    } else {
        console.log('Cookie deleted successfully');
    }
});

```

4/27/2026, 8:06:11 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_download

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_addStyle) [](https://www.tampermonkey.net/documentation.php?q=api:GM_getResourceText)
## GM_download(details), GM_download(url, name)
`GM_download` allows userscripts to download a file from a specified URL and save it to the user's local machine.
The `GM_download` function takes the following parameters:
_details_ can have the following attributes:
  * **url** : The URL of the file to download or a `Blob` or `File` objectv5.4.6226+. In case of a string, this must be a valid URL and must point to a file that is accessible to the user.
  * **name** : The name to use for the downloaded file. This should include the file's extension, such as .txt or .pdf. For security reasons the file extension needs to be whitelisted at Tampermonkey's options page
  * **headers** : An object containing HTTP headers to include in the download request. See [`GM_xmlhttpRequest`](https://www.tampermonkey.net/documentation.php?q=meta:GM_xmlhttpRequest) for more details.
  * **saveAs** : A boolean value indicating whether to use the user's default download location, or to prompt the user to choose a different location. This option works in browser API mode only.
  * **conflictAction** : A string that control what happens when a file with this name already exists. This option works in browser API mode only. Possible values are `uniquify`, `overwrite` and `prompt`. Please check [this link](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/downloads/FilenameConflictAction) for more details.
  * **onload** : A function to call when the download has completed successfully.
  * **onerror** : A function to call if the download fails or is cancelled.
  * **onprogress** A callback to be executed if this download made some progress.
  * **ontimeout** A callback to be executed if this download failed due to a timeout.

The _download_ argument of the _onerror_ callback can have the following attributes:
  * **error** : error reason
    * not_enabled - the download feature isn't enabled by the user
    * not_whitelisted - the requested file extension is not whitelisted
    * not_permitted - the user enabled the download feature, but did not give the _downloads_ permission
    * not_supported - the download feature isn't supported by the browser/version
    * not_succeeded - the download wasn't started or failed, the _details_ attribute may provide more information
  * **details** : detail about that error

Returns an object with the following property:
  * **abort** : A function which can be called to cancel this download.

If `GM.download` is used it returns a promise that resolves to the download details and also has an `abort` function.
Depending on the download mode `GM_info` provides a property called `downloadMode` which is set to one of the following values: **native** , **disabled** or **browser**.

```
GM_download("http://example.com/file.txt", "file.txt");

const download = GM_download({
    url: "http://example.com/file.txt",
    name: "file.txt",
    saveAs: true
});

// cancel download after 5 seconds
window.setTimeout(() => download.abort(), 5000);

```

Note: The browser might modify the desired filename. Especially a file extension might be added if the browser finds this to be safe to download at the current OS.
4/27/2026, 8:06:24 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_getResourceText

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_download) [](https://www.tampermonkey.net/documentation.php?q=api:GM_info)
## GM_getResourceText(name)
Allows userscripts to access the text of a resource (such as a JavaScript or CSS file) that has been included in a userscript via `@resource`.
The function takes a single parameter, which is the _"name"_ of the resource to retrieve. It returns the text of the resource as a string.
Here is an example of how the function might be used:

```
const scriptText = GM_getResourceText("myscript.js");
const scriptText2 = await GM.getResourceText("myscript.js");
const script = document.createElement("script");
script.textContent = scriptText;
document.body.appendChild(script);

```

## GM_getResourceURL(name)
`GM_getResourceURL` allows userscripts to access the URL of a resource (such as a CSS or image file) that has been included in the userscript via a `@resource` tag at the script header.
The function takes a single parameter, which is the _"name"_ of the resource to retrieve. It returns the URL of the resource as a string.

```
const imageUrl = GM_getResourceURL("myimage.png");
const imageUrl2 = await GM.getResourceUrl("myimage.png");
const image = document.createElement("img");
image.src = imageUrl;
document.body.appendChild(image);

```

**Important:** : The promise-based version of this function is called `GM.getResourceUrl` (with a lowercase "r" and "l" in "Url").
4/27/2026, 8:06:29 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_getResourceURL

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_download) [](https://www.tampermonkey.net/documentation.php?q=api:GM_info)
## GM_getResourceText(name)
Allows userscripts to access the text of a resource (such as a JavaScript or CSS file) that has been included in a userscript via `@resource`.
The function takes a single parameter, which is the _"name"_ of the resource to retrieve. It returns the text of the resource as a string.
Here is an example of how the function might be used:

```
const scriptText = GM_getResourceText("myscript.js");
const scriptText2 = await GM.getResourceText("myscript.js");
const script = document.createElement("script");
script.textContent = scriptText;
document.body.appendChild(script);

```

## GM_getResourceURL(name)
`GM_getResourceURL` allows userscripts to access the URL of a resource (such as a CSS or image file) that has been included in the userscript via a `@resource` tag at the script header.
The function takes a single parameter, which is the _"name"_ of the resource to retrieve. It returns the URL of the resource as a string.

```
const imageUrl = GM_getResourceURL("myimage.png");
const imageUrl2 = await GM.getResourceUrl("myimage.png");
const image = document.createElement("img");
image.src = imageUrl;
document.body.appendChild(image);

```

**Important:** : The promise-based version of this function is called `GM.getResourceUrl` (with a lowercase "r" and "l" in "Url").
4/27/2026, 8:06:29 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_getTab

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_setClipboard) [](https://www.tampermonkey.net/documentation.php?q=api:GM_setValue)
## GM_getTab(callback)
The GM_getTab function takes a single parameter, a callback function that will be called with an object that is persistent as long as this tab is open.

```
GM_getTab((tab) => console.log(tab));
const t = await GM.getTab();
console.log(t);

```

## GM_saveTab(tab, cb)
The `GM_saveTab` function allows a userscript to save information about a tab for later use.
The function takes a _"tab_ " parameter, which is an object containing the information to be saved about the tab and an optional callback function _"cb"_.
The `GM_saveTab` function saves the provided tab information, so that it can be retrieved later using the `GM_getTab` function.
Here is an example of how the GM_saveTab function might be used in a userscript:

```
GM_getTab(function(tab) {
    tab.newInfo = "new!";
    GM_saveTab(tab);
});
const tab = await GM.getTab();
await GM.saveTab(tab);

```

In this example, the `GM_saveTab` function is called with the tab object returned by the `GM_getTab` function, and a new key called "newInfo".
## GM_getTabs(callback)
The `GM_getTabs` function takes a single parameter: a callback function that will be called with the information about the tabs.
The _"tabs"_ object that is passed to the callback function contains objects, with each object representing the saved tab information stored by `GM_saveTab`.

```
GM_getTabs((tabs) => {
    for (const [tabId, tab] of Object.entries(tabs)) {
        console.log(`tab ${tabId}`, tab);
    }
});
const tabs = await GM.getTabs();

```

4/27/2026, 8:07:26 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_getTabs

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_setClipboard) [](https://www.tampermonkey.net/documentation.php?q=api:GM_setValue)
## GM_getTab(callback)
The GM_getTab function takes a single parameter, a callback function that will be called with an object that is persistent as long as this tab is open.

```
GM_getTab((tab) => console.log(tab));
const t = await GM.getTab();
console.log(t);

```

## GM_saveTab(tab, cb)
The `GM_saveTab` function allows a userscript to save information about a tab for later use.
The function takes a _"tab_ " parameter, which is an object containing the information to be saved about the tab and an optional callback function _"cb"_.
The `GM_saveTab` function saves the provided tab information, so that it can be retrieved later using the `GM_getTab` function.
Here is an example of how the GM_saveTab function might be used in a userscript:

```
GM_getTab(function(tab) {
    tab.newInfo = "new!";
    GM_saveTab(tab);
});
const tab = await GM.getTab();
await GM.saveTab(tab);

```

In this example, the `GM_saveTab` function is called with the tab object returned by the `GM_getTab` function, and a new key called "newInfo".
## GM_getTabs(callback)
The `GM_getTabs` function takes a single parameter: a callback function that will be called with the information about the tabs.
The _"tabs"_ object that is passed to the callback function contains objects, with each object representing the saved tab information stored by `GM_saveTab`.

```
GM_getTabs((tabs) => {
    for (const [tabId, tab] of Object.entries(tabs)) {
        console.log(`tab ${tabId}`, tab);
    }
});
const tabs = await GM.getTabs();

```

4/27/2026, 8:07:26 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_info

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_getResourceURL) [](https://www.tampermonkey.net/documentation.php?q=api:GM_log)
## GM_info
Get some info about the script and TM. The object might look like this:

```
type ScriptGetInfo = {
    container?: { // 5.3+ | Firefox only
        id: string,
        name?: string
    },
    downloadMode: string,
    isFirstPartyIsolation?: boolean,
    isIncognito: boolean,
    sandboxMode: SandboxMode, // 4.18+
    scriptHandler: string,
    scriptMetaStr: string | null,
    scriptUpdateURL: string | null,
    scriptWillUpdate: boolean,
    userAgentData: UADataValues, // 4.19+
    version?: string,
    script: {
        antifeatures: { [antifeature: string]: { [locale: string]: string } },
        author: string | null,
        blockers: string[],
        connects: string[],
        copyright: string | null,
        deleted?: number | undefined,
        description_i18n: { [locale: string]: string } | null,
        description: string,
        downloadURL: string | null,
        excludes: string[],
        fileURL: string | null,
        grant: string[],
        header: string | null,
        homepage: string | null,
        icon: string | null,
        icon64: string | null,
        includes: string[],
        lastModified: number,
        matches: string[],
        name_i18n: { [locale: string]: string } | null,
        name: string,
        namespace: string | null,
        position: number,
        resources: Resource[],
        supportURL: string | null,
        system?: boolean | undefined,
        'run-at': string | null,
        'run-in': string[] | null, // 5.3+
        unwrap: boolean | null,
        updateURL: string | null,
        version: string,
        webRequest: WebRequestRule[] | null,
        options: {
            check_for_updates: boolean,
            comment: string | null,
            compatopts_for_requires: boolean,
            compat_wrappedjsobject: boolean,
            compat_metadata: boolean,
            compat_foreach: boolean,
            compat_powerful_this: boolean | null,
            sandbox: string | null,
            noframes: boolean | null,
            unwrap: boolean | null,
            run_at: string | null,
            run_in: string | null, // 5.3+
            override: {
                use_includes: string[],
                orig_includes: string[],
                merge_includes: boolean,
                use_matches: string[],
                orig_matches: string[],
                merge_matches: boolean,
                use_excludes: string[],
                orig_excludes: string[],
                merge_excludes: boolean,
                use_connects: string[],
                orig_connects: string[],
                merge_connects: boolean,
                use_blockers: string[],
                orig_run_at: string | null,
                orig_run_in: string[] | null, // 5.3+
                orig_noframes: boolean | null
            }
        }
    }
};

type SandboxMode = 'js' | 'raw' | 'dom';

type Resource = {
    name: string,
    url: string,
    error?: string,
    content?: string,
    meta?: string
};

type WebRequestRule = {
    selector: { include?: string | string[], match?: string | string[], exclude?: string | string[] } | string,
    action: string | {
        cancel?: boolean,
        redirect?: {
            url: string,
            from?: string,
            to?: string
        } | string
    }
};

type UADataValues = {
    brands?: {
        brand: string;
        version: string;
    }[],
    mobile?: boolean,
    platform?: string,
    architecture?: string,
    bitness?: string
}

```

4/27/2026, 8:06:39 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_log

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_info) [](https://www.tampermonkey.net/documentation.php?q=api:GM_notification)
## GM_log(message)
Log a message to the console.
4/27/2026, 8:06:44 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_notification

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_log) [](https://www.tampermonkey.net/documentation.php?q=api:GM_openInTab)
## GM_notification(details, ondone), GM_notification(text, title, image, onclick)
`GM_notification` allows users to display notifications on the screen, using a provided message and other optional parameters.
The function takes several parameters. Either a _details_ object or multiple parameters.
The _details_ object can have the following attributes, from which some can also be used as direct parameter.
The available options include:
  * **text** : A string containing the message to display in the notification.
  * **title** : The title of the notification.
  * **tag** : v5.0+ This tag will be used to identify this notification. This way you can update existing notifications by calling `GM_notification` again and using the same tag. If you don't provide a tag, a new notification will be created every time.
  * **image** : The URL of an image to display in the notification.
  * **highlight** : A boolean flag whether to highlight the tab that sends the notfication (required unless text is set)
  * **silent** : A boolean flag whether to not play a sound
  * **timeout** : The time, in milliseconds, after which the notification should automatically close.
  * **url** : v5.0+ A URL to load when the user clicks on the notification. You can prevent loading the URL by calling `event.preventDefault()` in the `onclick` event handler.
  * **onclick** : A callback function that will be called when the user clicks on the notification.
  * **ondone** A callback function that will be called when the notification is closed (no matter if this was triggered by a timeout or a click) or the tab was highlighted

The function does not return a value.
If no `url` and no `tag` is provided the notification will closed when the userscript unloads v5.0+(e.g. when the page is reloaded or the tab is closed).
Here is an example of how the function might be used:

```
GM_notification({
  text: "This is the notification message.",
  title: "Notification Title",
  url: 'https:/example.com/',
  onclick: (event) => {
    // The userscript is still running, so don't open example.com
    event.preventDefault();
    // Display an alert message instead
    alert('I was clicked!')
  }
});

const clicked = await GM.notification({ text: "Click me." });

```

4/27/2026, 8:06:49 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_openInTab

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_notification) [](https://www.tampermonkey.net/documentation.php?q=api:GM_registerMenuCommand)
## GM_openInTab(url, options), GM_openInTab(url, loadInBackground)
`GM_openInTab` allows userscripts to open a new tab in the browser and navigate to a specified URL.
The function takes two parameters:
A string names _"url"_ containing the URL of the page to open in the new tab.
An optional options object that can be used to customize the behavior of the new tab. The available options include:
  * **active** : A boolean value indicating whether the new tab should be active (selected) or not. The default is false.
  * **insert** : An integer indicating the position at which the new tab should be inserted in the tab strip. The default is false, which means the new tab will be added to the end of the tab strip.
  * **setParent** : A boolean value indicating whether the new tab should be considered a child of the current tab. The default is false.
  * **incognito** A boolean value that makes the tab being opened inside a incognito mode/private mode window.
  * **loadInBackground** A boolean value has the opposite meaning of **active** and was added to achieve Greasemonkey 3.x compatibility.

The function returns an object with the function **close** , the listener **onclose** and a flag called **closed**.
Here is an example of how the function might be used:

```
// Open a new tab and navigate to the specified URL
GM_openInTab("https://www.example.com/");

```

4/27/2026, 8:06:59 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_registerMenuCommand

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_openInTab) [](https://www.tampermonkey.net/documentation.php?q=api:GM_setClipboard)
## GM_registerMenuCommand(name, callback, options_or_accessKey)
`GM_registerMenuCommand` allows userscripts to add a new entry to the userscript's menu in the browser, and specify a function to be called when the menu item is selected. Menu items created from different frames are merged into a single menu entry if name, title and accessKey are the same.
The function takes three parameters:
  * **name** - _string_ , A string containing the text to display for the menu item.
  * **callback** - _function_ , A function to be called when the menu item is selected. The function will be passed a single parameter, which is the currently active tab. As of Tampermonkey 4.14 a MouseEvent or KeyboardEvent is passed as function argument.
  * **accessKey** - _string?_ , An optional access key. Please see the description below. Either `options` or `accessKey` can be specified.
  * **options** v4.20+ _object?_ , Optional options that can be used to customize the menu item. The options are specified as an object with the following properties:
    * **id** v5.0+ _number|string?_ , An optional number that was returned by a previous `GM_registerMenuCommand` call. If specified, the according menu item will be updated with the new options. If not specified or the menu item can't be found, a new menu item will be created.
    * **accessKey** - _string?_ , An optional access key for the menu item. This can be used to create a shortcut for the menu item. For example, if the access key is "s", the user can select the menu item by pressing "s" when Tampermonkey's popup-menu is open. Please note that there are browser-wide shortcuts configurable to open Tampermonkey's popup-menu. (`chrome://extensions/shortcuts` in Chrome, `about:addons` + "Manage Extension Shortcuts" in Firefox)
    * **autoClose** - _boolean?_ , An optional boolean parameter that specifies whether the popup menu should be closed after the menu item is clicked. The default value is `true`. Please note that this setting has no effect on the menu command section that is added to the page's context menu.
    * **title** v5.0+ - _string?_ , An optional string that specifies the title of the menu item. This is displayed as a tooltip when the user hovers the mouse over the menu item.

The function return a menu entry ID that can be used to unregister the command.
Here is an example of how the function might be used:

```
const menu_command_id_1 = GM_registerMenuCommand("Show Alert", function(event: MouseEvent | KeyboardEvent) {
  alert("Menu item selected");
}, {
  accessKey: "a",
  autoClose: true
});

const menu_command_id_2 = GM_registerMenuCommand("Log", function(event: MouseEvent | KeyboardEvent) {
  console.log("Menu item selected");
}, "l");

```

## GM_unregisterMenuCommand(menuCmdId)
`GM_unregisterMenuCommand` removes an existing entry from the userscript's menu in the browser.
The function takes a single parameter, which is the ID of the menu item to remove. It does not return a value.
Here is an example of how the function might be used:

```
const menu_command_id = GM_registerMenuCommand(...);
GM_unregisterMenuCommand(menu_command_id);

```

4/27/2026, 8:07:12 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_removeValueChangeListener

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_getTabs) [](https://www.tampermonkey.net/documentation.php?q=api:GM_xmlhttpRequest)
## GM_setValue(key, value)
The `GM_setValue` allows a userscript to set the value of a specific key in the userscript's storage.
The `GM_setValue` function takes two parameters:
  * A string specifying the key for which the value should be set.
  * The value to be set for the key. Values (including nested object properties) can be `null` or of type "object", "string", "number", "undefined" or "boolean".

The `GM_setValue` function does not return any value. Instead, it sets the provided value for the specified key in the userscript's storage.
Here is an example of how `GM_setValue` and its async pendant `GM.setValue` might be used in a userscript:

```
GM_setValue("someKey", "someData");
await GM.setValue("otherKey", "otherData");

```

## GM_getValue(key, defaultValue)
The `GM_getValue` function allows a userscript to retrieve the value of a specific key in the userscript's storage. It takes two parameters:
  * A string specifying the key for which the value should be retrieved.
  * A default value to be returned if the key does not exist in the userscript's storage. This default value can be of any type (string, number, object, etc.).

The `GM_getValue` function returns the value of the specified key from the userscript's storage, or the default value if the key does not exist.
Here is an example of how the `GM_getValue` function might be used in a userscript:

```
const someKey = GM_getValue("someKey", null);
const otherKey = await GM.getValue("otherKey", null);

```

In this example, the `GM_getValue` function is called with the key "someKey" and a default value of null. If the "someKey" key exists in the userscript's storage, its value will be returned and stored in the someKey variable. If the key does not exist, the default value of null will be returned and stored in the savedTab variable.
## GM_deleteValue(key)
Deletes _"key"_ from the userscript's storage.

```
GM_deleteValue("someKey");
await GM.deleteValue("otherKey");

```

## GM_listValues()
The `GM_listValues` function returns a list of keys of all stored data.

```
const keys = GM_listValues();
const asyncKeys = await GM.listValues();

```

## GM_setValues(values) v5.3+
The `GM_setValues` function allows a userscript to set multiple key-value pairs in the userscript's storage simultaneously.
The `GM_setValues` function takes one parameter:
  * An object where each key-value pair corresponds to a key and the value to be set for that key. Values (including nested object properties) can be `null` or of type "object", "string", "number", "undefined" or "boolean".

The `GM_setValues` function does not return any value. Instead, it sets the provided values for the specified keys in the userscript's storage.
Here is an example of how `GM_setValues` and its async counterpart `GM.setValues` might be used in a userscript:

```
GM_setValues({ foo: 1, bar: 2 });
await GM.setValues({ foo: 1, bar: 2 });

```

## GM_getValues(keysOrDefaults) v5.3+
The `GM_getValues` function allows a userscript to retrieve the values of multiple keys in the userscript's storage. It can also provide default values if the keys do not exist.
The `GM_getValues` function takes one parameter:
  * Either an array of strings specifying the keys for which the values should be retrieved, or an object specifying the default values to be returned if the keys do not exist. This default values object can contain keys of any type (string, number, object, etc.).

The `GM_getValues` function returns an object containing the values of the specified keys from the userscript's storage, or the default values if the keys do not exist.
Here is an example of how the `GM_getValues` function might be used in a userscript:

```
const values = GM_getValues(['foo', 'bar']);
const asyncValues = await GM.getValues(['foo', 'bar']);

const defaultValues = GM_getValues({ foo: 1, bar: 2, baz: 3 });
const asyncDefaultValues = await GM.getValues({ foo: 1, bar: 2, baz: 3 });

```

In this example, the `GM_getValues` function is called with an array of keys or an object of default values. It returns an object with the values of the specified keys or the default values if the keys do not exist.
## GM_deleteValues(keys) v5.3+
The `GM_deleteValues` function allows a userscript to delete multiple keys from the userscript's storage simultaneously.
The `GM_deleteValues` function takes one parameter:
  * An array of strings specifying the keys to be deleted from the userscript's storage.

The `GM_deleteValues` function does not return any value. Instead, it deletes the specified keys from the userscript's storage.
Here is an example of how `GM_deleteValues` and its async counterpart GM.deleteValues might be used in a userscript:

```
GM_deleteValues(['foo', 'bar']);
await GM.deleteValues(['foo', 'bar']);

```

## GM_addValueChangeListener(key, (key, old_value, new_value, remote) => void)
The `GM_addValueChangeListener` function allows a userscript to add a listener for changes to the value of a specific key in the userscript's storage.
The function takes two parameters:
  * A string specifying the key for which changes should be monitored.
  * A callback function that will be called when the value of the key changes. The callback function should have the following signature:
```
  function(key, oldValue, newValue, remote) {
      // key is the key whose value has changed
      // oldValue is the previous value of the key
      // newValue is the new value of the key
      // remote is a boolean indicating whether the change originated from a different userscript instance
  }

```

The `GM_addValueChangeListener` function returns a _"listenerId"_ value that can be used to remove the listener later using the `GM_removeValueChangeListener` function. The very same applies to `GM.addValueChangeListener` and `GM.removeValueChangeListener` with the only difference that both return a promise;
Here is an example of how the `GM_addValueChangeListener` function might be used in a userscript:

```
// Add a listener for changes to the "savedTab" key
var listenerId = GM_addValueChangeListener("savedTab", function(key, oldValue, newValue, remote) {
  // Print a message to the console when the value of the "savedTab" key changes
  console.log("The value of the '" + key + "' key has changed from '" + oldValue + "' to '" + newValue + "'");
});

```

`GM_addValueChangeListener` can be used by userscripts to communicate with other userscript instances at other tabs.
## GM_removeValueChangeListener(listenerId)
`GM_removeValueChangeListener` and `GM.removeValueChangeListener` both get one argument called _"listenerId"_ and remove the change listener with this ID.
4/27/2026, 8:07:39 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_setClipboard

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_unregisterMenuCommand) [](https://www.tampermonkey.net/documentation.php?q=api:GM_getTab)
## GM_setClipboard(data, info, cb)
`GM_setClipboard` sets the text of the clipboard to a specified value.
The function takes a parameter _"data"_ , which is the string to set as the clipboard text, a parameter _"info"_ and an optional callback function _"cb"_.
_"info_ " can be just a string expressing the type `text` or `html` or an object like _"cb"_ is an optional callback function that is called when the clipboard has been set.

```
{
    type: 'text',
    mimetype: 'text/plain'
}

```

```
GM_setClipboard("This is the clipboard text.", "text", () => console.log("Clipboard set!"));
await GM.setClipboard("This is the newer clipboard text.", "text");
console.log('Clipboard set again!');

```

4/27/2026, 8:07:16 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_setValue

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_getTabs) [](https://www.tampermonkey.net/documentation.php?q=api:GM_xmlhttpRequest)
## GM_setValue(key, value)
The `GM_setValue` allows a userscript to set the value of a specific key in the userscript's storage.
The `GM_setValue` function takes two parameters:
  * A string specifying the key for which the value should be set.
  * The value to be set for the key. Values (including nested object properties) can be `null` or of type "object", "string", "number", "undefined" or "boolean".

The `GM_setValue` function does not return any value. Instead, it sets the provided value for the specified key in the userscript's storage.
Here is an example of how `GM_setValue` and its async pendant `GM.setValue` might be used in a userscript:

```
GM_setValue("someKey", "someData");
await GM.setValue("otherKey", "otherData");

```

## GM_getValue(key, defaultValue)
The `GM_getValue` function allows a userscript to retrieve the value of a specific key in the userscript's storage. It takes two parameters:
  * A string specifying the key for which the value should be retrieved.
  * A default value to be returned if the key does not exist in the userscript's storage. This default value can be of any type (string, number, object, etc.).

The `GM_getValue` function returns the value of the specified key from the userscript's storage, or the default value if the key does not exist.
Here is an example of how the `GM_getValue` function might be used in a userscript:

```
const someKey = GM_getValue("someKey", null);
const otherKey = await GM.getValue("otherKey", null);

```

In this example, the `GM_getValue` function is called with the key "someKey" and a default value of null. If the "someKey" key exists in the userscript's storage, its value will be returned and stored in the someKey variable. If the key does not exist, the default value of null will be returned and stored in the savedTab variable.
## GM_deleteValue(key)
Deletes _"key"_ from the userscript's storage.

```
GM_deleteValue("someKey");
await GM.deleteValue("otherKey");

```

## GM_listValues()
The `GM_listValues` function returns a list of keys of all stored data.

```
const keys = GM_listValues();
const asyncKeys = await GM.listValues();

```

## GM_setValues(values) v5.3+
The `GM_setValues` function allows a userscript to set multiple key-value pairs in the userscript's storage simultaneously.
The `GM_setValues` function takes one parameter:
  * An object where each key-value pair corresponds to a key and the value to be set for that key. Values (including nested object properties) can be `null` or of type "object", "string", "number", "undefined" or "boolean".

The `GM_setValues` function does not return any value. Instead, it sets the provided values for the specified keys in the userscript's storage.
Here is an example of how `GM_setValues` and its async counterpart `GM.setValues` might be used in a userscript:

```
GM_setValues({ foo: 1, bar: 2 });
await GM.setValues({ foo: 1, bar: 2 });

```

## GM_getValues(keysOrDefaults) v5.3+
The `GM_getValues` function allows a userscript to retrieve the values of multiple keys in the userscript's storage. It can also provide default values if the keys do not exist.
The `GM_getValues` function takes one parameter:
  * Either an array of strings specifying the keys for which the values should be retrieved, or an object specifying the default values to be returned if the keys do not exist. This default values object can contain keys of any type (string, number, object, etc.).

The `GM_getValues` function returns an object containing the values of the specified keys from the userscript's storage, or the default values if the keys do not exist.
Here is an example of how the `GM_getValues` function might be used in a userscript:

```
const values = GM_getValues(['foo', 'bar']);
const asyncValues = await GM.getValues(['foo', 'bar']);

const defaultValues = GM_getValues({ foo: 1, bar: 2, baz: 3 });
const asyncDefaultValues = await GM.getValues({ foo: 1, bar: 2, baz: 3 });

```

In this example, the `GM_getValues` function is called with an array of keys or an object of default values. It returns an object with the values of the specified keys or the default values if the keys do not exist.
## GM_deleteValues(keys) v5.3+
The `GM_deleteValues` function allows a userscript to delete multiple keys from the userscript's storage simultaneously.
The `GM_deleteValues` function takes one parameter:
  * An array of strings specifying the keys to be deleted from the userscript's storage.

The `GM_deleteValues` function does not return any value. Instead, it deletes the specified keys from the userscript's storage.
Here is an example of how `GM_deleteValues` and its async counterpart GM.deleteValues might be used in a userscript:

```
GM_deleteValues(['foo', 'bar']);
await GM.deleteValues(['foo', 'bar']);

```

## GM_addValueChangeListener(key, (key, old_value, new_value, remote) => void)
The `GM_addValueChangeListener` function allows a userscript to add a listener for changes to the value of a specific key in the userscript's storage.
The function takes two parameters:
  * A string specifying the key for which changes should be monitored.
  * A callback function that will be called when the value of the key changes. The callback function should have the following signature:
```
  function(key, oldValue, newValue, remote) {
      // key is the key whose value has changed
      // oldValue is the previous value of the key
      // newValue is the new value of the key
      // remote is a boolean indicating whether the change originated from a different userscript instance
  }

```

The `GM_addValueChangeListener` function returns a _"listenerId"_ value that can be used to remove the listener later using the `GM_removeValueChangeListener` function. The very same applies to `GM.addValueChangeListener` and `GM.removeValueChangeListener` with the only difference that both return a promise;
Here is an example of how the `GM_addValueChangeListener` function might be used in a userscript:

```
// Add a listener for changes to the "savedTab" key
var listenerId = GM_addValueChangeListener("savedTab", function(key, oldValue, newValue, remote) {
  // Print a message to the console when the value of the "savedTab" key changes
  console.log("The value of the '" + key + "' key has changed from '" + oldValue + "' to '" + newValue + "'");
});

```

`GM_addValueChangeListener` can be used by userscripts to communicate with other userscript instances at other tabs.
## GM_removeValueChangeListener(listenerId)
`GM_removeValueChangeListener` and `GM.removeValueChangeListener` both get one argument called _"listenerId"_ and remove the change listener with this ID.
4/27/2026, 8:07:39 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_unregisterMenuCommand

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_openInTab) [](https://www.tampermonkey.net/documentation.php?q=api:GM_setClipboard)
## GM_registerMenuCommand(name, callback, options_or_accessKey)
`GM_registerMenuCommand` allows userscripts to add a new entry to the userscript's menu in the browser, and specify a function to be called when the menu item is selected. Menu items created from different frames are merged into a single menu entry if name, title and accessKey are the same.
The function takes three parameters:
  * **name** - _string_ , A string containing the text to display for the menu item.
  * **callback** - _function_ , A function to be called when the menu item is selected. The function will be passed a single parameter, which is the currently active tab. As of Tampermonkey 4.14 a MouseEvent or KeyboardEvent is passed as function argument.
  * **accessKey** - _string?_ , An optional access key. Please see the description below. Either `options` or `accessKey` can be specified.
  * **options** v4.20+ _object?_ , Optional options that can be used to customize the menu item. The options are specified as an object with the following properties:
    * **id** v5.0+ _number|string?_ , An optional number that was returned by a previous `GM_registerMenuCommand` call. If specified, the according menu item will be updated with the new options. If not specified or the menu item can't be found, a new menu item will be created.
    * **accessKey** - _string?_ , An optional access key for the menu item. This can be used to create a shortcut for the menu item. For example, if the access key is "s", the user can select the menu item by pressing "s" when Tampermonkey's popup-menu is open. Please note that there are browser-wide shortcuts configurable to open Tampermonkey's popup-menu. (`chrome://extensions/shortcuts` in Chrome, `about:addons` + "Manage Extension Shortcuts" in Firefox)
    * **autoClose** - _boolean?_ , An optional boolean parameter that specifies whether the popup menu should be closed after the menu item is clicked. The default value is `true`. Please note that this setting has no effect on the menu command section that is added to the page's context menu.
    * **title** v5.0+ - _string?_ , An optional string that specifies the title of the menu item. This is displayed as a tooltip when the user hovers the mouse over the menu item.

The function return a menu entry ID that can be used to unregister the command.
Here is an example of how the function might be used:

```
const menu_command_id_1 = GM_registerMenuCommand("Show Alert", function(event: MouseEvent | KeyboardEvent) {
  alert("Menu item selected");
}, {
  accessKey: "a",
  autoClose: true
});

const menu_command_id_2 = GM_registerMenuCommand("Log", function(event: MouseEvent | KeyboardEvent) {
  console.log("Menu item selected");
}, "l");

```

## GM_unregisterMenuCommand(menuCmdId)
`GM_unregisterMenuCommand` removes an existing entry from the userscript's menu in the browser.
The function takes a single parameter, which is the ID of the menu item to remove. It does not return a value.
Here is an example of how the function might be used:

```
const menu_command_id = GM_registerMenuCommand(...);
GM_unregisterMenuCommand(menu_command_id);

```

4/27/2026, 8:07:12 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_webRequest

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_xmlhttpRequest) [](https://www.tampermonkey.net/documentation.php?q=api:GM_cookie.list)
## GM_webRequest(rules, listener)
Note: this API is experimental and might change at any time. It is also not available anymore at Manifest v3 versions of Tampermonkey 5.2+ (Chrome and derivates).
`GM_webRequest` (re-)registers rules for web request manipulations and the listener of triggered rules. If you need to just register rules it's better to use `@webRequest` header. Note, webRequest proceeds only requests with types `sub_frame`, `script`, `xhr` and `websocket`.
### Parameters:
  * **rules** - _object[]_ , array of rules with following properties:
    * **selector** - _string|object_ , for which URLs the rule should be triggered, string value is shortening for `{ include: [selector] }`, object properties:
      * **include** - _string|string[]_ , URLs, patterns, and regexpes for rule triggering;
      * **match** - _string|string[]_ , URLs and patterns for rule trigering;
      * **exclude** - _string|string[]_ , URLs, patterns, and regexpes for not triggering the rule;
    * **action** - _string|object_ , what to do with the request, string value `"cancel"` is shortening for `{ cancel: true }`, object properties:
      * **cancel** - _boolean_ , whether to cancel the request;
      * **redirect** - _string|object_ , redirect to some URL which must be included in any @match or @include header. When a string, redirects to the static URL. If object:
        * **from** - _string_ , a regexp to extract some parts of the URL, e.g. `"([^:]+)://match.me/(.*)"`;
        * **to** - _string_ , pattern for substitution, e.g. `"$1://redirected.to/$2"`;
  * **listener** - _function_ , is called when the rule is triggered, cannot impact on the rule action, arguments:
    * **info** - _string_ , type of action: `"cancel"`, `"redirect"`;
    * **message** - _string_ , `"ok"` or `"error"`;
    * **details** - _object_ , info about the request and rule:
      * **rule** - _object_ , the triggered rule;
      * **url** - _string_ , URL of the request;
      * **redirect_url** - _string_ , where the request was redirected;
      * **description** - _string_ , error description.

### Example

```
GM_webRequest([
    { selector: '*cancel.me/*', action: 'cancel' },
    { selector: { include: '*', exclude: 'http://exclude.me/*' }, action: { redirect: 'http://new_static.url' } },
    { selector: { match: '*://match.me/*' }, action: { redirect: { from: '([^:]+)://match.me/(.*)',  to: '$1://redirected.to/$2' } } }
], function(info, message, details) {
    console.log(info, message, details);
});

```

4/27/2026, 8:07:49 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AGM_xmlhttpRequest

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_removeValueChangeListener) [](https://www.tampermonkey.net/documentation.php?q=api:GM_webRequest)
## GM_xmlhttpRequest(details)
The `GM_xmlhttpRequest` allows a userscripts to send an HTTP request and handle the response. The function takes a single parameter: an object containing the details of the request to be sent and the callback functions to be called when the response is received.
The object can have the following properties:
  * **method** - _string_ , usually one of GET, HEAD, POST, PUT, DELETE, ...
  * **url** - _string|URL|File|Blob_ , the destination URL or a `Blob` or `File` objectv5.4.6226+
  * **headers** e.g. `user-agent`, `referer`, ... (some special headers are not supported by Safari and Android browsers)
  * **data** - _string|Blob|File|Object|Array|FormData|URLSearchParams?_ , some data to send via a POST request
  * **redirect** one of `follow`, `error` or `manual`; controls what to happen when a redirect is detected (build 6180+, enforces `fetch` mode)
  * **cookie** a cookie to be patched into the sent cookie set
  * **cookiePartition** v5.2+ _object_?, containing the partition key to be used for sent and received [partitioned cookies](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/cookies#storage_partitioning)
    * **topLevelSite** _string_?, representing the top frame site for partitioned cookies
  * **binary** send the data string in binary mode
  * **nocache** don't cache the resource
  * **revalidate** revalidate maybe cached content
  * **timeout** a timeout in ms
  * **context** a property which will be added to the response object
  * **responseType** one of `arraybuffer`, `blob`, `json` or `stream`
  * **overrideMimeType** a MIME type for the request
  * **anonymous** don't send cookies with the request (enforces `fetch` mode)
  * **fetch** use a `fetch` instead of a `XMLHttpRequest` request (at Chrome this causes `details.timeout` and `xhr.onprogress` to not work and makes `xhr.onreadystatechange` receive only `readyState` `DONE` (==4) events)
  * **proxy** v5.5.6233+ | Firefox only Proxy configuration
    * **type** _string_ , 'direct' | 'http' | 'https' | 'socks' | 'socks4', the kind of proxy to use
    * **host** _string_ , hostname of the proxy server
    * **port** _number_ , port number of the proxy server
    * **username** _string_?, username for SOCKS proxies
    * **password** _string_?, password for SOCKS proxies
    * **proxyDNS** _boolean_?, use the proxy for DNS resolution (only for “socks”/“socks4”)
    * **failoverTimeout** _number_?, fail‑over timeout in seconds
    * **proxyAuthorizationHeader** _string_?, value sent as Proxy-Authorization for HTTP/HTTPS proxies
    * **connectionIsolationKey** _string_?, additional key for connection isolation
  * **user** _string_?, a user name for authentication
  * **password** _string_?, a password
  * **onabort** callback to be executed if the request was aborted
  * **onerror** callback to be executed if the request ended up with an error
  * **onloadstart** callback to be executed on load start, provides access to the stream object if responseType is set to `stream`
  * **onprogress** callback to be executed if the request made some progress
  * **onreadystatechange** callback to be executed if the request's `readyState` changed
  * **ontimeout** callback to be executed if the request failed due to a timeout
  * **onload** callback to be executed if the request was loaded.
```
  function(response) {
    // response is an object containing the details of the response
  }

```
**response** has the following attributes:
    * **finalUrl** - the final URL after all redirects from where the data was loaded
    * **readyState** - the request's `readyState`
    * **status** - the request's status
    * **statusText** - the request's status text
    * **responseHeaders** - the request's response headers
    * **response** - the response data as object if `details.responseType` was set
    * **responseXML** - the response data as XML document
    * **responseText** - the response data as plain string

`GM_xmlhttpRequest` returns an object with the following property:
  * **abort** - function to be called to cancel this request

`GM.xmlHttpRequest` returns a promise that resolves to the response and also has an `abort` function.
Here is an example of how the `GM_xmlhttpRequest` function might be used in a userscript:

```
GM_xmlhttpRequest({
  method: "GET",
  url: "https://example.com/",
  headers: {
    "Content-Type": "application/json"
  },
  onload: function(response) {
    console.log(response.responseText);
  }
});

const r = await GM.xmlHttpRequest({ url: "https://example.com/" }).catch(e => console.error(e));
console.log(r.responseText);

```

**Note:** the `synchronous` flag at `details` is not supported
**Important:** :
  * If you want to use this method then please also check the documentation about [`@connect`](https://www.tampermonkey.net/documentation.php?q=meta:connect)
  * The promise-based version of this function is called `GM.xmlHttpRequest` (with a uppercase "h" in "http")

4/27/2026, 8:07:53 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3ASubresource_Integrity

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:unsafeWindow) [](https://www.tampermonkey.net/documentation.php?q=api:GM_addElement)
## Subresource Integrity
Subresource Integrity (SRI) is a security feature that allows userscript developers to ensure that the external resources (such as JavaScript libraries and CSS files) that they include in their userscript have not been tampered with or modified. This is accomplished by generating a cryptographic hash of the resource and including it in `@require` and `@resource` tags. When the userscript is installed, Tampermonkey will calculate the hash of the resource and compare it to the included hash. If the two hashes do not match, Tampermonkey will refuse to load the resource, preventing attackers from injecting malicious code into your userscript.
The hash component of the URL of `@resource` and `@require` tags is used for this purpose.

```
// @resource SRIsecured1 http://example.com/favicon1.ico#md5=ad34bb...
// @resource SRIsecured2 http://example.com/favicon2.ico#md5=ac3434...,sha256=23fd34...
// @require              https://code.jquery.com/jquery-2.1.1.min.js#md5=45eef...
// @require              https://code.jquery.com/jquery-2.1.2.min.js#md5-ac56d...,sha256-6e789...
// @require              https://code.jquery.com/jquery-3.6.0.min.js#sha256-/xUj+3OJU...ogEvDej/m4=

```

Tampermonkey supports `SHA-256` and `MD5` hashes natively, all other (`SHA-1`, `SHA-384` and `SHA-512`) depend on [window.crypto](https://developer.mozilla.org/en-US/docs/Web/API/Crypto).
In case multiple hashes (separated by comma or semicolon) are given the last currently supported one is used by Tampermonkey. All hashes need to be encoded in either hex or Base64 format.
4/27/2026, 8:11:09 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3AunsafeWindow

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:unwrap) [](https://www.tampermonkey.net/documentation.php?q=api:Subresource_Integrity)
## unsafeWindow
The `unsafeWindow` object provides access to the `window` object of the page that Tampermonkey is running on, rather than the `window` object of the Tampermonkey extension. This can be useful in some cases, such as when a userscript needs to access a JavaScript library or variable that is defined on the page.
4/27/2026, 8:11:20 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3Awindow.focus

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_audio.removeStateChangeListener) [](https://www.tampermonkey.net/documentation.php?q=api:CDATA)
## window.onurlchange
If a script runs on a single-page application, then it can use `window.onurlchange` to listen for URL changes:

```
// ==UserScript==
...
// @grant window.onurlchange
// ==/UserScript==

if (window.onurlchange === null) {
    // feature is supported
    window.addEventListener('urlchange', (info) => ...);
}

```

## window.close
Usually JavaScript is not allowed to close tabs via `window.close`. Userscripts, however, can do this if the permission is requested via `@grant`.
Note: for security reasons it is not allowed to close the last tab of a window.

```
// ==UserScript==
...
// @grant window.close
// ==/UserScript==

if (condition) {
    window.close();
}

```

## window.focus
`window.focus` brings the window to the front, while `unsafeWindow.focus` may fail due to user settings.

```
// ==UserScript==
...
// @grant window.focus
// ==/UserScript==

if (condition) {
    window.focus();
}

```

4/27/2026, 8:11:33 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=api%3Awindow.onurlchange

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_audio.removeStateChangeListener) [](https://www.tampermonkey.net/documentation.php?q=api:CDATA)
## window.onurlchange
If a script runs on a single-page application, then it can use `window.onurlchange` to listen for URL changes:

```
// ==UserScript==
...
// @grant window.onurlchange
// ==/UserScript==

if (window.onurlchange === null) {
    // feature is supported
    window.addEventListener('urlchange', (info) => ...);
}

```

## window.close
Usually JavaScript is not allowed to close tabs via `window.close`. Userscripts, however, can do this if the permission is requested via `@grant`.
Note: for security reasons it is not allowed to close the last tab of a window.

```
// ==UserScript==
...
// @grant window.close
// ==/UserScript==

if (condition) {
    window.close();
}

```

## window.focus
`window.focus` brings the window to the front, while `unsafeWindow.focus` may fail due to user settings.

```
// ==UserScript==
...
// @grant window.focus
// ==/UserScript==

if (condition) {
    window.focus();
}

```

4/27/2026, 8:11:33 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=author

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:grant) [](https://www.tampermonkey.net/documentation.php?q=meta:homepage)
## @author
The scripts author.
4/27/2026, 8:11:51 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=CDATA

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:window.focus) [](https://www.tampermonkey.net/documentation.php?q=settings:content_script_api)
## <></>
CDATA-based way of storing meta data is supported via compatibility option. Tampermonkey tries to automatically detect whether a script needs this option to be enabled.

```
var inline_src = (<><![CDATA[
    console.log('Hello World!');
]]></>).toString();

eval(inline_src);

```

4/27/2026, 8:05:40 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=connect

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:tag) [](https://www.tampermonkey.net/documentation.php?q=meta:noframes)
## @connect
This tag defines the domains (no top-level domains) including subdomains which are allowed to be retrieved by [GM_xmlhttpRequest](https://www.tampermonkey.net/documentation.php?q=api:GM_xmlhttpRequest)

```
// @connect <value>

```

`<value>` can be:
  * a domain name like `example.com` (this will also allow all subdomains).
  * a subdomain name like `subdomain.example.com`.
  * `self` to whitelist the domain the script is currently running at.
  * `localhost` to access the localhost.
  * an IP address like `1.2.3.4`.
  * `*`.

If it's not possible to declare _all_ domains a userscript might connect to then it's a good practice to do the following:
  1. Declare _all known_ or at least _all common_ domains that might be connected by the script to avoid the confirmation dialog for most users.
  2. Additionally add `@connect *` to the script to allow Tampermonkey to offer an "Always allow all domains" button.

Users can also whitelist all requests by adding `*` to the user domain whitelist at the script settings tab.
Notes:
  * Both, the initial **and** the final URL will be checked!
  * For backward compatibility to Scriptish [`@domain`](https://github.com/scriptish/scriptish/wiki/Manual%3A-Metadata-Block#user-content-domain-new-in-scriptish) tags are interpreted as well.
  * Multiple tag instances are allowed.

More examples:

```
// @connect tmnk.net
// @connect www.tampermonkey.net
// @connect self
// @connect localhost
// @connect 8.8.8.8
// @connect *

```

4/27/2026, 8:12:04 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=content_script_api

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:CDATA) [](https://www.tampermonkey.net/documentation.php?q=deployment:overview)
## Content Script API
Script execution is handled by wrapper code that runs or injects the actual userscripts. There are various methods and APIs available for this, and the `Content Script API` setting in Tampermonkey determines how and where the wrapper code is executed.
This setting is available in Firefox and Chrome (Manifest V3) versions of the extension.
The following options are available for the Content Script API setting:
  * **Content Script** : Runs the wrapper code as a [content script or via the content script API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts). This is the default option if not explicitly selected. Userscripts are retrieved via messaging from the background script, _**no** real `document-start` support_.
  * **UserScripts API** : Uses the browser's UserScripts API ([MV3](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts)|[MV2](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts_legacy)) to inject the wrapper code.
    * Chrome: Userscripts are retrieved via messaging from the background script, _**no** real `document-start` support_.
    * Firefox: The userscript is executed instantly -> `document-start` is supported.
  * **UserScripts API Dynamic** : Uses the browser's UserScripts API ([MV3](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts)|[MV2](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts_legacy)) to inject both the wrapper code and the userscript code. The userscript is executed instantly -> `document-start` is supported.

Some known MV3 issues with the Content Script API setting include:
  * **Dynamic Mode Limitations** : In Dynamic Mode, `@include` patterns using regular expressions may cause scripts to be injected into every frame.
  * **External Resource Updates** : Tampermonkey does not automatically update external `@resource`s.

4/27/2026, 8:12:17 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=deploying

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=settings:content_script_api)
## Overview
This document describes how to deploy **Tampermonkey** in a managed environment. It covers both **installing the extension** and **centrally provisioning scripts and settings** using managed browser policies.
The deployment approach is supported by:
  * Chromium-based browsers (Chrome, Chromium, Edge, Brave, etc.)
  * Firefox (desktop, non-mobile)

The configuration itself is provided as a **JSON export** from a preconfigured Tampermonkey installation and fetched by managed Tampermonkey instances at startup. This requires version 5.5+ or 5.5.6235+ (BETA).
Deployment consists of three steps:
  1. Install Tampermonkey via browser policy (force-installed)
  2. Host a provisioning JSON file (exported from Tampermonkey)
  3. Configure browser policies so Tampermonkey imports that JSON via managed storage

The provisioning file can include:
  * Userscripts
  * Script storage
  * Tampermonkey settings
  * External script resources

* * *
## Creating the Provisioning JSON
Tampermonkey provides a built-in export mechanism.
### Export Steps
  1. Open Tampermonkey
  2. **Dashboard → Utilities**
  3. Enable:
     * Include script storage
     * Include Tampermonkey settings
     * Include external script resources
  4. In the **File section** , click **Export**

The resulting file (for example `tm.json`) is the provisioning source used by the browsers.
### Example `tm.json`

```
{
  "version": "1",
  "scripts": [
    {
      "name": "Log location",
      "enabled": true,
      "position": 1,
      "uuid": "4190fc63-64c8-4c68-9a7c-96f41f85729a",
      "source": "Ly8gPT1Vc2VyU2NyaXB0PT0KLy8gQG5[...]sb2cobG9jYXRpb24uaHJlZik7"
    }
  ],
  "settings": {
    "configMode": 100,
    "logLevel": 80
  }
}

```

Host this file on an internal web server, for example:

```
php -S localhost:12121 -t .

```

In **production** mode – Use a real web server (Apache, Nginx, IIS, …) that serves the file over **HTTPS** with a valid certificate.
* * *
## Hash Handling
Each provisioning entry requires a **content hash** to guarantee integrity. If the hash does not match, Tampermonkey logs an error similar to:

```
Error: Hash mismatch for provisioning jsonImport from http://localhost:12121/tm.json:
    expected 1:abcd... !== calculated 1:ef01...

```

The correct hash is shown in the error output (`calculated …`). Copy that value into the policy configuration. A dedicated hash helper tool is planned.
* * *
## Managed Storage Schema
Tampermonkey reads its managed configuration from the browser. Relevant schema excerpt:

```
{
  "jsonImport": [
    {
      "hash": "1:…",
      "url": "https://example.com/tm.json",
      "haltOnError": true,
      "installAsSystemScripts": false
    }
  ]
}

```

### Fields
  * **hash** (required): integrity hash of the JSON file
  * **url** (required): HTTPS or HTTP URL to the JSON file
  * **haltOnError** : abort provisioning on error (Tampermonkey will not start at all in case of an error)
  * **installAsSystemScripts** : install scripts as system scripts (default: true)

## Extension IDs
See [Q406](https://www.tampermonkey.net/faq.php?q=Q406) in the FAQ for Tampermonkey's extension IDs.
* * *
## Firefox Deployment
Firefox supports managed extension configuration via **policies.json**.
Policies can be inspected at:
  * `about:policies`

### Linux (system-wide)
`/etc/firefox/policies/policies.json`

```
{
  "policies": {
    "Extensions": {
      "Install": [
        "https://www.tampermonkey.net/xpi/firefox-current-beta.xpi"
      ]
    },
    "3rdparty": {
      "Extensions": {
        "firefoxbeta@tampermonkey.net": {
          "jsonImport": [
            {
              "hash": "1:66849534c66c5bd384f39f7fb5c7c5bdbc8611bfedab082762cb943f853637d0",
              "url": "http://localhost:12121/tm.json",
              "haltOnError": true,
              "installAsSystemScripts": false
            }
          ]
        }
      }
    }
  }
}

```

### Windows
  * Place `policies.json` in the `distribution` directory next to `firefox.exe`
Find the Firefox install directory (commonly):

```
C:\Program Files\Mozilla Firefox\

```

Create:

```
C:\Program Files\Mozilla Firefox\distribution\

```

Put this file here:

```
C:\Program Files\Mozilla Firefox\distribution\policies.json

```

  * Alternatively deploy via [GPO](https://extensionworkshop.com/documentation/enterprise/enterprise-development/#distributing-your-policy) or Intune

### macOS
  * Place `policies.json` in the `distribution` directory
Find and edit:

```
Firefox.app/Contents/Resources/distribution/policies.json

```

  * Or deploy via [configuration profiles](https://www.tampermonkey.net/\(https:/extensionworkshop.com/documentation/enterprise/enterprise-development/#distributing-your-policy\)) / MDM

Mozilla policy documentation:
  * <https://mozilla.github.io/policy-templates/#extensions>

* * *
## Chromium-Based Browsers
Policies can be inspected at:
  * `chrome://policy/`
  * `edge://policy/`

### Linux
`/etc/opt/chrome/policies/managed/tampermonkey.json`

```
{
  "ExtensionInstallForcelist": [
    "gcalenpjmijncebpfijmoaglllgpjagf"
  ],
  "3rdparty": {
    "extensions": {
      "gcalenpjmijncebpfijmoaglllgpjagf": {
        "jsonImport": [
          {
            "hash": "1:66849534c66c5bd384f39f7fb5c7c5bdbc8611bfedab082762cb943f853637d0",
            "url": "http://localhost:12121/tm.json",
            "haltOnError": true,
            "installAsSystemScripts": false
          }
        ]
      }
    }
  }
}

```

### Windows
Create a `.reg` file (e.g. `tampermonkey_provision.reg`) and import it with `reg import` **as an administrator** :

```
Windows Registry Editor Version 5.00

; Force‑install Tampermonkey (if not already installed)
[HKEY_LOCAL_MACHINE\Software\Policies\Google\Chrome\ExtensionInstallForcelist]
"1"="gcalenpjmijncebpfijmoaglllgpjagf"

; 3rd‑party policy for the extension
[HKEY_LOCAL_MACHINE\Software\Policies\Google\Chrome\3rdparty\extensions\gcalenpjmijncebpfijmoaglllgpjagf\jsonImport\1]
"hash"="1:66849534c66c5bd384f39f7fb5c7c5bdbc8611bfedab082762cb943f853637d0"
"url"="http://localhost:12121/tm.json"
"haltOnError"=dword:00000001
"installAsSystemScripts"=dword:00000000

```

  * Deploy via Group Policy or MDM

### macOS
  * Deploy via [MCX](https://www.chromium.org/administrators/configuring-policy-for-extensions/#mac) using `.mobileconfig` or `.plist`

Chromium documentation:
  * <https://www.chromium.org/administrators/configuring-policy-for-extensions/>
  * <https://chromeenterprise.google/policies/#ExtensionInstallForcelist>

4/27/2026, 8:12:23 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=deployment%3Aoverview

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=settings:content_script_api)
## Overview
This document describes how to deploy **Tampermonkey** in a managed environment. It covers both **installing the extension** and **centrally provisioning scripts and settings** using managed browser policies.
The deployment approach is supported by:
  * Chromium-based browsers (Chrome, Chromium, Edge, Brave, etc.)
  * Firefox (desktop, non-mobile)

The configuration itself is provided as a **JSON export** from a preconfigured Tampermonkey installation and fetched by managed Tampermonkey instances at startup. This requires version 5.5+ or 5.5.6235+ (BETA).
Deployment consists of three steps:
  1. Install Tampermonkey via browser policy (force-installed)
  2. Host a provisioning JSON file (exported from Tampermonkey)
  3. Configure browser policies so Tampermonkey imports that JSON via managed storage

The provisioning file can include:
  * Userscripts
  * Script storage
  * Tampermonkey settings
  * External script resources

* * *
## Creating the Provisioning JSON
Tampermonkey provides a built-in export mechanism.
### Export Steps
  1. Open Tampermonkey
  2. **Dashboard → Utilities**
  3. Enable:
     * Include script storage
     * Include Tampermonkey settings
     * Include external script resources
  4. In the **File section** , click **Export**

The resulting file (for example `tm.json`) is the provisioning source used by the browsers.
### Example `tm.json`

```
{
  "version": "1",
  "scripts": [
    {
      "name": "Log location",
      "enabled": true,
      "position": 1,
      "uuid": "4190fc63-64c8-4c68-9a7c-96f41f85729a",
      "source": "Ly8gPT1Vc2VyU2NyaXB0PT0KLy8gQG5[...]sb2cobG9jYXRpb24uaHJlZik7"
    }
  ],
  "settings": {
    "configMode": 100,
    "logLevel": 80
  }
}

```

Host this file on an internal web server, for example:

```
php -S localhost:12121 -t .

```

In **production** mode – Use a real web server (Apache, Nginx, IIS, …) that serves the file over **HTTPS** with a valid certificate.
* * *
## Hash Handling
Each provisioning entry requires a **content hash** to guarantee integrity. If the hash does not match, Tampermonkey logs an error similar to:

```
Error: Hash mismatch for provisioning jsonImport from http://localhost:12121/tm.json:
    expected 1:abcd... !== calculated 1:ef01...

```

The correct hash is shown in the error output (`calculated …`). Copy that value into the policy configuration. A dedicated hash helper tool is planned.
* * *
## Managed Storage Schema
Tampermonkey reads its managed configuration from the browser. Relevant schema excerpt:

```
{
  "jsonImport": [
    {
      "hash": "1:…",
      "url": "https://example.com/tm.json",
      "haltOnError": true,
      "installAsSystemScripts": false
    }
  ]
}

```

### Fields
  * **hash** (required): integrity hash of the JSON file
  * **url** (required): HTTPS or HTTP URL to the JSON file
  * **haltOnError** : abort provisioning on error (Tampermonkey will not start at all in case of an error)
  * **installAsSystemScripts** : install scripts as system scripts (default: true)

## Extension IDs
See [Q406](https://www.tampermonkey.net/faq.php?q=Q406) in the FAQ for Tampermonkey's extension IDs.
* * *
## Firefox Deployment
Firefox supports managed extension configuration via **policies.json**.
Policies can be inspected at:
  * `about:policies`

### Linux (system-wide)
`/etc/firefox/policies/policies.json`

```
{
  "policies": {
    "Extensions": {
      "Install": [
        "https://www.tampermonkey.net/xpi/firefox-current-beta.xpi"
      ]
    },
    "3rdparty": {
      "Extensions": {
        "firefoxbeta@tampermonkey.net": {
          "jsonImport": [
            {
              "hash": "1:66849534c66c5bd384f39f7fb5c7c5bdbc8611bfedab082762cb943f853637d0",
              "url": "http://localhost:12121/tm.json",
              "haltOnError": true,
              "installAsSystemScripts": false
            }
          ]
        }
      }
    }
  }
}

```

### Windows
  * Place `policies.json` in the `distribution` directory next to `firefox.exe`
Find the Firefox install directory (commonly):

```
C:\Program Files\Mozilla Firefox\

```

Create:

```
C:\Program Files\Mozilla Firefox\distribution\

```

Put this file here:

```
C:\Program Files\Mozilla Firefox\distribution\policies.json

```

  * Alternatively deploy via [GPO](https://extensionworkshop.com/documentation/enterprise/enterprise-development/#distributing-your-policy) or Intune

### macOS
  * Place `policies.json` in the `distribution` directory
Find and edit:

```
Firefox.app/Contents/Resources/distribution/policies.json

```

  * Or deploy via [configuration profiles](https://www.tampermonkey.net/\(https:/extensionworkshop.com/documentation/enterprise/enterprise-development/#distributing-your-policy\)) / MDM

Mozilla policy documentation:
  * <https://mozilla.github.io/policy-templates/#extensions>

* * *
## Chromium-Based Browsers
Policies can be inspected at:
  * `chrome://policy/`
  * `edge://policy/`

### Linux
`/etc/opt/chrome/policies/managed/tampermonkey.json`

```
{
  "ExtensionInstallForcelist": [
    "gcalenpjmijncebpfijmoaglllgpjagf"
  ],
  "3rdparty": {
    "extensions": {
      "gcalenpjmijncebpfijmoaglllgpjagf": {
        "jsonImport": [
          {
            "hash": "1:66849534c66c5bd384f39f7fb5c7c5bdbc8611bfedab082762cb943f853637d0",
            "url": "http://localhost:12121/tm.json",
            "haltOnError": true,
            "installAsSystemScripts": false
          }
        ]
      }
    }
  }
}

```

### Windows
Create a `.reg` file (e.g. `tampermonkey_provision.reg`) and import it with `reg import` **as an administrator** :

```
Windows Registry Editor Version 5.00

; Force‑install Tampermonkey (if not already installed)
[HKEY_LOCAL_MACHINE\Software\Policies\Google\Chrome\ExtensionInstallForcelist]
"1"="gcalenpjmijncebpfijmoaglllgpjagf"

; 3rd‑party policy for the extension
[HKEY_LOCAL_MACHINE\Software\Policies\Google\Chrome\3rdparty\extensions\gcalenpjmijncebpfijmoaglllgpjagf\jsonImport\1]
"hash"="1:66849534c66c5bd384f39f7fb5c7c5bdbc8611bfedab082762cb943f853637d0"
"url"="http://localhost:12121/tm.json"
"haltOnError"=dword:00000001
"installAsSystemScripts"=dword:00000000

```

  * Deploy via Group Policy or MDM

### macOS
  * Deploy via [MCX](https://www.chromium.org/administrators/configuring-policy-for-extensions/#mac) using `.mobileconfig` or `.plist`

Chromium documentation:
  * <https://www.chromium.org/administrators/configuring-policy-for-extensions/>
  * <https://chromeenterprise.google/policies/#ExtensionInstallForcelist>

4/27/2026, 8:12:23 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=description

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:version) [](https://www.tampermonkey.net/documentation.php?q=meta:icon)
## @description
A short significant description.
Internationalization is done by adding an appendix naming the locale.

```
// @description    This userscript does wonderful things
// @description:de Dieses Userscript tut wundervolle Dinge

```

4/27/2026, 8:12:40 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=externals

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:antifeature) [](https://www.tampermonkey.net/documentation.php?q=meta:include)
## @require
Points to a JavaScript file that is loaded and executed before the script itself starts running. Note: the scripts loaded via `@require` and their _"use strict"_ statements might influence the userscript's strict mode!

```
// @require https://code.jquery.com/jquery-2.1.4.min.js
// @require https://code.jquery.com/jquery-2.1.3.min.js#sha256=23456...
// @require https://code.jquery.com/jquery-2.1.2.min.js#md5=34567...,sha256=6789...

```

Please check the [sub-resource integrity](https://www.tampermonkey.net/documentation.php?q=api:Subresource_Integrity) section for more information how to ensure integrity.
Multiple tag instances are allowed.
## @resource
Preloads resources that can by accessed via `GM_getResourceURL` and `GM_getResourceText` by the script.

```
// @resource icon1       http://www.tampermonkey.net/favicon.ico
// @resource icon2       /images/icon.png
// @resource html        http://www.tampermonkey.net/index.html
// @resource xml         http://www.tampermonkey.net/crx/tampermonkey.xml
// @resource SRIsecured1 http://www.tampermonkey.net/favicon.ico#md5=123434...
// @resource SRIsecured2 http://www.tampermonkey.net/favicon.ico#md5=123434...;sha256=234234...

```

Please check the [sub-resource integrity](https://www.tampermonkey.net/documentation.php?q=api:Subresource_Integrity) section for more information how to ensure integrity.
Multiple tag instances are allowed.
4/27/2026, 8:12:54 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=GM_addElement

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:Subresource_Integrity) [](https://www.tampermonkey.net/documentation.php?q=api:GM_addStyle)
## GM_addElement(tag_name, attributes), GM_addElement(parent_node, tag_name, attributes)
`GM_addElement` allows Tampermonkey scripts to add new elements to the page that Tampermonkey is running on. This can be useful for a variety of purposes, such as adding `script` and `img` tags if the page limits these elements with a content security policy (CSP).
It creates an HTML element specified by _"tag_name"_ and applies all given _"attributes"_ and returns the injected HTML element. If a _"parent_node"_ is given, then it is attached to it or to document head or body otherwise. In case of an error it returns `null`.
For suitable _"attributes"_ , please consult the appropriate documentation. For example:
  * [script tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script)
  * [img tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img)
  * [style tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/style)

```
GM_addElement('script', {
  textContent: 'window.foo = "bar";'
});

GM_addElement('script', {
  src: 'https://example.com/script.js',
  type: 'text/javascript'
});

GM_addElement(document.getElementsByTagName('div')[0], 'img', {
  src: 'https://example.com/image.png'
});

GM_addElement(shadowDOM, 'style', {
  textContent: 'div { color: black; };'
});

```

4/27/2026, 8:05:49 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=GM_addStyle

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_addElement) [](https://www.tampermonkey.net/documentation.php?q=api:GM_download)
## GM_addStyle(css)
Adds the given style to the document and returns the injected style element.
4/27/2026, 8:05:53 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=GM_audio

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_cookie.delete) [](https://www.tampermonkey.net/documentation.php?q=api:window.onurlchange)
## GM_audio.setMute(details, callback?)
Sets the mute state of the current tab.
**Parameters**
  * **details** _object_ , describing the new mute state of the tab:
    * **isMuted** _boolean_ , `true` to mute the tab, `false` to un‑mute it.
  * **callback** _(optional)_ _function?_ , called when the operation finishes.
    * **error** _(optional)_ _string_ , contains an error message if setting the mute state fails, otherwise it is `undefined`.

**Return value**
  * _Callback style_ : nothing (result is delivered via the callback).
  * _Promise style_ : returns a `Promise<void>` that resolves on success and rejects with an error string on failure.

**Example (callback)**

```
// ==UserScript==
...
// @grant      GM_audio
// ==/UserScript==

GM_audio.setMute({ isMuted: true }, function(err) {
  if (err) console.error('mute failed:', err);
  else console.log('tab muted');
});

```

**Example (Promise)**

```
// ==UserScript==
...
// @grant      GM.audio
// ==/UserScript==

await GM.audio.setMute({ isMuted: false });
console.log('tab un‑muted');

```

## GM_audio.getState(callback)
Retrieves the current audio state of the tab.
**Parameters**
  * **callback** _function_ , to be called with an object describing the tab’s audio state:
    * **info** _object_ , representing the retrieved state
      * **isMuted** _(optional)_ _boolean_ , whether the tab is currently muted.
      * **muteReason** _(optional)_ _string_ , the reason why the tab was muted, if it is currently muted.
        * `user` – User action (e.g., mute button).
        * `capture` – Tab capture API call.
        * `extension` – Extension call.
      * **isAudible** _(optional)_ _boolean_ , whether the tab is currently playing audio.

**Return value**
  * _Callback style_ : nothing (state delivered via the callback).
  * _Promise style_ : returns a `Promise` that resolves with the callback’s `info` object on success or rejects on error.

**Example (callback)**

```
// ==UserScript==
...
// @grant      GM_audio
// ==/UserScript==

GM_audio.getState(function(state) {
  if (!state) return console.error('failed to read state');
  console.log('muted?', state.isMuted, 'reason:', state.muteReason);
  console.log('audible?', state.isAudible);
});

```

**Example (Promise)**

```
// ==UserScript==
...
// @grant      GM.audio
// ==/UserScript==

const state = await GM.audio.getState();
console.log(`muted=${state.isMuted} (reason=${state.muteReason}) audible=${state.isAudible}`);

```

## GM_audio.addStateChangeListener(listener, callback)
Registers a listener that is called whenever the tab’s mute or audible state changes.
**Parameters**
  * **listener** _function_ , to be called when state changes. The function will be passed one argument:
    * **info** _object_ , representing the retrieved state change
      * **muted** _(optional)_ _string | false_ , mute reason or `false` if not muted.
      * **audible** _(optional)_ _boolean_ , whether the tab is currently playing audio.
  * **callback** _(optional)_ _function?_ , called once the registration attempt is complete. The function will be passed one argument:
    * **error** _(optional)_ _string?_ , containing an error message if registration fails, or `undefined` otherwise.

**Return value**
  * _Callback style_ : nothing (listener registered via callback).
  * _Promise style_ : returns a `Promise<void>` that resolves when the listener has been successfully registered.

**Example (callback)**

```
// ==UserScript==
...
// @grant      GM_audio
// ==/UserScript==

GM_audio.addStateChangeListener(function(e) {
  if ('muted' in e) console.log('muted:', e.muted);
  if ('audible' in e) console.log('audible:', e.audible);
});

```

**Example (Promise)**

```
// ==UserScript==
...
// @grant      GM.audio
// ==/UserScript==

await GM.audio.addStateChangeListener(ev => {
  if (ev.muted) console.log('muted by', ev.muted);
});

```

## GM_audio.removeStateChangeListener(listener, callback)
Unregisters a previously added state‑change listener.
**Parameters**
  * **listener** _function_ , The exact listener function that was passed to `addStateChangeListener`:
  * **callback** _(optional)_ _function?_ , called once the listener has been removed

**Return value**
  * _Callback style_ : nothing.
  * _Promise style_ : returns a `Promise<void>` that resolves when the listener has been removed.

**Example (callback)**

```
// ==UserScript==
...
// @grant      GM_audio
// ==/UserScript==

function onAudio(ev) { console.log(ev); }
GM_audio.addStateChangeListener(onAudio);
...
GM_audio.removeStateChangeListener(onAudio, () => console.log('listener removed'));

```

**Example (Promise)**

```
// ==UserScript==
...
// @grant      GM.audio
// ==/UserScript==

await GM.audio.removeStateChangeListener(onAudio);
console.log('listener removed');

```

4/27/2026, 8:06:06 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=GM_cookie

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_webRequest) [](https://www.tampermonkey.net/documentation.php?q=api:GM_audio.setMute)
## GM_cookie.list(details[, callback])
Note: `httpOnly` cookies are supported at the BETA versions of Tampermonkey only for now
Tampermonkey checks if the script has `@include` or `@match` access to given `details.url` arguments!
### Parameters:
  * **details** _object_ , containing properties of the cookies to retrieve
    * **url** _string?_ , representing the URL to retrieve cookies from (defaults to current document URL)
    * **domain** _string?_ , representing the domain of the cookies to retrieve
    * **name** _string?_ , representing the name of the cookies to retrieve
    * **path** _string?_ , representing the path of the cookies to retrieve
    * **partitionKey** v5.2+ _object_?, representing the [partition key](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/cookies#storage_partitioning) of the cookies, use an empty object to retrieve all cookies
      * **topLevelSite** _string_?, representing the top frame site of the cookies
  * **callback** _function?_ , to be called when the cookies have been retrieved. The function will be passed two arguments:
    * **cookies** _object[]_ , representing the retrieved cookies
    * **error** _string_ , representing an error message if an error occurred, null otherwise.

The cookie objects have the following properties:
  * **domain** _string_ , representing the domain of the cookie
  * **expirationDate** _number?_ , the expiration date of the cookie in seconds since the Unix epoch. If not specified, the cookie never expires.
  * **firstPartyDomain** _string?_ : the first party domain of the cookie.
  * **partitionKey** v5.2+ _object_?, containing the partition key of the cookie
    * **topLevelSite** _string_?, representing the top frame site of the cookie
  * **hostOnly** _boolean_ , indicating whether the cookie is a host-only cookie
  * **httpOnly** _boolean_ , indicating whether the cookie is an HTTP-only cookie
  * **name** _string_ , representing the name of the cookie
  * **path** _string_ , representing the path of the cookie
  * **sameSite** _string_ , indicating the SameSite attribute of the cookie
  * **secure** _boolean_ , indicating whether the cookie requires a secure connection
  * **session** _boolean_ , indicating whether the cookie is a session cookie
  * **value** _string_ , representing the value of the cookie

### Example usage:

```
// Retrieve all cookies with name "mycookie"
GM_cookie.list({ name: "mycookie" }, function(cookies, error) {
  if (!error) {
    console.log(cookies);
  } else {
    console.error(error);
  }
});

// Retrieve all cookies for the current domain
const cookies = await GM.cookie.list()
console.log(cookies);

```

## GM_cookie.set(details[, callback])
Sets a cookie with the given details. Supported properties are defined [here](https://developer.chrome.com/extensions/cookies#method-set).
### Parameters:
  * **details** : An object containing the details of the cookie to be set. The object can have the following properties:
    * **url** _string?_ , the URL to associate the cookie with. If not specified, the cookie is associated with the current document's URL.
    * **name** _string_ , the name of the cookie.
    * **value** _string_ , the value of the cookie.
    * **domain** _string?_ , the domain of the cookie.
    * **firstPartyDomain** _string?_ : the first party domain of the cookie.
    * **partitionKey** v5.2+ _object_?, containing the [partition key of the cookie](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/cookies#storage_partitioning)
      * **topLevelSite** _string_?, representing the top frame site of the cookie
    * **path** _string?_ , the path of the cookie.
    * **secure** _boolean?_ , whether the cookie should only be sent over HTTPS.
    * **httpOnly** _boolean?_ , whether the cookie should be marked as HttpOnly.
    * **expirationDate** _number?_ , the expiration date of the cookie in seconds since the Unix epoch. If not specified, the cookie never expires.
  * **callback** _function?_ , a function to be called when the operation is complete. The function is passed one argument:
    * **error** _string?_ , if there was an error setting the cookie, this contains an error message. Otherwise, it is `undefined`.

### Example:

```
GM_cookie.set({
  url: 'https://example.com',
  name: 'name',
  value: 'value',
  domain: '.example.com',
  path: '/',
  secure: true,
  httpOnly: true,
  expirationDate: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30) // Expires in 30 days
}, function(error) {
  if (error) {
    console.error(error);
  } else {
    console.log('Cookie set successfully.');
  }
});

GM.cookie.set({
  name: 'name',
  value: 'value'
})
.then(() => {
  console.log('Cookie set successfully.');
})
.catch((error) => {
  console.error(error);
});

```

## GM_cookie.delete(details, callback)
Deletes a cookie.
### Parameters:
The `details` object can have the following properties:
  * **url** _string?_ , the URL associated with the cookie. If `url` is not specified, the current document's URL will be used.
  * **name** _string_ , the name of the cookie to delete.
  * **firstPartyDomain** _string?_ : the first party domain of the cookie to delete.
  * **partitionKey** v5.2+ _object_?, representing the partition key of the cookie to delete
    * **topLevelSite** _string_?, representing the top frame site of the cookies

The `callback` function is optional and will be called when the cookie has been deleted or an error has occurred. It takes one argument:
  * **error** _string?_ , an error message, or `undefined` if the cookie was deleted successfully.

### Example:

```
GM_cookie.delete({ name: 'cookie_name' }, function(error) {
    if (error) {
        console.error(error);
    } else {
        console.log('Cookie deleted successfully');
    }
});

```

4/27/2026, 8:06:11 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=GM_download

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_addStyle) [](https://www.tampermonkey.net/documentation.php?q=api:GM_getResourceText)
## GM_download(details), GM_download(url, name)
`GM_download` allows userscripts to download a file from a specified URL and save it to the user's local machine.
The `GM_download` function takes the following parameters:
_details_ can have the following attributes:
  * **url** : The URL of the file to download or a `Blob` or `File` objectv5.4.6226+. In case of a string, this must be a valid URL and must point to a file that is accessible to the user.
  * **name** : The name to use for the downloaded file. This should include the file's extension, such as .txt or .pdf. For security reasons the file extension needs to be whitelisted at Tampermonkey's options page
  * **headers** : An object containing HTTP headers to include in the download request. See [`GM_xmlhttpRequest`](https://www.tampermonkey.net/documentation.php?q=meta:GM_xmlhttpRequest) for more details.
  * **saveAs** : A boolean value indicating whether to use the user's default download location, or to prompt the user to choose a different location. This option works in browser API mode only.
  * **conflictAction** : A string that control what happens when a file with this name already exists. This option works in browser API mode only. Possible values are `uniquify`, `overwrite` and `prompt`. Please check [this link](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/downloads/FilenameConflictAction) for more details.
  * **onload** : A function to call when the download has completed successfully.
  * **onerror** : A function to call if the download fails or is cancelled.
  * **onprogress** A callback to be executed if this download made some progress.
  * **ontimeout** A callback to be executed if this download failed due to a timeout.

The _download_ argument of the _onerror_ callback can have the following attributes:
  * **error** : error reason
    * not_enabled - the download feature isn't enabled by the user
    * not_whitelisted - the requested file extension is not whitelisted
    * not_permitted - the user enabled the download feature, but did not give the _downloads_ permission
    * not_supported - the download feature isn't supported by the browser/version
    * not_succeeded - the download wasn't started or failed, the _details_ attribute may provide more information
  * **details** : detail about that error

Returns an object with the following property:
  * **abort** : A function which can be called to cancel this download.

If `GM.download` is used it returns a promise that resolves to the download details and also has an `abort` function.
Depending on the download mode `GM_info` provides a property called `downloadMode` which is set to one of the following values: **native** , **disabled** or **browser**.

```
GM_download("http://example.com/file.txt", "file.txt");

const download = GM_download({
    url: "http://example.com/file.txt",
    name: "file.txt",
    saveAs: true
});

// cancel download after 5 seconds
window.setTimeout(() => download.abort(), 5000);

```

Note: The browser might modify the desired filename. Especially a file extension might be added if the browser finds this to be safe to download at the current OS.
4/27/2026, 8:06:24 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=GM_getResource

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_download) [](https://www.tampermonkey.net/documentation.php?q=api:GM_info)
## GM_getResourceText(name)
Allows userscripts to access the text of a resource (such as a JavaScript or CSS file) that has been included in a userscript via `@resource`.
The function takes a single parameter, which is the _"name"_ of the resource to retrieve. It returns the text of the resource as a string.
Here is an example of how the function might be used:

```
const scriptText = GM_getResourceText("myscript.js");
const scriptText2 = await GM.getResourceText("myscript.js");
const script = document.createElement("script");
script.textContent = scriptText;
document.body.appendChild(script);

```

## GM_getResourceURL(name)
`GM_getResourceURL` allows userscripts to access the URL of a resource (such as a CSS or image file) that has been included in the userscript via a `@resource` tag at the script header.
The function takes a single parameter, which is the _"name"_ of the resource to retrieve. It returns the URL of the resource as a string.

```
const imageUrl = GM_getResourceURL("myimage.png");
const imageUrl2 = await GM.getResourceUrl("myimage.png");
const image = document.createElement("img");
image.src = imageUrl;
document.body.appendChild(image);

```

**Important:** : The promise-based version of this function is called `GM.getResourceUrl` (with a lowercase "r" and "l" in "Url").
4/27/2026, 8:06:29 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=GM_info

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_getResourceURL) [](https://www.tampermonkey.net/documentation.php?q=api:GM_log)
## GM_info
Get some info about the script and TM. The object might look like this:

```
type ScriptGetInfo = {
    container?: { // 5.3+ | Firefox only
        id: string,
        name?: string
    },
    downloadMode: string,
    isFirstPartyIsolation?: boolean,
    isIncognito: boolean,
    sandboxMode: SandboxMode, // 4.18+
    scriptHandler: string,
    scriptMetaStr: string | null,
    scriptUpdateURL: string | null,
    scriptWillUpdate: boolean,
    userAgentData: UADataValues, // 4.19+
    version?: string,
    script: {
        antifeatures: { [antifeature: string]: { [locale: string]: string } },
        author: string | null,
        blockers: string[],
        connects: string[],
        copyright: string | null,
        deleted?: number | undefined,
        description_i18n: { [locale: string]: string } | null,
        description: string,
        downloadURL: string | null,
        excludes: string[],
        fileURL: string | null,
        grant: string[],
        header: string | null,
        homepage: string | null,
        icon: string | null,
        icon64: string | null,
        includes: string[],
        lastModified: number,
        matches: string[],
        name_i18n: { [locale: string]: string } | null,
        name: string,
        namespace: string | null,
        position: number,
        resources: Resource[],
        supportURL: string | null,
        system?: boolean | undefined,
        'run-at': string | null,
        'run-in': string[] | null, // 5.3+
        unwrap: boolean | null,
        updateURL: string | null,
        version: string,
        webRequest: WebRequestRule[] | null,
        options: {
            check_for_updates: boolean,
            comment: string | null,
            compatopts_for_requires: boolean,
            compat_wrappedjsobject: boolean,
            compat_metadata: boolean,
            compat_foreach: boolean,
            compat_powerful_this: boolean | null,
            sandbox: string | null,
            noframes: boolean | null,
            unwrap: boolean | null,
            run_at: string | null,
            run_in: string | null, // 5.3+
            override: {
                use_includes: string[],
                orig_includes: string[],
                merge_includes: boolean,
                use_matches: string[],
                orig_matches: string[],
                merge_matches: boolean,
                use_excludes: string[],
                orig_excludes: string[],
                merge_excludes: boolean,
                use_connects: string[],
                orig_connects: string[],
                merge_connects: boolean,
                use_blockers: string[],
                orig_run_at: string | null,
                orig_run_in: string[] | null, // 5.3+
                orig_noframes: boolean | null
            }
        }
    }
};

type SandboxMode = 'js' | 'raw' | 'dom';

type Resource = {
    name: string,
    url: string,
    error?: string,
    content?: string,
    meta?: string
};

type WebRequestRule = {
    selector: { include?: string | string[], match?: string | string[], exclude?: string | string[] } | string,
    action: string | {
        cancel?: boolean,
        redirect?: {
            url: string,
            from?: string,
            to?: string
        } | string
    }
};

type UADataValues = {
    brands?: {
        brand: string;
        version: string;
    }[],
    mobile?: boolean,
    platform?: string,
    architecture?: string,
    bitness?: string
}

```

4/27/2026, 8:06:39 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=GM_log

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_info) [](https://www.tampermonkey.net/documentation.php?q=api:GM_notification)
## GM_log(message)
Log a message to the console.
4/27/2026, 8:06:44 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=GM_notification

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_log) [](https://www.tampermonkey.net/documentation.php?q=api:GM_openInTab)
## GM_notification(details, ondone), GM_notification(text, title, image, onclick)
`GM_notification` allows users to display notifications on the screen, using a provided message and other optional parameters.
The function takes several parameters. Either a _details_ object or multiple parameters.
The _details_ object can have the following attributes, from which some can also be used as direct parameter.
The available options include:
  * **text** : A string containing the message to display in the notification.
  * **title** : The title of the notification.
  * **tag** : v5.0+ This tag will be used to identify this notification. This way you can update existing notifications by calling `GM_notification` again and using the same tag. If you don't provide a tag, a new notification will be created every time.
  * **image** : The URL of an image to display in the notification.
  * **highlight** : A boolean flag whether to highlight the tab that sends the notfication (required unless text is set)
  * **silent** : A boolean flag whether to not play a sound
  * **timeout** : The time, in milliseconds, after which the notification should automatically close.
  * **url** : v5.0+ A URL to load when the user clicks on the notification. You can prevent loading the URL by calling `event.preventDefault()` in the `onclick` event handler.
  * **onclick** : A callback function that will be called when the user clicks on the notification.
  * **ondone** A callback function that will be called when the notification is closed (no matter if this was triggered by a timeout or a click) or the tab was highlighted

The function does not return a value.
If no `url` and no `tag` is provided the notification will closed when the userscript unloads v5.0+(e.g. when the page is reloaded or the tab is closed).
Here is an example of how the function might be used:

```
GM_notification({
  text: "This is the notification message.",
  title: "Notification Title",
  url: 'https:/example.com/',
  onclick: (event) => {
    // The userscript is still running, so don't open example.com
    event.preventDefault();
    // Display an alert message instead
    alert('I was clicked!')
  }
});

const clicked = await GM.notification({ text: "Click me." });

```

4/27/2026, 8:06:49 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=GM_openInTab

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_notification) [](https://www.tampermonkey.net/documentation.php?q=api:GM_registerMenuCommand)
## GM_openInTab(url, options), GM_openInTab(url, loadInBackground)
`GM_openInTab` allows userscripts to open a new tab in the browser and navigate to a specified URL.
The function takes two parameters:
A string names _"url"_ containing the URL of the page to open in the new tab.
An optional options object that can be used to customize the behavior of the new tab. The available options include:
  * **active** : A boolean value indicating whether the new tab should be active (selected) or not. The default is false.
  * **insert** : An integer indicating the position at which the new tab should be inserted in the tab strip. The default is false, which means the new tab will be added to the end of the tab strip.
  * **setParent** : A boolean value indicating whether the new tab should be considered a child of the current tab. The default is false.
  * **incognito** A boolean value that makes the tab being opened inside a incognito mode/private mode window.
  * **loadInBackground** A boolean value has the opposite meaning of **active** and was added to achieve Greasemonkey 3.x compatibility.

The function returns an object with the function **close** , the listener **onclose** and a flag called **closed**.
Here is an example of how the function might be used:

```
// Open a new tab and navigate to the specified URL
GM_openInTab("https://www.example.com/");

```

4/27/2026, 8:06:59 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=GM_registerMenuCommand

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_openInTab) [](https://www.tampermonkey.net/documentation.php?q=api:GM_setClipboard)
## GM_registerMenuCommand(name, callback, options_or_accessKey)
`GM_registerMenuCommand` allows userscripts to add a new entry to the userscript's menu in the browser, and specify a function to be called when the menu item is selected. Menu items created from different frames are merged into a single menu entry if name, title and accessKey are the same.
The function takes three parameters:
  * **name** - _string_ , A string containing the text to display for the menu item.
  * **callback** - _function_ , A function to be called when the menu item is selected. The function will be passed a single parameter, which is the currently active tab. As of Tampermonkey 4.14 a MouseEvent or KeyboardEvent is passed as function argument.
  * **accessKey** - _string?_ , An optional access key. Please see the description below. Either `options` or `accessKey` can be specified.
  * **options** v4.20+ _object?_ , Optional options that can be used to customize the menu item. The options are specified as an object with the following properties:
    * **id** v5.0+ _number|string?_ , An optional number that was returned by a previous `GM_registerMenuCommand` call. If specified, the according menu item will be updated with the new options. If not specified or the menu item can't be found, a new menu item will be created.
    * **accessKey** - _string?_ , An optional access key for the menu item. This can be used to create a shortcut for the menu item. For example, if the access key is "s", the user can select the menu item by pressing "s" when Tampermonkey's popup-menu is open. Please note that there are browser-wide shortcuts configurable to open Tampermonkey's popup-menu. (`chrome://extensions/shortcuts` in Chrome, `about:addons` + "Manage Extension Shortcuts" in Firefox)
    * **autoClose** - _boolean?_ , An optional boolean parameter that specifies whether the popup menu should be closed after the menu item is clicked. The default value is `true`. Please note that this setting has no effect on the menu command section that is added to the page's context menu.
    * **title** v5.0+ - _string?_ , An optional string that specifies the title of the menu item. This is displayed as a tooltip when the user hovers the mouse over the menu item.

The function return a menu entry ID that can be used to unregister the command.
Here is an example of how the function might be used:

```
const menu_command_id_1 = GM_registerMenuCommand("Show Alert", function(event: MouseEvent | KeyboardEvent) {
  alert("Menu item selected");
}, {
  accessKey: "a",
  autoClose: true
});

const menu_command_id_2 = GM_registerMenuCommand("Log", function(event: MouseEvent | KeyboardEvent) {
  console.log("Menu item selected");
}, "l");

```

## GM_unregisterMenuCommand(menuCmdId)
`GM_unregisterMenuCommand` removes an existing entry from the userscript's menu in the browser.
The function takes a single parameter, which is the ID of the menu item to remove. It does not return a value.
Here is an example of how the function might be used:

```
const menu_command_id = GM_registerMenuCommand(...);
GM_unregisterMenuCommand(menu_command_id);

```

4/27/2026, 8:07:12 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=GM_setClipboard

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_unregisterMenuCommand) [](https://www.tampermonkey.net/documentation.php?q=api:GM_getTab)
## GM_setClipboard(data, info, cb)
`GM_setClipboard` sets the text of the clipboard to a specified value.
The function takes a parameter _"data"_ , which is the string to set as the clipboard text, a parameter _"info"_ and an optional callback function _"cb"_.
_"info_ " can be just a string expressing the type `text` or `html` or an object like _"cb"_ is an optional callback function that is called when the clipboard has been set.

```
{
    type: 'text',
    mimetype: 'text/plain'
}

```

```
GM_setClipboard("This is the clipboard text.", "text", () => console.log("Clipboard set!"));
await GM.setClipboard("This is the newer clipboard text.", "text");
console.log('Clipboard set again!');

```

4/27/2026, 8:07:16 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=GM_tabs

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_setClipboard) [](https://www.tampermonkey.net/documentation.php?q=api:GM_setValue)
## GM_getTab(callback)
The GM_getTab function takes a single parameter, a callback function that will be called with an object that is persistent as long as this tab is open.

```
GM_getTab((tab) => console.log(tab));
const t = await GM.getTab();
console.log(t);

```

## GM_saveTab(tab, cb)
The `GM_saveTab` function allows a userscript to save information about a tab for later use.
The function takes a _"tab_ " parameter, which is an object containing the information to be saved about the tab and an optional callback function _"cb"_.
The `GM_saveTab` function saves the provided tab information, so that it can be retrieved later using the `GM_getTab` function.
Here is an example of how the GM_saveTab function might be used in a userscript:

```
GM_getTab(function(tab) {
    tab.newInfo = "new!";
    GM_saveTab(tab);
});
const tab = await GM.getTab();
await GM.saveTab(tab);

```

In this example, the `GM_saveTab` function is called with the tab object returned by the `GM_getTab` function, and a new key called "newInfo".
## GM_getTabs(callback)
The `GM_getTabs` function takes a single parameter: a callback function that will be called with the information about the tabs.
The _"tabs"_ object that is passed to the callback function contains objects, with each object representing the saved tab information stored by `GM_saveTab`.

```
GM_getTabs((tabs) => {
    for (const [tabId, tab] of Object.entries(tabs)) {
        console.log(`tab ${tabId}`, tab);
    }
});
const tabs = await GM.getTabs();

```

4/27/2026, 8:07:26 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=GM_values

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_getTabs) [](https://www.tampermonkey.net/documentation.php?q=api:GM_xmlhttpRequest)
## GM_setValue(key, value)
The `GM_setValue` allows a userscript to set the value of a specific key in the userscript's storage.
The `GM_setValue` function takes two parameters:
  * A string specifying the key for which the value should be set.
  * The value to be set for the key. Values (including nested object properties) can be `null` or of type "object", "string", "number", "undefined" or "boolean".

The `GM_setValue` function does not return any value. Instead, it sets the provided value for the specified key in the userscript's storage.
Here is an example of how `GM_setValue` and its async pendant `GM.setValue` might be used in a userscript:

```
GM_setValue("someKey", "someData");
await GM.setValue("otherKey", "otherData");

```

## GM_getValue(key, defaultValue)
The `GM_getValue` function allows a userscript to retrieve the value of a specific key in the userscript's storage. It takes two parameters:
  * A string specifying the key for which the value should be retrieved.
  * A default value to be returned if the key does not exist in the userscript's storage. This default value can be of any type (string, number, object, etc.).

The `GM_getValue` function returns the value of the specified key from the userscript's storage, or the default value if the key does not exist.
Here is an example of how the `GM_getValue` function might be used in a userscript:

```
const someKey = GM_getValue("someKey", null);
const otherKey = await GM.getValue("otherKey", null);

```

In this example, the `GM_getValue` function is called with the key "someKey" and a default value of null. If the "someKey" key exists in the userscript's storage, its value will be returned and stored in the someKey variable. If the key does not exist, the default value of null will be returned and stored in the savedTab variable.
## GM_deleteValue(key)
Deletes _"key"_ from the userscript's storage.

```
GM_deleteValue("someKey");
await GM.deleteValue("otherKey");

```

## GM_listValues()
The `GM_listValues` function returns a list of keys of all stored data.

```
const keys = GM_listValues();
const asyncKeys = await GM.listValues();

```

## GM_setValues(values) v5.3+
The `GM_setValues` function allows a userscript to set multiple key-value pairs in the userscript's storage simultaneously.
The `GM_setValues` function takes one parameter:
  * An object where each key-value pair corresponds to a key and the value to be set for that key. Values (including nested object properties) can be `null` or of type "object", "string", "number", "undefined" or "boolean".

The `GM_setValues` function does not return any value. Instead, it sets the provided values for the specified keys in the userscript's storage.
Here is an example of how `GM_setValues` and its async counterpart `GM.setValues` might be used in a userscript:

```
GM_setValues({ foo: 1, bar: 2 });
await GM.setValues({ foo: 1, bar: 2 });

```

## GM_getValues(keysOrDefaults) v5.3+
The `GM_getValues` function allows a userscript to retrieve the values of multiple keys in the userscript's storage. It can also provide default values if the keys do not exist.
The `GM_getValues` function takes one parameter:
  * Either an array of strings specifying the keys for which the values should be retrieved, or an object specifying the default values to be returned if the keys do not exist. This default values object can contain keys of any type (string, number, object, etc.).

The `GM_getValues` function returns an object containing the values of the specified keys from the userscript's storage, or the default values if the keys do not exist.
Here is an example of how the `GM_getValues` function might be used in a userscript:

```
const values = GM_getValues(['foo', 'bar']);
const asyncValues = await GM.getValues(['foo', 'bar']);

const defaultValues = GM_getValues({ foo: 1, bar: 2, baz: 3 });
const asyncDefaultValues = await GM.getValues({ foo: 1, bar: 2, baz: 3 });

```

In this example, the `GM_getValues` function is called with an array of keys or an object of default values. It returns an object with the values of the specified keys or the default values if the keys do not exist.
## GM_deleteValues(keys) v5.3+
The `GM_deleteValues` function allows a userscript to delete multiple keys from the userscript's storage simultaneously.
The `GM_deleteValues` function takes one parameter:
  * An array of strings specifying the keys to be deleted from the userscript's storage.

The `GM_deleteValues` function does not return any value. Instead, it deletes the specified keys from the userscript's storage.
Here is an example of how `GM_deleteValues` and its async counterpart GM.deleteValues might be used in a userscript:

```
GM_deleteValues(['foo', 'bar']);
await GM.deleteValues(['foo', 'bar']);

```

## GM_addValueChangeListener(key, (key, old_value, new_value, remote) => void)
The `GM_addValueChangeListener` function allows a userscript to add a listener for changes to the value of a specific key in the userscript's storage.
The function takes two parameters:
  * A string specifying the key for which changes should be monitored.
  * A callback function that will be called when the value of the key changes. The callback function should have the following signature:
```
  function(key, oldValue, newValue, remote) {
      // key is the key whose value has changed
      // oldValue is the previous value of the key
      // newValue is the new value of the key
      // remote is a boolean indicating whether the change originated from a different userscript instance
  }

```

The `GM_addValueChangeListener` function returns a _"listenerId"_ value that can be used to remove the listener later using the `GM_removeValueChangeListener` function. The very same applies to `GM.addValueChangeListener` and `GM.removeValueChangeListener` with the only difference that both return a promise;
Here is an example of how the `GM_addValueChangeListener` function might be used in a userscript:

```
// Add a listener for changes to the "savedTab" key
var listenerId = GM_addValueChangeListener("savedTab", function(key, oldValue, newValue, remote) {
  // Print a message to the console when the value of the "savedTab" key changes
  console.log("The value of the '" + key + "' key has changed from '" + oldValue + "' to '" + newValue + "'");
});

```

`GM_addValueChangeListener` can be used by userscripts to communicate with other userscript instances at other tabs.
## GM_removeValueChangeListener(listenerId)
`GM_removeValueChangeListener` and `GM.removeValueChangeListener` both get one argument called _"listenerId"_ and remove the change listener with this ID.
4/27/2026, 8:07:39 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=GM_webRequest

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_xmlhttpRequest) [](https://www.tampermonkey.net/documentation.php?q=api:GM_cookie.list)
## GM_webRequest(rules, listener)
Note: this API is experimental and might change at any time. It is also not available anymore at Manifest v3 versions of Tampermonkey 5.2+ (Chrome and derivates).
`GM_webRequest` (re-)registers rules for web request manipulations and the listener of triggered rules. If you need to just register rules it's better to use `@webRequest` header. Note, webRequest proceeds only requests with types `sub_frame`, `script`, `xhr` and `websocket`.
### Parameters:
  * **rules** - _object[]_ , array of rules with following properties:
    * **selector** - _string|object_ , for which URLs the rule should be triggered, string value is shortening for `{ include: [selector] }`, object properties:
      * **include** - _string|string[]_ , URLs, patterns, and regexpes for rule triggering;
      * **match** - _string|string[]_ , URLs and patterns for rule trigering;
      * **exclude** - _string|string[]_ , URLs, patterns, and regexpes for not triggering the rule;
    * **action** - _string|object_ , what to do with the request, string value `"cancel"` is shortening for `{ cancel: true }`, object properties:
      * **cancel** - _boolean_ , whether to cancel the request;
      * **redirect** - _string|object_ , redirect to some URL which must be included in any @match or @include header. When a string, redirects to the static URL. If object:
        * **from** - _string_ , a regexp to extract some parts of the URL, e.g. `"([^:]+)://match.me/(.*)"`;
        * **to** - _string_ , pattern for substitution, e.g. `"$1://redirected.to/$2"`;
  * **listener** - _function_ , is called when the rule is triggered, cannot impact on the rule action, arguments:
    * **info** - _string_ , type of action: `"cancel"`, `"redirect"`;
    * **message** - _string_ , `"ok"` or `"error"`;
    * **details** - _object_ , info about the request and rule:
      * **rule** - _object_ , the triggered rule;
      * **url** - _string_ , URL of the request;
      * **redirect_url** - _string_ , where the request was redirected;
      * **description** - _string_ , error description.

### Example

```
GM_webRequest([
    { selector: '*cancel.me/*', action: 'cancel' },
    { selector: { include: '*', exclude: 'http://exclude.me/*' }, action: { redirect: 'http://new_static.url' } },
    { selector: { match: '*://match.me/*' }, action: { redirect: { from: '([^:]+)://match.me/(.*)',  to: '$1://redirected.to/$2' } } }
], function(info, message, details) {
    console.log(info, message, details);
});

```

4/27/2026, 8:07:49 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=GM_xmlhttpRequest

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_removeValueChangeListener) [](https://www.tampermonkey.net/documentation.php?q=api:GM_webRequest)
## GM_xmlhttpRequest(details)
The `GM_xmlhttpRequest` allows a userscripts to send an HTTP request and handle the response. The function takes a single parameter: an object containing the details of the request to be sent and the callback functions to be called when the response is received.
The object can have the following properties:
  * **method** - _string_ , usually one of GET, HEAD, POST, PUT, DELETE, ...
  * **url** - _string|URL|File|Blob_ , the destination URL or a `Blob` or `File` objectv5.4.6226+
  * **headers** e.g. `user-agent`, `referer`, ... (some special headers are not supported by Safari and Android browsers)
  * **data** - _string|Blob|File|Object|Array|FormData|URLSearchParams?_ , some data to send via a POST request
  * **redirect** one of `follow`, `error` or `manual`; controls what to happen when a redirect is detected (build 6180+, enforces `fetch` mode)
  * **cookie** a cookie to be patched into the sent cookie set
  * **cookiePartition** v5.2+ _object_?, containing the partition key to be used for sent and received [partitioned cookies](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/cookies#storage_partitioning)
    * **topLevelSite** _string_?, representing the top frame site for partitioned cookies
  * **binary** send the data string in binary mode
  * **nocache** don't cache the resource
  * **revalidate** revalidate maybe cached content
  * **timeout** a timeout in ms
  * **context** a property which will be added to the response object
  * **responseType** one of `arraybuffer`, `blob`, `json` or `stream`
  * **overrideMimeType** a MIME type for the request
  * **anonymous** don't send cookies with the request (enforces `fetch` mode)
  * **fetch** use a `fetch` instead of a `XMLHttpRequest` request (at Chrome this causes `details.timeout` and `xhr.onprogress` to not work and makes `xhr.onreadystatechange` receive only `readyState` `DONE` (==4) events)
  * **proxy** v5.5.6233+ | Firefox only Proxy configuration
    * **type** _string_ , 'direct' | 'http' | 'https' | 'socks' | 'socks4', the kind of proxy to use
    * **host** _string_ , hostname of the proxy server
    * **port** _number_ , port number of the proxy server
    * **username** _string_?, username for SOCKS proxies
    * **password** _string_?, password for SOCKS proxies
    * **proxyDNS** _boolean_?, use the proxy for DNS resolution (only for “socks”/“socks4”)
    * **failoverTimeout** _number_?, fail‑over timeout in seconds
    * **proxyAuthorizationHeader** _string_?, value sent as Proxy-Authorization for HTTP/HTTPS proxies
    * **connectionIsolationKey** _string_?, additional key for connection isolation
  * **user** _string_?, a user name for authentication
  * **password** _string_?, a password
  * **onabort** callback to be executed if the request was aborted
  * **onerror** callback to be executed if the request ended up with an error
  * **onloadstart** callback to be executed on load start, provides access to the stream object if responseType is set to `stream`
  * **onprogress** callback to be executed if the request made some progress
  * **onreadystatechange** callback to be executed if the request's `readyState` changed
  * **ontimeout** callback to be executed if the request failed due to a timeout
  * **onload** callback to be executed if the request was loaded.
```
  function(response) {
    // response is an object containing the details of the response
  }

```
**response** has the following attributes:
    * **finalUrl** - the final URL after all redirects from where the data was loaded
    * **readyState** - the request's `readyState`
    * **status** - the request's status
    * **statusText** - the request's status text
    * **responseHeaders** - the request's response headers
    * **response** - the response data as object if `details.responseType` was set
    * **responseXML** - the response data as XML document
    * **responseText** - the response data as plain string

`GM_xmlhttpRequest` returns an object with the following property:
  * **abort** - function to be called to cancel this request

`GM.xmlHttpRequest` returns a promise that resolves to the response and also has an `abort` function.
Here is an example of how the `GM_xmlhttpRequest` function might be used in a userscript:

```
GM_xmlhttpRequest({
  method: "GET",
  url: "https://example.com/",
  headers: {
    "Content-Type": "application/json"
  },
  onload: function(response) {
    console.log(response.responseText);
  }
});

const r = await GM.xmlHttpRequest({ url: "https://example.com/" }).catch(e => console.error(e));
console.log(r.responseText);

```

**Note:** the `synchronous` flag at `details` is not supported
**Important:** :
  * If you want to use this method then please also check the documentation about [`@connect`](https://www.tampermonkey.net/documentation.php?q=meta:connect)
  * The promise-based version of this function is called `GM.xmlHttpRequest` (with a uppercase "h" in "http")

4/27/2026, 8:07:53 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=grant

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:icon64) [](https://www.tampermonkey.net/documentation.php?q=meta:author)
## @grant
`@grant` is used to whitelist `GM_*` and `GM.*` functions, the `unsafeWindow` object and some powerful `window` functions.

```
// @grant GM_setValue
// @grant GM_getValue
// @grant GM.setValue
// @grant GM.getValue
// @grant GM_setClipboard
// @grant unsafeWindow
// @grant window.close
// @grant window.focus
// @grant window.onurlchange

```

Since closing and focusing tabs is a powerful feature this needs to be added to the `@grant` statements as well. In case `@grant` is followed by `none` the sandbox is disabled. In this mode no `GM_*` function but the `GM_info` property will be available.

```
// @grant none

```

If no `@grant` tag is given an empty list is assumed. However this different from using `none`.
4/27/2026, 8:13:06 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=homepage

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:author) [](https://www.tampermonkey.net/documentation.php?q=meta:antifeature)
## @homepage, @homepageURL, @website, @source
The authors homepage that is used at the options page to link from the scripts name to the given page. Please note that if the `@namespace` tag starts with `http://` its content will be used for this too.
4/27/2026, 8:13:19 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=icon

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:description) [](https://www.tampermonkey.net/documentation.php?q=meta:grant)
## @icon, @iconURL, @defaulticon
The script icon in low res.
## @icon64, @icon64URL
This scripts icon in 64x64 pixels. If this tag, but `@icon` is given the `@icon` image will be scaled at some places at the options page.
4/27/2026, 8:13:32 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=include

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:resource) [](https://www.tampermonkey.net/documentation.php?q=meta:run_at)
## @include
The pages on that a script should run. Multiple tag instances are allowed. @include doesn't support the URL hash parameter. You have to match the path without the hash parameter and make use of [window.onurlchange](https://www.tampermonkey.net/documentation.php?q=api:window.onurlchange)

```
// @include http://www.tampermonkey.net/*
// @include http://*
// @include https://*
// @include /^https:\/\/www\.tampermonkey\.net\/.*$/
// @include *

```

Note: When writing something like `*://tmnk.net/*` many script developers expect the script to run at `tmnk.net` only, but this is not the case. It also runs at `https://example.com/?http://tmnk.net/` as well.
Therefore Tampermonkey interprets `@includes` that contain a `://` a little bit like `@match`. Every `*` before `://` only matches everything except `:` characters to makes sure only the URL scheme is matched. Also, if such an `@include` contains a `/` after `://`, then everything between those strings is treat as host, matching everything except `/` characters. The same applies to `*` directly following `://`.
## @match
In Tampermonkey, the `@match` directive is used to specify the web pages that your script should run on. The value of `@match` should be a URL pattern that matches the pages you want your script to run on. Here are the parts of the URL pattern that you'll need to set:

```
// @match <protocol>://<domain><path>

```

  * **protocol** - This is the first part of the URL, before the colon. It specifies the protocol that the page uses, such as `http` or `https`. `*` matches both.
  * **domain** - This is the second part of the URL, after the protocol and two slashes. It specifies the domain name of the website, such as `tmnk.com`. You can use the wildcard character this way `*.tmnk.net` to match `tmnk.net` and any sub-domain of it like `www.tmnk.net`.
  * **path** - This is the part of the URL that comes after the domain name, and may include additional subdirectories or filenames. You can use the wildcard character `*` to match any part of the path.

Please check [this documentation](https://developer.chrome.com/docs/extensions/mv2/match_patterns/) to get more information about match pattern. Note: the `<all_urls>` statement is not yet supported and the scheme part also accepts `http*://`.
Multiple tag instances are allowed.
More examples:

```
// @match *://*/*
// @match https://*/*
// @match http://*/foo*
// @match https://*.tampermonkey.net/foo*bar

```

## @exclude
Exclude URLs even it they are included by `@include` or `@match`.
Multiple tag instances are allowed.
4/27/2026, 8:13:37 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Aantifeature

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:homepage) [](https://www.tampermonkey.net/documentation.php?q=meta:require)
## @antifeature
This tag allows script developers to disclose whether they monetize their scripts. It is for example required by [GreasyFork](https://greasyfork.org).
Syntax: <tag> <type> <description>
_< type>_ can have the following values:
  * ads
  * tracking
  * miner

```
// @antifeature       ads         We show you ads
// @antifeature:fr    ads         Nous vous montrons des publicités
// @antifeature       tracking    We have some sort of analytics included
// @antifeature       miner       We use your computer's resources to mine a crypto currency

```

Internationalization is done by adding an appendix naming the locale.
4/27/2026, 8:07:58 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Aauthor

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:grant) [](https://www.tampermonkey.net/documentation.php?q=meta:homepage)
## @author
The scripts author.
4/27/2026, 8:11:51 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Aconnect

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:tag) [](https://www.tampermonkey.net/documentation.php?q=meta:noframes)
## @connect
This tag defines the domains (no top-level domains) including subdomains which are allowed to be retrieved by [GM_xmlhttpRequest](https://www.tampermonkey.net/documentation.php?q=api:GM_xmlhttpRequest)

```
// @connect <value>

```

`<value>` can be:
  * a domain name like `example.com` (this will also allow all subdomains).
  * a subdomain name like `subdomain.example.com`.
  * `self` to whitelist the domain the script is currently running at.
  * `localhost` to access the localhost.
  * an IP address like `1.2.3.4`.
  * `*`.

If it's not possible to declare _all_ domains a userscript might connect to then it's a good practice to do the following:
  1. Declare _all known_ or at least _all common_ domains that might be connected by the script to avoid the confirmation dialog for most users.
  2. Additionally add `@connect *` to the script to allow Tampermonkey to offer an "Always allow all domains" button.

Users can also whitelist all requests by adding `*` to the user domain whitelist at the script settings tab.
Notes:
  * Both, the initial **and** the final URL will be checked!
  * For backward compatibility to Scriptish [`@domain`](https://github.com/scriptish/scriptish/wiki/Manual%3A-Metadata-Block#user-content-domain-new-in-scriptish) tags are interpreted as well.
  * Multiple tag instances are allowed.

More examples:

```
// @connect tmnk.net
// @connect www.tampermonkey.net
// @connect self
// @connect localhost
// @connect 8.8.8.8
// @connect *

```

4/27/2026, 8:12:04 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Acopyright

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:version)
## @name
The name of the script.
Internationalization is done by adding an appendix naming the locale.

```
// @name    A test
// @name:de Ein Test

```

## @namespace
The namespace of the script.
## @copyright
A copyright statement shown at the header of the script's editor right below the script name.
4/27/2026, 8:14:26 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Adescription

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:version) [](https://www.tampermonkey.net/documentation.php?q=meta:icon)
## @description
A short significant description.
Internationalization is done by adding an appendix naming the locale.

```
// @description    This userscript does wonderful things
// @description:de Dieses Userscript tut wundervolle Dinge

```

4/27/2026, 8:12:40 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Aexclude

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:resource) [](https://www.tampermonkey.net/documentation.php?q=meta:run_at)
## @include
The pages on that a script should run. Multiple tag instances are allowed. @include doesn't support the URL hash parameter. You have to match the path without the hash parameter and make use of [window.onurlchange](https://www.tampermonkey.net/documentation.php?q=api:window.onurlchange)

```
// @include http://www.tampermonkey.net/*
// @include http://*
// @include https://*
// @include /^https:\/\/www\.tampermonkey\.net\/.*$/
// @include *

```

Note: When writing something like `*://tmnk.net/*` many script developers expect the script to run at `tmnk.net` only, but this is not the case. It also runs at `https://example.com/?http://tmnk.net/` as well.
Therefore Tampermonkey interprets `@includes` that contain a `://` a little bit like `@match`. Every `*` before `://` only matches everything except `:` characters to makes sure only the URL scheme is matched. Also, if such an `@include` contains a `/` after `://`, then everything between those strings is treat as host, matching everything except `/` characters. The same applies to `*` directly following `://`.
## @match
In Tampermonkey, the `@match` directive is used to specify the web pages that your script should run on. The value of `@match` should be a URL pattern that matches the pages you want your script to run on. Here are the parts of the URL pattern that you'll need to set:

```
// @match <protocol>://<domain><path>

```

  * **protocol** - This is the first part of the URL, before the colon. It specifies the protocol that the page uses, such as `http` or `https`. `*` matches both.
  * **domain** - This is the second part of the URL, after the protocol and two slashes. It specifies the domain name of the website, such as `tmnk.com`. You can use the wildcard character this way `*.tmnk.net` to match `tmnk.net` and any sub-domain of it like `www.tmnk.net`.
  * **path** - This is the part of the URL that comes after the domain name, and may include additional subdirectories or filenames. You can use the wildcard character `*` to match any part of the path.

Please check [this documentation](https://developer.chrome.com/docs/extensions/mv2/match_patterns/) to get more information about match pattern. Note: the `<all_urls>` statement is not yet supported and the scheme part also accepts `http*://`.
Multiple tag instances are allowed.
More examples:

```
// @match *://*/*
// @match https://*/*
// @match http://*/foo*
// @match https://*.tampermonkey.net/foo*bar

```

## @exclude
Exclude URLs even it they are included by `@include` or `@match`.
Multiple tag instances are allowed.
4/27/2026, 8:13:37 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3AGM_xmlhttpRequest

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
# Cette page n'existe pas
4/27/2026, 8:13:50 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Agrant

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:icon64) [](https://www.tampermonkey.net/documentation.php?q=meta:author)
## @grant
`@grant` is used to whitelist `GM_*` and `GM.*` functions, the `unsafeWindow` object and some powerful `window` functions.

```
// @grant GM_setValue
// @grant GM_getValue
// @grant GM.setValue
// @grant GM.getValue
// @grant GM_setClipboard
// @grant unsafeWindow
// @grant window.close
// @grant window.focus
// @grant window.onurlchange

```

Since closing and focusing tabs is a powerful feature this needs to be added to the `@grant` statements as well. In case `@grant` is followed by `none` the sandbox is disabled. In this mode no `GM_*` function but the `GM_info` property will be available.

```
// @grant none

```

If no `@grant` tag is given an empty list is assumed. However this different from using `none`.
4/27/2026, 8:13:06 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Ahomepage

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:author) [](https://www.tampermonkey.net/documentation.php?q=meta:antifeature)
## @homepage, @homepageURL, @website, @source
The authors homepage that is used at the options page to link from the scripts name to the given page. Please note that if the `@namespace` tag starts with `http://` its content will be used for this too.
4/27/2026, 8:13:19 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Aicon

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:description) [](https://www.tampermonkey.net/documentation.php?q=meta:grant)
## @icon, @iconURL, @defaulticon
The script icon in low res.
## @icon64, @icon64URL
This scripts icon in 64x64 pixels. If this tag, but `@icon` is given the `@icon` image will be scaled at some places at the options page.
4/27/2026, 8:13:32 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Aicon64

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:description) [](https://www.tampermonkey.net/documentation.php?q=meta:grant)
## @icon, @iconURL, @defaulticon
The script icon in low res.
## @icon64, @icon64URL
This scripts icon in 64x64 pixels. If this tag, but `@icon` is given the `@icon` image will be scaled at some places at the options page.
4/27/2026, 8:13:32 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Ainclude

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:resource) [](https://www.tampermonkey.net/documentation.php?q=meta:run_at)
## @include
The pages on that a script should run. Multiple tag instances are allowed. @include doesn't support the URL hash parameter. You have to match the path without the hash parameter and make use of [window.onurlchange](https://www.tampermonkey.net/documentation.php?q=api:window.onurlchange)

```
// @include http://www.tampermonkey.net/*
// @include http://*
// @include https://*
// @include /^https:\/\/www\.tampermonkey\.net\/.*$/
// @include *

```

Note: When writing something like `*://tmnk.net/*` many script developers expect the script to run at `tmnk.net` only, but this is not the case. It also runs at `https://example.com/?http://tmnk.net/` as well.
Therefore Tampermonkey interprets `@includes` that contain a `://` a little bit like `@match`. Every `*` before `://` only matches everything except `:` characters to makes sure only the URL scheme is matched. Also, if such an `@include` contains a `/` after `://`, then everything between those strings is treat as host, matching everything except `/` characters. The same applies to `*` directly following `://`.
## @match
In Tampermonkey, the `@match` directive is used to specify the web pages that your script should run on. The value of `@match` should be a URL pattern that matches the pages you want your script to run on. Here are the parts of the URL pattern that you'll need to set:

```
// @match <protocol>://<domain><path>

```

  * **protocol** - This is the first part of the URL, before the colon. It specifies the protocol that the page uses, such as `http` or `https`. `*` matches both.
  * **domain** - This is the second part of the URL, after the protocol and two slashes. It specifies the domain name of the website, such as `tmnk.com`. You can use the wildcard character this way `*.tmnk.net` to match `tmnk.net` and any sub-domain of it like `www.tmnk.net`.
  * **path** - This is the part of the URL that comes after the domain name, and may include additional subdirectories or filenames. You can use the wildcard character `*` to match any part of the path.

Please check [this documentation](https://developer.chrome.com/docs/extensions/mv2/match_patterns/) to get more information about match pattern. Note: the `<all_urls>` statement is not yet supported and the scheme part also accepts `http*://`.
Multiple tag instances are allowed.
More examples:

```
// @match *://*/*
// @match https://*/*
// @match http://*/foo*
// @match https://*.tampermonkey.net/foo*bar

```

## @exclude
Exclude URLs even it they are included by `@include` or `@match`.
Multiple tag instances are allowed.
4/27/2026, 8:13:37 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Anoframes

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:connect) [](https://www.tampermonkey.net/documentation.php?q=meta:updateURL)
## @noframes
This tag makes the script running on the main pages, but not at iframes.
4/27/2026, 8:15:55 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Arequire

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:antifeature) [](https://www.tampermonkey.net/documentation.php?q=meta:include)
## @require
Points to a JavaScript file that is loaded and executed before the script itself starts running. Note: the scripts loaded via `@require` and their _"use strict"_ statements might influence the userscript's strict mode!

```
// @require https://code.jquery.com/jquery-2.1.4.min.js
// @require https://code.jquery.com/jquery-2.1.3.min.js#sha256=23456...
// @require https://code.jquery.com/jquery-2.1.2.min.js#md5=34567...,sha256=6789...

```

Please check the [sub-resource integrity](https://www.tampermonkey.net/documentation.php?q=api:Subresource_Integrity) section for more information how to ensure integrity.
Multiple tag instances are allowed.
## @resource
Preloads resources that can by accessed via `GM_getResourceURL` and `GM_getResourceText` by the script.

```
// @resource icon1       http://www.tampermonkey.net/favicon.ico
// @resource icon2       /images/icon.png
// @resource html        http://www.tampermonkey.net/index.html
// @resource xml         http://www.tampermonkey.net/crx/tampermonkey.xml
// @resource SRIsecured1 http://www.tampermonkey.net/favicon.ico#md5=123434...
// @resource SRIsecured2 http://www.tampermonkey.net/favicon.ico#md5=123434...;sha256=234234...

```

Please check the [sub-resource integrity](https://www.tampermonkey.net/documentation.php?q=api:Subresource_Integrity) section for more information how to ensure integrity.
Multiple tag instances are allowed.
4/27/2026, 8:12:54 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Aresource

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:antifeature) [](https://www.tampermonkey.net/documentation.php?q=meta:include)
## @require
Points to a JavaScript file that is loaded and executed before the script itself starts running. Note: the scripts loaded via `@require` and their _"use strict"_ statements might influence the userscript's strict mode!

```
// @require https://code.jquery.com/jquery-2.1.4.min.js
// @require https://code.jquery.com/jquery-2.1.3.min.js#sha256=23456...
// @require https://code.jquery.com/jquery-2.1.2.min.js#md5=34567...,sha256=6789...

```

Please check the [sub-resource integrity](https://www.tampermonkey.net/documentation.php?q=api:Subresource_Integrity) section for more information how to ensure integrity.
Multiple tag instances are allowed.
## @resource
Preloads resources that can by accessed via `GM_getResourceURL` and `GM_getResourceText` by the script.

```
// @resource icon1       http://www.tampermonkey.net/favicon.ico
// @resource icon2       /images/icon.png
// @resource html        http://www.tampermonkey.net/index.html
// @resource xml         http://www.tampermonkey.net/crx/tampermonkey.xml
// @resource SRIsecured1 http://www.tampermonkey.net/favicon.ico#md5=123434...
// @resource SRIsecured2 http://www.tampermonkey.net/favicon.ico#md5=123434...;sha256=234234...

```

Please check the [sub-resource integrity](https://www.tampermonkey.net/documentation.php?q=api:Subresource_Integrity) section for more information how to ensure integrity.
Multiple tag instances are allowed.
4/27/2026, 8:12:54 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Arun_at

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:exclude) [](https://www.tampermonkey.net/documentation.php?q=meta:run_in)
## @run-at
Defines the moment the script is injected. In opposition to other script handlers, `@run-at` defines the first possible moment a script wants to run. This means it may happen, that a script that uses the `@require` tag may be executed after the document is already loaded, cause fetching the required script took that long.
Anyhow, all `DOMNodeInserted`, `DOMContentLoaded` and `load` events fired after the given injection moment are cached and delivered to listeners registered via the sandbox's `window.addEventListener` method.

```
// @run-at document-start

```

The script will be injected as fast as possible.

```
// @run-at document-body

```

The script will be injected if the body element exists.

```
// @run-at document-end

```

The script will be injected when or after the DOMContentLoaded event was dispatched.

```
// @run-at document-idle

```

The script will be injected after the DOMContentLoaded event was dispatched. This is the default value if no `@run-at` tag is given.

```
// @run-at context-menu

```

The script will be injected if it is clicked at the browser context menu.
Note: all `@include` and `@exclude` statements will be ignored if this value is used, but this may change in the future.
4/27/2026, 8:16:29 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Arun_in

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:run_at) [](https://www.tampermonkey.net/documentation.php?q=meta:sandbox)
## @run-in v5.3+
Defines the type of browser context in which the script is injected. This meta key allows you to control whether the script should run in normal browsing tabs, incognito tabs, or both. This provides flexibility in determining the script's behavior based on the privacy context of the browsing session.

```
// @run-in normal-tabs

```

The script will be injected only in normal browsing tabs (non-incognito mode, default container).

```
// @run-in incognito-tabs

```

The script will be injected only in incognito browsing tabs (private mode). In Firefox, this means all tabs that don't use the default cookie store.
Firefox supports containers, which allow you to separate your browsing activities into distinct contexts. You can specify the container ID in the `@run-in` tag to control the script's behavior based on the container context.

```
// @run-in container-id-2
// @run-in container-id-3

```

The script will be injected only in tabs that belong to the specified containers. The container ID can be found by checking `GM_info.container` when the script is running in the desired container context.
If no `@run-in` tag is specified, the script defaults to being injected in all tabs.
4/27/2026, 8:16:33 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Asandbox

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:run_in) [](https://www.tampermonkey.net/documentation.php?q=meta:tag)
## @sandbox 4.18+
`@sandbox` allows Tampermonkey to decide where the userscript is injected:
  * `MAIN_WORLD` - the page
  * `ISOLATED_WORLD` - the extension's content script
  * `USERSCRIPT_WORLD` - a special context created for userscripts

But instead of specifying an environment, the userscript can express what exactly it needs access to. `@sandbox` supports three possible arguments:
  * `raw` "Raw" access means that a script for compatibility reasons always needs to run in page context, the `MAIN_WORLD`. At the moment this mode is the default if `@sandbox` is omitted. If injection into the `MAIN_WORLD` is not possible (e.g. because of a CSP) the userscript will be injected into other (enabled) sandboxes according to the order of this list.
  * `JavaScript` "JavaScript" access mode means that this script needs access to `unsafeWindow`. At Firefox a special context, the `USERSCRIPT_WORLD`, is created which also bypasses existing CSPs. It however, might create new issues since now [`cloneInto` and `exportFunction`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts) are necessary to share objects with the page. `raw` mode is used as fallback at other browsers.
  * `DOM` Use this access mode if the script only needs DOM and no direct `unsafeWindow` access. If [enabled](https://www.tampermonkey.net/faq.php?q=Q404) these scripts are executed inside the extension context, the `ISOLATED_WORLD`, or at any other enabled context otherwise, because they all grant DOM access.

```
// @sandbox JavaScript

```

4/27/2026, 8:16:39 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3AsupportURL

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:noframes) [](https://www.tampermonkey.net/documentation.php?q=meta:webRequest)
## @updateURL
An update URL for the userscript. Note: a `@version` tag is required to make update checks work.
## @downloadURL
Defines the URL where the script will be downloaded from when an update was detected. If the value _none_ is used, then no update check will be done.
## @supportURL
Defines the URL where the user can report issues and get personal support.
4/27/2026, 8:16:49 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Atag

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:sandbox) [](https://www.tampermonkey.net/documentation.php?q=meta:connect)
## @tag
You can add tags to your script which will be visible in the script list if this tag is part of your system's tag list. Tags can be useful to categorize your scripts or to mark them as a certain type. The list of tags can be found at the script's settings page.
Example of a script with tags

```
// ==UserScript==
// @name         My Script
// @tag          productivity
// @tag          other
// ==/UserScript==

```

4/27/2026, 8:17:03 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Aunwrap

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:webRequest) [](https://www.tampermonkey.net/documentation.php?q=api:unsafeWindow)
## @unwrap
Injects the userscript without any wrapper and sandbox into the page, which might be useful for Scriptlets.
4/27/2026, 8:17:07 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3AupdateURL

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:noframes) [](https://www.tampermonkey.net/documentation.php?q=meta:webRequest)
## @updateURL
An update URL for the userscript. Note: a `@version` tag is required to make update checks work.
## @downloadURL
Defines the URL where the script will be downloaded from when an update was detected. If the value _none_ is used, then no update check will be done.
## @supportURL
Defines the URL where the user can report issues and get personal support.
4/27/2026, 8:16:49 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3Aversion

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:copyright) [](https://www.tampermonkey.net/documentation.php?q=meta:description)
## @version
The script version. This is used for the update check and needs to be increased at every update.
In this list the next entry is considered to be a higher version number, eg: `Alpha-v1` < `Alpha-v2` and `16.4` == `16.04`
  * `Alpha-v1`
  * `Alpha-v2`
  * `Alpha-v10`
  * `Beta`
  * `0.5pre3`
  * `0.5prelimiary`
  * `0.6pre4`
  * `0.6pre5`
  * `0.7pre4`
  * `0.7pre10`
  * `1.-1`
  * `1` == `1.` == `1.0` == `1.0.0`
  * `1.1a`
  * `1.1aa`
  * `1.1ab`
  * `1.1b`
  * `1.1c`
  * `1.1.-1`
  * `1.1` == `1.1.0` == `1.1.00`
  * `1.1.1.1.1`
  * `1.1.1.1.2`
  * `1.1.1.1`
  * `1.10.0-alpha`
  * `1.10` == `1.10.0`
  * `1.11.0-0.3.7`
  * `1.11.0-alpha`
  * `1.11.0-alpha.1`
  * `1.11.0-alpha+1`
  * `1.12+1` == `1.12+1.0`
  * `1.12+1.1` == `1.12+1.1.0`
  * `1.12+2`
  * `1.12+2.1`
  * `1.12+3`
  * `1.12+4`
  * `1.12`
  * `2.0`
  * `16.4` == `16.04`
  * `2023-08-17.alpha`
  * `2023-08-17`
  * `2023-08-17_14-04` == `2023-08-17_14-04.0`
  * `2023-08-17+alpha`
  * `2023-09-11_14-0`

4/27/2026, 8:17:19 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=meta%3AwebRequest

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:supportURL) [](https://www.tampermonkey.net/documentation.php?q=meta:unwrap)
## @webRequest
Note: this API is experimental and might change at any time. It is also not available anymore at Manifest v3 versions of Tampermonkey 5.2+ (Chrome and derivates).
`@webRequest` takes a JSON document that matches [`GM_webRequest`](https://www.tampermonkey.net/documentation.php?q=api:GM_webRequest)'s `rule` parameter. It allows the rules to apply even before the userscript is loaded.
4/27/2026, 8:17:33 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=name

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:version)
## @name
The name of the script.
Internationalization is done by adding an appendix naming the locale.

```
// @name    A test
// @name:de Ein Test

```

## @namespace
The namespace of the script.
## @copyright
A copyright statement shown at the header of the script's editor right below the script name.
4/27/2026, 8:14:26 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=noframes

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:connect) [](https://www.tampermonkey.net/documentation.php?q=meta:updateURL)
## @noframes
This tag makes the script running on the main pages, but not at iframes.
4/27/2026, 8:15:55 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=run_at

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:exclude) [](https://www.tampermonkey.net/documentation.php?q=meta:run_in)
## @run-at
Defines the moment the script is injected. In opposition to other script handlers, `@run-at` defines the first possible moment a script wants to run. This means it may happen, that a script that uses the `@require` tag may be executed after the document is already loaded, cause fetching the required script took that long.
Anyhow, all `DOMNodeInserted`, `DOMContentLoaded` and `load` events fired after the given injection moment are cached and delivered to listeners registered via the sandbox's `window.addEventListener` method.

```
// @run-at document-start

```

The script will be injected as fast as possible.

```
// @run-at document-body

```

The script will be injected if the body element exists.

```
// @run-at document-end

```

The script will be injected when or after the DOMContentLoaded event was dispatched.

```
// @run-at document-idle

```

The script will be injected after the DOMContentLoaded event was dispatched. This is the default value if no `@run-at` tag is given.

```
// @run-at context-menu

```

The script will be injected if it is clicked at the browser context menu.
Note: all `@include` and `@exclude` statements will be ignored if this value is used, but this may change in the future.
4/27/2026, 8:16:29 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=run_in

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:run_at) [](https://www.tampermonkey.net/documentation.php?q=meta:sandbox)
## @run-in v5.3+
Defines the type of browser context in which the script is injected. This meta key allows you to control whether the script should run in normal browsing tabs, incognito tabs, or both. This provides flexibility in determining the script's behavior based on the privacy context of the browsing session.

```
// @run-in normal-tabs

```

The script will be injected only in normal browsing tabs (non-incognito mode, default container).

```
// @run-in incognito-tabs

```

The script will be injected only in incognito browsing tabs (private mode). In Firefox, this means all tabs that don't use the default cookie store.
Firefox supports containers, which allow you to separate your browsing activities into distinct contexts. You can specify the container ID in the `@run-in` tag to control the script's behavior based on the container context.

```
// @run-in container-id-2
// @run-in container-id-3

```

The script will be injected only in tabs that belong to the specified containers. The container ID can be found by checking `GM_info.container` when the script is running in the desired container context.
If no `@run-in` tag is specified, the script defaults to being injected in all tabs.
4/27/2026, 8:16:33 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=sandbox

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:run_in) [](https://www.tampermonkey.net/documentation.php?q=meta:tag)
## @sandbox 4.18+
`@sandbox` allows Tampermonkey to decide where the userscript is injected:
  * `MAIN_WORLD` - the page
  * `ISOLATED_WORLD` - the extension's content script
  * `USERSCRIPT_WORLD` - a special context created for userscripts

But instead of specifying an environment, the userscript can express what exactly it needs access to. `@sandbox` supports three possible arguments:
  * `raw` "Raw" access means that a script for compatibility reasons always needs to run in page context, the `MAIN_WORLD`. At the moment this mode is the default if `@sandbox` is omitted. If injection into the `MAIN_WORLD` is not possible (e.g. because of a CSP) the userscript will be injected into other (enabled) sandboxes according to the order of this list.
  * `JavaScript` "JavaScript" access mode means that this script needs access to `unsafeWindow`. At Firefox a special context, the `USERSCRIPT_WORLD`, is created which also bypasses existing CSPs. It however, might create new issues since now [`cloneInto` and `exportFunction`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts) are necessary to share objects with the page. `raw` mode is used as fallback at other browsers.
  * `DOM` Use this access mode if the script only needs DOM and no direct `unsafeWindow` access. If [enabled](https://www.tampermonkey.net/faq.php?q=Q404) these scripts are executed inside the extension context, the `ISOLATED_WORLD`, or at any other enabled context otherwise, because they all grant DOM access.

```
// @sandbox JavaScript

```

4/27/2026, 8:16:39 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=settings%3Acontent_script_api

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:CDATA) [](https://www.tampermonkey.net/documentation.php?q=deployment:overview)
## Content Script API
Script execution is handled by wrapper code that runs or injects the actual userscripts. There are various methods and APIs available for this, and the `Content Script API` setting in Tampermonkey determines how and where the wrapper code is executed.
This setting is available in Firefox and Chrome (Manifest V3) versions of the extension.
The following options are available for the Content Script API setting:
  * **Content Script** : Runs the wrapper code as a [content script or via the content script API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts). This is the default option if not explicitly selected. Userscripts are retrieved via messaging from the background script, _**no** real `document-start` support_.
  * **UserScripts API** : Uses the browser's UserScripts API ([MV3](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts)|[MV2](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts_legacy)) to inject the wrapper code.
    * Chrome: Userscripts are retrieved via messaging from the background script, _**no** real `document-start` support_.
    * Firefox: The userscript is executed instantly -> `document-start` is supported.
  * **UserScripts API Dynamic** : Uses the browser's UserScripts API ([MV3](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts)|[MV2](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts_legacy)) to inject both the wrapper code and the userscript code. The userscript is executed instantly -> `document-start` is supported.

Some known MV3 issues with the Content Script API setting include:
  * **Dynamic Mode Limitations** : In Dynamic Mode, `@include` patterns using regular expressions may cause scripts to be injected into every frame.
  * **External Resource Updates** : Tampermonkey does not automatically update external `@resource`s.

4/27/2026, 8:12:17 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=sri

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:unsafeWindow) [](https://www.tampermonkey.net/documentation.php?q=api:GM_addElement)
## Subresource Integrity
Subresource Integrity (SRI) is a security feature that allows userscript developers to ensure that the external resources (such as JavaScript libraries and CSS files) that they include in their userscript have not been tampered with or modified. This is accomplished by generating a cryptographic hash of the resource and including it in `@require` and `@resource` tags. When the userscript is installed, Tampermonkey will calculate the hash of the resource and compare it to the included hash. If the two hashes do not match, Tampermonkey will refuse to load the resource, preventing attackers from injecting malicious code into your userscript.
The hash component of the URL of `@resource` and `@require` tags is used for this purpose.

```
// @resource SRIsecured1 http://example.com/favicon1.ico#md5=ad34bb...
// @resource SRIsecured2 http://example.com/favicon2.ico#md5=ac3434...,sha256=23fd34...
// @require              https://code.jquery.com/jquery-2.1.1.min.js#md5=45eef...
// @require              https://code.jquery.com/jquery-2.1.2.min.js#md5-ac56d...,sha256-6e789...
// @require              https://code.jquery.com/jquery-3.6.0.min.js#sha256-/xUj+3OJU...ogEvDej/m4=

```

Tampermonkey supports `SHA-256` and `MD5` hashes natively, all other (`SHA-1`, `SHA-384` and `SHA-512`) depend on [window.crypto](https://developer.mozilla.org/en-US/docs/Web/API/Crypto).
In case multiple hashes (separated by comma or semicolon) are given the last currently supported one is used by Tampermonkey. All hashes need to be encoded in either hex or Base64 format.
4/27/2026, 8:18:46 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=tag

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:sandbox) [](https://www.tampermonkey.net/documentation.php?q=meta:connect)
## @tag
You can add tags to your script which will be visible in the script list if this tag is part of your system's tag list. Tags can be useful to categorize your scripts or to mark them as a certain type. The list of tags can be found at the script's settings page.
Example of a script with tags

```
// ==UserScript==
// @name         My Script
// @tag          productivity
// @tag          other
// ==/UserScript==

```

4/27/2026, 8:17:03 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=unsafeWindow

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:unwrap) [](https://www.tampermonkey.net/documentation.php?q=api:Subresource_Integrity)
## unsafeWindow
The `unsafeWindow` object provides access to the `window` object of the page that Tampermonkey is running on, rather than the `window` object of the Tampermonkey extension. This can be useful in some cases, such as when a userscript needs to access a JavaScript library or variable that is defined on the page.
4/27/2026, 8:19:04 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=unwrap

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:webRequest) [](https://www.tampermonkey.net/documentation.php?q=api:unsafeWindow)
## @unwrap
Injects the userscript without any wrapper and sandbox into the page, which might be useful for Scriptlets.
4/27/2026, 8:17:07 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=update_url

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:noframes) [](https://www.tampermonkey.net/documentation.php?q=meta:webRequest)
## @updateURL
An update URL for the userscript. Note: a `@version` tag is required to make update checks work.
## @downloadURL
Defines the URL where the script will be downloaded from when an update was detected. If the value _none_ is used, then no update check will be done.
## @supportURL
Defines the URL where the user can report issues and get personal support.
4/27/2026, 8:16:49 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=version

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:copyright) [](https://www.tampermonkey.net/documentation.php?q=meta:description)
## @version
The script version. This is used for the update check and needs to be increased at every update.
In this list the next entry is considered to be a higher version number, eg: `Alpha-v1` < `Alpha-v2` and `16.4` == `16.04`
  * `Alpha-v1`
  * `Alpha-v2`
  * `Alpha-v10`
  * `Beta`
  * `0.5pre3`
  * `0.5prelimiary`
  * `0.6pre4`
  * `0.6pre5`
  * `0.7pre4`
  * `0.7pre10`
  * `1.-1`
  * `1` == `1.` == `1.0` == `1.0.0`
  * `1.1a`
  * `1.1aa`
  * `1.1ab`
  * `1.1b`
  * `1.1c`
  * `1.1.-1`
  * `1.1` == `1.1.0` == `1.1.00`
  * `1.1.1.1.1`
  * `1.1.1.1.2`
  * `1.1.1.1`
  * `1.10.0-alpha`
  * `1.10` == `1.10.0`
  * `1.11.0-0.3.7`
  * `1.11.0-alpha`
  * `1.11.0-alpha.1`
  * `1.11.0-alpha+1`
  * `1.12+1` == `1.12+1.0`
  * `1.12+1.1` == `1.12+1.1.0`
  * `1.12+2`
  * `1.12+2.1`
  * `1.12+3`
  * `1.12+4`
  * `1.12`
  * `2.0`
  * `16.4` == `16.04`
  * `2023-08-17.alpha`
  * `2023-08-17`
  * `2023-08-17_14-04` == `2023-08-17_14-04.0`
  * `2023-08-17+alpha`
  * `2023-09-11_14-0`

4/27/2026, 8:17:19 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=webRequest

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=meta:supportURL) [](https://www.tampermonkey.net/documentation.php?q=meta:unwrap)
## @webRequest
Note: this API is experimental and might change at any time. It is also not available anymore at Manifest v3 versions of Tampermonkey 5.2+ (Chrome and derivates).
`@webRequest` takes a JSON document that matches [`GM_webRequest`](https://www.tampermonkey.net/documentation.php?q=api:GM_webRequest)'s `rule` parameter. It allows the rules to apply even before the userscript is loaded.
4/27/2026, 8:17:33 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲

---

# Source: https://www.tampermonkey.net/documentation.php?q=window

Tampermonkey® by Jan Biniok
en zh de fr es pt ru it ja
☰
[ Domicile ](https://www.tampermonkey.net/index.php) [ Scripts utilisateur ](https://www.tampermonkey.net/scripts.php) [ Soutien ](https://www.tampermonkey.net/faq.php) [ Changements ](https://www.tampermonkey.net/changelog.php) [ Contribuer ](https://www.tampermonkey.net/contrib.php) [ À propos ](https://www.tampermonkey.net/imprint.php)
☰
[ FAQ ](https://www.tampermonkey.net/faq.php) [ Documentation ](https://www.tampermonkey.net/documentation.php)
[](https://www.tampermonkey.net/documentation.php) [](https://www.tampermonkey.net/documentation.php?q=api:GM_audio.removeStateChangeListener) [](https://www.tampermonkey.net/documentation.php?q=api:CDATA)
## window.onurlchange
If a script runs on a single-page application, then it can use `window.onurlchange` to listen for URL changes:

```
// ==UserScript==
...
// @grant window.onurlchange
// ==/UserScript==

if (window.onurlchange === null) {
    // feature is supported
    window.addEventListener('urlchange', (info) => ...);
}

```

## window.close
Usually JavaScript is not allowed to close tabs via `window.close`. Userscripts, however, can do this if the permission is requested via `@grant`.
Note: for security reasons it is not allowed to close the last tab of a window.

```
// ==UserScript==
...
// @grant window.close
// ==/UserScript==

if (condition) {
    window.close();
}

```

## window.focus
`window.focus` brings the window to the front, while `unsafeWindow.focus` may fail due to user settings.

```
// ==UserScript==
...
// @grant window.focus
// ==/UserScript==

if (condition) {
    window.focus();
}

```

4/27/2026, 8:19:50 PM [Imprimer](https://www.tampermonkey.net/imprint.php) [Politique de confidentialité](https://www.tampermonkey.net/privacy.php) Paramètres des cookies
▲