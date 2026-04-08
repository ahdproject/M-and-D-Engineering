const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Create a sample payroll Excel file for testing
const sampleData = [
  {
    'Employee ID': 'EMP001',
    'Employee Name': 'John Doe',
    'Department': 'Operations',
    'Designation': 'Technician',
    'Full Day': 20,
    'Half Day': 2,
    'Off Days': 4,
    'Paid Leave': 2,
    'Paid Days': 24,
    'Unpaid Days': 0,
    'Daily Wage': 500,
    'Gross Wages': 12000,
    'Earned Wages': 12000,
    'Other Earnings': 0,
    'Overtime': 500,
    'Extras': 0,
    'Gross Earnings': 12500,
    'Statutory Compliance': 1500,
    'Penalities': 0,
    'Loan & Advance': 1000,
    'Other Deductions': 0,
    'Finalized Amount': 10000,
    'Basic Salary': 10000,
    'Dearness Allowance': 1000,
    'House Rent Allowance': 2000,
    'Transportation Allowance': 500,
    'Residual Pay': 0,
    'Gross Income': 13500,
    'Total Other Earnings': 500,
    'Provident Fund': 1200,
    'ESIC Amount': 200,
    'Professional Tax': 100,
    'Labour Welfare Fund': 50,
    'Total Statutory Compliance': 1550,
    'Esic': 200,
    'Total Deductions': 2450,
    'Bank Name': 'ICICI Bank',
    'IFSC Code': 'ICIC0000001',
    'Bank Account No': '1234567890',
    'Bank Branch Name': 'Delhi Branch',
    'Account Type': 'Savings',
  },
];

const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(sampleData);
XLSX.utils.book_append_sheet(workbook, worksheet, 'Payroll');

const filePath = path.join(__dirname, 'test_payroll.xlsx');
XLSX.writeFile(workbook, filePath);

console.log(`✅ Sample payroll file created: ${filePath}`);
