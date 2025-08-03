// Saves options to chrome.storage
function saveOptions() {
  const size = document.getElementById('size').value;
  chrome.storage.sync.set(
    { sizeThreshold: size },
    () => {
      // Update status to let user know options were saved.
      const status = document.getElementById('status');
      status.textContent = 'Options saved.';
      status.style.opacity = 1;
      setTimeout(() => {
        status.style.opacity = 0;
      }, 1500);
    }
  );
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restoreOptions() {
  // Use default value sizeThreshold = 200.
  chrome.storage.sync.get(
    { sizeThreshold: 200 },
    (items) => {
      document.getElementById('size').value = items.sizeThreshold;
    }
  );
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
