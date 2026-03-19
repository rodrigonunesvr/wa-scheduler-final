
export async function sendWhatsAppMessage(phone, message) {
    const baseUrl = process.env.EVOLUTION_API_BASE_URL; // e.g., http://localhost:8080
    const instanceName = process.env.EVOLUTION_API_INSTANCE; // e.g., Clara
    const apikey = process.env.EVOLUTION_API_KEY;

    console.log(`[lib/evolution] Attempting to send to ${phone}. BaseURL: ${baseUrl}, Instance: ${instanceName}`);

    if (!baseUrl || !instanceName || !apikey) {
        console.error('Missing Evolution API Credentials');
        return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const url = `${baseUrl}/message/sendText/${instanceName}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apikey
            },
            body: JSON.stringify({
                number: cleanPhone,
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
        const responseData = await response.json();
        console.log(`[lib/evolution] Message successfully sent to ${cleanPhone}:`, responseData);
        return responseData;
    } catch (error) {
        console.error('Fetch Error:', error);
        return { error: true, message: error.message };
    }
}

/**
 * Sends a WhatsApp message with interactive buttons (Evolution API v2)
 */
export async function sendWhatsAppButtons(phone, title, description, buttons) {
    const baseUrl = process.env.EVOLUTION_API_BASE_URL;
    const instanceName = process.env.EVOLUTION_API_INSTANCE;
    const apikey = process.env.EVOLUTION_API_KEY;

    if (!baseUrl || !instanceName || !apikey) return { error: 'Missing credentials' };

    const cleanPhone = phone.replace(/\D/g, '');
    const url = `${baseUrl}/message/sendButtons/${instanceName}`;

    const payload = {
        number: cleanPhone,
        title: title,
        description: description,
        footer: "AgendaÍ",
        buttons: buttons.map(b => ({
            buttonId: b.id,
            buttonText: { displayText: b.label },
            type: 1
        }))
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apikey },
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        console.error('Evolution Buttons Error:', error);
        return { error: true, message: error.message };
    }
}
