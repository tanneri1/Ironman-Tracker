// Workouts Service
import { actualWorkouts, plannedWorkouts } from '../lib/supabase.js';
import { showToast } from '../utils.js';

class WorkoutsService {
    async getPlannedWorkouts(userId, startDate, endDate) {
        try {
            return await plannedWorkouts.list(userId, startDate, endDate);
        } catch (error) {
            showToast('Failed to load planned workouts: ' + error.message, 'error');
            throw error;
        }
    }

    async getActualWorkouts(userId, startDate, endDate) {
        try {
            return await actualWorkouts.list(userId, startDate, endDate);
        } catch (error) {
            showToast('Failed to load workouts: ' + error.message, 'error');
            throw error;
        }
    }

    async logWorkout(userId, workoutData) {
        try {
            const workout = await actualWorkouts.create({
                user_id: userId,
                completed_at: new Date().toISOString(),
                ...workoutData
            });
            showToast('Workout logged!', 'success');
            return workout;
        } catch (error) {
            showToast('Failed to log workout: ' + error.message, 'error');
            throw error;
        }
    }

    async updateWorkout(workoutId, updates) {
        try {
            const workout = await actualWorkouts.update(workoutId, updates);
            showToast('Workout updated', 'success');
            return workout;
        } catch (error) {
            showToast('Failed to update workout: ' + error.message, 'error');
            throw error;
        }
    }

    async deleteWorkout(workoutId) {
        try {
            await actualWorkouts.delete(workoutId);
            showToast('Workout deleted', 'success');
        } catch (error) {
            showToast('Failed to delete workout: ' + error.message, 'error');
            throw error;
        }
    }

    async createPlannedWorkout(userId, workoutData) {
        try {
            return await plannedWorkouts.create({
                user_id: userId,
                ...workoutData
            });
        } catch (error) {
            showToast('Failed to create planned workout: ' + error.message, 'error');
            throw error;
        }
    }

    async createPlannedWorkouts(workoutsArray) {
        try {
            return await plannedWorkouts.createMany(workoutsArray);
        } catch (error) {
            showToast('Failed to create planned workouts: ' + error.message, 'error');
            throw error;
        }
    }

    async deletePlannedWorkout(workoutId) {
        try {
            await plannedWorkouts.delete(workoutId);
            showToast('Planned workout deleted', 'success');
        } catch (error) {
            showToast('Failed to delete planned workout: ' + error.message, 'error');
            throw error;
        }
    }

    getWeeklyStats(workouts) {
        const stats = {
            swim: { count: 0, duration: 0, distance: 0 },
            bike: { count: 0, duration: 0, distance: 0 },
            run: { count: 0, duration: 0, distance: 0 },
            strength: { count: 0, duration: 0 },
            brick: { count: 0, duration: 0, distance: 0 },
            total: { count: 0, duration: 0 }
        };

        workouts.forEach(w => {
            const discipline = w.discipline || 'other';
            if (stats[discipline]) {
                stats[discipline].count++;
                stats[discipline].duration += w.duration_minutes || 0;
                if (w.distance_km) {
                    stats[discipline].distance += parseFloat(w.distance_km) || 0;
                }
            }
            stats.total.count++;
            stats.total.duration += w.duration_minutes || 0;
        });

        return stats;
    }

    formatDuration(minutes) {
        if (!minutes) return '-';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    }

    kmToMiles(km) {
        return km * 0.621371;
    }

    formatDistance(km, discipline) {
        if (!km) return '-';
        if (discipline === 'swim') {
            return `${Math.round(km * 1000)}m`;
        }
        return `${this.kmToMiles(km).toFixed(1)} mi`;
    }

    formatPace(minutes, km, discipline) {
        if (!minutes || !km) return '-';
        if (discipline === 'swim') {
            // Pace per 100m
            const pace = minutes / (km * 10);
            const mins = Math.floor(pace);
            const secs = Math.round((pace - mins) * 60);
            return `${mins}:${secs.toString().padStart(2, '0')}/100m`;
        } else if (discipline === 'bike') {
            // mph
            const miles = this.kmToMiles(km);
            const speed = (miles / minutes) * 60;
            return `${speed.toFixed(1)} mph`;
        } else {
            // min/mi
            const miles = this.kmToMiles(km);
            const pace = minutes / miles;
            const mins = Math.floor(pace);
            const secs = Math.round((pace - mins) * 60);
            return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
        }
    }

    getDisciplineIcon(discipline) {
        const icons = {
            swim: '&#127946;', // swimmer
            bike: '&#128690;', // bike
            run: '&#127939;', // runner
            strength: '&#128170;', // flexed bicep
            brick: '&#127939;&#128690;',
            rest: '&#128164;' // zzz
        };
        return icons[discipline] || '&#127939;';
    }

    getDisciplineLabel(discipline) {
        const labels = {
            swim: 'Swim',
            bike: 'Bike',
            run: 'Run',
            strength: 'Strength',
            brick: 'Brick',
            rest: 'Rest'
        };
        return labels[discipline] || discipline;
    }
}

export const workoutsService = new WorkoutsService();
