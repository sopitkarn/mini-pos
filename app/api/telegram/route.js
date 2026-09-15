// API Route ฝั่ง Server สำหรับยิงข้อความเข้า Telegram
// เก็บ Bot Token ไว้ฝั่งเซิร์ฟเวอร์ ไม่หลุดไปยังเบราว์เซอร์
export async function POST(request) {
  const TELEGRAM_BOT_TOKEN =
    process.env.TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID =
    process.env.TELEGRAM_CHAT_ID || process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

  try {
    // ยังไม่ได้ตั้งค่า env → ไม่ถือเป็น error ร้ายแรง แค่ข้ามการแจ้งเตือน
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return Response.json(
        { ok: false, skipped: true, reason: 'Telegram config not set' },
        { status: 200 }
      );
    }

    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (messages.length === 0) {
      return Response.json({ ok: false, reason: 'No messages' }, { status: 400 });
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    // ส่งทีละข้อความตามลำดับ เพื่อให้ข้อความเรียงถูกต้องใน Channel
    const results = [];
    for (const text of messages) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: text,
          parse_mode: 'HTML',
        }),
      });
      const json = await res.json().catch(() => ({}));
      results.push({ ok: res.ok, description: json?.description });
    }

    return Response.json({ ok: true, results }, { status: 200 });
  } catch (error) {
    // ไม่โยน error ออกไป เพื่อไม่ให้กระทบระบบขาย
    return Response.json({ ok: false, error: String(error) }, { status: 200 });
  }
}
