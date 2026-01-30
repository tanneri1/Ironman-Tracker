// Supabase Client Configuration
// Replace these with your actual Supabase project credentials

const SUPABASE_URL = 'https://ffdbrcutxysxntrfbmya.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZGJyY3V0eHlzeG50cmZibXlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjA1MDgsImV4cCI6MjA4NTIzNjUwOH0._cjPIJFFMAFvmg1oY6UvbtkFNkFlg1x3WX8KsWMvP6w';

// Import Supabase client from CDN
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Create and export the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth helper functions
export const auth = {
    async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        return data;
    },

    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    async getSession() {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        return session;
    },

    async getUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        return user;
    },

    onAuthStateChange(callback) {
        return supabase.auth.onAuthStateChange(callback);
    }
};

// Profile helper functions
export const profiles = {
    async get(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async update(userId, updates) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        if (error) throw error;
        return data;
    }
};

// Meals helper functions
export const meals = {
    async list(userId, startDate, endDate) {
        let query = supabase
            .from('meals')
            .select('*')
            .eq('user_id', userId)
            .order('logged_at', { ascending: false });

        if (startDate) {
            query = query.gte('logged_at', startDate);
        }
        if (endDate) {
            query = query.lte('logged_at', endDate);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async create(meal) {
        const { data, error } = await supabase
            .from('meals')
            .insert(meal)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabase
            .from('meals')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};

// Training plans helper functions
export const trainingPlans = {
    async list(userId) {
        const { data, error } = await supabase
            .from('training_plans')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async getActive(userId) {
        const { data, error } = await supabase
            .from('training_plans')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async create(plan) {
        const { data, error } = await supabase
            .from('training_plans')
            .insert(plan)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async update(id, updates) {
        const { data, error } = await supabase
            .from('training_plans')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabase
            .from('training_plans')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};

// Planned workouts helper functions
export const plannedWorkouts = {
    async list(userId, startDate, endDate) {
        let query = supabase
            .from('planned_workouts')
            .select('*')
            .eq('user_id', userId)
            .order('scheduled_date', { ascending: true });

        if (startDate) {
            query = query.gte('scheduled_date', startDate);
        }
        if (endDate) {
            query = query.lte('scheduled_date', endDate);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async create(workout) {
        const { data, error } = await supabase
            .from('planned_workouts')
            .insert(workout)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async createMany(workouts) {
        const { data, error } = await supabase
            .from('planned_workouts')
            .insert(workouts)
            .select();
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabase
            .from('planned_workouts')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async deleteByPlan(planId) {
        const { error } = await supabase
            .from('planned_workouts')
            .delete()
            .eq('plan_id', planId);
        if (error) throw error;
    }
};

// Actual workouts helper functions
export const actualWorkouts = {
    async list(userId, startDate, endDate) {
        let query = supabase
            .from('actual_workouts')
            .select('*')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false });

        if (startDate) {
            query = query.gte('completed_at', startDate);
        }
        if (endDate) {
            query = query.lte('completed_at', endDate);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async create(workout) {
        const { data, error } = await supabase
            .from('actual_workouts')
            .insert(workout)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async update(id, updates) {
        const { data, error } = await supabase
            .from('actual_workouts')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabase
            .from('actual_workouts')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};

// Coaching sessions helper functions
export const coachingSessions = {
    async getOrCreate(userId) {
        // Try to get the most recent session
        const { data: existing, error: fetchError } = await supabase
            .from('coaching_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        if (existing) {
            return existing;
        }

        // Create a new session
        const { data, error } = await supabase
            .from('coaching_sessions')
            .insert({ user_id: userId, messages: [] })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async addMessage(sessionId, message) {
        // Get current messages
        const { data: session, error: fetchError } = await supabase
            .from('coaching_sessions')
            .select('messages')
            .eq('id', sessionId)
            .single();
        if (fetchError) throw fetchError;

        const messages = [...(session.messages || []), message];

        const { data, error } = await supabase
            .from('coaching_sessions')
            .update({ messages })
            .eq('id', sessionId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async clearMessages(sessionId) {
        const { data, error } = await supabase
            .from('coaching_sessions')
            .update({ messages: [] })
            .eq('id', sessionId)
            .select()
            .single();
        if (error) throw error;
        return data;
    }
};

// Storage helper for training plan photos
export const storage = {
    async uploadPlanPhoto(userId, file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from('training-plans')
            .upload(fileName, file);
        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('training-plans')
            .getPublicUrl(fileName);

        return publicUrl;
    }
};
