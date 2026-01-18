const pool = require('../db');
const multer = require('multer');
const Papa = require('papaparse');
const fetch = require('node-fetch');
const XLSX = require('xlsx');

const upload = multer({ storage: multer.memoryStorage() });

const normalizePhone = (p) => (p || '').replace(/\D/g, '').trim();

const getLeads = async (req, res) => {
  const { role, id: user_id } = req.user;

  try {
    let result;

    if (role === 'relationship_mgr') {
      console.log(`🔍 Fetching leads for RM with user_id: ${user_id}, role: ${role}`);
      result = await pool.query(
        `SELECT l.*, u.display_name AS assigned_user_name, u.role AS assigned_user_role
         FROM leads l
         LEFT JOIN users u ON l.assigned_to = u.id
         WHERE l.assigned_to = $1
         ORDER BY l.date DESC NULLS LAST`,
        [user_id]
      );
      console.log(`✅ RM fetched ${result.rows.length} leads assigned to user_id: ${user_id}`);
    } else if (role === 'financial_manager') {
      result = await pool.query(
        `SELECT l.*, u.display_name AS assigned_user_name, u.role AS assigned_user_role
         FROM leads l
         LEFT JOIN users u ON l.assigned_to = u.id
         ORDER BY l.date DESC NULLS LAST`
      );
    } else if (role === 'team_leader') {
      const teamRes = await pool.query(
        'SELECT team_id FROM users WHERE id = $1',
        [user_id]
      );
      const teamId = teamRes.rows[0]?.team_id;

      if (teamId) {
        result = await pool.query(
          `SELECT l.*, u.display_name AS assigned_user_name, u.role AS assigned_user_role
           FROM leads l
           LEFT JOIN users u ON l.assigned_to = u.id
           WHERE l.team_id = $1
           ORDER BY l.date DESC NULLS LAST`,
          [teamId]
        );
      } else {
        result = { rows: [] };
      }
    } else if (role === 'admin') {
      result = await pool.query(
        `SELECT l.*, u.display_name AS assigned_user_name, u.role AS assigned_user_role
         FROM leads l
         LEFT JOIN users u ON l.assigned_to = u.id
         ORDER BY l.date DESC NULLS LAST`
      );
        console.log(`✅ Admin fetched ${result.rows.length} leads`);
    } else {
      result = await pool.query(
        `SELECT l.*, u.display_name AS assigned_user_name, u.role AS assigned_user_role
         FROM leads l
         LEFT JOIN users u ON l.assigned_to = u.id
         ORDER BY l.date DESC NULLS LAST`
      );
        console.log(`✅ Super Admin fetched ${result.rows.length} leads`);
    }

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Failed to fetch leads:', err.message);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

const addLead = async (req, res) => {
  const {
    fullName,
    email,
    phone,
    altNumber,
    notes,
    deematAccountName,
    profession,
    stateName,
    capital,
    segment,
    team_id,
    assigned_to,
    tags,
    source
  } = req.body;
  const { role, id: user_id } = req.user;

  console.log('🔍 addLead called with:', {
    role,
    user_id,
    assigned_to,
    team_id,
    tags,
    fullName
  });
  console.log('📦 Full request body:', JSON.stringify(req.body, null, 2));

  if (!fullName || !phone) {
    return res.status(400).json({ error: 'Full name and phone are required' });
  }

  const phoneNorm = normalizePhone(phone);
  
  // Validate phone number is exactly 10 digits
  if (phoneNorm.length !== 10) {
    return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
  }

  try {
    const existing = await pool.query('SELECT id FROM leads WHERE phone = $1', [phoneNorm]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Lead with this phone number already exists' });
    }

    // Validate alternate number if provided
    if (altNumber) {
      const altNumberNorm = normalizePhone(altNumber);
      
      // Validate alternate number is exactly 10 digits if provided
      if (altNumberNorm.length !== 10) {
        return res.status(400).json({ error: 'Alternate number must be exactly 10 digits' });
      }

      // First check: Alternate number cannot match the phone number of the same lead
      if (altNumberNorm === phoneNorm) {
        return res.status(400).json({ error: 'Alternate number cannot be the same as the phone number' });
      }

      // Check if phone number matches any alternate number (before checking altNumber uniqueness)
      const phoneMatchesAlt = await pool.query('SELECT id FROM leads WHERE alt_number = $1', [phoneNorm]);
      if (phoneMatchesAlt.rows.length > 0) {
        return res.status(400).json({ error: 'Phone number cannot match an alternate number of another lead' });
      }

      // Second check: Alternate number must be unique from all other leads' phone and alt numbers
      const altNumberCheck = await pool.query(
        'SELECT id FROM leads WHERE phone = $1 OR alt_number = $1',
        [altNumberNorm]
      );
      if (altNumberCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Alternate number must be unique and cannot match any phone number or alternate number' });
      }
    }

    let assignedTo = null;
    let finalTeamId = team_id;

    // Use assigned_to from frontend if provided, otherwise use role-based logic
    if (assigned_to) {
      console.log('✅ Using assigned_to from frontend:', assigned_to);
      assignedTo = assigned_to;
      // Get team_id from the assigned user if not provided
      if (!finalTeamId) {
        const userRes = await pool.query('SELECT team_id FROM users WHERE id = $1', [assigned_to]);
        finalTeamId = userRes.rows[0]?.team_id || null;
        console.log('📋 Got team_id from assigned user:', finalTeamId);
      }
    } else if (role === 'relationship_mgr' || role === 'financial_manager') {
      console.log('✅ Using role-based assignment for:', role, user_id);
      assignedTo = user_id;
      if (!finalTeamId) {
        const rm = await pool.query('SELECT team_id FROM users WHERE id = $1', [user_id]);
        finalTeamId = rm.rows[0]?.team_id || null;
        console.log('📋 Got team_id from user:', finalTeamId);
      }
    } else {
      console.log('⚠️ No assignment logic applied for role:', role);
    }

    console.log('🎯 Final assignment values:', {
      assignedTo,
      finalTeamId,
      safeAssignedTo: assignedTo && assignedTo.trim() !== '' ? assignedTo : null,
      safeTeamId: finalTeamId && finalTeamId.trim() !== '' ? finalTeamId : null
    });

    const safeTeamId = finalTeamId && finalTeamId.trim() !== '' ? finalTeamId : null;
    const safeAssignedTo = assignedTo && assignedTo.trim() !== '' ? assignedTo : null;

    const assignedAt = safeAssignedTo ? new Date() : null;

    const result = await pool.query(
      `INSERT INTO leads (
        full_name,
        email,
        phone,
        alt_number,
        notes,
        deemat_account_name,
        profession,
        state_name,
        capital,
        segment,
        team_id,
        assigned_to,
        assigned_at,
        tags,
        source
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        fullName,
        email,
        phoneNorm,
        altNumber || '',
        notes || '',
        deematAccountName || '',
        profession || '',
        stateName || '',
        capital || '',
        segment || '',
        safeTeamId,
        safeAssignedTo,
        assignedAt,
        tags || '',
        source || ''
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Failed to add lead:', err.message);
    res.status(500).json({ error: 'Failed to add lead' });
  }
};

const updateLead = async (req, res) => {
  // Sanitize ID parameter - remove any trailing :1 or other suffixes
  let { id } = req.params;
  // Remove trailing colon and numbers (e.g., ":1" becomes "")
  id = id.split(':')[0].trim();
  
  const { role, id: user_id } = req.user;
  const {
    fullName, email, phone, altNumber, notes, deematAccountName,
    profession, stateName, capital, segment, gender, dob, age,
    panCardNumber, aadharCardNumber, paymentHistory, status,
    team_id, assigned_to, tags, source
  } = req.body;

  try {
    console.log('🔍 [updateLead] Updating lead ID:', id);
    console.log('🔍 [updateLead] Original ID from params:', req.params.id);
    console.log('🔍 [updateLead] Payload:', JSON.stringify(req.body, null, 2));
    console.log('🔍 [updateLead] User role:', role, 'User ID:', user_id);

    // Validate required fields
    if (!fullName || !phone || !status) {
      console.error('❌ [updateLead] Missing required fields:', { fullName: !!fullName, phone: !!phone, status: !!status });
      return res.status(400).json({ error: 'Missing required fields: fullName, phone, and status are required' });
    }

    // Check if lead exists first (we need existing altNumber for validation)
    const existingLeadRes = await pool.query(
      'SELECT assigned_to, team_id, assigned_at, alt_number FROM leads WHERE id = $1',
      [id]
    );

    if (existingLeadRes.rows.length === 0) {
      console.error('❌ [updateLead] Lead not found with ID:', id);
      return res.status(404).json({ error: 'Lead not found' });
    }

    const existingAltNumber = existingLeadRes.rows[0].alt_number;

    // Normalize phone number
    const phoneNorm = normalizePhone(phone);
    if (phoneNorm.length !== 10) {
      console.error('❌ [updateLead] Invalid phone number:', phone, 'normalized:', phoneNorm);
      return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
    }

    // Check if phone number already exists on another lead
    const phoneCheckRes = await pool.query(
      'SELECT id FROM leads WHERE phone = $1 AND id != $2',
      [phoneNorm, id]
    );
    if (phoneCheckRes.rows.length > 0) {
      console.error('❌ [updateLead] Phone number already exists on another lead');
      return res.status(400).json({ error: 'Phone number already exists on another lead' });
    }

    // Get the altNumber being set (either new value or keep existing)
    const altNumberToUse = altNumber !== undefined ? altNumber : existingAltNumber;
    const altNumberNorm = altNumberToUse ? normalizePhone(altNumberToUse) : null;

    // Check: Phone number cannot match the alternate number of the same lead
    if (altNumberNorm && phoneNorm === altNumberNorm) {
      return res.status(400).json({ error: 'Phone number cannot be the same as the alternate number' });
    }

    // Also check if phone number matches any alternate number of other leads (excluding current lead)
    const phoneMatchesAltRes = await pool.query(
      'SELECT id FROM leads WHERE alt_number = $1 AND id != $2',
      [phoneNorm, id]
    );
    if (phoneMatchesAltRes.rows.length > 0) {
      console.error('❌ [updateLead] Phone number matches an alternate number on another lead');
      return res.status(400).json({ error: 'Phone number cannot match an alternate number of another lead' });
    }

    // Validate alternate number if provided
    if (altNumber !== undefined) {
      const altNumberNorm = normalizePhone(altNumber);
      
      // Validate alternate number is exactly 10 digits if provided (empty string is allowed)
      if (altNumberNorm.length > 0 && altNumberNorm.length !== 10) {
        return res.status(400).json({ error: 'Alternate number must be exactly 10 digits' });
      }

      // Only validate uniqueness if altNumber is being set (not empty)
      if (altNumberNorm.length > 0) {
        // First check: Alternate number cannot match the phone number of the same lead
        if (altNumberNorm === phoneNorm) {
          return res.status(400).json({ error: 'Alternate number cannot be the same as the phone number' });
        }

        // Second check: Alternate number must be unique from all other leads' phone and alt numbers
        const altNumberCheck = await pool.query(
          'SELECT id FROM leads WHERE (phone = $1 OR alt_number = $1) AND id != $2',
          [altNumberNorm, id]
        );
        if (altNumberCheck.rows.length > 0) {
          return res.status(400).json({ error: 'Alternate number must be unique and cannot match any phone number or alternate number' });
        }
      }
    }

    const existingLead = existingLeadRes.rows[0];
    const isRMorFM = role === 'relationship_mgr' || role === 'financial_manager';

    let finalAssignedTo = assigned_to;
    if (finalAssignedTo === undefined || finalAssignedTo === null) {
      finalAssignedTo = existingLead.assigned_to;
    } else if (typeof finalAssignedTo === 'string' && finalAssignedTo.trim() === '') {
      finalAssignedTo = null;
    }

    let finalTeamId = team_id;
    if (finalTeamId === undefined || finalTeamId === null || (typeof finalTeamId === 'string' && finalTeamId.trim() === '')) {
      finalTeamId = existingLead.team_id;
    }

    if (isRMorFM) {
      finalAssignedTo = existingLead.assigned_to;
      finalTeamId = existingLead.team_id;
    }

    let assignedAtValue = existingLead.assigned_at;
    if (finalAssignedTo && finalAssignedTo !== existingLead.assigned_to) {
      assignedAtValue = new Date();
    } else if (!finalAssignedTo) {
      assignedAtValue = null;
    }

    // Prepare age value - handle string to number conversion
    let ageValue = null;
    if (age !== undefined && age !== null && age !== '') {
      const ageNum = Number(age);
      ageValue = isNaN(ageNum) ? null : ageNum;
    }

    // Prepare dob value
    let dobValue = null;
    if (dob !== undefined && dob !== null && typeof dob === 'string' && dob.trim() !== '') {
      dobValue = dob.trim();
    }

    console.log('🔍 [updateLead] Final values:', {
      id,
      finalAssignedTo,
      finalTeamId,
      assignedAtValue,
      ageValue,
      dobValue,
      phoneNorm
    });

    const result = await pool.query(
      `UPDATE leads SET
        full_name = $1, email = $2, phone = $3, alt_number = $4, notes = $5,
        deemat_account_name = $6, profession = $7, state_name = $8, capital = $9,
        segment = $10, gender = $11, dob = $12, age = $13, pan_card_number = $14,
        aadhar_card_number = $15, payment_history = $16, status = $17,
        team_id = $18, assigned_to = $19, assigned_at = $20, tags = $21, source = $22
       WHERE id = $23 RETURNING *`,
      [
        fullName,
        email || null,
        phoneNorm,
        altNumber || '',
        notes || '',
        deematAccountName || '',
        profession || '',
        stateName || '',
        capital || '',
        segment || '',
        gender || '',
        dobValue,
        ageValue,
        panCardNumber || '',
        aadharCardNumber || '',
        paymentHistory || '',
        status,
        finalTeamId || null,
        finalAssignedTo || null,
        assignedAtValue,
        tags || '',
        source || '',
        id
      ]
    );

    console.log('✅ [updateLead] Update success:', result.rows[0]);
    console.log('✅ [updateLead] Final assigned_to:', result.rows[0].assigned_to);
    res.json(result.rows[0]);

  } catch (err) {
    console.error('❌ [updateLead Error] Full error details:');
    console.error('   Error message:', err.message);
    console.error('   Error code:', err.code);
    console.error('   Error detail:', err.detail);
    console.error('   Error hint:', err.hint);
    console.error('   Error stack:', err.stack);
    console.error('   Lead ID:', id);
    console.error('   Request body:', JSON.stringify(req.body, null, 2));
    
    // Return more detailed error message for debugging
    const errorMessage = err.detail || err.message || 'Failed to update lead';
    res.status(500).json({ 
      error: 'Failed to update lead',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
};


const assignLead = async (req, res) => {
  const { id } = req.params;
  const { assigned_to } = req.body;

  console.log(`🔍 Assigning lead ${id} to user ${assigned_to}`);

  if (!assigned_to) {
    return res.status(400).json({ error: 'Missing assigned_to value' });
  }

  try {
    const userRes = await pool.query(
      'SELECT team_id, display_name, role FROM users WHERE id = $1',
      [assigned_to]
    );
    
    if (userRes.rows.length === 0) {
      console.error(`❌ User ${assigned_to} not found`);
      return res.status(404).json({ error: 'User not found' });
    }

    const userTeamId = userRes.rows[0]?.team_id || null;
    console.log(`✅ Found user: ${userRes.rows[0].display_name}, team_id: ${userTeamId}`);

    const currentLeadRes = await pool.query(
      'SELECT assigned_to, assigned_at FROM leads WHERE id = $1',
      [id]
    );

    if (currentLeadRes.rows.length === 0) {
      console.error(`❌ Lead ${id} not found`);
      return res.status(404).json({ error: 'Lead not found' });
    }

    const currentLead = currentLeadRes.rows[0];
    let newAssignedAt = currentLead.assigned_at;
    if (assigned_to && assigned_to !== currentLead.assigned_to) {
      newAssignedAt = new Date();
    } else if (!assigned_to) {
      newAssignedAt = null;
    }

    const result = await pool.query(
      `UPDATE leads
       SET assigned_to = $1,
           team_id = COALESCE(team_id, $2),
           assigned_at = $4
       WHERE id = $3
       RETURNING *`,
      [assigned_to, userTeamId, id, newAssignedAt]
    );

    if (result.rows.length === 0) {
      console.error(`❌ Lead ${id} not found`);
      return res.status(404).json({ error: 'Lead not found' });
    }

    console.log(`✅ Lead ${id} assigned successfully to ${assigned_to}`);
    console.log(`   Lead assigned_to: ${result.rows[0].assigned_to}, team_id: ${result.rows[0].team_id}`);
    
    res.json({ message: 'Lead assigned successfully', lead: result.rows[0] });
  } catch (err) {
    console.error('❌ Failed to assign lead:', err.message);
    console.error('   Full error:', err);
    res.status(500).json({ error: 'Failed to assign lead' });
  }
};

const deleteLead = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM leads WHERE id = $1', [id]);
    res.status(204).end();
  } catch (err) {
    console.error('❌ Failed to delete lead:', err.message);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
};

const uploadLeads = [
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let data = [];
    const fileName = req.file.originalname.toLowerCase();
    
    // Parse file based on extension
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      // Parse Excel file
      try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        console.log(`✅ Parsed Excel file: ${fileName}, found ${data.length} rows`);
      } catch (err) {
        console.error('❌ Error parsing Excel file:', err);
        return res.status(400).json({ error: 'Failed to parse Excel file' });
      }
    } else {
      // Parse CSV file
      try {
        const csvData = req.file.buffer.toString('utf-8');
        const parsed = Papa.parse(csvData, {
          header: true,
          skipEmptyLines: true,
        });
        data = parsed.data;
        console.log(`✅ Parsed CSV file: ${fileName}, found ${data.length} rows`);
      } catch (err) {
        console.error('❌ Error parsing CSV file:', err);
        return res.status(400).json({ error: 'Failed to parse CSV file' });
      }
    }

    const totalParsed = data.length;
    let validCount = 0;

    const client = await pool.connect();
    try {
      const existingPhonesRes = await client.query('SELECT phone FROM leads');
      const existingPhones = new Set(existingPhonesRes.rows.map(r => normalizePhone(r.phone)));
      const sheetPhones = new Set();

      await client.query('BEGIN');
      // Debug: Log first row's keys for file uploads
      if (data.length > 0) {
        console.log(`🔍 [File Upload] All row keys from first row:`, Object.keys(data[0]));
      }

      for (const row of data) {
        const fullName = row['Full Name'] || row.fullName || '';
        const email = row['Email'] || row.email || '';
        const phone = normalizePhone(row['Phone'] || row.phone || '');
        const altNumber = row['Alternate Number'] || row.altNumber || '';
        const notes = row['Notes'] || row.notes || '';
        const deematAccountName = row['Deemat Account Name'] || row.deematAccountName || '';
        const profession = row['Profession'] || row.profession || '';
        const stateName = row['State Name'] || row.stateName || '';
        const capital = row['Capital'] || row.capital || '';
        const segment = row['Segment'] || row.segment || '';
        const team_id = row['Team ID'] || row.team_id || null;
        // Try multiple variations of the "Assigned to" column name (same as Google Sheets)
        const assignedToName = row['Assigned to'] || row['Assigned To'] || row['Assigned to '] || row['assigned to'] || row['Assigned To '] || row.assignedTo || row.assigned_to || row['assigned_to'] || '';
        // Parse Tags column - try multiple variations
        const tags = row['Tags'] || row['Tag'] || row['tags'] || row['tag'] || row['Tags '] || row.tags || row.tag || '';
        // Parse Source column - try multiple variations
        const source = row['Source'] || row['source'] || row.source || '';

        // Debug: Log first valid row's extracted values
        if (validCount === 0 && fullName && phone) {
          console.log(`🔍 [File Upload] assignedToName extracted: "${assignedToName}"`);
          console.log(`🔍 [File Upload] tags extracted: "${tags}"`);
          console.log(`🔍 [File Upload] source extracted: "${source}"`);
          console.log(`🔍 [File Upload] Raw row['Assigned to']:`, row['Assigned to']);
          console.log(`🔍 [File Upload] Raw row['Assigned To']:`, row['Assigned To']);
          console.log(`🔍 [File Upload] Raw row['Tags']:`, row['Tags']);
          console.log(`🔍 [File Upload] Raw row['Source']:`, row['Source']);
        }

        // Look up user by display_name if "Assigned to" is provided
        let assignedTo = null;
        let finalTeamId = team_id && team_id.trim() !== '' ? team_id : null;

        if (assignedToName && assignedToName.trim() !== '') {
          console.log(`🔍 Looking up user: "${assignedToName.trim()}"`);
          const userRes = await client.query(
            `SELECT id, team_id, role, display_name FROM users 
             WHERE LOWER(display_name) = LOWER($1) 
             AND LOWER(status) = 'active' 
             AND (role = 'relationship_mgr' OR role = 'financial_manager')`,
            [assignedToName.trim()]
          );
          if (userRes.rows.length > 0) {
            assignedTo = userRes.rows[0].id;
            // Use the user's team_id if not provided in the row
            if (!finalTeamId && userRes.rows[0].team_id) {
              finalTeamId = userRes.rows[0].team_id;
            }
            console.log(`✅ Found active RM/FM: ${assignedToName} (ID: ${assignedTo}, Role: ${userRes.rows[0].role}, Team: ${finalTeamId})`);
          } else {
            // Try to find if user exists but is not RM/FM or inactive
            const checkRes = await client.query(
              `SELECT id, display_name, role, status FROM users WHERE LOWER(display_name) = LOWER($1)`,
              [assignedToName.trim()]
            );
            if (checkRes.rows.length > 0) {
              console.log(`⚠️ User "${assignedToName}" found but is not an active RM/FM (Role: ${checkRes.rows[0].role}, Status: ${checkRes.rows[0].status}), lead will be unassigned`);
            } else {
              console.log(`⚠️ User "${assignedToName}" not found, lead will be unassigned`);
            }
          }
        }

        const safeTeamId = finalTeamId;

        if (!fullName || !phone) continue;
        // Skip if phone is not exactly 10 digits
        if (phone.length !== 10) continue;
        if (existingPhones.has(phone)) continue;
        if (sheetPhones.has(phone)) continue;

        validCount++;

        const assignedAt = assignedTo ? new Date() : null;

        await client.query(
          `INSERT INTO leads (
            full_name,
            email,
            phone,
            alt_number,
            notes,
            deemat_account_name,
            profession,
            state_name,
            capital,
            segment,
            team_id,
            assigned_to,
            assigned_at,
            tags,
            source
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            fullName,
            email || null,
            phone,
            altNumber,
            notes,
            deematAccountName,
            profession,
            stateName,
            capital,
            segment,
            safeTeamId,
            assignedTo,
            assignedAt,
            tags || '',
            source || ''
          ]
        );

        sheetPhones.add(phone);
      }
      await client.query('COMMIT');
      console.log(`📊 Parsed: ${totalParsed}, ✅ Inserted: ${validCount}`);
      res.status(201).json({
        message: 'Leads uploaded successfully (duplicates skipped)',
        totalParsed,
        validInserted: validCount
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to upload leads:', err.message);
      res.status(500).json({ error: 'Failed to upload leads' });
    } finally {
      client.release();
    }
  }
];

const googleSheetsUpload = async (req, res) => {
  const { sheetLink } = req.body;

  if (!sheetLink || !sheetLink.includes('docs.google.com/spreadsheets')) {
    return res.status(400).json({ error: 'Invalid Google Sheets link' });
  }

  try {
    const match = sheetLink.match(/\/d\/(.*?)\//);
    if (!match) {
      return res.status(400).json({ error: 'Could not parse Google Sheets link' });
    }

    const sheetId = match[1];
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    const response = await fetch(exportUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch data from Google Sheets');
    }

    const csvData = await response.text();
    const { data } = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
    });

    // Debug: Log first row to see column names
    if (data.length > 0) {
      console.log('📋 [Google Sheets] First row keys:', Object.keys(data[0]));
      console.log('📋 [Google Sheets] First row sample:', JSON.stringify(data[0], null, 2));
    }

    const totalParsed = data.length;
    let validCount = 0;

    const client = await pool.connect();
    try {
      const existingPhonesRes = await client.query('SELECT phone FROM leads');
      const existingPhones = new Set(existingPhonesRes.rows.map(r => normalizePhone(r.phone)));
      const sheetPhones = new Set();

      await client.query('BEGIN');
      for (const row of data) {
        const fullName = row['Full Name'] || row.fullName || '';
        const email = row['Email'] || row.email || '';
        const phone = normalizePhone(row['Phone'] || row.phone || '');
        const altNumber = row['Alternate Number'] || row.altNumber || '';
        const notes = row['Notes'] || row.notes || '';
        const deematAccountName = row['Deemat Account Name'] || row.deematAccountName || '';
        const profession = row['Profession'] || row.profession || '';
        const stateName = row['State Name'] || row.stateName || '';
        const capital = row['Capital'] || row.capital || '';
        const segment = row['Segment'] || row.segment || '';
        const team_id = row['Team ID'] || row.team_id || null;
        // Try multiple variations of the "Assigned to" column name
        const assignedToName = row['Assigned to'] || row['Assigned To'] || row['Assigned to '] || row['assigned to'] || row['Assigned To '] || row.assignedTo || row.assigned_to || row['assigned_to'] || '';
        // Parse Tags column - try multiple variations
        const tags = row['Tags'] || row['Tag'] || row['tags'] || row['tag'] || row['Tags '] || row.tags || row.tag || '';
        
        // Debug: Log first row's keys and assignedToName for Google Sheets
        if (validCount === 0 && totalParsed > 0) {
          console.log(`🔍 [Google Sheets] All row keys:`, Object.keys(row));
          console.log(`🔍 [Google Sheets] assignedToName extracted: "${assignedToName}"`);
          console.log(`🔍 [Google Sheets] tags extracted: "${tags}"`);
          console.log(`🔍 [Google Sheets] Raw row['Assigned to']:`, row['Assigned to']);
          console.log(`🔍 [Google Sheets] Raw row['Assigned To']:`, row['Assigned To']);
          console.log(`🔍 [Google Sheets] Raw row['Tags']:`, row['Tags']);
        }

        // Look up user by display_name if "Assigned to" is provided
        let assignedTo = null;
        let finalTeamId = team_id && team_id.trim() !== '' ? team_id : null;

        if (assignedToName && assignedToName.trim() !== '') {
          console.log(`🔍 Looking up user: "${assignedToName.trim()}"`);
          const userRes = await client.query(
            `SELECT id, team_id, role, display_name FROM users 
             WHERE LOWER(display_name) = LOWER($1) 
             AND LOWER(status) = 'active' 
             AND (role = 'relationship_mgr' OR role = 'financial_manager')`,
            [assignedToName.trim()]
          );
          if (userRes.rows.length > 0) {
            assignedTo = userRes.rows[0].id;
            // Use the user's team_id if not provided in the row
            if (!finalTeamId && userRes.rows[0].team_id) {
              finalTeamId = userRes.rows[0].team_id;
            }
            console.log(`✅ Found active RM/FM: ${assignedToName} (ID: ${assignedTo}, Role: ${userRes.rows[0].role}, Team: ${finalTeamId})`);
          } else {
            // Try to find if user exists but is not RM/FM or inactive
            const checkRes = await client.query(
              `SELECT id, display_name, role, status FROM users WHERE LOWER(display_name) = LOWER($1)`,
              [assignedToName.trim()]
            );
            if (checkRes.rows.length > 0) {
              console.log(`⚠️ User "${assignedToName}" found but is not an active RM/FM (Role: ${checkRes.rows[0].role}, Status: ${checkRes.rows[0].status}), lead will be unassigned`);
            } else {
              console.log(`⚠️ User "${assignedToName}" not found, lead will be unassigned`);
            }
          }
        }

        const safeTeamId = finalTeamId;

        if (!fullName || !phone) continue;
        // Skip if phone is not exactly 10 digits
        if (phone.length !== 10) continue;
        if (existingPhones.has(phone)) continue;
        if (sheetPhones.has(phone)) continue;

        validCount++;

        const assignedAt = assignedTo ? new Date() : null;

        console.log(`💾 [Google Sheets] Inserting lead "${fullName}" with assigned_to: ${assignedTo || 'NULL'}, tags: "${tags || 'NULL'}"`);

        await client.query(
          `INSERT INTO leads (
            full_name,
            email,
            phone,
            alt_number,
            notes,
            deemat_account_name,
            profession,
            state_name,
            capital,
            segment,
            team_id,
            assigned_to,
            assigned_at,
            tags
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            fullName,
            email || null,
            phone,
            altNumber,
            notes,
            deematAccountName,
            profession,
            stateName,
            capital,
            segment,
            safeTeamId,
            assignedTo,
            assignedAt,
            tags || ''
          ]
        );

        sheetPhones.add(phone);
      }
      await client.query('COMMIT');
      console.log(`📊 [Google Sheets] Parsed: ${totalParsed}, ✅ Inserted: ${validCount}`);
      res.status(201).json({
        message: 'Leads uploaded successfully (duplicates skipped)',
        totalParsed,
        validInserted: validCount
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to upload leads from Google Sheets:', err.message);
      res.status(500).json({ error: 'Failed to upload leads from Google Sheets' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Google Sheets upload error:', err.message);
    res.status(500).json({ error: 'Failed to process Google Sheets link' });
  }
};

const getNewLeadsCount = async (req, res) => {
  const { id: user_id, role } = req.user;

  try {
    // Only for RMs and Financial Managers
    if (role !== 'relationship_mgr' && role !== 'financial_manager') {
      return res.json({ newLeadsCount: 0 });
    }

    const result = await pool.query(
      `SELECT COUNT(*) as count FROM leads 
       WHERE assigned_to = $1 
       AND assigned_at IS NOT NULL
       AND assigned_at > COALESCE((SELECT last_login FROM users WHERE id = $1), '1970-01-01'::timestamp)`,
      [user_id]
    );

    const newLeadsCount = parseInt(result.rows[0]?.count || 0);
    res.json({ newLeadsCount });
  } catch (err) {
    console.error('❌ Failed to get new leads count:', err.message);
    res.status(500).json({ error: 'Failed to get new leads count' });
  }
};

module.exports = {
  getLeads,
  addLead,
  updateLead,
  deleteLead,
  uploadLeads,
  assignLead,
  googleSheetsUpload,
  getNewLeadsCount
};
