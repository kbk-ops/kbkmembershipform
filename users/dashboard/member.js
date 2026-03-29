const supabaseClient = window.supabaseClient;

if (!supabaseClient) {
    console.error("Supabase client not initialized.");
}

// State Management
let state = {
    user: null,
    role: null,
    userInfo: null, 
    allMembers: [],
    contributions: new Set(),
    filteredData: [],
    currentPage: 1,
    itemsPerPage: 100,
    currentSort: { column: null, asc: true },
    charts: { age: null, gender: null },
    filters: { search: '', barangay: '', district: '' },
    isGenerated: false
};

// SVG Fallback for Avatar
const fallbackAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

document.addEventListener("DOMContentLoaded", async () => {
    // Top/Bottom Nav integration guard
    if (window.initAuthGuard) await window.initAuthGuard();
    
    await initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    toggleLoader(true); // Show skeleton loading

    // 1. Get User
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
        toggleLoader(false);
        return;
    }
    state.user = user;

    // 2. Get User Role
    const { data: roleData } = await supabaseClient
        .from('user_roles')
        .select('role, id_number')
        .eq('auth_user_id', user.id)
        .maybeSingle();

    state.role = roleData?.role || 'brgy_moderator';

    // 3. Get User Info
    if (roleData?.id_number) {
        const { data } = await supabaseClient
            .from('members_data')
            .select('first_name, last_name')
            .eq('id_number', roleData.id_number)
            .maybeSingle();
        state.userInfo = data || { first_name: 'Admin', last_name: 'User' };
    } else {
        state.userInfo = { first_name: 'Admin', last_name: 'User' };
    }

    // 4. Setup UI and Data
    renderFilters();
    await fetchAllData();

    // 5. Initial Load (Triggers KPI and Charts immediately)
    handleGenerate(); 
    
    toggleLoader(false); // Hide loader once data is ready
}

function toggleLoader(show) {
    const loader = document.getElementById('loader');
    const cardView = document.getElementById('card-view');
    if (!loader || !cardView) return;

    if (show) {
        loader.classList.remove('loader-hidden');
        cardView.classList.add('view-hidden');
    } else {
        loader.classList.add('loader-hidden');
        cardView.classList.remove('view-hidden');
    }
}

function renderFilters() {
    const searchContainer = document.getElementById('filter-search-container');
    const dropsContainer = document.getElementById('filter-dropdowns-container');
    
    searchContainer.innerHTML = `<input type="text" id="input-search" placeholder="Search ID, Name..." aria-label="Search members">`;

    let dropsHtml = '';
    if (state.role === 'brgy_moderator' || state.role === 'brgy_admin') {
        const userBrgy = "Sample Barangay"; 
        dropsHtml = `<input type="text" id="input-brgy" value="${userBrgy}" readonly title="Locked to your Barangay">`;
    } else {
        dropsHtml = `
            <select id="input-brgy"><option value="">All Barangays</option></select>
            <select id="input-dist"><option value="">All Districts</option></select>
        `;
    }
    dropsContainer.innerHTML = dropsHtml;
}

async function fetchAllData() {
    try {
        const { data: members } = await supabaseClient.from('members_data').select('*');
        state.allMembers = members || [];

        const { data: contribs } = await supabaseClient.from('contributions').select('id_number');
        state.contributions = new Set(contribs?.map(c => c.id_number) || []);

        populateDropdowns();
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

function populateDropdowns() {
    const brgySelect = document.getElementById('input-brgy');
    const distSelect = document.getElementById('input-dist');

    if (brgySelect && brgySelect.tagName === 'SELECT') {
        const brgys = [...new Set(state.allMembers.map(m => m.barangay).filter(Boolean))].sort();
        brgySelect.innerHTML = '<option value="">All Barangays</option>' + brgys.map(b => `<option value="${b}">${b}</option>`).join('');
    }
    if (distSelect && distSelect.tagName === 'SELECT') {
        const dists = [...new Set(state.allMembers.map(m => m.district).filter(Boolean))].sort();
        distSelect.innerHTML = '<option value="">All Districts</option>' + dists.map(d => `<option value="${d}">${d}</option>`).join('');
    }
}

function setupEventListeners() {
    document.getElementById('btn-generate').addEventListener('click', handleGenerate);
    document.getElementById('btn-download').addEventListener('click', generatePDF);
    document.getElementById('view-toggle').addEventListener('change', toggleView);
    
    const searchInput = document.getElementById('input-search');
    let timeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        state.filters.search = e.target.value.toLowerCase();
        timeout = setTimeout(() => { if (state.isGenerated) applyFiltersAndRender(); }, 300);
    });

    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;
            state.currentSort.asc = state.currentSort.column === column ? !state.currentSort.asc : true;
            state.currentSort.column = column;
            applyFiltersAndRender();
        });
    });
}

function handleGenerate() {
    state.isGenerated = true;
    const brgyInput = document.getElementById('input-brgy');
    const distInput = document.getElementById('input-dist');
    
    state.filters.barangay = brgyInput ? brgyInput.value : '';
    state.filters.district = distInput ? distInput.value : '';

    applyFiltersAndRender();
}

function applyFiltersAndRender() {
    const { search, barangay, district } = state.filters;
    
    state.filteredData = state.allMembers.filter(m => {
        const matchSearch = !search || 
            (m.id_number?.toLowerCase().includes(search) || 
             m.first_name?.toLowerCase().includes(search) || 
             m.last_name?.toLowerCase().includes(search));
        const matchBrgy = !barangay || m.barangay === barangay;
        const matchDist = !district || m.district === district;
        return matchSearch && matchBrgy && matchDist;
    });

    if (state.currentSort.column) {
        state.filteredData.sort((a, b) => {
            let valA = a[state.currentSort.column] || '';
            let valB = b[state.currentSort.column] || '';
            if (valA < valB) return state.currentSort.asc ? -1 : 1;
            if (valA > valB) return state.currentSort.asc ? 1 : -1;
            return 0;
        });
    }

    state.currentPage = 1;
    updateKPIs();
    updateCharts();
    renderDataViews();
}

function calculateAge(birthDate) {
    if (!birthDate) return 0;
    const diff = Date.now() - new Date(birthDate).getTime();
    return Math.abs(new Date(diff).getUTCFullYear() - 1970);
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString();
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

function updateKPIs() {
    const total = state.filteredData.length;
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const newMembers = state.filteredData.filter(m => new Date(m.created_at) >= sixtyDaysAgo).length;

    let goodStanding = 0;
    let delinquent = 0;
    state.filteredData.forEach(m => {
        if (state.contributions.has(m.id_number)) goodStanding++;
        else delinquent++;
    });

    animateValue('kpi-total', 0, total, 800);
    animateValue('kpi-new', 0, newMembers, 800);
    animateValue('kpi-good', 0, goodStanding, 800);
    animateValue('kpi-delinquent', 0, delinquent, 800);
}

function updateCharts() {
    const data = state.allMembers;
    const total = data.length || 1;

    const ageCounts = { teen: 0, young: 0, adult: 0, senior: 0 };
    const genderCounts = { male: 0, female: 0, other: 0 };

    data.forEach(m => {
        const age = calculateAge(m.birth_date);
        if (age >= 15 && age <= 17) ageCounts.teen++;
        else if (age >= 18 && age <= 35) ageCounts.young++;
        else if (age >= 36 && age <= 55) ageCounts.adult++;
        else if (age >= 56) ageCounts.senior++;

        const g = (m.gender || '').toLowerCase();
        if (g === 'male') genderCounts.male++;
        else if (g === 'female') genderCounts.female++;
        else genderCounts.other++;
    });

    new Chart(document.getElementById('ageChart'), {
        type: 'bar',
        data: {
            labels: ['Teen', 'Young', 'Adult', 'Senior'],
            datasets: [{ data: Object.values(ageCounts), backgroundColor: '#8b5cf6', borderRadius: 5 }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: { color: '#fff', anchor: 'end', align: 'top', formatter: (v) => ((v/total)*100).toFixed(1)+'%' }
            },
            scales: { y: { display: false }, x: { ticks: { color: '#94a3b8' }, grid: { display: false } } }
        }
    });

    new Chart(document.getElementById('genderChart'), {
        type: 'pie',
        data: {
            labels: ['Male', 'Female', 'Other'],
            datasets: [{ data: Object.values(genderCounts), backgroundColor: ['#3b82f6', '#ec4899', '#64748b'], borderWidth: 0 }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94a3b8' } },
                datalabels: {
                    color: '#fff', font: { weight: 'bold' },
                    formatter: (val, ctx) => {
                        const label = ctx.chart.data.labels[ctx.dataIndex];
                        const icon = label === 'Male' ? '♂' : label === 'Female' ? '♀' : '⚥';
                        return `${icon} ${((val/total)*100).toFixed(0)}%`;
                    }
                }
            }
        }
    });
}

function formatFullName(m) {
    let mInitial = (m.middle_name && !['none', 'n/a'].includes(m.middle_name.toLowerCase())) ? ` ${m.middle_name.charAt(0)}.` : '';
    let sfx = m.suffix ? ` ${m.suffix}` : '';
    return `${m.first_name}${mInitial} ${m.last_name}${sfx}`.trim();
}

function renderDataViews() {
    const cardContainer = document.getElementById('card-view');
    const tableBody = document.getElementById('table-body');
    const start = (state.currentPage - 1) * state.itemsPerPage;
    const paginated = state.filteredData.slice(start, start + state.itemsPerPage);

    let cardHTML = '';
    let tableHTML = '';

    paginated.forEach(m => {
        const isDelinquent = !state.contributions.has(m.id_number);
        const name = formatFullName(m);
        const age = calculateAge(m.birth_date);
        
        cardHTML += `
            <div class="member-card ${isDelinquent ? 'delinquent' : ''}">
                <img src="${m.picture || fallbackAvatar}" class="avatar" loading="lazy" onerror="this.src='${fallbackAvatar}'">
                <div class="member-info">
                    <h4>${name}</h4>
                    <p>${m.gender || 'N/A'} • ${age} yrs</p>
                </div>
            </div>`;

        tableHTML += `
            <tr class="${isDelinquent ? 'delinquent' : ''}">
                <td>${m.id_number || 'N/A'}</td>
                <td>${name}</td>
                <td>${m.address || 'N/A'}</td>
                <td>${m.phone_number || 'N/A'}</td>
                <td>${m.barangay || 'N/A'}</td>
            </tr>`;
    });

    cardContainer.innerHTML = cardHTML || '<p>No records found.</p>';
    tableBody.innerHTML = tableHTML || '<tr><td colspan="5">No records found.</td></tr>';
    renderPagination();
}

function toggleView() {
    const isTable = document.getElementById('view-toggle').checked;
    document.getElementById('card-view').className = isTable ? 'view-hidden' : 'view-active member-cards-grid';
    document.getElementById('table-view').className = isTable ? 'view-active' : 'view-hidden';
}

function renderPagination() {
    const totalPages = Math.ceil(state.filteredData.length / state.itemsPerPage);
    const pagContainer = document.getElementById('pagination-controls');
    if (totalPages <= 1) { pagContainer.innerHTML = ''; return; }

    let html = `<button class="page-btn" ${state.currentPage === 1 ? 'disabled' : ''} onclick="changePage(${state.currentPage - 1})"><</button>`;
    for (let i = Math.max(1, state.currentPage - 2); i <= Math.min(totalPages, state.currentPage + 2); i++) {
        html += `<button class="page-btn ${i === state.currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" ${state.currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${state.currentPage + 1})">></button>`;
    pagContainer.innerHTML = html;
}

window.changePage = (page) => {
    state.currentPage = page;
    renderDataViews();
    document.getElementById('data-scroll-area').scrollTop = 0;
};

function generatePDF() {
    if (!state.isGenerated || state.filteredData.length === 0) return alert("No data to download.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    const reqBy = `${state.userInfo.first_name} ${state.userInfo.last_name}`;
    
    doc.setFontSize(16);
    doc.text("Membership Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Requested by: ${reqBy} | Date: ${new Date().toLocaleDateString()}`, 14, 28);

    const rows = state.filteredData.map(m => [
        m.id_number || 'N/A',
        formatFullName(m),
        m.address || 'N/A',
        m.phone_number || 'N/A',
        m.barangay || 'N/A',
        state.contributions.has(m.id_number) ? 'Good' : 'Delinquent'
    ]);

    doc.autoTable({
        head: [["ID", "Name", "Address", "Phone", "Barangay", "Status"]],
        body: rows,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [109, 40, 217] }
    });

    doc.save(`Membership_Report.pdf`);
}