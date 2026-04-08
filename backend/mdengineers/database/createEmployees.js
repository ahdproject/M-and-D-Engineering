const db = require('../src/config/db');
const logger = require('../src/config/logger');

const createSampleEmployees = async () => {
  const client = await db.connect();
  try {
    const employees = [
      { name: 'Mohit Aghera', designation: 'Sr. BDE', department: 'Sales' },
      { name: 'Rajesh Kumar', designation: 'Technician', department: 'Operations' },
      { name: 'Priya Singh', designation: 'HR Manager', department: 'HR' },
      { name: 'Amit Patel', designation: 'Accountant', department: 'Finance' },
      { name: 'Deepak Sharma', designation: 'Supervisor', department: 'Operations' },
      { name: 'Neha Verma', designation: 'Jr. Executive', department: 'Sales' },
      { name: 'Vikram Reddy', designation: 'Senior Technician', department: 'Operations' },
      { name: 'Anjali Mishra', designation: 'Data Entry Operator', department: 'Admin' },
    ];

    logger.info('Creating sample employees...');
    
    for (const emp of employees) {
      const result = await client.query(
        `INSERT INTO employees (name, designation, department, is_active, created_at)
         VALUES ($1, $2, $3, true, NOW())
         ON CONFLICT (name) DO NOTHING
         RETURNING id, name`,
        [emp.name, emp.designation, emp.department]
      );
      
      if (result.rows.length > 0) {
        logger.info(`✅ Created: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
      } else {
        logger.info(`⏭️  Skipped: ${emp.name} (already exists)`);
      }
    }

    logger.info('\n✅ Employee creation completed');
    
    // Get all employees
    const { rows: allEmps } = await client.query('SELECT id, name, designation, department FROM employees ORDER BY id');
    console.log('\n📋 All Employees in System:');
    console.table(allEmps);

  } catch (err) {
    logger.error('❌ Error creating employees:', err);
  } finally {
    client.release();
    process.exit(0);
  }
};

createSampleEmployees();
