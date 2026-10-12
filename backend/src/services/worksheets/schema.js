// The shape of a worksheet. The AI is asked for exactly this JSON (OpenAI
// structured outputs), and every worksheet — generated or edited by a teacher —
// is checked against it before it is stored. The frontend renders it as React
// elements, so no AI-written HTML ever reaches the page.

export const QUESTION_TYPES = ['multiple_choice', 'fill_in_blank', 'short_answer', 'true_false', 'matching'];

export const LANGUAGES = ['English', 'Afrikaans', 'isiZulu', 'isiXhosa', 'Sepedi', 'Setswana', 'Sesotho'];

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'];

export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 20;

/** JSON Schema sent to the model (strict mode: every property required, no extras). */
export const WORKSHEET_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'instructions', 'questions', 'teacher_notes'],
  properties: {
    title: { type: 'string', description: 'Short, friendly worksheet title' },
    instructions: { type: 'string', description: 'One or two simple sentences addressed to the learner' },
    teacher_notes: { type: 'string', description: 'A short note for the teacher: what the worksheet practises and how to use it' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'prompt', 'options', 'pairs', 'answer', 'marks'],
        properties: {
          type: { type: 'string', enum: QUESTION_TYPES },
          prompt: {
            type: 'string',
            description: 'The question. For fill_in_blank, mark each blank with ___ (three underscores).',
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'multiple_choice: 3 or 4 options. true_false: ["True", "False"]. Otherwise empty.',
          },
          pairs: {
            type: 'array',
            description: 'matching: 3 to 5 pairs, listed in the correct order (they are shuffled for the learner). Otherwise empty.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['left', 'right'],
              properties: { left: { type: 'string' }, right: { type: 'string' } },
            },
          },
          answer: { type: 'string', description: 'The correct answer, for the answer key' },
          marks: { type: 'integer', description: 'Marks for this question, usually 1' },
        },
      },
    },
  },
};

const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

/**
 * Checks (and tidies) a worksheet. Returns { worksheet } or { errors: [message] }.
 * Used for model output and for teachers' edits alike.
 */
export const validateWorksheet = (input) => {
  const errors = [];
  if (!input || typeof input !== 'object') return { errors: ['The worksheet is empty'] };
  if (!text(input.title, 200)) errors.push('Give the worksheet a title (up to 200 characters)');
  if (typeof input.instructions !== 'string' || input.instructions.length > 1000) errors.push('Instructions are too long');
  if (typeof input.teacher_notes !== 'string' || input.teacher_notes.length > 2000) errors.push('Teacher notes are too long');
  if (!Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > MAX_QUESTIONS) {
    errors.push(`A worksheet needs between 1 and ${MAX_QUESTIONS} questions`);
    return { errors };
  }

  const questions = input.questions.map((q, i) => {
    const n = i + 1;
    if (!q || typeof q !== 'object') {
      errors.push(`Question ${n} is empty`);
      return null;
    }
    if (!QUESTION_TYPES.includes(q.type)) errors.push(`Question ${n} has an unknown type`);
    if (!text(q.prompt, 500)) errors.push(`Question ${n} needs a question (up to 500 characters)`);
    if (!text(q.answer, 300)) errors.push(`Question ${n} needs an answer for the answer key`);
    const options = Array.isArray(q.options) ? q.options.filter((o) => text(o, 200)).map((o) => o.trim()) : [];
    const pairs = Array.isArray(q.pairs)
      ? q.pairs.filter((p) => p && text(p.left, 200) && text(p.right, 200)).map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
      : [];
    if (q.type === 'multiple_choice') {
      if (options.length < 2 || options.length > 6) errors.push(`Question ${n} needs 2 to 6 options`);
      else if (!options.some((o) => o.toLowerCase() === String(q.answer).trim().toLowerCase())) {
        errors.push(`Question ${n}: the answer must be one of the options`);
      }
    }
    if (q.type === 'matching' && (pairs.length < 2 || pairs.length > 8)) errors.push(`Question ${n} needs 2 to 8 pairs to match`);
    if (q.type === 'fill_in_blank' && !String(q.prompt).includes('___')) errors.push(`Question ${n}: mark the blank with ___`);
    const marks = Number.isInteger(q.marks) && q.marks >= 1 && q.marks <= 10 ? q.marks : 1;

    return {
      type: q.type,
      prompt: String(q.prompt ?? '').trim(),
      options: q.type === 'true_false' ? ['True', 'False'] : q.type === 'multiple_choice' ? options : [],
      pairs: q.type === 'matching' ? pairs : [],
      answer: String(q.answer ?? '').trim(),
      marks,
    };
  });

  if (errors.length > 0) return { errors };
  return {
    worksheet: {
      title: input.title.trim(),
      instructions: input.instructions.trim(),
      teacher_notes: input.teacher_notes.trim(),
      questions,
    },
  };
};

export const totalMarks = (worksheet) => worksheet.questions.reduce((n, q) => n + q.marks, 0);
