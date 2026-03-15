// app.js

document.addEventListener("DOMContentLoaded", async () => {
    // 1. INJECT REUSABLE LAYOUTS (Top Bar & Bottom Nav)
    renderLayout();

    // 2. INITIALIZE DASHBOARD COMPONENTS
    updateGreeting();
    fetchProfileData();
    fetchKPIData();
    renderRoleCards();
    initCarousel();
    initNotifications();
});

// --- LAYOUT INJECTION ---
function renderLayout() {
    const header = document.getElementById("main-header");
    const footer = document.getElementById("main-footer");

    if (header) {
        header.innerHTML = `
            <div class="top-bar glass-panel">
                <div class="logo-container">
                    <img src="../../Clips/kbkheader.png" alt="Logo" class="neon-logo">
                </div>
                <div class="top-actions">
                    <div class="notif-wrapper" onclick="toggleNotifModal()">
                        <span class="material-symbols-outlined icon-touch">notifications</span>
                        <span id="notif-badge" class="badge hidden">0</span>
                    </div>
                    <div class="logout-wrapper" onclick="logout()">
                        <span class="material-symbols-outlined icon-touch">logout</span>
                    </div>
                </div>
            </div>
            <div id="notif-modal" class="notif-modal hidden">
                <div class="notif-overlay" onclick="toggleNotifModal()"></div>
                <div class="notif-panel glass-panel">
                    <div class="notif-header">
                        <h3>Notifications</h3>
                        <span class="material-symbols-outlined close-btn" onclick="toggleNotifModal()">close</span>
                    </div>
                    <div id="notif-list" class="notif-list">
                        </div>
                </div>
            </div>
        `;
    }

    if (footer) {
        footer.innerHTML = `
            <div class="bottom-nav glass-panel">
                <a href="index.html" class="nav-item">
                    <span class="material-symbols-outlined">home</span>
                </a>
                <a href="contribution.html" class="nav-item fab-wrapper">
                    <div class="fab">
                        <span class="material-symbols-outlined">volunteer_activism</span>
                    </div>
                </a>
                <a href="about.html" class="nav-item">
                    <span class="material-symbols-outlined">info</span>
                </a>
            </div>
        `;
    }
}

// --- GREETING & TIME LOGIC ---
function updateGreeting() {
    const greetingEl = document.getElementById("greeting-text");
    const dateEl = document.getElementById("greeting-date");
    
    // Get Manila Time
    const manilaTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
    const dateObj = new Date(manilaTime);
    
    const hour = dateObj.getHours();
    let timeOfDay = "Evening";
    if (hour < 12) timeOfDay = "Morning";
    else if (hour < 18) timeOfDay = "Afternoon";

    // Format Date: Tuesday, March 10, 2026
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = dateObj.toLocaleDateString("en-US", options);

    // Extract first name for greeting
    const firstName = cachedProfile.fullname.split(" ")[0] || "Member";

    greetingEl.innerText = `Good ${timeOfDay}, ${firstName}!`;
    dateEl.innerText = formattedDate;
}

// --- PROFILE & DATA FETCHING ---
async function fetchProfileData() {
    const profileImg = document.getElementById("profile-img");
    
    try {
        const { data, error } = await supabaseClient
            .from("kbk_membership_data")
            .select("picture")
            .eq("id", memberID)
            .single();

        if (data && data.picture) {
            profileImg.src = data.picture; // Cloudinary URL expected
        }
    } catch (err) {
        console.error("Profile picture fetch error:", err);
    }
}

async function fetchKPIData() {
    const kpiValue = document.getElementById("kpi-value");
    try {
        const { count, error } = await supabaseClient
            .from("kbk_membership_data")
            .select("*", { count: 'exact', head: true })
            .eq("status", "Active");

        if (!error) {
            kpiValue.innerText = count;
            kpiValue.classList.remove("skeleton-text");
        }
    } catch (err) {
        console.error("KPI fetch error:", err);
    }
}

// --- ROLE BASED CARDS ---
const ROLE_CONFIG = {
    member: [
        { title: "Membership Perks", icon: "redeem", link: "perks.html", color: "grad-violet" },
        { title: "Volunteer Hub", icon: "group", link: "volunteer.html", color: "grad-orange" }
    ],
    barangay_moderator: [
        { title: "Membership Perks", icon: "redeem", link: "perks.html", color: "grad-violet" },
        { title: "Membership Data", icon: "dataset", link: "membership.html", color: "grad-green" },
        { title: "Volunteer Hub", icon: "group", link: "volunteer.html", color: "grad-orange" }
    ],
    barangay_admin: [
        { title: "Membership Perks", icon: "redeem", link: "perks.html", color: "grad-violet" },
        { title: "Monthly Dues", icon: "payments", link: "dues.html", color: "grad-red" },
        { title: "Membership Data", icon: "dataset", link: "membership.html", color: "grad-green" },
        { title: "Volunteer Hub", icon: "group", link: "volunteer.html", color: "grad-orange" }
    ],
    district_admin: [
        { title: "Membership Perks", icon: "redeem", link: "perks.html", color: "grad-violet" },
        { title: "Membership Data", icon: "dataset", link: "membership.html", color: "grad-green" },
        { title: "Volunteer Hub", icon: "group", link: "volunteer.html", color: "grad-orange" }
    ],
    admin: [
        { title: "Membership Perks", icon: "redeem", link: "perks.html", color: "grad-violet" },
        { title: "Membership Data", icon: "dataset", link: "membership.html", color: "grad-green" },
        { title: "Volunteer Hub", icon: "group", link: "volunteer.html", color: "grad-orange" }
    ],
    admintemp: [
        { title: "Membership Perks", icon: "redeem", link: "perks.html", color: "grad-violet" },
        { title: "Volunteer Hub", icon: "group", link: "volunteer.html", color: "grad-orange" },
        { title: "Attendance", icon: "how_to_reg", link: "attendance.html", color: "grad-green" }
    ],
    superuser: [
        { title: "Membership Perks", icon: "redeem", link: "perks.html", color: "grad-violet" },
        { title: "Monthly Dues", icon: "payments", link: "dues.html", color: "grad-red" },
        { title: "Membership Data", icon: "dataset", link: "membership.html", color: "grad-green" },
        { title: "Directory", icon: "contact_phone", link: "directory.html", color: "grad-violet" },
        { title: "Volunteer Hub", icon: "group", link: "volunteer.html", color: "grad-orange" },
        { title: "Attendance", icon: "how_to_reg", link: "attendance.html", color: "grad-green" }
    ]
};

function renderRoleCards() {
    const grid = document.getElementById("action-grid");
    grid.innerHTML = ""; // Clear skeletons
    
    const userRole = cachedProfile.role || "member";
    const cards = ROLE_CONFIG[userRole] || ROLE_CONFIG["member"];

    cards.forEach(card => {
        const cardEl = document.createElement("a");
        cardEl.href = card.link;
        cardEl.className = `action-card ${card.color}`;
        cardEl.innerHTML = `
            <span class="material-symbols-outlined card-icon">${card.icon}</span>
            <span class="card-title">${card.title}</span>
        `;
        grid.appendChild(cardEl);
    });
}

// --- NOTIFICATIONS LOGIC ---
let unreadCount = 0;

async function initNotifications() {
    await fetchNotifications();
    setupRealtimeNotifications();
}

async function fetchNotifications() {
    const { data: notifications, error } = await supabaseClient
        .from("notifications")
        .select("*")
        .or(`receiver_user_id.eq.${memberID},receiver_group.eq.${userGroup}`)
        .order("created_at", { ascending: false })
        .limit(10);

    if (!error && notifications) {
        renderNotifications(notifications);
    }
}

function renderNotifications(notifications) {
    const notifList = document.getElementById("notif-list");
    notifList.innerHTML = "";
    unreadCount = 0;

    if (notifications.length === 0) {
        notifList.innerHTML = `<p class="empty-notif">No new notifications</p>`;
        return;
    }

    notifications.forEach(notif => {
        // Simple logic for unread: assuming all fetched are unread for this demo unless explicitly marked
        // If you add a "read" boolean to DB, check it here.
        unreadCount++; 
        
        const row = document.createElement("div");
        row.className = "notif-row unread";
        row.innerHTML = `
            <div class="notif-time">${timeAgo(notif.created_at)}</div>
            <div class="notif-content">
                <span class="notif-subject">${notif.subject}</span>
                <span class="unread-dot"></span>
            </div>
        `;
        // Add click listener for full message modal expansion (can implement a deeper modal here)
        row.addEventListener("click", () => {
            row.classList.remove("unread");
            row.querySelector('.unread-dot')?.remove();
            alert(`Message:\n${notif.message}`); // Placeholder for message expansion
            updateBadge(--unreadCount);
        });

        notifList.appendChild(row);
    });

    updateBadge(unreadCount);
}

function setupRealtimeNotifications() {
    supabaseClient
        .channel('custom-all-channel')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications' },
            (payload) => {
                const newNotif = payload.new;
                if (newNotif.receiver_user_id === memberID || newNotif.receiver_group === userGroup) {
                    // Prepend new notification
                    fetchNotifications(); // Refresh list to maintain max 10 and order
                }
            }
        )
        .subscribe();
}

function updateBadge(count) {
    const badge = document.getElementById("notif-badge");
    if (count > 0) {
        badge.innerText = count;
        badge.classList.remove("hidden");
    } else {
        badge.classList.add("hidden");
    }
}

function toggleNotifModal() {
    const modal = document.getElementById("notif-modal");
    modal.classList.toggle("hidden");
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString("en-US", options);
}

// --- CAROUSEL LOGIC ---
function initCarousel() {
    const track = document.querySelector('.carousel-track');
    if(!track) return;
    let index = 0;
    const slides = document.querySelectorAll('.carousel-slide');
    const total = slides.length;

    setInterval(() => {
        index = (index + 1) % total;
        track.style.transform = `translateX(-${index * 100}%)`;
    }, 5000);
}

// --- LOGOUT ---
window.logout = function() {
    sessionStorage.clear();
    window.location.href = "../index.html";
};
