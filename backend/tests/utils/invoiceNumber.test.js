/**
 * Invoice Number Utility Tests
 * 
 * Tests invoice number generation utility
 */

import { generateInvoiceNumber } from '../../src/utils/invoiceNumber.js';
import { 
  initTestDatabase, 
  clearTestDatabase,
  getTestDb,
  run
} from '../setup.js';

// Mock the pool module
jest.mock('../../src/db/pool.js', () => ({
  getDb: jest.fn()
}));

describe('generateInvoiceNumber', () => {
  beforeAll(async () => {
    await initTestDatabase();
  });

  beforeEach(() => {
    clearTestDatabase();
    const { getDb } = require('../../src/db/pool.js');
    getDb.mockReturnValue(getTestDb());
  });

  test('should generate invoice number with correct format', () => {
    // Act
    const invoiceNumber = generateInvoiceNumber();

    // Assert
    expect(invoiceNumber).toMatch(/^TYR-\d{4}-\d{5}$/);
  });

  test('should use current year and month in invoice number', () => {
    // Arrange
    const now = new Date();
    const expectedYYMM = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0');

    // Act
    const invoiceNumber = generateInvoiceNumber();

    // Assert
    expect(invoiceNumber).toContain(`TYR-${expectedYYMM}-`);
  });

  test('should generate sequential numbers', () => {
    // Act
    const invoice1 = generateInvoiceNumber();
    const invoice2 = generateInvoiceNumber();
    const invoice3 = generateInvoiceNumber();

    // Assert
    const seq1 = parseInt(invoice1.split('-')[2]);
    const seq2 = parseInt(invoice2.split('-')[2]);
    const seq3 = parseInt(invoice3.split('-')[2]);

    expect(seq2).toBe(seq1 + 1);
    expect(seq3).toBe(seq2 + 1);
  });

  test('should create new sequence for new month', () => {
    // This test verifies the database logic works correctly
    // First call creates the sequence
    generateInvoiceNumber();
    
    // Verify sequence was created
    const { getDb } = require('../../src/db/pool.js');
    const db = getDb();
    const now = new Date();
    const yymm = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0');
    
    const stmt = db.prepare('SELECT * FROM invoice_sequences WHERE yymm = ?');
    stmt.bind([yymm]);
    const hasResult = stmt.step();
    stmt.free();
    
    expect(hasResult).toBe(true);
  });

  test('should reset sequence for different month', () => {
    // Arrange - Create a sequence for last month
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastYYMM = String(lastMonth.getFullYear()).slice(-2) + String(lastMonth.getMonth() + 1).padStart(2, '0');
    
    run('INSERT INTO invoice_sequences (yymm, last_sequence) VALUES (?, ?)', [lastYYMM, 999]);

    // Act - Generate for current month
    const invoiceNumber = generateInvoiceNumber();

    // Assert
    const currentYYMM = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0');
    expect(invoiceNumber).toContain(`TYR-${currentYYMM}-`);
    const seq = parseInt(invoiceNumber.split('-')[2]);
    expect(seq).toBe(1); // First for new month
  });

  test('should pad sequence to 5 digits', () => {
    // Act
    const invoiceNumber = generateInvoiceNumber();

    // Assert
    const parts = invoiceNumber.split('-');
    expect(parts[2].length).toBe(5);
    expect(parts[2]).toMatch(/^\d{5}$/);
  });
});
