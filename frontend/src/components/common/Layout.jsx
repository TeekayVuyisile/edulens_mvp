import React from "react";
import { Container } from "react-bootstrap";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { useAuth } from "../../contexts/AuthContext";

const Layout = ({ children }) => {
  const { user } = useAuth();

  const getSidebarItems = () => {
    if (!user) return [];

    const commonItems = [
      { path: "/dashboard", icon: "grid", label: "Dashboard" },
      { path: "/profile", icon: "person", label: "Profile" },
    ];

    const roleBasedItems = {
      super_admin: [
        { path: "/super-admin/schools", icon: "building", label: "Schools" },
        { path: "/super-admin/curricula", icon: "book", label: "Curricula" },
         { path: '/super-admin/users', icon: 'people', label: 'Users' }, // Add this
      ],
      school_admin: [
        { path: "/school-admin/classes", icon: "collection", label: "Classes" },
        {
          path: "/school-admin/teachers",
          icon: "person-badge",
          label: "Teachers",
        },
        { path: "/school-admin/learners", icon: "people", label: "Learners" },
        
        { path: "/school-admin/reports", icon: "bar-chart", label: "Reports" }, // Add this line
      ],
      teacher: [
        { path: "/teacher/classes", icon: "collection", label: "My Classes" },
        {
          path: "/teacher/assessments",
          icon: "clipboard",
          label: "Assessments",
        },
        { path: "/teacher/grading", icon: "pencil", label: "Grading" },
        {
          path: "/teacher/worksheets",
          icon: "file-earmark-text",
          label: "Worksheets",
        },
        
      ],
      learner: [
        {
          path: "/learner/performance",
          icon: "graph-up",
          label: "My Performance",
        },
        { path: "/learner/assignments", icon: "journal", label: "Assignments" },
        { path: "/learner/resources", icon: "folder", label: "Resources" },
      ],
    };

    return [...commonItems, ...(roleBasedItems[user.role] || [])];
  };

  return (
    <div className="d-flex vh-100">
      {user && <Sidebar items={getSidebarItems()} />}
      <div className="flex-grow-1 d-flex flex-column">
        {user && <Navbar />}
        <main className="flex-grow-1 p-3 p-md-4" style={{ overflowY: "auto" }}>
          <Container fluid>{children}</Container>
        </main>
      </div>
    </div>
  );
};

export default Layout;
