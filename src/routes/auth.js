import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';

const router = express.Router();

// 1. REGISTER
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Toate campurile sunt obligatorii.' });
        }

        const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'Acest email este deja inregistrat.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

        res.status(201).json({ message: 'Utilizator inregistrat cu succes.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Toate campurile sunt obligatorii.' });
        }

        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Email sau parola incorecta.' });
        }

        const user = users[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Email sau parola incorecta.' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || 'secret_cheie',
            { expiresIn: '24h' }
        );

        res.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. ȘTERGERE CONT SECURIZATĂ CU BEARER TOKEN (ZONĂ DIRECTĂ SWAGGER)
router.delete('/delete-account', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Token de autentificare lipsa.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_cheie');
        const userId = decoded.id;

        console.log(`[Swagger Trigger] Pornire stergere pentru utilizatorul cu ID: ${userId}`);

        // A. Preluăm ID-urile tuturor călătoriilor acestui utilizator
        const [trips] = await db.query('SELECT id FROM trips WHERE userId = ?', [userId]);
        const tripIds = trips.map(t => t.id);

        if (tripIds.length > 0) {
            // B. Ștergem locurile salvate asociate călătoriilor (pentru a asigura lipsa conflictelor de Foreign Key)
            await db.query('DELETE FROM places WHERE trip_id IN (?)', [tripIds]);

            // C. Ștergem zilele asociate călătoriilor
            await db.query('DELETE FROM trip_days WHERE tripId IN (?)', [tripIds]);
            console.log(`Zilele si locurile asociate calatoriilor au fost sterse.`);

            // D. Ștergem călătoriile utilizatorului
            await db.query('DELETE FROM trips WHERE userId = ?', [userId]);
            console.log(`Toate calatoriile au fost sterse.`);
        }

        // E. Ștergem definitiv contul din users
        const [result] = await db.query('DELETE FROM users WHERE id = ?', [userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Utilizatorul nu a fost gasit.' });
        }

        console.log(`Contul cu ID ${userId} a fost sters definitiv cu succes.`);
        return res.status(200).json({ message: 'Contul și toate datele tale asociate au fost șterse definitiv din MySQL!' });

    } catch (error) {
        console.error("Eroare la stergerea contului:", error);
        return res.status(500).json({ error: error.message });
    }
});

export default router;