// AI Coach Service
import { coachingSessions, actualWorkouts, meals, profiles } from '../lib/supabase.js';
import { showToast } from '../utils.js';

// AI Coach API endpoint (Vercel serverless function)
const COACH_API_URL = '/api/coach';

class CoachService {
    constructor() {
        this.session = null;
    }

    async getOrCreateSession(userId) {
        try {
            this.session = await coachingSessions.getOrCreate(userId);
            return this.session;
        } catch (error) {
            console.error('Failed to get/create coaching session:', error);
            throw error;
        }
    }

    async getRecentContext(userId) {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const startDate = weekAgo.toISOString();

        try {
            const [recentWorkouts, recentMeals, profile] = await Promise.all([
                actualWorkouts.list(userId, startDate),
                meals.list(userId, startDate),
                profiles.get(userId)
            ]);

            return { recentWorkouts, recentMeals, profile };
        } catch (error) {
            console.error('Failed to fetch context:', error);
            return { recentWorkouts: [], recentMeals: [], profile: null };
        }
    }

    buildSystemPrompt(context) {
        const { recentWorkouts, recentMeals, profile } = context;

        let systemPrompt = `You are an expert Ironman triathlon coach and sports nutritionist.
You help athletes prepare for their Ironman events with personalized training and nutrition advice.
Be encouraging but realistic. Provide specific, actionable advice based on the athlete's data.

`;

        if (profile) {
            systemPrompt += `ATHLETE PROFILE:
- Name: ${profile.full_name || 'Unknown'}
- Weight: ${profile.weight_kg ? `${profile.weight_kg} kg` : 'Not set'}
- Height: ${profile.height_cm ? `${profile.height_cm} cm` : 'Not set'}
- Event: ${profile.event_name || 'Ironman event'}
- Event Date: ${profile.event_date || 'Not set'}
- Weekly Training Goal: ${profile.weekly_training_hours_goal ? `${profile.weekly_training_hours_goal} hours` : 'Not set'}
- Daily Calorie Goal: ${profile.daily_calorie_goal ? `${profile.daily_calorie_goal} cal` : 'Not set'}

`;
        }

        if (recentWorkouts.length > 0) {
            const workoutSummary = this.summarizeWorkouts(recentWorkouts);
            systemPrompt += `LAST 7 DAYS TRAINING:
${workoutSummary}

`;
        } else {
            systemPrompt += `LAST 7 DAYS TRAINING: No workouts logged yet.

`;
        }

        if (recentMeals.length > 0) {
            const nutritionSummary = this.summarizeNutrition(recentMeals);
            systemPrompt += `LAST 7 DAYS NUTRITION:
${nutritionSummary}

`;
        } else {
            systemPrompt += `LAST 7 DAYS NUTRITION: No meals logged yet.

`;
        }

        systemPrompt += `Keep responses concise and focused. Use the athlete's data to give personalized feedback.
If they ask about their progress, reference their actual logged data.
If data is missing, encourage them to log more consistently for better insights.`;

        return systemPrompt;
    }

    summarizeWorkouts(workouts) {
        const byDiscipline = {};
        workouts.forEach(w => {
            const d = w.discipline || 'other';
            if (!byDiscipline[d]) {
                byDiscipline[d] = { count: 0, duration: 0, distance: 0 };
            }
            byDiscipline[d].count++;
            byDiscipline[d].duration += w.duration_minutes || 0;
            byDiscipline[d].distance += parseFloat(w.distance_km) || 0;
        });

        let summary = '';
        for (const [discipline, stats] of Object.entries(byDiscipline)) {
            summary += `- ${discipline}: ${stats.count} sessions, ${stats.duration} min total`;
            if (stats.distance > 0) {
                summary += `, ${stats.distance.toFixed(1)} km`;
            }
            summary += '\n';
        }

        const totalDuration = workouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0);
        summary += `- Total: ${workouts.length} workouts, ${Math.round(totalDuration / 60 * 10) / 10} hours`;

        return summary;
    }

    summarizeNutrition(mealsArr) {
        const dailyTotals = {};
        mealsArr.forEach(m => {
            const date = new Date(m.logged_at).toISOString().split('T')[0];
            if (!dailyTotals[date]) {
                dailyTotals[date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
            }
            dailyTotals[date].calories += m.calories || 0;
            dailyTotals[date].protein += m.protein_g || 0;
            dailyTotals[date].carbs += m.carbs_g || 0;
            dailyTotals[date].fat += m.fat_g || 0;
        });

        const days = Object.keys(dailyTotals).length;
        const totals = Object.values(dailyTotals).reduce((acc, day) => ({
            calories: acc.calories + day.calories,
            protein: acc.protein + day.protein,
            carbs: acc.carbs + day.carbs,
            fat: acc.fat + day.fat
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

        if (days === 0) return 'No nutrition data available.';

        const avg = {
            calories: Math.round(totals.calories / days),
            protein: Math.round(totals.protein / days),
            carbs: Math.round(totals.carbs / days),
            fat: Math.round(totals.fat / days)
        };

        return `Average daily intake (${days} days tracked):
- Calories: ${avg.calories} kcal
- Protein: ${avg.protein}g
- Carbs: ${avg.carbs}g
- Fat: ${avg.fat}g`;
    }

    async sendMessage(userId, userMessage) {
        if (!this.session) {
            await this.getOrCreateSession(userId);
        }

        try {
            // Get context for personalization
            const context = await this.getRecentContext(userId);
            const systemPrompt = this.buildSystemPrompt(context);

            // Get existing messages
            const messages = this.session.messages || [];

            // Build conversation for API
            const apiMessages = [
                { role: 'system', content: systemPrompt },
                ...messages.slice(-10), // Last 10 messages for context
                { role: 'user', content: userMessage }
            ];

            // Call coach API (Vercel serverless function)
            const response = await fetch(COACH_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ messages: apiMessages })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Coach API request failed');
            }

            const data = await response.json();
            const assistantMessage = data.content;

            // Save messages to session
            await coachingSessions.addMessage(this.session.id, { role: 'user', content: userMessage });
            this.session = await coachingSessions.addMessage(this.session.id, { role: 'assistant', content: assistantMessage });

            return assistantMessage;
        } catch (error) {
            console.error('Coach API error:', error);
            showToast('Failed to get coach response', 'error');
            throw error;
        }
    }

    async clearChat(userId) {
        if (!this.session) {
            await this.getOrCreateSession(userId);
        }

        try {
            this.session = await coachingSessions.clearMessages(this.session.id);
            showToast('Chat cleared', 'success');
        } catch (error) {
            showToast('Failed to clear chat', 'error');
            throw error;
        }
    }

    getMessages() {
        return this.session?.messages || [];
    }
}

export const coachService = new CoachService();
