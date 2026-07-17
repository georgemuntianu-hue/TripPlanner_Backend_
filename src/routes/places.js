// server/src/routes/places.js
import express from 'express';
import db from '../config/db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Protejăm rutele de places cu middleware-ul de autentificare
router.use(authMiddleware);

// Helper pentru a extrage userId în siguranță
const getUserIdFromReq = (req) => {
    return req.userId || (req.user && req.user.id) || (req.user && req.user.userId) || req.id || (req.decoded && req.decoded.id);
};

// 1. GET /api/places - Citește toate locurile utilizatorului din MySQL
router.get('/', async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        const tripId = req.query.trip_id;

        let query = 'SELECT * FROM places WHERE user_id = ?';
        let queryParams = [userId];

        // Dacă trimitem trip_id din frontend, filtrăm locurile doar pentru acea călătorie
        if (tripId) {
            query += ' AND trip_id = ?';
            queryParams.push(tripId);
        }

        query += ' ORDER BY id DESC'; // Cele mai noi primele (prepend behavior)

        const [places] = await db.query(query, queryParams);
        res.json(places);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. POST /api/places - Salvează un loc nou în MySQL (Global sau asociat unui Trip/Day)
router.post('/', async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        const { name, description, trip_id, day_number } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Numele locației este obligatoriu.' });
        }

        const [result] = await db.query(
            'INSERT INTO places (user_id, trip_id, day_number, name, description) VALUES (?, ?, ?, ?, ?)',
            [userId, trip_id || null, day_number || null, name, description || '']
        );

        // Returnăm obiectul proaspăt creat cu ID-ul generat de SQL
        res.status(201).json({
            id: result.insertId,
            user_id: userId,
            trip_id: trip_id || null,
            day_number: day_number || null,
            name,
            description: description || ''
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. DELETE /api/places/:id - Șterge un rând din tabela `places` pe baza ID-ului
router.delete('/:id', async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        const placeId = req.params.id;

        const [result] = await db.query(
            'DELETE FROM places WHERE id = ? AND user_id = ?',
            [placeId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Locația nu a fost găsită sau nu îți aparține.' });
        }

        res.json({ message: 'Locația a fost ștearsă cu succes din MySQL!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;