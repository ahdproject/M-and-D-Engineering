const XLSX = require('xlsx');
const path = require('path');

// Sample payroll data matching the exact structure from your Excel file
const samplePayroll = [
  {
    'Employee ID': 'EMP001',
    'Employee Name': 'Rajesh Kumar',
    'Department': 'Operations',
    'Designation': 'Technician',
    'Full Day': 20,
    'Half Day': 2,
    'Off Days': 2,
    'Paid Leave': 2,
    'Paid Days': 24,
    'Unpaid Days': 2,
    'Daily Wage': 400,
    'Gross Wages': 9600,
    'Earned Wages': 9600,
    'Other Earnings': 500,
    'Overtime': 800,
    'Extras': 200,
    'Gross Earnings': 11100,
    'Statutory Compliance': 1500,
    'Penalities': 0,
    'Loan & Advance': 500,
    'Other Deductions': 300,
    'Finalized Amount': 8800,
    'Basic Salary': 8000,
    'Dearness Allowance': 800,
    'House Rent Allowance': 1200,
    'Transportation Allowance': 400,
    'Residual Pay': 500,
    'Gross Income': 10900,
    'Total Other Earnings': 500,
    'Provident Fund': 960,
    'ESIC Amount': 300,
    'Professional Tax': 150,
    'Labour Welfare Fund': 90,
    'Total Statutory Compliance': 1500,
    'Esic': 300,
    'Total Deductions': 3300,
    'Bank Name': 'ICICI Bank',
    'IFSC Code': 'ICIC0000120',
    'Bank Account No': '1234567890123',
    'Bank Branch Name': 'Mumbai Branch',
    'Account Type': 'Savings',
  },
  {
    'Employee ID': 'EMP002',
    'Employee Name': 'Priya Singh',
    'Department': 'Quality Control',
    'Designation': 'Supervisor',
    'Full Day': 22,
    'Half Day': 1,
    'Off Days': 1,
    'Paid Leave': 2,
    'Paid Days': 25,
    'Unpaid Days': 1,
    'Daily Wage': 500,
    'Gross Wages': 12500,
    'Earned Wages': 12500,
    'Other Earnings': 800,
    'Overtime': 1000,
    'Extras': 300,
    'Gross Earnings': 14600,
    'Statutory Compliance': 2000,
    'Penalities': 200,
    'Loan & Advance': 1000,
    'Other Deductions': 400,
    'Finalized Amount': 10000,
    'Basic Salary': 10000,
    'Dearness Allowance': 1000,
    'House Rent Allowance': 1500,
    'Transportation Allowance': 500,
    'Residual Pay': 600,
    'Gross Income': 13600,
    'Total Other Earnings': 800,
    'Provident Fund': 1200,
    'ESIC Amount': 350,
    'Professional Tax': 200,
    'Labour Welfare Fund': 100,
    'Total Statutory Compliance': 2000,
    'Esic': 350,
    'Total Deductions': 4000,
    'Bank Name': 'State Bank of India',
    'IFSC Code': 'SBIN0001234',
    'Bank Account No': '9876543210987',
    'Bank Branch Name': 'Delhi Branch',
    'Account Type': 'Current',
  },
  {
    'Employee ID': 'EMP003',
    'Employee Name': 'Amit Patel',
    'Department': 'Operations',
    'Designation': 'Helper',
    'Full Day': 18,
    'Half Day': 3,
    'Off Days': 3,
    'Paid Leave': 2,
    'Paid Days': 22,
    'Unpaid Days': 4,
    'Daily Wage': 300,
    'Gross Wages': 6600,
    'Earned Wages': 6600,
    'Other Earnings': 200,
    'Overtime': 400,
    'Extras': 100,
    'Gross Earnings': 7300,
    'Statutory Compliance': 800,
    'Penalities': 100,
    'Loan & Advance': 300,
    'Other Deductions': 150,
    'Finalized Amount': 5850,
    'Basic Salary': 6000,
    'Dearness Allowance': 600,
    'House Rent Allowance': 800,
    'Transportation Allowance': 300,
    'Residual Pay': 200,
    'Gross Income': 7900,
    'Total Other Earnings': 300,
    'Provident Fund': 600,
    'ESIC Amount': 200,
    'Professional Tax': 100,
    'Labour Welfare Fund': 50,
    'Total Statutory Compliance': 950,
    'Esic': 200,
    'Total Deductions': 2050,
    'Bank Name': 'Axis Bank',
    'IFSC Code': 'AXIS0000456',
    'Bank Account No': '5555666677778888',
    'Bank Branch Name': 'Bangalore Branch',
    'Account Type': 'Savings',
  },
  {
    'Employee ID': 'EMP004',
    'Employee Name': 'Neha Sharma',
    'Department': 'Administration',
    'Designation': 'Office Manager',
    'Full Day': 21,
    'Half Day': 1,
    'Off Days': 2,
    'Paid Leave': 2,
    'Paid Days': 24,
    'Unpaid Days': 2,
    'Daily Wage': 550,
    'Gross Wages': 13200,
    'Earned Wages': 13200,
    'Other Earnings': 600,
    'Overtime': 900,
    'Extras': 250,
    'Gross Earnings': 14950,
    'Statutory Compliance': 1800,
    'Penalities': 0,
    'Loan & Advance': 800,
    'Other Deductions': 350,
    'Finalized Amount': 11200,
    'Basic Salary': 11000,
    'Dearness Allowance': 1100,
    'House Rent Allowance': 1650,
    'Transportation Allowance': 450,
    'Residual Pay': 400,
    'Gross Income': 14600,
    'Total Other Earnings': 600,
    'Provident Fund': 1300,
    'ESIC Amount': 320,
    'Professional Tax': 180,
    'Labour Welfare Fund': 80,
    'Total Statutory Compliance': 1880,
    'Esic': 320,
    'Total Deductions': 3750,
    'Bank Name': 'HDFC Bank',
    'IFSC Code': 'HDFC0002000',
    'Bank Account No': '1111222233334444',
    'Bank Branch Name': 'Chennai Branch',
    'Account Type': 'Savings',
  },
  {
    'Employee ID': 'EMP005',
    'Employee Name': 'Vikram Rao',
    'Department': 'Operations',
    'Designation': 'Senior Technician',
    'Full Day': 23,
    'Half Day': 0,
    'Off Days': 1,
    'Paid Leave': 2,
    'Paid Days': 25,
    'Unpaid Days': 1,
    'Daily Wage': 600,
    'Gross Wages': 15000,
    'Earned Wages': 15000,
    'Other Earnings': 1000,
    'Overtime': 1200,
    'Extras': 400,
    'Gross Earnings': 17600,
    'Statutory Compliance': 2200,
    'Penalities': 0,
    'Loan & Advance': 1200,
    'Other Deductions': 500,
    'Finalized Amount': 13500,
    'Basic Salary': 12000,
    'Dearness Allowance': 1200,
    'House Rent Allowance': 1800,
    'Transportation Allowance': 600,
    'Residual Pay': 500,
    'Gross Income': 16100,
    'Total Other Earnings': 1000,
    'Provident Fund': 1500,
    'ESIC Amount': 400,
    'Professional Tax': 250,
    'Labour Welfare Fund': 150,
    'Total Statutory Compliance': 2300,
    'Esic': 400,
    'Total Deductions': 4100,
    'Bank Name': 'Kotak Mahindra Bank',
    'IFSC Code': 'KKBK0000999',
    'Bank Account No': '9999888877776666',
    'Bank Branch Name': 'Hyderabad Branch',
    'Account Type': 'Savings',
  },
];

try {
  // Create a new workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(samplePayroll);
  
  // Set column widths for better readability
  const columnWidths = [
    { wch: 12 },  // Employee ID
    { wch: 16 },  // Employee Name
    { wch: 14 },  // Department
    { wch: 16 },  // Designation
    { wch: 10 },  // Full Day
    { wch: 10 },  // Half Day
    { wch: 10 },  // Off Days
    { wch: 12 },  // Paid Leave
    { wch: 10 },  // Paid Days
    { wch: 12 },  // Unpaid Days
    { wch: 12 },  // Daily Wage
    { wch: 12 },  // Gross Wages
    { wch: 14 },  // Earned Wages
    { wch: 14 },  // Other Earnings
    { wch: 10 },  // Overtime
    { wch: 10 },  // Extras
    { wch: 14 },  // Gross Earnings
    { wch: 18 },  // Statutory Compliance
    { wch: 12 },  // Penalities
    { wch: 14 },  // Loan & Advance
    { wch: 16 },  // Other Deductions
    { wch: 16 },  // Finalized Amount
    { wch: 14 },  // Basic Salary
    { wch: 18 },  // Dearness Allowance
    { wch: 18 },  // House Rent Allowance
    { wch: 22 },  // Transportation Allowance
    { wch: 14 },  // Residual Pay
    { wch: 12 },  // Gross Income
    { wch: 18 },  // Total Other Earnings
    { wch: 14 },  // Provident Fund
    { wch: 12 },  // ESIC Amount
    { wch: 16 },  // Professional Tax
    { wch: 16 },  // Labour Welfare Fund
    { wch: 22 },  // Total Statutory Compliance
    { wch: 14 },  // Esic
    { wch: 14 },  // Total Deductions
    { wch: 14 },  // Bank Name
    { wch: 14 },  // IFSC Code
    { wch: 16 },  // Bank Account No
    { wch: 16 },  // Bank Branch Name
    { wch: 14 },  // Account Type
  ];
  
  worksheet['!cols'] = columnWidths;
  
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Payroll');
  
  // Save to Downloads folder
  const filePath = path.join('/Users/devanshu/Downloads', 'sample_payroll.xlsx');
  XLSX.writeFile(workbook, filePath);
  
  console.log('✅ Sample payroll Excel file created successfully!');
  console.log(`📁 Location: ${filePath}`);
  console.log(`📊 Rows: ${samplePayroll.length} employees`);
  console.log(`📋 Columns: ${Object.keys(samplePayroll[0]).length} fields`);
  
  process.exit(0);
} catch (err) {
  console.error('❌ Error creating Excel file:', err.message);
  process.exit(1);
}
