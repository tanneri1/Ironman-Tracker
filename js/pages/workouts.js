// Workouts Page
import { authService } from '../services/auth.js';
import { workoutsService } from '../services/workouts.js';
import { formatDate, formatTime, getStartOfWeek, getEndOfWeek, addDays, showModal, getFormData, escapeHtml } from '../utils.js';

let currentWeekStart = getStartOfWeek();

export async function render() {
    return `
        <h1 class="page-title">Workouts</h1>

        <div class="card">
            <div class="card-header">
                <h2 class="card-title">Log Workout</h2>
            </div>
            <form id="workout-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="discipline">Discipline</label>
                        <select id="discipline" name="discipline" class="form-select" required>
                            <option value="swim">Swim</option>
                            <option value="bike">Bike</option>
                            <option value="run">Run</option>
                            <option value="strength">Strength</option>
                            <option value="brick">Brick</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="title">Title (optional)</label>
                        <input type="text" id="title" name="title" class="form-input" placeholder="e.g., Easy recovery run">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="duration_minutes">Duration (minutes)</label>
                        <input type="number" id="duration_minutes" name="duration_minutes" class="form-input" min="1" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="distance_km">Distance (km)</label>
                        <input type="number" id="distance_km" name="distance_km" class="form-input" step="0.1" min="0">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="avg_heart_rate">Avg Heart Rate</label>
                        <input type="number" id="avg_heart_rate" name="avg_heart_rate" class="form-input" min="40" max="220">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="perceived_effort">Perceived Effort (1-10)</label>
                        <input type="number" id="perceived_effort" name="perceived_effort" class="form-input" min="1" max="10">
                    </div>
                </div>

                <!-- Discipline-specific fields -->
                <div id="swim-fields" class="form-row hidden">
                    <div class="form-group">
                        <label class="form-label" for="pool_length_m">Pool Length (m)</label>
                        <input type="number" id="pool_length_m" name="pool_length_m" class="form-input" placeholder="25 or 50">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="stroke_count">Stroke Count</label>
                        <input type="number" id="stroke_count" name="stroke_count" class="form-input">
                    </div>
                </div>

                <div id="bike-fields" class="form-row hidden">
                    <div class="form-group">
                        <label class="form-label" for="avg_power_watts">Avg Power (watts)</label>
                        <input type="number" id="avg_power_watts" name="avg_power_watts" class="form-input">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="bike_elevation_gain_m">Elevation Gain (m)</label>
                        <input type="number" id="bike_elevation_gain_m" name="bike_elevation_gain_m" class="form-input">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="avg_cadence_rpm">Avg Cadence (rpm)</label>
                        <input type="number" id="avg_cadence_rpm" name="avg_cadence_rpm" class="form-input">
                    </div>
                </div>

                <div id="run-fields" class="form-row hidden">
                    <div class="form-group">
                        <label class="form-label" for="run_elevation_gain_m">Elevation Gain (m)</label>
                        <input type="number" id="run_elevation_gain_m" name="run_elevation_gain_m" class="form-input">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="avg_cadence_spm">Avg Cadence (spm)</label>
                        <input type="number" id="avg_cadence_spm" name="avg_cadence_spm" class="form-input">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="notes">Notes</label>
                    <textarea id="notes" name="notes" class="form-textarea" placeholder="How did you feel? Any observations?"></textarea>
                </div>

                <button type="submit" class="btn btn-primary">Log Workout</button>
            </form>
        </div>

        <div class="card">
            <div class="card-header">
                <h2 class="card-title">This Week</h2>
                <div class="flex gap-sm">
                    <button id="prev-week" class="btn btn-secondary btn-sm">&larr;</button>
                    <span id="week-range"></span>
                    <button id="next-week" class="btn btn-secondary btn-sm">&rarr;</button>
                </div>
            </div>
            <div id="week-stats" class="stats-grid mb-md"></div>
        </div>

        <div class="card">
            <div class="card-header">
                <h2 class="card-title">Workouts</h2>
            </div>
            <div id="workouts-list">
                <div class="loading"><div class="spinner"></div></div>
            </div>
        </div>
    `;
}

export async function init() {
    // Toggle discipline-specific fields
    document.getElementById('discipline').addEventListener('change', updateDisciplineFields);
    updateDisciplineFields();

    // Form submission
    document.getElementById('workout-form').addEventListener('submit', handleWorkoutSubmit);

    // Week navigation
    document.getElementById('prev-week').addEventListener('click', () => navigateWeek(-1));
    document.getElementById('next-week').addEventListener('click', () => navigateWeek(1));

    // Load initial data
    await loadWorkouts();
}

function updateDisciplineFields() {
    const discipline = document.getElementById('discipline').value;

    document.getElementById('swim-fields').classList.toggle('hidden', discipline !== 'swim');
    document.getElementById('bike-fields').classList.toggle('hidden', discipline !== 'bike');
    document.getElementById('run-fields').classList.toggle('hidden', discipline !== 'run');
}

async function handleWorkoutSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const data = getFormData(form);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        const userId = authService.getUserId();
        await workoutsService.logWorkout(userId, data);

        // Clear form
        form.reset();
        updateDisciplineFields();

        // Reload workouts
        await loadWorkouts();
    } catch (error) {
        console.error('Failed to log workout:', error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log Workout';
    }
}

function navigateWeek(delta) {
    currentWeekStart = addDays(currentWeekStart, delta * 7);
    loadWorkouts();
}

async function loadWorkouts() {
    const userId = authService.getUserId();
    const weekEnd = getEndOfWeek(currentWeekStart);

    // Update week range display
    document.getElementById('week-range').textContent =
        `${formatDate(currentWeekStart, { month: 'short', day: 'numeric' })} - ${formatDate(weekEnd, { month: 'short', day: 'numeric' })}`;

    const listContainer = document.getElementById('workouts-list');
    const statsContainer = document.getElementById('week-stats');

    try {
        const [actualWorkouts, plannedWorkouts] = await Promise.all([
            workoutsService.getActualWorkouts(userId, currentWeekStart.toISOString(), weekEnd.toISOString()),
            workoutsService.getPlannedWorkouts(userId, currentWeekStart.toISOString(), weekEnd.toISOString())
        ]);

        const stats = workoutsService.getWeeklyStats(actualWorkouts);

        // Render stats
        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${stats.total.count}</div>
                <div class="stat-label">Total Workouts</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${workoutsService.formatDuration(stats.total.duration)}</div>
                <div class="stat-label">Total Time</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.swim.distance.toFixed(1)} km</div>
                <div class="stat-label">Swim Distance</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.bike.distance.toFixed(1)} km</div>
                <div class="stat-label">Bike Distance</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.run.distance.toFixed(1)} km</div>
                <div class="stat-label">Run Distance</div>
            </div>
        `;

        // Render workout list
        if (actualWorkouts.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#127939;</div>
                    <h3 class="empty-state-title">No workouts this week</h3>
                    <p>Log your first workout above!</p>
                </div>
            `;
        } else {
            listContainer.innerHTML = actualWorkouts.map(workout => `
                <div class="workout-item" data-id="${workout.id}">
                    <span class="discipline-badge ${workout.discipline}">${workoutsService.getDisciplineLabel(workout.discipline)}</span>
                    <div class="workout-info">
                        <div class="workout-title">${escapeHtml(workout.title) || workoutsService.getDisciplineLabel(workout.discipline)}</div>
                        <div class="workout-meta">
                            <span>${formatDate(workout.completed_at)} ${formatTime(workout.completed_at)}</span>
                            <span>${workoutsService.formatDuration(workout.duration_minutes)}</span>
                            ${workout.distance_km ? `<span>${workoutsService.formatDistance(workout.distance_km, workout.discipline)}</span>` : ''}
                            ${workout.distance_km && workout.duration_minutes ? `<span>${workoutsService.formatPace(workout.duration_minutes, workout.distance_km, workout.discipline)}</span>` : ''}
                            ${workout.avg_heart_rate ? `<span>${workout.avg_heart_rate} bpm</span>` : ''}
                            ${workout.perceived_effort ? `<span>RPE ${workout.perceived_effort}/10</span>` : ''}
                        </div>
                        ${workout.notes ? `<div class="text-muted" style="font-size: var(--text-sm); margin-top: var(--space-xs);">${escapeHtml(workout.notes)}</div>` : ''}
                    </div>
                    <button class="btn btn-danger btn-sm delete-workout" data-id="${workout.id}">Delete</button>
                </div>
            `).join('');

            // Add delete handlers
            listContainer.querySelectorAll('.delete-workout').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const workoutId = e.target.dataset.id;
                    const confirmed = await showModal(
                        'Delete Workout',
                        'Are you sure you want to delete this workout?',
                        [
                            { id: 'cancel', label: 'Cancel' },
                            { id: 'delete', label: 'Delete', class: 'btn-danger' }
                        ]
                    );

                    if (confirmed === 'delete') {
                        await workoutsService.deleteWorkout(workoutId);
                        await loadWorkouts();
                    }
                });
            });
        }
    } catch (error) {
        listContainer.innerHTML = `<p class="text-error">Failed to load workouts: ${error.message}</p>`;
    }
}

export function cleanup() {
    currentWeekStart = getStartOfWeek();
}
