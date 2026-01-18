import { useState, useEffect } from 'react';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';
import { useLeadStore } from '../../stores/leadStore';
import { useTeamStore } from '../../stores/teamStore';
import { useUserStore } from '../../stores/userStore';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import type { Lead } from '../../stores/leadStore';

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
}

const LeadModal: React.FC<LeadModalProps> = ({ isOpen, onClose, lead }) => {
  const { addLead, updateLead, leads } = useLeadStore();
  const { fetchTeams } = useTeamStore();
  const { users, fetchUsers } = useUserStore();
  const { role, userId } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);

  const [showConfirm, setShowConfirm] = useState(false);
  const [noteHistory, setNoteHistory] = useState<
    { note: string; status: Lead['status']; date: string; isNew?: boolean }[]
  >([]);
  const [deematSearchQuery, setDeematSearchQuery] = useState('');
  const [showDeematDropdown, setShowDeematDropdown] = useState(false);
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);

  const sourceOptions = [
    'Facebook',
    'Google',
    'Instagram',
    'LinkedIn',
    'Referral',
    'Website',
    'Cold Call',
    'Email',
    'Other',
  ];

  const filteredSourceOptions = sourceSearchQuery
    ? sourceOptions
        .filter((option) =>
          option.toLowerCase().includes(sourceSearchQuery.toLowerCase())
        )
        .sort((a, b) => {
          const aStarts = a.toLowerCase().startsWith(sourceSearchQuery.toLowerCase());
          const bStarts = b.toLowerCase().startsWith(sourceSearchQuery.toLowerCase());
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return a.localeCompare(b);
        })
    : sourceOptions;

  const deematAccountOptions = [
    'Zerodha',
    'Upstox',
    'Groww',
    'Angel One',
    '5paisa',
    'ICICI Direct',
    'HDFC Securities',
    'Kotak Securities',
    'Axis Direct',
    'SBI Securities',
    'Motilal Oswal',
    'Sharekhan',
    'IIFL Securities',
    'Edelweiss',
    'Religare Broking',
    'Ventura Securities',
    'Nirmal Bang',
    'Anand Rathi',
    'SMC Global',
    'Bonanza Portfolio',
    'LKP Securities',
    'Prabhudas Lilladher',
    'Karvy Stock Broking',
    'TradeSmart Online',
    'Alice Blue',
    'Fyers',
    'Paytm Money',
    'Dhan',
    'Shoonya',
    'Samco',
    'Prostocks',
    'BlinkX',
    'mStock',
    'Kotak Neo',
    'Choice Broking',
    'Axis Direct Lite',
    'Wisdom Capital',
    'RMoney',
    'Master Trust',
    'Way2Wealth',
    'BMA Wealth Creators',
    'Achiievers Equities',
    'Astha Trade',
    'TradePlus Online',
    'Aditya Birla Money',
    'Arihant Capital',
    'Trustline Securities',
    'Jainam Broking',
    'Monarch Networth Capital',
    'IDBI Direct',
    'Indiabulls Securities',
    'Narnolia Financial Advisors',
    'JM Financial',
    'Yes Securities',
    'IndusInd Bank',
    'Federal Bank',
    'IDFC FIRST Bank',
    'ICICI Bank 3-in-1',
    'HDFC Bank 3-in-1',
    'Kotak Bank 3-in-1',
    'Axis Bank 3-in-1',
    'SBI Bank 3-in-1',
    'IDBI Capital',
    'Axis Capital',
    'SBI Capital Markets',
    'INDmoney',
    'Kuvera',
    'Smallcase',
    'ET Money',
    'Growpital',
    'Jar',
    'Fi Money',
  ];

  const filteredDeematOptions = deematSearchQuery
    ? deematAccountOptions
        .filter((option) =>
          option.toLowerCase().includes(deematSearchQuery.toLowerCase())
        )
        .sort((a, b) => {
          const aStarts = a.toLowerCase().startsWith(deematSearchQuery.toLowerCase());
          const bStarts = b.toLowerCase().startsWith(deematSearchQuery.toLowerCase());
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return a.localeCompare(b);
        })
    : deematAccountOptions;

  const [formData, setFormData] = useState<Omit<Lead, 'id'>>({
    fullName: '',
    phone: '',
    email: '',
    altNumber: '',
    notes: '',
    deematAccountName: '',
    profession: '',
    stateName: '',
    capital: '',
    segment: '',
    status: 'Free Trial',
    team_id: '',
    assigned_to: '',
    tags: '',
    source: '',
  });

  useEffect(() => {
    fetchTeams();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (lead) {
      console.log('🔄 Loading lead into form:', { 
        leadId: lead.id, 
        leadTags: lead.tags,
        fullLead: lead 
      });
      setFormData({
        fullName: lead.fullName || '',
        phone: lead.phone || '',
        email: lead.email || '',
        altNumber: lead.altNumber || '',
        notes: lead.notes || '',
        deematAccountName: lead.deematAccountName || '',
        profession: lead.profession || '',
        stateName: lead.stateName || '',
        capital: lead.capital || '',
        segment: lead.segment || '',
        status: lead.status || 'Free Trial',
        source: lead.source || '',
        team_id: lead.team_id || '',
        assigned_to: lead.assigned_to || '',
        tags: lead.tags || '',
      });
      console.log('✅ FormData set with tags:', lead.tags || '');
      setDeematSearchQuery(lead.deematAccountName || '');
      setSourceSearchQuery(lead.source || '');
      
      const history = lead.notes
        ? lead.notes
            .split('||')
            .filter((entry) => entry.trim() !== '')
            .map((entry) => {
              const parts = entry.split('__');
              // Format is: status__note__timestamp (matching parseNotes in LeadsPage)
              // Handle both old format (note__status__date) and new format (status__note__timestamp)
              if (parts.length >= 3) {
                // Try new format first (status__note__timestamp)
                const statusMatch = ['Busy', 'Call Back With Presentation', 'Call Back Without Presentation', 'Call Disconnected', 'Counselling Call', 'Disconnected Call', 'Do Not disturb', 'Equity trader', 'Follow Up', 'Follow Up-No Response', 'Free Trial', 'Free Trial – Follow Up', 'Incoming Calls Not Allowed', 'Invalid Number', 'Language Barrier', 'Less Funds', 'Loss Client', 'Low Capital', 'No Capital', 'No DMAT', 'No Response', 'Non Trader', 'Not Connected', 'Not Interested', 'Not Reachable', 'Out Of Service', 'Paid Client', 'Promise To Pay', 'Ringing', 'Summarization Call', 'Switched Off', 'Wrong No'].includes(parts[0]);
                if (statusMatch) {
                  // New format: status__note__timestamp
                  return {
                    status: (parts[0] || 'New') as Lead['status'],
                    note: parts[1] || '',
                    date: parts[2] || new Date().toISOString(),
                    isNew: false,
                  };
                } else {
                  // Old format: note__status__date (backward compatibility)
                  return {
                    status: (parts[1] || 'New') as Lead['status'],
                    note: parts[0] || '',
                    date: parts[2] || new Date().toISOString(),
                    isNew: false,
                  };
                }
              }
              // Fallback for malformed entries
              return {
                status: 'New' as Lead['status'],
                note: parts[0] || '',
                date: new Date().toISOString(),
                isNew: false,
              };
            })
        : [];

      // For existing leads, just populate the saved history without
      // automatically adding a new empty row. Users can add a row
      // manually using the "+ Add Row" button.
      setNoteHistory(history.reverse());
    } else {
      setFormData({
        fullName: '',
        phone: '',
        email: '',
        altNumber: '',
        notes: '',
        deematAccountName: '',
        profession: '',
        stateName: '',
        capital: '',
        segment: '',
        status: 'Free Trial',
        team_id: '',
        assigned_to: '',
        tags: '',
        source: '',
      });
      setSourceSearchQuery('');
      setDeematSearchQuery('');
      // For new leads, start with empty history - user must add rows manually
      setNoteHistory([]);
      
      // Auto-set tag for RMs when adding a new lead
      if ((role === 'relationship_mgr' || role === 'financial_manager')) {
        setFormData(prev => ({ ...prev, tags: 'Added by RM' }));
      }
    }
  }, [lead, role]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'tags') {
      console.log('🏷️ Tags field changed:', { name, value, oldValue: formData.tags });
    }
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'tags') {
        console.log('🏷️ State updated:', { newValue: updated.tags, previousValue: prev.tags });
      }
      return updated;
    });
  };

  const handleNoteChange = (
    index: number,
    field: 'note' | 'status',
    value: string
  ) => {
    if (role === 'relationship_mgr' && !noteHistory[index].isNew) return;
    const updated = [...noteHistory];
    updated[index][field] = value as any;
    setNoteHistory(updated);
  };

  const addNewRow = () => {
    const now = new Date().toISOString();
    setNoteHistory([
      {
        status: 'Free Trial',
        note: '',
        date: now,
        isNew: true,
      },
      ...noteHistory,
    ]);
  };

  const submitLead = async (forcedStatus?: string) => {
  // Use existing status from formData if noteHistory is empty or doesn't have status
  // Only use noteHistory status if it exists, otherwise preserve the current lead's status
  const newStatus = noteHistory[0]?.status || formData.status || 'Free Trial';
  
  // Mark all new entries as saved (not new anymore)
  const updatedHistory = noteHistory.map(entry => ({
    ...entry,
    isNew: false // Mark all entries as saved
  }));
  
  // Include entries that have either a note OR a status (to capture status-only changes)
  const sanitized = updatedHistory.filter((n) => n.note.trim() !== '' || n.status);
  const reversed = sanitized.reverse();
  // Format: note__status__date, but parseNotes expects status__note__timestamp
  // So we need to save it in the format that parseNotes expects: status__note__timestamp
  const notesString = reversed
    .map((n) => `${n.status}__${n.note.trim()}__${n.date}`)
    .join('||');

  // Use functional state getter to ensure we have the latest formData
  // But since we can't do that with useState, we'll use formData directly
  // The issue might be that formData is stale in the closure
  let finalData = {
    ...formData,
    notes: notesString,
    status: (forcedStatus ?? newStatus) as Lead['status'],
  };
  
  console.log('🔍 submitLead - State check:', {
    formDataTags: formData.tags,
    finalDataTags: finalData.tags,
    leadTags: lead?.tags,
    inputElementValue: (document.querySelector('input[name="tags"]') as HTMLInputElement)?.value
  });

  // Auto-assign to the current user if they're an RM or Financial Manager (only for new leads)
  if (!lead && (role === 'relationship_mgr' || role === 'financial_manager')) {
    console.log('🔍 Auto-assignment check:', { role, userId, lead: !!lead });
    const user = users.find(u => u.id === userId);
    console.log('👤 Found user:', user);
    if (user) {
      finalData = {
        ...finalData,
        team_id: user.team_id || '',
        assigned_to: userId,
      };
      console.log('✅ Auto-assignment applied:', { assigned_to: userId, team_id: user.team_id });
    } else {
      console.log('❌ User not found for auto-assignment');
    }
  } else {
    console.log('⚠️ Auto-assignment skipped:', { isNewLead: !lead, role, userId });
  }

  // Ensure tags are explicitly included (in case of closure issues)
  // Auto-set to "Added by RM" for RMs when adding a new lead if tag is empty
  let tagsValue = finalData.tags || (document.querySelector('input[name="tags"]') as HTMLInputElement)?.value || '';
  if (!lead && (role === 'relationship_mgr' || role === 'financial_manager') && (!tagsValue || tagsValue.trim() === '')) {
    tagsValue = 'Added by RM';
  }
  finalData = {
    ...finalData,
    tags: tagsValue
  };

  console.log("✅ submitLead triggered", formData);
  console.log("Tags in formData:", formData.tags);
  console.log("Final payload to update/add:", finalData);
  console.log("Tags in finalData:", finalData.tags);
  console.log("🔍 Complete finalData object:", JSON.stringify(finalData, null, 2));

  if (lead) {
    await updateLead(lead.id, finalData);
  } else {
    await addLead(finalData);
  }

  onClose();

  setTimeout(() => {
    const event = new CustomEvent('refreshLeads');
    window.dispatchEvent(event);
  }, 100);
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate phone number is exactly 10 digits
    if (formData.phone) {
      const phoneDigits = formData.phone.replace(/\D/g, '');
      if (phoneDigits.length !== 10) {
        addToast('Phone number must be exactly 10 digits', 'error');
        return;
      }
    }

    // Check if phone number already exists (for both new and edit)
    // Phone must be unique from all phone numbers and alternate numbers
    if (formData.phone) {
      const normalizedPhone = formData.phone.replace(/\D/g, '');
      const normalizedAltNumber = formData.altNumber ? formData.altNumber.replace(/\D/g, '') : '';

      // First check: Phone number cannot match the alternate number of the same lead
      if (normalizedPhone === normalizedAltNumber && normalizedPhone !== '') {
        addToast('Phone number cannot be the same as the alternate number', 'error');
        return;
      }

      // Second check: Phone number must be unique from all other leads' phone and alt numbers
      const phoneExists = leads.some(l => {
        // Skip current lead if editing
        if (lead && l.id === lead.id) return false;
        // Check against phone numbers
        const existingPhone = (l.phone || '').replace(/\D/g, '');
        if (existingPhone === normalizedPhone && existingPhone !== '') return true;
        // Check against alternate numbers
        const existingAlt = (l.altNumber || '').replace(/\D/g, '');
        if (existingAlt === normalizedPhone && existingAlt !== '') return true;
        return false;
      });
      if (phoneExists) {
        addToast('A lead with this phone number already exists!', 'error');
        return;
      }
    }

    // Validate alternate number is exactly 10 digits if provided
    if (formData.altNumber) {
      const altNumberDigits = formData.altNumber.replace(/\D/g, '');
      if (altNumberDigits.length !== 10) {
        addToast('Alternate number must be exactly 10 digits', 'error');
        return;
      }

      const normalizedAltNumber = altNumberDigits;
      const normalizedPhone = formData.phone ? formData.phone.replace(/\D/g, '') : '';

      // First check: Alternate number cannot match the phone number of the same lead
      if (normalizedAltNumber === normalizedPhone && normalizedAltNumber !== '') {
        addToast('Alternate number cannot be the same as the phone number', 'error');
        return;
      }

      // Second check: Alternate number must be unique from all other leads' phone and alt numbers
      const isDuplicate = leads.some(l => {
        // Skip current lead if editing
        if (lead && l.id === lead.id) return false;
        // Check against phone numbers
        const existingPhone = (l.phone || '').replace(/\D/g, '');
        if (existingPhone === normalizedAltNumber && existingPhone !== '') return true;
        // Check against alternate numbers
        const existingAlt = (l.altNumber || '').replace(/\D/g, '');
        if (existingAlt === normalizedAltNumber && existingAlt !== '') return true;
        return false;
      });

      if (isDuplicate) {
        addToast('Alternate number must be unique and cannot match any phone number or alternate number', 'error');
        return;
      }
    }

    // Auto-set tag to "Added by RM" for RMs when adding a new lead if tag is empty
    if (!lead && (role === 'relationship_mgr' || role === 'financial_manager')) {
      const tagsValue = formData.tags || (document.querySelector('input[name="tags"]') as HTMLInputElement)?.value || '';
      if (!tagsValue || tagsValue.trim() === '') {
        setFormData(prev => ({ ...prev, tags: 'Added by RM' }));
      }
    }

    const latestStatus = noteHistory[0]?.status || 'Free Trial';
    if (lead?.status !== 'Won' && lead?.status !== 'Paid Client' && (latestStatus === 'Won' || latestStatus === 'Paid Client')) {
      setShowConfirm(true);
      return;
    }

    await submitLead();
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={lead ? 'Edit Lead' : 'Add Lead'}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input
            type="text"
            name="fullName"
            className="form-input"
            value={formData.fullName}
            onChange={handleChange}
            required
            disabled={role === 'relationship_mgr' && !!lead?.fullName}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Phone Number</label>
          <input
            type="text"
            name="phone"
            className="form-input"
            value={formData.phone}
            onChange={handleChange}
            disabled={role === 'relationship_mgr' && !!lead?.phone}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input
            type="email"
            name="email"
            className="form-input"
            value={formData.email}
            onChange={handleChange}
            disabled={role === 'relationship_mgr' && !!lead?.email}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Alternate Number</label>
          <input
            type="text"
            name="altNumber"
            className="form-input"
            value={formData.altNumber}
            onChange={handleChange}
            disabled={role === 'relationship_mgr' && !!lead?.altNumber}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Deemat Account Name</label>
          <div className="relative">
            <input
              type="text"
              className="form-input"
              value={deematSearchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setDeematSearchQuery(value);
                setShowDeematDropdown(true);
                // Update formData to allow custom input
                setFormData(prev => ({ ...prev, deematAccountName: value }));
              }}
              onFocus={() => setShowDeematDropdown(true)}
              onBlur={() => {
                // Delay to allow click on dropdown item
                setTimeout(() => setShowDeematDropdown(false), 200);
              }}
              placeholder="Type to search (e.g., 'Z' for Zerodha)"
              disabled={role === 'relationship_mgr' && !!lead?.deematAccountName}
            />
            {showDeematDropdown && filteredDeematOptions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                {filteredDeematOptions.map((option) => (
                  <div
                    key={option}
                    className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-white"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setDeematSearchQuery(option);
                      setFormData(prev => ({ ...prev, deematAccountName: option }));
                      setShowDeematDropdown(false);
                    }}
                  >
                    {option}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Source</label>
          <div className="relative">
            <input
              type="text"
              className="form-input"
              value={sourceSearchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSourceSearchQuery(value);
                setShowSourceDropdown(true);
                // Update formData to allow custom input
                setFormData(prev => ({ ...prev, source: value }));
              }}
              onFocus={() => setShowSourceDropdown(true)}
              onBlur={() => {
                // Delay to allow click on dropdown item
                setTimeout(() => setShowSourceDropdown(false), 200);
              }}
              placeholder="e.g., Facebook, Google, Referral"
              disabled={role === 'relationship_mgr' && !!lead?.language}
            />
            {showSourceDropdown && filteredSourceOptions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                {filteredSourceOptions.map((option) => (
                  <div
                    key={option}
                    className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-white"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSourceSearchQuery(option);
                      setFormData(prev => ({ ...prev, source: option }));
                      setShowSourceDropdown(false);
                    }}
                  >
                    {option}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Profession</label>
          <select
            name="profession"
            className="form-input"
            value={formData.profession}
            onChange={handleChange}
            disabled={role === 'relationship_mgr' && !!lead?.profession}
          >
            <option value="">Select</option>
            <option value="Student">Student</option>
            <option value="Private Sector">Private Sector</option>
            <option value="Business">Business</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">State</label>
          <select
            name="stateName"
            className="form-input"
            value={formData.stateName}
            onChange={handleChange}
            disabled={role === 'relationship_mgr' && !!lead?.stateName}
          >
            <option value="">Select</option>
            <option value="Andhra Pradesh">Andhra Pradesh</option>
            <option value="Arunachal Pradesh">Arunachal Pradesh</option>
            <option value="Assam">Assam</option>
            <option value="Bihar">Bihar</option>
            <option value="Chhattisgarh">Chhattisgarh</option>
            <option value="Goa">Goa</option>
            <option value="Gujarat">Gujarat</option>
            <option value="Haryana">Haryana</option>
            <option value="Himachal Pradesh">Himachal Pradesh</option>
            <option value="Jharkhand">Jharkhand</option>
            <option value="Karnataka">Karnataka</option>
            <option value="Kerala">Kerala</option>
            <option value="Madhya Pradesh">Madhya Pradesh</option>
            <option value="Maharashtra">Maharashtra</option>
            <option value="Manipur">Manipur</option>
            <option value="Meghalaya">Meghalaya</option>
            <option value="Mizoram">Mizoram</option>
            <option value="Nagaland">Nagaland</option>
            <option value="Odisha">Odisha</option>
            <option value="Punjab">Punjab</option>
            <option value="Rajasthan">Rajasthan</option>
            <option value="Sikkim">Sikkim</option>
            <option value="Tamil Nadu">Tamil Nadu</option>
            <option value="Telangana">Telangana</option>
            <option value="Tripura">Tripura</option>
            <option value="Uttar Pradesh">Uttar Pradesh</option>
            <option value="Uttarakhand">Uttarakhand</option>
            <option value="West Bengal">West Bengal</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Capital</label>
          <input
            type="text"
            name="capital"
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            className="form-input"
            value={formData.capital}
            onChange={(e) => {
              const value = e.target.value;
              // Only allow numbers and decimal point
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                handleChange(e);
              }
            }}
            onKeyPress={(e) => {
              // Allow only numbers and decimal point
              if (!/[0-9.]/.test(e.key)) {
                e.preventDefault();
              }
            }}
            disabled={role === 'relationship_mgr' && !!lead?.capital}
            placeholder="0.00"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Segment</label>
          <input
            type="text"
            name="segment"
            className="form-input"
            value={formData.segment}
            onChange={handleChange}
            disabled={role === 'relationship_mgr' && !!lead?.segment}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Tags</label>
          <input
            type="text"
            name="tags"
            className="form-input"
            value={formData.tags || ''}
            onChange={(e) => {
              console.log('🏷️ Tags input onChange triggered:', { 
                currentValue: e.target.value,
                formDataValue: formData.tags,
                leadTags: lead?.tags
              });
              handleChange(e);
            }}
            onBlur={(e) => {
              console.log('🏷️ Tags input onBlur:', { 
                value: e.target.value,
                formDataTags: formData.tags
              });
            }}
            placeholder="e.g., VIP, Hot Lead, Follow Up"
            disabled={!lead && (role === 'relationship_mgr' || role === 'financial_manager')}
          />
        </div>

        <div className="form-group">
          <div className="flex justify-between items-center mb-2">
            <label className="form-label">Status &amp; Notes History</label>
            <button
              type="button"
              onClick={addNewRow}
              className="text-sm px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 transition"
            >
              + Add Row
            </button>
          </div>
          {noteHistory.length > 0 ? (
            <table className="w-full text-sm text-left">
              <thead className="text-gray-400 border-b border-gray-600">
                <tr>
                  <th className="p-2">Date &amp; Time</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {noteHistory.map((entry, i) => (
                  <tr key={i} className="border-b border-gray-700">
                    <td className="p-2 text-gray-400">
                      {new Date(entry.date).toLocaleString()}
                      {!entry.isNew ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-400 border border-green-700/50">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Entry Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/30 text-yellow-400 border border-yellow-700/50">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                          </svg>
                          Editing
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      <select
                        className="form-input"
                        value={entry.status}
                        onChange={(e) => handleNoteChange(i, 'status', e.target.value)}
                        disabled={role === 'relationship_mgr' && !entry.isNew}
                      >
                        <option value="Busy">Busy</option>
                        <option value="Call Back With Presentation">Call Back With Presentation</option>
                        <option value="Call Back Without Presentation">Call Back Without Presentation</option>
                        <option value="Call Disconnected">Call Disconnected</option>
                        <option value="Counselling Call">Counselling Call</option>
                        <option value="Disconnected Call">Disconnected Call</option>
                        <option value="Do Not disturb">Do Not disturb</option>
                        <option value="Equity trader">Equity trader</option>
                        <option value="Follow Up">Follow Up</option>
                        <option value="Follow Up-No Response">Follow Up-No Response</option>
                        <option value="Free Trial">Free Trial</option>
                        <option value="Free Trial – Follow Up">Free Trial – Follow Up</option>
                        <option value="Incoming Calls Not Allowed">Incoming Calls Not Allowed</option>
                        <option value="Invalid Number">Invalid Number</option>
                        <option value="Language Barrier">Language Barrier</option>
                        <option value="Less Funds">Less Funds</option>
                        <option value="Loss Client">Loss Client</option>
                        <option value="Low Capital">Low Capital</option>
                        <option value="No Capital">No Capital</option>
                        <option value="No DMAT">No DMAT</option>
                        <option value="No Response">No Response</option>
                        <option value="Non Trader">Non Trader</option>
                        <option value="Not Connected">Not Connected</option>
                        <option value="Not Interested">Not Interested</option>
                        <option value="Not Reachable">Not Reachable</option>
                        <option value="Out Of Service">Out Of Service</option>
                        <option value="Paid Client">Paid Client</option>
                        <option value="Promise To Pay">Promise To Pay</option>
                        <option value="Ringing">Ringing</option>
                        <option value="Summarization Call">Summarization Call</option>
                        <option value="Switched Off">Switched Off</option>
                        <option value="Wrong No">Wrong No</option>

                      </select>
                    </td>
                    <td className="p-2">
                      <textarea
                        className="form-input"
                        rows={2}
                        placeholder="Enter note"
                        value={entry.note}
                        onChange={(e) => handleNoteChange(i, 'note', e.target.value)}
                        disabled={role === 'relationship_mgr' && !entry.isNew}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No notes added yet. Click "+ Add Row" to add your first note.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {lead ? 'Update Lead' : 'Add Lead'}
          </button>
        </div>
      </form>
    </Modal>
    {showConfirm && (
  <ConfirmModal
    isOpen={true}
    onClose={() => {
      setShowConfirm(false);
      setNoteHistory((prev) => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[0].status = lead?.status || 'Free Trial';
        }
        return updated;
      });
    }}
    onConfirm={async () => {
      console.log("🟡 ConfirmModal confirmed"); // ← add this
      setShowConfirm(false);
      const latestStatus = noteHistory[0]?.status || 'Free Trial';
      const clientStatus = (latestStatus === 'Won' || latestStatus === 'Paid Client') ? latestStatus : 'Paid Client';
      await submitLead(clientStatus); // ← force Paid Client or Won status
    }}
    message="Marking this lead as Paid Client will convert it to a client and cannot be undone. Continue?"
  />
)}
    </>
  );
};

export default LeadModal;
