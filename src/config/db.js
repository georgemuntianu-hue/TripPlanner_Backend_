import mysql from 'mysql2/promise';

// Scriem datele direct, fara sa mai apelam process.env
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '826257ronaldo', // <-- Pune aici parola ta de la MySQL
    database: 'tripplanner',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export const testConnection = async () => {
    try {
        await pool.query('SELECT 1 + 1 AS result');
        console.log('✅ Conexiunea la baza de date MySQL a reusit cu succes!');
    } catch (error) {
        console.error('❌ Eroare la conectarea bazei de date MySQL:', error.message);
    }
};

export default pool;