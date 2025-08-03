// Debounce function to limit the rate at which a function gets called.
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Internationalize the UI
function setLocaleText() {
    const i18nMap = {
        'optionsTitle': 'optionsTitle',
        'sizeThresholdLabel': 'sizeThresholdLabel',
        'blackoutLabel': 'blackoutLabel',
        'blackoutDescription': 'blackoutDescription',
        'footerDescription': 'footerDescription',
        'moreAppsLink': 'moreAppsLink'
    };

    document.title = chrome.i18n.getMessage('optionsTitle');

    for (const id in i18nMap) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = chrome.i18n.getMessage(i18nMap[id]);
        }
    }
}

// Saves options to chrome.storage
function saveOptions() {
  const size = document.getElementById('size').value;
  const blackout = document.getElementById('blackout').checked;

  chrome.storage.sync.set(
    {
      sizeThreshold: size,
      blackout: blackout,
    },
    () => {
      // Update status to let user know options were saved.
      const status = document.getElementById('status');
      status.textContent = chrome.i18n.getMessage('optionsSaved');
      status.style.opacity = 1;
      setTimeout(() => {
        status.style.opacity = 0;
      }, 1500);
    }
  );
}

// Restores options using the preferences stored in chrome.storage.
function restoreOptions() {
  const defaults = {
    sizeThreshold: 200,
    blackout: false,
  };

  chrome.storage.sync.get(defaults, (items) => {
    document.getElementById('size').value = items.sizeThreshold;
    document.getElementById('blackout').checked = items.blackout;
  });
}

document.addEventListener('DOMContentLoaded', () => {
    setLocaleText();
    restoreOptions();

    const debouncedSave = debounce(saveOptions, 500);

    document.getElementById('size').addEventListener('input', debouncedSave);
    document.getElementById('blackout').addEventListener('change', saveOptions);
});