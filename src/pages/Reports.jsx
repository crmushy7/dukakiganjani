import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './Reports.css';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const money = (value) =>
  `TSh ${Number(value || 0).toLocaleString('en-TZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const cleanName = (value) => String(value || '').trim().toLowerCase();

const parseDate = (value) => {
  if (!value) return null;
  if (value?.toDate && typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object' && value.seconds) {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const raw = String(value).trim();
  if (!raw) return null;

  // Duka Kiganjani stores dates such as "7-10-2026 14:05Hrs".
  const local = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (local) {
    const [, day, month, year, hour = '0', minute = '0'] = local;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getRecordDate = (item, candidates = []) => {
  for (const field of candidates) {
    const parsed = parseDate(item?.[field]);
    if (parsed) return parsed;
  }
  return null;
};

const dateLabel = (value) => {
  const parsed = parseDate(value);
  return parsed ? parsed.toLocaleDateString('en-GB') : '—';
};

const Report = () => {
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [stock, setStock] = useState([]);
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [customerDebts, setCustomerDebts] = useState([]);
  const [supplierDebts, setSupplierDebts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [
        purchasesSnapshot,
        salesSnapshot,
        stockSnapshot,
        incomeSnapshot,
        expensesSnapshot,
        customerDebtSnapshot,
        supplierDebtSnapshot,
      ] = await Promise.all([
        getDocs(collection(db, 'items')),
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'ItemCounter')),
        getDocs(collection(db, 'income')),
        getDocs(collection(db, 'expenses')),
        getDocs(collection(db, 'wanaodaiwa')),
        getDocs(collection(db, 'wanaonidai')),
      ]);

      const purchaseRows = purchasesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const salesRows = salesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const stockRows = stockSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const incomeRows = incomeSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const expenseRows = expensesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const customerDebtRows = customerDebtSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const supplierDebtRows = supplierDebtSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const paymentRows = [];
      customerDebtRows.forEach((record) => {
        (Array.isArray(record.payments) ? record.payments : []).forEach((payment, index) => {
          paymentRows.push({
            ...payment,
            id: `${record.id}-customer-payment-${index}`,
            type: 'Paid To Shop',
            name: record.customerName || record.name || 'Customer',
          });
        });
      });
      supplierDebtRows.forEach((record) => {
        (Array.isArray(record.payments) ? record.payments : []).forEach((payment, index) => {
          paymentRows.push({
            ...payment,
            id: `${record.id}-supplier-payment-${index}`,
            type: 'Paid By Shop',
            name: record.customerName || record.name || record.supplierName || 'Supplier',
          });
        });
      });

      setPurchases(purchaseRows);
      setSales(salesRows);
      setStock(stockRows);
      setIncome(incomeRows);
      setExpenses(expenseRows);
      setCustomerDebts(customerDebtRows);
      setSupplierDebts(supplierDebtRows);
      setPayments(paymentRows);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load report data:', err);
      setError('Ripoti haikuweza kupakia data zote. Tafadhali angalia muunganisho na ruhusa za Firebase, kisha jaribu tena.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const inSelectedPeriod = useCallback((item, dateFields) => {
    if (!startDate && !endDate) return true;
    const recordDate = getRecordDate(item, dateFields);
    // Records without a date cannot be reliably assigned to a selected period.
    if (!recordDate) return false;
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
    if (start && recordDate < start) return false;
    if (end && recordDate > end) return false;
    return true;
  }, [startDate, endDate]);

  const latestPurchaseByProduct = useMemo(() => {
    const latest = new Map();
    purchases.forEach((purchase) => {
      const key = cleanName(purchase.name);
      if (!key) return;
      const date = getRecordDate(purchase, ['dateAdded', 'date', 'createdAt']);
      const existing = latest.get(key);
      const existingDate = existing ? getRecordDate(existing, ['dateAdded', 'date', 'createdAt']) : null;
      if (!existing || (date && (!existingDate || date > existingDate))) latest.set(key, purchase);
    });
    return latest;
  }, [purchases]);

  const filteredPurchases = useMemo(
    () => purchases.filter((item) => inSelectedPeriod(item, ['dateAdded', 'date', 'createdAt'])),
    [purchases, inSelectedPeriod]
  );
  const filteredSales = useMemo(
    () => sales.filter((item) => inSelectedPeriod(item, ['date', 'dateAdded', 'createdAt', 'timestamp'])),
    [sales, inSelectedPeriod]
  );
  const filteredIncome = useMemo(
    () => income.filter((item) => inSelectedPeriod(item, ['date', 'dateAdded', 'createdAt', 'timestamp'])),
    [income, inSelectedPeriod]
  );
  const filteredExpenses = useMemo(
    () => expenses.filter((item) => inSelectedPeriod(item, ['date', 'dateAdded', 'createdAt', 'timestamp'])),
    [expenses, inSelectedPeriod]
  );
  const filteredPayments = useMemo(
    () => payments.filter((item) => inSelectedPeriod(item, ['datePaid', 'date', 'dateAdded', 'createdAt', 'timestamp'])),
    [payments, inSelectedPeriod]
  );

  const purchaseReport = useMemo(() => filteredPurchases.map((item) => {
    const qty = number(item.quantity);
    const cost = number(item.buyingPrice);
    const unitCost = qty > 0 ? cost / qty : 0;
    const latest = latestPurchaseByProduct.get(cleanName(item.name));
    const latestSellingPrice = number(latest?.sellingPrice);
    const expectedRevenue = latestSellingPrice * qty;
    return {
      ...item,
      qty,
      cost,
      unitCost,
      latestSellingPrice,
      expectedRevenue,
      expectedProfit: expectedRevenue - cost,
    };
  }).sort((a, b) => (getRecordDate(b, ['dateAdded'])?.getTime() || 0) - (getRecordDate(a, ['dateAdded'])?.getTime() || 0)), [filteredPurchases, latestPurchaseByProduct]);

  const salesByProduct = useMemo(() => {
    const grouped = new Map();
    filteredSales.forEach((sale) => {
      const key = cleanName(sale.itemName);
      if (!key) return;
      const current = grouped.get(key) || {
        itemName: String(sale.itemName || '').trim(),
        quantity: 0,
        revenue: 0,
        transactions: 0,
        cashRevenue: 0,
        creditRevenue: 0,
      };
      const qty = number(sale.quantity);
      const revenue = number(sale.price);
      current.quantity += qty;
      current.revenue += revenue;
      current.transactions += 1;
      if (String(sale.paymentType || '').toLowerCase() === 'credit') current.creditRevenue += revenue;
      else current.cashRevenue += revenue;
      grouped.set(key, current);
    });
    return [...grouped.entries()].map(([key, item]) => {
      const latest = latestPurchaseByProduct.get(key);
      const latestQty = number(latest?.quantity);
      const latestCost = number(latest?.buyingPrice);
      const unitCost = latestQty > 0 ? latestCost / latestQty : 0;
      const costOfGoods = unitCost * item.quantity;
      const hasCost = Boolean(latest && latestQty > 0);
      const profit = hasCost ? item.revenue - costOfGoods : null;
      return {
        ...item,
        unitCost,
        costOfGoods,
        profit,
        margin: hasCost && item.revenue > 0 ? (profit / item.revenue) * 100 : 0,
        hasCost,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, latestPurchaseByProduct]);

  const stockReport = useMemo(() => {
    const byName = new Map();
    stock.forEach((row) => {
      const key = cleanName(row.itemName || row.name);
      if (!key) return;
      const latest = latestPurchaseByProduct.get(key);
      const qty = Math.max(0, number(row.remaining));
      const latestQty = number(latest?.quantity);
      const unitCost = latestQty > 0 ? number(latest?.buyingPrice) / latestQty : 0;
      const unitSell = number(latest?.sellingPrice);
      byName.set(key, {
        itemName: String(row.itemName || row.name || '').trim(),
        remaining: qty,
        unitCost,
        unitSell,
        stockCost: qty * unitCost,
        stockRetail: qty * unitSell,
        potentialProfit: qty * (unitSell - unitCost),
        hasPrice: Boolean(latest && latestQty > 0),
      });
    });
    return [...byName.values()].sort((a, b) => a.remaining - b.remaining);
  }, [stock, latestPurchaseByProduct]);

  const totals = useMemo(() => {
    const purchaseQty = filteredPurchases.reduce((sum, item) => sum + number(item.quantity), 0);
    const purchaseSpend = filteredPurchases.reduce((sum, item) => sum + number(item.buyingPrice), 0);
    const salesQty = filteredSales.reduce((sum, item) => sum + number(item.quantity), 0);
    const salesRevenue = filteredSales.reduce((sum, item) => sum + number(item.price), 0);
    const cashSales = filteredSales.filter((item) => String(item.paymentType || '').toLowerCase() !== 'credit')
      .reduce((sum, item) => sum + number(item.price), 0);
    const creditSales = filteredSales.filter((item) => String(item.paymentType || '').toLowerCase() === 'credit')
      .reduce((sum, item) => sum + number(item.price), 0);
    const estimatedCOGS = salesByProduct.reduce((sum, item) => sum + item.costOfGoods, 0);
    const grossProfit = salesByProduct.reduce((sum, item) => sum + (item.hasCost ? item.profit : 0), 0);
    const revenueWithKnownCost = salesByProduct.reduce((sum, item) => sum + (item.hasCost ? item.revenue : 0), 0);
    const otherIncome = filteredIncome.reduce((sum, item) => sum + number(item.amount), 0);
    const otherExpenses = filteredExpenses.reduce((sum, item) => sum + number(item.amount), 0);
    const paidToShop = filteredPayments.filter((item) => item.type === 'Paid To Shop')
      .reduce((sum, item) => sum + number(item.amount), 0);
    const paidByShop = filteredPayments.filter((item) => item.type === 'Paid By Shop')
      .reduce((sum, item) => sum + number(item.amount), 0);
    const stockQty = stockReport.reduce((sum, item) => sum + item.remaining, 0);
    const stockCost = stockReport.reduce((sum, item) => sum + item.stockCost, 0);
    const stockRetail = stockReport.reduce((sum, item) => sum + item.stockRetail, 0);
    const customerOutstanding = customerDebts.reduce((sum, item) => sum + Math.max(0, number(item.balance ?? (number(item.total) - number(item.paid)))), 0);
    const supplierOutstanding = supplierDebts.reduce((sum, item) => sum + Math.max(0, number(item.balance ?? (number(item.total) - number(item.paid)))), 0);
    const operatingProfit = grossProfit + otherIncome - otherExpenses;
    // Approximate cash movement: cash sales + debt collections + other income - purchases - other expenses - supplier payments.
    const estimatedCashMovement = cashSales + paidToShop + otherIncome - purchaseSpend - otherExpenses - paidByShop;
    return {
      purchaseQty, purchaseSpend, salesQty, salesRevenue, cashSales, creditSales,
      estimatedCOGS, grossProfit, revenueWithKnownCost, grossMargin: revenueWithKnownCost > 0 ? grossProfit / revenueWithKnownCost * 100 : 0,
      otherIncome, otherExpenses, paidToShop, paidByShop, stockQty, stockCost, stockRetail,
      stockPotentialProfit: stockRetail - stockCost, customerOutstanding, supplierOutstanding,
      operatingProfit, estimatedCashMovement,
      expectedPurchaseProfit: purchaseReport.reduce((sum, item) => sum + item.expectedProfit, 0),
      uncostedSales: salesByProduct.filter((item) => !item.hasCost).length,
      lowStockCount: stockReport.filter((item) => item.remaining <= 5).length,
    };
  }, [filteredPurchases, filteredSales, salesByProduct, filteredIncome, filteredExpenses, filteredPayments, stockReport, customerDebts, supplierDebts, purchaseReport]);

  const filteredPurchaseReport = useMemo(() => purchaseReport.filter((item) => cleanName(item.name).includes(searchQuery)), [purchaseReport, searchQuery]);
  const filteredSalesByProduct = useMemo(() => salesByProduct.filter((item) => cleanName(item.itemName).includes(searchQuery)), [salesByProduct, searchQuery]);
  const filteredStockReport = useMemo(() => stockReport.filter((item) => cleanName(item.itemName).includes(searchQuery)), [stockReport, searchQuery]);

  const dailySales = useMemo(() => {
    const days = new Map();
    filteredSales.forEach((sale) => {
      const date = getRecordDate(sale, ['date', 'dateAdded', 'createdAt']);
      if (!date) return;
      const key = date.toLocaleDateString('en-GB');
      const current = days.get(key) || { date, label: key, revenue: 0, quantity: 0 };
      current.revenue += number(sale.price);
      current.quantity += number(sale.quantity);
      days.set(key, current);
    });
    return [...days.values()].sort((a, b) => a.date - b.date).slice(-14);
  }, [filteredSales]);

  const topProducts = useMemo(() => [...salesByProduct].filter((item) => item.hasCost).sort((a, b) => b.profit - a.profit).slice(0, 5), [salesByProduct]);
  const maxDailyRevenue = Math.max(1, ...dailySales.map((day) => day.revenue));
  const maxTopProfit = Math.max(1, ...topProducts.map((item) => Math.max(0, item.profit)));

  const resetDates = () => {
    setStartDate('');
    setEndDate('');
  };

  const exportTables = (format) => {
    const tables = Array.from(document.querySelectorAll('.report-container table'));
    if (format === 'pdf') {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.setFontSize(16);
      pdf.text('Duka Kiganjani — Business Report', 14, 13);
      pdf.setFontSize(9);
      pdf.text(`Period: ${startDate || 'Beginning'} to ${endDate || 'Today'} | Generated: ${new Date().toLocaleString()}`, 14, 19);
      let y = 25;
      tables.forEach((table) => {
        const title = table.dataset.title || 'Report table';
        if (y > 175) {
          pdf.addPage();
          y = 15;
        }
        pdf.setFontSize(11);
        pdf.text(title, 14, y);
        autoTable(pdf, {
          html: table,
          startY: y + 3,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.7 },
          headStyles: { fillColor: [29, 78, 70] },
          margin: { left: 14, right: 14 },
        });
        y = (pdf.lastAutoTable?.finalY || y) + 10;
      });
      pdf.save('Duka_Kiganjani_Report.pdf');
      return;
    }

    const workbook = XLSX.utils.book_new();
    tables.forEach((table, index) => {
      const baseName = (table.dataset.title || `Report ${index + 1}`).replace(/[\\/?*[\]:]/g, '').slice(0, 31);
      const name = baseName || `Report${index + 1}`;
      let sheetName = name;
      let suffix = 2;
      while (workbook.SheetNames.includes(sheetName)) {
        sheetName = `${name.slice(0, 27)}_${suffix++}`;
      }
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.table_to_sheet(table), sheetName);
    });
    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([output], { type: 'application/octet-stream' }), 'Duka_Kiganjani_Report.xlsx');
  };

  const dateRangeLabel = startDate || endDate ? `${startDate || 'Mwanzo'} — ${endDate || 'Leo'}` : 'Muda wote';
  const formatProfit = (value) => <span className={value < 0 ? 'negative-value' : 'positive-value'}>{money(value)}</span>;

  return (
    <main className="report-container">
      <header className="report-hero">
        <div>
          <p className="report-eyebrow">DUKA KIGANJANI · BUSINESS INTELLIGENCE</p>
          <h1 className="report-header">Ripoti ya Biashara</h1>
          <p className="report-subtitle">Muhtasari wa mauzo, faida, manunuzi, stock, madeni na mtiririko wa fedha.</p>
        </div>
        <div className="report-hero-actions">
          <button className="btn btn-light" onClick={fetchData} disabled={loading}>{loading ? 'Inapakia…' : '↻ Refresh'}</button>
          <button className="btn btn-primary" onClick={() => exportTables('pdf')} disabled={loading}>Export PDF</button>
          <button className="btn btn-secondary" onClick={() => exportTables('excel')} disabled={loading}>Export Excel</button>
        </div>
      </header>

      <section className="report-toolbar" aria-label="Report filters">
        <div className="report-search">
          <label htmlFor="report-search">Tafuta bidhaa / taarifa</label>
          <input id="report-search" type="search" placeholder="Andika jina la bidhaa au mhusika…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value.toLowerCase())} />
        </div>
        <div className="date-filter">
          <label htmlFor="start-date">Kuanzia</label>
          <input id="start-date" type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} />
        </div>
        <div className="date-filter">
          <label htmlFor="end-date">Mpaka</label>
          <input id="end-date" type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} />
        </div>
        <button className="btn btn-light clear-filter" onClick={resetDates}>Ondoa tarehe</button>
      </section>

      {error && <div className="report-alert" role="alert">{error}</div>}
      {loading && <div className="report-loading">Inakusanya taarifa za biashara…</div>}

      {!loading && <>
        <div className="report-meta">
          <span><strong>Kipindi:</strong> {dateRangeLabel}</span>
          <span><strong>Imesasishwa:</strong> {lastUpdated ? lastUpdated.toLocaleString() : '—'}</span>
          <span><strong>Bidhaa bila gharama inayojulikana:</strong> {totals.uncostedSales}</span>
        </div>

        <section className="metric-grid">
          <article className="metric-card metric-primary"><span>Mauzo yote</span><strong>{money(totals.salesRevenue)}</strong><small>{totals.salesQty.toLocaleString()} vipande vilivyouzwa</small></article>
          <article className="metric-card"><span>Faida ghafi inayokadiriwa</span><strong>{money(totals.grossProfit)}</strong><small>Margin ya bidhaa zenye gharama inayojulikana: {totals.grossMargin.toFixed(1)}%</small></article>
          <article className="metric-card"><span>Faida baada ya mapato/matumizi mengine</span><strong>{money(totals.operatingProfit)}</strong><small>Faida ghafi + mapato mengine − matumizi mengine</small></article>
          <article className="metric-card"><span>Gharama ya manunuzi</span><strong>{money(totals.purchaseSpend)}</strong><small>{totals.purchaseQty.toLocaleString()} vipande vilivyonunuliwa</small></article>
          <article className="metric-card"><span>Thamani ya stock kwa gharama</span><strong>{money(totals.stockCost)}</strong><small>{totals.stockQty.toLocaleString()} vipande vilivyobaki</small></article>
          <article className="metric-card"><span>Thamani ya stock kwa bei ya kuuza</span><strong>{money(totals.stockRetail)}</strong><small>Faida inayoweza kupatikana: {money(totals.stockPotentialProfit)}</small></article>
          <article className="metric-card"><span>Madeni ya wateja yaliyobaki</span><strong>{money(totals.customerOutstanding)}</strong><small>Salio la wadaiwa wa duka</small></article>
          <article className="metric-card"><span>Madeni ya duka yaliyobaki</span><strong>{money(totals.supplierOutstanding)}</strong><small>Salio la tunaowadai</small></article>
          <article className="metric-card"><span>Makadirio ya mzunguko wa fedha</span><strong>{money(totals.estimatedCashMovement)}</strong><small>Makadirio ya cash in/out; si salio la benki</small></article>
        </section>

        <section className="report-section">
          <div className="section-heading"><div><p className="section-kicker">PERFORMANCE</p><h2>Muhtasari wa mauzo na faida</h2></div></div>
          <div className="insight-grid">
            <div className="insight-card">
              <h3>Mauzo ya siku za karibuni</h3>
              {dailySales.length === 0 ? <p className="empty-state">Hakuna mauzo yenye tarehe inayosomeka katika kipindi hiki.</p> : <div className="bar-list">
                {dailySales.map((day) => <div className="bar-row" key={day.label}>
                  <span className="bar-label">{day.label}</span>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(2, day.revenue / maxDailyRevenue * 100)}%` }} /></div>
                  <strong>{money(day.revenue)}</strong>
                </div>)}
              </div>}
            </div>
            <div className="insight-card">
              <h3>Bidhaa zenye faida kubwa zaidi</h3>
              {topProducts.length === 0 ? <p className="empty-state">Bado hakuna mauzo ya kuonyesha.</p> : <div className="bar-list">
                {topProducts.map((item) => <div className="profit-row" key={cleanName(item.itemName)}>
                  <div className="profit-row-head"><span>{item.itemName}</span>{formatProfit(item.profit)}</div>
                  <div className="bar-track"><div className={`bar-fill ${item.profit < 0 ? 'bar-negative' : ''}`} style={{ width: `${Math.max(2, Math.max(0, item.profit) / maxTopProfit * 100)}%` }} /></div>
                </div>)}
              </div>}
            </div>
          </div>
        </section>

        <section className="report-section">
          <div className="section-heading"><div><p className="section-kicker">PURCHASING</p><h2>Ripoti ya manunuzi</h2><p>Faida tarajiwa inatumia bei ya sasa ya kuuza ya bidhaa, dhidi ya gharama ya kila rekodi ya manunuzi.</p></div></div>
          <div className="table-container"><table data-title="Purchases and Expected Profit">
            <thead><tr><th>Bidhaa</th><th>Idadi</th><th>Gharama / moja</th><th>Jumla ya gharama</th><th>Bei ya sasa ya kuuza / moja</th><th>Mapato tarajiwa</th><th>Faida tarajiwa</th><th>Tarehe</th></tr></thead>
            <tbody>
              {filteredPurchaseReport.map((item) => <tr key={item.id || `${item.name}-${item.dateAdded}`}>
                <td>{item.name || '—'}</td><td>{item.qty}</td><td>{money(item.unitCost)}</td><td>{money(item.cost)}</td><td>{money(item.latestSellingPrice)}</td><td>{money(item.expectedRevenue)}</td><td>{formatProfit(item.expectedProfit)}</td><td>{item.dateAdded || '—'}</td>
              </tr>)}
              <tr className="total-row"><td>JUMLA</td><td>{totals.purchaseQty}</td><td>—</td><td>{money(totals.purchaseSpend)}</td><td>—</td><td>{money(purchaseReport.reduce((sum, item) => sum + item.expectedRevenue, 0))}</td><td>{formatProfit(totals.expectedPurchaseProfit)}</td><td>—</td></tr>
            </tbody>
          </table></div>
        </section>

        <section className="report-section">
          <div className="section-heading"><div><p className="section-kicker">SALES & PROFIT</p><h2>Ripoti ya mauzo na faida halisi inayokadiriwa</h2><p>Bei ya mauzo ni jumla ya bei iliyoingizwa kwenye mauzo. Gharama hutumia bei ya kununua kwa kipande kutoka rekodi ya manunuzi ya hivi karibuni ya bidhaa.</p></div></div>
          <div className="table-container"><table data-title="Sales and Estimated Profit">
            <thead><tr><th>Bidhaa</th><th>Idadi iliyouzwa</th><th>Mapato ya mauzo</th><th>Gharama / moja</th><th>Gharama ya bidhaa zilizouzwa</th><th>Faida / hasara</th><th>Faida %</th><th>Cash</th><th>Deni</th></tr></thead>
            <tbody>
              {filteredSalesByProduct.map((item) => <tr key={cleanName(item.itemName)}>
                <td>{item.itemName}</td><td>{item.quantity}</td><td>{money(item.revenue)}</td><td>{item.hasCost ? money(item.unitCost) : 'Haijulikani'}</td><td>{item.hasCost ? money(item.costOfGoods) : 'Haijulikani'}</td><td>{item.hasCost ? formatProfit(item.profit) : 'Haijulikani'}</td><td>{item.hasCost ? `${item.margin.toFixed(1)}%` : '—'}</td><td>{money(item.cashRevenue)}</td><td>{money(item.creditRevenue)}</td>
              </tr>)}
              <tr className="total-row"><td>JUMLA</td><td>{totals.salesQty}</td><td>{money(totals.salesRevenue)}</td><td>—</td><td>{money(totals.estimatedCOGS)}</td><td>{formatProfit(totals.grossProfit)}</td><td>{totals.grossMargin.toFixed(1)}%</td><td>{money(totals.cashSales)}</td><td>{money(totals.creditSales)}</td></tr>
            </tbody>
          </table></div>
          {totals.uncostedSales > 0 && <p className="report-note warning-note">Tahadhari: bidhaa {totals.uncostedSales} zilizouzwa hazina rekodi ya manunuzi yenye gharama inayotambulika. Faida yake haiwezi kukokotolewa kwa uhakika.</p>}
        </section>

        <section className="report-section">
          <div className="section-heading"><div><p className="section-kicker">INVENTORY</p><h2>Ripoti ya hali na thamani ya stock</h2><p>Bidhaa zenye stock ya vipande 5 au chini zimewekewa alama ya stock ndogo.</p></div></div>
          <div className="table-container"><table data-title="Stock Valuation and Reorder Watch">
            <thead><tr><th>Bidhaa</th><th>Stock iliyobaki</th><th>Gharama / moja</th><th>Thamani kwa gharama</th><th>Bei ya kuuza / moja</th><th>Thamani ya kuuza</th><th>Faida inayoweza kupatikana</th><th>Hali</th></tr></thead>
            <tbody>
              {filteredStockReport.map((item) => <tr key={cleanName(item.itemName)}>
                <td>{item.itemName}</td><td>{item.remaining}</td><td>{item.hasPrice ? money(item.unitCost) : 'Haijulikani'}</td><td>{item.hasPrice ? money(item.stockCost) : 'Haijulikani'}</td><td>{item.hasPrice ? money(item.unitSell) : 'Haijulikani'}</td><td>{item.hasPrice ? money(item.stockRetail) : 'Haijulikani'}</td><td>{item.hasPrice ? formatProfit(item.potentialProfit) : 'Haijulikani'}</td><td><span className={`stock-status ${item.remaining <= 5 ? 'stock-low' : 'stock-ok'}`}>{item.remaining <= 5 ? 'STOCK NDOGO' : 'Inatosha'}</span></td>
              </tr>)}
              <tr className="total-row"><td>JUMLA</td><td>{totals.stockQty}</td><td>—</td><td>{money(totals.stockCost)}</td><td>—</td><td>{money(totals.stockRetail)}</td><td>{formatProfit(totals.stockPotentialProfit)}</td><td>{totals.lowStockCount} stock ndogo</td></tr>
            </tbody>
          </table></div>
        </section>

        <section className="report-section">
          <div className="section-heading"><div><p className="section-kicker">OTHER TRANSACTIONS</p><h2>Mapato na matumizi mengine</h2></div></div>
          <div className="two-column-tables">
            <div className="table-container"><h3>Mapato mengine</h3><table data-title="Other Income">
              <thead><tr><th>Tarehe</th><th>Kiasi</th><th>Maelezo</th></tr></thead>
              <tbody>{filteredIncome.filter((item) => cleanName(`${item.notes || ''} ${item.note || ''}`).includes(searchQuery)).map((item) => <tr key={item.id}><td>{item.date || item.dateAdded || item.createdAt || '—'}</td><td>{money(item.amount)}</td><td>{item.notes || item.note || '—'}</td></tr>)}
                <tr className="total-row"><td>JUMLA</td><td>{money(totals.otherIncome)}</td><td>—</td></tr></tbody>
            </table></div>
            <div className="table-container"><h3>Matumizi mengine</h3><table data-title="Other Expenses">
              <thead><tr><th>Tarehe</th><th>Kiasi</th><th>Maelezo</th></tr></thead>
              <tbody>{filteredExpenses.filter((item) => cleanName(`${item.notes || ''} ${item.note || ''}`).includes(searchQuery)).map((item) => <tr key={item.id}><td>{item.date || item.dateAdded || item.createdAt || '—'}</td><td>{money(item.amount)}</td><td>{item.notes || item.note || '—'}</td></tr>)}
                <tr className="total-row"><td>JUMLA</td><td>{money(totals.otherExpenses)}</td><td>—</td></tr></tbody>
            </table></div>
          </div>
        </section>

        <section className="report-section">
          <div className="section-heading"><div><p className="section-kicker">DEBT CONTROL</p><h2>Madeni na malipo ya madeni</h2></div></div>
          <div className="metric-grid debt-metrics">
            <article className="metric-card"><span>Wateja wanadaiwa</span><strong>{money(totals.customerOutstanding)}</strong></article>
            <article className="metric-card"><span>Duka linadaiwa</span><strong>{money(totals.supplierOutstanding)}</strong></article>
            <article className="metric-card"><span>Malipo yaliyopokelewa kwa madeni</span><strong>{money(totals.paidToShop)}</strong></article>
            <article className="metric-card"><span>Malipo ya madeni yaliyofanywa na duka</span><strong>{money(totals.paidByShop)}</strong></article>
          </div>
          <div className="two-column-tables">
            <div className="table-container"><h3>Malipo yaliyopokelewa na duka</h3><table data-title="Debt Payments Received by Shop">
              <thead><tr><th>Mlipaji</th><th>Kiasi</th><th>Maelezo</th><th>Tarehe</th><th>Aliyethibitisha</th></tr></thead>
              <tbody>{filteredPayments.filter((p) => p.type === 'Paid To Shop' && cleanName(p.name).includes(searchQuery)).map((p) => <tr key={p.id}><td>{p.name}</td><td>{money(p.amount)}</td><td>{p.note || p.notes || '—'}</td><td>{p.datePaid || p.date || '—'}</td><td>{p.confirmedBy || '—'}</td></tr>)}
                <tr className="total-row"><td>JUMLA</td><td>{money(totals.paidToShop)}</td><td colSpan="3">—</td></tr></tbody>
            </table></div>
            <div className="table-container"><h3>Malipo yaliyofanywa na duka</h3><table data-title="Debt Payments Made by Shop">
              <thead><tr><th>Mhusika</th><th>Kiasi</th><th>Maelezo</th><th>Tarehe</th><th>Aliyethibitisha</th></tr></thead>
              <tbody>{filteredPayments.filter((p) => p.type === 'Paid By Shop' && cleanName(p.name).includes(searchQuery)).map((p) => <tr key={p.id}><td>{p.name}</td><td>{money(p.amount)}</td><td>{p.note || p.notes || '—'}</td><td>{p.datePaid || p.date || '—'}</td><td>{p.confirmedBy || '—'}</td></tr>)}
                <tr className="total-row"><td>JUMLA</td><td>{money(totals.paidByShop)}</td><td colSpan="3">—</td></tr></tbody>
            </table></div>
          </div>
        </section>

        <section className="report-section">
          <div className="section-heading"><div><p className="section-kicker">MANAGEMENT SUMMARY</p><h2>Maelezo muhimu ya meneja</h2></div></div>
          <div className="management-notes">
            <p><strong>Faida ghafi inayokadiriwa:</strong> Mauzo ukitoa gharama ya bidhaa zilizouzwa, kwa kutumia gharama ya ununuzi ya hivi karibuni ya kila bidhaa. Bidhaa zisizo na gharama inayojulikana hazihesabiwi kama faida; hivyo faida inaweza kuwa pungufu hadi rekodi zake ziongezwe.</p>
            <p><strong>Faida ya uendeshaji inayokadiriwa:</strong> Faida ghafi + mapato mengine − matumizi mengine. Haijumuishi kodi, mishahara, au gharama nyingine ambazo hazijaingizwa kwenye mfumo.</p>
            <p><strong>Stock valuation:</strong> Thamani ya stock ni makadirio kwa kutumia rekodi ya manunuzi ya hivi karibuni kwa kila bidhaa; si lazima ilingane na gharama halisi ya kila batch iliyobaki.</p>
            <p><strong>Mtiririko wa fedha:</strong> Ni makadirio yanayotumia mauzo ya cash, malipo yaliyopokelewa kwa madeni, mapato mengine, manunuzi na malipo mengine. Si salio la akaunti na linaweza kutofautiana na fedha halisi kutokana na data zisizo na tarehe au miamala isiyoingizwa.</p>
            <p><strong>Usahihi wa kipindi:</strong> Ukiweka tarehe, miamala yenye tarehe inayosomeka ndiyo inajumuishwa. Hakikisha mapato na matumizi mengine yana tarehe kwenye Firestore ili ripoti za kipindi ziwe sahihi.</p>
          </div>
        </section>
      </>}

      <footer className="report-footer">
        <span>Duka Kiganjani · Ripoti ya usimamizi</span>
        <span>Imetengenezwa: {new Date().toLocaleString()}</span>
      </footer>
    </main>
  );
};

export default Report;
