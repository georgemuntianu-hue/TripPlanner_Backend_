import express from 'express';
import db from '../config/db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// ==========================================
// 1. GET /api/trips - Toate călătoriile
// ==========================================
router.get('/', async (req, res) => {
    try {
        const userId = req.userId || (req.user && req.user.id) || (req.user && req.user.userId) || req.id;

        const [trips] = await db.query(
            'SELECT * FROM trips WHERE user_id = ? ORDER BY start_date ASC',
            [userId]
        );

        const formattedTrips = trips.map(trip => {
            try {
                trip.preferences = typeof trip.preferences === 'string' ? JSON.parse(trip.preferences) : trip.preferences;
            } catch (e) {
                trip.preferences = {};
            }
            return trip;
        });

        res.json(formattedTrips);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 2. GET /api/trips/:id - Detalii călătorie + Zile (cu dayId explicat)
// ==========================================
router.get('/:id', async (req, res) => {
    try {
        const userId = req.userId || (req.user && req.user.id) || (req.user && req.user.userId) || req.id;
        const tripId = req.params.id;

        const [trips] = await db.query('SELECT * FROM trips WHERE id = ? AND user_id = ?', [tripId, userId]);

        if (trips.length === 0) {
            return res.status(404).json({ message: 'Călătoria nu a fost găsită sau nu ai permisiunea.' });
        }

        const trip = trips[0];
        try {
            trip.preferences = typeof trip.preferences === 'string' ? JSON.parse(trip.preferences) : trip.preferences;
        } catch (e) {
            trip.preferences = {};
        }

        // Luăm zilele și mapăm rezultatul ca să includă clar "dayId"
        const [days] = await db.query('SELECT * FROM days WHERE trip_id = ? ORDER BY day_number ASC', [tripId]);

        trip.days = days.map(day => ({
            id: day.id,
            dayId: day.id, // <-- ACUM APARE EXPLICIT ȘI dayId PENTRU SWAGGER / FRONTEND
            trip_id: day.trip_id,
            day_number: day.day_number,
            morning: day.morning,
            afternoon: day.afternoon,
            evening: day.evening,
            activities: day.activities
        }));

        res.json(trip);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 3. POST /api/trips - Creare + Generare automată zile (cu dayId explicat)
// ==========================================
router.post('/', async (req, res) => {
    try {
        const { destination, start_date, end_date, preferences } = req.body;
        const userId = req.userId || (req.user && req.user.id) || (req.user && req.user.userId) || req.id;

        if (!userId) {
            return res.status(401).json({ message: 'Eroare de autentificare.' });
        }

        if (!destination) {
            return res.status(400).json({ message: 'Destinația este obligatorie' });
        }

        const start = new Date(start_date);
        const end = new Date(end_date);

        if (end <= start) {
            return res.status(400).json({ message: 'end_date trebuie sa fie mai mare decat start_date' });
        }

        const differenceInTime = end.getTime() - start.getTime();
        const totalDays = Math.ceil(differenceInTime / (1000 * 3600 * 24)) + 1;

        if (totalDays > 14) {
            return res.status(400).json({ message: 'Călătoria nu poate depăși maximum 14 zile' });
        }

        const preferencesString = preferences ? JSON.stringify(preferences) : '{}';

        const [tripResult] = await db.query(
            'INSERT INTO trips (user_id, destination, start_date, end_date, preferences) VALUES (?, ?, ?, ?, ?)',
            [userId, destination, start_date, end_date, preferencesString]
        );

        const newTripId = tripResult.insertId;
        const generatedDays = [];

        try {
            for (let i = 1; i <= totalDays; i++) {
                const [dayResult] = await db.query(
                    'INSERT INTO days (trip_id, day_number, morning, afternoon, evening, activities) VALUES (?, ?, ?, ?, ?, ?)',
                    [newTripId, i, 'Planifică dimineața...', 'Planifică amiaza...', 'Planifică seara...', `Activități Ziua ${i}`]
                );

                generatedDays.push({
                    id: dayResult.insertId,
                    dayId: dayResult.insertId, // <-- ADAUGĂM EXPLICIT ȘI AICI PENTRU NOILE TRIP-URI
                    trip_id: newTripId,
                    day_number: i,
                    morning: 'Planifică dimineața...',
                    afternoon: 'Planifică amiaza...',
                    evening: 'Planifică seara...',
                    activities: `Activități Ziua ${i}`
                });
            }
        } catch (dayError) {
            return res.status(500).json({
                message: "Generarea automată a zilelor a eșuat.",
                error: dayError.message
            });
        }

        res.status(201).json({
            id: newTripId,
            user_id: userId,
            destination,
            start_date,
            end_date,
            preferences: preferences || {},
            days: generatedDays
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 4. PUT /api/trips/:id - Editare călătorie
// ==========================================
router.put('/:id', async (req, res) => {
    try {
        const userId = req.userId || (req.user && req.user.id) || (req.user && req.user.userId) || req.id;
        const tripId = req.params.id;
        const { destination } = req.body;

        const [result] = await db.query(
            'UPDATE trips SET destination = COALESCE(?, destination) WHERE id = ? AND user_id = ?',
            [destination, tripId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Călătoria nu a fost găsită sau nu ai permisiunea.' });
        }

        res.json({ message: 'Călătoria a fost actualizată' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 5. DELETE /api/trips/:id - Ștergere călătorie
// ==========================================
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.userId || (req.user && req.user.id) || (req.user && req.user.userId) || req.id;
        const tripId = req.params.id;

        const [result] = await db.query('DELETE FROM trips WHERE id = ? AND user_id = ?', [tripId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Călătoria nu a fost găsită.' });
        }

        res.json({ message: 'Călătoria a fost ștearsă' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 6. PUT /api/trips/:id/days/:dayId - Editare manuală a unei zile (Task Remus)
// ==========================================
router.put('/:id/days/:dayId', async (req, res) => {
    try {
        const userId = req.userId || (req.user && req.user.id) || (req.user && req.user.userId) || req.id;
        const tripId = req.params.id;
        const dayId = req.params.dayId;
        const { morning, afternoon, evening, activities } = req.body;

        const [check] = await db.query(
            `SELECT d.id FROM days d 
       JOIN trips t ON d.trip_id = t.id 
       WHERE d.id = ? AND d.trip_id = ? AND t.user_id = ?`,
            [dayId, tripId, userId]
        );

        if (check.length === 0) {
            return res.status(404).json({ message: 'Ziua specificată nu a fost găsită sau nu aparține acestei călătorii.' });
        }

        await db.query(
            `UPDATE days 
       SET morning = COALESCE(?, morning), 
           afternoon = COALESCE(?, afternoon), 
           evening = COALESCE(?, evening),
           activities = COALESCE(?, activities)
       WHERE id = ?`,
            [
                morning !== undefined ? morning : null,
                afternoon !== undefined ? afternoon : null,
                evening !== undefined ? evening : null,
                activities !== undefined ? activities : null,
                dayId
            ]
        );

        const [updatedDay] = await db.query('SELECT * FROM days WHERE id = ?', [dayId]);

        // Întoarcem răspunsul incluzând și dayId ca să păstrăm consistența
        const responseDay = {
            ...updatedDay[0],
            dayId: updatedDay[0].id
        };

        res.json(responseDay);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;