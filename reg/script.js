const FUNCTION_URL = "https://ayynblvknxuvazbwpxpm.supabase.co/functions/v1/validate-referrer";

// -------------------------
// DOM ELEMENTS
// -------------------------
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const idNumberInput = document.getElementById("idNumber");
const emailInput = document.getElementById("email");
const errorEl = document.getElementById("error");
const loader = document.getElementById("loader");
const nextBtn = document.getElementById("nextBtn");
const continueBtn = document.getElementById("continueBtn");

// -------------------------
// STATE
// -------------------------
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
        const res = await fetch(FUNCTION_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ id })
        });

        const result = await res.json();
        loader.style.display = "none";

        if (!res.ok) {
            errorEl.textContent = result.error || "Validation failed";
            nextBtn.disabled = false;
            return;
        }

        // Save referrer data
        currentReferrerData = result.referrer;

        // Move to next step
        step1.style.display = "none";
        step2.style.display = "block";

    } catch (err) {
        console.error("Step 1 Error:", err);
        loader.style.display = "none";
        errorEl.textContent = "Connection error. Please try again.";
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

    if (!currentReferrerData) {
        errorEl.textContent = "Referrer data missing. Please go back.";
        return;
    }

    continueBtn.disabled = true;
    loader.style.display = "block";

    try {
        const res = await fetch(FUNCTION_URL, {
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
            errorEl.textContent = result.error || "Email validation failed";
            continueBtn.disabled = false;
            return;
        }

        // -------------------------
        // SAVE SESSION DATA
        // -------------------------
        sessionStorage.setItem("referrerID", currentReferrerData.id_number);
        sessionStorage.setItem("registerEmail", email.toLowerCase());
        sessionStorage.setItem("referrerFirstName", currentReferrerData.first_name);
        sessionStorage.setItem("referrerLastName", currentReferrerData.last_name);
        sessionStorage.setItem("referrerSuffix", currentReferrerData.suffix || "");

        // Redirect to form
        window.location.replace("../reg/form/index.html");

    } catch (err) {
        console.error("Step 2 Error:", err);
        loader.style.display = "none";
        errorEl.textContent = "Server error. Please try again.";
        continueBtn.disabled = false;
    }
};

// ----------------------
// EMAIL VALIDATOR
// ----------------------
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
