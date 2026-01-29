// Nutrition Page
import { authService } from '../services/auth.js';
import { nutritionService } from '../services/nutrition.js';
import { formatDate, formatTime, getStartOfDay, getEndOfDay, showModal, escapeHtml } from '../utils.js';

let currentDate = new Date();

export async function render() {
    return `
        <h1 class="page-title">Nutrition</h1>

        <div class="card">
            <div class="card-header">
                <h2 class="card-title">Log a Meal</h2>
            </div>
            <form id="meal-form">
                <div class="form-group">
                    <label class="form-label" for="meal-description">What did you eat?</label>
                    <textarea
                        id="meal-description"
                        class="form-textarea"
                        placeholder="e.g., 2 eggs, toast with butter, and a glass of orange juice"
                        required
                    ></textarea>
                    <p class="text-muted" style="font-size: var(--text-sm); margin-top: var(--space-xs);">
                        Describe your meal naturally - AI will estimate the nutrition
                    </p>
                </div>
                <button type="submit" class="btn btn-primary">
                    Log Meal
                </button>
            </form>
        </div>

        <div class="card">
            <div class="card-header">
                <h2 class="card-title">Today's Summary</h2>
                <div class="flex gap-sm">
                    <button id="prev-day" class="btn btn-secondary btn-sm">&larr;</button>
                    <span id="current-date">${formatDate(currentDate)}</span>
                    <button id="next-day" class="btn btn-secondary btn-sm">&rarr;</button>
                </div>
            </div>
            <div id="nutrition-summary">
                <div class="loading"><div class="spinner"></div></div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h2 class="card-title">Meals</h2>
            </div>
            <div id="meals-list">
                <div class="loading"><div class="spinner"></div></div>
            </div>
        </div>
    `;
}

export async function init() {
    // Set up form submission
    document.getElementById('meal-form').addEventListener('submit', handleMealSubmit);

    // Set up date navigation
    document.getElementById('prev-day').addEventListener('click', () => navigateDay(-1));
    document.getElementById('next-day').addEventListener('click', () => navigateDay(1));

    // Load initial data
    await loadMeals();
}

async function handleMealSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const description = document.getElementById('meal-description').value.trim();

    if (!description) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Analyzing...';

    try {
        const userId = authService.getUserId();
        await nutritionService.logMeal(userId, description);

        // Clear form
        form.reset();

        // Reload meals
        await loadMeals();
    } catch (error) {
        console.error('Failed to log meal:', error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log Meal';
    }
}

function navigateDay(delta) {
    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + delta);
    document.getElementById('current-date').textContent = formatDate(currentDate);
    loadMeals();
}

async function loadMeals() {
    const userId = authService.getUserId();
    const profile = authService.getProfile();

    const startOfDay = getStartOfDay(currentDate).toISOString();
    const endOfDay = getEndOfDay(currentDate).toISOString();

    const summaryContainer = document.getElementById('nutrition-summary');
    const listContainer = document.getElementById('meals-list');

    try {
        const meals = await nutritionService.getMeals(userId, startOfDay, endOfDay);
        const summary = nutritionService.getDailySummary(meals);

        // Render summary
        const calorieGoal = profile?.daily_calorie_goal || 2500;
        const percent = Math.min(100, Math.round((summary.calories / calorieGoal) * 100));

        summaryContainer.innerHTML = `
            <div style="margin-bottom: var(--space-md);">
                <div class="flex-between mb-md">
                    <span><strong>${summary.calories}</strong> / ${calorieGoal} kcal</span>
                    <span>${percent}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percent}%"></div>
                </div>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${Math.round(summary.protein_g)}g</div>
                    <div class="stat-label">Protein</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Math.round(summary.carbs_g)}g</div>
                    <div class="stat-label">Carbs</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Math.round(summary.fat_g)}g</div>
                    <div class="stat-label">Fat</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Math.round(summary.fiber_g)}g</div>
                    <div class="stat-label">Fiber</div>
                </div>
            </div>
        `;

        // Render meals list
        if (meals.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#127869;</div>
                    <h3 class="empty-state-title">No meals logged</h3>
                    <p>Log your first meal of the day above!</p>
                </div>
            `;
        } else {
            listContainer.innerHTML = meals.map(meal => `
                <div class="meal-item" data-id="${meal.id}">
                    <div>
                        <div class="meal-description">${escapeHtml(meal.description)}</div>
                        <div class="meal-time">${formatTime(meal.logged_at)}</div>
                    </div>
                    <div class="meal-nutrition">
                        ${meal.calories ? `
                            <div class="meal-calories">${meal.calories} cal</div>
                            <div class="meal-macros">
                                P: ${meal.protein_g}g | C: ${meal.carbs_g}g | F: ${meal.fat_g}g
                            </div>
                        ` : `
                            <div class="meal-macros text-muted">No nutrition data</div>
                        `}
                        <button class="btn btn-danger btn-sm mt-md delete-meal" data-id="${meal.id}">Delete</button>
                    </div>
                </div>
            `).join('');

            // Add delete handlers
            listContainer.querySelectorAll('.delete-meal').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const mealId = e.target.dataset.id;
                    const confirmed = await showModal(
                        'Delete Meal',
                        'Are you sure you want to delete this meal?',
                        [
                            { id: 'cancel', label: 'Cancel' },
                            { id: 'delete', label: 'Delete', class: 'btn-danger' }
                        ]
                    );

                    if (confirmed === 'delete') {
                        await nutritionService.deleteMeal(mealId);
                        await loadMeals();
                    }
                });
            });
        }
    } catch (error) {
        summaryContainer.innerHTML = `<p class="text-error">Failed to load data</p>`;
        listContainer.innerHTML = `<p class="text-error">Failed to load meals</p>`;
    }
}

export function cleanup() {
    // Reset date when leaving page
    currentDate = new Date();
}
