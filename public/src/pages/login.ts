// Login page logic migrated to module

type LoginResponse = {
    token?: string;
    refreshToken?: string;
    user?: { name?: string };
    error?: string;
};

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

function getDashboardUrl() {
    return window.location.pathname.includes('app.html') ? 'app.html#/dashboard' : 'dashboard.html';
}

function getInputValue(id: string): string {
    const input = document.getElementById(id) as HTMLInputElement | null;
    return input?.value ?? '';
}

function getErrorMessageElement(): HTMLElement | null {
    return document.getElementById('errorMsg');
}

async function handleLogin(e: Event) {
    e.preventDefault();

    const identifier = getInputValue('username').trim();
    const password = getInputValue('password');
    const errorMsg = getErrorMessageElement();

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

        const data: LoginResponse = await response.json();

        if (!response.ok || !data?.token) {
            throw new Error(data?.error || 'Credenciais inválidas');
        }

        sessionStorage.setItem('selfDashboardToken', data.token);
        if (data.refreshToken) {
            sessionStorage.setItem('selfDashboardRefreshToken', data.refreshToken);
        }
        sessionStorage.setItem('selfDashboardUser', data.user?.name || identifier);
        sessionStorage.setItem('selfDashboardExpiry', Date.now() + (8 * 60 * 60 * 1000));

        window.location.href = getDashboardUrl();
    } catch (error) {
        if (errorMsg) {
            errorMsg.style.display = 'block';
            errorMsg.textContent = error instanceof Error ? error.message : 'Falha ao realizar login';
            setTimeout(() => {
                errorMsg.style.display = 'none';
            }, 4000);
        }
    }

    return false;
}

function initLogin() {
    // Verificar se ja esta logado
    if (sessionStorage.getItem('selfDashboardToken')) {
        const expiry = sessionStorage.getItem('selfDashboardExpiry');
        if (expiry && Date.now() < parseInt(expiry)) {
            window.location.href = getDashboardUrl();
            return;
        }
    }

    const windowAny = window as Window & {
        handleLogin?: (e: Event) => boolean | Promise<boolean>;
        initLogin?: () => void;
    };
    windowAny.handleLogin = handleLogin;
    windowAny.initLogin = initLogin;
}

onReady(initLogin);

export { initLogin };
