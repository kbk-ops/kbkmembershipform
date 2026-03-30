// ------------------ Supabase Setup ------------------
const URL = "https://bxezqlrgfsucvjuimgjw.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4ZXpxbHJnZnN1Y3ZqdWltZ2p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDYyNjUsImV4cCI6MjA4NTE4MjI2NX0.XeAM-FpM6MLVMsZ7Gotj0cxd5-6-3nNBeHX_AvPRU08";

const TABLE = "kbk_membership_data";

let memberData = [];

// Default profile image (SVG)
const defaultProfile =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
    <circle cx='100' cy='100' r='100' fill='#e0e0e0'/>
    <circle cx='100' cy='80' r='35' fill='#9e9e9e'/>
    <path d='M40 160c0-30 25-50 60-50s60 20 60 50' fill='#9e9e9e'/>
  </svg>
`);

// ------------------ Load Data from Supabase ------------------
async function loadData() {
  const loader = document.getElementById("loader");
  loader.style.display = "block";

  try {
    const res = await fetch(`${URL}/rest/v1/${TABLE}?select=*`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      }
    });

    if (!res.ok)
      throw new Error(`Supabase fetch failed: ${res.status} ${res.statusText}`);

    memberData = await res.json();
    console.log("Member data loaded:", memberData);
  } catch (err) {
    console.error("Supabase fetch error:", err);
    alert("Failed to load data, Relaunch and login");
  }

  loader.style.display = "none";
}

// ------------------ Format Image ------------------
function formatImage(link) {
  if (!link || link.trim() === "") {
    return defaultProfile;
  }

  if (link.startsWith("http://")) {
    link = link.replace("http://", "https://");
  }

  return link;
}

// ------------------ TAB NAVIGATION ------------------
function showTab(id) {
  document
    .querySelectorAll(".tab-content")
    .forEach((t) => t.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  if (id === "homeTab") {
    document.getElementById("searchInput").value = "";
    document.getElementById("results").innerHTML = "";
  }
}

// ------------------ Search Member ------------------
async function searchMember() {
  const loader = document.getElementById("loader");
  const searchBtn = document.getElementById("searchBtn");
  const resultsDiv = document.getElementById("results");

  loader.style.display = "block";
  searchBtn.disabled = true;
  resultsDiv.innerHTML = "";

  const keyword = document.getElementById("searchInput").value.trim();

  try {
    if (!keyword) {
      resultsDiv.innerHTML = "<p>Enter an ID or name to search.</p>";
      return;
    }

    const safeKeyword = encodeURIComponent(`*${keyword}*`);

    // Removed the &status=eq.Active from the URL so we can catch deactivated members
    const queryUrl = `${URL}/rest/v1/${TABLE}?select=*&or=(id.ilike.${safeKeyword},first_name.ilike.${safeKeyword},last_name.ilike.${safeKeyword})`;

    const res = await fetch(queryUrl, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`
      }
    });

    if (!res.ok) throw new Error(`Supabase responded with ${res.status}`);

    const data = await res.json();
    resultsDiv.innerHTML = "";

    // 1. Check if ID exists at all
    if (!data.length) {
      resultsDiv.innerHTML = "<p>No record found</p>";
      return;
    }

    // 2. Filter or check for the specific ID status
    data.forEach((row) => {
      const id = row.id || "";
      const status = row.status || "";

      // Check if this is an exact ID match and if it is not Active
      if (id.toLowerCase() === keyword.toLowerCase() && status !== "Active") {
        const msg = document.createElement("p");
        msg.className = "deactivated-msg";
        msg.style.color = "red";
        msg.innerHTML =
          "<br>⚠️The ID number belongs to a deactivated member. Please advise to coordinate with KBKAI Leadership!<br><br><strong>Note:</strong> This individual is not entitled to receive any benefits from KBKAI partners.";
        resultsDiv.appendChild(msg);
        return;
      }

      // Only display the card if the member is Active
      if (status === "Active") {
        const first = row.first_name || "";
        const middle = row.middle_name || "";
        const last = row.last_name || "";
        const suffix = row.suffix || "";
        const position = row.designation || "";
        const barangay = row.barangay || "";
        const picture = formatImage(row.picture);
        const fullFirst = suffix ? `${first} ${suffix}` : first;

        const card = document.createElement("div");
        card.className = "member-card";
        card.innerHTML = `
          <img src="${picture}" 
               loading="lazy"
               onerror="this.onerror=null;this.src='${defaultProfile}'">
          <div class="member-info">
            <h3>${first} ${last} ${suffix}</h3>
            <p><strong>ID Number:</strong> ${id}</p>
            <p><strong>Last Name:</strong> ${last}</p>
            <p><strong>First Name:</strong> ${fullFirst}</p>
            <p><strong>Middle Name:</strong> ${middle}</p>
            <p><strong>Position:</strong> ${position}</p>
            <p><strong>Barangay:</strong> ${barangay}</p>
          </div>
        `;
        resultsDiv.appendChild(card);
      }
    });

    // Final check: if we found records but NONE were active or triggered the ID message
    if (resultsDiv.innerHTML === "") {
      resultsDiv.innerHTML = "<p>No record found</p>";
    }
  } catch (err) {
    console.error("Search failed:", err);
    resultsDiv.innerHTML = "<p>Error searching members. Check console.</p>";
  } finally {
    loader.style.display = "none";
    searchBtn.disabled = false;
  }
}

// ------------------ Initialize ------------------
loadData();

// ----------Enable enter Key on search -----------
document
  .getElementById("searchInput")
  .addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      searchMember();
    }
  });
