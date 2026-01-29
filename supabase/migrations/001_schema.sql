-- Ironman Triathlon Tracker Database Schema
-- Run this migration in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    weight_kg DECIMAL(5,2),
    height_cm DECIMAL(5,2),
    event_name TEXT,
    event_date DATE,
    weekly_training_hours_goal INTEGER,
    daily_calorie_goal INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meals table for nutrition tracking
CREATE TABLE meals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    description TEXT NOT NULL,
    -- AI-analyzed nutrition data
    calories INTEGER,
    protein_g DECIMAL(6,2),
    carbs_g DECIMAL(6,2),
    fat_g DECIMAL(6,2),
    fiber_g DECIMAL(6,2),
    sugar_g DECIMAL(6,2),
    sodium_mg DECIMAL(8,2),
    -- Raw API response for debugging
    api_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training plans (uploaded photos)
CREATE TABLE training_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    photo_url TEXT,
    ocr_text TEXT,
    parsed_schedule JSONB,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Planned workouts (extracted from training plan)
CREATE TABLE planned_workouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    plan_id UUID REFERENCES training_plans(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    discipline TEXT NOT NULL CHECK (discipline IN ('swim', 'bike', 'run', 'strength', 'brick', 'rest')),
    title TEXT,
    description TEXT,
    target_duration_minutes INTEGER,
    target_distance_km DECIMAL(8,2),
    target_intensity TEXT, -- easy, moderate, hard, race pace, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Actual workouts (user-logged)
CREATE TABLE actual_workouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    planned_workout_id UUID REFERENCES planned_workouts(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    discipline TEXT NOT NULL CHECK (discipline IN ('swim', 'bike', 'run', 'strength', 'brick')),
    title TEXT,
    notes TEXT,
    -- Core metrics
    duration_minutes INTEGER,
    distance_km DECIMAL(8,2),
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    perceived_effort INTEGER CHECK (perceived_effort BETWEEN 1 AND 10),
    -- Swim-specific
    pool_length_m INTEGER,
    stroke_count INTEGER,
    -- Bike-specific
    avg_power_watts INTEGER,
    bike_elevation_gain_m INTEGER,
    avg_cadence_rpm INTEGER,
    -- Run-specific
    run_elevation_gain_m INTEGER,
    avg_cadence_spm INTEGER,
    -- Metadata
    weather TEXT,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coaching sessions (AI conversation history)
CREATE TABLE coaching_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]',
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_meals_user_date ON meals(user_id, logged_at DESC);
CREATE INDEX idx_planned_workouts_user_date ON planned_workouts(user_id, scheduled_date);
CREATE INDEX idx_actual_workouts_user_date ON actual_workouts(user_id, completed_at DESC);
CREATE INDEX idx_coaching_sessions_user ON coaching_sessions(user_id, updated_at DESC);

-- Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE actual_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_sessions ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can manage own meals" ON meals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own training_plans" ON training_plans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own planned_workouts" ON planned_workouts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own actual_workouts" ON actual_workouts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own coaching_sessions" ON coaching_sessions FOR ALL USING (auth.uid() = user_id);

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-creating profile
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_plans_updated_at BEFORE UPDATE ON training_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coaching_sessions_updated_at BEFORE UPDATE ON coaching_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
