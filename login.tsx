import { API_BASE_URL } from './login.helper.js';
// Fix: Use the named export `injectSpeedInsights` as the default export is not a callable function.
import { injectSpeedInsights } from '@vercel/speed-insights';

injectSpeedInsights();

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form') as HTMLFormElement;
    const errorMessage = document.getElementById('error-message') as HTMLParagraphElement;
    const loginButton = document.getElementById('login-button') as HTMLButtonElement;
    const apiUrlInput = document.getElementById('api-url') as HTMLInputElement;
    const updateUrlButton = document.getElementById('update-url-button') as HTMLButtonElement;
    const rememberMeCheckbox = document.getElementById('remember-me') as HTMLInputElement;
    const usernameInput = document.getElementById('username') as HTMLInputElement;

    // --- Remember Me Functionality ---
    const loadRememberedUser = () => {
        const savedUsername = localStorage.getItem('pmicUsername');
        if (savedUsername) {
            usernameInput.value = savedUsername;
            rememberMeCheckbox.checked = true;
        }
    };

    const handleRememberMe = (username: string) => {
        if (rememberMeCheckbox.checked) {
            localStorage.setItem('pmicUsername', username);
        } else {
            localStorage.removeItem('pmicUsername');
        }
    };
    // --- End Remember Me ---

    // --- API URL Management ---
    const getApiUrl = (): string => {
        // Use the custom URL from localStorage if it exists, otherwise fall back to the default.
        return localStorage.getItem('customApiBaseUrl') || API_BASE_URL;
    };

    const saveApiUrl = (newUrl: string) => {
        if (newUrl) {
            localStorage.setItem('customApiBaseUrl', newUrl);
            updateUrlButton.textContent = 'Saved!';
            updateUrlButton.classList.add('saved');
            setTimeout(() => {
                updateUrlButton.textContent = 'Save';
                updateUrlButton.classList.remove('saved');
            }, 1500);
        }
    };

    // Populate the input with the a current effective URL on load
    apiUrlInput.value = getApiUrl();
    
    // Add event listener for the save button
    updateUrlButton.addEventListener('click', () => {
        saveApiUrl(apiUrlInput.value.trim());
    });
    // --- End API URL Management ---


    // If already authenticated, redirect to dashboard
    if (sessionStorage.getItem('authToken')) {
        window.location.href = 'index.html';
        return;
    }
    
    // Check for a remembered user on page load
    loadRememberedUser();


    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // UI state: loading
        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';
        errorMessage.classList.add('hidden');

        const formData = new FormData(loginForm);
        const username = formData.get('username') as string;
        const password = formData.get('password');
        
        // Use the dynamically retrieved API URL
        const currentApiUrl = apiUrlInput.value.trim();
        // Also save the URL on login attempt in case it was just typed
        saveApiUrl(currentApiUrl);

        try {
            const requestUrl = `${currentApiUrl}/login`;
            const method = 'POST';
            console.log(`[API Call] Requesting: ${method} ${requestUrl}`);
            
            const response = await fetch(requestUrl, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            console.log(`[API Call] Received response with status: ${response.status}`);

            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    handleRememberMe(username); // Handle saving/clearing the username
                    sessionStorage.setItem('authToken', data.token);
                    window.location.href = 'index.html';
                } else {
                    errorMessage.textContent = 'Login successful, but no token received.';
                    errorMessage.classList.remove('hidden');
                }
            } else {
                 errorMessage.textContent = 'Invalid credentials. Please try again.';
                 errorMessage.classList.remove('hidden');
            }

        } catch (error) {
            console.error('Login Error:', error);
            errorMessage.textContent = 'An error occurred. Check the API URL and your connection.';
            errorMessage.classList.remove('hidden');
        } finally {
            // UI state: idle
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    });
});