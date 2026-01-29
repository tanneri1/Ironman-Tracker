// Authentication Service
import { auth, profiles } from '../lib/supabase.js';
import { showToast } from '../utils.js';

class AuthService {
    constructor() {
        this.user = null;
        this.profile = null;
        this.listeners = new Set();
    }

    async init() {
        // Set up auth state listener
        auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                this.user = session.user;
                try {
                    this.profile = await profiles.get(session.user.id);
                } catch (error) {
                    console.error('Error fetching profile:', error);
                }
            } else {
                this.user = null;
                this.profile = null;
            }
            this.notifyListeners();
        });

        // Check for existing session
        const session = await auth.getSession();
        if (session?.user) {
            this.user = session.user;
            try {
                this.profile = await profiles.get(session.user.id);
            } catch (error) {
                console.error('Error fetching profile:', error);
            }
        }

        return this.user;
    }

    async signUp(email, password) {
        try {
            await auth.signUp(email, password);
            showToast('Account created! Please check your email to verify.', 'success');
            return true;
        } catch (error) {
            showToast(error.message, 'error');
            return false;
        }
    }

    async signIn(email, password) {
        try {
            await auth.signIn(email, password);
            showToast('Welcome back!', 'success');
            return true;
        } catch (error) {
            showToast(error.message, 'error');
            return false;
        }
    }

    async signOut() {
        try {
            await auth.signOut();
            showToast('Logged out successfully', 'success');
            return true;
        } catch (error) {
            showToast(error.message, 'error');
            return false;
        }
    }

    async updateProfile(updates) {
        if (!this.user) return false;
        try {
            this.profile = await profiles.update(this.user.id, updates);
            showToast('Profile updated', 'success');
            this.notifyListeners();
            return true;
        } catch (error) {
            showToast(error.message, 'error');
            return false;
        }
    }

    isAuthenticated() {
        return !!this.user;
    }

    getUser() {
        return this.user;
    }

    getProfile() {
        return this.profile;
    }

    getUserId() {
        return this.user?.id;
    }

    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notifyListeners() {
        this.listeners.forEach(callback => callback(this.user, this.profile));
    }
}

export const authService = new AuthService();
