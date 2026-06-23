import React, { useEffect, useState } from 'react';
import './Dashboard.css';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const Dashboard = () => {
  const [summary, setSummary] = useState({
    dailySales: 0,
    weeklySales: 0,
    monthlySales: 0,
    dailyPurchases: 0,
    weeklyPurchases: 0,
    monthlyPurchases: 0,
    ninaowadai: 0,
    wanaonidai: 0,
  });

  const parseDate = (dateStr) => {
    const [datePart] = dateStr.split(' ');
    if (!datePart) return null;
    const [d, m, y] = datePart.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const getStartOfDay = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };

  const getStartOfWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.getFullYear(), now.getMonth(), diff);
  };

  const getStartOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const fetchData = async () => {
    const [salesSnapshot, purchasesSnapshot, wanaodaiwaSnapshot, wanaonidaiSnapshot] = await Promise.all([
      getDocs(collection(db, 'sales')),
      getDocs(collection(db, 'items')), // ⚠️ keep as is
      getDocs(collection(db, 'wanaodaiwa')),
      getDocs(collection(db, 'wanaonidai')),
    ]);

    const startOfDay = getStartOfDay();
    const startOfWeek = getStartOfWeek();
    const startOfMonth = getStartOfMonth();

    let dailySales = 0;
    let weeklySales = 0;
    let monthlySales = 0;

    let dailyPurchases = 0;
    let weeklyPurchases = 0;
    let monthlyPurchases = 0;

    let ninaowadai = 0;
    let wanaonidai = 0;

    // SALES (Medicine Sales)
    salesSnapshot.forEach(doc => {
      const data = doc.data();
      const date = parseDate(data.date);
      const total = Number(data.price) || 0;
      if (!date) return;

      if (date >= startOfDay) dailySales += total;
      if (date >= startOfWeek) weeklySales += total;
      if (date >= startOfMonth) monthlySales += total;
    });

    // PURCHASES (Medicine Stock)
    purchasesSnapshot.forEach(doc => {
      const data = doc.data();
      const date = parseDate(data.dateAdded);
      const total = Number(data.buyingPrice) || 0;
      if (!date) return;

      if (date >= startOfDay) dailyPurchases += total;
      if (date >= startOfWeek) weeklyPurchases += total;
      if (date >= startOfMonth) monthlyPurchases += total;
    });

    // BALANCES
    wanaodaiwaSnapshot.forEach(doc => {
      const data = doc.data();
      ninaowadai += Number(data.balance || 0);
    });

    wanaonidaiSnapshot.forEach(doc => {
      const data = doc.data();
      wanaonidai += Number(data.balance || 0);
    });

    setSummary({
      dailySales,
      weeklySales,
      monthlySales,
      dailyPurchases,
      weeklyPurchases,
      monthlyPurchases,
      ninaowadai,
      wanaonidai,
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (value) => `Tsh ${value.toLocaleString()}`;

  const summaries = [
    { title: 'Mauzo ya Siku', value: formatCurrency(summary.dailySales) },
    { title: 'Mauzo ya wiki', value: formatCurrency(summary.weeklySales) },
    { title: 'Mauzo ya Mwezi', value: formatCurrency(summary.monthlySales) },
    { title: 'Ununuzi wa Siku', value: formatCurrency(summary.dailyPurchases) },
    { title: 'Manunuzi ya Wiki', value: formatCurrency(summary.weeklyPurchases) },
    { title: 'Manunuzi ya Mwezi', value: formatCurrency(summary.monthlyPurchases) },
    { title: 'Manunuzi ya Mwezi', value: formatCurrency(summary.monthlyPurchases) },
    { title: 'Ninaowadai ', value: formatCurrency(summary.ninaowadai) },
    { title: 'Wanaonidai ', value: formatCurrency(summary.wanaonidai) },
  ];

  return (
    <div className="dashboard">
      <h2 className="dashboard-title">💊 Vivian Medics Dashboard</h2>
      <div className="summary-cards">
        {summaries.map((summary, index) => (
          <div className="card" key={index}>
            <h3>{summary.title}</h3>
            <p>{summary.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;