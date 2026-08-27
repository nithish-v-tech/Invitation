import React, { useState } from 'react';

const CATEGORIES = [
  'Wedding', 'Engagement', 'Ear Piercing Function', 'Birthday', 
  'Housewarming', 'Reception', 'Baby Shower', 'Anniversary', 
  'Religious Function', 'Puberty Ceremony', 'Other'
];

export default function GiftsReceived({ token, gifts, onGiftAdded, onGiftUpdated, onGiftDeleted }) {
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [selectedGiftId, setSelectedGiftId] = useState('');
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All'); // 'All' | 'Amount' | 'Gift'
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    person_name: '',
    function_name: '',
    function_type: 'Other',
    date: '',
    gift_type: 'Amount', // 'Amount' | 'Gift'
    amount: '',
    gift_description: '',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const openAddModal = () => {
    setModalMode('add');
    setFormData({
      person_name: '',
      function_name: '',
      function_type: 'Other',
      date: new Date().toISOString().split('T')[0],
      gift_type: 'Amount',
      amount: '',
      gift_description: '',
      notes: ''
    });
    setErrorMsg('');
    setShowModal(true);
  };

  const openEditModal = (gift) => {
    setModalMode('edit');
    setSelectedGiftId(gift.id);
    setFormData({
      person_name: gift.person_name,
      function_name: gift.function_name,
      function_type: gift.function_type,
      date: gift.date,
      gift_type: gift.gift_type,
      amount: gift.amount || '',
      gift_description: gift.gift_description,
      notes: gift.notes
    });
    setErrorMsg('');
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!formData.person_name) {
      setErrorMsg('Person Name is required');
      return;
    }
    if (!formData.date) {
      setErrorMsg('Date is required');
      return;
    }
    if (formData.gift_type === 'Amount' && !formData.amount) {
      setErrorMsg('Gift amount is required');
      return;
    }

    setLoading(true);

    try {
      const url = modalMode === 'add' 
        ? 'http://localhost:5000/api/gifts/received'
        : `http://localhost:5000/api/gifts/received/${selectedGiftId}`;

      const method = modalMode === 'add' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || 'Failed to save gift record');
      }

      if (modalMode === 'add') {
        onGiftAdded(res);
      } else {
        onGiftUpdated(res);
      }
      setShowModal(false);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Action
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this gift record?')) return;
    
    try {
      const response = await fetch(`http://localhost:5000/api/gifts/received/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || 'Failed to delete gift record');
      }
      onGiftDeleted(id);
    } catch (err) {
      alert(err.message);
    }
  };

  // Filter & Search Logic
  const filteredGifts = gifts.filter(gift => {
    // Search Query
    const matchSearch = 
      gift.person_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gift.function_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (gift.gift_description && gift.gift_description.toLowerCase().includes(searchQuery.toLowerCase()));

    // Gift Type Filter
    const matchType = filterType === 'All' || gift.gift_type === filterType;

    // Category Filter
    const matchCategory = filterCategory === 'All' || gift.function_type === filterCategory;

    // Date filters
    const matchDateStart = !filterDateStart || new Date(gift.date) >= new Date(filterDateStart);
    const matchDateEnd = !filterDateEnd || new Date(gift.date) <= new Date(filterDateEnd);

    return matchSearch && matchType && matchCategory && matchDateStart && matchDateEnd;
  });

  // Calculate Cumulative sums
  const totalAmountReceived = filteredGifts
    .filter(g => g.gift_type === 'Amount')
    .reduce((sum, g) => sum + (parseFloat(g.amount) || 0), 0);

  const physicalGiftsCount = filteredGifts.filter(g => g.gift_type === 'Gift').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Gifts Received</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Keep track of who gave you gifts or cash contributions during functions.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <i className="fa fa-plus"></i> Record Gift Received
        </button>
      </div>

      {/* Tallies */}
      <div className="dashboard-grid" style={{ marginBottom: '25px', gridTemplateColumns: '1fr 1fr' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span>Total Cash / Amount Received</span>
            <i className="fa fa-indian-rupee-sign" style={{ color: 'var(--secondary)' }}></i>
          </div>
          <div className="metric-value">₹{totalAmountReceived.toLocaleString('en-IN')}</div>
          <div className="metric-footer">Across all filtered records</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Total Physical Gifts Received</span>
            <i className="fa fa-gift" style={{ color: 'var(--primary)' }}></i>
          </div>
          <div className="metric-value">{physicalGiftsCount}</div>
          <div className="metric-footer">Items recorded as received</div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="dashboard-panel" style={{ marginBottom: '25px' }}>
        <div className="search-controls">
          <div className="search-input-wrapper">
            <i className="fa fa-search"></i>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search by person, function, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select 
            className="form-control" 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            style={{ width: '130px' }}
          >
            <option value="All">All Types</option>
            <option value="Amount">Cash Amount</option>
            <option value="Gift">Physical Gift</option>
          </select>

          <select 
            className="form-control" 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>From:</span>
            <input 
              type="date" 
              className="form-control" 
              value={filterDateStart}
              onChange={(e) => setFilterDateStart(e.target.value)}
              style={{ padding: '8px' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>To:</span>
            <input 
              type="date" 
              className="form-control" 
              value={filterDateEnd}
              onChange={(e) => setFilterDateEnd(e.target.value)}
              style={{ padding: '8px' }}
            />
          </div>
        </div>
      </div>

      {/* Gifts Table List */}
      <div className="dashboard-panel">
        <h3 className="panel-title"><i className="fa fa-list" style={{ color: 'var(--primary)' }}></i> Gift Records</h3>
        {filteredGifts.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>No gift records found matching selection.</p>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Contributor / Person</th>
                  <th>Function / Event</th>
                  <th>Date</th>
                  <th>Gift Type</th>
                  <th>Value / Gift Item</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGifts.map(gift => (
                  <tr key={gift.id}>
                    <td><strong>{gift.person_name}</strong></td>
                    <td>
                      {gift.function_name} <br/>
                      <span className="badge badge-other" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{gift.function_type}</span>
                    </td>
                    <td>{gift.date}</td>
                    <td>
                      <span style={{ color: gift.gift_type === 'Amount' ? 'var(--secondary)' : 'var(--primary)' }}>
                        {gift.gift_type === 'Amount' ? 'Cash Amount' : 'Physical Gift'}
                      </span>
                    </td>
                    <td>
                      {gift.gift_type === 'Amount' ? (
                        <strong>₹{parseFloat(gift.amount).toLocaleString('en-IN')}</strong>
                      ) : (
                        <span>{gift.gift_description || 'Gift Item'}</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{gift.notes || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary" onClick={() => openEditModal(gift)} style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                          <i className="fa fa-edit"></i>
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDelete(gift.id)} style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                          <i className="fa fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{modalMode === 'add' ? 'Record Gift Received' : 'Edit Gift Received'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.25rem', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {errorMsg && (
                  <div className="alert-box alert-warning" style={{ padding: '10px', marginBottom: '15px' }}>
                    <i className="fa fa-exclamation-triangle"></i>
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="form-group">
                  <label>Person Name</label>
                  <input 
                    type="text" 
                    name="person_name"
                    value={formData.person_name} 
                    onChange={handleInputChange} 
                    className="form-control" 
                    placeholder="Giver's Name"
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Function Name</label>
                  <input 
                    type="text" 
                    name="function_name"
                    value={formData.function_name} 
                    onChange={handleInputChange} 
                    className="form-control" 
                    placeholder="e.g. My Wedding Ceremony" 
                  />
                </div>

                <div className="form-group">
                  <label>Function Type / Category</label>
                  <select 
                    name="function_type"
                    value={formData.function_type}
                    onChange={handleInputChange}
                    className="form-control"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Date Received</label>
                  <input 
                    type="date" 
                    name="date"
                    value={formData.date} 
                    onChange={handleInputChange} 
                    className="form-control" 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Gift Type</label>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '5px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="gift_type" 
                        value="Amount"
                        checked={formData.gift_type === 'Amount'} 
                        onChange={handleInputChange} 
                      />
                      Amount / Money
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="gift_type" 
                        value="Gift"
                        checked={formData.gift_type === 'Gift'} 
                        onChange={handleInputChange} 
                      />
                      Physical Gift / Item
                    </label>
                  </div>
                </div>

                {formData.gift_type === 'Amount' ? (
                  <div className="form-group">
                    <label>Amount (₹)</label>
                    <input 
                      type="number" 
                      name="amount"
                      value={formData.amount} 
                      onChange={handleInputChange} 
                      className="form-control" 
                      placeholder="e.g. 1000" 
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Gift Description (Item Name / Details)</label>
                    <input 
                      type="text" 
                      name="gift_description"
                      value={formData.gift_description} 
                      onChange={handleInputChange} 
                      className="form-control" 
                      placeholder="e.g. Silk Saree / Dinner Set" 
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Notes</label>
                  <textarea 
                    name="notes"
                    value={formData.notes} 
                    onChange={handleInputChange} 
                    className="form-control" 
                    placeholder="Comments, relationship notes or remarks..." 
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Close</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <span className="spinner"></span> : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
