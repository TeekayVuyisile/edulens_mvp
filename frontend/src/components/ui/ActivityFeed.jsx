import { LuActivity } from 'react-icons/lu';
import { timeAgo } from '../../lib/format';
import EmptyState from './EmptyState';

/**
 * "Naledi Dlamini added a learner · 5 minutes ago" timeline.
 * items: [{ id, actor, description, school_name?, created_at }]; null while loading.
 */
const ActivityFeed = ({ items, showSchool = false, emptyText = 'Changes made by admins and teachers show up here.' }) => {
  if (items && items.length === 0) {
    return (
      <EmptyState compact icon={LuActivity} title="Nothing yet">
        {emptyText}
      </EmptyState>
    );
  }

  return (
    <ol className="el-feed">
      {(items ?? []).map((item) => (
        <li key={item.id} className="el-feed__item">
          <span className="el-feed__dot" aria-hidden="true" />
          <div className="min-w-0">
            <div>
              <span className="fw-semibold">{item.actor ?? 'Someone'}</span>{' '}
              <span className="text-body-secondary">{item.description.toLowerCase()}</span>
            </div>
            <div className="el-cell-secondary">
              {[showSchool && item.school_name, timeAgo(item.created_at)].filter(Boolean).join(' · ')}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
};

export default ActivityFeed;
