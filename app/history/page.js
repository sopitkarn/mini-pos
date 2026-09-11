'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function HistoryPage() {
  // รายการประวัติการขายทั้งหมด
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // โหลดข้อมูลจากตาราง sales เรียงจากล่าสุดไปเก่าสุด
  const fetchSales = async () => {
    setLoading(true);
    setErrorMsg('');
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('sold_at', { ascending: false });

    if (error) {
      setErrorMsg('โหลดประวัติการขายไม่สำเร็จ: ' + error.message);
    } else {
      setSales(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSales();
  }, []);

  // คำนวณยอดขายรวมทั้งหมด (sum ของ total_price)
  const totalSalesAmount = sales.reduce(
    (sum, s) => sum + Number(s.total_price || 0),
    0
  );

  // จัดรูปแบบวันเวลาให้อ่านง่าย
  const formatDateTime = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div>
      <h1>ประวัติการขาย</h1>

      {errorMsg && <p className="error-text">{errorMsg}</p>}

      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <>
          {/* ยอดขายรวมทั้งหมด */}
          <p>
            <strong>ยอดขายรวมทั้งหมด: {totalSalesAmount.toFixed(2)} บาท</strong>
            {' '}(จำนวน {sales.length} รายการ)
          </p>

          {sales.length === 0 ? (
            <p>ยังไม่มีประวัติการขาย</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>วันเวลาที่ขาย</th>
                  <th>ชื่อสินค้า</th>
                  <th>จำนวน</th>
                  <th>ยอดรวม</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td>{formatDateTime(s.sold_at)}</td>
                    <td>{s.product_name}</td>
                    <td>{s.quantity}</td>
                    <td>{Number(s.total_price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
