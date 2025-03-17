document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
  
    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  
    const result = await response.json();
    if (result.success) {
      window.location.href = 'Dataupload.html';
    } else {
      document.getElementById('errorMessage').innerText = result.message;
    }
  });
  
// Toggle Hamburger Menu
document.querySelector('.hamburger').addEventListener('click', function() {
  document.querySelector('.navbar').classList.toggle('active');
});

// Toggle Password Visibility
document.getElementById('togglePassword').addEventListener('click', function() {
  const passwordField = document.getElementById('password');
  if (passwordField.type === 'password') {
    passwordField.type = 'text';
  } else {
    passwordField.type = 'password';
  }
});

// Clear form fields on page load
document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
});

// Prevent back button from showing cached pages
window.history.pushState(null, null, window.location.href);
window.addEventListener("popstate", function () {
  window.location.reload(true);
});
  