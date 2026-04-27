// New Debts.js with saving blur overlay and upgraded success popup
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import './Debts.css';

const Debts = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentInput, setPaymentInput] = useState({ amount: '', note: '', confirmedBy: '' });
  const [debtInput, setDebtInput] = useState({ name: '', description: '', amount: '', type: 'wanaodaiwa' });
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showDebtDialog, setShowDebtDialog] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchAllDebts();
  }, []);

  const fetchAllDebts = async () => {
    const wanaodaiwaSnap = await getDocs(collection(db, 'wanaodaiwa'));
    const wanaonidaiSnap = await getDocs(collection(db, 'wanaonidai'));
    const all = [];

    wanaodaiwaSnap.forEach(docSnap => {
      all.push({ id: docSnap.id, ...docSnap.data(), type: 'wanaodaiwa' });
    });
    wanaonidaiSnap.forEach(docSnap => {
      all.push({ id: docSnap.id, ...docSnap.data(), type: 'wanaonidai' });
    });

    setCustomers(all);
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setShowSuccessPopup(true);
    setTimeout(() => setShowSuccessPopup(false), 1500);
  };

  const handleAddDebt = async () => {
    if (isSaving) return;
    setIsSaving(true);

    const { name, description, amount, type } = debtInput;
    if (!name || !description || !amount) { 
      alert('Fill all fields'); 
      setIsSaving(false);
      return; 
    }

    const now = new Date();
    const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()} ${now.getHours()}:${now.getMinutes()}Hrs`;
    const col = type;
    const id = name.toLowerCase().replace(/\s+/g, '_');
    const ref = doc(db, col, id);
    const snap = await getDoc(ref);
    const newDebt = { description, amount: Number(amount), date };

    if (snap.exists()) {
      const data = snap.data();
      const newTotal = (data.total || 0) + Number(amount);
      const newBalance = newTotal - (data.paid || 0);
      await updateDoc(ref, {
        total: newTotal,
        balance: newBalance,
        debts: arrayUnion(newDebt)
      });
    } else {
      await setDoc(ref, {
        customerName: name,
        total: Number(amount),
        paid: 0,
        balance: Number(amount),
        debts: [newDebt],
        payments: []
      });
    }
    setShowDebtDialog(false);
    fetchAllDebts();
    setIsSaving(false);
    showSuccess('Debt saved successfully!');
  };

  const handleOpenDebtDialog = (type, customerName = '') => {
    setDebtInput({
      name: customerName,
      description: '',
      amount: '',
      type,
    });
    setSelectedCustomer(customerName || null);
    setShowDebtDialog(true);
    setShowAddOptions(false);
  };

  const handleAddPayment = async () => {
    if (isSaving) return;
    setIsSaving(true);

    const col = selectedCustomer.type;
    const ref = doc(db, col, selectedCustomer.id);
    const snap = await getDoc(ref);

    if (!snap.exists()) { 
      alert('Customer not found'); 
      setIsSaving(false);
      return; 
    }

    const data = snap.data();
    const now = new Date();
    const datePaid = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()} ${now.getHours()}:${now.getMinutes()}Hrs`;

    const newPaid = (data.paid || 0) + Number(paymentInput.amount);
    const newBalance = (data.total || 0) - newPaid;
    const newPayment = {
      amount: Number(paymentInput.amount),
      note: paymentInput.note,
      confirmedBy: paymentInput.confirmedBy,
      datePaid
    };

    await updateDoc(ref, {
      paid: newPaid,
      balance: newBalance,
      payments: arrayUnion(newPayment)
    });

    setShowPaymentDialog(false);
    fetchAllDebts();
    setIsSaving(false);
    showSuccess('Payment recorded successfully!');
  };

  const filteredCustomers = customers.filter(c =>
    c.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="debts">
      <h1 className="animated-section" style={{ animationDelay: '0s' }}>Madeni</h1>
      <input
        type="text"
        placeholder="Tafuta kwa jina la mteja..."
        className="search-input animated-section"
        style={{ animationDelay: '0.1s' }}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      {['wanaodaiwa', 'wanaonidai'].map((type, idxType) => (
        <section key={type} className="animated-section" style={{ animationDelay: `${0.2 + idxType * 0.1}s` }}>
          <h2>{type === 'wanaodaiwa' ? 'Watu Wanaodaiwa' : 'Wanaodai'}</h2>
          {filteredCustomers.filter(c => c.type === type).length === 0 ? (
            <p>Hakuna taarifa yoyote.</p>
          ) : (
            <div className="cards-container">
              {filteredCustomers.filter(c => c.type === type).map((c, idxCard) => (
                <div
                  className="debt-card animated-section"
                  style={{ animationDelay: `${0.3 + idxType * 0.1 + idxCard * 0.05}s` }}
                  key={c.id}
                >
                  <div className="card-header">
                    <strong>{c.customerName}</strong>
                    <div className="card-buttons">
                      <button
                        className="card-btn pay animated-btn"
                        style={{ animationDelay: `${0.4 + idxType * 0.1 + idxCard * 0.05}s` }}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setPaymentInput({ amount: '', note: '', confirmedBy: '' });
                          setShowPaymentDialog(true);
                        }}
                      >
                        Ongeza Malipo
                      </button>
                      <button
                        className="card-btn debt animated-btn"
                        style={{ animationDelay: `${0.45 + idxType * 0.1 + idxCard * 0.05}s` }}
                        onClick={() => handleOpenDebtDialog(type, c.customerName)}
                      >
                        Ongeza Deni
                      </button>
                    </div>
                  </div>
                  <div className="card-summary">
                    Jumla: <span style={{ color: 'red' }}>Tsh {c.total}</span>,
                    Iliyolipwa: Tsh {c.paid}, <span style={{ color: 'blue' }}>Deni: Tsh {c.balance}</span>
                  </div>
                  <ul className="card-details">
                    {c.debts?.map((d, i) => (
                      <li key={i}>{d.description} - Tsh {d.amount} on {d.date}</li>
                    ))}
                    {c.payments?.map((p, i) => (
                      <li key={i} style={{ color: 'green' }}>
                        Paid Tsh {p.amount} on {p.datePaid}<br/>
                        {p.note && <em>Note: {p.note}</em>}<br/>
                        {p.confirmedBy && <strong>Confirmed by: {p.confirmedBy}</strong>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      {showPaymentDialog && (
        <div className="payment-dialog scale-in">
          <h3>Record Payment for {selectedCustomer.customerName}</h3>
          <input type="number" placeholder="Amount Paid" value={paymentInput.amount} onChange={e => setPaymentInput({ ...paymentInput, amount: e.target.value })} />
          <input type="text" placeholder="Note (optional)" value={paymentInput.note} onChange={e => setPaymentInput({ ...paymentInput, note: e.target.value })} />
          <input type="text" placeholder="Confirmed by" value={paymentInput.confirmedBy} onChange={e => setPaymentInput({ ...paymentInput, confirmedBy: e.target.value })} />
          <div className="dialog-buttons">
            <button className="save-btn" onClick={handleAddPayment} disabled={isSaving}>Save</button>
            <button className="cancel-btn" onClick={() => setShowPaymentDialog(false)} disabled={isSaving}>Cancel</button>
          </div>
        </div>
      )}

      {showDebtDialog && (
        <div className="payment-dialog scale-in">
          <h3>Ongeza deni jipya ({debtInput.type === 'wanaodaiwa' ? 'Wanaodaiwa' : 'Wanaodai'})</h3>
          {!selectedCustomer && (
            <input type="text" placeholder="Jina kamili" value={debtInput.name} onChange={e => setDebtInput({ ...debtInput, name: e.target.value })} />
          )}
          <input type="text" placeholder="Maelezo" value={debtInput.description} onChange={e => setDebtInput({ ...debtInput, description: e.target.value })} />
          <input type="number" placeholder="Kiasi" value={debtInput.amount} onChange={e => setDebtInput({ ...debtInput, amount: e.target.value })} />
          <div className="dialog-buttons">
            <button className="save-btn" onClick={handleAddDebt} disabled={isSaving}>Save</button>
            <button className="cancel-btn" onClick={() => setShowDebtDialog(false)} disabled={isSaving}>Cancel</button>
          </div>
        </div>
      )}

      {showAddOptions && (
        <div className="add-options scale-in">
          <button onClick={() => handleOpenDebtDialog('wanaodaiwa')}>Ongeza kwa Wanaodaiwa</button>
          <button onClick={() => handleOpenDebtDialog('wanaonidai')}>Ongeza kwa Wanaodai</button>
        </div>
      )}

      {isSaving && (
        <div className="saving-overlay">
          <div className="saving-box">
            <div className="loader"></div>
            <p>Saving...</p>
          </div>
        </div>
      )}

      {showSuccessPopup && (
        <div className="success-popup">
          <div className="success-box upgraded">
            <div className="upgraded-check">✓</div>
            <div className="success-text">{successMessage}</div>
          </div>
        </div>
      )}

      <button className="floating-add-btn scale-in" onClick={() => setShowAddOptions(prev => !prev)}>+</button>
    </div>
  );
};

export default Debts;
