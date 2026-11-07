const fs = require('fs');
const path = require('path');

function getSafeDbFilePath() {
  const preferredDir = path.join(__dirname, 'data');
  try {
    if (!fs.existsSync(preferredDir)) {
      fs.mkdirSync(preferredDir, { recursive: true });
    }
    const testFile = path.join(preferredDir, '.write_test');
    fs.writeFileSync(testFile, 'ok', 'utf8');
    fs.unlinkSync(testFile);
    return path.join(preferredDir, 'gymgo_db.json');
  } catch (err) {
    const tmpDir = require('os').tmpdir();
    console.warn(`[GymGo DB] Standard data directory is not writable (${err.message}). Using system temp directory: ${tmpDir}`);
    return path.join(tmpDir, 'gymgo_db.json');
  }
}

let mongoose = null;
try {
  mongoose = require('mongoose');
} catch (e) {}

let GymGoDocModel = null;
if (mongoose) {
  const storeSchema = new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    data: mongoose.Schema.Types.Mixed,
    updatedAt: { type: Date, default: Date.now }
  });
  GymGoDocModel = mongoose.models.GymGoStore || mongoose.model('GymGoStore', storeSchema);
}

// Initial default seed state
const initialData = {
  users: [
    {
      id: 'usr_1',
      username: 'athlete',
      name: 'Alex Turner',
      email: 'alex@gymgo.fit',
      password: '123456',
      role: 'athlete',
      streak: 47,
      matchPct: 96,
      avatar: 'A',
      homeCity: 'Vijayawada',
      prs: {
        bench: '105 kg',
        squat: '145 kg',
        deadlift: '185 kg'
      },
      createdAt: '2026-01-10T10:00:00.000Z'
    },
    {
      id: 'usr_owner',
      username: 'owner',
      name: 'Vikram Rao (Starts Gym)',
      email: 'owner@startsgym.com',
      password: '123456',
      role: 'owner',
      gymName: 'Starts Gym',
      city: 'Vijayawada',
      area: 'Tadepalli',
      avatar: 'V',
      createdAt: '2026-01-01T10:00:00.000Z'
    },
    {
      id: 'usr_admin',
      username: 'admin',
      name: 'Master Admin',
      email: 'admin@gymgo.fit',
      password: '123456',
      role: 'admin',
      avatar: 'M',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  ],
  cities: {
    'Vijayawada': ['Tadepalli', 'Benz Circle', 'Labbipet', 'Governorpet', 'Patamata', 'Auto Nagar', 'Gunadala'],
    'Guntur': ['Brodipet', 'Arundelpet', 'Lakshmipuram', 'Pattabhipuram'],
    'Visakhapatnam': ['MVP Colony', 'Dwaraka Nagar', 'Gajuwaka', 'Madhurawada'],
    'Hyderabad': ['Madhapur', 'Gachibowli', 'Kondapur', 'Jubilee Hills', 'Banjara Hills'],
    'Bengaluru': ['Koramangala', 'Indiranagar', 'HSR Layout', 'Whitefield'],
    'Chennai': ['T Nagar', 'Adyar', 'Velachery', 'Anna Nagar'],
    'Mumbai': ['Andheri', 'Bandra', 'Powai', 'Thane'],
    'Delhi': ['Saket', 'Dwarka', 'Rohini', 'Connaught Place']
  },
  gyms: [
    {
      id: 'gym_1',
      name: 'Starts Gym',
      city: 'Vijayawada',
      area: 'Tadepalli',
      rating: 4.8,
      reviews: 248,
      distance: 0.6,
      dayPrice: 150,
      tags: ['Free weights', 'Squat rack', 'AC', 'Trainers', 'Crossfit zone'],
      address: 'Near NH16 Bypass, Tadepalli, Vijayawada',
      openHours: '5:00 AM - 10:30 PM',
      slots: ['5–7 AM', '7–9 AM', '9–11 AM', '5–7 PM', '7–9 PM', '9–11 PM']
    },
    {
      id: 'gym_2',
      name: 'Derive Fitness',
      city: 'Vijayawada',
      area: 'Tadepalli',
      rating: 5.0,
      reviews: 312,
      distance: 1.2,
      dayPrice: 150,
      tags: ['AC', 'Cardio', 'Showers', 'Lockers', 'Steam room'],
      address: 'Main Road, Tadepalli, Vijayawada',
      openHours: '5:30 AM - 10:00 PM',
      slots: ['5–7 AM', '7–9 AM', '5–7 PM', '7–9 PM']
    },
    {
      id: 'gym_3',
      name: 'Multifit',
      city: 'Vijayawada',
      area: 'Tadepalli',
      rating: 5.0,
      reviews: 190,
      distance: 1.8,
      dayPrice: 150,
      tags: ['Calisthenics', 'Crossfit', 'Functional training', 'AC'],
      address: 'Opp. Police Station, Tadepalli',
      openHours: '6:00 AM - 10:00 PM',
      slots: ['6–8 AM', '8–10 AM', '5–7 PM', '7–9 PM']
    },
    {
      id: 'gym_4',
      name: 'Iron Nation',
      city: 'Vijayawada',
      area: 'Benz Circle',
      rating: 4.7,
      reviews: 420,
      distance: 2.1,
      dayPrice: 120,
      tags: ['Olympic barbells', 'Heavy dumbbells up to 60kg', 'Deadlift platform'],
      address: 'MG Road, Benz Circle, Vijayawada',
      openHours: '5:00 AM - 11:00 PM',
      slots: ['5–7 AM', '7–9 AM', '5–7 PM', '7–9 PM']
    },
    {
      id: 'gym_5',
      name: 'Cult.Fit Elite',
      city: 'Hyderabad',
      area: 'Madhapur',
      rating: 4.9,
      reviews: 840,
      distance: 0.8,
      dayPrice: 180,
      tags: ['Strength & Conditioning', 'Boxing ring', 'Steam bath', 'Juice Bar'],
      address: 'Hitech City Road, Madhapur, Hyderabad',
      openHours: '5:30 AM - 11:00 PM',
      slots: ['6–8 AM', '8–10 AM', '5–7 PM', '7–9 PM']
    },
    {
      id: 'gym_6',
      name: 'Gold\'s Gym',
      city: 'Hyderabad',
      area: 'Gachibowli',
      rating: 4.8,
      reviews: 650,
      distance: 1.4,
      dayPrice: 180,
      tags: ['Certified Trainers', 'Cardio cinema', 'Spinning studio', 'Sauna'],
      address: 'Financial District, Gachibowli, Hyderabad',
      openHours: '5:00 AM - 11:00 PM',
      slots: ['5–7 AM', '7–9 AM', '5–7 PM', '7–9 PM']
    },
    {
      id: 'gym_7',
      name: 'Beast Mode Gym',
      city: 'Guntur',
      area: 'Brodipet',
      rating: 4.6,
      reviews: 154,
      distance: 0.9,
      dayPrice: 100,
      tags: ['Heavy Lifting', 'Powerlifting Racks', 'AC', 'Chalk allowed'],
      address: '4th Line, Brodipet, Guntur',
      openHours: '5:00 AM - 10:00 PM',
      slots: ['5–7 AM', '7–9 AM', '5–7 PM', '7–9 PM']
    },
    {
      id: 'gym_8',
      name: 'Nitro Fitness Club',
      city: 'Bengaluru',
      area: 'Indiranagar',
      rating: 4.9,
      reviews: 920,
      distance: 1.1,
      dayPrice: 200,
      tags: ['State-of-the-art machines', 'Recovery lounge', 'Smoothie bar'],
      address: '100ft Road, Indiranagar, Bengaluru',
      openHours: '5:00 AM - 11:30 PM',
      slots: ['6–8 AM', '8–10 AM', '5–7 PM', '7–9 PM']
    }
  ],
  bookings: [
    {
      id: 'GG-84291',
      userId: 'usr_1',
      gymId: 'gym_1',
      gymName: 'Starts Gym',
      city: 'Vijayawada',
      area: 'Tadepalli',
      planName: '1 Week',
      daysCount: 7,
      startDate: '2026-10-18',
      endDate: '2026-10-24',
      slot: '5–7 PM',
      amount: 750,
      status: 'paid', // 'pending', 'accepted', 'slots', 'paid', 'declined'
      qrCodeData: 'GYMGO:GG-84291:usr_1:gym_1:20261024',
      userName: 'Alex Turner',
      paymentMethod: 'UPI',
      createdAt: '2026-10-18T10:30:00.000Z'
    }
  ],
  passportStamps: [
    {
      id: 'stamp_1',
      userId: 'usr_1',
      gymName: 'Starts Gym',
      city: 'Vijayawada',
      area: 'Tadepalli',
      visitedDate: '2026-10-18',
      badgeEarned: 'First Sweat',
      verified: true
    },
    {
      id: 'stamp_2',
      userId: 'usr_1',
      gymName: 'Cult.Fit Elite',
      city: 'Hyderabad',
      area: 'Madhapur',
      visitedDate: '2026-09-24',
      badgeEarned: 'Cyber City Lifter',
      verified: true
    },
    {
      id: 'stamp_3',
      userId: 'usr_1',
      gymName: 'Nitro Fitness',
      city: 'Bengaluru',
      area: 'Indiranagar',
      visitedDate: '2026-08-14',
      badgeEarned: 'Silicon Valley Pump',
      verified: true
    }
  ],
  gymgramPosts: [
    {
      id: 'post_1',
      userId: 'usr_1',
      authorName: 'Alex Turner',
      authorAvatar: 'A',
      location: 'Starts Gym · Tadepalli, Vijayawada',
      caption: 'Hit a smooth 105 kg bench press on travel pass! The equipment here at Starts Gym is top-notch. 🔥 Never skip chest day, even when travelling.',
      tag: 'PR Alert 🏆',
      likes: 28,
      likedBy: ['usr_owner'],
      comments: [
        { id: 'c_1', author: 'Vikram Rao', text: 'Great form today Alex! Keep smashing it at Starts Gym.' }
      ],
      timeAgo: '2 hours ago',
      workoutType: 'Chest & Triceps'
    },
    {
      id: 'post_2',
      userId: 'usr_2',
      authorName: 'Sarah Jenkins',
      authorAvatar: 'S',
      location: 'Cult.Fit Elite · Madhapur, Hyderabad',
      caption: 'Morning HIIT session wrapped before client meetings. GymGo made dropping into Hyderabad gym so seamless! ⚡',
      tag: 'Morning Grind ⚡',
      likes: 45,
      likedBy: ['usr_1'],
      comments: [
        { id: 'c_2', author: 'Alex Turner', text: 'Cult Madhapur is legendary!' }
      ],
      timeAgo: '5 hours ago',
      workoutType: 'HIIT & Mobility'
    },
    {
      id: 'post_3',
      userId: 'usr_3',
      authorName: 'Rahul Varma',
      authorAvatar: 'R',
      location: 'Iron Nation · Benz Circle, Vijayawada',
      caption: '4-plate deadlift session in the books. 180kg felt light today. Consistency beats motivation every single time.',
      tag: 'Deadlift Club 🏋️',
      likes: 62,
      likedBy: ['usr_1'],
      comments: [],
      timeAgo: '1 day ago',
      workoutType: 'Back & Deadlifts'
    }
  ],
  coachAssessments: {
    'usr_1': {
      age: 25,
      sex: 'Male',
      h: 175,
      w: 72,
      goal: 'muscle',
      ap: 'bb',
      diet: 'non',
      med: ['None'],
      note: 'Looking to hit 110kg bench this quarter.',
      waterGlassesToday: 6,
      updatedAt: '2026-10-18T12:00:00.000Z'
    }
  },
  workoutLogs: {
    'usr_1': [
      {
        t: 1760810400000,
        d: 'Moderate · Upper A',
        x: 'DB Press: 32kg x 10, 10, 8\nDB Row: 34kg x 10, 10, 10\nArnold Press: 18kg x 10, 10\nFelt great pump in Tadepalli.'
      }
    ]
  },
  workoutEdits: {},
  workoutDone: {},
  customExercises: [],
  settlements: [
    {
      id: 'set_101',
      gymId: 'gym_1',
      ownerId: 'usr_owner',
      period: 'Oct 2026',
      grossAmount: 3200,
      commissionAmount: 480,
      netPayout: 2720,
      status: 'SETTLED',
      paidAt: '2026-10-31T18:00:00.000Z',
      reference: 'UPI/AXIS/99812471'
    }
  ],
  refunds: [
    {
      id: 'ref_1',
      bookingId: 'GG-84291',
      athleteId: 'usr_1',
      athleteName: 'Alex Turner',
      gymId: 'gym_1',
      gymName: 'Starts Gym',
      amount: 150,
      reason: 'Travel plan cancelled due to flight reschedule',
      status: 'RESOLVED',
      createdAt: '2026-10-22T08:00:00.000Z',
      adminNote: 'Verified and credited via original payment method'
    }
  ],
  complaints: [
    {
      id: 'tkt_101',
      reporterId: 'usr_1',
      reporterName: 'Alex Turner',
      reporterRole: 'athlete',
      category: 'facility_cleanliness',
      description: 'Locker room showers water pressure was low during morning slot.',
      status: 'RESOLVED',
      priority: 'MEDIUM',
      resolution: 'Owner inspected and repaired pressure valve on 24th Oct.',
      createdAt: '2026-10-23T11:00:00.000Z'
    }
  ],
  auditLogs: [
    {
      id: 'aud_1',
      adminId: 'usr_admin',
      adminName: 'Master Admin',
      action: 'SYSTEM_INITIALIZATION',
      targetType: 'PLATFORM',
      targetId: 'gymgo_hq',
      details: 'GymGo 2.0 Unified Cross-City Platform Activated',
      timestamp: '2026-10-01T00:00:00.000Z'
    }
  ],
  promotions: [
    {
      code: 'GYMGO20',
      discountPct: 20,
      maxDiscount: 100,
      city: 'ALL',
      description: '20% off all cross-city travel day passes',
      validUntil: '2026-12-31',
      usageCount: 14,
      maxUsage: 500,
      active: true
    },
    {
      code: 'VIJAYAWADA50',
      discountPct: 50,
      maxDiscount: 150,
      city: 'Vijayawada',
      description: 'Flat 50% discount on Tadepalli & Benz Circle passes',
      validUntil: '2026-12-31',
      usageCount: 8,
      maxUsage: 200,
      active: true
    }
  ],
  notifications: [
    {
      id: 'notif_1',
      userId: 'usr_1',
      title: 'Pass Ready',
      message: 'Your Starts Gym Tadepalli pass QR is active for turnstile check-in.',
      type: 'pass',
      read: false,
      createdAt: '2026-10-18T10:35:00.000Z'
    },
    {
      id: 'notif_2',
      userId: 'usr_owner',
      title: 'New Booking',
      message: 'Alex Turner requested a 1 Week pass for Starts Gym Tadepalli.',
      type: 'booking',
      read: true,
      createdAt: '2026-10-18T10:30:00.000Z'
    }
  ],
  visitorRegister: [
    {
      id: 'vis_101',
      bookingId: 'GG-84291',
      athleteId: 'usr_1',
      athleteName: 'Alex Turner',
      gymId: 'gym_1',
      gymName: 'Starts Gym',
      checkInTime: '2026-10-18T17:15:00.000Z',
      verifiedBy: 'Reception / Turnstile Scanner',
      passType: '1 Week Pass',
      status: 'VERIFIED'
    }
  ],
  staffAccounts: [
    {
      id: 'stf_1',
      gymId: 'gym_1',
      username: 'reception_starts',
      name: 'Starts Gym Desk Staff',
      password: 'password123',
      role: 'staff',
      permissions: ['qr_scan', 'visitor_view']
    }
  ],
  gymSchedules: {
    'gym_1': {
      currentOccupancy: 18,
      maxCapacity: 60,
      slots: [
        { time: '5–7 AM', maxCapacity: 25, bookedCapacity: 12, open: true },
        { time: '7–9 AM', maxCapacity: 30, bookedCapacity: 18, open: true },
        { time: '9–11 AM', maxCapacity: 20, bookedCapacity: 5, open: true },
        { time: '5–7 PM', maxCapacity: 35, bookedCapacity: 22, open: true },
        { time: '7–9 PM', maxCapacity: 35, bookedCapacity: 28, open: true },
        { time: '9–11 PM', maxCapacity: 20, bookedCapacity: 4, open: true }
      ]
    }
  }
};

// Database helper functions - Dual Engine (MongoDB Atlas Cloud + Local JSON File Fallback)
class Database {
  constructor() {
    this.dbFilePath = getSafeDbFilePath();
    this.mongoConnected = false;
    this.data = JSON.parse(JSON.stringify(initialData));
    this.loadFromFile();
    this.initMongo();
  }

  loadFromFile() {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const raw = fs.readFileSync(this.dbFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        // Deep merge top-level tables so new tables from initialData are preserved
        this.data = { ...initialData, ...parsed };
      } else {
        this.saveToFile();
      }
    } catch (e) {
      console.warn('[GymGo DB] Could not read local DB file, using seed memory:', e.message);
      this.saveToFile();
    }
  }

  saveToFile() {
    try {
      fs.writeFileSync(this.dbFilePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.warn('[GymGo DB] Could not save local DB file:', e.message);
    }
  }

  async initMongo() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri || !mongoose) {
      return;
    }

    try {
      console.log('🔄 Connecting to MongoDB Atlas cloud database...');
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 6000
      });
      this.mongoConnected = true;
      console.log('✅ Connected to MongoDB Atlas! Cloud persistence active for GymGo.');

      // Load all collections from cloud into in-memory store
      const docs = await GymGoDocModel.find({});
      if (docs && docs.length > 0) {
        docs.forEach(doc => {
          if (doc.key && doc.data !== undefined) {
            this.data[doc.key] = doc.data;
          }
        });
        console.log(`📦 Loaded ${docs.length} tables from MongoDB Atlas.`);
      } else {
        // Seed MongoDB from initialData if collection is fresh
        console.log('🌱 Seeding fresh MongoDB Atlas database with GymGo initial data...');
        for (const [key, val] of Object.entries(this.data)) {
          await GymGoDocModel.findOneAndUpdate(
            { key },
            { data: val, updatedAt: new Date() },
            { upsert: true }
          );
        }
        console.log('✅ Seed completed in MongoDB Atlas.');
      }
      this.saveToFile();
    } catch (err) {
      this.mongoConnected = false;
      console.warn('⚠️  Could not connect to MongoDB Atlas:', err.message);
      console.warn('⚡ Seamlessly continuing with local file/in-memory database engine.');
    }
  }

  get(table) {
    return this.data[table] || [];
  }

  set(table, val) {
    this.data[table] = val;
    this.saveToFile();

    // Asynchronous background cloud sync to MongoDB
    if (this.mongoConnected && GymGoDocModel) {
      GymGoDocModel.findOneAndUpdate(
        { key: table },
        { data: val, updatedAt: new Date() },
        { upsert: true }
      ).catch(err => {
        console.warn(`[GymGo DB] Cloud sync error for table "${table}":`, err.message);
      });
    }

    return this.data[table];
  }

  getStatus() {
    return {
      mode: this.mongoConnected ? 'mongodb_cloud' : 'local_json',
      connected: this.mongoConnected,
      mongoConfigured: !!process.env.MONGODB_URI,
      storageFile: this.dbFilePath,
      tablesCount: Object.keys(this.data).length
    };
  }
}

const db = new Database();

module.exports = { db, initialData };
