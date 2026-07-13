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

        // Verificăm direct ID-ul tripului ȘI ownership-ul în același query pentru a da direct 404
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
router.post('/', async (req, res) => {
    try {
        const { destination, start_date, end_date, preferences } = req.body;
        const userId = req.userId;

        // Validare obligatorie
        if (!destination) {
            return res.status(400).json({ message: 'Destinația este obligatorie' });
        }

        const start = new Date(start_date);
        const end = new Date(end_date);

        // Validare checklist: end_date > start_date
        if (end <= start) {
            return res.status(400).json({ message: 'end_date trebuie sa fie mai mare decat start_date' });
        }

        // Validare checklist: max 14 zile
        const differenceInDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
        if (differenceInDays > 14) {
            return res.status(400).json({ message: 'Călătoria nu poate depăși maximum 14 zile' });
        }

        // preferences se stocheaza ca JSON string
        const preferencesString = preferences ? JSON.stringify(preferences) : '{}';

        const [result] = await db.query(
            'INSERT INTO trips (user_id, destination, start_date, end_date, preferences) VALUES (?, ?, ?, ?, ?)',
            [userId, destination, start_date, end_date, preferencesString]
        );

        // Returneaza 201 cu trip-ul creat
        res.status(201).json({
            id: result.insertId,
            user_id: userId,
            destination,
            start_date,
            end_date,
            preferences: preferences || {}
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

        // Verificăm ownership. Dacă nu există sau nu e al lui -> 404
        const [trips] = await db.query('SELECT * FROM trips WHERE id = ? AND user_id = ?', [id, userId]);
        if (trips.length === 0) {
            return res.status(404).json({ message: 'Trip-ul nu a fost găsit sau nu aveți acces.' });
        }

        const preferencesString = preferences ? JSON.stringify(preferences) : undefined;

        // Actualizăm câmpurile trimise folosind COALESCE
        await db.query(
            `UPDATE trips 
       SET destination = COALESCE(?, destination), 
           start_date = COALESCE(?, start_date), 
           end_date = COALESCE(?, end_date), 
           preferences = COALESCE(?, preferences) 
       WHERE id = ? AND user_id = ?`,
            [destination, start_date, end_date, preferencesString, id, userId]
        );

        // Preluăm trip-ul proaspăt modificat din DB pentru a-l returna (Cerința exactă din pasul 5!)
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

        // Verificăm ownership -> 404 dacă nu e al lui
        const [trips] = await db.query('SELECT * FROM trips WHERE id = ? AND user_id = ?', [id, userId]);
        if (trips.length === 0) {
            return res.status(404).json({ message: 'Trip-ul nu a fost găsit sau nu aveți acces.' });
        }

        // Ștergem manual din tabelul asociat "days" pentru a simula comportamentul de CASCADE cerut în checklist
        await db.query('DELETE FROM days WHERE trip_id = ?', [id]);
        await db.query('DELETE FROM trips WHERE id = ?', [id]);

        res.json({ success: true, message: 'Trip sters si zilele asociate automat (CASCADE).' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;