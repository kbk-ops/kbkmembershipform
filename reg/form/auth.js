(function() {
    const referrerID = sessionStorage.getItem('referrerID');
    const registerEmail = sessionStorage.getItem('registerEmail');

    if (!referrerID || !registerEmail) {
        console.warn("Session data missing. Redirecting to home...");
        window.location.href = "../index.html";
    }
})();