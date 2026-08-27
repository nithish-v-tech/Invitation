import React, { useState } from 'react';

export default function CalendarView({ invitations, onSelectInvitation }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get name of month
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Number of days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // First day of current month (0 = Sunday, 1 = Monday, etc.)
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Navigate months
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Helper: check if two dates are the same calendar day
  const isSameDayStr = (dateStr1, dateStr2) => {
    if (!dateStr1 || !dateStr2) return false;
    // Normalize format to YYYY-MM-DD
    const d1 = dateStr1.split('T')[0];
    const d2 = dateStr2.split('T')[0];
    return d1 === d2;
  };

  // Generate calendar days array
  const cells = [];
  
  // Previous month padding cells
  const prevDaysInMonth = new Date(year, month, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const padDate = new Date(year, month - 1, prevDaysInMonth - i);
    cells.push({
      date: padDate,
      isCurrentMonth: false,
      dateString: padDate.toISOString().split('T')[0]
    });
  }

  // Current month cells
  const todayStr = new Date().toISOString().split('T')[0];
  for (let d = 1; d <= daysInMonth; d++) {
    const activeDate = new Date(year, month, d);
    // Adjusted timezone offset to get local date ISO string safely
    const offset = activeDate.getTimezoneOffset();
    const localDate = new Date(activeDate.getTime() - (offset * 60 * 1000));
    cells.push({
      date: activeDate,
      isCurrentMonth: true,
      dateString: localDate.toISOString().split('T')[0]
    });
  }

  // Next month padding cells to complete a grid of 35 or 42 cells
  const totalGridCells = cells.length > 35 ? 42 : 35;
  const remaining = totalGridCells - cells.length;
  for (let i = 1; i <= remaining; i++) {
    const padDate = new Date(year, month + 1, i);
    cells.push({
      date: padDate,
      isCurrentMonth: false,
      dateString: padDate.toISOString().split('T')[0]
    });
  }

  // Helper to color-code event pills
  const getEventStyle = (type) => {
    const styles = {
      'Wedding': { background: '#ef4444', color: '#fff' },
      'Engagement': { background: '#f59e0b', color: '#0c0919' },
      'Ear Piercing Function': { background: '#10b981', color: '#fff' },
      'Birthday': { background: '#3b82f6', color: '#fff' },
      'Housewarming': { background: '#8b5cf6', color: '#fff' },
      'Reception': { background: '#ec4899', color: '#fff' },
      'Baby Shower': { background: '#14b8a6', color: '#fff' },
      'Anniversary': { background: '#0ea5e9', color: '#fff' },
      'Religious Function': { background: '#a855f7', color: '#fff' },
      'Puberty Ceremony': { background: '#f43f5e', color: '#fff' },
      'Other': { background: '#6b7280', color: '#fff' }
    };
    return styles[type] || styles['Other'];
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Event Calendar</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Plot your saved invitations by dates. Click on any event to see full details.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={prevMonth} style={{ padding: '8px 12px' }}>
            <i className="fa fa-chevron-left"></i>
          </button>
          <h3 style={{ minWidth: '150px', textAlign: 'center' }}>{monthNames[month]} {year}</h3>
          <button className="btn btn-secondary btn-sm" onClick={nextMonth} style={{ padding: '8px 12px' }}>
            <i className="fa fa-chevron-right"></i>
          </button>
        </div>
      </div>

      <div className="dashboard-panel">
        <div className="calendar-grid" style={{ marginBottom: '10px' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
        </div>

        <div className="calendar-grid">
          {cells.map((cell, idx) => {
            // Find matches
            const dayEvents = invitations.filter(inv => isSameDayStr(inv.date, cell.dateString));
            const isToday = cell.dateString === todayStr;

            return (
              <div 
                key={idx} 
                className={`calendar-cell ${cell.isCurrentMonth ? '' : 'other-month'} ${isToday ? 'today' : ''}`}
              >
                <div className="calendar-date-number" style={{ color: isToday ? 'var(--secondary)' : 'inherit' }}>
                  {cell.date.getDate()}
                </div>
                
                <div className="calendar-events">
                  {dayEvents.map(event => (
                    <div 
                      key={event.id}
                      className="calendar-event-pill" 
                      style={getEventStyle(event.function_type)}
                      onClick={(e) => {
                        e.stopPropagation(); // Avoid cell trigger
                        onSelectInvitation(event);
                      }}
                      title={`${event.function_name} by ${event.person_name || 'Family'}`}
                    >
                      {event.function_name}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Calendar Color Legend */}
      <div className="dashboard-panel" style={{ marginTop: '20px', padding: '15px' }}>
        <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-muted)' }}>Category Legend</h4>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {Object.keys(getEventStyle('Other')).length && [
            'Wedding', 'Engagement', 'Ear Piercing Function', 'Birthday', 
            'Housewarming', 'Reception', 'Baby Shower', 'Anniversary', 
            'Religious Function', 'Puberty Ceremony', 'Other'
          ].map(cat => {
            const colors = getEventStyle(cat);
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '3px', 
                  backgroundColor: colors.background 
                }}></span>
                <span>{cat}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
