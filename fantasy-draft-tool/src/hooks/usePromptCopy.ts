import { useState } from "react";
import { buildAdvicePrompt, type AdviceContext } from "../lib/advice";

export function usePromptCopy(getContext: () => AdviceContext | null) {
  const [promptCopied, setPromptCopied] = useState(false);
  const [sysCopied, setSysCopied] = useState(false);
  const [usrCopied, setUsrCopied] = useState(false);

  const copySystemPrompt = () => {
    const ctx = getContext();
    if (!ctx) return;
    const { system } = buildAdvicePrompt(ctx);
    navigator.clipboard.writeText(system).then(() => {
      setSysCopied(true);
      setTimeout(() => setSysCopied(false), 2000);
    });
  };

  const copyUserPrompt = () => {
    const ctx = getContext();
    if (!ctx) return;
    const { user } = buildAdvicePrompt(ctx);
    navigator.clipboard.writeText(user).then(() => {
      setUsrCopied(true);
      setTimeout(() => setUsrCopied(false), 2000);
    });
  };

  const copyFullPrompt = () => {
    const ctx = getContext();
    if (!ctx) return;
    const { system, user } = buildAdvicePrompt(ctx);
    navigator.clipboard.writeText(JSON.stringify({ system, user })).then(() => {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    });
  };

  return { promptCopied, sysCopied, usrCopied, copySystemPrompt, copyUserPrompt, copyFullPrompt };
}
