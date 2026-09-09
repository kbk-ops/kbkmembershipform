const SUPABASE_URL = "https://ayynblvknxuvazbwpxpm.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5eW5ibHZrbnh1dmF6YndweHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzk2NjEsImV4cCI6MjA4OTM1NTY2MX0.iQYNqs0W1YJB2PTxBUTOZnpKBl6FU0UVxJzDmyOEOmM";

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

async function getUser() {
  const {
    data: { user },
    error
  } = await window.supabaseClient.auth.getUser();
  return error ? null : user;
}

// --- App State ---
const state = {
  currentPage: 1,
  limit: 10,
  totalCount: 0,
  searchQuery: "",
  isLoading: false
};

// --- DOM Elements ---
const DOM = {
  searchInput: document.getElementById("searchInput"),
  inactiveMsg: document.getElementById("inactiveErrorMsg"),
  grid: document.getElementById("membersGrid"),
  emptyState: document.getElementById("emptyState"),
  pagination: document.getElementById("pagination"),
  modal: document.getElementById("detailsModal"),
  modalBody: document.getElementById("modalBody"),
  closeModalBtn: document.getElementById("closeModal"),
  username: document.getElementById("username")
};

// --- Helper Functions ---

// Default generic avatar SVG data URI
const DEFAULT_AVATAR =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzY2NiI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYzAtMi42Ni01LjMzLTQtOC00eiIvPjwvc3ZnPg==";

function isNullOrEmpty(val) {
  if (!val) return true;
  const str = String(val).trim().toLowerCase();
  return str === "n/a" || str === "none" || str === "null";
}

function cleanString(val) {
  return isNullOrEmpty(val) ? null : String(val).trim();
}

function optimizeCloudinaryUrl(url) {
  if (!url) return DEFAULT_AVATAR;
  if (url.includes("cloudinary.com") && url.includes("/upload/")) {
    return url.replace("/upload/", "/upload/w_150,h_150,c_fill,q_auto,f_auto/");
  }
  return url;
}

function formatFullName(first, middle, last, suffix) {
  const f = cleanString(first) || "";
  const m = cleanString(middle);
  const l = cleanString(last) || "";
  const s = cleanString(suffix);

  const mi = m ? `${m.charAt(0).toUpperCase()}.` : "";
  const suf = s ? s : "";

  return `${f} ${mi} ${l} ${suf}`.replace(/\s+/g, " ").trim();
}

// Custom Debounce
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// --- Rendering Functions ---

function renderSkeletons() {
  DOM.grid.innerHTML = "";
  for (let i = 0; i < state.limit; i++) {
    DOM.grid.innerHTML += `
      <div class="member-card glass-panel" style="pointer-events: none;">
        <div class="skeleton skeleton-avatar"></div>
        <div class="card-info" style="width: 100%;">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text short"></div>
          <div class="skeleton skeleton-text short"></div>
        </div>
      </div>
    `;
  }
  DOM.emptyState.classList.add("hidden");
}

function renderMembers(members) {
  DOM.grid.innerHTML = "";

  if (members.length === 0) {
    DOM.emptyState.classList.remove("hidden");
    return;
  }

  DOM.emptyState.classList.add("hidden");

  members.forEach((member) => {
    const fullName = formatFullName(
      member.first_name,
      member.middle_name,
      member.last_name,
      member.suffix
    );
    const avatar = optimizeCloudinaryUrl(member.picture);

    const card = document.createElement("div");
    card.className = "member-card glass-panel";
    card.innerHTML = `
      <img src="${avatar}" alt="${fullName}" class="card-avatar" loading="lazy" onerror="this.src='${DEFAULT_AVATAR}'">
      <div class="card-info">
        <span class="card-name">${fullName}</span>
        <span class="card-id">${member.id_number}</span>
        <span class="card-barangay">${
          cleanString(member.barangay) || "Barangay N/A"
        }</span>
      </div>
    `;

    card.addEventListener("click", () => openModal(member, fullName, avatar));
    DOM.grid.appendChild(card);
  });
}

function renderPagination() {
  DOM.pagination.innerHTML = "";
  const totalPages = Math.ceil(state.totalCount / state.limit);
  if (totalPages <= 1) return;

  const createBtn = (text, page, disabled = false, active = false) => {
    const btn = document.createElement("button");
    btn.className = `page-btn ${active ? "active" : ""}`;
    btn.innerHTML = text;
    btn.disabled = disabled;
    btn.addEventListener("click", () => {
      state.currentPage = page;
      fetchData();
    });
    return btn;
  };

  DOM.pagination.appendChild(createBtn("<<", 1, state.currentPage === 1));
  DOM.pagination.appendChild(
    createBtn("<", state.currentPage - 1, state.currentPage === 1)
  );

  // Determine window of pages to show
  let startPage = Math.max(1, state.currentPage - 1);
  let endPage = Math.min(totalPages, startPage + 2);
  if (endPage - startPage < 2 && startPage > 1) {
    startPage = endPage - 2;
  }

  for (let i = startPage; i <= endPage; i++) {
    DOM.pagination.appendChild(createBtn(i, i, false, i === state.currentPage));
  }

  DOM.pagination.appendChild(
    createBtn(">", state.currentPage + 1, state.currentPage === totalPages)
  );
  DOM.pagination.appendChild(
    createBtn(">>", totalPages, state.currentPage === totalPages)
  );
}

// --- Modal Handling ---

function openModal(member, fullName, avatar) {
  const fNameWithSuffix = `${cleanString(member.first_name) || ""} ${
    cleanString(member.suffix) || ""
  }`.trim();

  DOM.modalBody.innerHTML = `
    <img src="${avatar}" alt="Profile" class="modal-avatar" onerror="this.src='${DEFAULT_AVATAR}'">
    <div class="modal-id">${member.id_number}</div>
    <div class="modal-details">
      <div class="detail-row">
        <span class="detail-label">Last Name</span>
        <span class="detail-value">${
          cleanString(member.last_name) || "N/A"
        }</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">First Name</span>
        <span class="detail-value">${fNameWithSuffix || "N/A"}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Middle Name</span>
        <span class="detail-value">${
          cleanString(member.middle_name) || "N/A"
        }</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Barangay</span>
        <span class="detail-value">${
          cleanString(member.barangay) || "N/A"
        }</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Position</span>
        <span class="detail-value">${
          cleanString(member.designation) || "N/A"
        }</span>
      </div>
    </div>
  `;
  DOM.modal.classList.remove("hidden");
}

DOM.closeModalBtn.addEventListener("click", () =>
  DOM.modal.classList.add("hidden")
);
DOM.modal.addEventListener("click", (e) => {
  if (e.target === DOM.modal) DOM.modal.classList.add("hidden");
});

// --- Data Fetching & Logic ---

async function checkInactiveSpecialCase(query) {
  if (!query) return false;

  const { data, error } = await window.supabaseClient
    .from("members_data")
    .select("status")
    .eq("id_number", query)
    .maybeSingle();

  if (data && data.status === "Deactivated") {
    DOM.inactiveMsg.classList.remove("hidden");
    return true;
  }

  DOM.inactiveMsg.classList.add("hidden");
  return false;
}

async function fetchData() {
  state.isLoading = true;
  renderSkeletons();

  const from = (state.currentPage - 1) * state.limit;
  const to = from + state.limit - 1;
  const q = state.searchQuery.trim();

  // 1. Check for Inactive ID special case
  await checkInactiveSpecialCase(q);

  // 2. Build Query for Active Members
  let queryBuilder = window.supabaseClient
    .from("members_data")
    .select("*", { count: "exact" })
    .eq("status", "Active");

  if (q) {
    // "Fuzzy" simulation: Splitting input slightly aids basic ilike matching for typo tolerance
    const tokens = q.split(" ").filter((t) => t.length > 0);
    if (tokens.length === 1) {
      queryBuilder = queryBuilder.or(
        `id_number.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`
      );
    } else {
      // Broaden search to match multi-part names
      queryBuilder = queryBuilder.or(
        `first_name.ilike.%${tokens[0]}%,last_name.ilike.%${
          tokens[tokens.length - 1]
        }%`
      );
    }
  }

  const { data, count, error } = await queryBuilder.range(from, to);

  if (error) {
    console.error("Error fetching data:", error);
    renderMembers([]);
    state.totalCount = 0;
  } else {
    state.totalCount = count || 0;
    renderMembers(data);
  }

  renderPagination();
  state.isLoading = false;
}

// --- Event Listeners & Init ---

const handleSearch = debounce((e) => {
  state.searchQuery = e.target.value;
  state.currentPage = 1;
  fetchData();
}, 400);

DOM.searchInput.addEventListener("input", handleSearch);

// Run on page load
document.addEventListener("DOMContentLoaded", async () => {
  if (window.initAuthGuard) {
    await window.initAuthGuard();
  }

  const user = await getUser();
  if (user) {
    if (DOM.username) DOM.username.innerText = user.email || "User";
  }

  // Initial Fetch
  fetchData();
});