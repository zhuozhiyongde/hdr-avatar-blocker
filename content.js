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

let settings = {
  sizeThreshold: 200,
  ignoreList: 'localhost,127.0.0.1,192.168.0.0/16,10.0.0.0/8,*.local',
  blackout: false,
  isIgnored: false,
};

const processedImages = new WeakSet();
let imagesToProcess = [];

function ipToLong(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isUrlIgnored(hostname, ignoreList) {
    if (!ignoreList) return false;
    const ignoredItems = ignoreList.split(',').map(s => s.trim()).filter(Boolean);
    const isHostnameIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
    const hostnameLong = isHostnameIp ? ipToLong(hostname) : 0;

    for (const item of ignoredItems) {
        if (item.includes('/') && isHostnameIp) {
            const [range, bitsStr] = item.split('/');
            const bits = parseInt(bitsStr, 10);
            if (isNaN(bits) || bits < 0 || bits > 32) continue;
            const mask = -1 << (32 - bits);
            const rangeLong = ipToLong(range);
            if ((hostnameLong & mask) === (rangeLong & mask)) return true;
        } else if (item.startsWith('*.')) {
            if (hostname.endsWith(item.substring(1))) return true;
        } else if (hostname === item) {
            return true;
        }
    }
    return false;
}

function applyHdrFilter(img) {
  if (settings.isIgnored) {
    if (img.dataset.hdrBlocked) {
        img.style.filter = '';
        delete img.dataset.hdrBlocked;
    }
    return;
  }

  const shouldFilter = img.clientWidth > 0 && img.clientHeight > 0 && img.clientWidth < settings.sizeThreshold && img.clientHeight < settings.sizeThreshold;

  if (shouldFilter) {
    img.style.filter = settings.blackout ? 'brightness(0)' : 'contrast(100%) saturate(100%)';
    img.dataset.hdrBlocked = 'true';
  } else if (img.dataset.hdrBlocked) {
    img.style.filter = '';
    delete img.dataset.hdrBlocked;
  }
}

const processBatch = debounce(() => {
    const batch = imagesToProcess;
    imagesToProcess = [];

    for (const img of batch) {
        if (processedImages.has(img) || !document.body.contains(img)) continue;

        if (img.complete) {
            applyHdrFilter(img);
        } else {
            img.addEventListener('load', () => applyHdrFilter(img), { once: true });
        }
        processedImages.add(img);
    }
}, 150);

function queueImageForProcessing(img) {
    if (!processedImages.has(img)) {
        imagesToProcess.push(img);
        processBatch();
    }
}

function processAllImagesNow() {
    document.querySelectorAll('img').forEach(img => {
        if (img.dataset.hdrBlocked) {
            img.style.filter = '';
            delete img.dataset.hdrBlocked;
        }
        applyHdrFilter(img);
    });
}

const observer = new MutationObserver((mutations) => {
  if (settings.isIgnored) return;
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'IMG') {
            queueImageForProcessing(node);
        } else if (node.querySelectorAll) {
            node.querySelectorAll('img').forEach(queueImageForProcessing);
        }
      }
    }
  }
});

function loadSettingsAndRun() {
  const defaults = {
    sizeThreshold: 200,
    ignoreList: 'localhost,127.0.0.1,192.168.0.0/16,10.0.0.0/8,*.local',
    blackout: false,
  };

  chrome.storage.sync.get(defaults, (items) => {
    settings.sizeThreshold = parseInt(items.sizeThreshold, 10) || 200;
    settings.ignoreList = items.ignoreList;
    settings.blackout = items.blackout;
    settings.isIgnored = isUrlIgnored(window.location.hostname, settings.ignoreList);
    
    if (!settings.isIgnored) {
        // At document_start, the body may not exist yet. We start observing the root
        // and the observer will catch all images as they are added.
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  });
}

chrome.storage.onChanged.addListener((changes) => {
  let needsReprocessing = false;
  const wasIgnored = settings.isIgnored;

  if (changes.sizeThreshold) {
    settings.sizeThreshold = parseInt(changes.sizeThreshold.newValue, 10) || 200;
    needsReprocessing = true;
  }
  if (changes.blackout) {
    settings.blackout = changes.blackout.newValue;
    needsReprocessing = true;
  }
  if (changes.ignoreList) {
    settings.ignoreList = changes.ignoreList.newValue;
    settings.isIgnored = isUrlIgnored(window.location.hostname, settings.ignoreList);
    needsReprocessing = true; 
  }

  if (wasIgnored && !settings.isIgnored) {
      // If it was ignored, but now it's not, start observing.
      observer.observe(document.documentElement, { childList: true, subtree: true });
  } else if (!wasIgnored && settings.isIgnored) {
      // If it wasn't ignored, but now it is, stop observing and clear all filters.
      observer.disconnect();
  }
  
  if (needsReprocessing) {
    processAllImagesNow();
  }
});

loadSettingsAndRun();
