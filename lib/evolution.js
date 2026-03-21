
export async function sendWhatsAppMessage(phone, message) {
    const baseUrl = process.env.EVOLUTION_API_BASE_URL;
    const instanceName = process.env.EVOLUTION_API_INSTANCE;
    const apikey = process.env.EVOLUTION_API_KEY;

    console.log(`[evolution] sendText → ${phone}. URL: ${baseUrl}, Instance: ${instanceName}`);

    if (!baseUrl || !instanceName || !apikey) {
        console.error('[evolution] Missing credentials!');
        return { error: 'Missing credentials' };
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const url = `${baseUrl}/message/sendText/${instanceName}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apikey },
            body: JSON.stringify({ number: cleanPhone, text: message, delay: 1200, linkPreview: false })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('[evolution] sendText error:', data);
            return { error: true, data };
        }
        console.log('[evolution] sendText OK:', cleanPhone);
        return data;
    } catch (err) {
        console.error('[evolution] sendText fetch error:', err);
        return { error: true, message: err.message };
    }
}

/**
 * Sends interactive buttons via Evolution API.
 * Falls back to plain text message if buttons fail (e.g., unsupported by WhatsApp version).
 */
export async function sendWhatsAppButtons(phone, title, description, buttons) {
    const baseUrl = process.env.EVOLUTION_API_BASE_URL;
    const instanceName = process.env.EVOLUTION_API_INSTANCE;
    const apikey = process.env.EVOLUTION_API_KEY;

    if (!baseUrl || !instanceName || !apikey) {
        console.error('[evolution] Missing credentials for sendButtons!');
        return { error: 'Missing credentials' };
    }

    const cleanPhone = phone.replace(/\D/g, '');
    console.log(`[evolution] sendButtons → ${cleanPhone}`);

    // --- Attempt 1: Native Interactive Buttons (Evolution API v2 format) ---
    const url = `${baseUrl}/message/sendButtons/${instanceName}`;
    const payload = {
        number: cleanPhone,
        title: title,
        description: description,
        footer: 'Espaço C.A.',
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

        const data = await response.json();

        if (response.ok && !data.error) {
            console.log('[evolution] sendButtons OK (native):', cleanPhone);
            return data;
        }

        // --- Attempt 2: Fallback to bold text message if native buttons fail ---
        console.warn('[evolution] Native buttons failed, falling back to text. Error:', JSON.stringify(data));
        const fallbackLines = [
            `*${title}*`,
            '',
            description,
            '',
            ...buttons.map((b, i) => `${i + 1}️⃣ *${b.label}*`)
        ];
        return await sendWhatsAppMessage(cleanPhone, fallbackLines.join('\n'));

    } catch (err) {
        console.error('[evolution] sendButtons error:', err);
        // Fallback on network error too
        const fallbackLines = [
            `*${title}*`,
            '',
            description,
            '',
            ...buttons.map((b, i) => `${i + 1}️⃣ *${b.label}*`)
        ];
        return await sendWhatsAppMessage(cleanPhone, fallbackLines.join('\n'));
    }
}
