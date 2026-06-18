import type { ProofStatus } from "./recall-data";
import type { ReactNode } from "react";

type ProofLabelProps = {
  status: ProofStatus;
  children?: ReactNode;
};

export default function ProofLabel({ status, children }: ProofLabelProps) {
  const className = `proof-label proof-label-${status
    .toLowerCase()
    .replaceAll(" ", "-")}`;

  return (
    <span className={className}>
      <span className="proof-label-mark" aria-hidden="true" />
      <strong>{status}</strong>
      {children ? <em>{children}</em> : null}
    </span>
  );
}
