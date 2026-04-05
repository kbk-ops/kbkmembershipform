const EDGE_FUNCTION_URL =
  "https://ayynblvknxuvazbwpxpm.supabase.co/functions/v1/create-member";
const CLOUD_NAME = "dlte9ybza";
const CLOUDINARY_PRESET = "id_image_upload";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

// Form Helpers
function toggleMiddleName() {
  const middleInput = document.getElementById("middleName");
  const checkbox = document.getElementById("noMiddleName");

  if (checkbox.checked) {
    middleInput.value = "";
    middleInput.disabled = true;
    middleInput.removeAttribute("required");
  } else {
    middleInput.disabled = false;
    middleInput.setAttribute("required", "required");
  }
}

function togglePrecintNo() {
  const precinctInput = document.getElementById("precinct");
  const checkbox = document.getElementById("noPrecint");

  if (checkbox.checked) {
    precinctInput.value = "";
    precinctInput.disabled = true;
    precinctInput.removeAttribute("required");
  } else {
    precinctInput.disabled = false;
    precinctInput.setAttribute("required", "required");
  }
}

const titleCase = (str) =>
  str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const formatMMM = (date) => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  const d = new Date(date);
  return `${months[d.getMonth()]}-${String(d.getDate()).padStart(
    2,
    "0"
  )}-${d.getFullYear()}`;
};

function getAge(birthDateString) {
  const today = new Date();
  const parts = birthDateString.split("/");
  if (parts.length !== 3) return 0;
  const birthDate = new Date(parts[2], parts[0] - 1, parts[1]);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function showTab(id) {
  document
    .querySelectorAll(".tab-content")
    .forEach((t) => t.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("memberForm");
  const photoInput = document.getElementById("photoInput");
  const previewArea = document.getElementById("previewArea");
  let base64Image = "";

  // Field Formatting Listeners
  ["firstName", "middleName", "lastName"].forEach((id) => {
    document
      .getElementById(id)
      .addEventListener(
        "input",
        (e) => (e.target.value = titleCase(e.target.value))
      );
  });

  document.getElementById("dob").addEventListener("input", (e) => {
    let v = e.target.value.replace(/\D/g, "");
    let f = "";
    if (v.length > 0) f += v.slice(0, 2);
    if (v.length > 2) f += "/" + v.slice(2, 4);
    if (v.length > 4) f += "/" + v.slice(4, 8);
    e.target.value = f;
  });

  document.getElementById("barangay").addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase();
  });

  document.getElementById("address").addEventListener("blur", (e) => {
    let val = e.target.value
      .replace(/(caloocan|city|kalookan)/gi, "")
      .replace(/,\s*,/g, ",")
      .trim();
    if (val)
      e.target.value = titleCase(val.replace(/,+$/, "")) + " Caloocan City";
  });

  document
    .getElementById("precinct")
    .addEventListener(
      "input",
      (e) => (e.target.value = e.target.value.toUpperCase())
    );

  // Image Preview
  photoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext("2d");
        let s = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - s) / 2,
          (img.height - s) / 2,
          s,
          s,
          0,
          0,
          300,
          300
        );
        base64Image = canvas.toDataURL("image/jpeg");
        previewArea.innerHTML = `<img src="${base64Image}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`;
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Dynamic Position Fetching (Connected to Edge Function)
  document.getElementById("barangay").addEventListener("change", async (e) => {
    const bInput = e.target.value.toUpperCase();
    const posSel = document.getElementById("position");

    posSel.disabled = true;
    posSel.innerHTML = "<option>Checking...</option>";

    try {
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getPositions",
          payload: { barangay: bInput }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      posSel.innerHTML = data.positions
        .map((p) => `<option value="${p}">${p}</option>`)
        .join("");
      posSel.disabled = false;
    } catch (err) {
      console.error(err);
      posSel.innerHTML = `<option>Error loading positions</option>`;
    }
  });

  // Form Submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dobValue = document.getElementById("dob").value;
    const currentAge = getAge(dobValue);

    if (currentAge < 15) {
      alert(
        `Registration Failed: You must be at least 15 years old. (Current Age: ${currentAge})`
      );
      return;
    }

    if (!base64Image) return alert("Photo required");

    document.getElementById("loadingOverlay").style.display = "flex";

    try {
      // 1. Setup values early for validation
      const firstName = document.getElementById("firstName").value;
      const middleName = document.getElementById("middleName").value;
      const lastName = document.getElementById("lastName").value;
      const suffix = document.getElementById("suffix").value;

      // ==========================================
      // NEW STEP: Pre-validate with Edge Function
      // ==========================================
      const checkRes = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkDuplicate",
          payload: {
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
            suffix: suffix
          }
        })
      });

      const checkData = await checkRes.json();
      if (!checkRes.ok) throw new Error(checkData.error || "Validation failed");

      // If a duplicate is found, abort before Cloudinary is touched
      if (checkData.isDuplicate) {
        throw new Error("Member with this exact name already exists.");
      }

      // 2. Cloudinary Upload (Will only execute if validation passes)
      const sanitize = (str) =>
        str
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");
      let fileName = `${sanitize(firstName)}_${sanitize(lastName)}`;
      if (suffix && suffix.trim() !== "") fileName += `_${sanitize(suffix)}`;
      fileName += `_${Date.now()}`;

      const formData = new FormData();
      formData.append("file", base64Image);
      formData.append("upload_preset", CLOUDINARY_PRESET);
      formData.append("public_id", fileName);
      formData.append("folder", "Profile/Picture");

      const cRes = await fetch(CLOUDINARY_URL, {
        method: "POST",
        body: formData
      });
      const cData = await cRes.json();
      if (!cRes.ok)
        throw new Error(cData.error?.message || "Image upload failed");

      // 3. Prepare payload for Edge Function
      const rFN = sessionStorage.getItem("referrerFirstName") || "";
      const rLN = sessionStorage.getItem("referrerLastName") || "";
      const rSX = sessionStorage.getItem("referrerSuffix") || "";
      const referrer =
        `${rFN} ${rLN} ${rSX}`.trim().replace(/\s+/g, " ") || "Unknown";

      const payload = {
        email_add: sessionStorage.getItem("registerEmail") || "",
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        suffix: suffix,
        gender: document.getElementById("gender").value,
        birth_date: dobValue,
        address: document.getElementById("address").value,
        phone_number: document.getElementById("phone").value,
        barangay: document.getElementById("barangay").value,
        precint_no: document.getElementById("precinct").value,
        designation: document.getElementById("position").value,
        referrer: referrer,
        picture: cData.secure_url
      };

      // 4. Submit to Edge Function (Final save)
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "registerMember", payload: payload })
      });

      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error);

      // 5. Success Handling
      sessionStorage.setItem(
        "registeredMember",
        JSON.stringify({
          ...responseData.member,
          timestamp: formatMMM(new Date())
        })
      );

      document.getElementById("spinner").style.display = "none";
      document.getElementById("overlayTitle").innerText = "Success!";
      document.getElementById("overlayText").innerText =
        "Your details have been successfully recorded. Click Close to view confirmation.";
      document.getElementById("closeBtn").style.display = "block";
    } catch (err) {
      console.error(err);
      alert(err.message);
      document.getElementById("loadingOverlay").style.display = "none";
    }
  });
});
