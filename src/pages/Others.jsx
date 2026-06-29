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
  const [filter, setFilter] = useState('all');

  const [loading, setLoading] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');

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

  // ---------------- FILTER ----------------
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
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      }
      return true;
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

    const incomeData = applyFilter(incomeRaw);
    const expenseData = applyFilter(expenseRaw);

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
    if (!entry.amount || isNaN(entry.amount)) {
      return alert('Amount required');
    }

    try {
      setLoading(true);

      const now = Timestamp.now();

      const data = {
        amount: Number(entry.amount),
        notes: entry.notes,
        date: now,
      };

      const col =
        typeToAdd === 'income' ? 'income' : 'expenses';

      await addDoc(collection(db, col), data);

      setEntry({ amount: '', notes: '' });
      setShowEntryDialog(false);

      await fetchRecords();
    } catch (err) {
      console.error(err);
      alert('Failed to save');
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

      const col =
        deleteItem.type === 'income'
          ? 'income'
          : 'expenses';

      await deleteDoc(doc(db, col, deleteItem.id));

      setDeleteItem(null);
      setDeletePassword('');
      setShowDeleteDialog(false);

      await fetchRecords();
    } catch (err) {
      console.error(err);
      alert('Delete failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [filter]);

  return (
    <div className="others-page">

      {/* TITLE */}
      <h1 className="animated-section">
        MATUMIZI MENGINE YA FEDHA
      </h1>

      {/* FILTERS */}
      <div className="filter-buttons animated-section">
        <button onClick={() => setFilter('all')}>Yote</button>
        <button onClick={() => setFilter('daily')}>Siku</button>
        <button onClick={() => setFilter('weekly')}>Wiki</button>
        <button onClick={() => setFilter('monthly')}>Mwezi</button>
      </div>

      {/* TOTALS */}
      <div className="totals animated-section">
        <p>
          <strong>Income:</strong> Tsh{' '}
          {totals.income.toLocaleString()}
        </p>
        <p>
          <strong>Expense:</strong> Tsh{' '}
          {totals.expense.toLocaleString()}
        </p>
      </div>

      {/* RECORDS */}
      <div className="sections">
        {['income', 'expense'].map((type) => (
          <div key={type}>
            <h2>
              {type === 'income'
                ? 'Income'
                : 'Expenses'}
            </h2>

            {Object.entries(records[type]).map(
              ([date, entries]) => (
                <div key={date}>
                  <h4>{date}</h4>

                  <ul>
                    {entries.map((e) => (
                     <li className="record-item">
  <div className="record-info">
    Tsh {e.amount} - {e.notes || 'No note'}
  </div>

  <div className="record-actions">
    <button
      className="delete-btn"
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
              )
            )}
          </div>
        ))}
      </div>

      {/* SAVE LOADER */}
      {loading && (
        <div className="loader-overlay">
          <div className="loading-box">
            <div className="loader"></div>
            <p>Processing...</p>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {showDeleteDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Confirm Delete</h3>

            <input
              type="password"
              placeholder="Enter password"
              value={deletePassword}
              onChange={(e) =>
                setDeletePassword(e.target.value)
              }
            />

            <div className="dialog-buttons">
              <button onClick={handleDelete}>
                Delete
              </button>

              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeletePassword('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TYPE DIALOG */}
      {showTypeDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Add Type</h3>

            <button
              onClick={() => {
                setTypeToAdd('income');
                setShowEntryDialog(true);
                setShowTypeDialog(false);
              }}
            >
              Income
            </button>

            <button
              onClick={() => {
                setTypeToAdd('expense');
                setShowEntryDialog(true);
                setShowTypeDialog(false);
              }}
            >
              Expense
            </button>

            <button
              onClick={() =>
                setShowTypeDialog(false)
              }
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ENTRY DIALOG */}
      {showEntryDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>
              New{' '}
              {typeToAdd === 'income'
                ? 'Income'
                : 'Expense'}
            </h3>

            <input
              type="number"
              placeholder="Amount"
              value={entry.amount}
              onChange={(e) =>
                setEntry({
                  ...entry,
                  amount: e.target.value,
                })
              }
            />

            <input
              type="text"
              placeholder="Notes"
              value={entry.notes}
              onChange={(e) =>
                setEntry({
                  ...entry,
                  notes: e.target.value,
                })
              }
            />

            <div className="dialog-buttons">
              <button
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save'}
              </button>

              <button
                onClick={() =>
                  setShowEntryDialog(false)
                }
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOAT BUTTON */}
      <button
        className="floating-add-btn"
        onClick={() =>
          setShowTypeDialog(true)
        }
      >
        +
      </button>
    </div>
  );
};

export default Others;