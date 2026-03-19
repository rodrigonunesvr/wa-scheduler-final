
export async function sendWhatsAppMessage(phone, message) {
    const baseUrl = process.env.EVOLUTION_API_BASE_URL;
    const instanceName = process.env.EVOLUTION_API_INSTANCE;
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

/**
 * Sends a WhatsApp message with interactive buttons (Evolution API v2)
 * @param {string} phone - Recipient phone number
 * @param {string} title - Main text of the message
 * @param {string} description - Description text above buttons
 * @param {Array} buttons - Array of button objects: [{ id: 'sim', label: 'Sim' }, ...]
 */
export async function sendWhatsAppButtons(phone, title, description, buttons) {
    const baseUrl = process.env.EVOLUTION_API_BASE_URL;
    const instanceName = process.env.EVOLUTION_API_INSTANCE;
    const apikey = process.env.EVOLUTION_API_KEY;

    if (!baseUrl || !instanceName || !apikey) return { error: 'Missing credentials' };

    const url = `${baseUrl}/message/sendButtons/${instanceName}`;

    const payload = {
        number: phone,
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
