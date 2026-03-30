document.addEventListener("DOMContentLoaded", async () => {
  const getSupabase = () => {
    return new Promise((resolve) => {
      if (window.supabaseClient) return resolve(window.supabaseClient);
      const interval = setInterval(() => {
        if (window.supabaseClient) {
          clearInterval(interval);
          resolve(window.supabaseClient);
        }
      }, 50);
    });
  };

  const supabase = await getSupabase();
  let userRoleData = null;
  let userProfile = null;
  let tableData = [];
  let currentPage = 1;
  const ROWS_PER_PAGE = 30;

  const DOM = {
    skeleton: document.getElementById("initialSkeleton"),
    dashboard: document.getElementById("mainDashboard"),
    tableSection: document.getElementById("tableSection"),
    noDataMsg: document.getElementById("noDataMessage"),
    msgFirstName: document.getElementById("msgFirstName"),

    search: document.getElementById("filterSearch"),
    barangay: document.getElementById("filterBarangay"),
    district: document.getElementById("filterDistrict"),
    month: document.getElementById("filterMonth"),
    year: document.getElementById("filterYear"),
    receivedBy: document.getElementById("filterReceivedBy"),

    grpSearch: document.getElementById("grpSearch"),
    grpBarangay: document.getElementById("grpBarangay"),
    grpDistrict: document.getElementById("grpDistrict"),
    grpMonth: document.getElementById("grpMonth"),
    grpYear: document.getElementById("grpYear"),
    grpReceivedBy: document.getElementById("grpReceivedBy"),

    btnGenerate: document.getElementById("btnGenerate"),
    btnDownload: document.getElementById("btnDownload"),
    tbody: document.getElementById("tableBody"),
    tfoot: document.getElementById("tableFooter"),
    pagination: document.getElementById("paginationControls")
  };

  async function init() {
    if (window.initAuthGuard) await window.initAuthGuard();

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("*")
      .eq("auth_user_id", user.id)
      .single();

    if (!roleData) return console.error("Role missing.");
    userRoleData = roleData;

    const { data: profile } = await supabase
      .from("members_data")
      .select("*")
      .eq("id_number", userRoleData.id_number)
      .maybeSingle();

    userProfile = profile || {};

    await configureFiltersAndCheckData();
    DOM.skeleton.classList.add("hidden");
  }

  async function configureFiltersAndCheckData() {
    const role = userRoleData.role;
    const { data: cData } = await supabase.from("contributions").select("*");
    if (!cData) return;

    const userHasContributions = cData.some(
      (c) => c.id_number === userRoleData.id_number
    );

    if (!userHasContributions) {
      const fName = userProfile.first_name || "Member";
      DOM.msgFirstName.innerHTML = `Hello <b>${fName}</b>!`;
      DOM.noDataMsg.classList.remove("hidden");
      return;
    }

    DOM.dashboard.classList.remove("hidden");

    const distinct = (key) => [
      ...new Set(cData.map((item) => item[key]).filter(Boolean))
    ];
    populateSelect(DOM.month, distinct("month"));
    populateSelect(DOM.year, distinct("year"));
    populateSelect(DOM.receivedBy, distinct("receive_by"));
    populateSelect(DOM.barangay, distinct("barangay"));
    populateSelect(DOM.district, distinct("district"));

    if (role === "member") {
      DOM.grpDistrict.classList.add("hidden");
      DOM.grpMonth.classList.add("hidden");
      DOM.grpReceivedBy.classList.add("hidden");

      const myData = cData.find((c) => c.id_number === userRoleData.id_number);
      DOM.search.value = myData.full_name;
      DOM.search.readOnly = true;

      DOM.barangay.innerHTML = `<option value="${myData.barangay}">${myData.barangay}</option>`;
      DOM.barangay.value = myData.barangay;
      DOM.barangay.disabled = true;
    } else if (["brgy_admin", "brgy_moderator"].includes(role)) {
      DOM.grpDistrict.classList.add("hidden");

      const targetBrgy =
        userRoleData.brgy_access || userProfile.barangay || cData[0]?.barangay;
      DOM.barangay.innerHTML = `<option value="${targetBrgy}">${targetBrgy}</option>`;
      DOM.barangay.value = targetBrgy;
      DOM.barangay.disabled = true;
    } else if (role === "dist_admin") {
      const targetDist =
        userRoleData.dist_access || userProfile.district || cData[0]?.district;
      DOM.district.innerHTML = `<option value="${targetDist}">${targetDist}</option>`;
      DOM.district.value = targetDist;
      DOM.district.disabled = true;
    }
  }

  function populateSelect(element, options) {
    options.sort().forEach((opt) => {
      const el = document.createElement("option");
      el.value = opt;
      el.textContent = opt;
      element.appendChild(el);
    });
  }

  // --- Table Generation ---
  DOM.btnGenerate.addEventListener("click", async () => {
    // 1. Reveal the table section when Generate is clicked
    DOM.tableSection.classList.remove("hidden");

    DOM.tbody.innerHTML =
      '<tr><td colspan="8"><div class="skeleton" style="height:100px"></div></td></tr>';

    let query = supabase.from("contributions").select("*");

    if (DOM.search.value)
      query = query.or(
        `id_number.ilike.%${DOM.search.value}%,full_name.ilike.%${DOM.search.value}%`
      );
    if (!DOM.barangay.disabled && DOM.barangay.value !== "All")
      query = query.eq("barangay", DOM.barangay.value);
    if (DOM.barangay.disabled) query = query.eq("barangay", DOM.barangay.value);
    if (!DOM.district.disabled && DOM.district.value !== "All")
      query = query.eq("district", DOM.district.value);
    if (DOM.district.disabled) query = query.eq("district", DOM.district.value);

    if (DOM.month.value && DOM.month.value !== "All")
      query = query.eq("month", DOM.month.value);
    if (DOM.year.value && DOM.year.value !== "All")
      query = query.eq("year", DOM.year.value);
    if (DOM.receivedBy.value && DOM.receivedBy.value !== "All")
      query = query.eq("receive_by", DOM.receivedBy.value);

    const { data, error } = await query;
    if (error) return console.error(error);

    tableData = data;
    currentPage = 1;
    renderTable();
    DOM.btnDownload.disabled = tableData.length === 0;
  });

  function renderTable() {
    DOM.tbody.innerHTML = "";
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const paginatedData = tableData.slice(start, start + ROWS_PER_PAGE);

    if (paginatedData.length === 0) {
      DOM.tbody.innerHTML =
        '<tr><td colspan="8" style="text-align:center;">No records found.</td></tr>';
      DOM.tfoot.innerHTML = "";
      DOM.pagination.classList.add("hidden");
      return;
    }

    paginatedData.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>${row.id_number}</td>
                <td>${row.full_name}</td>
                <td>${row.barangay}</td>
                <td>${row.month}</td>
                <td>${row.year}</td>
                <td>${Number(row.amount).toFixed(2)}</td>
                <td>${new Date(row.receive_at).toLocaleDateString()}</td>
                <td>${row.receive_by}</td>
            `;
      DOM.tbody.appendChild(tr);
    });

    updateSummary();
    renderPagination();
  }

  function updateSummary() {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const paginatedData = tableData.slice(start, start + ROWS_PER_PAGE);
    const subtotal = paginatedData.reduce(
      (s, r) => s + Number(r.amount || 0),
      0
    );
    const grandTotal = tableData.reduce((s, r) => s + Number(r.amount || 0), 0);
    const isLast = start + ROWS_PER_PAGE >= tableData.length;

    DOM.tfoot.innerHTML = `
            <tr><td colspan="5" align="right">Subtotal:</td><td colspan="3">${subtotal.toFixed(
              2
            )}</td></tr>
            ${
              isLast
                ? `<tr style="color:#10b981"><td colspan="5" align="right">Grand Total:</td><td colspan="3">${grandTotal.toFixed(
                    2
                  )}</td></tr>`
                : ""
            }
        `;
  }

  function renderPagination() {
    const totalPages = Math.ceil(tableData.length / ROWS_PER_PAGE);
    DOM.pagination.classList.toggle("hidden", totalPages <= 1);
    document.getElementById(
      "pageNumbers"
    ).textContent = `${currentPage} / ${totalPages}`;

    document.getElementById("pageFirst").onclick = () => {
      currentPage = 1;
      renderTable();
    };
    document.getElementById("pagePrev").onclick = () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    };
    document.getElementById("pageNext").onclick = () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
      }
    };
    document.getElementById("pageLast").onclick = () => {
      currentPage = totalPages;
      renderTable();
    };
  }

  // --- PDF Export Logic ---
  DOM.btnDownload.addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "pt", "letter");
    const role = userRoleData.role;

    const fName = userProfile?.first_name || "";
    const lName = userProfile?.last_name || "";
    const sName = userProfile?.suffix ? ` ${userProfile.suffix}` : "";
    const fullName =
      `${fName} ${lName}${sName}`.trim() || userRoleData.id_number;

    let pdfBrgy = ["member", "brgy_moderator", "brgy_admin"].includes(role)
      ? userProfile?.barangay || userRoleData.brgy_access
      : DOM.barangay.value;

    let pdfDist = [
      "member",
      "brgy_moderator",
      "brgy_admin",
      "dist_admin"
    ].includes(role)
      ? userProfile?.district || userRoleData.dist_access
      : DOM.district.value;

    const dateStr = new Date().toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric"
    });

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("KBKAI Year to Date Dues Report", 40, 40);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Requested By: ${fullName}`, 40, 60);
    doc.text(`Barangay: ${pdfBrgy}`, 40, 75);
    doc.text(`District: ${pdfDist}`, 40, 90);
    doc.text(`Date: ${dateStr}`, 40, 105);

    const body = tableData.map((r) => [
      r.id_number,
      r.full_name,
      r.barangay,
      r.month,
      r.year,
      Number(r.amount).toFixed(2),
      new Date(r.receive_at).toLocaleDateString(),
      r.receive_by
    ]);

    const grandTotal = tableData.reduce((s, r) => s + Number(r.amount || 0), 0);
    body.push([
      {
        content: "Grand Total",
        colSpan: 5,
        styles: { halign: "right", fontStyle: "bold" }
      },
      {
        content: grandTotal.toFixed(2),
        colSpan: 3,
        styles: { fontStyle: "bold" }
      }
    ]);

    doc.autoTable({
      startY: 120,
      head: [
        [
          "ID",
          "Full Name",
          "Barangay",
          "Month",
          "Year",
          "Amount",
          "Posted",
          "Received By"
        ]
      ],
      body: body,
      headStyles: { fillColor: [6, 78, 59] },
      styles: { fontSize: 8 }
    });

    const fileDate = new Date().toISOString().split("T")[0];
    doc.save(`monthly_dues_report_${fileDate}.pdf`);
  });

  init();
});