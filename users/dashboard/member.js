// Register ChartDataLabels plugin
Chart.register(ChartDataLabels);

let globalMembers = [];
let globalContributions = new Set();
let filteredData = [];
let currentUserRole = null;
let currentProfile = null;
let currentPage = 1;
const ROWS_PER_PAGE = 100;
let currentSort = { column: 'first_name', asc: true };

// Custom Plugin to draw SVG Icons inside Pie Chart
const pieIconPlugin = {
    id: 'pieIcons',
    afterDraw: (chart) => {
        if (chart.config.type !== 'pie') return;
        const ctx = chart.ctx;
        chart.data.datasets.forEach((dataset, i) => {
            const meta = chart.getDatasetMeta(i);
            meta.data.forEach((element, index) => {
                const label = chart.data.labels[index];
                // Simplified SVG paths encoded for Image source
                const maleSVG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24"><path d="M15 4v2h3.59l-4.07 4.07c-1.2-1.3-2.9-2.07-4.52-2.07C6.69 8 4 10.69 4 14s2.69 6 6 6 6-2.69 6-6c0-1.62-.77-3.32-2.07-4.52L18 5.41V9h2V4h-5zm-5 14c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>';
                const femaleSVG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24"><path d="M12 4c-3.31 0-6 2.69-6 6 0 2.97 2.16 5.43 5 5.91V19H9v2h2v2h2v-2h2v-2h-2v-3.09c2.84-.48 5-2.94 5-5.91 0-3.31-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>';
                
                const img = new Image();
                img.src = label === 'Male' ? maleSVG : femaleSVG;
                
                const position = element.tooltipPosition();
                // Draw image slightly offset to accommodate the percentage text
                ctx.drawImage(img, position.x - 12, position.y + 5, 24, 24);
            });
        });
    }
};
Chart.register(pieIconPlugin);

document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await initializeApp();
});

async function initializeApp() {
    const user = await getUser(); // From components.js / supabaseClient.js
    if (!user) return; // Handle unauth if needed

    // 1. Fetch user role
    const { data: roleData } = await window.supabaseClient
        .from('user_roles')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();
    
    currentUserRole = roleData?.role || 'brgy_moderator';
    currentProfile = roleData;

    // 2. Fetch Data for KPIs and Charts (Non-blocking UI)
    fetchDashboardData();
}

async function fetchDashboardData() {
    // Fetch members and contributions in parallel
    const [membersRes, contributionsRes] = await Promise.all([
        window.supabaseClient.from('members_data').select('*'),
        window.supabaseClient.from('contributions').select('id_number')
    ]);

    globalMembers = membersRes.data || [];
    const contribs = contributionsRes.data || [];
    globalContributions = new Set(contribs.map(c => c.id_number));

    renderKPIs();
    renderCharts();
    setupFilters();
}

// --- KPI Logic ---
function renderKPIs() {
    const now = new Date();
    const sixtyDaysAgo = new Date(now.setDate(now.getDate() - 60));

    const totalMembers = globalMembers.length;
    const newMembers = globalMembers.filter(m => new Date(m.created_at) >= sixtyDaysAgo).length;
    const goodStanding = [...globalContributions].length; // Unique ID count
    const inactive = globalMembers.filter(m => !globalContributions.has(m.id_number)).length;

    const kpiData = [
        { title: "Total Members", value: totalMembers, icon: '<path d="M12 14c-4.418 0-8 3.582-8 8h16c0-4.418-3.582-8-8-8zm0-2c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6z"/>' },
        { title: "New Members (60d)", value: newMembers, icon: '<path d="M12 4v16m8-8H4"/>' },
        { title: "Good Standing", value: goodStanding, icon: '<path d="M5 13l4 4L19 7"/>' },
        { title: "Inactive Members", value: inactive, icon: '<path d="M18.364 5.636l-12.728 12.728M5.636 5.636l12.728 12.728"/>' }
    ];

    const container = document.getElementById('kpi-container');
    container.innerHTML = kpiData.map(kpi => `
        <div class="kpi-card">
            <svg class="kpi-icon" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                ${kpi.icon}
            </svg>
            <h3 class="kpi-title">${kpi.title}</h3>
            <p class="kpi-value" data-val="${kpi.value}">0</p>
        </div>
    `).join('');

    // Animate count up
    document.querySelectorAll('.kpi-value').forEach(el => {
        const target = +el.getAttribute('data-val');
        let count = 0;
        const inc = target / 50; // 50 frames
        const updateCount = () => {
            count += inc;
            if (count < target) {
                el.innerText = Math.ceil(count);
                requestAnimationFrame(updateCount);
            } else {
                el.innerText = target;
            }
        };
        updateCount();
    });
}

// --- Chart Logic ---
function calculateAgeGroups() {
    const groups = { 'Youth (15-25)': 0, 'Young Adult (26-35)': 0, 'Adult (36-59)': 0, 'Senior Citizen (60+)': 0 };
    const currentYear = new Date().getFullYear();

    globalMembers.forEach(m => {
        if (!m.birth_date) return;
        const age = currentYear - new Date(m.birth_date).getFullYear();
        if (age >= 15 && age <= 25) groups['Youth (15-25)']++;
        else if (age >= 26 && age <= 35) groups['Young Adult (26-35)']++;
        else if (age >= 36 && age <= 59) groups['Adult (36-59)']++;
        else if (age >= 60) groups['Senior Citizen (60+)']++;
    });
    return groups;
}

function renderCharts() {
    // Age Chart
    const ageData = calculateAgeGroups();
    const totalAge = Object.values(ageData).reduce((a, b) => a + b, 0);
    const ageCtx = document.getElementById('ageChart').getContext('2d');
    
    new Chart(ageCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(ageData),
            datasets: [{
                label: 'Members',
                data: Object.values(ageData),
                backgroundColor: 'rgba(16, 185, 129, 0.8)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: '#fff',
                    formatter: (value) => ((value / totalAge) * 100).toFixed(1) + '%'
                },
                tooltip: {
                    callbacks: { label: (ctx) => `${ctx.raw} (${((ctx.raw / totalAge) * 100).toFixed(1)}%)` }
                }
            },
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' } }, x: { grid: { display: false } } }
        }
    });

    // Gender Chart
    const genderData = { Male: 0, Female: 0 };
    globalMembers.forEach(m => { if (m.gender === 'Male' || m.gender === 'Female') genderData[m.gender]++; });
    const totalGender = genderData.Male + genderData.Female;
    
    const genderCtx = document.getElementById('genderChart').getContext('2d');
    new Chart(genderCtx, {
        type: 'pie',
        data: {
            labels: ['Male', 'Female'],
            datasets: [{
                data: [genderData.Male, genderData.Female],
                backgroundColor: ['#3b82f6', '#ec4899'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#fff' } },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 14 },
                    anchor: 'center', align: 'center', offset: -10,
                    formatter: (value) => ((value / totalGender) * 100).toFixed(1) + '%'
                }
            }
        }
    });
}

// --- Filters & UI Logic ---
function setupFilters() {
    const container = document.getElementById('filters-container');
    const uniqueBarangays = [...new Set(globalMembers.map(m => m.barangay).filter(Boolean))];
    const uniqueDistricts = [...new Set(globalMembers.map(m => m.district).filter(Boolean))];

    let filterHTML = '';
    let colsClass = 'cols-2';

    if (['brgy_moderator', 'brgy_admin'].includes(currentUserRole)) {
        filterHTML += `<div class="input-group"><input type="text" id="filterBarangay" value="${currentProfile.barangay || ''}" readonly></div>`;
        colsClass = 'cols-2';
    } else if (currentUserRole === 'dist_admin') {
        filterHTML += `
            <div class="input-group">
                <select id="filterBarangay">
                    <option value="">All Barangays</option>
                    ${uniqueBarangays.map(b => `<option value="${b}">${b}</option>`).join('')}
                </select>
            </div>
            <div class="input-group"><input type="text" id="filterDistrict" value="${currentProfile.district || ''}" readonly></div>`;
        colsClass = 'cols-3';
    } else {
        filterHTML += `
            <div class="input-group">
                <select id="filterBarangay">
                    <option value="">All Barangays</option>
                    ${uniqueBarangays.map(b => `<option value="${b}">${b}</option>`).join('')}
                </select>
            </div>
            <div class="input-group">
                <select id="filterDistrict">
                    <option value="">All Districts</option>
                    ${uniqueDistricts.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
            </div>`;
        colsClass = 'cols-3';
    }

    // Insert after search input
    document.getElementById('searchInput').parentElement.insertAdjacentHTML('afterend', filterHTML);
    container.classList.add(colsClass);
}

function setupEventListeners() {
    const debounce = (fn, delay) => {
        let timeout;
        return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), delay); };
    };

    document.getElementById('searchInput').addEventListener('input', debounce(() => {
        if (filteredData.length > 0) applyFilters(); // Live filter if already generated once
    }, 300));

    document.getElementById('btnGenerate').addEventListener('click', generateDataView);
    document.getElementById('btnDownload').addEventListener('click', downloadPDF);
    document.getElementById('viewToggle').addEventListener('change', (e) => {
        document.getElementById('cardView').classList.toggle('hidden', e.target.checked);
        document.getElementById('tableView').classList.toggle('hidden', !e.target.checked);
    });

    // Table Sorting
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            currentSort.asc = currentSort.column === col ? !currentSort.asc : true;
            currentSort.column = col;
            applySort();
            renderDataViews();
        });
    });
}

function getFullName(m) {
    const mi = m.middle_name && m.middle_name !== 'N/A' && m.middle_name !== 'None' ? `${m.middle_name[0]}. ` : '';
    const suffix = m.suffix ? ` ${m.suffix}` : '';
    return `${m.first_name} ${mi}${m.last_name}${suffix}`;
}

function applyFilters() {
    const searchVal = document.getElementById('searchInput').value.toLowerCase();
    const brgyEl = document.getElementById('filterBarangay');
    const distEl = document.getElementById('filterDistrict');

    filteredData = globalMembers.filter(m => {
        const matchSearch = searchVal === '' || 
                            m.id_number?.toLowerCase().includes(searchVal) || 
                            m.first_name?.toLowerCase().includes(searchVal) || 
                            m.last_name?.toLowerCase().includes(searchVal);
        const matchBrgy = !brgyEl || brgyEl.value === '' || m.barangay === brgyEl.value;
        const matchDist = !distEl || distEl.value === '' || m.district === distEl.value;
        
        return matchSearch && matchBrgy && matchDist;
    });

    applySort();
    currentPage = 1;
    renderDataViews();
}

function applySort() {
    filteredData.sort((a, b) => {
        let valA = a[currentSort.column] || '';
        let valB = b[currentSort.column] || '';
        if (valA < valB) return currentSort.asc ? -1 : 1;
        if (valA > valB) return currentSort.asc ? 1 : -1;
        return 0;
    });
}

async function generateDataView() {
    document.getElementById('dataLoader').classList.remove('hidden');
    document.getElementById('cardView').classList.add('hidden');
    document.getElementById('tableView').classList.add('hidden');
    
    // Simulate slight delay for UX loading feel since data is in memory
    await new Promise(r => setTimeout(r, 600)); 
    
    applyFilters();
    document.getElementById('dataLoader').classList.add('hidden');
    
    // Show appropriate view based on toggle
    const isTable = document.getElementById('viewToggle').checked;
    document.getElementById('cardView').classList.toggle('hidden', isTable);
    document.getElementById('tableView').classList.toggle('hidden', !isTable);
}

function renderDataViews() {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const paginated = filteredData.slice(start, start + ROWS_PER_PAGE);

    // 1. Render Cards
    const cardContainer = document.getElementById('cardView');
    cardContainer.innerHTML = paginated.map(m => {
        const age = m.birth_date ? new Date().getFullYear() - new Date(m.birth_date).getFullYear() : 'N/A';
        const isDelinquent = !globalContributions.has(m.id_number);
        const img = m.picture || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" fill="%23fff" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

        return `
            <div class="member-card ${isDelinquent ? 'delinquent' : ''}">
                <img src="${img}" alt="Avatar" class="member-avatar" loading="lazy">
                <div class="member-info">
                    <h4>${getFullName(m)}</h4>
                    <p>ID: ${m.id_number}</p>
                    <p>${m.gender || 'N/A'} | Age: ${age}</p>
                </div>
            </div>`;
    }).join('');

    // 2. Render Table
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = paginated.map(m => {
        const isDelinquent = !globalContributions.has(m.id_number);
        return `
            <tr class="${isDelinquent ? 'delinquent' : ''}">
                <td>${m.id_number || ''}</td>
                <td>${getFullName(m)}</td>
                <td>${m.address || ''}</td>
                <td>${m.phone_number || ''}</td>
                <td>${m.barangay || ''}</td>
            </tr>`;
    }).join('');

    renderPagination();
}

function renderPagination() {
    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
    const container = document.getElementById('pagination');
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = `<button class="page-btn" onclick="changePage(1)">&lt;&lt;</button>`;
    html += `<button class="page-btn" onclick="changePage(${Math.max(1, currentPage - 1)})">&lt;</button>`;
    
    // Simple window for pagination
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }

    html += `<button class="page-btn" onclick="changePage(${Math.min(totalPages, currentPage + 1)})">&gt;</button>`;
    html += `<button class="page-btn" onclick="changePage(${totalPages})">&gt;&gt;</button>`;
    
    container.innerHTML = html;
}

window.changePage = (page) => {
    currentPage = page;
    renderDataViews();
};

function downloadPDF() {
    if (filteredData.length === 0) return alert("Please generate data first.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header Data
    const reqBy = currentProfile ? getFullName(currentProfile) : 'Admin';
    const brgyVal = document.getElementById('filterBarangay')?.value || currentProfile?.barangay || 'All';
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

    // Header Drawing
    doc.setFontSize(16);
    doc.text("KBKAI Membership Data", 14, 20);
    doc.setFontSize(10);
    doc.text(`Requested by: ${reqBy}`, 14, 28);
    doc.text(`Barangay: ${brgyVal}`, 14, 34);
    doc.text(`Date Generated: ${dateStr}`, 14, 40);

    // Table Data
    const tableBody = filteredData.map(m => [
        m.id_number,
        getFullName(m),
        m.address,
        m.phone_number,
        m.barangay
    ]);

    doc.autoTable({
        startY: 45,
        head: [['ID Number', 'Full Name', 'Address', 'Phone Number', 'Barangay']],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [109, 40, 217] } // Violet header
    });

    doc.save(`KBKAI_Membership_${dateStr}.pdf`);
}
