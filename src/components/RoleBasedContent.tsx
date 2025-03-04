import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface RoleBasedContentProps {
  adminContent: React.ReactNode;
  userContent: React.ReactNode;
}

const RoleBasedContent: React.FC<RoleBasedContentProps> = ({ adminContent, userContent }) => {
  const { isAdmin } = useAuth();

  return (
    <div>
      {isAdmin ? adminContent : userContent}
    </div>
  );
};

export default RoleBasedContent;
