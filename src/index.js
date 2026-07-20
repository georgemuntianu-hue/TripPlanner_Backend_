import 'dotenv/config'; // Încarcă variabilele de mediu imediat
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Importă rutele
import authRoutes from './routes/auth.js';
import tripRoutes from './routes/trips.js';
import placesRoutes from './routes/places.js';
import chatRoutes from './routes/chat.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Obținem calea pentru modulele ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware-uri esențiale
app.use(cors());
app.use(express.json());

// Montăm routerele (o singură dată, ordonate)
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/chat', chatRoutes);

// Configurare Swagger
const swaggerPath = path.resolve(__dirname, '../swagger.json');
if (fs.existsSync(swaggerPath)) {
    const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} else {
    console.log("Avertisment: Fișierul swagger.json nu a fost găsit.");
}

// Rută test
app.get('/', (req, res) => {
    res.send('Serverul TripPlanner rulează corect!');
});

// 🌟 PASUL 1 DIN TASK: Global Error Handler Middleware
// OBLIGATORIU: Trebuie montat DUPA toate rutele și să aibă exact 4 parametri (err, req, res, next)
app.use((err, req, res, next) => {
    // Loghează eroarea în consolă pentru debug
    console.error("❌ [Global Server Error]:", err.stack || err.message || err);

    // Returnează cod HTTP 500 cu un mesaj generic, FĂRĂ a expune stack trace-ul intern
    res.status(500).json({
        error: "A apărut o eroare internă de server. Vă rugăm să încercați mai târziu."
    });
});

// Pornire server
app.listen(PORT, () => {
    console.log(`Serverul rulează pe http://localhost:${PORT}`);
    console.log(`Documentația Swagger la http://localhost:${PORT}/api-docs`);
});