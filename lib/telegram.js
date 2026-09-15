// ฟังก์ชันช่วยประกอบข้อความและส่งแจ้งเตือน Telegram
// ออกแบบให้ "ไม่มีวัน throw" เพื่อไม่ให้กระทบ flow การขาย

export const LOW_STOCK_THRESHOLD = 5; // เกณฑ์เตือนสต๊อกใกล้หมด

// escape อักขระพิเศษของ HTML ป้องกันชื่อสินค้าที่มี < > & ทำให้ Telegram ตีความผิด
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatThaiDateTime(date) {
  return new Date(date).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// ข้อความ: แจ้งเตือนรายการขายใหม่
export function buildNewOrderMessage({ productName, quantity, totalPrice, stockAfter, soldAt }) {
  return [
    '🛍️ <b>มีรายการขายใหม่!</b>',
    `• สินค้า: ${escapeHtml(productName)}`,
    `• จำนวน: ${quantity} ชิ้น`,
    `• ราคารวม: ${Number(totalPrice).toFixed(2)} บาท`,
    `• สต๊อกคงเหลือปัจจุบัน: ${stockAfter} ชิ้น`,
    `• เวลา: ${formatThaiDateTime(soldAt)}`,
  ].join('\n');
}

// ข้อความ: เตือนภัยสต๊อกใกล้หมด
export function buildLowStockMessage({ productName, stockAfter }) {
  return [
    '🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>',
    `• สินค้า: ${escapeHtml(productName)}`,
    `• คงเหลือเพียง: ${stockAfter} ชิ้น`,
    '⚠️ กรุณาเติมสต๊อกสินค้าด่วน!',
  ].join('\n');
}

// ข้อความ: สรุปยอดบิล (ใช้เมื่อขายหลายรายการในบิลเดียว)
export function buildBillSummaryMessage({ itemCount, totalQuantity, grandTotal, soldAt }) {
  return [
    '🧾 <b>สรุปบิลการขาย</b>',
    `• จำนวนรายการ: ${itemCount} รายการ (${totalQuantity} ชิ้น)`,
    `• ยอดรวมทั้งบิล: <b>${Number(grandTotal).toFixed(2)} บาท</b>`,
    `• เวลา: ${formatThaiDateTime(soldAt)}`,
  ].join('\n');
}

/**
 * ส่งข้อความเข้า Telegram ผ่าน API Route ฝั่ง Server
 * คืนค่า { ok: boolean } เสมอ และจะไม่ throw ไม่ว่ากรณีใด
 */
export async function sendTelegramMessages(messages) {
  try {
    if (!messages || messages.length === 0) return { ok: false };

    const res = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: Boolean(json?.ok) };
  } catch (error) {
    console.error('Telegram notification failed:', error);
    return { ok: false };
  }
}
