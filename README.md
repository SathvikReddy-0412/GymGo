# GymGo – Full-Stack Fitness & Travel Gym Web Application

**GymGo** is a high-performance, dark-themed fitness web application with Orbitron & Inter typography, glassmorphism aesthetics, ambient radial glows, and animated SVG components. Built with an Express REST API backend, persistent JSON database, and a responsive Single Page Application frontend.

---

## 📁 Sorted Project Structure

The project has been organized into clean, dedicated modules:

```
Gymgo/
├── frontend/                     # All Client-Side UI & Assets
│   ├── css/
│   │   └── style.css             # Glassmorphism, design tokens, micro-animations
│   ├── js/
│   │   ├── api.js                # Frontend REST API client
│   │   ├── sound.js              # Web Audio API synthesizers (ticks, chimes, likes)
│   │   └── app.js                # Main Single Page App controller & views
│   └── index.html                # App entrypoint (Logo intro, scenes, modals)
│
├── backend/                      # Server Logic & Persistence
│   ├── data/
│   │   └── gymgo_db.json         # Local persistent JSON database
│   ├── db.js                     # Database manager & seed data
│   └── server.js                 # Express 5 server & REST API endpoints
│
├── api_keys/                     # API Keys & Service Credentials
│   ├── api_keys.json             # Active API keys (Payment, AI Coach, Maps, Secrets)
│   ├── api_keys.example.json     # Template file for environment setup
│   └── keys.js                   # Configuration module with environment fallbacks
│
├── .env.example                  # Environment variables template
├── .gitignore                    # Git ignore file
├── package.json                  # Node.js dependencies and run scripts
└── README.md                     # Project documentation
```

---

## 🔑 API Keys & Configuration (`api_keys/`)

Service keys and credentials are saved in [`api_keys/api_keys.json`](api_keys/api_keys.json) and loaded by [`api_keys/keys.js`](api_keys/keys.js).

You can configure:
- **Payment Gateway**: Razorpay Key ID, Secret, and UPI Merchant VPA (`upiMerchantVpa`)
- **AI Coach**: Google Gemini API key or LLM endpoints
- **Maps**: Google Maps Platform API key & default city
- **Security**: QR code generation hash salt & JWT secrets

---

## 🚀 Key Application Features

1. **Logo Intro & Interactive Login**:
   - Morphing dumbbell SVG animation with rotating weight plates.
   - Quick one-click demo login buttons for **Athlete Mode** and **Gym Owner Mode**.
2. **Athlete Home Dashboard**:
   - Live streak counter, match affinity percentage, and quick action cards.
   - Fixed bottom glassmorphic navigation bar.
3. **Travel Gym Pass Booking**:
   - Search across 8 major Indian cities (*Vijayawada, Hyderabad, Guntur, Bengaluru, Chennai, Mumbai, Visakhapatnam, Delhi*) with typo tolerance and area filtering.
   - Pass selection (*1 Day, 1 Week, 1 Month, 3 Months*) with instant discount calculation.
   - Owner review flow, slot scheduling, simulated UPI / Card checkout, and dynamic QR pass generation.
4. **Gym Owner Portal**:
   - Review incoming pass requests in real-time.
   - Accept or decline bookings, toggle open daily slots, and view revenue.
5. **AI Biometric Coach**:
   - Biometric inputs: Age, Sex, Height, Weight, Goal, Training Approach, Medical conditions, and Diet preference.
   - Calculates BMI, BMR, TDEE, Calorie targets, and Macronutrients (Protein, Carbs, Fat).
   - Radial animated BMI gauge, hydration tracker with interactive glasses, personalized 7-day routine, Indian diet recipes, and health safety warnings.
6. **Workout Sessions & Rest Timer**:
   - 3 difficulty splits: Beginner, Moderate, Advanced.
   - 7-day training schedule with 33+ exercises across all major muscle groups.
   - Set-by-set tracker with interactive chip checks and audio-visual Rest Timer (30s, 60s, 90s, 120s with chime feedback).
   - Exercise technique cues, physiological advantages, swap variation picker, and custom exercise creation with photo attachments.
   - Personal workout log with timestamps.
7. **Gym Passport**:
   - Collectible digital passport book for fitness travel.
   - City check-in stamps with official gold seals.
   - Unlockable milestone badges (*First Sweat, City Hopper, Iron Nomad, Streak Crusher*).
8. **GymGram Community Feed**:
   - Social feed for PR alerts, check-ins, and fitness achievements.
   - Heart like animations with sound effects, comment threads, and a post creator.
9. **My Passes QR Wallet**:
   - Active pass viewer with simulated front-desk verification scanner.
10. **Profile & Account Switcher**:
    - Athlete statistics, personal records (*Bench, Squat, Deadlift*), and instant role switcher.

---

## 🏃 Running the Application

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
# Or for development:
npm run dev
```

### 3. Open in Browser
Visit **[http://localhost:3000](http://localhost:3000)** in any modern web browser.
