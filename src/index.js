import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/db.js'; // <-- Importam testul bazei de date

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Ruta de test pentru sanatatea serverului
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// !!! APELAM CONFIGURAREA DE MYSQL INAINTE DE LISTEN !!!
testConnection();

app.listen(PORT, () => {
    console.log(`Serverul ruleaza pe portul ${PORT}`);
});