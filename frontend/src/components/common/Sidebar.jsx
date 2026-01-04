import React, { useState } from 'react';
import { Nav } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = ({ items }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className={`d-flex flex-column bg-white border-end ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}
         style={{ 
           width: collapsed ? '80px' : '250px',
           transition: 'width 0.3s ease',
           minHeight: '100vh'
         }}>
      
      <div className="p-3 border-bottom">
        <button 
          className="btn btn-light btn-sm"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <i className={`bi bi-chevron-${collapsed ? 'right' : 'left'}`}></i>
        </button>
      </div>

      <Nav className="flex-column p-3" style={{ overflowY: 'auto' }}>
        {items.map((item, index) => (
          <Nav.Item key={index} className="mb-2">
            <Nav.Link 
              as={Link}
              to={item.path}
              className={`d-flex align-items-center rounded px-3 py-2 ${
                location.pathname === item.path ? 'bg-primary text-white' : 'text-dark'
              }`}
              style={{ 
                textDecoration: 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <i className={`bi bi-${item.icon} ${collapsed ? 'fs-5' : 'me-3'}`}></i>
              {!collapsed && <span>{item.label}</span>}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      {!collapsed && (
        <div className="mt-auto p-3 border-top">
          <div className="text-muted small">
            <div>Edulens LMS</div>
            <div>v1.0.0</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;