import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main>
      {/* useSearchParams (?next=) exige Suspense em página prerenderizada */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
