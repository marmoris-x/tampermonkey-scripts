# \# 🤖 marmoris-x Userscript Collection

# 

# This is a private collection of UserScripts, optimized for use with browser extensions like Tampermonkey or Greasemonkey.

# 

# The scripts are designed to enhance usability and extend the functionality of specific websites (YouTube, Kleinanzeigen, Willhaben, etc.).

# 

# ---

# 

# \## 🛠️ Installation

# 

# To use these scripts, you need a UserScript manager extension (e.g., Tampermonkey, Greasemonkey, or Violentmonkey).

# 

# 1\.  \*\*Clone/Download the Repository:\*\* Download this repository or clone it to your computer.

# 2\.  \*\*Install Files in Tampermonkey:\*\*

# &nbsp;   \*   Open your UserScript manager extension's dashboard.

# &nbsp;   \*   Select the option to \*\*import local files\*\* or \*\*create a new script\*\*.

# &nbsp;   \*   Paste the content of the respective `.user.js` file (e.g., `kleinanzeigen\_integration.user.js`) into the editor and save it.

# &nbsp;   \*   \*Tip:\* If you wish to install the scripts directly from GitHub, use the `Raw` link for the specific file.

# 

# ---

# 

# \## 📂 Repository Structure

# 

# The scripts are stored directly in the main directory for easy management:

# 

# ```

# .

# ├── absolute\_enable\_right\_click.user.js

# ├── ai\_manga\_translator.user.js

# ├── asura\_premium\_blocker.user.js

# ├── botghost\_bulk\_extractor.user.js

# ├── crunchyroll\_advanced\_filter.user.js

# ├── dark\_reader\_auto.user.js

# ├── flamecomics\_sort\_enhancement.user.js

# ├── gutefrage\_enhanced\_suite.user.js

# ├── kleinanzeigen\_integration.user.js

# ├── night\_mode.user.js

# ├── notegpt\_ui\_tweaks.user.js

# ├── reddit\_nsfw\_unblur.user.js

# ├── universal\_video\_downloader.user.js

# ├── vidiq\_upsell\_remover.user.js

# ├── willhaben\_integration.user.js

# └── youtube\_ai\_assistant.user.js

# ```

# 

# ---

# 

# \## 📋 Userscript Details

# 

# \### 1. Marketplace Enhancements (Kleinanzeigen \& Willhaben)

# 

# | Script | Description \& Features |

# | :--- | :--- |

# | \*\*Kleinanzeigen - Perfekte Integration\*\* | Enhances search results on `kleinanzeigen.de`. Loads the \*\*full description\*\* and \*\*seller information\*\* (name, ID) directly into preview cards. Adds buttons for manual data integration (with anti-bot delay) and exporting results as plain text. |

# | \*\*Willhaben - Perfekte Integration\*\* | Enhances search results on `willhaben.at`. Loads full ad descriptions, seller details (name, location, ad code), replacing short preview texts. Supports pre-loading all ads via automatic scrolling and offers a structured \*\*Plain Text Export\*\* of all collected data. |

# 

# \### 2. YouTube Tools \& Tweaks

# 

# | Script | Description \& Features |

# | :--- | :--- |

# | \*\*YouTube AI Assistant Pro - Complete Edition\*\* | A comprehensive AI suite for YouTube videos (requires OpenAI/Google API keys). Features include: transcript fetching, chatbot functionality (questions about the video), generation of summaries, key points, Mind Maps (visual/textual), and presentation slides. |

# | \*\*YouTube - Als geschaut markieren\*\* | Adds a menu command in Tampermonkey to open a list of YouTube links in the \*\*background\*\*, increase playback speed to 16x, jump near the end of the video, and automatically close the tab. This efficiently marks videos as "watched" without disrupting the current session. |

# | \*\*YouTube Channel Speed Controller\*\* | Adds a \*\*channel-specific speed menu\*\* to the YouTube video settings. Saves the preferred playback speed for each channel. Automatically applies and corrects the speed if YouTube resets the rate. |

# | \*\*Universal Video Download Button\*\* | Adds a universal download button to all HTML5 video players (supports YouTube, TikTok, Twitch, etc.). Can extract the original file or a filtered URL link and offers fallback methods (including `GM\_download`). |

# | \*\*NoteGPT UI Tweaks\*\* | Improves the NoteGPT user interface on YouTube. Permanently displays the \*\*"Focus" button\*\* and ensures \*\*automatic expansion\*\* of transcript sections. |

# | \*\*VidIQ Upsell Entferner\*\* | Removes all \*\*Premium upsell banners and elements\*\* from the VidIQ extension on YouTube for a distraction-free interface. |

# | \*\*YouTube CPU Tamer by AnimationFrame\*\* | Improves CPU efficiency and reduces browser energy impact during YouTube playback by optimizing browser update rates. |

# | \*\*YouTube: Quick Stop Automatic Video Playback\*\* | Immediately stops automatic video playback on channel pages, watch pages, shorts, and `@` pages to save resources and prevent autoplay. |

# 

# \### 3. Website Optimization \& Filters

# 

# | Script | Description \& Features |

# | :--- | :--- |

# | \*\*Gutefrage Enhanced Suite\*\* | \*\*Combined solution\*\* for enhanced `gutefrage.net` experience. \*\*Filter Module:\*\* Extends the native filter menu with date range filtering, min/max \*\*answer count\*\*, minimum like count, \*\*keyword search\*\* and \*\*exclusion keywords\*\*. \*\*Tag Management Module:\*\* Automatically removes specific unwanted tags, provides a "Remove Tags" button that opens posts in background tabs for tag removal and auto-closes them. Both modules work seamlessly together. |

# | \*\*Crunchyroll Advanced Multi-Filter \& Sort - Optimized\*\* | Adds a floating UI to Crunchyroll Popular Videos/Browse Pages, allowing advanced filters (Min. Rating, Min. Episodes, Min. Reviews) and \*\*multi-level sorting\*\* (by Rating, Episodes, Reviews, or Title). |

# | \*\*FlameComics Sort Enhancement\*\* | Extends the sorting options on FlameComics to include \*\*alphabetical sorting\*\* (A-Z/Z-A) and sorting by the \*\*number of hearts\*\* (popularity). |

# | \*\*Bulk Choice Extractor V4\*\* | Adds a \*\*"Copy Bulk"\*\* button next to the "Clear All Choices" button on the BotGhost dashboard to copy all Label/Value pairs from choice containers into the clipboard in `Label,Value` format. |

# 

# \### 4. System and Security Tools

# 

# | Script | Description \& Features |

# | :--- | :--- |

# | \*\*Absolute Enable Right Click \& Copy (Include System)\*\* | Forces the activation of right-clicks, copy functions, and text selection on websites that block them. \*\*Important:\*\* Uses an \*\*Include System\*\*, meaning it only executes on websites you manually whitelist via the Tampermonkey menu. |

# | \*\*Dark Reader (Auto)\*\* | Ensures the Dark Reader library is activated immediately upon page load. Includes a hotkey (`CTRL + SHIFT + Ü`) to toggle the visibility of the embedded Dark Reader UI. |

# | \*\*Reddit NSFW Content Blocker\*\* | Removes NSFW modal popups and \*\*unblurs\*\* NSFW and spoiler content on Reddit (on both the old and new `sh.reddit.com` domains). Provides a menu to control NSFW/Spoiler unblurring. |

# | \*\*AI Manga Translator\*\* | A tool for translating manga/comics on any website. Uses vision models (OpenAI GPT-4.1-mini or Google Gemini) for OCR and translating speech bubbles. Places translated text in precise, overlap-avoiding bubbles. |

