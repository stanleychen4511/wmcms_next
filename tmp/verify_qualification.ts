import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// 1. Setup Env
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/DATABASE_URL="([^"]+)"/);
  if (match) {
    process.env.DATABASE_URL = match[1];
  }
}

// 2. Mock Application Logic Wrapper
async function runTest() {
    const { pool } = await import('../src/lib/db');
    const { checkApplicationStatus, createNewApplication } = await import('../src/app/actions/applicationActions');
    
    const client = await pool.connect();
    try {
        console.log('--- Verification Test: Qualification Logic ---');
        
        // Setup Test Data
        const testName = '測試人員_' + Date.now();
        const testId = 'Z' + Math.floor(Math.random() * 900000000 + 100000000); // Random Z123456789
        
        console.log(`Checking status for NEW user: ${testName} (${testId})`);
        let res = await checkApplicationStatus(testId);
        console.log('New User Result:', JSON.stringify(res, null, 2));
        if (res.found === false && res.hasActiveApplication === undefined) {
             console.log('✅ Correct: New user not found.');
        } else {
             console.error('❌ Error: New user should not be found.');
        }

        console.log('\n--- Scenario: Create First Application ---');
        const createRes = await createNewApplication(testName, testId, 'admin_01');
        console.log('Create Application Result:', JSON.stringify(createRes, null, 2));
        if (createRes.success) {
            console.log('✅ Correct: Application created.');
        } else {
            console.error('❌ Error: Failed to create application.', createRes.error);
            return;
        }

        console.log('\n--- Scenario: Check Active Application ---');
        res = await checkApplicationStatus(testId);
        console.log('Active User Result:', JSON.stringify(res, null, 2));
        if (res.found === true && res.hasActiveApplication === true) {
            console.log('✅ Correct: Identified active application.');
        } else {
            console.error('❌ Error: Should have active application.');
        }

        console.log('\n--- Scenario: Close Application (Rejected) and Re-check ---');
        // Manually update status to '2' (Rejected) in DB
        await client.query(`UPDATE applications SET status = '2' WHERE id = $1`, [createRes.caseId]);
        res = await checkApplicationStatus(testId);
        if (res.found === true && res.hasActiveApplication === false) {
            console.log('✅ Correct: Identified NO active application after rejection.');
        } else {
            console.error('❌ Error: Should not have active application after rejection.');
        }

        console.log('\n--- Scenario: Check Amount Summing ---');
        // Add a COMPLETED application (status '4') with 200,000
        const appRes = await client.query(`
            INSERT INTO applications (case_number, applicant_id, officer_id, status, apply_at, approved_amount)
            SELECT 'TEST' || id, applicant_id, officer_id, '4', NOW(), 200000
            FROM applications WHERE id = $1
            RETURNING id
        `, [createRes.caseId]);

        res = await checkApplicationStatus(testId);
        console.log('Total Approved Amount:', res.totalApprovedAmount);
        if (res.totalApprovedAmount === 200000) {
            console.log('✅ Correct: Amount summed correctly.');
        } else {
            console.error('❌ Error: Total amount mismatch.');
        }

        // Cleanup test data
        console.log('\nCleaning up test data...');
        const userRes = await client.query(`SELECT id FROM users WHERE id_number_bidx IS NOT NULL`); 
        // Note: we'd need to find the specific user via blind index again or just use ids from the flow
        // For simplicity, we'll just leave it or use the id we got during the flow if we captured it
        await client.query(`DELETE FROM application_workflow WHERE application_id IN (SELECT id FROM applications WHERE applicant_id = (SELECT applicant_id FROM applications WHERE id = $1))`, [createRes.caseId]);
        await client.query(`DELETE FROM applications WHERE applicant_id = (SELECT applicant_id FROM applications WHERE id = $1)`, [createRes.caseId]);
        // To delete the user, we need their ID. Luckily createNewApplication doesn't return it easily, 
        // but we can query it from the application record.
        await client.query(`DELETE FROM user_roles WHERE user_id = (SELECT applicant_id FROM applications WHERE id = $1)`, [createRes.caseId]);
        await client.query(`DELETE FROM users WHERE id = (SELECT applicant_id FROM applications WHERE id = $1)`, [createRes.caseId]);

        console.log('\n--- VERIFICATION COMPLETED ---');

    } catch (err) {
        console.error('Test script error:', err);
    } finally {
        client.release();
        process.exit(0);
    }
}

runTest();
