import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/global.css';

// Contexts
import { AuthProvider } from './contexts/AuthContext';

// Components
import Layout from './components/common/Layout';
import ProtectedRoute from './components/common/ProtectedRoute';

// Pages
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';

// Super Admin Pages
import Schools from './pages/super-admin/Schools';
import Curricula from './pages/super-admin/Curricula';
import Users from './pages/super-admin/Users';

// School Admin Pages
import Teachers from './pages/school-admin/Teachers';
import Learners from './pages/school-admin/Learners';
import Classes from './pages/school-admin/Classes';
import Reports from './pages/school-admin/Reports'

// Teacher Pages
import TeacherClasses from './pages/teacher/Classes';
import Assessments from './pages/teacher/Assessments';
import Worksheets from './pages/teacher/Worksheets';
import Grading from './pages/teacher/Grading';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '10px',
              background: '#333',
              color: '#fff',
            },
          }}
        />
        
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Protected Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout>
                <Navigate to="/dashboard" replace />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/profile" element={
            <ProtectedRoute>
              <Layout>
                <Profile />
              </Layout>
            </ProtectedRoute>
          } />
          
          {/* Super Admin Routes */}
          <Route path="/super-admin/schools" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <Layout>
                <Schools />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/super-admin/curricula" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <Layout>
                <Curricula />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/super-admin/users" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <Layout>
                <Users />
              </Layout>
            </ProtectedRoute>
          } />
          
          {/* School Admin Routes */}
          <Route path="/school-admin/teachers" element={
            <ProtectedRoute allowedRoles={['school_admin']}>
              <Layout>
                <Teachers />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/school-admin/learners" element={
            <ProtectedRoute allowedRoles={['school_admin']}>
              <Layout>
                <Learners />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/school-admin/classes" element={
            <ProtectedRoute allowedRoles={['school_admin']}>
              <Layout>
                <Classes />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/school-admin/reports" element={
            <ProtectedRoute allowedRoles={['school_admin']}>
              <Layout>
                <Reports />
              </Layout>
            </ProtectedRoute>
          } />
          
          {/* Teacher Routes */}
          <Route path="/teacher/classes" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <Layout>
                <TeacherClasses />
              </Layout>
            </ProtectedRoute>
          } />
         
          
          <Route path="/teacher/assessments" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <Layout>
                <Assessments />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/teacher/worksheets" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <Layout>
                <Worksheets />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/teacher/grading" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <Layout>
                <Grading />
              </Layout>
            </ProtectedRoute>
          } />
          
          {/* 404 Route */}
          <Route path="*" element={
            <div className="min-vh-100 d-flex align-items-center justify-content-center">
              <div className="text-center">
                <h1 className="display-1 text-muted">404</h1>
                <p className="lead">Page not found</p>
              </div>
            </div>
          } />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;