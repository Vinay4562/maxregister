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
  
  document.getElementById('togglePassword').addEventListener('click', function () {
    const passwordField = document.getElementById('password');
    const type = passwordField.type === 'password' ? 'text' : 'password';
    passwordField.type = type;
    this.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
    this.setAttribute('aria-label', type === 'password' ? 'Show password' : 'Hide password');
  });
  