import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcodeTerminal from 'qrcode-terminal';
import express from 'express';
import axios from 'axios';

const PORT = process.env.PORT || 3000;

async function startSock () {
  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');
  const sock = makeWASocket({ auth: state });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, qr, lastDisconnect }) => {
    if (qr) {
      console.clear();
      console.log('📱  Scan this QR with WhatsApp:');
      qrcodeTerminal.generate(qr, { small: true });
    }
    if (connection === 'open')  console.log('✅  WhatsApp connected!');
    if (connection === 'close'
        && lastDisconnect?.error?.output?.statusCode !== 401) {
      console.log('🔄  Disconnected – reconnecting…');
      startSock();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    console.log(`[📩] ${sender}: ${text}`);

    try {
      const { data } = await axios.post(
        'https://primary-production-cd26.up.railway.app/webhook/whatsapp-ai',
        { from: sender, message: text }
      );
      await sock.sendMessage(sender, { text: data.reply || '✅ Got it.' });
    } catch (err) {
      console.error('[❌] Webhook error:', err.message);
      await sock.sendMessage(sender, { text: '⚠️ Bot error.' });
    }
  });
}

startSock();

express()
  .get('/', (_, res) => res.send('✅ Baileys bot live'))
  .listen(PORT, () => console.log(`🌐 Express up on ${PORT}`));
