📘 Edulens LMS
Learning Management System for Grade R – Grade 3

📌 Overview

Edulens LMS is a role-based Learning Management System designed specifically for primary schools focusing on Grade R to Grade 3 learners.

The system streamlines:

• Curriculum management
• Assessment creation and grading
• Learner performance tracking
• Academic progression
• AI-powered worksheet generation
• Data archiving and reporting

It empowers teachers and school administrators to make data-driven academic decisions while reducing administrative workload.

🎯 MVP Objectives

The Minimum Viable Product (MVP) delivers the core functionality required for schools to:

• Manage multiple user roles securely
• Structure academic content (curriculum → subjects → topics)
• Create and grade assessments
• Track learner performance over time
• Generate curriculum-aligned worksheets using AI
• Promote, repeat, and archive learners at year-end

👥 User Roles & Capabilities

🔹 Super Admin

• Register and manage schools
• Activate/Deactivate schools
• Define curricula (e.g., CAPS, Cambridge)
• Define subjects and topics per curriculum
• Assign curriculum structures per grade
• View platform-wide analytics

🔹 School Admin

• Manage teachers and learners
• Create and manage classes (e.g., Grade 1 – A)
• Assign teachers to classes
• Bulk import teachers/learners via CSV
• Promote learners to next grade
• Flag learners for repetition
• Archive Grade 3 graduates
• View school-level performance reports

🔹 Teacher

• View assigned classes
• Create and schedule assessments
• Attach supporting resources
• Grade learners individually or in bulk
• Provide feedback per learner
• View gradebook table
• Access learner performance profiles
• Generate AI-based worksheets
• Save and download worksheets

🧠 Core Features

🔐 Authentication System

• Secure login for all roles
• Role-based route protection
• Email-based password reset
• JWT-based authentication
• Password hashing

📊 Dashboard & Reporting

• School-level analytics
• Class performance trends
• Learner progress visualization
• Historical performance tracking

📝 Assessment Management

• Term-based assessments
• Curriculum-aligned grading
• Learner feedback system
• Gradebook table view
• Assessment history per learner

📂 Bulk Operations

• CSV import for teachers and learners
• Bulk assessment grading for entire class

🤖 AI Worksheet Generator

• Curriculum-constrained content generation
• Select subject, topic, difficulty level
• Define number of questions
• Download and print support
• Worksheet generation history log

📦 Academic Progression & Archiving

• End-of-year learner promotion
• Repeat grade functionality
• Automatic Grade 3 archiving
• Historical data preservation

🏗 System Architecture

The system follows a full-stack architecture:

Frontend (React + Bootstrap)
↓
Backend API (Node.js + Express)
↓
PostgreSQL Database
↓
AI API Integration

🛠 Tech Stack

Frontend

• HTML5
• CSS3
• JavaScript (ES6+)
• React
• Bootstrap
• Vite

Backend

• Node.js
• Express.js
• PostgreSQL
• RESTful API architecture

Additional Services

• Email Service (Password Reset Flow)
• AI API (Worksheet Generation)

📁 Project Structure

📦 Frontend

frontend/
│
├── src/
│ ├── components/
│ │ └── common/
│ ├── contexts/
│ ├── pages/
│ │ ├── Auth/
│ │ ├── Super-admin/
│ │ ├── School-admin/
│ │ ├── Teacher/
│ ├── styles/
│ ├── App.jsx
│ └── main.jsx


Key Components:

• AuthContext → Global authentication state
• ProtectedRoute → Role-based route protection
• Layout, Sidebar, Navbar → UI structure

📦 Backend

backend/
│
├── src/
│ ├── config/
│ ├── controllers/
│ ├── middleware/
│ ├── models/
│ ├── routes/
│ ├── services/
│ └── utils/


Architecture Pattern:

• MVC (Model–Controller–Route separation)
• Middleware-based authentication & validation
• Centralized error handling
• Activity logging

🗄 Database Overview

Core Entities:

• User
• School
• Class
• Curriculum
• Learner
• Assessment
• Worksheet

Relationship Highlights:

• A School has many Classes
• A Class has many Learners
• A Curriculum contains Subjects and Topics
• A Teacher creates Assessments
• Assessments store learner grades and feedback
• Worksheets are linked to teachers and curriculum topics

🔒 Non-Functional Requirements

• Secure password hashing
• Role-based access control
• Data validation middleware
• Performance target: < 3 seconds per major action
• Scalable multi-school architecture
• Clean, simple UI/UX design

⚙️ Installation & Setup

1️⃣ Clone the Repository

git clone <your-repository-url>
cd edulens-lms


2️⃣ Backend Setup

cd backend
npm install


Create a .env file inside /backend:

PORT=5000
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_secret_key
EMAIL_USER=your_email
EMAIL_PASS=your_email_password
AI_API_KEY=your_ai_api_key


Run the backend server:

npm run dev


3️⃣ Frontend Setup

cd frontend
npm install
npm run dev


📈 Scalability & Future Enhancements

Planned future improvements:

• Parent Portal
• Mobile Application
• Advanced analytics dashboards
• Subscription billing system
• Real-time performance tracking
• Expanded grade support beyond Grade 3

⚠️ MVP Limitations

• Limited to Grade R – Grade 3
• Requires external AI API for worksheet generation
• No parent-facing portal (yet)
• No mobile-native app

📜 License

Private Project – All rights reserved.
Not for public distribution without permission.