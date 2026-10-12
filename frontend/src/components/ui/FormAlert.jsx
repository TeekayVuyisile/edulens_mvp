import { AnimatePresence, motion } from 'framer-motion';
import { LuCircleAlert, LuCircleCheck, LuInfo } from 'react-icons/lu';
import { reveal } from '../../lib/motion';

const ICONS = { danger: LuCircleAlert, success: LuCircleCheck, info: LuInfo };

/** Inline message under a form heading; animates in and out. */
const FormAlert = ({ variant = 'danger', children }) => {
  const Icon = ICONS[variant] ?? LuInfo;

  return (
    <AnimatePresence initial={false}>
      {children && (
        <motion.div {...reveal} className="overflow-hidden">
          <div
            className={`el-form-alert el-form-alert--${variant}`}
            role={variant === 'danger' ? 'alert' : 'status'}
          >
            <Icon size={18} className="flex-shrink-0 mt-1" aria-hidden="true" />
            <div>{children}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FormAlert;
