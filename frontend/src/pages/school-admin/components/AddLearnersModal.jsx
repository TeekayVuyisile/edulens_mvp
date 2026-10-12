import { useId, useState } from 'react';
import { Button, Form, Modal, Spinner } from 'react-bootstrap';
import { useApi, useDebouncedValue } from '../../../hooks/useApi';
import { useMutation } from '../../../hooks/useMutation';
import { ageFrom, plural } from '../../../lib/format';
import FormAlert from '../../../components/ui/FormAlert';
import SearchInput from '../../../components/ui/SearchInput';
import FilterTabs from '../../../components/ui/FilterTabs';

/**
 * Picks learners to place in a class: those without a class by default, or
 * learners from other classes (they move). Never offers more than the free places.
 */
const AddLearnersModal = ({ klass, onClose, onSaved }) => {
  const titleId = useId();
  const [source, setSource] = useState('unplaced');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const debouncedSearch = useDebouncedValue(search.trim());
  const save = useMutation();

  const { data, loading } = useApi('/api/school-admin/learners', {
    status: source === 'unplaced' ? 'unplaced' : 'current',
    search: debouncedSearch || undefined,
    limit: 100,
  });
  const learners = (data?.learners ?? []).filter((l) => l.current_class_id !== klass.class_id);
  const free = Math.max(0, klass.max_capacity - klass.learner_count);
  const remaining = free - selected.size;

  const toggle = (learnerId) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(learnerId)) next.delete(learnerId);
      else next.add(learnerId);
      return next;
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await save.run('post', `/api/school-admin/classes/${klass.class_id}/learners`, {
      learner_ids: [...selected],
    });
    if (result.ok) onSaved(result.message);
  };

  return (
    <Modal aria-labelledby={titleId} show onHide={onClose} centered size="lg" scrollable backdrop={save.pending ? 'static' : true}>
      <Form onSubmit={handleSubmit} className="d-flex flex-column overflow-hidden">
        <Modal.Header closeButton>
          <Modal.Title id={titleId} as="h2" className="h5 mb-0">
            Add learners to {klass.class_name}
          </Modal.Title>
        </Modal.Header>
        <div className="el-toolbar">
          <FilterTabs
            label="Which learners"
            value={source}
            onChange={(value) => {
              setSource(value);
              setSelected(new Set());
            }}
            options={[
              { value: 'unplaced', label: 'Not in a class' },
              { value: 'other', label: 'In other classes' },
            ]}
          />
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name" label="Search learners" />
        </div>
        <Modal.Body className="p-0">
          <div className="px-3 pt-3">
            <FormAlert variant="danger">{save.error}</FormAlert>
          </div>
          {loading && !data ? (
            <p className="text-center text-body-secondary py-4 mb-0">
              <Spinner size="sm" className="me-2" aria-hidden="true" />
              Loading learners…
            </p>
          ) : learners.length === 0 ? (
            <p className="text-center text-body-secondary py-4 mb-0">
              {debouncedSearch
                ? 'No learners match.'
                : source === 'unplaced'
                  ? 'Everyone at school is already in a class.'
                  : 'No learners in other classes.'}
            </p>
          ) : (
            <ul className="el-pick-list">
              {learners.map((learner) => {
                const checked = selected.has(learner.learner_id);
                return (
                  <li key={learner.learner_id}>
                    <Form.Check
                      id={`pick-${learner.learner_id}`}
                      checked={checked}
                      disabled={!checked && remaining <= 0}
                      onChange={() => toggle(learner.learner_id)}
                      label={
                        <span>
                          <span className="el-cell-primary">
                            {learner.last_name}, {learner.first_name}
                          </span>
                          <span className="el-cell-secondary d-block">
                            {[
                              learner.class_name ? `Now in ${learner.class_name}` : null,
                              ageFrom(learner.date_of_birth) !== null ? `${ageFrom(learner.date_of_birth)} years` : null,
                              learner.admission_number,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Modal.Body>
        <Modal.Footer className="justify-content-between">
          <span className="el-cell-secondary" aria-live="polite">
            {selected.size > 0 ? `${plural(selected.size, 'learner')} selected · ` : ''}
            {remaining > 0 ? `${plural(remaining, 'place')} left` : 'No places left'}
          </span>
          <span className="d-flex gap-2">
            <Button variant="light" onClick={onClose} disabled={save.pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.pending || selected.size === 0}>
              {save.pending && <Spinner size="sm" className="me-2" aria-hidden="true" />}
              Add {selected.size > 0 ? plural(selected.size, 'learner') : 'learners'}
            </Button>
          </span>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default AddLearnersModal;
