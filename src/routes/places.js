import express from 'express';
import db from '../config/db.js'; // Ajustează calea către fișierul tău de configurare bază de date dacă diferă
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// 1. Aplicăm authMiddleware global pe toate rutele din acest fișier
router.use(authMiddleware);

// 2. GET /api/places - Returnează locurile utilizatorului autentificat cu LEFT JOIN spre trips
router.get('/', async (req, res) => {
    try {
        const userId = req.userId;

        const query = `
      SELECT p.*, t.destination AS trip_destination 
      FROM places p
      LEFT JOIN trips t ON p.trip_id = t.id
      WHERE p.user_id = ?
    `;
        const [places] = await db.query(query, [userId]);

        res.json(places);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. POST /api/places - Creează un loc salvat nou
router.post('/', async (req, res) => {
    try {
        const userId = req.userId;
        const { name, description, address, trip_id } = req.body;

        // Validare: Numele este obligatoriu
        if (!name) {
            return res.status(400).json({ message: 'Numele locului este obligatoriu' });
        }

        // Dacă trip_id este furnizat, verificăm ownership-ul (să aparțină utilizatorului)
        if (trip_id) {
            const [trip] = await db.query('SELECT user_id FROM trips WHERE id = ?', [trip_id]);

            if (trip.length === 0 || trip[0].user_id !== userId) {
                return res.status(403).json({ message: 'Călătoria specificată nu îți aparține!' });
            }
        }

        // Inserare în baza de date
        const [result] = await db.query(
            'INSERT INTO places (user_id, name, description, address, trip_id) VALUES (?, ?, ?, ?, ?)',
            [userId, name, description || null, address || null, trip_id || null]
        );

        res.status(201).json({
            id: result.insertId,
            user_id: userId,
            name,
            description: description || null,
            address: address || null,
            trip_id: trip_id || null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. DELETE /api/places/:id - Șterge un loc salvat verificând ownership-ul
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const placeId = req.params.id;

        // Verificăm dacă locul există și aparține utilizatorului autentificat
        const [place] = await db.query('SELECT user_id FROM places WHERE id = ?', [placeId]);

        if (place.length === 0 || place[0].user_id !== userId) {
            return res.status(403).json({ message: 'Nu ai permisiunea să ștergi acest loc sau locul nu există' });
        }

        // Ștergem locul
        await db.query('DELETE FROM places WHERE id = ?', [placeId]);

        res.status(200).json({ message: 'Locul a fost șters cu succes' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;