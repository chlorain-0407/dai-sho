import React from 'react';
import { ProjectModal } from './ProjectModal';
import { Project } from '../../types';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProject?: Project | null;
  onSuccess?: (project: Project) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  initialProject,
  onSuccess,
}) => {
  return (
    <ProjectModal
      isOpen={isOpen}
      onClose={onClose}
      initialProject={initialProject}
      onSuccess={onSuccess}
    />
  );
};
