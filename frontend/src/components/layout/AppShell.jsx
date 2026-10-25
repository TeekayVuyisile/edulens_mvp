import { useState } from 'react';
import { Link, useLocation, useOutlet } from 'react-router-dom';
import { Offcanvas } from 'react-bootstrap';
import { AnimatePresence, motion } from 'framer-motion';
import { LuPanelLeftClose, LuPanelLeftOpen } from 'react-icons/lu';
import { useAuth } from '../../contexts/useAuth';
import { pageTransition } from '../../lib/motion';
import BrandMark from '../ui/BrandMark';
import DemoBanner from './DemoBanner';
import SidebarNav from './SidebarNav';
import Topbar from './Topbar';

const COLLAPSE_KEY = 'edulens.sidebarCollapsed';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
};

/** Signed-in layout: sidebar (drawer on mobile), top bar, animated page area. */
const AppShell = () => {
  const { user } = useAuth();
  const location = useLocation();
  const outlet = useOutlet();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, String(!value));
      } catch {
        // Preference just won't persist.
      }
      return !value;
    });
  };

  return (
    <div className={`el-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <a href="#main-content" className="el-skip-link">
        Skip to content
      </a>

      <aside className="el-sidebar d-none d-lg-flex">
        <Link to="/dashboard" className="el-sidebar__brand">
          <BrandMark size={32} withWordmark={!collapsed} />
        </Link>
        <SidebarNav role={user.role} collapsed={collapsed} layoutId="sidebar-active-desktop" />
        <button
          type="button"
          className="el-sidebar__collapse"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <LuPanelLeftOpen size={19} /> : <LuPanelLeftClose size={19} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>

      <Offcanvas show={menuOpen} onHide={() => setMenuOpen(false)} className="el-drawer" aria-label="Navigation">
        <Offcanvas.Header closeButton closeLabel="Close navigation menu">
          <BrandMark size={32} withWordmark />
        </Offcanvas.Header>
        <Offcanvas.Body className="pt-0">
          <SidebarNav role={user.role} layoutId="sidebar-active-drawer" onNavigate={() => setMenuOpen(false)} />
        </Offcanvas.Body>
      </Offcanvas>

      <div className="el-main">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <DemoBanner />
        <main id="main-content" className="el-content" tabIndex={-1}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={location.pathname} {...pageTransition}>
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default AppShell;
