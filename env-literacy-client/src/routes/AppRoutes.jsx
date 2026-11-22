import { Navigate, Route, Routes } from 'react-router-dom';
import { HOME, useAuth } from '../hooks/useAuth.jsx';
import Layout from '../components/Layout.jsx';
import { Loading } from '../components/ui.jsx';
import { ForgotPage, LoginPage, RegisterPage } from '../pages/Auth.jsx';
import { CheckInPage, QuizListPage, QuizResultPage, QuizTakePage, StudentHome } from '../pages/Student.jsx';
import { ClassOverviewPage, ClassesPage, QuizManagerPage } from '../pages/Teacher.jsx';
import { AuditPage, InstitutionDashboard } from '../pages/Institution.jsx';
import { AccountPage, AnnouncementsPage, ChallengesPage, LearnPage, QuizResultsPage } from '../pages/More.jsx';
import Landing from '../pages/Landing.jsx';
import RegionalPage from '../pages/Regional.jsx';
import { ActivityPage, InstitutionsPage, PeoplePage, QuestionBankPage, SettingsPage } from '../pages/Admin.jsx';

// Route guard by role (the server enforces the same rules; this just avoids dead ends).
function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME[user.role]} replace />;
  return children;
}
const G = (roles, el) => <Guard roles={roles}>{el}</Guard>;

function Root() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Layout /> : <Navigate to="/welcome" replace />;
}

export default function AppRoutes() {
  const { user } = useAuth();
  const publicRedirect = user ? <Navigate to={HOME[user.role]} replace /> : null;
  return (
    <Routes>
      <Route path="/welcome" element={publicRedirect || <Landing />} />
      <Route path="/login" element={publicRedirect || <LoginPage />} />
      <Route path="/register" element={publicRedirect || <RegisterPage />} />
      <Route path="/forgot" element={<ForgotPage />} />
      <Route element={<Root />}>
        <Route index element={user && user.role !== 'student' ? <Navigate to={HOME[user.role]} replace /> : G(['student'], <StudentHome />)} />
        <Route path="quizzes" element={G(['student', 'teacher', 'inst_admin'], user?.role === 'student' ? <QuizListPage /> : <QuizManagerPage />)} />
        <Route path="quizzes/:id" element={G(['student'], <QuizTakePage />)} />
        <Route path="quizzes/:id/result" element={G(['student'], <QuizResultPage />)} />
        <Route path="quizzes/:id/results" element={G(['teacher', 'inst_admin'], <QuizResultsPage />)} />
        <Route path="practice" element={G(['student'], <LearnPage />)} />
        <Route path="challenges" element={G(['student'], <ChallengesPage />)} />
        <Route path="announcements" element={G(['teacher', 'inst_admin'], <AnnouncementsPage />)} />
        <Route path="account" element={G(null, <AccountPage />)} />
        <Route path="checkin" element={G(['student'], <CheckInPage />)} />
        <Route path="classes" element={G(['teacher', 'inst_admin'], <ClassesPage />)} />
        <Route path="classes/:id" element={G(['teacher', 'inst_admin', 'super_admin'], <ClassOverviewPage />)} />
        <Route path="institution" element={G(['inst_admin'], <InstitutionDashboard />)} />
        <Route path="audit" element={G(['inst_admin'], <AuditPage />)} />
        <Route path="people" element={G(['inst_admin', 'super_admin'], <PeoplePage />)} />
        <Route path="region" element={G(['regional_admin', 'super_admin'], <RegionalPage />)} />
        <Route path="questions" element={G(['regional_admin', 'super_admin'], <QuestionBankPage />)} />
        <Route path="institutions" element={G(['super_admin'], <InstitutionsPage />)} />
        <Route path="settings" element={G(['super_admin'], <SettingsPage />)} />
        <Route path="activity" element={G(['super_admin'], <ActivityPage />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
