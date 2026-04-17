// Fix double slash in invoice URL
const baseUrl = (process.env.FRONTEND_URL || process.env.APP_BASE_URL || 'http://localhost:4000')
  .replace(/\/$/, '')  // Remove trailing slash
  .replace(/^\//, '');  // Remove leading slash if present

console.log('Base URL for invoice:', baseUrl);  // Debug log

const invoiceUrl = `${baseUrl}/invoice/${result.invoice_number}`;
console.log('Generated invoice URL:', invoiceUrl);  // Debug log

return res.status(201).json({
  ...result,
  invoice_url: invoiceUrl
});