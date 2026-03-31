const supabase = window.supabaseClient;

const GENERIC_PROFILE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 24 24" fill="#bdbdbd">
  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
</svg>
`;

async function loadUserProfile() {
  console.log("Loading profile...");

  try {
    // 1️⃣ Get logged-in user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error("Auth error:", userError);
      return;
    }

    if (!user) {
      console.warn("No logged-in user detected. Make sure a session exists.");
      return;
    }

    console.log("Logged-in user:", user);

    // 2️⃣ Get id_number from user_roles
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("id_number")
      .eq("auth_user_id", user.id)
      .single();

    if (roleError) {
      console.error("Error fetching user_roles:", roleError);
      return;
    }

    if (!roleData) {
      console.warn("No role data found for user:", user.id);
      return;
    }

    const userIdNumber = roleData.id_number;
    console.log("User id_number:", userIdNumber);

    // 3️⃣ Get members_data by id_number
    const { data: profile, error: profileError } = await supabase
      .from("members_data")
      .select("*")
      .eq("id_number", userIdNumber)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching members_data:", profileError);
      return;
    }

    if (!profile) {
      console.warn("No members_data found for id_number:", userIdNumber);
      return;
    }

    console.log("Profile data:", profile);

    // 4️⃣ Render profile picture
    const profilePic = document.getElementById("profile-pic");
    if (profile.picture) {
      profilePic.src = `${profile.picture}?auto=format&fit=crop&w=200&h=200`;
    } else {
      profilePic.outerHTML = `<div class="profile-pic-container">${GENERIC_PROFILE_SVG}</div>`;
    }

    // 5️⃣ Render full name
    const middleInitial =
      profile.middle_name && profile.middle_name !== "N/A"
        ? profile.middle_name[0] + "."
        : "";
    const suffix = profile.suffix ? ` ${profile.suffix}` : "";
    const fullName = `${profile.first_name} ${middleInitial} ${profile.last_name}${suffix}`;
    document.getElementById("full-name").textContent = fullName;

    // 6️⃣ Other fields
    const fields = {
      "id-number": profile.id_number,
      designation: profile.designation,
      dob: profile.birth_date,
      address: profile.address,
      barangay: profile.barangay,
      district: profile.district,
      email: profile.email_add,
      phone: profile.phone_number,
      precinct: profile.precint_no,
      referrer: profile.referrer,
    };

    for (const [id, value] of Object.entries(fields)) {
      const el = document.getElementById(id);
      if (el) el.textContent = value || "N/A";
    }

    // 7️⃣ Electronic Raffle from contributions
    const { data: raffleData, error: raffleError } = await supabase
      .from("contributions")
      .select("payment_id")
      .eq("id_number", userIdNumber)
      .eq("raffle_status", "On Track");

    if (raffleError) {
      console.error("Error fetching raffle count:", raffleError);
      return;
    }

    const raffleCount = raffleData?.length || 0;
    const raffleEl = document.getElementById("raffle-count");
    if (raffleEl) raffleEl.textContent = raffleCount;
    raffleEl.style.transform = "scale(1.3)";
    setTimeout(() => { raffleEl.style.transform = "scale(1)"; }, 500);

    console.log("Profile loaded successfully!");

  } catch (err) {
    console.error("Unexpected error loading profile:", err);
  }
}

document.addEventListener("DOMContentLoaded", loadUserProfile);
