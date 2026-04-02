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
        const res = await fetch("https://ayynblvknxuvazbwpxpm.supabase.co/functions/v1/validate-referrer", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ id })
        });

        const result = await res.json();
        loader.style.display = "none";

        if (!res.ok) {
            errorEl.textContent = result.error;
            nextBtn.disabled = false;
            return;
        }

        currentReferrerData = result.referrer;

        step1.style.display = "none";
        step2.style.display = "block";

    } catch (err) {
        console.error(err);
        loader.style.display = "none";
        errorEl.textContent = "Connection error.";
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
        const res = await fetch("https://ayynblvknxuvazbwpxpm.supabase.co/functions/v1/validate-referrer", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: currentReferrerData.id_number,
                email
            })
        });

        const result = await res.json();
        loader.style.display = "none";

        if (!res.ok) {
            errorEl.textContent = result.error;
            continueBtn.disabled = false;
            return;
        }

        sessionStorage.setItem("referrerID", currentReferrerData.id_number);
        sessionStorage.setItem("registerEmail", email.toLowerCase());
        sessionStorage.setItem("referrerFirstName", currentReferrerData.first_name);
        sessionStorage.setItem("referrerLastName", currentReferrerData.last_name);
        sessionStorage.setItem("referrerSuffix", currentReferrerData.suffix || "");

        window.location.replace("../reg/form/index.html");

    } catch (err) {
        console.error(err);
        loader.style.display = "none";
        errorEl.textContent = "Server error.";
        continueBtn.disabled = false;
    }
};

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
