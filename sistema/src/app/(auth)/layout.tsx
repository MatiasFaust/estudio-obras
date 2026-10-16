import { Brand } from "@/components/common/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <Brand className="mb-6 justify-center" />
        {children}
      </div>
    </main>
  );
}
