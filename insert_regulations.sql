-- SQL Script to Insert Removed Regulations
-- This script inserts the 8 regulations that were previously shown in the "Regulations Overview" section
-- into the regulations table so they appear in the "Active Regulations" table.

-- Insert SOX - Sarbanes-Oxley Act
INSERT INTO regulations (title, description, status) VALUES (
    'SOX - Sarbanes-Oxley Act',
    'Sarbanes-Oxley Act (SOX) establishes auditing and financial regulations for public companies to protect shareholders and the general public. It mandates internal controls and reporting accuracy.',
    'Active'
);

-- Insert AML - Anti-Money Laundering
INSERT INTO regulations (title, description, status) VALUES (
    'AML - Anti-Money Laundering',
    'Anti-Money Laundering (AML) comprises laws and regulations to prevent criminals from disguising illegally obtained funds as legitimate income.',
    'Active'
);

-- Insert BIR - Bureau of Internal Revenue
INSERT INTO regulations (title, description, status) VALUES (
    'BIR - Bureau of Internal Revenue',
    'Bureau of Internal Revenue regulations for taxation compliance and reporting.',
    'Active'
);

-- Insert ISO - International Organization for Standardization
INSERT INTO regulations (title, description, status) VALUES (
    'ISO - International Standards',
    'ISO standards ensure quality, safety, and efficiency across products, services, and systems.',
    'Active'
);

-- Insert GDPR - General Data Protection Regulation
INSERT INTO regulations (title, description, status) VALUES (
    'GDPR - General Data Protection Regulation',
    'General Data Protection Regulation (GDPR) is the EU law on data protection and privacy, providing individuals control over their personal data.',
    'Active'
);

-- Insert FDA - Food and Drug Administration
INSERT INTO regulations (title, description, status) VALUES (
    'FDA - Food and Drug Administration',
    'Food and Drug Administration (FDA) regulates food, drugs, medical devices, cosmetics and more to ensure safety and efficacy.',
    'Active'
);

-- Insert ECA - Economic Crime Act
INSERT INTO regulations (title, description, status) VALUES (
    'ECA - Economic Crime Act',
    'ECA outlines consumer protection and trade compliance frameworks.',
    'Active'
);

-- Insert DPA - Data Privacy Act
INSERT INTO regulations (title, description, status) VALUES (
    'DPA - Data Privacy Act',
    'Data Privacy Act provides protection of personal information collected by organizations.',
    'Active'
);

-- Verify the insertions
SELECT regulation_id, title, status FROM regulations ORDER BY regulation_id;