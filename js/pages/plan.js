// Training Plan Page
import { authService } from '../services/auth.js';
import { planService } from '../services/plan.js';
import { workoutsService } from '../services/workouts.js';
import { formatDate, addDays, getStartOfWeek, isSameDay, showModal, escapeHtml } from '../utils.js';

let currentWeekStart = getStartOfWeek();

export async function render() {
    return `
        <h1 class="page-title">Training Plan</h1>

        <div class="tabs">
            <button class="tab active" data-tab="calendar">Calendar</button>
            <button class="tab" data-tab="upload">Upload Plan</button>
            <button class="tab" data-tab="manual">Add Workout</button>
        </div>

        <div id="tab-calendar" class="tab-content">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Week View</h2>
                    <div class="flex gap-sm">
                        <button id="prev-week" class="btn btn-secondary btn-sm">&larr;</button>
                        <span id="week-range"></span>
                        <button id="next-week" class="btn btn-secondary btn-sm">&rarr;</button>
                    </div>
                </div>
                <div id="calendar-view">
                    <div class="loading"><div class="spinner"></div></div>
                </div>
            </div>
        </div>

        <div id="tab-upload" class="tab-content hidden">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Upload Training Plan Photos</h2>
                </div>
                <p class="text-muted mb-md">
                    Upload one or more photos of your training schedule and AI will extract the workouts.
                    Dates are calculated from your race day and plan length so training ends on race day.
                </p>
                <form id="upload-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="plan-name">Plan Name</label>
                            <input type="text" id="plan-name" class="form-input" placeholder="e.g., 16-Week Ironman Plan" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="plan-race-date">Race/Event Date</label>
                            <input type="date" id="plan-race-date" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="plan-weeks">Plan Length (weeks)</label>
                            <input type="number" id="plan-weeks" class="form-input" min="1" max="52" placeholder="e.g., 20" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="file-upload" for="plan-photo">
                            <div class="file-upload-icon">&#128247;</div>
                            <div class="file-upload-text">Click to select photos (you can pick multiple)</div>
                            <input type="file" id="plan-photo" accept="image/*" multiple required>
                        </label>
                        <div id="photo-preview" class="hidden mt-md"></div>
                    </div>
                    <button type="submit" class="btn btn-primary">Upload & Parse</button>
                </form>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Your Plans</h2>
                </div>
                <div id="plans-list">
                    <div class="loading"><div class="spinner"></div></div>
                </div>
            </div>
        </div>

        <div id="tab-manual" class="tab-content hidden">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Add Planned Workout</h2>
                </div>
                <form id="manual-workout-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="workout-date">Date</label>
                            <input type="date" id="workout-date" name="scheduled_date" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="workout-discipline">Discipline</label>
                            <select id="workout-discipline" name="discipline" class="form-select" required>
                                <option value="swim">Swim</option>
                                <option value="bike">Bike</option>
                                <option value="run">Run</option>
                                <option value="strength">Strength</option>
                                <option value="brick">Brick</option>
                                <option value="rest">Rest</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="workout-title">Title</label>
                        <input type="text" id="workout-title" name="title" class="form-input" placeholder="e.g., Long Run">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="workout-duration">Target Duration (min)</label>
                            <input type="number" id="workout-duration" name="target_duration_minutes" class="form-input" min="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="workout-distance">Target Distance (mi)</label>
                            <input type="number" id="workout-distance" name="target_distance_km" class="form-input" step="0.1" min="0">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="workout-intensity">Intensity</label>
                        <select id="workout-intensity" name="target_intensity" class="form-select">
                            <option value="">Select...</option>
                            <option value="recovery">Recovery</option>
                            <option value="easy">Easy</option>
                            <option value="moderate">Moderate</option>
                            <option value="hard">Hard</option>
                            <option value="race">Race Pace</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="workout-description">Description</label>
                        <textarea id="workout-description" name="description" class="form-textarea" placeholder="Workout details..."></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">Add to Plan</button>
                </form>
            </div>
        </div>
    `;
}

export async function init() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Week navigation
    document.getElementById('prev-week').addEventListener('click', () => navigateWeek(-1));
    document.getElementById('next-week').addEventListener('click', () => navigateWeek(1));

    // Photo preview
    document.getElementById('plan-photo').addEventListener('change', handlePhotoChange);

    // Form submissions
    document.getElementById('upload-form').addEventListener('submit', handlePhotoUpload);
    document.getElementById('manual-workout-form').addEventListener('submit', handleManualWorkout);

    // Set default date to today
    document.getElementById('workout-date').value = new Date().toISOString().split('T')[0];

    // Load calendar
    await loadCalendar();
    await loadPlans();
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
}

function navigateWeek(delta) {
    currentWeekStart = addDays(currentWeekStart, delta * 7);
    loadCalendar();
}

function handlePhotoChange(e) {
    const files = e.target.files;
    const preview = document.getElementById('photo-preview');

    if (files.length > 0) {
        preview.innerHTML = '';
        preview.classList.remove('hidden');
        Array.from(files).forEach((file, i) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = document.createElement('img');
                img.src = ev.target.result;
                img.style.cssText = 'max-width: 100%; max-height: 200px; border-radius: var(--radius-md); margin-bottom: var(--space-sm);';
                img.alt = `Plan image ${i + 1}`;
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    } else {
        preview.classList.add('hidden');
    }
}

async function handlePhotoUpload(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const planName = document.getElementById('plan-name').value;
    const raceDate = document.getElementById('plan-race-date').value;
    const weeks = parseInt(document.getElementById('plan-weeks').value, 10);
    const files = Array.from(document.getElementById('plan-photo').files);

    if (files.length === 0) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    try {
        const userId = authService.getUserId();
        const plan = await planService.uploadAndParsePhotos(userId, files, planName, raceDate, weeks, (stage) => {
            if (stage === 'encoding') submitBtn.textContent = 'Preparing images...';
            else if (stage === 'parsing') submitBtn.textContent = 'Reading plan...';
        });

        // Show results
        if (plan.parsed_schedule?.workouts?.length > 0) {
            await showModal(
                'Plan Imported',
                `<p>Successfully extracted ${plan.parsed_schedule.workouts.length} workouts from ${files.length} image${files.length > 1 ? 's' : ''}!</p>
                 <p>Check the calendar to see your scheduled workouts.</p>`,
                [{ id: 'ok', label: 'View Calendar', class: 'btn-primary' }]
            );
            switchTab('calendar');
        } else {
            await showModal(
                'Partial Import',
                `<p>The plan was saved but we couldn't automatically extract workouts.</p>
                 <p>You can add workouts manually from the "Add Workout" tab.</p>`,
                [{ id: 'ok', label: 'OK' }]
            );
        }

        form.reset();
        document.getElementById('photo-preview').classList.add('hidden');
        await loadPlans();
        await loadCalendar();
    } catch (error) {
        console.error('Upload failed:', error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Upload & Parse';
    }
}

async function handleManualWorkout(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
        const userId = authService.getUserId();
        const formData = new FormData(form);
        const data = {};

        for (const [key, value] of formData.entries()) {
            if (value !== '') {
                data[key] = value;
            }
        }

        // Convert miles to km for storage
        if (data.target_distance_km) {
            data.target_distance_km = (parseFloat(data.target_distance_km) / 0.621371).toFixed(2);
        }

        await workoutsService.createPlannedWorkout(userId, data);

        form.reset();
        document.getElementById('workout-date').value = new Date().toISOString().split('T')[0];

        await loadCalendar();
        switchTab('calendar');
    } catch (error) {
        console.error('Failed to add workout:', error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add to Plan';
    }
}

async function loadCalendar() {
    const userId = authService.getUserId();
    const weekEnd = addDays(currentWeekStart, 6);

    document.getElementById('week-range').textContent =
        `${formatDate(currentWeekStart, { month: 'short', day: 'numeric' })} - ${formatDate(weekEnd, { month: 'short', day: 'numeric' })}`;

    const container = document.getElementById('calendar-view');

    try {
        const [plannedWorkouts, actualWorkouts] = await Promise.all([
            workoutsService.getPlannedWorkouts(userId, currentWeekStart.toISOString(), weekEnd.toISOString()),
            workoutsService.getActualWorkouts(userId, currentWeekStart.toISOString(), weekEnd.toISOString())
        ]);

        // Build week calendar
        const days = [];
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const today = new Date();

        for (let i = 0; i < 7; i++) {
            const date = addDays(currentWeekStart, i);
            const dateStr = date.toISOString().split('T')[0];

            const planned = plannedWorkouts.filter(w =>
                w.scheduled_date === dateStr
            );
            const actual = actualWorkouts.filter(w =>
                isSameDay(w.completed_at, date)
            );

            days.push({
                date,
                dayName: dayNames[i],
                isToday: isSameDay(date, today),
                planned,
                actual
            });
        }

        container.innerHTML = `
            <div class="calendar">
                ${days.map(day => `
                    <div class="calendar-header">${day.dayName}</div>
                `).join('')}
                ${days.map(day => `
                    <div class="calendar-day ${day.isToday ? 'today' : ''}">
                        <div class="calendar-date">${day.date.getDate()}</div>
                        ${day.planned.map(w => `
                            <div class="calendar-workout planned" title="${escapeHtml(w.description || w.title || '')}">
                                <span class="discipline-badge ${w.discipline}" style="font-size: 10px; padding: 1px 4px;">
                                    ${workoutsService.getDisciplineLabel(w.discipline)}
                                </span>
                                ${w.title ? `<span style="margin-left: 2px;">${escapeHtml(w.title)}</span>` : ''}
                            </div>
                        `).join('')}
                        ${day.actual.map(w => `
                            <div class="calendar-workout completed">
                                ${workoutsService.getDisciplineLabel(w.discipline)}
                                ${w.duration_minutes ? ` - ${workoutsService.formatDuration(w.duration_minutes)}` : ''}
                            </div>
                        `).join('')}
                        ${day.planned.length === 0 && day.actual.length === 0 ? '<div class="text-muted" style="font-size: 10px;">-</div>' : ''}
                    </div>
                `).join('')}
            </div>
            <div class="flex gap-md mt-md" style="font-size: var(--text-sm);">
                <div><span style="display: inline-block; width: 12px; height: 12px; background: var(--gray-200); border-radius: 2px;"></span> Planned</div>
                <div><span style="display: inline-block; width: 12px; height: 12px; background: var(--success); border-radius: 2px;"></span> Completed</div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = `<p class="text-error">Failed to load calendar: ${error.message}</p>`;
    }
}

async function loadPlans() {
    const userId = authService.getUserId();
    const container = document.getElementById('plans-list');

    try {
        const plans = await planService.getPlans(userId);

        if (plans.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No training plans yet. Upload a plan photo above!</p>
                </div>
            `;
        } else {
            container.innerHTML = plans.map(plan => `
                <div class="workout-item" data-id="${plan.id}">
                    <div class="workout-info">
                        <div class="workout-title">
                            ${escapeHtml(plan.name)}
                            ${plan.is_active ? '<span class="discipline-badge" style="background: var(--success); font-size: 10px;">Active</span>' : ''}
                        </div>
                        <div class="workout-meta">
                            <span>Created ${formatDate(plan.created_at)}</span>
                            ${plan.start_date ? `<span>Starts ${formatDate(plan.start_date)}</span>` : ''}
                            ${plan.parsed_schedule?.workouts?.length ? `<span>${plan.parsed_schedule.workouts.length} workouts</span>` : ''}
                        </div>
                    </div>
                    <div class="flex gap-sm">
                        ${!plan.is_active ? `
                            <button class="btn btn-secondary btn-sm activate-plan" data-id="${plan.id}">Activate</button>
                        ` : ''}
                        <button class="btn btn-secondary btn-sm delete-plan" data-id="${plan.id}" data-name="${escapeHtml(plan.name)}" style="color: var(--error);">Delete</button>
                    </div>
                </div>
            `).join('');

            // Add activate handlers
            container.querySelectorAll('.activate-plan').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const planId = e.target.dataset.id;
                    await planService.setActivePlan(userId, planId);
                    await loadPlans();
                });
            });

            // Add delete handlers
            container.querySelectorAll('.delete-plan').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const planId = e.target.dataset.id;
                    const planName = e.target.dataset.name;
                    const result = await showModal(
                        'Delete Plan',
                        `<p>Are you sure you want to delete <strong>${planName}</strong>?</p>
                         <p>This will also remove all planned workouts associated with this plan.</p>`,
                        [
                            { id: 'cancel', label: 'Cancel', class: 'btn-secondary' },
                            { id: 'delete', label: 'Delete', class: 'btn-primary btn-danger' }
                        ]
                    );
                    if (result === 'delete') {
                        await planService.deletePlan(planId);
                        await loadPlans();
                        await loadCalendar();
                    }
                });
            });
        }
    } catch (error) {
        container.innerHTML = `<p class="text-error">Failed to load plans</p>`;
    }
}

export function cleanup() {
    currentWeekStart = getStartOfWeek();
}
