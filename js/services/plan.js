// Training Plan Service - Groq Vision Parsing
import { trainingPlans, plannedWorkouts } from '../lib/supabase.js';
import { showToast } from '../utils.js';

const PARSE_PLAN_URL = '/api/parse-plan';

class PlanService {
    async uploadAndParsePhotos(userId, files, planName, raceDate, weeks, onProgress) {
        try {
            // 1. Calculate the exact start date from race date and weeks
            const startDate = this.calculateStartDate(raceDate, weeks);

            // 2. Convert all images to base64
            if (onProgress) onProgress('encoding');
            showToast('Preparing images...', 'info');
            const images = [];
            for (let i = 0; i < files.length; i++) {
                const base64 = await this.fileToBase64(files[i]);
                images.push({ data: base64, mimeType: files[i].type });
            }

            // 3. Send all images in a single API call with exact dates
            if (onProgress) onProgress('parsing');
            showToast('Reading training plan...', 'info');
            const result = await this.parseImages(images, startDate, raceDate, weeks);
            let allWorkouts = result.workouts || [];

            // 4. Sort workouts by date
            allWorkouts.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

            const parsedSchedule = {
                startDate,
                endDate: raceDate,
                workouts: allWorkouts
            };

            // 4. Create training plan record
            const plan = await trainingPlans.create({
                user_id: userId,
                name: planName,
                parsed_schedule: parsedSchedule,
                start_date: startDate,
                end_date: raceDate,
                is_active: true
            });

            // 4. Create planned workouts
            if (allWorkouts.length > 0) {
                const workoutsToCreate = allWorkouts.map(w => ({
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

    calculateStartDate(raceDate, weeks) {
        // Find the Monday of race week, then go back (weeks-1) more weeks
        const race = new Date(raceDate + 'T00:00:00');
        const raceDay = race.getDay(); // 0=Sun, 1=Mon...
        const daysFromMonday = raceDay === 0 ? 6 : raceDay - 1;
        const raceWeekMonday = new Date(race);
        raceWeekMonday.setDate(race.getDate() - daysFromMonday);
        const startMonday = new Date(raceWeekMonday);
        startMonday.setDate(raceWeekMonday.getDate() - ((weeks - 1) * 7));
        return startMonday.toISOString().split('T')[0];
    }

    async parseImages(images, startDate, raceDate, weeks) {
        try {
            const response = await fetch(PARSE_PLAN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images, startDate, raceDate, weeks })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Plan parsing failed');
            }

            const data = await response.json();
            return data.schedule;
        } catch (error) {
            console.error('Plan parsing error:', error);
            throw error;
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

    async importFromJson(userId, planName, raceDate, weeks, workoutsJson) {
        try {
            // Parse JSON if it's a string
            let parsed;
            if (typeof workoutsJson === 'string') {
                try {
                    parsed = JSON.parse(workoutsJson);
                } catch (e) {
                    throw new Error('Invalid JSON format. Please check the pasted text and try again.');
                }
            } else {
                parsed = workoutsJson;
            }

            // Accept either { workouts: [...] } or a raw array
            const workouts = Array.isArray(parsed) ? parsed : parsed?.workouts;
            if (!Array.isArray(workouts) || workouts.length === 0) {
                throw new Error('JSON must contain a "workouts" array with at least one workout.');
            }

            // Validate each workout has required fields
            const validDisciplines = ['swim', 'bike', 'run', 'strength', 'brick', 'rest'];
            const validIntensities = ['easy', 'moderate', 'hard', 'race', 'recovery'];
            for (let i = 0; i < workouts.length; i++) {
                const w = workouts[i];
                if (!w.date || !/^\d{4}-\d{2}-\d{2}$/.test(w.date)) {
                    throw new Error(`Workout ${i + 1}: missing or invalid "date" (expected YYYY-MM-DD).`);
                }
                if (!w.discipline || !validDisciplines.includes(w.discipline)) {
                    throw new Error(`Workout ${i + 1} (${w.date}): invalid "discipline". Must be one of: ${validDisciplines.join(', ')}.`);
                }
                if (w.intensity && !validIntensities.includes(w.intensity)) {
                    throw new Error(`Workout ${i + 1} (${w.date}): invalid "intensity". Must be one of: ${validIntensities.join(', ')}.`);
                }
            }

            // Calculate start date and sort workouts
            const startDate = this.calculateStartDate(raceDate, weeks);
            workouts.sort((a, b) => a.date.localeCompare(b.date));

            const parsedSchedule = {
                startDate,
                endDate: raceDate,
                workouts
            };

            // Create training plan record
            const plan = await trainingPlans.create({
                user_id: userId,
                name: planName,
                parsed_schedule: parsedSchedule,
                start_date: startDate,
                end_date: raceDate,
                is_active: true
            });

            // Create planned workouts
            const workoutsToCreate = workouts.map(w => ({
                user_id: userId,
                plan_id: plan.id,
                scheduled_date: w.date,
                discipline: w.discipline,
                title: w.title || null,
                description: w.description || null,
                target_duration_minutes: w.duration || null,
                target_distance_km: w.distance || null,
                target_intensity: w.intensity || null
            }));

            await plannedWorkouts.createMany(workoutsToCreate);

            showToast(`Imported ${workouts.length} workouts!`, 'success');
            return plan;
        } catch (error) {
            showToast('Import failed: ' + error.message, 'error');
            throw error;
        }
    }

    async deletePlan(planId) {
        try {
            await plannedWorkouts.deleteByPlan(planId);
            await trainingPlans.delete(planId);
            showToast('Plan deleted', 'success');
        } catch (error) {
            showToast('Failed to delete plan', 'error');
            throw error;
        }
    }
}

export const planService = new PlanService();
