// components.js

const renderNavigation = () => {
  const header = `
        <header class="top-bar">
            <img src="https://res.cloudinary.com/dlte9ybza/image/upload/w_200,f_auto/v1773671813/KBK_Header_White_ghqcjv.png" 
                 class="org-logo" alt="Logo">
            <div class="top-icons">
                <button class="icon-btn" onclick="logout()">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                </button>
            </div>
        </header>`;

  const footer = `
        <nav class="bottom-nav">
            <a href="index.html" class="nav-item">
                <svg width="30" height="30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                <span>Home</span>
            </a>
   
            <a href="about.html" class="nav-item">
                <svg width="30" height="30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>About</span>
            </a>
        </nav>`;

  document.body.insertAdjacentHTML("afterbegin", header);
  document.body.insertAdjacentHTML("beforeend", footer);
};

// Call renderNavigation and initAuthGuard on DOM load
document.addEventListener("DOMContentLoaded", () => {
  renderNavigation();

  if (window.initAuthGuard) {
    window.initAuthGuard();
  } else {
    console.error(
      "initAuthGuard not found. Make sure authGuard.js is loaded first."
    );
  }
});