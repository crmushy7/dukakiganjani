import React, { useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import './Others.css';

const Others = () => {
  const [records, setRecords] = useState({ income: {}, expense: {} });
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [typeToAdd, setTypeToAdd] = useState('');
  const [entry, setEntry] = useState({ amount: '', notes: '' });
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [totals, setTotals] = useState({ income: 0, expense: 0 });

  const [filter, setFilter] = useState('all');

  const groupByDate = (items) => {
    const grouped = {};
    items.forEach((item) => {
      const dateStr = item.date.toDate().toLocaleDateString();
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(item);
    });
    return grouped;
  };

  const applyFilter = (items) => {
    const now = new Date();
    return items.filter((item) => {
      const d = item.date.toDate();
      if (filter === 'daily') {
        return d.toDateString() === now.toDateString();
      } else if (filter === 'weekly') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;
      } else if (filter === 'monthly') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  };

  const fetchRecords = async () => {
    const [incomeSnap, expenseSnap] = await Promise.all([
      getDocs(collection(db, 'income')),
      getDocs(collection(db, 'expenses')),
    ]);

    const incomeRaw = incomeSnap.docs.map((doc) => doc.data());
    const expenseRaw = expenseSnap.docs.map((doc) => doc.data());

    const incomeData = applyFilter(incomeRaw);
    const expenseData = applyFilter(expenseRaw);

    const incomeTotal = incomeData.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const expenseTotal = expenseData.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    setTotals({ income: incomeTotal, expense: expenseTotal });
    setRecords({
      income: groupByDate(incomeData),
      expense: groupByDate(expenseData),
    });
  };

  const handleSave = async () => {
    if (!entry.amount || isNaN(entry.amount)) return alert('Amount required');

    const now = Timestamp.now();
    const data = {
      amount: Number(entry.amount),
      notes: entry.notes,
      date: now,
    };
    const col = typeToAdd === 'income' ? 'income' : 'expenses';
    await addDoc(collection(db, col), data);

    setEntry({ amount: '', notes: '' });
    setShowEntryDialog(false);
    fetchRecords();
  };

  useEffect(() => {
    fetchRecords();
  }, [filter]);

  return (
  <div className="others-page">
    {/* Header */}
    <h1 className="animated-section" style={{ animationDelay: '0s' }}>
      MATUMIZI MENGINE YA FEDHA
    </h1>

    {/* Filter Buttons */}
    <div className="filter-buttons animated-section" style={{ animationDelay: '0.1s' }}>
      <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>Yote</button>
      <button onClick={() => setFilter('daily')} className={filter === 'daily' ? 'active' : ''}>Siku</button>
      <button onClick={() => setFilter('weekly')} className={filter === 'weekly' ? 'active' : ''}>Wiki</button>
      <button onClick={() => setFilter('monthly')} className={filter === 'monthly' ? 'active' : ''}>Mwezi</button>
    </div>

    {/* Totals */}
    <div className="totals animated-section" style={{ animationDelay: '0.2s' }}>
      <p><strong>Jumla zilizoingia:</strong> Tsh {totals.income.toLocaleString()}</p>
      <p><strong>Jumla zilizotumika:</strong> Tsh {totals.expense.toLocaleString()}</p>
    </div>

    {/* Records Sections */}
    <div className="sections">
      {['income', 'expense'].map((type, idxType) => (
        <div
          className="record-section animated-section"
          style={{ animationDelay: `${0.25 + idxType * 0.1}s` }}
          key={type}
        >
          <h2>{type === 'income' ? 'Zilizopokelewa (Income)' : 'Zilizotumika (Expenses)'}</h2>
          {Object.entries(records[type]).length === 0 ? (
            <p>Hakuna taarifa yoyote.</p>
          ) : (
            Object.entries(records[type]).map(([date, entries], idxDate) => (
              <div
                className="date-group animated-section"
                style={{ animationDelay: `${0.3 + idxType * 0.1 + idxDate * 0.05}s` }}
                key={date}
              >
                <h4>{date}</h4>
                <ul>
                  {entries.map((e, i) => (
                    <li key={i}>
                      Tsh {e.amount} - {e.notes || 'No note'}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      ))}
    </div>

    {/* Type Dialog */}
    {showTypeDialog && (
      <div className="dialog-overlay scale-in" style={{ animationDelay: '0.4s' }}>
        <div className="dialog scale-in">
          <h3>Add Record</h3>
          <button onClick={() => { setTypeToAdd('income'); setShowEntryDialog(true); setShowTypeDialog(false); }}>Income</button>
          <button onClick={() => { setTypeToAdd('expense'); setShowEntryDialog(true); setShowTypeDialog(false); }}>Expense</button>
          <button onClick={() => setShowTypeDialog(false)}>Cancel</button>
        </div>
      </div>
    )}

    {/* Entry Dialog */}
    {showEntryDialog && (
      <div className="dialog-overlay scale-in" style={{ animationDelay: '0.4s' }}>
        <div className="dialog scale-in">
          <h3>New {typeToAdd === 'income' ? 'Income' : 'Expense'}</h3>
          <input
            type="number"
            placeholder="Amount"
            value={entry.amount}
            onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
          />
          <input
            type="text"
            placeholder="Notes"
            value={entry.notes}
            onChange={(e) => setEntry({ ...entry, notes: e.target.value })}
          />
          <div className="dialog-buttons">
            <button onClick={handleSave}>Save</button>
            <button onClick={() => setShowEntryDialog(false)}>Cancel</button>
          </div>
        </div>
      </div>
    )}

    {/* Floating Add Button */}
    <button className="floating-add-btn scale-in" style={{ animationDelay: '0.5s' }} onClick={() => setShowTypeDialog(true)}>+</button>
  </div>
);

};

export default Others;
