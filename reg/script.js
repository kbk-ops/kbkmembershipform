// 1. --- Supabase Configuration ---
const SUPABASE_URL = "https://ayynblvknxuvazbwpxpm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5eW5ibHZrbnh1dmF6YndweHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzk2NjEsImV4cCI6MjA4OTM1NTY2MX0.iQYNqs0W1YJB2PTxBUTOZnpKBl6FU0UVxJzDmyOEOmM";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

// 2. --- DOM Elements ---
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const idNumberInput = document.getElementById("idNumber");
const emailInput = document.getElementById("email");
const errorEl = document.getElementById("error");
const loader = document.getElementById("loader");
const nextBtn = document.getElementById("nextBtn");
const continueBtn = document.getElementById("continueBtn");

sessionStorage.clear();
let currentReferrerData = null;

// -------------------------
// STEP 1: Validate Referrer
// -------------------------
nextBtn.onclick = async () => {
    errorEl.textContent = "";
    const id = idNumberInput.value.trim();

    if (!id) {
        errorEl.textContent = "Referrer ID required";
        return;
    }

    nextBtn.disabled = true;
    loader.style.display = "block";

    try {
        
        const { data: member, error } = await db
            .from('members_data')
            .select('id_number, first_name, last_name, suffix, status')
            .eq('id_number', id)
            .maybeSingle();

        loader.style.display = "none";

        if (error) throw error;

        if (!member) {
            errorEl.textContent = "Referrer ID not found";
            nextBtn.disabled = false;
            return;
        }

        if (member.status !== "Active") {
            errorEl.textContent = "Referrer is not Active";
            nextBtn.disabled = false;
            return;
        }

        currentReferrerData = member;
        step1.style.display = "none";
        step2.style.display = "block";

    } catch (err) {
        console.error("Step 1 Error:", err);
        loader.style.display = "none";
        errorEl.textContent = "Connection error. Check console.";
        nextBtn.disabled = false;
    }
};

// ----------------------
// STEP 2: Validate Email
// ----------------------
continueBtn.onclick = async () => {
    errorEl.textContent = "";
    const email = emailInput.value.trim();

    if (!validateEmail(email)) {
        errorEl.textContent = "Invalid email format";
        return;
    }

    continueBtn.disabled = true;
    loader.style.display = "block";

    try {

        const { data: existingEntry, error } = await db
            .from('members_data')
            .select('email_add')
            .ilike('email_add', email) 
            .maybeSingle();

        loader.style.display = "none";

        if (error) throw error;

        if (existingEntry) {
            errorEl.textContent = "Email already registered";
            continueBtn.disabled = false;
            return;
        }

        // --- Save to Session Storage ---
        sessionStorage.setItem("referrerID", currentReferrerData.id);
        sessionStorage.setItem("registerEmail", email.toLowerCase());
        sessionStorage.setItem("referrerFirstName", currentReferrerData.first_name);
        sessionStorage.setItem("referrerLastName", currentReferrerData.last_name);
        sessionStorage.setItem("referrerSuffix", currentReferrerData.suffix || "");

        window.location.replace("../reg/form/index.html");

    } catch (err) {
        console.error("Step 2 Error:", err);
        loader.style.display = "none";
        errorEl.textContent = "Database error during email check.";
        continueBtn.disabled = false;
    }
};

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
