(function () {
  // ----- CONFIG -----
  const INACTIVITY_LIMIT = 1800000; // 30 minutes
  let inactivityTimer = null;
  let throttleTimer = null;
  let listenersAttached = false;

  // ----- GET SUPABASE CLIENT -----
  function getClient() {
    if (!window.supabaseClient) {
      console.error("Supabase client not found!");
      return null;
    }
    return window.supabaseClient;
  }

  // ----- REDIRECT -----
  function redirectToLogin() {
    // Use absolute pathing to prevent directory traversal issues
    window.location.replace("/index.html"); 
  }

  // ----- LOGOUT -----
  async function logout() {
    const client = getClient();
    if (!client) return;

    try {
      await client.auth.signOut();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      redirectToLogin();
    }
  }

  // ----- AUTH CHECK -----
  async function checkAuth() {
    const client = getClient();
    if (!client) return null;

    try {
      const { data, error } = await client.auth.getSession();

      if (error || !data?.session) {
        redirectToLogin();
        return null;
      }

      // Show the page ONLY after auth is confirmed (Prevents FOUC)
      document.body.style.visibility = "visible"; 

      return data.session;
    } catch (err) {
      console.error("Auth check failed:", err);
      redirectToLogin();
      return null;
    }
  }

  // ----- INACTIVITY TIMER WITH THROTTLE -----
  function resetTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);

    inactivityTimer = setTimeout(() => {
      console.warn("User inactive. Logging out...");
      logout();
    }, INACTIVITY_LIMIT);
  }

  function throttledReset() {
    // Only allow the reset to fire once per second to save performance
    if (throttleTimer) return;
    
    throttleTimer = setTimeout(() => {
      resetTimer();
      throttleTimer = null;
    }, 1000);
  }

  function setupActivityListeners() {
    if (listenersAttached) return;

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, throttledReset, { passive: true });
    });

    listenersAttached = true;
  }

  // ----- AUTH STATE LISTENER -----
  function setupAuthStateListener() {
    const client = getClient();
    if (!client) return;

    client.auth.onAuthStateChange((event, session) => {
      // If the user logs out in another tab, or token expires, redirect immediately
      if (event === 'SIGNED_OUT' || !session) {
        redirectToLogin();
      }
    });
  }

  // ----- INITIALIZE AUTH GUARD -----
  async function init() {
    // Hide body initially to prevent Flash of Unauthenticated Content
    document.body.style.visibility = "hidden";

    const session = await checkAuth();
    if (!session) return;

    setupAuthStateListener();
    setupActivityListeners();
    resetTimer();
  }

  // ----- HANDLE BACK/FORWARD CACHE -----
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      // Page loaded from bfcache, re-check auth
      checkAuth();
    }
  });

  // ----- EXPOSE INIT FUNCTION -----
  window.initAuthGuard = init;
})();
