'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SellPage() {
  // รายการสินค้าทั้งหมด (สำหรับ dropdown)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // สินค้าที่เลือก + จำนวนที่จะขาย
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
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

  // หาข้อมูลสินค้าที่เลือกอยู่ในปัจจุบัน
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // คำนวณยอดรวมอัตโนมัติ (ราคา x จำนวน)
  const qtyNumber = Number(quantity) || 0;
  const totalPrice = selectedProduct ? selectedProduct.price * qtyNumber : 0;

  const resetForm = () => {
    setSelectedProductId('');
    setQuantity('');
  };

  // ยืนยันการขาย
  const handleSell = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // ตรวจสอบข้อมูลเบื้องต้น
    if (!selectedProductId) {
      setErrorMsg('กรุณาเลือกสินค้า');
      return;
    }
    if (!quantity || qtyNumber <= 0) {
      setErrorMsg('กรุณากรอกจำนวนที่ถูกต้อง');
      return;
    }
    if (!selectedProduct) {
      setErrorMsg('ไม่พบข้อมูลสินค้าที่เลือก');
      return;
    }

    // ตรวจสอบว่า stock เพียงพอหรือไม่
    if (qtyNumber > selectedProduct.stock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่เพียงพอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit})`
      );
      return;
    }

    setSubmitting(true);

    // 1) บันทึกรายการลงตาราง sales
    const { error: saleError } = await supabase.from('sales').insert([
      {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: qtyNumber,
        total_price: totalPrice,
        sold_at: new Date().toISOString(),
      },
    ]);

    if (saleError) {
      setErrorMsg('บันทึกการขายไม่สำเร็จ: ' + saleError.message);
      setSubmitting(false);
      return;
    }

    // 2) อัปเดต stock ในตาราง products ให้ลดลงตามจำนวนที่ขาย
    const newStock = selectedProduct.stock - qtyNumber;
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', selectedProduct.id);

    if (updateError) {
      setErrorMsg('ขายสำเร็จ แต่ปรับปรุงจำนวนคงเหลือไม่สำเร็จ: ' + updateError.message);
      setSubmitting(false);
      return;
    }

    // สำเร็จ: แจ้งเตือน รีเซ็ตฟอร์ม และโหลดรายการสินค้าใหม่ (stock ล่าสุด)
    setSuccessMsg(
      `ขาย "${selectedProduct.name}" จำนวน ${qtyNumber} ${selectedProduct.unit} สำเร็จ ยอดรวม ${totalPrice.toFixed(2)} บาท`
    );
    resetForm();
    await fetchProducts();
    setSubmitting(false);
  };

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {errorMsg && <p className="error-text">{errorMsg}</p>}
      {successMsg && <p className="success-text">{successMsg}</p>}

      {loading ? (
        <p>กำลังโหลดข้อมูลสินค้า...</p>
      ) : (
        <form onSubmit={handleSell}>
          <div className="form-row">
            <label>
              เลือกสินค้า
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
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
              จำนวนที่ขาย
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>

          {/* แสดงยอดรวมอัตโนมัติ */}
          {selectedProduct && (
            <p>
              ราคาต่อหน่วย: {Number(selectedProduct.price).toFixed(2)} บาท / {selectedProduct.unit}
              <br />
              <strong>ยอดรวม: {totalPrice.toFixed(2)} บาท</strong>
            </p>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? 'กำลังบันทึก...' : 'ขาย'}
          </button>
        </form>
      )}
    </div>
  );
}
