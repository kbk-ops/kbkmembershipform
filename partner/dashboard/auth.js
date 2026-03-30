(function () {
  const IDLE_LIMIT = 15 * 60 * 1000;
  let idleTimer;

  // Authentication Check
  function checkAuth() {
    const session = localStorage.getItem("userSession");
    const username = localStorage.getItem("username");

    return !!(session && username);
  }

  // UI Control
  function lockUI() {
    document.body.classList.add("locked");

    const app = document.getElementById("app");
    if (app) app.classList.add("hidden");
  }

  function unlockUI() {
    document.body.classList.remove("locked");

    const app = document.getElementById("app");
    if (app) app.classList.remove("hidden");
  }

  // Logout
  window.logout = function () {
    localStorage.removeItem("userSession");
    localStorage.removeItem("username");
    lockUI();
    window.location.replace("../../index.html");
  };

  // Reset idle timer
  function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      alert("Session expired due to inactivity.");
      logout();
    }, IDLE_LIMIT);
  }

  // Initialize on DOM ready
  document.addEventListener("DOMContentLoaded", function () {
    if (!checkAuth()) {
      lockUI();
      window.location.replace("../../index.html");
      return;
    }

    // Authenticated
    unlockUI();

    // Start idle timer
    ["click", "mousemove", "keypress", "touchstart"].forEach((evt) => {
      document.addEventListener(evt, resetIdleTimer);
    });

    resetIdleTimer();
  });
})();