import React from 'react';

export default function Dashboard({ 
  invitations, 
  giftsGiven, 
  giftsReceived, 
  reminders, 
  onNavigate,
  onDismissReminder 
}) {
  
  const todayStr = new Date().toISOString().split('T')[0];

  // Helper date parsing
  const isUpcoming = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date(todayStr);
    return date >= today;
  };

  const isToday = (dateStr) => {
    return dateStr === todayStr;
  };

  // Calculations
  const totalInvitations = invitations.length;
  
  const countByCategory = (cat) => {
    return invitations.filter(i => i.function_type === cat).length;
  };

  const weddingCount = countByCategory('Wedding');
  const birthdayCount = countByCategory('Birthday');
  const engagementCount = countByCategory('Engagement');
  const earPiercingCount = countByCategory('Ear Piercing Function');
  const otherCount = invitations.filter(i => 
    !['Wedding', 'Birthday', 'Engagement', 'Ear Piercing Function'].includes(i.function_type)
  ).length;

  const upcomingInvitations = invitations.filter(i => isUpcoming(i.date));
  const todayInvitations = invitations.filter(i => isToday(i.date));

  // Gifts Given Calculations
  const totalGiftsGivenCount = giftsGiven.length;
  const totalAmountGiven = giftsGiven
    .filter(g => g.gift_type === 'Amount')
    .reduce((sum, g) => sum + (parseFloat(g.amount) || 0), 0);

  // Gifts Received Calculations
  const totalGiftsReceivedCount = giftsReceived.length;
  const totalAmountReceived = giftsReceived
    .filter(g => g.gift_type === 'Amount')
    .reduce((sum, g) => sum + (parseFloat(g.amount) || 0), 0);

  // Reminders Filter
  const activeReminders = reminders.filter(r => r.status === 'pending');

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Welcome back to your Invitation & Event control hub.</p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('add-invitation')}>
          <i className="fa fa-plus"></i> Add Invitation
        </button>
      </div>

      {/* Today's Events Alert */}
      {todayInvitations.length > 0 && (
        <div className="alert-box alert-warning">
          <i className="fa-solid fa-bell-ring" style={{ fontSize: '1.25rem', marginTop: '3px' }}></i>
          <div>
            <h4 style={{ fontWeight: '700', marginBottom: '4px' }}>Today's Celebrations!</h4>
            <p>You have {todayInvitations.length} event(s) scheduled for today:</p>
            <ul style={{ marginLeft: '20px', marginTop: '6px' }}>
              {todayInvitations.map(inv => (
                <li key={inv.id}>
                  <strong>{inv.function_name}</strong> by {inv.person_name || 'Family'} at {inv.time || 'Scheduled Time'} - {inv.venue}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="dashboard-grid">
        <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('my-invitations')}>
          <div className="metric-header">
            <span>Total Invitations</span>
            <div className="metric-icon"><i className="fa fa-envelope-open"></i></div>
          </div>
          <div className="metric-value">{totalInvitations}</div>
          <div className="metric-footer">{upcomingInvitations.length} upcoming functions</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Today's Functions</span>
            <div className="metric-icon"><i className="fa fa-calendar-day"></i></div>
          </div>
          <div className="metric-value">{todayInvitations.length}</div>
          <div className="metric-footer">Events taking place today</div>
        </div>

        <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('my-gifts')}>
          <div className="metric-header">
            <span>Gifts Given</span>
            <div className="metric-icon gold"><i className="fa fa-gift"></i></div>
          </div>
          <div className="metric-value">₹{totalAmountGiven.toLocaleString('en-IN')}</div>
          <div className="metric-footer">{totalGiftsGivenCount} gifts recorded</div>
        </div>

        <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('gifts-received')}>
          <div className="metric-header">
            <span>Gifts Received</span>
            <div className="metric-icon gold"><i className="fa fa-hand-holding-heart"></i></div>
          </div>
          <div className="metric-value">₹{totalAmountReceived.toLocaleString('en-IN')}</div>
          <div className="metric-footer">{totalGiftsReceivedCount} items received</div>
        </div>
      </div>

      <div className="dashboard-layout">
        {/* Statistics & Breakdown */}
        <div className="dashboard-panel">
          <h3 className="panel-title"><i className="fa fa-chart-pie" style={{ color: 'var(--primary)' }}></i> Invitation Categories</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                <span>Wedding</span>
                <span>{weddingCount}</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalInvitations > 0 ? (weddingCount/totalInvitations)*100 : 0}%`, background: 'var(--primary)', borderRadius: '4px' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                <span>Birthday</span>
                <span>{birthdayCount}</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalInvitations > 0 ? (birthdayCount/totalInvitations)*100 : 0}%`, background: '#3b82f6', borderRadius: '4px' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                <span>Engagement</span>
                <span>{engagementCount}</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalInvitations > 0 ? (engagementCount/totalInvitations)*100 : 0}%`, background: '#f59e0b', borderRadius: '4px' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                <span>Ear Piercing Function</span>
                <span>{earPiercingCount}</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalInvitations > 0 ? (earPiercingCount/totalInvitations)*100 : 0}%`, background: '#10b981', borderRadius: '4px' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                <span>Others</span>
                <span>{otherCount}</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalInvitations > 0 ? (otherCount/totalInvitations)*100 : 0}%`, background: '#6b7280', borderRadius: '4px' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* 2-Day Reminders */}
        <div className="dashboard-panel">
          <h3 className="panel-title"><i className="fa fa-clock" style={{ color: 'var(--secondary)' }}></i> Upcoming Reminders (2 Days Before)</h3>
          {activeReminders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>No active notifications or alerts.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeReminders.map(rem => (
                <div key={rem.id} className="alert-box alert-info" style={{ margin: 0, padding: '12px' }}>
                  <div style={{ flex: 1, fontSize: '0.85rem' }}>
                    <p style={{ fontWeight: '600', marginBottom: '4px' }}>Event Reminder</p>
                    <p>{rem.reminder_message}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Alert Date: {rem.reminder_date}
                    </p>
                  </div>
                  <button 
                    onClick={() => onDismissReminder(rem.id)} 
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', hover: {color: '#fff'} }}
                    title="Dismiss reminder"
                  >
                    <i className="fa fa-check"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
