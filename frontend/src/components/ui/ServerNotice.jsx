import { useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LuLoaderCircle, LuServerCrash } from 'react-icons/lu';
import { reveal } from '../../lib/motion';
import { getServerStatus, subscribeServerStatus } from '../../lib/serverStatus';

/** Explains a slow first request on free hosting. Hidden once the API responds. */
const ServerNotice = ({ className = '' }) => {
  const status = useSyncExternalStore(subscribeServerStatus, getServerStatus);
  const visible = status === 'waking' || status === 'offline';
  const waking = status === 'waking';
  const Icon = waking ? LuLoaderCircle : LuServerCrash;

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div {...reveal} className={`overflow-hidden ${className}`}>
          <div className="el-form-alert el-form-alert--warning" role="status">
            <Icon size={18} className={`flex-shrink-0 mt-1 ${waking ? 'el-spin' : ''}`} aria-hidden="true" />
            <div>
              <strong className="d-block">
                {waking ? 'Waking up the demo server…' : 'The server isn’t responding right now.'}
              </strong>
              {waking
                ? 'It runs on free hosting that sleeps when idle, so the first visit can take up to a minute.'
                : 'Please try again in a few minutes.'}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ServerNotice;
