
export async function sendWhatsAppMessage(phone, message) {
    const baseUrl = process.env.EVOLUTION_API_BASE_URL; // e.g., http://localhost:8080
    const instanceName = process.env.EVOLUTION_API_INSTANCE; // e.g., Clara
    const apikey = process.env.EVOLUTION_API_KEY;

    if (!baseUrl || !instanceName || !apikey) {
        console.error('Missing Evolution API Credentials');
        return;
    }

    const url = `${baseUrl}/message/sendText/${instanceName}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apikey
            },
            body: JSON.stringify({
                number: phone,
                text: message,
                delay: 1200,
                linkPreview: false
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Evolution API Error:', errorData);
            return { error: true, data: errorData };
        }
        return await response.json();
    } catch (error) {
        console.error('Fetch Error:', error);
        return { error: true, message: error.message };
    }
}
