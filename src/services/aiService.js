import fetch from 'node-fetch';

export const generateItinerary = async (tripData, lang) => {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const daysCount = tripData.days_count || 8;

    // Contextul aplicației integrat în prompt
    const appContext = `
    Numele aplicației: TripPlanner.
    Funcționalitate: Aplicație inteligentă de planificare a vacanțelor.
    Utilizatorul poate genera itinerarii pe zile, salva locații preferate și personaliza vacanța în funcție de buget și preferințe.
    Dacă utilizatorul are nevoie de asistență, recomandă-i să trimită un email la contact@travelplanner.ro.`;

    const prompt = `
    ${appContext}
    Ești ghidul turistic expert al TripPlanner. Creează un itinerariu complet de ${daysCount} zile pentru: ${tripData.destination}.
    Preferințe utilizator: ${tripData.preferences || 'Nespecificat'}.
    Limba de răspuns obligatorie: ${lang === 'ro' ? 'română' : 'engleză'}.

    INSTRUCȚIUNE STRICTĂ: Generează un itinerariu detaliat pentru TOATE cele ${daysCount} zile. Nu sări nicio zi.
    Returnează răspunsul DOAR în format JSON, cu structura: 
    { 
      "days": [
        { "dayNumber": 1, "morning": "...", "afternoon": "...", "evening": "...", "tips": "..." },
        ... (până la ziua ${daysCount})
      ] 
    }`;

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
    if (data.error) throw new Error(`Eroare Groq: ${data.error.message}`);

    return JSON.parse(data.choices[0].message.content);
};