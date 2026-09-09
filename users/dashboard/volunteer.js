document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const idNumberInput = document.getElementById("idNumber");
  const memberNameInput = document.getElementById("memberName");
  const volunteerRoleInput = document.getElementById("volunteerRole");
  const submitBtn = document.getElementById("submitBtn");
  const btnText = document.querySelector(".btn-text");
  const spinner = document.querySelector(".spinner");
  const toastContainer = document.getElementById("toastContainer");
  const volunteerForm = document.getElementById("volunteerForm");

  // State
  let currentMember = null;
  let debounceTimeout = null;

  // Constants based on instructions
  const EVENT_NAME = "KBKAI Bingo Social";
  const EVENT_DATE = "04/19/2025";

  // ---- Toast Notification ----
  const showToast = (message, type = "success") => {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("fade-out");
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  };

  // ---- Format Name ----
  const formatName = (first, middle, last, suffix) => {
    let m = "";
    if (middle && middle.trim() !== "") {
      const midStr = middle.trim().toUpperCase();
      if (midStr !== "N/A" && midStr !== "NONE") {
        m = middle.trim().charAt(0).toUpperCase() + ". ";
      }
    }
    const sfx = suffix && suffix.trim() !== "" ? ` ${suffix.trim()}` : "";
    // Combine and collapse multiple spaces safely
    const rawName = `${first} ${m}${last}${sfx}`;
    return rawName.replace(/\s+/g, " ").trim();
  };

  // ---- Logic: Handle ID Input & Fetch Supabase ----
  const validateAndFetchMember = async (idValue) => {
    // Reset state initially
    currentMember = null;
    memberNameInput.value = "";
    submitBtn.disabled = true;

    if (!idValue) return;

    try {
      const { data, error } = await window.supabaseClient
        .from("members_data")
        .select("*")
        .eq("id_number", idValue)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        showToast("Member not found", "error");
        return;
      }

      if (data.status !== "Active") {
        showToast("Only active members can sign up", "error");
        return;
      }

      // Valid Active Member
      currentMember = data;
      memberNameInput.value = formatName(
        data.first_name,
        data.middle_name,
        data.last_name,
        data.suffix
      );

      checkFormCompletion();
    } catch (err) {
      console.error("Error fetching member:", err);
      showToast("Error verifying ID", "error");
    }
  };

  // Debounce input to avoid spamming the database
  idNumberInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimeout);
    submitBtn.disabled = true;

    const val = e.target.value.trim();
    if (val.length > 11) {
      debounceTimeout = setTimeout(() => validateAndFetchMember(val), 600);
    } else {
      currentMember = null;
      memberNameInput.value = "";
    }
  });

  // Enable button only if inputs are valid
  const checkFormCompletion = () => {
    if (currentMember && volunteerRoleInput.value !== "") {
      submitBtn.disabled = false;
    } else {
      submitBtn.disabled = true;
    }
  };

  volunteerRoleInput.addEventListener("change", checkFormCompletion);

  // ---- Logic: Handle Form Submission ----
  volunteerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentMember || !volunteerRoleInput.value) return;

    // UI Loading State
    submitBtn.disabled = true;
    btnText.classList.add("hidden");
    spinner.classList.remove("hidden");

    try {
      // 1. Check for duplicates
      const {
        data: existingEntry,
        error: dupError
      } = await window.supabaseClient
        .from("volunteer_hub")
        .select("volunteer_id")
        .eq("id_number", currentMember.id_number)
        .eq("event_name", EVENT_NAME)
        .maybeSingle();

      if (dupError) throw dupError;

      if (existingEntry) {
        showToast("Already registered for this event", "error");
        return;
      }

      // 2. Insert into volunteer_hub
      const payload = {
        id_number: currentMember.id_number,
        name: memberNameInput.value,
        barangay: currentMember.barangay,
        district: currentMember.district,
        event_name: EVENT_NAME,
        event_date: EVENT_DATE,
        volunteer_as: volunteerRoleInput.value
      };

      const { error: insertError } = await window.supabaseClient
        .from("volunteer_hub")
        .insert([payload]);

      if (insertError) throw insertError;

      // 3. Success State
      showToast("Successfully registered as a volunteer!", "success");

      // Reset Form completely
      volunteerForm.reset();
      currentMember = null;
      submitBtn.disabled = true;

      // Blur the select element to reset its floating label state correctly
      volunteerRoleInput.blur();
    } catch (err) {
      console.error("Submission error:", err);
      showToast("Error processing registration", "error");
    } finally {
      // Reset UI Loading State
      btnText.classList.remove("hidden");
      spinner.classList.add("hidden");
      // Keep disabled if currentMember was cleared
      if (!currentMember) submitBtn.disabled = true;
    }
  });
});