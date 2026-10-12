import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute, { PublicOnlyRoute } from './components/common/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import FullPageLoader from './components/ui/FullPageLoader';

import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import { NotFound, Unauthorized } from './pages/StatusPage';

// Signed-in pages load on demand, so each role only downloads its own screens.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));

const Schools = lazy(() => import('./pages/super-admin/Schools'));
const SchoolDetail = lazy(() => import('./pages/super-admin/SchoolDetail'));
const Curricula = lazy(() => import('./pages/super-admin/Curricula'));
const Users = lazy(() => import('./pages/super-admin/Users'));

const SchoolClasses = lazy(() => import('./pages/school-admin/Classes'));
const Teachers = lazy(() => import('./pages/school-admin/Teachers'));
const Learners = lazy(() => import('./pages/school-admin/Learners'));
const LearnerDetail = lazy(() => import('./pages/school-admin/LearnerDetail'));
const SchoolClassDetail = lazy(() => import('./pages/school-admin/ClassDetail'));
const Reports = lazy(() => import('./pages/school-admin/Reports'));

const TeacherClasses = lazy(() => import('./pages/teacher/Classes'));
const ClassDetails = lazy(() => import('./pages/teacher/ClassDetails'));
const AddLearners = lazy(() => import('./pages/teacher/AddLearners'));
const Assessments = lazy(() => import('./pages/teacher/Assessments'));
const AssessmentGradebook = lazy(() => import('./pages/teacher/AssessmentGradebook'));
const Grading = lazy(() => import('./pages/teacher/Grading'));
const Worksheets = lazy(() => import('./pages/teacher/Worksheets'));

const page = (Component) => (
  <Suspense fallback={<FullPageLoader label="Loading page…" />}>
    <Component />
  </Suspense>
);

/** The route table; exported so tests can mount it inside a MemoryRouter. */
export const AppRoutes = () => (
  <Routes>
    <Route element={<PublicOnlyRoute />}>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
    </Route>
    {/* Reachable signed in or out: the link arrives by email. */}
    <Route path="/reset-password" element={<ResetPassword />} />

    <Route element={<ProtectedRoute />}>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={page(Dashboard)} />
        <Route path="profile" element={page(Profile)} />
        <Route path="unauthorized" element={<Unauthorized />} />

        <Route path="super-admin" element={<ProtectedRoute allowedRoles={['super_admin']} />}>
          <Route path="schools" element={page(Schools)} />
          <Route path="schools/:schoolId" element={page(SchoolDetail)} />
          <Route path="curricula" element={page(Curricula)} />
          <Route path="users" element={page(Users)} />
        </Route>

        <Route path="school-admin" element={<ProtectedRoute allowedRoles={['school_admin']} />}>
          <Route path="classes" element={page(SchoolClasses)} />
          <Route path="classes/:classId" element={page(SchoolClassDetail)} />
          <Route path="teachers" element={page(Teachers)} />
          <Route path="learners" element={page(Learners)} />
          <Route path="learners/:learnerId" element={page(LearnerDetail)} />
          <Route path="reports" element={page(Reports)} />
        </Route>

        <Route path="teacher" element={<ProtectedRoute allowedRoles={['teacher']} />}>
          <Route path="classes" element={page(TeacherClasses)} />
          <Route path="classes/:classId" element={page(ClassDetails)} />
          <Route path="classes/:classId/add-learners" element={page(AddLearners)} />
          <Route path="assessments" element={page(Assessments)} />
          <Route path="assessments/:assessmentId/gradebook" element={page(AssessmentGradebook)} />
          <Route path="grading" element={page(Grading)} />
          <Route path="worksheets" element={page(Worksheets)} />
        </Route>
      </Route>
    </Route>

    <Route path="*" element={<NotFound />} />
  </Routes>
);

function App() {
  return (
    <BrowserRouter>
      {/* Respect the OS "reduce motion" setting for every framer-motion animation. */}
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              className: 'el-toast',
              success: { iconTheme: { primary: '#15803d', secondary: '#fff' } },
              error: { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
            }}
          />

          <AppRoutes />
        </AuthProvider>
      </MotionConfig>
    </BrowserRouter>
  );
}

export default App;
