(function () {
  const INACTIVITY_LIMIT = 1800000;
  let inactivityTimer = null;
  let listenersAttached = false;

  function getClient() {
    if (!window.supabaseClient) {
      console.error("Supabase client not found!");
      return null;
    }
    return window.supabaseClient;
  }

  async function checkAuth() {
    const client = getClient();
    if (!client) return null;

    try {
      const { data, error } = await client.auth.getSession();

      if (error || !data?.session) {
        redirectToLogin();
        return null;
      }

      return data.session;
    } catch (err) {
      console.error("Auth check failed:", err);
      redirectToLogin();
      return null;
    }
  }

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

  function redirectToLogin() {
    window.location.replace("../index.html");
  }

  function resetTimer() {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }

    inactivityTimer = setTimeout(() => {
      console.warn("User inactive. Logging out...");
      logout();
    }, INACTIVITY_LIMIT);
  }

  function setupActivityListeners() {
    if (listenersAttached) return;

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];

    events.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    listenersAttached = true;
  }

  async function init() {
    const session = await checkAuth();
    if (!session) return;

    setupActivityListeners();
    resetTimer();
  }

  window.initAuthGuard = init;
})();