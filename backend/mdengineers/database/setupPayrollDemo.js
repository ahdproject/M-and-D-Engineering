const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');
const logger = require('../src/config/logger');

// Sample employees to create
const SAMPLE_EMPLOYEES = [
  { name: 'Rajesh Kumar', phone: '9876543210', designation: 'Technician', department: 'Operations' },
  { name: 'Priya Singh', phone: '9876543211', designation: 'Supervisor', department: 'Operations' },
  { name: 'Amit Patel', phone: '9876543212', designation: 'Helper', department: 'Operations' },
  { name: 'Neha Sharma', phone: '9876543213', designation: 'Office Manager', department: 'Admin' },
  { name: 'Vikram Rao', phone: '9876543214', designation: 'Senior Technician', department: 'Operations' },
];

// Sample payroll data matching the Excel structure
const generatePayrollData = (employees) => {
  return employees.map((emp, idx) => ({
    'Employee ID': `EMP${String(idx + 1).padStart(3, '0')}`,
    'Employee Name': emp.name,
    'Department': emp.department,
    'Designation': emp.designation,
    'Full Day': 20 + Math.floor(Math.random() * 5),
    'Half Day': Math.floor(Math.random() * 3),
    'Off Days': 2,
    'Paid Leave': 2,
    'Paid Days': 24,
    'Unpaid Days': 0,
    'Daily Wage': 500,
    'Gross Wages': 12000,
    'Earned Wages': 12000,
    'Other Earnings': Math.floor(Math.random() * 500),
    'Overtime': Math.floor(Math.random() * 1000),
    'Extras': 0,
    'Gross Earnings': 12500 + Math.floor(Math.random() * 1000),
    'Statutory Compliance': 1500,
    'Penalities': 0,
    'Loan & Advance': Math.floor(Math.random() * 2000),
    'Other Deductions': 0,
    'Finalized Amount': 10000 + Math.floor(Math.random() * 3000),
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
    'IFSC Code': 'ICIC000000' + String(idx + 1).padStart(2, '0'),
    'Bank Account No': '1234567890' + String(idx + 1).padStart(2, '0'),
    'Bank Branch Name': 'Delhi Branch',
    'Account Type': 'Savings',
  }));
};

const run = async () => {
  try {
    logger.info('Starting employee & payroll setup...');

    // 1. Create employees
    logger.info('Creating sample employees...');
    const client = await db.connect();
    
    const createdEmployees = [];
    for (const emp of SAMPLE_EMPLOYEES) {
      try {
        const { rows } = await client.query(
          `INSERT INTO employees (name, phone, designation, joining_date, is_active)
           VALUES ($1, $2, $3, CURRENT_DATE, true)
           RETURNING id, name, designation`,
          [emp.name, emp.phone, emp.designation]
        );
        if (rows.length) {
          createdEmployees.push({ ...emp, ...rows[0] });
          logger.info(`✅ Created employee: ${emp.name}`);
        }
      } catch (err) {
        // Employee might already exist, try to fetch it
        const { rows } = await client.query(
          `SELECT id, name, designation FROM employees WHERE name = $1`,
          [emp.name]
        );
        if (rows.length) {
          createdEmployees.push({ ...emp, ...rows[0] });
          logger.info(`ℹ️  Employee already exists: ${emp.name}`);
        }
      }
    }

    client.release();

    // 2. Generate Excel payroll file
    logger.info('Generating sample payroll Excel file...');
    const payrollData = generatePayrollData(SAMPLE_EMPLOYEES);
    
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(payrollData);
    
    // Set column widths
    const colWidths = [
      { wch: 12 },  // Employee ID
      { wch: 18 },  // Employee Name
      { wch: 15 },  // Department
      { wch: 18 },  // Designation
      { wch: 10 },  // Full Day
      { wch: 10 },  // Half Day
      { wch: 10 },  // Off Days
      { wch: 12 },  // Paid Leave
      { wch: 10 },  // Paid Days
      { wch: 12 },  // Unpaid Days
      { wch: 12 },  // Daily Wage
      { wch: 12 },  // Gross Wages
      { wch: 13 },  // Earned Wages
      { wch: 15 },  // Other Earnings
      { wch: 10 },  // Overtime
      { wch: 8 },   // Extras
      { wch: 15 },  // Gross Earnings
      { wch: 18 },  // Statutory Compliance
      { wch: 12 },  // Penalities
      { wch: 13 },  // Loan & Advance
      { wch: 16 },  // Other Deductions
      { wch: 15 },  // Finalized Amount
      { wch: 13 },  // Basic Salary
      { wch: 18 },  // Dearness Allowance
      { wch: 18 },  // House Rent Allowance
      { wch: 22 },  // Transportation Allowance
      { wch: 12 },  // Residual Pay
      { wch: 12 },  // Gross Income
      { wch: 18 },  // Total Other Earnings
      { wch: 15 },  // Provident Fund
      { wch: 12 },  // ESIC Amount
      { wch: 16 },  // Professional Tax
      { wch: 18 },  // Labour Welfare Fund
      { wch: 22 },  // Total Statutory Compliance
      { wch: 12 },  // Esic
      { wch: 16 },  // Total Deductions
      { wch: 12 },  // Bank Name
      { wch: 12 },  // IFSC Code
      { wch: 16 },  // Bank Account No
      { wch: 16 },  // Bank Branch Name
      { wch: 14 },  // Account Type
    ];
    worksheet['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payroll');
    
    const month = new Date().toLocaleString('default', { month: 'short' });
    const year = new Date().getFullYear();
    const filePath = path.join(__dirname, `../payroll-sample-${month}-${year}.xlsx`);
    
    XLSX.writeFile(workbook, filePath);
    logger.info(`✅ Sample payroll Excel file created: ${filePath}`);

    // 3. Summary
    logger.info(`
╔════════════════════════════════════════════════════════════╗
║           EMPLOYEE & PAYROLL SETUP COMPLETED              ║
╠════════════════════════════════════════════════════════════╣
║ Created Employees: ${createdEmployees.length}                          ║
║ ${createdEmployees.map(e => `  • ${e.name} (${e.designation})`).join('\n║   ')} ║
║                                                            ║
║ Payroll File Location:                                     ║
║ ${filePath.substring(filePath.length - 50)}
║                                                            ║
║ Next Steps:                                                ║
║ 1. Open the Excel file in the path above                  ║
║ 2. Go to Salary page in the frontend                      ║
║ 3. Click "Upload Excel" button                            ║
║ 4. Select the payroll file                                ║
║ 5. Click "Compute" to process salaries                    ║
╚════════════════════════════════════════════════════════════╝
    `);

    process.exit(0);
  } catch (err) {
    logger.error('❌ Setup failed:', err.message);
    process.exit(1);
  }
};

run();
