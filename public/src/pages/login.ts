// @ts-nocheck
// Login page logic migrated to module

async function handleLogin(e) {
    e.preventDefault();

    const identifier = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');

    try {
        const response = await fetch(`${window.location.origin}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: identifier,
                password
            })
        });

        const data = await response.json();

        if (!response.ok || !data?.token) {
            throw new Error(data?.error || 'Credenciais inválidas');
        }

        sessionStorage.setItem('selfDashboardToken', data.token);
        if (data.refreshToken) {
            sessionStorage.setItem('selfDashboardRefreshToken', data.refreshToken);
        }
        sessionStorage.setItem('selfDashboardUser', data.user?.name || identifier);
        sessionStorage.setItem('selfDashboardExpiry', Date.now() + (8 * 60 * 60 * 1000));

        window.location.href = 'dashboard.html';
    } catch (error) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = error.message || 'Falha ao realizar login';
        setTimeout(() => {
            errorMsg.style.display = 'none';
        }, 4000);
    }

    return false;
}

// Verificar se ja esta logado
if (sessionStorage.getItem('selfDashboardToken')) {
    const expiry = sessionStorage.getItem('selfDashboardExpiry');
    if (expiry && Date.now() < parseInt(expiry)) {
        window.location.href = 'dashboard.html';
    }
}

const windowAny = window as any;
windowAny.handleLogin = handleLogin;

export {};
