'use strict';

// --- Settings ---
let settings = {
  sizeThreshold: 200,
  blackout: false,
};

// --- Core Logic ---

/**
 * Applies the visual filter to an image based on current settings.
 * @param {HTMLImageElement} img The image element to process.
 */
function applyHdrFilter(img) {
  const shouldFilter = img.clientWidth > 0 && img.clientHeight > 0 && img.clientWidth < settings.sizeThreshold && img.clientHeight < settings.sizeThreshold;

  if (shouldFilter) {
    img.style.filter = settings.blackout ? 'brightness(0)' : 'contrast(100%) saturate(100%)';
    img.dataset.hdrBlocked = 'true';
  } else if (img.dataset.hdrBlocked) {
    // Only remove the filter if we previously added it.
    img.style.filter = '';
    delete img.dataset.hdrBlocked;
  }
}

/**
 * A queue for images that need processing. This avoids redundant processing.
 * @type {WeakSet<HTMLImageElement>}
 */
const processedImages = new WeakSet();
let imagesToProcess = [];

/**
 * Debounced function to process a batch of images found in the DOM.
 * This is the core of the performance optimization.
 */
const processBatch = debounce(() => {
    const batch = imagesToProcess;
    imagesToProcess = []; // Clear the queue for the next batch

    for (const img of batch) {
        // Ensure the image is still in the document and hasn't been processed.
        if (processedImages.has(img) || !document.body.contains(img)) continue;

        if (img.complete) {
            applyHdrFilter(img);
        } else {
            img.addEventListener('load', () => applyHdrFilter(img), { once: true });
        }
        processedImages.add(img);
    }
}, 100); // A short delay to batch mutations together.

/**
 * Adds an image to the processing queue.
 * @param {HTMLImageElement} img
 */
function queueImageForProcessing(img) {
    if (!processedImages.has(img)) {
        imagesToProcess.push(img);
        processBatch();
    }
}

/**
 * Re-processes all images on the page. Called when settings change.
 */
function processAllImagesNow() {
    document.querySelectorAll('img').forEach(img => {
        // Clear WeakSet to ensure all images are re-evaluated.
        processedImages.delete(img);
        // Clear existing filter state before re-applying.
        if (img.dataset.hdrBlocked) {
            img.style.filter = '';
            delete img.dataset.hdrBlocked;
        }
        queueImageForProcessing(img);
    });
}

// --- Initialization and Event Listeners ---

/**
 * Observes the DOM for newly added images and queues them for processing.
 */
const observer = new MutationObserver((mutations) => {
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

/**
 * Loads settings from storage and starts the observer.
 */
function loadSettingsAndRun() {
  const defaults = {
    sizeThreshold: 200,
    blackout: false,
  };

  chrome.storage.sync.get(defaults, (items) => {
    settings.sizeThreshold = parseInt(items.sizeThreshold, 10) || 200;
    settings.blackout = items.blackout;
    
    // Start observing at document_start. The observer will catch all images as they are added.
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

/**
 * Listens for changes in settings and re-processes images if necessary.
 */
chrome.storage.onChanged.addListener((changes) => {
  let needsReprocessing = false;
  if (changes.sizeThreshold) {
    settings.sizeThreshold = parseInt(changes.sizeThreshold.newValue, 10) || 200;
    needsReprocessing = true;
  }
  if (changes.blackout) {
    settings.blackout = changes.blackout.newValue;
    needsReprocessing = true;
  }
  
  if (needsReprocessing) {
    processAllImagesNow();
  }
});

// --- Start Execution ---
loadSettingsAndRun();

/**
 * Debounce function to limit the rate at which a function gets called.
 * @param {Function} func The function to debounce.
 * @param {number} wait The delay in milliseconds.
 * @returns {Function} The debounced function.
 */
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