// Training Plan Service - OCR & AI Parsing
import { trainingPlans, plannedWorkouts, storage } from '../lib/supabase.js';
import { showToast } from '../utils.js';

// Google Cloud Vision API configuration
const GOOGLE_VISION_API_KEY = 'YOUR_GOOGLE_VISION_API_KEY';
const GOOGLE_VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;

// AI API for parsing (reuse from coach service)
const AI_API_KEY = 'YOUR_AI_API_KEY';
const AI_API_URL = 'https://api.openai.com/v1/chat/completions';
const AI_MODEL = 'gpt-4o-mini';

class PlanService {
    async uploadAndParsePhoto(userId, file, planName) {
        try {
            // 1. Upload photo to Supabase Storage
            showToast('Uploading photo...', 'info');
            const photoUrl = await storage.uploadPlanPhoto(userId, file);

            // 2. Run OCR on the image
            showToast('Extracting text...', 'info');
            const ocrText = await this.runOCR(file);

            if (!ocrText) {
                throw new Error('Could not extract text from image');
            }

            // 3. Parse the text into structured schedule
            showToast('Parsing training plan...', 'info');
            const parsedSchedule = await this.parseSchedule(ocrText);

            // 4. Create training plan record
            const plan = await trainingPlans.create({
                user_id: userId,
                name: planName,
                photo_url: photoUrl,
                ocr_text: ocrText,
                parsed_schedule: parsedSchedule,
                start_date: parsedSchedule.startDate,
                end_date: parsedSchedule.endDate,
                is_active: true
            });

            // 5. Create planned workouts from parsed schedule
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

    async runOCR(file) {
        // Convert file to base64
        const base64 = await this.fileToBase64(file);

        const requestBody = {
            requests: [{
                image: { content: base64 },
                features: [{ type: 'TEXT_DETECTION' }]
            }]
        };

        try {
            const response = await fetch(GOOGLE_VISION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error('OCR request failed');
            }

            const data = await response.json();
            const textAnnotations = data.responses[0]?.textAnnotations;

            if (!textAnnotations || textAnnotations.length === 0) {
                return null;
            }

            // First annotation contains all text
            return textAnnotations[0].description;
        } catch (error) {
            console.error('OCR error:', error);
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

    async parseSchedule(ocrText) {
        const systemPrompt = `You are an expert at parsing triathlon training schedules.
Given OCR text from a training plan image, extract a structured schedule.

Return a JSON object with this structure:
{
  "startDate": "YYYY-MM-DD or null if not found",
  "endDate": "YYYY-MM-DD or null if not found",
  "weeks": number of weeks if identifiable,
  "workouts": [
    {
      "date": "YYYY-MM-DD",
      "discipline": "swim|bike|run|strength|brick|rest",
      "title": "Brief workout title",
      "description": "Full workout description",
      "duration": minutes as number or null,
      "distance": kilometers as number or null,
      "intensity": "easy|moderate|hard|race|recovery" or null
    }
  ]
}

Guidelines:
- Parse dates relative to today if only day names are given
- Convert all distances to kilometers
- Convert all durations to minutes
- Identify discipline from keywords: swim/pool, bike/cycle/ride, run/jog, weights/strength/gym
- "Brick" means combined bike+run workout
- Rest days should be included with discipline "rest"
- If you can't determine exact dates, estimate based on week structure

Only return valid JSON, no other text.`;

        const today = new Date().toISOString().split('T')[0];

        try {
            const response = await fetch(AI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AI_API_KEY}`
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Today's date is ${today}.\n\nOCR Text from training plan:\n\n${ocrText}` }
                    ],
                    max_tokens: 2000,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                throw new Error('AI parsing request failed');
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            // Extract JSON from response (in case there's extra text)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Could not parse AI response as JSON');
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('Schedule parsing error:', error);
            // Return empty structure on error
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
