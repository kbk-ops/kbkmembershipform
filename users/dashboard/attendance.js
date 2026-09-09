const GAS_URL =
  "https://script.google.com/macros/s/AKfycbxCo2yyA21A455dd-nn1zDGgtuXM6YVbSbSfo61PznbkZaK-4uZuGwZBE1NwtQKcuKCRw/exec";

// --- DOM Elements ---
const form = document.getElementById("attendance-form");
const idInput = document.getElementById("id_number");
const nameInput = document.getElementById("name");
const genderInput = document.getElementById("gender");
const brgyInput = document.getElementById("barangay");
const distInput = document.getElementById("district");
const posInput = document.getElementById("position");

const btnScan = document.getElementById("btn-scan");
const btnReset = document.getElementById("btn-reset");
const btnCloseScan = document.getElementById("btn-close-scan");

const qrModal = document.getElementById("qr-modal");
const loadingOverlay = document.getElementById("loading-overlay");
const toastEl = document.getElementById("toast");

// ZXing Reader Instance
let codeReader = null;

// --- Helper Functions ---

// Clean string data. Returns empty if N/A or None
const cleanString = (str) => {
  if (!str) return "";
  const upper = str.toUpperCase().trim();
  if (upper === "N/A" || upper === "NONE") return "";
  return str.trim();
};

// Format full name
const formatName = (first, middle, last, suffix) => {
  const f = cleanString(first);
  const m = cleanString(middle);
  const l = cleanString(last);
  const s = cleanString(suffix);

  let mi = "";
  if (m.length > 0) {
    mi = m.charAt(0).toUpperCase() + ". ";
  }
  return `${f} ${mi}${l} ${s}`.trim().replace(/\s+/g, " ");
};

// Toast Notification
const showToast = (message, type = "success") => {
  toastEl.textContent = message;
  toastEl.className = `toast show ${type === "error" ? "error" : ""}`;
  setTimeout(() => {
    toastEl.classList.remove("show");
  }, 3000);
};

// Clear readonly fields
const clearReadonlyFields = () => {
  nameInput.value = "";
  genderInput.value = "";
  brgyInput.value = "";
  distInput.value = "";
  posInput.value = "";
};

// --- Core Logic ---

// Fetch Member Data from Supabase
const fetchMemberData = async (id) => {
  if (!id) {
    clearReadonlyFields();
    return;
  }

  try {
    const { data, error } = await window.supabaseClient
      .from("members_data")
      .select("*")
      .eq("id_number", id)
      .single();

    if (error) throw error;

    if (data) {
      nameInput.value = formatName(
        data.first_name,
        data.middle_name,
        data.last_name,
        data.suffix
      );
      genderInput.value = cleanString(data.gender) || "Not Specified";
      brgyInput.value = cleanString(data.barangay) || "Not Specified";
      distInput.value = cleanString(data.district) || "Not Specified";
      posInput.value = cleanString(data.designation) || "Not Specified";
      showToast("Member found!");
    }
  } catch (err) {
    console.error("Supabase Fetch Error:", err);
    clearReadonlyFields();
    showToast("ID not found in database", "error");
  }
};

// Debounce for manual ID typing
let typingTimer;
idInput.addEventListener("input", () => {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    if (idInput.value.trim().length > 11) {
      fetchMemberData(idInput.value.trim());
    } else {
      clearReadonlyFields();
    }
  }, 800);
});

// --- QR Scanner Logic (ZXing) ---
const startScanner = async () => {
  qrModal.classList.remove("hidden");
  codeReader = new ZXing.BrowserMultiFormatReader();

  try {
    // Request high res for small codes
    const constraints = {
      video: {
        facingMode: "environment",
        width: { min: 640, ideal: 1920 },
        height: { min: 480, ideal: 1080 }
      }
    };

    const devices = await codeReader.listVideoInputDevices();
    if (devices.length === 0) {
      throw new Error("No camera found.");
    }

    // Start decoding
    codeReader.decodeFromConstraints(constraints, "video", (result, err) => {
      if (result) {
        // Success
        idInput.value = result.text;
        stopScanner();
        fetchMemberData(result.text);
        // Visual feedback
        if (window.navigator.vibrate) window.navigator.vibrate(200);
      }
    });
  } catch (err) {
    console.error(err);
    showToast("Camera access error.", "error");
    stopScanner();
  }
};

const stopScanner = () => {
  qrModal.classList.add("hidden");
  if (codeReader) {
    codeReader.reset();
    codeReader = null;
  }
};

btnScan.addEventListener("click", startScanner);
btnCloseScan.addEventListener("click", stopScanner);

// --- Form Submission ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!idInput.value.trim() || !nameInput.value.trim()) {
    showToast("Please provide a valid ID", "error");
    return;
  }

  loadingOverlay.classList.remove("hidden");

  // Create Payload matching Google Sheet Columns A-F
  const payload = {
    id: idInput.value,
    name: nameInput.value,
    gender: genderInput.value,
    barangay: brgyInput.value,
    district: distInput.value,
    position: posInput.value
  };

  try {
    // Note: fetch with no-cors creates an opaque response, meaning success can't be strictly verified via response body.
    await fetch(GAS_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    // Assume success if no throw
    showToast("Attendance Recorded");
    form.reset();
    clearReadonlyFields();
  } catch (err) {
    console.error("Submit Error:", err);
    showToast("Failed to record attendance", "error");
  } finally {
    loadingOverlay.classList.add("hidden");
  }
});

// --- Reset Form ---
btnReset.addEventListener("click", () => {
  form.reset();
  clearReadonlyFields();
});
