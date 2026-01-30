import { LoginForm } from "./_components/LoginForm";

export const metadata = {
  title: "Login - Defenz Dashboard",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-white to-slate-100">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight font-display">
            Defenz<span className="text-red-600">.Dashboard</span>
          </h1>
          <p className="text-slate-500 text-sm mt-2">
            Acesso restrito
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
