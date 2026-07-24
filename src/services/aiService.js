// Cale salvare: server/src/services/aiService.js

export const generateItinerary = async (tripData, lang) => {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    // 1. Calculăm dinamic numărul exact de zile
    let daysCount = tripData.days_count || tripData.daysCount;

    if (!daysCount && tripData.start_date && tripData.end_date) {
        const sDate = new Date(tripData.start_date);
        const eDate = new Date(tripData.end_date);
        if (!isNaN(sDate) && !isNaN(eDate)) {
            const diffTime = Math.abs(eDate - sDate);
            daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }
    }

    if (!daysCount || daysCount <= 0) {
        daysCount = 3;
    }

    // 2. Măsură de siguranță: Dacă nu există API Key valid, folosim modul Fallback garantat
    if (!GROQ_API_KEY) {
        console.warn("⚠️ GROQ_API_KEY lipsă în .env! Se generează itinerariul offline.");
        return createFallbackItinerary(tripData.destination, daysCount, lang);
    }

    const appContext = `
    Numele aplicației: TripPlanner.
    Funcționalitate: Aplicație inteligentă de planificare a vacanțelor.
    Dacă utilizatorul are nevoie de asistență, recomandă-i să trimită un email la contact@travelplanner.ro.`;

    const prompt = `
    ${appContext}
    Ești ghidul turistic expert al TripPlanner. Creează un itinerariu complet de EXACT ${daysCount} zile pentru: ${tripData.destination || 'Destinație'}.
    Preferințe utilizator: ${typeof tripData.preferences === 'object' ? JSON.stringify(tripData.preferences) : (tripData.preferences || 'Nespecificat')}.
    Limba de răspuns obligatorie: ${lang === 'ro' ? 'română' : 'engleză'}.

    INSTRUCȚIUNE STRICTĂ: Trebuie să generezi un obiect JSON cu un array "days" de EXACT ${daysCount} elemente.
    Returnează răspunsul DOAR în format JSON cu cheile:
    { 
      "days": [
        { "day_number": 1, "morning": "...", "afternoon": "...", "evening": "...", "tips": "..." }
      ] 
    }`;

    try {
        // Folosim fetch nativ din Node.js (fără 'node-fetch')
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("⚠️ Groq API Error:", data.error.message);
            return createFallbackItinerary(tripData.destination, daysCount, lang);
        }

        const parsedContent = JSON.parse(data.choices[0].message.content);
        return parsedContent;

    } catch (err) {
        console.error("❌ Eroare la procesarea cererii AI (Se aplică Fallback):", err.message);
        return createFallbackItinerary(tripData.destination, daysCount, lang);
    }
};

// Generare plan de rezervă (previne erorile 500)
function createFallbackItinerary(destination, daysCount, lang) {
    const days = [];
    const destName = destination || 'Destinație';

    for (let i = 1; i <= daysCount; i++) {
        days.push({
            day_number: i,
            dayNumber: i,
            morning: lang === 'ro' ? `Explorează atracțiile principale din ${destName} (Dimineața)` : `Explore main attractions in ${destName} (Morning)`,
            afternoon: lang === 'ro' ? `Vizitează centrul istoric și bucură-te de un prânz local` : `Visit historical center and enjoy local lunch`,
            evening: lang === 'ro' ? `Cină relaxantă și plimbare de seară` : `Relaxing dinner and evening walk`,
            tips: lang === 'ro' ? `Sfat Ziua ${i}: Verifică programul muzeelor din zonă.` : `Tip Day ${i}: Check local museum schedules.`
        });
    }

    return { days };
}