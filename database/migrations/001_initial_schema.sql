-- ============================================
-- Edulens LMS Database Schema
-- Version: 1.0
-- Date: October 26, 2023
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ENUM Types
-- ============================================

CREATE TYPE user_role AS ENUM ('super_admin', 'school_admin', 'teacher', 'learner');
CREATE TYPE term_number AS ENUM ('1', '2', '3', '4');
CREATE TYPE academic_status AS ENUM ('active', 'graduated', 'repeated', 'archived', 'inactive');
CREATE TYPE assessment_type AS ENUM ('test', 'quiz', 'project', 'worksheet', 'assignment');
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard', 'mixed');

-- ============================================
-- 2. Core Tables
-- ============================================

-- Schools table
CREATE TABLE schools (
    school_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_name VARCHAR(255) NOT NULL,
    school_code VARCHAR(50) UNIQUE NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    province VARCHAR(100),
    country VARCHAR(100) DEFAULT 'South Africa',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table (all roles)
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    phone VARCHAR(50),
    profile_image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_school_user FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE SET NULL
);

-- Indexes for users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_school_id ON users(school_id);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- 3. Academic Structure
-- ============================================

-- Curricula
CREATE TABLE curricula (
    curriculum_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    curriculum_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subjects
CREATE TABLE subjects (
    subject_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    curriculum_id UUID REFERENCES curricula(curriculum_id) ON DELETE CASCADE,
    subject_name VARCHAR(255) NOT NULL,
    subject_code VARCHAR(50),
    description TEXT,
    grade_level VARCHAR(10), -- 'R', '1', '2', '3' or 'R-3'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(curriculum_id, subject_name, grade_level)
);

-- Topics
CREATE TABLE topics (
    topic_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES subjects(subject_id) ON DELETE CASCADE,
    topic_name VARCHAR(255) NOT NULL,
    topic_code VARCHAR(50),
    description TEXT,
    learning_objectives TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subject_id, topic_name)
);

-- ============================================
-- 4. School-Specific Academic Setup
-- ============================================

-- School curriculum assignments
CREATE TABLE school_curriculum_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
    curriculum_id UUID REFERENCES curricula(curriculum_id) ON DELETE CASCADE,
    grade_level VARCHAR(10) NOT NULL,
    academic_year INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    assigned_by UUID REFERENCES users(user_id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, curriculum_id, grade_level, academic_year)
);

-- Classes/Grades
CREATE TABLE classes (
    class_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
    class_name VARCHAR(100) NOT NULL,
    grade_level VARCHAR(10) NOT NULL, -- 'R', '1', '2', '3'
    academic_year INTEGER NOT NULL,
    term_number term_number DEFAULT '1',
    primary_teacher_id UUID REFERENCES users(user_id),
    max_capacity INTEGER DEFAULT 30,
    current_enrollment INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, class_name, academic_year)
);

-- Class teacher assignments (for multiple teachers per class)
CREATE TABLE class_teacher_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(class_id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(user_id),
    UNIQUE(class_id, teacher_id)
);

-- Learners
CREATE TABLE learners (
    learner_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
    current_class_id UUID REFERENCES classes(class_id) ON DELETE SET NULL,
    date_of_birth DATE,
    gender VARCHAR(20),
    enrollment_date DATE DEFAULT CURRENT_DATE,
    academic_status academic_status DEFAULT 'active',
    previous_class_id UUID REFERENCES classes(class_id),
    has_special_needs BOOLEAN DEFAULT false,
    special_needs_notes TEXT,
    medical_notes TEXT,
    guardian_name VARCHAR(255),
    guardian_email VARCHAR(255),
    guardian_phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Learner class history
CREATE TABLE learner_class_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    learner_id UUID REFERENCES learners(learner_id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(class_id) ON DELETE CASCADE,
    academic_year INTEGER NOT NULL,
    term_number term_number,
    status academic_status DEFAULT 'active',
    enrolled_date DATE DEFAULT CURRENT_DATE,
    completed_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. Assessment & Grading
-- ============================================

-- Assessments
CREATE TABLE assessments (
    assessment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(class_id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(user_id),
    curriculum_id UUID REFERENCES curricula(curriculum_id),
    subject_id UUID REFERENCES subjects(subject_id),
    topic_id UUID REFERENCES topics(topic_id),
    assessment_name VARCHAR(255) NOT NULL,
    assessment_type assessment_type NOT NULL,
    description TEXT,
    total_marks DECIMAL(5,2) NOT NULL,
    passing_marks DECIMAL(5,2),
    term_number term_number NOT NULL,
    due_date DATE,
    scheduled_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assessment resources
CREATE TABLE assessment_resources (
    resource_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID REFERENCES assessments(assessment_id) ON DELETE CASCADE,
    resource_name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(50), -- 'pdf', 'image', 'link', 'document'
    resource_url TEXT NOT NULL,
    uploaded_by UUID REFERENCES users(user_id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grades/Results
CREATE TABLE grades (
    grade_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID REFERENCES assessments(assessment_id) ON DELETE CASCADE,
    learner_id UUID REFERENCES learners(learner_id) ON DELETE CASCADE,
    marks_obtained DECIMAL(5,2),
    percentage DECIMAL(5,2),
    grade_letter VARCHAR(5),
    teacher_feedback TEXT,
    is_graded BOOLEAN DEFAULT false,
    graded_by UUID REFERENCES users(user_id),
    graded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assessment_id, learner_id)
);

-- ============================================
-- 6. AI Worksheet System
-- ============================================

-- Worksheet generation requests
CREATE TABLE worksheet_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
    curriculum_id UUID REFERENCES curricula(curriculum_id),
    subject_id UUID REFERENCES subjects(subject_id),
    topic_id UUID REFERENCES topics(topic_id),
    grade_level VARCHAR(10) NOT NULL,
    difficulty difficulty_level NOT NULL,
    number_of_questions INTEGER NOT NULL CHECK (number_of_questions > 0),
    worksheet_type VARCHAR(50), -- 'practice', 'test', 'homework'
    learning_objectives TEXT,
    specific_instructions TEXT,
    ai_prompt TEXT NOT NULL,
    generated_content JSONB, -- Stores the AI response
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'generating', 'completed', 'failed'
    error_message TEXT,
    generated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Worksheet library (saved worksheets)
CREATE TABLE worksheet_library (
    worksheet_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES worksheet_requests(request_id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
    worksheet_title VARCHAR(255) NOT NULL,
    curriculum_name VARCHAR(255),
    subject_name VARCHAR(255),
    topic_name VARCHAR(255),
    grade_level VARCHAR(10),
    difficulty difficulty_level,
    content_html TEXT NOT NULL, -- HTML content for display
    content_pdf_url TEXT, -- URL to generated PDF
    download_count INTEGER DEFAULT 0,
    is_shared BOOLEAN DEFAULT false,
    shared_with_class_id UUID REFERENCES classes(class_id),
    tags TEXT[], -- Array of tags for searching
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. Analytics & Reporting
-- ============================================

-- Progress tracking
CREATE TABLE learner_progress (
    progress_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    learner_id UUID REFERENCES learners(learner_id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(class_id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(subject_id),
    topic_id UUID REFERENCES topics(topic_id),
    term_number term_number,
    academic_year INTEGER,
    overall_percentage DECIMAL(5,2),
    topic_mastery_percentage DECIMAL(5,2),
    assessments_completed INTEGER DEFAULT 0,
    assessments_total INTEGER DEFAULT 0,
    last_assessment_date DATE,
    teacher_notes TEXT,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(learner_id, class_id, subject_id, topic_id, term_number, academic_year)
);

-- ============================================
-- 8. System Logs & Audit
-- ============================================

-- Activity logs
CREATE TABLE activity_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    school_id UUID REFERENCES schools(school_id),
    action_type VARCHAR(100) NOT NULL,
    action_details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bulk import logs
CREATE TABLE bulk_import_logs (
    import_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
    imported_by UUID REFERENCES users(user_id),
    import_type VARCHAR(50) NOT NULL, -- 'learners', 'teachers', 'assessments'
    file_name VARCHAR(255),
    total_records INTEGER,
    successful_records INTEGER,
    failed_records INTEGER,
    error_details JSONB,
    import_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- ============================================
-- 9. Views for Common Queries
-- ============================================

-- View for teacher dashboard
CREATE VIEW teacher_dashboard_view AS
SELECT 
    u.user_id as teacher_id,
    u.first_name || ' ' || u.last_name as teacher_name,
    c.class_id,
    c.class_name,
    c.grade_level,
    c.academic_year,
    COUNT(DISTINCT l.learner_id) as total_learners,
    COUNT(DISTINCT a.assessment_id) as total_assessments,
    AVG(g.percentage) as class_average_percentage
FROM users u
LEFT JOIN class_teacher_assignments cta ON u.user_id = cta.teacher_id
LEFT JOIN classes c ON cta.class_id = c.class_id
LEFT JOIN learners l ON c.class_id = l.current_class_id
LEFT JOIN assessments a ON c.class_id = a.class_id AND a.teacher_id = u.user_id
LEFT JOIN grades g ON a.assessment_id = g.assessment_id
WHERE u.role = 'teacher' AND c.is_active = true
GROUP BY u.user_id, c.class_id, c.class_name, c.grade_level, c.academic_year;

-- View for learner performance
CREATE VIEW learner_performance_view AS
SELECT
    l.learner_id,
    u.first_name || ' ' || u.last_name as learner_name,
    c.class_id,
    c.class_name,
    c.grade_level,
    s.subject_name,
    t.topic_name,
    g.percentage,
    g.grade_letter,
    a.assessment_name,
    a.assessment_type,
    a.term_number,
    a.scheduled_date
FROM learners l
JOIN users u ON l.user_id = u.user_id
JOIN classes c ON l.current_class_id = c.class_id
JOIN grades g ON l.learner_id = g.learner_id
JOIN assessments a ON g.assessment_id = a.assessment_id
LEFT JOIN subjects s ON a.subject_id = s.subject_id
LEFT JOIN topics t ON a.topic_id = t.topic_id
WHERE l.academic_status = 'active';

-- ============================================
-- 10. Functions & Triggers
-- ============================================

-- Function to update class enrollment count
CREATE OR REPLACE FUNCTION update_class_enrollment()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE classes 
        SET current_enrollment = current_enrollment + 1
        WHERE class_id = NEW.current_class_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.current_class_id IS DISTINCT FROM NEW.current_class_id THEN
            -- Decrease count for old class
            UPDATE classes 
            SET current_enrollment = current_enrollment - 1
            WHERE class_id = OLD.current_class_id;
            
            -- Increase count for new class
            UPDATE classes 
            SET current_enrollment = current_enrollment + 1
            WHERE class_id = NEW.current_class_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE classes 
        SET current_enrollment = current_enrollment - 1
        WHERE class_id = OLD.current_class_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for class enrollment updates
CREATE TRIGGER trg_update_class_enrollment
AFTER INSERT OR UPDATE OR DELETE ON learners
FOR EACH ROW
EXECUTE FUNCTION update_class_enrollment();

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trg_update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_classes_updated_at
BEFORE UPDATE ON classes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_learners_updated_at
BEFORE UPDATE ON learners
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_assessments_updated_at
BEFORE UPDATE ON assessments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_grades_updated_at
BEFORE UPDATE ON grades
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_worksheet_library_updated_at
BEFORE UPDATE ON worksheet_library
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 11. Sample Data (Optional - for testing)
-- ============================================

-- Insert sample curriculum
INSERT INTO curricula (curriculum_name, description) VALUES
('CAPS', 'South African Curriculum and Assessment Policy Statement'),
('Cambridge', 'Cambridge International Curriculum');

-- Insert CAPS subjects for Grade R-3
WITH caps AS (SELECT curriculum_id FROM curricula WHERE curriculum_name = 'CAPS')
INSERT INTO subjects (curriculum_id, subject_name, subject_code, grade_level) VALUES
((SELECT curriculum_id FROM caps), 'Mathematics', 'CAPS-MATH', 'R-3'),
((SELECT curriculum_id FROM caps), 'English Home Language', 'CAPS-ENG-HL', 'R-3'),
((SELECT curriculum_id FROM caps), 'Life Skills', 'CAPS-LIFE', 'R-3'),
((SELECT curriculum_id FROM caps), 'First Additional Language', 'CAPS-FAL', 'R-3');

-- Insert sample topics for English Home Language
WITH eng_subject AS (
    SELECT subject_id FROM subjects 
    WHERE subject_name = 'English Home Language' 
    AND curriculum_id = (SELECT curriculum_id FROM curricula WHERE curriculum_name = 'CAPS')
)
INSERT INTO topics (subject_id, topic_name, description) VALUES
((SELECT subject_id FROM eng_subject), 'Phonemic Awareness', 'Ability to hear, identify, and manipulate individual sounds in spoken words'),
((SELECT subject_id FROM eng_subject), 'Reading Comprehension', 'Understanding and interpreting written text'),
((SELECT subject_id FROM eng_subject), 'Vocabulary Development', 'Learning and using new words'),
((SELECT subject_id FROM eng_subject), 'Writing Skills', 'Developing handwriting and composition skills');

-- ============================================
-- 12. Indexes for Performance
-- ============================================

-- Performance indexes
CREATE INDEX idx_grades_assessment_learner ON grades(assessment_id, learner_id);
CREATE INDEX idx_grades_learner ON grades(learner_id);
CREATE INDEX idx_assessments_class_teacher ON assessments(class_id, teacher_id);
CREATE INDEX idx_learners_class_school ON learners(current_class_id, school_id);
CREATE INDEX idx_worksheet_requests_teacher ON worksheet_requests(teacher_id);
CREATE INDEX idx_worksheet_library_teacher ON worksheet_library(teacher_id);
CREATE INDEX idx_activity_logs_user_date ON activity_logs(user_id, created_at DESC);
CREATE INDEX idx_users_school_role ON users(school_id, role);
CREATE INDEX idx_classes_school_year ON classes(school_id, academic_year, grade_level);

-- ============================================
-- Database Comments
-- ============================================

COMMENT ON TABLE schools IS 'Stores information about schools using the LMS';
COMMENT ON TABLE users IS 'Contains all user accounts with authentication details';
COMMENT ON TABLE curricula IS 'Available curricula like CAPS, Cambridge';
COMMENT ON TABLE subjects IS 'Subjects under each curriculum';
COMMENT ON TABLE topics IS 'Topics within subjects for assessment alignment';
COMMENT ON TABLE classes IS 'Classes/grade levels within schools';
COMMENT ON TABLE learners IS 'Learner profiles and academic information';
COMMENT ON TABLE assessments IS 'Assessments created by teachers';
COMMENT ON TABLE grades IS 'Assessment results and feedback';
COMMENT ON TABLE worksheet_requests IS 'AI worksheet generation requests and history';
COMMENT ON TABLE worksheet_library IS 'Saved worksheets for reuse';

-- ============================================
-- END OF DATABASE SCRIPT
-- ============================================