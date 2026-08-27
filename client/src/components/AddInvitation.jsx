import React, { useState } from 'react';

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

export default function AddInvitation({ token, onSave, onCancel }) {
  const [activeTab, setActiveTab] = useState('ocr'); // 'ocr' | 'manual'
  
  // Form fields
  const [formData, setFormData] = useState({
    person_name: '',
    function_name: '',
    function_type: 'Other',
    date: '',
    time: '',
    venue: '',
    address: '',
    latitude: '',
    longitude: '',
    ocr_text: '',
    notes: ''
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  // Loaders & Statuses
  const [scanning, setScanning] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Handle text input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      
      // Auto classify if changing function name
      if (name === 'function_name') {
        const textLower = value.toLowerCase();
        const found = CATEGORIES.find(cat => {
          if (cat === 'Other') return false;
          // Simple keyword mapping
          const matchKeywords = {
            'Wedding': ['wedding', 'marriage', 'nuptial', 'matrimony', 'vivaha'],
            'Engagement': ['engagement', 'betrothal', 'ring'],
            'Ear Piercing Function': ['ear piercing', 'ear-piercing', 'karnavedha'],
            'Birthday': ['birthday', 'happy b', 'celebrat'],
            'Housewarming': ['housewarming', 'house warming', 'grihapravesh'],
            'Reception': ['reception'],
            'Baby Shower': ['baby shower', 'seemantham', 'valaikappu'],
            'Anniversary': ['anniversary'],
            'Religious Function': ['pooja', 'puja', 'prayer', 'bhajan', 'religious'],
            'Puberty Ceremony': ['puberty', 'manjal neerattu']
          };
          const keywords = matchKeywords[cat] || [];
          return keywords.some(kw => textLower.includes(kw));
        });
        
        updated.function_type = found || 'Other';
      }
      return updated;
    });
  };

  // Handle file select
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // OCR Scan Action
  const handleOCRScan = async () => {
    if (!imageFile) {
      setErrorMsg('Please select an invitation image to scan');
      return;
    }

    setErrorMsg('');
    setScanning(true);

    const data = new FormData();
    data.append('invitation_image', imageFile);

    try {
      const response = await fetch('http://localhost:5000/api/scan', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: data
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || 'Failed to scan invitation');
      }

      const scanResult = res.data;
      setFormData({
        person_name: scanResult.person_name || '',
        function_name: scanResult.function_name || '',
        function_type: scanResult.function_type || 'Other',
        date: scanResult.date || '',
        time: scanResult.time || '',
        venue: scanResult.venue || '',
        address: scanResult.address || '',
        latitude: '',
        longitude: '',
        ocr_text: scanResult.ocr_text || '',
        notes: 'Scanned via local OCR Scanner.'
      });

      setSuccessMsg('OCR Scan finished successfully! Review the extracted data below.');
      setActiveTab('manual'); // Toggle to edit screen
    } catch (err) {
      setErrorMsg(err.message || 'Error occurred during scan');
    } finally {
      setScanning(false);
    }
  };

  // Geocode address coordinate fetcher
  const handleGeocode = async () => {
    const searchVal = formData.address || formData.venue;
    if (!searchVal) {
      setErrorMsg('Please provide a venue address to geocode');
      return;
    }

    setErrorMsg('');
    setGeocoding(true);

    try {
      const response = await fetch(`http://localhost:5000/api/geocode?q=${encodeURIComponent(searchVal)}`);
      const res = await response.json();
      
      if (!response.ok) {
        throw new Error(res.error || 'Address coordinates could not be resolved');
      }

      setFormData(prev => ({
        ...prev,
        latitude: res.lat,
        longitude: res.lon,
        address: res.display_name || prev.address
      }));
      setSuccessMsg('Coordinates resolved successfully! Latitude & Longitude mapped.');
    } catch (err) {
      setErrorMsg(err.message || 'Geocoding failed. You can enter coordinates manually.');
    } finally {
      setGeocoding(false);
    }
  };

  // Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!formData.function_name) {
      setErrorMsg('Function Name is required');
      return;
    }
    if (!formData.date) {
      setErrorMsg('Function Date is required');
      return;
    }

    setSaving(true);

    const submissionData = new FormData();
    // Append all text fields
    Object.keys(formData).forEach(key => {
      submissionData.append(key, formData[key]);
    });

    // Append image if present
    if (imageFile) {
      submissionData.append('invitation_image', imageFile);
    }

    try {
      const response = await fetch('http://localhost:5000/api/invitations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: submissionData
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || 'Failed to save invitation');
      }

      onSave(res);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h2>Add New Invitation</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Choose between uploading an image for automatic OCR scanning or filling details manually.</p>
        </div>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>

      {errorMsg && (
        <div className="alert-box alert-warning">
          <i className="fa fa-exclamation-triangle"></i>
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert-box alert-info">
          <i className="fa fa-info-circle"></i>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="filter-pill-bar">
        <button 
          className={`filter-pill ${activeTab === 'ocr' ? 'active' : ''}`}
          onClick={() => setActiveTab('ocr')}
        >
          <i className="fa fa-qrcode"></i> Option A – OCR Scanner
        </button>
        <button 
          className={`filter-pill ${activeTab === 'manual' ? 'active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          <i className="fa fa-keyboard"></i> Option B – Manual Form
        </button>
      </div>

      <div className="dashboard-panel" style={{ marginTop: '20px' }}>
        
        {/* TAB 1: OCR IMAGE SCANNER */}
        {activeTab === 'ocr' && (
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ marginBottom: '15px' }}>Upload Invitation Card to Scan</h4>
            
            <div className="file-upload-wrapper" style={{ margin: '0 auto 20px', maxWidth: '500px' }}>
              <i className="fa fa-cloud-upload-alt" style={{ fontSize: '3rem', color: 'var(--primary)', marginBottom: '10px' }}></i>
              <p>Drag and drop or click to choose invitation image</p>
              <input type="file" accept="image/*" onChange={handleFileChange} />
            </div>

            {imagePreview && (
              <div style={{ marginBottom: '20px' }}>
                <img 
                  src={imagePreview} 
                  alt="Invitation Preview" 
                  style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '8px', border: '1px solid var(--border)' }} 
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{imageFile.name}</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleOCRScan}
                disabled={scanning || !imageFile}
              >
                {scanning ? (
                  <>
                    <span className="spinner"></span> Extracting text...
                  </>
                ) : (
                  <>
                    <i className="fa fa-bolt"></i> Scan & Extract Data
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: MANUAL FORM OR REVIEW MODAL */}
        {activeTab === 'manual' && (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              <div className="form-group">
                <label>Person / Family Name</label>
                <input 
                  type="text" 
                  name="person_name" 
                  value={formData.person_name} 
                  onChange={handleInputChange} 
                  className="form-control" 
                  placeholder="e.g. Mr. & Mrs. Sharma"
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
                  placeholder="e.g. Wedding Reception"
                  required
                />
              </div>

              <div className="form-group">
                <label>Function Category</label>
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
                <label>Function Date</label>
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
                <label>Function Time</label>
                <input 
                  type="text" 
                  name="time" 
                  value={formData.time} 
                  onChange={handleInputChange} 
                  className="form-control" 
                  placeholder="e.g. 7:00 PM onwards"
                />
              </div>

              <div className="form-group">
                <label>Venue (Hall / Hotel / House name)</label>
                <input 
                  type="text" 
                  name="venue" 
                  value={formData.venue} 
                  onChange={handleInputChange} 
                  className="form-control" 
                  placeholder="e.g. Royal Palace Hall"
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Location / Address (For Geocoding & Map Pinpoint)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="text" 
                    name="address" 
                    value={formData.address} 
                    onChange={handleInputChange} 
                    className="form-control" 
                    placeholder="e.g. MG Road, Bengaluru"
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={handleGeocode}
                    disabled={geocoding}
                  >
                    {geocoding ? <span className="spinner"></span> : <i className="fa fa-map-marker-alt"></i>} Geocode
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Latitude (Auto-filled by Geocode)</label>
                <input 
                  type="number" 
                  step="any"
                  name="latitude" 
                  value={formData.latitude} 
                  onChange={handleInputChange} 
                  className="form-control" 
                  placeholder="e.g. 12.9716"
                />
              </div>

              <div className="form-group">
                <label>Longitude (Auto-filled by Geocode)</label>
                <input 
                  type="number" 
                  step="any"
                  name="longitude" 
                  value={formData.longitude} 
                  onChange={handleInputChange} 
                  className="form-control" 
                  placeholder="e.g. 77.5946"
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Upload Original Invitation Image (Optional)</label>
                <div className="file-upload-wrapper">
                  <i className="fa fa-image" style={{ fontSize: '2rem', color: 'var(--text-muted)', marginBottom: '8px' }}></i>
                  <p>{imageFile ? imageFile.name : 'Select different image or keep scanned one'}</p>
                  <input type="file" accept="image/*" onChange={handleFileChange} />
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Additional Notes / Scanned OCR Raw Text</label>
                <textarea 
                  name="notes" 
                  value={formData.notes} 
                  onChange={handleInputChange} 
                  className="form-control"
                  placeholder="Any extra details, dress code or details..."
                  style={{ minHeight: '120px' }}
                />
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <span className="spinner"></span> : <i className="fa fa-save"></i>} Save Invitation
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
