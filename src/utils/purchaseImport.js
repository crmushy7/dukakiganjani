
import * as XLSX from "xlsx";
import { createWorker } from "tesseract.js";

const normalizeHeader = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");

const HEADER_ALIASES = {
  name: [
    "name", "item", "item name", "product", "product name",
    "bidhaa", "jina", "jina la bidhaa", "description",
    "item description", "medicine"
  ],
  quantity: [
    "qty", "quantity", "count", "idadi", "units", "pcs",
    "pieces", "number"
  ],
  buyingPrice: [
    "buying price", "purchase price", "cost", "cost price",
    "total cost", "total buying price", "bei ya kununua",
    "gharama", "jumla", "amount"
  ],
  sellingPrice: [
    "selling price", "retail price", "sale price",
    "bei ya kuuza", "selling price per item", "unit selling price"
  ],
  category: [
    "category", "type", "group", "aina", "kundi"
  ]
};

export function detectColumns(headers) {
  const result = {};

  for (const field of Object.keys(HEADER_ALIASES)) {
    result[field] = headers.findIndex((header) =>
      HEADER_ALIASES[field].includes(normalizeHeader(header))
    );
  }

  return result;
}

export async function readSpreadsheet(file) {
  const buffer = await file.arrayBuffer();

  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false
  });

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!firstSheet) {
    throw new Error("The selected file has no worksheet.");
  }

  const rows = XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false
  });

  if (rows.length < 2) {
    throw new Error(
      "The file must contain a header row and at least one data row."
    );
  }

  return {
    headers: rows[0].map((value) => String(value ?? "").trim()),
    rows: rows.slice(1).filter((row) =>
      row.some((value) => String(value ?? "").trim() !== "")
    ),
    sheetNames: workbook.SheetNames
  };
}

export async function recognizeImage(file, onProgress) {
  let worker;

  try {
    worker = await createWorker("eng", 1, {
      logger: (message) => {
        if (message.status === "recognizing text") {
          onProgress?.(Math.round((message.progress || 0) * 100));
        }
      }
    });

    const result = await worker.recognize(file);

    return {
      text: result.data.text || "",
      confidence: result.data.confidence ?? 0
    };
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

export function parseNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }

  const cleaned = String(value ?? "")
    .replace(/TSh|TZS|Shs?\.?/gi, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/[^\d.-]/g, "");

  if (!cleaned || cleaned === "-" || cleaned === ".") {
    return NaN;
  }

  return Number(cleaned);
}

export function mapSpreadsheetRows(rows, columns) {
  return rows.map((row, index) => {
    const valueAt = (field) => {
      const columnIndex = columns[field];
      return columnIndex >= 0 ? row[columnIndex] ?? "" : "";
    };

    const quantity = parseNumber(valueAt("quantity"));
    const buyingPrice = parseNumber(valueAt("buyingPrice"));
    const sellingPrice = parseNumber(valueAt("sellingPrice"));

    return {
      rowNumber: index + 2,
      name: String(valueAt("name") ?? "").trim(),
      quantity: Number.isFinite(quantity) ? quantity : "",
      buyingPrice: Number.isFinite(buyingPrice) ? buyingPrice : "",
      sellingPrice: Number.isFinite(sellingPrice) ? sellingPrice : "",
      category: String(valueAt("category") ?? "").trim() || "Bidhaa",
      errors: []
    };
  });
}

export function validateImportRows(rows) {
  return rows.map((row) => {
    const errors = [];

    if (!String(row.name ?? "").trim()) {
      errors.push("Jina la bidhaa lina lazima liwe kimechukuliwa.");
    }

    const quantity = Number(row.quantity);
    const buyingPrice = Number(row.buyingPrice);
    const sellingPrice = Number(row.sellingPrice);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      errors.push("Kiasi ya bidhaa lazima iwe namba kamili chanya.");
    }

    if (!Number.isFinite(buyingPrice) || buyingPrice <= 0) {
      errors.push("Jumla ya ununuzi lazima iwe kubwa kuliko zero.");
    }

    if (
      !Number.isFinite(sellingPrice) ||
      sellingPrice <= buyingPrice / quantity
    ) {
      errors.push("Bei ya kuuza lazima iwe kubwa kuliko bei ya ununuzi kwa kipande.");
    }

    return {
      ...row,
      errors
    };
  });
}

/**
 * OCR is imperfect, especially for handwriting.
 * Keep the recognized text available for review instead of silently
 * guessing which numbers belong to which columns.
 */
export function getRecognizedLines(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
