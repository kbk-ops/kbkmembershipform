document.addEventListener("DOMContentLoaded", () => {
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

  let loggedInUserFullName = "System Admin"; // Fallback
  let fetchDebounce = null;

  // --- INITIALIZATION ---
  yearSelect.value = new Date().getFullYear();
  setCollectorName();

  // --- COLLECTOR LOGIC ---
  async function setCollectorName() {
    try {
      const {
        data: { user }
      } = await window.supabaseClient.auth.getUser();
      if (!user) return;

      // 1. Get id_number from user_roles
      const { data: roleData } = await window.supabaseClient
        .from("user_roles")
        .select("id_number")
        .eq("auth_user_id", user.id)
        .single();

      if (roleData?.id_number) {
        // 2. Get profile details from members_data
        const { data: profile } = await window.supabaseClient
          .from("members_data")
          .select("first_name, last_name, suffix")
          .eq("id_number", roleData.id_number)
          .maybeSingle();

        if (profile) {
          const suffix =
            profile.suffix && profile.suffix !== "None"
              ? ` ${profile.suffix}`
              : "";
          loggedInUserFullName = `${profile.first_name} ${profile.last_name}${suffix}`;
        }
      }
    } catch (err) {
      console.error("Collector fetching error:", err);
    }
  }

  // --- MEMBER LOOKUP LOGIC ---
  idInput.addEventListener("input", () => {
    clearTimeout(fetchDebounce);
    const val = idInput.value.trim();
    if (!val) return clearFields();

    fetchDebounce = setTimeout(async () => {
      const { data, error } = await window.supabaseClient
        .from("members_data")
        .select("*")
        .eq("id_number", val)
        .maybeSingle();

      if (data) {
        const mi =
          data.middle_name && !["N/A", "None"].includes(data.middle_name)
            ? ` ${data.middle_name.charAt(0)}.`
            : "";
        const sfx =
          data.suffix && data.suffix !== "None" ? ` ${data.suffix}` : "";

        nameInput.value = `${data.first_name}${mi} ${data.last_name}${sfx}`;
        barangayInput.value = data.barangay;
        districtInput.value = data.district;
      } else {
        clearFields();
      }
    }, 500);
  });

  // --- FORM SUBMISSION ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 2. Validation Check: Do not allow submit if Name, Barangay, or District are blank
    if (!nameInput.value || !barangayInput.value || !districtInput.value) {
      showToast(
        "Member details missing. Please enter a valid ID Number first.",
        "error"
      );
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

    const { error } = await window.supabaseClient
      .from("contributions")
      .insert([payload]);

    toggleLoading(false);

    if (error) {
      showToast(error.message, "error");
    } else {
      // 3. Put 5 seconds on success message
      showToast(`Dues Recorded for ${payload.month}!`, "success", 5000);
      resetForm();
    }
  });

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
    Array.from(form.elements).forEach((i) => (i.disabled = show));
  }

  // Modified to accept a duration (defaults to 3000ms if not provided)
  function showToast(msg, type, duration = 3000) {
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerText = msg;
    document.getElementById("toastContainer").appendChild(t);
    setTimeout(() => t.remove(), duration);
  }

  // 4. Add vibrate and sound on successful scan
  function playSuccessFeedback() {
    // Vibrate phone for 200ms (if supported by device)
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }

    // Play a short beep using Web Audio API
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Pitch (A5)
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Volume

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15); // Duration: 150ms
    } catch (e) {
      console.log("Audio feedback not supported in this browser.");
    }
  }

  btnClear.addEventListener("click", resetForm);

  // --- ZXING QR SCANNER LOGIC (Updated for High-Res, Flash & Guide) ---
  const videoEl = document.getElementById("video");
  const btnToggleFlash = document.getElementById("btnToggleFlash");
  const cameraOverlay = document.getElementById("cameraOverlay");
  
  let codeReader = new ZXing.BrowserMultiFormatReader();
  let selectedDeviceId = null;
  let currentStream = null;
  let isFlashOn = false;

 btnScan.addEventListener("click", async () => {
    cameraOverlay.classList.remove("hidden");
    // We keep it visible now for testing, but dim it if not supported
    btnToggleFlash.style.opacity = "0.5"; 
    isFlashOn = false;

    try {
      const videoDevices = await codeReader.listVideoInputDevices();
      const backCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('environment')
      );
      
      selectedDeviceId = backCamera ? backCamera.deviceId : videoDevices[0].deviceId;

      const constraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          facingMode: "environment",
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          // Focus is key for small QR codes
          advanced: [{ focusMode: "continuous" }] 
        }
      };

      await codeReader.decodeFromConstraints(constraints, 'video', (result, err) => {
        if (result) {
          idInput.value = result.getText();
          idInput.dispatchEvent(new Event('input')); 
          playSuccessFeedback();
          showToast("QR Scanned Successfully", "success", 5000);
          stopScanner();
        }
      });

      // --- FLASH & FOCUS INITIALIZATION ---
      // We check multiple times because hardware takes a moment to respond
      const checkCapabilities = setInterval(() => {
        const track = videoEl.srcObject?.getVideoTracks()[0];
        if (track) {
          const caps = track.getCapabilities();
          
          // If the device supports flash, highlight the button
          if (caps && caps.torch) {
            btnToggleFlash.style.opacity = "1";
            btnToggleFlash.style.display = "block";
            clearInterval(checkCapabilities);
          }
          
          // Try to force the focus to be as sharp as possible
          if (caps && caps.focusMode?.includes('continuous')) {
             track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
          }
        }
      }, 500);

      // Stop checking after 5 seconds to save battery
      setTimeout(() => clearInterval(checkCapabilities), 5000);

    } catch (err) {
      console.error("Camera Error:", err);
      showToast("Camera Error: " + err.message, "error");
      stopScanner();
    }
  });
