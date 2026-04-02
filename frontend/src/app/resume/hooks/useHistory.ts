// =============================================
// useHistory — 通用撤销/重做状态管理 Hook
// =============================================
// 原理：
//   维护一个状态快照栈（past / present / future），
//   每次 set 操作将旧 present 推入 past，新值成为 present，
//   清空 future（新编辑后不可 redo 之前分支）。
//   undo 时 present → future，past.pop() → present。
//   redo 时 present → past，future.pop() → present。
//   maxHistory 限制栈深，防止内存膨胀。
//   使用 JSON 序列化去重：如果新值与 present 相同（深比较），
//   不插入新快照——避免无意义的 undo 步骤。
// =============================================

"use client";

import { useState, useCallback, useRef } from "react";

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

/**
 * useHistory — 提供 undo/redo 功能的状态管理 Hook
 *
 * @param initialState 初始值
 * @param maxHistory   最大历史栈深度（默认 50）
 * @returns [state, setState, { undo, redo, canUndo, canRedo, reset }]
 */
export function useHistory<T>(initialState: T, maxHistory = 50) {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  // 缓存 JSON 序列化用于深比较，避免相同内容重复入栈
  const presentJsonRef = useRef(JSON.stringify(initialState));

  const set = useCallback(
    (newPresent: T | ((prev: T) => T)) => {
      setHistory((prev) => {
        const resolved =
          typeof newPresent === "function"
            ? (newPresent as (p: T) => T)(prev.present)
            : newPresent;

        // 深比较：如果值未变，不记录历史
        const newJson = JSON.stringify(resolved);
        if (newJson === presentJsonRef.current) return prev;
        presentJsonRef.current = newJson;

        const newPast = [...prev.past, prev.present];
        // 裁剪历史栈到 maxHistory
        if (newPast.length > maxHistory) {
          newPast.splice(0, newPast.length - maxHistory);
        }
        return { past: newPast, present: resolved, future: [] };
      });
    },
    [maxHistory]
  );

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const newPast = [...prev.past];
      const newPresent = newPast.pop()!;
      presentJsonRef.current = JSON.stringify(newPresent);
      return {
        past: newPast,
        present: newPresent,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const newFuture = [...prev.future];
      const newPresent = newFuture.shift()!;
      presentJsonRef.current = JSON.stringify(newPresent);
      return {
        past: [...prev.past, prev.present],
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  /** 重置历史（例如加载新数据时调用） */
  const reset = useCallback((newPresent: T) => {
    presentJsonRef.current = JSON.stringify(newPresent);
    setHistory({ past: [], present: newPresent, future: [] });
  }, []);

  return {
    state: history.present,
    set,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    reset,
  };
}
