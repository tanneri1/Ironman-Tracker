# Ironman Triathlon Tracker - Setup Guide

## Quick Start

1. **Set up Supabase**
   - Create a project at [supabase.com](https://supabase.com)
   - Run the SQL migration in `supabase/migrations/001_schema.sql` via the SQL Editor
   - Get your project URL and anon key from Settings > API

2. **Configure API Keys**
   Edit `js/lib/supabase.js`:
   ```javascript
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   ```

   Edit `js/services/nutrition.js`:
   ```javascript
   const CALORIE_NINJAS_API_KEY = 'your-api-key'; // Get from calorieninjas.com
   ```

   Edit `js/services/coach.js` and `js/services/plan.js`:
   ```javascript
   const AI_API_KEY = 'your-openai-or-anthropic-key';
   const AI_API_URL = 'https://api.openai.com/v1/chat/completions';
   const AI_MODEL = 'gpt-4o-mini';
   ```

   For OCR (plan photo parsing), edit `js/services/plan.js`:
   ```javascript
   const GOOGLE_VISION_API_KEY = 'your-google-cloud-key';
   ```

3. **Enable Supabase Storage**
   - Go to Storage in Supabase dashboard
   - Create a bucket called `training-plans`
   - Set it to public or configure appropriate policies

4. **Run Locally**
   ```bash
   cd triathlon-tracker
   npx serve .
   # or
   python -m http.server 8000
   ```
   Open http://localhost:8000

## API Key Sources

| Service | URL | Free Tier |
|---------|-----|-----------|
| Supabase | https://supabase.com | 500MB DB, 1GB storage |
| CalorieNinjas | https://calorieninjas.com/api | 10k requests/month |
| Google Cloud Vision | https://cloud.google.com/vision | $300 free credits |
| OpenAI | https://platform.openai.com | Pay-as-you-go |
| Anthropic | https://console.anthropic.com | Pay-as-you-go |

## Features

### Phase 1 (MVP) - Implemented
- User authentication (email/password)
- Profile setup (weight, height, event date, goals)
- Basic meal logging with AI nutrition analysis
- Workout logging (swim/bike/run/strength/brick)
- Dashboard with weekly stats

### Phase 2 (AI Integration) - Implemented
- CalorieNinjas API for nutrition estimation
- Training plan photo upload with OCR
- AI parsing of schedules into structured workouts
- Week calendar showing planned vs actual workouts

### Phase 3 (Smart Features) - Implemented
- AI coach chat with personalized context
- Weekly/daily nutrition summaries
- Training volume tracking by discipline
- Race countdown

### Phase 4 (Polish) - Partial
- [x] Data export (CSV)
- [ ] PWA service worker (manifest included)
- [ ] Enhanced error handling

## Project Structure

```
triathlon-tracker/
├── index.html              # App shell
├── manifest.json           # PWA manifest
├── css/
│   ├── variables.css       # Design tokens
│   └── styles.css          # All styles
├── js/
│   ├── app.js              # Main entry point
│   ├── router.js           # Client-side routing
│   ├── utils.js            # Utility functions
│   ├── lib/
│   │   └── supabase.js     # Database client
│   ├── services/
│   │   ├── auth.js         # Authentication
│   │   ├── nutrition.js    # CalorieNinjas integration
│   │   ├── workouts.js     # Workout CRUD
│   │   ├── plan.js         # Training plan OCR/parsing
│   │   └── coach.js        # AI coach
│   └── pages/
│       ├── dashboard.js    # Overview
│       ├── nutrition.js    # Meal logging
│       ├── workouts.js     # Workout logging
│       ├── plan.js         # Training plan
│       ├── coach.js        # AI chat
│       └── profile.js      # Settings
└── supabase/
    └── migrations/
        └── 001_schema.sql  # Database schema
```

## Database Tables

- **profiles** - User settings and goals
- **meals** - Food logs with nutrition data
- **training_plans** - Uploaded plans with OCR text
- **planned_workouts** - Scheduled workouts from plans
- **actual_workouts** - Logged workouts with metrics
- **coaching_sessions** - AI chat history

## Customization

### Theming
Edit `css/variables.css` to change colors:
```css
--primary-start: #667eea;
--primary-end: #764ba2;
```

### AI Model
Change the model in coach.js/plan.js:
```javascript
// OpenAI
const AI_API_URL = 'https://api.openai.com/v1/chat/completions';
const AI_MODEL = 'gpt-4o-mini'; // or 'gpt-4o'

// Anthropic
const AI_API_URL = 'https://api.anthropic.com/v1/messages';
const AI_MODEL = 'claude-3-haiku-20240307';
```

Note: Anthropic requires different request/response format.
