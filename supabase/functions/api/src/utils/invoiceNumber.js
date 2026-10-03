import { get, run } from '../db/db.js';

export function generateInvoiceNumber() {
  const now = new Date();
  const yymm = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0');
  
  let seq = get('SELECT last_sequence FROM invoice_sequences WHERE yymm = $yymm', { yymm });
  
  if (!seq) {
    run('INSERT INTO invoice_sequences (yymm, last_sequence) VALUES ($yymm, 0)', { yymm });
    seq = { last_sequence: 0 };
  }
  
  const newSeq = seq.last_sequence + 1;
  run('UPDATE invoice_sequences SET last_sequence = $newSeq WHERE yymm = $yymm', { newSeq, yymm });
  
  return `TYR-${yymm}-${String(newSeq).padStart(5, '0')}`;
}
