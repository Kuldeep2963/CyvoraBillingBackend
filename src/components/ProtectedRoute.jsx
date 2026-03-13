import { Navigate } from "react-router-dom";
import { Box, Spinner } from "@chakra-ui/react";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, loading } = useAuth();

  // Still loading auth
  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
        <Spinner
          thickness="4px"
          speed="0.65s"
          emptyColor="gray.200"
          color="blue.500"
          size="xl"
        />
      </Box>
    );
  }

  // Not logged in
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Wrong role - normalize to lowercase for comparison
  if (allowedRoles) {
    const userRole = user?.role?.trim().toLowerCase();
    const normalizedRoles = allowedRoles.map((role) => role.toLowerCase());
    if (!normalizedRoles.includes(userRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;