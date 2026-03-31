document.addEventListener("DOMContentLoaded", () => {
  // Assume window.supabaseClient is initialized in supabaseClient.js
  const supabaseClient = window.supabaseClient;

  // DOM Elements
  const elSkeleton = document.getElementById("profile-skeleton");
  const elContent = document.getElementById("profile-content");
  const elError = document.getElementById("profile-error");
  const elErrorMsg = document.getElementById("profile-error-msg");

  // Profile Elements
  const els = {
    avatar: document.getElementById("profile-picture"),
    fullname: document.getElementById("profile-fullname"),
    designation: document.getElementById("profile-designation"),
    idNumber: document.getElementById("profile-id-number"),
    raffleCount: document.getElementById("profile-raffle-count"),
    email: document.getElementById("profile-email"),
    mobile: document.getElementById("profile-mobile"),
    dob: document.getElementById("profile-dob"),
    precinct: document.getElementById("profile-precinct"),
    address: document.getElementById("profile-address"),
    barangay: document.getElementById("profile-barangay"),
    district: document.getElementById("profile-district"),
    referrer: document.getElementById("profile-referrer")
  };

  /**
   * Optimize Cloudinary Image URL or fallback to Generic SVG
   */
  const optimizeImage = (url) => {
    // Generic SVG string (Data URI) for fallback
    const defaultSVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a0a0ab'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";

    if (!url || url.trim() === '') return defaultSVG;
    
    // Inject f_auto,q_auto,w_300 into Cloudinary URL
    if (url.includes('/upload/')) {
      return url.replace('/upload/', '/upload/f_auto,q_auto,w_300,c_fill,ar_1:1/');
    }
    return url;
  };

  /**
   * Format full name handling nulls and N/A
   */
  const formatFullName = (first, middle, last, suffix) => {
    const isInvalid = (val) => !val || val.toLowerCase() === 'n/a' || val.toLowerCase() === 'none';
    
    let nameArr = [];
    if (!isInvalid(first)) nameArr.push(first);
    if (!isInvalid(middle)) nameArr.push(`${middle.charAt(0).toUpperCase()}.`);
    if (!isInvalid(last)) nameArr.push(last);
    if (!isInvalid(suffix)) nameArr.push(suffix);

    return nameArr.join(" ") || "Unknown User";
  };

  /**
   * Set text content, providing a fallback for empty values
   */
  const setField = (element, value, fallback = "N/A") => {
    if (element) {
      element.textContent = (value && value.trim() !== "") ? value : fallback;
    }
  };

  /**
   * Format mobile number to always start with "0"
   */
  const formatMobileNumber = (mobileStr) => {
    if (!mobileStr) return "N/A";
    let formatted = mobileStr.toString().trim();
    
    // Convert +63 to 0
    if (formatted.startsWith("+63")) {
      formatted = "0" + formatted.slice(3);
    } 
    // If it doesn't start with 0, prepend it
    else if (!formatted.startsWith("0")) {
      formatted = "0" + formatted;
    }
    
    return formatted;
  };

  /**
   * Main Initialization Function
   */
  const initProfile = async () => {
    try {
      // 1. Get Auth User
      const { data: authData, error: authErr } = await supabaseClient.auth.getUser();
      if (authErr || !authData?.user) throw new Error("Authentication failed. Please log in.");
      const authUserId = authData.user.id;

      // 2. Fetch user_roles matching auth_user_id to get id_number
      const { data: roleData, error: roleErr } = await supabaseClient
        .from('user_roles')
        .select('id_number')
        .eq('auth_user_id', authUserId)
        .single();
        
      if (roleErr || !roleData?.id_number) throw new Error("User role not found.");
      const idNumber = roleData.id_number;

      // 3. Parallel fetch: members_data and Raffle Count
      const [memberRes, raffleRes] = await Promise.all([
        supabaseClient
          .from('members_data')
          .select('*')
          .eq('id_number', idNumber)
          .single(),
        supabaseClient
          .from('contribitions')
          .select('*', { count: 'exact', head: true })
          .eq('id_number', idNumber)
          .eq('raffle_status', 'On Track')
      ]);

      if (memberRes.error || !memberRes.data) throw new Error("Member data not found.");
      
      const member = memberRes.data;
      const raffleCount = raffleRes.count || 0;

      // 4. Populate DOM
      els.avatar.src = optimizeImage(member.picture);
      
      const fullName = formatFullName(
        member.first_name, 
        member.middle_name, 
        member.last_name, 
        member.suffix
      );
      
      setField(els.fullname, fullName);
      setField(els.designation, member.designation, "Member");
      setField(els.idNumber, member.id_number);
      
      // Animate counter
      animateValue(els.raffleCount, 0, raffleCount, 1000);

      setField(els.email, member.email_add);
      
      // Apply the new mobile number formatting
      setField(els.mobile, formatMobileNumber(member.phone_number));
      
      // Format DOB if exists
      const dobStr = member.birth_date ? new Date(member.birth_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
      setField(els.dob, dobStr);
      
      setField(els.precinct, member.precinct_no);
      setField(els.address, member.address);
      setField(els.barangay, member.barangay);
      setField(els.district, member.district);
      setField(els.referrer, member.referrer);

      // Hide Skeleton, Show Content
      elSkeleton.style.display = 'none';
      elContent.style.display = 'block';
      elContent.classList.add('profile-fade-in');

    } catch (err) {
      console.error("Profile Load Error:", err);
      elSkeleton.style.display = 'none';
      elError.style.display = 'block';
      elErrorMsg.textContent = err.message || "An unexpected error occurred.";
    }
  };

  /**
   * Utility: Animate numbers counting up
   */
  const animateValue = (obj, start, end, duration) => {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      obj.innerHTML = Math.floor(progress * (end - start) + start);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  };

  /**
   * Copy to Clipboard Event
   */
  const copyBtn = document.getElementById('profile-btn-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const idTxt = els.idNumber.textContent;
      if (!idTxt || idTxt === "N/A") return;

      navigator.clipboard.writeText(idTxt).then(() => {
        const originalTitle = copyBtn.title;
        copyBtn.title = "Copied!";
        // Highlight effect
        copyBtn.style.color = "#00b09b";
        setTimeout(() => {
          copyBtn.title = originalTitle;
          copyBtn.style.color = "";
        }, 2000);
      });
    });
  }

  // Trigger init on load
  initProfile();
});
