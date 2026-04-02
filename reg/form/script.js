const SUPABASE_URL = "https://ayynblvknxuvazbwpxpm.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5eW5ibHZrbnh1dmF6YndweHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzk2NjEsImV4cCI6MjA4OTM1NTY2MX0.iQYNqs0W1YJB2PTxBUTOZnpKBl6FU0UVxJzDmyOEOmM";
const CLOUD_NAME = "dlte9ybza";
const CLOUDINARY_PRESET = "id_image_upload";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. if no Middle Name
function toggleMiddleName() {
  const middleInput = document.getElementById("middleName");
  const checkbox = document.getElementById("noMiddleName");

  if (checkbox.checked) {
    middleInput.value = "";
    middleInput.disabled = true;
    middleInput.removeAttribute("required");
  } else {
    middleInput.value = "";
    middleInput.disabled = false;
    middleInput.setAttribute("required", "required");
  }
}

// 2. if no Precint No.
function togglePrecintNo() {
  const precinctInput = document.getElementById("precinct");
  const checkbox = document.getElementById("noPrecint");

  if (checkbox.checked) {
    precinctInput.value = "";
    precinctInput.disabled = true;
    precinctInput.removeAttribute("required");
  } else {
    precinctInput.value = "";
    precinctInput.disabled = false;
    precinctInput.setAttribute("required", "required");
  }
}

// 3. Month convertion for form
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

// 4. Calculate age from MM/DD/YYYY
function getAge(birthDateString) {
  const today = new Date();
  const parts = birthDateString.split("/");
  if (parts.length !== 3) return 0;

  // Convert MM/DD/YYYY to Supabase Date object
  const birthDate = new Date(parts[2], parts[0] - 1, parts[1]);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// 5. Identify District per Barangay
function getDistrictInfo(barangayName) {
  const b = parseInt(barangayName);
  let name = "Unknown",
    code = "000";
  if (barangayName.toString().includes("176-")) {
    name = "Bagong Silang";
    code = "101";
  } else if (
    (b >= 1 && b <= 4) ||
    (b >= 77 && b <= 85) ||
    (b >= 132 && b <= 164)
  ) {
    name = "Dist. I South";
    code = "101";
  } else if (b >= 165 && b <= 177) {
    name = "Dist. I North";
    code = "101";
  } else if ((b >= 5 && b <= 76) || (b >= 86 && b <= 131)) {
    name = "Dist. II";
    code = "201";
  } else if (b >= 178 && b <= 188) {
    name = "Dist. III";
    code = "301";
  }
  return { name, code };
}

// 6. Photo Preview
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

  // 7. Barangay Format
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

  // 8. Dynamic Position Logic
  document.getElementById("barangay").addEventListener("change", async (e) => {
    const bInput = e.target.value.toUpperCase();
    const posSel = document.getElementById("position");
    posSel.disabled = true;
    posSel.innerHTML = "<option>Checking...</option>";
    const roles = [
      "Barangay Manager",
      "Asst. Barangay Manager",
      "Secretary",
      "Asst. Secretary",
      "Youth Coordinator",
      "Asst. Youth Coordinator",
      "Youth Secretary",
      "Asst. Youth Secretary"
    ];
    const { data } = await _supabase
      .from("members_data")
      .select("designation")
      .eq("barangay", bInput);
    const taken = data ? data.map((d) => d.designation) : [];
    const available = roles.filter((r) => !taken.includes(r));
    posSel.innerHTML = [...available, "Team Leader", "Family Member"]
      .map((p) => `<option value="${p}">${p}</option>`)
      .join("");
    posSel.disabled = false;
  });

  // 9. Form Submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 10. Age Checker
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
      const firstName = document.getElementById("firstName").value;
      const middleName = document.getElementById("middleName").value;
      const lastName = document.getElementById("lastName").value;
      const suffix = document.getElementById("suffix").value;
      const gender = document.getElementById("gender").value;
      const address = document.getElementById("address").value;
      const phone = document.getElementById("phone").value;
      const barangay = document.getElementById("barangay").value;
      const precinct = document.getElementById("precinct").value;
      const designation = document.getElementById("position").value;

      // 11. Cloudinary Upload
      const sanitize = (str) =>
        str
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");

      let fileName = `${sanitize(firstName)}_${sanitize(lastName)}`;

      if (suffix && suffix.trim() !== "") {
        fileName += `_${sanitize(suffix)}`;
      }

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

      if (!cRes.ok) {
        console.error("Cloudinary Error:", cData);
        throw new Error(cData.error?.message || "Upload failed");
      }

      // 12. ID Generation
      const dist = getDistrictInfo(barangay);
      const { count } = await _supabase
        .from("members_data")
        .select("*", { count: "exact", head: true });
      const memberID = `BK26-${dist.code}${(count + 1)
        .toString()
        .padStart(4, "0")}`;

      // 13. Referrer Logic
      const rFN = sessionStorage.getItem("referrerFirstName") || "";
      const rLN = sessionStorage.getItem("referrerLastName") || "";
      const rSX = sessionStorage.getItem("referrerSuffix") || "";
      const referrer =
        `${rFN} ${rLN} ${rSX}`.trim().replace(/\s+/g, " ") || "Unknown";

      // 14. Supabase Insert
      const payload = {
        id_number: memberID,
        qr_code: `https://quickchart.io/qr?text=${memberID}&size=500`,
        email_add: sessionStorage.getItem("registerEmail") || "",
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        suffix: suffix,
        gender: gender,
        birth_date: dobValue,
        address: address,
        phone_number: phone,
        district: dist.name,
        barangay: barangay,
        precint_no: precinct,
        referrer: referrer,
        picture: cData.secure_url,
        designation: designation,
        status: "Active"
      };

      const { error } = await _supabase
        .from("kbk_membership_data")
        .insert([payload]);
      if (error) throw error;

      // 15. Store Data for Form Page
      sessionStorage.setItem(
        "registeredMember",
        JSON.stringify({
          ...payload,
          timestamp: formatMMM(new Date())
        })
      );

      // 16. SUCCESS UI
      document.getElementById("spinner").style.display = "none";
      document.getElementById("overlayTitle").innerText = "Success!";
      document.getElementById("overlayText").innerText = "Your details has been successfully recorded click Close to view confirmation";
      document.getElementById("closeBtn").style.display = "block";
    } catch (err) {
      console.error(err);
      alert(err.message);
      document.getElementById("loadingOverlay").style.display = "none";
    }
  });
});

function showTab(id) {
  // Remove active from all tabs
  document
    .querySelectorAll(".tab-content")
    .forEach((t) => t.classList.remove("active"));

  // Show selected tab
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
}
