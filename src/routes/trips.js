// server/src/routes/trips.js
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

// Helper pentru a formata datele călătoriei (buget și preferințe)
const formatTripData = (trip) => {
    try {
        trip.preferences = typeof trip.preferences === 'string' ? JSON.parse(trip.preferences) : trip.preferences;
    } catch (e) {
        trip.preferences = {};
    }
    trip.budgetLimit = trip.budget;
    return trip;
};

// 1. GET /api/trips - Toate călătoriile utilizatorului
router.get('/', async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        const [trips] = await db.query('SELECT * FROM trips WHERE user_id = ? ORDER BY start_date ASC', [userId]);
        const formattedTrips = trips.map(trip => formatTripData(trip));
        res.json(formattedTrips);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. GET /api/trips/:id - Detalii călătorie + Zile
router.get('/:id', async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        const tripId = req.params.id;

        const [trips] = await db.query('SELECT * FROM trips WHERE id = ? AND user_id = ?', [tripId, userId]);
        if (trips.length === 0) return res.status(404).json({ message: 'Călătoria nu a fost găsită.' });

        const trip = formatTripData(trips[0]);
        const [days] = await db.query('SELECT * FROM days WHERE trip_id = ? ORDER BY day_number ASC', [tripId]);

        // Mapăm corect elementele ca să se potrivească perfect cu structura din frontend
        trip.days = days.map(day => ({
            id: day.id,
            dayNumber: day.day_number,
            day_number: day.day_number,
            title: `Ziua ${day.day_number}: Plan de călătorie`,
            morning: day.morning,
            afternoon: day.afternoon,
            evening: day.evening,
            activities: day.activities,
            tip_of_the_day: day.activities // Mapăm coloana activities din MySQL în tip_of_the_day
        }));

        res.json(trip);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. POST /api/trips - Creare călătorie + Generare inițială de zile
router.post('/', async (req, res) => {
    try {
        const { destination, start_date, end_date, preferences, budget } = req.body;
        const userId = getUserIdFromReq(req);

        if (!userId) return res.status(401).json({ message: 'Eroare autentificare.' });

        const start = new Date(start_date);
        const end = new Date(end_date);
        const totalDays = Math.ceil((end - start) / (1000 * 3600 * 24)) + 1;

        const [tripResult] = await db.query(
            'INSERT INTO trips (user_id, destination, start_date, end_date, preferences, budget) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, destination, start.toISOString().split('T')[0], end.toISOString().split('T')[0], JSON.stringify(preferences || {}), budget]
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
        res.status(500).json({ error: error.message });
    }
});

// 4. PUT /api/trips/:id - Update călătorie generic
router.put('/:id', async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        const { destination, budget } = req.body;
        await db.query('UPDATE trips SET destination = ?, budget = ? WHERE id = ? AND user_id = ?', [destination, budget, req.params.id, userId]);
        res.json({ message: 'Actualizat' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. DELETE /api/trips/:id - Ștergere călătorie
router.delete('/:id', async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        await db.query('DELETE FROM trips WHERE id = ? AND user_id = ?', [req.params.id, userId]);
        res.json({ message: 'Șters' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. PUT /api/trips/:id/days/:dayNumber - Actualizează activitățile dintr-o zi în baza de date SQL
router.put('/:id/days/:dayNumber', async (req, res) => {
    try {
        const tripId = req.params.id;
        const dayNumber = req.params.dayNumber;
        const { morning, afternoon, evening, tip_of_the_day } = req.body;

        const [result] = await db.query(
            'UPDATE days SET morning = ?, afternoon = ?, evening = ?, activities = ? WHERE trip_id = ? AND day_number = ?',
            [morning, afternoon, evening, tip_of_the_day || '', tripId, dayNumber]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Ziua respectivă nu a fost găsită în baza de date.' });
        }

        res.json({ message: 'Activitățile au fost salvate cu succes în MySQL!' });
    } catch (error) {
        console.error("Eroare la update SQL day:", error);
        res.status(500).json({ error: error.message });
    }
});

// 7. POST /api/trips/:id/generate - Generare itinerar cu OpenAI (Task #73208)
router.post('/:id/generate', async (req, res) => {
    try {
        const tripId = req.params.id;
        const userId = getUserIdFromReq(req);

        // Preluăm datele călătoriei pentru a le trimite la OpenAI
        const [trips] = await db.query('SELECT * FROM trips WHERE id = ? AND user_id = ?', [tripId, userId]);
        if (trips.length === 0) {
            return res.status(404).json({ message: 'Călătoria nu a fost găsită.' });
        }

        const trip = trips[0];

        // Apelăm modulul de AI pentru generare
        let aiResult;
        try {
            aiResult = await generateItinerary(trip);
        } catch (aiError) {
            // Pasul 6: Returnăm cod 503 cu un mesaj user-friendly în caz că dă eroare API-ul OpenAI
            return res.status(503).json({
                message: "Nu am putut genera itinerariul în acest moment din cauza unei probleme cu serviciul de AI. Vă rugăm să reîncercați în câteva momente."
            });
        }

        const generatedDays = aiResult.days;

        try {
            // Ștergem eventualele zile deja existente pentru această călătorie (permite Regenerarea curată)
            await db.query('DELETE FROM days WHERE trip_id = ?', [tripId]);

            // Inserăm noile zile generate de AI în baza de date MySQL
            for (const day of generatedDays) {
                await db.query(
                    'INSERT INTO days (trip_id, day_number, morning, afternoon, evening, activities) VALUES (?, ?, ?, ?, ?, ?)',
                    [
                        tripId,
                        day.day_number || day.dayNumber,
                        day.morning || 'Planifică dimineața...',
                        day.afternoon || 'Planifică amiaza...',
                        day.evening || 'Planifică seara...',
                        day.tips || '' // Se salvează în coloana activities
                    ]
                );
            }

            // Actualizăm statusul tripului la 'generated'
            await db.query('UPDATE trips SET status = ? WHERE id = ?', ['generated', tripId]);

        } catch (dbError) {
            console.error("Eroare la scrierea datelor generate în MySQL:", dbError);
            return res.status(500).json({ error: "Eroare la salvarea itinerariului generat în baza de date." });
        }

        res.json({
            message: "Itinerariul a fost generat și salvat cu succes în MySQL!",
            days: generatedDays
        });

    } catch (error) {
        console.error("Eroare generală pe ruta de generare:", error);
        res.status(500).json({ error: error.message });
    }
});

export default router;