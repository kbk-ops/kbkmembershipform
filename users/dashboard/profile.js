// Use your existing supabaseClient.js
const supabaseClient = window.supabaseClient;

// Generic SVG icon for profile picture
const GENERIC_PROFILE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 24 24" fill="#bdbdbd">
  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
</svg>
`;

async function loadUserProfile() {
  // Get logged-in user from Supabase Auth
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

  if (userError || !user) {
    console.error('No logged-in user', userError);
    return;
  }

  // Fetch members_data based on user's email
  const { data: member, error: memberError } = await supabase
    .from('members_data')
    .select('*')
    .eq('email_add', user.email)
    .single();

  if (memberError || !member) {
    console.error('Member data not found', memberError);
    return;
  }

  // Profile picture
  const profilePic = document.getElementById('profile-pic');
  if (member.picture) {
    profilePic.src = `${member.picture}?auto=format&fit=crop&w=200&h=200`;
  } else {
    // Insert generic SVG icon
    profilePic.outerHTML = `<div class="profile-pic-container">${GENERIC_PROFILE_SVG}</div>`;
  }

  // Full Name with middle initial & suffix
  const middleInitial = member.middle_name && member.middle_name !== 'N/A' ? member.middle_name[0] + '.' : '';
  const suffix = member.suffix ? ` ${member.suffix}` : '';
  const fullName = `${member.first_name} ${middleInitial} ${member.last_name}${suffix}`;
  document.getElementById('full-name').textContent = fullName;

  // Other profile data
  document.getElementById('id-number').textContent = member.id_number;
  document.getElementById('designation').textContent = member.designation || 'N/A';
  document.getElementById('dob').textContent = member.birth_date || 'N/A';
  document.getElementById('address').textContent = member.address || 'N/A';
  document.getElementById('barangay').textContent = member.barangay || 'N/A';
  document.getElementById('district').textContent = member.district || 'N/A';
  document.getElementById('email').textContent = member.email_add || 'N/A';
  document.getElementById('phone').textContent = member.phone_number || 'N/A';
  document.getElementById('precinct').textContent = member.precint_no || 'N/A';
  document.getElementById('referrer').textContent = member.referrer || 'N/A';

  // Fetch Electronic Raffle count
  const { data: raffleData, error: raffleError } = await supabase
    .from('user_roles')
    .select('id_number')
    .eq('id_number', member.id_number)
    .eq('raffle_status', 'On Track');

  if (raffleError) {
    console.error(raffleError);
    return;
  }

  const raffleCount = raffleData.length;
  const raffleElement = document.getElementById('raffle-count');
  raffleElement.textContent = raffleCount;

  // Animate count
  raffleElement.style.transform = 'scale(1.3)';
  setTimeout(() => { raffleElement.style.transform = 'scale(1)'; }, 500);
}

// Load profile on page ready
document.addEventListener('DOMContentLoaded', loadUserProfile);
