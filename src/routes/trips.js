import express from 'express';
import authMiddleware from '../middleware/auth.js';
import db from '../config/db.js';

const router = express.Router();

// 1. Aplica authMiddleware pe tot router-ul cu router.use(authMiddleware)
router.use(authMiddleware);

// 2. GET /api/trips: returneaza toate trip-urile utilizatorului autentificat, inclusiv numarul de zile (days_count) printr-un LEFT JOIN. Parseaza campul preferences din JSON string.
router.get('/', async (req, res) => {
    try {
        const userId = req.userId;

        const [trips] = await db.query(
            `SELECT t.*, COUNT(d.id) as days_count 
       FROM trips t 
       LEFT JOIN days d ON t.id = d.trip_id 
       WHERE t.user_id = ? 
       GROUP BY t.id`,
            [userId]
        );

        const parsedTrips = trips.map(trip => ({
            ...trip,
            preferences: trip.preferences ? JSON.parse(trip.preferences) : {}
        }));

        res.json(parsedTrips);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. GET /api/trips/:id: returneaza detaliile unui trip + zilele asociate. Verifica ca trip-ul apartine utilizatorului autentificat. Returneaza 404 daca nu gasesti.
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        const [trips] = await db.query('SELECT * FROM trips WHERE id = ? AND user_id = ?', [id, userId]);
        if (trips.length === 0) {
            return res.status(404).json({ message: 'Trip-ul nu a fost găsit sau nu aveți acces.' });
        }

        const trip = trips[0];
        const [days] = await db.query('SELECT * FROM days WHERE trip_id = ? ORDER BY day_number ASC', [id]);

        trip.preferences = trip.preferences ? JSON.parse(trip.preferences) : {};
        trip.days = days;

        res.json(trip);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. POST /api/trips: validare (destination obligatoriu, end_date > start_date, max 14 zile), inserare, returneaza 201 cu trip-ul creat.
// 4. POST /api/trips: creare călătorie nouă
router.post('/', async (req, res) => {
    try {
        const { destination, start_date, end_date, preferences } = req.body;

        // Extragere sigură a ID-ului utilizatorului
        const userId = req.userId || (req.user && req.user.id) || (req.user && req.user.userId) || req.id;

        if (!userId) {
            return res.status(401).json({ message: 'Eroare de autentificare. ID-ul utilizatorului nu a putut fi extras.' });
        }

        if (!destination) {
            return res.status(400).json({ message: 'Destinația este obligatorie' });
        }

        const start = new Date(start_date);
        const end = new Date(end_date);

        if (end <= start) {
            return res.status(400).json({ message: 'end_date trebuie sa fie mai mare decat start_date' });
        }

        // Calculăm numărul de zile incluzive (ex: 1 august - 10 august înseamnă 10 zile de vacanță)
        const differenceInTime = end.getTime() - start.getTime();
        const totalDays = Math.ceil(differenceInTime / (1000 * 3600 * 24)) + 1;

        if (totalDays > 14) {
            return res.status(400).json({ message: 'Călătoria nu poate depăși maximum 14 zile' });
        }

        const preferencesString = preferences ? JSON.stringify(preferences) : '{}';

        // 1. Inserăm călătoria în tabelul `trips`
        const [tripResult] = await db.query(
            'INSERT INTO trips (user_id, destination, start_date, end_date, preferences) VALUES (?, ?, ?, ?, ?)',
            [userId, destination, start_date, end_date, preferencesString]
        );

        const newTripId = tripResult.insertId;
        const generatedDays = [];

        // 2. Buclă care generează automat fiecare zi în baza de date
        for (let i = 1; i <= totalDays; i++) {
            const [dayResult] = await db.query(
                'INSERT INTO days (trip_id, day_number, morning, afternoon, evening, activities) VALUES (?, ?, ?, ?, ?, ?)',
                [newTripId, i, 'Planifică dimineața...', 'Planifică amiaza...', 'Planifică seara...', `Activități Ziua ${i}`]
            );

            // Salvăm structura ca să o returnăm frumos în răspuns
            generatedDays.push({
                id: dayResult.insertId,
                trip_id: newTripId,
                day_number: i,
                morning: 'Planifică dimineața...',
                afternoon: 'Planifică amiaza...',
                evening: 'Planifică seara...',
                activities: `Activități Ziua ${i}`
            });
        }

        // 3. Returnăm călătoria creată cu TOATE zilele generate automat
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

// 5. PUT /api/trips/:id: verifica ownership, actualizeaza campurile trimise, returneaza trip-ul actualizat.
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { destination, start_date, end_date, preferences } = req.body;
        const userId = req.userId;

        const [trips] = await db.query('SELECT * FROM trips WHERE id = ? AND user_id = ?', [id, userId]);
        if (trips.length === 0) {
            return res.status(404).json({ message: 'Trip-ul nu a fost găsit sau nu aveți acces.' });
        }

        const preferencesString = preferences ? JSON.stringify(preferences) : undefined;

        await db.query(
            `UPDATE trips 
       SET destination = COALESCE(?, destination), 
           start_date = COALESCE(?, start_date), 
           end_date = COALESCE(?, end_date), 
           preferences = COALESCE(?, preferences) 
       WHERE id = ? AND user_id = ?`,
            [destination, start_date, end_date, preferencesString, id, userId]
        );

        const [updatedTrips] = await db.query('SELECT * FROM trips WHERE id = ?', [id]);
        const updatedTrip = updatedTrips[0];
        updatedTrip.preferences = updatedTrip.preferences ? JSON.parse(updatedTrip.preferences) : {};

        res.json(updatedTrip);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. DELETE /api/trips/:id: verifica ownership, sterge trip-ul (CASCADE sterge zilele automat).
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        const [trips] = await db.query('SELECT * FROM trips WHERE id = ? AND user_id = ?', [id, userId]);
        if (trips.length === 0) {
            return res.status(404).json({ message: 'Trip-ul nu a fost găsit sau nu aveți acces.' });
        }

        await db.query('DELETE FROM days WHERE trip_id = ?', [id]);
        await db.query('DELETE FROM trips WHERE id = ?', [id]);

        res.json({ success: true, message: 'Trip sters si zilele asociate automat (CASCADE).' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 🚀 NOUA RUTĂ: Editare manuală a unei zile dintr-un trip
// ==========================================
// 1. Adaoga ruta PUT /api/trips/:id/days/:dayId in trips.js
router.put('/:id/days/:dayId', async (req, res) => {
    try {
        const { id: tripId, dayId } = req.params;
        const { morning, afternoon, evening, activities } = req.body;
        const userId = req.userId;

        // 2. Verifica mai intai ca trip-ul apartine utilizatorului autentificat printr-un JOIN cu tabelul trips.
        // 3. Verifica ca ziua exista si apartine trip-ului specificat (Returneaza 404 daca dayId nu exista sau nu apartine).
        const [check] = await db.query(
            `SELECT d.* 
       FROM days d
       JOIN trips t ON d.trip_id = t.id
       WHERE d.id = ? AND d.trip_id = ? AND t.user_id = ?`,
            [dayId, tripId, userId]
        );

        if (check.length === 0) {
            return res.status(404).json({ message: 'Ziua nu a fost găsită sau nu aveți acces la acest trip.' });
        }

        // 4. Actualizeaza doar campurile trimise folosind COALESCE(?, coloana) — daca valoarea trimisa e NULL/undefined, se pastreaza cea existenta.
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

        // 5. Returneaza ziua actualizata complet
        const [updatedDays] = await db.query('SELECT * FROM days WHERE id = ?', [dayId]);

        res.json(updatedDays[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;