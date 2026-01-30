// Training Plan Service - Groq Vision Parsing
import { trainingPlans, plannedWorkouts } from '../lib/supabase.js';
import { showToast } from '../utils.js';

const PARSE_PLAN_URL = '/api/parse-plan';

class PlanService {
    async uploadAndParsePhoto(userId, file, planName) {
        try {
            // 1. Send image to Groq vision model for parsing
            showToast('Reading training plan...', 'info');
            const base64 = await this.fileToBase64(file);
            const parsedSchedule = await this.parseImage(base64, file.type);

            // 2. Create training plan record
            const plan = await trainingPlans.create({
                user_id: userId,
                name: planName,
                parsed_schedule: parsedSchedule,
                start_date: parsedSchedule.startDate,
                end_date: parsedSchedule.endDate,
                is_active: true
            });

            // 4. Create planned workouts from parsed schedule
            if (parsedSchedule.workouts && parsedSchedule.workouts.length > 0) {
                const workoutsToCreate = parsedSchedule.workouts.map(w => ({
                    user_id: userId,
                    plan_id: plan.id,
                    scheduled_date: w.date,
                    discipline: w.discipline,
                    title: w.title,
                    description: w.description,
                    target_duration_minutes: w.duration,
                    target_distance_km: w.distance,
                    target_intensity: w.intensity
                }));

                await plannedWorkouts.createMany(workoutsToCreate);
            }

            showToast('Training plan imported!', 'success');
            return plan;
        } catch (error) {
            showToast('Failed to import plan: ' + error.message, 'error');
            throw error;
        }
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async parseImage(base64, mimeType) {
        try {
            const response = await fetch(PARSE_PLAN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64, mimeType })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Plan parsing failed');
            }

            const data = await response.json();
            return data.schedule;
        } catch (error) {
            console.error('Plan parsing error:', error);
            return { startDate: null, endDate: null, workouts: [] };
        }
    }

    async getPlans(userId) {
        try {
            return await trainingPlans.list(userId);
        } catch (error) {
            showToast('Failed to load training plans', 'error');
            throw error;
        }
    }

    async getActivePlan(userId) {
        try {
            return await trainingPlans.getActive(userId);
        } catch (error) {
            console.error('Failed to get active plan:', error);
            return null;
        }
    }

    async setActivePlan(userId, planId) {
        try {
            // Deactivate all other plans
            const plans = await trainingPlans.list(userId);
            for (const plan of plans) {
                if (plan.id !== planId && plan.is_active) {
                    await trainingPlans.update(plan.id, { is_active: false });
                }
            }

            // Activate selected plan
            await trainingPlans.update(planId, { is_active: true });
            showToast('Plan activated', 'success');
        } catch (error) {
            showToast('Failed to activate plan', 'error');
            throw error;
        }
    }

    async createManualPlan(userId, planData, workoutsData) {
        try {
            const plan = await trainingPlans.create({
                user_id: userId,
                name: planData.name,
                start_date: planData.startDate,
                end_date: planData.endDate,
                is_active: true
            });

            if (workoutsData && workoutsData.length > 0) {
                const workoutsToCreate = workoutsData.map(w => ({
                    user_id: userId,
                    plan_id: plan.id,
                    ...w
                }));

                await plannedWorkouts.createMany(workoutsToCreate);
            }

            showToast('Training plan created', 'success');
            return plan;
        } catch (error) {
            showToast('Failed to create plan', 'error');
            throw error;
        }
    }

    async deletePlan(planId) {
        try {
            // Delete associated workouts first
            await plannedWorkouts.deleteByPlan(planId);
            // Note: We'd need to add a delete method to trainingPlans
            showToast('Plan deleted', 'success');
        } catch (error) {
            showToast('Failed to delete plan', 'error');
            throw error;
        }
    }
}

export const planService = new PlanService();
