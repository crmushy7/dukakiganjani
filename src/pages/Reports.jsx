import React, { useState, useEffect } from 'react';
import './Reports.css';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const Report = () => {
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [stock, setStock] = useState([]);
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showButton, setShowButton] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const purchasesSnapshot = await getDocs(collection(db, 'items'));
    const salesSnapshot = await getDocs(collection(db, 'sales'));
    const stockSnapshot = await getDocs(collection(db, 'ItemCounter'));
    const incomeSnapshot = await getDocs(collection(db, 'income'));
    const expensesSnapshot = await getDocs(collection(db, 'expenses'));

    const wanaodaiwaSnapshot = await getDocs(collection(db, 'wanaodaiwa'));
    const wanaonidaiSnapshot = await getDocs(collection(db, 'wanaonidai'));

    let allPayments = [];
    wanaodaiwaSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.payments?.length) {
        data.payments.forEach(p => {
          allPayments.push({ type: 'Paid To Shop', name: data.customerName, ...p });
        });
      }
    });
    wanaonidaiSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.payments?.length) {
        data.payments.forEach(p => {
          allPayments.push({ type: 'Paid By Shop', name: data.customerName, ...p });
        });
      }
    });

    setPurchases(purchasesSnapshot.docs.map(doc => doc.data()));
    setSales(salesSnapshot.docs.map(doc => doc.data()));
    setStock(
      stockSnapshot.docs
        .map(doc => doc.data())
        .sort((a, b) => Number(a.remaining || 0) - Number(b.remaining || 0))
    );
    
    setIncome(incomeSnapshot.docs.map(doc => doc.data()));
    setExpenses(expensesSnapshot.docs.map(doc => doc.data()));
    setPayments(allPayments);
  };


useEffect(() => {
  const handleScroll = () => {
    if (window.scrollY > 0) {
      setShowButton(false);
    } else {
      setShowButton(false);
    }
  };

  window.addEventListener("scroll", handleScroll);
  return () => window.removeEventListener("scroll", handleScroll);
}, []);

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};


  const filterByDate = (data, dateField) => {
    if (!startDate || !endDate) return data;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return data.filter(item => {
      const rawDate = item[dateField];
      if (!rawDate) return false;
      const [day, month, yearTime] = rawDate.split('-');
      const [year] = yearTime.split(' ');
      const itemDate = new Date(`${month}/${day}/${year}`);
      return itemDate >= start && itemDate <= end;
    });
  };

  const filtered = filterByDate(purchases, 'dateAdded');

  const sortedFilteredPurchases = [...filtered].sort((a, b) => {
    const [d1, m1, y1Time] = a.dateAdded.split('-');
    const [y1] = y1Time.split(' ');
    const [d2, m2, y2Time] = b.dateAdded.split('-');
    const [y2] = y2Time.split(' ');

    const dateA = new Date(`${m1}/${d1}/${y1}`);
    const dateB = new Date(`${m2}/${d2}/${y2}`);

    return dateB - dateA; // Latest first
  });

  const filteredSales = filterByDate(sales, 'date');
  const filteredIncome = income;
  const filteredExpenses = expenses;
  const filteredPayments = payments;

  const totalPurchased = filtered.reduce((sum, item) => sum + Number(item.quantity), 0);
  const totalSold = filteredSales.reduce((sum, item) => sum + Number(item.quantity), 0);
  const totalCost = filtered.reduce((sum, item) => sum + Number(item.buyingPrice || 0), 0);
  const estimatedProfit = filteredSales.reduce((sum, item) => sum + Number(item.total || 0), 0) - totalCost;

  const totalIncome = filteredIncome.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalPayments = filteredPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const groupedSales = Object.values(
    filteredSales.reduce((acc, curr) => {
      const name = curr.itemName?.toLowerCase().trim();
      if (!acc[name]) acc[name] = { itemName: name, quantity: 0, total: 0 };
      acc[name].quantity += Number(curr.quantity || 0);
      acc[name].total += Number(curr.price || 0);
      return acc;
    }, {})
  ).sort((a,b)=>a.itemName.localeCompare(b.itemName));

  const handleExportPDF = () => {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("Medicohub Report", 14, 10);

  const tables = document.querySelectorAll("table"); // 👈 get all tables
  let startY = 20;

  tables.forEach((table, index) => {
    const tableTitle = table.getAttribute("data-title") || `Table ${index + 1}`;
    doc.text(tableTitle, 14, startY - 5);
    autoTable(doc, { html: table, startY });
    startY = doc.lastAutoTable.finalY + 15; // move down for next table
  });

  doc.save("Medicohub_Report.pdf");
};


  const handleExportExcel = () => {
  const wb = XLSX.utils.book_new();
  const tables = document.querySelectorAll("table"); // 👈 all tables

  tables.forEach((table, index) => {
    const sheetName = table.getAttribute("data-title") || `Table ${index + 1}`;
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)); // Excel limit: 31 chars
  });

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(
    new Blob([wbout], { type: "application/octet-stream" }),
    "Medicohub_Report.xlsx"
  );
};


 return (
  <div className="report-container">
    <h1 className="report-header">📄 MEDICOHUB Report</h1>

    {/* Top controls */}
    <div className="top-controls">
      <input
        type="text"
        placeholder="🔍 Tafuta..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}
        className="search-bar"
      />
      <div className="export-buttons">
        <button onClick={handleExportPDF}>📄 Export PDF</button>
        <button onClick={handleExportExcel}>📊 Export Excel</button>
      </div>
    </div>

    {/* Filters */}
    <div className="filters">
      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      <button onClick={fetchData}>Refresh</button>
    </div>

    {/* Summary section */}
    <div className="summary">
      <div className="summary-card"><h4>Jumla ya bidhaa zilizonunuliwa</h4><p>{totalPurchased}</p></div>
      <div className="summary-card"><h4>Jumla ya bidhaa zilizouzwa</h4><p>{totalSold}</p></div>
      <div className="summary-card"><h4>Jumla ya matumizi(Tsh)</h4><p>{totalCost}</p></div>
      <div className="summary-card"><h4>Mapato (Mengineyo)</h4><p>{totalIncome}</p></div>
      <div className="summary-card"><h4>Matumizi (Mengineyo)</h4><p>{totalExpenses}</p></div>
      <div className="summary-card"><h4>Madeni yaliyolipwa</h4><p>{totalPayments}</p></div>
    </div>

    {/* Main report content */}
    <div className="report-tabs">
      {/* Purchases Report */}
      <h2>🛒 Ripoti ya Manunuzi</h2>
      <div className="table-container">
        <table data-title="Purchases Report">
          <thead>
            <tr>
              <th>Jina la Dawa</th>
              <th>Idadi ya ZIlizonunuliwa</th>
              <th>Gharama ya Kununua(Moja)</th>
              <th>Jumla ya Gharama</th>
              <th>Tarehe ya Manunuzi</th>
            </tr>
          </thead>
          <tbody>
            {sortedFilteredPurchases
              .filter(item => item.name.toLowerCase().includes(searchQuery))
              .map((item, index) => (
                <tr key={index}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{(item.buyingPrice / item.quantity).toFixed(2)}</td>
                  <td>{item.buyingPrice}</td>
                  <td>{item.dateAdded}</td>
                </tr>
              ))}
            <tr className="total-row">
              <td><strong>Jumla</strong></td>
              <td><strong>{totalPurchased}</strong></td>
              <td></td>
              <td><strong>{totalCost}</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Sales Report */}
      <h2>💸 Ripoti ya Mauzo</h2>
      <div className="table-container">
        <table data-title="Sales Report">
          <thead>
            <tr>
              <th>Jina la Dawa</th>
              <th>Idadi ya Zilizouzwa</th>
              <th>Gharama ya Moja</th>
              <th>Jumla ya Gharama</th>
            </tr>
          </thead>
          <tbody>
            {groupedSales
              .filter(item => item.itemName.toLowerCase().includes(searchQuery))
              .map((item, index) => (
                <tr key={index}>
                  <td>{item.itemName}</td>
                  <td>{item.quantity}</td>
                  <td>{(item.total / item.quantity).toFixed(2)}</td>
                  <td>{item.total}</td>
                </tr>
              ))}
            <tr className="total-row">
              <td><strong>Jumla</strong></td>
              <td><strong>{groupedSales.reduce((sum, item) => sum + item.quantity, 0)}</strong></td>
              <td></td>
              <td><strong>{groupedSales.reduce((sum, item) => sum + item.total, 0)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Income Report */}
      <h2>📥 Ripoti ya Mapato (Mengine)</h2>
      <div className="table-container">
        <table data-title="Income (Others)">
          <thead><tr><th>Kiasi</th><th>Note</th></tr></thead>
          <tbody>
            {filteredIncome
              .filter(e => e.notes?.toLowerCase().includes(searchQuery))
              .map((e, i) => (<tr key={i}><td>{e.amount}</td><td>{e.notes}</td></tr>))}
          </tbody>
        </table>
      </div>

      {/* Expenses Report */}
      <h2>📤 Ripoti ya Matumizi (Mengine)</h2>
      <div className="table-container">
        <table data-title="Expenses (Others)">
          <thead><tr><th>Kiasi</th><th>Note</th></tr></thead>
          <tbody>
            {filteredExpenses
              .filter(e => e.notes?.toLowerCase().includes(searchQuery))
              .map((e, i) => (<tr key={i}><td>{e.amount}</td><td>{e.notes}</td></tr>))}
          </tbody>
        </table>
      </div>

      {/* Debts Report */}
      <h2>💰 Ripoti ya Malipo ya deni</h2>
      <div className="table-container">
        <h3>Yaliyolipwa Kwa Duka</h3>
        <table data-title="Debt Payments - Paid To Shop">
          <thead><tr><th>Mhusika</th><th>Kiasi kilicholipwa</th><th>Note</th><th>Aliyethibitisha</th><th>Tarehe</th></tr></thead>
          <tbody>
            {filteredPayments.filter(p => p.type === 'Paid To Shop' && p.name.toLowerCase().includes(searchQuery))
              .map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td>{p.amount}</td>
                  <td>{p.note}</td>
                  <td>{p.confirmedBy}</td>
                  <td>{p.datePaid}</td>
                </tr>
              ))}
          </tbody>
        </table>

        <h3>Yaliyolipwa na Duka</h3>
        <table data-title="Debt Payments - Paid By Shop">
          <thead><tr><th>Mhusika</th><th>Kiasi kilicholipwa</th><th>Note</th><th>Aliyethibitisha</th><th>Tarehe</th></tr></thead>
          <tbody>
            {filteredPayments.filter(p => p.type === 'Paid By Shop' && p.name.toLowerCase().includes(searchQuery))
              .map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td>{p.amount}</td>
                  <td>{p.note}</td>
                  <td>{p.confirmedBy}</td>
                  <td>{p.datePaid}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Stock Report */}
      <h2>📦 Ripoti ya Hali ya Stock</h2>
      <div className="table-container">
        <table data-title="Stock Status Report">
          <thead><tr><th>Jina la Dawa</th><th>Idadi iliyobaki</th></tr></thead>
          <tbody>
            {stock
              .filter(item => item.itemName.toLowerCase().includes(searchQuery))
              .map((item, index) => (
                <tr key={index}><td>{item.itemName}</td><td>{item.remaining}</td></tr>
              ))}
            <tr className="total-row">
              <td><strong>Jumla</strong></td>
              <td><strong>{stock.reduce((sum, item) => sum + Number(item.remaining || 0), 0)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    {/* Footer */}
    <div className="report-footer">
      <div className="signed">Signed by: __________________________</div>
      <div className="contacts">
        <p>📞 +255 ........................................................</p>
      </div>
    </div>

    {/* Back to Top */}
    {showButton && (
      <button onClick={scrollToTop} className="back-to-top show">
        ⬆️ Rudi Juu
      </button>
    )}
  </div>
);

};

export default Report;
