import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import AddInvitation from './components/AddInvitation';
import CalendarView from './components/CalendarView';
import LocationMap from './components/LocationMap';
import GiftsGiven from './components/GiftsGiven';
import GiftsReceived from './components/GiftsReceived';

const CATEGORIES = [
  'Wedding',
  'Engagement',
  'Ear Piercing Function',
  'Birthday',
  'Housewarming',
  'Reception',
  'Baby Shower',
  'Anniversary',
  'Religious Function',
  'Puberty Ceremony',
  'Other'
];

export default function App() {
  // Session & Auth state
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  
  // Navigation & Routing state
  const [currentTab, setCurrentTab] = useState('dashboard'); // 'dashboard' | 'my-invitations' | 'add-invitation' | 'calendar' | 'location' | 'my-gifts' | 'gifts-received' | 'profile'
  const [selectedInvitation, setSelectedInvitation] = useState(null); // Detail view item
  const [editingInvitation, setEditingInvitation] = useState(null); // Edit form item
  const [sidebarActive, setSidebarActive] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All'); // For Category filter page

  // Auth Inputs
  const [isRegister, setIsRegister] = useState(false);
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: ''
  });
  
  // Lists
  const [invitations, setInvitations] = useState([]);
  const [giftsGiven, setGiftsGiven] = useState([]);
  const [giftsReceived, setGiftsReceived] = useState([]);
  const [reminders, setReminders] = useState([]);
  
  // Statuses
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all user details if logged in
  useEffect(() => {
    if (token) {
      fetchUserData();
    }
  }, [token]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [invRes, givenRes, recRes, remRes] = await Promise.all([
        fetch('http://localhost:5000/api/invitations', { headers }),
        fetch('http://localhost:5000/api/gifts/given', { headers }),
        fetch('http://localhost:5000/api/gifts/received', { headers }),
        fetch('http://localhost:5000/api/reminders', { headers })
      ]);

      const invs = await invRes.json();
      const given = await givenRes.json();
      const rec = await recRes.json();
      const rems = await remRes.json();

      if (invRes.ok) setInvitations(invs);
      if (givenRes.ok) setGiftsGiven(given);
      if (recRes.ok) setGiftsReceived(rec);
      if (remRes.ok) setReminders(rems);
      
    } catch (err) {
      console.error('Error fetching dashboard details', err);
    } finally {
      setLoading(false);
    }
  };

  // Auth Handlers
  const handleAuthInputChange = (e) => {
    setAuthForm({ ...authForm, [e.target.name]: e.target.value });
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    const endpoint = isRegister ? 'register' : 'login';
    try {
      const response = await fetch(`http://localhost:5000/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || 'Authentication failed');
      }

      if (isRegister) {
        setIsRegister(false);
        setAuthForm({ name: '', email: '', mobile: '', password: '', confirmPassword: '' });
        alert('Registration successful! Please login.');
      } else {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        setToken(res.token);
        setUser(res.user);
        setCurrentTab('dashboard');
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setInvitations([]);
    setGiftsGiven([]);
    setGiftsReceived([]);
    setReminders([]);
  };

  // Dismiss a 2-day reminder
  const handleDismissReminder = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/reminders/${id}/dismiss`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setReminders(prev => prev.map(r => r.id === id ? { ...r, status: 'dismissed' } : r));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Invitation
  const handleDeleteInvitation = async (id) => {
    if (!window.confirm('Are you sure you want to delete this invitation? All associated reminders will be removed.')) return;
    try {
      const response = await fetch(`http://localhost:5000/api/invitations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setInvitations(prev => prev.filter(inv => inv.id !== id));
        setSelectedInvitation(null);
        setCurrentTab('my-invitations');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Edit invitation submission helper
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    try {
      const response = await fetch(`http://localhost:5000/api/invitations/${editingInvitation.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: data
      });
      const res = await response.json();
      if (response.ok) {
        setInvitations(prev => prev.map(inv => inv.id === res.id ? res : inv));
        setSelectedInvitation(res);
        setEditingInvitation(null);
        alert('Invitation updated successfully');
      } else {
        alert(res.error || 'Failed to update invitation');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter criteria for My Invitations tab
  const getFilteredInvitations = () => {
    return invitations.filter(inv => {
      const matchesSearch = 
        inv.person_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.function_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.function_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.venue && inv.venue.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (inv.date && inv.date.includes(searchQuery));
      
      const matchesCategory = 
        categoryFilter === 'All' || 
        inv.function_type === categoryFilter ||
        (categoryFilter === 'Other' && !CATEGORIES.includes(inv.function_type));

      return matchesSearch && matchesCategory;
    });
  };

  // RENDER AUTH SCREENS
  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-logo"><i className="fa-solid fa-wand-magic-sparkles"></i> Invitation Manager</h1>
            <p className="auth-subtitle">Organize and keep track of your wedding, ceremonies, and gifts.</p>
          </div>

          {authError && (
            <div className="alert-box alert-warning">
              <i className="fa fa-exclamation-triangle"></i>
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit}>
            {isRegister && (
              <>
                <div className="form-group">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    name="name" 
                    value={authForm.name} 
                    onChange={handleAuthInputChange} 
                    className="form-control" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Mobile Number</label>
                  <input 
                    type="text" 
                    name="mobile" 
                    value={authForm.mobile} 
                    onChange={handleAuthInputChange} 
                    className="form-control" 
                    required 
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                name="email" 
                value={authForm.email} 
                onChange={handleAuthInputChange} 
                className="form-control" 
                required 
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                name="password" 
                value={authForm.password} 
                onChange={handleAuthInputChange} 
                className="form-control" 
                required 
              />
            </div>

            {isRegister && (
              <div className="form-group">
                <label>Confirm Password</label>
                <input 
                  type="password" 
                  name="confirmPassword" 
                  value={authForm.confirmPassword} 
                  onChange={handleAuthInputChange} 
                  className="form-control" 
                  required 
                />
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '15px' }}>
              {isRegister ? 'Register Account' : 'Login Dashboard'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {isRegister ? (
              <p>Already have an account? <span onClick={() => { setIsRegister(false); setAuthError(''); }} style={{ color: 'var(--secondary)', cursor: 'pointer', fontWeight: 'bold' }}>Login here</span></p>
            ) : (
              <p>New member? <span onClick={() => { setIsRegister(true); setAuthError(''); }} style={{ color: 'var(--secondary)', cursor: 'pointer', fontWeight: 'bold' }}>Register here</span></p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Mobile Sidebar Toggle */}
      <button className="menu-toggle" onClick={() => setSidebarActive(!sidebarActive)}>
        <i className={`fa ${sidebarActive ? 'fa-times' : 'fa-bars'}`}></i>
      </button>

      {/* Sidebar Panel */}
      <aside className={`sidebar ${sidebarActive ? 'active' : ''}`}>
        <div className="sidebar-brand">
          <i className="fa-solid fa-wand-magic-sparkles" style={{ fontSize: '1.5rem', color: 'var(--secondary)' }}></i>
          <span className="sidebar-logo-text">IMS Panel</span>
        </div>

        <ul className="sidebar-menu">
          <li className={`sidebar-item ${currentTab === 'dashboard' ? 'active' : ''}`}>
            <button onClick={() => { setCurrentTab('dashboard'); setSidebarActive(false); }}>
              <i className="fa fa-tachometer-alt"></i> Dashboard
            </button>
          </li>
          <li className={`sidebar-item ${currentTab === 'my-invitations' ? 'active' : ''}`}>
            <button onClick={() => { setCurrentTab('my-invitations'); setSelectedInvitation(null); setCategoryFilter('All'); setSidebarActive(false); }}>
              <i className="fa fa-envelope-open"></i> My Invitations
            </button>
          </li>
          <li className={`sidebar-item ${currentTab === 'add-invitation' ? 'active' : ''}`}>
            <button onClick={() => { setCurrentTab('add-invitation'); setSidebarActive(false); }}>
              <i className="fa fa-plus"></i> Add Invitation
            </button>
          </li>
          
          {/* Categories Submenu List */}
          <li style={{ padding: '8px 16px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-dim)', letterSpacing: '0.05em', marginTop: '10px' }}>CATEGORIES</li>
          {['Wedding', 'Birthday', 'Engagement', 'Ear Piercing Function', 'Other'].map(cat => (
            <li key={cat} className={`sidebar-item ${currentTab === `cat-${cat}` ? 'active' : ''}`} style={{ paddingLeft: '8px' }}>
              <button onClick={() => { 
                setCategoryFilter(cat); 
                setCurrentTab('my-invitations'); 
                setSelectedInvitation(null);
                setSidebarActive(false); 
              }}>
                <i className="fa fa-tag" style={{ fontSize: '0.85rem' }}></i> {cat === 'Ear Piercing Function' ? 'Ear Piercing' : cat}
              </button>
            </li>
          ))}

          <li style={{ padding: '8px 16px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-dim)', letterSpacing: '0.05em', marginTop: '10px' }}>UTILITIES</li>
          <li className={`sidebar-item ${currentTab === 'calendar' ? 'active' : ''}`}>
            <button onClick={() => { setCurrentTab('calendar'); setSidebarActive(false); }}>
              <i className="fa fa-calendar-alt"></i> Calendar View
            </button>
          </li>
          <li className={`sidebar-item ${currentTab === 'location' ? 'active' : ''}`}>
            <button onClick={() => { setCurrentTab('location'); setSidebarActive(false); }}>
              <i className="fa fa-map-marked-alt"></i> Venue Location
            </button>
          </li>
          
          <li style={{ padding: '8px 16px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-dim)', letterSpacing: '0.05em', marginTop: '10px' }}>GIFTS SYSTEM</li>
          <li className={`sidebar-item ${currentTab === 'my-gifts' ? 'active' : ''}`}>
            <button onClick={() => { setCurrentTab('my-gifts'); setSidebarActive(false); }}>
              <i className="fa fa-gift"></i> Gifts Given
            </button>
          </li>
          <li className={`sidebar-item ${currentTab === 'gifts-received' ? 'active' : ''}`}>
            <button onClick={() => { setCurrentTab('gifts-received'); setSidebarActive(false); }}>
              <i className="fa fa-hand-holding-heart"></i> Gifts Received
            </button>
          </li>
        </ul>

        {/* User profile details at bottom */}
        <div className="sidebar-footer">
          <div className="user-info-bar" style={{ cursor: 'pointer', justifyContent: 'space-between' }} onClick={() => setCurrentTab('profile')}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', overflow: 'hidden' }}>
              <div className="user-avatar">{user ? user.name.charAt(0).toUpperCase() : 'U'}</div>
              <div className="user-details">
                <span className="user-name">{user ? user.name : 'User'}</span>
                <span className="user-email">{user ? user.email : ''}</span>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} title="Logout">
              <i className="fa fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Panel Content Wrapper */}
      <main className="main-wrapper">
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
            <span className="spinner"></span> Loading IMS Sync...
          </div>
        )}

        {/* DETAIL VIEW OVERLAY FOR AN INVITATION */}
        {selectedInvitation ? (
          <div>
            <div className="page-header">
              <div>
                <h2>Invitation Details</h2>
                <p style={{ color: 'var(--text-muted)' }}>Viewing full information card for this celebration.</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedInvitation(null)}>Back to List</button>
                <button className="btn btn-primary" onClick={() => setEditingInvitation(selectedInvitation)}>
                  <i className="fa fa-edit"></i> Edit
                </button>
                <button className="btn btn-danger" onClick={() => handleDeleteInvitation(selectedInvitation.id)}>
                  <i className="fa fa-trash"></i> Delete
                </button>
              </div>
            </div>

            <div className="details-layout">
              {/* Image box */}
              <div className="details-image-panel">
                {selectedInvitation.invitation_image ? (
                  <img 
                    src={`http://localhost:5000${selectedInvitation.invitation_image}`} 
                    alt="Invitation Card" 
                    className="details-image"
                  />
                ) : (
                  <div className="card-img-placeholder" style={{ height: '350px' }}>
                    <i className="fa fa-envelope-open" style={{ fontSize: '5rem' }}></i>
                    <p style={{ fontSize: '1rem', marginTop: '10px' }}>No Card Attached</p>
                  </div>
                )}
                
                {selectedInvitation.latitude && selectedInvitation.longitude && (
                  <button 
                    className="btn btn-gold" 
                    style={{ marginTop: '20px', width: '100%' }}
                    onClick={() => { 
                      setCurrentTab('location');
                      setSelectedInvitation(null);
                    }}
                  >
                    <i className="fa fa-map-marked-alt"></i> View Venue on Map
                  </button>
                )}
              </div>

              {/* Data lists */}
              <div className="details-info-panel">
                <div style={{ marginBottom: '20px' }}>
                  <span className={`badge badge-${selectedInvitation.function_type.toLowerCase().replace(/\s+/g, '')}`}>
                    {selectedInvitation.function_type}
                  </span>
                  <h3 style={{ fontSize: '1.8rem', marginTop: '10px' }}>{selectedInvitation.function_name}</h3>
                </div>

                <div className="info-row">
                  <div className="info-label">Invited by / Host</div>
                  <div className="info-value">{selectedInvitation.person_name || 'Not Specified'}</div>
                </div>

                <div className="info-row">
                  <div className="info-label">Event Date</div>
                  <div className="info-value">{selectedInvitation.date || 'Not Scheduled'}</div>
                </div>

                <div className="info-row">
                  <div className="info-label">Timings</div>
                  <div className="info-value">{selectedInvitation.time || 'Not Scheduled'}</div>
                </div>

                <div className="info-row">
                  <div className="info-label">Hall Name</div>
                  <div className="info-value">{selectedInvitation.venue || 'Not Specified'}</div>
                </div>

                <div className="info-row">
                  <div className="info-label">Address</div>
                  <div className="info-value">{selectedInvitation.address || 'Not Specified'}</div>
                </div>

                <div className="info-row">
                  <div className="info-label">Coordinates</div>
                  <div className="info-value">
                    {selectedInvitation.latitude ? `Lat: ${selectedInvitation.latitude}, Lon: ${selectedInvitation.longitude}` : 'No GPS coordinates saved'}
                  </div>
                </div>

                <div className="info-row" style={{ flexDirection: 'column', gap: '8px' }}>
                  <div className="info-label">Additional notes</div>
                  <div className="info-value" style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
                    {selectedInvitation.notes || 'No extra remarks recorded.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* TABS SELECT ROUTER */}
            {currentTab === 'dashboard' && (
              <Dashboard 
                invitations={invitations}
                giftsGiven={giftsGiven}
                giftsReceived={giftsReceived}
                reminders={reminders}
                onNavigate={setCurrentTab}
                onDismissReminder={handleDismissReminder}
              />
            )}

            {currentTab === 'my-invitations' && (
              <div>
                <div className="page-header">
                  <div>
                    <h2>My Invitations ({getFilteredInvitations().length})</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Browse, search, and view complete invitation records.</p>
                  </div>
                  <button className="btn btn-primary" onClick={() => setCurrentTab('add-invitation')}>
                    <i className="fa fa-plus"></i> Add Invitation
                  </button>
                </div>

                {/* Filters Row */}
                <div className="dashboard-panel" style={{ marginBottom: '25px' }}>
                  <div className="search-controls">
                    <div className="search-input-wrapper" style={{ flex: 1 }}>
                      <i className="fa fa-search"></i>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Search by host name, venue address, function name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    
                    <select 
                      className="form-control" 
                      value={categoryFilter} 
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      style={{ width: '200px' }}
                    >
                      <option value="All">All Categories</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Grid List */}
                {getFilteredInvitations().length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No invitations registered matching filter.</p>
                ) : (
                  <div className="invitation-grid">
                    {getFilteredInvitations().map(inv => (
                      <div key={inv.id} className="invitation-card" onClick={() => setSelectedInvitation(inv)}>
                        {inv.invitation_image ? (
                          <img src={`http://localhost:5000${inv.invitation_image}`} alt={inv.function_name} className="card-img" />
                        ) : (
                          <div className="card-img-placeholder">
                            <i className="fa fa-envelope"></i>
                          </div>
                        )}
                        <div className="card-body">
                          <div className="card-category">
                            <span className={`badge badge-${inv.function_type.toLowerCase().replace(/\s+/g, '')}`}>
                              {inv.function_type}
                            </span>
                          </div>
                          <h4 className="card-title">{inv.function_name}</h4>
                          <p className="card-meta"><i className="fa fa-user"></i> {inv.person_name || 'Family'}</p>
                          <p className="card-meta"><i className="fa fa-calendar-alt"></i> {inv.date || 'No Date'}</p>
                          <p className="card-meta"><i className="fa fa-map-marker-alt"></i> {inv.venue || 'No Venue'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {currentTab === 'add-invitation' && (
              <AddInvitation 
                token={token}
                onSave={(newInv) => {
                  setInvitations(prev => [newInv, ...prev]);
                  setCurrentTab('my-invitations');
                  setSelectedInvitation(newInv);
                  fetchUserData(); // Recalculate reminders
                }}
                onCancel={() => setCurrentTab('dashboard')}
              />
            )}

            {currentTab === 'calendar' && (
              <CalendarView 
                invitations={invitations}
                onSelectInvitation={(inv) => setSelectedInvitation(inv)}
              />
            )}

            {currentTab === 'location' && (
              <LocationMap invitations={invitations} />
            )}

            {currentTab === 'my-gifts' && (
              <GiftsGiven 
                token={token}
                gifts={giftsGiven}
                onGiftAdded={(gift) => setGiftsGiven(prev => [gift, ...prev])}
                onGiftUpdated={(gift) => setGiftsGiven(prev => prev.map(g => g.id === gift.id ? gift : g))}
                onGiftDeleted={(id) => setGiftsGiven(prev => prev.filter(g => g.id !== id))}
              />
            )}

            {currentTab === 'gifts-received' && (
              <GiftsReceived 
                token={token}
                gifts={giftsReceived}
                onGiftAdded={(gift) => setGiftsReceived(prev => [gift, ...prev])}
                onGiftUpdated={(gift) => setGiftsReceived(prev => prev.map(g => g.id === gift.id ? gift : g))}
                onGiftDeleted={(id) => setGiftsReceived(prev => prev.filter(g => g.id !== id))}
              />
            )}

            {currentTab === 'profile' && (
              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div className="page-header">
                  <h2>User Profile Settings</h2>
                </div>

                <div className="dashboard-panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div className="user-avatar" style={{ width: '80px', height: '80px', fontSize: '2rem', margin: '0 auto 20px' }}>
                    {user ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>

                  <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{user ? user.name : 'Unknown User'}</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>Member since: {user ? 'August 2026' : '-'}</p>

                  <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '15px', borderTop: '1px solid rgba(143, 92, 242, 0.15)', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Email ID:</span>
                      <strong>{user ? user.email : ''}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Contact No:</span>
                      <strong>{user ? user.mobile : ''}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Invitations Logged:</span>
                      <strong>{invitations.length} Cards</strong>
                    </div>
                  </div>

                  <button className="btn btn-danger" onClick={handleLogout} style={{ marginTop: '40px', width: '100%', maxWidth: '200px' }}>
                    <i className="fa fa-sign-out-alt"></i> Logout Session
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* EDIT INVITATION DIALOG BOX */}
      {editingInvitation && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Invitation Details</h3>
              <button onClick={() => setEditingInvitation(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.25rem', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Person / Family Name</label>
                  <input 
                    type="text" 
                    name="person_name"
                    defaultValue={editingInvitation.person_name} 
                    className="form-control" 
                  />
                </div>

                <div className="form-group">
                  <label>Function Name</label>
                  <input 
                    type="text" 
                    name="function_name"
                    defaultValue={editingInvitation.function_name} 
                    className="form-control" 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Function Category</label>
                  <select 
                    name="function_type"
                    defaultValue={editingInvitation.function_type}
                    className="form-control"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Date</label>
                  <input 
                    type="date" 
                    name="date"
                    defaultValue={editingInvitation.date} 
                    className="form-control" 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Time</label>
                  <input 
                    type="text" 
                    name="time"
                    defaultValue={editingInvitation.time} 
                    className="form-control" 
                  />
                </div>

                <div className="form-group">
                  <label>Venue Hall</label>
                  <input 
                    type="text" 
                    name="venue"
                    defaultValue={editingInvitation.venue} 
                    className="form-control" 
                  />
                </div>

                <div className="form-group">
                  <label>Address</label>
                  <input 
                    type="text" 
                    name="address"
                    defaultValue={editingInvitation.address} 
                    className="form-control" 
                  />
                </div>

                <div className="form-group">
                  <label>Latitude</label>
                  <input 
                    type="number" 
                    step="any"
                    name="latitude"
                    defaultValue={editingInvitation.latitude || ''} 
                    className="form-control" 
                  />
                </div>

                <div className="form-group">
                  <label>Longitude</label>
                  <input 
                    type="number" 
                    step="any"
                    name="longitude"
                    defaultValue={editingInvitation.longitude || ''} 
                    className="form-control" 
                  />
                </div>

                <div className="form-group">
                  <label>Upload New Invitation Image (Optional)</label>
                  <input type="file" name="invitation_image" accept="image/*" className="form-control" />
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea 
                    name="notes"
                    defaultValue={editingInvitation.notes} 
                    className="form-control" 
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingInvitation(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
