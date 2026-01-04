import pool from '../config/database.js';
import OpenAI from 'openai';

class Worksheet {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  // Generate worksheet using AI
  async generate(worksheetData) {
    const {
      teacher_id,
      school_id,
      curriculum_id,
      subject_id,
      topic_id,
      grade_level,
      difficulty,
      number_of_questions,
      worksheet_type,
      learning_objectives,
      specific_instructions
    } = worksheetData;

    // Get curriculum and topic details for context
    const contextQuery = `
      SELECT 
        c.curriculum_name,
        s.subject_name,
        t.topic_name,
        t.learning_objectives as default_objectives
      FROM curricula c
      LEFT JOIN subjects s ON c.curriculum_id = s.curriculum_id
      LEFT JOIN topics t ON s.subject_id = t.subject_id
      WHERE c.curriculum_id = $1 
        AND s.subject_id = $2
        AND t.topic_id = $3
    `;

    const contextResult = await pool.query(contextQuery, [
      curriculum_id,
      subject_id,
      topic_id
    ]);

    if (contextResult.rows.length === 0) {
      throw new Error('Curriculum, subject, or topic not found');
    }

    const { curriculum_name, subject_name, topic_name, default_objectives } = contextResult.rows[0];

    // Create AI prompt
    const prompt = this.createPrompt({
      curriculum_name,
      subject_name,
      topic_name,
      grade_level,
      difficulty,
      number_of_questions,
      worksheet_type,
      learning_objectives: learning_objectives || default_objectives,
      specific_instructions
    });

    try {
      // Create worksheet request record
      const requestQuery = `
        INSERT INTO worksheet_requests (
          teacher_id, school_id, curriculum_id, subject_id, topic_id,
          grade_level, difficulty, number_of_questions, worksheet_type,
          learning_objectives, specific_instructions, ai_prompt, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'generating')
        RETURNING *
      `;

      const requestResult = await pool.query(requestQuery, [
        teacher_id,
        school_id,
        curriculum_id,
        subject_id,
        topic_id,
        grade_level,
        difficulty,
        number_of_questions,
        worksheet_type,
        learning_objectives,
        specific_instructions,
        prompt
      ]);

      const requestId = requestResult.rows[0].request_id;

      try {
        // Call OpenAI API
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are an expert educational worksheet generator for primary school (Grade R-3). Create age-appropriate, engaging, and curriculum-aligned worksheets."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        });

        const generatedContent = completion.choices[0].message.content;

        // Parse and structure the content
        const structuredContent = this.parseGeneratedContent(generatedContent);

        // Update request with generated content
        const updateQuery = `
          UPDATE worksheet_requests 
          SET 
            generated_content = $1,
            status = 'completed',
            generated_at = CURRENT_TIMESTAMP
          WHERE request_id = $2
          RETURNING *
        `;

        await pool.query(updateQuery, [
          JSON.stringify(structuredContent),
          requestId
        ]);

        return {
          request_id: requestId,
          status: 'completed',
          content: structuredContent,
          raw_content: generatedContent
        };

      } catch (aiError) {
        // Update request with error
        await pool.query(
          `UPDATE worksheet_requests SET status = 'failed', error_message = $1 WHERE request_id = $2`,
          [aiError.message, requestId]
        );
        throw aiError;
      }

    } catch (error) {
      console.error('Error generating worksheet:', error);
      throw error;
    }
  }

  createPrompt(data) {
    return `
Create a worksheet for ${data.grade_level} students.

CURRICULUM: ${data.curriculum_name}
SUBJECT: ${data.subject_name}
TOPIC: ${data.topic_name}
DIFFICULTY: ${data.difficulty}
TYPE: ${data.worksheet_type || 'practice worksheet'}
NUMBER OF QUESTIONS: ${data.number_of_questions}

LEARNING OBJECTIVES:
${data.learning_objectives}

SPECIFIC INSTRUCTIONS:
${data.specific_instructions || 'Create age-appropriate, engaging questions that assess understanding of the topic.'}

FORMAT REQUIREMENTS:
1. Start with a title
2. Include clear instructions for students
3. Create ${data.number_of_questions} questions with varied types (multiple choice, fill in the blank, short answer, matching)
4. Include answer key
5. Make it visually appealing with appropriate spacing for young children
6. Use simple language appropriate for ${data.grade_level} students

Please generate the worksheet in HTML format suitable for printing, with clear sections and appropriate styling for primary school students.
    `;
  }

  parseGeneratedContent(content) {
    // Extract sections from the generated content
    const sections = {
      title: '',
      instructions: '',
      questions: [],
      answer_key: ''
    };

    // Simple parsing logic - in production, you'd want more robust parsing
    const lines = content.split('\n');
    let currentSection = '';

    for (const line of lines) {
      if (line.includes('TITLE:') || line.includes('Title:')) {
        sections.title = line.split(':')[1]?.trim() || '';
      } else if (line.includes('INSTRUCTIONS:') || line.includes('Instructions:')) {
        currentSection = 'instructions';
      } else if (line.includes('QUESTIONS:') || line.includes('Questions:')) {
        currentSection = 'questions';
      } else if (line.includes('ANSWER KEY:') || line.includes('Answer Key:')) {
        currentSection = 'answer_key';
      } else {
        if (currentSection === 'questions' && line.trim()) {
          sections.questions.push(line.trim());
        } else if (currentSection === 'answer_key') {
          sections.answer_key += line + '\n';
        } else if (currentSection === 'instructions') {
          sections.instructions += line + '\n';
        }
      }
    }

    return {
      ...sections,
      html_content: content // For now, use the raw HTML content
    };
  }

  // Save worksheet to library
  static async saveToLibrary(worksheetData) {
    const {
      request_id,
      teacher_id,
      school_id,
      worksheet_title,
      curriculum_name,
      subject_name,
      topic_name,
      grade_level,
      difficulty,
      content_html
    } = worksheetData;

    const query = `
      INSERT INTO worksheet_library (
        request_id, teacher_id, school_id, worksheet_title,
        curriculum_name, subject_name, topic_name, grade_level,
        difficulty, content_html
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [
        request_id,
        teacher_id,
        school_id,
        worksheet_title,
        curriculum_name,
        subject_name,
        topic_name,
        grade_level,
        difficulty,
        content_html
      ]);
      return result.rows[0];
    } catch (error) {
      console.error('Error saving worksheet to library:', error);
      throw error;
    }
  }

  // Get worksheet history for teacher
  static async getHistory(teacherId, filters = {}) {
    const conditions = ['teacher_id = $1'];
    const values = [teacherId];
    let paramCount = 2;

    if (filters.status) {
      conditions.push(`status = $${paramCount}`);
      values.push(filters.status);
      paramCount++;
    }

    if (filters.subject_id) {
      conditions.push(`subject_id = $${paramCount}`);
      values.push(filters.subject_id);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        wr.*,
        c.curriculum_name,
        s.subject_name,
        t.topic_name
      FROM worksheet_requests wr
      LEFT JOIN curricula c ON wr.curriculum_id = c.curriculum_id
      LEFT JOIN subjects s ON wr.subject_id = s.subject_id
      LEFT JOIN topics t ON wr.topic_id = t.topic_id
      ${whereClause}
      ORDER BY wr.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const offset = (filters.page - 1) * filters.limit || 0;
    const limit = filters.limit || 20;

    values.push(limit, offset);

    // Count query
    const countQuery = `
      SELECT COUNT(*) 
      FROM worksheet_requests 
      ${whereClause}
    `;

    try {
      const [historyResult, countResult] = await Promise.all([
        pool.query(query, values),
        pool.query(countQuery, [teacherId])
      ]);

      return {
        worksheets: historyResult.rows,
        total: parseInt(countResult.rows[0].count),
        page: filters.page || 1,
        limit
      };
    } catch (error) {
      console.error('Error getting worksheet history:', error);
      throw error;
    }
  }

  // Get saved worksheets
  static async getSavedWorksheets(teacherId, filters = {}) {
    const conditions = ['teacher_id = $1'];
    const values = [teacherId];
    let paramCount = 2;

    if (filters.shared) {
      conditions.push(`is_shared = $${paramCount}`);
      values.push(filters.shared);
      paramCount++;
    }

    if (filters.search) {
      conditions.push(`(worksheet_title ILIKE $${paramCount} OR tags @> ARRAY[$${paramCount}])`);
      values.push(`%${filters.search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT *
      FROM worksheet_library
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const offset = (filters.page - 1) * filters.limit || 0;
    const limit = filters.limit || 20;

    values.push(limit, offset);

    // Count query
    const countQuery = `
      SELECT COUNT(*) 
      FROM worksheet_library
      ${whereClause}
    `;

    try {
      const [worksheetsResult, countResult] = await Promise.all([
        pool.query(query, values),
        pool.query(countQuery, [teacherId])
      ]);

      return {
        worksheets: worksheetsResult.rows,
        total: parseInt(countResult.rows[0].count),
        page: filters.page || 1,
        limit
      };
    } catch (error) {
      console.error('Error getting saved worksheets:', error);
      throw error;
    }
  }

  // Share worksheet with class
  static async shareWithClass(worksheetId, classId) {
    const query = `
      UPDATE worksheet_library 
      SET 
        is_shared = true,
        shared_with_class_id = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE worksheet_id = $2
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [classId, worksheetId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error sharing worksheet:', error);
      throw error;
    }
  }
}

export default Worksheet;