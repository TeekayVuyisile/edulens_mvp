import { motion } from 'framer-motion';
import { LuChartLine, LuClipboardCheck, LuSparkles } from 'react-icons/lu';
import BrandMark from '../ui/BrandMark';
import { DURATION, EASE_OUT } from '../../lib/motion';

const HIGHLIGHTS = [
  { icon: LuClipboardCheck, text: 'Assessments aligned to CAPS, from Grade R to Grade 3' },
  { icon: LuChartLine, text: 'See every learner’s progress, term by term' },
  { icon: LuSparkles, text: 'Curriculum-matched worksheets in minutes' },
];

/** Split layout for the sign-in pages: brand panel (desktop) + form column. */
const AuthLayout = ({ title, subtitle, children, footer }) => (
  <div className="el-auth">
    <aside className="el-auth__brand d-none d-lg-flex" aria-hidden="true">
      <BrandMark size={40} withWordmark inverted />
      <div className="el-auth__pitch">
        <h2 className="el-auth__headline">Every learner, seen clearly.</h2>
        <p className="el-auth__lede">
          One place for Foundation Phase teachers and school leaders to plan, assess and track progress.
        </p>
        <ul className="el-auth__highlights">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li key={text}>
              <span className="el-auth__highlight-icon">
                <Icon size={18} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
      <p className="el-auth__legal">© {new Date().getFullYear()} Edulens LMS</p>
    </aside>

    <main className="el-auth__panel">
      <motion.div
        className="el-auth__card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.slow, ease: EASE_OUT }}
      >
        <BrandMark size={40} withWordmark className="d-lg-none mb-4" />
        <h1 className="el-auth__title">{title}</h1>
        {subtitle && <p className="el-auth__subtitle">{subtitle}</p>}
        {children}
        {footer && <div className="el-auth__footer">{footer}</div>}
      </motion.div>
    </main>
  </div>
);

export default AuthLayout;
