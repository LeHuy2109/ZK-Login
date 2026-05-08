document.addEventListener('DOMContentLoaded', () => {
    const challengeBox = document.getElementById('challengeBox');
    const refreshChallengeBtn = document.getElementById('refreshChallengeBtn');
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    const messageBox = document.getElementById('messageBox');

    // Fetch a new challenge code from the server
    async function fetchChallenge() {
        try {
            challengeBox.innerText = 'Loading...';
            const res = await fetch('/challenge');
            const data = await res.json();
            if (data.challenge) {
                challengeBox.innerText = data.challenge;
            } else {
                challengeBox.innerText = 'Error';
            }
        } catch (err) {
            console.error(err);
            challengeBox.innerText = 'Network Error';
        }
    }

    // Show messages
    function showMessage(msg, type) {
        messageBox.innerText = msg;
        messageBox.className = `message-box ${type}`;
    }

    // Register Upload
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('registerFile');
        if (!fileInput.files.length) return;

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        try {
            const res = await fetch('/register', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if (res.ok) {
                showMessage(data.message || 'Đăng ký thành công!', 'success');
            } else {
                showMessage(data.error || 'Đăng ký thất bại.', 'error');
            }
        } catch (err) {
            console.error(err);
            showMessage('Không thể kết nối đến server.', 'error');
        }
    });

    // Login Upload
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('loginFile');
        if (!fileInput.files.length) return;

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        try {
            const res = await fetch('/login', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if (res.ok) {
                showMessage(data.message || 'Đăng nhập thành công!', 'success');
                // Auto refresh challenge after login success
                setTimeout(fetchChallenge, 1500);
            } else {
                showMessage(data.error || 'Đăng nhập thất bại.', 'error');
            }
        } catch (err) {
            console.error(err);
            showMessage('Không thể kết nối đến server.', 'error');
        }
    });

    // Event Listeners
    refreshChallengeBtn.addEventListener('click', fetchChallenge);

    // Initial load
    fetchChallenge();
});
