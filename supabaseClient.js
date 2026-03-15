// supabaseClient.js

// Ensure Supabase JS CDN is loaded in HTML before this script runs.
const SUPABASE_URL = "https://bxezqlrgfsucvjuimgjw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4ZXpxbHJnZnN1Y3ZqdWltZ2p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDYyNjUsImV4cCI6MjA4NTE4MjI2NX0.XeAM-FpM6MLVMsZ7Gotj0cxd5-6-3nNBeHX_AvPRU08";

// --- SECURITY GATE & DATA RETRIEVAL ---
const token = sessionStorage.getItem("auth_token");
const profileData = sessionStorage.getItem("user_profile");

// Redirect if not logged in
if (!token || !profileData) {
    window.location.href = "../index.html";
}

const cachedProfile = JSON.parse(profileData);
const { fullname, role, id: memberID, receiver: userGroup } = cachedProfile;

// --- INITIALIZE SUPABASE WITH JWT ---
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    },
});
