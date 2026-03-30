const SUPABASE_URL = "https://bxezqlrgfsucvjuimgjw.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4ZXpxbHJnZnN1Y3ZqdWltZ2p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDYyNjUsImV4cCI6MjA4NTE4MjI2NX0.XeAM-FpM6MLVMsZ7Gotj0cxd5-6-3nNBeHX_AvPRU08";

// ===== LOGIC =====
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const loader = document.getElementById("loader");
const errorMsg = document.getElementById("error");
const pinLabel = document.getElementById("pinLabel");
const loginBtn = document.getElementById("loginBtn");
const pinInput = document.getElementById("pin");

let currentUsername = "";

function toggleLoading(isLoading) {
  loader.style.display = isLoading ? "block" : "none";
  nextBtn.disabled = isLoading;
  loginBtn.disabled = isLoading;
}

function showError(message) {
  errorMsg.style.color = "red";
  errorMsg.innerText = message;
}

function clearError() {
  errorMsg.innerText = "";
}

function resetForm() {
  step1.style.display = "block";
  step2.style.display = "none";
  document.getElementById("idNumber").value = "";
  pinInput.value = "";
  loginBtn.disabled = false;
  loginBtn.innerText = "Login";
  clearError();
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("idNumber").focus();
});

// STEP 1: Check Username
document.getElementById("formStep1").addEventListener("submit", async (e) => {
  e.preventDefault();
  const idNum = document.getElementById("idNumber").value.trim();
  if (!idNum) {
    showError("Please enter your username.");
    return;
  }

  toggleLoading(true);
  clearError();

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ p_username: idNum })
    });

    const result = await response.json();

    if (result.status === "success") {
      currentUsername = idNum;
      document.getElementById("formStep1").style.display = "none";
      document.getElementById("formStep2").style.display = "block";

      setTimeout(() => {
        document.getElementById("pin").focus();
      }, 100);

      // Check if PIN Exists
      const hasPin = Boolean(result.hasPin);
      pinLabel.innerText = hasPin ? "Enter PIN" : "Create 6-digit PIN";
    } else {
      showError(result.message || "Username not found.");
    }
  } catch (e) {
    showError("Connection error. Try again.");
    console.error(e);
  } finally {
    toggleLoading(false);
  }
});

// STEP 2: Login or Save PIN
document.getElementById("formStep2").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pinVal = pinInput.value.trim();
  if (pinVal.length !== 6) {
    showError("Please enter a 6-digit PIN.");
    return;
  }

  toggleLoading(true);
  clearError();

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/partner_login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ p_username: currentUsername, p_pin: pinVal })
    });

    const result = await response.json();

    if (result.status === "success") {
      localStorage.setItem("userSession", Date.now());
      localStorage.setItem("username", currentUsername);
      window.location.href = "../partner/dashboard/index.html";
    } else {
      showError(result.message || "Login failed.");

      // If locked, disable the login button
      if (result.locked === true) {
        loginBtn.disabled = true;
        loginBtn.innerText = "Account Locked";
        pinInput.disabled = true;
      }
    }
  } catch (e) {
    showError("Error processing login.");
    console.error(e);
  } finally {
    toggleLoading(false);
  }
});