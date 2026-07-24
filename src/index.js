import 'dotenv/config'; // Încarcă variabilele de mediu
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

// Middleware-uri esențiale (Permite conexiuni din orice origine pentru rețeaua locală/mobil)
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());

// Montăm routerele (o singură dată, ordonate)
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/chat', chatRoutes);

// 🌟 RUTA NOUĂ: Prinde mesajele trimise din bara de jos (Footer)
app.post('/api/contact', (req, res) => {
    const { email, message } = req.body;

    console.log(`📩 [Contact Message Received] De la: ${email} | Mesaj: ${message}`);

    // Răspunde cu succes către client
    res.status(200).json({
        success: true,
        message: 'Mesajul a fost recepționat cu succes!'
    });
});

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

// 🌟 Global Error Handler Middleware
// OBLIGATORIU: Trebuie montat DUPĂ toate rutele și să aibă exact 4 parametri
app.use((err, req, res, next) => {
    // Loghează eroarea în consolă pentru debug
    console.error("❌ [Global Server Error]:", err.stack || err.message || err);

    // Returnează cod HTTP 500 cu un mesaj generic, FĂRĂ a expune stack trace-ul intern
    res.status(500).json({
        error: "A apărut o eroare internă de server. Vă rugăm să încercați mai târziu."
    });
});

// Pornire server pe host-ul universal 0.0.0.0 (accesibil din rețeaua locală / mobil)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serverul rulează pe portul ${PORT} (0.0.0.0:${PORT})`);
    console.log(`📖 Documentația Swagger la http://localhost:${PORT}/api-docs`);
});