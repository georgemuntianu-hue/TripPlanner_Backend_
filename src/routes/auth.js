import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const router = express.Router();

// Rută POST /api/auth/register
router.post('/register', async (req, res) => {
    let { name, email, password } = req.body;

    // 1. Validarea câmpurilor (Pasul 2 din task)
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Toate câmpurile (name, email, password) sunt obligatorii!' });
    }

    // Validare format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Formatul email-ului nu este valid!' });
    }

    // Validare lungime parolă
    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Parola trebuie să aibă minim 6 caractere!' });
    }

    // Curățare date (Pasul 5 din task)
    name = name.trim();
    email = email.trim().toLowerCase();

    try {
        // 2. Verifică unicitatea email-ului (Pasul 3 din task)
        const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ success: false, message: 'Acest email este deja înregistrat!' });
        }

        // 3. Hash-uiește parola cu bcrypt (Pasul 4 din task)
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 4. Inserează utilizatorul în baza de date users
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

        const userId = result.insertId;

        // 5. Generează token JWT (Pasul 6 din task - direct în cod)
        const token = jwt.sign(
            { userId: userId, email: email },
            'un_secret_super_greu_de_ghicit_123!',
            { expiresIn: '24h' }
        );

        // 6. Returnează succes 201 (Pasul 7 din task)
        return res.status(201).json({
            token,
            user: {
                id: userId,
                name,
                email
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Eroare internă de server la baza de date!' });
    }
});

export default router;