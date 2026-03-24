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

  // --- FORM SUBMISSION VALIDATION ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!nameInput.value || !barangayInput.value || !districtInput.value) {
      showToast("Member details missing. Please enter a valid ID Number first.", "error");
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

    toggleLoading(true);

    if (error) {
      showToast(error.message, "error");
      toggleLoading(false);
    } else {
      showToast(`Dues Recorded for ${payload.month}!`, "success", 5000); // 5 Seconds Success
      toggleLoading(false);
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

  function showToast(msg, type, duration = 3000) {
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerText = msg;
    document.getElementById("toastContainer").appendChild(t);
    setTimeout(() => t.remove(), duration);
  }

  function playSuccessFeedback() {
    if (navigator.vibrate) {
      navigator.vibrate(200); // Vibrate
    }

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); 

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15); // Beep Sound
    } catch (e) {
      console.log("Audio feedback not supported.");
    }
  }

  btnClear.addEventListener("click", resetForm);

  // --- 🛠️ UPDATED HIGH-RES SCANNER LOGIC ---
  const videoEl = document.getElementById("video");
  const btnToggleFlash = document.getElementById("btnToggleFlash");
  const cameraOverlay = document.getElementById("cameraOverlay");
  
  let codeReader = new ZXing.BrowserMultiFormatReader();
  let localStream = null;
  let isFlashOn = false;

  btnScan.addEventListener("click", async () => {
    cameraOverlay.classList.remove("hidden");
    btnToggleFlash.style.display = "none"; // Hide initially
    isFlashOn = false;

    try {
      // Find the back/environment camera
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const backCamera = videoDevices.find(d => 
        d.label.toLowerCase().includes('back') || 
        d.label.toLowerCase().includes('environment')
      );
      
      const constraints = {
        video: {
          deviceId: backCamera ? { exact: backCamera.deviceId } : undefined,
          facingMode: "environment",
          width: { ideal: 1280 }, // 720p captures details without processing lag
          height: { ideal: 720 }
        }
      };

      // 1. Manually capture stream so we can bind it and read capabilities
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoEl.srcObject = localStream;
      videoEl.setAttribute("playsinline", "true"); 
      await videoEl.play();

      // 2. Read flashlight (Torch) capabilities from live track
      const track = localStream.getVideoTracks()[0];
      if (track && track.getCapabilities) {
        const capabilities = track.getCapabilities();
        if (capabilities.torch) {
          btnToggleFlash.style.display = "block";
          btnToggleFlash.innerText = "🔦 Flash: OFF";
          btnToggleFlash.style.backgroundColor = "#333";
        }
      }

      // 3. Set Continuous Focus if possible
      if (track && track.applyConstraints) {
        track.applyConstraints({
          advanced: [{ focusMode: "continuous" }]
        }).catch(() => {}); 
      }

      // 4. Pass existing stream to ZXing to decode
      codeReader.decodeFromVideoElement(videoEl, (result, err) => {
        if (result) {
          idInput.value = result.getText();
          idInput.dispatchEvent(new Event("input"));

          playSuccessFeedback(); 
          showToast("QR Scanned Successfully", "success", 5000); 
          stopScanner();
        }
      });

    } catch (err) {
      console.error("Camera access failed:", err);
      showToast("Camera Error: " + err.message, "error");
      stopScanner();
    }
  });

  // Flashlight Toggle Logic
  btnToggleFlash.addEventListener("click", async () => {
    if (!localStream) return;
    const track = localStream.getVideoTracks()[0];
    
    if (track) {
      try {
        isFlashOn = !isFlashOn;
        await track.applyConstraints({
          advanced: [{ torch: isFlashOn }]
        });
        
        btnToggleFlash.innerText = isFlashOn ? "🔦 Flash: ON" : "🔦 Flash: OFF";
        btnToggleFlash.style.backgroundColor = isFlashOn ? "#27ae60" : "#333"; 
      } catch (err) {
        showToast("Flash toggle failed.", "error");
      }
    }
  });

  function stopScanner() {
    if (codeReader) {
      codeReader.reset();
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    videoEl.srcObject = null;
    cameraOverlay.classList.add("hidden");
  }

  document.getElementById("btnCloseCamera").addEventListener("click", stopScanner);
});
