// ==========================================
// 1. INITIALIZATION & SETUP
// ==========================================
const SUPABASE_URL = "https://ayynblvknxuvazbwpxpm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5eW5ibHZrbnh1dmF6YndweHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzk2NjEsImV4cCI6MjA4OTM1NTY2MX0.iQYNqs0W1YJB2PTxBUTOZnpKBl6FU0UVxJzDmyOEOmM";

// Renamed variable to 'supabaseClient' to prevent collision with the CDN's global 'supabase' object
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: window.sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// Cloudinary Image Optimization for faster loading
const optimizeLogo = () => {
  const logo = document.querySelector(".logo");
  if (
    logo &&
    logo.src.includes("cloudinary.com") &&
    !logo.src.includes("q_auto")
  ) {
    // Injects max-width 400px, auto-quality, and auto-format (WebP/AVIF)
    logo.src = logo.src.replace("/upload/", "/upload/w_400,q_auto,f_auto/");
  }
};

optimizeLogo();

// ==========================================
// 2. DOM ELEMENTS & UTILITIES
// ==========================================

const steps = {
  1: document.getElementById("step-1"),
  2: document.getElementById("step-2"),
  3: document.getElementById("step-3"),
  success: document.getElementById("success-overlay")
};

const showStep = (stepNumber) => {
  Object.values(steps).forEach((step) => step.classList.remove("active"));
  if (steps[stepNumber]) steps[stepNumber].classList.add("active");
};

const setLoading = (buttonId, isLoading) => {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  if (isLoading) {
    btn.classList.add("loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
};

const showError = (elementId, message, shakeElementId = null) => {
  document.getElementById(elementId).innerText = message;
  if (shakeElementId) {
    const shakeEl = document.getElementById(shakeElementId);
    shakeEl.classList.remove("error-shake");
    void shakeEl.offsetWidth; // trigger reflow to restart animation
    shakeEl.classList.add("error-shake");
  }
};

const clearError = (elementId) => {
  document.getElementById(elementId).innerText = "";
};

// Basic frontend rate limiting
let lastFailedAttempt = 0;
const checkRateLimit = () => {
  const now = Date.now();
  if (now - lastFailedAttempt < 2000) {
    // 2 second delay between failed attempts
    return false;
  }
  return true;
};

// ==========================================
// 3. PIN INPUT LOGIC
// ==========================================

const setupPinInputs = (containerId, onComplete = null) => {
  const container = document.getElementById(containerId);
  const inputs = container.querySelectorAll(".pin-box");

  inputs.forEach((input, index) => {
    // Mask character visually but store real value
    input.addEventListener("input", (e) => {
      if (e.target.value) {
        e.target.dataset.value = e.target.value;
        e.target.value = "•";

        if (index < inputs.length - 1) {
          inputs[index + 1].focus();
        } else if (onComplete) {
          const fullPin = Array.from(inputs)
            .map((i) => i.dataset.value || "")
            .join("");
          if (fullPin.length === 6) {
            onComplete(fullPin, container);
          }
        }
      }
    });

    // Handle Backspace navigation
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace") {
        e.target.value = "";
        e.target.dataset.value = "";
        if (index > 0) {
          inputs[index - 1].focus();
          inputs[index - 1].value = "";
          inputs[index - 1].dataset.value = "";
        }
      }
    });

    // Handle Paste of a full 6-digit PIN
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pastedData = (e.clipboardData || window.clipboardData).getData(
        "text"
      );
      const numericData = pastedData.replace(/\D/g, "").slice(0, 6);

      if (numericData) {
        numericData.split("").forEach((char, i) => {
          if (inputs[i]) {
            inputs[i].dataset.value = char;
            inputs[i].value = "•";
          }
        });

        const focusIndex = Math.min(numericData.length, 5);
        inputs[focusIndex].focus();

        if (numericData.length === 6 && onComplete) {
          onComplete(numericData, container);
        }
      }
    });
  });
};

const clearPinInputs = (containerId) => {
  const inputs = document
    .getElementById(containerId)
    .querySelectorAll(".pin-box");
  inputs.forEach((input) => {
    input.value = "";
    input.dataset.value = "";
  });
  inputs[0].focus();
};

const triggerSuccessPulse = (container) => {
  const inputs = container.querySelectorAll(".pin-box");
  inputs.forEach((input) => input.classList.add("success"));
  setTimeout(() => {
    inputs.forEach((input) => input.classList.remove("success"));
  }, 600);
};

// ==========================================
// 4. AUTHENTICATION FLOW
// ==========================================

// STEP 1: Handle ID Submit
document.getElementById("form-id").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError("error-id");
  const idNumber = document.getElementById("id_number").value.trim();

  if (!idNumber) return;

  setLoading("btn-id", true);

  try {
    // Fetch user data, including the new lock columns
    const { data, error } = await supabaseClient
      .from("user_roles")
      .select("id_number, failed_attempts, locked_until")
      .ilike("id_number", idNumber)
      .single();

    if (error || !data) {
      throw new Error("ID Number not found or access denied.");
    }

    // --- LOCKOUT CHECK LOGIC ---
    if (data.locked_until) {
      const lockedUntilDate = new Date(data.locked_until);
      const now = new Date();

      if (now < lockedUntilDate) {
        
        const minutesLeft = Math.ceil((lockedUntilDate - now) / 60000);
        throw new Error(
          `Account locked. Try again in ${minutesLeft} minute(s).`
        );
      } else if (data.failed_attempts >= 3) {
        
        await supabaseClient
          .from("user_roles")
          .update({ failed_attempts: 0, locked_until: null })
          .ilike("id_number", idNumber);
      }
    }

    // Success - Save to session and move to Step 2
    sessionStorage.setItem("temp_id_number", data.id_number);
    showStep(2);

    // Auto-focus first PIN box
    setTimeout(() => {
      document.querySelector("#login-pin-group .pin-box").focus();
    }, 400);
  } catch (error) {
    showError("error-id", error.message, "id_number");
  } finally {
    setLoading("btn-id", false);
  }
});

// Helper to go back to ID screen
window.goBackToId = () => {
  sessionStorage.removeItem("temp_id_number");
  clearPinInputs("login-pin-group");
  clearError("error-pin");
  showStep(1);
};

// STEP 2: Handle Login PIN Enter
setupPinInputs("login-pin-group", async (pin, container) => {
  if (!checkRateLimit()) {
    showError(
      "error-pin",
      "Too many attempts. Please wait.",
      "login-pin-group"
    );
    return;
  }

  clearError("error-pin");
  const idNumber = sessionStorage.getItem("temp_id_number");
  const email = `${idNumber}@kbkai.local`;

  try {
    // Login attempt
    const {
      data: authData,
      error: authError
    } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: pin
    });

    if (authError) {
      lastFailedAttempt = Date.now();

      // 1. Get current failed attempts
      const { data: userData } = await supabaseClient
        .from("user_roles")
        .select("failed_attempts")
        .ilike("id_number", idNumber)
        .single();

      let attempts = (userData?.failed_attempts || 0) + 1;

      if (attempts >= 3) {
        // 2. Lock the account for 15 minutes
        const lockTime = new Date();
        lockTime.setMinutes(lockTime.getMinutes() + 15);

        await supabaseClient
          .from("user_roles")
          .update({
            failed_attempts: attempts,
            locked_until: lockTime.toISOString()
          })
          .ilike("id_number", idNumber);

        // back to step 1
        window.goBackToId();
        showError(
          "error-id",
          "Account locked for 15 minutes due to multiple failed attempts.",
          "id_number"
        );
        return;
      } else {
        // 3. Update the counter
        await supabaseClient
          .from("user_roles")
          .update({ failed_attempts: attempts })
          .ilike("id_number", idNumber);

        throw new Error(`Invalid PIN. ${3 - attempts} attempt(s) remaining.`);
      }
    }

    // --- ON SUCCESSFUL LOGIN ---
    triggerSuccessPulse(container);

    // Reset the failed attempts counter upon successful login
    await supabaseClient
      .from("user_roles")
      .update({ failed_attempts: 0, locked_until: null })
      .ilike("id_number", idNumber);

    // Check must_change_pin
    const userId = authData.user.id;
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("must_change_pin")
      .eq("auth_user_id", userId)
      .single();

    if (roleError) throw new Error("Error retrieving user status.");

    setTimeout(() => {
      if (roleData.must_change_pin) {
        showStep(3);
        setTimeout(
          () => document.querySelector("#new-pin-group .pin-box").focus(),
          400
        );
      } else {
        handleSuccessfulLogin();
      }
    }, 600);
  } catch (error) {
    showError("error-pin", error.message, "login-pin-group");
    clearPinInputs("login-pin-group");
  }
});

// STEP 3: Handle Change PIN setup
setupPinInputs("new-pin-group");
setupPinInputs("confirm-pin-group");

document
  .getElementById("form-change-pin")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError("error-change-pin");

    const getPinFromGroup = (id) => {
      return Array.from(
        document.getElementById(id).querySelectorAll(".pin-box")
      )
        .map((i) => i.dataset.value || "")
        .join("");
    };

    const newPin = getPinFromGroup("new-pin-group");
    const confirmPin = getPinFromGroup("confirm-pin-group");

    if (newPin.length !== 6 || confirmPin.length !== 6) {
      showError("error-change-pin", "Please fill all 6 digits.");
      return;
    }

    if (newPin !== confirmPin) {
      showError("error-change-pin", "PINs do not match.", "confirm-pin-group");
      clearPinInputs("confirm-pin-group");
      return;
    }

    setLoading("btn-change-pin", true);

    try {
      // 1. Update Supabase Auth PIN
      const {
        data: authData,
        error: authError
      } = await supabaseClient.auth.updateUser({
        password: newPin
      });

      if (authError) throw authError;

      // 2. Update Database User Role Status
      const userId = authData.user.id;
      const { error: dbError } = await supabaseClient
        .from("user_roles")
        .update({ must_change_pin: false })
        .eq("auth_user_id", userId);

      if (dbError) throw dbError;

      // Success
      triggerSuccessPulse(document.getElementById("new-pin-group"));
      triggerSuccessPulse(document.getElementById("confirm-pin-group"));

      setTimeout(() => {
        handleSuccessfulLogin();
      }, 600);
    } catch (error) {
      showError("error-change-pin", error.message || "Error updating PIN.");
    } finally {
      setLoading("btn-change-pin", false);
    }
  });

const handleSuccessfulLogin = () => {
  showStep("success");
  sessionStorage.removeItem("temp_id_number"); // Clean up securely

  // Redirect to dashboard
  setTimeout(() => {
    window.location.replace("dashboard/index.html");
  }, 1500);
};