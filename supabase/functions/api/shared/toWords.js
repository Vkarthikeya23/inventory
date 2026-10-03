/**
 * Convert number to words in Indian numbering system
 * Handles: Thousand, Lakhs, Crores
 * Example: 14000 -> "Fourteen Thousand"
 * Example: 150000 -> "One Lakh Fifty Thousand"
 * Example: 2500000 -> "Twenty Five Lakhs"
 */

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertLessThanOneThousand(num) {
  if (num === 0) return '';
  
  let words = '';
  
  // Hundreds
  if (num >= 100) {
    words += ones[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }
  
  // Tens and ones
  if (num >= 20) {
    words += tens[Math.floor(num / 10)] + ' ';
    num %= 10;
  } else if (num >= 10) {
    words += teens[num - 10] + ' ';
    return words.trim();
  }
  
  // Ones
  if (num > 0) {
    words += ones[num] + ' ';
  }
  
  return words.trim();
}

export function toWords(num) {
  if (num === 0) return 'Zero Rupees only';
  
  const amount = Math.abs(Math.floor(num));
  const decimal = Math.round((Math.abs(num) - amount) * 100);
  
  let words = '';
  let remaining = amount;
  
  // Crores (10 million)
  if (remaining >= 10000000) {
    const crores = Math.floor(remaining / 10000000);
    words += convertLessThanOneThousand(crores) + ' Crore ';
    remaining %= 10000000;
  }
  
  // Lakhs (100 thousand)
  if (remaining >= 100000) {
    const lakhs = Math.floor(remaining / 100000);
    words += convertLessThanOneThousand(lakhs) + ' Lakh ';
    remaining %= 100000;
  }
  
  // Thousands
  if (remaining >= 1000) {
    const thousands = Math.floor(remaining / 1000);
    words += convertLessThanOneThousand(thousands) + ' Thousand ';
    remaining %= 1000;
  }
  
  // Hundreds and below
  if (remaining > 0) {
    words += convertLessThanOneThousand(remaining) + ' ';
  }
  
  words = words.trim();
  
  if (decimal > 0) {
    const decimalWords = convertLessThanOneThousand(decimal);
    return `${words} Rupees and ${decimalWords} Paise only`;
  }
  
  return `${words} Rupees only`;
}

// Export for both ES modules and CommonJS
export default toWords;
