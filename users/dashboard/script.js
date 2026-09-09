document.addEventListener("DOMContentLoaded", () => {
  initAuthGuard();
  initDashboard();
  setupCarousel();
  renderUpcomingEvent();
  initOverlay();
});

function initOverlay() {
  const overlay = document.getElementById("promo-overlay");
  const closeBtn = document.getElementById("close-overlay");

  if (overlay && closeBtn) {
    // Show overlay smoothly on load
    setTimeout(() => {
      overlay.classList.remove("hidden");
    }, 500);

    // Close button logic
    closeBtn.addEventListener("click", () => {
      overlay.classList.add("hidden");
    });

    // Close when clicking outside of the modal container
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.add("hidden");
      }
    });
  }
}

function goToApply() {
  window.location.href = "apply.html";
}

function optimizeCloudinary(url, transformations = "w_400,q_auto,f_auto") {
  if (!url || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/${transformations}/`);
}

async function initDashboard() {
  const greetingEl = document.getElementById("user-greeting");
  const profileImg = document.getElementById("profile-pic");
  const activeCountEl = document.getElementById("active-count");

  // Skeleton is visible initially
  greetingEl.classList.add("skeleton", "skeleton-text");
  profileImg.classList.add("skeleton", "skeleton-img");
  activeCountEl.classList.add("skeleton", "skeleton-count");

  // 1. Set Greeting & Date
  const now = new Date();
  const manilaTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    hour12: false,
    weekday: "long",
    month: "long",
    day: "numeric"
  }).formatToParts(now);

  const hour = parseInt(manilaTime.find((p) => p.type === "hour").value, 10);
  const dayStr = `${manilaTime.find((p) => p.type === "weekday").value}, ${
    manilaTime.find((p) => p.type === "month").value
  } ${manilaTime.find((p) => p.type === "day").value}, 2026`;
  document.getElementById("current-date").innerText = dayStr;

  let greeting =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  // 2. Fetch User Data
  const {
    data: { user }
  } = await supabaseClient.auth.getUser();
  if (!user) return (window.location.href = "../index.html");

  const { data: roleData } = await supabaseClient
    .from("user_roles")
    .select("id_number")
    .eq("auth_user_id", user.id)
    .single();

  const userIdNumber = roleData?.id_number;
  const { data: profile } = await supabaseClient
    .from("members_data")
    .select("*")
    .eq("id_number", userIdNumber)
    .maybeSingle();

  // Remove skeletons after data loads
  if (profile) {
    greetingEl.innerText = `${greeting}, ${profile.first_name}!`;
    greetingEl.classList.remove("skeleton", "skeleton-text");

    profileImg.src = profile.picture
      ? optimizeCloudinary(
          profile.picture,
          "w_120,h_120,c_fill,g_face,q_auto,f_auto"
        )
      : `https://ui-avatars.com/api/?name=${profile.first_name}&background=10b981&color=fff`;
    profileImg.classList.remove("skeleton", "skeleton-img");
  }

  // 3. Fetch KPI
  async function updateActiveUsers() {
    try {
      const res = await fetch(
        "https://ayynblvknxuvazbwpxpm.supabase.co/functions/v1/active_users_count"
      );
      if (!res.ok) throw new Error(res.statusText);

      const data = await res.json();
      activeCountEl.innerText = data.active_count ?? 0;
      activeCountEl.classList.remove("skeleton", "skeleton-count");
    } catch (err) {
      console.error("Error fetching active users:", err);
      activeCountEl.innerText = 0;
      activeCountEl.classList.remove("skeleton", "skeleton-count");
    }
  }

  updateActiveUsers();

  // Remove skeletons from the entire card
  const activeCard = document.getElementById("active-members-card");
  if (activeCard) {
    activeCard.classList.remove("skeleton-wrapper");

    const title = activeCard.querySelector(".kpi-title");
    if (title) {
      title.classList.remove("skeleton", "skeleton-text");
    }
  }

  // 4. Render role cards
  await renderRoleCards(user.id);
}

async function renderRoleCards(userId) {
  const container = document.getElementById("role-grid");
  if (!container) return;

  const { data: roleData } = await supabaseClient
    .from("user_roles")
    .select("role")
    .eq("auth_user_id", userId)
    .single();

  const role = roleData?.role || "member";

  const cardDefinitions = {
    perks: { title: "Membership Perks", icon: "🎁", url: "perks.html" },
    dues: { title: "Monthly Dues", icon: "💳", url: "dues.html" },
    data: { title: "Membership Data", icon: "📊", url: "membership.html" },
    volunteer: { title: "Volunteer Hub", icon: "🤝", url: "volunteer.html" },
    directory: { title: "Directory", icon: "📇", url: "directory.html" },
    attendance: { title: "Attendance", icon: "📝", url: "attendance.html" }
  };

  const roleMap = {
    member: ["perks", "volunteer"],
    brgy_moderator: ["perks", "data", "volunteer"],
    brgy_admin: ["perks", "dues", "data", "volunteer"],
    dist_admin: ["perks", "data", "volunteer"],
    admin: ["perks", "data", "volunteer"],
    admintemp: ["perks", "volunteer", "attendance"],
    superuser: ["perks", "dues", "data", "directory", "volunteer", "attendance"]
  };

  const allowedCards = roleMap[role] || roleMap["member"];

  // Color rotation
  const colors = ["grad-violet", "grad-green", "grad-red", "grad-orange"];

  container.innerHTML = allowedCards
    .map((key, index) => {
      const card = cardDefinitions[key];
      const colorClass = colors[index % colors.length];

      return `
            <div class="role-card glass ${colorClass}" onclick="location.href='${card.url}'">
                <span>${card.icon}</span>
                <h4>${card.title}</h4>
            </div>
        `;
    })
    .join("");
}

function setupCarousel() {
  const track = document.getElementById("carousel");
  const bulletsContainer = document.getElementById("carousel-bullets");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");

  if (!track || !bulletsContainer || !prevBtn || !nextBtn) return;

  const slidesData = [
    {
      src:
        "https://res.cloudinary.com/dlte9ybza/image/upload/v1773931734/YEP1_q1d7sa.jpg",
      title: "2025 Year End Party"
    },
    {
      src:
        "https://res.cloudinary.com/dlte9ybza/image/upload/v1773931734/with_mayor_vvqomz.jpg",
      title: "Meeting with Mayor Along"
    },
    {
      src:
        "https://res.cloudinary.com/dlte9ybza/image/upload/v1773931737/Relief_tk477s.jpg",
      title: "KBKAI Relief Operation"
    },
    {
      src:
        "https://res.cloudinary.com/dlte9ybza/image/upload/v1776070133/Arpil_Monthly_Meeting_iwzcil.jpg",
      title: "April Monthly Meeting Dist. III"
    },
	{
      src:
        "https://res.cloudinary.com/dlte9ybza/image/upload/v1777019776/aprilmeeting1_n4wjzy.jpg",
      title: "April Monthly Meeting Dist. III"
    },
	{
      src:
        "https://res.cloudinary.com/dlte9ybza/image/upload/v1777019777/aprilmeeting_kjgw5n.jpg",
      title: "April Monthly Meeting Dist. III"
    },
	{
      src:
        "https://res.cloudinary.com/dlte9ybza/image/upload/v1777019576/bingo2_h9a5f4.jpg",
      title: "KBK Bingo Social Dist. III"
    },
	{
      src:
        "https://res.cloudinary.com/dlte9ybza/image/upload/v1788966297/sagala1_l72bzx.jpg",
      title: "KBK SAGALA 2026 Dist. III"
    },
	{
      src:
        "https://res.cloudinary.com/dlte9ybza/image/upload/v1788966357/Sagala2_ex3run.jpg",
      title: "KBK SAGALA 2026 Dist. III"
    },
	{
      src:
        "https://res.cloudinary.com/dlte9ybza/image/upload/v1788966586/sagala3_ii7hkq.jpg",
      title: "KBK SAGALA 2026 Dist. III"
    },
	{
      src:
        "https://res.cloudinary.com/dlte9ybza/image/upload/v1788966707/sagala4_utreje.jpg",
      title: "KBK SAGALA 2026 Dist. III"
    },
	{
      src:
        "https://res.cloudinary.com/dlte9ybza/image/upload/v1788966783/sagala5_pegvdi.jpg",
      title: "KBK SAGALA 2026 Dist. III"
    }
  ];

  let index = 0;
  let interval;

  // Render images with title overlay
  track.innerHTML = slidesData
    .map(
      (slide) => `
      <div class="carousel-slide">
        <img 
          src="${optimizeCloudinary(
            slide.src,
            "w_800,h_450,c_fill,q_auto,f_auto"
          )}" 
          alt="${slide.title}"
          loading="lazy"
        >
        <div class="carousel-title-overlay">${slide.title}</div>
      </div>
    `
    )
    .join("");

  // Render bullets (make sure to use slidesData.length here now)
  bulletsContainer.innerHTML = slidesData
    .map((_, i) => `<span class="${i === 0 ? "active" : ""}"></span>`)
    .join("");
  const bullets = bulletsContainer.querySelectorAll("span");

  function goToSlide(i) {
    index = (i + slidesData.length) % slidesData.length; // use slidesData.length
    track.style.transform = `translateX(-${index * 100}%)`;
    bullets.forEach((b) => b.classList.remove("active"));
    bullets[index].classList.add("active");
  }

  // Next / Prev buttons
  nextBtn.addEventListener("click", () => {
    goToSlide(index + 1);
    resetInterval();
  });
  prevBtn.addEventListener("click", () => {
    goToSlide(index - 1);
    resetInterval();
  });

  // Bullet clicks
  bullets.forEach((bullet, i) =>
    bullet.addEventListener("click", () => {
      goToSlide(i);
      resetInterval();
    })
  );

  // Auto-slide
  function startInterval() {
    interval = setInterval(() => goToSlide(index + 1), 4000);
  }
  function resetInterval() {
    clearInterval(interval);
    startInterval();
  }

  startInterval();
}

async function renderUpcomingEvent() {
  const container = document.getElementById("events-list");
  if (!container) return;

  // Show skeleton first
  container.innerHTML = `
        <div class="skeleton-event">
            <div class="skeleton-event-image"></div>
            <div class="skeleton-event-text">
                <div class="skeleton-event-text-line"></div>
                <div class="skeleton-event-text-line"></div>
                <div class="skeleton-event-text-line"></div>
            </div>
        </div>
    `;

  // Simulate async fetch or load
  setTimeout(() => {
    const eventData = {
      image:
        "https://res.cloudinary.com/dlte9ybza/image/upload/v1788967671/Year_End_Party_2026_saczrl.jpg",
      title: "KBKAI Dist. III Year End Party 2026",
      date: "Saturday, December 05, 2026, 3:00 PM",
      location: "Amphitheater Glorietta Park Tala, Caloocan City"
    };

    const optimizedSrc = optimizeCloudinary(
      eventData.image,
      "w_200,h_200,c_fill,q_auto,f_auto"
    );

    container.innerHTML = `
  <div class="upcoming-event-card">
    <img 
      src="${optimizedSrc}" 
      class="upcoming-event-image"
      width="100"
      height="100"
      loading="lazy"
      alt="Event"
    >
    <div class="upcoming-event-info">
      <div class="upcoming-event-title">${eventData.title}</div>
      <div class="upcoming-event-date">${eventData.date}</div>
      <div class="upcoming-event-location">${eventData.location}</div>
    </div>
  </div>
`;
  }, 500);
}
