import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';

const router = express.Router();

// 1. REGISTER
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Toate câmpurile sunt obligatorii.' });
        }

        const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Acest email este deja înregistrat.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name.trim(), email.trim(), hashedPassword]
        );

        res.status(201).json({
            message: 'Cont creat cu succes!',
            userId: result.insertId
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email și parola sunt obligatorii.' });
        }

        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Email sau parolă incorectă.' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Email sau parolă incorectă.' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET || 'secret_cheie',
            { expiresIn: '24h' }
        );

        res.status(200).json({
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. ȘTERGERE CONT
router.delete('/delete-account', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Token de autentificare lipsă.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_cheie');
        const userId = decoded.id;

        const [trips] = await db.query('SELECT id FROM trips WHERE user_id = ?', [userId]);
        const tripIds = trips.map(t => t.id);

        if (tripIds.length > 0) {
            await db.query('DELETE FROM places WHERE trip_id IN (?)', [tripIds]);
            await db.query('DELETE FROM days WHERE trip_id IN (?)', [tripIds]);
            await db.query('DELETE FROM trips WHERE user_id = ?', [userId]);
        }

        const [result] = await db.query('DELETE FROM users WHERE id = ?', [userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Utilizatorul nu a fost găsit.' });
        }

        return res.status(200).json({ message: 'Contul și toate datele tale asociate au fost șterse definitiv.' });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

export default router;