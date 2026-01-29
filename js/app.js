// Main Application Entry Point
import { router } from './router.js';
import { authService } from './services/auth.js';
import { showToast } from './utils.js';

// Import page modules
import * as dashboardPage from './pages/dashboard.js';
import * as nutritionPage from './pages/nutrition.js';
import * as workoutsPage from './pages/workouts.js';
import * as planPage from './pages/plan.js';
import * as coachPage from './pages/coach.js';
import * as profilePage from './pages/profile.js';

// DOM Elements
const authView = document.getElementById('auth-view');
const mainView = document.getElementById('main-view');
const authForm = document.getElementById('auth-form');
const authSubmit = document.getElementById('auth-submit');
const authToggle = document.getElementById('auth-toggle');
const authToggleText = document.getElementById('auth-toggle-text');
const userNameEl = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');

// Auth mode state
let isSignUp = false;

// Initialize the application
async function init() {
    // Register routes
    router.register('/', dashboardPage);
    router.register('/nutrition', nutritionPage);
    router.register('/workouts', workoutsPage);
    router.register('/plan', planPage);
    router.register('/coach', coachPage);
    router.register('/profile', profilePage);

    // Set up auth event listeners
    authForm.addEventListener('submit', handleAuthSubmit);
    authToggle.addEventListener('click', toggleAuthMode);
    logoutBtn.addEventListener('click', handleLogout);

    // Subscribe to auth state changes
    authService.subscribe(handleAuthStateChange);

    // Initialize auth service
    try {
        await authService.init();
    } catch (error) {
        console.error('Auth initialization failed:', error);
        showAuthView();
    }

    // Initial auth state check
    if (authService.isAuthenticated()) {
        showMainView();
    } else {
        showAuthView();
    }
}

function handleAuthStateChange(user, profile) {
    if (user) {
        showMainView();
        updateUserDisplay(user, profile);
    } else {
        showAuthView();
    }
}

function showAuthView() {
    authView.classList.remove('hidden');
    mainView.classList.add('hidden');
}

function showMainView() {
    authView.classList.add('hidden');
    mainView.classList.remove('hidden');

    const user = authService.getUser();
    const profile = authService.getProfile();
    updateUserDisplay(user, profile);

    // Trigger initial route
    router.handleRoute();
}

function updateUserDisplay(user, profile) {
    if (profile?.full_name) {
        userNameEl.textContent = profile.full_name;
    } else if (user?.email) {
        userNameEl.textContent = user.email;
    }
}

function toggleAuthMode(e) {
    e.preventDefault();
    isSignUp = !isSignUp;

    if (isSignUp) {
        authSubmit.textContent = 'Sign Up';
        authToggleText.textContent = 'Already have an account?';
        authToggle.textContent = 'Sign in';
    } else {
        authSubmit.textContent = 'Sign In';
        authToggleText.textContent = "Don't have an account?";
        authToggle.textContent = 'Sign up';
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();

    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    authSubmit.disabled = true;
    authSubmit.textContent = isSignUp ? 'Creating account...' : 'Signing in...';

    try {
        let success;
        if (isSignUp) {
            success = await authService.signUp(email, password);
        } else {
            success = await authService.signIn(email, password);
        }

        if (success && !isSignUp) {
            authForm.reset();
        }
    } catch (error) {
        console.error('Auth error:', error);
    } finally {
        authSubmit.disabled = false;
        authSubmit.textContent = isSignUp ? 'Sign Up' : 'Sign In';
    }
}

async function handleLogout() {
    await authService.signOut();
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
