const supabaseClient = window.supabaseClient;

// Generic SVG icon for profile picture fallback
const GENERIC_PROFILE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 24 24" fill="#bdbdbd">
  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
</svg>
`;

async function loadUserProfile() {
  try {
    // 1️⃣ Get logged-in user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("No logged-in user", userError);
      return;
    }

    // 2️⃣ Get id_number from user_roles using auth_user_id
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("id_number")
      .eq("auth_user_id", user.id)
      .single();

    if (roleError || !roleData) {
      console.error("No role data found", roleError);
      return;
    }

    const userIdNumber = roleData.id_number;

    // 3️⃣ Get members_data by id_number
    const { data: profile, error: profileError } = await supabaseClient
      .from("members_data")
      .select("*")
      .eq("id_number", userIdNumber)
      .maybeSingle();

    if (profileError || !profile) {
      console.error("No profile data found", profileError);
      return;
    }

    // 4️⃣ Profile picture
    const profilePic = document.getElementById("profile-pic");
    if (profile.picture) {
      profilePic.src = `${profile.picture}?auto=format&fit=crop&w=200&h=200`;
    } else {
      profilePic.outerHTML = `<div class="profile-pic-container">${GENERIC_PROFILE_SVG}</div>`;
    }

    // 5️⃣ Full name with middle initial & suffix
    const middleInitial =
      profile.middle_name && profile.middle_name !== "N/A"
        ? profile.middle_name[0] + "."
        : "";
    const suffix = profile.suffix ? ` ${profile.suffix}` : "";
    const fullName = `${profile.first_name} ${middleInitial} ${profile.last_name}${suffix}`;
    document.getElementById("full-name").textContent = fullName;

    // 6️⃣ Other profile info
    document.getElementById("id-number").textContent = profile.id_number;
    document.getElementById("designation").textContent =
      profile.designation || "N/A";
    document.getElementById("dob").textContent = profile.birth_date || "N/A";
    document.getElementById("address").textContent = profile.address || "N/A";
    document.getElementById("barangay").textContent = profile.barangay || "N/A";
    document.getElementById("district").textContent = profile.district || "N/A";
    document.getElementById("email").textContent = profile.email_add || "N/A";
    document.getElementById("phone").textContent = profile.phone_number || "N/A";
    document.getElementById("precinct").textContent = profile.precint_no || "N/A";
    document.getElementById("referrer").textContent = profile.referrer || "N/A";

    // 7️⃣ Fetch Electronic Raffle count from contributions table
    const { data: raffleData, error: raffleError } = await supabase
      .from("contributions")
      .select("payment_id") // just need count
      .eq("id_number", userIdNumber)
      .eq("raffle_status", "On Track");

    if (raffleError) {
      console.error("Raffle fetch error", raffleError);
      return;
    }

    const raffleCount = raffleData.length;
    const raffleElement = document.getElementById("raffle-count");
    raffleElement.textContent = raffleCount;

    // Animate raffle count
    raffleElement.style.transform = "scale(1.3)";
    setTimeout(() => {
      raffleElement.style.transform = "scale(1)";
    }, 500);

  } catch (err) {
    console.error("Error loading profile:", err);
  }
}

// Load profile when DOM is ready
document.addEventListener("DOMContentLoaded", loadUserProfile);
