// Ensure supabaseClient.js is loaded
const supabaseClient = window.supabaseClient; // from supabaseClient.js

// Simulate logged-in user id_number
const currentUserId = "123456"; // replace dynamically if needed

async function loadUserProfile() {
    // Fetch member data
    const { data: members, error: memberError } = await supabaseClient
        .from('members_data')
        .select('*')
        .eq('id_number', currentUserId)
        .single();

    if (memberError) {
        console.error(memberError);
        return;
    }

    // Populate profile picture
    const profilePic = document.getElementById('profile-pic');
    if (members.picture) {
        profilePic.src = `${members.picture}?auto=format&fit=crop&w=200&h=200`; // optimize Cloudinary URL
    } else {
        profilePic.src = 'default-avatar.png'; // fallback
    }

    // Full Name
    const middleInitial = members.middle_name && members.middle_name !== 'N/A' ? members.middle_name[0] + '.' : '';
    const suffix = members.suffix ? ` ${members.suffix}` : '';
    const fullName = `${members.first_name} ${middleInitial} ${members.last_name}${suffix}`;
    document.getElementById('full-name').textContent = fullName;

    // Other profile data
    document.getElementById('id-number').textContent = members.id_number;
    document.getElementById('designation').textContent = members.designation || 'N/A';
    document.getElementById('dob').textContent = members.birth_date || 'N/A';
    document.getElementById('address').textContent = members.address || 'N/A';
    document.getElementById('barangay').textContent = members.barangay || 'N/A';
    document.getElementById('district').textContent = members.district || 'N/A';
    document.getElementById('email').textContent = members.email_add || 'N/A';
    document.getElementById('phone').textContent = members.phone_number || 'N/A';
    document.getElementById('precinct').textContent = members.precint_no || 'N/A';
    document.getElementById('referrer').textContent = members.referrer || 'N/A';

    // Fetch Electronic Raffle Count
    const { data: raffleData, error: raffleError } = await supabase
        .from('user_roles')
        .select('id_number')
        .eq('id_number', currentUserId)
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

// Load profile on page load
document.addEventListener('DOMContentLoaded', loadUserProfile);
