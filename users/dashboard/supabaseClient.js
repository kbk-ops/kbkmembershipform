const SUPABASE_URL = "https://ayynblvknxuvazbwpxpm.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5eW5ibHZrbnh1dmF6YndweHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzk2NjEsImV4cCI6MjA4OTM1NTY2MX0.iQYNqs0W1YJB2PTxBUTOZnpKBl6FU0UVxJzDmyOEOmM";

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Helper functions
async function getUser() {
  const {
    data: { user },
    error
  } = await window.supabaseClient.auth.getUser();
  return error ? null : user;
}

// Logic to run when page is ready
document.addEventListener("DOMContentLoaded", async () => {
  if (window.initAuthGuard) {
    await window.initAuthGuard();
  }

  const user = await getUser();
  if (user) {
    const usernameEl = document.getElementById("username");
    if (usernameEl) usernameEl.innerText = user.email;
  }
});