Chart.register(ChartDataLabels);

let globalMembers = [];
let globalContributions = new Set();
let filteredData = [];
let currentDashboardData = [];
let currentUserRole = null;
let currentProfileData = null;
let currentUserRolesTable = null;
let currentPage = 1;
const ROWS_PER_PAGE = 100;
let currentSort = { column: "first_name", asc: true };

let ageChartInstance = null;
let genderChartInstance = null;

// Safe Base64 SVG to prevent HTML attribute breaking
const fallbackAvatarBase64 =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYzAtMi42Ni01LjMzLTQtOC00eiIvPjwvc3ZnPg==";

// Cloudinary optimization helper for fast, small thumbnails
function getOptimizedAvatarUrl(url) {
  if (!url || url === "null" || url.trim() === "") return fallbackAvatarBase64;

  // Check if it's a Cloudinary URL without existing transformations
  if (
    url.includes("res.cloudinary.com") &&
    url.includes("/upload/") &&
    !url.includes("/upload/c_")
  ) {
    // Inject resize and auto-format flags for a 100x100 circle thumbnail
    return url.replace("/upload/", "/upload/c_fill,w_100,h_100,f_auto,q_auto/");
  }
  return url;
}

document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  await initializeApp();
});

// Helper to bypass 1000 row Supabase limit
async function fetchAllRecords(tableName, columns = "*") {
  let allData = [];
  let from = 0;
  const limit = 1000;
  let keepFetching = true;

  while (keepFetching) {
    const { data, error } = await window.supabaseClient
      .from(tableName)
      .select(columns)
      .range(from, from + limit - 1);

    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      break;
    }
    if (data && data.length > 0) {
      allData.push(...data);
      from += limit;
      if (data.length < limit) keepFetching = false;
    } else {
      keepFetching = false;
    }
  }
  return allData;
}

async function initializeApp() {
  const user = await getUser();
  if (!user) return;

  // 1. Fetch user role
  const { data: roleData } = await window.supabaseClient
    .from("user_roles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  currentUserRolesTable = roleData;
  currentUserRole = roleData?.role || "brgy_moderator";

  // 2. Fetch all members and contributions
  const [membersRes, contributionsRes] = await Promise.all([
    fetchAllRecords("members_data", "*"),
    fetchAllRecords("contributions", "id_number")
  ]);

  globalMembers = membersRes;
  const contribs = contributionsRes;
  globalContributions = new Set(contribs.map((c) => c.id_number));

  // 3. Find Logged-in user's profile info for PDF Header
  if (currentUserRolesTable?.id_number) {
    currentProfileData = globalMembers.find(
      (m) => m.id_number === currentUserRolesTable.id_number
    );
  }

  currentDashboardData = [...globalMembers];

  setupFilters();
  updateDashboardsOnFilter();
}

function updateDashboardsOnFilter() {
  const searchVal =
    document.getElementById("searchInput")?.value.toLowerCase() || "";
  const brgyEl = document.getElementById("filterBarangay");
  const distEl = document.getElementById("filterDistrict");

  currentDashboardData = globalMembers.filter((m) => {
    const matchSearch =
      searchVal === "" ||
      m.id_number?.toLowerCase().includes(searchVal) ||
      m.first_name?.toLowerCase().includes(searchVal) ||
      m.last_name?.toLowerCase().includes(searchVal);
    const matchBrgy =
      !brgyEl || brgyEl.value === "" || m.barangay === brgyEl.value;
    const matchDist =
      !distEl || distEl.value === "" || m.district === distEl.value;
    return matchSearch && matchBrgy && matchDist;
  });

  renderKPIs(currentDashboardData);
  renderCharts(currentDashboardData);

  // Reset Data view and disable download if filters change
  document.getElementById("cardView").innerHTML = "";
  document.getElementById("tableBody").innerHTML = "";
  document.getElementById("pagination").innerHTML = "";
  document.getElementById("btnDownload").disabled = true;
}

// --- KPI Logic ---
function renderKPIs(dataSubset) {
  const now = new Date();
  const sixtyDaysAgo = new Date(now.setDate(now.getDate() - 60));

  const totalMembers = dataSubset.length;
  const newMembers = dataSubset.filter(
    (m) => new Date(m.created_at) >= sixtyDaysAgo
  ).length;

  let goodStanding = 0;
  let inactive = 0;
  dataSubset.forEach((m) => {
    if (globalContributions.has(m.id_number)) goodStanding++;
    else inactive++;
  });

  const kpiData = [
    {
      title: "Total Members",
      value: totalMembers,
      colorClass: "green",
      icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>'
    },
    {
      title: "New Members",
      value: newMembers,
      colorClass: "violet",
      icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>'
    },
    {
      title: "Good Standing",
      value: goodStanding,
      colorClass: "green",
      icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
    },
    {
      title: "Inactive Members",
      value: inactive,
      colorClass: "red",
      icon:
        ' <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
    }
  ];

  const container = document.getElementById("kpi-container");
  container.innerHTML = kpiData
    .map(
      (kpi) => `
        <div class="kpi-card">
            <svg class="kpi-icon ${kpi.colorClass}" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">${kpi.icon}</svg>
            <h3 class="kpi-title">${kpi.title}</h3>
            <p class="kpi-value" data-val="${kpi.value}">0</p>
        </div>
    `
    )
    .join("");

  // Animate
  document.querySelectorAll(".kpi-value").forEach((el) => {
    const target = +el.getAttribute("data-val");
    let count = 0;
    const inc = Math.max(1, target / 30);
    const updateCount = () => {
      count += inc;
      if (count < target) {
        el.innerText = Math.floor(count);
        requestAnimationFrame(updateCount);
      } else {
        el.innerText = target;
      }
    };
    if (target > 0) updateCount();
  });
}

// --- Chart Logic ---
function renderCharts(dataSubset) {
  document.getElementById("ageChartSkeleton").classList.add("hidden");
  document.getElementById("genderChartSkeleton").classList.add("hidden");
  document.getElementById("ageChartWrapper").classList.remove("hidden");
  document.getElementById("genderChartWrapper").classList.remove("hidden");

  // 1. Age Data
  const groups = {
    "Youth (15-25)": 0,
    "Young Adult (26-35)": 0,
    "Adult (36-59)": 0,
    "Senior Citizen (60+)": 0
  };
  const currentYear = new Date().getFullYear();

  dataSubset.forEach((m) => {
    if (!m.birth_date) return;
    const age = currentYear - new Date(m.birth_date).getFullYear();
    if (age >= 15 && age <= 25) groups["Youth (15-25)"]++;
    else if (age >= 26 && age <= 35) groups["Young Adult (26-35)"]++;
    else if (age >= 36 && age <= 59) groups["Adult (36-59)"]++;
    else if (age >= 60) groups["Senior Citizen (60+)"]++;
  });

  const totalAge = Object.values(groups).reduce((a, b) => a + b, 0);
  const ageCtx = document.getElementById("ageChart").getContext("2d");

  if (ageChartInstance) ageChartInstance.destroy();
  ageChartInstance = new Chart(ageCtx, {
    type: "bar",
    data: {
      labels: Object.keys(groups),
      datasets: [
        {
          data: Object.values(groups),
          backgroundColor: "rgba(139, 92, 246, 0.8)",
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          color: "#fff",
          formatter: (value) =>
            totalAge > 0 ? ((value / totalAge) * 100).toFixed(1) + "%" : "0%"
        },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.raw} (${
                totalAge > 0 ? ((ctx.raw / totalAge) * 100).toFixed(1) : 0
              }%)`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { display: false },
          border: { display: false },
          ticks: { display: false } // Removes numbers on left side
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });

  // 2. Gender Data
  const genderData = { Male: 0, Female: 0 };
  dataSubset.forEach((m) => {
    if (m.gender === "Male" || m.gender === "Female") genderData[m.gender]++;
  });
  const totalGender = genderData.Male + genderData.Female;

  const genderCtx = document.getElementById("genderChart").getContext("2d");
  if (genderChartInstance) genderChartInstance.destroy();
  genderChartInstance = new Chart(genderCtx, {
    type: "pie",
    data: {
      labels: ["Male", "Female"],
      datasets: [
        {
          data: [genderData.Male, genderData.Female],
          backgroundColor: ["#10b981", "#ec4899"],
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "right", labels: { color: "#fff" } },
        datalabels: {
          color: "#fff",
          font: { weight: "bold", size: 14 },
          anchor: "center",
          align: "center",
          offset: -10,
          formatter: (value) =>
            totalGender > 0
              ? ((value / totalGender) * 100).toFixed(1) + "%"
              : "0%"
        }
      }
    }
  });
}

// --- Filters & UI Logic ---
function setupFilters() {
  const container = document.getElementById("filters-container");
  const uniqueBarangays = [
    ...new Set(globalMembers.map((m) => m.barangay).filter(Boolean))
  ].sort();
  const uniqueDistricts = [
    ...new Set(globalMembers.map((m) => m.district).filter(Boolean))
  ].sort();

  let filterHTML = "";
  let colsClass = "cols-2";

  if (["brgy_moderator", "brgy_admin"].includes(currentUserRole)) {
    filterHTML += `
            <div class="input-group">
                <label for="filterBarangay" class="filter-label">Barangay</label>
                <input type="text" id="filterBarangay" value="${
                  currentUserRolesTable.brgy_access || ""
                }" readonly>
            </div>`;
    colsClass = "cols-2";
  } else if (currentUserRole === "district_admin") {
    const distAccess = currentUserRolesTable.dist_access || "";
    // Pre-filter barangays to only those in the allowed district
    const distBrgys = [
      ...new Set(
        globalMembers
          .filter((m) => m.district === distAccess)
          .map((m) => m.barangay)
          .filter(Boolean)
      )
    ].sort();

    filterHTML += `
            <div class="input-group">
                <label for="filterDistrict" class="filter-label">District</label>
                <input type="text" id="filterDistrict" value="${distAccess}" readonly>
            </div>
            <div class="input-group">
                <label for="filterBarangay" class="filter-label">Barangay</label>
                <select id="filterBarangay">
                    <option value="">All Barangays</option>
                    ${distBrgys
                      .map((b) => `<option value="${b}">${b}</option>`)
                      .join("")}
                </select>
            </div>`;
    colsClass = "cols-3";
  } else {
    // admin or superuser
    filterHTML += `
            <div class="input-group">
                <label for="filterDistrict" class="filter-label">District</label>
                <select id="filterDistrict">
                    <option value="">All Districts</option>
                    ${uniqueDistricts
                      .map((d) => `<option value="${d}">${d}</option>`)
                      .join("")}
                </select>
            </div>
            <div class="input-group">
                <label for="filterBarangay" class="filter-label">Barangay</label>
                <select id="filterBarangay">
                    <option value="">All Barangays</option>
                    ${uniqueBarangays
                      .map((b) => `<option value="${b}">${b}</option>`)
                      .join("")}
                </select>
            </div>`;
    colsClass = "cols-3";
  }

  document
    .getElementById("searchInput")
    .parentElement.insertAdjacentHTML("afterend", filterHTML);
  container.classList.add(colsClass);

  // Attach listeners
  const distEl = document.getElementById("filterDistrict");
  const brgyEl = document.getElementById("filterBarangay");

  if (
    distEl &&
    (currentUserRole === "admin" || currentUserRole === "superuser")
  ) {
    distEl.addEventListener("change", (e) => {
      const selectedDist = e.target.value;
      // Update Barangay dropdown based on District selection
      const brgys = selectedDist
        ? [
            ...new Set(
              globalMembers
                .filter((m) => m.district === selectedDist)
                .map((m) => m.barangay)
                .filter(Boolean)
            )
          ].sort()
        : uniqueBarangays;

      if (brgyEl) {
        brgyEl.innerHTML =
          `<option value="">All Barangays</option>` +
          brgys.map((b) => `<option value="${b}">${b}</option>`).join("");
      }
      updateDashboardsOnFilter();
    });
  }

  brgyEl?.addEventListener("change", updateDashboardsOnFilter);
}

function setupEventListeners() {
  const debounce = (fn, delay) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  };

  document.getElementById("searchInput").addEventListener(
    "input",
    debounce(() => {
      updateDashboardsOnFilter();
    }, 300)
  );

  document
    .getElementById("btnGenerate")
    .addEventListener("click", generateDataView);
  document.getElementById("btnDownload").addEventListener("click", downloadPDF);
  document.getElementById("viewToggle").addEventListener("change", (e) => {
    document
      .getElementById("cardView")
      .classList.toggle("hidden", e.target.checked);
    document
      .getElementById("tableView")
      .classList.toggle("hidden", !e.target.checked);
  });

  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      currentSort.asc = currentSort.column === col ? !currentSort.asc : true;
      currentSort.column = col;
      applySort();
      renderDataViews();
    });
  });
}

function getFullName(m) {
  if (!m) return "Unknown";
  const mi =
    m.middle_name && m.middle_name !== "N/A" && m.middle_name !== "None"
      ? `${m.middle_name[0]}. `
      : "";
  const suffix = m.suffix ? ` ${m.suffix}` : "";
  return `${m.first_name || ""} ${mi}${m.last_name || ""}${suffix}`.trim();
}

function applySort() {
  filteredData.sort((a, b) => {
    let valA = a[currentSort.column] || "";
    let valB = b[currentSort.column] || "";
    if (valA < valB) return currentSort.asc ? -1 : 1;
    if (valA > valB) return currentSort.asc ? 1 : -1;
    return 0;
  });
}

async function generateDataView() {
  document.getElementById("dataLoader").classList.remove("hidden");
  document.getElementById("cardView").classList.add("hidden");
  document.getElementById("tableView").classList.add("hidden");

  await new Promise((r) => setTimeout(r, 500));

  filteredData = [...currentDashboardData];
  applySort();
  currentPage = 1;
  renderDataViews();

  document.getElementById("dataLoader").classList.add("hidden");
  const isTable = document.getElementById("viewToggle").checked;
  document.getElementById("cardView").classList.toggle("hidden", isTable);
  document.getElementById("tableView").classList.toggle("hidden", !isTable);

  document.getElementById("btnDownload").disabled = false;
}

function renderDataViews() {
  const start = (currentPage - 1) * ROWS_PER_PAGE;
  const paginated = filteredData.slice(start, start + ROWS_PER_PAGE);

  // 1. Render Cards
  const cardContainer = document.getElementById("cardView");
  cardContainer.innerHTML = paginated
    .map((m) => {
      const age = m.birth_date
        ? new Date().getFullYear() - new Date(m.birth_date).getFullYear()
        : "N/A";
      const isDelinquent = !globalContributions.has(m.id_number);
      const optimizedImage = getOptimizedAvatarUrl(m.picture);

      return `
            <div class="member-card ${isDelinquent ? "delinquent" : ""}">
                <img src="${optimizedImage}" onerror="this.src='${fallbackAvatarBase64}'" alt="Avatar" class="member-avatar" loading="lazy">
                <div class="member-info">
                    <h4 title="${getFullName(m)}">${getFullName(m)}</h4>
                    <p>ID: ${m.id_number}</p>
                    <p>${m.gender || "N/A"} | Age: ${age}</p>
                </div>
            </div>`;
    })
    .join("");

  // 2. Render Table
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = paginated
    .map((m) => {
      const isDelinquent = !globalContributions.has(m.id_number);
      return `
            <tr class="${isDelinquent ? "delinquent" : ""}">
                <td>${m.id_number || ""}</td>
                <td>${getFullName(m)}</td>
                <td>${m.address || ""}</td>
                <td>${m.phone_number || ""}</td>
                <td>${m.barangay || ""}</td>
            </tr>`;
    })
    .join("");

  renderPagination();
}

function renderPagination() {
  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
  const container = document.getElementById("pagination");
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = `<button class="page-btn" onclick="changePage(1)">&lt;&lt;</button>`;
  html += `<button class="page-btn" onclick="changePage(${Math.max(
    1,
    currentPage - 1
  )})">&lt;</button>`;

  let startPage = Math.max(1, currentPage - 1);
  let endPage = Math.min(totalPages, currentPage + 1);

  if (currentPage === 1) endPage = Math.min(totalPages, 3);
  if (currentPage === totalPages) startPage = Math.max(1, totalPages - 2);

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${
      i === currentPage ? "active" : ""
    }" onclick="changePage(${i})">${i}</button>`;
  }

  html += `<button class="page-btn" onclick="changePage(${Math.min(
    totalPages,
    currentPage + 1
  )})">&gt;</button>`;
  html += `<button class="page-btn" onclick="changePage(${totalPages})">&gt;&gt;</button>`;

  container.innerHTML = html;
}

window.changePage = (page) => {
  currentPage = page;
  renderDataViews();
};

function downloadPDF() {
  if (filteredData.length === 0) return alert("No data to download.");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const reqBy = currentProfileData
    ? getFullName(currentProfileData)
    : "Administrator";
  let distVal = document.getElementById("filterDistrict")?.value;
  const brgyVal = document.getElementById("filterBarangay")?.value || "All";

  // Dynamic District inference if only Barangay is selected
  if (brgyVal !== "All" && (!distVal || distVal === "All" || distVal === "")) {
    const sampleMatch = globalMembers.find((m) => m.barangay === brgyVal);
    if (sampleMatch && sampleMatch.district) {
      distVal = sampleMatch.district;
    }
  }
  // Fallbacks
  if (!distVal || distVal === "")
    distVal = currentUserRolesTable?.dist_access || "All";

  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  });

  doc.setFontSize(16);
  doc.text("KBKAI Membership Data", 14, 20);
  doc.setFontSize(10);
  doc.text(`Requested by: ${reqBy}`, 14, 28);
  doc.text(`District: ${distVal} | Barangay: ${brgyVal}`, 14, 34);
  doc.text(`Date Generated: ${dateStr}`, 14, 40);

  const tableBody = filteredData.map((m) => [
    m.id_number,
    getFullName(m),
    m.address,
    m.phone_number,
    m.barangay
  ]);

  doc.autoTable({
    startY: 45,
    head: [["ID Number", "Full Name", "Address", "Phone Number", "Barangay"]],
    body: tableBody,
    theme: "grid",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [109, 40, 217] }
  });

  doc.save(`KBKAI_Membership_${dateStr}.pdf`);
}