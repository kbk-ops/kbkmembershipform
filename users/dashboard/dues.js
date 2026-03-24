document.addEventListener("DOMContentLoaded", () => {
  // --- DOM ELEMENTS ---
  const form = document.getElementById("duesForm");
  const idInput = document.getElementById("id_number");
  const nameInput = document.getElementById("full_name");
  const barangayInput = document.getElementById("barangay");
  const districtInput = document.getElementById("district");
  const monthSelect = document.getElementById("month");
  const yearSelect = document.getElementById("year");
  const btnScan = document.getElementById("btnScan");
  const btnClear = document.getElementById("btnClear");
  const spinner = document.getElementById("spinnerOverlay");
  
  // Scanner Elements
  const cameraOverlay = document.getElementById("cameraOverlay");
  const videoEl = document.getElementById("video");
  const btnToggleFlash = document.getElementById("btnToggleFlash");
  const btnCloseCamera = document.getElementById("btnCloseCamera");

  // --- STATE VARIABLES ---
  let loggedInUserFullName = "System Admin"; 
  let fetchDebounce = null;
  let codeReader = new ZXing.BrowserMultiFormatReader();
  let isFlashOn = false;

  // --- INITIALIZATION ---
  yearSelect.value = new Date().getFullYear();
  setCollectorName();

  // --- 1. COLLECTOR NAME LOGIC ---
  async function setCollectorName() {
    try {
      const { data: { user } } = await window.supabaseClient.auth.getUser();
      if (!user) return;

      const { data: roleData } = await window.supabaseClient
        .from("user_roles")
        .select("id_number")
        .eq("auth_user_id", user.id)
        .single();

      if (roleData?.id_number) {
        const { data: profile } = await window.supabaseClient
          .from("members_data")
          .select("first_name, last_name, suffix")
          .eq("id_number", roleData.id_number)
          .maybeSingle();

        if (profile) {
          const suffix = profile.suffix && profile.suffix !== "None" ? ` ${profile.suffix}` : "";
          loggedInUserFullName = `${profile.first_name} ${profile.last_name}${suffix}`;
        }
      }
    } catch (err) {
      console.error("Collector fetching error:", err);
    }
  }

  // --- 2. MEMBER LOOKUP LOGIC ---
  idInput.addEventListener("input", () => {
    clearTimeout(fetchDebounce);
    const val = idInput.value.trim();
    if (!val) return clearFields();

    fetchDebounce = setTimeout(async () => {
      const { data } = await window.supabaseClient
        .from("members_data")
        .select("*")
        .eq("id_number", val)
        .maybeSingle();

      if (data) {
        const mi = data.middle_name && !["N/A", "None"].includes(data.middle_name) ? ` ${data.middle_name.charAt(0)}.` : "";
        const sfx = data.suffix && data.suffix !== "None" ? ` ${data.suffix}` : "";
        nameInput.value = `${data.first_name}${mi} ${data.last_name}${sfx}`;
        barangayInput.value = data.barangay;
        districtInput.value = data.district;
      } else {
        clearFields();
      }
    }, 500);
  });

  // --- 3. FORM SUBMISSION ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!nameInput.value || !barangayInput.value || !districtInput.value) {
      showToast("Member details missing. Please enter a valid ID Number.", "error");
      return;
    }

    toggleLoading(true);

    const payload = {
      id_number: idInput.value,
      full_name: nameInput.value,
      barangay: barangayInput.value,
      district: districtInput.value,
      amount: 30.0,
      year: parseInt(yearSelect.value),
      month: monthSelect.value,
      receive_by: loggedInUserFullName
    };

    const { error } = await window.supabaseClient.from("contributions").insert([payload]);

    toggleLoading(false);

    if (error) {
      showToast(error.message, "error");
    } else {
      showToast(`Dues Recorded for ${payload.month}!`, "success", 5000);
      resetForm();
    }
  });

  // --- 4. SCANNER LOGIC (FIXED & HARDENED) ---
  btnScan.addEventListener("click", async () => {
    cameraOverlay.classList.remove("hidden");
    btnToggleFlash.style.display = "none"; // Initially hide flash
    isFlashOn = false;

    const constraints = {
      video: {
        facingMode: "environment",
        width: { ideal: 1280 }, // 720p is best for speed vs detail
        height: { ideal: 720 },
        advanced: [{ focusMode: "continuous" }]
      }
    };

    try {
      // Start Decoding
      await codeReader.decodeFromConstraints(constraints, videoEl, (result, err) => {
        if (result) {
          idInput.value = result.getText();
          idInput.dispatchEvent(new Event('input')); 
          playSuccessFeedback();
          showToast("QR Scanned", "success", 3000);
          stopScanner();
        }
      });

      // --- FLASH INITIALIZATION ---
      // We check every 500ms for up to 5 seconds to see if the camera reports "torch" capability
      let checkCount = 0;
      const flashInterval = setInterval(() => {
        const stream = videoEl.srcObject;
        const track = stream ? stream.getVideoTracks()[0] : null;
        
        if (track && track.getCapabilities) {
          const caps = track.getCapabilities();
          if (caps.torch) {
            btnToggleFlash.style.display = "block";
            btnToggleFlash.innerText = "🔦 Flash: OFF";
            btnToggleFlash.style.backgroundColor = "#333";
            clearInterval(flashInterval);
          }
        }
        
        checkCount++;
        if (checkCount > 10) clearInterval(flashInterval); // Stop after 5 seconds
      }, 500);

    } catch (err) {
      console.error("Scanner failed:", err);
      showToast("Camera failed to load. Check permissions.", "error");
      stopScanner();
    }
  });

  // Flash Toggle Action
  btnToggleFlash.addEventListener("click", async () => {
    const track = videoEl.srcObject?.getVideoTracks()[0];
    if (track) {
      try {
        isFlashOn = !isFlashOn;
        await track.applyConstraints({ advanced: [{ torch: isFlashOn }] });
        btnToggleFlash.innerText = isFlashOn ? "🔦 Flash: ON" : "🔦 Flash: OFF";
        btnToggleFlash.style.backgroundColor = isFlashOn ? "#27ae60" : "#333";
      } catch (e) {
        showToast("Flash not supported on this device.", "error");
      }
    }
  });

  function stopScanner() {
    codeReader.reset(); // ZXing internal stop
    if (videoEl.srcObject) {
      videoEl.srcObject.getTracks().forEach(track => track.stop());
    }
    videoEl.srcObject = null;
    cameraOverlay.classList.add("hidden");
  }

  btnCloseCamera.addEventListener("click", stopScanner);

  // --- HELPERS ---
  function resetForm() {
    idInput.value = "";
    monthSelect.value = "";
    clearFields();
  }

  function clearFields() {
    nameInput.value = "";
    barangayInput.value = "";
    districtInput.value = "";
  }

  function toggleLoading(show) {
    spinner.classList.toggle("hidden", !show);
    Array.from(form.elements).forEach(i => (i.disabled = show));
  }

  function showToast(msg, type, duration = 3000) {
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerText = msg;
    document.getElementById("toastContainer").appendChild(t);
    setTimeout(() => t.remove(), duration);
  }

  function playSuccessFeedback() {
    if (navigator.vibrate) navigator.vibrate(200);
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  }

  btnClear.addEventListener("click", resetForm);
});
