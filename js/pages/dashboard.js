// Dashboard Page
import { authService } from '../services/auth.js';
import { workoutsService } from '../services/workouts.js';
import { nutritionService } from '../services/nutrition.js';
import { planService } from '../services/plan.js';
import { formatDate, getStartOfWeek, getEndOfWeek } from '../utils.js';

export async function render() {
    return `
        <h1 class="page-title">Dashboard</h1>

        <div id="dashboard-content">
            <div class="loading">
                <div class="spinner"></div>
            </div>
        </div>
    `;
}

export async function init() {
    const userId = authService.getUserId();
    const profile = authService.getProfile();

    const content = document.getElementById('dashboard-content');

    try {
        await loadDashboard(content, userId, profile);
    } catch (error) {
        // Retry once on AbortError (caused by Supabase auth token refresh)
        if (error.name === 'AbortError') {
            try {
                await loadDashboard(content, userId, profile);
                return;
            } catch (retryError) {
                // Fall through to error display
                error = retryError;
            }
        }
        content.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">&#9888;</div>
                <h3 class="empty-state-title">Failed to load dashboard</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

async function loadDashboard(content, userId, profile) {
    const startOfWeek = getStartOfWeek();
    const endOfWeek = getEndOfWeek();
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    // Fetch data in parallel
    const [weekWorkouts, todayMeals, plannedThisWeek] = await Promise.all([
        workoutsService.getActualWorkouts(userId, startOfWeek.toISOString(), endOfWeek.toISOString()),
        nutritionService.getMeals(userId, startOfDay, endOfDay),
        workoutsService.getPlannedWorkouts(userId, startOfWeek.toISOString(), endOfWeek.toISOString())
    ]);

    const weekStats = workoutsService.getWeeklyStats(weekWorkouts);
    const todayNutrition = nutritionService.getDailySummary(todayMeals);

    content.innerHTML = `
        ${renderEventCountdown(profile)}

        <div class="stats-grid mb-md">
            <div class="stat-card">
                <div class="stat-value">${weekStats.total.count}</div>
                <div class="stat-label">Workouts This Week</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${workoutsService.formatDuration(weekStats.total.duration)}</div>
                <div class="stat-label">Training Time</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${todayNutrition.calories}</div>
                <div class="stat-label">Calories Today</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${plannedThisWeek.length}</div>
                <div class="stat-label">Planned Workouts</div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h2 class="card-title">This Week's Training</h2>
            </div>
            ${renderDisciplineBreakdown(weekStats)}
        </div>

        <div class="card">
            <div class="card-header">
                <h2 class="card-title">Today's Nutrition</h2>
                <a href="#/nutrition" class="btn btn-secondary btn-sm">Log Meal</a>
            </div>
            ${renderNutritionProgress(todayNutrition, profile?.daily_calorie_goal)}
        </div>

        <div class="card">
            <div class="card-header">
                <h2 class="card-title">Recent Workouts</h2>
                <a href="#/workouts" class="btn btn-secondary btn-sm">Log Workout</a>
            </div>
            ${renderRecentWorkouts(weekWorkouts.slice(0, 5))}
        </div>
    `;
}

function renderEventCountdown(profile) {
    if (!profile?.event_date) {
        return `
            <div class="card" style="background: var(--primary-gradient); color: white;">
                <h3>Set up your race!</h3>
                <p>Add your event date in your profile to see a countdown.</p>
                <a href="#/profile" class="btn btn-secondary mt-md">Go to Profile</a>
            </div>
        `;
    }

    const eventDate = new Date(profile.event_date);
    const today = new Date();
    const daysLeft = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
        return `
            <div class="card" style="background: var(--primary-gradient); color: white;">
                <h3>Race Complete!</h3>
                <p>${profile.event_name || 'Your Ironman'} was on ${formatDate(eventDate)}</p>
            </div>
        `;
    }

    return `
        <div class="card" style="background: var(--primary-gradient); color: white;">
            <div class="flex-between">
                <div>
                    <h3 style="font-size: var(--text-2xl); margin-bottom: var(--space-xs);">${daysLeft} days</h3>
                    <p>until ${profile.event_name || 'race day'}</p>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: var(--text-lg);">${formatDate(eventDate, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>
        </div>
    `;
}

function renderDisciplineBreakdown(stats) {
    const disciplines = ['swim', 'bike', 'run', 'strength'];

    if (stats.total.count === 0) {
        return `
            <div class="empty-state">
                <p>No workouts logged this week. Time to train!</p>
                <a href="#/workouts" class="btn btn-primary mt-md">Log Workout</a>
            </div>
        `;
    }

    return `
        <div class="stats-grid">
            ${disciplines.map(d => `
                <div class="stat-card">
                    <span class="discipline-badge ${d}">${workoutsService.getDisciplineLabel(d)}</span>
                    <div class="stat-value mt-md">${stats[d].count}</div>
                    <div class="stat-label">
                        ${workoutsService.formatDuration(stats[d].duration)}
                        ${stats[d].distance > 0 ? `<br>${stats[d].distance.toFixed(1)} km` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderNutritionProgress(nutrition, calorieGoal) {
    const goal = calorieGoal || 2500;
    const percent = Math.min(100, Math.round((nutrition.calories / goal) * 100));

    return `
        <div style="margin-bottom: var(--space-md);">
            <div class="flex-between mb-md">
                <span>${nutrition.calories} / ${goal} kcal</span>
                <span>${percent}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percent}%"></div>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${Math.round(nutrition.protein_g)}g</div>
                <div class="stat-label">Protein</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Math.round(nutrition.carbs_g)}g</div>
                <div class="stat-label">Carbs</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Math.round(nutrition.fat_g)}g</div>
                <div class="stat-label">Fat</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Math.round(nutrition.fiber_g)}g</div>
                <div class="stat-label">Fiber</div>
            </div>
        </div>
    `;
}

function renderRecentWorkouts(workouts) {
    if (workouts.length === 0) {
        return `
            <div class="empty-state">
                <p>No recent workouts. Start training!</p>
            </div>
        `;
    }

    return `
        <div class="workout-list">
            ${workouts.map(w => `
                <div class="workout-item">
                    <span class="discipline-badge ${w.discipline}">${workoutsService.getDisciplineLabel(w.discipline)}</span>
                    <div class="workout-info">
                        <div class="workout-title">${w.title || workoutsService.getDisciplineLabel(w.discipline) + ' workout'}</div>
                        <div class="workout-meta">
                            <span>${formatDate(w.completed_at)}</span>
                            <span>${workoutsService.formatDuration(w.duration_minutes)}</span>
                            ${w.distance_km ? `<span>${workoutsService.formatDistance(w.distance_km, w.discipline)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}
