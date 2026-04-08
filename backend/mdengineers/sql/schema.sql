-- Create database (run separately if needed)
-- CREATE DATABASE mdengineers_erp;

-- ─── ROLES ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

INSERT INTO roles (name, description) VALUES
  ('admin',   'Full system access including user management'),
  ('manager', 'Can manage stock, salary, attendance, P&L'),
  ('staff',   'Can do stock entry and view own attendance')
ON CONFLICT (name) DO NOTHING;

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id       INT NOT NULL REFERENCES roles(id),
  is_active     BOOLEAN DEFAULT TRUE,
  last_login    TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ─── SEED: ADMIN USER ────────────────────────────────────────────────────────
-- Password: admin123 (bcrypt hash with rounds=12)
INSERT INTO users (name, email, password_hash, role_id, is_active) 
SELECT 'Admin User', 'admin@mdengineers.com', '$2b$12$Y0yKxgxZf0aJrXJEQJB7NOKwV0RJEGKDqcGg7.sFl4YhK5C3dDQGG', id, true
FROM roles WHERE name = 'admin'
ON CONFLICT (email) DO NOTHING;

-- ─── USER PERMISSIONS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_permissions (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module     VARCHAR(50) NOT NULL CHECK (
               module IN ('stock','pl','salary','attendance',
                          'cash_expense','user_mgmt','masters','work_orders')
             ),
  can_view   BOOLEAN DEFAULT FALSE,
  can_edit   BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, module)
);

-- ─── CHEMICALS MASTER ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chemicals_master (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL UNIQUE,
  unit         VARCHAR(20)  NOT NULL,
  default_rate DECIMAL(10,2) DEFAULT 0.00,
  hsn_code     VARCHAR(20)  DEFAULT '9988',
  gst_rate     DECIMAL(5,2) DEFAULT 18.00,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- ─── CHEMICAL RATE HISTORY ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chemical_rate_history (
  id             SERIAL PRIMARY KEY,
  chemical_id    INT NOT NULL REFERENCES chemicals_master(id),
  old_rate       DECIMAL(10,2) NOT NULL,
  new_rate       DECIMAL(10,2) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to   DATE NULL,
  reason         VARCHAR(255),
  changed_by     INT NOT NULL REFERENCES users(id),
  changed_at     TIMESTAMP DEFAULT NOW()
);

-- ─── STOCK DATEWISE ENTRY ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_datewise_entry (
  id                   SERIAL PRIMARY KEY,
  date                 DATE NOT NULL,
  chemical_id          INT NOT NULL REFERENCES chemicals_master(id),
  entry_type           VARCHAR(20) NOT NULL CHECK (entry_type IN ('purchase','usage','adjustment')),
  quantity             DECIMAL(10,3) NOT NULL,
  quantity_unit        VARCHAR(20) NOT NULL,
  rate                 DECIMAL(10,2) NOT NULL,
  rate_unit            VARCHAR(20) NOT NULL,
  rate_source          VARCHAR(20) DEFAULT 'master' CHECK (rate_source IN ('master','override')),
  rate_override_reason VARCHAR(255) NULL,
  stock_before         DECIMAL(10,3),
  stock_after          DECIMAL(10,3),
  sales_amount         DECIMAL(12,2),
  gst_amount           DECIMAL(10,2),
  total_amount         DECIMAL(12,2),
  work_order_id        INT NULL,
  remark               TEXT,
  entered_by           INT NOT NULL REFERENCES users(id),
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_date          ON stock_datewise_entry(date);
CREATE INDEX IF NOT EXISTS idx_stock_month_year    ON stock_datewise_entry(EXTRACT(MONTH FROM date), EXTRACT(YEAR FROM date));
CREATE INDEX IF NOT EXISTS idx_stock_chemical_date ON stock_datewise_entry(chemical_id, date);
CREATE INDEX IF NOT EXISTS idx_stock_entry_type    ON stock_datewise_entry(entry_type);

-- ─── STOCK ENTRY EDIT LOG ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_entry_edit_log (
  id            SERIAL PRIMARY KEY,
  entry_id      INT NOT NULL REFERENCES stock_datewise_entry(id) ON DELETE CASCADE,
  field_changed VARCHAR(50) NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  changed_by    INT NOT NULL REFERENCES users(id),
  change_reason TEXT,
  changed_at    TIMESTAMP DEFAULT NOW()
);

-- ─── SEED: CHEMICALS ─────────────────────────────────────────────────────────
INSERT INTO chemicals_master (name, unit, default_rate) VALUES
  ('BK 67 A',           'ltr',  237.07),
  ('BK 67 B',           'ltr',  2333.34),
  ('BL-15',             'kgs',  252.20),
  ('752',               'ltr',  0.00),
  ('862',               'ltr',  0.00),
  ('3000',              'ltr',  290.00),
  ('375-A',             'ltr',  277.12),
  ('375-C',             'ltr',  306.49),
  ('BR.1265',           'ltr',  185.00),
  ('846-B',             'kgs',  90.22),
  ('1085-M',            'ltr',  178.00),
  ('1085-R',            'ltr',  190.00),
  ('846-A',             'ltr',  109.00),
  ('DURA-601',          'kgs',  160.00),
  ('CYANIDE',           'kgs',  255.00),
  ('CK-1',              'kgs',  0.00),
  ('ZINK OXIDE',        'kgs',  295.00),
  ('LADI',              'Nos',  343.00),
  ('Costic',            'kgs',  52.00),
  ('HCL',               'kgs',  3.50),
  ('Nitric',            'kgs',  32.00),
  ('Hydrogen Peroxide', 'kgs',  0.00),
  ('Sulfuric Acid',     'kgs',  0.00),
  ('Urfolin EL 80',     'kgs',  0.00),
  ('Sulphide',          'kgs',  90.00),
  ('AZ-2085-R',         'kgs',  0.00)
ON CONFLICT (name) DO NOTHING;

-- ─── SEED: CHEMICAL RATE HISTORY ─────────────────────────────────────────────
-- Initialize rate history for all chemicals with their default rates
INSERT INTO chemical_rate_history (chemical_id, old_rate, new_rate, effective_from, reason, changed_by)
SELECT 
  c.id,
  c.default_rate,
  c.default_rate,
  CURRENT_DATE,
  'Initial rate setup',
  (SELECT id FROM users WHERE email = 'admin@mdengineers.com' LIMIT 1)
FROM chemicals_master c
WHERE NOT EXISTS (
  SELECT 1 FROM chemical_rate_history WHERE chemical_id = c.id
)
ON CONFLICT DO NOTHING;

-- ─── PAYROLL IMPORT TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_import (
  id                        SERIAL PRIMARY KEY,
  employee_id               INT REFERENCES employees(id) ON DELETE SET NULL,
  employee_excel_id         VARCHAR(20),
  employee_name             VARCHAR(100),
  department                VARCHAR(100),
  designation               VARCHAR(100),
  full_day                  NUMERIC(5,2),
  half_day                  NUMERIC(5,2),
  off_days                  NUMERIC(5,2),
  paid_leave                NUMERIC(5,2),
  paid_days                 NUMERIC(5,2),
  unpaid_days               NUMERIC(5,2),
  daily_wage                NUMERIC(12,2),
  gross_wages               NUMERIC(12,2),
  earned_wages              NUMERIC(12,2),
  other_earnings            NUMERIC(12,2),
  overtime                  NUMERIC(12,2),
  extras                    NUMERIC(12,2),
  gross_earnings            NUMERIC(12,2),
  statutory_compliance      NUMERIC(12,2),
  penalties                 NUMERIC(12,2),
  loan_advance              NUMERIC(12,2),
  other_deductions          NUMERIC(12,2),
  finalized_amount          NUMERIC(12,2),
  basic_salary              NUMERIC(12,2),
  dearness_allowance        NUMERIC(12,2),
  house_rent_allowance      NUMERIC(12,2),
  transportation_allowance  NUMERIC(12,2),
  residual_pay              NUMERIC(12,2),
  gross_income              NUMERIC(12,2),
  total_other_earnings      NUMERIC(12,2),
  provident_fund            NUMERIC(12,2),
  esic_amount               NUMERIC(12,2),
  professional_tax          NUMERIC(12,2),
  labour_welfare_fund       NUMERIC(12,2),
  total_statutory_compliance NUMERIC(12,2),
  esic_deduction            NUMERIC(12,2),
  total_deductions          NUMERIC(12,2),
  bank_name                 VARCHAR(100),
  ifsc_code                 VARCHAR(20),
  bank_account_no           VARCHAR(30),
  bank_branch_name          VARCHAR(100),
  account_type              VARCHAR(30),
  uploaded_by               INT REFERENCES users(id),
  uploaded_at               TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_import_employee ON payroll_import(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_import_uploaded_at ON payroll_import(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_payroll_import_excel_id ON payroll_import(employee_excel_id);