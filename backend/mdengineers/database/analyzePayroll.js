const XLSX = require('xlsx');
const path = require('path');

const filePath = '/Users/devanshu/Downloads/payroll-01-Mar (18).xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

console.log('📊 Excel File Structure:');
console.log('Sheet Name:', workbook.SheetNames[0]);
console.log('Total Records:', data.length);
console.log('\n📋 Column Names:');
if (data.length > 0) {
  console.log(Object.keys(data[0]));
  console.log('\n📍 First Record (Sample):');
  console.log(data[0]);
}
