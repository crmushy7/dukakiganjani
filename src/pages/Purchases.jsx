
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from 'firebase/firestore';
import './Purchases.css';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

import {
  detectColumns,
  readSpreadsheet,
  recognizeImage,
  mapSpreadsheetRows,
  validateImportRows,
  getRecognizedLines
} from '../utils/purchaseImport';

const initialNewItem = {
  name: '',
  buyingPrice: '',
  sellingPrice: '',
  quantity: '',
  category: 'Bidhaa'
};

const importFields = [
  { key: 'name', label: 'Jina la bidhaa', required: true },
  { key: 'quantity', label: 'Idadi', required: true },
  { key: 'buyingPrice', label: 'Bei ya kununua', required: true },
  { key: 'sellingPrice', label: 'Bei ya kuuza', required: true },
  { key: 'category', label: 'Kundi', required: false }
];

const formatDateTime = () => {
  const now = new Date();

  return `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()} ${now
    .getHours()}:${String(now.getMinutes()).padStart(2, '0')}Hrs`;
};

const Purchases = () => {
  const [items, setItems] = useState([]);
  const [groupedItems, setGroupedItems] = useState({});
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');

  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [newItem, setNewItem] = useState(initialNewItem);

  const [editItem, setEditItem] = useState(null);
  const [showEditItemDialog, setShowEditItemDialog] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [addingId, setAddingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [medicineSuggestions, setMedicineSuggestions] = useState([]);
  const [allMedicineNames, setAllMedicineNames] = useState([]);

  // Import state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importMode, setImportMode] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importHeaders, setImportHeaders] = useState([]);
  const [importRawRows, setImportRawRows] = useState([]);
  const [importColumns, setImportColumns] = useState({});
  const [importRows, setImportRows] = useState([]);
  const [ocrText, setOcrText] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSaving, setImportSaving] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    filterItems();
  }, [searchQuery, category, items, startDate, endDate]);

  const fetchItems = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'items'));

      const itemsList = querySnapshot.docs.map(snapshot => ({
        ...snapshot.data(),
        id: snapshot.id
      }));

      const dateValue = value => {
        const datePart = String(value || '').split(' ')[0];
        const parts = datePart.split('-');

        if (parts.length !== 3) return new Date(0);

        const [day, month, year] = parts;
        return new Date(Number(year), Number(month) - 1, Number(day));
      };

      itemsList.sort(
        (a, b) => dateValue(b.dateAdded) - dateValue(a.dateAdded)
      );

      setItems(itemsList);

      const uniqueMedicines = [];

      itemsList.forEach(item => {
        const name = String(item.name || '');

        const exists = uniqueMedicines.find(
          med => med.name.toLowerCase() === name.toLowerCase()
        );

        if (!exists) {
          uniqueMedicines.push({
            name,
            sellingPrice: item.sellingPrice,
            category: item.category
          });
        }
      });

      setAllMedicineNames(uniqueMedicines);
    } catch (error) {
      console.error('Error fetching items:', error);
      alert('Imeshindikana kusoma bidhaa. Tafadhali jaribu tena.');
    }
  };

  const handleMedicineInput = value => {
    setNewItem(previous => ({ ...previous, name: value }));

    if (!value.trim()) {
      setMedicineSuggestions([]);
      return;
    }

    const filtered = allMedicineNames.filter(med =>
      med.name.toLowerCase().includes(value.toLowerCase())
    );

    setMedicineSuggestions(filtered);
  };

  const groupByDate = list => {
    const groups = {};

    list.forEach(item => {
      const date = String(item.dateAdded || '').split(' ')[0] || 'Unknown date';

      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });

    return groups;
  };

  const filterItems = () => {
    let filtered = [...items];

    if (category !== 'all') {
      filtered = filtered.filter(item => item.category === category);
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(item =>
        String(item.name || '')
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase())
      );
    }

    if (startDate) {
      filtered = filtered.filter(item => {
        const parts = String(item.dateAdded || '')
          .split(' ')[0]
          .split('-');

        if (parts.length !== 3) return false;

        const itemDate = new Date(
          Number(parts[2]),
          Number(parts[1]) - 1,
          Number(parts[0])
        );

        return itemDate >= new Date(`${startDate}T00:00:00`);
      });
    }

    if (endDate) {
      filtered = filtered.filter(item => {
        const parts = String(item.dateAdded || '')
          .split(' ')[0]
          .split('-');

        if (parts.length !== 3) return false;

        const itemDate = new Date(
          Number(parts[2]),
          Number(parts[1]) - 1,
          Number(parts[0])
        );

        return itemDate <= new Date(`${endDate}T23:59:59`);
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
      ...filteredItems.map(item => [
        item.name,
        item.quantity,
        item.buyingPrice,
        item.sellingPrice,
        item.dateAdded
      ])
    ];

    const escapeCSV = value => {
      const text = String(value ?? '');
      return `"${text.replace(/"/g, '""')}"`;
    };

    const csvContent = csvRows
      .map(row => row.map(escapeCSV).join(','))
      .join('\r\n');

    const blob = new Blob(['\uFEFF', csvContent], {
      type: 'text/csv;charset=utf-8;'
    });

    saveAs(blob, 'Purchases.csv');
  };

  const chartData = Object.entries(groupedItems).map(([date, dateItems]) => ({
    date,
    quantity: dateItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    ),
    value: dateItems.reduce(
      (sum, item) => sum + (Number(item.buyingPrice) || 0),
      0
    )
  }));

  const updateItemCounter = async (itemName, quantityAdded) => {
    const counterId = itemName.toLowerCase().trim();
    const itemRef = doc(db, 'ItemCounter', counterId);
    const itemSnap = await getDoc(itemRef);

    if (itemSnap.exists()) {
      const current = Number(itemSnap.data().remaining) || 0;

      await updateDoc(itemRef, {
        itemName: counterId,
        remaining: current + Number(quantityAdded)
      });
    } else {
      await setDoc(itemRef, {
        itemName: counterId,
        remaining: Number(quantityAdded)
      });
    }
  };

  const handleAddItem = async () => {
    const { name, buyingPrice, sellingPrice, quantity, category } = newItem;

    const parsedBuying = Number(buyingPrice);
    const parsedSelling = Number(sellingPrice);
    const parsedQty = Number(quantity);

    if (
      !name.trim() ||
      !Number.isFinite(parsedBuying) ||
      !Number.isFinite(parsedSelling) ||
      !Number.isInteger(parsedQty) ||
      parsedBuying <= 0 ||
      parsedSelling <= 0 ||
      parsedQty <= 0
    ) {
      alert('Tafadhali jaza jina, idadi na bei zote kwa usahihi.');
      return;
    }

    if (parsedSelling <= parsedBuying / parsedQty) {
      alert(
        `Bei ya kuuza lazima izidi gharama ya kununua kwa kipimo: ${parsedBuying / parsedQty}`
      );
      return;
    }

    setLoading(true);

    try {
      const docRef = await addDoc(collection(db, 'items'), {
        name: name.trim(),
        category,
        quantity: parsedQty,
        buyingPrice: parsedBuying,
        sellingPrice: parsedSelling,
        total: parsedBuying,
        dateAdded: formatDateTime()
      });

      await updateItemCounter(name, parsedQty);

      setAddingId(docRef.id);
      setTimeout(() => setAddingId(null), 400);

      setNewItem(initialNewItem);
      setMedicineSuggestions([]);
      setShowAddItemDialog(false);

      await fetchItems();
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Imeshindikana kuongeza bidhaa. Tafadhali jaribu tena.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!editItem) return;

    const quantity = Number(editItem.quantity);
    const buyingPrice = Number(editItem.buyingPrice);
    const sellingPrice = Number(editItem.sellingPrice);

    if (
      !String(editItem.name || '').trim() ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(buyingPrice) ||
      buyingPrice <= 0 ||
      !Number.isFinite(sellingPrice) ||
      sellingPrice <= buyingPrice / quantity
    ) {
      alert('Tafadhali hakikisha jina, idadi na bei ni sahihi.');
      return;
    }

    setLoading(true);

    try {
      await updateDoc(doc(db, 'items', editItem.id), {
        name: editItem.name.trim(),
        buyingPrice,
        sellingPrice,
        quantity,
        category: editItem.category
      });

      setShowEditItemDialog(false);
      setEditItem(null);

      await fetchItems();
    } catch (error) {
      console.error('Kuna hitilafu:', error);
      alert('Imeshindikana kusasisha item. Tafadhali jaribu tena.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (id, name) => {
    if (!window.confirm(`Una uhakika unataka kufuta ${name}?`)) return;

    setRemovingId(id);
    setLoading(true);

    try {
      await deleteDoc(doc(db, 'items', id));
      await fetchItems();
    } catch (error) {
      console.error('Kuna hitilafu:', error);
      alert('Imeshindikana kufuta item. Tafadhali jaribu tena.');
    } finally {
      setRemovingId(null);
      setLoading(false);
    }
  };

  // ---------- IMPORT WORKFLOW ----------

  const resetImport = () => {
    setImportMode('');
    setImportFileName('');
    setImportHeaders([]);
    setImportRawRows([]);
    setImportColumns({});
    setImportRows([]);
    setOcrText('');
    setOcrProgress(0);
    setImportLoading(false);
    setImportError('');
    setImportSaving(false);
  };

  const openImportDialog = () => {
    resetImport();
    setShowImportDialog(true);
  };

  const closeImportDialog = () => {
    if (importLoading || importSaving) return;

    setShowImportDialog(false);
    resetImport();
  };

  // Give every preview row a stable identity so deleting a row cannot
  // accidentally change which row an input edits.
  const createImportRowId = () =>
    `import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const prepareImportRows = rows =>
    rows.map(row => ({
      ...row,
      _importId: row._importId || createImportRowId()
    }));

  const handleAddImportRow = () => {
    setImportRows(previous => [
      ...previous,
      {
        _importId: createImportRowId(),
        rowNumber: previous.length + 1,
        name: '',
        quantity: '',
        buyingPrice: '',
        sellingPrice: '',
        category: 'Bidhaa'
      }
    ]);
  };

  const handleDeleteImportRow = row => {
    if (importSaving || importLoading) return;

    const productName = String(row.name || '').trim();
    const description = productName
      ? `bidhaa "${productName}"`
      : 'safu hii';

    const confirmed = window.confirm(
      `Una uhakika unataka kufuta ${description} kwenye orodha ya bidhaa zinazoingizwa?`
    );

    if (!confirmed) return;

    setImportRows(previous =>
      previous.filter(item => item._importId !== row._importId)
    );
  };

  const buildRowsFromOCR = text => {
    const lines = getRecognizedLines(text);

    const rows = lines.map((line, index) => {
      const parts = line
        .split(/\t+|\s*\|\s*|;|\s{2,}/)
        .map(part => part.trim())
        .filter(Boolean);

      if (parts.length >= 3) {
        return {
          rowNumber: index + 1,
          name: parts[0] || '',
          quantity: parts[1] || '',
          buyingPrice: parts[2] || '',
          sellingPrice: parts[3] || '',
          category: parts[4] || 'Bidhaa'
        };
      }

      return {
        rowNumber: index + 1,
        name: line,
        quantity: '',
        buyingPrice: '',
        sellingPrice: '',
        category: 'Bidhaa'
      };
    });

    setImportRows(prepareImportRows(rows));
  };

  const handleImportFile = async event => {
    const file = event.target.files?.[0];

    // Allow selecting the same file again later.
    event.target.value = '';

    if (!file) return;

    resetImport();
    setImportFileName(file.name);
    setImportLoading(true);

    try {
      const lowerName = file.name.toLowerCase();
      const isImage =
        file.type.startsWith('image/') ||
        /\.(png|jpe?g|webp|bmp|tiff?)$/.test(lowerName);

      if (isImage) {
        setImportMode('image');

        const result = await recognizeImage(file, setOcrProgress);

        setOcrText(result.text);
        buildRowsFromOCR(result.text);

        if (!result.text.trim()) {
          setImportError(
            'Hakukutambua maandishi yoyote kwenye picha. Hakikisha picha ina maandishi wazi na jaribu tena.'
          );
        }
      } else if (/\.(xlsx|xls|csv)$/.test(lowerName)) {
        setImportMode('spreadsheet');

        const result = await readSpreadsheet(file);
        const detectedColumns = detectColumns(result.headers);

        setImportHeaders(result.headers);
        setImportRawRows(result.rows);
        setImportColumns(detectedColumns);
        setImportRows(
          prepareImportRows(
            mapSpreadsheetRows(result.rows, detectedColumns)
          )
        );

        if (!result.rows.length) {
          setImportError(
            'Hakuna rekodi yoyote kwenye faili. Tafadhali hakikisha faili ina data sahihi.'
          );
        }
      } else {
        throw new Error(
          'Faili hii haiwezi kutumika. Tafadhali chagua picha au faili ya Excel/CSV.'
        );
      }
    } catch (error) {
      console.error('Import file error:', error);
      setImportError(
        error.message || 'Imeshindikana kusoma faili. Tafadhali jaribu tena.'
      );
    } finally {
      setImportLoading(false);
    }
  };

  const handleColumnChange = (field, value) => {
    const columnIndex = value === '' ? -1 : Number(value);

    const updatedColumns = {
      ...importColumns,
      [field]: columnIndex
    };

    setImportColumns(updatedColumns);
    setImportRows(
      prepareImportRows(
        mapSpreadsheetRows(importRawRows, updatedColumns)
      )
    );
  };

  const updateImportRow = (rowId, field, value) => {
    setImportRows(previous =>
      previous.map(row =>
        row._importId === rowId
          ? { ...row, [field]: value }
          : row
      )
    );
  };

  const validatedImportRows = validateImportRows(importRows);
  const invalidRows = validatedImportRows.filter(
    row => row.errors.length > 0
  );

  const handleSaveImport = async () => {
    if (importSaving || importLoading) return;

    if (!importRows.length) {
      alert('Hakuna rekodi za kuingiza.');
      return;
    }

    const checkedRows = validateImportRows(importRows);
    const invalid = checkedRows.filter(row => row.errors.length > 0);

    if (invalid.length > 0) {
      alert(
        `Kuna rekodi ${invalid.length} zenye makosa. Rekebisha sehemu zilizoonyeshwa kabla ya kuhifadhi.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Una uhakika unataka kuhifadhi rekodi ${checkedRows.length}? Kila rekodi itahifadhiwa kama delivery tofauti.`
    );

    if (!confirmed) return;

    setImportSaving(true);
    setImportError('');

    let savedCount = 0;

    try {
      for (const row of checkedRows) {
        const name = String(row.name).trim();
        const quantity = Number(row.quantity);
        const buyingPrice = Number(row.buyingPrice);
        const sellingPrice = Number(row.sellingPrice);
        const itemCategory = String(row.category || 'Bidhaa').trim();

        // Each imported row creates a separate purchase record.
        await addDoc(collection(db, 'items'), {
          name,
          category: itemCategory || 'Bidhaa',
          quantity,
          buyingPrice,
          sellingPrice,
          total: buyingPrice,
          dateAdded: formatDateTime()
        });

        savedCount++;

        // Keep the existing stock counter updated.
        await updateItemCounter(name, quantity);
      }

      await fetchItems();

      setShowImportDialog(false);
      resetImport();

      alert(`Import imekamilika. Rekodi zilizohifadhiwa: ${savedCount}.`);
    } catch (error) {
      console.error('Import save error:', error);

      setImportError(
        `Import imesimama baada ya kuhifadhi rekodi ${savedCount}. ` +
          'Baadhi ya rekodi zinaweza kuwa tayari zimehifadhiwa. ' +
          'Usirudie import nzima bila kuangalia orodha ya Manunuzi kwanza. ' +
          (error.message || '')
      );

      await fetchItems();
    } finally {
      setImportSaving(false);
    }
  };

  const renderColumnMapping = () => (
    <div style={styles.mappingGrid}>
      {importFields.map(field => (
        <label key={field.key} style={styles.fieldLabel}>
          {field.label}
          {field.required ? ' *' : ''}

          <select
            value={
              importColumns[field.key] >= 0
                ? String(importColumns[field.key])
                : ''
            }
            onChange={event =>
              handleColumnChange(field.key, event.target.value)
            }
          >
            <option value="">-- Haijaoneshwa --</option>

            {importHeaders.map((header, index) => (
              <option key={`${header}-${index}`} value={index}>
                {header || `Column ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );

  const renderImportPreview = () => (
    <section style={styles.previewSection}>
      <div style={styles.previewHeading}>
        <div>
          <h3 style={{ margin: '0 0 5px' }}>Hakikisha data zako</h3>
          <p style={{ ...styles.helperText, margin: 0 }}>
            Badilisha taarifa moja kwa moja kwenye jedwali. Unaweza kuongeza
            au kufuta safu kabla ya kuhifadhi. Sehemu zenye rangi nyekundu
            zinahitaji marekebisho.
          </p>
        </div>

        <div style={styles.previewSummary}>
          <span style={styles.summaryChip}>
            Safu {importRows.length}
          </span>

          <span
            style={{
              ...styles.summaryChip,
              ...(invalidRows.length
                ? styles.summaryChipError
                : styles.summaryChipSuccess)
            }}
          >
            {invalidRows.length
              ? `Safu ${invalidRows.length} zinahitaji marekebisho`
              : 'Safu zote ziko tayari kuhifadhiwa'}
          </span>
        </div>
      </div>

      <div style={styles.previewScroll}>
        <table style={styles.previewTable}>
          <colgroup>
            <col style={{ width: 55 }} />
            <col style={{ width: 240 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 175 }} />
            <col style={{ width: 175 }} />
            <col style={{ width: 145 }} />
            <col style={{ width: 250 }} />
            <col style={{ width: 100 }} />
          </colgroup>

          <thead>
            <tr>
              <th style={styles.previewHeader}>SN</th>
              <th style={styles.previewHeader}>Jina la bidhaa</th>
              <th style={styles.previewHeader}>Idadi</th>
              <th style={styles.previewHeader}>Bei ya jumla kununua</th>
              <th style={styles.previewHeader}>Bei ya kuuza kimoja</th>
              <th style={styles.previewHeader}>Kundi</th>
              <th style={styles.previewHeader}>Uthibitishaji</th>
              <th style={styles.previewHeader}>Kitendo</th>
            </tr>
          </thead>

          <tbody>
            {validatedImportRows.map((row, index) => {
              const hasErrors = row.errors.length > 0;

              return (
                <tr
                  key={row._importId}
                  style={{
                    background: hasErrors
                      ? 'rgba(220, 53, 69, 0.055)'
                      : index % 2 === 0
                        ? 'var(--card-background, #fff)'
                        : 'var(--preview-alt-background, #f7f9fc)'
                  }}
                >
                  <td style={styles.previewNumberCell}>
                    {index + 1}
                  </td>

                  <td style={styles.previewCell}>
                    <input
                      style={{
                        ...styles.previewInput,
                        ...(hasErrors && !String(row.name || '').trim()
                          ? styles.previewInputError
                          : {})
                      }}
                      value={row.name ?? ''}
                      onChange={event =>
                        updateImportRow(
                          row._importId,
                          'name',
                          event.target.value
                        )
                      }
                      aria-label={`Jina la bidhaa, safu ${index + 1}`}
                      disabled={importSaving}
                    />
                  </td>

                  <td style={styles.previewCell}>
                    <input
                      style={{
                        ...styles.previewInput,
                        ...styles.numericInput,
                        ...(hasErrors &&
                        (!Number.isInteger(Number(row.quantity)) ||
                          Number(row.quantity) <= 0)
                          ? styles.previewInputError
                          : {})
                      }}
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity ?? ''}
                      onChange={event =>
                        updateImportRow(
                          row._importId,
                          'quantity',
                          event.target.value
                        )
                      }
                      aria-label={`Idadi, safu ${index + 1}`}
                      disabled={importSaving}
                    />
                  </td>

                  <td style={styles.previewCell}>
                    <input
                      style={{
                        ...styles.previewInput,
                        ...styles.numericInput,
                        ...(hasErrors &&
                        (!Number.isFinite(Number(row.buyingPrice)) ||
                          Number(row.buyingPrice) <= 0)
                          ? styles.previewInputError
                          : {})
                      }}
                      type="number"
                      min="0.01"
                      step="any"
                      value={row.buyingPrice ?? ''}
                      onChange={event =>
                        updateImportRow(
                          row._importId,
                          'buyingPrice',
                          event.target.value
                        )
                      }
                      aria-label={`Bei ya kununua, safu ${index + 1}`}
                      disabled={importSaving}
                    />
                  </td>

                  <td style={styles.previewCell}>
                    <input
                      style={{
                        ...styles.previewInput,
                        ...styles.numericInput,
                        ...(hasErrors &&
                        (!Number.isFinite(Number(row.sellingPrice)) ||
                          Number(row.sellingPrice) <=
                            Number(row.buyingPrice) / Number(row.quantity))
                          ? styles.previewInputError
                          : {})
                      }}
                      type="number"
                      min="0.01"
                      step="any"
                      value={row.sellingPrice ?? ''}
                      onChange={event =>
                        updateImportRow(
                          row._importId,
                          'sellingPrice',
                          event.target.value
                        )
                      }
                      aria-label={`Bei ya kuuza, safu ${index + 1}`}
                      disabled={importSaving}
                    />
                  </td>

                  <td style={styles.previewCell}>
                    <input
                      style={styles.previewInput}
                      value={row.category ?? 'Bidhaa'}
                      onChange={event =>
                        updateImportRow(
                          row._importId,
                          'category',
                          event.target.value
                        )
                      }
                      aria-label={`Kundi, safu ${index + 1}`}
                      disabled={importSaving}
                    />
                  </td>

                  <td style={styles.previewValidationCell}>
                    {hasErrors ? (
                      <div style={styles.validationError}>
                        {row.errors.map((error, errorIndex) => (
                          <div key={errorIndex}>{error}</div>
                        ))}
                      </div>
                    ) : (
                      <span style={styles.validationSuccess}>
                        ✓ Tayari
                      </span>
                    )}
                  </td>

                  <td style={styles.previewActionCell}>
                    <button
                      type="button"
                      style={styles.previewDeleteButton}
                      onClick={() => handleDeleteImportRow(row)}
                      disabled={importSaving || importLoading}
                      title="Futa safu hii"
                      aria-label={`Futa safu ya ${index + 1}`}
                    >
                      <span aria-hidden="true">−</span>
                      <span>Futa</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={styles.previewFooter}>
        <div>
          <strong>Jumla ya safu: {importRows.length}</strong>

          <div style={{ marginTop: 5 }}>
            {invalidRows.length
              ? `Safu ${invalidRows.length} zinahitaji marekebisho kabla ya kuhifadhi.`
              : 'Safu zote ziko tayari kuhifadhiwa.'}
          </div>
        </div>

        <button
          type="button"
          style={styles.previewAddButton}
          onClick={handleAddImportRow}
          disabled={importSaving || importLoading}
        >
          <span aria-hidden="true">+</span> Ongeza Safu
        </button>
      </div>
    </section>
  );

  return (
    <>
      <div className="purchases">
        {loading && (
          <div className="loader-overlay">
            <div className="loading-box">
              <div className="loader"></div>
              <p>Saving...</p>
            </div>
          </div>
        )}

        <h1 className="headertu" style={{ animationDelay: '0s' }}>
          Duka Kiganjani Purchases
        </h1>

        <div
          className="controls animated-section"
          style={{ animationDelay: '0.1s' }}
        >
          <input
            type="text"
            placeholder="Tafuta bidhaa..."
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
          />

          <select
            value={category}
            onChange={event => setCategory(event.target.value)}
          >
            <option value="all">All</option>
            <option value="Bidhaa">Bidhaa</option>
            <option value="Vinywaji">Vinywaji</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={event => setStartDate(event.target.value)}
          />

          <input
            type="date"
            value={endDate}
            onChange={event => setEndDate(event.target.value)}
          />

          <button className="btn colored" onClick={exportToExcel}>
            Export to Excel
          </button>

          <button className="btn colored" onClick={exportToCSV}>
            Export to CSV
          </button>

          <button className="btn colored" onClick={openImportDialog}>
            Import Purchases
          </button>
        </div>

        {Object.entries(groupedItems).map(([date, dateItems], index) => (
          <div
            key={date}
            className="group animated-section"
            style={{ animationDelay: `${0.2 + index * 0.1}s` }}
          >
            <h3>{date}</h3>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Qty</th>
                    <th>Buying Price</th>
                    <th>Price per Item</th>
                    <th>Selling per Item</th>
                    <th>Profit</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {dateItems.map(item => (
                    <tr
                      key={item.id}
                      className={`${
                        addingId === item.id ? 'fade-in' : ''
                      } ${removingId === item.id ? 'fade-out' : ''}`}
                    >
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>
                        {Number(item.buyingPrice || 0).toLocaleString()}
                      </td>
                      <td>
                        {item.quantity
                          ? (
                              Number(item.buyingPrice || 0) /
                              Number(item.quantity)
                            ).toFixed(0)
                          : '—'}
                      </td>
                      <td>
                        {Number(item.sellingPrice || 0).toLocaleString()}
                      </td>
                      <td>
                        {(
                          (
                            Number(item.sellingPrice || 0) -
                            Number(item.buyingPrice || 0) /
                              Number(item.quantity || 1)
                          ) * Number(item.quantity || 0)
                        ).toLocaleString()}
                      </td>

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
            </div>

            <p>
              <strong>Daily Total (Buying): </strong>
              {dateItems
                .reduce(
                  (sum, item) => sum + Number(item.buyingPrice || 0),
                  0
                )
                .toLocaleString()}{' '}
              Tsh
            </p>
          </div>
        ))}

        {chartData.length > 0 && (
          <div
            className="chart-container animated-section"
            style={{
              animationDelay: `${
                0.2 + Object.entries(groupedItems).length * 0.1
              }s`
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
                <Bar
                  dataKey="value"
                  fill="#82ca9d"
                  name="Total Buying Value (Tsh)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ADD ITEM DIALOG */}
        {showAddItemDialog && (
          <div className="dialog-overlay">
            <div className="dialog scale-in">
              <h3>Add New Item</h3>

              <div className="medicine-input-wrapper">
                <input
                  type="text"
                  placeholder="Product name"
                  value={newItem.name}
                  onChange={event => handleMedicineInput(event.target.value)}
                />

                {medicineSuggestions.length > 0 && (
                  <ul className="suggestion-list animated-section">
                    {medicineSuggestions.map((medicine, index) => (
                      <li
                        key={`${medicine.name}-${index}`}
                        onClick={() => {
                          setNewItem(previous => ({
                            ...previous,
                            name: medicine.name,
                            sellingPrice: medicine.sellingPrice,
                            category: medicine.category || 'Bidhaa'
                          }));

                          setMedicineSuggestions([]);
                        }}
                      >
                        {medicine.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <input
                type="number"
                placeholder="Total Buying Price"
                value={newItem.buyingPrice}
                onChange={event =>
                  setNewItem(previous => ({
                    ...previous,
                    buyingPrice: event.target.value
                  }))
                }
              />

              <input
                type="number"
                placeholder="Selling Price per Item"
                value={newItem.sellingPrice}
                onChange={event =>
                  setNewItem(previous => ({
                    ...previous,
                    sellingPrice: event.target.value
                  }))
                }
              />

              <input
                type="number"
                placeholder="Quantity"
                value={newItem.quantity}
                onChange={event =>
                  setNewItem(previous => ({
                    ...previous,
                    quantity: event.target.value
                  }))
                }
              />

              <select
                value={newItem.category}
                onChange={event =>
                  setNewItem(previous => ({
                    ...previous,
                    category: event.target.value
                  }))
                }
              >
                <option value="Bidhaa">Bidhaa</option>
                <option value="Vinywaji">Vinywaji</option>
              </select>

              <div className="dialog-actions">
                <button
                  className="btn colored"
                  onClick={handleAddItem}
                  disabled={loading}
                >
                  Add
                </button>

                <button
                  className="btn"
                  onClick={() => setShowAddItemDialog(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EDIT ITEM DIALOG */}
        {showEditItemDialog && editItem && (
          <div
            className="modal-overlay"
            onClick={() => setShowEditItemDialog(false)}
          >
            <div
              className="modal-content slide-in"
              onClick={event => event.stopPropagation()}
            >
              <h3>Edit Item</h3>

              <input
                type="text"
                value={editItem.name}
                onChange={event =>
                  setEditItem({ ...editItem, name: event.target.value })
                }
              />

              <input
                type="number"
                value={editItem.buyingPrice}
                onChange={event =>
                  setEditItem({
                    ...editItem,
                    buyingPrice: event.target.value
                  })
                }
              />

              <input
                type="number"
                value={editItem.sellingPrice}
                onChange={event =>
                  setEditItem({
                    ...editItem,
                    sellingPrice: event.target.value
                  })
                }
              />

              <input
                type="number"
                value={editItem.quantity}
                onChange={event =>
                  setEditItem({ ...editItem, quantity: event.target.value })
                }
              />

              <select
                value={editItem.category || 'Bidhaa'}
                onChange={event =>
                  setEditItem({ ...editItem, category: event.target.value })
                }
              >
                <option value="Bidhaa">Bidhaa</option>
                <option value="Vinywaji">Vinywaji</option>
              </select>

              <div className="dialog-actions">
                <button
                  className="btn colored"
                  onClick={handleUpdateItem}
                  disabled={loading}
                >
                  Save
                </button>

                <button
                  className="btn danger"
                  onClick={() => {
                    setShowEditItemDialog(false);
                    setEditItem(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* IMPORT DIALOG */}
        {showImportDialog && (
          <div style={styles.overlay}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="purchase-import-title"
              style={styles.importDialog}
            >
              <h2 id="purchase-import-title">Ingiza Manunuzi</h2>

              <p style={styles.helperText}>
                Chagua faili la Excel, CSV, au picha ya risiti ya msambazaji
                au orodha ya manunuzi iliyoandikwa kwa mkono.
              </p>

              <label style={styles.uploadLabel}>
                <span>Chagua faili</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,image/*"
                  onChange={handleImportFile}
                  disabled={importLoading || importSaving}
                  style={{ display: 'block', marginTop: 8 }}
                />
              </label>

              {importFileName && (
                <p style={styles.helperText}>
                  Faili lililochaguliwa: <strong>{importFileName}</strong>
                </p>
              )}

              {importLoading && (
                <div style={styles.statusBox}>
                  {importMode === 'image'
                    ? `Inasoma maandishi kwenye picha... ${ocrProgress}%`
                    : 'Inasoma faili...'}
                  <div style={styles.progressTrack}>
                    <div
                      style={{
                        ...styles.progressBar,
                        width: `${
                          importMode === 'image' ? ocrProgress : 100
                        }%`
                      }}
                    />
                  </div>
                </div>
              )}

              {importError && (
                <div role="alert" style={styles.errorBox}>
                  {importError}
                </div>
              )}

              {importMode === 'spreadsheet' && importHeaders.length > 0 && (
                <>
                  <h3>Linganishia safu za faili</h3>
                  <p style={styles.helperText}>
                    Chagua kichwa cha safu kinacholingana na kila taarifa ya
                    bidhaa. Sehemu zenye nyota (*) ni lazima zijazwe.
                  </p>
                  {renderColumnMapping()}
                </>
              )}

              {importMode === 'image' && ocrText && (
                <div style={styles.ocrSection}>
                  <h3>Maandishi yaliyotambuliwa</h3>

                  <p style={styles.helperText}>
                    Mfumo unaweza kukosea kutambua maandishi kwenye picha.
                    Hakikisha maandishi ni sahihi na uyarekebishe inapohitajika.
                  </p>

                  <textarea
                    rows={7}
                    value={ocrText}
                    onChange={event => setOcrText(event.target.value)}
                    style={styles.ocrTextarea}
                    disabled={importSaving}
                  />

                  <button
                    className="btn"
                    type="button"
                    onClick={() => buildRowsFromOCR(ocrText)}
                    disabled={importSaving}
                  >
                    Tengeneza upya orodha ya bidhaa
                  </button>
                </div>
              )}

              {importRows.length > 0 && renderImportPreview()}

              <div style={styles.dialogActions}>
                <button
                  className="btn colored"
                  onClick={handleSaveImport}
                  disabled={
                    importLoading ||
                    importSaving ||
                    importRows.length === 0 ||
                    invalidRows.length > 0
                  }
                >
                  {importSaving
                    ? 'Inahifadhi manunuzi...'
                    : `Thibitisha na Hifadhi (${importRows.length})`}
                </button>

                <button
                  className="btn danger"
                  onClick={closeImportDialog}
                  disabled={importLoading || importSaving}
                >
                  Funga
                </button>
              </div>

              {importSaving && (
                <p style={styles.helperText}>
                  Tafadhali subiri, bidhaa zinaingizwa kwenye hifadhidata.
                  Usifunge au kuondoa dirisha hili.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <button
        className="add-item-button colored animated-section"
        style={{
          animationDelay: `${
            0.3 + Object.entries(groupedItems).length * 0.1
          }s`
        }}
        onClick={() => setShowAddItemDialog(true)}
        aria-label="Add item"
      >
        +
      </button>
    </>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  importDialog: {
    background: 'var(--card-background, #fff)',
    color: 'var(--text-color, #222)',
    borderRadius: 12,
    padding: 22,
    width: 'min(1500px, calc(100vw - 32px))',
    maxHeight: '94vh',
    overflowY: 'auto',
    overflowX: 'hidden',
    boxSizing: 'border-box',
    boxShadow: '0 12px 45px rgba(0,0,0,0.3)'
  },
  helperText: {
    fontSize: 13,
    lineHeight: 1.5,
    opacity: 0.8
  },
  uploadLabel: {
    display: 'block',
    padding: 14,
    border: '1px dashed #999',
    borderRadius: 8,
    margin: '14px 0'
  },
  mappingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
    marginBottom: 18
  },
  fieldLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 13
  },

  previewSection: {
    marginTop: 22,
    width: '100%',
    minWidth: 0
  },
  previewHeading: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14
  },
  previewSummary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center'
  },
  summaryChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 11px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    background: 'var(--preview-alt-background, #f1f4f8)'
  },
  summaryChipSuccess: {
    color: '#176b38',
    background: '#e6f6eb'
  },
  summaryChipError: {
    color: '#a51d2d',
    background: '#fdebed'
  },
  previewScroll: {
    width: '100%',
    maxHeight: '48vh',
    minHeight: 180,
    overflow: 'auto',
    border: '1px solid var(--border-color, #d9dee7)',
    borderRadius: 10,
    background: 'var(--card-background, #fff)',
    overscrollBehavior: 'contain'
  },
  previewTable: {
    width: '100%',
    minWidth: 1250,
    tableLayout: 'fixed',
    borderCollapse: 'separate',
    borderSpacing: 0,
    fontSize: 13,
    textAlign: 'left'
  },
  previewHeader: {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    padding: '13px 10px',
    background: 'var(--preview-header-background, #edf1f7)',
    color: 'var(--text-color, #222)',
    borderBottom: '2px solid var(--border-color, #d5dce6)',
    fontWeight: 700,
    whiteSpace: 'normal',
    lineHeight: 1.4,
    verticalAlign: 'middle'
  },
  previewNumberCell: {
    padding: '10px 8px',
    textAlign: 'center',
    verticalAlign: 'middle',
    color: 'var(--muted-text-color, #687386)',
    borderBottom: '1px solid var(--border-color, #e5e9f0)',
    fontVariantNumeric: 'tabular-nums'
  },
  previewCell: {
    padding: '7px 8px',
    verticalAlign: 'middle',
    borderBottom: '1px solid var(--border-color, #e5e9f0)'
  },
  previewInput: {
    display: 'block',
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    height: 38,
    boxSizing: 'border-box',
    margin: 0,
    padding: '8px 9px',
    border: '1px solid var(--border-color, #ccd3df)',
    borderRadius: 6,
    background: 'var(--input-background, #fff)',
    color: 'var(--text-color, #222)',
    fontFamily: 'inherit',
    fontSize: 13,
    lineHeight: 1.3,
    outlineOffset: 1
  },
  numericInput: {
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums'
  },
  previewInputError: {
    border: '1px solid #d93025',
    background: 'var(--preview-error-background, #fff4f3)'
  },
  previewValidationCell: {
    padding: '9px 10px',
    verticalAlign: 'middle',
    borderBottom: '1px solid var(--border-color, #e5e9f0)',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    lineHeight: 1.5
  },
  validationSuccess: {
    display: 'inline-block',
    color: '#16803c',
    fontWeight: 700,
    fontSize: 12
  },
  validationError: {
    color: '#b42318',
    fontSize: 12,
    lineHeight: 1.5
  },
  previewActionCell: {
    padding: '7px 10px',
    textAlign: 'center',
    verticalAlign: 'middle',
    borderBottom: '1px solid var(--border-color, #e5e9f0)'
  },
  previewDeleteButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: '7px 10px',
    border: '1px solid #dc3545',
    borderRadius: 6,
    background: '#fff0f0',
    color: '#b42318',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  previewAddButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 15px',
    border: '1px solid #198754',
    borderRadius: 7,
    background: '#198754',
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  previewFooter: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 2px',
    fontSize: 12,
    opacity: 0.9
  },

  statusBox: {
    padding: 12,
    background: '#f0f4f8',
    borderRadius: 8,
    margin: '12px 0'
  },
  progressTrack: {
    width: '100%',
    height: 6,
    background: '#ddd',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 10
  },
  progressBar: {
    height: '100%',
    background: '#2878d0',
    transition: 'width 0.2s ease'
  },
  errorBox: {
    background: '#fff0f0',
    color: '#9b1c1c',
    padding: 12,
    borderRadius: 8,
    margin: '12px 0',
    overflowWrap: 'anywhere'
  },
  ocrSection: {
    margin: '18px 0'
  },
  ocrTextarea: {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    padding: 10,
    marginBottom: 10,
    font: 'inherit',
    resize: 'vertical'
  },
  dialogActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 18
  }
};

export default Purchases;
