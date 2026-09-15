'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  LOW_STOCK_THRESHOLD,
  buildNewOrderMessage,
  buildLowStockMessage,
  buildBillSummaryMessage,
  sendTelegramMessages,
} from '../../lib/telegram';

export default function SellPage() {
  // รายการสินค้าทั้งหมด (สำหรับ dropdown)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ตะกร้าสินค้าที่กำลังจะขาย: [{ productId, sku, name, price, unit, stock, quantity }]
  const [cart, setCart] = useState([]);

  // ฟอร์มสำหรับเพิ่มสินค้าเข้าตะกร้า
  const [pickedProductId, setPickedProductId] = useState('');
  const [pickedQuantity, setPickedQuantity] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [notifyMsg, setNotifyMsg] = useState(''); // สถานะการแจ้งเตือน Telegram
  const [submitting, setSubmitting] = useState(false);

  // โหลดรายการสินค้าจาก Supabase
  const fetchProducts = async () => {
    setLoading(true);
    setErrorMsg('');
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      setErrorMsg('โหลดข้อมูลสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const pickedProduct = products.find((p) => p.id === pickedProductId);

  // จำนวนที่ถูกใส่ในตะกร้าไปแล้วของสินค้านี้ (ไว้เช็ค stock ซ้ำ)
  const qtyAlreadyInCart = (productId) =>
    cart
      .filter((item) => item.productId === productId)
      .reduce((sum, item) => sum + item.quantity, 0);

  // เพิ่มสินค้าเข้าตะกร้า
  const handleAddToCart = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setNotifyMsg('');

    if (!pickedProductId) {
      setErrorMsg('กรุณาเลือกสินค้า');
      return;
    }
    const qty = Number(pickedQuantity);
    if (!pickedQuantity || qty <= 0) {
      setErrorMsg('กรุณากรอกจำนวนที่ถูกต้อง');
      return;
    }
    if (!pickedProduct) {
      setErrorMsg('ไม่พบข้อมูลสินค้าที่เลือก');
      return;
    }

    // ตรวจสอบ stock โดยนับรวมจำนวนที่มีอยู่ในตะกร้าแล้วด้วย
    const alreadyInCart = qtyAlreadyInCart(pickedProduct.id);
    if (alreadyInCart + qty > pickedProduct.stock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่เพียงพอ (คงเหลือ ${pickedProduct.stock} ${pickedProduct.unit}, อยู่ในตะกร้าแล้ว ${alreadyInCart})`
      );
      return;
    }

    // ถ้าสินค้านี้อยู่ในตะกร้าแล้ว ให้รวมจำนวนกันแทนที่จะเพิ่มแถวใหม่
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === pickedProduct.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + qty,
        };
        return updated;
      }
      return [
        ...prev,
        {
          productId: pickedProduct.id,
          sku: pickedProduct.sku,
          name: pickedProduct.name,
          price: pickedProduct.price,
          unit: pickedProduct.unit,
          stock: pickedProduct.stock,
          quantity: qty,
        },
      ];
    });

    setPickedProductId('');
    setPickedQuantity('');
  };

  // ลบสินค้าออกจากตะกร้า
  const handleRemoveFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // แก้จำนวนสินค้าในตะกร้าโดยตรง
  const handleCartQuantityChange = (productId, newQty) => {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity: newQty === '' ? '' : Number(newQty) }
          : item
      )
    );
  };

  // ยอดรวมทั้งบิล
  const grandTotal = cart.reduce(
    (sum, item) => sum + item.price * (Number(item.quantity) || 0),
    0
  );
  const totalItemsCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const resetCart = () => {
    setCart([]);
    setPickedProductId('');
    setPickedQuantity('');
  };

  // ยืนยันการขายทั้งบิล (หลายสินค้าในครั้งเดียว)
  const handleCheckout = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setNotifyMsg('');

    if (cart.length === 0) {
      setErrorMsg('ยังไม่มีสินค้าในตะกร้า');
      return;
    }
    for (const item of cart) {
      const qty = Number(item.quantity);
      if (!qty || qty <= 0) {
        setErrorMsg(`กรุณากรอกจำนวนของ "${item.name}" ให้ถูกต้อง`);
        return;
      }
      if (qty > item.stock) {
        setErrorMsg(`"${item.name}" คงเหลือไม่เพียงพอ (คงเหลือ ${item.stock} ${item.unit})`);
        return;
      }
    }

    setSubmitting(true);
    const soldAt = new Date().toISOString();

    // 1) บันทึกทุกรายการลงตาราง sales ในครั้งเดียว
    const saleRows = cart.map((item) => ({
      product_id: item.productId,
      product_name: item.name,
      quantity: Number(item.quantity),
      total_price: item.price * Number(item.quantity),
      sold_at: soldAt,
    }));

    const { error: saleError } = await supabase.from('sales').insert(saleRows);

    if (saleError) {
      setErrorMsg('บันทึกการขายไม่สำเร็จ: ' + saleError.message);
      setSubmitting(false);
      return;
    }

    // 2) อัปเดต stock ของสินค้าแต่ละรายการ + เก็บสต๊อกหลังตัดไว้ใช้แจ้งเตือน
    const soldSummary = cart.map((item) => ({
      productName: item.name,
      quantity: Number(item.quantity),
      totalPrice: item.price * Number(item.quantity),
      stockAfter: item.stock - Number(item.quantity),
    }));

    const updateResults = await Promise.all(
      cart.map((item) =>
        supabase
          .from('products')
          .update({ stock: item.stock - Number(item.quantity) })
          .eq('id', item.productId)
      )
    );
    const updateError = updateResults.find((r) => r.error)?.error;

    if (updateError) {
      setErrorMsg('ขายสำเร็จ แต่ปรับปรุงจำนวนคงเหลือบางรายการไม่สำเร็จ: ' + updateError.message);
      setSubmitting(false);
      return;
    }

    // ==== ขายสำเร็จแล้ว: แสดงผลในเว็บก่อนเสมอ ====
    setSuccessMsg(
      `ขายสำเร็จ ${cart.length} รายการ (${totalItemsCount} ชิ้น) ยอดรวม ${grandTotal.toFixed(2)} บาท`
    );

    // ==== 3) แจ้งเตือน Telegram (ไม่กระทบระบบขายหากล้มเหลว) ====
    // ประกอบข้อความทั้งหมด: New Order ต่อรายการ + Low Stock ถ้าเหลือ <= 5
    const messages = [];
    for (const s of soldSummary) {
      messages.push(buildNewOrderMessage({ ...s, soldAt }));
      if (s.stockAfter <= LOW_STOCK_THRESHOLD) {
        messages.push(buildLowStockMessage(s));
      }
    }
    // ถ้าขายหลายรายการในบิลเดียว แนบสรุปยอดรวมท้ายสุด
    if (cart.length > 1) {
      messages.push(
        buildBillSummaryMessage({
          itemCount: cart.length,
          totalQuantity: totalItemsCount,
          grandTotal,
          soldAt,
        })
      );
    }

    // ยิงแบบ async + จับ error ทั้งหมด ไม่ให้ throw ออกมาขัดจังหวะการขาย
    try {
      const result = await sendTelegramMessages(messages);
      setNotifyMsg(
        result.ok
          ? '📨 ส่งแจ้งเตือนเข้า Telegram แล้ว'
          : '⚠️ บันทึกการขายเรียบร้อย แต่ส่งแจ้งเตือน Telegram ไม่สำเร็จ'
      );
    } catch (err) {
      console.error(err);
      setNotifyMsg('⚠️ บันทึกการขายเรียบร้อย แต่ส่งแจ้งเตือน Telegram ไม่สำเร็จ');
    }

    resetCart();
    await fetchProducts();
    setSubmitting(false);
  };

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {/* สรุปยอดรวม - ตัวใหญ่ วางไว้บนสุด */}
      <div
        style={{
          background: '#111827',
          color: '#fff',
          borderRadius: 10,
          padding: '20px 24px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: '0.95rem', color: '#9ca3af' }}>
            {cart.length === 0
              ? 'ยังไม่มีสินค้าในตะกร้า'
              : `${cart.length} รายการ / ${totalItemsCount} ชิ้น`}
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, lineHeight: 1.2 }}>
            {grandTotal.toFixed(2)} <span style={{ fontSize: '1.2rem', fontWeight: 500 }}>บาท</span>
          </div>
        </div>
        <button
          onClick={handleCheckout}
          disabled={submitting || cart.length === 0}
          style={{ fontSize: '1.1rem', padding: '14px 28px' }}
        >
          {submitting ? 'กำลังบันทึก...' : 'ยืนยันการขาย'}
        </button>
      </div>

      {errorMsg && <p className="error-text">{errorMsg}</p>}
      {successMsg && <p className="success-text">{successMsg}</p>}
      {notifyMsg && <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>{notifyMsg}</p>}

      {loading ? (
        <p>กำลังโหลดข้อมูลสินค้า...</p>
      ) : (
        <>
          {/* ฟอร์มเลือกสินค้าเพิ่มเข้าตะกร้า */}
          <form onSubmit={handleAddToCart}>
            <h2 style={{ marginTop: 0 }}>เพิ่มสินค้า</h2>
            <div className="form-row">
              <label>
                เลือกสินค้า
                <select
                  value={pickedProductId}
                  onChange={(e) => setPickedProductId(e.target.value)}
                >
                  <option value="">-- เลือกสินค้า --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({Number(p.price).toFixed(2)} บาท / {p.unit}) - คงเหลือ {p.stock}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                จำนวน
                <input
                  type="number"
                  min="1"
                  value={pickedQuantity}
                  onChange={(e) => setPickedQuantity(e.target.value)}
                  placeholder="0"
                />
              </label>
            </div>
            <button type="submit">+ เพิ่มลงตะกร้า</button>
          </form>

          {/* ตารางตะกร้าสินค้า */}
          <h2>รายการที่จะขาย</h2>
          {cart.length === 0 ? (
            <p>ยังไม่มีสินค้าในตะกร้า เลือกสินค้าด้านบนเพื่อเพิ่ม</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>สินค้า</th>
                  <th>ราคา/หน่วย</th>
                  <th>จำนวน</th>
                  <th>รวม</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => {
                  const stockAfter = item.stock - (Number(item.quantity) || 0);
                  return (
                    <tr key={item.productId}>
                      <td>
                        {item.name}
                        {/* เตือนล่วงหน้าในหน้าเว็บว่าขายแล้วสต๊อกจะเหลือน้อย */}
                        {stockAfter <= LOW_STOCK_THRESHOLD && (
                          <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>
                            {' '}⚠️ เหลือ {stockAfter}
                          </span>
                        )}
                      </td>
                      <td>
                        {Number(item.price).toFixed(2)} / {item.unit}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          max={item.stock}
                          value={item.quantity}
                          onChange={(e) =>
                            handleCartQuantityChange(item.productId, e.target.value)
                          }
                          style={{ width: 70 }}
                        />
                      </td>
                      <td>
                        <strong>
                          {(item.price * (Number(item.quantity) || 0)).toFixed(2)}
                        </strong>
                      </td>
                      <td>
                        <button onClick={() => handleRemoveFromCart(item.productId)}>
                          ลบ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
