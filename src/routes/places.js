import express from 'express';
import db from '../config/db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Protejăm toate rutele cu middleware-ul de autentificare
router.use(authMiddleware);

// Helper pentru extragerea ID-ului utilizatorului în siguranță
const getUserIdFromReq = (req) => {
    return (
        req.userId ||
        (req.user && req.user.id) ||
        (req.user && req.user.userId) ||
        req.id ||
        (req.decoded && req.decoded.id)
    );
};

// 1. GET /api/places - Preluare toate locurile salvate
router.get('/', async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        const tripId = req.query.trip_id || req.query.tripId;

        if (!userId) {
            return res.status(401).json({ message: "Utilizator neautentificat." });
        }

        let query = 'SELECT * FROM places WHERE user_id = ?';
        let queryParams = [userId];

        if (tripId) {
            query += ' AND trip_id = ?';
            queryParams.push(Number(tripId));
        }

        query += ' ORDER BY id DESC';

        const [places] = await db.query(query, queryParams);

        // Mapăm rezultatele pentru a fi compatibile cu ambele denumiri (notes / description) pe frontend
        const formattedPlaces = places.map(p => ({
            ...p,
            id: p.id,
            name: p.name,
            description: p.description || '',
            notes: p.description || '',
            trip_id: p.trip_id,
            tripId: p.trip_id
        }));

        res.json(formattedPlaces);
    } catch (error) {
        console.error("❌ EROARE GET PLACES:", error);
        res.status(500).json({ error: error.message });
    }
});

// 2. POST /api/places - Adăugare locație nouă
router.post('/', async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        const { name, description, notes, trip_id, tripId } = req.body;

        if (!userId) {
            return res.status(401).json({ message: 'Utilizator neautentificat.' });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Numele locației este obligatoriu.' });
        }

        const parsedTripId = (trip_id || tripId) ? Number(trip_id || tripId) : null;
        const finalDescription = (description || notes || '').trim();

        // Inserare în baza de date MySQL
        const [result] = await db.query(
            'INSERT INTO places (user_id, trip_id, name, description) VALUES (?, ?, ?, ?)',
            [userId, parsedTripId, name.trim(), finalDescription]
        );

        const newPlace = {
            id: result.insertId,
            user_id: userId,
            trip_id: parsedTripId,
            tripId: parsedTripId,
            name: name.trim(),
            description: finalDescription,
            notes: finalDescription
        };

        res.status(201).json(newPlace);
    } catch (error) {
        console.error("❌ EROARE POST PLACES:", error);
        res.status(500).json({ error: error.message });
    }
});

// 3. DELETE /api/places/:id - Ștergere locație
router.delete('/:id', async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        const placeId = Number(req.params.id);

        if (!userId) {
            return res.status(401).json({ message: 'Utilizator neautentificat.' });
        }

        const [result] = await db.query(
            'DELETE FROM places WHERE id = ? AND user_id = ?',
            [placeId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Locația nu a fost găsită.' });
        }

        res.json({ message: 'Locația a fost ștearsă cu succes!' });
    } catch (error) {
        console.error("❌ EROARE DELETE PLACES:", error);
        res.status(500).json({ error: error.message });
    }
});

export default router;