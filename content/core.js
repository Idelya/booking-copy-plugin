(function initBookingExcelCopyCore() {
  const namespace = window.BookingExcelCopy || {};

  namespace.constants = {
    COPY_COOLDOWN_MS: 2500,
    BUTTON_ID: "booking-excel-copy-button",
    STORAGE_KEY: "formulaLocale",
    DEBUG_STORAGE_KEY: "bookingCopyDebug",
    DEBUG_GLOBAL_KEY: "BOOKING_COPY_DEBUG"
  };

  namespace.state = namespace.state || {
    lastCopyAt: 0,
    formulaLocalePreference: "auto"
  };

  const constants = namespace.constants;

  function isDebugEnabled() {
    try {
      if (window[constants.DEBUG_GLOBAL_KEY] === true) {
        return true;
      }
      return window.localStorage && window.localStorage.getItem(constants.DEBUG_STORAGE_KEY) === "1";
    } catch (_error) {
      return false;
    }
  }

  function debugLog(message, payload) {
    if (!isDebugEnabled()) {
      return;
    }
    if (typeof payload === "undefined") {
      console.log("[BookingCopyDebug]", message);
      return;
    }
    console.log("[BookingCopyDebug]", message, payload);
  }

  function getText(selectors) {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node && node.textContent) {
        const text = node.textContent.replace(/\s+/g, " ").trim();
        if (text) {
          return text;
        }
      }
    }
    return "";
  }

  function parsePositiveInt(value) {
    if (value == null) {
      return 0;
    }
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function extractFirstPositiveInt(text) {
    if (!text) {
      return 0;
    }
    let current = "";
    for (const ch of String(text)) {
      if (ch >= "0" && ch <= "9") {
        current += ch;
        continue;
      }
      if (current) {
        return parsePositiveInt(current);
      }
    }
    return current ? parsePositiveInt(current) : 0;
  }

  function resolveFormulaLanguage(preference) {
    if (preference === "pl" || preference === "en") {
      return preference;
    }
    const locale = (navigator.language || "").toLowerCase();
    return locale.startsWith("pl") ? "pl" : "en";
  }

  namespace.utils = Object.assign({}, namespace.utils, {
    isDebugEnabled,
    debugLog,
    getText,
    parsePositiveInt,
    extractFirstPositiveInt,
    resolveFormulaLanguage
  });

  window.BookingExcelCopy = namespace;
})();
