import { useEffect, useState } from 'react';
import Modal from './Modal';
import { useLeadStore, Lead } from '../../stores/leadStore';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import {
  PaymentEntry,
  PackageTier,
  parsePaymentHistory,
  serializePaymentHistory,
} from '../../utils/payment';

interface ClientDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
}

const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({ isOpen, onClose, lead }) => {
  const { updateLead } = useLeadStore();
  const { role, userId } = useAuthStore();
  const { users, fetchUsers } = useUserStore();

  const [formData, setFormData] = useState({
    packageTier: '' as PackageTier,
    gender: '',
    dob: '',
    panCardNumber: '',
    aadharCardNumber: '',
    status: '' as Lead['status'],
  });

  const [paymentHistory, setPaymentHistory] = useState<PaymentEntry[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [dividedPayments, setDividedPayments] = useState<Set<number>>(new Set());
  const packageOptions: PackageTier[] = ['', 'Basic', 'Advanced', 'Premium'];

  // Get list of active RMs for dropdown
  const relationshipManagers = users.filter(
    u => (u.role === 'relationship_mgr' || u.role === 'financial_manager') && u.status?.toLowerCase() === 'active'
  );

  // Total of approved payments
  const totalApproved = paymentHistory
    .filter(e => e.approved)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Fetch users for RM dropdown
  useEffect(() => {
    fetchUsers();
  }, []);

  // Seed form + history once we get the lead
  useEffect(() => {
    if (lead) {
      const history = parsePaymentHistory(lead.paymentHistory);
      const newestFirst = history.reverse();
      const initialPackage =
        newestFirst.find((entry) => entry.packageTier)?.packageTier || '';

      setFormData({
        packageTier: (initialPackage as PackageTier) || '',
        gender: lead.gender || '',
        dob: lead.dob || '',
        panCardNumber: lead.panCardNumber || '',
        aadharCardNumber: lead.aadharCardNumber || '',
        status: lead.status || '',
      });
      // newest-first in the table
      setPaymentHistory(newestFirst);
      // Set divided state based on existing RM2 values
      const divided = new Set<number>();
      newestFirst.forEach((entry, idx) => {
        if (entry.rm2 && entry.rm2.trim() !== '') {
          divided.add(idx);
        }
      });
      setDividedPayments(divided);
      setIsSaved(false);
    }
  }, [lead]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const calculateAge = (date: string) => {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)).toString();
  };

  const handlePaymentChange = (
    index: number,
    field: keyof PaymentEntry,
    value: string | boolean,
  ) => {
    const updated = [...paymentHistory];
    
    // Validate amount field to only allow numeric values
    if (field === 'amount' && typeof value === 'string') {
      // Remove any non-numeric characters except decimal point
      const numericValue = value.replace(/[^0-9.]/g, '');
      // Ensure only one decimal point
      const parts = numericValue.split('.');
      const validValue = parts.length > 2 
        ? parts[0] + '.' + parts.slice(1).join('') 
        : numericValue;
      // Additional validation: ensure it's a valid number format
      if (validValue === '' || /^\d*\.?\d*$/.test(validValue)) {
        (updated[index] as any)[field] = validValue;
      }
    } else {
      (updated[index] as any)[field] = value;
    }
    
    setPaymentHistory(updated);
  };

  const addPaymentRow = (isDivided: boolean = false) => {
    // Auto-populate RM1 with current user if they are an RM
    const currentUserRM = (role === 'relationship_mgr' || role === 'financial_manager') ? userId : '';
    const currentUserRMName = (role === 'relationship_mgr' || role === 'financial_manager') 
      ? users.find(u => u.id === userId)?.displayName || '' 
      : '';
    
    const newPayment = {
      amount: '',
      date: new Date().toISOString(),
      utr: '',
      approved: false,
      assigned_to: lead.assigned_to || '',
      assigned_to_name: lead.assigned_user_name || '',
      rm1: currentUserRM || '',
      rm1_name: currentUserRMName || '',
      rm2: isDivided ? '' : undefined, // Only set rm2 if it's a divided payment
      rm2_name: isDivided ? '' : undefined,
      packageTier: formData.packageTier,
      isNew: true,
    };
    
    setPaymentHistory((prev) => [newPayment, ...prev]);
    
    // If it's a divided payment, add to dividedPayments set
    if (isDivided) {
      setDividedPayments(prev => {
        const shifted = new Set<number>();
        shifted.add(0); // New row is at index 0
        prev.forEach(idx => shifted.add(idx + 1));
        return shifted;
      });
    } else {
      // Shift existing divided payment indices by +1
      setDividedPayments(prev => {
        const shifted = new Set<number>();
        prev.forEach(idx => shifted.add(idx + 1));
        return shifted;
      });
    }
  };

  useEffect(() => {
    setPaymentHistory((prev) =>
      prev.map((entry) =>
        entry.isNew ? { ...entry, packageTier: formData.packageTier } : entry
      )
    );
  }, [formData.packageTier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1) Drop blank new rows  
    // 2) Remove isNew flag  
    // 3) Keep approved=false on those just-added
    const cleaned = paymentHistory
      .filter(entry => !(entry.isNew && entry.amount.trim() === ''))
      .map(entry => {
        const { isNew, ...rest } = entry;
        return {
          ...rest,
          approved: entry.approved && !entry.isNew
        };
      });

    // 4) oldest-first → serialize → save
    const reversed = [...cleaned].reverse();
    const historyStr = serializePaymentHistory(reversed);

    await updateLead(lead.id, {
      ...lead,
      notes: lead.notes,
      gender: formData.gender,
      dob: formData.dob,
      age: calculateAge(formData.dob),
      panCardNumber: formData.panCardNumber,
      aadharCardNumber: formData.aadharCardNumber,
      paymentHistory: historyStr,
      status: role === 'super_admin' && formData.status ? formData.status : lead.status
    });

    // 5) Reflect “saved but unapproved” state immediately
    setPaymentHistory(cleaned.reverse());
    setIsSaved(true);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Client Details – ${lead.fullName} (${lead.assigned_user_name || 'Unassigned'} RM)`} size="5xl">
      <form onSubmit={handleSubmit}>
        {/* ————— Package Selection ————— */}
        <div className="form-group">
          <label className="form-label">Package</label>
          <select
            name="packageTier"
            className="form-input"
            value={formData.packageTier}
            onChange={handleChange}
          >
            <option value="">Select Package</option>
            {packageOptions
              .filter((opt) => opt)
              .map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
          </select>
        </div>

        {/* ————— Personal Info ————— */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="form-group">
            <label className="form-label">Gender</label>
            <select
              name="gender"
              className="form-input"
              value={formData.gender}
              onChange={handleChange}
            >
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Date of Birth (dd/mm/yyyy)</label>
            <input
              type="date"
              name="dob"
              className="form-input"
              value={formData.dob}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="form-group">
            <label className="form-label">PAN Card Number</label>
            <input
              type="text"
              name="panCardNumber"
              className="form-input"
              value={formData.panCardNumber}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Aadhar Card Number</label>
            <input
              type="text"
              name="aadharCardNumber"
              className="form-input"
              value={formData.aadharCardNumber}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* ————— Status/Disposition Change (Super Admin Only) ————— */}
        {role === 'super_admin' && (
          <div className="form-group">
            <label className="form-label">Change Disposition (Status)</label>
            <select
              name="status"
              className="form-input"
              value={formData.status}
              onChange={handleChange}
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
            <p className="text-xs text-yellow-400 mt-1">
              ⚠️ Warning: Changing disposition from Paid Client will revert this client back to a lead.
            </p>
          </div>
        )}

        {/* ————— Payment History ————— */}
        <div className="form-group">
          <div className="flex justify-between items-center mb-2">
            <label className="form-label">Payment History</label>
            {(role === 'super_admin' || role === 'relationship_mgr' || role === 'financial_manager') && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addPaymentRow(false)}
                  className="text-sm px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 transition"
                >
                  + Add Payment
                </button>
                <button
                  type="button"
                  onClick={() => addPaymentRow(true)}
                  className="text-sm px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 transition"
                >
                  + Add Divided Payment
                </button>
              </div>
            )}
          </div>

          <div className="mb-2 font-semibold">
            Total Approved: ₹{totalApproved}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-400 border-b border-gray-600">
                <tr>
                  <th className="p-2 min-w-[120px]">Date</th>
                  <th className="p-2 min-w-[100px]">Amount</th>
                  <th className="p-2 min-w-[150px]">RM1</th>
                  <th className="p-2 min-w-[150px]">RM2</th>
                  <th className="p-2 min-w-[120px]">UTR / Status</th>
                </tr>
              </thead>
            <tbody>
              {paymentHistory.map((entry, i) => (
                <tr key={i} className={`border-b border-gray-700 ${dividedPayments.has(i) ? 'bg-purple-900/10' : 'bg-blue-900/5'}`}>
                  <td className="p-2 text-gray-400">
                    <div className="flex items-center gap-2">
                      {(role === 'super_admin' || (entry.isNew && (role === 'relationship_mgr' || role === 'financial_manager'))) ? (
                        <input
                          type="date"
                          className="form-input"
                          value={entry.date ? new Date(entry.date).toISOString().split('T')[0] : ''}
                          onChange={e => {
                            const dateValue = e.target.value;
                            const isoDate = dateValue ? new Date(dateValue).toISOString() : '';
                            handlePaymentChange(i, 'date', isoDate);
                          }}
                        />
                      ) : (
                        <span>{new Date(entry.date).toLocaleDateString('en-GB')}</span>
                      )}
                      {dividedPayments.has(i) ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-600/30 text-purple-300 border border-purple-500/50">
                          Divided
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-600/30 text-blue-300 border border-blue-500/50">
                          Single
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    {(role === 'super_admin' || role === 'admin' || role === 'financial_manager' || (entry.isNew && (role === 'relationship_mgr' || role === 'financial_manager'))) ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*\.?[0-9]*"
                        className="form-input"
                        value={entry.amount || ''}
                        onChange={e => handlePaymentChange(i, 'amount', e.target.value)}
                        onKeyPress={(e) => {
                          // Allow only numbers and decimal point
                          if (!/[0-9.]/.test(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        placeholder="0.00"
                      />
                    ) : (
                      <span>{entry.amount || '—'}</span>
                    )}
                  </td>
                  <td className="p-2 min-w-[150px]">
                    {(role === 'super_admin' || role === 'admin' || role === 'financial_manager') ? (
                      <select
                        className="form-input text-sm w-full min-w-[140px]"
                        value={entry.rm1 || ''}
                        onChange={e => {
                          const selectedRM = relationshipManagers.find(rm => rm.id === e.target.value);
                          handlePaymentChange(i, 'rm1', e.target.value);
                          handlePaymentChange(i, 'rm1_name', selectedRM?.displayName || '');
                        }}
                        title={entry.rm1_name || 'Select RM1'}
                      >
                        <option value="">Select RM1</option>
                        {relationshipManagers.map(rm => (
                          <option key={rm.id} value={rm.id}>
                            {rm.displayName}
                          </option>
                        ))}
                      </select>
                    ) : (role === 'relationship_mgr' && entry.rm1 === userId) ? (
                      <span className="text-green-400 whitespace-nowrap" title={entry.rm1_name || '—'}>
                        {entry.rm1_name || '—'}
                      </span>
                    ) : (
                      <span className="text-green-400 whitespace-nowrap" title={entry.rm1_name || '—'}>
                        {entry.rm1_name || '—'}
                      </span>
                    )}
                  </td>
                  <td className="p-2 min-w-[150px]">
                    {dividedPayments.has(i) ? (
                      (role === 'super_admin' || role === 'admin' || role === 'financial_manager') ? (
                        <select
                          className="form-input text-sm w-full min-w-[140px]"
                          value={entry.rm2 || ''}
                          onChange={e => {
                            const selectedRM = relationshipManagers.find(rm => rm.id === e.target.value);
                            handlePaymentChange(i, 'rm2', e.target.value);
                            handlePaymentChange(i, 'rm2_name', selectedRM?.displayName || '');
                          }}
                          title={entry.rm2_name || 'Select RM2'}
                        >
                          <option value="">Select RM2</option>
                          {relationshipManagers.map(rm => (
                            <option key={rm.id} value={rm.id}>
                              {rm.displayName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-green-400 whitespace-nowrap" title={entry.rm2_name || '—'}>
                          {entry.rm2_name || '—'}
                        </span>
                      )
                    ) : (
                      <span className="text-gray-500 text-xs italic">N/A</span>
                    )}
                  </td>
                  <td className="p-2 min-w-[80px]">
                    {(role === 'super_admin' || role === 'financial_manager') ? (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          className="form-input"
                          value={entry.utr || ''}
                          onChange={e => {
                            const utrValue = e.target.value.trim();
                            handlePaymentChange(i, 'utr', utrValue);
                            // Automatically set approved to true if UTR has value, false if empty
                            handlePaymentChange(i, 'approved', utrValue.length > 0);
                          }}
                          placeholder="Enter UTR"
                        />
                        <span className={`text-xs font-semibold ${entry.utr && entry.utr.trim() ? 'text-emerald-400' : 'text-yellow-400'}`}>
                          {entry.utr && entry.utr.trim() ? 'Approved' : 'Awaiting Approval'}
                        </span>
                      </div>
                    ) : entry.approved ? (
                      <div className="flex flex-col">
                        <span className="text-emerald-400 font-semibold">Approved</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-yellow-400">
                        <svg
                          className="w-4 h-4 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6l4 2" />
                        </svg>
                        Awaiting Approval
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* ————— Actions ————— */}
        <div className="flex justify-end space-x-3 mt-6">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {isSaved ? 'Close' : 'Cancel'}
          </button>
          {!isSaved && (
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default ClientDetailsModal;
