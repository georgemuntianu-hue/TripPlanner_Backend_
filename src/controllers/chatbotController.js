import fetch from 'node-fetch';

export const handleChat = async (req, res) => {
    try {
        const { message } = req.body;
        const GROQ_API_KEY = process.env.GROQ_API_KEY;

        const systemInstruction = `
        Ești asistentul virtual TripPlanner.
        Informații despre aplicație:
        - Nume: TripPlanner
        - Scop: Planificare automată a vacanțelor cu AI.
        - Funcții: Itinerarii pe zile, salvare de locuri preferate, bugetare.
        - Contact: Pentru orice problemă, trimite utilizatorii la contact@travelplanner.ro.
        - Ton: Prietenos, profesionist, entuziasmat.
        Dacă întrebarea nu are legătură cu călătoriile sau aplicația TripPlanner, orientează discuția politicos către planificarea unei vacanțe.`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: message }
                ]
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("Eroare Groq Chat:", data.error);
            return res.status(500).json({ reply: "Sunt puțin ocupat momentan, încearcă din nou!" });
        }

        const reply = data.choices[0].message.content;
        res.json({ reply });

    } catch (error) {
        console.error("Eroare Chatbot:", error);
        res.status(500).json({ reply: "A apărut o eroare tehnică." });
    }
};