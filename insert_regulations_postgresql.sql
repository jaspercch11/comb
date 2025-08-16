-- PostgreSQL-Compatible SQL Script to Insert Removed Regulations
-- This script inserts the 8 regulations that were previously shown in the "Regulations Overview" section
-- into the regulations table with all necessary fields for the "Active Regulations" table.

-- First, let's add the necessary columns if they don't exist
-- Run these ALTER TABLE statements first if the columns don't exist:

-- ALTER TABLE regulations ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'Compliance';
-- ALTER TABLE regulations ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'Medium';
-- ALTER TABLE regulations ADD COLUMN IF NOT EXISTS last_review DATE;
-- ALTER TABLE regulations ADD COLUMN IF NOT EXISTS next_review DATE;

-- Insert SOX - Sarbanes-Oxley Act
INSERT INTO regulations (title, description, status, department, risk_level, last_review, next_review) VALUES (
    'SOX - Sarbanes-Oxley Act',
    'Sarbanes-Oxley Act (SOX) establishes auditing and financial regulations for public companies to protect shareholders and the general public. It mandates internal controls and reporting accuracy.',
    'Active',
    'Finance & Accounting',
    'High',
    CURRENT_DATE - 30,
    CURRENT_DATE + 335
);

-- Insert AML - Anti-Money Laundering
INSERT INTO regulations (title, description, status, department, risk_level, last_review, next_review) VALUES (
    'AML - Anti-Money Laundering',
    'Anti-Money Laundering (AML) comprises laws and regulations to prevent criminals from disguising illegally obtained funds as legitimate income.',
    'Active',
    'Finance & Accounting',
    'High',
    CURRENT_DATE - 45,
    CURRENT_DATE + 320
);

-- Insert BIR - Bureau of Internal Revenue
INSERT INTO regulations (title, description, status, department, risk_level, last_review, next_review) VALUES (
    'BIR - Bureau of Internal Revenue',
    'Bureau of Internal Revenue regulations for taxation compliance and reporting.',
    'Active',
    'Finance & Accounting',
    'Medium',
    CURRENT_DATE - 15,
    CURRENT_DATE + 350
);

-- Insert ISO - International Organization for Standardization
INSERT INTO regulations (title, description, status, department, risk_level, last_review, next_review) VALUES (
    'ISO - International Standards',
    'ISO standards ensure quality, safety, and efficiency across products, services, and systems.',
    'Active',
    'Quality Assurance',
    'Medium',
    CURRENT_DATE - 60,
    CURRENT_DATE + 305
);

-- Insert GDPR - General Data Protection Regulation
INSERT INTO regulations (title, description, status, department, risk_level, last_review, next_review) VALUES (
    'GDPR - General Data Protection Regulation',
    'General Data Protection Regulation (GDPR) is the EU law on data protection and privacy, providing individuals control over their personal data.',
    'Active',
    'IT & Data Security',
    'High',
    CURRENT_DATE - 20,
    CURRENT_DATE + 345
);

-- Insert FDA - Food and Drug Administration
INSERT INTO regulations (title, description, status, department, risk_level, last_review, next_review) VALUES (
    'FDA - Food and Drug Administration',
    'Food and Drug Administration (FDA) regulates food, drugs, medical devices, cosmetics and more to ensure safety and efficacy.',
    'Active',
    'Research & Development',
    'High',
    CURRENT_DATE - 10,
    CURRENT_DATE + 355
);

-- Insert ECA - Economic Crime Act
INSERT INTO regulations (title, description, status, department, risk_level, last_review, next_review) VALUES (
    'ECA - Economic Crime Act',
    'ECA outlines consumer protection and trade compliance frameworks.',
    'Active',
    'Legal & Compliance',
    'Medium',
    CURRENT_DATE - 25,
    CURRENT_DATE + 340
);

-- Insert DPA - Data Privacy Act
INSERT INTO regulations (title, description, status, department, risk_level, last_review, next_review) VALUES (
    'DPA - Data Privacy Act',
    'Data Privacy Act provides protection of personal information collected by organizations.',
    'Active',
    'IT & Data Security',
    'Medium',
    CURRENT_DATE - 35,
    CURRENT_DATE + 330
);

-- Verify the insertions
SELECT 
    regulation_id, 
    title, 
    COALESCE(department, 'Compliance') as department, 
    status, 
    COALESCE(risk_level, 'Medium') as risk_level, 
    last_review, 
    next_review 
FROM regulations 
ORDER BY regulation_id;