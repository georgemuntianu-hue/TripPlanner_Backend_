import express from 'express';
import db from '../config/db.js';
import authMiddleware from '../middleware/auth.js';
import { generateItinerary } from '../services/aiService.js';

const router = express.Router();

// Protejăm toate rutele cu middleware-ul de autentificare
router.use(authMiddleware);

// Helper pentru a extrage userId în siguranță
const getUserIdFromReq = (req) => {
    return req.userId || (req.user && req.user.id) || (req.user && req.user.userId) || req.id;
};

// Helper pentru a formata datele călătoriei
const formatTripData = (trip) => {
    try {
        trip.preferences = typeof trip.preferences === 'string' ? JSON.parse(trip.preferences) : (trip.preferences || {});
    } catch (e) {
        trip.preferences = {};
    }
    trip.budgetLimit = trip.budget;
    return trip;
};

// GET /api/trips - Toate călătoriile utilizatorului
router.get('/', async (req, res, next) => {
    try {
        const userId = getUserIdFromReq(req);
        if (!userId) {
            return res.status(401).json({ message: 'Utilizator neidentificat.' });
        }

        const [trips] = await db.query('SELECT * FROM trips WHERE user_id = ? ORDER BY start_date ASC', [userId]);
        const formattedTrips = trips.map(trip => formatTripData(trip));
        res.json(formattedTrips);
    } catch (error) {
        next(error);
    }
});

// GET /api/trips/:id - Detalii călătorie + Zile
router.get('/:id', async (req, res, next) => {
    try {
        const userId = getUserIdFromReq(req);
        const tripId = req.params.id;

        const [trips] = await db.query('SELECT * FROM trips WHERE id = ? AND user_id = ?', [tripId, userId]);
        if (trips.length === 0) return res.status(404).json({ message: 'Călătoria nu a fost găsită.' });

        const trip = formatTripData(trips[0]);
        const [days] = await db.query('SELECT * FROM days WHERE trip_id = ? ORDER BY day_number ASC', [tripId]);

        trip.days = days.map(day => ({
            id: day.id,
            dayNumber: day.day_number,
            day_number: day.day_number,
            title: `Ziua ${day.day_number}: Plan de călătorie`,
            morning: day.morning,
            afternoon: day.afternoon,
            evening: day.evening,
            activities: day.activities,
            tip_of_the_day: day.activities
        }));

        res.json(trip);
    } catch (error) {
        next(error);
    }
});

// POST /api/trips - Creare călătorie nouă
router.post('/', async (req, res, next) => {
    try {
        const { destination, start_date, end_date, preferences, prefs, budget } = req.body;
        const userId = getUserIdFromReq(req);

        if (!userId) return res.status(401).json({ message: 'Eroare autentificare.' });

        const start = new Date(start_date);
        const end = new Date(end_date);
        const totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 3600 * 24)) + 1);

        const finalPreferences = prefs || preferences || {};

        const [tripResult] = await db.query(
            'INSERT INTO trips (user_id, destination, start_date, end_date, preferences, budget) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, destination, start.toISOString().split('T')[0], end.toISOString().split('T')[0], JSON.stringify(finalPreferences), budget || 0]
        );

        const newTripId = tripResult.insertId;

        for (let i = 1; i <= totalDays; i++) {
            await db.query(
                'INSERT INTO days (trip_id, day_number, morning, afternoon, evening, activities) VALUES (?, ?, ?, ?, ?, ?)',
                [newTripId, i, 'Planifică dimineața...', 'Planifică amiaza...', 'Planifică seara...', `Activități Ziua ${i}`]
            );
        }

        res.status(201).json({ id: newTripId, destination });
    } catch (error) {
        console.error("Eroare la crearea trip-ului în MySQL:", error);
        next(error);
    }
});

// PUT /api/trips/:id/days/:dayNumber - Actualizează activități zi
router.put('/:id/days/:dayNumber', async (req, res, next) => {
    try {
        const tripId = req.params.id;
        const dayNumber = req.params.dayNumber;
        const { morning, afternoon, evening, tip_of_the_day } = req.body;

        const [result] = await db.query(
            'UPDATE days SET morning = ?, afternoon = ?, evening = ?, activities = ? WHERE trip_id = ? AND day_number = ?',
            [morning, afternoon, evening, tip_of_the_day || '', tripId, dayNumber]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Ziua nu a fost găsită.' });
        }
        res.json({ message: 'Activitățile au fost salvate.' });
    } catch (error) {
        next(error);
    }
});

// POST /api/trips/:id/generate - Generare itinerar (DEBUG & SAFE MODE)
router.post('/:id/generate', async (req, res) => {
    try {
        const tripId = req.params.id;
        const userId = getUserIdFromReq(req);
        const lang = req.body?.lang || 'ro';

        // 1. Verificăm dacă trip-ul există
        const [trips] = await db.query('SELECT * FROM trips WHERE id = ? AND user_id = ?', [tripId, userId]);
        if (!trips || trips.length === 0) {
            return res.status(404).json({ message: 'Călătoria nu a fost găsită.' });
        }

        const trip = trips[0];

        // 2. Apelăm AI Service și afișăm eventualele erori în consolă
        let generatedDays = [];
        try {
            const aiResult = await generateItinerary(trip, lang);
            const parsed = typeof aiResult === 'string' ? JSON.parse(aiResult) : aiResult;
            generatedDays = parsed?.days || (Array.isArray(parsed) ? parsed : []);
        } catch (aiErr) {
            console.error("❌ [AI SERVICE ERROR]:", aiErr);
        }

        // 3. Fallback dacă AI nu a generat zile
        if (!Array.isArray(generatedDays) || generatedDays.length === 0) {
            let totalDays = 3;
            if (trip.start_date && trip.end_date) {
                const start = new Date(trip.start_date);
                const end = new Date(trip.end_date);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 3600 * 24)) + 1);
                }
            }

            generatedDays = [];
            for (let i = 1; i <= totalDays; i++) {
                generatedDays.push({
                    day_number: i,
                    morning: `Vizită la atracțiile din ${trip.destination || 'oraș'}`,
                    afternoon: `Plimbare și prânz local`,
                    evening: `Cină și relaxare`,
                    activities: `Sfat Ziua ${i}: Verifică orarul local.`
                });
            }
        }

        // 4. Salvare în MySQL (Ștergere veche + Inserare nouă)
        try {
            await db.query('DELETE FROM days WHERE trip_id = ?', [tripId]);
        } catch (delErr) {
            console.warn("⚠️ Warning la ștergerea zilelor vechi:", delErr.message);
        }

        for (const day of generatedDays) {
            const dayNum = Number(day.day_number || day.dayNumber) || 1;
            const morning = String(day.morning || 'Planifică dimineața...');
            const afternoon = String(day.afternoon || 'Planifică amiaza...');
            const evening = String(day.evening || 'Planifică seara...');
            const activities = String(day.tips || day.activities || day.tip_of_the_day || '');

            await db.query(
                'INSERT INTO days (trip_id, day_number, morning, afternoon, evening, activities) VALUES (?, ?, ?, ?, ?, ?)',
                [tripId, dayNum, morning, afternoon, evening, activities]
            );
        }

        // Marcăm statusul
        await db.query('UPDATE trips SET status = ? WHERE id = ?', ['generated', tripId]).catch(() => { });

        return res.json({ message: "Itinerariu generat cu succes!", days: generatedDays });

    } catch (error) {
        console.error("❌ [MYSQL / CRITICAL GENERATE ERROR]:", error);

        return res.status(200).json({
            warning: true,
            error_details: error.message || error.sqlMessage || "Eroare necunoscută",
            code: error.code || "UNKNOWN"
        });
    }
});

// DELETE /api/trips/:id - Ștergere călătorie
router.delete('/:id', async (req, res, next) => {
    try {
        const tripId = req.params.id;
        const userId = getUserIdFromReq(req);

        const [trips] = await db.query('SELECT * FROM trips WHERE id = ? AND user_id = ?', [tripId, userId]);
        if (trips.length === 0) {
            return res.status(404).json({ message: 'Călătoria nu a fost găsită sau nu aveți permisiunea de a o șterge.' });
        }

        try {
            await db.query('DELETE FROM places WHERE trip_id = ?', [tripId]);
        } catch (e) {
            console.log("Notă: Nu au fost găsite locuri salvate de șters.");
        }

        await db.query('DELETE FROM days WHERE trip_id = ?', [tripId]);
        await db.query('DELETE FROM trips WHERE id = ? AND user_id = ?', [tripId, userId]);

        res.json({ message: 'Călătoria a fost ștearsă cu succes!' });
    } catch (error) {
        console.error("Eroare la ștergerea călătoriei:", error);
        next(error);
    }
});

export default router;