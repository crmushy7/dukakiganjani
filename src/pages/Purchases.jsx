import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import './Purchases.css';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const Purchases = () => {
  const [items, setItems] = useState([]);
  const [groupedItems, setGroupedItems] = useState({});
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    buyingPrice: '',
    sellingPrice: '',
    quantity: '',
    category: 'metals',
  });
  const [editItem, setEditItem] = useState(null);
  const [showEditItemDialog, setShowEditItemDialog] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [addingId, setAddingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [loading, setLoading] = useState(false); // Loader state

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    filterItems();
  }, [searchQuery, category, items, startDate, endDate]);

  const fetchItems = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'items'));
      const itemsList = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      itemsList.sort(
        (a, b) =>
          new Date(b.dateAdded.split(' ')[0].split('-').reverse().join('-')) -
          new Date(a.dateAdded.split(' ')[0].split('-').reverse().join('-'))
      );
      setItems(itemsList);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const groupByDate = (items) => {
    const groups = {};
    items.forEach(item => {
      const date = item.dateAdded.split(' ')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return groups;
  };

  const filterItems = () => {
    let filtered = [...items];
    if (category !== 'all') filtered = filtered.filter(item => item.category === category);
    if (searchQuery) filtered = filtered.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (startDate && endDate) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.dateAdded.split(' ')[0].split('-').reverse().join('-'));
        return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
      });
    }
    setFilteredItems(filtered);
    setGroupedItems(groupByDate(filtered));
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredItems);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchases');
    XLSX.writeFile(workbook, 'Purchases.xlsx');
  };

  const exportToCSV = () => {
    const csvRows = [
      ['Name', 'Quantity', 'Buying Price', 'Selling Price', 'Date Added'],
      ...filteredItems.map(item => [item.name, item.quantity, item.buyingPrice, item.sellingPrice, item.dateAdded])
    ];
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'Purchases.csv');
  };

  const chartData = Object.entries(groupedItems).map(([date, items]) => {
    const totalQuantity = items.reduce((sum, item) => sum + parseInt(item.quantity), 0);
    const totalValue = items.reduce((sum, item) => sum + item.quantity * item.buyingPrice, 0);
    return { date, quantity: totalQuantity, value: totalValue };
  });

  const updateItemCounter = async (itemName, quantitySold) => {
    const itemRef = doc(db, 'ItemCounter', itemName);
    const itemSnap = await getDoc(itemRef);
    if (itemSnap.exists()) {
      const current = itemSnap.data().remaining || 0;
      const updated = current + Number(quantitySold);
      await updateDoc(itemRef, { itemName, remaining: updated });
    } else {
      await setDoc(itemRef, { itemName, remaining: Number(quantitySold) });
    }
  };

  const handleAddItem = async () => {
    const { name, buyingPrice, sellingPrice, quantity, category } = newItem;
    const parsedBuying = parseFloat(buyingPrice);
    const parsedSelling = parseFloat(sellingPrice);
    const parsedQty = parseInt(quantity);

    if (
      name.trim() &&
      !isNaN(parsedBuying) &&
      !isNaN(parsedSelling) &&
      !isNaN(parsedQty) &&
      parsedBuying > 0 &&
      parsedSelling > 0 &&
      parsedQty > 0 &&
      parsedSelling > parsedBuying / parsedQty
    ) {
      setLoading(true);
      const currentDateTime = new Date();
      const formattedDateTime = `${currentDateTime.getDate()}-${currentDateTime.getMonth() + 1}-${currentDateTime.getFullYear()} ${currentDateTime.getHours()}:${currentDateTime.getMinutes().toString().padStart(2, '0')}Hrs`;

      try {
        const docRef = await addDoc(collection(db, 'items'), {
          name: name.trim(),
          category,
          quantity: parsedQty,
          buyingPrice: parsedBuying,
          sellingPrice: parsedSelling,
          total: parsedBuying,
          dateAdded: formattedDateTime,
        });

        await updateItemCounter(name.toLowerCase().trim(), parsedQty);

        setAddingId(docRef.id);
        setTimeout(() => setAddingId(null), 400);

        setNewItem({ name: '', buyingPrice: '', sellingPrice: '', quantity: '', category: 'metals' });
        setShowAddItemDialog(false);
        fetchItems();
      } catch (error) {
        console.error('Error adding item:', error);
      } finally {
        setLoading(false);
      }
    } else {
      if (parsedSelling <= parsedBuying / parsedQty){
            alert('Bei ya kuuza : '+ parsedSelling+ ' uliyoweka ni lazima iwe juu ya bei ya kununua ambayo ni shilingi : '+ parsedBuying / parsedQty);
        }else{
            alert('Tafadhali jaza vyema sehemu zote. Bei, Idadi, na Jina la Dawa vinahitajika na lazima viwe namba halali.');
        }
    }
  };

  const handleUpdateItem = async () => {
    try {
      const itemDoc = doc(db, 'items', editItem.id);
      if (parseFloat(editItem.sellingPrice) > parseFloat(editItem.buyingPrice) / parseInt(editItem.quantity)){
        await updateDoc(itemDoc, {
        name: editItem.name,
        buyingPrice: parseFloat(editItem.buyingPrice),
        sellingPrice: parseFloat(editItem.sellingPrice),
        quantity: parseInt(editItem.quantity),
        category: editItem.category,
      });
      setShowEditItemDialog(false);
      setEditItem(null);
      fetchItems();
      } else {
        alert('Bei ya kuuza lazima iwe juu ya bei ya kununua kwa kipimo cha idadi ambayo ni shilingi : '+ parseFloat(editItem.buyingPrice) / parseInt(editItem.quantity));
      }
      
    } catch (error) {
      console.error('Kuna hitilafu:', error);
      alert('Imeshindikana kusasisha item. Tafadhali jaribu tena.');
    }
  };

  const handleDeleteItem = async (id, name) => {
    if (window.confirm(`Una uhakika unataka kufuta ${name}?`)) {
      setRemovingId(id);
      setLoading(true);
      setTimeout(async () => {
        try {
          await deleteDoc(doc(db, 'items', id));
          fetchItems();
          setRemovingId(null);
        } catch (error) {
          console.error('Kuna hitilafu:', error);
          alert('Imeshindikana kufuta item. Tafadhali jaribu tena.');
        } finally {
          setLoading(false);
        }
      }, 300); // match fade-out animation
    }
  };

 return (
  <div className="purchases">
    {loading && (
      <div className="loader-overlay">
        <div className="loading-box">
          <div className="loader"></div>
          <p>saving...</p>
        </div>
      </div>
    )}

    <h1 className="headertu" style={{ animationDelay: '0s' }}>
      Vivian Medics Purchases
    </h1>

    <div className="controls animated-section" style={{ animationDelay: '0.1s' }}>
      <input
        type="text"
        placeholder="Search medicines..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
      />

      <select value={category} onChange={e => setCategory(e.target.value)}>
        <option value="all">All</option>
        <option value="Analgesics">Analgesics</option>
        <option value="Antibiotics">Antibiotics</option>
        <option value="Antimalarials">Antimalarials</option>
        <option value="Antifungals">Antifungals</option>
        <option value="Antiemetics">Antiemetics</option>
        <option value="Anthelmintics">Anthelmintics</option>
        <option value="PPIs">PPIs</option>
        <option value="Anthypertensive">Anthypertensive</option>
        <option value="Antidiabetics">Antidiabetics</option>
        <option value="Cough Syrups">Cough Syrups</option>
        <option value="Bronchodilators">Bronchodilators</option>
        <option value="Steroids">Steroids</option>
        <option value="Corticosteroids">Corticosteroids</option>
        <option value="Antihistamines">Antihistamines</option>
        <option value="Sedatives">Sedatives</option>
        <option value="Creams">Creams</option>
        <option value="Eye Care">Eye Care</option>
        <option value="Ear Care">Ear Care</option>
        <option value="Others">Others</option>
      </select>

      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />

      <button className="btn colored" onClick={exportToExcel}>
        Export to Excel
      </button>

      <button className="btn colored" onClick={exportToCSV}>
        Export to CSV
      </button>
    </div>

    {Object.entries(groupedItems).map(([date, items], idx) => (
      <div
        key={date}
        className="group animated-section"
        style={{ animationDelay: `${0.2 + idx * 0.1}s` }}
      >
        <h3>{date}</h3>

        {/* ✅ WRAPPER ADDED HERE */}
        {/* <div className="table-wrapper"> */}
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Qty</th>
                <th>Buying Price</th>
                <th>Price per Item</th>
                <th>Selling Price per Item</th>
                <th>Total Selling Price</th>
                <th>Profit</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {items.map(item => (
                <tr
                  key={item.id}
                  className={`${addingId === item.id ? 'fade-in' : ''} ${
                    removingId === item.id ? 'fade-out' : ''
                  }`}
                >
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{item.buyingPrice}</td>
                  <td>{(item.buyingPrice / item.quantity).toFixed(2)}</td>
                  <td>{item.sellingPrice}</td>
                  <td>{(item.sellingPrice*item.quantity).toLocaleString()}</td>
                  <td>{((item.sellingPrice - (item.buyingPrice / item.quantity)) * item.quantity).toLocaleString()}</td>

                  <td className="actions">
  <button
    className="btn colored"
    onClick={() => {
      setEditItem(item);
      setShowEditItemDialog(true);
    }}
  >
    Edit
  </button>

  <button
    className="btn danger"
    onClick={() => handleDeleteItem(item.id, item.name)}
  >
    Delete
  </button>
</td>
                </tr>
              ))}
            </tbody>
          </table>
        {/* </div> */}

        <p>
          <strong>Daily Total (Buying): </strong>
          {items.reduce((sum, item) => sum + item.buyingPrice, 0).toLocaleString()} Tsh
        </p>
      </div>
    ))}

    {chartData.length > 0 && (
      <div
        className="chart-container animated-section"
        style={{
          animationDelay: `${
            0.2 + Object.entries(groupedItems).length * 0.1
          }s`,
        }}
      >
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />

            <Bar dataKey="quantity" fill="#8884d8" name="Total Quantity" />
            <Bar dataKey="value" fill="#82ca9d" name="Total Buying Value (Tsh)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )}

    <button
      className="add-item-button colored animated-section"
      style={{
        animationDelay: `${
          0.3 + Object.entries(groupedItems).length * 0.1
        }s`,
      }}
      onClick={() => setShowAddItemDialog(true)}
    >
      +
    </button>

    {/* ADD ITEM DIALOG */}
    {showAddItemDialog && (
      <div className="dialog-overlay">
        <div className="dialog scale-in">
          <h3>Add New Medicine</h3>

          <input
            type="text"
            placeholder="Medicine Name"
            value={newItem.name}
            onChange={e =>
              setNewItem({ ...newItem, name: e.target.value })
            }
          />

          <input
            type="number"
            placeholder="Total Buying Price"
            value={newItem.buyingPrice}
            onChange={e =>
              setNewItem({ ...newItem, buyingPrice: e.target.value })
            }
          />

          <input
            type="number"
            placeholder="Selling Price per Item"
            value={newItem.sellingPrice}
            onChange={e =>
              setNewItem({ ...newItem, sellingPrice: e.target.value })
            }
          />

          <input
            type="number"
            placeholder="Quantity"
            value={newItem.quantity}
            onChange={e =>
              setNewItem({ ...newItem, quantity: e.target.value })
            }
          />

          <select
            value={newItem.category}
            onChange={e =>
              setNewItem({ ...newItem, category: e.target.value })
            }
          >
            <option value="Analgesics">Analgesics</option>
<option value="Antibiotics">Antibiotics</option>
<option value="Antimalarials">Antimalarials</option>
<option value="Antifungals">Antifungals</option>
<option value="Antiemetics">Antiemetics</option>
<option value="Anthelmintics">Anthelmintics</option>
<option value="PPIs">PPIs</option>
<option value="Anthypertensive">Anthypertensive</option>
<option value="Antidiabetics">Antidiabetics</option>
<option value="Cough Syrups">Cough Syrups</option>
<option value="Bronchodilators">Bronchodilators</option>
<option value="Steroids">Steroids</option>
<option value="Corticosteroids">Corticosteroids</option>
<option value="Antihistamines">Antihistamines</option>
<option value="Sedatives">Sedatives</option>
<option value="Creams">Creams</option>
<option value="Eye Care">Eye Care</option>
<option value="Ear Care">Ear Care</option>
<option value="Others">Others</option>
          </select>

          <div className="dialog-actions">
            <button className="btn colored" onClick={handleAddItem}>
              Add
            </button>

            <button className="btn" onClick={() => setShowAddItemDialog(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

    {/* EDIT ITEM DIALOG */}
    {showEditItemDialog && editItem && (
      <div className="modal-overlay" onClick={() => setShowEditItemDialog(false)}>
        <div className="modal-content slide-in" onClick={e => e.stopPropagation()}>
          <h3>Edit Medicine</h3>

          <input
            type="text"
            value={editItem.name}
            onChange={e =>
              setEditItem({ ...editItem, name: e.target.value })
            }
          />

          <input
            type="number"
            value={editItem.buyingPrice}
            onChange={e =>
              setEditItem({ ...editItem, buyingPrice: e.target.value })
            }
          />

          <input
            type="number"
            value={editItem.sellingPrice}
            onChange={e =>
              setEditItem({ ...editItem, sellingPrice: e.target.value })
            }
          />

          <input
            type="number"
            value={editItem.quantity}
            onChange={e =>
              setEditItem({ ...editItem, quantity: e.target.value })
            }
          />

          <select
            value={editItem.category}
            onChange={e =>
              setEditItem({ ...editItem, category: e.target.value })
            }
          >
            <option value="Analgesics">Analgesics</option>
<option value="Antibiotics">Antibiotics</option>
<option value="Antimalarials">Antimalarials</option>
<option value="Antifungals">Antifungals</option>
<option value="Antiemetics">Antiemetics</option>
<option value="Anthelmintics">Anthelmintics</option>
<option value="PPIs">PPIs</option>
<option value="Antipyretics">Antipyretics</option>
<option value="Antidiabetics">Antidiabetics</option>
<option value="Cough Syrups">Cough Syrups</option>
<option value="Bronchodilators">Bronchodilators</option>
<option value="Steroids">Steroids</option>
<option value="Corticosteroids">Corticosteroids</option>
<option value="Antihistamines">Antihistamines</option>
<option value="Sedatives">Sedatives</option>
<option value="Creams">Creams</option>
<option value="Eye Care">Eye Care</option>
<option value="Ear Care">Ear Care</option>
<option value="Others">Others</option>
          </select>

          <div className="dialog-actions">
            <button className="btn colored" onClick={handleUpdateItem}>
              Save
            </button>

            <button className="btn danger" onClick={() => setShowEditItemDialog(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);

};

export default Purchases;
