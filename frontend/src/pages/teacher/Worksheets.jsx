import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { LuFileText, LuSparkles } from 'react-icons/lu';
import { useApi, useDebouncedValue, useDocumentTitle } from '../../hooks/useApi';
import { CLASS_GRADES, formatDate, gradeLabel } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import FilterTabs from '../../components/ui/FilterTabs';
import SearchInput from '../../components/ui/SearchInput';
import EmptyState from '../../components/ui/EmptyState';

const Worksheets = () => {
  useDocumentTitle('Worksheets');
  const [scope, setScope] = useState('school');
  const [grade, setGrade] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const { data, loading, error, reload } = useApi('/api/teacher/worksheets/library', {
    mine: scope === 'mine' ? 'true' : undefined,
    grade: grade || undefined,
    search: debouncedSearch || undefined,
  });
  const worksheets = data?.worksheets ?? [];
  const filtering = Boolean(debouncedSearch || grade || scope === 'mine');

  return (
    <>
      <PageHeader
        title="Worksheets"
        description="Printable worksheets your school has made, with answer keys. Make a new one with AI in under a minute."
        actions={
          <Button as={Link} to="/teacher/worksheets/new" className="d-inline-flex align-items-center gap-2">
            <LuSparkles aria-hidden="true" /> New worksheet
          </Button>
        }
      />

      <section className="el-panel mb-4" aria-label="Filter worksheets">
        <div className="el-toolbar border-0">
          <FilterTabs
            label="Whose worksheets"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'school', label: 'Whole school' },
              { value: 'mine', label: 'Mine' },
            ]}
          />
          <SearchInput value={search} onChange={setSearch} placeholder="Search title, subject or topic" label="Search worksheets" />
          <Form.Select aria-label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">All grades</option>
            {CLASS_GRADES.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </Form.Select>
        </div>
      </section>

      {error && !data ? (
        <EmptyState icon={LuFileText} title="Couldn’t load worksheets" action={<Button onClick={reload}>Try again</Button>}>
          {error}
        </EmptyState>
      ) : loading && !data ? (
        <div className="el-chart-placeholder" />
      ) : worksheets.length === 0 ? (
        <section className="el-panel">
          <EmptyState
            icon={LuFileText}
            title={filtering ? 'No worksheets match' : 'No worksheets yet'}
            action={!filtering && <Button as={Link} to="/teacher/worksheets/new">Make the first one</Button>}
          >
            {filtering ? 'Try a different search or filter.' : 'Worksheets you and your colleagues save appear here, ready to print.'}
          </EmptyState>
        </section>
      ) : (
        <div className="el-worksheet-cards">
          {worksheets.map((w) => (
            <Link key={w.worksheet_id} to={`/teacher/worksheets/${w.worksheet_id}`} className="el-worksheet-card">
              <span className="el-cell-secondary">
                {[w.subject_name, gradeLabel(w.grade_level), w.language !== 'English' && w.language].filter(Boolean).join(' · ')}
              </span>
              <span className="el-cell-primary fs-6">{w.worksheet_title}</span>
              {w.topic_name && <span className="el-cell-secondary">{w.topic_name}</span>}
              <span className="el-cell-secondary mt-auto">
                {w.question_count} questions · {w.teacher_first_name} {w.teacher_last_name} · {formatDate(w.created_at)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
};

export default Worksheets;
