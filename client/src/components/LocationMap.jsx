import React, { useEffect, useRef, useState } from 'react';

export default function LocationMap({ invitations }) {
  const [selectedInvId, setSelectedInvId] = useState('');
  const [userLoc, setUserLoc] = useState(null); // { lat, lon }
  const [locPermission, setLocPermission] = useState('prompt'); // 'prompt' | 'granted' | 'denied'
  const [routingInfo, setRoutingInfo] = useState(null); // { distance, duration }
  const [statusMsg, setStatusMsg] = useState('');
  
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const userMarker = useRef(null);
  const destMarker = useRef(null);
  const routePolyline = useRef(null);

  // Filter invitations that have valid coordinates
  const mappedInvitations = invitations.filter(inv => inv.latitude && inv.longitude);

  // 1. Ask for current location on load
  useEffect(() => {
    getUserLocation();
  }, []);

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setStatusMsg('Geolocation is not supported by your browser');
      setLocPermission('denied');
      return;
    }

    setStatusMsg('Requesting location permission...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLoc({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
        setLocPermission('granted');
        setStatusMsg('Location acquired.');
      },
      (error) => {
        console.error('Error getting location', error);
        setLocPermission('denied');
        setStatusMsg('Location permission denied or unavailable. Mapped directions require location access.');
      },
      { enableHighAccuracy: true }
    );
  };

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Check if L is loaded (from index.html CDN)
    if (!window.L) {
      setStatusMsg('Error: Leaflet map library failed to load.');
      return;
    }

    // Initialize map centering Bengaluru/India default if user coordinates not ready yet
    const centerLat = userLoc ? userLoc.lat : 12.9716;
    const centerLon = userLoc ? userLoc.lon : 77.5946;

    if (!mapInstance.current) {
      mapInstance.current = window.L.map('map-container').setView([centerLat, centerLon], 13);
      
      // Load OpenStreetMap Tiles
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstance.current);
    } else {
      mapInstance.current.setView([centerLat, centerLon], mapInstance.current.getZoom());
    }

    // Draw user location marker if available
    if (userLoc) {
      if (userMarker.current) {
        userMarker.current.setLatLng([userLoc.lat, userLoc.lon]);
      } else {
        // Red icon for user
        const redIcon = window.L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        userMarker.current = window.L.marker([userLoc.lat, userLoc.lon], { icon: redIcon })
          .addTo(mapInstance.current)
          .bindPopup('<b>Your Location</b>')
          .openPopup();
      }
    }
  }, [userLoc]);

  // 3. Handle selection and render routing
  useEffect(() => {
    if (!mapInstance.current || !window.L) return;

    // Clean old destination marker & polyline
    if (destMarker.current) {
      mapInstance.current.removeLayer(destMarker.current);
      destMarker.current = null;
    }
    if (routePolyline.current) {
      mapInstance.current.removeLayer(routePolyline.current);
      routePolyline.current = null;
    }
    setRoutingInfo(null);

    if (!selectedInvId) return;

    const selectedInv = mappedInvitations.find(inv => inv.id === selectedInvId);
    if (!selectedInv) return;

    const destLat = parseFloat(selectedInv.latitude);
    const destLon = parseFloat(selectedInv.longitude);

    // Add Destination Marker
    const goldIcon = window.L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    destMarker.current = window.L.marker([destLat, destLon], { icon: goldIcon })
      .addTo(mapInstance.current)
      .bindPopup(`<b>${selectedInv.function_name}</b><br/>Venue: ${selectedInv.venue || selectedInv.address}`)
      .openPopup();

    // Zoom/pan map to fit both
    if (userLoc) {
      const bounds = window.L.latLngBounds(
        [userLoc.lat, userLoc.lon],
        [destLat, destLon]
      );
      mapInstance.current.fitBounds(bounds, { padding: [50, 50] });

      // Fetch Driving Routing coordinates from free OSRM API
      setStatusMsg('Calculating route directions...');
      fetch(`https://router.project-osrm.org/route/v1/driving/${userLoc.lon},${userLoc.lat};${destLon},${destLat}?overview=full&geometries=geojson`)
        .then(res => res.json())
        .then(data => {
          if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]); // Swap Lon/Lat for Leaflet Lat/Lon

            // Draw polyline
            routePolyline.current = window.L.polyline(coordinates, {
              color: 'var(--primary)',
              weight: 5,
              opacity: 0.75,
              dashArray: '1, 5'
            }).addTo(mapInstance.current);

            // Set Routing card statistics
            const distanceKm = (route.distance / 1000).toFixed(1);
            const durationMin = Math.round(route.duration / 60);

            setRoutingInfo({
              distance: `${distanceKm} km`,
              duration: `${durationMin} mins`
            });
            setStatusMsg('Route loaded.');
          } else {
            // Draw direct fallback line if routing API fails
            routePolyline.current = window.L.polyline([[userLoc.lat, userLoc.lon], [destLat, destLon]], {
              color: 'var(--danger)',
              weight: 3,
              dashArray: '5, 10'
            }).addTo(mapInstance.current);
            setStatusMsg('Driving route unavailable. Showing straight line path.');
          }
        })
        .catch(err => {
          console.error(err);
          // Fallback line
          routePolyline.current = window.L.polyline([[userLoc.lat, userLoc.lon], [destLat, destLon]], {
            color: 'var(--danger)',
            weight: 3,
            dashArray: '5, 10'
          }).addTo(mapInstance.current);
          setStatusMsg('Offline/Network error. Showing direct line marker connection.');
        });
    } else {
      mapInstance.current.setView([destLat, destLon], 15);
      setStatusMsg('Centered on venue. Current user location not found.');
    }

  }, [selectedInvId, userLoc]);

  // Open External Navigation helper
  const handleOpenNavigation = () => {
    const selectedInv = mappedInvitations.find(inv => inv.id === selectedInvId);
    if (!selectedInv) return;

    const destLat = selectedInv.latitude;
    const destLon = selectedInv.longitude;

    let url = '';
    if (userLoc) {
      url = `https://www.google.com/maps/dir/?api=1&origin=${userLoc.lat},${userLoc.lon}&destination=${destLat},${destLon}&travelmode=driving`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${destLat},${destLon}`;
    }
    window.open(url, '_blank');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Venue Location Finder</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Real-time location finder, destination mappings, and navigation directions.</p>
        </div>
        
        {locPermission !== 'granted' && (
          <button className="btn btn-secondary" onClick={getUserLocation}>
            <i className="fa fa-location-crosshairs"></i> Get Current Location
          </button>
        )}
      </div>

      {statusMsg && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
          <i className="fa fa-info-circle"></i> {statusMsg}
        </div>
      )}

      <div className="map-view-wrapper">
        {/* Map Display */}
        <div id="map-container"></div>

        {/* Sidebar Controls */}
        <div className="map-sidebar">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '15px' }}>Navigation Settings</h3>
          
          <div className="form-group">
            <label>Select Invitation Destination</label>
            <select 
              className="form-control"
              value={selectedInvId}
              onChange={(e) => setSelectedInvId(e.target.value)}
            >
              <option value="">-- Choose Venue --</option>
              {mappedInvitations.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.function_name} ({inv.person_name || 'Family'})
                </option>
              ))}
            </select>
          </div>

          {selectedInvId && (
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--secondary)', marginBottom: '10px' }}>Route Details</h4>
                
                {routingInfo ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Estimated Distance:</span>
                      <span>{routingInfo.distance}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Est. Driving Time:</span>
                      <span>{routingInfo.duration}</span>
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Select destination with active user location to calculate navigation.</span>
                )}
              </div>

              <button 
                className="btn btn-gold" 
                onClick={handleOpenNavigation}
                style={{ width: '100%' }}
              >
                <i className="fa fa-navigation"></i> Open Navigation App
              </button>
            </div>
          )}

          <div style={{ marginTop: '30px', fontSize: '0.8rem', color: 'var(--text-dim)', borderTop: '1px solid rgba(143, 92, 242, 0.15)', paddingTop: '15px' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'red' }}></span>
              Red Pin: Your current location
            </p>
            <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#e5b842' }}></span>
              Gold Pin: Event Venue
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
