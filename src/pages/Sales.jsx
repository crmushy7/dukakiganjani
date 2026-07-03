import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';

import './Sales.css';


const Sales = () => {
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [saleItems, setSaleItems] = useState([{ itemName: '', quantity: '', price: '' }]);
  const [paymentType, setPaymentType] = useState('cash');
  const [customerName, setCustomerName] = useState('');
  const [note, setNote] = useState('');
  const [removingId, setRemovingId] = useState(null);
  const [addingId, setAddingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemNameSuggestions, setItemNameSuggestions] = useState({});

  useEffect(() => {
    fetchSales();
    fetchPurchases();
  }, []);

  const fetchSales = async () => {
    const querySnapshot = await getDocs(collection(db, 'sales'));
    const salesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setSales(salesList);
  };
  const fetchPurchases = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'items'));

    console.log("Documents found:", querySnapshot.size);

    const purchaseList = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log("Purchase List:", purchaseList);

    setPurchases(purchaseList);
  } catch (error) {
    console.error("Error fetching items:", error);
  }
};

//   const fetchPurchases = async () => {
//   const querySnapshot = await getDocs(collection(db, 'items'));

//   const purchaseList = querySnapshot.docs.map(doc => ({
//     id: doc.id,
//     ...doc.data()
//   }));

//   setPurchases(purchaseList);
// };

  const handleItemInput = (value, index) => {
    console.log("Purchases state:", purchases);
  const updatedItems = [...saleItems];
  updatedItems[index].itemName = value;
  setSaleItems(updatedItems);

  if (!value) {
    setItemNameSuggestions(prev => ({
      ...prev,
      [index]: []
    }));
    return;
  }

  const filtered = purchases
  .map(p => p.name)
  .filter(name =>
    name?.toLowerCase().includes(value.toLowerCase())
  );

console.log("Filtered:", filtered);

  setItemNameSuggestions(prev => ({
    ...prev,
    [index]: [...new Set(filtered)].slice(0, 6)
  }));
};

  const handleCustomerInput = (value) => {
    setCustomerName(value);

    const customerNames = Array.from(
      new Set(sales.filter(s => s.customerName).map(s => s.customerName))
    );

    setCustomerSuggestions(
      customerNames.filter(name =>
        name.toLowerCase().includes(value.toLowerCase())
      )
    );
  };

  const addItemRow = () => {
    setSaleItems([...saleItems, { itemName: '', quantity: '', price: '' }]);
  };

  const removeItemRow = (index) => {
    const updated = [...saleItems];
    updated.splice(index, 1);
    setSaleItems(updated);
  };

  const handleSubmit = async (print = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const now = new Date();
    const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()} ${now.getHours()}:${now.getMinutes()}Hrs`;

    for (let item of saleItems) {
      if (!item.itemName || !item.quantity || !item.price) {
        alert('Please fill all fields.');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      for (let item of saleItems) {
        const sale = {
          ...item,
          paymentType,
          customerName,
          note,
          date,
          debtType: paymentType === 'credit' ? 'wanaodaiwa' : ''
        };

        const docRef = await addDoc(collection(db, 'sales'), sale);
        const saleId = docRef.id;

        setAddingId(saleId);
        setTimeout(() => setAddingId(null), 400);

        await updateItemCounter(
          item.itemName.toLowerCase().trim(),
          item.quantity
        );

        // Credit handling (Patient debt system)
        if (paymentType === 'credit') {
          const col = 'wanaodaiwa';
          const id = customerName.toLowerCase().replace(/\s+/g, '_');
          const ref = doc(db, col, id);
          const snap = await getDoc(ref);

          const newDebt = {
            description: `Medicine sale: ${item.itemName} (${item.quantity})`,
            amount: Number(item.price),
            date
          };

          if (snap.exists()) {
            const data = snap.data();
            const newTotal = (data.total || 0) + Number(item.price);
            const newBalance = newTotal - (data.paid || 0);

            await updateDoc(ref, {
              total: newTotal,
              balance: newBalance,
              debts: arrayUnion(newDebt)
            });
          } else {
            await setDoc(ref, {
              customerName,
              total: Number(item.price),
              paid: 0,
              balance: Number(item.price),
              debts: [newDebt],
              payments: []
            });
          }
        }
      }

      fetchSales();
      setSaleItems([{ itemName: '', quantity: '', price: '' }]);
      setCustomerName('');
      setNote('');
      setPaymentType('cash');

      if (print) printReceipt();

    } catch (err) {
      console.error(err);
      alert('Error saving sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateItemCounter = async (itemName, quantitySold) => {
    const itemRef = doc(db, 'ItemCounter', itemName);
    const itemSnap = await getDoc(itemRef);

    if (itemSnap.exists()) {
      const current = itemSnap.data().remaining || 0;
      const updated = current - Number(quantitySold);

      await updateDoc(itemRef, {
        itemName,
        remaining: updated < 0 ? 0 : updated
      });
    } else {
      await setDoc(itemRef, {
        itemName,
        remaining: 0
      });
    }
  };

  const handleDelete = async (id) => {
    setRemovingId(id);
    setTimeout(async () => {
      await deleteDoc(doc(db, 'sales', id));
      fetchSales();
      setRemovingId(null);
    }, 400);
  };

  const groupedSales = sales
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .reduce((groups, sale) => {
      const dateOnly = sale.date.split(' ')[0];
      if (!groups[dateOnly]) groups[dateOnly] = [];
      groups[dateOnly].push(sale);
      return groups;
    }, {});

  return (
    <div className="sales">
      <h2 className='sales-title'>💊 Medical Sales Record</h2>

      <div className="form animated-section" style={{ animationDelay: '0.1s' }}>
      {saleItems.map((item, index) => (
        <div
          key={index}
          className={`sale-row animated-section`}
          style={{ animationDelay: `${0.15 + index * 0.05}s` }}
        >
          <input
            type="text"
            placeholder="Jina la Dawa"
            value={item.itemName}
            onChange={(e) => handleItemInput(e.target.value, index)}
          />
          {itemNameSuggestions[index]?.length > 0 && (
            <ul className="suggestion-list animated-section" style={{ animationDelay: '0.2s' }}>
              {itemNameSuggestions[index].map((name, i) => (
                <li
                  key={i}
                  onClick={() => {
                    const updated = [...saleItems];
                    updated[index].itemName = name;
                    setSaleItems(updated);
                    setItemNameSuggestions(prev => ({
                    ...prev,
                    [index]: []
                  }));
                  }}
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
          <input
            type="number"
            placeholder="Idadi ya Dawa"
            value={item.quantity}
            onChange={(e) => {
              const updated = [...saleItems];
              updated[index].quantity = e.target.value;
              setSaleItems(updated);
            }}
          />
          <input
            type="number"
            placeholder="Jumla ya Bei"
            value={item.price}
            onChange={(e) => {
              const updated = [...saleItems];
              updated[index].price = e.target.value;
              setSaleItems(updated);
            }}
          />
          {index > 0 && (
            <button className="delete-button" onClick={() => removeItemRow(index)}>
              -
            </button>
          )}
        </div>
      ))}
      <button className="animated-section" style={{ animationDelay: '0.3s' }} onClick={addItemRow}>
        + Ongeza dawa nyingine
      </button>

      <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
        <option value="cash">Cash</option>
        <option value="credit">Deni</option>
      </select>

      {paymentType === 'credit' && (
        <div className="relative animated-section" style={{ animationDelay: '0.35s' }}>
          <input
            type="text"
            placeholder="Jina la Mteja"
            value={customerName}
            onChange={(e) => handleCustomerInput(e.target.value)}
          />
          
          <input
            type="text"
            placeholder="Maelezo ya Deni (Optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}

      <button className="animated-section" style={{ animationDelay: '0.4s' }} onClick={() => handleSubmit(false)} disabled={isSubmitting}>
        {isSubmitting ? 'Processing...' : 'Hifadhi mauzo'}
      </button>
      {/* <button className="animated-section" style={{ animationDelay: '0.42s' }} onClick={() => handleSubmit(true)} disabled={isSubmitting}>
        {isSubmitting ? 'Processing...' : 'Save and Print'}
      </button> */}
      {customerSuggestions.length > 0 && (
            <ul className="suggestion-list animated-section" style={{ animationDelay: '0.36s' }}>
              {customerSuggestions.map((name, i) => (
                <li
                  key={i}
                  onClick={() => {
                    setCustomerName(name);
                    setCustomerSuggestions([]);
                  }}
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
    </div>

    <h2 className="animated-section" style={{ animationDelay: '0.45s' }}>Sales Records</h2>
    <div className="sales-list">
      {Object.keys(groupedSales).length === 0 ? (
        <p className="animated-section" style={{ animationDelay: '0.5s' }}>No sales recorded yet.</p>
      ) : (
        Object.entries(groupedSales)
          .sort((a, b) => {
            const [d1, m1, y1] = a[0].split('-').map(Number);
            const [d2, m2, y2] = b[0].split('-').map(Number);
            return new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1);
          })
          .map(([date, salesOnDate], idxDate) => (
            <div
              key={date}
              className="animated-section"
              style={{ animationDelay: `${0.55 + idxDate * 0.05}s`, marginBottom: '20px' }}
            >
              <h3 style={{ color: 'pink' }}>{date}</h3>
              <ul>
                {salesOnDate
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map((s, index) => (
                    <li
                      key={s.id}
                      className={`sale-item${addingId === s.id ? ' adding' : ''}${removingId === s.id ? ' removing' : ''} animated-section`}
                      style={{ animationDelay: `${0.57 + idxDate * 0.05 + index * 0.03}s` }}
                    >
                      <div className="sale-item-details">
                        {index + 1}. {s.itemName.toLowerCase().trim()} - {s.quantity} pcs Total Tsh {s.price} ({s.paymentType}) on {s.date}
                        {s.paymentType === 'credit' && (
                          <div>Customer: {s.customerName}, Note: {s.note}</div>
                        )}
                      </div>
                      <button className="delete-button" onClick={() => handleDelete(s.id)}>Delete</button>
                    </li>
                  ))}
              </ul>
            </div>
          ))
      )}
    </div>
    </div>
  );
};

export default Sales;