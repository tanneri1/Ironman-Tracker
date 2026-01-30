// Nutrition Service - CalorieNinjas Integration
import { meals } from '../lib/supabase.js';
import { showToast } from '../utils.js';

// CalorieNinjas API configuration
// Get your free API key at https://calorieninjas.com/api
const CALORIE_NINJAS_API_KEY = 'i7+vi+h9aXCHFY2Dbg8tUw==NbScNAtgBBWn7LFY';
const CALORIE_NINJAS_URL = 'https://api.calorieninjas.com/v1/nutrition';

class NutritionService {
    constructor() {
        this.cache = new Map();
    }

    async analyzeFood(description) {
        // Check cache first
        const cacheKey = description.toLowerCase().trim();
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(`${CALORIE_NINJAS_URL}?query=${encodeURIComponent(description)}`, {
                headers: {
                    'X-Api-Key': CALORIE_NINJAS_API_KEY
                }
            });

            if (!response.ok) {
                throw new Error('Failed to analyze food');
            }

            const data = await response.json();

            if (!data.items || data.items.length === 0) {
                return null;
            }

            // Aggregate nutrition from all items
            const nutrition = data.items.reduce((acc, item) => ({
                calories: (acc.calories || 0) + (item.calories || 0),
                protein_g: (acc.protein_g || 0) + (item.protein_g || 0),
                carbs_g: (acc.carbs_g || 0) + (item.carbohydrates_total_g || 0),
                fat_g: (acc.fat_g || 0) + (item.fat_total_g || 0),
                fiber_g: (acc.fiber_g || 0) + (item.fiber_g || 0),
                sugar_g: (acc.sugar_g || 0) + (item.sugar_g || 0),
                sodium_mg: (acc.sodium_mg || 0) + (item.sodium_mg || 0),
            }), {});

            // Round values (calories to whole number for INTEGER column)
            Object.keys(nutrition).forEach(key => {
                nutrition[key] = key === 'calories'
                    ? Math.round(nutrition[key])
                    : Math.round(nutrition[key] * 10) / 10;
            });

            // Cache the result
            this.cache.set(cacheKey, { nutrition, apiResponse: data });

            return { nutrition, apiResponse: data };
        } catch (error) {
            console.error('CalorieNinjas API error:', error);
            return null;
        }
    }

    async logMeal(userId, description) {
        try {
            // Analyze the food
            const analysis = await this.analyzeFood(description);

            const mealData = {
                user_id: userId,
                description: description,
                logged_at: new Date().toISOString()
            };

            if (analysis) {
                Object.assign(mealData, analysis.nutrition);
                mealData.api_response = analysis.apiResponse;
            }

            const meal = await meals.create(mealData);
            showToast('Meal logged!', 'success');
            return meal;
        } catch (error) {
            showToast('Failed to log meal: ' + error.message, 'error');
            throw error;
        }
    }

    async getMeals(userId, startDate, endDate) {
        try {
            return await meals.list(userId, startDate, endDate);
        } catch (error) {
            showToast('Failed to load meals: ' + error.message, 'error');
            throw error;
        }
    }

    async deleteMeal(mealId) {
        try {
            await meals.delete(mealId);
            showToast('Meal deleted', 'success');
        } catch (error) {
            showToast('Failed to delete meal: ' + error.message, 'error');
            throw error;
        }
    }

    getDailySummary(mealsArray) {
        return mealsArray.reduce((acc, meal) => ({
            calories: acc.calories + (meal.calories || 0),
            protein_g: acc.protein_g + (meal.protein_g || 0),
            carbs_g: acc.carbs_g + (meal.carbs_g || 0),
            fat_g: acc.fat_g + (meal.fat_g || 0),
            fiber_g: acc.fiber_g + (meal.fiber_g || 0),
        }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 });
    }

    formatNutrition(meal) {
        if (!meal.calories) {
            return 'Nutrition data unavailable';
        }
        return `${meal.calories} cal | P: ${meal.protein_g}g | C: ${meal.carbs_g}g | F: ${meal.fat_g}g`;
    }
}

export const nutritionService = new NutritionService();
