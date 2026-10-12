import { useId, useRef, useState } from 'react';
import { Button, Modal, Spinner, Table } from 'react-bootstrap';
import { AnimatePresence, motion } from 'framer-motion';
import { LuCircleCheck, LuDownload, LuFileSpreadsheet, LuTriangleAlert, LuUpload } from 'react-icons/lu';
import { useMutation } from '../../hooks/useMutation';
import { formatDate, plural } from '../../lib/format';
import { pageTransition } from '../../lib/motion';
import FormAlert from '../ui/FormAlert';
import FilterTabs from '../ui/FilterTabs';

const TEMPLATE = [
  'first_name,last_name,date_of_birth,gender,admission_number,class,guardian_name,guardian_phone,guardian_email',
  'Amahle,Dlamini,2019-03-14,Female,2026-001,Grade 1A,Zanele Dlamini,082 123 4567,zanele@example.com',
].join('\r\n');

const downloadTemplate = () => {
  const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: 'edulens-learners-template.csv' });
  link.click();
  URL.revokeObjectURL(url);
};

const ACCEPT = '.csv,.xlsx,.xls';

/**
 * Imports learners from a spreadsheet in three steps: choose a file, review
 * every row (problems are explained per row), then import the good rows.
 */
const ImportLearnersModal = ({ url = '/api/school-admin/learners/import', className, onClose, onImported }) => {
  const titleId = useId();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // dry-run result
  const [done, setDone] = useState(null); // { summary, message }
  const [show, setShow] = useState('problems');
  const [dragging, setDragging] = useState(false);
  const request = useMutation();

  const step = done ? 'done' : preview ? 'review' : 'choose';

  const send = (chosen, dryRun) => {
    const body = new FormData();
    body.append('dry_run', String(dryRun));
    body.append('file', chosen);
    return request.run('post', url, body);
  };

  const check = async (chosen) => {
    if (!chosen) return;
    setFile(chosen);
    const result = await send(chosen, true);
    if (result.ok) {
      setPreview(result.data);
      setShow(result.data.summary.withErrors > 0 ? 'problems' : 'ready');
    }
  };

  const runImport = async () => {
    const result = await send(file, false);
    if (result.ok) setDone({ summary: result.data.summary, message: result.message });
  };

  const startOver = () => {
    setFile(null);
    setPreview(null);
    request.reset();
    if (inputRef.current) inputRef.current.value = '';
  };

  const finish = () => (done ? onImported(done.message) : onClose());

  const rows = preview?.rows.filter((row) => (show === 'problems' ? row.errors.length > 0 : row.errors.length === 0)) ?? [];

  return (
    <Modal aria-labelledby={titleId} show onHide={finish} centered size="lg" backdrop={request.pending ? 'static' : true}>
      <Modal.Header closeButton>
        <Modal.Title id={titleId} as="h2" className="h5 mb-0">
          {className ? `Import learners into ${className}` : 'Import learners'}
        </Modal.Title>
      </Modal.Header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} {...pageTransition}>
          {step === 'choose' && (
            <Modal.Body>
              <p className="text-body-secondary">
                Upload your class register as a CSV or Excel file. You’ll see every row before anything is saved.
              </p>
              <FormAlert variant="danger">{request.error}</FormAlert>
              <label
                className={`el-dropzone ${dragging ? 'is-dragging' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  check(e.dataTransfer.files[0]);
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  className="visually-hidden"
                  onChange={(e) => check(e.target.files[0])}
                  disabled={request.pending}
                />
                <span className="el-dropzone__icon" aria-hidden="true">
                  {request.pending ? <Spinner size="sm" /> : <LuUpload size={22} />}
                </span>
                <span className="el-cell-primary">
                  {request.pending ? `Checking ${file?.name}…` : 'Choose a file or drag it here'}
                </span>
                <span className="el-cell-secondary">CSV or Excel (.xlsx), up to 1,000 learners</span>
              </label>

              <div className="el-import-help">
                <div>
                  <h3 className="el-import-help__title">What the file needs</h3>
                  <ul className="el-import-help__list">
                    <li>
                      <strong>First name, last name and date of birth</strong> for every learner.
                    </li>
                    <li>Dates as 2019-03-14 or 14/03/2019.</li>
                    {className ? (
                      <li>Optional: gender, admission number and guardian details. Everyone joins {className}.</li>
                    ) : (
                      <li>
                        Optional: gender, admission number, guardian details, and a <strong>class</strong> that matches
                        one of your class names exactly.
                      </li>
                    )}
                  </ul>
                </div>
                <Button variant="light" size="sm" onClick={downloadTemplate} className="d-inline-flex align-items-center gap-2">
                  <LuDownload aria-hidden="true" /> Download template
                </Button>
              </div>
            </Modal.Body>
          )}

          {step === 'review' && (
            <Modal.Body className="p-0">
              <div className="el-import-summary">
                <span className="el-import-summary__file">
                  <LuFileSpreadsheet aria-hidden="true" /> {file?.name}
                </span>
                <span className="el-import-summary__counts">
                  <span className="el-tone--success el-import-pill">
                    <LuCircleCheck aria-hidden="true" /> {plural(preview.summary.ready, 'learner')} ready
                  </span>
                  {preview.summary.withErrors > 0 && (
                    <span className="el-tone--warning el-import-pill">
                      <LuTriangleAlert aria-hidden="true" /> {plural(preview.summary.withErrors, 'row')} to fix
                    </span>
                  )}
                </span>
              </div>
              <div className="px-3 px-sm-4 pt-3">
                <FormAlert variant="danger">{request.error}</FormAlert>
                {preview.unknownColumns.length > 0 && (
                  <p className="el-cell-secondary">
                    Ignored columns: {preview.unknownColumns.join(', ')}.
                  </p>
                )}
                <FilterTabs
                  label="Rows to show"
                  value={show}
                  onChange={setShow}
                  options={[
                    { value: 'problems', label: 'Need fixing', count: preview.summary.withErrors },
                    { value: 'ready', label: 'Ready', count: preview.summary.ready },
                  ]}
                />
              </div>
              <div className="el-import-table">
                {rows.length === 0 ? (
                  <p className="text-center text-body-secondary py-4 mb-0">
                    {show === 'problems' ? 'No problems found.' : 'No rows are ready yet.'}
                  </p>
                ) : (
                  <Table className="el-table mb-0" size="sm">
                    <thead>
                      <tr>
                        <th scope="col">Row</th>
                        <th scope="col">Learner</th>
                        <th scope="col">{show === 'problems' ? 'What to fix' : 'Class'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.line}>
                          <td className="tabular-nums text-body-secondary">{row.line}</td>
                          <td>
                            <div className="el-cell-primary">
                              {`${row.data.first_name} ${row.data.last_name}`.trim() || '(no name)'}
                            </div>
                            {row.data.date_of_birth && (
                              <div className="el-cell-secondary">Born {formatDate(row.data.date_of_birth)}</div>
                            )}
                          </td>
                          <td>
                            {show === 'problems' ? (
                              <ul className="el-import-errors">
                                {row.errors.map((e) => (
                                  <li key={e.field + e.message}>{e.message}</li>
                                ))}
                              </ul>
                            ) : (
                              row.class_name ?? <span className="el-cell-secondary">Place later</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
              {preview.summary.withErrors > 0 && (
                <p className="el-cell-secondary px-3 px-sm-4 py-3 mb-0 border-top">
                  Rows that need fixing are skipped. Correct them in your spreadsheet and import that file again;
                  learners who were already imported are recognised and won’t be added twice.
                </p>
              )}
            </Modal.Body>
          )}

          {step === 'done' && (
            <Modal.Body>
              <div className="el-empty el-empty--compact">
                <span className="el-empty__icon el-tone--success" aria-hidden="true">
                  <LuCircleCheck size={24} />
                </span>
                <p className="el-empty__title">{plural(done.summary.imported, 'learner')} imported</p>
                <p className="el-empty__body">
                  {done.summary.withErrors > 0
                    ? `${plural(done.summary.withErrors, 'row was', 'rows were')} skipped. Fix them and import the file again.`
                    : 'Everyone in the file is now on the register.'}
                </p>
              </div>
            </Modal.Body>
          )}
        </motion.div>
      </AnimatePresence>

      <Modal.Footer>
        {step === 'choose' && (
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
        )}
        {step === 'review' && (
          <>
            <Button variant="light" onClick={startOver} disabled={request.pending}>
              Choose another file
            </Button>
            <Button onClick={runImport} disabled={request.pending || preview.summary.ready === 0}>
              {request.pending && <Spinner size="sm" className="me-2" aria-hidden="true" />}
              Import {plural(preview.summary.ready, 'learner')}
            </Button>
          </>
        )}
        {step === 'done' && <Button onClick={finish}>Done</Button>}
      </Modal.Footer>
    </Modal>
  );
};

export default ImportLearnersModal;
