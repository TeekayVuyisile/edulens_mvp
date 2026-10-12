import { Link } from 'react-router-dom';
import { LuChevronLeft } from 'react-icons/lu';

/** Page title row: optional back link, title, description and action buttons. */
const PageHeader = ({ title, description, actions, back, eyebrow }) => (
  <header className="el-page-header">
    <div className="el-page-header__text">
      {back && (
        <Link to={back.to} className="el-page-header__back">
          <LuChevronLeft aria-hidden="true" /> {back.label}
        </Link>
      )}
      {eyebrow && <div className="el-page-header__eyebrow">{eyebrow}</div>}
      <h1 className="el-page-header__title">{title}</h1>
      {description && <p className="el-page-header__description">{description}</p>}
    </div>
    {actions && <div className="el-page-header__actions">{actions}</div>}
  </header>
);

export default PageHeader;
