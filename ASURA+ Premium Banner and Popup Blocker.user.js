// ==UserScript==
// @name         ASURA+ Premium Banner and Popup Blocker
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Blocks all ASURA+ Premium banners and popups without affecting the regular UI
// @author       You
// @match        *://*.asuracomic.net/*
// @match        *://*.asura.gg/*
// @match        *://*.asura.com/*
// @match        *://*.asurascans.net/*
// @match        *://*.asuratoon.com/*
// @grant        none
// @icon         https://i.imgur.com/iafOJLx.png
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Debug mode toggle function (accessible in console)
    let debugMode = false;
    window.toggleDebug = function() {
        debugMode = !debugMode;
        console.log(`Premium banner blocker debug mode: ${debugMode ? 'ON' : 'OFF'}`);
    };

    function debugLog(...args) {
        if (debugMode) console.log('[Premium Blocker]', ...args);
    }

    // Create and inject CSS to hide premium elements
    const style = document.createElement('style');
    style.textContent = `
        /* First variant - gradient from previous banner */
        .z-50.overflow-hidden[style*="linear-gradient(125deg, rgb(20, 20, 40) 0%, rgb(30, 30, 58) 50%, rgb(20, 20, 40) 100%)"],

        /* Second variant - the new purple gradient banner */
        div[class*="relative"][class*="bg-gradient-to-b"][class*="from-[#231258]"][class*="to-[#1b0e45]"],
        .relative.bg-gradient-to-b.from-\\[\\#231258\\].to-\\[\\#1b0e45\\],

        /* Generic premium banner indicators */
        div:has(> span.text-\\[\\#FFD700\\]:contains("Premium Offer")),
        div:has(> h2 > span.text-\\[\\#FFD700\\]:contains("ASURA+")),
        div:has(button:has(svg.lucide-crown):contains("Subscribe Now!")),

        /* Another common pattern */
        div:has(> div.flex > svg.lucide-crown + span:contains("Premium Offer")) {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
            position: absolute !important;
            z-index: -9999 !important;
        }
    `;
    document.head.appendChild(style);

    // Advanced detection function for premium banners
    function isPremiumBanner(element) {
        // Avoid checking elements we've already processed
        if (element.dataset.premiumChecked) return false;
        element.dataset.premiumChecked = "true";

        // Skip small elements
        if (element.offsetWidth < 280 || element.offsetHeight < 100) return false;

        // 1. Check for distinctive CSS classes and attributes
        const classStr = element.className || '';
        const styleStr = element.getAttribute('style') || '';

        // Match patterns for first banner variant
        const isFirstVariant = (
            (classStr.includes('z-50') && classStr.includes('overflow-hidden')) &&
            styleStr.includes('linear-gradient(125deg, rgb(20, 20, 40)')
        );

        // Match patterns for second banner variant
        const isSecondVariant = (
            classStr.includes('relative') && (
                classStr.includes('bg-gradient-to-b') ||
                (classStr.includes('from-[#231258]') && classStr.includes('to-[#1b0e45]'))
            )
        );

        if (isFirstVariant || isSecondVariant) {
            debugLog('Found premium banner by CSS pattern', element);
            return true;
        }

        // 2. Check for premium content indicators
        const textContent = element.textContent || '';

        // Key phrases that appear in premium banners
        const premiumPhrases = [
            {text: 'Premium Offer', weight: 3},
            {text: 'ASURA+', weight: 3},
            {text: 'Premium', weight: 1},
            {text: '$19.99', weight: 3},
            {text: '/YEAR', weight: 2},
            {text: 'Subscribe Now', weight: 2},
            {text: '$1.67', weight: 2},
            {text: 'per month', weight: 1},
            {text: 'Ad-free reading', weight: 2},
            {text: 'Early access', weight: 2}
        ];

        let matchScore = 0;
        for (const {text, weight} of premiumPhrases) {
            if (textContent.includes(text)) {
                matchScore += weight;
                debugLog(`Found "${text}" in element, score +${weight}`);
            }
        }

        // 3. Check for premium icons
        const hasCrownIcon = element.querySelector('svg.lucide-crown') !== null;
        const hasStarIcon = element.querySelector('svg.lucide-star') !== null;
        const hasDiamondIcon = element.querySelector('svg.lucide-diamond') !== null;

        if (hasCrownIcon) matchScore += 3;
        if (hasStarIcon) matchScore += 2;
        if (hasDiamondIcon) matchScore += 2;

        // 4. Check for gold/yellow UI elements typical in premium banners
        const hasGoldElements = element.querySelector('[class*="text-[#FFD700]"]') !== null;
        if (hasGoldElements) matchScore += 2;

        // 5. Check for a subscribe button
        const hasSubscribeButton = element.querySelector('button:not([disabled])') !== null &&
                                  textContent.includes('Subscribe Now');
        if (hasSubscribeButton) matchScore += 3;

        // Determine if it's a premium banner based on the score
        const isPremium = matchScore >= 6;
        if (isPremium) {
            debugLog(`Identified premium element with score: ${matchScore}`, element);
        }

        return isPremium;
    }

    // Function to handle removal of premium banners
    function removePremiumBanners() {
        // Common container selectors that might contain premium banners
        const selectors = [
            'div.relative.z-50',
            'div.z-50.overflow-hidden',
            'div.relative.bg-gradient-to-b',
            'div[class*="relative"][class*="bg-gradient"]',
            'div:has(> div > svg.lucide-crown)',
            'div:has(> span:contains("Premium Offer"))',
            'div:has(button:contains("Subscribe Now"))',
            // Specific to the second banner variant
            'div[class*="jsx-"][class*="relative"][class*="bg-gradient-to-b"]'
        ];

        // Keep track of removed elements to avoid duplicates
        const removedElements = new Set();

        try {
            // First try with querySelectorAll
            selectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        if (!removedElements.has(element) && isPremiumBanner(element)) {
                            element.style.display = 'none';
                            element.style.visibility = 'hidden';
                            element.style.height = '0';
                            element.style.overflow = 'hidden';
                            element.style.pointerEvents = 'none';
                            removedElements.add(element);
                            debugLog('Hidden premium banner:', element);
                        }
                    });
                } catch (e) {
                    // Some selectors might not be supported in all browsers
                    debugLog('Error with selector:', selector, e);
                }
            });

            // Fallback approach: check all divs with certain key attributes
            const divs = document.querySelectorAll('div[class*="relative"], div[class*="bg-gradient"], div[class*="z-50"]');
            divs.forEach(div => {
                if (!removedElements.has(div) && isPremiumBanner(div)) {
                    div.style.display = 'none';
                    div.style.visibility = 'hidden';
                    div.style.height = '0';
                    div.style.overflow = 'hidden';
                    div.style.pointerEvents = 'none';
                    removedElements.add(div);
                    debugLog('Hidden premium banner (fallback):', div);
                }
            });

            // Update count if in debug mode
            if (debugMode && removedElements.size > 0) {
                console.log(`[Premium Blocker] Removed ${removedElements.size} premium elements`);
            }
        } catch (e) {
            console.error('[Premium Blocker] Error:', e);
        }
    }

    // Execute on page load
    window.addEventListener('load', () => {
        setTimeout(removePremiumBanners, 500); // Slight delay to ensure DOM is fully loaded
    });

    // Continuous checking with throttling for dynamically loaded content
    let timeout = null;
    const observer = new MutationObserver(() => {
        if (!timeout) {
            timeout = setTimeout(() => {
                removePremiumBanners();
                timeout = null;
            }, 300);
        }
    });

    // Start observing once the DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            removePremiumBanners();
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        });
    } else {
        // Document already loaded
        removePremiumBanners();
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }

    // Add emergency disable function
    window.disablePremiumBlocker = function() {
        observer.disconnect();
        console.log('Premium banner blocker disabled for this session');
    };

    // Immediate execution for early blocking
    if (document.body) {
        removePremiumBanners();
    }
})();