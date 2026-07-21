import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { PendingApprovalNotice } from "@/components/auth/pending-approval-notice";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

describe("PendingApprovalNotice", () => {
  it("explica que a conta aguarda aprovação do administrador", () => {
    const html = render(<PendingApprovalNotice />);

    expect(html).toContain("aguarda aprovação");
  });

  it("orienta a sair e entrar de novo, já que a sessão só reflete a aprovação no próximo login", () => {
    const html = render(<PendingApprovalNotice />);

    expect(html).toContain("saia e entre novamente");
  });

  it("oferece saída pelo signout existente", () => {
    const html = render(<PendingApprovalNotice />);

    expect(html).toContain('action="/api/auth/signout"');
    expect(html).toContain('method="post"');
    expect(html).toContain("Sair");
  });
});
