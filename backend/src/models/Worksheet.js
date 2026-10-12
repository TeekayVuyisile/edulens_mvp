import pool from '../config/database.js';

// Worksheet requests (each AI generation, kept for history and cost tracking)
// and the school's worksheet library.

const LIBRARY_COLUMNS = `
  w.worksheet_id, w.request_id, w.teacher_id, w.school_id, w.worksheet_title, w.curriculum_name,
  w.subject_name, w.topic_name, w.grade_level, w.difficulty, w.language, w.created_at, w.updated_at,
  u.first_name AS teacher_first_name, u.last_name AS teacher_last_name,
  COALESCE(jsonb_array_length(w.content -> 'questions'), 0) AS question_count`;

class Worksheet {
  /** Generations by a teacher in the last `hours` (for the daily limit). */
  static async countRecent(teacherId, hours = 24) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM worksheet_requests
       WHERE teacher_id = $1 AND created_at > NOW() - make_interval(hours => $2)`,
      [teacherId, hours]
    );
    return rows[0].n;
  }

  static async createRequest(data) {
    const { rows } = await pool.query(
      `INSERT INTO worksheet_requests (teacher_id, school_id, curriculum_id, subject_id, topic_id, grade_level,
         difficulty, number_of_questions, worksheet_type, language, question_types, learning_objectives,
         specific_instructions, ai_prompt, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'practice', $9, $10, $11, $12, $13, 'generating')
       RETURNING request_id`,
      [
        data.teacherId, data.schoolId, data.curriculumId, data.subjectId, data.topicId ?? null, data.gradeLevel,
        data.difficulty, data.numberOfQuestions, data.language, data.questionTypes, data.objectives ?? null,
        data.instructions ?? null, data.prompt,
      ]
    );
    return rows[0].request_id;
  }

  static async completeRequest(requestId, { worksheet, model, usage }) {
    await pool.query(
      `UPDATE worksheet_requests
       SET generated_content = $2, status = 'completed', generated_at = CURRENT_TIMESTAMP,
           model = $3, prompt_tokens = $4, completion_tokens = $5
       WHERE request_id = $1`,
      [requestId, JSON.stringify(worksheet), model, usage.prompt_tokens, usage.completion_tokens]
    );
  }

  static async failRequest(requestId, message) {
    await pool.query(
      "UPDATE worksheet_requests SET status = 'failed', error_message = $2 WHERE request_id = $1",
      [requestId, message.slice(0, 2000)]
    );
  }

  /** A teacher's own request with the names it was made for. */
  static async findRequest(requestId, teacherId) {
    const { rows } = await pool.query(
      `SELECT r.request_id, r.status, r.error_message, r.grade_level, r.difficulty, r.number_of_questions,
              r.language, r.question_types, r.specific_instructions, r.generated_content AS content,
              r.subject_id, r.topic_id, r.created_at,
              cur.curriculum_name, s.subject_name, t.topic_name,
              (SELECT w.worksheet_id FROM worksheet_library w WHERE w.request_id = r.request_id LIMIT 1) AS saved_worksheet_id
       FROM worksheet_requests r
       LEFT JOIN curricula cur ON cur.curriculum_id = r.curriculum_id
       LEFT JOIN subjects s ON s.subject_id = r.subject_id
       LEFT JOIN topics t ON t.topic_id = r.topic_id
       WHERE r.request_id = $1 AND r.teacher_id = $2`,
      [requestId, teacherId]
    );
    return rows[0];
  }

  /** The teacher's recent generations, newest first. */
  static async recentRequests(teacherId, limit = 10) {
    const { rows } = await pool.query(
      `SELECT r.request_id, r.status, r.grade_level, r.created_at, r.generated_content ->> 'title' AS title,
              s.subject_name, t.topic_name,
              EXISTS (SELECT 1 FROM worksheet_library w WHERE w.request_id = r.request_id) AS saved
       FROM worksheet_requests r
       LEFT JOIN subjects s ON s.subject_id = r.subject_id
       LEFT JOIN topics t ON t.topic_id = r.topic_id
       WHERE r.teacher_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2`,
      [teacherId, limit]
    );
    return rows;
  }

  static async save({ request, teacherId, schoolId, worksheet }) {
    const { rows } = await pool.query(
      `INSERT INTO worksheet_library (request_id, teacher_id, school_id, worksheet_title, curriculum_name,
         subject_name, topic_name, grade_level, difficulty, language, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING worksheet_id`,
      [
        request.request_id, teacherId, schoolId, worksheet.title, request.curriculum_name, request.subject_name,
        request.topic_name, request.grade_level, request.difficulty, request.language, JSON.stringify(worksheet),
      ]
    );
    return rows[0].worksheet_id;
  }

  /** The school's library. owner: a teacher id to show only theirs. */
  static async library(schoolId, { owner, search, grade, subject } = {}) {
    const values = [schoolId];
    const conditions = ['w.school_id = $1'];
    const add = (sql, value) => {
      values.push(value);
      conditions.push(sql.replaceAll('?', `$${values.length}`));
    };
    if (owner) add('w.teacher_id = ?', owner);
    if (grade) add('w.grade_level = ?', grade);
    if (subject) add('w.subject_name = ?', subject);
    if (search) add('(w.worksheet_title ILIKE ? OR w.topic_name ILIKE ? OR w.subject_name ILIKE ?)', `%${search}%`);

    const { rows } = await pool.query(
      `SELECT ${LIBRARY_COLUMNS}
       FROM worksheet_library w
       LEFT JOIN users u ON u.user_id = w.teacher_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY w.created_at DESC
       LIMIT 200`,
      values
    );
    return rows;
  }

  static async findInSchool(worksheetId, schoolId) {
    const { rows } = await pool.query(
      `SELECT ${LIBRARY_COLUMNS}, w.content
       FROM worksheet_library w
       LEFT JOIN users u ON u.user_id = w.teacher_id
       WHERE w.worksheet_id = $1 AND w.school_id = $2`,
      [worksheetId, schoolId]
    );
    return rows[0];
  }

  static async update(worksheetId, worksheet) {
    await pool.query(
      `UPDATE worksheet_library SET worksheet_title = $2, content = $3, updated_at = CURRENT_TIMESTAMP
       WHERE worksheet_id = $1`,
      [worksheetId, worksheet.title, JSON.stringify(worksheet)]
    );
  }

  static async delete(worksheetId) {
    await pool.query('DELETE FROM worksheet_library WHERE worksheet_id = $1', [worksheetId]);
  }
}

export default Worksheet;
