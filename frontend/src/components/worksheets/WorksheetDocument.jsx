import { Button, Form } from 'react-bootstrap';
import { LuTrash2 } from 'react-icons/lu';
import { gradeLabel } from '../../lib/format';
import { QUESTION_TYPE_LABELS } from './questionTypes';

// Renders a structured worksheet (never HTML from the AI) as a printable page,
// or as an editor when `onChange` is given.


const LETTERS = 'ABCDEFGH';

/** Right-hand column for matching, rotated so no pair lines up (stable, so prints match the answer key). */
const rotated = (pairs) => (pairs.length < 2 ? pairs : [...pairs.slice(1), pairs[0]]);

/** "10, 11, ___, 13" → text with a write-on line where each ___ is. */
const WithBlanks = ({ text }) =>
  text.split('___').flatMap((part, i, all) => (i < all.length - 1 ? [part, <span key={i} className="el-ws__blank" aria-label="blank" />] : [part]));

const QuestionView = ({ question }) => {
  switch (question.type) {
    case 'multiple_choice':
    case 'true_false':
      return (
        <ul className="el-ws__options">
          {question.options.map((option) => (
            <li key={option}>
              <span className="el-ws__bubble" aria-hidden="true" /> {option}
            </li>
          ))}
        </ul>
      );
    case 'matching':
      return (
        <div className="el-ws__matching">
          <ol>
            {question.pairs.map((p) => (
              <li key={p.left}>{p.left}</li>
            ))}
          </ol>
          <ol type="A">
            {rotated(question.pairs).map((p) => (
              <li key={p.right}>{p.right}</li>
            ))}
          </ol>
        </div>
      );
    case 'short_answer':
      return <div className="el-ws__lines" aria-hidden="true" />;
    default:
      return null;
  }
};

/** The answer key text for a question (matching: 1 – C, 2 – A…). */
const answerFor = (question) => {
  if (question.type !== 'matching') return question.answer;
  const right = rotated(question.pairs).map((p) => p.right);
  return question.pairs.map((p, i) => `${i + 1} – ${LETTERS[right.indexOf(p.right)]}`).join(', ');
};

const QuestionEditor = ({ question, index, onChange, onRemove }) => {
  const set = (changes) => onChange({ ...question, ...changes });
  const id = `q-${index}`;
  return (
    <div className="el-ws-edit">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="el-chip">
          {index + 1}. {QUESTION_TYPE_LABELS[question.type]}
        </span>
        <Button size="sm" variant="light" className="text-danger" onClick={onRemove} aria-label={`Remove question ${index + 1}`}>
          <LuTrash2 aria-hidden="true" />
        </Button>
      </div>
      <Form.Group controlId={`${id}-prompt`} className="mb-2">
        <Form.Label className="small">Question{question.type === 'fill_in_blank' && ' (mark the blank with ___)'}</Form.Label>
        <Form.Control as="textarea" rows={2} value={question.prompt} onChange={(e) => set({ prompt: e.target.value })} />
      </Form.Group>
      {question.type === 'multiple_choice' && (
        <Form.Group controlId={`${id}-options`} className="mb-2">
          <Form.Label className="small">Options (one per line)</Form.Label>
          <Form.Control
            as="textarea"
            rows={question.options.length || 3}
            value={question.options.join('\n')}
            onChange={(e) => set({ options: e.target.value.split('\n') })}
          />
        </Form.Group>
      )}
      {question.type === 'matching' && (
        <Form.Group controlId={`${id}-pairs`} className="mb-2">
          <Form.Label className="small">Pairs (one per line, as “left = right”)</Form.Label>
          <Form.Control
            as="textarea"
            rows={question.pairs.length || 3}
            value={question.pairs.map((p) => `${p.left} = ${p.right}`).join('\n')}
            onChange={(e) =>
              set({
                pairs: e.target.value.split('\n').map((line) => {
                  const [left = '', ...rest] = line.split('=');
                  return { left: left.trim(), right: rest.join('=').trim() };
                }),
              })
            }
          />
        </Form.Group>
      )}
      <Form.Group controlId={`${id}-answer`}>
        <Form.Label className="small">Answer</Form.Label>
        <Form.Control value={question.answer} onChange={(e) => set({ answer: e.target.value })} />
      </Form.Group>
    </div>
  );
};

/**
 * worksheet: { title, instructions, teacher_notes, questions[] }
 * meta: { subject_name, topic_name, grade_level } for the header.
 * showAnswers adds the answer key; onChange switches to editing.
 */
const WorksheetDocument = ({ worksheet, meta = {}, showAnswers = false, onChange }) => {
  if (onChange) {
    const update = (changes) => onChange({ ...worksheet, ...changes });
    return (
      <div className="el-ws el-ws--editing">
        <Form.Group controlId="ws-title" className="mb-3">
          <Form.Label>Title</Form.Label>
          <Form.Control value={worksheet.title} onChange={(e) => update({ title: e.target.value })} />
        </Form.Group>
        <Form.Group controlId="ws-instructions" className="mb-3">
          <Form.Label>Instructions for learners</Form.Label>
          <Form.Control as="textarea" rows={2} value={worksheet.instructions} onChange={(e) => update({ instructions: e.target.value })} />
        </Form.Group>
        {worksheet.questions.map((question, index) => (
          <QuestionEditor
            key={index}
            index={index}
            question={question}
            onChange={(q) => update({ questions: worksheet.questions.map((old, i) => (i === index ? q : old)) })}
            onRemove={() => update({ questions: worksheet.questions.filter((_, i) => i !== index) })}
          />
        ))}
      </div>
    );
  }

  const marks = worksheet.questions.reduce((n, q) => n + (q.marks ?? 1), 0);
  return (
    <article className="el-ws" aria-label={worksheet.title}>
      <header className="el-ws__header">
        <div className="el-ws__meta">
          {[meta.subject_name, meta.topic_name, meta.grade_level && gradeLabel(meta.grade_level)].filter(Boolean).join(' · ')}
        </div>
        <h2 className="el-ws__title">{worksheet.title}</h2>
        <div className="el-ws__fields">
          <span>
            Name: <span className="el-ws__field" />
          </span>
          <span>
            Date: <span className="el-ws__field el-ws__field--short" />
          </span>
          <span>
            Total: <span className="el-ws__field el-ws__field--tiny" /> / {marks}
          </span>
        </div>
        {worksheet.instructions && <p className="el-ws__instructions">{worksheet.instructions}</p>}
      </header>

      <ol className="el-ws__questions">
        {worksheet.questions.map((question, index) => (
          <li key={index} className="el-ws__question">
            <p className="el-ws__prompt">
              {question.type === 'fill_in_blank' ? <WithBlanks text={question.prompt} /> : question.prompt}
              <span className="el-ws__marks">({question.marks ?? 1})</span>
            </p>
            <QuestionView question={question} />
          </li>
        ))}
      </ol>

      {showAnswers && (
        <section className="el-ws__answers">
          <h3>Answer key</h3>
          <ol>
            {worksheet.questions.map((question, index) => (
              <li key={index}>{answerFor(question)}</li>
            ))}
          </ol>
          {worksheet.teacher_notes && (
            <p className="el-ws__notes">
              <strong>Notes for the teacher:</strong> {worksheet.teacher_notes}
            </p>
          )}
        </section>
      )}
    </article>
  );
};

export default WorksheetDocument;
