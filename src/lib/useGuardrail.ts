import { useState, useCallback } from "react";
import { type GuardrailConfig } from "./guardrail";

interface GuardrailState {
  config: GuardrailConfig;
  onConfirm: () => void | Promise<void>;
}

export function useGuardrail() {
  const [pending, setPending] = useState<GuardrailState | null>(null);

  const request = useCallback(
    (config: GuardrailConfig, onConfirm: () => void | Promise<void>) => {
      setPending({ config, onConfirm });
    },
    []
  );

  const handleConfirm = useCallback(async () => {
    if (!pending) return;
    await pending.onConfirm();
    setPending(null);
  }, [pending]);

  const handleCancel = useCallback(() => {
    setPending(null);
  }, []);

  return { pending, request, handleConfirm, handleCancel };
}
