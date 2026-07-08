import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/db.js'; // <-- Importul nou

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Apelam functia ca sa testeze baza de date la pornire
testConnection(); // <-- Apelul nou

app.listen(PORT, () => {
    console.log(`Serverul ruleaza pe portul ${PORT}`);
});