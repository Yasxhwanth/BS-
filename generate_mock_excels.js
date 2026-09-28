/**
 * generate_mock_excels.js
 * Generates 6 separate Excel files for OntologyBuilder mock data:
 *   Department, Worker, Material, Process, Sensor, Product
 * Run: node generate_mock_excels.js
 */

const XLSX = require('xlsx');
const path = require('path');
const fs   = require('fs');

const OUT_DIR = path.join(__dirname, 'mock_excel_data');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

function write(filename, rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  // Auto-width columns
  const colWidths = Object.keys(rows[0] || {}).map(k => ({
    wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)) + 2
  }));
  ws['!cols'] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  const outPath = path.join(OUT_DIR, filename);
  XLSX.writeFile(wb, outPath);
  console.log(`✔  ${filename}  (${rows.length} rows)`);
}

// ─── 1. DEPARTMENT ───────────────────────────────────────────
write('department.xlsx', [
  { Department_ID: 'DEPT-001', Name: 'Production',         Subtype: 'Production',        Head_Count: 120, Shift: '24/7',      Location: 'Block A', Manager: 'Karan Verma',    Budget_INR: 5000000, Status: 'Active' },
  { Department_ID: 'DEPT-002', Name: 'Quality Assurance',  Subtype: 'Quality Assurance', Head_Count: 30,  Shift: 'Day',       Location: 'Block B', Manager: 'Priya Singh',    Budget_INR: 1500000, Status: 'Active' },
  { Department_ID: 'DEPT-003', Name: 'Maintenance',        Subtype: 'Maintenance',       Head_Count: 20,  Shift: 'Day+Night', Location: 'Block C', Manager: 'Ravi Kumar',     Budget_INR: 800000,  Status: 'Active' },
  { Department_ID: 'DEPT-004', Name: 'Logistics',          Subtype: 'Logistics',         Head_Count: 25,  Shift: 'Day',       Location: 'Block D', Manager: 'Meena Pillai',   Budget_INR: 600000,  Status: 'Active' },
  { Department_ID: 'DEPT-005', Name: 'Management',         Subtype: 'Management',        Head_Count: 10,  Shift: 'General',   Location: 'HQ',      Manager: 'Anand Sharma',   Budget_INR: 2000000, Status: 'Active' },
  { Department_ID: 'DEPT-006', Name: 'R&D Engineering',    Subtype: 'Management',        Head_Count: 15,  Shift: 'General',   Location: 'Block E', Manager: 'Dr. Nair',       Budget_INR: 3000000, Status: 'Active' },
]);

// ─── 2. WORKER ───────────────────────────────────────────────
write('worker.xlsx', [
  { Worker_ID: 'EMP-1021', Name: 'Rajesh Kumar',    Subtype: 'Operator',          Department: 'Production',        Shift: 'Morning',   Age: 34, Experience_Yrs: 8,  Certifications: 'AWS D1.1',        Salary_INR: 28000,  Status: 'Active' },
  { Worker_ID: 'EMP-2045', Name: 'Priya Singh',     Subtype: 'Quality Inspector', Department: 'Quality Assurance', Shift: 'Afternoon', Age: 29, Experience_Yrs: 5,  Certifications: 'Six Sigma GB',    Salary_INR: 35000,  Status: 'Active' },
  { Worker_ID: 'EMP-3077', Name: 'Arun Mehta',      Subtype: 'Technician',        Department: 'Production',        Shift: 'Morning',   Age: 41, Experience_Yrs: 14, Certifications: 'CNC Level 3',     Salary_INR: 32000,  Status: 'Active' },
  { Worker_ID: 'EMP-4012', Name: 'Sunita Rao',      Subtype: 'Engineer',          Department: 'Production',        Shift: 'General',   Age: 35, Experience_Yrs: 9,  Certifications: 'BE Mechanical',   Salary_INR: 55000,  Status: 'Active' },
  { Worker_ID: 'EMP-5003', Name: 'Karan Verma',     Subtype: 'Supervisor',        Department: 'Production',        Shift: 'Rotating',  Age: 44, Experience_Yrs: 18, Certifications: 'PMP',             Salary_INR: 65000,  Status: 'Active' },
  { Worker_ID: 'EMP-6018', Name: 'Meena Pillai',    Subtype: 'Operator',          Department: 'Logistics',         Shift: 'Morning',   Age: 30, Experience_Yrs: 4,  Certifications: 'Forklift License', Salary_INR: 25000, Status: 'Active' },
  { Worker_ID: 'EMP-7031', Name: 'Vikram Nair',     Subtype: 'Technician',        Department: 'Maintenance',       Shift: 'Night',     Age: 38, Experience_Yrs: 11, Certifications: 'Electrical Safety', Salary_INR: 30000, Status: 'Active' },
  { Worker_ID: 'EMP-8044', Name: 'Deepa Reddy',     Subtype: 'Engineer',          Department: 'Quality Assurance', Shift: 'General',   Age: 32, Experience_Yrs: 7,  Certifications: 'Six Sigma BB',    Salary_INR: 60000,  Status: 'Active' },
  { Worker_ID: 'EMP-9001', Name: 'Suresh Patil',    Subtype: 'Operator',          Department: 'Production',        Shift: 'Afternoon', Age: 27, Experience_Yrs: 2,  Certifications: 'Safety Induction', Salary_INR: 22000, Status: 'Active' },
  { Worker_ID: 'EMP-9055', Name: 'Lakshmi Iyer',    Subtype: 'Supervisor',        Department: 'Quality Assurance', Shift: 'Morning',   Age: 46, Experience_Yrs: 20, Certifications: 'ISO 9001 LA',     Salary_INR: 70000,  Status: 'On Leave' },
]);

// ─── 3. MATERIAL ─────────────────────────────────────────────
write('material.xlsx', [
  { Material_ID: 'MAT-001', Name: 'Steel Sheet IS 2062',      Subtype: 'Steel',        Grade: 'E250',      Supplier: 'SAIL',             Unit: 'kg',  Unit_Cost_INR: 75.5,  Stock_Qty: 8400, Reorder_Level: 1000, Lead_Time_Days: 7,  Status: 'In Stock' },
  { Material_ID: 'MAT-002', Name: 'Aluminium Alloy 6061',     Subtype: 'Aluminium',    Grade: '6061-T6',   Supplier: 'Hindalco',         Unit: 'kg',  Unit_Cost_INR: 210,   Stock_Qty: 3200, Reorder_Level: 500,  Lead_Time_Days: 10, Status: 'In Stock' },
  { Material_ID: 'MAT-003', Name: 'ABS Plastic Resin',        Subtype: 'Plastic',      Grade: 'HI-ABS',    Supplier: 'Reliance Industries', Unit: 'kg', Unit_Cost_INR: 95,  Stock_Qty: 1500, Reorder_Level: 300,  Lead_Time_Days: 5,  Status: 'In Stock' },
  { Material_ID: 'MAT-004', Name: 'Neoprene Rubber Sheet',    Subtype: 'Rubber',       Grade: 'CR-40',     Supplier: 'Elasto Proxy',     Unit: 'kg',  Unit_Cost_INR: 180,   Stock_Qty: 600,  Reorder_Level: 100,  Lead_Time_Days: 8,  Status: 'Low Stock' },
  { Material_ID: 'MAT-005', Name: 'Bearing Sub-Assembly',     Subtype: 'Sub-Assembly', Grade: 'SKF 6205',  Supplier: 'SKF India',        Unit: 'pcs', Unit_Cost_INR: 450,   Stock_Qty: 800,  Reorder_Level: 200,  Lead_Time_Days: 14, Status: 'In Stock' },
  { Material_ID: 'MAT-006', Name: 'Copper Wire 2.5mm',        Subtype: 'Component A',  Grade: 'ETP Cu',    Supplier: 'Sterlite',         Unit: 'mtr', Unit_Cost_INR: 55,    Stock_Qty: 5000, Reorder_Level: 800,  Lead_Time_Days: 6,  Status: 'In Stock' },
  { Material_ID: 'MAT-007', Name: 'M12 Hex Bolts SS',         Subtype: 'Component A',  Grade: 'SS 316',    Supplier: 'Sundaram Fasteners', Unit: 'pcs', Unit_Cost_INR: 8,  Stock_Qty: 20000, Reorder_Level: 5000, Lead_Time_Days: 3,  Status: 'In Stock' },
  { Material_ID: 'MAT-008', Name: 'Hydraulic Oil ISO VG 68',  Subtype: 'Raw Input',    Grade: 'VG 68',     Supplier: 'Castrol India',    Unit: 'ltr', Unit_Cost_INR: 120,   Stock_Qty: 2000, Reorder_Level: 400,  Lead_Time_Days: 4,  Status: 'In Stock' },
  { Material_ID: 'MAT-009', Name: 'Powder Coat Paint Grey',   Subtype: 'Raw Input',    Grade: 'RAL 7035',  Supplier: 'Berger Paints',    Unit: 'kg',  Unit_Cost_INR: 350,   Stock_Qty: 400,  Reorder_Level: 80,   Lead_Time_Days: 5,  Status: 'Low Stock' },
  { Material_ID: 'MAT-010', Name: 'HDPE Corrugated Box L',    Subtype: 'Raw Input',    Grade: 'BC Flute',  Supplier: 'ITC Packaging',    Unit: 'pcs', Unit_Cost_INR: 45,    Stock_Qty: 3000, Reorder_Level: 600,  Lead_Time_Days: 2,  Status: 'In Stock' },
]);

// ─── 4. PROCESS ──────────────────────────────────────────────
write('process.xlsx', [
  { Process_ID: 'PROC-001', Name: 'MIG Welding Station W1',   Subtype: 'Welding',       Department: 'Production',        Machine: 'Lincoln Electric POWER MIG 260', Cycle_Time_Min: 4.5,  Defect_Rate_Pct: 1.2, Uptime_Pct: 92, Shift_Output: 200, Temp_C: 1500,  Status: 'Running' },
  { Process_ID: 'PROC-002', Name: 'CNC Machining Line A',     Subtype: 'CNC Machining', Department: 'Production',        Machine: 'Haas VF-3',                      Cycle_Time_Min: 12,   Defect_Rate_Pct: 0.8, Uptime_Pct: 88, Shift_Output: 80,  Temp_C: 45,    Status: 'Running' },
  { Process_ID: 'PROC-003', Name: 'Final Assembly Cell 3',    Subtype: 'Assembly',      Department: 'Production',        Machine: 'Manual + Torque Tools',          Cycle_Time_Min: 25,   Defect_Rate_Pct: 2.1, Uptime_Pct: 95, Shift_Output: 45,  Temp_C: 28,    Status: 'Running' },
  { Process_ID: 'PROC-004', Name: 'Quality Inspection QC1',   Subtype: 'Quality Check', Department: 'Quality Assurance', Machine: 'Zeiss CMM + Vision System',      Cycle_Time_Min: 8,    Defect_Rate_Pct: 0.0, Uptime_Pct: 98, Shift_Output: 120, Temp_C: 24,    Status: 'Running' },
  { Process_ID: 'PROC-005', Name: 'Electrostatic Painting',   Subtype: 'Painting',      Department: 'Production',        Machine: 'Nordson Powder Coat System',     Cycle_Time_Min: 18,   Defect_Rate_Pct: 1.5, Uptime_Pct: 90, Shift_Output: 60,  Temp_C: 185,   Status: 'Running' },
  { Process_ID: 'PROC-006', Name: 'Packaging and Dispatch',   Subtype: 'Packaging',     Department: 'Logistics',         Machine: 'Conveyor + Stretch Wrap',        Cycle_Time_Min: 5,    Defect_Rate_Pct: 0.2, Uptime_Pct: 99, Shift_Output: 300, Temp_C: 26,    Status: 'Running' },
  { Process_ID: 'PROC-007', Name: 'Robotic Spot Welding R2',  Subtype: 'Welding',       Department: 'Production',        Machine: 'FANUC ArcMate 120iD',            Cycle_Time_Min: 2.0,  Defect_Rate_Pct: 0.5, Uptime_Pct: 96, Shift_Output: 350, Temp_C: 1400,  Status: 'Idle' },
  { Process_ID: 'PROC-008', Name: 'Incoming Inspection IQC',  Subtype: 'Inspection',    Department: 'Quality Assurance', Machine: 'Manual + Go-No-Go Gauges',       Cycle_Time_Min: 15,   Defect_Rate_Pct: 0.0, Uptime_Pct: 97, Shift_Output: 50,  Temp_C: 24,    Status: 'Running' },
]);

// ─── 5. SENSOR ───────────────────────────────────────────────
write('sensor.xlsx', [
  { Sensor_ID: 'SEN-T001', Name: 'Thermocouple TS-W1',       Subtype: 'Temperature', Process: 'MIG Welding Station W1',  Unit: 'degC', Range_Min: 0, Range_Max: 2000, Current_Value: 1485, Threshold_High: 1600, Threshold_Low: 800,  Calibrated_On: '2026-08-01', Status: 'OK',      Protocol: 'Modbus RTU' },
  { Sensor_ID: 'SEN-V001', Name: 'Vibration Sensor VS-CNC1', Subtype: 'Vibration',   Process: 'CNC Machining Line A',    Unit: 'mm/s', Range_Min: 0, Range_Max: 50,   Current_Value: 3.2,  Threshold_High: 7.5,  Threshold_Low: 0,    Calibrated_On: '2026-09-01', Status: 'OK',      Protocol: 'OPC-UA' },
  { Sensor_ID: 'SEN-P001', Name: 'Pressure Sensor PS-HYD1',  Subtype: 'Pressure',    Process: 'Final Assembly Cell 3',   Unit: 'bar',  Range_Min: 0, Range_Max: 250,  Current_Value: 182,  Threshold_High: 210,  Threshold_Low: 50,   Calibrated_On: '2026-07-15', Status: 'WARNING', Protocol: 'HART' },
  { Sensor_ID: 'SEN-H001', Name: 'Humidity Sensor HM-PKG1',  Subtype: 'Humidity',    Process: 'Packaging and Dispatch',  Unit: '%RH',  Range_Min: 0, Range_Max: 100,  Current_Value: 58,   Threshold_High: 80,   Threshold_Low: 20,   Calibrated_On: '2026-08-20', Status: 'OK',      Protocol: 'BACnet' },
  { Sensor_ID: 'SEN-E001', Name: 'Power Meter PM-PAINT1',    Subtype: 'Power',       Process: 'Electrostatic Painting',  Unit: 'kW',   Range_Min: 0, Range_Max: 500,  Current_Value: 312,  Threshold_High: 450,  Threshold_Low: 10,   Calibrated_On: '2026-09-10', Status: 'OK',      Protocol: 'Modbus TCP' },
  { Sensor_ID: 'SEN-F001', Name: 'Flow Sensor FS-COOL1',     Subtype: 'Flow',        Process: 'CNC Machining Line A',    Unit: 'L/min',Range_Min: 0, Range_Max: 100,  Current_Value: 45,   Threshold_High: 80,   Threshold_Low: 10,   Calibrated_On: '2026-08-05', Status: 'OK',      Protocol: 'IO-Link' },
  { Sensor_ID: 'SEN-S001', Name: 'Speed Sensor RPM-CNC1',    Subtype: 'Speed',       Process: 'CNC Machining Line A',    Unit: 'RPM',  Range_Min: 0, Range_Max: 8000, Current_Value: 6020, Threshold_High: 7500, Threshold_Low: 500,  Calibrated_On: '2026-09-01', Status: 'OK',      Protocol: 'OPC-UA' },
  { Sensor_ID: 'SEN-T002', Name: 'Thermocouple TS-PAINT1',   Subtype: 'Temperature', Process: 'Electrostatic Painting',  Unit: 'degC', Range_Min: 0, Range_Max: 300,  Current_Value: 187,  Threshold_High: 200,  Threshold_Low: 160,  Calibrated_On: '2026-08-15', Status: 'OK',      Protocol: 'Modbus RTU' },
]);

// ─── 6. PRODUCT ──────────────────────────────────────────────
write('product.xlsx', [
  { Product_ID: 'PRD-CH-001', Name: 'Steel Chassis Frame',       Subtype: 'Sub-Assembly',  SKU: 'SCF-2026-001', Weight_kg: 18.5, Daily_Output: 200, QC_Pass_Rate_Pct: 98.8, Unit_Cost_INR: 1850,  Selling_Price_INR: 2800,  Warranty_Months: 12, Customer: 'Internal',         Status: 'Active' },
  { Product_ID: 'PRD-AH-002', Name: 'Aluminium Housing',          Subtype: 'Component',     SKU: 'ALH-2026-002', Weight_kg: 2.1,  Daily_Output: 85,  QC_Pass_Rate_Pct: 99.2, Unit_Cost_INR: 780,   Selling_Price_INR: 1200,  Warranty_Months: 12, Customer: 'Internal',         Status: 'Active' },
  { Product_ID: 'PRD-DU-010', Name: 'Assembled Drive Unit',       Subtype: 'Final Product', SKU: 'ADU-2026-010', Weight_kg: 28,   Daily_Output: 45,  QC_Pass_Rate_Pct: 96.5, Unit_Cost_INR: 12500, Selling_Price_INR: 18000, Warranty_Months: 24, Customer: 'Siemens India',    Status: 'Active' },
  { Product_ID: 'PRD-PB-020', Name: 'Painted Batch Output',       Subtype: 'Batch Output',  SKU: 'PBO-2026-020', Weight_kg: 5.0,  Daily_Output: 500, QC_Pass_Rate_Pct: 97.5, Unit_Cost_INR: 200,   Selling_Price_INR: 320,   Warranty_Months: 6,  Customer: 'Various',          Status: 'Active' },
  { Product_ID: 'PRD-MC-030', Name: 'Motor Control Box',          Subtype: 'Final Product', SKU: 'MCB-2026-030', Weight_kg: 8.5,  Daily_Output: 30,  QC_Pass_Rate_Pct: 99.0, Unit_Cost_INR: 6800,  Selling_Price_INR: 9500,  Warranty_Months: 24, Customer: 'ABB India',        Status: 'Active' },
  { Product_ID: 'PRD-WA-040', Name: 'Welded Bracket Assembly',    Subtype: 'Sub-Assembly',  SKU: 'WBA-2026-040', Weight_kg: 3.2,  Daily_Output: 150, QC_Pass_Rate_Pct: 98.1, Unit_Cost_INR: 420,   Selling_Price_INR: 650,   Warranty_Months: 12, Customer: 'Internal',         Status: 'Active' },
  { Product_ID: 'PRD-ENC-050',Name: 'ABS Enclosure Panel',        Subtype: 'Component',     SKU: 'AEP-2026-050', Weight_kg: 1.1,  Daily_Output: 200, QC_Pass_Rate_Pct: 99.5, Unit_Cost_INR: 310,   Selling_Price_INR: 480,   Warranty_Months: 12, Customer: 'Multiple OEMs',    Status: 'Active' },
]);

console.log('\nAll 6 Excel files created in:', OUT_DIR);
