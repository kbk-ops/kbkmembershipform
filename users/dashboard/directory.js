const state = {
  members: [],
  currentPage: 1,
  totalPages: 1,
  limit: 50,
  searchTerm: "",
  isEditMode: false,
  selectedMember: null
};

// Form Configuration Definitions
const fields = [
  { key: "first_name", label: "First Name", type: "text" },
  { key: "middle_name", label: "Middle Name", type: "text" },
  { key: "last_name", label: "Last Name", type: "text" },
  { key: "suffix", label: "Suffix", type: "text" },
  {
    key: "email_add",
    label: "E-mail Address",
    type: "email",
    isLink: true,
    prefix: "mailto:"
  },
  {
    key: "phone_number",
    label: "Mobile Number",
    type: "tel",
    isLink: true,
    prefix: "tel:"
  },
  { key: "birth_date", label: "Date of Birth", type: "date" },
  { key: "gender", label: "Gender", type: "text" },
  { key: "address", label: "Address", type: "text", class: "full-width" },
  { key: "district", label: "District", type: "text" },
  { key: "barangay", label: "Barangay", type: "text" },
  { key: "precint_no", label: "Precint Number", type: "text" },
  { key: "referrer", label: "Referrer", type: "text" },
  {
    key: "designation",
    label: "Position",
    type: "select",
    options: [
	  "President",
	  "Vice-President",
	  "Sec. Gen.",
	  "Treasurer",
	  "Auditor",
      "Barangay Manager",
      "Asst. Barangay Manager",
      "Secretary",
      "Asst. Secretary",
      "Youth Coordinator",
      "Asst. Youth Coordinator",
      "Youth Secretary",
      "Asst. Youth Secretary",
      "Team Leader",
      "Family Member",
      "Member"
    ]
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["Active", "Deactivated"]
  }
];

// Helper functions
async function getUser() {
  const {
    data: { user },
    error
  } = await window.supabaseClient.auth.getUser();
  return error ? null : user;
}

const isNullVal = (val) =>
  !val || ["n/a", "none", "na", ""].includes(String(val).trim().toLowerCase());

function formatName(first, middle, last, suffix) {
  const mi = !isNullVal(middle) ? ` ${String(middle).trim().charAt(0)}.` : "";
  const suf = !isNullVal(suffix) ? ` ${String(suffix).trim()}` : "";
  return `${first || ""}${mi} ${last || ""}${suf}`.trim();
}

function getAvatarHtml(url, className = "card-avatar") {
  const defaultSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
  if (!url || isNullVal(url))
    return `<div class="${className}">${defaultSvg}</div>`;

  let optimizedUrl = url;
  if (url.includes("cloudinary.com")) {
    optimizedUrl = url.replace(
      "/upload/",
      "/upload/c_fill,w_100,h_100,q_auto,f_auto/"
    );
  }
  return `<div class="${className}"><img src="${optimizedUrl}" alt="Profile Picture" loading="lazy" onerror="this.outerHTML='${defaultSvg}</div>`;
}

// Debounce Function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Fetch Data
async function fetchMembers(page = 1, search = "") {
  renderSkeletons();

  const start = (page - 1) * state.limit;
  const end = start + state.limit - 1;

  let query = window.supabaseClient
    .from("members_data")
    .select("*", { count: "exact" });

  if (search) {
    // Simulate fuzzy search via ILIKE with wildcards
    const fuzzyTerm = `%${search.split("").join("%")}%`;
    const exactTerm = `%${search}%`;
    query = query.or(
      `id_number.ilike.${exactTerm},first_name.ilike.${fuzzyTerm},last_name.ilike.${fuzzyTerm}`
    );
  }

  query = query.range(start, end).order("first_name", { ascending: true });

  const { data, count, error } = await query;

  if (error) {
    console.error("Error fetching data:", error);
    return;
  }

  state.members = data;
  state.totalPages = Math.ceil(count / state.limit) || 1;
  state.currentPage = page;

  renderList();
  renderPagination();
}

// UI Renderers
function renderSkeletons() {
  const container = document.getElementById("listContainer");
  container.innerHTML = "";
  document.getElementById("emptyState").classList.add("hidden");
  document.getElementById("paginationContainer").classList.add("hidden");

  for (let i = 0; i < 6; i++) {
    container.innerHTML += `
      <div class="member-card glass-panel">
        <div class="skeleton skeleton-avatar"></div>
        <div class="card-info" style="width: 100%">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text short"></div>
          <div class="skeleton skeleton-text short"></div>
        </div>
      </div>
    `;
  }
}

function renderList() {
  const container = document.getElementById("listContainer");
  const emptyState = document.getElementById("emptyState");
  container.innerHTML = "";

  if (state.members.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  state.members.forEach((member, index) => {
    const fullName = formatName(
      member.first_name,
      member.middle_name,
      member.last_name,
      member.suffix
    );
    const card = document.createElement("div");
    card.className = "member-card glass-panel";
    card.innerHTML = `
      ${getAvatarHtml(member.picture)}
      <div class="card-info">
        <h3>${fullName || "Unknown Name"}</h3>
        <span>ID: ${member.id_number}</span>
        <span>Brgy: ${member.barangay || "N/A"}</span>
      </div>
    `;
    card.addEventListener("click", () => openDetails(index));
    container.appendChild(card);
  });
}

function renderPagination() {
  const container = document.getElementById("paginationContainer");
  if (state.totalPages <= 1) {
    container.classList.add("hidden");
    return;
  }

  container.classList.remove("hidden");
  container.innerHTML = `
    <button onclick="fetchMembers(1, state.searchTerm)" ${
      state.currentPage === 1 ? "disabled" : ""
    }>&laquo;&laquo;</button>
    <button onclick="fetchMembers(${
      state.currentPage - 1
    }, state.searchTerm)" ${
    state.currentPage === 1 ? "disabled" : ""
  }>&laquo;</button>
  `;

  // Simple visible page window logic
  let startPage = Math.max(1, state.currentPage - 1);
  let endPage = Math.min(state.totalPages, startPage + 2);
  startPage = Math.max(1, endPage - 2);

  for (let i = startPage; i <= endPage; i++) {
    container.innerHTML += `<button onclick="fetchMembers(${i}, state.searchTerm)" class="${
      i === state.currentPage ? "active" : ""
    }">${i}</button>`;
  }

  container.innerHTML += `
    <button onclick="fetchMembers(${
      state.currentPage + 1
    }, state.searchTerm)" ${
    state.currentPage === state.totalPages ? "disabled" : ""
  }>&raquo;</button>
    <button onclick="fetchMembers(${state.totalPages}, state.searchTerm)" ${
    state.currentPage === state.totalPages ? "disabled" : ""
  }>&raquo;&raquo;</button>
  `;
}

// Details Modal Logic
function buildFormFields() {
  const form = document.querySelector(".form-grid");
  form.innerHTML = "";

  fields.forEach((f) => {
    const group = document.createElement("div");
    group.className = `form-group ${f.class || ""}`;

    let inputHtml = "";
    if (f.type === "select") {
      const options = f.options
        .map((o) => `<option value="${o}">${o}</option>`)
        .join("");
      inputHtml = `<select id="input_${f.key}" disabled>${options}</select>`;
    } else {
      inputHtml = `<input type="${f.type}" id="input_${f.key}" readonly />`;
      if (f.isLink) {
        // Create a wrapper so link is visible in readonly, but turns to input in edit mode
        inputHtml = `
           <div id="wrapper_${f.key}">
             <a href="#" id="link_${f.key}" class="clickable-link"></a>
             <input type="${f.type}" id="input_${f.key}" readonly class="hidden"/>
           </div>
         `;
      }
    }

    group.innerHTML = `<label>${f.label}</label>${inputHtml}`;
    form.appendChild(group);
  });
}

function openDetails(index) {
  state.selectedMember = { ...state.members[index] };
  const member = state.selectedMember;

  document.getElementById("detailAvatar").innerHTML = getAvatarHtml(
    member.picture,
    ""
  );
  document.getElementById("detailIdNumber").innerText = member.id_number;

  fields.forEach((f) => {
    const val = isNullVal(member[f.key]) ? "" : member[f.key];
    const input = document.getElementById(`input_${f.key}`);

    if (f.isLink) {
      const link = document.getElementById(`link_${f.key}`);
      if (val) {
        link.innerText = val;
        link.href = `${f.prefix}${val}`;
        link.classList.remove("hidden");
        input.classList.add("hidden");
      } else {
        link.classList.add("hidden");
        input.classList.remove("hidden");
      }
      input.value = val;
    } else {
      input.value = val;
    }
  });

  setEditMode(false);
  document.getElementById("detailsModal").classList.remove("hidden");
}

function setEditMode(isEdit) {
  state.isEditMode = isEdit;
  const modalContent = document.querySelector(".modal-content");
  const saveBtn = document.getElementById("saveBtn");
  const editBtn = document.getElementById("editBtn");

  if (isEdit) {
    modalContent.classList.add("edit-mode");
    saveBtn.classList.remove("hidden");
    editBtn.classList.add("hidden");

    fields.forEach((f) => {
      const input = document.getElementById(`input_${f.key}`);
      if (f.type === "select") input.removeAttribute("disabled");
      else input.removeAttribute("readonly");

      if (f.isLink) {
        document.getElementById(`link_${f.key}`).classList.add("hidden");
        input.classList.remove("hidden");
      }
    });
  } else {
    modalContent.classList.remove("edit-mode");
    saveBtn.classList.add("hidden");
    editBtn.classList.remove("hidden");

    fields.forEach((f) => {
      const input = document.getElementById(`input_${f.key}`);
      if (f.type === "select") input.setAttribute("disabled", "true");
      else input.setAttribute("readonly", "true");

      if (f.isLink) {
        const link = document.getElementById(`link_${f.key}`);
        if (input.value) {
          link.innerText = input.value;
          link.href = `${f.prefix}${input.value}`;
          link.classList.remove("hidden");
          input.classList.add("hidden");
        }
      }
    });
  }
}

async function saveChanges() {
  const updates = {};
  fields.forEach((f) => {
    updates[f.key] = document.getElementById(`input_${f.key}`).value || null;
  });

  const saveBtn = document.getElementById("saveBtn");
  saveBtn.innerText = "Saving...";
  saveBtn.disabled = true;

  const { error } = await window.supabaseClient
    .from("members_data")
    .update(updates)
    .eq("id_number", state.selectedMember.id_number);

  saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save`;
  saveBtn.disabled = false;

  if (!error) {
    setEditMode(false);
    fetchMembers(state.currentPage, state.searchTerm);
  } else {
    alert("Error updating record: " + error.message);
  }
}

// Event Listeners
document.addEventListener("DOMContentLoaded", async () => {
  if (window.initAuthGuard) await window.initAuthGuard();

  const user = await getUser();
  if (user) {
    const usernameEl = document.getElementById("username");
    if (usernameEl) usernameEl.innerText = user.email;
  }

  buildFormFields();
  fetchMembers(1, "");

  // Search input with debounce
  const searchInput = document.getElementById("searchInput");
  const handleSearch = debounce((e) => {
    state.searchTerm = e.target.value;
    fetchMembers(1, state.searchTerm);
  }, 400);

  searchInput.addEventListener("input", handleSearch);

  // Modal interactions
  document.getElementById("closeModal").addEventListener("click", () => {
    document.getElementById("detailsModal").classList.add("hidden");
  });

  document.getElementById("modalOverlay").addEventListener("click", () => {
    document.getElementById("detailsModal").classList.add("hidden");
  });

  document
    .getElementById("editBtn")
    .addEventListener("click", () => setEditMode(true));
  document.getElementById("saveBtn").addEventListener("click", saveChanges);
});
