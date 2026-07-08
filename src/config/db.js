import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Îi spunem exact unde să caute fișierul .env ca să nu se mai piardă
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Crearea pool-ului de conexiuni
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '826257ronaldo', // Hardcode de siguranță dacă dotenv dă rateu
    database: process.env.DB_NAME || 'tripplanner',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Functia de test
export async function testConnection() {
    try {
        const connection = await pool.getConnection();
        await connection.query('SELECT 1');
        connection.release();
        console.log('Conectat la MySQL');
    } catch (error) {
        console.error('Eroare la conectarea bazei de date MySQL:', error.message);
    }
}

export default pool;