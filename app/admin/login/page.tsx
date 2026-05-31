import { Suspense } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function AdminLoginPage() {
  return (
    <main className="container flex min-h-screen max-w-sm flex-col justify-center py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-cricket-pitch">Admin Login</CardTitle>
          <CardDescription>
            Sign in with the admin email/password configured in Supabase Auth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
