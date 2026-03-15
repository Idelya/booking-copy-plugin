(function optionsPage() {
  const STORAGE_KEY = "formulaLocale";
  const DEFAULT_VALUE = "auto";

  const formulaLocaleSelect = document.getElementById("formulaLocale");
  const saveButton = document.getElementById("saveButton");
  const status = document.getElementById("status");

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.style.color = isError ? "#b91c1c" : "#0f766e";
  }

  function readStoredValue() {
    chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_VALUE }, (result) => {
      formulaLocaleSelect.value = result[STORAGE_KEY] || DEFAULT_VALUE;
    });
  }

  function saveValue() {
    const value = formulaLocaleSelect.value || DEFAULT_VALUE;
    chrome.storage.sync.set({ [STORAGE_KEY]: value }, () => {
      if (chrome.runtime.lastError) {
        setStatus("Nie udalo sie zapisac ustawienia.", true);
        return;
      }
      setStatus("Zapisano.");
      setTimeout(() => {
        status.textContent = "";
      }, 1500);
    });
  }

  saveButton.addEventListener("click", saveValue);
  readStoredValue();
})();
