import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Citeste fisierul .env din radacina de unde ruleaza terminalul
dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'tripplanner',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export const testConnection = async () => {
    try {
        // Ruleaza un test simplu in baza de date
        await pool.query('SELECT 1 + 1 AS result');
        console.log('✅ Conexiunea la baza de date MySQL a reusit cu succes!');
    } catch (error) {
        console.error('❌ Eroare la conectarea bazei de date MySQL:', error.message);
    }
};

export default pool;