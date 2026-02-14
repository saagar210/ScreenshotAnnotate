import { useState, useCallback } from 'react';
import type { Annotation } from '../types';

const MAX_UNDO_DEPTH = 50;

interface AnnotationState {
  annotations: Annotation[];
  undoStack: Annotation[][];
  redoStack: Annotation[][];
}

export function useAnnotations() {
  const [state, setState] = useState<AnnotationState>({
    annotations: [],
    undoStack: [],
    redoStack: [],
  });

  const addAnnotation = useCallback((annotation: Annotation) => {
    setState(prev => {
      // Save current state to undo stack
      const newUndoStack = [...prev.undoStack, prev.annotations];
      // Limit undo stack size
      if (newUndoStack.length > MAX_UNDO_DEPTH) {
        newUndoStack.shift();
      }

      return {
        annotations: [...prev.annotations, annotation],
        undoStack: newUndoStack,
        redoStack: [], // Clear redo stack when new action is taken
      };
    });
  }, []);

  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    setState(prev => {
      // Save current state to undo stack
      const newUndoStack = [...prev.undoStack, prev.annotations];
      if (newUndoStack.length > MAX_UNDO_DEPTH) {
        newUndoStack.shift();
      }

      return {
        annotations: prev.annotations.map(a =>
          a.id === id ? { ...a, ...updates } as Annotation : a
        ),
        undoStack: newUndoStack,
        redoStack: [],
      };
    });
  }, []);

  const removeAnnotation = useCallback((id: string) => {
    setState(prev => {
      const newUndoStack = [...prev.undoStack, prev.annotations];
      if (newUndoStack.length > MAX_UNDO_DEPTH) {
        newUndoStack.shift();
      }

      return {
        annotations: prev.annotations.filter(a => a.id !== id),
        undoStack: newUndoStack,
        redoStack: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState(prev => {
      if (prev.undoStack.length === 0) return prev;

      const previousState = prev.undoStack[prev.undoStack.length - 1];
      const newUndoStack = prev.undoStack.slice(0, -1);
      const newRedoStack = [...prev.redoStack, prev.annotations];

      return {
        annotations: previousState,
        undoStack: newUndoStack,
        redoStack: newRedoStack,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState(prev => {
      if (prev.redoStack.length === 0) return prev;

      const nextState = prev.redoStack[prev.redoStack.length - 1];
      const newRedoStack = prev.redoStack.slice(0, -1);
      const newUndoStack = [...prev.undoStack, prev.annotations];

      return {
        annotations: nextState,
        undoStack: newUndoStack,
        redoStack: newRedoStack,
      };
    });
  }, []);

  const clear = useCallback(() => {
    setState(prev => {
      if (prev.annotations.length === 0) return prev;

      const newUndoStack = [...prev.undoStack, prev.annotations];
      if (newUndoStack.length > MAX_UNDO_DEPTH) {
        newUndoStack.shift();
      }

      return {
        annotations: [],
        undoStack: newUndoStack,
        redoStack: [],
      };
    });
  }, []);

  const setAnnotations = useCallback((annotations: Annotation[]) => {
    setState(prev => ({
      annotations,
      undoStack: [...prev.undoStack, prev.annotations],
      redoStack: [],
    }));
  }, []);

  return {
    annotations: state.annotations,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    undo,
    redo,
    clear,
    setAnnotations,
    canUndo: state.undoStack.length > 0,
    canRedo: state.redoStack.length > 0,
  };
}
