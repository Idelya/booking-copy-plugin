(function bookingExcelCopyPlugin() {
  const namespace = window.BookingExcelCopy || {};
  const constants = namespace.constants || {};
  const state = namespace.state || {};
  const utils = namespace.utils || {};
  const localization = namespace.localization || {};
  const offer = namespace.offer || {};

  function showToast(message) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.zIndex = "2147483647";
    toast.style.background = "#1a1a1a";
    toast.style.color = "#ffffff";
    toast.style.padding = "10px 14px";
    toast.style.borderRadius = "8px";
    toast.style.fontSize = "13px";
    toast.style.fontFamily = "Arial, sans-serif";
    toast.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 1800);
  }

  async function copyOfferData(showToastMessage = true) {
    const now = Date.now();
    if (now - state.lastCopyAt < constants.COPY_COOLDOWN_MS) {
      return;
    }

    const offerData = offer.collectOfferData();
    if (!offerData.name && !offerData.apartmentLocalization) {
      return;
    }

    const row = offer.toExcelRow(offerData, state.formulaLocalePreference);
    utils.debugLog("Excel row to copy", row);

    try {
      await navigator.clipboard.writeText(row);
      state.lastCopyAt = now;
      if (showToastMessage) {
        showToast("Copied: name(link), lowest total price, beds configuration, apartment type, apartment localization, review score, free cancellation, parking, laundry");
      }
    } catch (error) {
      console.error("Booking Excel Copy: clipboard write failed", error);
      if (showToastMessage) {
        showToast("Copy failed. Click page and try again.");
      }
    }
  }

  function createCopyButton() {
    if (document.getElementById(constants.BUTTON_ID)) {
      return;
    }

    const button = document.createElement("button");
    button.id = constants.BUTTON_ID;
    button.type = "button";
    button.textContent = "Copy for Excel";
    button.style.position = "fixed";
    button.style.bottom = "20px";
    button.style.left = "20px";
    button.style.zIndex = "2147483647";
    button.style.border = "0";
    button.style.borderRadius = "999px";
    button.style.padding = "10px 14px";
    button.style.fontSize = "13px";
    button.style.fontFamily = "Arial, sans-serif";
    button.style.fontWeight = "600";
    button.style.cursor = "pointer";
    button.style.background = "#0071c2";
    button.style.color = "#ffffff";
    button.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";

    button.addEventListener("click", () => {
      copyOfferData(true);
    });

    document.body.appendChild(button);
  }

  function start() {
    if (!localization.isOfferPage()) {
      return;
    }
    createCopyButton();
    copyOfferData(false);
  }

  function loadFormulaPreference() {
    if (!chrome.storage || !chrome.storage.sync) {
      return;
    }
    chrome.storage.sync.get({ [constants.STORAGE_KEY]: "auto" }, (result) => {
      const value = result[constants.STORAGE_KEY];
      if (value === "pl" || value === "en" || value === "auto") {
        state.formulaLocalePreference = value;
      }
    });
  }

  function watchFormulaPreferenceChanges() {
    if (!chrome.storage || !chrome.storage.onChanged) {
      return;
    }
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync" || !changes[constants.STORAGE_KEY]) {
        return;
      }
      const nextValue = changes[constants.STORAGE_KEY].newValue;
      if (nextValue === "pl" || nextValue === "en" || nextValue === "auto") {
        state.formulaLocalePreference = nextValue;
      }
    });
  }

  loadFormulaPreference();
  watchFormulaPreferenceChanges();
//   window.addEventListener("load", start);
  // Some Booking pages are rendered dynamically; retry once after initial paint.
  setTimeout(start, 5000);
})();
