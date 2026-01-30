// Profile Page
import { authService } from '../services/auth.js';
import { showToast, getFormData } from '../utils.js';

export async function render() {
    const profile = authService.getProfile() || {};
    const user = authService.getUser();

    return `
        <h1 class="page-title">Profile</h1>

        <div class="card">
            <div class="card-header">
                <h2 class="card-title">Your Information</h2>
            </div>
            <form id="profile-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="full_name">Full Name</label>
                        <input type="text" id="full_name" name="full_name" class="form-input"
                            value="${profile.full_name || ''}" placeholder="Your name">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="email">Email</label>
                        <input type="email" class="form-input" value="${user?.email || ''}" disabled>
                        <p class="text-muted" style="font-size: var(--text-sm);">Email cannot be changed</p>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="weight_kg">Weight (kg)</label>
                        <input type="number" id="weight_kg" name="weight_kg" class="form-input"
                            value="${profile.weight_kg || ''}" step="0.1" min="30" max="200">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="height_cm">Height (cm)</label>
                        <input type="number" id="height_cm" name="height_cm" class="form-input"
                            value="${profile.height_cm || ''}" min="100" max="250">
                    </div>
                </div>

                <hr style="margin: var(--space-lg) 0; border: none; border-top: 1px solid var(--gray-200);">

                <h3 style="margin-bottom: var(--space-md);">Race Details</h3>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="event_name">Event Name</label>
                        <input type="text" id="event_name" name="event_name" class="form-input"
                            value="${profile.event_name || ''}" placeholder="e.g., Ironman Arizona">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="event_date">Event Date</label>
                        <input type="date" id="event_date" name="event_date" class="form-input"
                            value="${profile.event_date || ''}">
                    </div>
                </div>

                <hr style="margin: var(--space-lg) 0; border: none; border-top: 1px solid var(--gray-200);">

                <h3 style="margin-bottom: var(--space-md);">Goals</h3>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="weekly_training_hours_goal">Weekly Training Hours Goal</label>
                        <input type="number" id="weekly_training_hours_goal" name="weekly_training_hours_goal"
                            class="form-input" value="${profile.weekly_training_hours_goal || ''}"
                            min="1" max="40" placeholder="e.g., 12">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="daily_calorie_goal">Daily Calorie Goal</label>
                        <input type="number" id="daily_calorie_goal" name="daily_calorie_goal"
                            class="form-input" value="${profile.daily_calorie_goal || ''}"
                            min="1000" max="8000" placeholder="e.g., 2500">
                    </div>
                </div>

                <button type="submit" class="btn btn-primary">Save Profile</button>
            </form>
        </div>

        <div class="card">
            <div class="card-header">
                <h2 class="card-title">Data Management</h2>
            </div>
            <p class="text-muted mb-md">Export your training and nutrition data.</p>
            <div class="flex gap-sm">
                <button id="export-workouts" class="btn btn-secondary">Export Workouts (CSV)</button>
                <button id="export-meals" class="btn btn-secondary">Export Nutrition (CSV)</button>
            </div>
        </div>

        <div class="card" style="border-color: var(--error);">
            <div class="card-header">
                <h2 class="card-title text-error">Danger Zone</h2>
            </div>
            <p class="text-muted mb-md">
                These actions cannot be undone.
            </p>
            <button id="delete-account" class="btn btn-danger">Delete Account</button>
        </div>
    `;
}

export async function init() {
    // Profile form submission
    document.getElementById('profile-form').addEventListener('submit', handleProfileSubmit);

    // Export buttons
    document.getElementById('export-workouts').addEventListener('click', exportWorkouts);
    document.getElementById('export-meals').addEventListener('click', exportMeals);

    // Delete account
    document.getElementById('delete-account').addEventListener('click', handleDeleteAccount);
}

async function handleProfileSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const data = getFormData(form);

    // Remove empty values
    Object.keys(data).forEach(key => {
        if (data[key] === null || data[key] === '') {
            delete data[key];
        }
    });

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        await authService.updateProfile(data);
    } catch (error) {
        console.error('Failed to update profile:', error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Profile';
    }
}

async function exportWorkouts() {
    showToast('Generating workout export...', 'info');

    try {
        const { actualWorkouts } = await import('../lib/supabase.js');
        const userId = authService.getUserId();
        const workouts = await actualWorkouts.list(userId);

        if (workouts.length === 0) {
            showToast('No workouts to export', 'warning');
            return;
        }

        const headers = [
            'Date', 'Discipline', 'Title', 'Duration (min)', 'Distance (mi)',
            'Avg HR', 'Max HR', 'Perceived Effort', 'Notes'
        ];

        const rows = workouts.map(w => [
            w.completed_at,
            w.discipline,
            w.title || '',
            w.duration_minutes || '',
            w.distance_km ? (w.distance_km * 0.621371).toFixed(1) : '',
            w.avg_heart_rate || '',
            w.max_heart_rate || '',
            w.perceived_effort || '',
            (w.notes || '').replace(/"/g, '""')
        ]);

        downloadCSV('workouts', headers, rows);
        showToast('Workouts exported!', 'success');
    } catch (error) {
        showToast('Export failed: ' + error.message, 'error');
    }
}

async function exportMeals() {
    showToast('Generating nutrition export...', 'info');

    try {
        const { meals } = await import('../lib/supabase.js');
        const userId = authService.getUserId();
        const mealList = await meals.list(userId);

        if (mealList.length === 0) {
            showToast('No meals to export', 'warning');
            return;
        }

        const headers = [
            'Date', 'Description', 'Calories', 'Protein (g)', 'Carbs (g)',
            'Fat (g)', 'Fiber (g)', 'Sugar (g)', 'Sodium (mg)'
        ];

        const rows = mealList.map(m => [
            m.logged_at,
            (m.description || '').replace(/"/g, '""'),
            m.calories || '',
            m.protein_g || '',
            m.carbs_g || '',
            m.fat_g || '',
            m.fiber_g || '',
            m.sugar_g || '',
            m.sodium_mg || ''
        ]);

        downloadCSV('nutrition', headers, rows);
        showToast('Nutrition data exported!', 'success');
    } catch (error) {
        showToast('Export failed: ' + error.message, 'error');
    }
}

function downloadCSV(filename, headers, rows) {
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

async function handleDeleteAccount() {
    const confirmed = confirm(
        'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.'
    );

    if (confirmed) {
        const doubleConfirm = confirm(
            'This is your final warning. Type DELETE to confirm account deletion.'
        );

        if (doubleConfirm) {
            showToast('Account deletion would happen here (not implemented for safety)', 'warning');
            // In production, you would:
            // 1. Call a Supabase Edge Function to delete all user data
            // 2. Delete the auth user
            // 3. Sign out and redirect to login
        }
    }
}
