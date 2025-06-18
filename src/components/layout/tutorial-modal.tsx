
"use client";

// This component is no longer used and can be deleted.
// The tutorial/info functionality has been replaced by inline tooltips
// in AppSidebarContent.tsx.

import React from 'react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  if (!isOpen) return null;

  // Render null or a placeholder if somehow still invoked.
  return null;
}

    