import React from 'react';
import { UnitModal } from './UnitModal';
import { Unit } from '../../types';

interface NewUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  initialUnit?: Unit | null;
  onSuccess?: (unit: Unit) => void;
}

export const NewUnitModal: React.FC<NewUnitModalProps> = ({
  isOpen,
  onClose,
  defaultProjectId,
  initialUnit,
  onSuccess,
}) => {
  return (
    <UnitModal
      isOpen={isOpen}
      onClose={onClose}
      defaultProjectId={defaultProjectId}
      initialUnit={initialUnit}
      onSuccess={onSuccess}
    />
  );
};
