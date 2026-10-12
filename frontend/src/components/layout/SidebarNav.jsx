import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { navigationFor } from '../../config/navigation';

/**
 * The role's navigation sections. Used by the desktop sidebar and the mobile
 * drawer. `layoutId` gives each a separate sliding "active" indicator.
 */
const SidebarNav = ({ role, collapsed = false, layoutId = 'sidebar-active', onNavigate }) => (
  <nav aria-label="Main navigation" className="el-sidenav">
    {navigationFor(role).map((section) => (
      <div key={section.heading} className="el-sidenav__section">
        {collapsed ? (
          <hr className="el-sidenav__divider" aria-hidden="true" />
        ) : (
          <p className="el-sidenav__heading">{section.heading}</p>
        )}
        <ul className="list-unstyled m-0">
          {section.items.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onNavigate}
                className={({ isActive }) => `el-sidenav__link ${isActive ? 'is-active' : ''}`}
                title={collapsed ? label : undefined}
                aria-label={collapsed ? label : undefined}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId={layoutId}
                        className="el-sidenav__active-bg"
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                    )}
                    <Icon className="el-sidenav__icon" size={19} aria-hidden="true" />
                    {!collapsed && <span className="el-sidenav__label">{label}</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </nav>
);

export default SidebarNav;
