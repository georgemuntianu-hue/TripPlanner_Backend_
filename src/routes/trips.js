import express from 'express';
import db from '../config/db.js';
import authMiddleware from '../middleware/auth.js';
import { generateItinerary } from '../services/aiService.js';

const router = express.Router();

// Protejăm toate rutele cu middleware-ul de autentificare
router.use(authMiddleware);

// Helper pentru a extrage userId în siguranță
const getUserIdFromReq = (req) => {
    return req.userId || (req.user && req.user.id) || (req.user && req.user.userId) || req.id || (req.decoded && req.decoded.id);
};

// Helper pentru a formata datele călătoriei
const formatTripData = (trip) => {
    try {
        trip.preferences = typeof trip.preferences === 'string' ? JSON.parse(trip.preferences) : trip.preferences;
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
        const [trips] = await db.query('SELECT * FROM trips WHERE user_id = ? ORDER BY start_date ASC', [userId]);
        const formattedTrips = trips.map(trip => formatTripData(trip));
        res.json(formattedTrips);
    } catch (error) {
        next(error); // 🌟 PASUL 2: Trimitem eroarea către middleware-ul global
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
        next(error); // 🌟 PASUL 2
    }
});

// POST /api/trips - Creare călătorie
router.post('/', async (req, res, next) => {
    try {
        const { destination, start_date, end_date, preferences, prefs, budget } = req.body;
        const userId = getUserIdFromReq(req);

        if (!userId) return res.status(401).json({ message: 'Eroare autentificare.' });

        const start = new Date(start_date);
        const end = new Date(end_date);
        const totalDays = Math.ceil((end - start) / (1000 * 3600 * 24)) + 1;

        const finalPreferences = prefs || preferences || {};

        const [tripResult] = await db.query(
            'INSERT INTO trips (user_id, destination, start_date, end_date, preferences, budget) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, destination, start.toISOString().split('T')[0], end.toISOString().split('T')[0], JSON.stringify(finalPreferences), budget]
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
        next(error); // 🌟 PASUL 2
    }
});

// PUT /api/trips/:id/days/:dayNumber - Actualizează activități
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
        next(error); // 🌟 PASUL 2
    }
});

// POST /api/trips/:id/generate - Generare itinerar cu Groq
router.post('/:id/generate', async (req, res, next) => {
    try {
        const tripId = req.params.id;
        const userId = getUserIdFromReq(req);
        const { lang } = req.body;

        const [trips] = await db.query('SELECT * FROM trips WHERE id = ? AND user_id = ?', [tripId, userId]);
        if (trips.length === 0) {
            return res.status(404).json({ message: 'Călătoria nu a fost găsită.' });
        }

        const trip = trips[0];

        let aiResult;
        try {
            aiResult = await generateItinerary(trip, lang || 'ro');
        } catch (aiError) {
            return res.status(503).json({ message: "Eroare serviciu AI. Vă rugăm să reîncercați." });
        }

        const generatedDays = aiResult.days;

        try {
            await db.query('DELETE FROM days WHERE trip_id = ?', [tripId]);
            for (const day of generatedDays) {
                await db.query(
                    'INSERT INTO days (trip_id, day_number, morning, afternoon, evening, activities) VALUES (?, ?, ?, ?, ?, ?)',
                    [
                        tripId,
                        day.day_number || day.dayNumber,
                        day.morning || 'Planifică dimineața...',
                        day.afternoon || 'Planifică amiaza...',
                        day.evening || 'Planifică seara...',
                        day.tips || ''
                    ]
                );
            }
            await db.query('UPDATE trips SET status = ? WHERE id = ?', ['generated', tripId]);
        } catch (dbError) {
            return next(dbError);
        }

        res.json({ message: "Itinerariu generat!", days: generatedDays });
    } catch (error) {
        next(error); // 🌟 PASUL 2
    }
});

// DELETE /api/trips/:id - Ștergere călătorie
router.delete('/:id', async (req, res, next) => {
    try {
        const tripId = req.params.id;
        const userId = getUserIdFromReq(req);

        // 1. Verificăm dacă trip-ul aparține utilizatorului curent
        const [trips] = await db.query('SELECT * FROM trips WHERE id = ? AND user_id = ?', [tripId, userId]);
        if (trips.length === 0) {
            return res.status(404).json({ message: 'Călătoria nu a fost găsită sau nu aveți permisiunea de a o șterge.' });
        }

        // 2. Ștergem locurile salvate asociate călătoriei
        try {
            await db.query('DELETE FROM places WHERE trip_id = ?', [tripId]);
        } catch (e) {
            console.log("Notă: Nu au fost găsite locuri salvate de șters.");
        }

        // 3. Ștergem zilele asociate din tabelul days
        await db.query('DELETE FROM days WHERE trip_id = ?', [tripId]);

        // 4. Ștergem călătoria propriu-zisă
        await db.query('DELETE FROM trips WHERE id = ? AND user_id = ?', [tripId, userId]);

        res.json({ message: 'Călătoria a fost ștearsă cu succes!' });
    } catch (error) {
        console.error("Eroare la ștergerea călătoriei:", error);
        next(error); // 🌟 PASUL 2
    }
});

export default router;