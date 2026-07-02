import React, { useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
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

  const [loading, setLoading] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');

  // DATE RANGE FILTER
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedRange, setAppliedRange] = useState(null);

  // ---------------- GROUP BY DATE ----------------
  const groupByDate = (items) => {
    const grouped = {};
    items.forEach((item) => {
      const dateStr = item.date.toDate().toLocaleDateString();
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(item);
    });
    return grouped;
  };

  // ---------------- DATE FILTER ----------------
  const applyDateRange = (items) => {
    if (!appliedRange) return items;

    const { start, end } = appliedRange;

    return items.filter((item) => {
      const d = item.date.toDate();

      const startOk = start ? d >= new Date(start) : true;
      const endOk = end ? d <= new Date(end + 'T23:59:59') : true;

      return startOk && endOk;
    });
  };

  // ---------------- FETCH ----------------
  const fetchRecords = async () => {
    const [incomeSnap, expenseSnap] = await Promise.all([
      getDocs(collection(db, 'income')),
      getDocs(collection(db, 'expenses')),
    ]);

    const incomeRaw = incomeSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const expenseRaw = expenseSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const incomeData = applyDateRange(incomeRaw);
    const expenseData = applyDateRange(expenseRaw);

    const incomeTotal = incomeData.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );

    const expenseTotal = expenseData.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );

    setTotals({ income: incomeTotal, expense: expenseTotal });

    setRecords({
      income: groupByDate(incomeData),
      expense: groupByDate(expenseData),
    });
  };

  // ---------------- SAVE ----------------
  const handleSave = async () => {
    if (!entry.amount || isNaN(entry.amount)) return;

    try {
      setLoading(true);

      const data = {
        amount: Number(entry.amount),
        notes: entry.notes,
        date: Timestamp.now(),
      };

      const col = typeToAdd === 'income' ? 'income' : 'expenses';

      await addDoc(collection(db, col), data);

      setEntry({ amount: '', notes: '' });
      setShowEntryDialog(false);

      await fetchRecords();
    } finally {
      setLoading(false);
    }
  };

  // ---------------- DELETE ----------------
  const handleDelete = async () => {
    if (deletePassword !== 'viane') {
      alert('Wrong password');
      return;
    }

    try {
      setLoading(true);

      const col = deleteItem.type === 'income' ? 'income' : 'expenses';

      await deleteDoc(doc(db, col, deleteItem.id));

      setDeleteItem(null);
      setDeletePassword('');
      setShowDeleteDialog(false);

      await fetchRecords();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [appliedRange]);

  return (
    <div className="others-page">

      <h1>MATUMIZI MENGINE YA FEDHA</h1>

      {/* DATE RANGE FILTER */}
      <div className="filter-row">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />

        <button
          onClick={() => {
            setAppliedRange({ start: startDate, end: endDate });
          }}
        >
          Refresh
        </button>
      </div>

      {/* TOTALS */}
      <div className="totals">
        <p>Income: Tsh {totals.income.toLocaleString()}</p>
        <p>Expense: Tsh {totals.expense.toLocaleString()}</p>
      </div>

      {/* RECORDS */}
      <div className="sections">
        {['income', 'expense'].map((type) => (
          <div key={type}>
            <h2>{type.toUpperCase()}</h2>

            {Object.entries(records[type]).map(([date, entries]) => (
              <div key={date}>
                <h4>{date}</h4>

                <ul>
                  {entries.map((e) => (
                    <li className="record-item" key={e.id}>
                      <div className="record-info">
                        Tsh {e.amount} - {e.notes || 'No note'}
                      </div>

                      <div className="record-actions">
                        <button
                          onClick={() => {
                            setDeleteItem({ ...e, type });
                            setShowDeleteDialog(true);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* FLOATING + BUTTON (RESTORED) */}
      <button
        className="floating-add-btn"
        onClick={() => setShowTypeDialog(true)}
      >
        +
      </button>

      {/* TYPE SELECT DIALOG */}
      {showTypeDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Add Type</h3>

            <button
              onClick={() => {
                setTypeToAdd('income');
                setShowTypeDialog(false);
                setShowEntryDialog(true);
              }}
            >
              Income
            </button>

            <button
              onClick={() => {
                setTypeToAdd('expense');
                setShowTypeDialog(false);
                setShowEntryDialog(true);
              }}
            >
              Expense
            </button>

            <button onClick={() => setShowTypeDialog(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ENTRY DIALOG */}
      {showEntryDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>New {typeToAdd}</h3>

            <input
              type="number"
              placeholder="Amount"
              value={entry.amount}
              onChange={(e) =>
                setEntry({ ...entry, amount: e.target.value })
              }
            />

            <input
              type="text"
              placeholder="Notes"
              value={entry.notes}
              onChange={(e) =>
                setEntry({ ...entry, notes: e.target.value })
              }
            />

            <button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>

            <button onClick={() => setShowEntryDialog(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* DELETE DIALOG */}
      {showDeleteDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Confirm Delete</h3>

            <input
              type="password"
              value={deletePassword}
              onChange={(e) =>
                setDeletePassword(e.target.value)
              }
            />

            <button onClick={handleDelete}>Delete</button>
            <button onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Others;