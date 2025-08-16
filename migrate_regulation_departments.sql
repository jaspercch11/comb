-- Migration Script: Populate regulation_departments table
-- This script migrates existing regulation department data to the new many-to-many structure

-- First, ensure the regulation_departments table exists
-- (This should already be created by the server.js ensureSchema function)

-- Clear existing data (if any)
DELETE FROM regulation_departments;

-- Insert departments for existing regulations based on their current department field
-- This assumes existing regulations have a 'department' field

-- For regulations that already have a department field, create the relationship
INSERT INTO regulation_departments (regulation_id, department)
SELECT regulation_id, department 
FROM regulations 
WHERE department IS NOT NULL AND department != '';

-- If you want to set default departments for regulations without any:
-- UPDATE regulations SET department = 'Compliance' WHERE department IS NULL OR department = '';

-- Verify the migration
SELECT 
    r.regulation_id,
    r.title,
    r.department as old_department,
    array_agg(rd.department) as new_departments
FROM regulations r
LEFT JOIN regulation_departments rd ON r.regulation_id = rd.regulation_id
GROUP BY r.regulation_id, r.title, r.department
ORDER BY r.regulation_id;

-- Show count of regulations with departments
SELECT 
    COUNT(*) as total_regulations,
    COUNT(CASE WHEN rd.department IS NOT NULL THEN 1 END) as regulations_with_departments
FROM regulations r
LEFT JOIN regulation_departments rd ON r.regulation_id = rd.regulation_id;