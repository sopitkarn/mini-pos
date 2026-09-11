'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ProductsPage() {
  // รายการสินค้าทั้งหมด
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // ฟอร์มเพิ่มสินค้าใหม่
  const [form, setForm] = useState({
    sku: '',
    name: '',
    price: '',
    stock: '',
    unit: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // สถานะแก้ไขแบบ inline: เก็บ id ของแถวที่กำลังแก้ไข + ข้อมูลที่กำลังแก้
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // โหลดรายการสินค้าจาก Supabase
  const fetchProducts = async () => {
    setLoading(true);
    setErrorMsg('');
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

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

  // จัดการค่าฟอร์มเพิ่มสินค้าใหม่
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // เพิ่มสินค้าใหม่
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!form.sku || !form.name || !form.price || !form.stock || !form.unit) {
      setErrorMsg('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const { error } = await supabase.from('products').insert([
      {
        sku: form.sku,
        name: form.name,
        price: Number(form.price),
        stock: Number(form.stock),
        unit: form.unit,
      },
    ]);

    if (error) {
      setErrorMsg('เพิ่มสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setForm({ sku: '', name: '', price: '', stock: '', unit: '' });
      await fetchProducts();
    }
    setSubmitting(false);
  };

  // ลบสินค้า
  const handleDelete = async (id) => {
    const confirmDelete = window.confirm('ยืนยันการลบสินค้านี้?');
    if (!confirmDelete) return;

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      setErrorMsg('ลบสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      await fetchProducts();
    }
  };

  // เริ่มแก้ไขแถว (inline)
  const startEdit = (product) => {
    setEditingId(product.id);
    setEditForm({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  // บันทึกการแก้ไข
  const saveEdit = async (id) => {
    setErrorMsg('');
    const { error } = await supabase
      .from('products')
      .update({
        sku: editForm.sku,
        name: editForm.name,
        price: Number(editForm.price),
        stock: Number(editForm.stock),
        unit: editForm.unit,
      })
      .eq('id', id);

    if (error) {
      setErrorMsg('แก้ไขสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setEditingId(null);
      setEditForm({});
      await fetchProducts();
    }
  };

  return (
    <div>
      <h1>รายการสินค้า</h1>

      {errorMsg && <p className="error-text">{errorMsg}</p>}

      {/* ฟอร์มเพิ่มสินค้าใหม่ */}
      <form onSubmit={handleAddProduct}>
        <h2 style={{ marginTop: 0 }}>เพิ่มสินค้าใหม่</h2>
        <div className="form-row">
          <label>
            SKU
            <input
              type="text"
              name="sku"
              value={form.sku}
              onChange={handleFormChange}
              placeholder="เช่น P001"
            />
          </label>
          <label>
            ชื่อสินค้า
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleFormChange}
              placeholder="เช่น น้ำดื่ม"
            />
          </label>
          <label>
            ราคา
            <input
              type="number"
              step="0.01"
              name="price"
              value={form.price}
              onChange={handleFormChange}
              placeholder="0.00"
            />
          </label>
          <label>
            คงเหลือ
            <input
              type="number"
              name="stock"
              value={form.stock}
              onChange={handleFormChange}
              placeholder="0"
            />
          </label>
          <label>
            หน่วย
            <input
              type="text"
              name="unit"
              value={form.unit}
              onChange={handleFormChange}
              placeholder="เช่น ขวด, ชิ้น"
            />
          </label>
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? 'กำลังบันทึก...' : 'เพิ่มสินค้า'}
        </button>
      </form>

      {/* ตารางรายการสินค้า */}
      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : products.length === 0 ? (
        <p>ยังไม่มีสินค้าในระบบ</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>ชื่อสินค้า</th>
              <th>ราคา</th>
              <th>คงเหลือ</th>
              <th>หน่วย</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const isEditing = editingId === p.id;
              return (
                <tr key={p.id}>
                  {isEditing ? (
                    <>
                      <td>
                        <input
                          type="text"
                          name="sku"
                          value={editForm.sku}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          name="name"
                          value={editForm.name}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          name="price"
                          value={editForm.price}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          name="stock"
                          value={editForm.stock}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          name="unit"
                          value={editForm.unit}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <button onClick={() => saveEdit(p.id)}>บันทึก</button>{' '}
                        <button onClick={cancelEdit}>ยกเลิก</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{p.sku}</td>
                      <td>{p.name}</td>
                      <td>{Number(p.price).toFixed(2)}</td>
                      <td>{p.stock}</td>
                      <td>{p.unit}</td>
                      <td>
                        <button onClick={() => startEdit(p)}>แก้ไข</button>{' '}
                        <button onClick={() => handleDelete(p.id)}>ลบ</button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
